import { useState } from 'react'
import { Check, MessageCircle, SquarePlay, Users, Zap } from 'lucide-react'

import {
  DISCORD_INVITE_URL, STUDIO_PRICE, useRole, useRoleStore,
  YOUTUBE_JOIN_URL, YOUTUBE_TIERS, type Role,
} from '@/core/entitlement/role'
import { cn } from '@/core/ui/cn'

interface RoleCard {
  id: Role
  kind: string
  kindIcon: typeof Zap | typeof Users | null
  name: string
  purpose: string
  target: string
  features: string[]
  /** Master のように「ここから先は人が関わる」もの */
  humanFeatures?: string[]
  note?: string
  seats?: string
}

/**
 * プラン。
 *
 * ■ 見せ方の原則
 * 権限は Role で管理し、価格は「入手経路」の情報として添えるだけにする。
 * メインの導線は YouTube メンバーシップ。Studio直販は同じRoleになる別ルート。
 */
const CARDS: RoleCard[] = [
  {
    id: 'free',
    kind: 'ツール',
    kindIcon: null,
    name: '無料',
    purpose: 'まず触ってみる',
    target: 'AI音楽をこれから始める人／情報だけ追いたい人',
    features: [
      'AI音楽ニュース（全文・日本語訳つき）',
      'カラスイ Picks（冒頭）',
      'AIツール図鑑',
      '制作ツール（歌詞・MV・プロデューサー）',
      '曲の管理',
      'プロンプト工房（基本セット）',
      'データの書き出し',
    ],
  },
  {
    id: 'premium',
    kind: '制作環境',
    kindIcon: Zap,
    name: 'Studio Premium',
    purpose: '制作環境をアップグレードする',
    target: 'AI音楽制作を日常的に行うクリエイター。ひとりで、速く、たくさん作りたい人',
    features: [
      'Premium限定ツール',
      'プロンプトライブラリ',
      '制作テンプレート',
      'AI音楽ニュース詳細版',
      'カラスイ Picks 全文',
      '制作履歴',
      'お気に入り',
      '新機能先行公開',
    ],
    note: 'Studioは毎月アップデートされます',
  },
  {
    id: 'master',
    kind: '学習環境（伴走）',
    kindIcon: Users,
    name: 'Studio Master',
    purpose: '本気でAI音楽を学び、成長する',
    target: 'AI音楽を仕事や収益化につなげたい人。見てもらいながら伸ばしたい人',
    seats: '少人数制（30名まで）— 添削の質を守るため人数に上限があります',
    features: ['Studio Premium のすべて'],
    humanFeatures: [
      '作品添削',
      'AI音楽レビュー',
      'Discord Master限定コミュニティ',
      'Master限定ライブ',
      '優先サポート',
    ],
  },
]

function tierFor(role: Role) {
  return YOUTUBE_TIERS.find((t) => t.role === role) ?? null
}

/**
 * 権限の受け取り。
 *
 * YouTubeメンバーシップに加入すると、加入プランに応じたキーが配られ、
 * それを貼るだけで Role が付く。Studioで別途アカウントを作る必要はない。
 * 実際の署名検証は決済導入時にこの中だけ差し替える。
 */
function MembershipBox() {
  const setRole = useRoleStore((s) => s.setRole)
  const { role, source, label } = useRole()
  const [key, setKey] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const apply = () => {
    const k = key.trim().toUpperCase()
    if (k.includes('MASTER')) {
      setRole('master', 'youtube')
      setMessage('Studio Master になりました。')
    } else if (k.includes('PREMIUM')) {
      setRole('premium', 'youtube')
      setMessage('Studio Premium になりました。')
    } else {
      setMessage('このキーは確認できませんでした。')
    }
    setKey('')
  }

  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-4">
      <p className="text-[13.5px] font-bold">メンバーシップのキーを入れる</p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
        YouTubeメンバーシップに加入すると、加入プランに応じたキーが届きます。
        ここに貼るだけで権限が付きます。
        <strong className="text-foreground">Studioで別途登録する必要はありません。</strong>
        <br />
        キーは端末内で確認され、外部には送られません。正式なキーの発行はこれからです。
      </p>

      <div className="mt-2.5 flex flex-wrap gap-2">
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="KARASUI-PREMIUM-XXXX-XXXX"
          className="h-10 min-w-[240px] flex-1 rounded-lg border border-border bg-background px-3 font-mono text-[13px] outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={apply}
          className="h-10 shrink-0 rounded-lg bg-primary px-4 text-[13.5px] font-bold text-primary-foreground"
        >
          適用する
        </button>
      </div>

      {message && <p className="mt-2 text-[12.5px] font-semibold">{message}</p>}

      <p className="mt-2 text-[11.5px] text-muted-foreground">
        いまの権限: <span className="font-semibold text-foreground">{label}</span>
        {source === 'youtube' && <span className="ml-1.5">（YouTubeメンバーシップ経由）</span>}
        {source === 'studio' && <span className="ml-1.5">（Studio直販）</span>}
        {role !== 'free' && (
          <button
            type="button"
            onClick={() => { setRole('free'); setMessage('無料プランに戻しました。') }}
            className="ml-2 underline"
          >
            無料に戻す
          </button>
        )}
      </p>
    </div>
  )
}

