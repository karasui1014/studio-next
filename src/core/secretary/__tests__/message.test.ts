import { describe, expect, it } from 'vitest'

import type { Song, SongStatus } from '@/core/storage/songs'
import { buildSecretaryMessage, type SecretaryContext } from '../message'
import { DEFAULT_SECRETARY_SETTINGS, type SecretarySettings } from '../types'

function song(patch: Partial<Song> & { title: string; status: SongStatus }): Song {
  return {
    id: `s-${patch.title}`,
    genre: '', mood: '', lyrics: '', sunoPrompt: '', mvPrompt: '', memo: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...patch,
  }
}

function ctx(patch: Partial<SecretaryContext> = {}): SecretaryContext {
  return {
    songs: [],
    settings: DEFAULT_SECRETARY_SETTINGS,
    streak: 1,
    celebratedMilestones: [],
    now: new Date('2026-08-10T10:00:00'),
    ...patch,
  }
}

const settingsWith = (patch: Partial<SecretarySettings>): SecretarySettings => ({
  ...DEFAULT_SECRETARY_SETTINGS,
  ...patch,
})

describe('曲数の節目', () => {
  it('10曲になったら祝い、節目の番号を返す', () => {
    const songs = Array.from({ length: 10 }, (_, i) => song({ title: `曲${i}`, status: 'idea' }))
    const m = buildSecretaryMessage(ctx({ songs }))
    expect(m.milestone).toBe(10)
    expect(m.text).toContain('10曲')
  })

  it('一度祝った節目は二度言わない', () => {
    const songs = Array.from({ length: 10 }, (_, i) => song({ title: `曲${i}`, status: 'idea' }))
    const m = buildSecretaryMessage(ctx({ songs, celebratedMilestones: [10] }))
    expect(m.milestone).toBeUndefined()
  })

  it('複数の節目を超えていたら、大きい方を先に祝う', () => {
    const songs = Array.from({ length: 35 }, (_, i) => song({ title: `曲${i}`, status: 'idea' }))
    expect(buildSecretaryMessage(ctx({ songs })).milestone).toBe(30)
  })

  it('連続日数の節目より曲数の節目が優先される', () => {
    const songs = Array.from({ length: 10 }, (_, i) => song({ title: `曲${i}`, status: 'idea' }))
    expect(buildSecretaryMessage(ctx({ songs, streak: 7 })).milestone).toBe(10)
  })
})

describe('連続日数の節目', () => {
  // gentle は「一週間」、energetic/stoic は「7日」と言い分けるので、
  // 応援スタイルごとに実際の文言で確かめる
  it('7日ちょうどで言う', () => {
    expect(buildSecretaryMessage(ctx({ streak: 7 })).text).toContain('一週間')
    expect(
      buildSecretaryMessage(ctx({ streak: 7, settings: settingsWith({ cheerStyle: 'energetic' }) })).text,
    ).toContain('7日')
  })

  it('30日ちょうどで言う', () => {
    expect(buildSecretaryMessage(ctx({ streak: 30 })).text).toContain('30日')
  })

  it('8日目には言わない', () => {
    const text = buildSecretaryMessage(ctx({ streak: 8 })).text
    expect(text).not.toContain('一週間')
    expect(text).not.toContain('7日')
  })
})

