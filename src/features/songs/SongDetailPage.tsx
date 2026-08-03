import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Trash2 } from 'lucide-react'

import { recordActivity } from '@/core/storage/activity'
import {
  deleteSong, readSongs, saveSong, SONG_STATUS, type Song, type SongStatus,
} from '@/core/storage/songs'
import { cn } from '@/core/ui/cn'
import { Field, inputClass } from '../tools/ui'

/** 曲から使える制作ツールへの近道 */
const TOOL_LINKS = [
  { to: '/tools/lyrics-review', label: '歌詞をレビューする' },
  { to: '/tools/mv-idea', label: 'MVアイデアを出す' },
  { to: '/tools/ai-producer', label: '方向性を分析する' },
  { to: '/prompts', label: 'プロンプトを探す' },
]

/**
 * 曲の詳細。
 * 入力するそばから端末内に保存する（保存ボタンを押し忘れて消える事故をなくす）。
 */
export function SongDetailPage() {
  const { songId } = useParams<{ songId: string }>()
  const navigate = useNavigate()
  const [song, setSong] = useState<Song | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const found = readSongs().find((s) => s.id === songId) ?? null
    setSong(found)
    if (found) {
      recordActivity({
        id: found.id, kind: 'song', label: found.title, to: `/songs/${found.id}`, url: null,
      })
    }
  }, [songId])

  // 入力が止まってから保存する
  useEffect(() => {
    if (!song) return
    const timer = setTimeout(() => {
      saveSong(song)
      setSaved(true)
      setTimeout(() => setSaved(false), 1400)
    }, 600)
    return () => clearTimeout(timer)
  }, [song])

  const set = <K extends keyof Song>(key: K, value: Song[K]) =>
    setSong((prev) => (prev ? { ...prev, [key]: value } : prev))

  const remove = () => {
    if (!song) return
    if (!window.confirm(`「${song.title}」を削除します。取り消せません。よろしいですか？`)) return
    deleteSong(song.id)
    navigate('/songs')
  }

  const charCount = useMemo(() => song?.lyrics.replace(/\s/g, '').length ?? 0, [song])

  if (!song) {
    return (
      <div className="animate-fade-in">
        <p className="text-sm font-semibold">この曲は見つかりませんでした</p>
        <Link to="/songs" className="mt-2 inline-block text-[12.5px] font-semibold text-primary">
          曲一覧へ戻る
        </Link>
      </div>
    )
  }

  return (
    <div className="animate-fade-in pb-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/songs" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />
          曲一覧
        </Link>
        {saved && (
          <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-emerald-600 dark:text-emerald-400">
            <Check className="h-3.5 w-3.5" />
            保存しました
          </span>
        )}
        <button
          type="button"
          onClick={remove}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground hover:border-destructive/50 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
          削除
        </button>
      </div>

      <input
        value={song.title}
        onChange={(e) => set('title', e.target.value)}
        className="mt-3 w-full border-0 bg-transparent p-0 text-2xl font-extrabold outline-none"
        placeholder="曲名"
      />

      <div className="mt-3 flex flex-wrap gap-1.5">
        {SONG_STATUS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => set('status', s.id as SongStatus)}
            aria-pressed={song.status === s.id}
            className={cn(
              'rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors',
              song.status === s.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="ジャンル">
              <input className={inputClass} value={song.genre} onChange={(e) => set('genre', e.target.value)} />
            </Field>
            <Field label="感情・雰囲気">
              <input className={inputClass} value={song.mood} onChange={(e) => set('mood', e.target.value)} />
            </Field>
          </div>

          <Field label="歌詞" hint={charCount > 0 ? `${charCount}文字` : undefined}>
            <textarea
              className={cn(inputClass, 'resize-y font-mono text-[13px] leading-relaxed')}
              rows={12}
              value={song.lyrics}
              onChange={(e) => set('lyrics', e.target.value)}
              placeholder={'[Verse]\n夜の高速 灯りが流れる'}
            />
          </Field>

          <Field label="楽曲プロンプト">
            <textarea
              className={cn(inputClass, 'resize-y font-mono text-[13px]')}
              rows={3}
              value={song.sunoPrompt}
              onChange={(e) => set('sunoPrompt', e.target.value)}
            />
          </Field>

          <Field label="MVプロンプト・計画">
            <textarea
              className={cn(inputClass, 'resize-y font-mono text-[13px]')}
              rows={3}
              value={song.mvPrompt}
              onChange={(e) => set('mvPrompt', e.target.value)}
            />
          </Field>

          <Field label="メモ">
            <textarea
              className={cn(inputClass, 'resize-y')}
              rows={3}
              value={song.memo}
              onChange={(e) => set('memo', e.target.value)}
            />
          </Field>
        </div>

        <aside className="rounded-xl border border-border bg-card p-4">
          <p className="text-[13px] font-bold">この曲でつかう</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {TOOL_LINKS.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className="rounded-lg border border-border px-3 py-2 text-[12.5px] font-semibold transition-colors hover:border-primary/40"
              >
                {t.label}
              </Link>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            入力は自動で保存されます。データは端末内にのみ残ります。
          </p>
        </aside>
      </div>
    </div>
  )
}
