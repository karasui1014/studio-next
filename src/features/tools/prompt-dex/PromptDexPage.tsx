import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Copy, Search, Star } from 'lucide-react'

import { recordActivity } from '@/core/storage/activity'
import { cn } from '@/core/ui/cn'
import { inputClass, ToolHeader } from '../ui'
import { promptDexRepository } from './lib/repository'
import { collectOptions, filterAndSort } from './lib/search'
import {
  createEmptyFilters, SORT_LABELS, VOCAL_OPTIONS,
  type PromptEntry, type PromptFilters, type SortKey,
} from './lib/types'

/** 絞り込みのひとつ分（選択肢が無いときは出さない） */
function Select({
  label, value, options, onChange,
}: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  if (options.length === 0) return null
  return (
    <label className="min-w-0">
      <span className="block text-[11px] font-semibold text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full rounded-lg border border-border bg-card px-2 py-1.5 text-[12.5px] outline-none focus:border-primary"
      >
        <option value="">すべて</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  )
}

/**
 * プロンプト工房。
 * 使えたプロンプトを探して、コピーして、★で貯めておく場所。
 * データは端末内（localStorage）にのみ保存され、外部へは送らない。
 */
export function PromptDexPage() {
  const [entries, setEntries] = useState<PromptEntry[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [filters, setFilters] = useState<PromptFilters>(createEmptyFilters)
  const [sort, setSort] = useState<SortKey>('recommended')
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    setEntries([...promptDexRepository.getBuiltins(), ...promptDexRepository.getUserEntries()])
    setFavorites(promptDexRepository.getFavorites())
  }, [])

  const options = useMemo(() => collectOptions(entries), [entries])
  const isFavorite = (id: string) => favorites.includes(id)

  const visible = useMemo(
    () => filterAndSort(entries, filters, sort, isFavorite),
    // favorites は isFavorite 経由で使うので依存に入れる
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, filters, sort, favorites],
  )

  const set = <K extends keyof PromptFilters>(key: K, value: PromptFilters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }))

  const toggleFavorite = (entry: PromptEntry) => {
    const next = isFavorite(entry.id)
      ? favorites.filter((id) => id !== entry.id)
      : [entry.id, ...favorites]
    setFavorites(next)
    promptDexRepository.saveFavorites(next)
  }

  const copy = (entry: PromptEntry) => {
    navigator.clipboard?.writeText(entry.prompt)
    recordActivity({ id: entry.id, kind: 'prompt', label: entry.title, to: '/prompts', url: null })
  }

  return (
    <div className="animate-fade-in pb-6">
      <ToolHeader
        title="プロンプト工房"
        description="使えるプロンプトを探して、コピーして、★で貯めておけます。"
      />

      {/* 検索と絞り込み */}
      <div className="mt-4 rounded-xl border border-border bg-card p-3.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={filters.keyword}
            onChange={(e) => set('keyword', e.target.value)}
            placeholder="キーワードで探す（例: lo-fi、夜、女性ボーカル）"
            className={cn(inputClass, 'pl-9')}
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          <Select label="ジャンル" value={filters.genre} options={options.genres} onChange={(v) => set('genre', v)} />
          <Select label="感情" value={filters.emotion} options={options.emotions} onChange={(v) => set('emotion', v)} />
          <Select label="用途" value={filters.use} options={options.uses} onChange={(v) => set('use', v)} />
          <label className="min-w-0">
            <span className="block text-[11px] font-semibold text-muted-foreground">ボーカル</span>
            <select
              value={filters.vocal}
              onChange={(e) => set('vocal', e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-border bg-card px-2 py-1.5 text-[12.5px] outline-none focus:border-primary"
            >
              <option value="">すべて</option>
              {VOCAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="min-w-0">
            <span className="block text-[11px] font-semibold text-muted-foreground">並び順</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="mt-0.5 w-full rounded-lg border border-border bg-card px-2 py-1.5 text-[12.5px] outline-none focus:border-primary"
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <option key={k} value={k}>{SORT_LABELS[k]}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => set('favoritesOnly', !filters.favoritesOnly)}
            aria-pressed={filters.favoritesOnly}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold',
              filters.favoritesOnly
                ? 'border-premium bg-premium/15 text-premium'
                : 'border-border text-muted-foreground',
            )}
          >
            <Star className={cn('h-3.5 w-3.5', filters.favoritesOnly && 'fill-premium')} />
            ★だけ表示
          </button>
          <button
            type="button"
            onClick={() => { setFilters(createEmptyFilters()); setSort('recommended') }}
            className="rounded-full border border-border px-3 py-1 text-[12px] font-semibold text-muted-foreground"
          >
            条件をクリア
          </button>
          <span className="ml-auto text-[12px] text-muted-foreground">{visible.length}件</span>
        </div>
      </div>

      {/* 一覧 */}
      <div className="mt-4 grid gap-2.5 lg:grid-cols-2 2xl:grid-cols-3">
        {visible.map((e) => {
          const open = openId === e.id
          return (
            <div key={e.id} className="flex flex-col rounded-xl border border-border bg-card p-3.5">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-bold leading-snug">{e.title}</p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                    {e.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleFavorite(e)}
                  aria-pressed={isFavorite(e.id)}
                  aria-label={isFavorite(e.id) ? 'お気に入りから外す' : 'お気に入りに入れる'}
                  className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent"
                >
                  <Star className={cn('h-4 w-4', isFavorite(e.id) && 'fill-premium text-premium')} />
                </button>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {[e.genre, ...e.emotions.slice(0, 2), e.vocal].filter(Boolean).map((t) => (
                  <span key={t} className="rounded bg-muted px-1.5 py-px text-[10.5px] text-muted-foreground">
                    {t}
                  </span>
                ))}
                {e.beginnerFriendly && (
                  <span className="rounded bg-primary/12 px-1.5 py-px text-[10.5px] font-semibold text-primary">
                    はじめてでも使いやすい
                  </span>
                )}
              </div>

              <code className="mt-2.5 block break-all rounded-lg bg-muted px-2.5 py-2 font-mono text-[11.5px] leading-relaxed">
                {e.prompt}
              </code>

              <div className="mt-2.5 flex flex-wrap gap-2">
                <button type="button" onClick={() => copy(e)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-semibold">
                  <Copy className="h-3.5 w-3.5" />
                  コピー
                </button>
                <button type="button" onClick={() => setOpenId(open ? null : e.id)}
                  className="rounded-lg px-2 py-1.5 text-[12.5px] font-semibold text-muted-foreground">
                  {open ? '閉じる' : '使い方を見る'}
                </button>
              </div>

              {open && (
                <div className="mt-2.5 space-y-2 border-t border-border pt-2.5 text-[12px] leading-relaxed">
                  {e.successPoints.length > 0 && (
                    <div>
                      <p className="font-semibold">うまくいきやすい点</p>
                      <ul className="mt-0.5 text-muted-foreground">
                        {e.successPoints.map((s) => <li key={s}>・{s}</li>)}
                      </ul>
                    </div>
                  )}
                  {e.failurePoints.length > 0 && (
                    <div>
                      <p className="font-semibold">つまずきやすい点</p>
                      <ul className="mt-0.5 text-muted-foreground">
                        {e.failurePoints.map((s) => <li key={s}>・{s}</li>)}
                      </ul>
                    </div>
                  )}
                  {e.adjustments.length > 0 && (
                    <div>
                      <p className="font-semibold">調整のしかた</p>
                      <ul className="mt-0.5 text-muted-foreground">
                        {e.adjustments.map((s) => <li key={s}>・{s}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {visible.length === 0 && (
        <p className="py-14 text-center text-sm text-muted-foreground">
          条件に合うプロンプトがありませんでした。
        </p>
      )}

      <Link to="/tools" className="mt-6 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />
        制作ツールへ戻る
      </Link>
    </div>
  )
}
