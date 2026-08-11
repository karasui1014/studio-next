import { useEffect, useMemo, useRef, useState } from 'react'
import { ImageUp, ShieldCheck, Sparkles, Trash2 } from 'lucide-react'

import { getProgress } from '@/core/secretary/leveling'
import { buildSecretaryMessage } from '@/core/secretary/message'
import { useSecretaryStore } from '@/core/secretary/store'
import {
  CHEER_STYLE_LABEL,
  SPEAKING_STYLE_LABEL,
  type CheerStyle,
  type SpeakingStyle,
} from '@/core/secretary/types'
import { useSongs } from '@/core/storage/songs'
import { currentStreak } from '@/core/storage/streak'

import { SecretaryAvatar } from './SecretaryAvatar'

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const MAX_SIZE_MB = 8

const inputClass =
  'w-full rounded-lg border border-border bg-card px-3 py-2 text-[14px] outline-none ' +
  'focus:border-primary focus:ring-2 focus:ring-primary/20'

function Field({
  label, hint, htmlFor, children,
}: { label: string; hint?: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-[12.5px] font-semibold">
        {label}
        {hint && <span className="ml-1.5 font-normal text-[11px] text-muted-foreground">{hint}</span>}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  )
}

/**
 * AI秘書の設定画面。V1の `SecretaryPage` から移植。
 *
 * ■ 何を作っている画面か
 * 「AIに指示を出す画面」ではなく、**相棒の人物像を決める画面**。
 * 名前・見た目・話し方を自分で決めたものだから、毎日会っても嫌にならない。
 * 変更はその場で保存され、上のプレビューにすぐ反映される。
 */
