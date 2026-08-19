/**
 * セッショントークンの発行・検証・権限の包含。
 *
 * ここが壊れると「お金を払った人が使えない」か「払っていない人が使える」の
 * どちらかが起きる。4権限すべてで通しておく。
 */
import { describe, expect, it } from 'vitest'

import { bearerFrom, issueSession, satisfies, verifySession } from '../session'
import type { Env, Role, SessionClaims } from '../types'

const env = { SESSION_SECRET: 'x'.repeat(48) } as Env
const ROLES: Role[] = ['free', 'premium', 'creator', 'master']

const b64url = (o: unknown) =>
  Buffer.from(JSON.stringify(o)).toString('base64url')

describe('トークンの発行と検証', () => {
  it.each(ROLES)('%s のトークンを発行して検証できる', async (role) => {
    const { token } = await issueSession(role, 'license', env)
    const claims = await verifySession(token, env)
    expect(claims?.role).toBe(role)
  })

  it('有効期限は30日先', async () => {
    const { expiresAt } = await issueSession('premium', 'license', env)
    const now = Math.floor(Date.now() / 1000)
    expect(expiresAt - now).toBeGreaterThan(29 * 24 * 60 * 60)
    expect(expiresAt - now).toBeLessThanOrEqual(30 * 24 * 60 * 60)
  })

  it('連番を渡すと sid として入る（失効確認に使う）', async () => {
    const { token } = await issueSession('creator', 'license', env, 'C-002')
    expect((await verifySession(token, env))?.sid).toBe('C-002')
  })

  it('連番を渡さなければ sid は入らない（旧トークン相当）', async () => {
    const { token } = await issueSession('creator', 'license', env)
    expect((await verifySession(token, env))?.sid).toBeUndefined()
  })

  it('生のライセンスキーはトークンに入らない', async () => {
    const { token } = await issueSession('creator', 'license', env, 'C-002')
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString(),
    ) as Record<string, unknown>
    // 入ってよいのはこの5つだけ。キーやハッシュが紛れ込んでいないこと
    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'role', 'sid', 'src'])
  })
})

describe('偽装を弾く', () => {
  it('role を書き換えたトークンは通らない', async () => {
    const { token } = await issueSession('free', 'license', env)
    const [h, , s] = token.split('.')
    const now = Math.floor(Date.now() / 1000)
    const forged = `${h}.${b64url({ role: 'master', src: 'license', iat: now, exp: now + 999 })}.${s}`
    expect(await verifySession(forged, env)).toBeNull()
  })

  it('知らない role は通らない', async () => {
    const { token } = await issueSession('free', 'license', env)
    const [h, , s] = token.split('.')
    const now = Math.floor(Date.now() / 1000)
    const forged = `${h}.${b64url({ role: 'admin', src: 'x', iat: now, exp: now + 999 })}.${s}`
    expect(await verifySession(forged, env)).toBeNull()
  })

  it('別の鍵で作ったトークンは通らない', async () => {
    const other = { SESSION_SECRET: 'y'.repeat(48) } as Env
    const { token } = await issueSession('master', 'license', other)
    expect(await verifySession(token, env)).toBeNull()
  })

  it('期限切れは通らない', async () => {
    const { token } = await issueSession('premium', 'license', env)
    const [h, p, s] = token.split('.')
    const claims = JSON.parse(Buffer.from(p, 'base64url').toString()) as SessionClaims
    const expired = `${h}.${b64url({ ...claims, exp: Math.floor(Date.now() / 1000) - 1 })}.${s}`
    expect(await verifySession(expired, env)).toBeNull()
  })

  it('形が違うもの・空は通らない', async () => {
    for (const bad of [null, '', 'abc', 'a.b', 'a.b.c.d']) {
      expect(await verifySession(bad, env)).toBeNull()
    }
  })
})

describe('権限の包含（free < premium < creator < master）', () => {
  const expected: Record<Role, Role[]> = {
    free: ['free'],
    premium: ['free', 'premium'],
    creator: ['free', 'premium', 'creator'],
    master: ['free', 'premium', 'creator', 'master'],
  }

  it.each(ROLES)('%s が満たせる権限', (actual) => {
    expect(ROLES.filter((req) => satisfies(actual, req))).toEqual(expected[actual])
  })

  it('Creator は Master 限定を満たさない', () => {
    expect(satisfies('creator', 'master')).toBe(false)
  })

  it('Master は Creator 限定を満たす（既存Masterが機能を失わない）', () => {
    expect(satisfies('master', 'creator')).toBe(true)
  })
})

describe('Authorization ヘッダーの読み取り', () => {
  const req = (h: Record<string, string>) => new Request('https://x/', { headers: h })

  it('Bearer を取り出せる', () => {
    expect(bearerFrom(req({ Authorization: 'Bearer abc.def.ghi' }))).toBe('abc.def.ghi')
  })

  it('無ければ null', () => {
    expect(bearerFrom(req({}))).toBeNull()
  })
})
