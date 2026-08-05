import { useEffect, useState } from 'react'

import type {
  HomeContent, NewsContent, NewsItem, NewsCategory, PicksContent, SubstackPick,
} from './types'

/**
 * コンテンツの読み込み。
 *
 * ■ 安全のうえで大事なこと
 * ここで読むのは外部サイトの文章を集めたJSON。画面に出す前に必ず
 *   - リンクは http / https のみ許可（javascript: を弾く）
 *   - 文字数の上限を切る
 * を通す。表示側では絶対に innerHTML を使わない（Reactの既定どおり）。
 */

const CATEGORIES: NewsCategory[] = ['jp', 'global', 'official', 'youtube']

function safeUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null
  try {
    const u = new URL(url, window.location.href)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
  } catch {
    return null
  }
}

function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

function strOrNull(value: unknown, max: number): string | null {
  const s = str(value, max)
  return s ? s : null
}

function toItem(raw: unknown): NewsItem | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  const url = safeUrl(r.url)
  const title = str(r.title, 300).trim()
  if (!url || !title) return null

  const category = CATEGORIES.includes(r.category as NewsCategory)
    ? (r.category as NewsCategory)
    : 'global'

  return {
    id: str(r.id, 64) || url,
    title,
    titleJa: strOrNull(r.titleJa, 300),
    url,
    summary: str(r.summary, 400),
    summaryJa: strOrNull(r.summaryJa, 400),
    published: strOrNull(r.published, 40),
    source: str(r.source, 60),
    via: strOrNull(r.via, 30),
    category,
    lang: r.lang === 'ja' ? 'ja' : 'en',
    coverage: Math.min(Math.max(Number(r.coverage) || 1, 1), 99),
    score: Number(r.score) || 0,
  }
}

export async function loadNews(): Promise<NewsContent> {
  const res = await fetch(`${import.meta.env.BASE_URL}content/news.json`, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`ニュースを読み込めませんでした (HTTP ${res.status})`)

  const data = (await res.json()) as Record<string, unknown>
  const items = Array.isArray(data.items)
    ? data.items.map(toItem).filter((v): v is NewsItem => v !== null)
    : []

  return {
    generatedAt: strOrNull(data.generatedAt, 40),
    items,
    ranking: Array.isArray(data.ranking)
      ? data.ranking.filter((v): v is string => typeof v === 'string')
      : [],
    sources: Array.isArray(data.sources) ? (data.sources as NewsContent['sources']) : [],
    xLinks: Array.isArray(data.xLinks)
      ? (data.xLinks as { name: string; url: string }[]).filter((l) => l && l.name && safeUrl(l.url))
      : [],
  }
}

interface AsyncState<T> {
  data: T | null
  error: string | null
  loading: boolean
}

