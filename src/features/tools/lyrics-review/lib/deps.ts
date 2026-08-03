/**
 * Version 1 から移植したロジックが必要とする最小限の型。
 *
 * V1 の `src/lib/tools/types.ts` と `src/lib/types.ts` には
 * このツールに関係ない定義も多いので、必要な分だけをここに写している。
 */

/** 曲の状態（V1の Song 型から必要な分だけ） */
export type SongStatus = 'idea' | 'lyrics' | 'suno' | 'mv' | 'published'

/** 添削エンジンの提供元。いまは端末内のルールベースのみ */
export type AiProviderId = 'mock'
