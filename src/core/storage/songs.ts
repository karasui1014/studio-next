import { useCallback, useEffect, useState } from 'react'

/**
 * 曲データ。
 *
 * ■ 第一原則: ユーザーの作品はユーザーのもの
 * 端末内（localStorage）にのみ保存し、外部へは絶対に送らない。
 * いつでも JSON で持ち出せる（データ管理画面）。
 */

export type SongStatus = 'idea' | 'lyrics' | 'suno' | 'mv' | 'published'

export const SONG_STATUS: { id: SongStatus; label: string }[] = [
  { id: 'idea', label: '構想' },
  { id: 'lyrics', label: '歌詞' },
  { id: 'suno', label: '楽曲生成' },
  { id: 'mv', label: 'MV' },
  { id: 'published', label: '公開済み' },
]

export interface Song {
  id: string
  title: string
  status: SongStatus
  genre: string
  mood: string
  lyrics: string
  sunoPrompt: string
  mvPrompt: string
  memo: string
  createdAt: string
  updatedAt: string
}

const KEY = 'studio-next:songs:v1'
const CHANGED = 'studio:songs-changed'

export function createSong(title: string): Song {
  const now = new Date().toISOString()
  return {
    id: `song-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: title.trim() || '無題の曲',
    status: 'idea',
    genre: '', mood: '', lyrics: '', sunoPrompt: '', mvPrompt: '', memo: '',
    createdAt: now,
    updatedAt: now,
  }
}

function isSong(v: unknown): v is Song {
  const s = v as Song
  return Boolean(s) && typeof s.id === 'string' && typeof s.title === 'string'
}

export function readSongs(): Song[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(raw) ? raw.filter(isSong) : []
  } catch {
    return []
  }
}

export function writeSongs(songs: Song[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(songs))
  } catch {
    /* 保存できなくても画面は動かす */
  }
  window.dispatchEvent(new Event(CHANGED))
}

export function saveSong(song: Song): Song {
  const next = readSongs()
  const updated = { ...song, updatedAt: new Date().toISOString() }
  const i = next.findIndex((s) => s.id === song.id)
  if (i >= 0) next[i] = updated
  else next.unshift(updated)
  writeSongs(next)
  return updated
}

export function deleteSong(id: string) {
  writeSongs(readSongs().filter((s) => s.id !== id))
}

/** 更新が新しい順 */
export function byRecent(songs: Song[]): Song[] {
  return [...songs].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}

/** 曲一覧を購読する */
export function useSongs() {
  const [songs, setSongs] = useState<Song[]>([])
  const refresh = useCallback(() => setSongs(byRecent(readSongs())), [])

  useEffect(() => {
    refresh()
    window.addEventListener(CHANGED, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(CHANGED, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [refresh])

  return { songs, refresh }
}

/** 次にやることをひとことで。ホームの「続きから」で使う。 */
export function nextStepFor(song: Song): string {
  if (!song.lyrics) return '歌詞がまだありません'
  if (!song.sunoPrompt) return 'プロンプトがまだ未作成です'
  if (!song.mvPrompt) return 'MVの計画がまだです'
  if (song.status !== 'published') return '仕上げて公開しましょう'
  return '公開済みです'
}
