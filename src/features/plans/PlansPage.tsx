import { useState } from 'react'
import { Check, Film, MessageCircle, SquarePlay, Users, Zap } from 'lucide-react'

import { apiConfigured, usePremiumStore } from '@/core/entitlement/api'
import {
  OFFICIAL_LINE_URL, ROLE_LABEL, ROLE_RANK, useRole, useRoleStore,
  YOUTUBE_JOIN_URL, youtubeTierFor, type Role,
} from '@/core/entitlement/role'
import { cn } from '@/core/ui/cn'

interface RoleCard {
  id: Role
  kind: string
  kindIcon: typeof Zap | typeof Film | typeof Users | null
  name: string
  purpose: string
  target: string
  /** Studio内部の機能。アプリ内で完結し、権限が付いた瞬間から使える */
  features: string[]
  /**
   * Studioの外にある特典（外部サイト・人的サポート）。
   * URLや招待リンクはここに書かない——公開コードに置かないという方針のため。
   * 実際の受け渡しは公式LINEなど既存の案内経路で行う。
   */
  externalFeatures?: string[]
  /**
   * externalFeatures の上に置く見出し＋説明文。
   * 省略時は「Studioの外で提供するもの」という素っ気ない見出しだけになる（Premium）。
   * Creator だけ、「アップグレードすると何ができるようになるか」が伝わる
   * コピーに差し替えている（2026-08-19）。
   */
  externalFeaturesIntro?: { tagline: string; description: string }
  /** externalFeatures の各項目に添える一言説明（キー = 項目名の文字列） */
  externalFeatureNotes?: Record<string, string>
  /** Master のように「ここから先は人が関わる」もの */
  humanFeatures?: string[]
  note?: string
  seats?: string
}

/**
 * プラン。
 *
 * ■ 見せ方の原則
 * 権限は Role で管理する。加入経路はYouTubeメンバーシップのみ
 * （Studio直販は行わない・2026-08-12決定）。価格はYOUTUBE_TIERSの1本のみ。
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
    // ここに書いてよいのは「今日キーを受け取った人が実際に使えるもの」だけ。
    // 以前は「Premium限定ツール」「制作テンプレート」など実体のない項目が並んでいた。
    // 実装のない特典を書くのは、表示と実態の食い違いであり、課金前に必ず正す。
    features: [
      '歌詞レビュー',
      'MVアイデア（ストーリーボード）',
      'AIプロデューサー',
      'プロンプト工房',
      '曲の管理・制作履歴・お気に入り',
    ],
    // 絵コンテツール等はStudio内の「ストーリーボード」とは別の独立サイト。
    // Studioへ移植はせず、「制作ツール」画面のボタンから直接開ける外部提供にする
    // （2026-08-09決定・2026-08-10に3種へ拡張）。URLはここに書かない。
    externalFeatures: ['絵コンテツール', 'ギターコードTAB', 'マスタリング自動生成ツール'],
  },
  {
    id: 'creator',
    kind: 'クリエイター向け制作環境',
    kindIcon: Film,
    name: 'Studio Creator',
    purpose: 'AIで作れる範囲を映像まで広げる',
    // Premium・Masterと同じく「どんな人のためのプランか」を1〜2文で。
    // 断定の強い書き方（〜で止まっていた人へ／一人で仕上げられます）は避ける
    target:
      'AI音楽を作るだけでなく、MV・ショート動画などの映像制作まで自分で進めたいクリエイター向け。',
    features: ['Studio Premium のすべて'],
    // Seedance関連の2ツールをMaster限定からCreator以上に変更（2026-08-18決定）。
    // Masterの差別化はDiscordコミュニティに一本化する。
    //
    // 「Premiumにツールが2つ増えたプラン」ではなく「制作領域が映像まで広がるプラン」として
    // 読ませるため、見出し・説明・各ツールの一言説明をCreatorだけ持たせている（2026-08-19）。
    // ツール名は正式表記のまま。省略も日本語化もしない。
    externalFeaturesIntro: {
      tagline: '「音楽から映像制作まで、AIでつくる」',
      description: '作った楽曲をMVやショート動画へ。AIを使った映像制作まで、自分で進められます。',
    },
    externalFeatures: ['Seedance Batch Studio', 'シーダンス2.5 プロンプト工房'],
    externalFeatureNotes: {
      'Seedance Batch Studio': '複数の動画生成をまとめて進められる制作ツール',
      'シーダンス2.5 プロンプト工房': 'イメージから映像生成用プロンプトを作成',
    },
  },
  {
    id: 'master',
    kind: '学習環境（伴走）',
    kindIcon: Users,
    name: 'Studio Master',
    purpose: '本気でAI音楽を学び、成長する',
    target: 'AI音楽をもっと深く学びたい人。作品を見てもらいながら、制作力を伸ばしたい人。',
    seats: '少人数制（30名まで）— 添削の質を守るため人数に上限があります',
    features: ['Studio Creator のすべて'],
    // Master の特典はすべて Discord の中で提供する。
    // Studio 側に機能として実装されているものはない（＝ここは運用の約束）。
    // Discordの招待URLは公式LINEから手動でお送りするため、この画面には出さない。
    humanFeatures: [
      'Master限定 Discordコミュニティ',
      '作品添削（Discord内）',
      'AI音楽レビュー（Discord内）',
      'Master限定ライブ（Discord内）',
      '優先サポート（Discord内）',
    ],
  },
]

/**
 * プランごとの配色。Premium=琥珀（道具）／Creator=翠（映像）／Master=紅（人）
 *
 * ⚠️ クラス名は必ずリテラルで書くこと。`bg-${x}` のように組み立てると
 * Tailwindがソースを読んでも見つけられず、CSSごと生成されない。
 */
