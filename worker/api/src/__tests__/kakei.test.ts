/**
 * ふたりの家計の預かり所。
 *
 * ここが誤ると「合言葉を知らない人に書き換えられる」か
 * 「あとから保存した人が、相手の入力を黙って消す」。
 * その2つが起きないことを固定する。
 */
import { describe, expect, it } from 'vitest'

import { decidePut, sameSecret, sha256Hex, type KakeiDoc } from '../kakei'

const b64 = (n: number) => 'A'.repeat(n)

async function docFor(token: string, over: Partial<KakeiDoc> = {}): Promise<KakeiDoc> {
  return {
    salt: b64(24),
    verifier: await sha256Hex(token),
    iv: b64(16),
    ct: b64(100),
    rev: 3,
    at: 1,
    ...over,
  }
}
const put = (over: Record<string, unknown> = {}) => ({
  salt: b64(24),
  iv: b64(16),
  ct: b64(120),
  rev: 3,
  ...over,
})

describe('sameSecret', () => {
  it('同じなら true、1文字でも違えば false', () => {
    expect(sameSecret('abc', 'abc')).toBe(true)
    expect(sameSecret('abc', 'abd')).toBe(false)
    expect(sameSecret('abc', 'ab')).toBe(false)
  })
})

describe('decidePut：最初の1回', () => {
  it('まだ何も無ければ誰でも作れて、その合言葉が錠前になる', async () => {
    const r = await decidePut(null, put(), 'token-a')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.doc.rev).toBe(1)
    expect(r.doc.verifier).toBe(await sha256Hex('token-a'))
  })

  it('合言葉が空なら作らせない', async () => {
    const r = await decidePut(null, put(), '')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.status).toBe(401)
  })

  it('暗号文の形が違えば断る', async () => {
    const r = await decidePut(null, put({ ct: '中身' }), 'token-a')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.status).toBe(400)
  })
})

describe('decidePut：2回目以降', () => {
  it('合言葉が合えば、版番号が1つ増える', async () => {
    const r = await decidePut(await docFor('token-a'), put(), 'token-a')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.doc.rev).toBe(4)
  })

  it('合言葉が違えば書けない', async () => {
    const r = await decidePut(await docFor('token-a'), put(), 'token-b')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.status).toBe(401)
  })

  it('相手が先に保存していたら 409 で止め、相手の版を返す', async () => {
    const current = await docFor('token-a', { rev: 5 })
    const r = await decidePut(current, put({ rev: 3 }), 'token-a')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.status).toBe(409)
    expect(r.current?.rev).toBe(5)
    // 相手の暗号文は残ったまま。上書きしていない
    expect(r.current?.ct).toBe(current.ct)
  })

  it('塩を差し替えようとしたら断る（開けない暗号文になるため）', async () => {
    const r = await decidePut(await docFor('token-a'), put({ salt: b64(20) }), 'token-a')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('salt_mismatch')
  })

  it('保管するのは token のハッシュだけで、token そのものは残さない', async () => {
    const r = await decidePut(await docFor('token-a'), put(), 'token-a')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(JSON.stringify(r.doc)).not.toContain('token-a')
  })
})
