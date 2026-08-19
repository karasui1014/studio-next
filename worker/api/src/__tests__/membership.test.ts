/**
 * ライセンスの失効判定。
 *
 * ここが誤ると「退会した人が使い続ける」か「正規の会員が突然締め出される」。
 * 迷う場合の倒し方（データが無い→失効／KV障害→失効にしない）を固定する。
 */
import { describe, expect, it } from 'vitest'

import { isSerialRevoked } from '../membership'
import type { Env } from '../types'

/** KVの代役。put された内容をそのまま返すだけ */
function fakeKV(store: Record<string, string>, opts: { throws?: boolean } = {}) {
  return {
    ROSTER_KV: {
      get: async (key: string) => {
        if (opts.throws) throw new Error('KV down')
        return store[key] ?? null
      },
      put: async () => undefined,
    },
  } as unknown as Env
}

const license = (rec: Record<string, unknown>) => JSON.stringify(rec)

describe('isSerialRevoked', () => {
  it('有効なライセンスは失効ではない', async () => {
    const env = fakeKV({
      'serial:P-006': 'hash-p006',
      'license:hash-p006': license({ role: 'premium', serial: 'P-006' }),
    })
    expect(await isSerialRevoked('P-006', env)).toBe(false)
  })

  it('revoked が立っていれば失効', async () => {
    const env = fakeKV({
      'serial:C-001': 'hash-c001',
      'license:hash-c001': license({ role: 'creator', serial: 'C-001', revoked: true }),
    })
    expect(await isSerialRevoked('C-001', env)).toBe(true)
  })

  it('索引が無ければ失効扱い（追跡できないものは通さない）', async () => {
    expect(await isSerialRevoked('P-999', fakeKV({}))).toBe(true)
  })

  it('レコード本体が無ければ失効扱い', async () => {
    const env = fakeKV({ 'serial:M-001': 'hash-m001' })
    expect(await isSerialRevoked('M-001', env)).toBe(true)
  })

  it('レコードが壊れていれば失効扱い', async () => {
    const env = fakeKV({
      'serial:M-002': 'hash-m002',
      'license:hash-m002': '{壊れたJSON',
    })
    expect(await isSerialRevoked('M-002', env)).toBe(true)
  })

  it('KVが落ちているときは失効にしない（こちらの障害で会員を締め出さない）', async () => {
    const env = fakeKV({}, { throws: true })
    expect(await isSerialRevoked('P-006', env)).toBe(false)
  })

  it('revoked:false は有効として扱う', async () => {
    const env = fakeKV({
      'serial:P-001': 'hash-p001',
      'license:hash-p001': license({ role: 'premium', serial: 'P-001', revoked: false }),
    })
    expect(await isSerialRevoked('P-001', env)).toBe(false)
  })
})
