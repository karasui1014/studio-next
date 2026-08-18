import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Construction, Lock, SquareArrowOutUpRight } from 'lucide-react'

import { recordActivity } from '@/core/storage/activity'
import {
  ROLE_LABEL, satisfiesRole, useRole, youtubeTierFor, type Role,
} from '@/core/entitlement/role'
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

/** 制作ツールの一覧。すべて Premium 以上。V1からの移植が進むたびに to を埋めていく。 */
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

/**
 * Studioの外にある独立ツールへの入口。
 *
 * ■ これらのURLをコードに書いてよい理由
 * Discordの招待URLとは違い、ここに載せる8つはいずれも
 * 「元からログイン不要で誰でも開けるサイト」であり、限定性を持たない。
 * うち7つは V1（AI Music Studio）の公開ソースに以前から平文で書かれていたもの。
 * Seedance2.5プロンプト工房はV1に無い新規ツールだが、同じ理由（ログイン不要・
 * 誰でも開ける静的サイト）で公開コードに書いてよいと判断した（2026-08-12決定）。
 * ここでの「鍵」は本物のアクセス制御ではなく、導線の出し分けにすぎない
 * ——それはDiscordのときと同じ整理で、隠す価値のあるものを隠していない。
 *
 * ■ 権限
 *   スタイルプロンプト工房                                     : 無料（2026-08-10決定）
 *     （他所（このサイト自身）で既に無料公開済みのツールのため、Studio側でも無料開放にした）
 *   絵コンテツール・ギターコードTAB・マスタリング自動生成ツール : Premium以上（2026-08-10決定）
 *   字幕自動生成／楽曲批評ツール                                : Masterのみ（2026-08-10決定）
 *   Seedance Batch Studio／シーダンス2.5 プロンプト工房         : Creator以上（2026-08-18変更）
 *     （新設のStudio Creatorの目玉として、Masterのみ限定からCreator以上に引き下げた。
 *       Masterの差別化はDiscordコミュニティに一本化する）
 *
 * 名称・説明文・URLのうち7つは V1 の `src/lib/constants.ts`（EXTERNAL_TOOLS）と
 * 完全一致させている。シーダンス2.5 プロンプト工房のみV1に対応がない新規追加。
 */
interface ExternalTool {
  id: string
  emoji: string
  name: string
  desc: string
  url: string
  requires: Role
}

const EXTERNAL_TOOLS: ExternalTool[] = [
  {
    id: 'storyboard-external', emoji: '🎬', name: '絵コンテツール',
    desc: 'MVのカット割り・構成を考える',
    url: 'https://karasui1014.github.io/lofi-detective-website/storyboard.html',
    requires: 'premium',
  },
  {
    id: 'mastering', emoji: '🎚', name: 'マスタリング自動生成ツール',
    desc: '楽曲のマスタリング設定を作る',
    url: 'https://karasui1014.github.io/lofi-detective-website/mastering/',
    requires: 'premium',
  },
  {
    id: 'guitar-chord-tab', emoji: '🎸', name: 'ギターコードTAB',
    desc: 'ギター音源からコード進行とTAB譜を作る',
    url: 'https://karasui1014.github.io/guitar-chord-tab/',
    requires: 'premium',
  },
  {
    id: 'subtitle', emoji: '💬', name: '字幕自動生成ツール',
    desc: '歌詞から字幕を自動生成する',
    url: 'https://karasui1014.github.io/lofi-detective-website/lyric/',
    requires: 'master',
  },
  {
    id: 'style-prompt', emoji: '🎵', name: 'スタイルプロンプト工房',
    desc: 'Sunoのスタイルプロンプトを研究する',
    url: 'https://karasui1014.github.io/lofi-detective-website/style-prompt-koubou/',
    requires: 'free',
  },
  {
    id: 'review', emoji: '📝', name: '楽曲批評ツール',
    desc: '完成した楽曲をAIにレビューしてもらう',
    url: 'https://karasui1014.github.io/gakkyoku-hihyou/',
    requires: 'master',
  },
  {
    id: 'seedance', emoji: '🎞', name: 'Seedance Batch Studio',
    desc: '動画素材をまとめてバッチ生成する',
    url: 'https://seedance-batch-studio.karasui.chatgpt.site/',
    requires: 'creator',
  },
  {
    id: 'seedance-prompt-koubou', emoji: '🎥', name: 'シーダンス2.5 プロンプト工房',
    desc: 'Seedance 2.5用のプロンプトを香盤表形式で組み立てる',
    url: 'https://karasui1014.github.io/lofi-detective-website/seedance-prompt-koubou/',
    requires: 'creator',
  },
]

/** ロック表示に現れるのは有料プランだけ（free のツールは誰にもロックされない） */
type PaidRole = Exclude<Role, 'free'>

/**
 * アップグレード案内の手順。
 *
 * YouTube側の商品名は `role.ts` の YOUTUBE_TIERS から引く。ここに直接書くと、
 * YouTubeで改名したときに古い名前が残る——実際 2026-08-19 の改名まで
 * 「AIでMVを作りたい部」という旧名がこの場所に固定で書かれていた。
 */
