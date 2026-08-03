/**
 * 日本語歌詞のモーラ(拍)計測。
 *
 * 「歌いやすさ」は文字数ではなく **拍の数** で決まる。
 * 例: 「東京」は2文字だが「とうきょう」= 4拍、「ちょっと」は4文字だが3拍。
 * 文字数で判定すると漢字の多い行を短く、ひらがなの多い行を長く誤判定するため、
 * ここで拍を数える。
 *
 * 数え方(日本語のモーラの標準的な規則):
 * - かな1文字 = 1拍
 * - 拗音(ゃゅょぁぃぅぇぉ)は直前のかなと合わせて1拍(=単独では数えない)
 * - 促音「っ」・撥音「ん」・長音「ー」はそれぞれ1拍(歌では1音ぶんの長さを取る)
 * - 漢字は読み辞書で拍数を求める(辞書に無い漢字は2拍と推定)
 * - 英単語は音節数(母音のかたまり)= 歌う時の拍
 * - 数字は日本語読みの拍数
 */

/** 拗音(小書き文字)。直前のかなと合わせて1拍になるため単独では数えない */
const SMALL_KANA = new Set('ゃゅょぁぃぅぇぉャュョァィゥェォゎヮ')

/** 拍に数えない記号(句読点・括弧・空白など)。長音符「ー」は拍なので含めない */
const IGNORED = new Set(
  ' 　\t、。,.，．!?！？…‥・「」『』()()[]｛｝{}【】《》〈〉"\'”“‘’゛゜~〜－-—–:：;；/／\\＼|｜*＊+＋=＝&＆%％#＃@＠^＾_＿',
)

function isHiragana(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0
  return c >= 0x3041 && c <= 0x309f
}

function isKatakana(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0
  return (c >= 0x30a0 && c <= 0x30ff) || (c >= 0xff66 && c <= 0xff9f)
}

function isKana(ch: string): boolean {
  return isHiragana(ch) || isKatakana(ch)
}

function isKanji(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0
  return (c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3400 && c <= 0x4dbf) || ch === '々' || ch === '〆'
}

function isLatin(ch: string): boolean {
  return /[A-Za-z]/.test(ch)
}

/** 半角数字と全角数字(U+FF10〜U+FF19) */
function isDigit(ch: string): boolean {
  return /[0-9０-９]/.test(ch)
}

/**
 * 頻出語の読みの拍数。
 * 歌詞に出やすい語を優先して収録。長い見出しから照合するので
 * 「今日」= 2拍(きょう)が「日」= 1拍より先に一致する。
 * 送りがなは辞書に含めない(例: 帰る = 帰[かえ]2拍 + る1拍 = 3拍)。
 */
