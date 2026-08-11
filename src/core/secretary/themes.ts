import type { Song } from '@/core/storage/songs'

/**
 * 次の曲のテーマ提案。V1から移植（語彙・組み立ては無改変）。
 *
 * AIにもAPIにも聞かない。「情感 × 情景」の組み合わせを端末内で作るだけ。
 * それでも実用になるのは、提案の役目が「正解を出すこと」ではなく
 * **手が止まったときに最初の一歩を差し出すこと**だから。
 * 作ってきたジャンルの傾向だけは反映するので、曲が増えるほど自分向けになる。
 */

const MOODS = [
  '切ない',
  '疾走感のある',
  '郷愁を誘う',
  '幻想的な',
  '希望に満ちた',
  '内省的な',
  '高揚感のある',
  '静かで穏やかな',
  '解放感のある',
  '少し不思議な',
  'ノスタルジックな',
  '情熱的な',
  '雨の匂いがするような',
  '夢見心地な',
]

const SCENES = [
  '深夜のドライブ',
  '雨上がりの街並み',
  '夏の終わりの海辺',
  '始発電車の窓',
  '廃墟の中の光',
  '縁日の帰り道',
  '曇り空の午後',
  '都会の夜景',
  '学校帰りの裏道',
  '静かな図書館',
  '故郷への帰り道',
  '眠れない夜',
  '朝焼けの中の一歩',
  '古い写真の記憶',
  '街灯だけが灯る路地',
  '誰もいない教室',
  '窓辺で聴くレコード',
]

function topGenre(songs: Song[]): string | undefined {
  const counts = new Map<string, number>()
  for (const s of songs) {
    if (!s.genre) continue
    counts.set(s.genre, (counts.get(s.genre) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

export interface ThemeSuggestion {
  key: string
  text: string
}

/** 直前に出したものは `exclude` に入れて渡す（同じ提案を続けて出さないため） */
export function suggestTheme(songs: Song[], exclude: string[] = []): ThemeSuggestion {
  const genre = topGenre(songs)
  let combo = ''
  let attempts = 0
  do {
    combo = `${pickRandom(MOODS)}${pickRandom(SCENES)}`
    attempts++
  } while (exclude.includes(combo) && attempts < 12)

  const text = genre
    ? `${genre}で、${combo}をテーマにした曲はいかがでしょうか？`
    : `${combo}をテーマにした曲はいかがでしょうか？`

  return { key: combo, text }
}
