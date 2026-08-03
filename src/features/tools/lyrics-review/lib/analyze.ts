import { buildAllAdoptedLyrics } from './apply'
import { countMora, maxMoraForBpm, moraDetail } from './mora'
import {
  findChorusSections,
  parseLyricsStructure,
  sectionLabelForLine,
  type ParsedStructure,
} from './structure'
import {
  LYRICS_REVIEW_SCHEMA_VERSION,
  type AlternativeDirection,
  type AxisEvaluation,
  type AxisLevel,
  type LinePriority,
  type LineSuggestion,
  type LyricsReviewInput,
  type LyricsReviewResult,
  type LyricsReviewSongContext,
  type StyleConversion,
} from './types'
import type { AiProviderId } from './deps'

// ---------------------------------------------------------------------------
// ユーティリティ(完全に決定的。乱数は使わずseedで回転させる)
// ---------------------------------------------------------------------------

function pickRotated<T>(pool: T[], seed: number): T {
  return pool[Math.abs(seed) % pool.length]
}

/**
 * 歌いやすさ判定に使う「拍(モーラ)の数」。
 * 文字数ではなく実際に歌う拍で数える(「東京」= 2文字だが4拍)。
 */
export function singableLength(line: string): number {
  return countMora(line)
}

function truncate(text: string, max: number): string {
  const t = text.trim()
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

/** 区切り(読点・改行・空白)でリスト入力を分割する */
function splitList(value: string): string[] {
  return value
    .split(/[、,\n]/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function numToKanji(n: number): string {
  const digits = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  if (n <= 0 || n > 99) return String(n)
  if (n < 10) return digits[n]
  const tens = Math.floor(n / 10)
  const rest = n % 10
  return (tens === 1 ? '十' : `${digits[tens]}十`) + (rest ? digits[rest] : '')
}

// ---------------------------------------------------------------------------
// 変換の道具箱(すべて文法を壊さない安全な操作だけを使う)
// ---------------------------------------------------------------------------

/** 「を」「が」は語の一部になることがほぼ無いので、どこに来ても分割点にできる */
const ALWAYS_SAFE_PARTICLES = ['を', 'が']

/**
 * 語の一部にもなり得る助詞(でも・とき・はな・にじ…)。
 * 内容語(漢字・カタカナ・英数字)の直後にある時だけ助詞とみなす。
 */
const CONTENT_REQUIRED_PARTICLES = ['は', 'に', 'で', 'と', 'へ', 'も']

/**
 * 助詞の直後に来ると「複合助詞・別の語の一部」になってしまうかな。
 * 例:「では」「とは」「にも」「でも」「とき」— ここで割ると言葉が壊れる。
 */
const NO_SPLIT_AFTER = new Set(['は', 'も', 'の', 'が', 'を', 'に', 'で', 'と', 'へ', 'か', 'ら', 'き', 'ん', 'っ', 'ー', 'こ', 'し'])

const KANJI_RE = /[一-鿿々〆]/
const KATAKANA_RE = /[゠-ヿ]/

/**
 * 長い行を歌いやすい2行に割る。良い分割点が無ければ null。
 *
 * 助詞は「漢字・カタカナ・英数字の直後」にあるものだけを本物の助詞とみなす。
 * ひらがなの中の「で」「と」は語の一部(でも・とき)である可能性が高く、
 * そこで割ると言葉が壊れるため避ける。
 */
export function splitLongLine(line: string): string | null {
  const trimmed = line.trim()
  // 読点があれば読点で割る(作者が置いた息継ぎなので最優先)
  const commaIndex = trimmed.indexOf('、')
  if (commaIndex >= 3 && commaIndex <= trimmed.length - 4) {
    return `${trimmed.slice(0, commaIndex)}\n${trimmed.slice(commaIndex + 1)}`
  }
  // 助詞の直後で、なるべく中央に近い場所を探す
  const center = trimmed.length / 2
  // 極端に短い側ができる分割は歌の助けにならないので、両側に最低限の長さを求める
  const minSide = Math.max(3, Math.floor(trimmed.length * 0.25))
  let best = -1
  let bestDistance = Number.POSITIVE_INFINITY

  for (let i = minSide - 1; i <= trimmed.length - minSide - 1; i += 1) {
    const ch = trimmed[i]
    const isSafe = ALWAYS_SAFE_PARTICLES.includes(ch)
    const isContextual = CONTENT_REQUIRED_PARTICLES.includes(ch)
    if (!isSafe && !isContextual) continue

    const before = trimmed[i - 1]
    const after = trimmed[i + 1]
    if (!before || !after) continue
    // 語の一部になり得る助詞は、内容語の直後にある時だけ採用する
    if (
      isContextual &&
      !KANJI_RE.test(before) &&
      !KATAKANA_RE.test(before) &&
      !/[A-Za-z0-9]/.test(before)
    ) {
      continue
    }
    // 直後が複合助詞・語の続きになるかなら割らない(では/にも/とき…)
    if (NO_SPLIT_AFTER.has(after)) continue

    const distance = Math.abs(i - center)
    if (distance < bestDistance) {
      bestDistance = distance
      best = i
    }
  }
  if (best === -1) return null
  return `${trimmed.slice(0, best + 1)}\n${trimmed.slice(best + 1)}`
}

/**
 * 抜いても意味が変わりにくい埋め草。
 * `follow` に挙げたかなが直後に来る場合は別の語(ただ→ただしい 等)なので抜かない。
 */
const FILLERS: { word: string; follow: string[] }[] = [
  { word: 'もう', follow: ['し', 'ふ', 'す', 'こ', 'ど', 'け'] }, // もうし(申)・もうふ(毛布)
  { word: 'ずっと', follow: [] },
  { word: 'きっと', follow: [] },
  { word: 'ただ', follow: ['し', 'ち', 'よ', 'れ', 'い'] }, // ただしい・ただよう
  { word: 'まだ', follow: ['ら', 'む', 'れ'] }, // まだら
  { word: 'そっと', follow: [] },
  { word: 'いつも', follow: [] },
  { word: 'どこか', follow: [] },
]

/** 語の先頭として認められる位置か(行頭、または直前がひらがな以外) */
function isWordStart(line: string, index: number): boolean {
  if (index === 0) return true
  const before = line[index - 1]
  return !/[ぁ-ゟ]/.test(before)
}

/** 埋め草の言葉をひとつ抜いて短くする。語の一部を壊す場合は抜かない */
function removeFiller(line: string): string | null {
  for (const { word, follow } of FILLERS) {
    let from = 0
    for (;;) {
      const index = line.indexOf(word, from)
      if (index === -1) break
      const after = line[index + word.length] ?? ''
      if (isWordStart(line, index) && !follow.includes(after)) {
        return (line.slice(0, index) + line.slice(index + word.length))
          .replace(/\s{2,}/g, ' ')
          .trim()
      }
      from = index + 1
    }
  }
  return null
}

/**
 * 動詞の活用語尾として「た」「る」の直前に来るかな。
 * ここを見ないと「うた(歌)」→「うたんだ」のような壊れた変換が出てしまう。
 * い段(見た・走る)・え段(食べた・帰る)・促音(行った)・撥音(飲んだ)を許可する。
 */
const VERB_STEM_TAIL = new Set([
  'い', 'き', 'ぎ', 'し', 'じ', 'ち', 'に', 'ひ', 'び', 'み', 'り',
  'え', 'け', 'げ', 'せ', 'ぜ', 'て', 'で', 'ね', 'へ', 'べ', 'め', 'れ',
  'っ', 'ん',
])

/** 語尾を言い換える(活用を壊さない置換のみ)。順序は長いパターン優先 */
const ENDING_SWAPS: { re: RegExp; to: string; needsVerbStem?: boolean }[] = [
  { re: /ていた$/, to: 'てた' },
  { re: /ている$/, to: 'てる' },
  { re: /ったんだ$/, to: 'った' },
  { re: /っている$/, to: 'ってる' },
  { re: /った$/, to: 'ったまま' },
  { re: /ない$/, to: 'ないまま' },
  { re: /たい$/, to: 'たいんだ' },
  { re: /だろう$/, to: 'だろうか' },
  { re: /るよ$/, to: 'るね' },
  { re: /ました$/, to: 'ましたね' },
  { re: /た$/, to: 'たんだ', needsVerbStem: true },
  { re: /る$/, to: 'るんだ', needsVerbStem: true },
]

/**
 * 行末の語尾を言い換える。
 * 活用形だと確信できない場合(「歌」「また」など名詞・副詞)は null を返し、
 * 文法を壊す提案を出さない。
 */
export function swapEnding(line: string): string | null {
  const trimmed = line.trim()
  for (const { re, to, needsVerbStem } of ENDING_SWAPS) {
    if (!re.test(trimmed)) continue
    if (needsVerbStem) {
      // 直前が活用語尾のかな、または漢字(見た・来る・帰る)なら動詞とみなす
      const stemTail = trimmed[trimmed.length - 2]
      if (!stemTail || !(VERB_STEM_TAIL.has(stemTail) || KANJI_RE.test(stemTail))) continue
    }
    return trimmed.replace(re, to)
  }
  return null
}

/** 歌詞に出る一人称。混在は「誰が歌っているか」をぼかすため検出する */
const FIRST_PERSONS = ['僕', '私', '俺', 'ぼく', 'おれ', 'わたし', 'あたし']

/** かなの「行」(子音のグループ)。同じ行が続くと舌が回りにくい */
const KANA_ROWS: [string, string][] = [
  ['か行', 'かきくけこがぎぐげご'],
  ['さ行', 'さしすせそざじずぜぞ'],
  ['た行', 'たちつてとだぢづでど'],
  ['な行', 'なにぬねの'],
  ['は行', 'はひふへほばびぶべぼぱぴぷぺぽ'],
  ['ま行', 'まみむめも'],
  ['や行', 'やゆよ'],
  ['ら行', 'らりるれろ'],
]

const ROW_OF_KANA = new Map<string, string>()
for (const [row, kana] of KANA_ROWS) {
  for (const ch of kana) ROW_OF_KANA.set(ch, row)
}

/** 母音だけの音(「を」は /o/ と発音するのでここに含める) */
const VOWELS = new Set('あいうえおを')
/** 直前の音の続きとして扱う文字(拍は伸びるが子音は変わらない) */
const NEUTRAL_KANA = new Set('ーっんゃゅょぁぃぅぇぉ')

/** カタカナをひらがなへ寄せる(発音の並びを見るため) */
function toHiragana(text: string): string {
  return text.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
}

/**
 * 発音しにくい並びを探す。
 * - 同じ行(子音)が3拍以上続く → 舌が回らない
 * - 母音だけが3拍以上続く → 音が繋がって歌詞が聴き取れない
 */
function longestConsonantRun(line: string): { length: number; kind: string; sample: string } {
  const text = toHiragana(line.trim())
  let best = { length: 0, kind: '', sample: '' }
  let runRow = ''
  let runStart = -1
  let runLength = 0

  const flush = (endIndex: number) => {
    if (runLength > best.length) {
      best = {
        length: runLength,
        kind: runRow === '母音' ? '母音' : runRow,
        sample: text.slice(runStart, endIndex),
      }
    }
  }

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (NEUTRAL_KANA.has(ch)) continue // 促音・撥音・長音・拗音は行を変えない
    const row = ROW_OF_KANA.get(ch) ?? (VOWELS.has(ch) ? '母音' : '')
    if (row && row === runRow) {
      runLength += 1
      continue
    }
    flush(i)
    runRow = row
    runStart = row ? i : -1
    runLength = row ? 1 : 0
  }
  flush(text.length)
  return best.length >= 3 ? best : { length: 0, kind: '', sample: '' }
}

const INTERJECTIONS = ['ああ ', 'ほら ', 'ねえ ', 'そう ']

function withInterjection(line: string, seed: number): string {
  return pickRotated(INTERJECTIONS, seed) + line.trim()
}

// ---------------------------------------------------------------------------
// 辞書(硬い言葉・ありがちな言い回し・抽象語・情景の言葉)
// ---------------------------------------------------------------------------

const HARD_WORDS: [string, string[]][] = [
  ['邂逅', ['めぐりあい', '出会い']],
  ['刹那', ['一瞬', 'まばたきの間']],
  ['憂鬱', ['気だるさ', '重たい気分']],
  ['葛藤', ['迷い', '揺れる気持ち']],
  ['慟哭', ['声にならない涙', '泣き声']],
  ['黄昏', ['夕暮れ', '日暮れ']],
  ['彷徨', ['さまよい', 'あてない足どり']],
  ['郷愁', ['なつかしさ', '帰りたい気持ち']],
  ['喧騒', ['ざわめき', '街の音']],
  ['静謐', ['静けさ', 'しんとした空気']],
  ['憧憬', ['あこがれ', '遠い夢']],
  ['泡沫', ['うたかた', '消えそうな泡']],
]

const CLICHES: { re: RegExp; label: string; swaps: string[] }[] = [
  { re: /輝く未来/, label: '「輝く未来」', swaps: ['まだ名前のない未来', '書きかけの未来'] },
  { re: /明日へ向かって/, label: '「明日へ向かって」', swaps: ['まだ見ぬ朝へ', '次の信号へ'] },
  { re: /君のもとへ/, label: '「君のもとへ」', swaps: ['君の傘の中へ', '君の隣の空白へ'] },
  { re: /翼を広げて?/, label: '「翼を広げ」', swaps: ['スニーカーの紐を結んで', '窓を開け放って'] },
  { re: /涙を拭いて/, label: '「涙を拭いて」', swaps: ['涙は置いたまま', '涙を数えて'] },
  { re: /奇跡を信じて/, label: '「奇跡を信じて」', swaps: ['偶然を拾い集めて', '確率に逆らって'] },
  { re: /永遠に続く/, label: '「永遠に続く」', swaps: ['飽きるほど続く', '明日も続いていく'] },
  { re: /運命の糸/, label: '「運命の糸」', swaps: ['ほどけないイヤホンのコード', '偶然の乗り換え'] },
  { re: /星に願いを/, label: '「星に願いを」', swaps: ['自販機の灯りに願いを', '送信ボタンに願いを'] },
]

const ABSTRACT_WORDS = [
  '心',
  '想い',
  '未来',
  '希望',
  '夢',
  '光',
  '闇',
  '永遠',
  '運命',
  '奇跡',
  '世界',
  '自由',
  '愛',
  '明日',
]

const CONCRETE_HINT_RE =
  /(街|空|雨|風|窓|駅|海|夜道|朝焼け|夕焼け|指|靴|傘|コーヒー|電車|バス|部屋|カーテン|信号|月|星空|花|路地|改札|ホーム|コンビニ|自販機|スニーカー|ポケット|グラス|画面|通知|イヤホン)/

const IMAGERY_POOLS: { match: RegExp; words: string[] }[] = [
  {
    match: /(夜|眠れ|深夜|月|星|ローファイ|lo-?fi|チル)/i,
    words: ['青いネオンの水たまり', '終電の窓の光', '自販機のあかり', 'カーテン越しの月明かり'],
  },
  {
    match: /(雨|梅雨|涙|しずく)/,
    words: ['傘を打つ細い雨音', '濡れたアスファルト', '窓をつたう水滴', '折りたたみ傘の忘れもの'],
  },
  {
    match: /(夏|海|太陽|花火)/,
    words: ['白く光る入道雲', 'サンダルの熱い砂', '氷が溶けていくグラス', '線香花火の最後の玉'],
  },
  {
    match: /(冬|雪|寒|マフラー)/,
    words: ['白い息のカーブ', 'かじかむ指先', 'コートの襟の温度', '湯気の向こうの笑顔'],
  },
  {
    match: /(街|都会|シティ|city|ネオン)/i,
    words: ['信号待ちの横顔', 'ビルの谷間の風', 'シャッター街の張り紙', '終バスのアナウンス'],
  },
]

const DEFAULT_IMAGERY = ['夕暮れの帰り道', 'ポケットの中の鍵', '冷めかけのコーヒー', '窓際のカーテンの揺れ']

function imageryPoolFor(input: LyricsReviewInput): string[] {
  const context = `${input.genre} ${input.theme} ${input.emotion} ${input.lyrics.slice(0, 200)}`
  for (const pool of IMAGERY_POOLS) {
    if (pool.match.test(context)) return pool.words
  }
  return DEFAULT_IMAGERY
}

// ---------------------------------------------------------------------------
// 存命アーティストの模倣防止:名前を一般要素へ変換する
// ---------------------------------------------------------------------------

interface ArtistStyleEntry {
  names: string[]
  elements: {
    genre: string
    era: string
    tempo: string
    emotion: string
    instruments: string
    density: string
    abstraction: string
    structure: string
  }
}

/**
 * 有名アーティスト名 → 一般的な音楽要素。
 * 特定の作風を再現するためではなく、名前入力を「ジャンル・時代感」などの
 * 一般要素へ置き換えて安全に参考にするための変換表。
 */
const ARTIST_STYLE_MAP: ArtistStyleEntry[] = [
  {
    names: ['米津玄師', '米津'],
    elements: {
      genre: 'J-POP(オルタナティブ寄り)',
      era: '2010年代後半〜2020年代',
      tempo: 'ミドル〜やや速め',
      emotion: '切なさと高揚感の同居',
      instruments: 'ピアノ+バンド+シンセ',
      density: '言葉多め',
      abstraction: '抽象と具体を交互に置く',
      structure: '静かなAメロから開放的なサビへ',
    },
  },
  {
    names: ['あいみょん'],
    elements: {
      genre: 'J-POP(フォーク寄り)',
      era: '2010年代後半〜',
      tempo: 'ミドルテンポ',
      emotion: '等身大の恋愛感情',
      instruments: 'アコースティックギター中心のバンド',
      density: 'ふつう',
      abstraction: '日常語で具体寄り',
      structure: '弾き語り感のあるAメロと素直なサビ',
    },
  },
  {
    names: ['YOASOBI', 'ヨアソビ'],
    elements: {
      genre: 'J-POP(ボカロ文化系)',
      era: '2020年代',
      tempo: '速め',
      emotion: '疾走感と物語性',
      instruments: 'ピアノ+デジタルサウンド',
      density: '言葉かなり多め',
      abstraction: '物語調で具体的',
      structure: '展開が多くドラマチック',
    },
  },
  {
    names: ['Ado', 'アド'],
    elements: {
      genre: 'J-POP(ロック・ボカロ系)',
      era: '2020年代',
      tempo: '速め',
      emotion: '衝動と反骨',
      instruments: '歪んだバンドサウンド+シンセ',
      density: '言葉多め',
      abstraction: '感情直球で具体的',
      structure: '声の強弱で魅せる大きな起伏',
    },
  },
  {
    names: ['King Gnu', 'キングヌー'],
    elements: {
      genre: 'J-POP(ミクスチャーロック)',
      era: '2010年代末〜',
      tempo: 'ミドル',
      emotion: '都会的な緊張と哀愁',
      instruments: 'バンド+ストリングス',
      density: 'ふつう〜多め',
      abstraction: 'やや抽象的',
      structure: '対照的な2つの声色の掛け合い',
    },
  },
  {
    names: ['back number', 'バックナンバー'],
    elements: {
      genre: 'J-POP(バンド)',
      era: '2010年代〜',
      tempo: 'ミドル',
      emotion: '未練と片想いの機微',
      instruments: '王道バンドサウンド',
      density: 'ふつう',
      abstraction: '日常の情景で具体的',
      structure: 'サビで感情が溢れる王道進行',
    },
  },
  {
    names: ['Vaundy', 'バウンディ'],
    elements: {
      genre: 'J-POP(R&B・ロック横断)',
      era: '2020年代',
      tempo: '曲により幅広い',
      emotion: '浮遊感と皮肉',
      instruments: 'ローファイなバンド+シンセ',
      density: 'ふつう',
      abstraction: 'イメージ優先でやや抽象',
      structure: 'リフレインを軸にした構成',
    },
  },
  {
    names: ['星野源'],
    elements: {
      genre: 'J-POP(ソウル・ファンク寄り)',
      era: '2010年代〜',
      tempo: 'ミドル(踊れる)',
      emotion: '日常の肯定とユーモア',
      instruments: 'ファンクバンド+コーラス',
      density: 'ふつう',
      abstraction: '生活語で具体的',
      structure: 'リズム重視で言葉が跳ねる',
    },
  },
  {
    names: ['Mrs. GREEN APPLE', 'ミセスグリーンアップル', 'ミセス'],
    elements: {
      genre: 'J-POP(ポップロック)',
      era: '2010年代後半〜',
      tempo: '速め',
      emotion: '前向きさと切なさの振れ幅',
      instruments: 'カラフルなバンド+シンセ',
      density: '言葉多め',
      abstraction: 'メッセージ直球',
      structure: '高音サビで一気に開ける',
    },
  },
  {
    names: ['aiko'],
    elements: {
      genre: 'J-POP',
      era: '2000年代〜',
      tempo: 'ミドル',
      emotion: '恋の機微の接写',
      instruments: 'ピアノ+バンド',
      density: 'ふつう',
      abstraction: '体温のある具体描写',
      structure: 'メロディが細かく動く',
    },
  },
  {
    names: ['Official髭男dism', 'ヒゲダン', '髭男'],
    elements: {
      genre: 'J-POP(ピアノポップ)',
      era: '2010年代末〜',
      tempo: 'ミドル〜速め',
      emotion: '多幸感とほろ苦さ',
      instruments: 'ピアノ+バンド+ホーン',
      density: '言葉多め',
      abstraction: '比喩を織り込んだ具体',
      structure: '高いキーのサビが山場',
    },
  },
  {
    names: ['スピッツ'],
    elements: {
      genre: 'J-POP(ギターポップ)',
      era: '1990年代〜',
      tempo: 'ミドル',
      emotion: '透明感と少しの毒',
      instruments: 'クリーンなギターバンド',
      density: '少なめ〜ふつう',
      abstraction: '幻想的な比喩が多め',
      structure: 'シンプルな構成で言葉を立てる',
    },
  },
  {
    names: ['Taylor Swift', 'テイラースウィフト', 'テイラー・スウィフト'],
    elements: {
      genre: 'ポップ(カントリー出自)',
      era: '2010年代〜',
      tempo: 'ミドル',
      emotion: '物語仕立ての恋愛と自立',
      instruments: 'ポップバンド+シンセ',
      density: '言葉多め',
      abstraction: '固有名詞を使った具体',
      structure: 'ブリッジで物語が転換',
    },
  },
  {
    names: ['Ed Sheeran', 'エドシーラン', 'エド・シーラン'],
    elements: {
      genre: 'ポップ(アコースティック)',
      era: '2010年代〜',
      tempo: 'ミドル',
      emotion: '親密さと素朴さ',
      instruments: 'アコースティックギター+ループ',
      density: 'ふつう',
      abstraction: '会話調で具体的',
      structure: '小さな編成で歌を前に出す',
    },
  },
  {
    names: ['Billie Eilish', 'ビリーアイリッシュ', 'ビリー・アイリッシュ'],
    elements: {
      genre: 'オルタナティブポップ',
      era: '2010年代末〜',
      tempo: '遅め〜ミドル',
      emotion: '囁くような不安と皮肉',
      instruments: '低音ベース+ミニマルな電子音',
      density: '少なめ',
      abstraction: '断片的でダーク',
      structure: '静かな声を近くで聴かせる',
    },
  },
]

function detectStyleConversion(input: LyricsReviewInput): StyleConversion | undefined {
  const haystack = `${input.era} ${input.theme} ${input.genre} ${input.concern}`
  for (const entry of ARTIST_STYLE_MAP) {
    const hit = entry.names.find((name) => haystack.toLowerCase().includes(name.toLowerCase()))
    if (hit) {
      const e = entry.elements
      return {
        note: `アーティスト名「${hit}」が入力されていたため、特定の作風の再現ではなく一般的な要素へ変換して参考にしました。存命アーティストの模倣は行いません。`,
        elements: [
          { label: 'ジャンル', value: e.genre },
          { label: '時代感', value: e.era },
          { label: 'テンポ', value: e.tempo },
          { label: '感情', value: e.emotion },
          { label: '楽器', value: e.instruments },
          { label: '言葉の密度', value: e.density },
          { label: '歌詞の抽象度', value: e.abstraction },
          { label: '曲の構成', value: e.structure },
        ],
      }
    }
  }
  return undefined
}

// ---------------------------------------------------------------------------
// 行単位ルール
// ---------------------------------------------------------------------------

interface LineHit {
  ruleId: string
  lineIndex: number // 0始まり
  problem: string
  reason: string
  candidates: string[] // [本命, 別候補...]
  priority: LinePriority
  weight: number
  keepNote: string
}

const MODE_BOOST: Record<string, string[]> = {
  singability: ['line-too-long', 'ending-repeat', 'ai-notation', 'tongue-twister', 'punctuation-heavy'],
  chorus: ['chorus-weak-open', 'chorus-no-hook', 'repeat-excess', 'title-not-in-chorus', 'chorus-weak-conjunction'],
  imagery: ['abstract-cluster', 'too-explanatory'],
  simple: ['hard-word', 'ai-notation', 'too-explanatory', 'tongue-twister'],
  originality: ['cliche', 'abstract-cluster', 'overused-word'],
  repetition: ['repeat-excess', 'chorus-no-hook', 'ending-repeat', 'overused-word'],
}

const LATIN_READINGS: [RegExp, string][] = [
  [/\bSNS\b/gi, 'エスエヌエス'],
  [/\bBGM\b/gi, 'ビージーエム'],
  [/\bAI\b/g, 'エーアイ'],
  [/\bDM\b/g, 'ディーエム'],
  [/\bTV\b/gi, 'テレビ'],
  [/\bOK\b/gi, 'オーケー'],
  [/\bNG\b/g, 'エヌジー'],
  [/\bCD\b/gi, 'シーディー'],
  [/\bLINE\b/g, 'ライン'],
]

interface EngineContext {
  input: LyricsReviewInput
  structure: ParsedStructure
  imagery: string[]
  keepPhrases: string[]
  avoidWords: string[]
  contentLineIndexes: number[]
  lineCounts: Map<string, number[]> // trim済みテキスト → 出現行(0始まり)
  hookLine: string | null
  hookCount: number
  /** BPMから求めた「1行に収まる拍数」の目安 */
  maxMora: number
  /** 曲名(サビに入っているかの判定に使う。未選択時は空) */
  songTitle: string
}

function buildEngineContext(
  input: LyricsReviewInput,
  structure: ParsedStructure,
  songContext: LyricsReviewSongContext,
): EngineContext {
  const keepPhrases = splitList(input.keepPhrases)
  const avoidWords = splitList(input.avoidWords)
  const headingSet = new Set(structure.headingLineIndexes)
  const contentLineIndexes: number[] = []
  const lineCounts = new Map<string, number[]>()

  structure.lines.forEach((line, i) => {
    if (headingSet.has(i) || !line.trim()) return
    contentLineIndexes.push(i)
    const key = line.trim()
    const list = lineCounts.get(key) ?? []
    list.push(i)
    lineCounts.set(key, list)
  })

  // フック(繰り返し)は表記ゆれを吸収して数える。
  // 「君を待っている」と「君を待っているよ」は聴き手には同じ繰り返しに聞こえる。
  const normalizedCounts = new Map<string, { text: string; count: number }>()
  for (const [text, indexes] of lineCounts) {
    const key = normalizeForRepeat(text)
    if (key.length < 4) continue
    const entry = normalizedCounts.get(key) ?? { text, count: 0 }
    entry.count += indexes.length
    normalizedCounts.set(key, entry)
  }

  let hookLine: string | null = null
  let hookCount = 0
  for (const { text, count } of normalizedCounts.values()) {
    if (count >= 2 && count > hookCount) {
      hookLine = text
      hookCount = count
    }
  }

  return {
    input,
    structure,
    imagery: imageryPoolFor(input),
    keepPhrases,
    avoidWords,
    contentLineIndexes,
    lineCounts,
    hookLine,
    hookCount,
    maxMora: maxMoraForBpm(input.bpm),
    songTitle: songContext.songTitle && songContext.songTitle !== '(曲未選択)' ? songContext.songTitle : '',
  }
}

/** 繰り返し判定用の正規化(記号・末尾の終助詞・空白のゆれを吸収する) */
function normalizeForRepeat(text: string): string {
  return text
    .trim()
    .replace(/[\s、。,..!?！？…‥・「」『』()()]/g, '')
    .replace(/(よ|ね|さ|な|わ|ぞ|ぜ)$/, '')
}

function hasKeepPhrase(ctx: EngineContext, line: string): boolean {
  return ctx.keepPhrases.some((phrase) => line.includes(phrase))
}

/** すべての行ルールを評価してヒットを集める */
function collectLineHits(ctx: EngineContext): LineHit[] {
  const { input, structure } = ctx
  const hits: LineHit[] = []
  const seed = input.seed

  const push = (hit: LineHit) => {
    const line = structure.lines[hit.lineIndex]
    if (hasKeepPhrase(ctx, line)) return // 残したい表現を含む行は提案しない
    hits.push(hit)
  }

  // --- 使用したくない表現(最優先) ---
  for (const word of ctx.avoidWords) {
    const re = new RegExp(`${escapeRegExp(word)}[をがはにので]?`)
    for (const i of ctx.contentLineIndexes) {
      const line = structure.lines[i]
      if (!line.includes(word)) continue
      const imagery = pickRotated(ctx.imagery, seed + i)
      push({
        ruleId: 'avoid-word',
        lineIndex: i,
        problem: `使いたくない表現「${word}」が入っている`,
        reason: 'ご自身で避けたいと指定した言葉です。近い情景の言葉に置き換えるか、行ごと削る方が意図が守れます。',
        candidates: [line.replace(word, imagery), line.replace(re, '').trim() || line.replace(word, '').trim()],
        priority: 'high',
        weight: 90,
        keepNote: 'あえて使うと決めているなら、そのまま残して問題ありません。',
      })
    }
  }

  // --- 一行が長すぎる(BPMがあればテンポに合わせて判定する) ---
  const bpmNote = input.bpm.trim()
    ? `BPM${input.bpm.trim()}だと1行あたり約${ctx.maxMora}拍が目安です。`
    : '1行20〜24拍を超えるとワンブレスで歌いにくくなります。'
  for (const i of ctx.contentLineIndexes) {
    const line = structure.lines[i]
    const len = countMora(line)
    if (len <= ctx.maxMora) continue
    const split = splitLongLine(line)
    const shorter = removeFiller(line)
    const candidates: string[] = []
    if (split) candidates.push(split)
    if (shorter && shorter !== line.trim()) candidates.push(shorter)
    if (candidates.length === 0) continue
    const severe = len > ctx.maxMora * 1.3
    push({
      ruleId: 'line-too-long',
      lineIndex: i,
      problem: `一行が長い(約${len}拍 / 目安${ctx.maxMora}拍)`,
      reason: `${bpmNote}詰め込むとAI音楽生成でも早口になったりメロディが崩れやすくなります。2行に割るか言葉を間引くと歌いやすくなります。`,
      candidates,
      priority: severe ? 'high' : 'medium',
      weight: severe ? 80 : 60,
      keepNote: 'ラップ調や語りのパートとして意図しているなら、長いままでも成立します。',
    })
  }

  // --- 一人称が混ざっている ---
  const pronounHits = new Map<string, number[]>()
  for (const i of ctx.contentLineIndexes) {
    const line = structure.lines[i]
    for (const pronoun of FIRST_PERSONS) {
      if (line.includes(pronoun)) {
        const list = pronounHits.get(pronoun) ?? []
        list.push(i)
        pronounHits.set(pronoun, list)
      }
    }
  }
  if (pronounHits.size >= 2) {
    // いちばん多い一人称に寄せる提案を、少数派の行に出す
    const sorted = [...pronounHits.entries()].sort((a, b) => b[1].length - a[1].length)
    const [main] = sorted[0]
    for (const [pronoun, indexes] of sorted.slice(1)) {
      for (const i of indexes) {
        const line = structure.lines[i]
        push({
          ruleId: 'person-mixed',
          lineIndex: i,
          problem: `一人称が混ざっている(この行は「${pronoun}」、他の行は「${main}」)`,
          reason:
            '一人称が揺れると「誰が歌っているのか」がぼやけ、聴き手が感情移入しにくくなります。意図的な視点の切り替えでなければ、どちらかに統一しましょう。',
          candidates: [line.replace(pronoun, main)],
          priority: 'high',
          weight: 72,
          keepNote: '語り手が途中で変わる構成(男女の掛け合いなど)なら、混在させたままで正解です。',
        })
      }
    }
  }

  // --- 説明的すぎる行(助詞が多い) ---
  for (const i of ctx.contentLineIndexes) {
    const line = structure.lines[i].trim()
    const particles = line.match(/[はがをにでとへもの]/g)?.length ?? 0
    if (particles < 5 || countMora(line) < 14) continue
    const split = splitLongLine(line)
    const shorter = removeFiller(line)
    const candidates = [split, shorter].filter((c): c is string => !!c && c !== line)
    if (candidates.length === 0) continue
    push({
      ruleId: 'too-explanatory',
      lineIndex: i,
      problem: `説明っぽい行(助詞が${particles}個)`,
      reason:
        '助詞が多い行は「文章」に近づき、歌うと理屈っぽく聞こえます。助詞を削って名詞と動詞だけ残すと、歌詞らしい強さが出ます。',
      candidates,
      priority: 'medium',
      weight: 52,
      keepNote: '語りかけるタイプの曲なら、説明的な行が親密さになることもあります。',
    })
  }

  // --- 発音しにくい(同じ子音が連続する早口) ---
  for (const i of ctx.contentLineIndexes) {
    const line = structure.lines[i]
    const run = longestConsonantRun(line)
    if (run.length < 3) continue
    const shorter = removeFiller(line)
    const swapped = swapEnding(line)
    const candidates = [shorter, swapped].filter((c): c is string => !!c && c !== line.trim())
    if (candidates.length === 0) continue
    push({
      ruleId: 'tongue-twister',
      lineIndex: i,
      problem: `発音しにくい並び(「${run.sample}」で${run.kind}が続く)`,
      reason:
        '同じ行(子音)が続くと舌が回らず、歌うと言葉がつぶれます。AI音楽生成でも発音が不明瞭になりやすい並びです。1語だけ別の音の言葉に替えると滑らかになります。',
      candidates,
      priority: 'low',
      weight: 44,
      keepNote: '早口部分をあえて聴かせどころにしているなら、そのままで大丈夫です。',
    })
  }

  // --- 句読点が多い ---
  for (const i of ctx.contentLineIndexes) {
    const line = structure.lines[i]
    const marks = line.match(/[、。,.]/g)?.length ?? 0
    if (marks < 2) continue
    push({
      ruleId: 'punctuation-heavy',
      lineIndex: i,
      problem: `句読点が${marks}個ある`,
      reason:
        '歌詞では句読点の代わりに改行で息継ぎを表すのが一般的です。AI音楽サービスによっては句読点を読み上げの区切りとして強く解釈し、不自然な間が入ることがあります。',
      candidates: [line.replace(/[、。,.]/g, '\n').replace(/\n+/g, '\n').trim(), line.replace(/[、。,.]/g, ' ').trim()],
      priority: 'low',
      weight: 38,
      keepNote: '意図的な「ため」を句読点で表しているなら、残す判断もありです。',
    })
  }

  // --- 硬い言葉 ---
  for (const [word, swaps] of HARD_WORDS) {
    for (const i of ctx.contentLineIndexes) {
      const line = structure.lines[i]
      if (!line.includes(word)) continue
      push({
        ruleId: 'hard-word',
        lineIndex: i,
        problem: `硬い言葉「${word}」`,
        reason: `文章では映えますが、耳で一度聴いただけでは伝わりにくい言葉です。${input.audience.trim() || '聴き手'}が聴き取りやすい言い換えを検討できます。`,
        candidates: swaps.map((swap) => line.replace(word, swap)),
        priority: 'medium',
        weight: 55,
        keepNote: '曲の世界観の核になっている言葉なら、残す判断も十分ありです。',
      })
    }
  }

  // --- ありがちな言い回し ---
  for (const cliche of CLICHES) {
    for (const i of ctx.contentLineIndexes) {
      const line = structure.lines[i]
      if (!cliche.re.test(line)) continue
      push({
        ruleId: 'cliche',
        lineIndex: i,
        problem: `${cliche.label}はよく使われる言い回し`,
        reason:
          '多くの曲で使われてきたフレーズなので、ここだけ聴き手の記憶に残りにくくなります。自分の生活にしかない言葉に置き換えると独自性が出ます。',
        candidates: cliche.swaps.map((swap) => line.replace(cliche.re, swap)),
        priority: 'medium',
        weight: 65,
        keepNote: '王道感を狙う曲なら、あえて定番の言い回しを使う選択もあります。',
      })
    }
  }

  // --- 抽象語がかたまっている ---
  for (const i of ctx.contentLineIndexes) {
    const line = structure.lines[i]
    const found = ABSTRACT_WORDS.filter((w) => line.includes(w))
    if (found.length < 2) continue
    const imagery = pickRotated(ctx.imagery, seed + i)
    const imagery2 = pickRotated(ctx.imagery, seed + i + 1)
    push({
      ruleId: 'abstract-cluster',
      lineIndex: i,
      problem: `抽象的な言葉が1行に${found.length}個(${found.join('・')})`,
      reason:
        '抽象語が続くと景色が浮かばず、どの曲にも当てはまる歌詞に聴こえてしまいます。具体的な情景をひとつ足すだけで映像が立ち上がります。',
      candidates: [`${imagery}、${line.trim()}`, `${line.trim()}\n${imagery2}`],
      priority: 'medium',
      weight: 60,
      keepNote: 'サビで一気に開くための抽象なら、AメロやBメロを具体に寄せる手もあります。',
    })
  }

  // --- 語尾の連続 ---
  const endings = ctx.contentLineIndexes.map((i) => {
    const t = structure.lines[i].trim()
    return t.slice(-1)
  })
  for (let k = 2; k < ctx.contentLineIndexes.length; k += 1) {
    if (endings[k] && endings[k] === endings[k - 1] && endings[k] === endings[k - 2]) {
      const i = ctx.contentLineIndexes[k]
      const line = structure.lines[i]
      const swapped = swapEnding(line)
      if (!swapped) continue
      push({
        ruleId: 'ending-repeat',
        lineIndex: i,
        problem: `語尾「${endings[k]}」が3行続いている`,
        reason:
          '同じ語尾が続くとリズムが単調になります。3行目だけ語尾を変えると、流れに小さな起伏が生まれます。',
        candidates: [swapped, withInterjection(line, seed + i)],
        priority: 'low',
        weight: 50,
        keepNote: '意図的な畳みかけ(リフレイン)なら、そのままの方が強いこともあります。',
      })
    }
  }

  // --- 同じ行の繰り返しすぎ ---
  for (const [text, indexes] of ctx.lineCounts) {
    if (indexes.length < 4) continue
    for (const i of indexes.slice(3)) {
      const swapped = swapEnding(text) ?? withInterjection(text, seed + i)
      push({
        ruleId: 'repeat-excess',
        lineIndex: i,
        problem: `「${truncate(text, 12)}」が${indexes.length}回繰り返されている`,
        reason:
          '繰り返しはフックになりますが、4回を超えると効果が薄れます。後半の繰り返しに小さな変化を入れると最後まで飽きさせません。',
        candidates: [swapped, `${text} ${pickRotated(['もう一度', 'まだ', 'ずっと'], seed + i)}`],
        priority: 'medium',
        weight: 55,
        keepNote: 'ヒップホップやチル系では、同じ行の反復がグルーヴを作る場合もあります。',
      })
    }
  }

  // --- AI音楽生成で読み間違えやすい表記 ---
  for (const i of ctx.contentLineIndexes) {
    const line = structure.lines[i]
    const hasDigit = /\d/.test(line)
    const latinHit = LATIN_READINGS.find(([re]) => {
      re.lastIndex = 0
      return re.test(line)
    })
    if (!hasDigit && !latinHit) continue
    let converted = line
    if (hasDigit) {
      converted = converted.replace(/\d+/g, (m) => {
        const n = Number.parseInt(m, 10)
        return n >= 1 && n <= 99 ? numToKanji(n) : m
      })
    }
    for (const [re, reading] of LATIN_READINGS) {
      re.lastIndex = 0
      converted = converted.replace(re, reading)
    }
    if (converted === line) continue
    push({
      ruleId: 'ai-notation',
      lineIndex: i,
      problem: '数字・アルファベット表記が混ざっている',
      reason: `${input.service.trim() || 'Sunoなどの音楽AI'}は数字や略語の読み方を間違えることがあります。読み方をひらがな・漢字で固定すると狙い通りに歌われやすくなります。`,
      candidates: [converted],
      priority: 'low',
      weight: 40,
      keepNote: '英語表記のまま歌わせたい場合は、そのままでも生成できます(読みブレのリスクだけ把握を)。',
    })
  }

  // --- サビの入りが重い ---
  const choruses = findChorusSections(structure)
  const firstChorus = choruses[0]
  if (firstChorus && firstChorus.startLine <= firstChorus.endLine) {
    const i = firstChorus.startLine
    const line = structure.lines[i]
    const len = countMora(line)
    // サビ頭は本編より2割ほど短く言い切れると強い
    if (len > Math.round(ctx.maxMora * 0.8)) {
      const split = splitLongLine(line)
      const firstHalf = split ? split.split('\n')[0] : null
      const emotionHead = splitList(input.emotion)[0]?.split(/[とやの]/)[0] ?? ''
      const candidates: string[] = []
      if (split) candidates.push(split)
      if (emotionHead && emotionHead.length <= 6 && firstHalf) {
        candidates.push(`${emotionHead}、${firstHalf}`)
      }
      const shorter = removeFiller(line)
      if (shorter && shorter !== line.trim()) candidates.push(shorter)
      if (candidates.length > 0) {
        push({
          ruleId: 'chorus-weak-open',
          lineIndex: i,
          problem: `サビの1行目が長い(約${len}拍)`,
          reason:
            'サビの第一声は曲の顔です。短く言い切る形にすると、最初の2秒で耳をつかめます(ショート動画でもサビ頭が切り抜かれやすくなります)。',
          candidates,
          priority: 'high',
          weight: 75,
          keepNote: 'じわっと盛り上げるバラードなら、長いサビ頭が味になることもあります。',
        })
      }
    }
  }

  // --- フック(繰り返し)が無い ---
  if (firstChorus && !ctx.hookLine && firstChorus.startLine <= firstChorus.endLine) {
    const lastIndex = firstChorus.endLine
    const lastLine = structure.lines[lastIndex]
    const openLine = structure.lines[firstChorus.startLine].trim()
    if (lastLine.trim() && openLine) {
      push({
        ruleId: 'chorus-no-hook',
        lineIndex: lastIndex,
        problem: '曲全体で繰り返されるフレーズ(フック)が無い',
        reason:
          '一度しか出てこない言葉は覚えられません。サビの最初のフレーズをサビの最後でもう一度歌うだけで、記憶に残る「フック」になります。',
        candidates: [`${lastLine.trim()}\n${openLine}`, `${lastLine.trim()}\n${truncate(openLine, 10)}`],
        priority: 'high',
        weight: 70,
        keepNote: '物語をたどる曲(歌い切り型)なら、繰り返しを使わない選択もあります。',
      })
    }
  }

  // --- 曲名がサビに入っていない ---
  if (ctx.songTitle && firstChorus && firstChorus.startLine <= firstChorus.endLine) {
    const titleCore = ctx.songTitle.replace(/[\s〜~(())【】]/g, '')
    const appearsAnywhere = input.lyrics.includes(titleCore)
    if (titleCore.length >= 2 && titleCore.length <= 14 && !appearsAnywhere) {
      const i = firstChorus.startLine
      const line = structure.lines[i].trim()
      push({
        ruleId: 'title-not-in-chorus',
        lineIndex: i,
        problem: `曲名「${ctx.songTitle}」が歌詞に一度も出てこない`,
        reason:
          'サビに曲名が入っていると、聴き手が曲を思い出す手がかりになり、検索や口コミでも見つけてもらいやすくなります。サビのどこか1か所に置くだけで効果があります。',
        candidates: [`${titleCore} ${line}`, `${line}\n${titleCore}`],
        priority: 'medium',
        weight: 66,
        keepNote: '曲名をあえて歌詞に入れない作り方(タイトルが答え合わせになる構成)も立派な手法です。',
      })
    }
  }

  // --- サビの入りが接続詞で始まっている ---
  if (firstChorus && firstChorus.startLine <= firstChorus.endLine) {
    const i = firstChorus.startLine
    const line = structure.lines[i].trim()
    const conjunction = WEAK_OPENERS.find((word) => line.startsWith(word))
    if (conjunction && line.length > conjunction.length + 3) {
      const stripped = line.slice(conjunction.length).trim()
      push({
        ruleId: 'chorus-weak-conjunction',
        lineIndex: i,
        problem: `サビが接続詞「${conjunction}」で始まっている`,
        reason:
          'サビの第一声が接続詞だと、いちばん盛り上がる瞬間に前置きが入ってしまいます。名詞や動詞から始めると、最初の一音で世界が立ち上がります。',
        candidates: [stripped, withInterjection(stripped, seed + i)],
        priority: 'medium',
        weight: 62,
        keepNote: 'Aメロからの流れを地続きに見せたい場合は、接続詞のままが自然なこともあります。',
      })
    }
  }

  // --- 同じ言葉の使いすぎ ---
  for (const [word, indexes] of countKeywordUsage(ctx)) {
    if (indexes.length < 4) continue
    for (const i of indexes.slice(2)) {
      const line = structure.lines[i]
      const imagery = pickRotated(ctx.imagery, seed + i)
      push({
        ruleId: 'overused-word',
        lineIndex: i,
        problem: `「${word}」が歌詞全体で${indexes.length}回出てくる`,
        reason:
          '同じ言葉が何度も出ると、語彙が乏しく聞こえたり、その言葉の重みが薄れたりします。1〜2か所を別の言い方や具体的な情景に替えると、残した箇所がぐっと効いてきます。',
        candidates: [line.replace(word, imagery), line.replace(word, '').replace(/\s{2,}/g, ' ').trim()].filter(
          (c) => c && c !== line.trim(),
        ),
        priority: 'medium',
        weight: 56,
        keepNote: 'キーワードとして意図的に連呼しているなら、回数はそのままで大丈夫です。',
      })
    }
  }

  return hits
}

/** サビの第一声としては弱い書き出し */
const WEAK_OPENERS = ['でも', 'だから', 'そして', 'それでも', 'けれど', 'だけど', 'しかし', 'そんな']

/**
 * 使いすぎを見るための語の出現行を数える。
 * - 2文字以上の漢字のまとまり / 3文字以上のカタカナ語
 * - 単漢字は、歌詞で特に使いすぎになりやすい抽象語(心・夢・愛など)だけを見る
 */
function countKeywordUsage(ctx: EngineContext): Map<string, number[]> {
  const usage = new Map<string, number[]>()
  for (const i of ctx.contentLineIndexes) {
    const line = ctx.structure.lines[i]
    const words = line.match(/[一-鿿々]{2,}|[゠-ヿ]{3,}/g) ?? []
    const abstractHits = ABSTRACT_WORDS.filter((w) => line.includes(w))
    for (const word of new Set([...words, ...abstractHits])) {
      if (ctx.keepPhrases.some((p) => p.includes(word))) continue
      const list = usage.get(word) ?? []
      list.push(i)
      usage.set(word, list)
    }
  }
  return usage
}

/** 全面的に作り直すモード:提案が付いていない行にも言い換えを付ける */
function collectRewriteHits(ctx: EngineContext, covered: Set<number>): LineHit[] {
  const { structure, input } = ctx
  const hits: LineHit[] = []
  for (const i of ctx.contentLineIndexes) {
    if (covered.has(i)) continue
    const line = structure.lines[i]
    if (hasKeepPhrase(ctx, line)) continue
    const trimmed = line.trim()
    const seed = input.seed + i
    const toolbox: (string | null)[] = [
      swapEnding(trimmed),
      singableLength(trimmed) >= 14 ? splitLongLine(trimmed) : null,
      `${pickRotated(ctx.imagery, seed)}、${trimmed}`,
      withInterjection(trimmed, seed),
      removeFiller(trimmed),
    ]
    const candidates = toolbox.filter((c): c is string => !!c && c !== trimmed)
    if (candidates.length === 0) continue
    const rotated = candidates.length > 1 ? candidates.slice(seed % candidates.length).concat(candidates.slice(0, seed % candidates.length)) : candidates
    hits.push({
      ruleId: 'rewrite',
      lineIndex: i,
      problem: '言い回しの別パターン提案',
      reason:
        '全面的に作り直すモードのため、意図を変えない範囲で語感の違う候補を出しています。しっくり来なければ元のままで大丈夫です。',
      candidates: rotated.slice(0, 3),
      priority: 'low',
      weight: 30,
      keepNote: '原文の方が自然なら、迷わず元のままを選んでください。',
    })
  }
  return hits
}

/** 行ごとに最も重要なヒットへ統合する */
function mergeHits(hits: LineHit[]): LineHit[] {
  const byLine = new Map<number, LineHit[]>()
  for (const hit of hits) {
    const list = byLine.get(hit.lineIndex) ?? []
    list.push(hit)
    byLine.set(hit.lineIndex, list)
  }
  const merged: LineHit[] = []
  for (const list of byLine.values()) {
    list.sort((a, b) => b.weight - a.weight)
    const main = list[0]
    if (list.length > 1) {
      main.reason = `${main.reason} また、${list[1].problem}という点も見つかりました。`
    }
    merged.push(main)
  }
  return merged
}

const INTENSITY_CAPS: Record<string, number> = { gentle: 4, standard: 9, bold: 18 }
const REWRITE_CAPS: Record<string, number> = { gentle: 8, standard: 16, bold: 40 }

// ---------------------------------------------------------------------------
// 項目別評価・全体講評
// ---------------------------------------------------------------------------

interface Stats {
  contentLineCount: number
  longLines: { index: number; len: number }[]
  endingRunCount: number
  hardWordCount: number
  clicheCount: number
  abstractLineCount: number
  concreteLineCount: number
  notationCount: number
  hasChorus: boolean
  chorusOpenShort: boolean
  /** 行ごとの拍数のばらつき(大きいほどメロディに乗せにくい) */
  moraSpread: number
  /** 発音しにくい並びのあった行数 */
  hardToSayCount: number
  /** 一人称が混ざっているか */
  personMixed: boolean
}

function computeStats(ctx: EngineContext): Stats {
  const { structure } = ctx
  const longLines: { index: number; len: number }[] = []
  const moraList: number[] = []
  let hardWordCount = 0
  let clicheCount = 0
  let abstractLineCount = 0
  let concreteLineCount = 0
  let notationCount = 0
  let hardToSayCount = 0

  for (const i of ctx.contentLineIndexes) {
    const line = structure.lines[i]
    const len = countMora(line)
    moraList.push(len)
    if (len > ctx.maxMora) longLines.push({ index: i, len })
    if (HARD_WORDS.some(([w]) => line.includes(w))) hardWordCount += 1
    if (CLICHES.some((c) => c.re.test(line))) clicheCount += 1
    if (ABSTRACT_WORDS.filter((w) => line.includes(w)).length >= 2) abstractLineCount += 1
    if (CONCRETE_HINT_RE.test(line)) concreteLineCount += 1
    if (/\d/.test(line)) notationCount += 1
    if (longestConsonantRun(line).length >= 3) hardToSayCount += 1
  }

  let endingRunCount = 0
  const endings = ctx.contentLineIndexes.map((i) => structure.lines[i].trim().slice(-1))
  for (let k = 2; k < endings.length; k += 1) {
    if (endings[k] && endings[k] === endings[k - 1] && endings[k] === endings[k - 2]) endingRunCount += 1
  }

  // 拍数のばらつき(標準偏差)。同じくらいの長さで揃うとメロディに乗せやすい
  const mean = moraList.length ? moraList.reduce((a, b) => a + b, 0) / moraList.length : 0
  const variance = moraList.length
    ? moraList.reduce((sum, v) => sum + (v - mean) ** 2, 0) / moraList.length
    : 0
  const moraSpread = Math.sqrt(variance)

  const usedPersons = FIRST_PERSONS.filter((p) => ctx.input.lyrics.includes(p))

  const choruses = findChorusSections(structure)
  const firstChorus = choruses[0]
  const chorusOpenShort =
    !!firstChorus && countMora(structure.lines[firstChorus.startLine] ?? '') <= Math.round(ctx.maxMora * 0.8)

  return {
    contentLineCount: ctx.contentLineIndexes.length,
    longLines,
    endingRunCount,
    hardWordCount,
    clicheCount,
    abstractLineCount,
    concreteLineCount,
    notationCount,
    hasChorus: !!firstChorus,
    chorusOpenShort,
    moraSpread,
    hardToSayCount,
    personMixed: usedPersons.length >= 2,
  }
}

function level(good: boolean, ok: boolean): AxisLevel {
  if (good) return 'good'
  if (ok) return 'ok'
  return 'needs_work'
}

function buildAxes(ctx: EngineContext, stats: Stats): AxisEvaluation[] {
  const { structure } = ctx
  const longest = [...stats.longLines].sort((a, b) => b.len - a.len)[0]

  return [
    {
      axis: 'singability',
      label: '歌いやすさ',
      level: level(
        stats.longLines.length === 0 && stats.hardToSayCount === 0,
        stats.longLines.length <= 2 && stats.hardToSayCount <= 1,
      ),
      comment:
        stats.longLines.length === 0
          ? stats.hardToSayCount === 0
            ? `どの行も1行${ctx.maxMora}拍の目安に収まり、発音の引っかかりもありません。`
            : `行の長さは良いのですが、${stats.hardToSayCount}行に発音しにくい並びがあります。`
          : `${stats.longLines.length}行が目安の${ctx.maxMora}拍を超えています(最長: 「${truncate(structure.lines[longest.index], 14)}」約${longest.len}拍)。`,
    },
    {
      axis: 'rhythm',
      label: '言葉のリズム',
      level: level(
        stats.endingRunCount === 0 && stats.moraSpread < 4,
        stats.endingRunCount <= 1 && stats.moraSpread < 7,
      ),
      comment:
        stats.endingRunCount > 0
          ? `同じ語尾が3行以上続く箇所が${stats.endingRunCount}箇所あり、リズムが平坦になりがちです。`
          : stats.moraSpread >= 7
            ? `行ごとの拍数のばらつきが大きめです(±約${Math.round(stats.moraSpread)}拍)。長さを揃えるとメロディに乗せやすくなります。`
            : '語尾に変化があり、行の長さも揃っていて、リズムが取りやすい歌詞です。',
    },
    {
      axis: 'naturalness',
      label: '言葉の自然さ',
      level: level(
        stats.hardWordCount === 0 && !stats.personMixed,
        stats.hardWordCount <= 1 && !stats.personMixed,
      ),
      comment: stats.personMixed
        ? '一人称が複数まざっています。語り手を統一すると、聴き手が感情移入しやすくなります。'
        : stats.hardWordCount === 0
          ? '耳で聴いてすっと入る言葉が選ばれています。'
          : `一度聴いただけでは伝わりにくい硬い言葉が${stats.hardWordCount}行にあります。`,
    },
    {
      axis: 'imagery',
      label: '情景の伝わりやすさ',
      level: level(stats.concreteLineCount >= 3, stats.concreteLineCount >= 1),
      comment:
        stats.concreteLineCount >= 3
          ? '具体的な景色が見える行が複数あり、映像が浮かびます。'
          : stats.concreteLineCount >= 1
            ? '具体的な情景がもう1〜2行あると、聴き手の頭に映像が残ります。'
            : '情景を描く言葉がほぼ無く、心情だけで進んでいます。場所・物・時間のどれかを足しましょう。',
    },
    {
      axis: 'originality',
      label: '独自性',
      level: level(stats.clicheCount === 0 && stats.abstractLineCount <= 1, stats.clicheCount <= 1),
      comment:
        stats.clicheCount === 0
          ? '定番フレーズに頼りすぎず、自分の言葉で書けています。'
          : `よく使われる言い回しが${stats.clicheCount}箇所あります。1つ自分だけの言葉に変えるだけで印象が変わります。`,
    },
    {
      axis: 'chorusImpact',
      label: 'サビの印象',
      level: level(stats.hasChorus && stats.chorusOpenShort && !!ctx.hookLine, stats.hasChorus),
      comment: !stats.hasChorus
        ? 'サビにあたるブロックが見つかりませんでした。どこを一番聴かせたいか決めましょう。'
        : stats.chorusOpenShort
          ? 'サビの入りは十分コンパクトです。'
          : 'サビの1行目が長めです。短く言い切ると最初の2秒で耳をつかめます。',
    },
    {
      axis: 'repetition',
      label: '繰り返しの効果',
      level: level(ctx.hookCount >= 2 && ctx.hookCount <= 6, ctx.hookCount === 1 || (ctx.hookCount >= 7 && ctx.hookCount <= 8)),
      comment: ctx.hookLine
        ? ctx.hookCount <= 6
          ? `「${truncate(ctx.hookLine, 12)}」の繰り返し(${ctx.hookCount}回)がフックとして機能しています。`
          : `「${truncate(ctx.hookLine, 12)}」が${ctx.hookCount}回登場します。少し間引くと効きが戻ります。`
        : '曲全体で繰り返されるフレーズが無く、聴き終えた後に残る「引っかかり」が弱めです。',
    },
  ]
}

const RULE_THEME: Record<string, string> = {
  'avoid-word': '指定されたNGワードの置き換え',
  'chorus-weak-open': 'サビの入りを短く強くする',
  'chorus-no-hook': '繰り返しのフックを作る',
  'chorus-weak-conjunction': 'サビの第一声を接続詞から始めない',
  'title-not-in-chorus': '曲名をサビに置いて覚えてもらう',
  'line-too-long': '長い行を歌える長さに割る',
  'person-mixed': '一人称を統一して語り手を定める',
  cliche: 'ありがちな言い回しを自分の言葉にする',
  'abstract-cluster': '抽象語を情景に置き換える',
  'hard-word': '硬い言葉をやさしくする',
  'overused-word': '同じ言葉の使いすぎを整理する',
  'too-explanatory': '説明的な行を歌詞らしく削る',
  'repeat-excess': '繰り返しすぎを間引く',
  'ending-repeat': '語尾に変化をつける',
  'tongue-twister': '発音しにくい並びをほどく',
  'punctuation-heavy': '句読点を改行に置き換える',
  'ai-notation': '数字・英字の読みを固定する',
  rewrite: '言い回しの選択肢を広げる',
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------

/**
 * プロバイダー入口。MVPでは mock(端末内ルールベース)のみ。
 * 将来外部AIを追加する場合はここで providerId によって分岐する。
 */
export function reviewLyrics(
  input: LyricsReviewInput,
  context: LyricsReviewSongContext,
  _providerId: AiProviderId = 'mock',
): LyricsReviewResult {
  return reviewWithMock(input, context)
}

/** 端末内ルールベースの添削エンジン(決定的:同じ入力からは同じ結果) */
export function reviewWithMock(
  input: LyricsReviewInput,
  context: LyricsReviewSongContext,
): LyricsReviewResult {
  const structure = parseLyricsStructure(input.lyrics)
  const ctx = buildEngineContext(input, structure, context)
  const stats = computeStats(ctx)
  const styleConversion = detectStyleConversion(input)

  // --- 行単位の指摘を集めて絞り込む ---
  let hits = collectLineHits(ctx)

  // モードによる重み付け
  const boosted = MODE_BOOST[input.mode] ?? []
  for (const hit of hits) {
    if (boosted.includes(hit.ruleId)) hit.weight = Math.round(hit.weight * 1.6)
  }
  // 「軽く整える」は目立つものだけに絞る
  if (input.mode === 'light') {
    hits = hits.filter((h) => h.weight >= 55)
  }

  let merged = mergeHits(hits)
  if (input.mode === 'rewrite') {
    const covered = new Set(merged.map((h) => h.lineIndex))
    merged = merged.concat(collectRewriteHits(ctx, covered))
  }

  merged.sort((a, b) => b.weight - a.weight || a.lineIndex - b.lineIndex)
  const cap = input.mode === 'rewrite' ? REWRITE_CAPS[input.intensity] : INTENSITY_CAPS[input.intensity]
  merged = merged.slice(0, cap)
  merged.sort((a, b) => a.lineIndex - b.lineIndex)

  const lineSuggestions: LineSuggestion[] = merged.map((hit) => {
    const original = structure.lines[hit.lineIndex]
    const [main, ...alternatives] = hit.candidates
    return {
      id: `L${hit.lineIndex + 1}-${hit.ruleId}`,
      ruleId: hit.ruleId,
      sectionLabel: sectionLabelForLine(structure, hit.lineIndex) || '冒頭',
      lineNumber: hit.lineIndex + 1,
      original,
      problem: hit.problem,
      reason: hit.reason,
      suggestion: main,
      alternatives: alternatives.slice(0, 2),
      priority: hit.priority,
      keepNote: hit.keepNote,
    }
  })

  // --- 良い部分(必ず2つ以上) ---
  const goodPoints: string[] = []
  if (structure.explicit) {
    goodPoints.push('セクション構造([Verse]や[サビ]など)が書かれていて、Suno等のAI音楽サービスでそのまま扱いやすい形です。')
  }
  if (ctx.hookLine && ctx.hookCount >= 2 && ctx.hookCount <= 6) {
    goodPoints.push(`「${truncate(ctx.hookLine, 14)}」の繰り返しがフックとして機能していて、聴き終えた後に残ります。`)
  }
  const concreteExample = ctx.contentLineIndexes.find((i) => CONCRETE_HINT_RE.test(structure.lines[i]))
  if (concreteExample !== undefined) {
    goodPoints.push(`「${truncate(structure.lines[concreteExample], 16)}」のように景色が見える行があり、情景の芯になっています。`)
  }
  for (const phrase of ctx.keepPhrases) {
    if (input.lyrics.includes(phrase)) {
      goodPoints.push(`残したい表現「${phrase}」は提案の対象から外し、そのまま活かしています。`)
      break
    }
  }
  if (stats.longLines.length === 0 && stats.contentLineCount > 0) {
    goodPoints.push('一行の長さがそろっていて、メロディに乗せやすい歌詞です。')
  }
  if (goodPoints.length < 2) {
    const firstLine = ctx.contentLineIndexes[0] !== undefined ? structure.lines[ctx.contentLineIndexes[0]] : ''
    if (firstLine) {
      goodPoints.push(`書き出しの「${truncate(firstLine, 14)}」に${input.emotion.trim() || 'この曲'}の空気があり、土台はできています。`)
    }
    if (goodPoints.length < 2) {
      goodPoints.push(`${input.audience.trim() || '聴き手'}に向けて何を歌うかが決まっており、方向性は明確です。`)
    }
  }

  // --- 最優先で直す部分 ---
  const top = [...merged].sort((a, b) => b.weight - a.weight)[0]
  const topPriority = top
    ? `${sectionLabelForLine(structure, top.lineIndex) || '冒頭'}の「${truncate(structure.lines[top.lineIndex], 16)}」— ${top.problem}。まずこの1行から直すのが効果的です。`
    : '大きく直すべき箇所は見つかりませんでした。細部の言葉選びを磨く段階です。'

  // --- 項目別評価・改善優先順位 ---
  const axes = buildAxes(ctx, stats)
  const improvementOrder = [...new Set([...merged].sort((a, b) => b.weight - a.weight).map((h) => RULE_THEME[h.ruleId] ?? h.ruleId))].slice(0, 5)

  // --- 添削後全文(全提案を採用した場合) ---
  const revisedFullText = buildAllAdoptedLyrics(input.lyrics, lineSuggestions)

  // --- 別の方向性 ---
  const imagery1 = pickRotated(ctx.imagery, input.seed + 1)
  const imagery2 = pickRotated(ctx.imagery, input.seed + 2)
  const directionPool: AlternativeDirection[] = [
    {
      title: '視点を入れ替える',
      description: '同じ出来事を相手側(または情景側)から描き直す方向。感情を直接言わずに伝えられます。',
      sampleLines: [imagery1, 'あの日の私を見ていたのは', 'たぶん君じゃなくてこの街だった'],
    },
    {
      title: '時系列を逆から歌う',
      description: '結末を先に見せてから理由をたどる構成。サビの意味が2番で変わって聴こえます。',
      sampleLines: ['さよならから始まる歌にしよう', imagery2, 'そこまで巻き戻して確かめる'],
    },
    {
      title: 'サビ頭を体言止めにする',
      description: `サビの第一声を「${truncate(imagery1, 10)}」のような名詞で言い切り、勢いを作る方向です。`,
      sampleLines: [imagery1, 'それだけ覚えていればいい'],
    },
    {
      title: '会話を一行だけ入れる',
      description: 'かぎかっこの台詞を一箇所だけ使うと、物語の温度が一気に上がります。',
      sampleLines: ['「まだ起きてるの」って通知が光る', 'うん、と打って消した'],
    },
  ]
  const altIndex = Math.abs(input.seed) % directionPool.length
  const alternatives = [directionPool[altIndex], directionPool[(altIndex + 1) % directionPool.length]]

  // --- 次回意識すること ---
  const advicePool = [
    '書き終えたら一度声に出して歌ってみると、長すぎる行が体感でわかります。',
    'サビの1行目は「短く・言い切る」を合言葉にすると、フックが作りやすくなります。',
    '抽象的な言葉(心・未来・夢など)は1ブロックに1個までと決めると、情景が濁りません。',
    '書く前に「その曲の景色」を10個メモしてから書くと、自分にしかない言葉が増えます。',
    'AI音楽サービスに渡す前提なら、セクションタグ([Verse]等)を付けておくと構成が安定します。',
    '同じ語尾が3行続いたら、3行目だけ変える。これだけでリズムが生き返ります。',
  ]
  const nextAdvice = [0, 1, 2].map((k) => pickRotated(advicePool, input.seed + k * 2 + (input.mode === 'rewrite' ? 1 : 0)))

  // --- AIが推測した部分 ---
  const assumptions: string[] = []
  if (!structure.explicit) {
    assumptions.push('セクション構造が書かれていなかったため、空行のまとまりからAIが推定しました(構造表示は推定です)。')
  }
  if (styleConversion) {
    assumptions.push('入力されたアーティスト名は、模倣を避けるため一般的な音楽要素へ変換して扱いました。')
  }
  if (!input.bpm.trim()) {
    assumptions.push(
      `BPMが未入力のため、1行の長さは一般的な目安(${ctx.maxMora}拍)で判定しました。BPMを入れるとテンポに合わせて判定します。`,
    )
  }
  if (!input.vocal.trim()) assumptions.push('ボーカル情報が無いため、キーや音域の高さは考慮していません。')
  for (const phrase of ctx.keepPhrases) {
    if (!input.lyrics.includes(phrase)) {
      assumptions.push(`残したい表現「${phrase}」は歌詞の中に見つかりませんでした(表記ゆれの可能性があります)。`)
    }
  }
  // 読みを推定した漢字があれば正直に開示する(拍数の判定根拠になるため)
  const guessedKanji = [...new Set(moraDetail(input.lyrics).unknownKanji)]
  if (guessedKanji.length > 0) {
    assumptions.push(
      `次の漢字は読み方の辞書に無いため、2拍と仮定して拍数を数えました: ${guessedKanji.slice(0, 8).join('・')}${guessedKanji.length > 8 ? ' ほか' : ''}`,
    )
  }
  assumptions.push(
    '拍数は、かな・漢字の読み・英単語の音節から推定したモーラ(音の数)です。実際に歌ってみた感覚と食い違う場合は、あなたの感覚が正解です。',
  )

  // --- 確信度 ---
  const optionalFilled = [input.theme, input.vocal, input.bpm, input.duration, input.era, input.service, input.concern].filter(
    (v) => v.trim().length > 0,
  ).length
  let score = optionalFilled
  if (input.lyrics.length >= 200) score += 1
  if (structure.explicit) score += 2
  const confidence = score >= 6 ? 'high' : score >= 3 ? 'medium' : 'low'
  const confidenceNote =
    confidence === 'high'
      ? '入力情報が十分そろっているため、提案の的は絞れています。'
      : confidence === 'medium'
        ? '任意項目(テーマ・BPM・ボーカルなど)を足すと、提案の精度が上がります。'
        : '情報が少ないため一般的な提案が中心です。テーマや構造タグを足して再添削するのがおすすめです。'

  // --- 全体コメント ---
  const modeLabel = input.mode === 'rewrite' ? '全面的な作り直し' : '部分的な磨き込み'
  const overallComment = [
    `${input.genre.trim()}で「${input.emotion.trim()}」を${input.audience.trim()}へ届ける歌詞として読みました。`,
    context.songTitle && context.songTitle !== '(曲未選択)' ? `曲「${context.songTitle}」の意図(原文の言葉選び)は残す前提で、${modeLabel}の提案です。` : `原文の意図を残す前提で、${modeLabel}の提案です。`,
    lineSuggestions.length > 0
      ? `行単位の提案は${lineSuggestions.length}件。すべて「採用/却下」を選べるので、しっくり来るものだけ取り入れてください。`
      : '行単位で直すべき箇所はほとんどありません。このまま次の工程に進めます。',
  ].join('')

  return {
    schemaVersion: LYRICS_REVIEW_SCHEMA_VERSION,
    overallComment,
    goodPoints: goodPoints.slice(0, 4),
    topPriority,
    axes,
    improvementOrder: improvementOrder.length > 0 ? improvementOrder : ['細部の言葉選びの磨き込み'],
    lineSuggestions,
    revisedFullText,
    alternatives,
    nextAdvice: [...new Set(nextAdvice)],
    assumptions,
    styleConversion,
    structureEstimated: !structure.explicit,
    confidence,
    confidenceNote,
  }
}

/**
 * 「この行だけ再生成」:候補リストを1つ回転させた新しい結果を返す。
 * 決定的な操作なので、同じ回数だけ回せば同じ結果になる。
 */
export function regenerateLineSuggestion(
  result: LyricsReviewResult,
  suggestionId: string,
  input: LyricsReviewInput,
): LyricsReviewResult {
  const suggestions = result.lineSuggestions.map((s) => {
    if (s.id !== suggestionId) return s
    const pool = [s.suggestion, ...s.alternatives]
    if (pool.length <= 1) {
      // 候補がひとつしか無い場合は、道具箱から別の変換を足す
      const extra = swapEnding(s.original.trim()) ?? withInterjection(s.original, input.seed + s.lineNumber)
      if (extra && !pool.includes(extra)) pool.push(extra)
    }
    const rotated = pool.length > 1 ? [...pool.slice(1), pool[0]] : pool
    return { ...s, suggestion: rotated[0], alternatives: rotated.slice(1, 3) }
  })
  return {
    ...result,
    lineSuggestions: suggestions,
    revisedFullText: buildAllAdoptedLyrics(input.lyrics, suggestions),
  }
}