const READING_MORA: Record<string, number> = {
  // --- 熟語・複合語(長い見出しから照合される) ---
  一生懸命: 8, 大丈夫: 5, 待ち合わせ: 5, 季節外れ: 6, 雨上がり: 5, 帰り道: 5,
  通学路: 5, 月明かり: 5, 涙声: 5, 交差点: 5, 眠れない: 5, 懐かしい: 5, 温かい: 5,
  思い出: 4, 想い出: 4, 幸せ: 4, 悲しみ: 4, 寂しさ: 4, 優しさ: 4, 温もり: 4,
  眩しい: 4, 愛しい: 4, 切ない: 4, 儚い: 4, 泣き顔: 4, 横顔: 4, 面影: 4, 約束: 4,
  永遠: 4, 運命: 4, 本当: 4, 一番: 4, 毎日: 4, 太陽: 4, 星空: 4, 青空: 4,
  夕暮れ: 4, 朝焼け: 4, 夕焼け: 4, 東京: 4, 改札: 4, 自転車: 4, 街並み: 4,
  足音: 4, 心臓: 4, 感情: 4, 表情: 4, 問題: 4, 瞬き: 4, 溜息: 4, 眼差し: 4,
  面倒: 4, 特別: 4, 大切: 4, 緩やか: 4, 鮮やか: 4, 穏やか: 4, 賑やか: 4,
  爽やか: 4, 華やか: 4, 瞬間: 4, 沢山: 4, 音楽: 4, 制服: 4, 教室: 4, 放課後: 4,
  絶望: 4, 現在: 4, 信号: 4, 街灯: 4, 旋律: 4, 返信: 4, 学校: 4, 秘密: 3,
  笑顔: 3, 景色: 3, 記憶: 3, 世界: 3, 未来: 3, 希望: 3, 奇跡: 3, 自由: 3,
  孤独: 3, 全部: 3, 全て: 3, 最後: 3, 最初: 3, 一緒: 3, 一人: 3, 二人: 3,
  誰か: 3, 何か: 3, 何も: 3, 明日: 3, 昨日: 3, 今夜: 3, 昨夜: 3, 時間: 3,
  季節: 3, 夜空: 3, 電車: 3, 言葉: 3, 気持ち: 3, 鼓動: 3, 呼吸: 3, 理由: 3,
  答え: 3, 素直: 3, 素敵: 3, 綺麗: 3, 静か: 3, 確か: 3, 微か: 3, 僅か: 3,
  密か: 3, 自分: 3, 貴方: 3, 貴女: 3, 少し: 3, 本気: 3, 平気: 3, 元気: 3,
  天気: 3, 空気: 3, 匂い: 3, 香り: 3, 温度: 3, 湿度: 3, 仕事: 3, 会社: 3,
  電話: 3, 手紙: 3, 写真: 3, 画面: 3, 通知: 3, 既読: 3, 普通: 3, 勿論: 3,
  今日: 2, 今朝: 2, 何時: 2, 何処: 2, 何故: 2, 過去: 2, 意味: 2, 場所: 2,
  距離: 2, 部屋: 2, 歌詞: 2, 空港: 4, 本棚: 4, 椅子: 2, 苦味: 3,
  // 硬い言葉(添削対象として辞書に出てくる語)の読みも入れておく
  黄昏: 4, 彷徨: 3, 憂鬱: 4, 刹那: 3, 邂逅: 4, 慟哭: 4, 郷愁: 4, 喧騒: 3,
  静謐: 4, 憧憬: 4, 泡沫: 4, 葛藤: 4,
  // --- 単漢字(歌詞での訓読みを優先) ---
  君: 2, 僕: 2, 私: 3, 俺: 2, 彼: 2, 人: 2, 誰: 2, 皆: 3,
  声: 2, 心: 3, 胸: 2, 手: 1, 指: 2, 腕: 2, 目: 1, 瞳: 3, 涙: 3, 顔: 2, 髪: 2,
  息: 2, 肩: 2, 背: 1, 足: 2, 体: 3, 唇: 4, 頬: 2, 耳: 2, 口: 2, 首: 2, 血: 1,
  骨: 2, 肌: 2,
  空: 2, 星: 2, 月: 2, 雲: 2, 雨: 2, 雪: 2, 風: 2, 光: 3, 闇: 2, 影: 2, 色: 2,
  音: 2, 歌: 2, 曲: 2, 詩: 2, 夢: 2, 愛: 2, 恋: 2, 嘘: 2, 罪: 2, 傷: 2, 熱: 2,
  街: 2, 町: 2, 道: 2, 駅: 2, 窓: 2, 扉: 3, 家: 2, 庭: 2, 橋: 2, 坂: 2, 角: 2,
  海: 2, 川: 2, 山: 2, 森: 2, 花: 2, 桜: 3, 木: 1, 葉: 1, 草: 2, 種: 2,
  夜: 2, 朝: 2, 昼: 2, 夕: 2, 今: 2, 時: 2, 春: 2, 夏: 2, 秋: 2, 冬: 2, 年: 2,
  日: 1, 週: 2, 頃: 2, 先: 2, 後: 2, 前: 2, 中: 2, 外: 2, 内: 2, 上: 2, 下: 2,
  隣: 3, 側: 2, 間: 2, 端: 2, 奥: 2, 底: 2, 果: 2,
  火: 1, 水: 2, 氷: 2, 灯: 2, 炎: 3, 煙: 2, 波: 2, 砂: 2, 石: 2, 土: 2, 鉄: 2,
  白: 2, 黒: 2, 赤: 2, 青: 2, 緑: 3, 金: 2, 銀: 2,
  見: 1, 聞: 1, 言: 1, 話: 2, 呼: 1, 泣: 1, 笑: 2, 叫: 2, 歩: 2, 走: 2, 飛: 1,
  立: 1, 座: 2, 眠: 2, 起: 1, 帰: 2, 来: 1, 行: 1, 去: 1, 待: 1, 探: 2, 迷: 2,
  触: 1, 抱: 1, 掴: 2, 握: 2, 押: 1, 引: 1, 投: 1, 拾: 2, 捨: 1, 開: 1, 閉: 1,
  願: 2, 祈: 2, 信: 2, 疑: 3, 想: 2, 思: 2, 忘: 2, 覚: 2, 知: 1, 分: 1, 感: 2,
  消: 1, 生: 1, 死: 1, 終: 1, 始: 2, 続: 2, 変: 1, 残: 2, 落: 1, 満: 1, 溢: 2,
  流: 2, 揺: 1, 震: 2, 響: 2, 照: 1, 輝: 3, 咲: 1, 散: 1, 枯: 1, 濡: 1,
  重: 2, 軽: 2, 深: 2, 浅: 2, 遠: 2, 近: 2, 高: 2, 低: 2, 強: 2, 弱: 2,
  長: 2, 短: 3, 広: 2, 狭: 2, 新: 3, 古: 2, 若: 2, 早: 2, 遅: 2, 好: 1,
  嫌: 2, 楽: 2, 苦: 2, 痛: 2, 寒: 2, 暑: 2, 涼: 2, 暖: 3,
  無: 2, 有: 2, 大: 2, 小: 2, 多: 2, 少: 2, 全: 2, 半: 2,
  一: 2, 二: 1, 三: 2, 四: 2, 五: 1, 六: 2, 七: 2, 八: 2, 九: 2, 十: 2,
  百: 2, 千: 2, 万: 2,
  本: 2, 気: 1, 力: 3, 命: 3, 魂: 4, 神: 2, 天: 2, 地: 1, 国: 2, 島: 2,
  車: 3, 船: 2, 靴: 2, 傘: 2, 鍵: 2, 服: 2, 袖: 2, 箱: 2, 紙: 2, 席: 2,
  机: 3, 皿: 2, 味: 2, 甘: 2, 塩: 2, 酒: 2, 茶: 1,
  考: 3, 袋: 3, 靴下: 4, 数: 2, 迎: 3, 送: 2, 選: 2, 決: 2, 覚悟: 3,
  冷蔵庫: 5, 営業: 5, 文字: 2, 隅: 2, 冷: 2, 蔵: 2, 庫: 2, 営: 2, 業: 2,
  時計: 3, 眼鏡: 3, 財布: 2, 荷物: 3, 鞄: 3, 布団: 3, 枕: 3, 毛布: 2,
  信じ: 2, 未来形: 5, 週末: 4, 平日: 4, 休日: 4, 真夜中: 4, 明け方: 4,
}

