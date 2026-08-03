import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'

import { Sidebar } from './Sidebar'
import { TabBar } from './TabBar'
import { Topbar } from './Topbar'
import { DevRoleSwitcher } from './DevRoleSwitcher'

export function AppShell() {
  const { pathname } = useLocation()

  // 画面を移動したら先頭に戻す
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <DevRoleSwitcher />
        <main className="mx-auto w-full max-w-[1420px] flex-1 px-4 pb-24 pt-4 lg:px-7 lg:pb-16">
          <Outlet />
        </main>
      </div>
      <TabBar />
    </div>
  )
}
