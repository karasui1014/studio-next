import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, RotateCcw, Sparkles, Undo2 } from 'lucide-react'

import { recordActivity } from '@/core/storage/activity'
import { cn } from '@/core/ui/cn'
import { reviewLyrics } from './lib/analyze'
import { buildFinalLyrics, countDecisions, decisionFor, setDecision } from './lib/apply'
import { createSampleInput } from './lib/sample'
import {
  createEmptyInput, REVIEW_INTENSITIES, REVIEW_MODES, validateInput,
  type AxisLevel, type LineDecision, type LinePriority,
  type LyricsReviewInput, type LyricsReviewResult,
} from './lib/types'

const PRIORITY_STYLE: Record<LinePriority, string> = {
  high: 'bg-destructive/15 text-destructive',
  medium: 'bg-premium/15 text-premium',
  low: 'bg-muted text-muted-foreground',
}
const PRIORITY_LABEL: Record<LinePriority, string> = {
  high: '優先度 高', medium: '優先度 中', low: '優先度 低',
}

const AXIS_STYLE: Record<AxisLevel, string> = {
  good: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  ok: 'bg-muted text-muted-foreground',
  needs_work: 'bg-premium/15 text-premium',
}
const AXIS_LABEL: Record<AxisLevel, string> = {
  good: 'よい', ok: 'ふつう', needs_work: '伸ばせる',
}

function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12.5px] font-semibold">{label}</span>
      {hint && <span className="ml-1.5 text-[11px] text-muted-foreground">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  )
}

const inputClass =
  'w-full rounded-lg border border-border bg-card px-3 py-2 text-[14px] outline-none ' +
  'focus:border-primary focus:ring-2 focus:ring-primary/20'

/**
 * 歌詞レビュー。
 *
 * 添削のロジックは Version 1 からそのまま移植したもの（テスト69件つき）。
 * 端末内のルールベースで動くので、外部へ歌詞を送信することは一切ない。
 */
