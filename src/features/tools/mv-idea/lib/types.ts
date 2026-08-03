import type { SongStatus } from './deps'

/**
 * MVアイデア生成AIの型定義とSchema検証。
 * テストは src/lib/tools/mv-idea/__tests__/ にあり、`npm test`(vitest)で実行する。
 */

/** 企画モード */
export type MvPlanMode =
  | 'low-budget'
  | 'ai-video'
  | 'still-image'
  | 'lyric-video'
  | 'story'
  | 'shorts'
  | 'youtube'

export const MV_PLAN_MODES: { id: MvPlanMode; label: string; hint: string }[] = [
  { id: 'low-budget', label: '低予算で作る', hint: '無料枠・少ない素材で完成させる構成にします' },
  { id: 'ai-video', label: 'AI動画中心で作る', hint: '動画生成AIの得意な4〜8秒ショットで組み立てます' },
  { id: 'still-image', label: '静止画中心で作る', hint: '画像+ズーム/パンで映像化する構成にします' },
  { id: 'lyric-video', label: '歌詞動画として作る', hint: '歌詞タイポグラフィを主役にします' },
  { id: 'story', label: '物語中心で作る', hint: '小さなストーリーを軸に構成します' },
  { id: 'shorts', label: 'Shorts向けに作る', hint: '縦型・60秒以内・冒頭勝負の構成にします' },
  { id: 'youtube', label: 'YouTube向けに作る', hint: 'フル尺の横型MVとして構成します' },
]

/** 画面の向き */
export type MvOrientation = 'horizontal' | 'vertical'

/** 入力フォーム。Song型を肥大化させず、ツール固有の項目はここで持つ */
export interface MvIdeaInput {
  // 必須項目
  title: string // 曲名
  description: string // 曲の説明
  genre: string
  mood: string // 曲の感情
  durationText: string // 曲の長さ(「3:30」「210秒」など自由入力)
  media: string // 公開予定の媒体
  mode: MvPlanMode // 企画モード
  // 任意項目
  lyrics: string
  bpm: string
  audience: string // 想定する視聴者
  visualStyle: string // 希望する映像表現
  characters: string // 登場人物
  stage: string // 舞台
  era: string // 時代
  colorMood: string // 色の雰囲気
  orientation: MvOrientation | '' // 縦型または横型(空=モードから自動)
  budget: string // 制作予算
  videoAiTool: string // 使用予定の動画生成AI
  availableAssets: string // 使用できる素材
  avoid: string // 避けたい表現
  referenceNote: string // 参考画像の説明
  /** 「一部再生成」でバリエーションを変えるシード */
  seed: number
}

/** 選択した既存曲から自動収集する読み取り専用コンテキスト */
export interface MvIdeaSongContext {
  songId?: string
  songTitle: string
  status?: SongStatus
  sunoPrompt: string
  latestMvPrompt: string
  existingMvPromptCount: number
  youtubeTitle: string
  youtubeDescription: string
  youtubeTags: string
  youtubeUrl: string
  historyCount: number
}

/** 企画の方向性(3案の差別化に使う) */
export type MvApproach =
  | 'story'
  | 'performance'
  | 'lyric-graphic'
  | 'still-anime'
  | 'abstract'
  | 'slice-of-life'
  | 'loop'

export type MvDifficulty = 'easy' | 'normal' | 'hard'
export type MvBudgetTier = 'free' | 'low' | 'mid'

