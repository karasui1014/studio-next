import { describe, expect, it } from 'vitest'

import { isTrialActive, localDay, startTrial } from '../trial'

function memoryStorage() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  }
}

describe('1日1回の無料体験', () => {
  it('始める前は使えない', () => {
    expect(isTrialActive('lyrics-review', memoryStorage())).toBe(false)
  })

  it('始めたその日は使える', () => {
    const s = memoryStorage()
    const now = new Date(2026, 9, 20, 10, 0)
    startTrial('lyrics-review', s, now)
    expect(isTrialActive('lyrics-review', s, new Date(2026, 9, 20, 23, 59))).toBe(true)
  })

  it('日付が変わると、また始め直しになる', () => {
    const s = memoryStorage()
    startTrial('lyrics-review', s, new Date(2026, 9, 20, 23, 0))
    expect(isTrialActive('lyrics-review', s, new Date(2026, 9, 21, 0, 1))).toBe(false)
  })

  it('ツールごとに別々に数える', () => {
    const s = memoryStorage()
    const now = new Date(2026, 9, 20, 10, 0)
    startTrial('mv-idea', s, now)
    expect(isTrialActive('mv-idea', s, now)).toBe(true)
    expect(isTrialActive('ai-producer', s, now)).toBe(false)
  })

  it('保存先が使えない環境でも落ちない', () => {
    const broken = {
      getItem: () => { throw new Error('denied') },
      setItem: () => { throw new Error('denied') },
    }
    expect(() => startTrial('prompt-dex', broken)).not.toThrow()
    expect(isTrialActive('prompt-dex', broken)).toBe(false)
  })

  it('日付は現地時間で YYYY-MM-DD', () => {
    expect(localDay(new Date(2026, 0, 5, 9))).toBe('2026-01-05')
  })
})
