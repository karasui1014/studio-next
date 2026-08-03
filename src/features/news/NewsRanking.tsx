import { headline, type NewsItem } from '@/core/content/types'
import { cn } from '@/core/ui/cn'
import { relativeTime } from './format'

const MEDAL = [
  'bg-premium text-[#1a1205]',
  'bg-muted-foreground/60 text-card',
  'bg-[#c97b3c]/75 text-[#1a1205]',
]

/**
 * 注目ニュース（ランキング）。
 * 順位は収集時に計算した「初心者の関心度」スコア順で、1話題につき1本だけ載せている。
 */
export function NewsRanking({ items }: { items: NewsItem[] }) {
  if (items.length < 3) return null

  return (
    <section className="rounded-lg border border-primary/25 bg-gradient-to-b from-primary/[0.07] to-card px-4 pb-2 pt-3.5">
      <div className="mb-2 flex items-baseline gap-2.5">
        <h2 className="text-sm font-extrabold">🏆 注目ニュース</h2>
        <span className="text-[11px] text-muted-foreground">
          いま読むならこの{items.length}本
        </span>
      </div>

      <ol>
        {items.map((item, i) => (
          <li key={item.id} className="border-t border-border/60 first:border-t-0">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer external"
              referrerPolicy="no-referrer"
              className="flex items-start gap-3 py-2.5"
            >
              <span
                className={cn(
                  'mt-0.5 grid h-[21px] w-[21px] shrink-0 place-items-center rounded-md text-[11px] font-extrabold tabular-nums',
                  MEDAL[i] ?? 'bg-muted text-muted-foreground',
                )}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-3 text-[13.5px] font-semibold leading-snug [overflow-wrap:anywhere]">
                  {headline(item)}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10.5px] text-muted-foreground">
                  <span>{item.source}</span>
                  {item.coverage > 1 && (
                    <span className="rounded bg-destructive/15 px-1.5 py-px font-bold text-destructive">
                      {item.coverage}媒体が報道
                    </span>
                  )}
                  <span className="ml-auto tabular-nums">{relativeTime(item.published)}</span>
                </div>
              </div>
            </a>
          </li>
        ))}
      </ol>
    </section>
  )
}
