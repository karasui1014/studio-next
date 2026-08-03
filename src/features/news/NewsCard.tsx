import { digest, headline, type NewsItem } from '@/core/content/types'
import { cn } from '@/core/ui/cn'
import { CATEGORY_CLASS, CATEGORY_LABEL, isNew, relativeTime } from './format'

/** 記事1件のカード。日本語訳を主役にし、原文は下に小さく添える。 */
export function NewsCard({ item }: { item: NewsItem }) {
  const body = digest(item)

  return (
    <article className="rounded-lg border border-border bg-card transition-colors hover:border-primary/40">
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer external"
        referrerPolicy="no-referrer"
        className="block px-4 py-3"
      >
        <div className="mb-1.5 flex items-center gap-2 text-[11px]">
          <span className={cn('rounded px-1.5 py-px text-[10px] font-bold', CATEGORY_CLASS[item.category])}>
            {CATEGORY_LABEL[item.category]}
          </span>
          <span className="min-w-0 truncate font-semibold text-muted-foreground">
            {item.source}
            {item.via ? ` · ${item.via}` : ''}
          </span>
          {isNew(item.published) && (
            <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-primary ring-[3px] ring-primary/20" />
          )}
          <time className="ml-auto shrink-0 tabular-nums text-muted-foreground">
            {relativeTime(item.published)}
          </time>
        </div>

        <h3 className="line-clamp-4 text-[15px] font-bold leading-relaxed [overflow-wrap:anywhere]">
          {headline(item)}
        </h3>

        {item.titleJa && (
          <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-muted-foreground/85 [overflow-wrap:anywhere]">
            <span className="font-bold opacity-70">原文 </span>
            {item.title}
          </p>
        )}

        {body && (
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
            {body}
          </p>
        )}
      </a>
    </article>
  )
}
