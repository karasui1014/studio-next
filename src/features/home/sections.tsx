import { Link } from 'react-router-dom'
import { Copy, Star, X } from 'lucide-react'
import { useCallback, useState } from 'react'

import type { PromptPick, SubstackConfig, ToolPick, VideoPick } from '@/core/content/types'
import { recordActivity, useFavorite } from '@/core/storage/activity'
import { cn } from '@/core/ui/cn'

/** セクションの見出し。右端に「もっと見る」を置ける。 */
export function SectionHead({
  title, note, moreTo, moreLabel,
}: { title: string; note?: string; moreTo?: string; moreLabel?: string }) {
  return (
    <div className="mb-2.5 flex items-baseline gap-2.5">
      <h2 className="text-[15px] font-bold">{title}</h2>
      {note && <span className="text-[11.5px] text-muted-foreground">{note}</span>}
      {moreTo && (
        <Link to={moreTo} className="ml-auto shrink-0 text-xs font-semibold text-primary">
          {moreLabel ?? 'すべて見る'} →
        </Link>
      )}
    </div>
  )
}

/* ---------------- 今日試すべきAIツール ---------------- */

export function ToolCard({ tool }: { tool: ToolPick }) {
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-[11px] border border-border bg-card px-3.5 py-3.5">
      <div className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] bg-muted text-base">
        {tool.emoji}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold">{tool.name}</p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">{tool.description}</p>
      </div>
      <a
        href={tool.url}
        target="_blank"
        rel="noopener noreferrer external"
        referrerPolicy="no-referrer"
        onClick={() =>
          recordActivity({ id: tool.id, kind: 'external', label: tool.name, to: null, url: tool.url })
        }
        className="ml-auto shrink-0 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-semibold"
      >
        開く
      </a>
    </div>
  )
}

/* ---------------- おすすめプロンプト ---------------- */

export function PromptCard({ prompt }: { prompt: PromptPick }) {
  const [copied, setCopied] = useState(false)

  /**
   * 「Premium限定プロンプト」の仕組みは廃止した（2026-08-08）。
   * プロンプト工房そのものが Premium 以上の機能になったため、
   * プロンプト1件ずつをロックする必要がなくなった。
   *
   * 本文を持たないプロンプト（旧・限定扱いで公開JSONが空のもの）は、
   * 中身のないカードを出しても意味がないので描画しない。
   */
  const text = prompt.text

  const build = useCallback(
    () => ({ id: prompt.id, kind: 'prompt' as const, label: prompt.title, to: '/prompts', url: null }),
    [prompt.id, prompt.title],
  )
  const fav = useFavorite('prompt', prompt.id, build)

  const copy = () => {
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
        // 使ったプロンプトは「続きから」に出す
        recordActivity(build())
      },
      () => { /* コピーできなくても画面は壊さない */ },
    )
  }

  // 本文の無いプロンプトは表示しない（旧・限定扱いの残骸）
  if (!text) return null

  return (
    <div className="flex flex-col gap-2 rounded-[11px] border border-border bg-card px-3.5 py-3">
      <div className="flex items-center gap-1.5">
        <p className="min-w-0 flex-1 truncate text-[12.5px] font-bold">{prompt.title}</p>
        <button
          type="button"
          onClick={fav.toggle}
          aria-pressed={fav.on}
          aria-label={fav.on ? 'お気に入りから外す' : 'お気に入りに入れる'}
          className="-mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent"
        >
          <Star className={cn('h-4 w-4', fav.on && 'fill-premium text-premium')} />
        </button>
      </div>

      <p className="line-clamp-3 break-all rounded-lg bg-muted px-2.5 py-2.5 font-mono text-[11.5px] leading-relaxed text-muted-foreground">
        {text}
      </p>
      <button
        type="button"
        onClick={copy}
        className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-semibold"
      >
        <Copy className="h-3.5 w-3.5" />
        {copied ? 'コピーしました' : 'コピー'}
      </button>
    </div>
  )
}

/* ---------------- Substack ---------------- */

const SUBSTACK_DISMISSED = 'studio.substackDismissed'
const HIDE_DAYS = 30

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(SUBSTACK_DISMISSED))
    return Boolean(at) && Date.now() - at < HIDE_DAYS * 86400000
  } catch {
    return false
  }
}

/**
 * Substackへの導線。
 * ・ニュースとPicksを読み終わった位置に1枚だけ置く（モーダルは使わない）
 * ・閉じたら30日出さない
 * ・**プランに関わらず全員に出す**（2026-08-08 変更）
 *   以前は有料会員に出していなかったが、Substackは3つの場所を一緒に育てる導線であり、
 *   有料の人にも読んでほしいため、権限による出し分けをやめた。
 * 開発憲章の「制作の邪魔をしない」を守るための設計。
 */
export function SubstackCard({ config }: { config: SubstackConfig }) {
  const [hidden, setHidden] = useState(dismissedRecently)

  if (hidden) return null

  const dismiss = () => {
    try { localStorage.setItem(SUBSTACK_DISMISSED, String(Date.now())) } catch { /* noop */ }
    setHidden(true)
  }

  return (
    <div className="relative flex flex-wrap items-center gap-3.5 rounded-lg border border-substack/30 bg-substack/[0.06] px-4 py-4">
      <button
        type="button"
        onClick={dismiss}
        aria-label="この案内を閉じる"
        className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-substack text-lg font-extrabold text-white">
        S
      </div>
      <div className="min-w-[220px] flex-1 pr-6">
        <p className="text-sm font-bold">{config.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{config.description}</p>
        {config.note && (
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/80">{config.note}</p>
        )}
      </div>
      <a
        href={config.url}
        target="_blank"
        rel="noopener noreferrer external"
        referrerPolicy="no-referrer"
        className="w-full shrink-0 rounded-lg bg-substack px-4 py-2 text-center text-[13.5px] font-semibold text-white sm:w-auto"
      >
        {config.buttonLabel}
      </a>
    </div>
  )
}

/* ---------------- YouTube ---------------- */

export function VideoCard({ video }: { video: VideoPick }) {
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer external"
      referrerPolicy="no-referrer"
      className="block overflow-hidden rounded-[11px] border border-border bg-card"
    >
      <div className={cn(
        'grid aspect-video place-items-center text-2xl text-youtube',
        'bg-gradient-to-br from-youtube/20 to-primary/15',
      )}>
        ▶
      </div>
      <div className="px-3 py-2.5">
        <p className="line-clamp-2 text-[12.5px] font-semibold leading-snug">{video.title}</p>
        {video.meta && <p className="mt-1 text-[10.5px] text-muted-foreground">{video.meta}</p>}
      </div>
    </a>
  )
}
