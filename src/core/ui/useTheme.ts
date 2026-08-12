import { useCallback, useEffect, useState } from 'react'

const KEY = 'studio.theme'

/**
 * 表示テーマ。
 *   light / dark … 通常の配色
 *   suno         … Sunoのアプリ画面を思わせる、紫〜マゼンタを基調にした配色
 *                   （公式の色見本ではなく「雰囲気を寄せた」独自パレット）
 */
export type Theme = 'light' | 'dark' | 'suno'

export const THEME_LABEL: Record<Theme, string> = {
  light: 'ライト',
  dark: 'ダーク',
  suno: 'Suno風',
}

const THEME_COLOR: Record<Theme, string> = {
  light: '#ffffff',
  dark: '#0f1117',
  suno: '#130a1a',
}

function readStored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' || v === 'suno' ? v : null
  } catch {
    return null
  }
}

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** 表示テーマ。端末の設定を初期値にし、選択したらローカルに覚える。 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => readStored() ?? systemTheme())

  useEffect(() => {
    const root = document.documentElement
    // suno も背景が暗いテーマなので、既存の dark: ユーティリティ（V1由来の
    // 微調整など）はそのまま効かせる。配色そのものは theme-suno 側で上書きする。
    root.classList.toggle('dark', theme === 'dark' || theme === 'suno')
    root.classList.toggle('theme-suno', theme === 'suno')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      /* 保存できなくても表示は続ける */
    }
  }, [theme])

  const setTheme = useCallback((t: Theme) => setThemeState(t), [])
  return { theme, setTheme }
}
