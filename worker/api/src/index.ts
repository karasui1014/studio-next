/**
 * Studio Next 限定コンテンツ配信 API
 *
 * ■ この Worker の役目
 * 「権限のない相手には、限定コンテンツを *返さない*」——これだけ。
 * 画面のぼかしやロック表示は見せ方の問題であって、アクセス制御ではない。
 * 制御はここにしか存在しない。
 *
 * ■ 経路
 *   POST /api/session          資格情報 → 検証 → セッショントークン発行
 *   GET  /api/me               トークン → 権限を返す（フロントの表示判断はこれを使う）
 *   GET  /api/content/premium  premium 以上にだけ本文を返す
 *   GET  /api/content/master   master のみ
 *   GET  /api/health           死活確認（認証不要・秘密は返さない）
 *
 * ■ 限定コンテンツの持ち方 —— KV に置く（Workerには埋め込まない）
 * Worker のコードに同梱すると、更新のたびに再デプロイが要り、
 * 手元にファイルが無い環境（CI など）からデプロイすると内容が消える。
 * KV に置けば、Worker を何度デプロイしても内容はそのまま残り、
 * 内容の差し替えだけを単独で行える。
 *
 * 投入:  npm run premium:push   （scripts/push-premium-content.mjs）
 * 場所:  KV の `premium:content`
 * public/ には決して置かない。置いた時点で URL 直打ちで読めてしまう。
 */
import { isSerialRevoked, resolveMembership, type Credential } from './membership'
import { bearerFrom, issueSession, satisfies, verifySession } from './session'
import type { Env, Role, SessionClaims } from './types'

interface PremiumContent {
  updatedAt?: string
  prompts?: Record<string, unknown>
  picks?: Record<string, unknown>
  pickNotes?: Record<string, unknown>
  master?: Record<string, unknown>
}

const EMPTY: PremiumContent = { prompts: {}, picks: {}, pickNotes: {} }

/**
 * KV から限定コンテンツを読む。
 * 入っていなければ空を返す（本文を捏造しない）。
 * 「空が返る」状態は /api/health の counts が 0 になるので外から検知できる。
 */
async function loadPremium(env: Env): Promise<PremiumContent> {
  const raw = await env.ROSTER_KV.get('premium:content')
  if (!raw) return EMPTY
  try {
    return JSON.parse(raw) as PremiumContent
  } catch {
    return EMPTY
  }
}

const DEFAULT_ORIGINS = 'http://localhost:5180,https://karasui1014.github.io'

function corsHeaders(origin: string | null, env: Env): Headers {
  const allowed = (env.ALLOWED_ORIGINS ?? DEFAULT_ORIGINS).split(',').map((s) => s.trim())
  const h = new Headers()
  if (origin && allowed.includes(origin)) h.set('Access-Control-Allow-Origin', origin)
  h.set('Vary', 'Origin')
  h.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  h.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  h.set('Access-Control-Max-Age', '86400')
  return h
}

function json(body: unknown, status: number, cors: Headers): Response {
  const h = new Headers(cors)
  h.set('Content-Type', 'application/json; charset=utf-8')
  // 限定コンテンツを中間キャッシュに残さない。共有キャッシュ経由の漏洩を防ぐ
  h.set('Cache-Control', 'no-store, private')
  return new Response(JSON.stringify(body), { status, headers: h })
}

/**
 * トークンを検証し、**そのライセンスがまだ生きているか**まで確かめる。
 *
 * ■ ここが失効の即時反映の要（2026-08-19追加）
 * 署名と有効期限だけを見ていた頃は、キーを失効させても発行済みトークンが
 * 最大30日そのまま通っていた。ここでKVの失効フラグを見ることで、
 * **次にアプリが開かれた時点**で権限が落ちるようになる。
 * フロントは起動時に必ず `/api/me` を呼ぶので、追加の通信は発生しない。
 *
 * ■ `sid` が無いトークン（経過措置）
 * この仕組みより前に発行されたトークンには連番が入っていない。
 * 弾くと既存の会員が全員キーを入れ直す羽目になるため、従来どおり通す。
 * TTLが30日なので、この経過措置は最長30日で自然に終わる。
 */
async function authenticate(request: Request, env: Env): Promise<SessionClaims | null> {
  const claims = await verifySession(bearerFrom(request), env)
  if (!claims) return null
  if (claims.sid && (await isSerialRevoked(claims.sid, env))) return null
  return claims
}

