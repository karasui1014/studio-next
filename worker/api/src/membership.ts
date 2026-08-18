/**
 * 会員状態の解決 — ここが「権限の正」を決める唯一の場所。
 *
 * ■ 差し替え口としての設計
 * 認証方式（何をもって会員と認めるか）は将来変わる。
 * 画面もトークン発行も触らずに済むよう、判定はこの1ファイルに閉じ込める。
 *
 *   現在   : ライセンスキー方式（運営者が発行し、KVの名簿と突き合わせる）
 *   将来   : Google OAuth → YouTubeチャンネルID → 会員名簿（PROJECT_SPEC.md §5）
 *
 * 将来の切り替えは resolveMembership() に分岐を1つ足すだけで済む。
 * 呼び出し側（index.ts）も、フロントも、この変更を知らなくてよい。
 *
 * ■ 絶対に守ること
 * クライアントから送られてきた role を、そのまま信用してはならない。
 * role は必ずこの関数がサーバー側で決める。
 */
import type { Env, Role } from './types'

export interface Membership {
  role: Role
  /** 何をもって会員と判定したか。監査用 */
  source: 'license' | 'youtube' | 'dev'
}

/** ライセンスキーの正規化。表記ゆれで弾かれないようにする */
function normalizeKey(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '').replace(/-/g, '')
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const VALID_ROLES: Role[] = ['free', 'premium', 'creator', 'master']

function toRole(value: unknown): Role | null {
  return typeof value === 'string' && (VALID_ROLES as string[]).includes(value)
    ? (value as Role)
    : null
}

/**
 * ライセンスキーから会員状態を引く。
 *
 * 名簿は KV に `license:<キーのハッシュ>` → `{"role":"premium"}` の形で入れる。
 * 生のキーは保存しない（漏れても総当たりの手がかりを与えないため）。
 */
async function resolveByLicense(key: string, env: Env): Promise<Membership | null> {
  const normalized = normalizeKey(key)
  // 短すぎるキーは総当たりの的になるので、長さで足切りする
  if (normalized.length < 12) return null

  const hash = await sha256Hex(`${normalized}:${env.LICENSE_PEPPER ?? ''}`)
  const raw = await env.ROSTER_KV.get(`license:${hash}`)
  if (!raw) return null

  try {
    const rec = JSON.parse(raw) as Record<string, unknown>
    // 失効を明示できるようにしておく（返金・退会時に revoked を立てる）
    if (rec.revoked === true) return null
    const role = toRole(rec.role)
    if (!role || role === 'free') return null

    // 最終ログイン日時を記録する。
    // セッションTTLが30日に伸びたことで（session.ts参照）、退会時に
    // 「実際いつまで使われ続けるか」を運営者が確認できる必要が出た。
    // ここが最後に成功したログインの日時＝現在有効なセッションの起点になる。
    // 失敗してもログイン自体は成功させる（記録の失敗で締め出さない）
    try {
      await env.ROSTER_KV.put(
        `license:${hash}`,
        JSON.stringify({ ...rec, lastLoginAt: new Date().toISOString() }),
      )
    } catch {
      /* 記録できなくてもログインは通す */
    }

    return { role, source: 'license' }
  } catch {
    return null
  }
}

/**
 * 【将来】Google OAuth で得たチャンネルIDから会員状態を引く。
 *
 * 実装の前提が2つ未達のため、まだ有効にしていない:
 *   ① 案A' の成立検証（会員CSVにチャンネルIDが含まれるか）— PROJECT_SPEC.md §5
 *   ② OAuth審査（独自ドメインが前提。約10日）
 *
 * 検証が通ったら、ここに auth-test PoC の照合ロジックを移植して
 * resolveMembership() の分岐を有効にする。それ以外の場所は変更不要。
 */
async function resolveByYouTube(_channelId: string, _env: Env): Promise<Membership | null> {
  return null
}

/**
 * 開発・QA専用。DevRoleSwitcher に本物のトークンを渡すための口。
 *
 * ⚠️ 本番では必ず無効になる。有効化の条件は環境変数 DEV_ROLE_OVERRIDE === 'true' で、
 * この値は .dev.vars（Git管理外・ローカル専用）にしか書かない。
 * wrangler secret で本番に設定しない限り、本番では undefined になり常に false。
 */
function resolveByDevOverride(role: unknown, env: Env): Membership | null {
  if (env.DEV_ROLE_OVERRIDE !== 'true') return null
  const r = toRole(role)
  if (!r) return null
  return { role: r, source: 'dev' }
}

export interface Credential {
  mode: 'license' | 'youtube' | 'dev'
  licenseKey?: string
  channelId?: string
  role?: string
}

/**
 * 資格情報から会員状態を決める。ここを通らない role は存在しない。
 * 判定できなければ null を返す（＝無料扱いですらなく、セッションを発行しない）。
 */
export async function resolveMembership(
  cred: Credential,
  env: Env,
): Promise<Membership | null> {
  switch (cred.mode) {
    case 'license':
      return cred.licenseKey ? resolveByLicense(cred.licenseKey, env) : null
    case 'youtube':
      return cred.channelId ? resolveByYouTube(cred.channelId, env) : null
    case 'dev':
      return resolveByDevOverride(cred.role, env)
    default:
      return null
  }
}
