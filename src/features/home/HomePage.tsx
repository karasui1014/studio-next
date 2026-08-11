import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'

import { useHome, useNews, usePicks } from '@/core/content/load'
import { headline } from '@/core/content/types'
import { recordActivity } from '@/core/storage/activity'
import { CATEGORY_CLASS, CATEGORY_LABEL, relativeTime } from '@/features/news/format'
import { cn } from '@/core/ui/cn'
import { SecretaryCard } from '../secretary/SecretaryCard'
import { TodayPick } from '../picks/TodayPick'
import { CreateHero } from './CreateHero'
import { DailyTipCard, pickDailyTip } from './DailyTip'
import { ResumeSection } from './ResumeSection'
import { PromptCard, SectionHead, SubstackCard } from './sections'

/** 制作ツールの入口 */
const STUDIO_TOOLS = [
  { id: 'lyrics-review', emoji: '✍️', name: '歌詞レビュー', desc: '字余り・韻・構成をチェック', to: '/tools/lyrics-review' },
  { id: 'mv-idea', emoji: '🎬', name: 'MVアイデア', desc: '絵コンテとショットリストを生成', to: '/tools/mv-idea' },
  { id: 'ai-producer', emoji: '🎛', name: 'AIプロデューサー', desc: '曲の方向性を整理して比較', to: '/tools/ai-producer' },
  { id: 'prompt-dex', emoji: '📚', name: 'プロンプト工房', desc: '使えたプロンプトを貯める', to: '/prompts' },
]

/**
 * ホーム（制作ファースト）。
 *
 * 並び順に意味がある：
 *   ① 今日は何を作りますか？＋制作タイル … 制作の入口。いちばん大きく
 *      ＋ 今日試すAI音楽機能           … 開く理由になる一言
 *   ② AI秘書のひとこと                 … 有料プランのみ。次の一歩を名指しする
 *   ③ 続きから                         … 前回のつづき
 *   ④ 今日の重要ニュース（3件）        … 情報収集。ただし主役ではない
 *   ⑤ 今日のカラスイ Picks（1件）      … 迷わせないよう1本だけ。一覧は Picks ページ
 *   ⑥ おすすめプロンプト               … ふたたび制作へ
 *   ⑦ 制作ツール
 *   ⑧ AIツール図鑑
 *
 * 「制作 → 情報収集 → 学習 → ふたたび制作」の流れになるようにしている。
 */
export function HomePage() {
  const news = useNews()
  const home = useHome()
  const picks = usePicks()

  const topNews = (news.data?.items ?? []).slice(0, 3)
  const todayPick = picks.data?.items[0]
  const prompts = home.data?.prompts.slice(0, 3) ?? []
  const guide = home.data?.toolsGuide.slice(0, 4) ?? []
  const substack = home.data?.substack
  const tip = pickDailyTip(home.data?.daily ?? [])

  return (
    <div className="animate-fade-in pb-4">
      {/* ①〜④ 制作の入口（曲を作る／歌詞を書く／MVを作る／プロンプトを作る） */}
      <CreateHero />

      {/* AI秘書のひとこと。有料プランの人にだけ出る（無料の人には何も描画しない） */}
      <SecretaryCard />

      {/* ⑤ 続きから */}
      <ResumeSection />

      {/* ⑥ ニュース。3件だけ、控えめな見た目にして「読む場所」に見せない */}
      <section className="mt-8">
        <SectionHead
          title="今日の重要ニュース"
          note={`${topNews.length}件・3分で読めます`}
          moreTo="/news"
          moreLabel="もっと見る"
        />

        {news.loading && (
          <p className="py-5 text-center text-sm text-muted-foreground">読み込んでいます…</p>
        )}
        {news.error && <p className="py-5 text-center text-sm text-destructive">{news.error}</p>}

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {topNews.map((item, i) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer external"
              referrerPolicy="no-referrer"
              className={cn(
                'flex items-start gap-3 px-3.5 py-3 transition-colors hover:bg-accent/50',
                i > 0 && 'border-t border-border',
              )}
            >
              <span className="w-4 shrink-0 pt-0.5 text-[11px] font-bold tabular-nums text-muted-foreground">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0 flex-1">
                <span className="mb-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className={cn('rounded px-1.5 py-px text-[10px] font-bold', CATEGORY_CLASS[item.category])}>
                    {CATEGORY_LABEL[item.category]}
                  </span>
                  <span className="min-w-0 truncate">{item.source}</span>
                  <span className="ml-auto shrink-0 tabular-nums">{relativeTime(item.published)}</span>
                </span>
                <span className="block text-[13.5px] font-semibold leading-snug [overflow-wrap:anywhere]">
                  {headline(item)}
                </span>
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* ⑦ カラスイ Picks。ホームでは1本だけ見せる */}
      {todayPick && (
        <section className="mt-8">
          <SectionHead
            title="🔥 今日のカラスイ Picks"
            note="今日の注目ニュースを制作者目線で解説"
            moreTo="/picks"
            moreLabel="もっと見る"
          />
          <TodayPick pick={todayPick} />
        </section>
      )}

      {/* ⑧ おすすめプロンプト */}
      {prompts.length > 0 && (
        <section className="mt-8">
          <SectionHead title="今日のおすすめプロンプト" moreTo="/prompts" moreLabel="工房へ" />
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {prompts.map((p) => <PromptCard key={p.id} prompt={p} />)}
          </div>
        </section>
      )}

      {/* ⑨ 制作ツール */}
      <section className="mt-8">
        <SectionHead title="制作ツール" moreTo="/tools" />
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          {STUDIO_TOOLS.map((t) => (
            <Link
              key={t.id}
              to={t.to}
              onClick={() =>
                recordActivity({ id: t.id, kind: 'tool', label: t.name, to: t.to, url: null })
              }
              className="flex items-start gap-3 rounded-xl border border-border bg-card px-3.5 py-3.5 transition-colors hover:border-primary/40"
            >
              <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] bg-muted text-base">
                {t.emoji}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-bold">{t.name}</span>
                <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted-foreground">
                  {t.desc}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ⑩ 今日試すAIツール */}
      <section className="mt-8">
        <SectionHead
          title="今日試すAIツール"
          note="毎日ひとつ、実際に使ったものだけ"
          moreTo="/tools-guide"
          moreLabel="図鑑へ"
        />
        {tip && <DailyTipCard tip={tip} />}
      </section>

      {guide.length > 0 && (
        <section className="mt-4">
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            {guide.map((t) => (
              <a
                key={t.id}
                href={t.url}
                target="_blank"
                rel="noopener noreferrer external"
                referrerPolicy="no-referrer"
                onClick={() =>
                  recordActivity({ id: t.id, kind: 'external', label: t.name, to: null, url: t.url })
                }
                className="flex items-start gap-3 rounded-xl border border-border bg-card px-3.5 py-3.5 transition-colors hover:border-primary/40"
              >
                <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] bg-muted text-base">
                  {t.emoji}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-[13px] font-bold">
                    {t.name}
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-[11.5px] leading-relaxed text-muted-foreground">
                    {t.description}
                  </span>
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Substackの登録案内。読み終わったいちばん最後に1枚だけ置く */}
      {substack && (
        <section className="mt-8">
          <SubstackCard config={substack} />
        </section>
      )}
    </div>
  )
}
