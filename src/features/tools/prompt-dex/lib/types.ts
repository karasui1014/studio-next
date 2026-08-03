/**
 * プロンプト図鑑のデータモデル。
 * 「単なる一覧」ではなく「どんな条件で使い・何が成功しやすく・どう調整するか」まで
 * 学べる図鑑にするため、成功点/失敗点/調整方法を必須項目として持つ。
 */

export const PROMPT_DEX_SCHEMA_VERSION = 1

/** データの種類。将来 'from-community' などを足す場合もここへ追加する */
export type PromptSource = 'builtin' | 'user' | 'from-ai-producer' | 'imported'

export interface PromptEntry {
  id: string
  title: string
  /** プロンプト本文(Sunoなどに貼るスタイル指定) */
  prompt: string
  /** 日本語説明 */
  description: string
  genre: string
  subgenre: string
  /** 感情(複数) */
  emotions: string[]
  /** BPM帯。BPM_BANDS の value を1つ持つ */
  bpm: string
  /** ボーカル属性。VOCAL_OPTIONS の value を1つ持つ */
  vocal: string
  /** 楽器(複数) */
  instruments: string[]
  /** 時代感 */
  era: string
  /** 用途(複数) */
  uses: string[]
  /** 対応AI音楽サービス(複数) */
  services: string[]
  /** 初心者向けか */
  beginnerFriendly: boolean
  /** 成功しやすい点 */
  successPoints: string[]
  /** 失敗しやすい点 */
  failurePoints: string[]
  /** 調整方法 */
  adjustments: string[]
  tags: string[]
  version: string
  createdAt: string
  updatedAt: string
  source: PromptSource
  schemaVersion: number
}

/** BPM帯の定義。フィルタ表示にも、AIプロデューサーからの数値→帯変換にも使う */
export const BPM_BANDS = [
  { value: 'slow', label: 'スロー(〜75)', min: 0, max: 75 },
  { value: 'mid', label: 'ミッド(76〜105)', min: 76, max: 105 },
  { value: 'upper', label: 'アッパー(106〜125)', min: 106, max: 125 },
  { value: 'fast', label: 'ファスト(126〜)', min: 126, max: 999 },
] as const

export const VOCAL_OPTIONS = [
  { value: 'female', label: '女性ボーカル' },
  { value: 'male', label: '男性ボーカル' },
  { value: 'mixed', label: '男女/コーラス' },
  { value: 'instrumental', label: 'インスト(歌なし)' },
] as const

export const SOURCE_LABELS: Record<PromptSource, string> = {
  builtin: '初期収録',
  user: '自分用',
  'from-ai-producer': 'AIプロデューサーから保存',
  imported: 'インポート',
}

export function bpmBandLabel(value: string): string {
  return BPM_BANDS.find((b) => b.value === value)?.label ?? value
}

export function vocalLabel(value: string): string {
  return VOCAL_OPTIONS.find((v) => v.value === value)?.label ?? value
}

/** 数値BPMを帯の value へ変換(AIプロデューサー連携で使用) */
export function bpmToBand(bpm: number): string | undefined {
  return BPM_BANDS.find((b) => bpm >= b.min && bpm <= b.max)?.value
}

/** 収録元の絞り込み。'' すべて / 'builtin' 初期収録 / 'mine' 自分の辞書(自分用・インポート・AI由来) */
export type OwnerFilter = '' | 'builtin' | 'mine'

/** 絞り込み条件。'' は「すべて」を意味する */
export interface PromptFilters {
  keyword: string
  genre: string
  subgenre: string
  emotion: string
  use: string
  vocal: string
  bpm: string
  service: string
  tag: string
  owner: OwnerFilter
  favoritesOnly: boolean
}

export type SortKey = 'recommended' | 'title' | 'newest' | 'bpm'

export const SORT_LABELS: Record<SortKey, string> = {
  recommended: 'おすすめ順',
  title: 'タイトル順',
  newest: '新しい順',
  bpm: 'BPMが遅い順',
}

export function createEmptyFilters(): PromptFilters {
  return {
    keyword: '',
    genre: '',
    subgenre: '',
    emotion: '',
    use: '',
    vocal: '',
    bpm: '',
    service: '',
    tag: '',
    owner: '',
    favoritesOnly: false,
  }
}

/** 自分用プロンプトの入力(編集フォーム用)。ID・日時・source・schemaは付与側で設定 */
export type PromptEntryInput = Omit<
  PromptEntry,
  'id' | 'createdAt' | 'updatedAt' | 'source' | 'schemaVersion'
>

export function createEmptyEntryInput(): PromptEntryInput {
  return {
    title: '',
    prompt: '',
    description: '',
    genre: '',
    subgenre: '',
    emotions: [],
    bpm: 'mid',
    vocal: 'female',
    instruments: [],
    era: '',
    uses: [],
    services: ['Suno'],
    beginnerFriendly: false,
    successPoints: [],
    failurePoints: [],
    adjustments: [],
    tags: [],
    version: 'v1',
  }
}

/** 自分用プロンプト保存前の必須チェック。満たさない理由を返す */
export function validateEntryInput(input: PromptEntryInput): string[] {
  const errors: string[] = []
  if (!input.title.trim()) errors.push('タイトルを入力してください')
  if (!input.prompt.trim()) errors.push('プロンプト本文を入力してください')
  if (!input.genre.trim()) errors.push('ジャンルを入力してください')
  return errors
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string')
}

/**
 * 未知の値を安全に PromptEntry へ変換する(インポート・バックアップ復元で使用)。
 * 必須(id/title/prompt)が壊れていれば null。他は既定値で補完し、
 * 壊れたファイルでもアプリが落ちないようにする。
 */
export function normalizeEntry(raw: unknown, fallbackSource: PromptSource): PromptEntry | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || typeof r.title !== 'string' || typeof r.prompt !== 'string') {
    return null
  }
  const now = new Date().toISOString()
  const validSources: PromptSource[] = ['builtin', 'user', 'from-ai-producer', 'imported']
  return {
    id: r.id,
    title: r.title,
    prompt: r.prompt,
    description: typeof r.description === 'string' ? r.description : '',
    genre: typeof r.genre === 'string' ? r.genre : '',
    subgenre: typeof r.subgenre === 'string' ? r.subgenre : '',
    emotions: asStringArray(r.emotions),
    bpm: typeof r.bpm === 'string' ? r.bpm : 'mid',
    vocal: typeof r.vocal === 'string' ? r.vocal : 'female',
    instruments: asStringArray(r.instruments),
    era: typeof r.era === 'string' ? r.era : '',
    uses: asStringArray(r.uses),
    services: asStringArray(r.services),
    beginnerFriendly: typeof r.beginnerFriendly === 'boolean' ? r.beginnerFriendly : false,
    successPoints: asStringArray(r.successPoints),
    failurePoints: asStringArray(r.failurePoints),
    adjustments: asStringArray(r.adjustments),
    tags: asStringArray(r.tags),
    version: typeof r.version === 'string' ? r.version : 'v1',
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : now,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : now,
    source: validSources.includes(r.source as PromptSource)
      ? (r.source as PromptSource)
      : fallbackSource,
    schemaVersion:
      typeof r.schemaVersion === 'number' ? r.schemaVersion : PROMPT_DEX_SCHEMA_VERSION,
  }
}
