import { ArrowRight } from 'lucide-react'

import type { SubstackPick } from '@/core/content/types'

function dateText(iso: string | null): string {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const d = new Date(t)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

/**
 * ホームに出す「今日の1本」。
 *
 * ホームでは迷わせたくないので、一覧は置かず1本だけを大きく見せる。
 * 一覧は「もっと見る」から Picks ページへ。
 *
 * ■ 本文は載せない
 * 冒頭300文字までにして、続きは Substack で読んでもらう。
 * Studio に全文を写すと Substack の読者が育たず、
 * YouTube・Substack・Studio が一緒に育たなくなるため。
 *
 * ■ 制作メモ（Premium限定）は廃止した（2026-08-08）
 * Premium の価値は「制作ツールが使えること」に一本化した。
 */
export function TodayPick({ pick }: { pick: SubstackPick }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.07] to-card">
      <div className="flex flex-col gap-4 p-5 sm:flex-row">
        {pick.image && (
          <img
            src={pick.image}
            alt=""
            loading="lazy"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
            className="h-40 w-full shrink-0 rounded-xl border border-border object-cover sm:h-[150px] sm:w-[150px]"
          />
        )}

        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-bold text-muted-foreground">
            今日の注目テーマ
            {pick.published && <span className="ml-2 font-normal">{dateText(pick.published)}</span>}
          </p>

          <h3 className="mt-1.5 text-[19px] font-extrabold leading-snug tracking-tight [overflow-wrap:anywhere]">
            {pick.title}
          </h3>

          {pick.excerpt && (
            <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
              {pick.excerpt}
            </p>
          )}

          <a
            href={pick.url}
            target="_blank"
            rel="noopener noreferrer external"
            referrerPolicy="no-referrer"
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13.5px] font-bold text-primary-foreground"
          >
            続きを読む
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>

    </article>
  )
}
