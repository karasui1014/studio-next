/**
 * 連続利用日数。
 *
 * Studio の成功指標は「訪問数」ではなく「連続して開いた日数」なので、
 * それをいちばん簡単な形で記録する。保存するのは日付だけで、外部には送らない。
 */

const KEY = 'studio.visits'
const MAX_DAYS = 400

function dateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function read(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

function write(days: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(days.slice(-MAX_DAYS)))
  } catch {
    /* 保存できなくても表示は続ける */
  }
}

/** 今日きた記録を残し、連続日数と通算日数を返す */
export function recordVisit(): { streak: number; total: number } {
  const days = read()
  const today = dateKey(new Date())

  if (days[days.length - 1] !== today) {
    days.push(today)
    write(days)
  }

  // 今日から1日ずつ遡り、途切れるまで数える
  const set = new Set(days)
  const cursor = new Date()
  let streak = 0
  while (set.has(dateKey(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }

  return { streak, total: days.length }
}