/** 辞書の見出しを長い順に(最長一致のため) */
const READING_KEYS = Object.keys(READING_MORA).sort((a, b) => b.length - a.length)

/** 数字1桁の読みの拍数 */
const DIGIT_MORA: Record<string, number> = {
  '0': 2, // ゼロ
  '1': 2, // いち
  '2': 1, // に
  '3': 2, // さん
  '4': 2, // よん
  '5': 1, // ご
  '6': 2, // ろく
  '7': 2, // なな
  '8': 2, // はち
  '9': 2, // きゅう
}

/** 数字列の読みの拍数(2桁までは位取りを考慮、3桁以上は1桁ずつ読む想定) */
function digitsToMora(digits: string): number {
  // 全角数字(U+FF10〜)を半角へ寄せてから読む
  const normalized = digits.replace(/[０-９]/g, (d) =>
    String.fromCharCode(d.charCodeAt(0) - 0xfee0),
  )
  const n = Number.parseInt(normalized, 10)
  if (Number.isNaN(n)) return normalized.length
  if (n < 10) return DIGIT_MORA[String(n)] ?? 2
  if (n < 100) {
    // 十の位 +「じゅう」(2拍)+ 一の位。10〜19の十の位は読まない
    const tens = Math.floor(n / 10)
    const ones = n % 10
    const tensMora = tens === 1 ? 0 : (DIGIT_MORA[String(tens)] ?? 2)
    return tensMora + 2 + (ones ? (DIGIT_MORA[String(ones)] ?? 2) : 0)
  }
  return [...normalized].reduce((sum, d) => sum + (DIGIT_MORA[d] ?? 2), 0)
}

