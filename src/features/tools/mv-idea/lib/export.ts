import type { MvConcept, MvIdeaInput, MvIdeaResult, MvPlanDetail, MvShot } from './types'
import { BUDGET_META, DIFFICULTY_META, MV_PLAN_MODES, formatSec, shotSeconds } from './types'

/**
 * 書き出し(Markdown / JSON / CSV)とテキスト整形。
 * すべて端末内で完結し、ダウンロードはBlob+aタグで行う(GitHub Pages互換)。
 */

export interface MvIdeaExportMeta {
  songTitle: string
  createdAt: string
  providerName: string
}

function modeLabel(input: MvIdeaInput): string {
  return MV_PLAN_MODES.find((m) => m.id === input.mode)?.label ?? input.mode
}

function shotNo(shot: MvShot): string {
  return `S${String(shot.no).padStart(2, '0')}`
}

function conceptBlock(concept: MvConcept, selected: boolean, index: number): string {
  const lines = [
    `### 案${index + 1}: ${concept.conceptTitle}${selected ? ' ★選択' : ''}`,
    '',
    `- 一文企画: ${concept.oneLiner}`,
    `- 狙い: ${concept.aim}`,
    `- 世界観: ${concept.world}`,
    `- 主な映像表現: ${concept.mainVisuals.join(' / ')}`,
    `- 冒頭3秒: ${concept.opening3s}`,
    `- サビの見せ場: ${concept.chorusHighlight}`,
    `- ラスト: ${concept.ending}`,
    `- 難易度: ${DIFFICULTY_META[concept.difficulty].label} / 予算区分: ${BUDGET_META[concept.budgetTier].label} / 制作時間: ${concept.timeEstimate}`,
    `- 向いている媒体: ${concept.suitableMedia.join('、')}`,
  ]
  return lines.join('\n')
}

function bulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join('\n')
}

function consistencyBlock(detail: MvPlanDetail): string {
  const c = detail.consistency
  return bulletList([
    `登場人物: ${c.characters}`,
    `年齢層: ${c.ageRange}`,
    `髪型: ${c.hair}`,
    `衣装: ${c.outfit}`,
    `表情: ${c.expression}`,
    `舞台: ${c.stage}`,
    `時代: ${c.era}`,
    `色: ${c.colors}`,
    `光: ${c.light}`,
    `レンズ感: ${c.lens}`,
    `映像の質感: ${c.texture}`,
    `禁止事項: ${c.forbidden}`,
  ])
}

