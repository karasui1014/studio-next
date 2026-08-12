import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Flame, Moon, Search, Sparkles, Sun } from 'lucide-react'

import { cn } from '@/core/ui/cn'
import { THEME_LABEL, useTheme, type Theme } from '@/core/ui/useTheme'
import { useRole } from '@/core/entitlement/role'

const THEME_ICON: Record<Theme, typeof Sun> = {
  light: Sun,
  dark: Moon,
  amber: Flame,
}

const THEME_ORDER: Theme[] = ['light', 'dark', 'amber']

function ThemePicker() {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const Icon = THEME_ICON[theme]

  // 外側クリックで閉じる。毎日開くUIなので、開けっ放しは邪魔になる
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="表示テーマを切り替える"
        aria-expanded={open}
        className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-accent"
      >
        <Icon className="h-[18px] w-[18px]" />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-40 w-40 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-lg">
          {THEME_ORDER.map((t) => {
            const OptIcon = THEME_ICON[t]
            return (
              <button
                key={t}
                type="button"
                onClick={() => { setTheme(t); setOpen(false) }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium hover:bg-accent',
                  theme === t && 'text-primary',
                )}
              >
                <OptIcon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{THEME_LABEL[t]}</span>
                {theme === t && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function Topbar() {
  const { role, label } = useRole()

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1420px] items-center gap-3 px-4 py-2.5 lg:px-7">
        <button
          type="button"
          className="hidden h-9 max-w-[420px] flex-1 items-center gap-2 rounded-lg border border-border bg-muted px-3 text-[13px] text-muted-foreground sm:flex"
        >
          <Search className="h-4 w-4" />
          ニュース・プロンプト・曲を検索
        </button>

        <div className="flex-1 sm:hidden" />

        {/*
          無料の人には「見に行きたくなる」入口として出す。
          派手にはせず、Studioの世界観に合う淡い金色にとどめる。
          有料の人には、いま何のプランかを静かに示すだけにする。
        */}
        <Link
          to="/plans"
          className={cn(
            'inline-flex h-[30px] items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors',
            role === 'free' &&
              'border-premium/30 bg-premium/10 text-premium hover:border-premium/60 hover:bg-premium/15',
            role === 'premium' && 'border-premium/35 bg-premium/15 text-premium',
            role === 'master' && 'border-master/35 bg-master/15 text-master',
          )}
        >
          {role === 'free' ? (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              Premiumを見る
            </>
          ) : (
            label
          )}
        </Link>

        <ThemePicker />
      </div>
    </header>
  )
}
