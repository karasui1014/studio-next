import { describe, expect, it } from 'vitest'

import {
  DEFAULT_MAX_MORA,
  countMora,
  englishSyllables,
  maxMoraForBpm,
  moraDetail,
} from '../mora'

describe('countMora(かなの基本規則)', () => {
  it('かな1文字を1拍として数える', () => {
    expect(countMora('あいうえお')).toBe(5)
    expect(countMora('さくら')).toBe(3)
  })

  it('拗音は直前のかなと合わせて1拍', () => {
    expect(countMora('きょう')).toBe(2) // きょ + う
    expect(countMora('しゃしん')).toBe(3) // しゃ + し + ん
    expect(countMora('ちょっと')).toBe(3) // ちょ + っ + と
  })

  it('促音・撥音・長音はそれぞれ1拍', () => {
    expect(countMora('がっこう')).toBe(4) // が + っ + こ + う
    expect(countMora('ほんとう')).toBe(4)
    expect(countMora('コーヒー')).toBe(4) // コ + ー + ヒ + ー
  })

  it('句読点や記号は拍に数えない', () => {
    expect(countMora('あ、い。う!')).toBe(3)
    expect(countMora('ゆめ 」')).toBe(2)
  })
})

describe('countMora(漢字の読み)', () => {
  it('辞書にある語は読みの拍数で数える', () => {
    expect(countMora('東京')).toBe(4) // とうきょう
    expect(countMora('今日')).toBe(2) // きょう
    expect(countMora('明日')).toBe(3) // あした
    expect(countMora('心')).toBe(3) // こころ
  })

  it('長い見出しが単漢字より優先される', () => {
    expect(countMora('今日')).toBe(2) // 「今」+「日」= 3 ではない
    expect(countMora('笑顔')).toBe(3) // えがお(顔=2 の単純加算ではない)
  })

  it('送りがなは別に数える', () => {
    expect(countMora('帰る')).toBe(3) // かえ + る
    expect(countMora('見た')).toBe(2) // み + た
    expect(countMora('続いていく')).toBe(6) // つづ + いていく
  })

  it('辞書に無い漢字は2拍と推定し、内訳に残す', () => {
    const detail = moraDetail('鬱蒼')
    expect(detail.count).toBe(4)
    expect(detail.unknownKanji).toEqual(['鬱', '蒼'])
  })

  it('文字数ではなく拍で数えている(漢字を過小評価しない)', () => {
    const line = '東京の夜空'
    expect(line.length).toBe(5)
    expect(countMora(line)).toBe(8) // とうきょう(4)+の(1)+よぞら(3)
  })
})

describe('countMora(英語・数字)', () => {
  it('英単語は音節数で数える', () => {
    expect(englishSyllables('night')).toBe(1)
    expect(englishSyllables('make')).toBe(1)
    expect(englishSyllables('memory')).toBe(3)
    expect(countMora('good night')).toBe(2)
  })

  it('数字は日本語読みの拍数で数える', () => {
    expect(countMora('3')).toBe(2) // さん
    expect(countMora('24')).toBe(5) // に + じゅう + よん
    expect(countMora('10')).toBe(2) // じゅう
  })

  it('混在した行も数えられる', () => {
    // 24(5) + じかん(3) + えいぎょう…ではなく辞書外なので営(2)+業(2) + の(1)
    expect(countMora('24時間')).toBe(8) // にじゅうよん(5) + じかん(3)
  })
})

describe('maxMoraForBpm', () => {
  it('BPMが速いほど1行に入る拍数が少なくなる', () => {
    expect(maxMoraForBpm('80')).toBe(24)
    expect(maxMoraForBpm('120')).toBe(16)
    expect(maxMoraForBpm('60')).toBe(32)
  })

  it('未入力や異常値は既定値を使う', () => {
    expect(maxMoraForBpm('')).toBe(DEFAULT_MAX_MORA)
    expect(maxMoraForBpm('はやめ')).toBe(DEFAULT_MAX_MORA)
    expect(maxMoraForBpm('999')).toBe(DEFAULT_MAX_MORA)
  })

  it('単位つきの表記も読める', () => {
    expect(maxMoraForBpm('BPM 90')).toBe(maxMoraForBpm('90'))
    expect(maxMoraForBpm('120bpm')).toBe(16)
  })

  it('極端なテンポでも常識的な範囲に収まる', () => {
    expect(maxMoraForBpm('200')).toBe(14)
    expect(maxMoraForBpm('45')).toBe(34)
  })
})