export function SecretaryPage() {
  const settings = useSecretaryStore((s) => s.settings)
  const updateSettings = useSecretaryStore((s) => s.updateSettings)
  const setAvatar = useSecretaryStore((s) => s.setAvatar)
  const removeAvatar = useSecretaryStore((s) => s.removeAvatar)
  const avatarUrl = useSecretaryStore((s) => s.avatarUrl)
  const celebratedMilestones = useSecretaryStore((s) => s.celebratedMilestones)
  const hydrate = useSecretaryStore((s) => s.hydrate)

  const { songs } = useSongs()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    void hydrate()
    setStreak(currentStreak())
  }, [hydrate])

  const progress = useMemo(() => getProgress(songs), [songs])
  const preview = useMemo(
    () => buildSecretaryMessage({ songs, settings, streak, celebratedMilestones }),
    [songs, settings, streak, celebratedMilestones],
  )

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setNotice({ kind: 'error', text: 'PNG / JPG / WebP / GIF の画像を選んでください' })
      return
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setNotice({ kind: 'error', text: `画像は${MAX_SIZE_MB}MB以下にしてください` })
      return
    }
    try {
      await setAvatar(file)
      setNotice({ kind: 'ok', text: '秘書の画像を設定しました' })
    } catch {
      setNotice({ kind: 'error', text: '画像の保存に失敗しました' })
    }
  }

  return (
    <div className="animate-fade-in max-w-3xl">
      <h1 className="text-xl font-bold">AI秘書</h1>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
        あなた専属の秘書をカスタマイズできます。
        話す内容は端末内のルールだけで組み立てていて、AIには問い合わせていません。
      </p>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 px-4 py-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          画像や設定はすべて<strong className="font-semibold text-foreground">この端末の中だけ</strong>
          に保存されます。外部サーバーには一切送信されません。
        </p>
      </div>

      {/* プレビュー：設定を変えると即座にここへ反映される */}
      <div className="mt-5 flex items-start gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <SecretaryAvatar className="h-14 w-14 shrink-0" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13.5px] font-bold">{settings.name || 'アシスタント'}</p>
            <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-px text-[10.5px] font-bold text-primary">
              <Sparkles className="h-3 w-3" />
              Lv.{progress.level} {progress.title}
            </span>
          </div>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
            {preview.text}
          </p>
        </div>
      </div>

      {/* 見た目 */}
      <section className="mt-8">
        <h2 className="text-[13px] font-bold">見た目</h2>
        <div className="mt-3 flex items-center gap-4">
          <SecretaryAvatar className="h-20 w-20 shrink-0" />
          <div className="flex flex-col items-start gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              className="hidden"
              onChange={(e) => {
                void handleFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 text-[12.5px] font-semibold transition-colors hover:border-primary/40"
            >
              <ImageUp className="h-4 w-4" />
              画像をアップロード
            </button>
            {avatarUrl && (
              <button
                type="button"
                onClick={() => void removeAvatar()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-semibold text-destructive transition-colors hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
                画像を削除
              </button>
            )}
            <p className="text-[11px] text-muted-foreground">
              PNG / JPG / WebP / GIF（最大{MAX_SIZE_MB}MB）
            </p>
          </div>
        </div>

        {notice && (
          <p
            className={
              notice.kind === 'ok'
                ? 'mt-3 rounded-lg bg-muted px-3 py-2 text-[12.5px]'
                : 'mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive'
            }
          >
            {notice.text}
          </p>
        )}
      </section>

      {/* プロフィール */}
      <section className="mt-8">
        <h2 className="text-[13px] font-bold">プロフィール</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="名前" htmlFor="sec-name">
            <input
              id="sec-name"
              value={settings.name}
              onChange={(e) => updateSettings({ name: e.target.value })}
              placeholder="例: チロル"
              className={inputClass}
            />
          </Field>

          <Field label="一人称" htmlFor="sec-first-person">
            <input
              id="sec-first-person"
              value={settings.firstPerson}
              onChange={(e) => updateSettings({ firstPerson: e.target.value })}
              placeholder="例: 私、ボク、わたし"
              className={inputClass}
            />
          </Field>

          <Field label="話し方" htmlFor="sec-speaking">
            <select
              id="sec-speaking"
              value={settings.speakingStyle}
              onChange={(e) => updateSettings({ speakingStyle: e.target.value as SpeakingStyle })}
              className={inputClass}
            >
              {(Object.keys(SPEAKING_STYLE_LABEL) as SpeakingStyle[]).map((key) => (
                <option key={key} value={key}>{SPEAKING_STYLE_LABEL[key]}</option>
              ))}
            </select>
          </Field>

          <Field label="応援スタイル" htmlFor="sec-cheer">
            <select
              id="sec-cheer"
              value={settings.cheerStyle}
              onChange={(e) => updateSettings({ cheerStyle: e.target.value as CheerStyle })}
              className={inputClass}
            >
              {(Object.keys(CHEER_STYLE_LABEL) as CheerStyle[]).map((key) => (
                <option key={key} value={key}>{CHEER_STYLE_LABEL[key]}</option>
              ))}
            </select>
          </Field>

          <div className="sm:col-span-2">
            <Field label="口癖" hint="任意" htmlFor="sec-catchphrase">
              <input
                id="sec-catchphrase"
                value={settings.catchphrase}
                onChange={(e) => updateSettings({ catchphrase: e.target.value })}
                placeholder="例: 今日もマイペースにいきましょう🎵"
                className={inputClass}
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="性格メモ" hint="任意" htmlFor="sec-personality">
              <textarea
                id="sec-personality"
                value={settings.personality}
                onChange={(e) => updateSettings({ personality: e.target.value })}
                placeholder="例: 元気でフレンドリー。落ち込んでいる時はそっと寄り添ってくれる。"
                className={`${inputClass} min-h-[80px] resize-y`}
              />
            </Field>
            <p className="mt-1 text-[11px] text-muted-foreground">
              あなたの中のキャラクター設定として自由に書いておけます。
            </p>
          </div>
        </div>
      </section>

      {/* いまの記録 */}
      <section className="mt-8">
        <h2 className="text-[13px] font-bold">いまの記録</h2>
        <dl className="mt-3 grid gap-2.5 sm:grid-cols-3">
          {[
            { label: 'レベル', value: `Lv.${progress.level}`, note: progress.title },
            {
              label: '完成した曲',
              value: `${progress.completedCount}曲`,
              note: progress.isMaxLevel ? '最高レベルです' : `次のレベルまであと${progress.songsToNextLevel}曲`,
            },
            { label: '連続で開いた日数', value: `${streak}日`, note: `登録している曲は${songs.length}曲` },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4">
              <dt className="text-[11.5px] text-muted-foreground">{s.label}</dt>
              <dd className="mt-0.5 text-[19px] font-extrabold tracking-tight">{s.value}</dd>
              <dd className="mt-0.5 text-[11px] text-muted-foreground">{s.note}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          レベルは「公開済み」にした曲の数だけで上がります。作りかけの曲は数えません。
        </p>
      </section>
    </div>
  )
}
