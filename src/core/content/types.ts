/**
 * 配信コンテンツの型。
 *
 * public/content/ 以下のJSONは GitHub Actions が毎日書き換える。
 * アプリのビルドとは切り離されているので、ここは「外から来るデータ」として
 * 常に疑って扱う（core/content/load.ts で検証してから画面に渡す）。
 */

export type NewsCategory = 'jp' | 'global' | 'official' | 'youtube'

export interface NewsItem {
  id: string
  title: string
  /** 海外記事の日本語訳。無ければ原文のまま表示する */
  titleJa: string | null
  url: string
  summary: string
  summaryJa: string | null
  published: string | null
  source: string
  /** Googleニュース経由などの経由元 */
  via: string | null
  category: NewsCategory
  lang: 'ja' | 'en'
  /** 同じ話題を報じた媒体の数。多いほど注目度が高い */
  coverage: number
  /** 注目度スコア（初心者の関心を基準に採点） */
  score: number
}

export interface NewsSourceStatus {
  id: string
  name: string
  category: string
  ok: boolean
  matched: number
  error: string | null
}

export interface NewsContent {
  generatedAt: string | null
  items: NewsItem[]
  /** 注目ランキングに出す記事のID（上位から順に） */
  ranking: string[]
  sources: NewsSourceStatus[]
  xLinks: { name: string; url: string }[]
}

/** 記事の見出し（日本語訳があればそちら） */
export function headline(item: NewsItem): string {
  return item.titleJa || item.title
}

/** 記事の本文要約（日本語訳があればそちら） */
export function digest(item: NewsItem): string {
  return item.titleJa ? item.summaryJa || '' : item.summary
}

// ---------------------------------------------------------------
// トップページの手書きコンテンツ（public/content/home.json）
// ---------------------------------------------------------------

/** Substackから取り込んだ記事。Studioには全文を載せず、入口として見せる。 */
export interface SubstackPick {
  id: string
  title: string
  url: string
  excerpt: string
  image: string
  published: string | null
  /** Studio限定の制作メモ（Premiumで読める）。home.json の pickNotes から */
  note: string
  /** 関連プロンプトのID */
  prompts: string[]
}

export interface PicksContent {
  generatedAt: string | null
  items: SubstackPick[]
}

export interface Pick {
  id: string
  date: string
  tag: string
  topic: string
  title: string
  /** 無料プランで読める範囲 */
  free: string
  /** Premium で読める全文 */
  premium: string
  author: string
}

export interface ToolPick {
  id: string
  name: string
  emoji: string
  /** サービスのロゴ画像URL（任意）。読み込めない場合はemojiにフォールバックする */
  logo?: string
  description: string
  url: string
  /** 図鑑での分類（今日のツールでは空） */
  category: string
}

export interface PromptPick {
  id: string
  title: string
  text: string
  premium: boolean
}

export interface VideoPick {
  id: string
  title: string
  url: string
  meta: string
}

export interface SubstackConfig {
  enabled: boolean
  url: string
  title: string
  description: string
  /** 登録のハードルを下げる一言 */
  note: string
  buttonLabel: string
}

/** Studioからの今日の一言 */
export interface DailyTip {
  id: string
  /** 日付を指定した固定の一言（YYYY-MM-DD）。空なら日替わりの「たね」として扱う */
  date: string
  label: string
  message: string
  actionLabel: string
  to: string | null
  url: string | null
}

export interface HomeContent {
  daily: DailyTip[]
  picks: Pick[]
  todayTools: ToolPick[]
  toolsGuide: ToolPick[]
  prompts: PromptPick[]
  youtube: VideoPick[]
  youtubeChannelUrl: string | null
  substack: SubstackConfig | null
}
