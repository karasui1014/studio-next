import { describe, expect, it } from 'vitest'

import { BUILTIN_PROMPTS } from '../data'
import {
  buildProducerSearchQuery,
  collectOptions,
  criteriaToFilters,
  filterAndSort,
  matchesFilters,
  relatedEntries,
  sortEntries,
} from '../search'
import { createEmptyFilters, type PromptFilters } from '../types'

const NONE = () => false

function filters(overrides: Partial<PromptFilters> = {}): PromptFilters {
  return { ...createEmptyFilters(), ...overrides }
}

describe('絞り込み(matchesFilters)', () => {
  const lofi = BUILTIN_PROMPTS.find((e) => e.id === 'bp-lofi-study')!

  it('ジャンル一致で絞れる', () => {
    expect(matchesFilters(lofi, filters({ genre: 'Lo-fi' }), NONE)).toBe(true)
    expect(matchesFilters(lofi, filters({ genre: 'ロック' }), NONE)).toBe(false)
  })

  it('感情・用途・ボーカル・BPM帯・サービス・タグで絞れる', () => {
    expect(matchesFilters(lofi, filters({ emotion: '落ち着く' }), NONE)).toBe(true)
    expect(matchesFilters(lofi, filters({ use: '作業用BGM' }), NONE)).toBe(true)
    expect(matchesFilters(lofi, filters({ vocal: 'instrumental' }), NONE)).toBe(true)
    expect(matchesFilters(lofi, filters({ bpm: 'mid' }), NONE)).toBe(true)
    expect(matchesFilters(lofi, filters({ service: 'Suno' }), NONE)).toBe(true)
    expect(matchesFilters(lofi, filters({ tag: '作業用' }), NONE)).toBe(true)
    expect(matchesFilters(lofi, filters({ vocal: 'female' }), NONE)).toBe(false)
  })

  it('キーワードはAND検索(全語を含む必要がある)', () => {
    expect(matchesFilters(lofi, filters({ keyword: 'lo-fi ピアノ' }), NONE)).toBe(true)
    expect(matchesFilters(lofi, filters({ keyword: 'lo-fi ギター' }), NONE)).toBe(false)
  })

  it('お気に入りのみ表示は isFavorite に従う', () => {
    expect(matchesFilters(lofi, filters({ favoritesOnly: true }), NONE)).toBe(false)
    expect(matchesFilters(lofi, filters({ favoritesOnly: true }), (id) => id === lofi.id)).toBe(true)
  })

  it('収録元(owner)フィルタで初期収録/自分の辞書を切り替えられる', () => {
    // lofi は builtin
    expect(matchesFilters(lofi, filters({ owner: 'builtin' }), NONE)).toBe(true)
    expect(matchesFilters(lofi, filters({ owner: 'mine' }), NONE)).toBe(false)
    // 自分用エントリを模したもの
    const mine = { ...lofi, id: 'mine-1', source: 'user' as const }
    expect(matchesFilters(mine, filters({ owner: 'mine' }), NONE)).toBe(true)
    expect(matchesFilters(mine, filters({ owner: 'builtin' }), NONE)).toBe(false)
  })
})

describe('並び替え(sortEntries)', () => {
  it('タイトル順・BPM順で安定して並ぶ', () => {
    const byTitle = sortEntries(BUILTIN_PROMPTS, 'title')
    const titles = byTitle.map((e) => e.title)
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b, 'ja')))

    const byBpm = sortEntries(BUILTIN_PROMPTS, 'bpm')
    // 先頭は slow 帯のはず
    expect(['slow']).toContain(byBpm[0].bpm)
  })

  it('おすすめ順は初心者向けを先に出す', () => {
    const rec = sortEntries(BUILTIN_PROMPTS, 'recommended')
    const firstNonBeginner = rec.findIndex((e) => !e.beginnerFriendly)
    const lastBeginner = rec.map((e) => e.beginnerFriendly).lastIndexOf(true)
    expect(firstNonBeginner).toBeGreaterThan(lastBeginner)
  })
})

describe('絞り込み+並び替え(filterAndSort)', () => {
  it('該当0件・複数条件の組み合わせが動く', () => {
    const inst = filterAndSort(BUILTIN_PROMPTS, filters({ vocal: 'instrumental' }), 'title', NONE)
    expect(inst.length).toBeGreaterThan(0)
    expect(inst.every((e) => e.vocal === 'instrumental')).toBe(true)

    const none = filterAndSort(BUILTIN_PROMPTS, filters({ genre: '存在しない' }), 'title', NONE)
    expect(none).toHaveLength(0)
  })
})

describe('関連プロンプト(relatedEntries)', () => {
  it('自分自身は含まず、ジャンルが近いものが上位に来る', () => {
    const lofiStudy = BUILTIN_PROMPTS.find((e) => e.id === 'bp-lofi-study')!
    const related = relatedEntries(lofiStudy, BUILTIN_PROMPTS)
    expect(related.every((e) => e.id !== lofiStudy.id)).toBe(true)
    // 同じ Lo-fi ジャンルの別エントリが含まれる
    expect(related.some((e) => e.id === 'bp-lofi-shorts')).toBe(true)
  })
})

describe('選択肢の収集(collectOptions)', () => {
  it('データからジャンル等の選択肢が集まる', () => {
    const opts = collectOptions(BUILTIN_PROMPTS)
    expect(opts.genres).toContain('Lo-fi')
    expect(opts.genres).toContain('ロック')
    expect(opts.emotions.length).toBeGreaterThan(3)
    expect(opts.services).toContain('Suno')
  })
})

describe('AIプロデューサー連携(criteriaToFilters / buildProducerSearchQuery)', () => {
  it('ジャンル・BPM数値・狙い・媒体から絞り込み条件を作る', () => {
    const f = criteriaToFilters({
      genre: 'Lo-fi',
      bpm: '82',
      aim: '作業中に流す落ち着いた曲',
      media: 'YouTube Shorts',
    })
    expect(f.genre).toBe('Lo-fi')
    expect(f.bpm).toBe('mid') // 82 → mid帯
    expect(f.emotion).toBe('落ち着く')
    expect(f.use).toBe('Shorts')
  })

  it('問題の種類はタグへマップされる', () => {
    const f = criteriaToFilters({ problem: 'suno' })
    expect(f.tag).toBe('サビ映え')
  })

  it('英語ジャンルは日本語ジャンルへ寄せ、未知ジャンルは絞り込みから外す', () => {
    expect(criteriaToFilters({ genre: 'city pop' }).genre).toBe('シティポップ')
    expect(criteriaToFilters({ genre: 'rock' }).genre).toBe('ロック')
    // 既知ジャンルはそのまま
    expect(criteriaToFilters({ genre: 'アニソン' }).genre).toBe('アニソン')
    // 未知は undefined(0件化を防ぐため絞り込みをかけない)
    expect(criteriaToFilters({ genre: 'ぜんぜん違うジャンル' }).genre).toBeUndefined()
  })

  it('URLクエリを組み立てられる(未指定は載らない)', () => {
    const url = buildProducerSearchQuery({ genre: 'ロック', bpm: '150' })
    expect(url.startsWith('/tools/prompt-dex?')).toBe(true)
    expect(url).toContain('genre=')
    expect(url).toContain('bpm=fast')
    expect(url).not.toContain('emotion=')

    const empty = buildProducerSearchQuery({})
    expect(empty).toBe('/tools/prompt-dex')
  })
})