export function LyricsReviewPage() {
  const [input, setInput] = useState<LyricsReviewInput>(createEmptyInput)
  const [result, setResult] = useState<LyricsReviewResult | null>(null)
  const [decisions, setDecisions] = useState<LineDecision[]>([])
  const [errors, setErrors] = useState<string[]>([])

  const set = <K extends keyof LyricsReviewInput>(key: K, value: LyricsReviewInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }))

  const run = () => {
    const found = validateInput(input)
    setErrors(found)
    if (found.length > 0) return

    // 曲データとの連携は Phase 4 の後半（曲一覧）で繋ぐ。いまは単体で動かす。
    const r = reviewLyrics(input, {
      songTitle: '', sunoPrompt: '', mvPrompt: '', historyCount: 0, completed: false,
    })
    setResult(r)
    setDecisions([])
    recordActivity({
      id: 'lyrics-review', kind: 'tool', label: '歌詞レビュー', to: '/tools/lyrics-review', url: null,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const counts = useMemo(
    () => (result ? countDecisions(result.lineSuggestions, decisions) : null),
    [result, decisions],
  )

  const finalText = useMemo(() => {
    if (!result) return ''
    // 却下・保留の行は原文のまま残る（作者の意図を勝手に消さない）
    return buildFinalLyrics(input.lyrics, result.lineSuggestions, decisions)
  }, [result, input.lyrics, decisions])

  const decide = (id: string, status: LineDecision['status']) => {
    const current = decisionFor(decisions, id)
    setDecisions(
      setDecision(decisions, {
        ...current,
        status: current.status === status ? 'pending' : status,
      }),
    )
  }

  return (
    <div className="animate-fade-in pb-6">
      <Link to="/tools" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />
        制作ツール
      </Link>

      <h1 className="mt-2 text-xl font-bold">歌詞レビュー</h1>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
        字余り・韻・構成をチェックして、行ごとに直し方を出します。
        処理はすべて端末内で行うので、歌詞が外部に送られることはありません。
      </p>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* ---------------- 入力 ---------------- */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[14px] font-bold">歌詞と条件</h2>
            <button
              type="button"
              onClick={() => { setInput(createSampleInput()); setErrors([]) }}
              className="rounded-lg border border-border px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground"
            >
              サンプルを入れる
            </button>
          </div>

          <div className="mt-3 space-y-3">
            <Field label="歌詞" hint="必須">
              <textarea
                value={input.lyrics}
                onChange={(e) => set('lyrics', e.target.value)}
                rows={10}
                placeholder={'[Verse]\n夜の高速 灯りが流れる\n…'}
                className={cn(inputClass, 'resize-y font-mono text-[13px] leading-relaxed')}
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="ジャンル" hint="必須">
                <input className={inputClass} value={input.genre}
                  onChange={(e) => set('genre', e.target.value)} placeholder="Lo-fi" />
              </Field>
              <Field label="感情" hint="必須">
                <input className={inputClass} value={input.emotion}
                  onChange={(e) => set('emotion', e.target.value)} placeholder="切なさ" />
              </Field>
              <Field label="聴き手" hint="必須">
                <input className={inputClass} value={input.audience}
                  onChange={(e) => set('audience', e.target.value)} placeholder="夜に作業する人" />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="添削モード">
                <select className={inputClass} value={input.mode}
                  onChange={(e) => set('mode', e.target.value as LyricsReviewInput['mode'])}>
                  {REVIEW_MODES.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="添削の強さ">
                <select className={inputClass} value={input.intensity}
                  onChange={(e) => set('intensity', e.target.value as LyricsReviewInput['intensity'])}>
                  {REVIEW_INTENSITIES.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            <details className="rounded-lg border border-border px-3 py-2">
              <summary className="cursor-pointer text-[12.5px] font-semibold">
                さらに条件を足す（任意）
              </summary>
              <div className="mt-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="テーマ">
                    <input className={inputClass} value={input.theme}
                      onChange={(e) => set('theme', e.target.value)} />
                  </Field>
                  <Field label="ボーカル">
                    <input className={inputClass} value={input.vocal}
                      onChange={(e) => set('vocal', e.target.value)} />
                  </Field>
                </div>
                <Field label="残したい表現" hint="改行か読点で区切る">
                  <input className={inputClass} value={input.keepPhrases}
                    onChange={(e) => set('keepPhrases', e.target.value)} />
                </Field>
                <Field label="使いたくない表現">
                  <input className={inputClass} value={input.avoidWords}
                    onChange={(e) => set('avoidWords', e.target.value)} />
                </Field>
                <Field label="自分で気になっているところ">
                  <input className={inputClass} value={input.concern}
                    onChange={(e) => set('concern', e.target.value)} />
                </Field>
              </div>
            </details>

            {errors.length > 0 && (
              <ul className="rounded-lg bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">
                {errors.map((e) => <li key={e}>・{e}</li>)}
              </ul>
            )}

            <button
              type="button"
              onClick={run}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-[14px] font-bold text-primary-foreground"
            >
              <Sparkles className="h-4 w-4" />
              歌詞をレビューする
            </button>
          </div>
        </div>

        {/* ---------------- 結果 ---------------- */}
        <div>
          {!result && (
            <div className="rounded-xl border border-dashed border-border px-5 py-16 text-center">
              <p className="text-sm font-semibold">結果はここに出ます</p>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                歌詞・ジャンル・感情・聴き手を入れて実行してください。
              </p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="rounded-xl border border-primary/25 bg-primary/[0.06] p-4">
                <p className="text-[13px] font-bold">まず直すならここ</p>
                <p className="mt-1 text-[13px] leading-relaxed">{result.topPriority}</p>
                <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted-foreground">
                  {result.overallComment}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <p className="mb-2.5 text-[13px] font-bold">項目別</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {result.axes.map((a) => (
                    <div key={a.axis} className="flex items-start gap-2">
                      <span className={cn('shrink-0 rounded px-1.5 py-px text-[10px] font-bold', AXIS_STYLE[a.level])}>
                        {AXIS_LABEL[a.level]}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[12.5px] font-semibold">{a.label}</span>
                        <span className="block text-[11.5px] leading-relaxed text-muted-foreground">
                          {a.comment}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {result.lineSuggestions.length > 0 && (
                <div>
                  <div className="mb-2 flex flex-wrap items-baseline gap-2">
                    <h2 className="text-[14px] font-bold">行ごとの提案</h2>
                    {counts && (
                      <span className="text-[11.5px] text-muted-foreground">
                        {result.lineSuggestions.length}件中 {counts.adopted}件を採用
                      </span>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    {result.lineSuggestions.map((s) => {
                      const d = decisionFor(decisions, s.id)
                      return (
                        <div
                          key={s.id}
                          className={cn(
                            'rounded-xl border bg-card p-3.5',
                            d.status === 'adopted' && 'border-primary/50 bg-primary/[0.04]',
                            d.status === 'rejected' && 'border-border opacity-60',
                            d.status === 'pending' && 'border-border',
                          )}
                        >
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            <span className={cn('rounded px-1.5 py-px font-bold', PRIORITY_STYLE[s.priority])}>
                              {PRIORITY_LABEL[s.priority]}
                            </span>
                            <span>{s.sectionLabel}</span>
                            <span className="tabular-nums">{s.lineNumber}行目</span>
                          </div>

                          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted px-2.5 py-1.5 font-mono text-[12.5px] line-through opacity-70">
                            {s.original}
                          </p>
                          <p className="mt-1.5 whitespace-pre-wrap rounded-lg bg-primary/10 px-2.5 py-1.5 font-mono text-[12.5px] font-semibold">
                            {s.suggestion}
                          </p>

                          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                            <span className="font-semibold text-foreground">なぜ: </span>
                            {s.reason}
                          </p>
                          {s.keepNote && (
                            <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                              <span className="font-semibold">残す場合: </span>{s.keepNote}
                            </p>
                          )}

                          <div className="mt-2.5 flex gap-2">
                            <button
                              type="button"
                              onClick={() => decide(s.id, 'adopted')}
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] font-semibold',
                                d.status === 'adopted'
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-border',
                              )}
                            >
                              <Check className="h-3.5 w-3.5" />
                              採用
                            </button>
                            <button
                              type="button"
                              onClick={() => decide(s.id, 'rejected')}
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] font-semibold',
                                d.status === 'rejected' ? 'border-foreground/40 bg-muted' : 'border-border',
                              )}
                            >
                              <Undo2 className="h-3.5 w-3.5" />
                              このままにする
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-border bg-card p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-[13px] font-bold">採用したものを反映した歌詞</p>
                  <button
                    type="button"
                    onClick={() => setDecisions([])}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    選び直す
                  </button>
                </div>
                <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg bg-muted px-3 py-2.5 font-mono text-[12.5px] leading-relaxed">
                  {finalText}
                </pre>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(finalText)}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-semibold"
                >
                  コピーする
                </button>
              </div>

              {result.nextAdvice.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-[13px] font-bold">次に作るときに意識すること</p>
                  <ul className="mt-1.5 space-y-1 text-[12.5px] leading-relaxed text-muted-foreground">
                    {result.nextAdvice.map((a) => <li key={a}>・{a}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
