import { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'

import { readSongs, writeSongs, type Song } from '@/core/storage/songs'
import { readFavorites, readRecent } from '@/core/storage/activity'

/**
 * データ管理。
 *
 * ■ 第三原則: いつでも持ち出せる
 * 書き出しは**無料のまま**維持する。データを人質にする設計にはしない。
 */
export function DataPage() {
  const [message, setMessage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const exportAll = () => {
    const payload = {
      app: 'ai-music-club-studio',
      version: 2,
      exportedAt: new Date().toISOString(),
      songs: readSongs(),
      favorites: readFavorites(),
      recent: readRecent(),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `studio-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMessage('書き出しました。')
  }

  const importFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as { songs?: Song[] }
        if (!Array.isArray(data.songs)) throw new Error('曲データが見つかりません')

        // 同じIDは上書きし、無いものは足す（読み込みで既存を消さない）
        const current = readSongs()
        const map = new Map(current.map((s) => [s.id, s]))
        for (const s of data.songs) {
          if (s && typeof s.id === 'string') map.set(s.id, s)
        }
        writeSongs([...map.values()])
        setMessage(`${data.songs.length}曲を読み込みました。`)
      } catch (e) {
        setMessage(`読み込めませんでした（${(e as Error).message}）`)
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-bold">データ管理</h1>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
        制作データは端末内にのみ保存されています。
        いつでも書き出せて、いつでも戻せます。書き出しは無料のままです。
      </p>

      <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
        <button
          type="button"
          onClick={exportAll}
          className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted">
            <Download className="h-[18px] w-[18px]" />
          </span>
          <span>
            <span className="block text-[14px] font-bold">すべて書き出す</span>
            <span className="mt-0.5 block text-[12px] leading-relaxed text-muted-foreground">
              曲・お気に入り・履歴をJSONで保存します
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted">
            <Upload className="h-[18px] w-[18px]" />
          </span>
          <span>
            <span className="block text-[14px] font-bold">読み込む</span>
            <span className="mt-0.5 block text-[12px] leading-relaxed text-muted-foreground">
              書き出したJSONから戻します。いまのデータは消えません
            </span>
          </span>
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) importFile(f)
          e.target.value = ''
        }}
      />

      {message && (
        <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-[12.5px]">{message}</p>
      )}

      <div className="mt-6 rounded-xl border border-border bg-card p-4">
        <p className="text-[13px] font-bold">いま端末に入っているもの</p>
        <dl className="mt-2 space-y-1 text-[12.5px]">
          <div className="flex gap-3">
            <dt className="w-28 text-muted-foreground">曲</dt>
            <dd className="font-semibold">{readSongs().length}件</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-28 text-muted-foreground">お気に入り</dt>
            <dd className="font-semibold">{readFavorites().length}件</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