/** 企画全体をMarkdownにする(結果画面と同じ順序) */
export function resultToMarkdown(
  input: MvIdeaInput,
  result: MvIdeaResult,
  meta: MvIdeaExportMeta,
): string {
  const detail = result.detail
  const parts: string[] = []
  parts.push(`# MV企画書: ${detail?.conceptTitle ?? input.title}`)
  parts.push('')
  parts.push(
    bulletList([
      `曲名: ${input.title}`,
      `対象曲: ${meta.songTitle}`,
      `生成日時: ${meta.createdAt}`,
      `企画モード: ${modeLabel(input)}`,
      `生成エンジン: ${meta.providerName}`,
    ]),
  )

  parts.push('', '## 1. 企画案(3案)', '')
  result.concepts.forEach((c, i) => {
    parts.push(conceptBlock(c, c.id === result.selectedConceptId, i), '')
  })

  if (result.conversionNotes.length > 0) {
    parts.push('## 固有名詞の変換メモ', '', bulletList(result.conversionNotes), '')
  }

  if (!detail) {
    parts.push('---', '', '(詳細企画書は未生成です。案を1つ選んで展開してください)')
    return parts.join('\n')
  }

  parts.push('## 2. 選択した企画の全体像', '')
  parts.push(
    bulletList([
      `企画タイトル: ${detail.conceptTitle}`,
      `企画概要: ${detail.overview}`,
      `狙い: ${detail.aim}`,
      `想定視聴者: ${detail.audience}`,
      `想定尺: ${formatSec(detail.durationSec)}(${detail.orientation === 'vertical' ? '縦型9:16' : '横型16:9'})`,
      `制作難易度: ${DIFFICULTY_META[detail.difficulty].label}`,
      `制作時間の目安: ${detail.timeEstimate}`,
      `予算区分: ${BUDGET_META[detail.budgetTier].label}`,
    ]),
  )

  parts.push('', '## 3. 世界観設定', '')
  parts.push(
    bulletList([
      `世界観: ${detail.world}`,
      `色と光: ${detail.colorAndLight}`,
      `登場人物: ${detail.characters}`,
      `舞台: ${detail.stage}`,
    ]),
  )
  parts.push('', '### 物語の流れ', '', bulletList(detail.storyFlow))
  parts.push(
    '',
    bulletList([
      `冒頭3秒: ${detail.opening3s}`,
      `サビの見せ場: ${detail.chorusHighlight}`,
      `ラストシーン: ${detail.lastScene}`,
    ]),
  )

  parts.push('', '## 4. 時系列の構成', '')
  parts.push('| 区間 | 開始 | 終了 | 内容 |')
  parts.push('| --- | --- | --- | --- |')
  for (const block of detail.timeline) {
    parts.push(`| ${block.label} | ${formatSec(block.startSec)} | ${formatSec(block.endSec)} | ${block.summary} |`)
  }

  parts.push('', '## 5. ショットリスト', '')
  for (const shot of detail.shots) {
    const blockLabel = shot.block ? `[${shot.block}] ` : ''
    parts.push(
      `### ${shotNo(shot)} ${blockLabel}${formatSec(shot.startSec)}〜${formatSec(shot.endSec)}(${shotSeconds(shot)}秒)`,
      '',
    )
    parts.push(
      bulletList(
        [
          `場面説明: ${shot.scene}`,
          shot.lyricText ? `表示する歌詞: ${shot.lyricText}` : '',
          `カメラ構図: ${shot.composition}`,
          `カメラの動き: ${shot.cameraMove}`,
          `被写体の動き: ${shot.subjectMove}`,
          `背景: ${shot.background}`,
          `光: ${shot.light}`,
          `必要素材: ${shot.assets}`,
          `編集メモ: ${shot.editMemo}`,
        ].filter(Boolean),
      ),
      '',
    )
  }

  parts.push('## 6. 画像生成プロンプト', '')
  for (const shot of detail.shots) {
    parts.push(`- ${shotNo(shot)}: \`${shot.imagePrompt}\``)
  }

  parts.push('', '## 7. 動画生成プロンプト', '')
  for (const shot of detail.shots) {
    parts.push(`- ${shotNo(shot)}: \`${shot.videoPrompt}\``)
    parts.push(`  - ネガティブ: \`${shot.negativePrompt}\``)
  }

  parts.push('', '## 8. 必要素材', '', bulletList(detail.requiredAssets))
  parts.push('', '## 9. 制作チェックリスト', '', detail.checklist.map((c, i) => `${i + 1}. ${c}`).join('\n'))
  parts.push('', '## 10. サムネイル案', '', bulletList(detail.thumbnailIdeas))
  parts.push('', '## 11. Shorts転用案', '', bulletList(detail.shortsIdeas))
  parts.push('', '## 12. 一貫性設定', '', consistencyBlock(detail))
  parts.push('', '### 編集メモ(全体)', '', bulletList(detail.editNotes))
  parts.push('')
  return parts.join('\n')
}

/** JSON書き出し(入力+結果をまるごと。再取り込みや他ツール連携用) */
export function resultToJson(
  input: MvIdeaInput,
  result: MvIdeaResult,
  meta: MvIdeaExportMeta,
): string {
  return JSON.stringify(
    {
      tool: 'mv-idea',
      version: 1,
      exportedAt: new Date().toISOString(),
      meta,
      input,
      result,
    },
    null,
    2,
  )
}

