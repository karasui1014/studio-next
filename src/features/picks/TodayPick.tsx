import { Link } from 'react-router-dom'
import { ArrowRight, Lock, PenLine } from 'lucide-react'

import type { SubstackPick } from '@/core/content/types'
import { useRole } from '@/core/entitlement/role'

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
 */
export function TodayPick({ pick }: { pick: SubstackPick }) {
  const { paid } = useRole()

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

      {/* Studio限定の制作メモ。ここが Premium の価値。 */}
      {pick.note && (
        <div className="border-t border-border bg-card/70 px-5 py-4">
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
