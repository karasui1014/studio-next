import type { Song } from '@/core/storage/songs'

/**
 * レベルと称号。V1から移植（ロジックは無改変）。
 *
 * ■ 何を数えるか
 * V1は `song.completedAt` を見ていたが、V2の曲データに完了日時の項目は無い。
 * V2では **status が 'published'（公開済み）になった曲**を「完成した曲」とする。
 * 「作りかけを増やす」ではなく「出し切る」ことを評価したいので、この対応が自然。
 *
 * ■ なぜ曲数か
 * ログイン日数や滞在時間ではなく、完成した作品数だけを見る。
 * Studio が増やしたいのは接触時間ではなく、世に出た作品の数だから。
 */

export const MAX_LEVEL = 100

/** レベル1〜100を5ずつ20段に区切った称号。上に行くほど大仰になる。 */
const TITLE_TIERS: { minLevel: number; title: string }[] = [
  { minLevel: 1, title: '音の卵' },
  { minLevel: 6, title: '旋律の芽' },
  { minLevel: 11, title: '駆け出し作曲家' },
  { minLevel: 16, title: '音紡ぎの見習い' },
  { minLevel: 21, title: '調べの探究者' },
  { minLevel: 26, title: '旋律の職人' },
  { minLevel: 31, title: '音色の魔術師' },
  { minLevel: 36, title: '響きの詩人' },
  { minLevel: 41, title: '調べの賢者' },
  { minLevel: 46, title: '音楽の匠' },
  { minLevel: 51, title: '旋律の巨匠' },
  { minLevel: 56, title: '響奏の達人' },
  { minLevel: 61, title: '音楽の織り手' },
  { minLevel: 66, title: '調べの守護者' },
  { minLevel: 71, title: '音の賢人' },
  { minLevel: 76, title: '旋律の伝道師' },
  { minLevel: 81, title: '響きの巨星' },
  { minLevel: 86, title: '音楽の賢王' },
  { minLevel: 91, title: '調べの伝説' },
  { minLevel: 96, title: '音楽の神話' },
]

export function getTitle(level: number): string {
  let current = TITLE_TIERS[0].title
  for (const tier of TITLE_TIERS) {
    if (level >= tier.minLevel) current = tier.title
    else break
  }
  return current
}

/**
 * そのレベルに到達するのに必要な完成曲数（レベル1は0曲）。
 * 二次曲線にしてあるので、序盤はすぐ上がり、上位ほど時間がかかる。
 */
export function songsRequiredForLevel(level: number): number {
  if (level <= 1) return 0
  return Math.ceil((level - 1) ** 2 / 12.5)
}

export function levelForCompletedCount(count: number): number {
  const level = Math.floor(Math.sqrt(count * 12.5)) + 1
  return Math.min(level, MAX_LEVEL)
}

export interface ProgressInfo {
  completedCount: number
  level: number
  title: string
  isMaxLevel: boolean
  songsIntoLevel: number
  songsPerLevel: number
  songsToNextLevel: number
  /** 0〜1 */
  progressRatio: number
}

/** 完成した曲（公開済み）だけを数える */
export function countCompleted(songs: Song[]): number {
  return songs.filter((s) => s.status === 'published').length
}

export function getProgress(songs: Song[]): ProgressInfo {
  const completedCount = countCompleted(songs)
  const level = levelForCompletedCount(completedCount)
  const isMaxLevel = level >= MAX_LEVEL
  const currentLevelStart = songsRequiredForLevel(level)
  const nextLevelStart = isMaxLevel ? currentLevelStart : songsRequiredForLevel(level + 1)
  const songsPerLevel = Math.max(1, nextLevelStart - currentLevelStart)
  const songsIntoLevel = completedCount - currentLevelStart
  const songsToNextLevel = isMaxLevel ? 0 : nextLevelStart - completedCount

  return {
    completedCount,
    level,
    title: getTitle(level),
    isMaxLevel,
    songsIntoLevel,
    songsPerLevel,
    songsToNextLevel,
    progressRatio: isMaxLevel ? 1 : Math.min(1, songsIntoLevel / songsPerLevel),
  }
}
