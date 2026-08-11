#!/usr/bin/env node
/**
 * 限定コンテンツ（content/premium.json）を Cloudflare KV へ投入する。
 *
 * ■ なぜ Worker に埋め込まないのか
 * 埋め込むと、①内容を直すたびに Worker の再デプロイが要る
 * ②手元にファイルが無い環境（CI）からデプロイすると内容が消える、という事故が起きる。
 * KV に置けば Worker を何度デプロイしても内容は残り、内容だけを単独で差し替えられる。
 *
 * 使い方:
 *   node scripts/push-premium-content.mjs           # 本番KVへ投入
 *   node scripts/push-premium-content.mjs --local   # ローカル(wrangler dev)のKVへ
 *   node scripts/push-premium-content.mjs --check   # 投入せず、本番の現状だけ確認
 *
 * 投入後は /api/health の contentLoaded と updatedAt で反映を確認できる。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = resolve(root, 'content/premium.json')
const workerDir = resolve(root, 'worker/api')
const KEY = 'premium:content'

const isLocal = process.argv.includes('--local')
const checkOnly = process.argv.includes('--check')

function wrangler(args) {
  return execFileSync('npx', ['wrangler', ...args], {
    cwd: workerDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

if (checkOnly) {
  try {
    const out = wrangler(['kv', 'key', 'get', '--binding', 'ROSTER_KV', ...(isLocal ? ['--local'] : ['--remote']), KEY])
    const d = JSON.parse(out)
    console.log('✅ KVに限定コンテンツが入っています')
    console.log(`   更新日時   : ${d.updatedAt ?? '(不明)'}`)
    console.log(`   プロンプト : ${Object.keys(d.prompts ?? {}).length}件`)
    console.log(`   Pick全文   : ${Object.keys(d.picks ?? {}).length}件`)
    console.log(`   制作メモ   : ${Object.keys(d.pickNotes ?? {}).length}件`)
  } catch {
    console.error('❌ KVに限定コンテンツがありません。投入してください:')
    console.error('   node scripts/push-premium-content.mjs')
    process.exit(1)
  }
  process.exit(0)
}

if (!existsSync(src)) {
  console.error(`❌ ${src} がありません。`)
  console.error('   このファイルは Git管理外です。バックアップから戻すか、作り直してください。')
  process.exit(1)
}

const data = JSON.parse(readFileSync(src, 'utf8'))
data.updatedAt = new Date().toISOString()

const counts = {
  prompts: Object.keys(data.prompts ?? {}).length,
  picks: Object.keys(data.picks ?? {}).length,
  pickNotes: Object.keys(data.pickNotes ?? {}).length,
}
if (counts.prompts + counts.picks + counts.pickNotes === 0) {
  console.error('❌ 中身が空です。誤って空のファイルを投入すると、限定コンテンツが消えます。中止しました。')
  process.exit(1)
}

// 一時ファイル経由で渡す（巨大なJSONをコマンドライン引数に載せないため）
const tmp = resolve(workerDir, '.premium-upload.tmp.json')
writeFileSync(tmp, JSON.stringify(data))
try {
  wrangler([
    'kv', 'key', 'put',
    '--binding', 'ROSTER_KV',
    ...(isLocal ? ['--local'] : ['--remote']),
    KEY, '--path', tmp,
  ])
  console.log(`✅ ${isLocal ? 'ローカル' : '本番'}KVへ投入しました`)
  console.log(`   プロンプト ${counts.prompts}件 / Pick全文 ${counts.picks}件 / 制作メモ ${counts.pickNotes}件`)
  console.log(`   更新日時: ${data.updatedAt}`)
} finally {
  unlinkSync(tmp)
}