const TONE: Record<Role, {
  text: string
  bg: string
  chip: string
  border: string
  /** 淡い下地（アップグレード案内の背景） */
  tint: string
}> = {
  free: { text: 'text-muted-foreground', bg: 'bg-muted', chip: 'bg-muted text-muted-foreground', border: 'border-border', tint: 'bg-muted/50' },
  premium: { text: 'text-premium', bg: 'bg-premium', chip: 'bg-premium/15 text-premium', border: 'border-premium/45', tint: 'bg-premium/[0.06]' },
  creator: { text: 'text-creator', bg: 'bg-creator', chip: 'bg-creator/15 text-creator', border: 'border-creator/45', tint: 'bg-creator/[0.06]' },
  master: { text: 'text-master', bg: 'bg-master', chip: 'bg-master/15 text-master', border: 'border-master/40', tint: 'bg-master/[0.06]' },
}

/**
 * 権限の受け取り。
 *
 * ■ 判定はここでは行わない
 * 入力されたキーはAPIへ送り、Workerが名簿と照合して権限を決める。
 * 以前はキー文字列に PREMIUM/MASTER が含まれるかを画面側で見ていたが、
 * それは「誰でも好きな権限を名乗れる」状態だった（2026-08-08 に廃止）。
 *
 * ■ キーは1人1本
 * 運営者が申請ごとに個別発行する。共通キーは作らない。
 * 流出したとき、その人の分だけ失効させられるようにするため。
 */
