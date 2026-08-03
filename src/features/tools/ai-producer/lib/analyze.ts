import type {
  AiProducerInput,
  AiProducerResult,
  AiProducerSongContext,
  Confidence,
  Suggestion,
} from './types'

/**
 * スタジオ内蔵のルールベース分析(モックプロバイダー)。
 * 端末内だけで完結し、外部へデータを送信しない。
 * 決定的(同じ入力なら同じ結果)で、seedを変えると案系の出力だけ変化する。
 */

// ---------- 判定用キーワード ----------

const GENRE_WORDS = [
  'lo-fi', 'lofi', 'jazz', 'rock', 'pop', 'hip hop', 'hiphop', 'trap', 'edm',
  'house', 'techno', 'ambient', 'folk', 'r&b', 'rnb', 'city pop', 'citypop',
  'bossa', 'metal', 'punk', 'orchestral', 'ballad', 'funk', 'soul', 'country',
  'reggae', 'synthwave', 'chillhop', 'acoustic', 'enka', '演歌', 'アニソン',
]

const MOOD_WORDS = [
  'emotional', 'melancholic', 'nostalgic', 'uplifting', 'dreamy', 'dark',
  'chill', 'relaxing', 'energetic', 'sad', 'happy', 'hopeful', 'atmospheric',
  'warm', 'bittersweet', 'epic', 'calm', 'moody', 'romantic', 'mysterious',
  'mellow', 'groovy', 'haunting',
]

const INSTRUMENT_WORDS = [
  'piano', 'guitar', 'drums', 'bass', 'synth', 'strings', 'violin', 'cello',
  'sax', 'saxophone', 'trumpet', 'flute', 'organ', '808', 'pad', 'rhodes',
  'ukulele', 'harmonica', 'beat', 'vinyl',
]

const TEMPO_RE = /\d{2,3}\s*bpm|tempo|slow|fast|uptempo|midtempo|downtempo/i
const VOCAL_RE = /female|male|vocal|instrumental|choir|duet|rap|whisper|falsetto|ボーカル|女性|男性|歌声|インスト|デュエット/i
const SECTION_RE = /\[(verse|chorus|bridge|intro|outro|hook|pre-chorus|refrain)|【?(aメロ|bメロ|cメロ|サビ|イントロ|アウトロ|ブリッジ|ラスサビ|大サビ)/i
const SHORTS_RE = /shorts|ショート|tiktok|ティックトック|リール|reel/i

const AIM_MOOD_MAP: Array<[RegExp, string[]]> = [
  [/切な|せつな|泣け|涙|別れ/, ['melancholic', 'emotional', 'bittersweet']],
  [/元気|明る|前向き|応援|ポジティブ/, ['uplifting', 'bright', 'energetic']],
  [/夜|ナイト|深夜|夜景/, ['nocturnal', 'mellow', 'atmospheric']],
  [/落ち着|癒し|リラックス|作業用|勉強/, ['calm', 'relaxing', 'chill']],
  [/懐かし|ノスタル|昭和|レトロ|思い出/, ['nostalgic', 'retro', 'warm']],
  [/かっこ|クール|疾走|激し/, ['driving', 'edgy', 'powerful']],
  [/怖|ホラー|ダーク|闇|ミステリ/, ['dark', 'mysterious', 'haunting']],
  [/恋|ラブ|好き|愛/, ['romantic', 'heartfelt', 'sweet']],
]

const GENRE_INSTRUMENTS: Array<[RegExp, string[]]> = [
  [/lo-?fi|chillhop/i, ['mellow piano', 'vinyl crackle', 'soft drums']],
  [/rock|punk|metal/i, ['electric guitar', 'driving drums', 'bass']],
  [/pop|citypop|city pop/i, ['bright synth', 'punchy drums', 'clean guitar']],
  [/ballad|演歌/i, ['piano', 'strings']],
  [/jazz|bossa/i, ['upright bass', 'brushed drums', 'saxophone']],
  [/edm|house|techno|synthwave/i, ['analog synth', 'four-on-the-floor kick']],
  [/folk|acoustic|country/i, ['acoustic guitar', 'light percussion']],
]

// ---------- 小さなユーティリティ ----------

function includesAny(text: string, words: string[]): boolean {
  const lower = text.toLowerCase()
  return words.some((w) => lower.includes(w))
}

/** seedで開始位置を回転させてn件選ぶ(再生成でバリエーションを出す) */
function pickRotated<T>(items: T[], seed: number, count: number): T[] {
  if (items.length === 0) return []
  const start = ((seed % items.length) + items.length) % items.length
  const out: T[] = []
  for (let i = 0; i < Math.min(count, items.length); i++) {
    out.push(items[(start + i) % items.length])
  }
  return out
}

function lyricLines(lyrics: string): string[] {
  return lyrics
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !SECTION_RE.test(l))
}

