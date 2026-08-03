import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Copy, Sparkles } from 'lucide-react'

import { recordActivity } from '@/core/storage/activity'
import { cn } from '@/core/ui/cn'
import { Field, inputClass, ToolHeader } from '../ui'
import { analyzeWithMock } from './lib/analyze'
import {
  createEmptyInput, validateInput,
  type AiProducerInput, type AiProducerResult, type SuggestionPriority, type SuggestionTarget,
} from './lib/types'

const PRIORITY_LABEL: Record<SuggestionPriority, string> = {
  now: 'いま直す', later: 'あとで',
}
const PRIORITY_STYLE: Record<SuggestionPriority, string> = {
  now: 'bg-destructive/15 text-destructive',
  later: 'bg-muted text-muted-foreground',
}
const TARGET_LABEL: Record<SuggestionTarget, string> = {
  lyrics: '歌詞', suno: 'プロンプト', structure: '構成', title: 'タイトル', input: '入力',
}

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[13px] font-bold">{title}</p>
      <ul className="mt-1.5 space-y-1 text-[12.5px] leading-relaxed text-muted-foreground">
        {items.map((t) => <li key={t}>・{t}</li>)}
      </ul>
    </div>
  )
}

/**
 * AIプロデューサー。
 * 曲の狙いと素材を渡すと、どこをどう直すかを優先順位つきで出す。
 * ロジックは Version 1 から移植（端末内のルールベース・外部送信なし）。
 */
