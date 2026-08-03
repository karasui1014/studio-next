import { describe, expect, it } from 'vitest'

import {
  expandConcept,
  generateConcepts,
  neutralizeStyleText,
  reapplyConsistency,
  regenerateShot,
} from '../generate'
import {
  createEmptyInput,
  formatSec,
  parseDurationSec,
  validateConcepts,
  validateInput,
  validatePlanDetail,
  type MvIdeaInput,
  type MvIdeaSongContext,
  type MvPlanMode,
} from '../types'

function sampleInput(overrides: Partial<MvIdeaInput> = {}): MvIdeaInput {
  return {
    ...createEmptyInput(),
    title: '雨上がりの探偵',
    description: '夜の街を歩く探偵を描いたローファイ曲',
    genre: 'lofi hip hop',
    mood: '切ない、落ち着いた',
    durationText: '3:30',
    media: 'YouTube',
    mode: 'ai-video',
    stage: '夜の探偵事務所と雨上がりの路地',
    ...overrides,
  }
}

const CONTEXT: MvIdeaSongContext = {
  songTitle: '(曲未選択)',
  sunoPrompt: '',
  latestMvPrompt: '',
  existingMvPromptCount: 0,
  youtubeTitle: '',
  youtubeDescription: '',
  youtubeTags: '',
  youtubeUrl: '',
  historyCount: 0,
}

const ALL_MODES: MvPlanMode[] = [
  'low-budget',
  'ai-video',
  'still-image',
  'lyric-video',
  'story',
  'shorts',
  'youtube',
]

describe('入力チェックと尺の解析', () => {
  it('必須6項目が空ならエラー、埋めれば通る', () => {
    expect(validateInput(createEmptyInput())).toHaveLength(6)
    expect(validateInput(sampleInput())).toHaveLength(0)
  })

  it('各種の長さ表記を秒へ変換できる', () => {
    expect(parseDurationSec('3:30')).toBe(210)
    expect(parseDurationSec('210')).toBe(210)
    expect(parseDurationSec('3分30秒')).toBe(210)
    expect(parseDurationSec('90秒')).toBe(90)
    expect(parseDurationSec('3')).toBe(180) // 小さい数は「分」とみなす
    expect(parseDurationSec('abc')).toBeNull()
    expect(formatSec(210)).toBe('3:30')
  })
})

describe('第1段階: 企画案3件の生成', () => {
  it('全モードで方向性の異なる3案が生成されSchema検証を通る', () => {
    for (const mode of ALL_MODES) {
      const { concepts } = generateConcepts(sampleInput({ mode }), CONTEXT)
      expect(validateConcepts(concepts), `mode=${mode}`).toEqual([])
      const approaches = new Set(concepts.map((c) => c.approach))
      expect(approaches.size, `mode=${mode}: 3案の方向性が重複`).toBe(3)
    }
  })

  it('seedを変えると別の組み合わせになる', () => {
    const a = generateConcepts(sampleInput({ seed: 0 }), CONTEXT)
    const b = generateConcepts(sampleInput({ seed: 1 }), CONTEXT)
    expect(a.concepts.map((c) => c.approach)).not.toEqual(b.concepts.map((c) => c.approach))
  })
})

