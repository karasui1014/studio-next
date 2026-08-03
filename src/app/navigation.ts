import {
  Home, Newspaper, Target, Boxes, Music, Sparkles, Clapperboard,
  Wrench, Bot, Database, Gem, type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

export interface NavGroup {
  label?: string
  items: NavItem[]
}

/**
 * 情報設計：機能名ではなく「目的」で分ける。
 * Version 1 の「ツール置き場」型から意図的に変えている。
 */
export const NAV_GROUPS: NavGroup[] = [
  { items: [{ to: '/', label: 'ホーム', icon: Home, end: true }] },
  {
    label: '知る',
    items: [
      { to: '/news', label: 'AI音楽ニュース', icon: Newspaper },
      { to: '/picks', label: 'カラスイ Picks', icon: Target },
      { to: '/tools-guide', label: 'AIツール図鑑', icon: Boxes },
    ],
  },
  {
    label: 'つくる',
    items: [
      { to: '/songs', label: '曲一覧', icon: Music },
      { to: '/prompts', label: 'プロンプト工房', icon: Sparkles },
      { to: '/storyboard', label: 'ストーリーボード', icon: Clapperboard },
      { to: '/tools', label: '制作ツール', icon: Wrench },
    ],
  },
  {
    label: 'マイスタジオ',
    items: [
      { to: '/secretary', label: 'AI秘書', icon: Bot },
      { to: '/data', label: 'データ管理', icon: Database },
      { to: '/plans', label: 'プラン', icon: Gem },
    ],
  },
]

/** スマホ下部タブ。片手で届く5つに絞る。 */
export const TAB_ITEMS: NavItem[] = [
  { to: '/', label: 'ホーム', icon: Home, end: true },
  { to: '/news', label: 'ニュース', icon: Newspaper },
  { to: '/prompts', label: 'つくる', icon: Sparkles },
  { to: '/tools-guide', label: '学ぶ', icon: Boxes },
  { to: '/plans', label: 'マイ', icon: Gem },
]
