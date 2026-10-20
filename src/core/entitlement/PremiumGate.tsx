import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Lock, Sparkles } from 'lucide-react'

import { useRole } from './role'
import { isTrialActive, startTrial, type TrialKey } from './trial'

/**
 * 制作ツールを Premium 以上に制限するための入口。
 *
 * ■ これは「表示の出し分け」であって、アクセス制御ではない
 * 制作ツールのロジックは端末内で完結しており、配信されたJSを読めば誰でも動かせる。
 * ここで守っているのは「無料プランの人に、有料機能の画面を見せない」ことだけ。
 * 本当に渡してはいけないもの（限定コンテンツの本文）は、
 * サーバー側で権限を検証してから配信する（core/entitlement/api.ts）。
 *
 * ■ なぜ制作ツールはこれで足りるのか
 * 制作ツールは「使えること」自体が価値で、盗まれて困るデータを持っていない。
 * 制作データはすべて利用者の端末にあり、こちらは一切受け取らない。
 * そのため、サーバー配信に切り替える必要がない。
 */
export function PremiumGate({
  title,
  description,
  trial,
  children,
}: {
  title: string
  description?: string
  /** 指定すると、無料プランでも1日1回、その日いっぱい試せる（→ trial.ts） */
  trial?: TrialKey
  children: React.ReactNode
}) {
  const { paid } = useRole()
  // 画面を移動しても React はこの部品を使い回すので、「体験中か」は毎回そのツールで確かめる。
  // （最初の値だけ state に持つと、前のツールの「体験中」が次のツールに持ち越されてしまう）
  // started は保存できない環境向けの予備で、このページで始めたツールのキーを覚えておく。
  const [started, setStarted] = useState<TrialKey | null>(null)
  const trialOn = !!trial && (started === trial || isTrialActive(trial))
  if (paid) return <>{children}</>

  if (trial && trialOn) {
    return (
      <>
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-premium/30 bg-premium/[0.07] px-4 py-2.5 text-[12.5px]">
          <span className="flex items-center gap-1.5 font-bold text-premium">
            <Sparkles className="h-3.5 w-3.5" />
            無料体験中
          </span>
          <span className="text-muted-foreground">今日いっぱい使えます。明日また試せます。</span>
          <Link to="/plans" className="ml-auto font-semibold text-premium underline underline-offset-2">
            毎日使うなら Studio Premium
          </Link>
        </div>
        {children}
      </>
    )
  }

  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-premium/12">
        <Lock className="h-6 w-6 text-premium" />
      </div>

      <h1 className="mt-4 text-[22px] font-extrabold tracking-tight">{title}</h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
        {description ?? 'この機能は Studio Premium 以上でお使いいただけます。'}
      </p>

      {trial && (
        <div className="mt-6 rounded-xl border border-premium/30 bg-premium/[0.06] p-4">
          <p className="text-[13.5px] font-bold">まずは無料で試してみませんか</p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            1日1回、その日いっぱい使えます。登録もキーもいりません。
          </p>
          <button
            type="button"
            onClick={() => { startTrial(trial); setStarted(trial) }}
            className="mt-3 inline-flex h-11 items-center justify-center gap-1.5 rounded-lg bg-premium px-6 text-[14px] font-bold text-white"
          >
            <Sparkles className="h-4 w-4" />
            今日の無料体験で使ってみる
          </button>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-border bg-card p-4 text-left">
        <p className="text-[12.5px] font-bold">ご利用の流れ</p>
        <ol className="mt-2 space-y-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
          <li>1. YouTubeメンバーシップに加入する</li>
          <li>2. 公式LINEから利用申請をする</li>
          <li>3. 届いたライセンスキーを「プラン」画面で入力する</li>
        </ol>
      </div>

      <Link
        to="/plans"
        className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-premium px-6 text-[14px] font-bold text-white"
      >
        プランを見る
      </Link>

      <p className="mt-4 text-[12px] text-muted-foreground">
        AI音楽ニュース・AIツール図鑑・カラスイ Picks・データの書き出しは、
        無料のままお使いいただけます。
      </p>
    </div>
  )
}
