import type { SongStatus } from './deps'

/**
 * 歌詞添削AIの入力。
 * ジャンル・感情・BPMなどは既存Song型に無い(genre以外)ため、
 * Song型を肥大化させず、このツールの補足入力として持つ(基盤HANDOFF準拠)。
 */
export interface LyricsReviewInput {
  // 必須項目
  lyrics: string // 歌詞本文
  genre: string // 曲のジャンル
  emotion: string // 表現したい感情
  audience: string // 想定する聴き手
  // 任意項目
  theme: string // 曲のテーマ
  vocal: string // ボーカルの性別・声質
  bpm: string
  duration: string // 曲の長さ
  era: string // 参考にしたい時代(アーティスト名は一般要素へ変換される)
  service: string // 使用予定のAI音楽サービス
  mode: ReviewMode // 添削モード
  intensity: ReviewIntensity // 添削の強さ
  keepPhrases: string // 残したい表現(改行・読点区切り)
  avoidWords: string // 使用したくない表現(改行・読点区切り)
  concern: string // 自分で気になっている部分
  /** 「一部だけ再生成」でバリエーションを変えるためのシード */
  seed: number
}

/** 添削モード */
export type ReviewMode =
  | 'light' // 軽く整える
  | 'singability' // 歌いやすくする
  | 'chorus' // サビを強くする
  | 'imagery' // 情景を豊かにする
  | 'simple' // 言葉をやさしくする
  | 'originality' // 独自性を高める
  | 'repetition' // 繰り返しを改善する
  | 'rewrite' // 全面的に作り直す

export const REVIEW_MODES: { id: ReviewMode; label: string; description: string }[] = [
  { id: 'light', label: '軽く整える', description: '目立つ引っかかりだけを最小限直します' },
  { id: 'singability', label: '歌いやすくする', description: '一行の長さと発音のしやすさを優先します' },
  { id: 'chorus', label: 'サビを強くする', description: 'サビの入りとフックの繰り返しを重点添削します' },
  { id: 'imagery', label: '情景を豊かにする', description: '抽象的な言葉を具体的な景色に置き換えます' },
  { id: 'simple', label: '言葉をやさしくする', description: '硬い言葉・難しい言葉をやさしい表現にします' },
  { id: 'originality', label: '独自性を高める', description: 'ありがちな言い回しをあなたらしい表現に変えます' },
  { id: 'repetition', label: '繰り返しを改善する', description: '繰り返しの効き方(多すぎ・少なすぎ)を整えます' },
  { id: 'rewrite', label: '全面的に作り直す', description: '意図と構成を残したまま全行を提案し直します' },
]

/** 添削の強さ */
export type ReviewIntensity = 'gentle' | 'standard' | 'bold'

export const REVIEW_INTENSITIES: { id: ReviewIntensity; label: string; description: string }[] = [
  { id: 'gentle', label: '控えめ', description: '特に気になる数行だけ提案します' },
  { id: 'standard', label: '標準', description: 'バランスよく提案します' },
  { id: 'bold', label: 'しっかり', description: '気づいた行はすべて提案します' },
]

/** 選択した既存曲から自動収集する読み取り専用コンテキスト */
export interface LyricsReviewSongContext {
  songId?: string
  songTitle: string
  status?: SongStatus
  /** 最新Sunoプロンプト(ジャンル・BPMのヒントとして使う) */
  sunoPrompt: string
  mvPrompt: string
  historyCount: number
  completed: boolean
}

export type LinePriority = 'high' | 'medium' | 'low'

/** 行単位の指摘 */
export interface LineSuggestion {
  /** 安定ID(採用/却下の紐付けに使う) */
  id: string
  /** どのルールで検出したか */
  ruleId: string
  /** どのセクションの行か(推定含む) */
  sectionLabel: string
  /** 原文全体での行番号(1始まり) */
  lineNumber: number
  /** 元の行 */
  original: string
  /** 問題 */
  problem: string
  /** 理由 */
  reason: string
  /** 修正候補(改行を含む場合は行分割の提案) */
  suggestion: string
  /** 別候補 */
  alternatives: string[]
  /** 優先度 */
  priority: LinePriority
  /** 元のまま残す場合の考え方(残す選択肢を常に示す) */
  keepNote: string
}

/** 項目別評価の軸 */
export type AxisId =
  | 'singability' // 歌いやすさ
  | 'rhythm' // リズム
  | 'naturalness' // 言葉の自然さ
  | 'imagery' // 情景の伝わりやすさ
  | 'originality' // 独自性
  | 'chorusImpact' // サビの印象
  | 'repetition' // 繰り返しの効果

/** 点数を目立たせない3段階評価 */
export type AxisLevel = 'good' | 'ok' | 'needs_work'

export interface AxisEvaluation {
  axis: AxisId
  label: string
  level: AxisLevel
  comment: string
}

/** 別の方向性の提案 */
export interface AlternativeDirection {
  title: string
  description: string
  /** 方向性のイメージが伝わる短いサンプル行(このツールが生成した独自の例) */
  sampleLines: string[]
}

/** アーティスト名→一般要素への変換結果(存命アーティストの模倣防止) */
export interface StyleConversion {
  note: string
  elements: { label: string; value: string }[]
}

export type Confidence = 'high' | 'medium' | 'low'

/** 構造化された添削結果(Schemaバージョン付き) */
export interface LyricsReviewResult {
  schemaVersion: number
  overallComment: string // 全体コメント
  goodPoints: string[] // 良い部分
  topPriority: string // 最優先で直す部分
  axes: AxisEvaluation[] // 項目別評価
  improvementOrder: string[] // 改善優先順位
  lineSuggestions: LineSuggestion[] // 行単位の指摘
  revisedFullText: string // 添削後全文(全提案を採用した場合)
  alternatives: AlternativeDirection[] // 別の方向性
  nextAdvice: string[] // 次回意識すること
  assumptions: string[] // AIが推測した部分
  styleConversion?: StyleConversion
  structureEstimated: boolean // 歌詞構造をAIが推定したか
  confidence: Confidence // 確信度
  confidenceNote: string
}

