import { describe, expect, it } from 'vitest'

import { regenerateLineSuggestion, reviewWithMock } from '../analyze'
import { createSampleInput } from '../sample'
import {
  createEmptyInput,
  validateResult,
  type LyricsReviewSongContext,
} from '../types'

const CONTEXT: LyricsReviewSongContext = {
  songId: 'song-1',
  songTitle: 'テスト曲',
  status: 'lyrics',
  sunoPrompt: '',
  mvPrompt: '',
  historyCount: 3,
  completed: false,
}

describe('reviewWithMock', () => {
  it('サンプル入力からSchema検証を通る結果を返す', () => {
    const result = reviewWithMock(createSampleInput(), CONTEXT)
    expect(validateResult(result)).toEqual([])
    expect(result.goodPoints.length).toBeGreaterThanOrEqual(2)
    expect(result.lineSuggestions.length).toBeGreaterThan(0)
    expect(result.alternatives).toHaveLength(2)
    expect(result.nextAdvice.length).toBeGreaterThan(0)
  })

  it('決定的である(同じ入力からは同じ結果)', () => {
    const a = reviewWithMock(createSampleInput(), CONTEXT)
    const b = reviewWithMock(createSampleInput(), CONTEXT)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('構造タグの無い歌詞では推定フラグと推定の注記が付く', () => {
    const result = reviewWithMock(createSampleInput(), CONTEXT)
    expect(result.structureEstimated).toBe(true)
    expect(result.assumptions.some((a) => a.includes('推定'))).toBe(true)
  })

  it('残したい表現を含む行には提案を出さない', () => {
    const input = createSampleInput() // keepPhrases: 'ぬるいコーヒー'(2行目)
    const result = reviewWithMock(input, CONTEXT)
    const keptLine = input.lyrics.split('\n').findIndex((l) => l.includes('ぬるいコーヒー')) + 1
    expect(result.lineSuggestions.every((s) => s.lineNumber !== keptLine)).toBe(true)
  })

  it('使いたくない表現には高優先度の置き換え提案を出す', () => {
    const input = { ...createSampleInput(), avoidWords: '未来' }
    const result = reviewWithMock(input, CONTEXT)
    const hit = result.lineSuggestions.find((s) => s.ruleId === 'avoid-word')
    expect(hit).toBeDefined()
    expect(hit!.priority).toBe('high')
    expect(hit!.suggestion).not.toContain('未来')
  })

  it('アーティスト名は一般要素(8項目)へ変換される', () => {
    const input = { ...createSampleInput(), era: '米津玄師みたいな感じ' }
    const result = reviewWithMock(input, CONTEXT)
    expect(result.styleConversion).toBeDefined()
    expect(result.styleConversion!.elements).toHaveLength(8)
    expect(result.styleConversion!.note).toContain('模倣')
    expect(result.assumptions.some((a) => a.includes('アーティスト名'))).toBe(true)
  })

  it('添削の強さで提案数が絞られる(控えめは最大4件)', () => {
    const gentle = reviewWithMock({ ...createSampleInput(), intensity: 'gentle' }, CONTEXT)
    expect(gentle.lineSuggestions.length).toBeLessThanOrEqual(4)
    const bold = reviewWithMock({ ...createSampleInput(), intensity: 'bold' }, CONTEXT)
    expect(bold.lineSuggestions.length).toBeGreaterThanOrEqual(gentle.lineSuggestions.length)
  })

  it('全面的に作り直すモードでは提案の対象行が増える', () => {
    const light = reviewWithMock({ ...createSampleInput(), mode: 'light' }, CONTEXT)
    const rewrite = reviewWithMock({ ...createSampleInput(), mode: 'rewrite', intensity: 'bold' }, CONTEXT)
    expect(rewrite.lineSuggestions.length).toBeGreaterThan(light.lineSuggestions.length)
    expect(rewrite.revisedFullText).not.toBe(createSampleInput().lyrics)
  })

  it('添削後全文は「全提案を採用した場合」の全文になっている', () => {
    const result = reviewWithMock(createSampleInput(), CONTEXT)
    for (const s of result.lineSuggestions) {
      const firstLine = s.suggestion.split('\n')[0]
      expect(result.revisedFullText).toContain(firstLine)
    }
  })

  it('歌詞が1行でも壊れず動く', () => {
    const input = { ...createEmptyInput(), lyrics: '短い歌', genre: 'ポップ', emotion: '喜び', audience: '友だち' }
    const result = reviewWithMock(input, CONTEXT)
    expect(validateResult(result)).toEqual([])
  })
})

describe('regenerateLineSuggestion', () => {
  it('候補が回転し、添削後全文も追従する', () => {
    const input = createSampleInput()
    const result = reviewWithMock(input, CONTEXT)
    const target = result.lineSuggestions.find((s) => s.alternatives.length > 0)
    expect(target).toBeDefined()
    const next = regenerateLineSuggestion(result, target!.id, input)
    const regenerated = next.lineSuggestions.find((s) => s.id === target!.id)!
    expect(regenerated.suggestion).toBe(target!.alternatives[0])
    expect(regenerated.alternatives).toContain(target!.suggestion)
    expect(validateResult(next)).toEqual([])
    // 他の行は変わらない
    const other = next.lineSuggestions.filter((s) => s.id !== target!.id)
    const before = result.lineSuggestions.filter((s) => s.id !== target!.id)
    expect(JSON.stringify(other)).toBe(JSON.stringify(before))
  })
})