/** ニュースを読み込むフック。画面が表に戻ったときに取り直す。 */
export function useNews(): AsyncState<NewsContent> {
  const [state, setState] = useState<AsyncState<NewsContent>>({
    data: null,
    error: null,
    loading: true,
  })

  useEffect(() => {
    let alive = true

    const run = () => {
      loadNews()
        .then((data) => alive && setState({ data, error: null, loading: false }))
        .catch((err: Error) => alive && setState({ data: null, error: err.message, loading: false }))
    }

    run()

    const onVisible = () => {
      if (document.visibilityState === 'visible') run()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return state
}

// ---------------------------------------------------------------
// トップページの手書きコンテンツ
// ---------------------------------------------------------------

function toArray<T>(value: unknown, map: (raw: Record<string, unknown>) => T | null): T[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === 'object')
    .map(map)
    .filter((v): v is T => v !== null)
}

/** ツール1件。今日のツールと図鑑で同じ形を使う。 */
function toTool(r: Record<string, unknown>) {
  const url = safeUrl(r.url)
  const name = str(r.name, 80)
  if (!url || !name) return null
  return {
    id: str(r.id, 64) || name,
    name,
    emoji: str(r.emoji, 8) || '🛠',
    logo: safeUrl(r.logo) || undefined,
    description: str(r.description, 400),
    url,
    category: str(r.category, 30),
  }
}

export async function loadHome(): Promise<HomeContent> {
  const res = await fetch(`${import.meta.env.BASE_URL}content/home.json`, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`トップページの内容を読み込めませんでした (HTTP ${res.status})`)
  const d = (await res.json()) as Record<string, unknown>

  const sub = (d.substack ?? null) as Record<string, unknown> | null
  const subUrl = sub ? safeUrl(sub.url) : null

  return {
    daily: toArray(d.daily, (r) => {
      const message = str(r.message, 300)
      if (!message) return null
      return {
        id: str(r.id, 64) || message.slice(0, 24),
        date: str(r.date, 20),
        label: str(r.label, 30) || '今日のおすすめ',
        message,
        actionLabel: str(r.actionLabel, 30),
        to: strOrNull(r.to, 120),
        url: safeUrl(r.url),
      }
    }),
    picks: toArray(d.picks, (r) => {
      const title = str(r.title, 200)
      if (!title) return null
      return {
        id: str(r.id, 64) || title,
        date: str(r.date, 20),
        tag: str(r.tag, 20) || 'Pick',
        topic: str(r.topic, 60),
        title,
        free: str(r.free, 2000),
        premium: str(r.premium, 8000),
        author: str(r.author, 60),
      }
    }),
    todayTools: toArray(d.todayTools, toTool),
    toolsGuide: toArray(d.toolsGuide, toTool),
    prompts: toArray(d.prompts, (r) => {
      const title = str(r.title, 80)
      const text = str(r.text, 1000)
      if (!title || !text) return null
      return { id: str(r.id, 64) || title, title, text, premium: r.premium === true }
    }),
    youtube: toArray(d.youtube, (r) => {
      const url = safeUrl(r.url)
      const title = str(r.title, 200)
      if (!url || !title) return null
      return { id: str(r.id, 64) || url, title, url, meta: str(r.meta, 60) }
    }),
    youtubeChannelUrl: safeUrl(d.youtubeChannelUrl),
    substack:
      sub && subUrl && sub.enabled !== false
        ? {
            enabled: true,
            url: subUrl,
            title: str(sub.title, 200) || 'AI音楽部の記事を読む',
            description: str(sub.description, 400),
            note: str(sub.note, 200),
            buttonLabel: str(sub.buttonLabel, 30) || '無料で登録する',
          }
        : null,
  }
}

// ---------------------------------------------------------------
// カラスイ Picks（Substackから自動取得したもの）
// ---------------------------------------------------------------

interface PickNote { note?: string; prompts?: unknown }

/**
 * Substackの記事と、home.json の制作メモを突き合わせる。
 * 記事は自動で増え、メモは手で足す、という分担にしている。
 */
export async function loadPicks(): Promise<PicksContent> {
  const [picksRes, home] = await Promise.all([
    fetch(`${import.meta.env.BASE_URL}content/picks.json`, { cache: 'no-cache' }),
    loadHomeRaw(),
  ])
  if (!picksRes.ok) throw new Error(`記事を読み込めませんでした (HTTP ${picksRes.status})`)

  const d = (await picksRes.json()) as Record<string, unknown>
  const notes = (home.pickNotes ?? {}) as Record<string, PickNote>

  const items = toArray<SubstackPick>(d.items, (r) => {
    const url = safeUrl(r.url)
    const title = str(r.title, 200)
    if (!url || !title) return null
    const id = str(r.id, 80) || url
    const n = notes[id] ?? {}
    return {
      id,
      title,
      url,
      excerpt: str(r.excerpt, 400),
      image: safeUrl(r.image) ?? '',
      published: strOrNull(r.published, 40),
      note: str(n.note, 1200),
      prompts: Array.isArray(n.prompts)
        ? n.prompts.filter((v): v is string => typeof v === 'string')
        : [],
    }
  })

  return { generatedAt: strOrNull(d.generatedAt, 40), items }
}

/** home.json の生データ（pickNotes を読むためだけに使う） */
async function loadHomeRaw(): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}content/home.json`, { cache: 'no-cache' })
    return res.ok ? ((await res.json()) as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/** カラスイ Picks を読み込むフック */
export function usePicks(): AsyncState<PicksContent> {
  const [state, setState] = useState<AsyncState<PicksContent>>({
    data: null, error: null, loading: true,
  })

  useEffect(() => {
    let alive = true
    loadPicks()
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((err: Error) => alive && setState({ data: null, error: err.message, loading: false }))
    return () => { alive = false }
  }, [])

  return state
}

/** トップページの内容を読み込むフック */
export function useHome(): AsyncState<HomeContent> {
  const [state, setState] = useState<AsyncState<HomeContent>>({
    data: null, error: null, loading: true,
  })

  useEffect(() => {
    let alive = true
    loadHome()
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((err: Error) => alive && setState({ data: null, error: err.message, loading: false }))
    return () => { alive = false }
  }, [])

  return state
}
