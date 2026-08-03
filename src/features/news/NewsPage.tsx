import { useMemo, useState } from 'react'

import { useNews } from '@/core/content/load'
import type { NewsCategory } from '@/core/content/types'
import { cn } from '@/core/ui/cn'
import { CATEGORY_LABEL } from './format'
import { NewsCard } from './NewsCard'
import { NewsRanking } from './NewsRanking'

type Filter = 'all' | NewsCategory

export function NewsPage() {
  const { data, error, loading } = useNews()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const items = data?.items ?? []

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      if (filter !== 'all' && item.category !== filter) return false
      if (!q) return true
      const hay = [item.title, item.titleJa, item.summary, item.summaryJa, item.source]
        .filter(Boolean).join(' ').toLowerCase()
      return q.split(/\s+/).every((w) => !w || hay.includes(w))
    })
  }, [items, filter, query])

  const ranked = useMemo(() => {
    if (!data) return []
    return data.ranking
      .map((id) => items.find((it) => it.id === id))
      .filter((v): v is NonNullable<typeof v> => Boolean(v))
  }, [data, items])

  const filters: Filter[] = useMemo(() => {
    const cats = (['jp', 'global', 'official', 'youtube'] as NewsCategory[])
      .filter((c) => items.some((i) => i.category === c))
    return ['all', ...cats]
  }, [items])

  const countFor = (f: Filter) =>
    f === 'all' ? items.length : items.filter((i) => i.category === f).length

  return (
    <div className="animate-fade-in">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-xl font-bold">AI音楽ニュース</h1>
        <p className="text-[12px] text-muted-foreground">
          {data?.sources.length ?? 0}の情報源から自動収集・海外記事は日本語に翻訳
        </p>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="キーワードで絞り込む（例: Suno、著作権）"
        className="mt-3 h-10 w-full rounded-lg border border-border bg-muted px-3.5 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors',
              filter === f
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            {f === 'all' ? 'すべて' : CATEGORY_LABEL[f]}
            <span className="text-[11px] tabular-nums opacity-75">{countFor(f)}</span>
          </button>
        ))}
      </div>

      {loading && <p className="mt-8 text-center text-sm text-muted-foreground">読み込んでいます…</p>}
      {error && <p className="mt-8 text-center text-sm text-destructive">{error}</p>}

      {!loading && !error && (
        <div className="mt-4 grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-2.5">
            {filter === 'all' && !query && <NewsRanking items={ranked} />}
            {visible.map((item) => <NewsCard key={item.id} item={item} />)}
            {visible.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                条件に合う記事がありませんでした。
              </p>
            )}
          </div>

          <aside className="hidden xl:sticky xl:top-4 xl:block">
            <div className="rounded-lg border border-border bg-card px-4 py-3.5">
              <h2 className="text-[13.5px] font-bold">取得元</h2>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                {data?.sources.filter((s) => s.ok).length}/{data?.sources.length} 稼働中
              </p>
              <ul className="mt-2.5 space-y-1">
                {data?.sources.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 text-[11.5px]">
                    <span className={cn('h-[7px] w-[7px] shrink-0 rounded-full', s.ok ? 'bg-emerald-500' : 'bg-destructive')} />
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{s.name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground/70">
                      {s.ok ? `${s.matched}件` : '失敗'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
