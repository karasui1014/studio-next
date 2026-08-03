import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Copy, Download, Sparkles } from 'lucide-react'

import { recordActivity } from '@/core/storage/activity'
import { cn } from '@/core/ui/cn'
import { Field, inputClass, ToolHeader } from '../ui'
import { expandConcept, generateResult } from './lib/generate'
import { downloadTextFile, resultToMarkdown, shotsToCsv } from './lib/export'
import {
  createEmptyInput, MV_PLAN_MODES, shotSeconds, validateInput,
  type MvConcept, type MvIdeaInput, type MvIdeaResult, type MvPlanDetail,
} from './lib/types'

/** 曲データとの連携は Phase 4 後半（曲一覧）で繋ぐ。いまは単体で動かす。 */
const CONTEXT = {
  songTitle: '', sunoPrompt: '', latestMvPrompt: '', existingMvPromptCount: 0,
  youtubeUrl: '', youtubeTitle: '', youtubeDescription: '', youtubeTags: '',
  historyCount: 0,
}

function secText(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * MVアイデア。
 * 2段階で進む：まず3つの企画案を出し、選んだ1つをショットリストまで展開する。
 * ロジックは Version 1 から移植（テスト付き・端末内で完結）。
 */
export function MvIdeaPage() {
  const [input, setInput] = useState<MvIdeaInput>(createEmptyInput)
  const [result, setResult] = useState<MvIdeaResult | null>(null)
  const [detail, setDetail] = useState<MvPlanDetail | null>(null)
  const [errors, setErrors] = useState<string[]>([])

  const set = <K extends keyof MvIdeaInput>(key: K, value: MvIdeaInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }))

  const run = () => {
    const found = validateInput(input)
    setErrors(found)
    if (found.length > 0) return

    setResult(generateResult(input, CONTEXT))
    setDetail(null)
    recordActivity({ id: 'mv-idea', kind: 'tool', label: 'MVアイデア', to: '/tools/mv-idea', url: null })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const expand = (concept: MvConcept) => {
    setDetail(expandConcept(input, CONTEXT, concept))
    setResult((prev) => (prev ? { ...prev, selectedConceptId: concept.id } : prev))
  }

  return (
    <div className="animate-fade-in pb-6">
      <ToolHeader
        title="MVアイデア"
        description="曲の情報から企画案を3つ出し、選んだ案をショットリストと生成プロンプトまで展開します。"
      />

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* 入力 */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-[14px] font-bold">曲の情報</h2>
          <div className="mt-3 space-y-3">
            <Field label="曲名" hint="必須">
              <input className={inputClass} value={input.title} onChange={(e) => set('title', e.target.value)} />
            </Field>
            <Field label="曲の説明" hint="必須">
              <textarea className={cn(inputClass, 'resize-y')} rows={3}
                value={input.description} onChange={(e) => set('description', e.target.value)}
                placeholder="深夜の首都高を走りながら聴く曲" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="ジャンル" hint="必須">
                <input className={inputClass} value={input.genre} onChange={(e) => set('genre', e.target.value)} />
              </Field>
              <Field label="感情" hint="必須">
                <input className={inputClass} value={input.mood} onChange={(e) => set('mood', e.target.value)} />
              </Field>
              <Field label="曲の長さ" hint="必須">
                <input className={inputClass} value={input.durationText}
                  onChange={(e) => set('durationText', e.target.value)} placeholder="3:30" />
              </Field>
              <Field label="公開先" hint="必須">
                <input className={inputClass} value={input.media}
                  onChange={(e) => set('media', e.target.value)} placeholder="YouTube" />
              </Field>
            </div>
            <Field label="作り方">
              <select className={inputClass} value={input.mode}
                onChange={(e) => set('mode', e.target.value as MvIdeaInput['mode'])}>
                {MV_PLAN_MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {MV_PLAN_MODES.find((m) => m.id === input.mode)?.hint}
              </p>
            </Field>

            <details className="rounded-lg border border-border px-3 py-2">
              <summary className="cursor-pointer text-[12.5px] font-semibold">さらに条件を足す（任意）</summary>
              <div className="mt-3 space-y-3">
                <Field label="登場人物">
                  <input className={inputClass} value={input.characters} onChange={(e) => set('characters', e.target.value)} />
                </Field>
                <Field label="舞台">
                  <input className={inputClass} value={input.stage} onChange={(e) => set('stage', e.target.value)} />
                </Field>
                <Field label="色の雰囲気">
                  <input className={inputClass} value={input.colorMood} onChange={(e) => set('colorMood', e.target.value)} />
                </Field>
                <Field label="使える素材">
                  <input className={inputClass} value={input.availableAssets} onChange={(e) => set('availableAssets', e.target.value)} />
                </Field>
                <Field label="避けたい表現">
                  <input className={inputClass} value={input.avoid} onChange={(e) => set('avoid', e.target.value)} />
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
              企画案を出す
            </button>
          </div>
        </div>

        {/* 結果 */}
        <div>
          {!result ? (
            <div className="rounded-xl border border-dashed border-border px-5 py-16 text-center">
              <p className="text-sm font-semibold">企画案はここに出ます</p>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                必須項目を入れて「企画案を出す」を押してください。
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {result.conversionNotes.length > 0 && (
                <div className="rounded-xl border border-premium/30 bg-premium/[0.07] p-3.5">
                  <p className="text-[12.5px] font-bold text-premium">固有名詞を一般的な表現に置き換えました</p>
                  <ul className="mt-1 space-y-0.5 text-[11.5px] text-muted-foreground">
                    {result.conversionNotes.map((n) => <li key={n}>・{n}</li>)}
                  </ul>
                </div>
              )}

              <div>
                <h2 className="mb-2 text-[14px] font-bold">企画案</h2>
                <div className="grid gap-2.5 lg:grid-cols-3">
                  {result.concepts.map((c) => (
                    <div key={c.id}
                      className={cn(
                        'flex flex-col rounded-xl border bg-card p-3.5',
                        result.selectedConceptId === c.id ? 'border-primary' : 'border-border',
                      )}>
                      <p className="text-[13.5px] font-bold leading-snug">{c.conceptTitle}</p>
                      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{c.oneLiner}</p>
                      <dl className="mt-2.5 space-y-1 text-[11.5px]">
                        <div><dt className="inline font-semibold">冒頭3秒: </dt>
                          <dd className="inline text-muted-foreground">{c.opening3s}</dd></div>
                        <div><dt className="inline font-semibold">サビ: </dt>
                          <dd className="inline text-muted-foreground">{c.chorusHighlight}</dd></div>
                      </dl>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        難易度 {c.difficulty} ・ {c.timeEstimate}
                      </p>
                      <button type="button" onClick={() => expand(c)}
                        className="mt-3 rounded-lg bg-primary/10 px-3 py-1.5 text-[12.5px] font-semibold text-primary">
                        この案を詳しくする
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {detail && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-primary/25 bg-primary/[0.06] p-4">
                    <p className="text-[15px] font-bold">{detail.conceptTitle}</p>
                    <p className="mt-1 text-[12.5px] leading-relaxed">{detail.overview}</p>
                    <p className="mt-2 text-[11.5px] text-muted-foreground">
                      {detail.orientation === 'vertical' ? '縦型' : '横型'} ・
                      {' '}{secText(detail.durationSec)} ・ ショット{detail.shots.length}件
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-4">
                    <p className="mb-2 text-[13px] font-bold">構成</p>
                    <ol className="space-y-1.5">
                      {detail.timeline.map((b) => (
                        <li key={b.id} className="flex gap-3 text-[12.5px]">
                          <span className="w-24 shrink-0 tabular-nums text-muted-foreground">
                            {secText(b.startSec)}–{secText(b.endSec)}
                          </span>
                          <span className="font-semibold">{b.label}</span>
                          <span className="min-w-0 text-muted-foreground">{b.summary}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h2 className="text-[14px] font-bold">ショットリスト</h2>
                      <div className="ml-auto flex gap-2">
                        <button type="button"
                          onClick={() => downloadTextFile(`${detail.conceptTitle}-shots.csv`, shotsToCsv(detail.shots), 'text/csv')}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[11.5px] font-semibold">
                          <Download className="h-3.5 w-3.5" />CSV
                        </button>
                        <button type="button"
                          onClick={() => downloadTextFile(
                            `${detail.conceptTitle}.md`,
                            resultToMarkdown(input, { ...result, detail }, {
                              songTitle: input.title,
                              createdAt: new Date().toISOString(),
                              providerName: 'Studio（端末内）',
                            }),
                            'text/markdown',
                          )}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[11.5px] font-semibold">
                          <Download className="h-3.5 w-3.5" />Markdown
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {detail.shots.map((s) => (
                        <div key={s.id} className="rounded-xl border border-border bg-card p-3.5">
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="grid h-5 w-5 place-items-center rounded bg-muted font-bold tabular-nums text-foreground">
                              {s.no}
                            </span>
                            {s.block && <span className="font-semibold">{s.block}</span>}
                            <span className="tabular-nums">{secText(s.startSec)}–{secText(s.endSec)}（{shotSeconds(s)}秒）</span>
                          </div>
                          <p className="mt-1.5 text-[13px] font-semibold leading-snug">{s.scene}</p>
                          <p className="mt-1 text-[11.5px] text-muted-foreground">
                            {s.composition} / {s.cameraMove} / {s.subjectMove}
                          </p>
                          <div className="mt-2 space-y-1.5">
                            {[
                              { label: '画像生成', text: s.imagePrompt },
                              { label: '動画生成', text: s.videoPrompt },
                            ].map((p) => (
                              <div key={p.label} className="flex items-start gap-2">
                                <span className="mt-1 w-[52px] shrink-0 text-[10.5px] font-bold text-muted-foreground">
                                  {p.label}
                                </span>
                                <code className="min-w-0 flex-1 break-all rounded bg-muted px-2 py-1.5 font-mono text-[11.5px]">
                                  {p.text}
                                </code>
                                <button type="button" onClick={() => navigator.clipboard?.writeText(p.text)}
                                  aria-label={`${p.label}プロンプトをコピー`}
                                  className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent">
                                  <Copy className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                          {s.editMemo && (
                            <p className="mt-2 text-[11.5px] text-muted-foreground">編集メモ: {s.editMemo}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {detail.checklist.length > 0 && (
                    <div className="rounded-xl border border-border bg-card p-4">
                      <p className="text-[13px] font-bold">制作チェックリスト</p>
                      <ul className="mt-1.5 space-y-1 text-[12.5px] leading-relaxed text-muted-foreground">
                        {detail.checklist.map((c) => <li key={c}>・{c}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
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
