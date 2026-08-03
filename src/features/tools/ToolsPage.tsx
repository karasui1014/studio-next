import { Link } from 'react-router-dom'
import { Construction } from 'lucide-react'

import { recordActivity } from '@/core/storage/activity'
import { cn } from '@/core/ui/cn'

interface ToolEntry {
  id: string
  emoji: string
  name: string
  desc: string
  to: string | null
  /** まだ移植していないもの */
  phase?: string
}

/** 制作ツールの一覧。V1からの移植が進むたびに to を埋めていく。 */
const TOOLS: ToolEntry[] = [
  {
    id: 'lyrics-review', emoji: '✍️', name: '歌詞レビュー',
    desc: '字余り・韻・構成をチェックして、行ごとに直し方を出します', to: '/tools/lyrics-review',
  },
  {
    id: 'mv-idea', emoji: '🎬', name: 'MVアイデア',
    desc: '企画案を3つ出し、ショットリストと生成プロンプトまで展開します', to: '/tools/mv-idea',
  },
  {
    id: 'ai-producer', emoji: '🎛', name: 'AIプロデューサー',
    desc: '曲の狙いと素材から、直す順番を出します', to: '/tools/ai-producer',
  },
  {
    id: 'prompt-dex', emoji: '📚', name: 'プロンプト工房',
    desc: '使えるプロンプトを探して、コピーして、★で貯めておけます', to: '/prompts',
  },
]

export function ToolsPage() {
  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-bold">制作ツール</h1>
      <p className="mt-1 text-[12.5px] text-muted-foreground">
        すべて端末内で動きます。入力した内容が外部に送られることはありません。
      </p>

      <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
        {TOOLS.map((t) => {
          const body = (
            <>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-muted text-xl">
                {t.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-[14px] font-bold">{t.name}</span>
                  {t.phase && (
                    <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-px text-[10px] font-bold text-muted-foreground">
                      <Construction className="h-3 w-3" />
                      {t.phase}
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-[12px] leading-relaxed text-muted-foreground">
                  {t.desc}
                </span>
              </span>
            </>
          )

          const className = cn(
            'flex items-start gap-3.5 rounded-xl border border-border bg-card p-4 transition-colors',
            t.to ? 'hover:border-primary/40' : 'opacity-60',
          )

          return t.to ? (
            <Link
              key={t.id}
              to={t.to}
              onClick={() =>
                recordActivity({ id: t.id, kind: 'tool', label: t.name, to: t.to, url: null })
              }
              className={className}
            >
              {body}
            </Link>
          ) : (
            <div key={t.id} className={className}>{body}</div>
          )
        })}
      </div>
    </div>
  )
}
