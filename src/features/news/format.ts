/** 「3時間前」のような相対時刻 */
export function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''

  const min = Math.floor((Date.now() - t) / 60000)
  if (min < 1) return 'たった今'
  if (min < 60) return `${min}分前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour}時間前`
  const day = Math.floor(hour / 24)
  if (day < 7) return `${day}日前`
  const d = new Date(t)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

/** 24時間以内なら新着 */
export function isNew(iso: string | null): boolean {
  const t = Date.parse(iso || '')
  return !Number.isNaN(t) && Date.now() - t < 86400000
}

export const CATEGORY_LABEL: Record<string, string> = {
  jp: '日本語',
  global: '海外',
  official: '公式',
  youtube: '動画',
}

export const CATEGORY_CLASS: Record<string, string> = {
  jp: 'bg-suno/15 text-suno',
  global: 'bg-mv/15 text-mv',
  official: 'bg-premium/15 text-premium',
  youtube: 'bg-youtube/15 text-youtube',
}