/** 2回以上登場する行(=フック候補)を返す */
function repeatedLine(lyrics: string): string | undefined {
  const counts = new Map<string, number>()
  for (const line of lyricLines(lyrics)) {
    if (line.length < 4) continue
    counts.set(line, (counts.get(line) ?? 0) + 1)
  }
  let best: string | undefined
  let bestCount = 1
  for (const [line, count] of counts) {
    if (count > bestCount) {
      best = line
      bestCount = count
    }
  }
  return best
}

function moodsFromAim(aim: string): string[] {
  for (const [re, moods] of AIM_MOOD_MAP) {
    if (re.test(aim)) return moods
  }
  return ['emotional', 'atmospheric']
}

// ---------- 改善提案ルール ----------

interface RuleHit {
  rank: number
  suggestion: Suggestion
}

function collectSuggestions(
  input: AiProducerInput,
  context: AiProducerSongContext,
): Suggestion[] {
  const hits: RuleHit[] = []
  const lyrics = input.lyrics.trim()
  const prompt = input.sunoPrompt.trim()
  const lines = lyricLines(lyrics)
  const hook = repeatedLine(lyrics)
  const moods = moodsFromAim(input.aim)
  const wantsShorts = SHORTS_RE.test(input.media)

  if (!lyrics && !prompt) {
    hits.push({
      rank: 5,
      suggestion: {
        ruleId: 'input-missing-text',
        target: 'input',
        problem: '歌詞・Sunoプロンプトが未入力で、説明文だけの分析になっている',
        reason: '行単位・単語単位の具体的な指摘は、実物のテキストがないとできないため',
        fix: '曲詳細画面で歌詞かSunoプロンプトを保存してから、曲を選択して再分析する',
        example: '歌詞タブに1番だけでも貼り付けて再分析すると、フックや構成の指摘が出ます',
        priority: 'now',
        expected: '提案が「一般論」から「この曲専用」に変わる',
      },
    })
  }

  if (lyrics && !SECTION_RE.test(input.lyrics)) {
    hits.push({
      rank: 10,
      suggestion: {
        ruleId: 'lyrics-no-sections',
        target: 'lyrics',
        problem: '歌詞に構成タグ([Verse]/[Chorus]など)がない',
        reason: 'Sunoは構成タグを手がかりに展開を作るため、タグがないと構成が運任せになる',
        fix: 'AメロやサビのまとまりごとにSuno形式のタグを行頭に入れる',
        example: '[Verse]\n(Aメロの歌詞)\n\n[Chorus]\n(サビの歌詞)',
        priority: 'now',
        expected: '生成のたびに構成が崩れるガチャが減り、意図した展開になりやすい',
      },
    })
  }

  if (prompt) {
    const hasGenre = includesAny(prompt, GENRE_WORDS) || (input.genre.trim() !== '' && prompt.toLowerCase().includes(input.genre.trim().toLowerCase()))
    if (!hasGenre) {
      hits.push({
        rank: 12,
        suggestion: {
          ruleId: 'suno-missing-genre',
          target: 'suno',
          problem: 'Sunoプロンプトにジャンル指定が見当たらない',
          reason: 'ジャンルは生成の土台。指定がないとSunoが毎回別ジャンルに解釈しうる',
          fix: input.genre.trim()
            ? `プロンプト先頭に「${input.genre.trim()}」を英語表記で追加する`
            : 'プロンプト先頭にジャンル(例: lo-fi hip hop, city pop)を追加する',
          example: input.genre.trim()
            ? `${input.genre.trim()}, ${prompt.slice(0, 40)}...`
            : `lo-fi hip hop, ${prompt.slice(0, 40)}...`,
          priority: 'now',
          expected: '生成結果のジャンルブレが減り、リテイク回数が下がる',
        },
      })
    }

    if (!VOCAL_RE.test(prompt)) {
      hits.push({
        rank: 14,
        suggestion: {
          ruleId: 'suno-missing-vocal',
          target: 'suno',
          problem: 'ボーカル指定(female/male/instrumentalなど)がない',
          reason: '声質は曲の印象を最も左右する要素の一つで、未指定だと毎回変わる',
          fix: '想定する聴き手に合わせて「female vocal」「male vocal」「instrumental」などを追加する',
          example: 'soft female vocal / deep male vocal / instrumental, no vocals',
          priority: 'now',
          expected: '声のイメージが安定し、聴き手の想定とズレにくくなる',
        },
      })
    }

    if (!includesAny(prompt, MOOD_WORDS)) {
      hits.push({
        rank: 16,
        suggestion: {
          ruleId: 'suno-missing-mood',
          target: 'suno',
          problem: '雰囲気・感情を表す単語(mood)がプロンプトにない',
          reason: `「${input.aim.slice(0, 20)}」という狙いは、mood語で伝えるのが最も効く`,
          fix: `狙いに合うmood語を2〜3個追加する(例: ${moods.join(', ')})`,
          example: `${moods.slice(0, 2).join(', ')} を既存プロンプトへ追記`,
          priority: 'now',
          expected: '曲の感情の方向が狙いに寄り、「良いけど違う」生成が減る',
        },
      })
    }

    if (!TEMPO_RE.test(prompt)) {
      hits.push({
        rank: 18,
        suggestion: {
          ruleId: 'suno-missing-tempo',
          target: 'suno',
          problem: 'テンポ(BPM)の指定がない',
          reason: 'テンポは「聴くシーン」を決める。作業用・ドライブ用などの用途と直結する',
          fix: input.bpm.trim()
            ? `「${input.bpm.trim()} BPM」をプロンプトに追加する`
            : 'まず想定BPMを決めて(バラード60-75/ミッド85-105/アップ120以上)、数字で入れる',
          example: input.bpm.trim() ? `${input.bpm.trim()} BPM, ...` : '90 BPM, ...',
          priority: 'now',
          expected: 'テンポの当たり外れがなくなり、用途に合った曲になる',
        },
      })
    }

    if (!includesAny(prompt, INSTRUMENT_WORDS)) {
      const genreForInst = `${input.genre} ${prompt}`
      const instMatch = GENRE_INSTRUMENTS.find(([re]) => re.test(genreForInst))
      const inst = instMatch ? instMatch[1] : ['piano', 'warm pads']
      hits.push({
        rank: 40,
        suggestion: {
          ruleId: 'suno-missing-instruments',
          target: 'suno',
          problem: '主役になる楽器の指定がない',
          reason: '楽器を2〜3個指定すると、アレンジの軸が定まりミックスもまとまりやすい',
          fix: `ジャンルに合う楽器を指定する(例: ${inst.join(', ')})`,
          example: `${inst.slice(0, 2).join(', ')} を追記`,
          priority: 'later',
          expected: 'アレンジの方向が安定し、「音がゴチャつく」生成が減る',
        },
      })
    }

    if (prompt.length > 600) {
      hits.push({
        rank: 46,
        suggestion: {
          ruleId: 'suno-too-long',
          target: 'suno',
          problem: `Sunoプロンプトが長すぎる(${prompt.length}文字)`,
          reason: '要素が多いほど1つ1つの効きが薄まり、矛盾した指定も起きやすい',
          fix: '「ジャンル・mood・テンポ・ボーカル・主役楽器」の5要素に絞って書き直す',
          example: 'lo-fi hip hop, nostalgic, 85 BPM, soft female vocal, mellow piano',
          priority: 'later',
          expected: '重要な指定が確実に反映されるようになる',
        },
      })
    }
  }

  if (lyrics && lines.length >= 4 && !hook) {
    hits.push({
      rank: 20,
      suggestion: {
        ruleId: 'lyrics-no-hook-repeat',
        target: 'lyrics',
        problem: '2回以上繰り返される行(フック)が歌詞にない',
        reason: '繰り返しは「覚えてもらう」ための最重要装置。1回しか出ない言葉は残らない',
        fix: 'サビの中で一番伝えたい1行を決め、サビ内またはサビごとに繰り返す',
        example: `サビ末尾で「${(lines[0] ?? 'キーフレーズ').slice(0, 12)}」をもう一度歌う`,
        priority: 'now',
        expected: '1回聴いただけで口ずさめる率が上がり、リピート再生されやすくなる',
      },
    })
  }

  if (wantsShorts && lyrics && lines.length > 0) {
    hits.push({
      rank: 22,
      suggestion: {
        ruleId: 'structure-hook-first',
        target: 'structure',
        problem: 'Shorts向けなのに、サビ(フック)が曲の頭に来る設計になっていない可能性',
        reason: 'Shortsは最初の1〜2秒で離脱が決まる。イントロやAメロから始めると聴かれない',
        fix: 'Shorts用にはサビ始まりの構成を検討する(歌詞の先頭に[Chorus]を置く)',
        example: '[Chorus]から始めた別バージョンをSunoで生成し、Shorts専用に使う',
        priority: 'now',
        expected: '冒頭離脱が減り、最後まで見られる確率が上がる',
      },
    })
  }

  if (lyrics && input.lyrics.length < 120 && lines.length > 0) {
    hits.push({
      rank: 24,
      suggestion: {
        ruleId: 'lyrics-short',
        target: 'lyrics',
        problem: `歌詞が短い(${input.lyrics.length}文字)`,
        reason: 'フル尺(2〜3分)に対して歌詞が少ないと、Sunoが埋め合わせで意図しない繰り返しを作る',
        fix: '1番と同じ構成で2番を書くか、ブリッジ(Cメロ)を1ブロック足す',
        example: '[Verse 2]を追加して、1番の情景を「その後の時間」に進める',
        priority: 'now',
        expected: '展開に意図が通り、中だるみや不自然なループが減る',
      },
    })
  }

  if (lyrics) {
    const longLines = lines.filter((l) => l.length > 28)
    if (longLines.length >= 2) {
      hits.push({
        rank: 42,
        suggestion: {
          ruleId: 'lyrics-long-lines',
          target: 'lyrics',
          problem: `1行が長い歌詞が${longLines.length}行ある(28文字超)`,
          reason: '長い行はメロディに乗せると早口になり、聴き取りづらく歌詞が届かない',
          fix: '長い行を2行に割るか、意味を保ったまま文字数を2〜3割削る',
          example: `「${longLines[0].slice(0, 16)}...」を2行に分割する`,
          priority: 'later',
          expected: '歌詞の聴き取りやすさが上がり、感情が伝わりやすくなる',
        },
      })
    }

    const title = context.songTitle.trim()
    if (title && title !== '無題の曲' && !input.lyrics.includes(title) && title.length <= 12) {
      hits.push({
        rank: 44,
        suggestion: {
          ruleId: 'lyrics-title-disconnect',
          target: 'title',
          problem: `曲名「${title}」が歌詞の中に一度も出てこない`,
          reason: 'タイトルが歌詞に出ると「あの曲だ」と検索・記憶されやすくなる',
          fix: 'サビか最後の行にタイトルの言葉を入れる。合わなければタイトル側を歌詞のフックに寄せる',
          example: hook ? `フック「${hook.slice(0, 14)}」をタイトル候補にする` : 'サビ末尾にタイトルを歌い込む',
          priority: 'later',
          expected: '曲名と曲が結びつき、指名検索・再訪問につながる',
        },
      })
    }
  }

  hits.sort((a, b) => a.rank - b.rank)
  return hits.map((h) => h.suggestion)
}

