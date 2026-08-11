import { cn } from '@/core/ui/cn'
import { apiConfigured, usePremiumStore } from '@/core/entitlement/api'
import { ROLE_LABEL, useRoleStore, type Role } from '@/core/entitlement/role'

const ROLES: Role[] = ['free', 'premium', 'master']
const SHORT: Record<Role, string> = { free: '無料', premium: 'Premium', master: 'Master' }

/**
 * 検証用の権限切替バー。**本番ビルドでは描画しない。**
 *
 * ■ ここで切り替わるのは「見た目」だけではない
 * ボタンを押すと API に本物のセッションを発行させ、そのトークンで限定コンテンツを
 * 取りに行く。QA が本番とまったく同じ経路を通るので、
 * 「見た目は解除されたのに中身が出ない」を配信側の不具合として検出できる。
 *
 * ■ 安全装置は二重
 *   ① このコンポーネントが本番ビルドで描画されない（import.meta.env.PROD）
 *   ② API 側が DEV_ROLE_OVERRIDE='true' のときしか dev モードを受け付けない
 *      （この変数は .dev.vars にしかなく、本番では undefined）
 * 片方を外しても、もう片方で止まる。
 */
export function DevRoleSwitcher() {
  const role = useRoleStore((s) => s.role)
  const setRole = useRoleStore((s) => s.setRole)
  const signIn = usePremiumStore((s) => s.signIn)
  const signOut = usePremiumStore((s) => s.signOut)
  const status = usePremiumStore((s) => s.status)

  if (import.meta.env.PROD) return null

  const switchTo = (r: Role) => {
    setRole(r, r === 'free' ? 'none' : 'youtube') // 見た目を即座に反映
    if (!apiConfigured) return
    if (r === 'free') signOut()
    else void signIn({ mode: 'dev', role: r }) // 実データは本番と同じ経路で取り直す
  }

  const contentState = !apiConfigured
    ? 'API未接続（限定コンテンツは出ません）'
    : status === 'ready'
      ? '限定コンテンツ: 受信済み'
      : status === 'locked'
        ? '限定コンテンツ: 権限なし（正常）'
        : status === 'loading'
          ? '限定コンテンツ: 取得中…'
          : status === 'error'
            ? '限定コンテンツ: API接続エラー'
            : '限定コンテンツ: 未取得'

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-dashed border-primary/30 bg-primary/[0.07] px-4 py-1.5 text-xs text-muted-foreground lg:px-7">
      <strong className="font-bold text-primary">検証モード</strong>
      <span className="hidden sm:inline">権限を切り替えると画面の出し分けが確認できます</span>
      <span
        className={cn(
          'rounded px-1.5 py-px text-[10.5px] font-semibold',
          status === 'ready' && 'bg-premium/15 text-premium',
          status === 'error' && 'bg-destructive/15 text-destructive',
        )}
      >
        {contentState}
      </span>
      <div className="ml-auto flex gap-1.5">
        {ROLES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => switchTo(r)}
            aria-pressed={role === r}
            title={ROLE_LABEL[r]}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold transition-colors',
              role === r
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            {SHORT[r]}
          </button>
        ))}
      </div>
    </div>
  )
}
