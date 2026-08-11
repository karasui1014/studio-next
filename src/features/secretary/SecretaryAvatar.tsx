import { Bot } from 'lucide-react'

import { useSecretaryStore } from '@/core/secretary/store'
import { cn } from '@/core/ui/cn'

/** 秘書の顔。画像が未設定のあいだは既定のアイコンを出す。 */
export function SecretaryAvatar({ className }: { className?: string }) {
  const avatarUrl = useSecretaryStore((s) => s.avatarUrl)
  const name = useSecretaryStore((s) => s.settings.name)

  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className={cn('rounded-2xl object-cover', className)} />
  }

  return (
    <div
      className={cn(
        'grid place-items-center rounded-2xl bg-gradient-to-br from-primary to-suno text-white',
        className,
      )}
      aria-label={name}
      role="img"
    >
      <Bot className="h-1/2 w-1/2" />
    </div>
  )
}
