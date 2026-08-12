/**
 * 限定コンテンツAPIのクライアント。
 *
 * ■ 役割分担
 *   このファイル : トークンを預かって送るだけ。判定は一切しない
 *   Worker       : セッションを検証し、権限がある要求にだけ本文を返す
 *
 * ここに「role が premium なら本文を出す」といった分岐を書いてはいけない。
 * 書いた瞬間、本文がフロントに存在することになり、元の問題に戻る。
 */
import { useEffect, useMemo } from 'react'
import { create } from 'zustand'

import { useRoleStore, type Role } from './role'

const TOKEN_KEY = 'studio-next:session'

/**
 * APIの場所。未設定なら限定機能は「未接続」として静かにロック表示のままにする
 * （設定漏れで本文が漏れる、ということが起きない向きに倒してある）。
 */
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ?? ''

export const apiConfigured = API_BASE !== ''

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* 保存できなくてもその場のセッションは動く */
  }
}

async function call(path: string, init?: RequestInit): Promise<Response> {
  const token = readToken()
  const headers = new Headers(init?.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init?.body) headers.set('Content-Type', 'application/json')
  return fetch(`${API_BASE}${path}`, { ...init, headers, cache: 'no-store' })
}

/** 限定コンテンツ。持っていない間は空。ロック表示はこの「空」を根拠にする */
export interface PremiumContent {
  prompts: Record<string, { text: string }>
  picks: Record<string, { premium: string }>
  pickNotes: Record<string, { note?: string; prompts?: string[] }>
}

const EMPTY: PremiumContent = { prompts: {}, picks: {}, pickNotes: {} }

interface PremiumState {
  content: PremiumContent
  status: 'idle' | 'loading' | 'ready' | 'locked' | 'error'
  /** 現在のセッションの失効予定（UNIX秒）。無料時や未取得時は null */
  sessionExpiresAt: number | null
  signIn: (cred: Record<string, unknown>) => Promise<{ ok: boolean; message?: string }>
  signOut: () => void
  refresh: () => Promise<void>
}

export const usePremiumStore = create<PremiumState>((set) => ({
  content: EMPTY,
  status: 'idle',
  sessionExpiresAt: null,

  signIn: async (cred) => {
    if (!apiConfigured) return { ok: false, message: 'APIが未設定です' }
    try {
      const res = await call('/api/session', { method: 'POST', body: JSON.stringify(cred) })
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { message?: string }
        return { ok: false, message: b.message ?? '確認できませんでした' }
      }
      const b = (await res.json()) as { token: string; role: Role }
      writeToken(b.token)
      // 加入経路はYouTubeメンバーシップのみ（Studio直販は無い・2026-08-12決定）。
      // Workerが返す source（license/dev等・監査用の内部値）はUI表示には使わない。
      useRoleStore.getState().setRoleFromSession(b.role, b.role === 'free' ? 'none' : 'youtube')
      await usePremiumStore.getState().refresh()
      return { ok: true }
    } catch {
      return { ok: false, message: 'APIに接続できませんでした' }
    }
  },

  signOut: () => {
    writeToken(null)
    useRoleStore.getState().setRoleFromSession('free', 'none')
    set({ content: EMPTY, status: 'idle', sessionExpiresAt: null })
  },

  refresh: async () => {
    if (!apiConfigured) {
      set({ content: EMPTY, status: 'idle', sessionExpiresAt: null })
      return
    }
    set({ status: 'loading' })
    try {
      // まず権限を聞く。ここでの応答がフロントの role の「正」になる
      const me = await call('/api/me')
      const meBody = (await me.json().catch(() => ({}))) as { role?: Role; exp?: number | null }
      const role: Role = meBody.role ?? 'free'
      useRoleStore.getState().setRoleFromSession(role, role === 'free' ? 'none' : 'youtube')
      set({ sessionExpiresAt: role === 'free' ? null : (meBody.exp ?? null) })

      const res = await call('/api/content/premium')
      if (res.status === 401 || res.status === 403) {
        // 権限が無い＝本文は降ってこない。これが正常な姿
        set({ content: EMPTY, status: 'locked' })
        return
      }
      if (!res.ok) {
        set({ content: EMPTY, status: 'error' })
        return
      }
      set({ content: (await res.json()) as PremiumContent, status: 'ready' })
    } catch {
      set({ content: EMPTY, status: 'error' })
    }
  },
}))

/** アプリ起動時に一度だけ、権限と限定コンテンツを取りに行く */
export function usePremiumBootstrap() {
  const refresh = usePremiumStore((s) => s.refresh)
  useEffect(() => {
    void refresh()
  }, [refresh])
}

/** プロンプト本文。無ければ null（＝ロック表示。DOMに本文は入らない） */
export function usePremiumPromptText(id: string): string | null {
  return usePremiumStore((s) => s.content.prompts[id]?.text ?? null)
}

/**
 * 制作メモ。無ければ null。
 *
 * セレクタの中で新しいオブジェクトを作ってはいけない。
 * 毎回別物と判定されて再描画が止まらなくなる（無限ループ）。
 * ストア上の参照をそのまま選び、組み立ては useMemo の側で行う。
 */
export function usePremiumNote(id: string): { note: string; prompts: string[] } | null {
  const raw = usePremiumStore((s) => s.content.pickNotes[id])
  return useMemo(
    () => (raw?.note ? { note: raw.note, prompts: raw.prompts ?? [] } : null),
    [raw],
  )
}
