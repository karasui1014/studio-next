import { useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'

import { useHome } from '@/core/content/load'
import { recordActivity } from '@/core/storage/activity'
import { cn } from '@/core/ui/cn'

/**
 * AIツール図鑑。
 * 実際に使ったツールだけを、用途で引けるようにまとめた場所。
 * 中身は public/content/home.json の toolsGuide を編集すれば増やせる。
 */
export function ToolsGuidePage() {
  const { data, error, loading } = useHome()
  const [category, setCategory] = useState('')

  const tools = data?.toolsGuide ?? []
  const categories = useMemo(
    () => [...new Set(tools.map((t) => t.category).filter(Boolean))],
    [tools],
  )
  const visible = category ? tools.filter((t) => t.category === category) : tools

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-bold">AIツール図鑑</h1>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
        実際に使ってみたものだけを載せています。無料でどこまで試せるかも書いています。
      </p>

      {categories.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {['', ...categories].map((c) => (
            <button
              key={c || 'all'}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors',
                category === c
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground',
              )}
            >
              {c || 'すべて'}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="py-10 text-center text-sm text-muted-foreground">読み込んでいます…</p>}
      {error && <p className="py-10 text-center text-sm text-destructive">{error}</p>}

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((t) => (
          <a
            key={t.id}
            href={t.url}
            target="_blank"
            rel="noopener noreferrer external"
            referrerPolicy="no-referrer"
            onClick={() =>
              recordActivity({ id: t.id, kind: 'external', label: t.name, to: null, url: t.url })
            }
            className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-muted text-xl">
              {t.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="text-[14px] font-bold">{t.name}</span>
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </span>
              {t.category && (
                <span className="mt-1 inline-block rounded bg-muted px-1.5 py-px text-[10.5px] text-muted-foreground">
                  {t.category}
                </span>
              )}
              <span className="mt-1.5 block text-[12px] leading-relaxed text-muted-foreground">
                {t.description}
              </span>
            </span>
          </a>
        ))}
      </div>

      {!loading && visible.length === 0 && (
        <p className="py-14 text-center text-sm text-muted-foreground">
          この条件のツールはまだありません。
        </p>
      )}
    </div>
  )
}
