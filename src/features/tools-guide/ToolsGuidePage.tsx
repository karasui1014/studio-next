import { useMemo, useRef, useState } from 'react'
import { ExternalLink, Play } from 'lucide-react'

import { useHome } from '@/core/content/load'
import type { ToolPick } from '@/core/content/types'
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
          <ToolCard key={t.id} tool={t} />
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

/**
 * 1枚のツールカード。
 * video（公式サイトの動画ファイルの直接URL）があるカードは、下部にプレビューを表示し、
 * ホバーすると再生される。常に同じ<video>要素を使い回すので、ホバーのたびに読み込み直さない。
 * 動画エリアはリンク（<a>）の外に置く。
 */
function ToolCard({ tool: t }: { tool: ToolPick }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)

  const handleEnter = () => {
    const v = videoRef.current
    if (!v) return
    v.play().catch(() => {})
    setPlaying(true)
  }
  const handleLeave = () => {
    const v = videoRef.current
    if (!v) return
    v.pause()
    v.currentTime = 0
    setPlaying(false)
  }

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card transition-colors hover:border-primary/40">
      <a
        href={t.url}
        target="_blank"
        rel="noopener noreferrer external"
        referrerPolicy="no-referrer"
        onClick={() =>
          recordActivity({ id: t.id, kind: 'external', label: t.name, to: null, url: t.url })
        }
        className="flex items-start gap-3 p-4"
      >
        <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted text-xl">
          <span>{t.emoji}</span>
          {t.logo && (
            <img
              src={t.logo}
              alt=""
              className="absolute inset-0 h-full w-full bg-white object-contain p-2"
              onError={(e) => e.currentTarget.remove()}
            />
          )}
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

      {t.video && (
        <div
          className="relative mx-4 mb-4 aspect-video overflow-hidden rounded-lg bg-black"
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
        >
          <video
            ref={videoRef}
            src={t.video}
            muted
            loop
            playsInline
            preload="metadata"
            aria-label={`${t.name} の紹介動画`}
            className="h-full w-full object-cover"
          />
          {!playing && (
            <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/20">
              <Play className="h-8 w-8 fill-white text-white drop-shadow" />
            </span>
          )}
        </div>
      )}
    </div>
  )
}
