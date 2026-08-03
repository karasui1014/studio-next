import { NavLink } from 'react-router-dom'
import { Music4 } from 'lucide-react'

import { cn } from '@/core/ui/cn'
import { NAV_GROUPS } from './navigation'

/** PC用の左サイドバー。スマホでは下部タブに置き換わるため非表示。 */
export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-border bg-card lg:flex">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-gradient-to-br from-primary to-suno text-white">
          <Music4 className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold">AI音楽部 Studio</p>
          <p className="text-[11px] text-muted-foreground">AI音楽クリエイターのホーム</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 pb-4">
        {NAV_GROUPS.map((group, i) => (
          <div key={group.label ?? i} className="py-1">
            {group.label && (
              <p className="px-2.5 pb-1 pt-2.5 text-[10.5px] font-bold tracking-[0.08em] text-muted-foreground/75">
                {group.label}
              </p>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-[13.5px] font-medium transition-colors',
                    isActive
                      ? 'bg-accent font-semibold text-foreground'
                      : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground',
                  )
                }
              >
                <item.icon className="h-[17px] w-[17px] shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <p className="text-[10.5px] leading-snug text-muted-foreground/80">
          制作データは端末内のみに保存されます。
        </p>
      </div>
    </aside>
  )
}
