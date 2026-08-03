import { describe, expect, it } from 'vitest'

import {
  findChorusSections,
  isChorusLabel,
  parseHeadingLine,
  parseLyricsStructure,
  sectionLabelForLine,
} from '../structure'

describe('parseHeadingLine', () => {
  it('英語の見出しを正規化して認識する', () => {
    expect(parseHeadingLine('[Intro]')).toBe('Intro')
    expect(parseHeadingLine('[Verse]')).toBe('Verse')
    expect(parseHeadingLine('[Verse 2]')).toBe('Verse 2')
    expect(parseHeadingLine('[Pre-Chorus]')).toBe('Pre-Chorus')
    expect(parseHeadingLine('[Chorus]')).toBe('Chorus')
    expect(parseHeadingLine('[Bridge]')).toBe('Bridge')
    expect(parseHeadingLine('[Outro]')).toBe('Outro')
    expect(parseHeadingLine('Chorus:')).toBe('Chorus')
  })

  it('日本語の見出しを認識する', () => {
    expect(parseHeadingLine('Aメロ')).toBe('Aメロ')
    expect(parseHeadingLine('Bメロ')).toBe('Bメロ')
    expect(parseHeadingLine('サビ')).toBe('サビ')
    expect(parseHeadingLine('【サビ】')).toBe('サビ')
    expect(parseHeadingLine('サビ2')).toBe('サビ 2')
    expect(parseHeadingLine('間奏')).toBe('間奏')
    expect(parseHeadingLine('イントロ')).toBe('Intro')
  })

  it('歌詞の本文行は見出しとして扱わない', () => {
    expect(parseHeadingLine('サビの前で君が笑った')).toBeNull()
    expect(parseHeadingLine('夜の街を歩いた')).toBeNull()
    expect(parseHeadingLine('')).toBeNull()
  })
})

describe('isChorusLabel', () => {
  it('サビ系ラベルを判定する(Pre-Chorusは含まない)', () => {
    expect(isChorusLabel('Chorus')).toBe(true)
    expect(isChorusLabel('サビ')).toBe(true)
    expect(isChorusLabel('サビ 2')).toBe(true)
    expect(isChorusLabel('Pre-Chorus')).toBe(false)
    expect(isChorusLabel('Verse')).toBe(false)
  })
})

describe('parseLyricsStructure(見出しあり)', () => {
  const lyrics = ['[Verse]', '一行目', '二行目', '', '[Chorus]', 'サビの行', 'サビの行'].join('\n')

  it('明示された構造を読み取る', () => {
    const structure = parseLyricsStructure(lyrics)
    expect(structure.explicit).toBe(true)
    expect(structure.sections).toHaveLength(2)
    expect(structure.sections[0]).toMatchObject({ label: 'Verse', estimated: false, startLine: 1, endLine: 2 })
    expect(structure.sections[1]).toMatchObject({ label: 'Chorus', estimated: false, startLine: 5, endLine: 6 })
    expect(structure.headingLineIndexes).toEqual([0, 4])
  })

  it('行→セクションの対応を返す', () => {
    const structure = parseLyricsStructure(lyrics)
    expect(sectionLabelForLine(structure, 1)).toBe('Verse')
    expect(sectionLabelForLine(structure, 5)).toBe('Chorus')
    expect(sectionLabelForLine(structure, 3)).toBe('') // 空行
  })
})

describe('parseLyricsStructure(見出しなし=推定)', () => {
  it('繰り返しブロックをサビと推定し、推定フラグを立てる', () => {
    const lyrics = ['Aの一行目', 'Aの二行目', '', 'くりかえしの行', 'もうひとつの行', '', 'Bの一行目', 'Bの二行目', '', 'くりかえしの行', 'もうひとつの行'].join('\n')
    const structure = parseLyricsStructure(lyrics)
    expect(structure.explicit).toBe(false)
    expect(structure.sections.every((s) => s.estimated)).toBe(true)
    const chorusSections = findChorusSections(structure)
    expect(chorusSections).toHaveLength(2)
    expect(chorusSections[0].startLine).toBe(3)
    expect(structure.sections[0].label).toBe('Aメロ')
  })

  it('繰り返しが無い場合はA→B→サビの定型で推定する', () => {
    const lyrics = ['一番目のブロック', '', '二番目のブロック', '', '三番目のブロック'].join('\n')
    const structure = parseLyricsStructure(lyrics)
    expect(structure.explicit).toBe(false)
    expect(structure.sections.map((s) => s.label)).toEqual(['Aメロ', 'Bメロ', 'サビ'])
  })

  it('ブロックがひとつだけならVerseとして扱う', () => {
    const structure = parseLyricsStructure('一行だけの歌詞')
    expect(structure.sections).toHaveLength(1)
    expect(structure.sections[0]).toMatchObject({ label: 'Verse', estimated: true })
  })
})
