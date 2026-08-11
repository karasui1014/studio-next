import { lazy, Suspense } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'

import { AppShell } from '@/app/AppShell'
import { PremiumGate } from '@/core/entitlement/PremiumGate'
import { HomePage } from '@/features/home/HomePage'
import { NewsPage } from '@/features/news/NewsPage'
import { ToolsPage } from '@/features/tools/ToolsPage'
const LyricsReviewPage = lazy(() => import('@/features/tools/lyrics-review/LyricsReviewPage').then((m) => ({ default: m.LyricsReviewPage })))
const MvIdeaPage = lazy(() => import('@/features/tools/mv-idea/MvIdeaPage').then((m) => ({ default: m.MvIdeaPage })))
const AiProducerPage = lazy(() => import('@/features/tools/ai-producer/AiProducerPage').then((m) => ({ default: m.AiProducerPage })))
const SongsPage = lazy(() => import('@/features/songs/SongsPage').then((m) => ({ default: m.SongsPage })))
const SongDetailPage = lazy(() => import('@/features/songs/SongDetailPage').then((m) => ({ default: m.SongDetailPage })))
const DataPage = lazy(() => import('@/features/data/DataPage').then((m) => ({ default: m.DataPage })))
const PicksPage = lazy(() => import('@/features/picks/PicksPage').then((m) => ({ default: m.PicksPage })))
const ToolsGuidePage = lazy(() => import('@/features/tools-guide/ToolsGuidePage').then((m) => ({ default: m.ToolsGuidePage })))
const PlansPage = lazy(() => import('@/features/plans/PlansPage').then((m) => ({ default: m.PlansPage })))
const PromptDexPage = lazy(() => import('@/features/tools/prompt-dex/PromptDexPage').then((m) => ({ default: m.PromptDexPage })))
const SecretaryPage = lazy(() => import('@/features/secretary/SecretaryPage').then((m) => ({ default: m.SecretaryPage })))
import { PlaceholderPage } from '@/features/stub/PlaceholderPage'

/**
 * ルーティング。
 * GitHub Pages のような静的ホスティングでも動くよう HashRouter を使う（V1から踏襲）。
 * 機能を足すときは features/ にフォルダを作り、ここに1行足すだけで済むようにしている。
 */
export default function App() {
  return (
    <HashRouter>
      {/* 制作ツールは開いたときに読み込む。ホームの表示を軽く保つため。 */}
      <Suspense
        fallback={<p className="p-8 text-center text-sm text-muted-foreground">読み込んでいます…</p>}
      >
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="news" element={<NewsPage />} />
          <Route path="picks" element={<PicksPage />} />
          <Route path="tools-guide" element={<ToolsGuidePage />} />

          {/*
            ここから下が Premium 以上の制作機能。
            各ページを個別に書き換えず、ルーティングで一括して囲っている。
            ページを足したときに「ゲートのかけ忘れ」が起きないようにするため。

            無料のまま残すもの（意図的にこの外に置いている）:
              ニュース / Picks / AIツール図鑑 / データの書き出し
            データの書き出しは V1 憲章で無料維持と決めている（人質化しないため）。

            /tools だけ例外でゲートの外にある。
            外部ツールの「スタイルプロンプト工房」は他所で既に無料公開済みのため
            無料ユーザーにも見せる方針（2026-08-10決定）。ページ内部で
            無料/Premium/Master ごとの出し分けを行っている（ToolsPage.tsx）。
          */}
          <Route
            path="songs"
            element={<PremiumGate title="曲の管理"><SongsPage /></PremiumGate>}
          />
          <Route
            path="songs/:songId"
            element={<PremiumGate title="曲の管理"><SongDetailPage /></PremiumGate>}
          />
          <Route path="tools" element={<ToolsPage />} />
          <Route
            path="tools/lyrics-review"
            element={<PremiumGate title="歌詞レビュー"><LyricsReviewPage /></PremiumGate>}
          />
          <Route
            path="tools/mv-idea"
            element={<PremiumGate title="MVアイデア"><MvIdeaPage /></PremiumGate>}
          />
          <Route
            path="tools/ai-producer"
            element={<PremiumGate title="AIプロデューサー"><AiProducerPage /></PremiumGate>}
          />
          <Route
            path="prompts"
            element={<PremiumGate title="プロンプト工房"><PromptDexPage /></PremiumGate>}
          />
          <Route
            path="storyboard"
            element={<PremiumGate title="ストーリーボード"><MvIdeaPage /></PremiumGate>}
          />
          {/*
            AI秘書。話す内容の元になるのが曲データ（Premium以上）なので、
            ここも Premium 以上にしている。無料のまま開けても
            「今日は何から作りますか？」しか言えず、押した先はロック画面になる。
          */}
          <Route
            path="secretary"
            element={<PremiumGate title="AI秘書"><SecretaryPage /></PremiumGate>}
          />
          <Route path="data" element={<DataPage />} />
          <Route path="plans" element={<PlansPage />} />
          <Route path="*" element={<PlaceholderPage title="ページが見つかりません" phase="—" />} />
        </Route>
      </Routes>
      </Suspense>
    </HashRouter>
  )
}
