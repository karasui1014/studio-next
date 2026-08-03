import { Link } from 'react-router-dom'
import { Clock, ExternalLink, Music4, Sparkles, Star, Wrench } from 'lucide-react'

import { useActivity, type Activity, type ActivityKind } from '@/core/storage/activity'
import { nextStepFor, useSongs } from '@/core/storage/songs'
import { cn } from '@/core/ui/cn'

const ICON: Record<ActivityKind, typeof Music4> = {
  song: Music4,
  prompt: Sparkles,
  tool: Wrench,
  external: ExternalLink,
}

const KIND_LABEL: Record<ActivityKind, string> = {
  song: '曲',
  prompt: 'プロンプト',
  tool: 'ツール',
  external: '外部ツール',
}

function timeAgo(at: number): string {
  const min = Math.floor((Date.now() - at) / 60000)
  if (min < 1) return 'たった今'
  if (min < 60) return `${min}分前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour}時間前`
  return `${Math.floor(hour / 24)}日前`
}

function Item({ item, showTime }: { item: Activity; showTime: boolean }) {
  const Icon = ICON[item.kind] ?? Wrench

  const inner = (
    <>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold">{item.label}</span>
        <span className="block text-[10.5px] text-muted-foreground">
          {KIND_LABEL[item.kind]}
          {showTime ? ` · ${timeAgo(item.at)}` : ''}
        </span>
      </span>
    </>
  )

  const className = cn(
    'flex w-[220px] shrink-0 items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5',
    'transition-colors hover:border-primary/40',
  )

  if (item.to) {
    return <Link to={item.to} className={className}>{inner}</Link>
  }
  if (item.url) {
    return (
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer external"
        referrerPolicy="no-referrer"
        className={className}
      >
        {inner}
      </a>
    )
  }
  return <span className={className}>{inner}</span>
}

function Row({
  title, icon: Icon, items, showTime,
}: { title: string; icon: typeof Clock; items: Activity[]; showTime: boolean }) {
  if (items.length === 0) return null

  return (
    <div className="mt-3.5 first:mt-0">
      <p className="mb-2 flex items-center gap-1.5 text-[11.5px] font-bold text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </p>
      {/* 横に流して、縦の場所を取らないようにする */}
      <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((a) => (
          <Item key={`${a.kind}:${a.id}`} item={a} showTime={showTime} />
        ))}
      </div>
    </div>
  )
}

/**
 * 続きから。
 *
 * 前回さわったものとお気に入りを、制作の入口のすぐ下に置く。
 * 履歴がまだ無い人には何も出さない（初回は入口だけを見せたいため）。
 */
export function ResumeSection() {
  const { recent, favorites } = useActivity()
  const { songs } = useSongs()
  const latest = songs[0]

  if (!latest && recent.length === 0 && favorites.length === 0) return null

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card/60 px-4 py-4">
      <h2 className="text-[15px] font-bold">続きから</h2>

      {latest && (
        <Link
          to={`/songs/${latest.id}`}
          className="mt-3 flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/[0.06] px-3.5 py-3 transition-colors hover:border-primary/50"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15">
            <Music4 className="h-[18px] w-[18px] text-primary" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold text-primary">制作中の曲</span>
            <span className="block truncate text-[14px] font-bold">{latest.title}</span>
            <span className="block text-[11.5px] text-muted-foreground">{nextStepFor(latest)}</span>
          </span>
          <span className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-[12.5px] font-semibold text-primary-foreground">
            続きを作る
          </span>
        </Link>
      )}
      <Row title="最近ひらいたもの" icon={Clock} items={recent.slice(0, 8)} showTime />
      <Row title="お気に入り" icon={Star} items={favorites.slice(0, 8)} showTime={false} />
    </section>
  )
}
