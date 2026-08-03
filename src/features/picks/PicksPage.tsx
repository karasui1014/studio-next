import { usePicks } from '@/core/content/load'
import { PickCard } from './PickCard'

/** カラスイ Picks の一覧。制作者目線の見立てを時系列で並べる。 */
export function PicksPage() {
  const { data, error, loading } = usePicks()
  const picks = data?.items ?? []

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-bold">カラスイ Picks</h1>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
        今日の注目ニュースを制作者目線で解説しています。記事は Substack で公開しているものです。
      </p>

      {loading && <p className="py-10 text-center text-sm text-muted-foreground">読み込んでいます…</p>}
      {error && <p className="py-10 text-center text-sm text-destructive">{error}</p>}

      <div className="mt-5 space-y-3">
        {picks.map((p) => <PickCard key={p.id} pick={p} />)}
      </div>

      {!loading && picks.length === 0 && (
        <p className="py-14 text-center text-sm text-muted-foreground">
          まだ記事がありません。
        </p>
      )}
    </div>
  )
}
