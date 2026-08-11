#!/usr/bin/env node
/**
 * 個別ライセンスキーを発行し、KVへ登録して台帳に記録する。
 *
 * 使い方:
 *   node scripts/issue-license-key.mjs premium --name "YouTube表示名" --prod
 *   node scripts/issue-license-key.mjs master  --name "YouTube表示名" --prod
 *   node scripts/issue-license-key.mjs --status          # 発行状況だけ見る
 *
 *   --prod を付けないとローカル(wrangler dev)のKVに入る。本番は --prod。
 *
 *   --note "PremiumのP-003から変更"  … 台帳の備考に書き足す（任意）。
 *   プラン変更（Premium→Master等）で新規キーを発行するときに、
 *   どのキーからの移行かを残すために使う。省略時は従来どおり。
 *
 * ■ 1人1キー
 * 共通キーは作らない。流出したとき、その人の分だけ失効させられるようにするため。
 * YouTubeのメンバー限定投稿にキーそのものを載せてはいけない（全員同じキーになる）。
 *
 * ■ 生のキーは保存しない
 * KVに入れるのは SHA-256(キー + pepper) だけ。台帳にも書かない。
 * 発行時にこの画面へ一度出るだけなので、その場で控えて本人に送る。
 *
 * ■ Master は30名で機械的に止まる
 * 警告ではなくエラーで停止する。上限が形骸化すると添削が破綻し、
 * 「反応が遅い」という最悪の解約理由を生むため。
 */
import { createHash, randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  appendRow,
  checkMasterLimit,
  nextSerial,
  readLedger,
  summarize,
} from './license-ledger.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const workerDir = resolve(root, 'worker/api')
const devVars = resolve(workerDir, '.dev.vars')

const args = process.argv.slice(2)
const isProd = args.includes('--prod')

// ---- 発行状況の確認だけ ----------------------------------------
if (args.includes('--status')) {
  const { rows } = readLedger()
  const s = summarize(rows)
  console.log('\n=== ライセンス発行状況 ===\n')
  console.log(`  Premium : 有効 ${s.premium.active}名（失効 ${s.premium.revoked} / 累計 ${s.premium.total}）`)
  console.log(`  Master  : 有効 ${s.master.active}名（失効 ${s.master.revoked} / 累計 ${s.master.total}）`)
  console.log(`            上限 ${s.master.limit}名 — 残り ${s.master.remaining}枠`)
  if (s.master.remaining <= 0) console.log('            ⚠️ 上限に達しています。新規発行はできません')
  else if (s.master.remaining <= 5) console.log(`            ⚠️ 残りわずかです`)
  console.log()
  process.exit(0)
}

const role = args[0]
if (role !== 'premium' && role !== 'master') {
  console.error('使い方:')
  console.error('  node scripts/issue-license-key.mjs <premium|master> --name "表示名" [--prod]')
  console.error('  node scripts/issue-license-key.mjs --status')
  process.exit(1)
}

const nameIdx = args.indexOf('--name')
const applicant = nameIdx >= 0 ? args[nameIdx + 1] : ''
if (!applicant) {
  console.error('❌ --name で申請者（YouTube表示名）を指定してください。')
  console.error('   台帳に「誰に渡したか」が残らないと、退会時に失効させられません。')
  process.exit(1)
}

const noteIdx = args.indexOf('--note')
const customNote = noteIdx >= 0 ? args[noteIdx + 1] : ''

// ---- Master 30名上限（機械的に停止）-----------------------------
const { rows } = readLedger()
const limit = checkMasterLimit(rows, role)
if (!limit.ok) {
  console.error(`\n❌ ${limit.message}\n`)
  process.exit(1)
}

// ---- pepper（値は表示しない）------------------------------------
let pepper = process.env.LICENSE_PEPPER ?? ''
if (!pepper && !isProd && existsSync(devVars)) {
  const m = /^LICENSE_PEPPER\s*=\s*"?(.*?)"?\s*$/m.exec(readFileSync(devVars, 'utf8'))
  if (m) pepper = m[1]
}
if (!pepper) {
  console.error(
    isProd
      ? '本番用は LICENSE_PEPPER を環境変数で渡してください:\n' +
        '  LICENSE_PEPPER=xxx node scripts/issue-license-key.mjs premium --name "..." --prod'
      : 'worker/api/.dev.vars に LICENSE_PEPPER がありません。',
  )
  process.exit(1)
}

/** 読み上げやすさ優先。紛らわしい 0/O/1/I は使わない */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function makeKey() {
  let s = ''
  for (const b of randomBytes(20)) s += ALPHABET[b % ALPHABET.length]
  return s.match(/.{1,5}/g).join('-')
}
const normalize = (k) => k.trim().toUpperCase().replace(/\s+/g, '').replace(/-/g, '')

const serial = nextSerial(rows, role)
const key = makeKey()
const hash = createHash('sha256').update(`${normalize(key)}:${pepper}`).digest('hex')

// ---- KVへ登録（氏名は入れない）----------------------------------
const value = JSON.stringify({ role, serial, issuedAt: new Date().toISOString() })
const kvPut = (k, v) =>
  execFileSync(
    'npx',
    [
      'wrangler', 'kv', 'key', 'put',
      '--binding', 'ROSTER_KV',
      isProd ? '--remote' : '--local',
      k, v,
    ],
    { cwd: workerDir, stdio: ['ignore', 'ignore', 'pipe'] },
  )

try {
  kvPut(`license:${hash}`, value)
  // 連番 → ハッシュ の索引。
  // 生のキーは誰も保存していないので、これが無いと失効時に対象を特定できない。
  // 索引にも氏名は入れない（ハッシュだけ）。
  kvPut(`serial:${serial}`, hash)
} catch (e) {
  console.error('❌ KVへの登録に失敗しました。台帳には追記していません。')
  console.error(String(e.stderr ?? e).slice(0, 500))
  process.exit(1)
}

// ---- 台帳へ追記（KV登録が成功してから）---------------------------
// 環境を必ず残す。ローカル検証の行が本番と混ざると、
// 毎月の棚卸しで実在しない会員を追いかけることになる。
const localWarning = '⚠️ ローカル検証用（本番KVには存在しません）'
const note = isProd
  ? customNote
  : customNote ? `${localWarning} / ${customNote}` : localWarning

appendRow({ serial, plan: role, applicant, note })

const s = summarize(readLedger().rows)

console.log(`\n=== ${serial} を発行しました（${isProd ? '本番' : 'ローカル'}）===\n`)
console.log(`  申請者 : ${applicant}`)
console.log(`  プラン : ${role}`)
console.log()
console.log(`  🔑 ${key}`)
console.log()
console.log('  ⚠️ このキーが表示されるのは今回だけです。控えてから閉じてください。')
console.log('  ⚠️ 本人にだけ送ってください。メンバー限定投稿に載せると全員が同じキーを見ることになります。')
console.log()
console.log(`  台帳: ~/軍配/ledgers/LICENSES.md に ${serial} を追記しました`)
if (role === 'master') {
  console.log(`  Master: 有効 ${s.master.active}名 / 上限 ${s.master.limit}名（残り ${s.master.remaining}枠）`)
}
console.log()
console.log(`  失効させるとき: node scripts/revoke-license-key.mjs ${serial}${isProd ? ' --prod' : ''}`)
console.log()
