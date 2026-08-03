import type { SongStatus } from './deps'

/**
 * 分析フォームの入力。
 * 既存Song型にないジャンル以外の項目(BPM・想定視聴者など)は
 * Song型を肥大化させず、このツールの補足入力として持つ。
 */
export interface AiProducerInput {
  // 必須項目
  aim: string // 曲の狙い
  audience: string // 想定する聴き手
  media: string // 公開予定の媒体
  // 「以下のうち一つ以上」の対象
  lyrics: string
  sunoPrompt: string
  selfDescription: string // 制作者自身の説明
  // 任意項目
  genre: string
  bpm: string
  duration: string // 曲の長さ
  concern: string // 気になっている部分
  goal: string // 改善したい目的
  keep: string // 残したい要素
  doNotChange: string // 変更したくない要素
  /** 「一部だけ再生成」でバリエーションを変えるためのシード */
  seed: number
}

/** 選択した既存曲から自動収集する読み取り専用コンテキスト */
export interface AiProducerSongContext {
  songId?: string
  songTitle: string
  status?: SongStatus
  mvPrompt: string
  mvPromptCount: number
  youtubeUrl: string
  youtubeTitle: string
  historyCount: number
  sunoPromptCount: number
  completed: boolean
}

export type SuggestionTarget = 'lyrics' | 'suno' | 'structure' | 'title' | 'input'

export type SuggestionPriority = 'now' | 'later'

/** 改善提案。問題・理由・直し方・修正例・優先度・期待できる変化を必ず持つ */
export interface Suggestion {
  /** 安定したルールID。バージョン比較(前回と今回の課題の突き合わせ)に使う */
  ruleId: string
  target: SuggestionTarget
  problem: string
  reason: string
  fix: string
  example: string
  priority: SuggestionPriority
  expected: string
}

export type Confidence = 'high' | 'medium' | 'low'

export interface AiProducerResult {
  goodPoints: string[] // 良い部分
  biggestProblem: string // 最も大きな問題
  suggestions: Suggestion[] // 改善優先順位(順位順)
  keepAsIs: string[] // 変更しなくてよい部分
  revisedSunoPrompt: string // 修正版Sunoプロンプト
  revisedPromptNotes: string[] // 修正版で何を変えたか
  chorusIdeas: string[] // サビ改善案
  titleIdeas: string[] // タイトル案
  youtubeTips: string[] // YouTube向け改善案
  shortsTips: string[] // Shorts向け改善案
  nextChecklist: string[] // 次回生成チェックリスト
  unknowns: string[] // AIが確認できなかった情報
  confidence: Confidence // 提案の確信度
  confidenceNote: string
}

export function createEmptyInput(): AiProducerInput {
  return {
    aim: '',
    audience: '',
    media: '',
    lyrics: '',
    sunoPrompt: '',
    selfDescription: '',
    genre: '',
    bpm: '',
    duration: '',
    concern: '',
    goal: '',
    keep: '',
    doNotChange: '',
    seed: 0,
  }
}

/** 必須項目チェック。満たしていない場合は理由の配列を返す */
export function validateInput(input: AiProducerInput): string[] {
  const errors: string[] = []
  if (!input.aim.trim()) errors.push('「曲の狙い」を入力してください')
  if (!input.audience.trim()) errors.push('「想定する聴き手」を入力してください')
  if (!input.media.trim()) errors.push('「公開予定の媒体」を入力してください')
  if (!input.lyrics.trim() && !input.sunoPrompt.trim() && !input.selfDescription.trim()) {
    errors.push('歌詞・Sunoプロンプト・曲の説明のうち、どれか1つ以上を入力してください')
  }
  return errors
}