const CSV_HEADERS = [
  'ショット番号',
  '区間',
  '開始時間',
  '終了時間',
  '秒数',
  '場面説明',
  '表示する歌詞',
  'カメラ構図',
  'カメラの動き',
  '被写体の動き',
  '背景',
  '光',
  '画像生成プロンプト',
  '動画生成プロンプト',
  'ネガティブプロンプト',
  '必要素材',
  '編集メモ',
]

/**
 * CSVの数式インジェクション対策。
 * `=` `+` `-` `@` やタブ/CRで始まるセルは、Excel・Googleスプレッドシート・Numbersが
 * 数式として解釈し、外部通信(=HYPERLINK等)やコマンド実行に悪用されうる。
 * 書き出したCSVは共同制作者へ渡す前提なので、先頭にシングルクォートを足して
 * 「文字列」であることを明示する(表示上の値は変わらない)。
 */
function neutralizeFormula(s: string): string {
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
}

function csvCell(value: string | number): string {
  // 数値はそのまま(先頭が - でも数値として正しく読ませたい)
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '0'
  const s = neutralizeFormula(String(value))
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** ショット一覧をCSVにする(Excel互換: 先頭BOM+CRLF) */
export function shotsToCsv(shots: MvShot[]): string {
  const BOM = '\uFEFF'
  const rows = [CSV_HEADERS.map(csvCell).join(',')]
  for (const shot of shots) {
    rows.push(
      [
        shotNo(shot),
        shot.block ?? '',
        formatSec(shot.startSec),
        formatSec(shot.endSec),
        shotSeconds(shot),
        shot.scene,
        shot.lyricText ?? '',
        shot.composition,
        shot.cameraMove,
        shot.subjectMove,
        shot.background,
        shot.light,
        shot.imagePrompt,
        shot.videoPrompt,
        shot.negativePrompt,
        shot.assets,
        shot.editMemo,
      ]
        .map(csvCell)
        .join(','),
    )
  }
  return `${BOM}${rows.join('\r\n')}\r\n`
}

/** MVプロンプト欄へ保存する用: 全ショットの動画プロンプトをまとめる */
export function makeCombinedVideoPrompt(detail: MvPlanDetail): string {
  return detail.shots
    .map(
      (shot) =>
        `【${shotNo(shot)}|${formatSec(shot.startSec)}〜${formatSec(shot.endSec)}】${shot.videoPrompt}`,
    )
    .join('\n')
}

/** MVメモ(企画概要)へ保存する用のテキスト */
export function makePlanMemoText(detail: MvPlanDetail): string {
  return [
    `■ 企画: ${detail.conceptTitle}`,
    `概要: ${detail.overview}`,
    `狙い: ${detail.aim}`,
    `世界観: ${detail.world}`,
    `色と光: ${detail.colorAndLight}`,
    `冒頭3秒: ${detail.opening3s}`,
    `サビの見せ場: ${detail.chorusHighlight}`,
    `ラストシーン: ${detail.lastScene}`,
    `尺: ${formatSec(detail.durationSec)}(${detail.orientation === 'vertical' ? '縦型' : '横型'})/ ショット${detail.shots.length}件`,
  ].join('\n')
}

/** Windowsで使えない予約名(拡張子を付けても作成できない) */
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

/**
 * ファイル名を安全にする。
 * パス区切り・親ディレクトリ参照(..)・制御文字・予約名・過長を排除し、
 * ダウンロード先が意図しない場所になったり保存に失敗したりするのを防ぐ。
 */
export function sanitizeFilename(name: string): string {
  const cleaned = String(name ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[\\/:*?"<>|\s]+/g, '-')
    .replace(/\.+/g, '.') // 「..」によるパス遡上を潰す
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80)
  if (!cleaned || RESERVED_NAMES.test(cleaned)) return 'mv-plan'
  return cleaned
}

/** テキストをファイルとしてダウンロードする(ブラウザ専用) */
export function downloadTextFile(filename: string, content: string, mime: string): void {
  if (typeof document === 'undefined') return
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  try {
    a.click()
  } finally {
    a.remove()
    // 即時revokeするとFirefox/Safariでダウンロードが中断されることがあるため遅延させる
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}