export function PlansPage() {
  const { role, master } = useRole()

  return (
    <div className="animate-fade-in pb-6">
      <h1 className="text-xl font-bold">プラン</h1>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
        <span className="font-semibold text-premium">Premium は制作環境</span>、
        <span className="font-semibold text-master">Master は人が伴走する学習環境</span>です。
        機能の多い・少ないではなく、目的が違います。
        <br />
        加入は <strong className="text-foreground">Studio</strong> と
        <strong className="text-foreground"> YouTubeメンバーシップ</strong> のどちらからでもできます。
        どちらでも同じ権限になります。
      </p>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {CARDS.map((c) => {
          const current = role === c.id
          const tier = tierFor(c.id)

          return (
            <div
              key={c.id}
              className={cn(
                'flex flex-col rounded-2xl border bg-card p-5',
                c.id === 'premium' && 'border-premium/45 shadow-lg shadow-premium/10',
                c.id === 'master' && 'border-master/40 bg-gradient-to-b from-master/[0.05] to-card',
                c.id === 'free' && 'border-border',
              )}
            >
              <span className={cn(
                'inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold tracking-wide',
                c.id === 'premium' && 'bg-premium/15 text-premium',
                c.id === 'master' && 'bg-master/15 text-master',
                c.id === 'free' && 'bg-muted text-muted-foreground',
              )}>
                {c.kindIcon && <c.kindIcon className="h-3 w-3" />}
                {c.kind}
              </span>

              <p className="mt-2.5 text-[16px] font-extrabold">{c.name}</p>
              <p className={cn(
                'mt-1 text-[12.5px] font-semibold',
                c.id === 'premium' && 'text-premium',
                c.id === 'master' && 'text-master',
              )}>
                {c.purpose}
              </p>

              <p className="mt-3 text-[26px] font-extrabold tabular-nums">
                {c.id === 'free' ? '¥0' : `¥${STUDIO_PRICE[c.id].toLocaleString()}`}
                {c.id !== 'free' && (
                  <span className="text-[12px] font-semibold text-muted-foreground"> / 月</span>
                )}
              </p>

              {/* YouTube経由は別価格。同じ権限だが特典が付くぶん金額が違う。 */}
              {tier && (
                <p className="mt-1 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  <SquarePlay className="mt-0.5 h-3.5 w-3.5 shrink-0 text-youtube" />
                  YouTubeメンバーシップ「{tier.name}」なら ¥{tier.price.toLocaleString()} / 月
                </p>
              )}

              <p className="mt-2 min-h-[40px] text-[11.5px] leading-relaxed text-muted-foreground">
                {c.target}
              </p>

              {c.seats && (
                <p className="mt-2.5 flex items-start gap-2 rounded-lg border border-master/25 bg-master/[0.08] px-3 py-2 text-[11.5px] font-semibold text-master">
                  <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {c.seats}
                </p>
              )}

              <ul className="mt-3.5 flex-1 space-y-1.5">
                {c.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[12.5px] leading-snug">
                    <Check className={cn(
                      'mt-0.5 h-3.5 w-3.5 shrink-0',
                      c.id === 'premium' ? 'text-premium' : c.id === 'master' ? 'text-master' : 'text-primary',
                    )} />
                    {f}
                  </li>
                ))}
              </ul>

              {c.humanFeatures && (
                <>
                  <p className="mt-3.5 flex items-center gap-2 text-[10.5px] font-bold tracking-wide text-muted-foreground">
                    ここからは人が関わります
                    <span className="h-px flex-1 bg-border" />
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {c.humanFeatures.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[12.5px] leading-snug">
                        <span className="mt-0.5 shrink-0 text-master">◆</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {c.note && (
                <p className="mt-3 rounded-lg bg-premium/10 px-3 py-2 text-[11.5px] font-semibold text-premium">
                  ⚡ {c.note}
                </p>
              )}

              {/* 加入はYouTubeメンバーシップから */}
              {current ? (
                <p className="mt-4 grid h-11 place-items-center rounded-lg border border-border text-[13.5px] font-bold text-muted-foreground">
                  いま使っている権限
                </p>
              ) : tier ? (
                <a
                  href={YOUTUBE_JOIN_URL}
                  target="_blank"
                  rel="noopener noreferrer external"
                  referrerPolicy="no-referrer"
                  className={cn(
                    'mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-lg text-[13.5px] font-bold text-white',
                    c.id === 'premium' ? 'bg-premium' : 'bg-master',
                  )}
                >
                  <SquarePlay className="h-4 w-4" />
                  YouTubeで加入する
                </a>
              ) : (
                <p className="mt-4 grid h-11 place-items-center rounded-lg border border-border text-[13.5px] font-bold text-muted-foreground">
                  登録不要で使えます
                </p>
              )}

              {/* Discordは Master のときだけ案内する */}
              {c.id === 'master' && master && (
                <a
                  href={DISCORD_INVITE_URL}
                  target="_blank"
                  rel="noopener noreferrer external"
                  referrerPolicy="no-referrer"
                  className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-master/40 bg-master/10 text-[13.5px] font-bold text-master"
                >
                  <MessageCircle className="h-4 w-4" />
                  Discordコミュニティへ参加
                </a>
              )}
            </div>
          )
        })}
      </div>

      <MembershipBox />

      <div className="mt-6 rounded-xl border border-dashed border-border bg-muted/50 p-4">
        <p className="text-[13.5px] font-bold">権限のしくみ</p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
          Studioの権限は<strong className="text-foreground">価格ではなくRole（free / premium / master）</strong>で管理しています。
          YouTubeメンバーシップ経由でも、将来のStudio直販でも、最終的に同じ権限になります。
          <br />
          <span className="font-semibold text-premium">Premium は「制作環境」</span>。
          毎週コンテンツを配るのではなく、Studio自体が毎月良くなっていくことが価値です。
          <br />
          <span className="font-semibold text-master">Master は「人の伴走」</span>。
          添削・レビューはカラスイさんの時間そのものなので、人数に上限があります。
        </p>
      </div>
    </div>
  )
}
