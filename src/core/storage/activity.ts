import { useCallback, useEffect, useState } from 'react'

/**
 * 「続きから」のための行動記録。
 *
 * 前回の続きへすぐ戻れることが、毎日開く体験の中心にある
 * （Cursor や Arc が「前回の続き」から始まるのと同じ考え方）。
 *
 * ■ 大前提
 * 記録するのは「何を開いたか」だけで、作品の中身は保存しない。
 * すべて端末内（localStorage）に置き、外部へは送らない。
 * 制作中の曲は Phase 4 で曲データと繋ぐ。
 */

export type ActivityKind = 'song' | 'prompt' | 'tool' | 'external'

export interface Activity {
  id: string
  kind: ActivityKind
  label: string
  /** Studio内の遷移先。外部ツールなら null */
  to: string | null
  /** 外部ツールのURL */
  url: string | null
  /** 最後に触った時刻 */
  at: number
}

const RECENT_KEY = 'studio.recent'
const FAV_KEY = 'studio.favorites'
const MAX_RECENT = 20
const CHANGED = 'studio:activity-changed'

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* 保存できなくても操作は続けられる */
  }
}

function notify() {
  window.dispatchEvent(new Event(CHANGED))
}

function valid(a: unknown): a is Activity {
  const r = a as Activity
  return Boolean(r) && typeof r.id === 'string' && typeof r.label === 'string'
}

function key(kind: ActivityKind, id: string) {
  return `${kind}:${id}`
}

// ---------------- 最近ひらいたもの ----------------

export function readRecent(): Activity[] {
  const list = readJson<unknown[]>(RECENT_KEY, [])
  return Array.isArray(list) ? list.filter(valid) : []
}

/** 何かを開いた・使ったことを記録する。同じものは最新の1件にまとめる。 */
export function recordActivity(entry: Omit<Activity, 'at'>) {
  const list = readRecent().filter((a) => key(a.kind, a.id) !== key(entry.kind, entry.id))
  list.unshift({ ...entry, at: Date.now() })
  writeJson(RECENT_KEY, list.slice(0, MAX_RECENT))
  notify()
}

// ---------------- お気に入り ----------------

export function readFavorites(): Activity[] {
  const list = readJson<unknown[]>(FAV_KEY, [])
  return Array.isArray(list) ? list.filter(valid) : []
}

export function isFavorite(kind: ActivityKind, id: string): boolean {
  return readFavorites().some((a) => key(a.kind, a.id) === key(kind, id))
}

/** お気に入りの登録・解除。登録後の状態を返す。 */
export function toggleFavorite(entry: Omit<Activity, 'at'>): boolean {
  const list = readFavorites()
  const k = key(entry.kind, entry.id)
  const exists = list.some((a) => key(a.kind, a.id) === k)

  writeJson(
    FAV_KEY,
    exists ? list.filter((a) => key(a.kind, a.id) !== k) : [{ ...entry, at: Date.now() }, ...list],
  )
  notify()
  return !exists
}

// ---------------- React から使う ----------------

/** 履歴とお気に入りを購読する。別のカードで変更されても追従する。 */
export function useActivity() {
  const [recent, setRecent] = useState<Activity[]>([])
  const [favorites, setFavorites] = useState<Activity[]>([])

  const refresh = useCallback(() => {
    setRecent(readRecent())
    setFavorites(readFavorites())
  }, [])

  useEffect(() => {
    refresh()
    window.addEventListener(CHANGED, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(CHANGED, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [refresh])

  return { recent, favorites }
}

/** 1件のお気に入り状態を扱う */
export function useFavorite(kind: ActivityKind, id: string, build: () => Omit<Activity, 'at'>) {
  const [on, setOn] = useState(false)

  const sync = useCallback(() => setOn(isFavorite(kind, id)), [kind, id])

  useEffect(() => {
    sync()
    window.addEventListener(CHANGED, sync)
    return () => window.removeEventListener(CHANGED, sync)
  }, [sync])

  const toggle = useCallback(() => {
    setOn(toggleFavorite(build()))
  }, [build])

  return { on, toggle }
}
