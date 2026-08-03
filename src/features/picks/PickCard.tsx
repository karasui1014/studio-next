import { Link } from 'react-router-dom'
import { ArrowUpRight, Lock, PenLine } from 'lucide-react'

import type { SubstackPick } from '@/core/content/types'
import { useRole } from '@/core/entitlement/role'
import { cn } from '@/core/ui/cn'

function dateText(iso: string | null): string {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const d = new Date(t)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

/**
 * カラスイ Picks のカード。
 *
 * ■ なぜ本文を載せないか
 * 記事の本文は Substack で読んでもらう。Studio に全文を写すと Substack の
 * 読者が育たず、YouTube・Substack・Studio が一緒に育たなくなるため。
 * Studio 側の Premium 価値は「本文の続き」ではなく、
 * この記事を自分の制作にどう使うかという **制作メモ** に置いている。
 */
export function PickCard({ pick, compact = false }: { pick: SubstackPick; compact?: boolean }) {
  const { paid } = useRole()

  return (
    <article className="overflow-hidden rounded-xl border border-primary/25 bg-card">
      <div className={cn('flex gap-4 p-4', compact && 'gap-3.5')}>
        {pick.image && (
          <img
            src={pick.image}
            alt=""
            loading="lazy"
            // 取得できなかった画像は消して、崩れたアイコンを見せない
            onError={(e) => { e.currentTarget.style.display = 'none' }}
            className={cn(
              'shrink-0 rounded-lg border border-border object-cover',
              compact ? 'h-16 w-16' : 'hidden h-24 w-24 sm:block',
            )}
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-primary/15 px-1.5 py-px text-[10px] font-bold text-primary">
              カラスイ Picks
            </span>
            {pick.published && (
              <span className="text-[11px] text-muted-foreground">{dateText(pick.published)}</span>
            )}
          </div>

          <h3 className="mt-1.5 text-[15px] font-bold leading-snug [overflow-wrap:anywhere]">
            {pick.title}
          </h3>

          {pick.excerpt && (
            <p className="mt-1.5 line-clamp-3 text-[12.5px] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
              {pick.excerpt}
            </p>
          )}

          <a
            href={pick.url}
            target="_blank"
            rel="noopener noreferrer external"
            referrerPolicy="no-referrer"
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-semibold transition-colors hover:border-primary/50"
          >
            続きを読む
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Studio限定の制作メモ。ここが Premium の価値。 */}
      {pick.note && (
        <div className="border-t border-border bg-muted/50 px-4 py-3.5">
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-premium">
            <PenLine className="h-3.5 w-3.5" />
            カラスイの制作メモ
            <span className="rounded bg-premium/15 px-1.5 py-px text-[10px]">Premium</span>
          </p>

          {paid ? (
            <p className="mt-1.5 whitespace-pre-line text-[12.5px] leading-relaxed">{pick.note}</p>
          ) : (
            <div className="relative mt-1.5 overflow-hidden rounded-lg">
              <p className="select-none text-[12.5px] leading-relaxed blur-[4px]">
                {pick.note.slice(0, 120)}
              </p>
              <div className="absolute inset-0 grid place-items-center">
                <Link
                  to="/plans"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-premium px-3 py-1.5 text-[12.5px] font-semibold text-white"
                >
                  <Lock className="h-3.5 w-3.5" />
                  Premiumで読む
                </Link>
              </div>
            </div>
          )}

          {paid && pick.prompts.length > 0 && (
            <Link
              to="/prompts"
              className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary"
            >
              関連するプロンプトを見る（{pick.prompts.length}件）→
            </Link>
          )}
        </div>
      )}
    </article>
  )
}
