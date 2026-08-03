import { lazy, Suspense } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'

import { AppShell } from '@/app/AppShell'
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
          <Route path="songs" element={<SongsPage />} />
          <Route path="songs/:songId" element={<SongDetailPage />} />
          <Route path="tools" element={<ToolsPage />} />
          <Route path="tools/lyrics-review" element={<LyricsReviewPage />} />
          <Route path="tools/mv-idea" element={<MvIdeaPage />} />
          <Route path="tools/ai-producer" element={<AiProducerPage />} />
          <Route path="prompts" element={<PromptDexPage />} />
          <Route path="storyboard" element={<MvIdeaPage />} />
          <Route path="secretary" element={<PlaceholderPage title="AI秘書" phase="Phase 4" />} />
          <Route path="data" element={<DataPage />} />
          <Route path="plans" element={<PlansPage />} />
          <Route path="*" element={<PlaceholderPage title="ページが見つかりません" phase="—" />} />
        </Route>
      </Routes>
      </Suspense>
    </HashRouter>
  )
}