// ---------- 修正版プロンプト・各種案の生成 ----------

function buildRevisedPrompt(
  input: AiProducerInput,
): { prompt: string; notes: string[] } {
  const base = input.sunoPrompt.trim()
  const moods = moodsFromAim(input.aim)
  const additions: string[] = []
  const notes: string[] = []

  const hasGenre = base !== '' && (includesAny(base, GENRE_WORDS) || (input.genre.trim() !== '' && base.toLowerCase().includes(input.genre.trim().toLowerCase())))
  if (!hasGenre && input.genre.trim()) {
    additions.push(input.genre.trim())
    notes.push(`ジャンル「${input.genre.trim()}」を追加`)
  }
  if (base === '' || !includesAny(base, MOOD_WORDS)) {
    const picked = moods.slice(0, 2)
    additions.push(...picked)
    notes.push(`狙いから雰囲気語(${picked.join(', ')})を追加`)
  }
  if ((base === '' || !TEMPO_RE.test(base)) && input.bpm.trim()) {
    additions.push(`${input.bpm.trim()} BPM`)
    notes.push(`テンポ ${input.bpm.trim()} BPM を追加`)
  }
  if (base === '' || !includesAny(base, INSTRUMENT_WORDS)) {
    const genreForInst = `${input.genre} ${base}`
    const instMatch = GENRE_INSTRUMENTS.find(([re]) => re.test(genreForInst))
    const inst = (instMatch ? instMatch[1] : ['warm piano', 'soft pads']).slice(0, 2)
    additions.push(...inst)
    notes.push(`主役楽器(${inst.join(', ')})を追加`)
  }

  let prompt: string
  if (base && additions.length > 0) {
    prompt = `${base.replace(/[,、]\s*$/, '')}, ${additions.join(', ')}`
  } else if (base) {
    prompt = base
    notes.push('既存プロンプトに大きな不足はないため、構成は変えていません')
  } else {
    prompt = additions.join(', ')
    notes.push('プロンプトが未入力だったため、入力内容から新規に組み立てました')
  }

  if (input.doNotChange.trim()) {
    notes.push(`「${input.doNotChange.trim()}」は変更していません`)
  }
  return { prompt, notes }
}

