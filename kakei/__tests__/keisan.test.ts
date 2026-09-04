/**
 * 家計ダッシュボードの計算をテストする。
 *
 * アプリは index.html 1枚で完結していて import できないので、
 * 中の名前つき関数だけを取り出して評価する。表示の作りが変わっても、
 * 完済予定・利息・金額の書き方が変わっていないことはここで固定される。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8')

/** function NAME( から、対応する } までを切り出す */
function grab(name: string): string {
  const head = html.indexOf(`function ${name}(`)
  if (head < 0) throw new Error(`関数が見つからない: ${name}`)
  let i = html.indexOf('{', head)
  let depth = 0
  for (let j = i; j < html.length; j++) {
    if (html[j] === '{') depth++
    else if (html[j] === '}') {
      depth--
      if (depth === 0) return html.slice(head, j + 1)
    }
  }
  throw new Error(`閉じ括弧が見つからない: ${name}`)
}

const src = ['num', 'man', 'payoff', 'yearsText', 'pad2', 'ymPlus'].map(grab).join('\n')
const api = new Function(`${src}; return { num, man, payoff, yearsText, ymPlus };`)() as {
  num: (v: unknown) => number
  man: (v: number) => string
  payoff: (b: number, m: number, r: number) => { months: number; interest: number; ok: boolean; done?: boolean; why?: string }
  yearsText: (m: number) => string
  ymPlus: (m: number) => string
}

describe('num', () => {
  it('数字でないものは 0 になる', () => {
    expect(api.num('12.5')).toBe(12.5)
    expect(api.num('')).toBe(0)
    expect(api.num('あ')).toBe(0)
    expect(api.num(undefined)).toBe(0)
  })
})

describe('man（万円の書き方）', () => {
  it('3桁ごとにカンマを入れる', () => {
    expect(api.man(2800)).toBe('2,800')
    expect(api.man(850)).toBe('850')
  })
  it('端数があるときだけ小数第1位まで出す', () => {
    expect(api.man(9.5)).toBe('9.5')
    expect(api.man(10)).toBe('10')
  })
  it('マイナスは −（全角）で出す', () => {
    expect(api.man(-1200)).toBe('−1,200')
  })
})

describe('payoff（完済までの計算）', () => {
  it('金利0なら 残高 ÷ 毎月', () => {
    const p = api.payoff(100, 10, 0)
    expect(p.ok).toBe(true)
    expect(p.months).toBeCloseTo(10, 6)
    expect(p.interest).toBe(0)
  })

  it('住宅ローンらしい条件で、返済予定表と近い月数になる', () => {
    // 残高2800万円・毎月9.5万円・年0.475% → 元利均等でおよそ25年
    const p = api.payoff(2800, 9.5, 0.475)
    expect(p.ok).toBe(true)
    expect(p.months).toBeGreaterThan(310)
    expect(p.months).toBeLessThan(330)
    // 払う利息は残高の1割前後に収まる
    expect(p.interest).toBeGreaterThan(150)
    expect(p.interest).toBeLessThan(250)
  })

  it('毎月の返済が利息に届かないときは、減らないと伝える', () => {
    const p = api.payoff(3000, 1, 5)
    expect(p.ok).toBe(false)
    expect(p.why).toContain('減らない')
  })

  it('毎月の返済額が空なら、計算せずに理由を返す', () => {
    const p = api.payoff(3000, 0, 1)
    expect(p.ok).toBe(false)
    expect(p.why).toContain('入っていない')
  })

  it('残高が0なら完済ずみ', () => {
    const p = api.payoff(0, 9.5, 0.475)
    expect(p.done).toBe(true)
  })
})

describe('yearsText', () => {
  it('年と月に直す', () => {
    expect(api.yearsText(0)).toBe('完済ずみ')
    expect(api.yearsText(5)).toBe('あと5か月')
    expect(api.yearsText(12)).toBe('あと1年')
    expect(api.yearsText(25.2)).toBe('あと2年2か月')
  })
})

describe('ymPlus', () => {
  it('月をまたいでも年が繰り上がる', () => {
    const now = new Date()
    const t = now.getFullYear() * 12 + now.getMonth() + 13
    expect(api.ymPlus(13)).toBe(`${Math.floor(t / 12)}年${(t % 12) + 1}月`)
  })
})

/* ---------- 入金予定 ---------- */
const pay = new Function(
  ['num', 'nextPayday', 'daysUntil', 'untilText'].map(grab).join('\n') +
    '; return { nextPayday, daysUntil, untilText };',
)() as {
  nextPayday: (day: number, today: Date) => Date
  daysUntil: (d: Date, today: Date) => number
  untilText: (n: number) => string
}

describe('nextPayday（次の入金日）', () => {
  it('まだ来ていない日は、今月の日付', () => {
    const t = pay.nextPayday(25, new Date(2026, 8, 4))
    expect([t.getFullYear(), t.getMonth() + 1, t.getDate()]).toEqual([2026, 9, 25])
  })

  it('当日は今日を返す（もらう日を過ぎてから翌月へ送る）', () => {
    const t = pay.nextPayday(25, new Date(2026, 8, 25))
    expect(t.getDate()).toBe(25)
    expect(t.getMonth() + 1).toBe(9)
  })

  it('過ぎていれば翌月', () => {
    const t = pay.nextPayday(5, new Date(2026, 8, 10))
    expect([t.getFullYear(), t.getMonth() + 1, t.getDate()]).toEqual([2026, 10, 5])
  })

  it('12月をまたぐと年が変わる', () => {
    const t = pay.nextPayday(5, new Date(2026, 11, 20))
    expect([t.getFullYear(), t.getMonth() + 1, t.getDate()]).toEqual([2027, 1, 5])
  })

  it('その月に無い日は、その月の最終日に寄せる（31日→2月28日）', () => {
    const t = pay.nextPayday(31, new Date(2027, 1, 10))
    expect([t.getMonth() + 1, t.getDate()]).toEqual([2, 28])
  })
})

describe('daysUntil / untilText', () => {
  it('時刻に関係なく、日付の差で数える', () => {
    const today = new Date(2026, 8, 4, 23, 50)
    expect(pay.daysUntil(new Date(2026, 8, 5, 0, 10), today)).toBe(1)
    expect(pay.daysUntil(new Date(2026, 8, 4, 0, 10), today)).toBe(0)
  })

  it('0と1は言い換える', () => {
    expect(pay.untilText(0)).toBe('今日')
    expect(pay.untilText(1)).toBe('あした')
    expect(pay.untilText(21)).toBe('あと21日')
  })
})