/**
 * 権限を要求する。満たさなければ Response（エラー）を返す。
 * 「未ログイン」と「権限不足」を区別して返す——案内文を出し分けられるように。
 * 失効済みのライセンスは「未ログイン」側に倒れる（＝本文は返らない）。
 */
async function require(
  request: Request,
  env: Env,
  cors: Headers,
  needed: Role,
): Promise<{ role: Role } | Response> {
  const claims = await authenticate(request, env)
  if (!claims) {
    return json({ error: 'unauthenticated', message: 'ログインが必要です' }, 401, cors)
  }
  if (!satisfies(claims.role, needed)) {
    return json(
      { error: 'forbidden', message: `${needed} 以上のプランが必要です`, role: claims.role },
      403,
      cors,
    )
  }
  return { role: claims.role }
}

/** 簡易レート制限。ライセンスキーの総当たりを鈍らせる */
async function tooManyAttempts(request: Request, env: Env): Promise<boolean> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'local'
  const bucket = `rl:session:${ip}:${Math.floor(Date.now() / 60000)}`
  const n = Number((await env.ROSTER_KV.get(bucket)) ?? '0') + 1
  await env.ROSTER_KV.put(bucket, String(n), { expirationTtl: 120 })
  return n > 10
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const cors = corsHeaders(request.headers.get('Origin'), env)

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

    // --- 死活確認 -------------------------------------------------
    if (request.method === 'GET' && url.pathname === '/api/health') {
      const c = await loadPremium(env)
      const counts = {
        prompts: Object.keys(c.prompts ?? {}).length,
        picks: Object.keys(c.picks ?? {}).length,
        pickNotes: Object.keys(c.pickNotes ?? {}).length,
      }
      return json(
        {
          ok: true,
          // 「件数」だけ返す。中身は返さない。0なら未投入だと外から気づける
          counts,
          contentLoaded: counts.prompts + counts.picks + counts.pickNotes > 0,
          updatedAt: c.updatedAt ?? null,
          devRoleOverride: env.DEV_ROLE_OVERRIDE === 'true',
        },
        200,
        cors,
      )
    }

    // --- セッション発行 --------------------------------------------
    if (request.method === 'POST' && url.pathname === '/api/session') {
      if (await tooManyAttempts(request, env)) {
        return json({ error: 'rate_limited', message: '試行が多すぎます' }, 429, cors)
      }
      let cred: Credential
      try {
        cred = (await request.json()) as Credential
      } catch {
        return json({ error: 'bad_request' }, 400, cors)
      }

      // ここが唯一 role を決める場所。リクエストの role をそのまま使うことはない
      const membership = await resolveMembership(cred, env)
      if (!membership) {
        return json(
          { error: 'invalid_credential', message: '確認できませんでした' },
          401,
          cors,
        )
      }

      // 連番を封じる。以後このトークンは失効確認の対象になる
      const { token, expiresAt } = await issueSession(
        membership.role,
        membership.source,
        env,
        membership.serial,
      )
      return json({ token, role: membership.role, source: membership.source, expiresAt }, 200, cors)
    }

    // --- 自分の権限 ------------------------------------------------
    if (request.method === 'GET' && url.pathname === '/api/me') {
      // 失効済みライセンスのトークンはここで free に倒れる（→ authenticate）。
      // フロントは起動時にこれを呼ぶので、退会処理が次回起動で効く
      const claims = await authenticate(request, env)
      // 無効なトークンは「free」として答える。ここで役割を捏造しないことが肝
      // expはセッションの有効期限（秒・UNIX時間）。画面側で「いつまで有効か」を示すために返す
      return json(
        { role: claims?.role ?? 'free', authenticated: !!claims, exp: claims?.exp ?? null },
        200,
        cors,
      )
    }

    // --- 限定コンテンツ（Premium以上）-------------------------------
    if (request.method === 'GET' && url.pathname === '/api/content/premium') {
      const gate = await require(request, env, cors, 'premium')
      if (gate instanceof Response) return gate
      const c = await loadPremium(env)
      return json(
        { prompts: c.prompts ?? {}, picks: c.picks ?? {}, pickNotes: c.pickNotes ?? {} },
        200,
        cors,
      )
    }

    // --- 限定コンテンツ（Masterのみ）--------------------------------
    if (request.method === 'GET' && url.pathname === '/api/content/master') {
      const gate = await require(request, env, cors, 'master')
      if (gate instanceof Response) return gate
      const c = await loadPremium(env)
      return json({ master: c.master ?? {} }, 200, cors)
    }

    return json({ error: 'not_found' }, 404, cors)
  },
}