const CHORUS_IDEA_POOL = (title: string, hook: string | undefined): string[] => [
  `サビの頭でタイトル「${title}」をそのまま歌い、曲の看板にする`,
  'サビ直前に1拍の無音(ブレイク)を入れて、サビの入りを際立たせる',
  hook
    ? `フック「${hook.slice(0, 14)}」をサビの最後にもう一度置き、余韻で終える`
    : 'サビの最後の行を2回繰り返して、終わりの余韻を強くする',
  '1回目のサビは薄いアレンジ、2回目でコーラスを重ねて曲を成長させる',
  'サビの言葉数を減らし、伸ばせる母音(あ段・お段)で気持ちよく歌わせる',
  'ラスサビで半音上の転調を指定し([Key Change]メモ)、感情のピークを作る',
]

const TITLE_SUFFIXES = ['それから', 'もう一度', '今夜だけ', 'その先へ', 'まだ途中']

function moodPrefix(aim: string): string {
  if (/切な|泣け|涙|別れ/.test(aim)) return 'ひとりきりの'
  if (/懐かし|ノスタル|思い出|レトロ/.test(aim)) return 'あの日の'
  if (/夜|深夜/.test(aim)) return '真夜中の'
  if (/元気|前向き|応援/.test(aim)) return 'はじまりの'
  if (/恋|好き|愛/.test(aim)) return 'ふたりの'
  if (/癒し|リラックス|落ち着/.test(aim)) return 'やわらかな'
  return 'きみと'
}