function MembershipBox() {
  const { role, source, label } = useRole()
  const signIn = usePremiumStore((s) => s.signIn)
  const signOut = usePremiumStore((s) => s.signOut)
  const sessionExpiresAt = usePremiumStore((s) => s.sessionExpiresAt)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const apply = async () => {
    const k = key.trim()
    if (!k) return
    if (!apiConfigured) {
      setMessage({ ok: false, text: '接続先が設定されていません。運営者にお知らせください。' })
      return
    }
    setBusy(true)
    setMessage(null)
    const res = await signIn({ mode: 'license', licenseKey: k })
    setBusy(false)
    if (res.ok) {
      // 権限名はAPIが返した検証済みの値から出す。入力内容からは決めない
      const applied = useRoleStore.getState().role
      setMessage({ ok: true, text: `${ROLE_LABEL[applied]} になりました。` })
      setKey('')
    } else {
      // 「無効」「失効済み」「打ち間違い」を区別して伝えない。
      // 区別すると、キーの総当たりに手がかりを与えてしまう
      setMessage({
        ok: false,
        text: res.message ?? 'このキーは確認できませんでした。お手元のキーをご確認ください。',
      })
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-4">
      <p className="text-[13.5px] font-bold">メンバーシップのキーを入れる</p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
        YouTubeメンバーシップに加入したあと、<strong className="text-foreground">利用申請</strong>
        をしていただくと、お一人ずつ専用のキーをお送りします。ここに貼るだけで権限が付きます。
        <strong className="text-foreground">Studioで別途登録する必要はありません。</strong>
        <br />
        キーは会員確認のためだけに使われます。制作データが送られることはありません。
      </p>

      <div className="mt-2.5 flex flex-wrap gap-2">
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void apply() }}
          placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
          autoComplete="off"
          spellCheck={false}
          className="h-10 min-w-[240px] flex-1 rounded-lg border border-border bg-background px-3 font-mono text-[13px] outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={() => void apply()}
          disabled={busy || !key.trim()}
          className="h-10 shrink-0 rounded-lg bg-primary px-4 text-[13.5px] font-bold text-primary-foreground disabled:opacity-50"
        >
          {busy ? '確認しています…' : '適用する'}
        </button>
      </div>

      {message && (
        <p
          className={cn(
            'mt-2 text-[12.5px] font-semibold',
            message.ok ? 'text-premium' : 'text-destructive',
          )}
        >
          {message.text}
        </p>
      )}

      {/* Discord招待URLはここに書かない。使いたい人の連絡先だけ案内する */}
      <p className="mt-3 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
        <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-master" />
        Master限定のDiscordコミュニティを利用したい方は、
        <a
          href={OFFICIAL_LINE_URL}
          target="_blank"
          rel="noopener noreferrer external"
          referrerPolicy="no-referrer"
          className="font-semibold text-master underline underline-offset-2"
        >
          公式LINE
        </a>
        からご連絡ください。
      </p>

      <p className="mt-2 text-[11.5px] text-muted-foreground">
        いまの権限: <span className="font-semibold text-foreground">{label}</span>
        {source === 'youtube' && <span className="ml-1.5">（YouTubeメンバーシップ経由）</span>}
        {role !== 'free' && (
          <button
            type="button"
            onClick={() => { signOut(); setMessage({ ok: true, text: '無料プランに戻しました。' }) }}
            className="ml-2 underline"
          >
            無料に戻す
          </button>
        )}
        {/*
          セッションの有効期限。同じキーで入り直せば延長される。
          切れる前に気づいてもらうための表示（2026-08-10追加）。
        */}
        {role !== 'free' && sessionExpiresAt && (
          <span className="mt-0.5 block">
            この端末での有効期限:{' '}
            {new Date(sessionExpiresAt * 1000).toLocaleDateString('ja-JP')} まで
            （継続してご利用の場合は、同じキーを入れ直すと延長されます）
          </span>
        )}
      </p>
    </div>
  )
}