export const DIFFICULTY_META: Record<MvDifficulty, { label: string; badge: string }> = {
  easy: { label: '低', badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  normal: { label: '中', badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  hard: { label: '高', badge: 'bg-rose-500/15 text-rose-600 dark:text-rose-400' },
}

export const BUDGET_META: Record<MvBudgetTier, { label: string; badge: string }> = {
  free: { label: '無料枠中心', badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  low: { label: '低予算', badge: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  mid: { label: '中予算', badge: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' },
}

/** 第1段階: 方向性の異なる企画案 */
export interface MvConcept {
  id: string
  approach: MvApproach
  conceptTitle: string // 企画タイトル
  oneLiner: string // 一文で説明した企画
  aim: string // 狙い
  world: string // 世界観
  mainVisuals: string[] // 主な映像表現
  opening3s: string // 冒頭3秒
  chorusHighlight: string // サビの見せ場
  ending: string // ラスト
  difficulty: MvDifficulty
  budgetTier: MvBudgetTier
  timeEstimate: string // 制作時間の目安
  suitableMedia: string[] // 向いている媒体
}

/** 一貫性設定。各ショットのプロンプトへ反映する共通設定 */
export interface MvConsistency {
  characters: string // 登場人物
  ageRange: string // 年齢層
  hair: string // 髪型
  outfit: string // 衣装
  expression: string // 表情
  stage: string // 舞台
  era: string // 時代
  colors: string // 色
  light: string // 光
  lens: string // レンズ感
  texture: string // 映像の質感
  forbidden: string // 禁止事項
}

/** ショット1件 */
export interface MvShot {
  id: string
  no: number // ショット番号
  startSec: number // 開始時間(秒)
  endSec: number // 終了時間(秒)
  /** 所属する時系列ブロック名(イントロ/サビ等)。v1レコードには無いため任意 */
  block?: string
  /** このショットで画面に出す歌詞(歌詞動画モードのみ)。文字は編集時に載せる前提 */
  lyricText?: string
  scene: string // 場面説明
  composition: string // カメラ構図
  cameraMove: string // カメラの動き
  subjectMove: string // 被写体の動き
  background: string // 背景
  light: string // 光
  imagePrompt: string // 画像生成プロンプト
  videoPrompt: string // 動画生成プロンプト
  negativePrompt: string // ネガティブプロンプト
  assets: string // 必要素材
  editMemo: string // 編集メモ
}

/** ショットの秒数(終了-開始)。表示・CSVで使う */
export function shotSeconds(shot: Pick<MvShot, 'startSec' | 'endSec'>): number {
  return Math.max(0, Math.round((shot.endSec - shot.startSec) * 10) / 10)
}

/** 時系列の構成ブロック(イントロ/サビ等) */
export interface MvTimelineBlock {
  id: string
  label: string
  startSec: number
  endSec: number
  summary: string
}

/** 第2段階: 詳細企画書 */
export interface MvPlanDetail {
  conceptTitle: string // 企画タイトル
  overview: string // 企画概要
  aim: string // 狙い
  audience: string // 想定視聴者
  world: string // 世界観
  colorAndLight: string // 色と光
  characters: string // 登場人物
  stage: string // 舞台
  storyFlow: string[] // 物語の流れ
  opening3s: string // 冒頭3秒
  chorusHighlight: string // サビの見せ場
  lastScene: string // ラストシーン
  orientation: MvOrientation // 縦型/横型
  durationSec: number // 想定尺(秒)
  timeline: MvTimelineBlock[] // タイムライン
  shots: MvShot[] // ショットリスト
  requiredAssets: string[] // 必要素材(全体)
  difficulty: MvDifficulty // 制作難易度
  timeEstimate: string // 制作時間の目安
  budgetTier: MvBudgetTier // 予算区分
  editNotes: string[] // 編集メモ
  thumbnailIdeas: string[] // サムネイル案
  shortsIdeas: string[] // Shorts転用案
  checklist: string[] // 制作チェックリスト
  consistency: MvConsistency // 一貫性設定
}

/** 結果Schemaのバージョン(構造を変えたら上げる。基盤HANDOFFの慣例) */
export const MV_IDEA_SCHEMA_VERSION = 2

/** 実行結果。ToolRunRecordの `result` に入る(バックアップ互換のためこの形を守る) */
export interface MvIdeaResult {
  schemaVersion: number
  concepts: MvConcept[]
  /** 固有名詞→一般要素の変換メモ(変換がなければ空配列) */
  conversionNotes: string[]
  selectedConceptId?: string
  detail?: MvPlanDetail
}

export function createEmptyInput(): MvIdeaInput {
  return {
    title: '',
    description: '',
    genre: '',
    mood: '',
    durationText: '',
    media: '',
    mode: 'ai-video',
    lyrics: '',
    bpm: '',
    audience: '',
    visualStyle: '',
    characters: '',
    stage: '',
    era: '',
    colorMood: '',
    orientation: '',
    budget: '',
    videoAiTool: '',
    availableAssets: '',
    avoid: '',
    referenceNote: '',
    seed: 0,
  }
}

/**
 * 入力欄ごとの最大文字数。
 * 目的は3つ: (1)巨大テキスト貼り付けによるUI凍結の防止 (2)実行履歴1件が
 * localStorageを圧迫して他のデータ(曲・イベント)の保存を妨げるのを防ぐ
 * (3)生成プロンプトが実用不能な長さになるのを防ぐ。
 */
export const MAX_INPUT_LENGTHS = {
  title: 120,
  description: 600,
  genre: 80,
  mood: 120,
  durationText: 20,
  media: 120,
  lyrics: 5000,
  bpm: 10,
  audience: 200,
  visualStyle: 300,
  characters: 300,
  stage: 200,
  era: 60,
  colorMood: 120,
  budget: 80,
  videoAiTool: 80,
  availableAssets: 600,
  avoid: 300,
  referenceNote: 600,
} as const satisfies Partial<Record<keyof MvIdeaInput, number>>

/** 制御文字を除去し、上限文字数で切り詰める(改行とタブは残す) */
export function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return ''
  // eslint-disable-next-line no-control-regex
  const stripped = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  return stripped.length > maxLength ? stripped.slice(0, maxLength) : stripped
}

/**
 * 生成前に入力全体を正規化する。
 * 上限超過・制御文字・不正なseedを取り除き、以降の処理が安全な値だけを扱えるようにする。
 */
export function sanitizeInput(input: MvIdeaInput): MvIdeaInput {
  const sanitized = { ...input }
  for (const [key, max] of Object.entries(MAX_INPUT_LENGTHS)) {
    const field = key as keyof typeof MAX_INPUT_LENGTHS
    sanitized[field] = sanitizeText(input[field], max)
  }
  sanitized.mode = MV_PLAN_MODES.some((m) => m.id === input.mode) ? input.mode : 'ai-video'
  sanitized.orientation =
    input.orientation === 'horizontal' || input.orientation === 'vertical' ? input.orientation : ''
  const seed = Number(input.seed)
  sanitized.seed = Number.isFinite(seed) ? Math.abs(Math.trunc(seed)) % 1000 : 0
  return sanitized
}

/** 必須項目チェック。満たしていない場合は理由の配列を返す */
export function validateInput(input: MvIdeaInput): string[] {
  const errors: string[] = []
  if (!input.title.trim()) errors.push('「曲名」を入力してください')
  if (!input.description.trim()) errors.push('「曲の説明」を入力してください')
  if (!input.genre.trim()) errors.push('「ジャンル」を入力してください')
  if (!input.mood.trim()) errors.push('「曲の感情」を入力してください')
  if (!input.durationText.trim()) errors.push('「曲の長さ」を入力してください')
  if (!input.media.trim()) errors.push('「公開予定の媒体」を入力してください')
  if (input.durationText.trim() && parseDurationSec(input.durationText) === null) {
    errors.push('「曲の長さ」は 3:30 / 210秒 / 3分30秒 のような形式で入力してください')
  }
  return errors
}

/** 企画として成立する尺の範囲(秒)。10秒未満・20分超は企画書として意味を成さない */
export const MIN_DURATION_SEC = 10
export const MAX_DURATION_SEC = 1200
/** 長さが読めなかった場合の既定値(3分30秒) */
export const DEFAULT_DURATION_SEC = 210

/** 尺を安全な範囲に収める。NaN・0・極端な値でも必ず有効な秒数を返す */
export function clampDurationSec(sec: number | null | undefined): number {
  if (typeof sec !== 'number' || !Number.isFinite(sec)) return DEFAULT_DURATION_SEC
  return Math.min(MAX_DURATION_SEC, Math.max(MIN_DURATION_SEC, Math.round(sec)))
}

/** 「3:30」「3分30秒」「210」「210秒」などを秒へ変換。読めなければnull */
export function parseDurationSec(text: unknown): number | null {
  if (typeof text !== 'string') return null
  const t = text.trim().replace(/[  ]/g, '')
  if (!t) return null
  const colon = t.match(/^(\d{1,2})[:'](\d{1,2})$/)
  if (colon) {
    const sec = Number(colon[2])
    if (sec > 59) return null
    return Number(colon[1]) * 60 + sec
  }
  const jp = t.match(/^(\d{1,2})分(?:(\d{1,2})秒?)?$/)
  if (jp) {
    const sec = Number(jp[2] ?? 0)
    if (sec > 59) return null
    return Number(jp[1]) * 60 + sec
  }
  const secOnly = t.match(/^(\d{1,4})秒?$/)
  if (secOnly) {
    const n = Number(secOnly[1])
    if (n === 0) return null
    // 「3」のような小さい数は「分」とみなす
    return n <= 10 ? n * 60 : n
  }
  return null
}

/** 秒 → 「M:SS」表示 */
export function formatSec(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Schema検証(構造化出力の検証)
// モックだけでなく、将来AIプロバイダーがJSONを返す場合も同じ検証を通す。
// ---------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function checkString(obj: Record<string, unknown>, keys: string[], where: string, errors: string[]) {
  for (const key of keys) {
    const v = obj[key]
    if (typeof v !== 'string' || v.trim() === '') {
      errors.push(`${where}の「${key}」が空です`)
    }
  }
}

function checkStringArray(
  obj: Record<string, unknown>,
  keys: string[],
  where: string,
  errors: string[],
) {
  for (const key of keys) {
    const v = obj[key]
    if (!Array.isArray(v) || v.some((item) => typeof item !== 'string')) {
      errors.push(`${where}の「${key}」が文字列の配列ではありません`)
    }
  }
}

const CONCEPT_STRING_KEYS = [
  'id',
  'conceptTitle',
  'oneLiner',
  'aim',
  'world',
  'opening3s',
  'chorusHighlight',
  'ending',
  'timeEstimate',
]

/** 企画案3件のSchema検証。問題なければ空配列 */
export function validateConcepts(value: unknown): string[] {
  const errors: string[] = []
  if (!Array.isArray(value)) return ['企画案が配列ではありません']
  if (value.length !== 3) errors.push(`企画案は3件必要です(現在${value.length}件)`)
  const approaches = new Set<string>()
  value.forEach((c, i) => {
    const where = `企画案${i + 1}`
    if (!isRecord(c)) {
      errors.push(`${where}がオブジェクトではありません`)
      return
    }
    checkString(c, CONCEPT_STRING_KEYS, where, errors)
    checkStringArray(c, ['mainVisuals', 'suitableMedia'], where, errors)
    if (typeof c.approach !== 'string') errors.push(`${where}の「approach」がありません`)
    else approaches.add(c.approach)
  })
  if (value.length === 3 && approaches.size < 3) {
    errors.push('3案の方向性(approach)が重複しています')
  }
  return errors
}

const SHOT_STRING_KEYS = [
  'id',
  'scene',
  'composition',
  'cameraMove',
  'subjectMove',
  'background',
  'light',
  'imagePrompt',
  'videoPrompt',
  'negativePrompt',
]

const DETAIL_STRING_KEYS = [
  'conceptTitle',
  'overview',
  'aim',
  'audience',
  'world',
  'colorAndLight',
  'characters',
  'stage',
  'opening3s',
  'chorusHighlight',
  'lastScene',
  'timeEstimate',
]

const DETAIL_ARRAY_KEYS = [
  'storyFlow',
  'requiredAssets',
  'editNotes',
  'thumbnailIdeas',
  'shortsIdeas',
  'checklist',
]

const CONSISTENCY_KEYS: (keyof MvConsistency)[] = [
  'characters',
  'ageRange',
  'hair',
  'outfit',
  'expression',
  'stage',
  'era',
  'colors',
  'light',
  'lens',
  'texture',
  'forbidden',
]

/** 詳細企画書のSchema検証。問題なければ空配列 */
export function validatePlanDetail(value: unknown): string[] {
  const errors: string[] = []
  if (!isRecord(value)) return ['詳細企画書がオブジェクトではありません']
  checkString(value, DETAIL_STRING_KEYS, '詳細企画書', errors)
  checkStringArray(value, DETAIL_ARRAY_KEYS, '詳細企画書', errors)
  if (typeof value.durationSec !== 'number' || value.durationSec <= 0) {
    errors.push('詳細企画書の「durationSec」が正しくありません')
  }
  if (value.orientation !== 'horizontal' && value.orientation !== 'vertical') {
    errors.push('詳細企画書の「orientation」が正しくありません')
  }
  if (!isRecord(value.consistency)) {
    errors.push('詳細企画書の「一貫性設定」がありません')
  } else {
    for (const key of CONSISTENCY_KEYS) {
      if (typeof value.consistency[key] !== 'string') {
        errors.push(`一貫性設定の「${key}」が文字列ではありません`)
      }
    }
  }
  if (!Array.isArray(value.timeline) || value.timeline.length === 0) {
    errors.push('タイムラインが空です')
  } else {
    value.timeline.forEach((b, i) => {
      if (!isRecord(b) || typeof b.label !== 'string' || typeof b.startSec !== 'number' || typeof b.endSec !== 'number') {
        errors.push(`タイムライン${i + 1}件目の形式が正しくありません`)
      }
    })
  }
  if (!Array.isArray(value.shots) || value.shots.length === 0) {
    errors.push('ショットリストが空です')
  } else {
    value.shots.forEach((s, i) => {
      const where = `ショット${i + 1}`
      if (!isRecord(s)) {
        errors.push(`${where}がオブジェクトではありません`)
        return
      }
      checkString(s, SHOT_STRING_KEYS, where, errors)
      if (typeof s.no !== 'number') errors.push(`${where}の「no」が数値ではありません`)
      if (typeof s.startSec !== 'number' || typeof s.endSec !== 'number' || s.endSec <= s.startSec) {
        errors.push(`${where}の開始/終了時間が正しくありません`)
      }
      if (typeof s.assets !== 'string' || typeof s.editMemo !== 'string') {
        errors.push(`${where}の「assets/editMemo」が文字列ではありません`)
      }
    })
  }
  return errors
}
