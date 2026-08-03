import { cn } from '@/core/ui/cn'
import { ROLE_LABEL, useRoleStore, type Role } from '@/core/entitlement/role'

const ROLES: Role[] = ['free', 'premium', 'master']
const SHORT: Record<Role, string> = { free: '無料', premium: 'Premium', master: 'Master' }

/**
 * 検証用の権限切替バー。
 * 正式なキー検証を入れたらこの画面ごと削除する。本番ビルドでは表示しない。
 */
export function DevRoleSwitcher() {
  const role = useRoleStore((s) => s.role)
  const setRole = useRoleStore((s) => s.setRole)

  if (import.meta.env.PROD) return null

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-dashed border-primary/30 bg-primary/[0.07] px-4 py-1.5 text-xs text-muted-foreground lg:px-7">
      <strong className="font-bold text-primary">検証モード</strong>
      <span className="hidden sm:inline">権限を切り替えると画面の出し分けが確認できます</span>
      <div className="ml-auto flex gap-1.5">
        {ROLES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r, r === 'free' ? 'none' : 'youtube')}
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