function buildTitleIdeas(
  input: AiProducerInput,
  context: AiProducerSongContext,
): string[] {
  const title = context.songTitle.trim() && context.songTitle !== '無題の曲' ? context.songTitle.trim() : ''
  const hook = repeatedLine(input.lyrics)
  const hookShort = hook?.replace(/[、。!?!?\s]+$/g, '').slice(0, 12)
  const firstLine = lyricLines(input.lyrics)[0]?.slice(0, 12)
  const core = title || hookShort || firstLine || '無題'
  const suffix = pickRotated(TITLE_SUFFIXES, input.seed, 2)

  const ideas = [
    hookShort,
    `${moodPrefix(input.aim)}${core}`,
    `${core}、${suffix[0]}`,
    firstLine && firstLine !== hookShort ? firstLine : undefined,
    `${core}(${suffix[1]})`,
  ]
  return [...new Set(ideas.filter((t): t is string => !!t && t.length >= 2))].slice(0, 5)
}

function buildYoutubeTips(context: AiProducerSongContext): string[] {
  const tips: string[] = []
  if (!context.youtubeUrl && !context.youtubeTitle) {
    tips.push('YouTubeタブに投稿タイトル・概要欄・タグを記録しておくと、次回分析で公開情報も診断できます')
  }
  tips.push('動画タイトルは「曲名+聴くシチュエーション(作業用/夜ドライブなど)」で検索意図を拾う')
  tips.push('サムネイルの文字は7文字以内に絞り、曲の感情を1語で載せる')
  tips.push('概要欄の1行目に「誰のための、どんな曲か」を書く(検索結果とAIレコメンドに効く)')
  if (context.completed || context.status === 'published') {
    tips.push('公開済みの曲は、コメント欄固定で次の曲やプレイリストへの導線を作る')
  }
  return tips
}

