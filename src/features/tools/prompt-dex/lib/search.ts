import { BUILTIN_PROMPTS } from './data'
import {
  BPM_BANDS,
  bpmToBand,
  type PromptEntry,
  type PromptFilters,
  type SortKey,
} from './types'

/** キーワード検索の対象になるテキストをまとめる */
function haystack(entry: PromptEntry): string {
  return [
    entry.title,
    entry.prompt,
    entry.description,
    entry.genre,
    entry.subgenre,
    entry.era,
    ...entry.emotions,
    ...entry.instruments,
    ...entry.uses,
    ...entry.services,
    ...entry.tags,
  ]
    .join(' ')
    .toLowerCase()
}

/** 1件がフィルタ条件を満たすか */
export function matchesFilters(
  entry: PromptEntry,
  filters: PromptFilters,
  isFavorite: (id: string) => boolean,
): boolean {
  if (filters.favoritesOnly && !isFavorite(entry.id)) return false
  if (filters.owner === 'builtin' && entry.source !== 'builtin') return false
  if (filters.owner === 'mine' && entry.source === 'builtin') return false
  if (filters.genre && entry.genre !== filters.genre) return false
  if (filters.subgenre && entry.subgenre !== filters.subgenre) return false
  if (filters.emotion && !entry.emotions.includes(filters.emotion)) return false
  if (filters.use && !entry.uses.includes(filters.use)) return false
  if (filters.vocal && entry.vocal !== filters.vocal) return false
  if (filters.bpm && entry.bpm !== filters.bpm) return false
  if (filters.service && !entry.services.includes(filters.service)) return false
  if (filters.tag && !entry.tags.includes(filters.tag)) return false
  if (filters.keyword.trim()) {
    const words = filters.keyword.toLowerCase().split(/\s+/).filter(Boolean)
    const hay = haystack(entry)
    if (!words.every((w) => hay.includes(w))) return false
  }
  return true
}

const BPM_ORDER: Record<string, number> = Object.fromEntries(
  BPM_BANDS.map((band, i) => [band.value, i]),
)

/** 並び替え(recommended = 初心者向け→builtin優先→タイトル) */
export function sortEntries(entries: PromptEntry[], sort: SortKey): PromptEntry[] {
  const copy = [...entries]
  switch (sort) {
    case 'title':
      return copy.sort((a, b) => a.title.localeCompare(b.title, 'ja'))
    case 'newest':
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    case 'bpm':
      return copy.sort(
        (a, b) => (BPM_ORDER[a.bpm] ?? 99) - (BPM_ORDER[b.bpm] ?? 99) || a.title.localeCompare(b.title, 'ja'),
      )
    case 'recommended':
    default:
      return copy.sort((a, b) => {
        if (a.beginnerFriendly !== b.beginnerFriendly) return a.beginnerFriendly ? -1 : 1
        if (a.source !== b.source) return a.source === 'builtin' ? -1 : 1
        return a.title.localeCompare(b.title, 'ja')
      })
  }
}

/** 絞り込み + 並び替えをまとめて適用 */
export function filterAndSort(
  entries: PromptEntry[],
  filters: PromptFilters,
  sort: SortKey,
  isFavorite: (id: string) => boolean,
): PromptEntry[] {
  return sortEntries(
    entries.filter((e) => matchesFilters(e, filters, isFavorite)),
    sort,
  )
}

