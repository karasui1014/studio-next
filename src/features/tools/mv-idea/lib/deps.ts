/**
 * Version 1 から移植したロジックが必要とする最小限の定義。
 * V1 の共有ファイルには関係ない定義も多いので、必要な分だけを写している。
 */

export type SongStatus = 'idea' | 'lyrics' | 'suno' | 'mv' | 'published'

export type AiProviderId = 'mock'

/** localStorage のキー。V1と別の名前空間にして、V1のデータを壊さない。 */
export const STORAGE_KEYS = {
  promptDexUser: 'studio-next:prompt-dex:user:v1',
  promptDexFavorites: 'studio-next:prompt-dex:favorites:v1',
} as const
