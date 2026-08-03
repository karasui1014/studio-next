import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Music4, Plus } from 'lucide-react'

import { recordActivity } from '@/core/storage/activity'
import { createSong, nextStepFor, saveSong, SONG_STATUS, useSongs } from '@/core/storage/songs'
import { cn } from '@/core/ui/cn'
import { inputClass } from '../tools/ui'

const STATUS_STYLE: Record<string, string> = {
  idea: 'bg-muted text-muted-foreground',
  lyrics: 'bg-primary/15 text-primary',
  suno: 'bg-suno/15 text-suno',
  mv: 'bg-mv/15 text-mv',
  published: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
}

function statusLabel(id: string) {
  return SONG_STATUS.find((s) => s.id === id)?.label ?? id
}

function updatedText(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const day = Math.floor((Date.now() - t) / 86400000)
  if (day === 0) return '今日'
  if (day === 1) return '昨日'
  if (day < 7) return `${day}日前`
  const d = new Date(t)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

/** 曲一覧。制作中のものが上に来る（更新が新しい順）。 */
export function SongsPage() {
  const { songs } = useSongs()
  const [title, setTitle] = useState('')
  const navigate = useNavigate()

  const add = () => {
    const song = saveSong(createSong(title))
    setTitle('')
    recordActivity({
      id: song.id, kind: 'song', label: song.title, to: `/songs/${song.id}`, url: null,
    })
    navigate(`/songs/${song.id}`)
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-bold">曲一覧</h1>
      <p className="mt-1 text-[12.5px] text-muted-foreground">
        制作データは端末内にのみ保存されます。いつでも書き出せます。
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          className={cn(inputClass, 'max-w-md flex-1')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add() }}
          placeholder="曲名を入れて追加（あとから変えられます）"
        />
        <button
          type="button"
          onClick={add}
          className="inline-flex h-[42px] shrink-0 items-center gap-2 rounded-lg bg-primary px-4 text-[13.5px] font-bold text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          曲を追加
        </button>
      </div>

      {songs.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border px-5 py-16 text-center">
          <Music4 className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">まだ曲がありません</p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            1曲つくると、ホームに「続きから」が出るようになります。
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {songs.map((s) => (
            <Link
              key={s.id}
              to={`/songs/${s.id}`}
              onClick={() =>
                recordActivity({ id: s.id, kind: 'song', label: s.title, to: `/songs/${s.id}`, url: null })
              }
              className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <div className="flex items-center gap-2">
                <span className={cn('rounded px-1.5 py-px text-[10.5px] font-bold', STATUS_STYLE[s.status])}>
                  {statusLabel(s.status)}
                </span>
                <span className="ml-auto text-[11px] text-muted-foreground">{updatedText(s.updatedAt)}</span>
              </div>
              <p className="mt-2 line-clamp-2 text-[14.5px] font-bold leading-snug">{s.title}</p>
              <p className="mt-1 text-[11.5px] text-muted-foreground">{nextStepFor(s)}</p>
              {(s.genre || s.mood) && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {[s.genre, s.mood].filter(Boolean).join(' / ')}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
