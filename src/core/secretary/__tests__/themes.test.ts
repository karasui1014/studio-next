import { describe, expect, it } from 'vitest'

import type { Song } from '@/core/storage/songs'
import { suggestTheme } from '../themes'

function song(genre: string): Song {
  return {
    id: `s-${genre}-${Math.random()}`,
    title: '曲',
    status: 'idea',
    genre, mood: '', lyrics: '', sunoPrompt: '', mvPrompt: '', memo: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('suggestTheme', () => {
  it('曲が無くても提案を返す', () => {
    const s = suggestTheme([])
    expect(s.text.length).toBeGreaterThan(0)
    expect(s.key.length).toBeGreaterThan(0)
  })

  it('ジャンルが無いときはジャンル名を混ぜない', () => {
    expect(suggestTheme([]).text.startsWith('で、')).toBe(false)
  })

  it('いちばん多いジャンルを提案に反映する', () => {
    const songs = [song('Lo-Fi'), song('Lo-Fi'), song('Rock')]
    expect(suggestTheme(songs).text).toContain('Lo-Fi')
  })

  it('除外したものは繰り返さない', () => {
    const first = suggestTheme([])
    for (let i = 0; i < 30; i++) {
      expect(suggestTheme([], [first.key]).key).not.toBe(first.key)
    }
  })

  it('引き直すたびに違う組み合わせが出うる', () => {
    const keys = new Set(Array.from({ length: 40 }, () => suggestTheme([]).key))
    expect(keys.size).toBeGreaterThan(1)
  })

  it('ジャンルが空文字の曲しか無ければジャンルを使わない', () => {
    expect(suggestTheme([song(''), song('')]).text.startsWith('で、')).toBe(false)
  })
})
