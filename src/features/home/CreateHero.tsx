import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Clapperboard, Flame, Music4, PenLine, Sparkles } from 'lucide-react'

import { recordActivity } from '@/core/storage/activity'
import { recordVisit } from '@/core/storage/streak'
import { cn } from '@/core/ui/cn'

/**
 * 制作への入口。ホーム画面でいちばん大きく、いちばん上に置く。
 *
 * Studio は「読む場所」ではなく「作る場所」なので、
 * 開いた瞬間に目に入るのはニュースではなくこの4つにする。
 */
/** いちばん使う導線。ここだけ大きく、色も強くする。 */
const PRIMARY = {
  id: 'song',
  label: '曲を作る',
  hint: '新しい曲をはじめる',
  to: '/songs',
  icon: Music4,
} as const

/** 主役の次に使うもの。同じ大きさで横に並べる。 */
const SECONDARY = [
  {
    id: 'lyrics',
    label: '歌詞を書く',
    hint: '字余り・韻',
    to: '/tools',
    icon: PenLine,
    // 色は用途ごとに固定して、毎日見ても迷わないようにする
    tint: 'text-primary border-primary/20 bg-primary/[0.07]',
  },
  {
    id: 'mv',
    label: 'MVを作る',
    hint: '絵コンテ',
    to: '/storyboard',
    icon: Clapperboard,
    tint: 'text-mv border-mv/20 bg-mv/[0.07]',
  },
  {
    id: 'prompt',
    label: 'プロンプト',
    hint: 'スタイル作り',
    to: '/prompts',
    icon: Sparkles,
    tint: 'text-premium border-premium/20 bg-premium/[0.07]',
  },
] as const

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'こんばんは、カラスイさん'
  if (h < 11) return 'おはようございます、カラスイさん'
  if (h < 18) return 'おかえりなさい、カラスイさん'
  return 'こんばんは、カラスイさん'
}

export function CreateHero() {
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    setStreak(recordVisit().streak)
  }, [])

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <p className="text-[13px] text-muted-foreground">{greeting()}</p>
          <h1 className="mt-1 text-[26px] font-extrabold leading-tight tracking-tight sm:text-[30px]">
            今日は何を作りますか？
          </h1>
        </div>

        {streak > 0 && (
          <p className="flex items-center gap-1.5 pb-1 text-[12px] font-semibold text-muted-foreground">
            <Flame className="h-4 w-4 text-premium" />
            {streak}日連続で開いています
          </p>
        )}
      </div>

      {/*
        「曲を作る」がいちばん使われる想定なので、大きさ・色の強さ・位置で
        はっきり格を分ける。残り3つは同格として横に並べる。
      */}
      <div className="mt-4 grid gap-2.5 lg:grid-cols-2">
        <Link
          to={PRIMARY.to}
          onClick={() =>
            recordActivity({ id: PRIMARY.id, kind: 'tool', label: PRIMARY.label, to: PRIMARY.to, url: null })
          }
          className={cn(
            'group flex min-h-[132px] flex-col justify-between gap-6 rounded-2xl p-5 lg:min-h-[168px] lg:p-6',
            'bg-gradient-to-br from-primary to-suno text-primary-foreground',
            'shadow-lg shadow-primary/20 transition-transform active:scale-[0.99]',
          )}
        >
          <PRIMARY.icon className="h-7 w-7 lg:h-8 lg:w-8" />
          <span>
            <span className="block text-[19px] font-extrabold tracking-tight lg:text-[22px]">
              {PRIMARY.label}
            </span>
            <span className="mt-0.5 block text-[12px] opacity-80">{PRIMARY.hint}</span>
          </span>
        </Link>

        <div className="grid grid-cols-3 gap-2.5">
          {SECONDARY.map((a) => (
            <Link
              key={a.id}
              to={a.to}
              onClick={() =>
                recordActivity({ id: a.id, kind: 'tool', label: a.label, to: a.to, url: null })
              }
              className={cn(
                'flex flex-col justify-between gap-4 rounded-2xl border p-3.5 transition-transform active:scale-[0.98] lg:p-4',
                a.tint,
              )}
            >
              <a.icon className="h-5 w-5" />
              <span>
                <span className="block text-[13px] font-bold leading-tight text-foreground">
                  {a.label}
                </span>
                <span className="mt-0.5 block text-[10.5px] text-muted-foreground">{a.hint}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
