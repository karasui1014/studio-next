import { describe, expect, it } from 'vitest'

import { BUILTIN_PROMPTS } from '../data'
import { parseImport } from '../repository'
import {
  bpmToBand,
  createEmptyEntryInput,
  normalizeEntry,
  PROMPT_DEX_SCHEMA_VERSION,
  validateEntryInput,
} from '../types'

describe('初期収録データの健全性', () => {
  it('15件以上あり、必須項目と学びの項目が揃っている', () => {
    expect(BUILTIN_PROMPTS.length).toBeGreaterThanOrEqual(15)
    for (const e of BUILTIN_PROMPTS) {
      expect(e.title, e.id).toBeTruthy()
      expect(e.prompt, e.id).toBeTruthy()
      expect(e.genre, e.id).toBeTruthy()
      expect(e.description, e.id).toBeTruthy()
      // 「学べる図鑑」の核: 成功点・失敗点・調整方法が各1つ以上
      expect(e.successPoints.length, `${e.id} successPoints`).toBeGreaterThan(0)
      expect(e.failurePoints.length, `${e.id} failurePoints`).toBeGreaterThan(0)
      expect(e.adjustments.length, `${e.id} adjustments`).toBeGreaterThan(0)
      expect(e.source).toBe('builtin')
      expect(e.schemaVersion).toBe(PROMPT_DEX_SCHEMA_VERSION)
    }
  })

  it('IDが重複していない', () => {
    const ids = BUILTIN_PROMPTS.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('指示されたジャンル/用途が分散して収録されている', () => {
    const genres = new Set(BUILTIN_PROMPTS.map((e) => e.genre))
    for (const g of ['J-POP', 'ロック', 'アニソン', 'バラード', 'Lo-fi', 'EDM', 'ゲーム音楽', '作業用BGM', 'インストゥルメンタル']) {
      expect(genres, `ジャンル ${g}`).toContain(g)
    }
    const uses = new Set(BUILTIN_PROMPTS.flatMap((e) => e.uses))
    expect(uses).toContain('Shorts')
  })

  it('最新トレンドスタイルが収録され、人名は含まない', () => {
    const trend = BUILTIN_PROMPTS.filter((e) => e.tags.includes('トレンド'))
    expect(trend.length).toBeGreaterThanOrEqual(10)
    const genres = new Set(BUILTIN_PROMPTS.map((e) => e.genre))
    for (const g of ['ゴスペル', 'インディー', 'シネマティック', '和風', 'レゲエ']) {
      expect(genres, `トレンドで追加したジャンル ${g}`).toContain(g)
    }
    // 実在アーティスト名を推奨しない方針(代表的な人名が単語として本文・タイトルに出ない)
    const blob = BUILTIN_PROMPTS.map((e) => `${e.title} ${e.prompt} ${e.description}`).join(' ')
    for (const name of ['taylor', 'weeknd', 'drake', 'billie', 'yoasobi', '米津', 'peso pluma', 'bad bunny']) {
      // 単語境界で判定(genre名 tumbados 等の部分一致を誤検出しない)
      expect(new RegExp(`\\b${name}\\b`, 'i').test(blob), `人名 ${name} が含まれない`).toBe(false)
    }
  })

  it('ジャンル組み合わせ(フュージョン)が横断検索できる形で収録されている', () => {
    const fusion = BUILTIN_PROMPTS.filter((e) => e.tags.includes('ジャンルMIX'))
    expect(fusion.length).toBeGreaterThanOrEqual(12)
    // 組み合わせは「A × B」がタイトルから分かる
    expect(fusion.every((e) => e.title.includes('×'))).toBe(true)
    // 人気の掛け合わせジャンルが押さえられている
    const subgenres = new Set(fusion.map((e) => e.subgenre))
    for (const s of ['フォンク', 'ハイパーポップ', 'シンセウェイブ', 'ジャズホップ', 'フューチャーファンク']) {
      expect(subgenres, `サブジャンル ${s}`).toContain(s)
    }
  })

  it('Suno向け・Udio向けの両方が十分に収録されている', () => {
    const suno = BUILTIN_PROMPTS.filter((e) => e.services.includes('Suno'))
    const udio = BUILTIN_PROMPTS.filter((e) => e.services.includes('Udio'))
    expect(suno.length).toBeGreaterThanOrEqual(8)
    expect(udio.length).toBeGreaterThanOrEqual(8)
    // Suno専用/Udio専用のエントリがそれぞれ存在する(対応サービス絞り込みが意味を持つ)
    expect(BUILTIN_PROMPTS.some((e) => e.services.length === 1 && e.services[0] === 'Suno')).toBe(true)
    expect(BUILTIN_PROMPTS.some((e) => e.services.length === 1 && e.services[0] === 'Udio')).toBe(true)
  })
})

describe('BPM数値→帯(bpmToBand)', () => {
  it('境界値が正しい帯に入る', () => {
    expect(bpmToBand(60)).toBe('slow')
    expect(bpmToBand(75)).toBe('slow')
    expect(bpmToBand(76)).toBe('mid')
    expect(bpmToBand(105)).toBe('mid')
    expect(bpmToBand(120)).toBe('upper')
    expect(bpmToBand(140)).toBe('fast')
  })
})

describe('入力チェック(validateEntryInput)', () => {
  it('タイトル・本文・ジャンルが必須', () => {
    expect(validateEntryInput(createEmptyEntryInput())).toHaveLength(3)
    const ok = { ...createEmptyEntryInput(), title: 'a', prompt: 'b', genre: 'c' }
    expect(validateEntryInput(ok)).toHaveLength(0)
  })
})

describe('復元・インポート(normalizeEntry / parseImport)', () => {
  it('必須欠損はnull、欠けたフィールドは既定値で補完', () => {
    expect(normalizeEntry(null, 'imported')).toBeNull()
    expect(normalizeEntry({ id: 'x', title: 'x' }, 'imported')).toBeNull() // prompt欠損
    const e = normalizeEntry({ id: 'x', title: 't', prompt: 'p' }, 'imported')
    expect(e).not.toBeNull()
    expect(e!.emotions).toEqual([])
    expect(e!.bpm).toBe('mid')
    expect(e!.source).toBe('imported')
  })

  it('配列でもラッパーでも取り込め、sourceはimportedに統一', () => {
    const wrapped = JSON.stringify({ entries: [BUILTIN_PROMPTS[0]] })
    const fromWrapped = parseImport(wrapped)
    expect(fromWrapped).toHaveLength(1)
    expect(fromWrapped[0].source).toBe('imported')

    const bare = JSON.stringify([BUILTIN_PROMPTS[0], BUILTIN_PROMPTS[1]])
    expect(parseImport(bare)).toHaveLength(2)
  })

  it('壊れたJSON・空配列はエラー', () => {
    expect(() => parseImport('{{')).toThrow()
    expect(() => parseImport('[]')).toThrow()
    expect(() => parseImport(JSON.stringify({ foo: 1 }))).toThrow()
  })
})
