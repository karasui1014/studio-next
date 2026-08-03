import type { ParsedStructure } from './structure'
import type { LineDecision, LineSuggestion } from './types'

export type DecisionStatus = LineDecision['status']

/** 指定提案の採用状態を返す(未記録は pending) */
export function decisionFor(decisions: LineDecision[], suggestionId: string): LineDecision {
  return (
    decisions.find((d) => d.suggestionId === suggestionId) ?? {
      suggestionId,
      status: 'pending',
    }
  )
}

/** 採用状態を差し替えた新しい配列を返す */
export function setDecision(decisions: LineDecision[], next: LineDecision): LineDecision[] {
  const rest = decisions.filter((d) => d.suggestionId !== next.suggestionId)
  return [...rest, next]
}

/** 提案が採用されたときに最終版へ入るテキスト */
export function adoptedText(suggestion: LineSuggestion, decision: LineDecision): string {
  return decision.chosenText ?? suggestion.suggestion
}

export interface BuildOptions {
  /**
   * 構造が明示されていない歌詞に、推定セクションのタグ([サビ] など)を
   * 最終版へ挿入する(Suno等のAI音楽サービスで扱いやすくなる)
   */
  addSectionTags?: boolean
  structure?: ParsedStructure
}

/**
 * 採用された提案だけを原文へ反映した「最終版」を組み立てる。
 * 却下・保留の行は原文のまま残す(作者の意図を勝手に消さない)。
 */
export function buildFinalLyrics(
  originalLyrics: string,
  suggestions: LineSuggestion[],
  decisions: LineDecision[],
  options?: BuildOptions,
): string {
  const lines = originalLyrics.split('\n')
  const byLine = new Map<number, LineSuggestion>()
  for (const s of suggestions) byLine.set(s.lineNumber - 1, s)

  const tagAt = new Map<number, string>()
  if (options?.addSectionTags && options.structure && !options.structure.explicit) {
    for (const section of options.structure.sections) {
      tagAt.set(section.startLine, `[${section.label}]`)
    }
  }

  const out: string[] = []
  lines.forEach((line, i) => {
    const tag = tagAt.get(i)
    if (tag) {
      if (out.length > 0 && out[out.length - 1].trim()) out.push('')
      out.push(tag)
    }
    const suggestion = byLine.get(i)
    if (suggestion) {
      const decision = decisionFor(decisions, suggestion.id)
      if (decision.status === 'adopted') {
        out.push(adoptedText(suggestion, decision))
        return
      }
    }
    out.push(line)
  })
  return out.join('\n')
}

/** すべての提案を採用した場合の全文(=結果Schemaの「添削後全文」) */
export function buildAllAdoptedLyrics(originalLyrics: string, suggestions: LineSuggestion[]): string {
  return buildFinalLyrics(
    originalLyrics,
    suggestions,
    suggestions.map((s) => ({ suggestionId: s.id, status: 'adopted' as const })),
  )
}

export type DiffRowState = 'unchanged' | 'pending' | 'adopted' | 'rejected'

export interface DiffRow {
  /** 原文の行番号(1始まり) */
  lineNumber: number
  original: string
  /** 右側(修正側)に表示するテキスト */
  revised: string
  state: DiffRowState
  suggestionId?: string
  isHeading: boolean
}

/**
 * 原文と修正版を行単位で突き合わせた比較行を作る。
 * 提案のある行は採用状態に応じて revised が変わる:
 * - adopted: 採用テキスト / - rejected: 原文のまま / - pending: 提案テキスト(未確定として表示)
 */
export function buildDiffRows(
  originalLyrics: string,
  suggestions: LineSuggestion[],
  decisions: LineDecision[],
  headingLineIndexes: number[] = [],
): DiffRow[] {
  const lines = originalLyrics.split('\n')
  const byLine = new Map<number, LineSuggestion>()
  for (const s of suggestions) byLine.set(s.lineNumber - 1, s)
  const headingSet = new Set(headingLineIndexes)

  return lines.map((line, i) => {
    const suggestion = byLine.get(i)
    if (!suggestion) {
      return {
        lineNumber: i + 1,
        original: line,
        revised: line,
        state: 'unchanged' as const,
        isHeading: headingSet.has(i),
      }
    }
    const decision = decisionFor(decisions, suggestion.id)
    const revised =
      decision.status === 'rejected' ? line : adoptedText(suggestion, decision)
    return {
      lineNumber: i + 1,
      original: line,
      revised,
      state: decision.status,
      suggestionId: suggestion.id,
      isHeading: false,
    }
  })
}

/** 採用/却下/保留の件数 */
export function countDecisions(
  suggestions: LineSuggestion[],
  decisions: LineDecision[],
): { adopted: number; rejected: number; pending: number } {
  let adopted = 0
  let rejected = 0
  let pending = 0
  for (const s of suggestions) {
    const status = decisionFor(decisions, s.id).status
    if (status === 'adopted') adopted += 1
    else if (status === 'rejected') rejected += 1
    else pending += 1
  }
  return { adopted, rejected, pending }
}
