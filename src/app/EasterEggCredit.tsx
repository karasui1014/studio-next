import { useEffect, useState } from 'react'

const RAPID_WINDOW_MS = 1500
const CLICKS_REQUIRED = 5
const DISPLAY_MS = 6000

/**
 * 隠しクレジット。ページ見出し(h1)を1.5秒以内に5回クリックすると、
 * 右下に小さなバッジが6秒間だけ表示される。
 */
export function EasterEggCredit() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let count = 0
    let lastClick = 0

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target?.closest?.('h1')) return

      const now = Date.now()
      count = now - lastClick < RAPID_WINDOW_MS ? count + 1 : 1
      lastClick = now

      if (count >= CLICKS_REQUIRED) {
        count = 0
        setMessage(`© karasui1014 ／ AI音楽部 Studio 提供ツール ／ ${new Date().toLocaleString('ja-JP')}`)
      }
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), DISPLAY_MS)
    return () => clearTimeout(timer)
  }, [message])

  if (!message) return null

  return (
    <div className="fixed bottom-20 right-4 z-[99999] max-w-[260px] rounded-[10px] bg-[#161616] px-4 py-3 text-[12px] leading-[1.6] text-white shadow-[0_8px_24px_rgba(0,0,0,0.4)] lg:bottom-4">
      {message}
    </div>
  )
}
