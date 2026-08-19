/**
 * YouTubeの段名が、2つの場所でずれていないことを見張る。
 *
 * ■ なぜ必要か
 * 段名は2箇所にある。
 *   ① `src/core/entitlement/role.ts` の `YOUTUBE_TIERS[].youtubeName`
 *      … プラン画面に「YouTubeメンバーシップ『◯◯』」と出す文字列
 *   ② `scripts/membership-levels.mjs` の `MEMBERSHIP_LEVELS[].current`
 *      … 運営者が段名からRoleを引くときの参照表
 *
 * 片方だけ直すと、画面には存在しない段名が出たり、
 * 運営者の照合だけが「未知の段名」になったりする。
 * YouTube側で改名したときに**両方直したか**を、ここで機械的に確かめる。
 *
 * ■ ここは認証の経路ではない
 * 段名の文字列照合は、本番の認証には一切使われていない
 * （Roleはキー発行時に運営者が決め、KVに記録した値だけで決まる）。
 * つまり改名しても**新規の認証が止まることはない**。
 * それでも表示と参照表がずれると運営が混乱するため、テストで固定する。
 */
import { describe, expect, it } from 'vitest'

import { MEMBERSHIP_LEVELS, levelNameToRole } from '../membership-levels.mjs'
import { YOUTUBE_TIERS } from '../../src/core/entitlement/role'

/** 価格をキーにして突き合わせる（段名そのものは比較対象なので使えない） */
const levelByPrice = new Map(MEMBERSHIP_LEVELS.map((l) => [l.price, l]))

describe('YouTubeの段名が2箇所でずれていない', () => {
  it.each(YOUTUBE_TIERS.map((t) => [t.price, t.youtubeName] as const))(
    '¥%s の段名が参照表と一致する（%s）',
    (price, youtubeName) => {
      const level = levelByPrice.get(price)
      expect(level, `¥${price} の段が membership-levels.mjs にありません`).toBeTruthy()
      expect(level!.current).toBe(youtubeName)
    },
  )

  it('画面に出す段名は、参照表でも正しいRoleに解決できる', () => {
    for (const tier of YOUTUBE_TIERS) {
      const resolved = levelNameToRole(tier.youtubeName)
      expect(resolved.known, `「${tier.youtubeName}」が未知の段名です`).toBe(true)
      // role が null の段（応援用）は free に倒れるのが正しい
      expect(resolved.role).toBe(tier.role ?? 'free')
    }
  })
})

describe('段名の表記ゆれを吸収できる', () => {
  it('大文字小文字と空白の違いを吸収する', () => {
    // Master は「部」と「Studio」の間に空白が無いのが実表記。
    // 空白入りで来ても、AI/Ai の違いがあっても同じ段に解決できること
    for (const name of [
      'AI音楽部Studio Master',
      'AI音楽部 Studio Master',
      'ai音楽部studio master',
    ]) {
      expect(levelNameToRole(name).role).toBe('master')
    }
  })

  it('改名前の旧名でも解決できる（過去の申請控えと突き合わせるため）', () => {
    expect(levelNameToRole('AiでMVを作りたい部').role).toBe('premium')
    expect(levelNameToRole('AiでMVを作りたい部1ヶ月でマスターしたい方向け').role).toBe('master')
  })

  it('知らない段名は free に倒れる（勝手に権限を与えない）', () => {
    const r = levelNameToRole('まだ作っていない新しい段')
    expect(r.role).toBe('free')
    expect(r.known).toBe(false)
  })

  it('企業様向けは既知だが権限なし（金額が最高でもMasterにしない）', () => {
    const r = levelNameToRole('「企業様向け」Aiで曲作りしたい部')
    expect(r.known).toBe(true)
    expect(r.role).toBe('free')
  })
})