export const LYRICS_REVIEW_SCHEMA_VERSION = 1

/** 行ごとの採用状態。実行履歴(ToolRunRecord)に保存する */
export interface LineDecision {
  suggestionId: string
  status: 'adopted' | 'rejected' | 'pending'
  /** 別案や再生成を選んだ場合に確定したテキスト */
  chosenText?: string
}

export function createEmptyInput(): LyricsReviewInput {
  return {
    lyrics: '',
    genre: '',
    emotion: '',
    audience: '',
    theme: '',
    vocal: '',
    bpm: '',
    duration: '',
    era: '',
    service: '',
    mode: 'light',
    intensity: 'standard',
    keepPhrases: '',
    avoidWords: '',
    concern: '',
    seed: 0,
  }
}

/** 必須項目チェック。満たしていない場合は理由の配列を返す */
export function validateInput(input: LyricsReviewInput): string[] {
  const errors: string[] = []
  if (!input.lyrics.trim()) errors.push('「歌詞本文」を入力してください')
  if (!input.genre.trim()) errors.push('「曲のジャンル」を入力してください')
  if (!input.emotion.trim()) errors.push('「表現したい感情」を入力してください')
  if (!input.audience.trim()) errors.push('「想定する聴き手」を入力してください')
  return errors
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string')
}

const AXIS_IDS: AxisId[] = [
  'singability',
  'rhythm',
  'naturalness',
  'imagery',
  'originality',
  'chorusImpact',
  'repetition',
]

const LEVELS: AxisLevel[] = ['good', 'ok', 'needs_work']
const PRIORITIES: LinePriority[] = ['high', 'medium', 'low']
const CONFIDENCES: Confidence[] = ['high', 'medium', 'low']

/**
 * 構造化出力のSchema検証。
 * モック(および将来の外部AI)の出力が画面の期待する形かを確認し、
 * 問題があれば人間が読めるエラー配列を返す(空配列=合格)。
 */
export function validateResult(value: unknown): string[] {
  const errors: string[] = []
  if (typeof value !== 'object' || value === null) return ['結果がオブジェクトではありません']
  const r = value as Record<string, unknown>

  if (r.schemaVersion !== LYRICS_REVIEW_SCHEMA_VERSION) {
    errors.push(
      `Schemaバージョンが一致しません(期待: ${LYRICS_REVIEW_SCHEMA_VERSION} / 実際: ${String(r.schemaVersion)})`,
    )
  }
  if (typeof r.overallComment !== 'string' || !r.overallComment) errors.push('全体コメントがありません')
  if (!isStringArray(r.goodPoints) || r.goodPoints.length === 0) errors.push('良い部分がありません')
  if (typeof r.topPriority !== 'string' || !r.topPriority) errors.push('最優先で直す部分がありません')
  if (typeof r.revisedFullText !== 'string') errors.push('添削後全文がありません')
  if (!isStringArray(r.improvementOrder)) errors.push('改善優先順位がありません')
  if (!isStringArray(r.nextAdvice)) errors.push('次回意識することがありません')
  if (!isStringArray(r.assumptions)) errors.push('AIが推測した部分がありません')
  if (typeof r.structureEstimated !== 'boolean') errors.push('構造推定フラグがありません')
  if (!CONFIDENCES.includes(r.confidence as Confidence)) errors.push('確信度が不正です')
  if (typeof r.confidenceNote !== 'string') errors.push('確信度の説明がありません')

  if (!Array.isArray(r.axes) || r.axes.length !== AXIS_IDS.length) {
    errors.push('項目別評価が7軸そろっていません')
  } else {
    for (const axis of r.axes as unknown[]) {
      const a = axis as Record<string, unknown>
      if (
        typeof a !== 'object' ||
        a === null ||
        !AXIS_IDS.includes(a.axis as AxisId) ||
        !LEVELS.includes(a.level as AxisLevel) ||
        typeof a.label !== 'string' ||
        typeof a.comment !== 'string'
      ) {
        errors.push('項目別評価の形式が不正です')
        break
      }
    }
  }

  if (!Array.isArray(r.lineSuggestions)) {
    errors.push('行単位の指摘がありません')
  } else {
    for (const s of r.lineSuggestions as unknown[]) {
      const l = s as Record<string, unknown>
      if (
        typeof l !== 'object' ||
        l === null ||
        typeof l.id !== 'string' ||
        typeof l.lineNumber !== 'number' ||
        typeof l.original !== 'string' ||
        typeof l.problem !== 'string' ||
        typeof l.reason !== 'string' ||
        typeof l.suggestion !== 'string' ||
        typeof l.keepNote !== 'string' ||
        !isStringArray(l.alternatives) ||
        !PRIORITIES.includes(l.priority as LinePriority)
      ) {
        errors.push('行単位の指摘の形式が不正です')
        break
      }
    }
  }

  if (!Array.isArray(r.alternatives)) {
    errors.push('別の方向性がありません')
  } else {
    for (const alt of r.alternatives as unknown[]) {
      const a = alt as Record<string, unknown>
      if (
        typeof a !== 'object' ||
        a === null ||
        typeof a.title !== 'string' ||
        typeof a.description !== 'string' ||
        !isStringArray(a.sampleLines)
      ) {
        errors.push('別の方向性の形式が不正です')
        break
      }
    }
  }

  return errors
}
