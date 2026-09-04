/**
 * ふたりの家計 —— 暗号文の預かり所
 *
 * ■ この経路の役目
 * 夫婦2人が同じ数字を見られるように、**暗号文をそのまま預かって返す**。それだけ。
 * 中身は端末側で暗号化されてから届くので、この Worker も KV も
 * 「意味のない文字列」しか持たない。復号する手段はここには存在しない。
 *
 * ■ 合言葉の扱い（ここが肝）
 * 端末は合言葉から PBKDF2 で 64 バイトを作り、前半32を暗号鍵、後半32を
 * 「書いてよい人だ」と示す token として使う。サーバーが保管するのは
 * **token の SHA-256 だけ**。保管物が丸ごと漏れても、そこから合言葉も
 * token も中身も復元できない。
 *
 *   GET /api/kakei/meta  … salt と版番号（認証なし。saltは秘密ではない）
 *   GET /api/kakei       … 暗号文（X-Kakei-Auth が要る）
 *   PUT /api/kakei       … 暗号文を置く（X-Kakei-Auth と、いま持っている版番号が要る）
 *
 * ■ 同時に書いたとき
 * PUT には「自分が読んだときの版番号」を添えてもらう。ズレていたら 409 を返し、
 * 相手の版を一緒に返す。あとから来たほうが黙って上書きする事故を防ぐ。
 */
import type { Env } from './types'

/** 置き場所。ひと家庭ぶんしか無いので固定でよい */
const KEY = 'kakei:v1:home'

/** 暗号文の上限。これを超えるのは家計簿の使い方ではない */
const MAX_CT = 512 * 1024

export interface KakeiDoc {
  /** 鍵の導出に使う塩（Base64）。秘密ではない */
  salt: string
  /** token の SHA-256（16進）。合言葉そのものは決して保管しない */
  verifier: string
  /** AES-GCM の初期化ベクトル（Base64） */
  iv: string
  /** 暗号文（Base64） */
  ct: string
  /** 版番号。保存のたびに1つ増える */
  rev: number
  /** 最後に保存した時刻（ミリ秒） */
  at: number
}

/** 端末から届く保存要求 */
export interface KakeiPut {
  salt?: unknown
  iv?: unknown
  ct?: unknown
  rev?: unknown
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** 長さで分岐せず、全桁を見てから答える（照合にかかる時間から中身を推測させない） */
export function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function loadDoc(env: Env): Promise<KakeiDoc | null> {
  const raw = await env.ROSTER_KV.get(KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as KakeiDoc
  } catch {
    return null
  }
}

/** Base64 らしい文字列か。長さの上限もここで見る */
function isB64(v: unknown, max: number): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= max && /^[A-Za-z0-9+/=]+$/.test(v)
}

export type PutResult =
  | { ok: true; doc: KakeiDoc }
  | { ok: false; status: 400 | 401 | 409; error: string; message: string; current?: KakeiDoc }

/**
 * 保存を判定する。KV への書き込みはしない（呼び出し側が doc を書く）。
 *
 * ■ まだ何も無いとき
 * 最初の1回は誰でも作れる。作った人の token のハッシュがそのまま錠前になり、
 * 以降はその合言葉を知っている人しか書けない。
 */
export async function decidePut(
  current: KakeiDoc | null,
  body: KakeiPut,
  token: string,
): Promise<PutResult> {
  if (!token || token.length > 200) {
    return { ok: false, status: 401, error: 'unauthorized', message: '合言葉が要ります' }
  }
  if (!isB64(body.salt, 64) || !isB64(body.iv, 32) || !isB64(body.ct, MAX_CT)) {
    return { ok: false, status: 400, error: 'bad_request', message: '形が違います' }
  }
  const verifier = await sha256Hex(token)

  if (!current) {
    // 最初の1回。ここで錠前が決まる
    return {
      ok: true,
      doc: { salt: body.salt, verifier, iv: body.iv, ct: body.ct, rev: 1, at: Date.now() },
    }
  }
  if (!sameSecret(verifier, current.verifier)) {
    return { ok: false, status: 401, error: 'unauthorized', message: '合言葉が違います' }
  }
  // 塩が変わると、いまの合言葉で開けない暗号文になる。作り直し以外では起こらない
  if (body.salt !== current.salt) {
    return { ok: false, status: 400, error: 'salt_mismatch', message: '鍵の作り方が合いません' }
  }
  if (body.rev !== current.rev) {
    return {
      ok: false,
      status: 409,
      error: 'conflict',
      message: '相手が先に保存しています',
      current,
    }
  }
  return {
    ok: true,
    doc: { salt: current.salt, verifier, iv: body.iv, ct: body.ct, rev: current.rev + 1, at: Date.now() },
  }
}

export async function saveDoc(doc: KakeiDoc, env: Env): Promise<void> {
  await env.ROSTER_KV.put(KEY, JSON.stringify(doc))
}

/** 合言葉の総当たりを鈍らせる。1分あたり20回まで */
export async function tooManyKakeiAttempts(ip: string, env: Env): Promise<boolean> {
  const bucket = `rl:kakei:${ip}:${Math.floor(Date.now() / 60000)}`
  const n = Number((await env.ROSTER_KV.get(bucket)) ?? '0') + 1
  await env.ROSTER_KV.put(bucket, String(n), { expirationTtl: 120 })
  return n > 20
}
