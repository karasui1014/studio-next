#!/usr/bin/env node
/**
 * public/content/home.json から Premium 限定の「中身」を抜き出し、
 * 非公開の content/premium.json へ移す一度きりの移行スクリプト。
 *
 * ■ なぜ必要か
 * public/ に置いたものは、ログインの有無に関係なく誰でもURLで取得できる。
 * 画面側でぼかしても、JSONを直接開けば本文が読めてしまう。
 * 「Premium限定」と表示して課金する以上、中身は公開領域に置いてはいけない。
 *
 * ■ 分離の原則
 *   public/content/home.json … 無料で見せてよいものだけ（＋ロック表示用のメタ情報）
 *   content/premium.json      … 課金者にだけ返す本文。Worker からのみ配信する
 *
 * 実行:  node scripts/split-premium-content.mjs
 * 冪等:  2回目以降は「すでに分離済み」と表示して何もしない
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const publicHome = resolve(root, 'public/content/home.json')
const privateOut = resolve(root, 'content/premium.json')

const home = JSON.parse(readFileSync(publicHome, 'utf8'))

const premium = {
  _comment:
    'Premium/Master 限定の本文。public/ に置かないこと。Worker からのみ配信する。',
  generatedAt: new Date().toISOString(),
  prompts: {},
  picks: {},
  pickNotes: {},
}

let moved = 0

// ① プロンプト本文（premium: true のものだけ）
for (const p of home.prompts ?? []) {
  if (p.premium === true && p.text) {
    premium.prompts[p.id] = { text: p.text }
    p.text = '' // 公開側からは本文を消す。title と premium フラグは残す（ロック表示に要る）
    moved++
  }
}

// ② 手書き Pick の全文（free は無料なので残す）
for (const k of home.picks ?? []) {
  if (k.premium) {
    premium.picks[k.id] = { premium: k.premium }
    delete k.premium
    moved++
  }
}

// ③ 制作メモ（丸ごと非公開へ。公開側には「どの記事にメモがあるか」だけ残す）
if (home.pickNotes && Object.keys(home.pickNotes).length > 0) {
  premium.pickNotes = home.pickNotes
  moved += Object.keys(home.pickNotes).length
  // ロック表示に必要なのは「存在するかどうか」だけ。本文は渡さない
  home.pickNoteIds = Object.keys(home.pickNotes)
  delete home.pickNotes
}

if (moved === 0) {
  console.log('すでに分離済みです。変更はありません。')
  process.exit(0)
}

mkdirSync(dirname(privateOut), { recursive: true })
if (existsSync(privateOut)) {
  // 既存の非公開ファイルは壊さない。マージする
  const prev = JSON.parse(readFileSync(privateOut, 'utf8'))
  premium.prompts = { ...prev.prompts, ...premium.prompts }
  premium.picks = { ...prev.picks, ...premium.picks }
  premium.pickNotes = { ...prev.pickNotes, ...premium.pickNotes }
}

writeFileSync(privateOut, JSON.stringify(premium, null, 2) + '\n')
writeFileSync(publicHome, JSON.stringify(home, null, 2) + '\n')

console.log(`✅ ${moved}件のPremium本文を公開JSONから分離しました`)
console.log(`   公開   : public/content/home.json`)
console.log(`   非公開 : content/premium.json`)
