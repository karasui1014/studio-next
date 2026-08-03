import type { ReactNode } from 'react'

/** 制作ツールで共通に使う入力欄の見た目 */
export const inputClass =
  'w-full rounded-lg border border-border bg-card px-3 py-2 text-[14px] outline-none ' +
  'focus:border-primary focus:ring-2 focus:ring-primary/20'

export function Field({
  label, hint, children,
}: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12.5px] font-semibold">{label}</span>
      {hint && <span className="ml-1.5 text-[11px] text-muted-foreground">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  )
}

/** ツール画面の見出し。「端末内で動く」ことを毎回伝える。 */
export function ToolHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
        {description}
        <br />
        処理はすべて端末内で行うので、入力した内容が外部に送られることはありません。
      </p>
    </div>
  )
}
