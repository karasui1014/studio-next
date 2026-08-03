import { describe, expect, it } from 'vitest'

import { reviewWithMock } from '../analyze'
import { createSampleInput } from '../sample'
import {
  LYRICS_REVIEW_SCHEMA_VERSION,
  createEmptyInput,
  validateInput,
  validateResult,
} from '../types'

describe('validateInput', () => {
  it('必須4項目(歌詞・ジャンル・感情・聴き手)をチェックする', () => {
    const empty = createEmptyInput()
    const errors = validateInput(empty)
    expect(errors).toHaveLength(4)
    expect(errors[0]).toContain('歌詞本文')

    const ok = {
      ...empty,
      lyrics: '歌詞',
      genre: 'ポップ',
      emotion: '喜び',
      audience: '友だち',
    }
    expect(validateInput(ok)).toEqual([])
  })

  it('空白だけの入力は未入力として扱う', () => {
    const input = { ...createEmptyInput(), lyrics: '   ', genre: 'ポップ', emotion: '喜び', audience: '友だち' }
    expect(validateInput(input)).toHaveLength(1)
  })
})

describe('validateResult(構造化出力のSchema検証)', () => {
  it('正しい結果は合格する', () => {
    const result = reviewWithMock(createSampleInput(), {
      songTitle: 'テスト',
      sunoPrompt: '',
      mvPrompt: '',
      historyCount: 0,
      completed: false,
    })
    expect(validateResult(result)).toEqual([])
    expect(result.schemaVersion).toBe(LYRICS_REVIEW_SCHEMA_VERSION)
  })

  it('オブジェクトでない値・欠損・バージョン不一致を検出する', () => {
    expect(validateResult(null).length).toBeGreaterThan(0)
    expect(validateResult('text').length).toBeGreaterThan(0)
    expect(validateResult({}).length).toBeGreaterThan(0)

    const good = reviewWithMock(createSampleInput(), {
      songTitle: 'テスト',
      sunoPrompt: '',
      mvPrompt: '',
      historyCount: 0,
      completed: false,
    })
    const wrongVersion = { ...good, schemaVersion: 999 }
    expect(validateResult(wrongVersion).some((e) => e.includes('Schemaバージョン'))).toBe(true)

    const brokenAxes = { ...good, axes: good.axes.slice(0, 3) }
    expect(validateResult(brokenAxes).some((e) => e.includes('7軸'))).toBe(true)

    const brokenLines = { ...good, lineSuggestions: [{ id: 'x' }] }
    expect(validateResult(brokenLines).some((e) => e.includes('行単位'))).toBe(true)
  })
})
