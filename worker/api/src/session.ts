/**
 * セッショントークン（JWT / HS256）の発行と検証。
 *
 * ■ なぜ HS256（共通鍵）にしたか
 * 当初の設計（PROJECT_SPEC.md §5）は RS256 だった。フロント側でも署名を検証できる、
 * という理由からである。しかし今回の要件は逆で、
 * **フロントに権限判定をさせない**ことが目的になった。
 * 検証者が Worker だけなら共通鍵で足り、鍵の配布も鍵ペアの管理も要らない。
 * フロントはトークンを「預かって送るだけ」の存在にする。
 *
 * ■ このトークンでできないこと
 * 中身（role）は Base64URL なので誰でも「読める」。読まれて困る情報は入れない。
 * 大事なのは読めないことではなく、**署名なしには作れない**ことである。
 */
import type { Env, Role, SessionClaims } from './types'

/** 権限の並び（free < premium < creator < master）。検証・上下比較の両方で使う唯一の正 */
const ROLE_RANK: Record<Role, number> = { free: 0, premium: 1, creator: 2, master: 3 }

const ALG = { name: 'HMAC', hash: 'SHA-256' } as const
/**
 * 30日（2026-08-10変更・元は24時間）。
 *
 * 24時間だと「ログインしたのに数日後に無言でロックに戻る」という
 * 体験になっていた（再ログイン導線が未実装のため）。継続課金者は
 * 月1回程度の頻度で同じキーを入れ直せば済むよう、月次の運用リズム
 * （毎月1日の棚卸し）に合わせて伸ばした。
 *
 * ■ トレードオフ（セキュリティ検証で確認済み・2026-08-10）
 * TTLを伸ばすほど「退会後、運営者が手動で失効させるまでの猶予」も伸びる。
 * revokedフラグは新規セッション発行を止めるだけで、発行済みトークンを
 * 無効化する仕組み（ブラックリスト等）は無い。最悪の場合、退会直後に
 * キーを入れ直されていると、そこから最大30日は使われ続ける。
 * 30名規模の運用として許容し、退会時は check-license-expiry.mjs で
 * 実際の失効予定日を確認できるようにした。
 */
const TTL_SECONDS = 60 * 60 * 24 * 30

const enc = new TextEncoder()

function b64urlEncode(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(input: string): Uint8Array {
  const s = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const bin = atob(s + pad)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

async function key(env: Env): Promise<CryptoKey> {
  const secret = env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    // 弱い鍵で動いてしまうと「守っているつもり」が一番危ない。起動時に落とす
    throw new Error('SESSION_SECRET が未設定、または32文字未満です')
  }
  return crypto.subtle.importKey('raw', enc.encode(secret), ALG, false, ['sign', 'verify'])
}

/** 一定時間で同じ入力なら同じ結果になる比較（タイミング差を残さない） */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export async function issueSession(
  role: Role,
  src: string,
  env: Env,
): Promise<{ token: string; expiresAt: number }> {
  const now = Math.floor(Date.now() / 1000)
  const claims: SessionClaims = { role, src, iat: now, exp: now + TTL_SECONDS }

  const header = b64urlEncode(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const payload = b64urlEncode(enc.encode(JSON.stringify(claims)))
  const signingInput = `${header}.${payload}`

  const sig = await crypto.subtle.sign(ALG, await key(env), enc.encode(signingInput))
  return {
    token: `${signingInput}.${b64urlEncode(new Uint8Array(sig))}`,
    expiresAt: claims.exp,
  }
}

/**
 * トークンを検証して中身を返す。少しでも怪しければ null。
 * null は「無効」であって「無料ユーザー」ではない点に注意（呼び出し側で free に倒す）。
 */
export async function verifySession(
  token: string | null,
  env: Env,
): Promise<SessionClaims | null> {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, payload, sig] = parts

  // alg=none などのアルゴリズム差し替え攻撃を防ぐため、ヘッダーを固定で検査する
  try {
    const h = JSON.parse(new TextDecoder().decode(b64urlDecode(header))) as Record<string, unknown>
    if (h.alg !== 'HS256' || h.typ !== 'JWT') return null
  } catch {
    return null
  }

  let expected: ArrayBuffer
  try {
    expected = await crypto.subtle.sign(ALG, await key(env), enc.encode(`${header}.${payload}`))
  } catch {
    return null
  }
  if (!timingSafeEqual(new Uint8Array(expected), b64urlDecode(sig))) return null

  try {
    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(payload))) as SessionClaims
    if (typeof claims.exp !== 'number' || claims.exp < Math.floor(Date.now() / 1000)) return null
    if (ROLE_RANK[claims.role] === undefined) return null
    return claims
  } catch {
    return null
  }
}

/** Authorization: Bearer <token> を取り出す */
export function bearerFrom(request: Request): string | null {
  const h = request.headers.get('Authorization') ?? ''
  const m = /^Bearer\s+(.+)$/i.exec(h.trim())
  return m ? m[1] : null
}

/** 上位ロールは下位をすべて包含する（PROJECT_SPEC.md の isPaid と同じ考え方） */
export function satisfies(actual: Role, required: Role): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required]
}