describe('状況に応じた提案', () => {
  it('曲が1曲も無ければ、まず1曲登録するよう促す', () => {
    expect(buildSecretaryMessage(ctx()).text).toContain('1曲')
  })

  it('歌詞だけできている曲があれば、スタイルプロンプトを勧める', () => {
    const songs = [song({ title: '夜明け', status: 'lyrics', lyrics: 'あああ' })]
    const m = buildSecretaryMessage(ctx({ songs }))
    expect(m.text).toContain('夜明け')
    expect(m.text).toContain('プロンプト')
  })

  it('プロンプトまでできてMVが未着手なら、絵コンテを勧める', () => {
    const songs = [song({ title: '海辺', status: 'suno', lyrics: 'あ', sunoPrompt: 'lofi' })]
    const m = buildSecretaryMessage(ctx({ songs }))
    expect(m.text).toContain('海辺')
    expect(m.text).toContain('絵コンテ')
  })

  it('公開済みの曲がある日は、その曲名を挙げて振り返りを勧める', () => {
    const songs = [
      song({ title: '完成作', status: 'published', lyrics: 'あ', sunoPrompt: 'x', mvPrompt: 'y' }),
    ]
    expect(buildSecretaryMessage(ctx({ songs })).text).toContain('完成作')
  })

  it('Master限定のツール名は出さない（プランによって開けないため）', () => {
    const songs = [
      song({ title: '完成作', status: 'published', lyrics: 'あ', sunoPrompt: 'x', mvPrompt: 'y' }),
    ]
    const text = buildSecretaryMessage(ctx({ songs })).text
    for (const masterOnly of ['楽曲批評', '批評ツール', '字幕', 'Seedance']) {
      expect(text).not.toContain(masterOnly)
    }
  })

  it('同じ日なら何度呼んでも同じことを言う', () => {
    const songs = [
      song({ title: 'A', status: 'published', lyrics: 'あ', sunoPrompt: 'x', mvPrompt: 'y' }),
      song({ title: 'B', status: 'lyrics', lyrics: 'い' }),
    ]
    const a = buildSecretaryMessage(ctx({ songs }))
    const b = buildSecretaryMessage(ctx({ songs }))
    expect(a.text).toBe(b.text)
  })
})

describe('設定の反映', () => {
  it('一人称が文章に使われる', () => {
    const songs = Array.from({ length: 10 }, (_, i) => song({ title: `曲${i}`, status: 'idea' }))
    const m = buildSecretaryMessage(ctx({ songs, settings: settingsWith({ firstPerson: 'ボク' }) }))
    expect(m.text).toContain('ボク')
  })

  it('口癖が末尾に付く', () => {
    const m = buildSecretaryMessage(ctx({ settings: settingsWith({ catchphrase: 'にゃ〜' }) }))
    expect(m.text.endsWith('にゃ〜')).toBe(true)
  })

  it('口癖が空欄なら何も足さない', () => {
    expect(buildSecretaryMessage(ctx()).text.endsWith(' ')).toBe(false)
  })

  it('応援スタイルで言い回しが変わる', () => {
    const songs = Array.from({ length: 10 }, (_, i) => song({ title: `曲${i}`, status: 'idea' }))
    const gentle = buildSecretaryMessage(ctx({ songs, settings: settingsWith({ cheerStyle: 'gentle' }) }))
    const energetic = buildSecretaryMessage(ctx({ songs, settings: settingsWith({ cheerStyle: 'energetic' }) }))
    const stoic = buildSecretaryMessage(ctx({ songs, settings: settingsWith({ cheerStyle: 'stoic' }) }))
    expect(new Set([gentle.text, energetic.text, stoic.text]).size).toBe(3)
  })

  it('時間帯で挨拶が変わる', () => {
    const morning = buildSecretaryMessage(ctx({ now: new Date('2026-08-10T08:00:00') }))
    const night = buildSecretaryMessage(ctx({ now: new Date('2026-08-10T22:00:00') }))
    expect(morning.text).toContain('おはよう')
    expect(night.text).toContain('こんばんは')
  })
})

describe('安全性', () => {
  it('曲名をそのまま差し込むだけで、加工や外部送信の余地を作らない', () => {
    const songs = [song({ title: '<script>alert(1)</script>', status: 'lyrics', lyrics: 'あ' })]
    // Reactが描画時にエスケープする。ここでは文字列として保たれていることだけ確認する
    expect(buildSecretaryMessage(ctx({ songs })).text).toContain('<script>alert(1)</script>')
  })

  it('曲が空でも例外にならない', () => {
    expect(() => buildSecretaryMessage(ctx({ songs: [] }))).not.toThrow()
  })
})
