import { describe, expect, it } from 'vitest'

import type { Song, SongStatus } from '@/core/storage/songs'
import {
  countCompleted,
  getProgress,
  getTitle,
  levelForCompletedCount,
  MAX_LEVEL,
  songsRequiredForLevel,
} from '../leveling'

function song(status: SongStatus): Song {
  return {
    id: `s-${Math.random()}`,
    title: '曲',
    status,
    genre: '', mood: '', lyrics: '', sunoPrompt: '', mvPrompt: '', memo: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('countCompleted', () => {
  it('公開済みの曲だけを数える', () => {
    const songs = [song('published'), song('published'), song('mv'), song('idea')]
    expect(countCompleted(songs)).toBe(2)
  })

  it('作りかけしか無ければ0曲', () => {
    expect(countCompleted([song('idea'), song('lyrics'), song('suno'), song('mv')])).toBe(0)
  })
})

describe('レベル計算', () => {
  it('0曲はレベル1', () => {
    expect(levelForCompletedCount(0)).toBe(1)
  })

  it('曲が増えるとレベルは下がらない', () => {
    let prev = 0
    for (let n = 0; n <= 500; n++) {
      const lv = levelForCompletedCount(n)
      expect(lv).toBeGreaterThanOrEqual(prev)
      prev = lv
    }
  })

  it('レベル100を超えない', () => {
    expect(levelForCompletedCount(1_000_000)).toBe(MAX_LEVEL)
  })

  it('必要曲数とレベルが往復して一致する', () => {
    for (let lv = 2; lv <= 50; lv++) {
      const need = songsRequiredForLevel(lv)
      expect(levelForCompletedCount(need)).toBeGreaterThanOrEqual(lv)
      // ちょうど1曲足りなければ、そのレベルには届かない
      expect(levelForCompletedCount(need - 1)).toBeLessThan(lv)
    }
  })

  it('レベル1に必要な曲数は0', () => {
    expect(songsRequiredForLevel(1)).toBe(0)
  })
})

describe('称号', () => {
  it('レベル1は音の卵', () => {
    expect(getTitle(1)).toBe('音の卵')
  })

  it('段の境目で切り替わる', () => {
    expect(getTitle(5)).toBe('音の卵')
    expect(getTitle(6)).toBe('旋律の芽')
  })

  it('最高段は音楽の神話', () => {
    expect(getTitle(100)).toBe('音楽の神話')
  })
})

describe('getProgress', () => {
  it('曲が無いときはレベル1で、次のレベルまでの曲数が出る', () => {
    const p = getProgress([])
    expect(p.level).toBe(1)
    expect(p.completedCount).toBe(0)
    expect(p.isMaxLevel).toBe(false)
    expect(p.songsToNextLevel).toBeGreaterThan(0)
    expect(p.progressRatio).toBe(0)
  })

  it('進捗の割合は0〜1に収まる', () => {
    for (let n = 0; n < 200; n++) {
      const songs = Array.from({ length: n }, () => song('published'))
      const p = getProgress(songs)
      expect(p.progressRatio).toBeGreaterThanOrEqual(0)
      expect(p.progressRatio).toBeLessThanOrEqual(1)
    }
  })

  it('作りかけの曲はレベルに影響しない', () => {
    const drafts = Array.from({ length: 50 }, () => song('mv'))
    expect(getProgress(drafts).level).toBe(1)
  })
})
