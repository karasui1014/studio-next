import { Construction } from 'lucide-react'

/** 未実装の画面。どのPhaseで作るかを明示しておく。 */
export function PlaceholderPage({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-bold">{title}</h1>
      <div className="mt-4 rounded-lg border border-border bg-card px-5 py-12 text-center">
        <Construction className="mx-auto h-7 w-7 text-muted-foreground" />
        <p className="mt-3 text-sm font-bold">この画面はこれから作ります</p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">{phase} で実装予定です</p>
      </div>
    </div>
  )
}