export function AiProducerPage() {
  const [input, setInput] = useState<AiProducerInput>(createEmptyInput)
  const [result, setResult] = useState<AiProducerResult | null>(null)
  const [errors, setErrors] = useState<string[]>([])

  const set = <K extends keyof AiProducerInput>(key: K, value: AiProducerInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }))

  const run = () => {
    const found = validateInput(input)
    setErrors(found)
    if (found.length > 0) return

    setResult(analyzeWithMock(input, {
      songTitle: '', mvPrompt: '', mvPromptCount: 0, youtubeUrl: '', youtubeTitle: '',
      historyCount: 0, sunoPromptCount: 0, completed: false,
    }))
    recordActivity({
      id: 'ai-producer', kind: 'tool', label: 'AIプロデューサー', to: '/tools/ai-producer', url: null,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="animate-fade-in pb-6">
      <ToolHeader
        title="AIプロデューサー"
        description="曲の狙いと素材を渡すと、どこをどう直せばよいかを優先順位つきで出します。"
      />

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-[14px] font-bold">曲の情報</h2>

          <div className="mt-3 space-y-3">
            <Field label="曲の狙い" hint="必須">
              <input className={inputClass} value={input.aim}
                onChange={(e) => set('aim', e.target.value)} placeholder="夜の作業用に流し続けられる曲" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="聴き手" hint="必須">
                <input className={inputClass} value={input.audience}
                  onChange={(e) => set('audience', e.target.value)} placeholder="深夜に作業する20〜30代" />
              </Field>
              <Field label="公開先" hint="必須">
                <input className={inputClass} value={input.media}
                  onChange={(e) => set('media', e.target.value)} placeholder="YouTube" />
              </Field>
            </div>

            <p className="text-[11.5px] text-muted-foreground">
              下の3つのうち、少なくとも1つは入れてください。
            </p>

            <Field label="Sunoプロンプト">
              <textarea className={cn(inputClass, 'resize-y font-mono text-[13px]')} rows={3}
                value={input.sunoPrompt} onChange={(e) => set('sunoPrompt', e.target.value)} />
            </Field>
            <Field label="歌詞">
              <textarea className={cn(inputClass, 'resize-y font-mono text-[13px]')} rows={5}
                value={input.lyrics} onChange={(e) => set('lyrics', e.target.value)} />
            </Field>
            <Field label="自分でどんな曲か説明する">
              <textarea className={cn(inputClass, 'resize-y')} rows={2}
                value={input.selfDescription} onChange={(e) => set('selfDescription', e.target.value)} />
            </Field>

            <details className="rounded-lg border border-border px-3 py-2">
              <summary className="cursor-pointer text-[12.5px] font-semibold">さらに条件を足す（任意）</summary>
              <div className="mt-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="ジャンル">
                    <input className={inputClass} value={input.genre} onChange={(e) => set('genre', e.target.value)} />
                  </Field>
                  <Field label="BPM">
                    <input className={inputClass} value={input.bpm} onChange={(e) => set('bpm', e.target.value)} />
                  </Field>
                  <Field label="長さ">
                    <input className={inputClass} value={input.duration} onChange={(e) => set('duration', e.target.value)} />
                  </Field>
                </div>
                <Field label="気になっているところ">
                  <input className={inputClass} value={input.concern} onChange={(e) => set('concern', e.target.value)} />
                </Field>
                <Field label="残したい要素">
                  <input className={inputClass} value={input.keep} onChange={(e) => set('keep', e.target.value)} />
                </Field>
              </div>
            </details>

            {errors.length > 0 && (
              <ul className="rounded-lg bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">
                {errors.map((e) => <li key={e}>・{e}</li>)}
              </ul>
            )}

            <button type="button" onClick={run}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-[14px] font-bold text-primary-foreground">
              <Sparkles className="h-4 w-4" />
              分析する
            </button>
          </div>
        </div>

        <div>
          {!result ? (
            <div className="rounded-xl border border-dashed border-border px-5 py-16 text-center">
              <p className="text-sm font-semibold">結果はここに出ます</p>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                狙い・聴き手・公開先と、素材を1つ以上入れてください。
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-primary/25 bg-primary/[0.06] p-4">
                <p className="text-[13px] font-bold">いちばん大きな問題</p>
                <p className="mt-1 text-[13px] leading-relaxed">{result.biggestProblem}</p>
              </div>

              <List title="良いところ" items={result.goodPoints} />

              {result.suggestions.length > 0 && (
                <div>
                  <h2 className="mb-2 text-[14px] font-bold">
                    直す順番<span className="ml-2 text-[11.5px] font-normal text-muted-foreground">
                      {result.suggestions.length}件
                    </span>
                  </h2>
                  <ol className="space-y-2.5">
                    {result.suggestions.map((s, i) => (
                      <li key={s.ruleId} className="rounded-xl border border-border bg-card p-3.5">
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="grid h-5 w-5 place-items-center rounded bg-muted font-bold tabular-nums">
                            {i + 1}
                          </span>
                          <span className={cn('rounded px-1.5 py-px font-bold', PRIORITY_STYLE[s.priority])}>
                            {PRIORITY_LABEL[s.priority]}
                          </span>
                          <span className="text-muted-foreground">{TARGET_LABEL[s.target]}</span>
                        </div>
                        <p className="mt-2 text-[13px] font-semibold leading-snug">{s.problem}</p>
                        <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                          <span className="font-semibold text-foreground">なぜ: </span>{s.reason}
                        </p>
                        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                          <span className="font-semibold text-foreground">どうする: </span>{s.fix}
                        </p>
                        {s.example && (
                          <p className="mt-1.5 whitespace-pre-wrap rounded-lg bg-muted px-2.5 py-1.5 font-mono text-[12px]">
                            {s.example}
                          </p>
                        )}
                        <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                          期待できる変化: {s.expected}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {result.revisedSunoPrompt && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-[13px] font-bold">修正版プロンプト</p>
                  <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-muted px-3 py-2.5 font-mono text-[12.5px] leading-relaxed">
                    {result.revisedSunoPrompt}
                  </pre>
                  {result.revisedPromptNotes.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-[11.5px] text-muted-foreground">
                      {result.revisedPromptNotes.map((n) => <li key={n}>・{n}</li>)}
                    </ul>
                  )}
                  <button type="button"
                    onClick={() => navigator.clipboard?.writeText(result.revisedSunoPrompt)}
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-semibold">
                    <Copy className="h-3.5 w-3.5" />
                    コピーする
                  </button>
                </div>
              )}

              <List title="このままでよいところ" items={result.keepAsIs} />
              <List title="サビの案" items={result.chorusIdeas} />
              <List title="タイトルの案" items={result.titleIdeas} />
              <List title="次に作るときのチェックリスト" items={result.nextChecklist} />
            </div>
          )}
        </div>
      </div>

      <Link to="/tools" className="mt-6 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />
        制作ツールへ戻る
      </Link>
    </div>
  )
}
