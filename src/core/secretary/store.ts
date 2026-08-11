import { create } from 'zustand'

import { idbFiles } from './avatar'
import {
  AVATAR_IDB_KEY,
  DEFAULT_SECRETARY_SETTINGS,
  SECRETARY_KEYS,
  type SecretarySettings,
} from './types'

/**
 * AI秘書の状態。V1の `useSecretaryStore` から移植。
 *
 * ■ 保存先は端末内だけ
 * 設定は localStorage、画像は IndexedDB。どちらも外部へは送らない。
 *
 * ■ 読み込みは一度だけ
 * 画像の読み出しは非同期なので、複数の画面が同時に開いても
 * 一度しか走らないよう Promise を使い回す。
 */

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
    /* 保存できなくても画面は動かす */
  }
}

interface SecretaryState {
  settings: SecretarySettings
  /** 画像のObjectURL。未設定なら null（既定のアイコンを出す） */
  avatarUrl: string | null
  celebratedMilestones: number[]
  hydrated: boolean

  hydrate: () => Promise<void>
  updateSettings: (patch: Partial<SecretarySettings>) => void
  setAvatar: (file: File) => Promise<void>
  removeAvatar: () => Promise<void>
  markMilestoneCelebrated: (milestone: number) => void
}

let hydratePromise: Promise<void> | null = null

export const useSecretaryStore = create<SecretaryState>((set, get) => ({
  settings: DEFAULT_SECRETARY_SETTINGS,
  avatarUrl: null,
  celebratedMilestones: [],
  hydrated: false,

  hydrate: () => {
    if (hydratePromise) return hydratePromise
    hydratePromise = (async () => {
      const settings = {
        ...DEFAULT_SECRETARY_SETTINGS,
        ...readJson<Partial<SecretarySettings>>(SECRETARY_KEYS.settings, {}),
      }
      const celebratedMilestones = readJson<number[]>(SECRETARY_KEYS.milestones, [])

      let avatarUrl: string | null = null
      try {
        const blob = await idbFiles.get(AVATAR_IDB_KEY)
        if (blob) avatarUrl = URL.createObjectURL(blob)
      } catch {
        // IndexedDBが使えない環境。既定のアイコンで続行する
      }

      set({ settings, celebratedMilestones, avatarUrl, hydrated: true })
    })()
    return hydratePromise
  },

  updateSettings: (patch) => {
    const settings = { ...get().settings, ...patch }
    set({ settings })
    writeJson(SECRETARY_KEYS.settings, settings)
  },

  setAvatar: async (file) => {
    await idbFiles.set(AVATAR_IDB_KEY, file)
    const prev = get().avatarUrl
    if (prev) URL.revokeObjectURL(prev)
    set({ avatarUrl: URL.createObjectURL(file) })
  },

  removeAvatar: async () => {
    await idbFiles.remove(AVATAR_IDB_KEY)
    const prev = get().avatarUrl
    if (prev) URL.revokeObjectURL(prev)
    set({ avatarUrl: null })
  },

  markMilestoneCelebrated: (milestone) => {
    const current = get().celebratedMilestones
    if (current.includes(milestone)) return
    const next = [...current, milestone]
    set({ celebratedMilestones: next })
    writeJson(SECRETARY_KEYS.milestones, next)
  },
}))
