import { describe, expect, it } from 'vitest'

import {
  makeCombinedVideoPrompt,
  makePlanMemoText,
  resultToJson,
  resultToMarkdown,
  sanitizeFilename,
  shotsToCsv,
} from '../export'
import { expandConcept, generateConcepts } from '../generate'
import {
  createEmptyInput,
  type MvIdeaInput,
  type MvIdeaResult,
  type MvIdeaSongContext,
} from '../types'

const CONTEXT: MvIdeaSongContext = {
  songTitle: 'テスト曲',
  sunoPrompt: '',
  latestMvPrompt: '',
  existingMvPromptCount: 0,
  youtubeTitle: '',
  youtubeDescription: '',
  youtubeTags: '',
  youtubeUrl: '',
  historyCount: 0,
}

function buildFixture(): { input: MvIdeaInput; result: MvIdeaResult } {
  const input: MvIdeaInput = {
    ...createEmptyInput(),
    title: '夜間飛行',
    description: '深夜のドライブ曲',
    genre: 'synthwave',
    mood: 'クールで疾走感',
    durationText: '2:00',
    media: 'YouTube',
    mode: 'ai-video',
  }
  const { concepts, conversionNotes } = generateConcepts(input, CONTEXT)
  const detail = expandConcept(input, CONTEXT, concepts[0])
  return {
    input,
    result: {
      schemaVersion: 1,
      concepts,
      conversionNotes,
      selectedConceptId: concepts[0].id,
      detail,
    },
  }
}

const META = { songTitle: 'テスト曲', createdAt: '2026-07-21 10:00', providerName: 'スタジオ内蔵生成' }

describe('書き出し', () => {
  it('Markdown: 結果画面の順序でセクションが並ぶ', () => {
    const { input, result } = buildFixture()
    const md = resultToMarkdown(input, result, META)
    const sections = [
      '## 1. 企画案(3案)',
      '## 2. 選択した企画の全体像',
      '## 3. 世界観設定',
      '## 4. 時系列の構成',
      '## 5. ショットリスト',
      '## 6. 画像生成プロンプト',
      '## 7. 動画生成プロンプト',
      '## 8. 必要素材',
      '## 9. 制作チェックリスト',
      '## 10. サムネイル案',
      '## 11. Shorts転用案',
      '## 12. 一貫性設定',
    ]
    let cursor = -1
    for (const section of sections) {
      const index = md.indexOf(section)
      expect(index, `${section} の位置`).toBeGreaterThan(cursor)
      cursor = index
    }
    expect(md).toContain('★選択')
  })

  it('Markdown: 詳細未生成でも企画案だけ書き出せる', () => {
    const { input, result } = buildFixture()
    const md = resultToMarkdown(
      input,
      { ...result, detail: undefined, selectedConceptId: undefined },
      META,
    )
    expect(md).toContain('## 1. 企画案(3案)')
    expect(md).toContain('詳細企画書は未生成')
  })

  it('JSON: 往復変換で内容が保たれる', () => {
    const { input, result } = buildFixture()
    const parsed = JSON.parse(resultToJson(input, result, META))
    expect(parsed.tool).toBe('mv-idea')
    expect(parsed.input.title).toBe('夜間飛行')
    expect(parsed.result.detail.shots).toHaveLength(result.detail?.shots.length ?? -1)
  })

  it('CSV: BOM付き・15列・エスケープが正しい', () => {
    const { result } = buildFixture()
    const detail = result.detail
    expect(detail).toBeDefined()
    if (!detail) return
    const shots = [...detail.shots]
    shots[0] = { ...shots[0], scene: '雨,"夜"の路地\n続き' }
    const csv = shotsToCsv(shots)
    expect(csv.startsWith('﻿')).toBe(true)
    const headerLine = csv.slice(1).split('\r\n')[0]
    expect(headerLine.split(',')).toHaveLength(17)
    expect(csv).toContain('"雨,""夜""の路地\n続き"')
    expect(csv).toContain('S01')
  })

  it('まとめプロンプトと企画メモが組み立てられる', () => {
    const { result } = buildFixture()
    const detail = result.detail
    expect(detail).toBeDefined()
    if (!detail) return
    const combined = makeCombinedVideoPrompt(detail)
    expect(combined.split('\n')).toHaveLength(detail.shots.length)
    expect(combined.startsWith('【S01|0:00〜')).toBe(true)
    const memo = makePlanMemoText(detail)
    expect(memo).toContain('■ 企画:')
    expect(memo).toContain('サビの見せ場:')
  })

  it('sanitizeFilename: 使えない文字を除去する', () => {
    expect(sanitizeFilename('夜間 飛行/MV:v1')).toBe('夜間-飛行-MV-v1')
    expect(sanitizeFilename('   ')).toBe('mv-plan')
  })
})
