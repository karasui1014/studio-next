/**
 * AI秘書の設定。
 *
 * ■ V1（AI Music Studio）からの移植
 * 設計思想はV1と同じ。「AIらしい万能アシスタント」ではなく、
 * **利用者が自分で名前・見た目・話し方を決める相棒**にする。
 * 文章は端末内のルールだけで組み立て、外部APIには一切問い合わせない。
 *
 * ■ 第一原則との関係
 * 設定も画像も localStorage / IndexedDB にしか置かない。
 * 「あなたの秘書」である以上、その人物像がこちらのサーバーに送られるのはおかしい。
 */

export type SpeakingStyle = 'polite' | 'friendly' | 'cool'
export type CheerStyle = 'gentle' | 'energetic' | 'stoic'

export interface SecretarySettings {
  name: string
  firstPerson: string
  speakingStyle: SpeakingStyle
  personality: string
  catchphrase: string
  cheerStyle: CheerStyle
}

export const DEFAULT_SECRETARY_SETTINGS: SecretarySettings = {
  name: 'アシスタント',
  firstPerson: '私',
  speakingStyle: 'polite',
  personality: '',
  catchphrase: '',
  cheerStyle: 'gentle',
}

export const SPEAKING_STYLE_LABEL: Record<SpeakingStyle, string> = {
  polite: 'ていねい',
  friendly: 'フレンドリー',
  cool: 'クール',
}

export const CHEER_STYLE_LABEL: Record<CheerStyle, string> = {
  gentle: 'やさしく見守る',
  energetic: '元気に盛り上げる',
  stoic: '淡々と支える',
}

/** 曲数の節目。一度お祝いしたら二度は言わない（しつこくしない） */
export const SONG_MILESTONES = [10, 30, 50, 100, 200, 300, 500]

/** 保存先。V1とは別の名前空間にして、V1のデータを壊さない。 */
export const SECRETARY_KEYS = {
  settings: 'studio-next:secretary:v1',
  milestones: 'studio-next:secretary:milestones:v1',
} as const

/** 秘書の画像は容量が大きいので localStorage ではなく IndexedDB に置く */
export const AVATAR_IDB_KEY = 'secretary-avatar'
