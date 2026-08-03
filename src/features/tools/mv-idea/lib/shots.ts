import type { MvShot } from './types'
import { shotSeconds } from './types'

/**
 * ショットリストの編集ヘルパー(純粋関数)。
 * すべて「新しい配列」を返し、元の配列は変更しない。
 *
 * 時間の方針: 並べ替え・複製・削除・秒数変更のあとは
 * 「各ショットの秒数を保ったまま、先頭から時間を詰め直す」(renumberAndRetime)。
 * タイムラインブロックは企画時の設計図として残し、自動では書き換えない。
 */

function newShotId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** 番号を1から振り直し、各ショットの秒数を保って開始/終了時間を先頭から詰め直す */
export function renumberAndRetime(shots: MvShot[], firstStartSec?: number): MvShot[] {
  let cursor = firstStartSec ?? shots[0]?.startSec ?? 0
  return shots.map((shot, i) => {
    const len = Math.max(0.5, shotSeconds(shot))
    const startSec = Math.round(cursor * 10) / 10
    const endSec = Math.round((cursor + len) * 10) / 10
    cursor = endSec
    return { ...shot, no: i + 1, startSec, endSec }
  })
}

/** ショットを上下に移動する */
export function moveShot(shots: MvShot[], id: string, direction: 'up' | 'down'): MvShot[] {
  const index = shots.findIndex((s) => s.id === id)
  if (index === -1) return shots
  const target = direction === 'up' ? index - 1 : index + 1
  if (target < 0 || target >= shots.length) return shots
  const next = [...shots]
  ;[next[index], next[target]] = [next[target], next[index]]
  return renumberAndRetime(next, shots[0]?.startSec ?? 0)
}

/** ショットを複製して直後に挿入する */
export function duplicateShot(shots: MvShot[], id: string): MvShot[] {
  const index = shots.findIndex((s) => s.id === id)
  if (index === -1) return shots
  const copy: MvShot = { ...shots[index], id: newShotId() }
  const next = [...shots.slice(0, index + 1), copy, ...shots.slice(index + 1)]
  return renumberAndRetime(next, shots[0]?.startSec ?? 0)
}

/** ショットを削除する */
export function removeShot(shots: MvShot[], id: string): MvShot[] {
  const next = shots.filter((s) => s.id !== id)
  if (next.length === shots.length) return shots
  return renumberAndRetime(next, shots[0]?.startSec ?? 0)
}

/**
 * ショットを部分更新する。
 * durationSecを渡すと秒数変更として扱い、後続ショットの時間も詰め直す。
 */
export function updateShot(
  shots: MvShot[],
  id: string,
  patch: Partial<Omit<MvShot, 'id' | 'no'>>,
  durationSec?: number,
): MvShot[] {
  const index = shots.findIndex((s) => s.id === id)
  if (index === -1) return shots
  const next = [...shots]
  const updated = { ...next[index], ...patch }
  if (durationSec !== undefined) {
    const len = Math.max(0.5, durationSec)
    updated.endSec = Math.round((updated.startSec + len) * 10) / 10
  }
  next[index] = updated
  return renumberAndRetime(next, shots[0]?.startSec ?? 0)
}

/** ショット全体の合計秒数 */
export function totalSeconds(shots: MvShot[]): number {
  if (shots.length === 0) return 0
  return Math.round((shots[shots.length - 1].endSec - shots[0].startSec) * 10) / 10
}
