#!/usr/bin/env node
/**
 * ライセンスキーを失効させる。毎月1日の棚卸しで使う。
 *
 * 使い方:
 *   node scripts/revoke-license-key.mjs M-003 --prod
 *   node scripts/revoke-license-key.mjs P-012            # ローカル
 *
 *   --note "MasterのM-004へ変更のため失効"  … 台帳の備考に書き足す（任意）。
 *
 * ■ 生のキーは誰も持っていない
 * KVにはハッシュしか無く、台帳にもキーは書いていない。
 * そこで発行時に作った索引（serial:<連番> → ハッシュ）から対象を引く。
 *
 * ■ 行は消さない
 * 台帳の該当行は残したまま、状態を「失効」に、失効日を記入する。
 * 「誰にいつ渡して、いつ切ったか」の履歴自体が運用の資産になるため。
 *
 * ■ 失効は即時ではない
 * 失効後は新しいセッションが発行されなくなるが、
 * すでに発行済みのセッションは最大30日有効（セッションのTTL。2026-08-10変更）。
 * つまり反映まで最大30日かかりうる。正確な期限は
 * scripts/check-license-expiry.mjs で個別に確認できる。
 */
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { readLedger, revokeRow, summarize } from './license-ledger.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const workerDir = resolve(root, 'worker/api')

const args = process.argv.slice(2)
const isProd = args.includes('--prod')
const serial = args.find((a) => /^[PCM]-\d{3}$/.test(a))
const noteIdx = args.indexOf('--note')
const customNote = noteIdx >= 0 ? args[noteIdx + 1] : ''

if (!serial) {
  console.error('使い方: node scripts/revoke-license-key.mjs <連番> [--prod]')
  console.error('  例:   node scripts/revoke-license-key.mjs M-003 --prod')
  console.error('  連番は ~/軍配/ledgers/LICENSES.md で確認できます。')
  process.exit(1)
}

const wrangler = (args2) =>
  execFileSync('npx', ['wrangler', ...args2], {
    cwd: workerDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

const scope = isProd ? '--remote' : '--local'

// ---- 台帳で対象を確認（KVを触る前に）-----------------------------
const { rows } = readLedger()
const target = rows.find((r) => r.serial === serial)
if (!target) {
  console.error(`❌ 台帳に ${serial} が見つかりません。連番を確認してください。`)
  process.exit(1)
}
if (target.state === '失効') {
  console.log(`ℹ️ ${serial} はすでに失効済みです（${target.revokedAt}）。何もしませんでした。`)
  process.exit(0)
}

console.log(`\n=== ${serial} を失効させます（${isProd ? '本番' : 'ローカル'}）===`)
console.log(`  申請者 : ${target.applicant}`)
console.log(`  プラン : ${target.plan}`)
console.log(`  発行日 : ${target.issuedAt}\n`)

// ---- 索引からハッシュを引く ---------------------------------------
let hash
try {
  hash = wrangler(['kv', 'key', 'get', '--binding', 'ROSTER_KV', scope, `serial:${serial}`]).trim()
} catch {
  console.error(`❌ KVに索引 serial:${serial} がありません。`)
  console.error('   この連番は、索引を作る前のバージョンで発行された可能性があります。')
  console.error('   その場合は Cloudflare のダッシュボードから license:* を探して手で revoked:true にしてください。')
  process.exit(1)
}

// ---- 失効フラグを立てる（キーは消さない）--------------------------
// 削除ではなく revoked:true にするのは、
// 「一度も存在しなかった」と「失効した」を区別できるようにするため。
let current
try {
  current = JSON.parse(wrangler(['kv', 'key', 'get', '--binding', 'ROSTER_KV', scope, `license:${hash}`]))
} catch {
  console.error(`❌ KVに license:${hash.slice(0, 12)}… がありません。`)
  process.exit(1)
}

const updated = JSON.stringify({ ...current, revoked: true, revokedAt: new Date().toISOString() })
try {
  execFileSync(
    'npx',
    ['wrangler', 'kv', 'key', 'put', '--binding', 'ROSTER_KV', scope, `license:${hash}`, updated],
    { cwd: workerDir, stdio: ['ignore', 'ignore', 'pipe'] },
  )
} catch (e) {
  console.error('❌ KVの更新に失敗しました。台帳は変更していません。')
  console.error(String(e.stderr ?? e).slice(0, 400))
  process.exit(1)
}

// ---- 台帳を更新（KV更新が成功してから）----------------------------
const res = revokeRow(serial, customNote)
if (!res.ok) {
  console.error(`⚠️ KVは失効させましたが、台帳の更新に失敗しました（${res.reason}）。`)
  console.error('   台帳の該当行を手で「失効」にしてください。')
  process.exit(1)
}

const s = summarize(readLedger().rows)
console.log(`✅ ${serial} を失効させました`)
console.log(`   台帳: 状態を「失効」に更新しました`)
if (target.plan === 'master') {
  console.log(`   Master: 有効 ${s.master.active}名 / 上限 ${s.master.limit}名（残り ${s.master.remaining}枠）`)
}
console.log()
console.log('   この人は次にStudioを開いた時点で無料プランに戻ります。')
console.log('   （KVの反映に1分ほどかかります。開きっぱなしの画面は再読み込みで切り替わります）')
console.log()
console.log('   ⚠️ 2026-09-18ごろまでの経過措置：')
console.log('      失効の即時反映より前にキーを入れた人は、従来どおり最大30日残ります。')
console.log(`      残り期間: node scripts/check-license-expiry.mjs ${serial}${isProd ? ' --prod' : ''}`)
console.log()
