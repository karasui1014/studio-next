import { describe, expect, it } from 'vitest'

import { reviewWithMock, splitLongLine, swapEnding } from '../analyze'
import { createEmptyInput, type LyricsReviewSongContext } from '../types'

const CONTEXT: LyricsReviewSongContext = {
  songTitle: '(曲未選択)',
  sunoPrompt: '',
  mvPrompt: '',
  historyCount: 0,
  completed: false,
}

function review(lyrics: string, overrides = {}, context = CONTEXT) {
  return reviewWithMock(
    {
      ...createEmptyInput(),
      lyrics,
      genre: 'J-POP',
      emotion: '切なさ',
      audience: '20代',
      intensity: 'bold',
      ...overrides,
    },
    context,
  )
}

const ruleIds = (lyrics: string, overrides = {}, context = CONTEXT) =>
  review(lyrics, overrides, context).lineSuggestions.map((s) => s.ruleId)

describe('swapEnding(文法を壊さない)', () => {
  it('名詞・副詞の「た」「る」は変換しない', () => {
    expect(swapEnding('君に届けたいうた')).toBeNull()
    expect(swapEnding('それでもまた')).toBeNull()
    expect(swapEnding('あなた')).toBeNull()
    expect(swapEnding('ぐるぐる')).toBeNull()
    expect(swapEnding('まる')).toBeNull()
  })

  it('動詞の活用形は変換する', () => {
    expect(swapEnding('僕は見た')).toBe('僕は見たんだ')
    expect(swapEnding('街を歩いた')).toBe('街を歩いたんだ')
    expect(swapEnding('朝が来る')).toBe('朝が来るんだ')
    expect(swapEnding('雨が降っている')).toBe('雨が降ってる')
  })
})

describe('splitLongLine(語を壊さない)', () => {
  it('内容語の直後の助詞で割る', () => {
    expect(splitLongLine('24時間営業のコンビニの帰り道で僕はひとりで考えていた')).toBe(
      '24時間営業のコンビニの帰り道で\n僕はひとりで考えていた',
    )
  })

  it('「でも」「とき」のような語の途中では割らない', () => {
    const result = splitLongLine('それでもここでずっとまってるだけだったんだ')
    expect(result).toBeNull() // 安全に割れる位置が無ければ提案しない
  })

  it('割った結果が極端に短い側を作らない', () => {
    const result = splitLongLine('君を探していた長い長い夜の果てまでずっと')
    if (result) {
      const [first, second] = result.split('\n')
      expect(first.length).toBeGreaterThanOrEqual(3)
      expect(second.length).toBeGreaterThanOrEqual(3)
    }
  })
})

describe('BPM連動の行の長さ判定', () => {
  // 約25拍。BPM150(目安14拍)では長すぎ、BPM60(目安32拍)なら収まる長さ
  const longLine = '夜の街を歩きながら君のことを考えていた'

  it('速いテンポでは同じ行が「長い」と判定される', () => {
    expect(ruleIds(longLine, { bpm: '150' })).toContain('line-too-long')
  })

  it('遅いテンポでは許容される', () => {
    expect(ruleIds(longLine, { bpm: '60' })).not.toContain('line-too-long')
  })

  it('指摘文にテンポの根拠が入る', () => {
    const hit = review(longLine, { bpm: '150' }).lineSuggestions.find(
      (s) => s.ruleId === 'line-too-long',
    )
    expect(hit?.reason).toContain('BPM150')
  })
})

describe('新しいルール', () => {
  it('一人称の混在を検出する', () => {
    const lyrics = ['僕は歩いていた', '', '私は立ち止まった'].join('\n')
    expect(ruleIds(lyrics)).toContain('person-mixed')
  })

  it('一人称が統一されていれば指摘しない', () => {
    const lyrics = ['僕は歩いていた', '', '僕は立ち止まった'].join('\n')
    expect(ruleIds(lyrics)).not.toContain('person-mixed')
  })

  it('曲名が歌詞に一度も出てこない場合に指摘する', () => {
    const lyrics = ['[Verse]', '夜の底を歩く', '', '[Chorus]', '君のいない街で', '朝を待っている'].join('\n')
    const ids = ruleIds(lyrics, {}, { ...CONTEXT, songTitle: '眠らない街' })
    expect(ids).toContain('title-not-in-chorus')
  })

  it('曲名がすでに入っていれば指摘しない', () => {
    const lyrics = ['[Verse]', '夜の底を歩く', '', '[Chorus]', '眠らない街で', '朝を待っている'].join('\n')
    const ids = ruleIds(lyrics, {}, { ...CONTEXT, songTitle: '眠らない街' })
    expect(ids).not.toContain('title-not-in-chorus')
  })

  it('サビが接続詞で始まる場合に指摘する', () => {
    const lyrics = ['[Verse]', '雨が降る朝に', '', '[Chorus]', 'でも君は笑っていた', '傘もささずに'].join('\n')
    expect(ruleIds(lyrics)).toContain('chorus-weak-conjunction')
  })

  it('句読点が多い行を指摘する(歌いやすくするモード)', () => {
    const lyrics = ['心が痛い、心が軋む、心が消える', '', '静かな朝が来る'].join('\n')
    expect(ruleIds(lyrics, { mode: 'singability' })).toContain('punctuation-heavy')
  })

  it('「軽く整える」では細かい指摘を出さない(モードごとの絞り込みが効く)', () => {
    const lyrics = ['心が痛い、心が軋む、心が消える', '', '静かな朝が来る'].join('\n')
    expect(ruleIds(lyrics, { mode: 'light' })).not.toContain('punctuation-heavy')
  })

  it('同じ抽象語の使いすぎを指摘する', () => {
    const lyrics = ['夢を見ていた', '夢の続きを', '夢が覚めても', '夢を追いかけて'].join('\n')
    expect(ruleIds(lyrics)).toContain('overused-word')
  })

  it('説明的すぎる行(助詞が多い)を指摘する(言葉をやさしくするモード)', () => {
    const lyrics = ['僕はあの日の君の言葉を今でも胸の奥に抱えている'].join('\n')
    expect(ruleIds(lyrics, { mode: 'simple' })).toContain('too-explanatory')
  })
})

describe('提案の安全性(全ルール横断)', () => {
  const messy = [
    '[Verse]',
    '24時間営業のコンビニの帰り道で僕はひとりで考えていた',
    'それでもまた',
    '君に届けたいうた',
    '',
    '[Chorus]',
    'でも私の心の中の想いと未来と夢が全部ぼやけていく',
    '黄昏の街を彷徨っていた',
  ].join('\n')

  it('提案が空文字にならない', () => {
    for (const s of review(messy).lineSuggestions) {
      expect(s.suggestion.trim().length).toBeGreaterThan(0)
      for (const alt of s.alternatives) expect(alt.trim().length).toBeGreaterThan(0)
    }
  })

  it('提案が元の行と同じにならない', () => {
    for (const s of review(messy).lineSuggestions) {
      expect(s.suggestion).not.toBe(s.original)
    }
  })

  it('行番号が実際の歌詞の行を指している', () => {
    const lines = messy.split('\n')
    for (const s of review(messy).lineSuggestions) {
      expect(lines[s.lineNumber - 1]).toBe(s.original)
    }
  })

  it('残したい表現を含む行には提案を出さない', () => {
    const result = review(messy, { keepPhrases: '君に届けたいうた' })
    expect(result.lineSuggestions.every((s) => !s.original.includes('君に届けたいうた'))).toBe(true)
  })
})