function buildShortsTips(input: AiProducerInput): string[] {
  const tips = [
    '最初の1〜2秒にサビの一番強いフレーズを置く(イントロは使わない)',
    '縦型(9:16)で歌詞テロップを大きく出し、無音でも内容が伝わるようにする',
    '15〜30秒で「サビ→もう一度サビ」のループ構成にすると周回再生されやすい',
    '固定コメントにフル版への導線を書く',
  ]
  if (!SHORTS_RE.test(input.media)) {
    tips.unshift('公開媒体にShortsが含まれていない場合も、サビ切り出しの縦動画は低コストで試せます')
  }
  return tips
}

function buildChecklist(
  input: AiProducerInput,
  suggestions: Suggestion[],
): string[] {
  const list: string[] = []
  for (const s of suggestions.filter((s) => s.priority === 'now').slice(0, 3)) {
    list.push(`「${s.problem}」を直してから生成する`)
  }
  if (!input.bpm.trim()) list.push('BPMを決めて、プロンプトに数字で入れる')
  list.push('修正版プロンプトで2〜3回生成し、一番良いテイクだけ残す')
  list.push('生成後は最初の10秒とサビだけ先に確認する(全部聴くのは候補を絞ってから)')
  list.push('聴いた印象と分析結果の差をメモして、再分析で前回と比較する')
  return list
}

function buildUnknowns(
  input: AiProducerInput,
  context: AiProducerSongContext,
): string[] {
  const unknowns = ['実際の音源(ミックス・歌唱・音質)は、このツールからは確認できません']
  if (!input.lyrics.trim()) unknowns.push('歌詞が未入力のため、行単位の提案はできませんでした')
  if (!input.sunoPrompt.trim()) unknowns.push('Sunoプロンプトが未入力のため、プロンプト診断は一般的な内容です')
  if (!input.bpm.trim()) unknowns.push('BPMが不明です')
  if (!input.genre.trim() && !includesAny(input.sunoPrompt, GENRE_WORDS)) unknowns.push('ジャンルが不明です')
  if (!context.mvPrompt) unknowns.push('MVプロンプトが未登録のため、映像との整合は見ていません')
  if (!context.youtubeUrl && !context.youtubeTitle) unknowns.push('YouTube投稿情報が未登録です')
  return unknowns
}

function judgeConfidence(input: AiProducerInput): { confidence: Confidence; note: string } {
  const filled = [
    input.aim,
    input.audience,
    input.media,
    input.lyrics,
    input.sunoPrompt,
    input.genre,
    input.bpm,
    input.concern || input.goal,
  ].filter((v) => v.trim() !== '').length

  if (filled >= 7) {
    return {
      confidence: 'high',
      note: '入力情報が十分に揃っているため、提案の的中度は高めです。ただし内蔵ルール分析(モック)のため、最終判断は必ず耳で行ってください。',
    }
  }
  if (filled >= 5) {
    return {
      confidence: 'medium',
      note: '主要な情報は揃っていますが、不足項目があるため一部は一般的な提案です。「AIが確認できなかった情報」を埋めると精度が上がります。',
    }
  }
  return {
    confidence: 'low',
    note: '入力情報が少ないため、提案は一般論寄りです。歌詞・プロンプト・BPMなどを追加して再分析してください。',
  }
}

