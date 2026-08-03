import { Link } from 'react-router-dom'
import { ArrowRight, Lightbulb } from 'lucide-react'

import type { DailyTip as Tip } from '@/core/content/types'

/** その日の通し番号。日付が変われば必ず変わる。 */
function dayNumber(d: Date): number {
  return Math.floor(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000,
  )
}

function todayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * その日に出す一言を選ぶ。
 *
 * 日付を指定したものがあればそれを優先し、無ければ「たね」を日替わりで巡回する。
 * こうしておくと毎日書かなくても毎日変わるので、運営が止まらない。
 */
export function pickDailyTip(tips: Tip[], now = new Date()): Tip | null {
  if (tips.length === 0) return null

  const fixed = tips.find((t) => t.date === todayKey(now))
  if (fixed) return fixed

  const pool = tips.filter((t) => !t.date)
  if (pool.length === 0) return null

  return pool[dayNumber(now) % pool.length]
}

/** Studioからの今日の一言。ここが「今日ひらく理由」になる。 */
export function DailyTipCard({ tip }: { tip: Tip }) {
  const action = tip.actionLabel && (tip.to || tip.url)

  return (
    <section className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-premium/25 bg-gradient-to-r from-premium/[0.10] to-transparent px-4 py-3.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-premium/15">
        <Lightbulb className="h-[18px] w-[18px] text-premium" />
      </span>

      {/* 幅が足りないときはボタンを次の行へ送る。本文を細長い柱にしない。 */}
      <div className="min-w-[220px] flex-1">
        <p className="text-[11px] font-bold tracking-wide text-premium">{tip.label}</p>
        <p className="mt-0.5 text-[13.5px] font-semibold leading-relaxed [overflow-wrap:anywhere]">
          {tip.message}
        </p>
      </div>

      {action && (
        tip.to ? (
          <Link
            to={tip.to}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-premium/35 px-3 py-1.5 text-[12.5px] font-semibold text-premium"
          >
            {tip.actionLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <a
            href={tip.url ?? undefined}
            target="_blank"
            rel="noopener noreferrer external"
            referrerPolicy="no-referrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-premium/35 px-3 py-1.5 text-[12.5px] font-semibold text-premium"
          >
            {tip.actionLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        )
      )}
    </section>
  )
}
