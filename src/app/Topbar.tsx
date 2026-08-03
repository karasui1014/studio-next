import { Link } from 'react-router-dom'
import { Moon, Search, Sparkles, Sun } from 'lucide-react'

import { cn } from '@/core/ui/cn'
import { useTheme } from '@/core/ui/useTheme'
import { useRole } from '@/core/entitlement/role'

export function Topbar() {
  const { theme, toggle } = useTheme()
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

        <button
          type="button"
          onClick={toggle}
          aria-label="表示テーマを切り替える"
          className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-accent"
        >
          {theme === 'dark' ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
        </button>
      </div>
    </header>
  )
}