function upgradeSteps(required: PaidRole): string[] {
  const plan = ROLE_LABEL[required]
  const youtubeName = youtubeTierFor(required)?.youtubeName ?? plan
  return [
    `YouTubeメンバーシップ「${youtubeName}」に加入・変更する`,
    `公式LINEで「チャンネル名」と「${plan}に加入した」旨を送る`,
    'こちらでメンバーシップを確認し、新しいライセンスキーをお送りします',
    '「プラン」画面でキーを入力する',
  ]
}

/** プランごとの配色。Premium=琥珀／Creator=翠／Master=紅 */
function tierTone(required: PaidRole) {
  if (required === 'master') return { text: 'text-master', bg: 'bg-master', border: 'border-master/30', tint: 'bg-master/[0.04]', chip: 'bg-master/12' }
  if (required === 'creator') return { text: 'text-creator', bg: 'bg-creator', border: 'border-creator/30', tint: 'bg-creator/[0.04]', chip: 'bg-creator/12' }
  return { text: 'text-premium', bg: 'bg-premium', border: 'border-premium/30', tint: 'bg-premium/[0.04]', chip: 'bg-premium/12' }
}

/** ロックされたツール共通のカード。ネイティブ・外部どちらの表示にも使う。 */
function LockedCard({
  emoji,
  name,
  requires,
}: {
  emoji: string
  name: string
  requires: PaidRole
}) {
  const [expanded, setExpanded] = useState(false)
  // 「使えません」ではなく「どのプランなら使えるか」を言う。
  // 閉じた状態でも解放条件が分かるようにしておく（2026-08-19）
  const plan = ROLE_LABEL[requires]
  const steps = upgradeSteps(requires)
  const tone = tierTone(requires)

  return (
    <div className={cn('rounded-xl border p-4', tone.border, tone.tint)}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3.5 text-left"
      >
        <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl', tone.chip)}>
          {emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[14px] font-bold">
            {name}
            <Lock className={cn('h-3.5 w-3.5', tone.text)} />
          </span>
          <span className="mt-1 block text-[12px] leading-relaxed text-muted-foreground">
            <span className={cn('font-semibold', tone.text)}>{plan}</span>
            で利用できます。タップで詳しく
          </span>
        </span>
      </button>

      {expanded && (
        <div className="mt-3 rounded-lg border border-border bg-card p-3 text-[12.5px] leading-relaxed">
          <p className={cn('font-bold', tone.text)}>{plan}へのアップグレード</p>
          <p className="mt-1.5 text-muted-foreground">
            {name}は {plan} でご利用いただけます。
            アップグレードの流れは以下のとおりです。
          </p>
          <ol className="mt-2 space-y-1 text-muted-foreground">
            {steps.map((s, i) => (
              <li key={s}>{i + 1}. {s}</li>
            ))}
          </ol>
          <Link
            to="/plans"
            className={cn(
              'mt-3 inline-flex h-9 items-center justify-center rounded-lg px-4 text-[12.5px] font-bold text-white',
              tone.bg,
            )}
          >
            {plan}を見る
          </Link>
        </div>
      )}
    </div>
  )
}

function ExternalToolCard({ tool, role }: { tool: ExternalTool; role: Role }) {
  const locked = !satisfiesRole(role, tool.requires)

  if (!locked) {
    return (
      <a
        href={tool.url}
        target="_blank"
        rel="noopener noreferrer external"
        referrerPolicy="no-referrer"
        onClick={() => recordActivity({ id: tool.id, kind: 'tool', label: tool.name, to: null, url: tool.url })}
        className="flex items-start gap-3.5 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-muted text-xl">
          {tool.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[14px] font-bold">
            {tool.name}
            <SquareArrowOutUpRight className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
          <span className="mt-1 block text-[12px] leading-relaxed text-muted-foreground">
            {tool.desc}
          </span>
        </span>
      </a>
    )
  }

  // requires が 'free' なら誰にとってもロックされない（above の !locked 分岐で必ず拾われる）
  return <LockedCard emoji={tool.emoji} name={tool.name} requires={tool.requires as PaidRole} />
}

export function ToolsPage() {
  const { role } = useRole()

  // 鍵つきツールをなるべく下に揃える（2026-08-10決定）。ロック状態が同じもの同士の順序は変えない。
  const sortedExternalTools = [...EXTERNAL_TOOLS].sort((a, b) => {
    const aLocked = satisfiesRole(role, a.requires) ? 0 : 1
    const bLocked = satisfiesRole(role, b.requires) ? 0 : 1
    return aLocked - bLocked
  })

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-bold">制作ツール</h1>
      <p className="mt-1 text-[12.5px] text-muted-foreground">
        すべて端末内で動きます。入力した内容が外部に送られることはありません。
      </p>

      <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
        {TOOLS.map((t) => {
          if (role === 'free') {
            return <LockedCard key={t.id} emoji={t.emoji} name={t.name} requires="premium" />
          }

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

      <p className="mt-8 flex items-center gap-2 text-[10.5px] font-bold tracking-wide text-muted-foreground">
        外部ツール（別サイトが開きます）
        <span className="h-px flex-1 bg-border" />
      </p>
      <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
        {sortedExternalTools.map((t) => (
          <ExternalToolCard key={t.id} tool={t} role={role} />
        ))}
      </div>
    </div>
  )
}