export function PlansPage() {
  const { role, master, paid } = useRole()

  return (
    <div className="animate-fade-in pb-6">
      <h1 className="text-xl font-bold">プラン</h1>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
        <span className="font-semibold text-premium">Premium は制作環境</span>、
        <span className="font-semibold text-creator">Creator は映像制作まで広げる制作環境</span>、
        <span className="font-semibold text-master">Master は人が伴走する学習環境</span>です。
        機能の多い・少ないではなく、目的が違います。
        <br />
        加入は <strong className="text-foreground">YouTubeメンバーシップ</strong> から行います。
      </p>

      {/*
        4プランを比較しやすい並べ方（2026-08-19）。
        4枚を無理に横一列にすると1枚あたりが細くなり、価格も説明も読みにくくなる。
        スマホ=1列 → タブレット=2×2 → 広い画面でだけ4列、と段階的に広げる。
      */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((c) => {
          const current = role === c.id
          const tier = youtubeTierFor(c.id)
          const tone = TONE[c.id]
          // Premium・Creatorは項目が少なく、flex-1をチェックリストに置いたままだと
          // 直後の見出しとの間が不自然に空く。この2枚だけ余白の吸収先を
          // カード最下部（ボタン直前）へ動かす（2026-08-19）。Masterは対象外。
          const tightGap = c.id === 'premium' || c.id === 'creator'

          return (
            <div
              key={c.id}
              className={cn(
                'flex flex-col rounded-2xl border bg-card p-5',
                tone.border,
                c.id === 'premium' && 'shadow-lg shadow-premium/10',
                c.id === 'creator' && 'shadow-lg shadow-creator/10',
                c.id === 'master' && 'bg-gradient-to-b from-master/[0.05] to-card',
              )}
            >
              <span className={cn(
                'inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold tracking-wide',
                tone.chip,
              )}>
                {c.kindIcon && <c.kindIcon className="h-3 w-3 shrink-0" />}
                {c.kind}
              </span>

              <p className="mt-2.5 text-[16px] font-extrabold">{c.name}</p>
              <p className={cn('mt-1 text-[12.5px] font-semibold', c.id !== 'free' && tone.text)}>
                {c.purpose}
              </p>

              <p className="mt-3 text-[26px] font-extrabold tabular-nums">
                {c.id === 'free' ? '¥0' : `¥${tier?.price.toLocaleString()}`}
                {c.id !== 'free' && (
                  <span className="text-[12px] font-semibold text-muted-foreground"> / 月</span>
                )}
              </p>

              {/* 加入経路はYouTubeメンバーシップの1本のみ。プラン名だけ添える */}
              {tier && (
                <p className="mt-1 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  <SquarePlay className="mt-0.5 h-3.5 w-3.5 shrink-0 text-youtube" />
                  YouTubeメンバーシップ「{tier.youtubeName}」
                </p>
              )}

              <p className="mt-2 min-h-[56px] text-[11.5px] leading-relaxed text-muted-foreground">
                {c.target}
              </p>

              {c.seats && (
                <p className="mt-2.5 flex items-start gap-2 rounded-lg border border-master/25 bg-master/[0.08] px-3 py-2 text-[11.5px] font-semibold text-master">
                  <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {c.seats}
                </p>
              )}

              {/*
                flex-1 でカード内の余白を吸収し、4枚の「YouTubeで加入する」ボタンを
                行の下端で揃えている。tightGap のカードだけ、その吸収先を
                このリストからカード最下部（ボタン直前）へ動かす（2026-08-19）。
              */}
              <ul className={cn('mt-3.5 space-y-1.5', !tightGap && 'flex-1')}>
                {c.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[12.5px] leading-snug">
                    <Check className={cn(
                      'mt-0.5 h-3.5 w-3.5 shrink-0',
                      c.id === 'free' ? 'text-primary' : tone.text,
                    )} />
                    {f}
                  </li>
                ))}
              </ul>

              {c.externalFeatures && (
                <>
                  {c.externalFeaturesIntro && (
                    <div className="mt-3.5">
                      <p className={cn('text-[13px] font-bold leading-snug', tone.text)}>
                        {c.externalFeaturesIntro.tagline}
                      </p>
                      <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                        {c.externalFeaturesIntro.description}
                      </p>
                    </div>
                  )}
                  {/*
                    見出し「Studioの外で提供するもの」は廃止（2026-08-19）。
                    externalFeaturesIntro を持たないカードは、見出し無しで
                    チェックリストの直後にそのまま外部ツールを続ける。
                  */}
                  <ul className={cn('space-y-1.5', c.externalFeaturesIntro ? 'mt-2' : 'mt-2.5')}>
                    {c.externalFeatures.map((f) => (
                      <li key={f} className="text-[12.5px] leading-snug text-muted-foreground">
                        <span className="flex items-start gap-2">
                          <span className="mt-0.5 shrink-0">↗</span>
                          <span>{f}</span>
                        </span>
                        {c.externalFeatureNotes?.[f] && (
                          <span className="mt-0.5 block pl-5 text-[11px] leading-relaxed">
                            {c.externalFeatureNotes[f]}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {/* 上のリストから移した余白の吸収先。ボタンの直前に置くことで、カード内の
                  縦位置は変わらず、不自然な空きだけをここへ寄せる */}
              {tightGap && <div className="flex-1" />}

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
              ) : paid && ROLE_RANK[c.id] > ROLE_RANK[role] ? (
                /*
                  すでに有料プランの人が、今より上位のカードを見ているときだけの導線
                  （premium→creator／premium→master／creator→master）。
                  free の人には出さない（初回加入と混同させないため）。
                  Master の人にはそもそも上位が無いので、この分岐に入らない。
                  上位プランの特典は上のリストに既出なので、ここでは重複列挙しない。
                */
                <div className={cn('mt-4 rounded-lg border p-3.5', tone.border, tone.tint)}>
                  <p className={cn('flex items-center gap-1.5 text-[13px] font-bold', tone.text)}>
                    {c.id === 'master' ? <Users className="h-3.5 w-3.5" /> : <Film className="h-3.5 w-3.5" />}
                    {c.name}にアップグレードする
                  </p>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
                    {/* YouTube側の案内なので、ここだけはYouTubeの商品名で書く（→ role.ts） */}
                    YouTubeメンバーシップを「{tier?.youtubeName}」へ変更したあと、公式LINEから
                    「{c.name}に変更しました」とお送りください。
                    メンバーシップを確認後、{c.name}用ライセンスキーをご案内します。
                  </p>
                  <a
                    href={OFFICIAL_LINE_URL}
                    target="_blank"
                    rel="noopener noreferrer external"
                    referrerPolicy="no-referrer"
                    className={cn(
                      'mt-3 flex h-10 items-center justify-center gap-1.5 rounded-lg text-[13px] font-bold text-white',
                      tone.bg,
                    )}
                  >
                    <MessageCircle className="h-4 w-4" />
                    公式LINEで連絡する
                  </a>
                </div>
              ) : tier ? (
                <a
                  href={YOUTUBE_JOIN_URL}
                  target="_blank"
                  rel="noopener noreferrer external"
                  referrerPolicy="no-referrer"
                  className={cn(
                    'mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-lg text-[13.5px] font-bold text-white',
                    tone.bg,
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

              {/*
                Discordの招待URLはこの画面に出さない。
                Master の方へは、ライセンスキーと同じく公式LINEから手動でお送りする。
                画面に貼ると、URLを知った人が誰でも入れてしまい、
                少人数制（30名）の前提が崩れるため。
              */}
              {c.id === 'master' && master && (
                <p className="mt-2 rounded-lg border border-master/30 bg-master/[0.07] px-3 py-2.5 text-[12.5px] leading-relaxed text-master">
                  <MessageCircle className="mr-1.5 inline h-4 w-4 align-text-bottom" />
                  Discordコミュニティの招待は、公式LINEからお送りしています。
                  届いていない場合はLINEでお知らせください。
                </p>
              )}
            </div>
          )
        })}
      </div>

      <MembershipBox />

      <div className="mt-6 rounded-xl border border-dashed border-border bg-muted/50 p-4">
        <p className="text-[13.5px] font-bold">権限のしくみ</p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
          Studioの権限は<strong className="text-foreground">価格ではなくRole（free / premium / creator / master）</strong>で管理しています。
          加入経路はYouTubeメンバーシップのみです。
          <br />
          <span className="font-semibold text-premium">Premium は「制作環境」</span>。
          毎週コンテンツを配るのではなく、Studio自体が毎月良くなっていくことが価値です。
          <br />
          <span className="font-semibold text-creator">Creator は「制作領域の拡張」</span>。
          Premiumの制作環境に映像の生成ツールが加わり、AI音楽から映像制作まで扱えるようになります。
          <br />
          <span className="font-semibold text-master">Master は「人の伴走」</span>。
          ツールが増えるプランではありません。添削・レビュー・ライブはカラスイさんの時間
          そのものなので、人数に上限があります。
        </p>
      </div>
    </div>
  )
}