describe('第2段階: 詳細企画書への展開', () => {
  it('Schema検証を通り、ショットの時間が整合する', () => {
    const input = sampleInput()
    const { concepts } = generateConcepts(input, CONTEXT)
    const detail = expandConcept(input, CONTEXT, concepts[0])

    expect(validatePlanDetail(detail)).toEqual([])
    expect(detail.durationSec).toBe(210)
    expect(detail.orientation).toBe('horizontal')
    expect(detail.shots.length).toBeGreaterThan(0)
    expect(detail.shots[0].startSec).toBe(0)
    expect(detail.shots[detail.shots.length - 1].endSec).toBe(210)
    for (let i = 1; i < detail.shots.length; i++) {
      expect(detail.shots[i].startSec, `S${i + 1}の開始時間`).toBe(detail.shots[i - 1].endSec)
    }
    expect(detail.timeline[0].startSec).toBe(0)
    expect(detail.timeline[detail.timeline.length - 1].endSec).toBe(210)
    detail.shots.forEach((s, i) => expect(s.no).toBe(i + 1))
  })

  it('Shortsモードは60秒以内・縦型になる', () => {
    const input = sampleInput({ mode: 'shorts' })
    const { concepts } = generateConcepts(input, CONTEXT)
    const detail = expandConcept(input, CONTEXT, concepts[0])
    expect(detail.durationSec).toBeLessThanOrEqual(60)
    expect(detail.orientation).toBe('vertical')
  })

  it('一貫性設定が全ショットのプロンプトへ反映される', () => {
    const input = sampleInput()
    const { concepts } = generateConcepts(input, CONTEXT)
    const detail = expandConcept(input, CONTEXT, concepts[0])
    for (const shot of detail.shots) {
      expect(shot.imagePrompt).toContain(detail.consistency.colors)
      expect(shot.videoPrompt).toContain(detail.consistency.colors)
      expect(shot.negativePrompt).toContain('実在の人物')
    }
  })
})

describe('ショットの再生成と一貫性の再反映', () => {
  it('一貫性設定を変えて再反映すると新しいプロンプトに入る', () => {
    const input = sampleInput()
    const { concepts } = generateConcepts(input, CONTEXT)
    const detail = expandConcept(input, CONTEXT, concepts[0])
    const changed = { ...detail.consistency, colors: 'TEST_TOKEN_XYZ' }
    const shot = reapplyConsistency(detail.shots[0], changed)
    expect(shot.imagePrompt).toContain('TEST_TOKEN_XYZ')
    expect(shot.videoPrompt).toContain('TEST_TOKEN_XYZ')
    expect(shot.scene).toBe(detail.shots[0].scene) // 場面説明は変わらない
  })

  it('一部再生成はseedオフセットで構図・カメラが変わる', () => {
    const input = sampleInput()
    const { concepts } = generateConcepts(input, CONTEXT)
    const detail = expandConcept(input, CONTEXT, concepts[0])
    const original = detail.shots[0]
    const regen1 = regenerateShot(original, concepts[0].approach, detail.consistency, 1)
    const regen2 = regenerateShot(original, concepts[0].approach, detail.consistency, 2)
    expect([regen1.composition, regen1.cameraMove, regen1.subjectMove]).not.toEqual([
      regen2.composition,
      regen2.cameraMove,
      regen2.subjectMove,
    ])
    expect(regen1.id).toBe(original.id) // 同じショットの再生成
  })
})

describe('固有名詞の一般要素への変換', () => {
  it('作家名が一般要素へ変換され、生成結果に残らない', () => {
    const converted = neutralizeStyleText('新海誠風の映像にしたい')
    expect(converted.text).not.toContain('新海')
    expect(converted.notes).toHaveLength(1)

    const input = sampleInput({
      visualStyle: '新海誠風でお願いします',
      referenceNote: 'ジブリっぽい背景の画像',
    })
    const { concepts, conversionNotes } = generateConcepts(input, CONTEXT)
    expect(conversionNotes.length).toBeGreaterThanOrEqual(2)
    for (const c of concepts) {
      const text = JSON.stringify(c)
      expect(text).not.toContain('新海')
      expect(text).not.toContain('ジブリ')
    }
    const detail = expandConcept(input, CONTEXT, concepts[0])
    expect(JSON.stringify(detail)).not.toContain('新海')
  })
})

describe('Schema検証(壊れた構造の検出)', () => {
  it('件数不足・方向性重複・欠損フィールドを検出する', () => {
    const { concepts } = generateConcepts(sampleInput(), CONTEXT)
    expect(validateConcepts(concepts.slice(0, 2)).length).toBeGreaterThan(0)
    expect(validateConcepts([...concepts.slice(0, 2), concepts[0]]).length).toBeGreaterThan(0)

    const detail = expandConcept(sampleInput(), CONTEXT, concepts[0])
    expect(validatePlanDetail({ ...detail, conceptTitle: '' }).length).toBeGreaterThan(0)
    expect(validatePlanDetail({ ...detail, shots: [] }).length).toBeGreaterThan(0)
    expect(validatePlanDetail(null).length).toBeGreaterThan(0)
  })
})
