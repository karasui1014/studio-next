import { NavLink } from 'react-router-dom'

import { cn } from '@/core/ui/cn'
import { TAB_ITEMS } from './navigation'

/**
 * スマホ用の下部タブ。
 * 毎日開くサービスは片手で操作できる必要があるため、上部メニューではなく下部に置く。
 */
export function TabBar() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card/95 px-1 pt-1.5 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: 'calc(0.375rem + env(safe-area-inset-bottom))' }}
    >
      {TAB_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center gap-0.5 rounded-[9px] px-1 py-1.5 text-[10px] font-semibold',
              isActive ? 'text-primary' : 'text-muted-foreground',
            )
          }
        >
          <item.icon className="h-[19px] w-[19px]" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
