#!/usr/bin/env node
/**
 * 特定のライセンスキーが「いつまで使われ続ける可能性があるか」を確認する。
 *
 * ■ なぜ必要か
 * セッションの有効期限は30日（session.ts）。退会を確認して失効させても、
 * 直前にログインし直されていた場合、そのセッションは失効操作と無関係に
 * 最大30日は動き続ける（トークンを無効化する仕組みが無いため）。
 * 「いつ聞かれても正確に答えられる」ようにするための確認コマンド。
 *
 * 使い方:
 *   node scripts/check-license-expiry.mjs M-003 --prod
 *
 * 表示する日付は目安の上限であって、保証ではない。
 * 一度も再ログインされていなければ発行日を起点に計算する。
 */
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { readLedger } from './license-ledger.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const workerDir = resolve(root, 'worker/api')

const args = process.argv.slice(2)
const isProd = args.includes('--prod')
const serial = args.find((a) => /^[PM]-\d{3}$/.test(a))

if (!serial) {
  console.error('使い方: node scripts/check-license-expiry.mjs <連番> [--prod]')
  console.error('  例:   node scripts/check-license-expiry.mjs M-003 --prod')
  process.exit(1)
}

const wrangler = (a) =>
  execFileSync('npx', ['wrangler', ...a], { cwd: workerDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const scope = isProd ? '--remote' : '--local'

const { rows } = readLedger()
const row = rows.find((r) => r.serial === serial)
if (!row) {
  console.error(`❌ 台帳に ${serial} が見つかりません。`)
  process.exit(1)
}

let hash
try {
  hash = wrangler(['kv', 'key', 'get', '--binding', 'ROSTER_KV', scope, `serial:${serial}`]).trim()
} catch {
  console.error(`❌ KVに索引 serial:${serial} がありません（発行がこの仕組みより前の可能性）。`)
  process.exit(1)
}

let rec
try {
  rec = JSON.parse(wrangler(['kv', 'key', 'get', '--binding', 'ROSTER_KV', scope, `license:${hash}`]))
} catch {
  console.error(`❌ KVにライセンス本体が見つかりません。`)
  process.exit(1)
}

const TTL_DAYS = 30
// 最終ログインが記録されていればそこを起点に、無ければ発行日を起点にする
const baseline = rec.lastLoginAt ?? rec.issuedAt
const expiresAt = baseline ? new Date(new Date(baseline).getTime() + TTL_DAYS * 86400000) : null

console.log(`\n=== ${serial}（${row.applicant}）===\n`)
console.log(`  プラン       : ${rec.role}`)
console.log(`  台帳の状態   : ${row.state}${row.state === '失効' ? `（${row.revokedAt}）` : ''}`)
console.log(`  発行日       : ${rec.issuedAt ?? '(記録なし)'}`)
console.log(`  最終ログイン : ${rec.lastLoginAt ?? '(まだ一度もログインしていません)'}`)

if (rec.revoked) {
  console.log(`\n  ⚠️ このキーは失効済みです。新しいログインはできません。`)
  console.log(`     ただし失効前に発行済みのセッションが残っていれば、`)
  console.log(`     以下の日付までは動く可能性があります:`)
}

if (expiresAt) {
  const days = Math.ceil((expiresAt - new Date()) / 86400000)
  console.log(`\n  📅 最大で ${expiresAt.toLocaleDateString('ja-JP')} まで有効な可能性があります`)
  console.log(`     （${days >= 0 ? `残り約${days}日` : `${-days}日前に経過`}）`)
  console.log(`\n  ※ これは上限の目安です。ログインし直されていなければ、もっと早く切れます。`)
} else {
  console.log(`\n  ⚠️ 発行日・ログイン記録のいずれも無く、期限を計算できません。`)
}
console.log()
