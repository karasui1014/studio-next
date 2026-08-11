import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'

import { useRole } from './role'

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
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  const { paid } = useRole()
  if (paid) return <>{children}</>

  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-premium/12">
        <Lock className="h-6 w-6 text-premium" />
      </div>

      <h1 className="mt-4 text-[22px] font-extrabold tracking-tight">{title}</h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
        {description ?? 'この機能は Studio Premium 以上でお使いいただけます。'}
      </p>

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
