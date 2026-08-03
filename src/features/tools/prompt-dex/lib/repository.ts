import { STORAGE_KEYS } from './deps'
import { BUILTIN_PROMPTS } from './data'
import {
  normalizeEntry,
  PROMPT_DEX_SCHEMA_VERSION,
  type PromptEntry,
} from './types'

/**
 * データ取得層の抽象。
 * builtin(コード内)+ユーザーデータ(ブラウザ内保存)を扱う。
 * この境界を挟むことで、将来 builtin を外部DBやリモートJSONへ移す際も
 * 呼び出し側(ストア/UI)を変えずに差し替えられる(開発憲章: 取得層の分離)。
 */
export interface PromptDexRepository {
  getBuiltins(): PromptEntry[]
  getUserEntries(): PromptEntry[]
  saveUserEntries(entries: PromptEntry[]): void
  getFavorites(): string[]
  saveFavorites(ids: string[]): void
}

class LocalPromptDexRepository implements PromptDexRepository {
  getBuiltins(): PromptEntry[] {
    return BUILTIN_PROMPTS
  }

  getUserEntries(): PromptEntry[] {
    if (typeof window === 'undefined') return []
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.promptDexUser)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed
        .map((e) => normalizeEntry(e, 'user'))
        .filter((e): e is PromptEntry => e !== null)
    } catch {
      return []
    }
  }

  saveUserEntries(entries: PromptEntry[]): void {
    try {
      window.localStorage.setItem(STORAGE_KEYS.promptDexUser, JSON.stringify(entries))
    } catch {
      // 容量超過などは握りつぶす(画面表示は継続)
    }
  }

  getFavorites(): string[] {
    if (typeof window === 'undefined') return []
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.promptDexFavorites)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
    } catch {
      return []
    }
  }

  saveFavorites(ids: string[]): void {
    try {
      window.localStorage.setItem(STORAGE_KEYS.promptDexFavorites, JSON.stringify(ids))
    } catch {
      // 同上
    }
  }
}

export const promptDexRepository: PromptDexRepository = new LocalPromptDexRepository()

// ---------- JSON書き出し / 読み込み ----------

export interface PromptDexExport {
  app: 'ai-music-studio'
  kind: 'prompt-dex'
  schemaVersion: number
  exportedAt: string
  entries: PromptEntry[]
  favorites: string[]
}

export function buildExport(entries: PromptEntry[], favorites: string[]): PromptDexExport {
  return {
    app: 'ai-music-studio',
    kind: 'prompt-dex',
    schemaVersion: PROMPT_DEX_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    entries,
    favorites,
  }
}

/**
 * 読み込んだJSONから PromptEntry[] を安全に取り出す。
 * ラッパー({entries:[...]})でも、素の配列でも受け付ける。
 * source は 'imported' に統一する(取り込んだデータであることを明示)。
 */
export function parseImport(text: string): PromptEntry[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('JSONを読み取れませんでした')
  }
  let rawList: unknown
  if (Array.isArray(parsed)) {
    rawList = parsed
  } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).entries)) {
    rawList = (parsed as Record<string, unknown>).entries
  } else {
    throw new Error('プロンプト図鑑のデータではないようです')
  }
  const entries = (rawList as unknown[])
    .map((e) => normalizeEntry(e, 'imported'))
    .filter((e): e is PromptEntry => e !== null)
    .map((e) => ({ ...e, source: 'imported' as const }))
  if (entries.length === 0) {
    throw new Error('取り込めるプロンプトが見つかりませんでした')
  }
  return entries
}