/** 英単語の音節数(母音のかたまりの数)。歌う時の拍数にほぼ一致する */
export function englishSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (w.length === 0) return 0
  if (w.length <= 2) return 1
  const groups = w.match(/[aeiouy]+/g)
  let count = groups ? groups.length : 1
  // 語末の発音しない e を引く(make → 1拍)
  if (/[^aeiou]e$/.test(w) && count > 1) count -= 1
  return Math.max(1, count)
}

/** かな列の拍数(拗音は直前のかなと合わせて1拍) */
function kanaMora(text: string): number {
  let count = 0
  for (const ch of text) {
    if (SMALL_KANA.has(ch)) continue
    if (IGNORED.has(ch)) continue
    count += 1
  }
  return count
}

export interface MoraDetail {
  /** 推定した拍数 */
  count: number
  /** 読みが辞書に無く2拍と推定した漢字(推定であることを画面に出すため) */
  unknownKanji: string[]
}

/** 歌詞1行の拍数を推定する(内訳つき) */
export function moraDetail(text: string): MoraDetail {
  const unknownKanji: string[] = []
  let count = 0
  let i = 0

  while (i < text.length) {
    const ch = text[i]

    if (IGNORED.has(ch)) {
      i += 1
      continue
    }

    if (isKanji(ch)) {
      const hit = READING_KEYS.find((key) => text.startsWith(key, i))
      if (hit) {
        count += READING_MORA[hit]
        i += hit.length
        continue
      }
      // 辞書に無い漢字は2拍(音読みの平均)と推定する
      count += 2
      unknownKanji.push(ch)
      i += 1
      continue
    }

    if (isKana(ch)) {
      let j = i
      while (j < text.length && isKana(text[j])) j += 1
      count += kanaMora(text.slice(i, j))
      i = j
      continue
    }

    if (isLatin(ch)) {
      let j = i
      while (j < text.length && (isLatin(text[j]) || text[j] === "'")) j += 1
      count += englishSyllables(text.slice(i, j))
      i = j
      continue
    }

    if (isDigit(ch)) {
      let j = i
      while (j < text.length && isDigit(text[j])) j += 1
      count += digitsToMora(text.slice(i, j))
      i = j
      continue
    }

    i += 1
  }

  return { count, unknownKanji }
}

/** 歌詞1行の拍数(モーラ数)を推定する */
export function countMora(text: string): number {
  return moraDetail(text).count
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** BPM未入力時に使う「1行の目安の拍数」 */
export const DEFAULT_MAX_MORA = 24

/**
 * BPMから「1行に無理なく収まる拍数」を求める。
 *
 * 前提: 1行 ≒ 2小節(4/4拍子で8拍ぶん)、歌として自然に発音できる速さを毎秒4拍とする。
 * 例: BPM80 → 6秒 → 24拍、BPM120 → 4秒 → 16拍。
 * ラップのような極端な詰め込みは想定しないため14〜34拍に収める。
 */
export function maxMoraForBpm(bpmText: string): number {
  const bpm = Number.parseFloat(bpmText.replace(/[^0-9.]/g, ''))
  if (!Number.isFinite(bpm) || bpm < 40 || bpm > 220) return DEFAULT_MAX_MORA
  const secondsPerLine = (60 / bpm) * 8
  return clamp(Math.round(secondsPerLine * 4), 14, 34)
}
