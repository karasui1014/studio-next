import { describe, expect, it } from 'vitest'

import {
  buildAllAdoptedLyrics,
  buildDiffRows,
  buildFinalLyrics,
  countDecisions,
  setDecision,
} from '../apply'
import { parseLyricsStructure } from '../structure'
import type { LineDecision, LineSuggestion } from '../types'

const ORIGINAL = ['一行目のまま', '長い二行目をなおしたい', '三行目のまま'].join('\n')

function suggestion(overrides: Partial<LineSuggestion> = {}): LineSuggestion {
  return {
    id: 'L2-line-too-long',
    ruleId: 'line-too-long',
    sectionLabel: 'Aメロ',
    lineNumber: 2,
    original: '長い二行目をなおしたい',
    problem: '一行が長い',
    reason: 'テスト用',
    suggestion: '短くした二行目',
    alternatives: ['別案の二行目'],
    priority: 'medium',
    keepNote: '残してもよい',
    ...overrides,
  }
}

describe('buildFinalLyrics', () => {
  it('採用した行だけを置き換える(保留・却下は原文のまま)', () => {
    const s = suggestion()
    expect(buildFinalLyrics(ORIGINAL, [s], [])).toBe(ORIGINAL) // 保留
    expect(
      buildFinalLyrics(ORIGINAL, [s], [{ suggestionId: s.id, status: 'rejected' }]),
    ).toBe(ORIGINAL)
    expect(
      buildFinalLyrics(ORIGINAL, [s], [{ suggestionId: s.id, status: 'adopted' }]),
    ).toBe(['一行目のまま', '短くした二行目', '三行目のまま'].join('\n'))
  })

  it('別案を選んだ場合はそのテキストで置き換える', () => {
    const s = suggestion()
    const result = buildFinalLyrics(ORIGINAL, [s], [
      { suggestionId: s.id, status: 'adopted', chosenText: '別案の二行目' },
    ])
    expect(result).toContain('別案の二行目')
  })

  it('改行入りの候補は行の分割として反映される', () => {
    const s = suggestion({ suggestion: '前半\n後半' })
    const result = buildFinalLyrics(ORIGINAL, [s], [{ suggestionId: s.id, status: 'adopted' }])
    expect(result.split('\n')).toEqual(['一行目のまま', '前半', '後半', '三行目のまま'])
  })

  it('推定構造のセクションタグを挿入できる', () => {
    const lyrics = ['Aの行', '', 'くりかえし', '', 'Bの行', '', 'くりかえし'].join('\n')
    const structure = parseLyricsStructure(lyrics)
    const result = buildFinalLyrics(lyrics, [], [], { addSectionTags: true, structure })
    expect(result).toContain('[Aメロ]')
    expect(result).toContain('[サビ]')
  })

  it('明示構造の歌詞にはタグを重複挿入しない', () => {
    const lyrics = ['[Verse]', 'Aの行'].join('\n')
    const structure = parseLyricsStructure(lyrics)
    const result = buildFinalLyrics(lyrics, [], [], { addSectionTags: true, structure })
    expect(result).toBe(lyrics)
  })
})

describe('buildAllAdoptedLyrics', () => {
  it('すべての提案を採用した全文を返す', () => {
    const s = suggestion()
    expect(buildAllAdoptedLyrics(ORIGINAL, [s])).toContain('短くした二行目')
  })
})

describe('buildDiffRows', () => {
  it('採用状態ごとに行の状態を返す', () => {
    const s = suggestion()
    const pending = buildDiffRows(ORIGINAL, [s], [])
    expect(pending[1]).toMatchObject({ state: 'pending', revised: '短くした二行目', suggestionId: s.id })
    expect(pending[0]).toMatchObject({ state: 'unchanged', revised: '一行目のまま' })

    const adopted = buildDiffRows(ORIGINAL, [s], [{ suggestionId: s.id, status: 'adopted' }])
    expect(adopted[1].state).toBe('adopted')

    const rejected = buildDiffRows(ORIGINAL, [s], [{ suggestionId: s.id, status: 'rejected' }])
    expect(rejected[1]).toMatchObject({ state: 'rejected', revised: '長い二行目をなおしたい' })
  })
})

describe('setDecision / countDecisions', () => {
  it('採用状態の差し替えと集計ができる', () => {
    const s = suggestion()
    let decisions: LineDecision[] = []
    decisions = setDecision(decisions, { suggestionId: s.id, status: 'adopted' })
    expect(countDecisions([s], decisions)).toEqual({ adopted: 1, rejected: 0, pending: 0 })
    decisions = setDecision(decisions, { suggestionId: s.id, status: 'rejected' })
    expect(decisions).toHaveLength(1)
    expect(countDecisions([s], decisions)).toEqual({ adopted: 0, rejected: 1, pending: 0 })
  })
})