function buildGoodPoints(
  input: AiProducerInput,
  context: AiProducerSongContext,
): string[] {
  const points: string[] = []
  if (input.aim.trim() && input.audience.trim() && input.media.trim()) {
    points.push('狙い・聴き手・媒体が言語化されている(制作判断の軸がブレにくい)')
  }
  if (input.lyrics && SECTION_RE.test(input.lyrics)) {
    points.push('歌詞に構成タグがあり、Sunoが展開を理解しやすい状態')
  }
  if (repeatedLine(input.lyrics)) {
    points.push('繰り返しのフックがあり、耳に残る構造ができている')
  }
  if (input.sunoPrompt && includesAny(input.sunoPrompt, GENRE_WORDS) && includesAny(input.sunoPrompt, MOOD_WORDS)) {
    points.push('プロンプトにジャンルと雰囲気の両方があり、方向性が明確')
  }
  if (input.lyrics.trim().length >= 300) {
    points.push('歌詞のボリュームが十分で、フル尺の展開を支えられる')
  }
  if (input.keep.trim() || input.doNotChange.trim()) {
    points.push('「残したいもの」が自分で決まっている(改善で曲の芯を失いにくい)')
  }
  if (context.historyCount >= 5) {
    points.push('制作履歴が積み上がっており、試行錯誤のログが資産になっている')
  }
  if (points.length === 0) {
    points.push('改善の土台になる情報が整理できています。ここから一つずつ磨きましょう')
  }
  return points.slice(0, 4)
}

function buildKeepAsIs(
  input: AiProducerInput,
  suggestions: Suggestion[],
): string[] {
  const keep: string[] = []
  if (input.keep.trim()) keep.push(`残したい要素「${input.keep.trim()}」は提案の対象外にしています`)
  if (input.doNotChange.trim()) keep.push(`「${input.doNotChange.trim()}」は変更しない前提で提案しています`)
  if (repeatedLine(input.lyrics)) keep.push('サビのフック(繰り返し)は機能しているのでそのままで良いです')
  const hasSunoIssues = suggestions.some((s) => s.target === 'suno')
  if (input.sunoPrompt.trim() && !hasSunoIssues) {
    keep.push('Sunoプロンプトは要素が揃っており、大きく変える必要はありません')
  }
  if (keep.length === 0) {
    keep.push('曲の狙いと聴き手の設定は現状のままで大丈夫です')
  }
  return keep
}

// ---------- 公開API ----------

export function analyzeWithMock(
  input: AiProducerInput,
  context: AiProducerSongContext,
): AiProducerResult {
  const suggestions = collectSuggestions(input, context)
  const revised = buildRevisedPrompt(input)
  const hook = repeatedLine(input.lyrics)
  const { confidence, note } = judgeConfidence(input)

  return {
    goodPoints: buildGoodPoints(input, context),
    biggestProblem:
      suggestions.length > 0
        ? suggestions[0].problem
        : '大きな問題は見つかりませんでした。ここからは生成と微調整の繰り返しで磨く段階です',
    suggestions,
    keepAsIs: buildKeepAsIs(input, suggestions),
    revisedSunoPrompt: revised.prompt,
    revisedPromptNotes: revised.notes,
    chorusIdeas: pickRotated(CHORUS_IDEA_POOL(context.songTitle, hook), input.seed, 3),
    titleIdeas: buildTitleIdeas(input, context),
    youtubeTips: buildYoutubeTips(context),
    shortsTips: buildShortsTips(input),
    nextChecklist: buildChecklist(input, suggestions),
    unknowns: buildUnknowns(input, context),
    confidence,
    confidenceNote: note,
  }
}

export type RegenerableSection = 'revisedSunoPrompt' | 'chorusIdeas' | 'titleIdeas'

/** 「一部だけ再生成」— seedを進めて対象セクションだけ作り直す */
export function regenerateSection(
  result: AiProducerResult,
  section: RegenerableSection,
  input: AiProducerInput,
  context: AiProducerSongContext,
): { result: AiProducerResult; input: AiProducerInput } {
  const nextInput = { ...input, seed: input.seed + 1 }
  const next = { ...result }
  if (section === 'revisedSunoPrompt') {
    const revised = buildRevisedPrompt(nextInput)
    next.revisedSunoPrompt = revised.prompt
    next.revisedPromptNotes = revised.notes
  } else if (section === 'chorusIdeas') {
    next.chorusIdeas = pickRotated(
      CHORUS_IDEA_POOL(context.songTitle, repeatedLine(nextInput.lyrics)),
      nextInput.seed,
      3,
    )
  } else {
    next.titleIdeas = buildTitleIdeas(nextInput, context)
  }
  return { result: next, input: nextInput }
}
