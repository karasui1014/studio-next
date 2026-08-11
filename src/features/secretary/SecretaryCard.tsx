import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Settings2, Sparkles } from 'lucide-react'

import { useRole } from '@/core/entitlement/role'
import { getProgress } from '@/core/secretary/leveling'
import { buildSecretaryMessage } from '@/core/secretary/message'
import { useSecretaryStore } from '@/core/secretary/store'
import { suggestTheme } from '@/core/secretary/themes'
import { useSongs, type Song } from '@/core/storage/songs'
import { currentStreak } from '@/core/storage/streak'

import { SecretaryAvatar } from './SecretaryAvatar'

/** 次の曲のテーマ提案。気に入らなければ何度でも引き直せる。 */
function ThemeSuggestionBox({ songs }: { songs: Song[] }) {
  const [suggestion, setSuggestion] = useState(() => suggestTheme(songs))
  const [exclude, setExclude] = useState<string[]>([])

  const regenerate = () => {
    const nextExclude = [...exclude, suggestion.key].slice(-8)
    setExclude(nextExclude)
    setSuggestion(suggestTheme(songs, nextExclude))
  }

  return (
    <div className="mt-3 rounded-xl bg-muted/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11.5px] font-semibold text-muted-foreground">次の曲のテーマ提案</p>
        <button
          type="button"
          onClick={regenerate}
          className="shrink-0 text-[11.5px] font-semibold text-primary hover:underline"
        >
          他には？
        </button>
      </div>
      <p className="mt-1 text-[13px] leading-relaxed">{suggestion.text}</p>
    </div>
  )
}

/**
 * ホームに出る秘書のひとこと。V1の `SecretaryCard` から移植。
 *
 * ■ 有料プランの人にだけ出す
 * 秘書の話す内容は曲データが元になっていて、曲の管理は Premium 以上の機能。
 * 無料の人に出しても「今日は何から作りますか？」しか言えず、
 * 押した先はロック画面——という行き止まりになるので、最初から出さない。
 */
export function SecretaryCard() {
  const { paid } = useRole()
  const { songs } = useSongs()
  const settings = useSecretaryStore((s) => s.settings)
  const celebratedMilestones = useSecretaryStore((s) => s.celebratedMilestones)
  const markMilestoneCelebrated = useSecretaryStore((s) => s.markMilestoneCelebrated)
  const hydrated = useSecretaryStore((s) => s.hydrated)
  const hydrate = useSecretaryStore((s) => s.hydrate)

  const [streak, setStreak] = useState(0)

  useEffect(() => {
    void hydrate()
    setStreak(currentStreak())
  }, [hydrate])

  const progress = useMemo(() => getProgress(songs), [songs])
  const message = useMemo(
    () => buildSecretaryMessage({ songs, settings, streak, celebratedMilestones }),
    [songs, settings, streak, celebratedMilestones],
  )

  // 節目を祝ったら「祝った」と記録して、翌日から同じ報告をしないようにする
  useEffect(() => {
    if (message.milestone) markMilestoneCelebrated(message.milestone)
  }, [message.milestone, markMilestoneCelebrated])

  if (!paid || !hydrated) return null

  return (
    <section className="mt-8">
      <div className="flex items-start gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <SecretaryAvatar className="h-14 w-14 shrink-0" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[13.5px] font-bold">{settings.name}</p>
              <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-px text-[10.5px] font-bold text-primary">
                <Sparkles className="h-3 w-3" />
                Lv.{progress.level} {progress.title}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {streak >= 2 && (
                <span className="text-[11px] text-muted-foreground">{streak}日連続</span>
              )}
              <Link
                to="/secretary"
                aria-label="AI秘書の設定"
                className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Settings2 className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <p className="mt-1.5 text-[13.5px] leading-relaxed">{message.text}</p>

          {!progress.isMaxLevel && (
            <p className="mt-1 text-[11.5px] text-muted-foreground">
              次のレベルまであと{progress.songsToNextLevel}曲
            </p>
          )}

          {progress.completedCount > 0 && <ThemeSuggestionBox songs={songs} />}
        </div>
      </div>
    </section>
  )
}
