import { useCallback, useEffect, useState } from 'react'

const KEY = 'studio.theme'

/**
 * 表示テーマ。
 *   light / dark … 通常の配色
 *   amber        … 「炭×琥珀×藍鼠」の落ち着いた配色。
 *                   シーダンス2.5プロンプト工房の編集室UIと同じ考え方の独自パレット。
 *
 * ■ 名前について
 * 当初「Suno風」と呼んでいたが、他社サービスの名前をテーマ名に使うのは
 * 誤解（公式提携・模倣と受け取られる等）のもとなので避け、配色そのものを
 * 表す「琥珀（amber）」に改めた（2026-08-12）。
 */
export type Theme = 'light' | 'dark' | 'amber'

export const THEME_LABEL: Record<Theme, string> = {
  light: 'ライト',
  dark: 'ダーク',
  amber: '琥珀',
}

const THEME_COLOR: Record<Theme, string> = {
  light: '#ffffff',
  dark: '#0f1117',
  amber: '#14161c',
}

function readStored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' || v === 'amber' ? v : null
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
    // amber も背景が暗いテーマなので、既存の dark: ユーティリティ（V1由来の
    // 微調整など）はそのまま効かせる。配色そのものは theme-amber 側で上書きする。
    root.classList.toggle('dark', theme === 'dark' || theme === 'amber')
    root.classList.toggle('theme-amber', theme === 'amber')
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
