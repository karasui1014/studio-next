import type { Song } from '@/core/storage/songs'

import { SONG_MILESTONES, type CheerStyle, type SecretarySettings, type SpeakingStyle } from './types'

/**
 * 秘書のひとことを組み立てる。V1から移植。
 *
 * ■ AIは使っていない
 * 文章はすべてこのファイルの中のルールで決まる。外部APIには問い合わせない。
 * 「作りかけの曲がどこで止まっているか」を見れば、次の一歩は機械的に決まるので、
 * それだけで十分に役に立つ——というのがV1からの一貫した判断。
 *
 * ■ 優先順位（上から順に見て、最初に当たったものを言う）
 *   ① 曲数の節目     … いちばん嬉しい報告なので最優先。一度きり
 *   ② 連続日数の節目 … 7日・30日ちょうどの日だけ
 *   ③ 状況に応じた提案 … 該当するものの中から日替わりで1つ
 *   ④ ただの挨拶     … 何も無い日
 */

export interface SecretaryContext {
  songs: Song[]
  settings: SecretarySettings
  streak: number
  celebratedMilestones: number[]
  /** テスト用。省略すると現在時刻 */
  now?: Date
}

export interface SecretaryMessage {
  text: string
  /** 曲数の節目を祝ったときだけ入る。呼び出し側が「祝った」と記録する */
  milestone?: number
}

function greeting(hour: number, style: SpeakingStyle): string {
  if (hour < 5 || hour >= 18) return 'こんばんは' + (style === 'friendly' ? '！' : '。')
  if (hour < 11) {
    return style === 'polite' ? 'おはようございます。' : style === 'friendly' ? 'おはよう！' : 'おはよう。'
  }
  return 'こんにちは' + (style === 'friendly' ? '！' : '。')
}

/** 日付をたねにして選ぶ。同じ日は何度開いても同じことを言う（うるさくしない） */
function pick<T>(items: T[], seed: number): T {
  return items[seed % items.length]
}

function byCheer(cheer: CheerStyle, gentle: string, energetic: string, stoic: string): string {
  return cheer === 'energetic' ? energetic : cheer === 'stoic' ? stoic : gentle
}

function withCatchphrase(text: string, settings: SecretarySettings): string {
  if (!settings.catchphrase.trim()) return text
  return `${text} ${settings.catchphrase.trim()}`
}

export function buildSecretaryMessage(ctx: SecretaryContext): SecretaryMessage {
  const { songs, settings, streak, celebratedMilestones } = ctx
  const now = ctx.now ?? new Date()
  const cheer = settings.cheerStyle
  const me = settings.firstPerson || '私'
  const daySeed = Math.floor(now.getTime() / 86_400_000)

  // ① 曲数の節目。大きい方から見て、まだ祝っていないものを1つだけ
  const total = songs.length
  const milestone = [...SONG_MILESTONES]
    .reverse()
    .find((m) => total >= m && !celebratedMilestones.includes(m))
  if (milestone) {
    const text = byCheer(
      cheer,
      `${milestone}曲目ですね。かなり作品が増えました。${me}も嬉しいです。`,
      `ついに${milestone}曲達成です！すごいペースですね！`,
      `${milestone}曲。着実に積み上がっています。`,
    )
    return { text: withCatchphrase(text, settings), milestone }
  }

  // ② 連続日数の節目。ちょうどその日だけ言う
  if (streak === 7) {
    return {
      text: withCatchphrase(
        byCheer(
          cheer,
          '一週間続きましたね。この調子で、無理せずいきましょう。',
          '7日連続です！習慣になってきましたね！',
          '7日継続。継続は力です。',
        ),
        settings,
      ),
    }
  }
  if (streak === 30) {
    return {
      text: withCatchphrase(
        byCheer(
          cheer,
          '30日継続、おつかれさまです。もう立派な習慣ですね。',
          '30日連続！ここまで続く人はなかなかいませんよ！',
          '30日。数字は裏切りません。',
        ),
        settings,
      ),
    }
  }

  // ③ 状況に応じた提案。当てはまるものを集めて、その中から日替わりで1つ
  const suggestions: string[] = []
  const hello = greeting(now.getHours(), settings.speakingStyle)

  if (total === 0) {
    suggestions.push(
      byCheer(
        cheer,
        `${hello}今日は何から作りますか？まずは1曲、気軽に登録してみましょう。`,
        `${hello}最初の1曲を作りましょう！「曲を作る」からすぐ始められますよ！`,
        `${hello}まずは1曲。登録から始めましょう。`,
      ),
    )
  }

  const lyricsDoneNoSuno = songs.find((s) => s.lyrics.trim() && !s.sunoPrompt.trim())
  if (lyricsDoneNoSuno) {
    suggestions.push(
      byCheer(
        cheer,
        `「${lyricsDoneNoSuno.title}」の歌詞、いい感じですね。次はスタイルプロンプトを作りましょう。`,
        `「${lyricsDoneNoSuno.title}」の歌詞ができてますね！次はSunoプロンプトいきましょう！`,
        `「${lyricsDoneNoSuno.title}」は歌詞まで完了。次はスタイルプロンプトです。`,
      ),
    )
  }

  const sunoDoneNoMv = songs.find((s) => s.sunoPrompt.trim() && !s.mvPrompt.trim())
  if (sunoDoneNoMv) {
    suggestions.push(
      byCheer(
        cheer,
        `「${sunoDoneNoMv.title}」、そろそろMVのイメージを考えてみませんか？絵コンテツールも使えますよ。`,
        `「${sunoDoneNoMv.title}」のMV、作っちゃいましょう！絵コンテから始めるのがおすすめです！`,
        `「${sunoDoneNoMv.title}」はMV未着手。絵コンテから固めるのが近道です。`,
      ),
    )
  }

  const readyToPublish = songs.find((s) => s.status === 'mv')
  if (readyToPublish) {
    suggestions.push(
      byCheer(
        cheer,
        `「${readyToPublish.title}」、公開の準備を始めませんか？タイトルと概要をメモに残しておけます。`,
        `「${readyToPublish.title}」、もうすぐ公開ですね！タイトル案を考えましょう！`,
        `「${readyToPublish.title}」は公開待ち。概要欄の下書きを進めましょう。`,
      ),
    )
  }

  // 公開済みの曲は「振り返り」を促す。
  // V1はここで楽曲批評ツールを名指ししていたが、V2では同ツールがMaster限定になったため、
  // プランによっては開けない導線を秘書が勧めることになる。それは表示と実態の食い違いなので、
  // 特定のツール名は出さず「振り返り」という行為だけを勧める形に変えた。
  const published = songs.filter((s) => s.status === 'published')
  if (published.length > 0) {
    const target = pick(published, daySeed)
    suggestions.push(
      byCheer(
        cheer,
        `「${target.title}」を聴き返してみませんか？良かった点を書き留めておくと、次の作品のヒントになります。`,
        `「${target.title}」を振り返ってみましょう！伸びしろが見つかりますよ！`,
        `「${target.title}」の振り返りが未実施。次作の材料になります。`,
      ),
    )
  }

  if (suggestions.length > 0) {
    return { text: withCatchphrase(pick(suggestions, daySeed), settings) }
  }

  // ④ 何も言うことが無い日
  return { text: withCatchphrase(`${hello}今日は何から作りますか？`, settings) }
}