/** 関連プロンプト。ジャンル/感情/用途/タグ/BPMの重なりでスコア付けし上位を返す */
export function relatedEntries(
  target: PromptEntry,
  all: PromptEntry[],
  limit = 4,
): PromptEntry[] {
  const overlap = (a: string[], b: string[]) => a.filter((x) => b.includes(x)).length
  return all
    .filter((e) => e.id !== target.id)
    .map((e) => {
      let score = 0
      if (e.genre === target.genre) score += 3
      if (e.subgenre && e.subgenre === target.subgenre) score += 2
      score += overlap(e.emotions, target.emotions) * 2
      score += overlap(e.uses, target.uses) * 2
      score += overlap(e.tags, target.tags)
      if (e.bpm === target.bpm) score += 1
      if (e.vocal === target.vocal) score += 1
      return { e, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.e.title.localeCompare(b.e.title, 'ja'))
    .slice(0, limit)
    .map((x) => x.e)
}

export interface FilterOptions {
  genres: string[]
  subgenres: string[]
  emotions: string[]
  uses: string[]
  services: string[]
  tags: string[]
}

/** データから絞り込みドロップダウンの選択肢を動的に集める(データと常に同期) */
export function collectOptions(entries: PromptEntry[]): FilterOptions {
  const set = (pick: (e: PromptEntry) => string[]) =>
    [...new Set(entries.flatMap(pick))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'ja'))
  return {
    genres: set((e) => [e.genre]),
    subgenres: set((e) => [e.subgenre]),
    emotions: set((e) => e.emotions),
    uses: set((e) => e.uses),
    services: set((e) => e.services),
    tags: set((e) => e.tags),
  }
}

/**
 * AIプロデューサーの分析結果 → 図鑑の検索条件。
 * ここに変換ロジックを置くことで、AIプロデューサー側の変更を最小限にする。
 * 扱う条件: ジャンル・感情・用途・BPM帯・ボーカル・問題の種類・タグ。
 */
export interface ProducerSearchCriteria {
  genre?: string
  /** 曲の狙い(aim)。感情語を推定するのに使う */
  aim?: string
  /** 公開媒体(media)。用途を推定するのに使う */
  media?: string
  /** BPM(数値文字列可) */
  bpm?: string
  /** ボーカル(あれば) */
  vocal?: string
  /** 直したい問題の種類(AIプロデューサーの Suggestion.target) */
  problem?: string
  tag?: string
}

const AIM_EMOTION_MAP: Array<[RegExp, string]> = [
  [/切な|泣け|涙|別れ/, '切ない'],
  [/元気|明る|前向き|応援/, '前向き'],
  [/夜|深夜|ドライブ/, 'ノスタルジック'],
  [/落ち着|癒し|リラックス|作業/, '落ち着く'],
  [/懐かし|ノスタル|レトロ/, 'ノスタルジック'],
  [/熱|激し|疾走|かっこ/, '熱い'],
  [/高揚|盛り上/, '高揚'],
]

const MEDIA_USE_MAP: Array<[RegExp, string]> = [
  [/shorts|ショート|tiktok|ティックトック|リール/i, 'Shorts'],
  [/作業|bgm|勉強|study/i, '作業用BGM'],
  [/game|ゲーム/i, 'ゲーム'],
  [/youtube|ユーチューブ|mv|動画/i, 'YouTube'],
]

const PROBLEM_TAG_MAP: Record<string, string> = {
  suno: 'サビ映え',
  structure: 'フック',
  lyrics: 'フック',
  title: 'キャッチー',
}

/** よくある英語/ローマ字ジャンル名 → 図鑑の日本語ジャンル */
const GENRE_ALIASES: Record<string, string> = {
  'j-pop': 'J-POP',
  jpop: 'J-POP',
  pop: 'J-POP',
  rock: 'ロック',
  'anime song': 'アニソン',
  anison: 'アニソン',
  ballad: 'バラード',
  'lo-fi': 'Lo-fi',
  lofi: 'Lo-fi',
  edm: 'EDM',
  'game music': 'ゲーム音楽',
  bgm: '作業用BGM',
  instrumental: 'インストゥルメンタル',
  'city pop': 'シティポップ',
  citypop: 'シティポップ',
  'r&b': 'R&B',
  rnb: 'R&B',
}

/** 初期収録データに存在するジャンルの集合(連携時の妥当性チェックに使う) */
const KNOWN_GENRES = new Set(BUILTIN_PROMPTS.map((e) => e.genre))

/**
 * 曲の自由入力ジャンルを図鑑のジャンル語彙へ寄せる。
 * 別名にヒットすればそれを、既知ジャンルと一致すればそのまま、
 * どちらでもなければ undefined(=ジャンル絞り込みをかけない)。
 * これにより、語彙違いで検索結果が0件になるのを防ぐ。
 */
function normalizeGenre(raw: string): string | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  const alias = GENRE_ALIASES[trimmed.toLowerCase()]
  if (alias) return alias
  if (KNOWN_GENRES.has(trimmed)) return trimmed
  return undefined
}

/** criteria から PromptFilters を組み立てる(未指定は空=すべて) */
export function criteriaToFilters(criteria: ProducerSearchCriteria): Partial<PromptFilters> {
  const filters: Partial<PromptFilters> = {}
  if (criteria.genre) {
    const genre = normalizeGenre(criteria.genre)
    if (genre) filters.genre = genre
  }
  if (criteria.aim) {
    const hit = AIM_EMOTION_MAP.find(([re]) => re.test(criteria.aim!))
    if (hit) filters.emotion = hit[1]
  }
  if (criteria.media) {
    const hit = MEDIA_USE_MAP.find(([re]) => re.test(criteria.media!))
    if (hit) filters.use = hit[1]
  }
  if (criteria.bpm) {
    const n = parseInt(criteria.bpm, 10)
    if (!Number.isNaN(n)) {
      const band = bpmToBand(n)
      if (band) filters.bpm = band
    }
  }
  if (criteria.vocal?.trim()) filters.vocal = criteria.vocal.trim()
  if (criteria.tag?.trim()) filters.tag = criteria.tag.trim()
  else if (criteria.problem && PROBLEM_TAG_MAP[criteria.problem]) {
    filters.tag = PROBLEM_TAG_MAP[criteria.problem]
  }
  return filters
}

/** criteria から図鑑への遷移URL(#付きHashRouter用の相対パス)を作る */
export function buildProducerSearchQuery(criteria: ProducerSearchCriteria): string {
  const filters = criteriaToFilters(criteria)
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, String(value))
  }
  const qs = params.toString()
  return `/tools/prompt-dex${qs ? `?${qs}` : ''}`
}
