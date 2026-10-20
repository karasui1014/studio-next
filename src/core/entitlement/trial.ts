/**
 * 無料プランの「1日1回の無料体験」（2026-10-20）。
 *
 * ■ なぜ作ったか
 * ノートでツールを紹介しても、押した先がすべてロック画面で、
 * 月額を払う前に手応えを確かめる手段がなかった。
 * 制作ツールは端末の中だけで動くので、試してもらってもこちらの負担は増えない。
 *
 * ■ 仕組み
 * ロック画面のボタンを押すと、そのツールが「その日いっぱい」使える。
 * 日付が変われば、またボタンを押して試せる。
 * 記録は端末の localStorage にだけ置く（PremiumGate と同じく表示の出し分けで、
 * アクセス制御ではない。消されても困るものは何もない）。
 */

/** 体験できるツール。同じページを使うものは同じキーにする（ストーリーボード＝MVアイデア） */
export type TrialKey = 'lyrics-review' | 'mv-idea' | 'ai-producer' | 'prompt-dex'

const PREFIX = 'studio-next:trial:'

/** 端末の現地時間での日付（YYYY-MM-DD）。日付の切り替わりを利用者の感覚に合わせる */
export function localDay(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 今日、このツールの無料体験を使っているか */
export function isTrialActive(key: TrialKey, storage: Pick<Storage, 'getItem'> | null = safeStorage(), now = new Date()): boolean {
  try {
    return storage?.getItem(PREFIX + key) === localDay(now)
  } catch {
    return false
  }
}

/** 今日の無料体験を始める */
export function startTrial(key: TrialKey, storage: Pick<Storage, 'setItem'> | null = safeStorage(), now = new Date()): void {
  try {
    storage?.setItem(PREFIX + key, localDay(now))
  } catch {
    /* 保存できない環境でも、その場では使えるようにする（呼び出し側で state を立てる） */
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}
