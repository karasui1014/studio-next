/**
 * ライセンス台帳（~/軍配/ledgers/LICENSES.md）の読み書き。
 *
 * ■ なぜリポジトリの外に置くか
 * studio-next リポジトリは Public。中に置くと申請者の氏名が公開される。
 * 台帳は運営者のMac上だけに存在し、Gitにもサーバーにも上げない。
 *
 * ■ KVとの役割分担
 *   KV     : キーのハッシュ → { role, serial }   ← 誰かは知らない
 *   この台帳 : 連番 → 申請者                      ← 誰かを知っている
 * 分けているのは、KVが漏れても個人が特定できないようにするため。
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'

export const LEDGER_PATH = resolve(homedir(), '軍配/ledgers/LICENSES.md')

/** Master の人数上限。ここを超える発行はスクリプトが拒否する */
export const MASTER_LIMIT = 30

const PREFIX = { premium: 'P', master: 'M' }

/** 表の行。書式が崩れると読めなくなるので、パターンは1箇所にまとめる */
const ROW_RE = /^\|\s*([PM]-\d{3})\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|$/

export function readLedger() {
  if (!existsSync(LEDGER_PATH)) {
    throw new Error(
      `台帳がありません: ${LEDGER_PATH}\n` +
        'バックアップから戻すか、雛形を作り直してください。',
    )
  }
  const text = readFileSync(LEDGER_PATH, 'utf8')
  const rows = []
  for (const line of text.split('\n')) {
    const m = ROW_RE.exec(line.trim())
    if (!m) continue
    rows.push({
      serial: m[1],
      plan: m[2],
      issuedAt: m[3],
      applicant: m[4],
      state: m[5],
      revokedAt: m[6],
      note: m[7],
      raw: line,
    })
  }
  return { text, rows }
}

/** 次の連番を決める。欠番は埋めない（連番＝発行順の記録なので） */
export function nextSerial(rows, role) {
  const p = PREFIX[role]
  const used = rows
    .filter((r) => r.serial.startsWith(`${p}-`))
    .map((r) => Number(r.serial.slice(2)))
  const next = used.length === 0 ? 1 : Math.max(...used) + 1
  return `${p}-${String(next).padStart(3, '0')}`
}

/**
 * Master の上限チェック。
 * **失効した分は枠を返す**（退会者の枠を新しい人に回せないと運用が詰まるため）。
 * 判定するのは「いま有効な Master が何人か」。
 */
export function checkMasterLimit(rows, role) {
  if (role !== 'master') return { ok: true }
  const active = rows.filter((r) => r.serial.startsWith('M-') && r.state === '有効').length
  if (active >= MASTER_LIMIT) {
    return {
      ok: false,
      active,
      message:
        `Master は上限${MASTER_LIMIT}名です。現在の有効数が ${active} 名のため発行できません。\n` +
        '   退会者がいる場合は先に失効させてください:\n' +
        '     node scripts/revoke-license-key.mjs <連番> --prod',
    }
  }
  return { ok: true, active }
}

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * 台帳の表に1行足す。ヘッダー直下（＝新しいものが上）に入れる。
 *
 * `note` には**どの環境で発行したか**を必ず書く。
 * ローカル検証用の行が本番の行と混ざると、毎月の棚卸しで
 * 「この人は誰だ？」となり、実在しない会員を追いかけることになる。
 */
export function appendRow({ serial, plan, applicant, note = '' }) {
  const { text } = readLedger()
  const row = `| ${serial} | ${plan} | ${today()} | ${applicant} | 有効 | — | ${note} |`
  const marker = '|---|---|---|---|---|---|---|'
  if (!text.includes(marker)) {
    throw new Error('台帳の表が見つかりません。書式が壊れている可能性があります。')
  }
  writeFileSync(LEDGER_PATH, text.replace(marker, `${marker}\n${row}`))
  return row
}

/** 指定の連番を失効にする。行は消さず、状態と失効日を書き換える */
export function revokeRow(serial) {
  const { text, rows } = readLedger()
  const target = rows.find((r) => r.serial === serial)
  if (!target) return { ok: false, reason: 'not_found' }
  if (target.state === '失効') return { ok: false, reason: 'already_revoked', row: target }

  const updated = `| ${target.serial} | ${target.plan} | ${target.issuedAt} | ${target.applicant} | 失効 | ${today()} | ${target.note} |`
  writeFileSync(LEDGER_PATH, text.replace(target.raw, updated))
  return { ok: true, row: target, updated }
}

/** 発行状況の集計 */
export function summarize(rows) {
  const count = (p, state) =>
    rows.filter((r) => r.serial.startsWith(`${p}-`) && (!state || r.state === state)).length
  return {
    premium: { total: count('P'), active: count('P', '有効'), revoked: count('P', '失効') },
    master: {
      total: count('M'),
      active: count('M', '有効'),
      revoked: count('M', '失効'),
      limit: MASTER_LIMIT,
      remaining: MASTER_LIMIT - count('M', '有効'),
    },
  }
}
