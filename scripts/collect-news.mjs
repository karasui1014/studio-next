#!/usr/bin/env node
/**
 * AI音楽ニュース コレクター
 *
 * feeds.json に書かれたRSS/Atomを取得し、AI音楽に関係する記事だけを
 * public/content/news.json にまとめます。外部ライブラリは一切使いません。
 *
 * アプリ（src/）とコンテンツ（public/content/）を分けているのが Version 2 の要。
 * この処理は GitHub Actions が1日4回動かすので、アプリのビルドは不要。
 *
 * 使い方:  npm run news
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTranslator } from './translate.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const FEEDS_PATH = join(ROOT, 'feeds.json');
const OUT_PATH = join(ROOT, '..', 'public', 'content', 'news.json');

// ---- 制限値（安全のための上限。ここを大きくしすぎないこと） ----
const FETCH_TIMEOUT_MS = 15000;   // 1フィードの取得タイムアウト
const MAX_BYTES = 5 * 1024 * 1024; // 1フィードあたり最大5MB
const MAX_ITEMS_PER_FEED = 40;     // 1フィードから取り込む最大件数
const MAX_TOTAL_ITEMS = 400;       // news.json に残す最大件数
const MAX_AGE_DAYS = 90;           // 何日前までの記事を残すか
const TITLE_MAX = 300;
const SUMMARY_MAX = 400;
const CONCURRENCY = 6;             // 同時取得数（相手サーバーへの負荷を抑える）
const MAX_TRANSLATE_PER_RUN = 70;  // 1回の実行で翻訳する記事数の上限
const RANKING_SIZE = 5;            // 注目ランキングに出す件数
const RANKING_WINDOW_DAYS = 7;     // ランキングの対象期間

const USER_AGENT =
  'AIMusicNewsBot/1.0 (personal feed reader; +https://github.com/)';

// ============================================================
// AI音楽キーワード判定
// ============================================================

/** これ1語で「AI音楽ネタ確定」とみなす語 */
const STRONG_TERMS = [
  'suno', 'udio', 'musicgen', 'audiocraft', 'stable audio', 'riffusion',
  'lyria', 'moises', 'boomy', 'soundraw', 'aiva', 'mureka', 'elevenlabs music',
  'text-to-music', 'text to music', 'music generation', 'generative music',
  'generative audio', 'ai music', 'ai-generated music', 'ai-generated song',
  'ai song', 'ai artist', 'voice clone', 'voice cloning', 'singing voice',
  'ai音楽', 'ai作曲', 'ai楽曲', 'ai作詞', 'ai歌唱', 'aiカバー', 'ai生成音楽',
  '音楽生成', '自動作曲', '歌声合成', 'ボイスクローン', '音声クローン',
];

/** AI側の語（音楽側の語と両方あればヒット） */
const AI_TERMS = [
  '\\bai\\b', '\\ba\\.i\\.', 'artificial intelligence', 'generative',
  'genai', 'machine learning', 'deep learning', 'neural network',
  'diffusion model', '\\bllm\\b', 'transformer model',
  '生成ai', '人工知能', '機械学習', 'ディープラーニング', '拡散モデル',
  'ニューラルネット', '大規模言語モデル',
];

/** 音楽側の語 */
const MUSIC_TERMS = [
  '\\bmusic\\b', '\\bsong\\b', '\\bsongs\\b', '\\baudio\\b', '\\bvocal\\b',
  '\\bvocals\\b', '\\bsinger\\b', '\\bsinging\\b', '\\bcomposer\\b',
  '\\bcomposing\\b', '\\blyrics\\b', '\\bmelody\\b', '\\bsoundtrack\\b',
  '\\bspotify\\b', '\\bsynthesizer\\b', '\\bsynth\\b', '\\bdaw\\b',
  '\\bremix\\b', '\\bmastering\\b', 'record label', 'music industry',
  '音楽', '楽曲', '作曲', '編曲', '作詞', '歌詞', 'ボーカル', 'ボカロ',
  '歌声', 'サウンド', 'オーディオ', 'アーティスト', 'レーベル', '音源',
  'メロディ', 'ミキシング', 'マスタリング', 'シンセ', 'dtm', '音声合成',
];

const strongRe = buildRegex(STRONG_TERMS);
const aiRe = buildRegex(AI_TERMS);
const musicRe = buildRegex(MUSIC_TERMS);

function buildRegex(terms) {
  const parts = terms.map((t) => {
    // すでに \b などの正規表現記法で書かれているものはそのまま使う
    if (t.includes('\\')) return t;

    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 英数字だけの語は前後に単語境界を付ける。
    // これが無いと "udio" が st"udio" / a"udio" に、"ai" が m"ai"l に誤爆する。
    if (/^[a-z0-9][a-z0-9 '-]*[a-z0-9]$/i.test(t)) return `\\b${escaped}\\b`;

    // 日本語などは単語境界の概念が無いのでそのまま
    return escaped;
  });
  return new RegExp(parts.join('|'), 'i');
}

/**
 * 記事を採用するか判定する。
 * 媒体の性質によって基準を変えるのが精度のカギ。
 *
 *   all     … 全部通す（検索条件そのものが絞り込みになっているフィード用）
 *   ai      … 音楽専門メディア向け。見出しにAIの語があればOK
 *   music   … AI専門メディア向け。見出しに音楽の語があればOK
 *   keyword … 総合ニュース向け。見出しにAIと音楽の語が両方必要
 *
 * どの場合も「Suno」「音楽生成」などの決定的な語が本文にあれば無条件で採用。
 */
function shouldAccept(item, filter) {
  if (filter === 'all') return true;

  const title = String(item.title || '').toLowerCase();
  const full = `${item.title} ${item.summary}`.toLowerCase();

  if (strongRe.test(full)) return true;
  if (filter === 'ai') return aiRe.test(title);
  if (filter === 'music') return musicRe.test(title);
  return aiRe.test(title) && musicRe.test(title);
}

// ============================================================
// 注目度スコア
//
// 「AI音楽をこれから始める人が知りたいか」を基準に点をつける。
// 業界の資金調達や機材レビューより、「新しく何ができるようになったか」
// 「使い方」「無料で試せるか」「自分の曲は権利的に大丈夫か」を上に出す。
// ============================================================

/** [正規表現ソース, 点数] の組。点数が大きいほど初心者の関心が高い */
const SCORE_RULES = [
  // 使い方・始め方 — 初心者がいちばん知りたい
  [['使い方', '始め方', '入門', '初心者', '使ってみた', '作り方', 'やり方', '解説',
    'tutorial', 'beginner', 'how to', 'guide', 'explained'], 14],

  // 無料で試せる
  [['無料', '無償', 'フリー', '\\bfree\\b', 'free tier', 'no cost'], 12],

  // 日本語対応 — 日本のクリエイターには特に大きい
  [['日本語対応', '日本語', 'japanese'], 10],

  // 新しく使えるようになったもの
  [['発表', 'リリース', '公開', '登場', '提供開始', '新機能', 'アップデート', '新モデル',
    'announce', 'launch', 'release', 'unveil', 'introduc', 'new model', 'update',
    'now available', 'rolls out'], 11],

  // 主要サービス名
  [['suno', 'udio', 'lyria', 'musicgen', 'stable audio', 'elevenlabs', 'riffusion',
    'mureka', 'moises'], 9],

  // 権利・収益化 — 「自分の曲は大丈夫か」は初心者も気にする
  [['著作権', '権利', '商用利用', '規約', '収益化', '配信', 'ロイヤリティ',
    'copyright', 'licens', 'monetiz', 'royalt', 'rights'], 7],

  // 比較・検証記事
  [['比較', '違い', 'どっち', 'vs\\.?', 'compar', 'versus'], 6],

  // 業界のお金の話 — 初心者の制作には直接効かない
  [['買収', '出資', '資金調達', '決算', '上場', '株価', '投資家',
    'acquisition', 'acquires', 'funding round', 'raises \\$', 'ipo', 'valuation',
    'shareholder', 'earnings'], -8],

  // 機材レビュー — AI音楽の話ではないことが多い
  [['ヘッドホン', 'スピーカー', 'イヤホン', 'アンプ', 'dac',
    'headphone', 'earbuds', 'speaker', 'turntable'], -7],
];

const SCORE_REGEXPS = SCORE_RULES.map(([terms, points]) => [buildRegex(terms), points]);

/**
 * 記事の注目度を計算する。
 * 内訳: キーワード + 報道の広がり + 新しさ + 読みやすさ
 */
function scoreItem(item, now) {
  const text = `${item.title} ${item.titleJa || ''} ${item.summary || ''}`.toLowerCase();

  let score = 0;
  for (const [re, points] of SCORE_REGEXPS) {
    if (re.test(text)) score += points;
  }

  // 複数の媒体が同じ話題を報じている＝重要度が高い（最大+24）
  const coverage = Math.max(1, Number(item.coverage) || 1);
  score += Math.min((coverage - 1) * 8, 24);

  // 新しさ。古いニュースを上位に置き続けない
  const published = item.published ? Date.parse(item.published) : NaN;
  if (!Number.isNaN(published)) {
    const hours = (now - published) / 3600000;
    if (hours <= 24) score += 12;
    else if (hours <= 72) score += 7;
    else if (hours <= 168) score += 3;
    else score -= 6;
  }

  // 日本語記事は初心者が読みやすい
  if (item.lang === 'ja') score += 3;

  return score;
}

// ============================================================
// XML（RSS 2.0 / RDF / Atom）の最小パーサー
// 外部ライブラリを入れない代わりに、必要なタグだけを取り出します。
// ============================================================

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘',
  ldquo: '“', rdquo: '”', middot: '·', bull: '•', copy: '©',
  reg: '®', trade: '™', deg: '°', laquo: '«', raquo: '»',
};

function decodeEntities(str) {
  return String(str || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => {
      const key = name.toLowerCase();
      return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, key)
        ? NAMED_ENTITIES[key]
        : m;
    });
}

function safeCodePoint(code) {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

/** HTMLタグを除去してプレーンテキストにする（表示前のサニタイズの一段目） */
function stripHtml(str) {
  return decodeEntities(
    String(str || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function unwrapCdata(str) {
  const m = String(str || '').match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return m ? m[1] : str;
}

/** 指定タグの中身を取り出す（最初の1つ） */
function tagContent(xml, ...names) {
  for (const name of names) {
    const re = new RegExp(
      `<(?:[a-z0-9_-]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[a-z0-9_-]+:)?${name}\\s*>`,
      'i'
    );
    const m = xml.match(re);
    if (m) return unwrapCdata(m[1]);
  }
  return '';
}

/** Atom の <link href="..."> を取り出す */
function atomLink(xml) {
  const links = [...xml.matchAll(/<link\b([^>]*)\/?>/gi)];
  let fallback = '';
  for (const [, attrs] of links) {
    const href = (attrs.match(/href\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (!href) continue;
    const rel = (attrs.match(/rel\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (!rel || rel.toLowerCase() === 'alternate') return decodeEntities(href);
    if (!fallback) fallback = decodeEntities(href);
  }
  return fallback;
}

function splitEntries(xml) {
  const items = [...xml.matchAll(/<item\b[\s\S]*?<\/item\s*>/gi)].map((m) => m[0]);
  if (items.length) return items;
  return [...xml.matchAll(/<entry\b[\s\S]*?<\/entry\s*>/gi)].map((m) => m[0]);
}

function parseFeed(xml) {
  return splitEntries(xml).map((chunk) => {
    const title = stripHtml(tagContent(chunk, 'title'));
    let url = decodeEntities(tagContent(chunk, 'link')).trim();
    if (!url || url.startsWith('<')) url = atomLink(chunk);
    if (!url) url = decodeEntities(tagContent(chunk, 'guid')).trim();

    const summary = stripHtml(
      tagContent(chunk, 'description', 'summary', 'content', 'encoded')
    );
    const dateRaw =
      tagContent(chunk, 'pubDate', 'published', 'updated', 'date') || '';
    // Googleニュースは <source> に元の媒体名が入っている
    const publisher = stripHtml(tagContent(chunk, 'source'));

    return { title, url, summary, dateRaw, publisher };
  });
}

// ============================================================
// 取得
// ============================================================

function isSafeHttpUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

async function fetchFeed(url) {
  if (!isSafeHttpUrl(url)) throw new Error('http/https 以外のURLは取得しません');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) throw new Error('レスポンスが大きすぎます');
    return decodeBody(buf);
  } finally {
    clearTimeout(timer);
  }
}

/** 文字コードを判定してテキスト化（日本語サイトの Shift_JIS / EUC-JP 対策） */
function decodeBody(buf) {
  const head = buf.subarray(0, 400).toString('latin1');
  const m = head.match(/encoding\s*=\s*["']([\w-]+)["']/i);
  const enc = (m ? m[1] : 'utf-8').toLowerCase();
  const map = {
    'shift_jis': 'shift_jis', 'shift-jis': 'shift_jis', sjis: 'shift_jis',
    'windows-31j': 'shift_jis', 'cp932': 'shift_jis',
    'euc-jp': 'euc-jp', eucjp: 'euc-jp',
    'iso-8859-1': 'latin1', 'windows-1252': 'windows-1252',
  };
  const target = map[enc] || 'utf-8';
  try {
    return new TextDecoder(target).decode(buf);
  } catch {
    return buf.toString('utf-8');
  }
}

// ============================================================
// 整形
// ============================================================

function makeId(url, title) {
  return createHash('sha1').update(`${url}|${title}`).digest('hex').slice(0, 16);
}

function parseDate(raw) {
  if (!raw) return null;
  const t = Date.parse(String(raw).trim());
  if (Number.isNaN(t)) return null;
  // 未来の日付（フィード側のミス）は現在時刻に丸める
  return new Date(Math.min(t, Date.now())).toISOString();
}

/** RSSの要約によく混ざる定型文を取り除く */
function cleanSummary(str) {
  return String(str || '')
    .replace(/\s*The post .{0,120}? appeared first on .{0,60}?\.?\s*$/i, '')
    .replace(/\s*(Continue reading|Read more|Read the full story).{0,60}$/i, '')
    .replace(/\s*\[…\]\s*$/, '')
    .replace(/\s*Source\s*$/, '')
    .trim();
}

function clamp(str, max) {
  const s = String(str || '').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** 見出しの重複判定に使うキー（表記ゆれを吸収した簡易版） */
/** 「[写真]」「（1/2枚目）」「(ITmedia NEWS)」のような前後の付加部分を落とす */
function baseTitle(title) {
  let t = String(title || '').trim();
  for (let i = 0; i < 4; i++) {
    const next = t
      .replace(/^[［[【（(]\s*[^］\]】）)]{0,20}[］\]】）)]\s*/u, '')
      .replace(/\s*[［[【（(]\s*[^］\]】）)]{0,30}[］\]】）)]\s*$/u, '')
      .trim();
    if (next === t || !next) break;
    t = next;
  }
  return t;
}

/**
 * 見出しの「文字2つ組」の集合。日本語は単語で切りにくいので、
 * 2文字ずつずらした断片で似ているかを判定する。
 */
function bigrams(title) {
  const t = titleKey(title);
  const set = new Set();
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
  return set;
}

/** 2つの見出しがどれくらい似ているか（0〜1） */
function similarity(a, b) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const g of a) if (b.has(g)) shared++;
  return shared / (a.size + b.size - shared);
}

/**
 * これ以上似ていたら「同じ話題」とみなす。
 * 実測値: 同じ話題の組 = 0.19〜0.28 / 無関係な組 = 0.04 以下。
 * 間を取って 0.13 にしている（無関係な組の3倍の余裕がある）。
 */
const SAME_TOPIC = 0.13;

/** 見出しから英数字のかたまりを取り出す（例: googleが音楽生成AI「Lyria 3.5」→ ailyria35） */
function alnumTokens(title) {
  return titleKey(title).match(/[a-z0-9]{5,}/g) || [];
}

/**
 * 固有名詞レベルの共通部分があるか。
 * 「ailyria35」と「googlelyria35」は文字の重なりでは似て見えないが、
 * どちらも "lyria35" を含むので同じ話題と判定できる。
 */
function sharesKeyTerm(aTokens, bTokens) {
  const MIN = 6;
  for (const a of aTokens) {
    for (const b of bTokens) {
      for (let len = Math.min(a.length, b.length); len >= MIN; len--) {
        for (let i = 0; i + len <= a.length; i++) {
          if (b.includes(a.slice(i, i + len))) return true;
        }
      }
    }
  }
  return false;
}

/** 2つの見出しが同じ話題を指しているか */
function isSameTopic(a, b) {
  return similarity(a.grams, b.grams) >= SAME_TOPIC || sharesKeyTerm(a.tokens, b.tokens);
}

function titleKey(title) {
  // 記号・空白をすべて落とし、文字と数字だけにして比較する
  return baseTitle(title)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
    .slice(0, 48);
}

function normalizeItem(raw, source) {
  const url = raw.url.trim();
  if (!isSafeHttpUrl(url)) return null;

  let title = clamp(raw.title, TITLE_MAX);
  let summary = clamp(cleanSummary(raw.summary), SUMMARY_MAX);
  let displaySource = source.name;
  let via = null;

  if (source.type === 'googlenews') {
    // 「記事タイトル - 媒体名」から媒体名を切り離す
    const publisher = raw.publisher || (title.match(/\s-\s([^-]{2,40})$/) || [])[1] || '';
    if (publisher) {
      const suffix = ` - ${publisher}`;
      if (title.endsWith(suffix)) title = title.slice(0, -suffix.length).trim();
      displaySource = publisher;
    }
    // Googleニュースの description は本文ではなくリンクHTMLなので捨てる
    summary = '';
    via = 'Googleニュース';
  }

  if (!title) return null;

  return {
    id: makeId(url, title),
    title,
    url,
    summary,
    published: parseDate(raw.dateRaw),
    source: displaySource,
    sourceId: source.id,
    via,
    category: source.category,
    lang: source.lang || 'en',
  };
}

// ============================================================
// メイン
// ============================================================

async function runWithLimit(tasks, limit) {
  const results = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]();
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * 英語の記事に日本語の見出し・要約を付ける。
 * すでに titleJa が付いている記事は飛ばすので、同じ記事を何度も翻訳しません。
 */
async function translateItems(items) {
  const pending = items.filter(function (it) {
    return it.lang !== 'ja' && !it.titleJa && !/[぀-ヿ㐀-鿿]/.test(it.title);
  });

  if (!pending.length) {
    console.log('🈯 翻訳が必要な新しい記事はありませんでした。\n');
    return 0;
  }

  const targets = pending.slice(0, MAX_TRANSLATE_PER_RUN);
  console.log(
    `🈯 英語記事を日本語にします（${targets.length}件` +
    (pending.length > targets.length ? ` / 残り${pending.length - targets.length}件は次回` : '') +
    '）…'
  );

  const translator = createTranslator({ email: process.env.MYMEMORY_EMAIL || null });
  let done = 0;

  for (const item of targets) {
    if (!translator.anyAlive()) {
      console.log('     （翻訳の経路がすべて使えなくなったため中断します）');
      break;
    }

    const titleJa = await translator.translate(item.title);
    if (titleJa) {
      item.titleJa = titleJa;
      done++;
      if (item.summary) {
        const summaryJa = await translator.translate(item.summary);
        if (summaryJa) item.summaryJa = summaryJa;
      }
    }
  }

  const used = Object.keys(translator.stats.byRoute)
    .map(function (k) { return `${k} ${translator.stats.byRoute[k]}回`; })
    .join(' / ') || 'なし';
  console.log(`   訳せた記事 ${done}件（利用: ${used}、失敗 ${translator.stats.failed}回）\n`);
  return done;
}

async function loadPrevious() {
  try {
    const txt = await readFile(OUT_PATH, 'utf-8');
    const json = JSON.parse(txt);
    return Array.isArray(json.items) ? json.items : [];
  } catch {
    return [];
  }
}

async function main() {
  const config = JSON.parse(await readFile(FEEDS_PATH, 'utf-8'));
  const sources = (config.sources || []).filter(
    (s) => s.enabled !== false && s.id && s.url && isSafeHttpUrl(s.url)
  );

  console.log(`▶ ${sources.length} 件のフィードを取得します…\n`);

  const tasks = sources.map((source) => async () => {
    const started = Date.now();
    try {
      const xml = await fetchFeed(source.url);
      const parsed = parseFeed(xml).slice(0, MAX_ITEMS_PER_FEED);

      const items = [];
      for (const raw of parsed) {
        const item = normalizeItem(raw, source);
        if (!item) continue;
        if (!shouldAccept(item, source.filter)) continue;
        items.push(item);
      }

      const ms = Date.now() - started;
      console.log(
        `  ✅ ${source.name.padEnd(24)} 記事${String(parsed.length).padStart(3)}件 → 採用${String(items.length).padStart(3)}件 (${ms}ms)`
      );
      return { source, items, ok: true, error: null, fetched: parsed.length };
    } catch (err) {
      console.log(`  ❌ ${source.name.padEnd(24)} ${err.message}`);
      return { source, items: [], ok: false, error: err.message, fetched: 0 };
    }
  });

  const results = await runWithLimit(tasks, CONCURRENCY);

  // --- 既存データとマージ（フィードから消えた記事も一定期間は残す） ---
  const previous = await loadPrevious();
  const byId = new Map();
  for (const item of previous) {
    if (item && item.id && isSafeHttpUrl(item.url)) byId.set(item.id, item);
  }

  let added = 0;
  for (const r of results) {
    for (const item of r.items) {
      if (!byId.has(item.id)) added++;
      byId.set(item.id, { ...byId.get(item.id), ...item });
    }
  }

  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const fresh = [...byId.values()].filter((it) => {
    const t = it.published ? Date.parse(it.published) : Date.now();
    return Number.isNaN(t) || t >= cutoff;
  });

  // --- 同じ記事の重複を除く（Googleニュース経由より直リンクを優先） ---
  const seen = new Map();
  for (const it of fresh) {
    const key = titleKey(it.title);
    if (!key) continue;
    const prev = seen.get(key);
    if (!prev) {
      seen.set(key, { ...it, coverage: Math.max(1, Number(it.coverage) || 1) });
      continue;
    }
    // 同じ話題を報じた媒体の数を数える（注目度スコアで使う）
    const coverage = Math.max(prev.coverage + 1, Number(it.coverage) || 1);
    const better =
      (prev.via ? 0 : 2) + (prev.summary ? 1 : 0) <
      (it.via ? 0 : 2) + (it.summary ? 1 : 0);
    if (better) seen.set(key, { ...it, coverage });
    else prev.coverage = coverage;
  }

  const items = [...seen.values()]
    .sort((a, b) => {
      const ta = a.published ? Date.parse(a.published) : 0;
      const tb = b.published ? Date.parse(b.published) : 0;
      return tb - ta;
    })
    .slice(0, MAX_TOTAL_ITEMS);

  // --- 英語の記事を日本語にする（訳し済みのものは再翻訳しない） ---
  const translated = await translateItems(items);

  // --- 注目度スコアと「注目ランキング」を作る ---
  const now = Date.now();
  for (const item of items) item.score = scoreItem(item, now);

  const rankCutoff = now - RANKING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const candidates = items
    .filter((it) => {
      const t = it.published ? Date.parse(it.published) : NaN;
      return !Number.isNaN(t) && t >= rankCutoff;
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Date.parse(b.published) - Date.parse(a.published);
    });

  // 同じ話題で枠を埋めない。1話題につき1件だけ載せる。
  const ranked = [];
  const chosen = [];
  for (const it of candidates) {
    if (ranked.length >= RANKING_SIZE) break;
    const headline = it.titleJa || it.title;
    const sig = { grams: bigrams(headline), tokens: alnumTokens(headline) };
    if (chosen.some((prev) => isSameTopic(prev, sig))) continue;
    ranked.push(it);
    chosen.push(sig);
  }

  console.log('🏆 注目ランキング');
  ranked.forEach((it, i) => {
    console.log(
      `   ${i + 1}位 [${String(it.score).padStart(3)}点 / ${it.coverage}媒体] ` +
      `${(it.titleJa || it.title).slice(0, 52)}`
    );
  });
  console.log('');

  const payload = {
    generatedAt: new Date().toISOString(),
    count: items.length,
    newCount: added,
    translatedCount: translated,
    ranking: ranked.map((it) => it.id),
    sources: results.map((r) => ({
      id: r.source.id,
      name: r.source.name,
      category: r.source.category,
      ok: r.ok,
      fetched: r.fetched,
      matched: r.items.length,
      error: r.error,
    })),
    xLinks: Array.isArray(config.x_links)
      ? config.x_links.filter((l) => l && l.name && isSafeHttpUrl(l.url))
      : [],
    items,
  };

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');

  const okCount = results.filter((r) => r.ok).length;
  console.log(
    `\n📄 public/content/news.json を書き出しました` +
    `\n   フィード成功 ${okCount}/${results.length}` +
    `\n   記事 合計${items.length}件（うち今回の新着 ${added}件）\n`
  );
}

main().catch((err) => {
  console.error('\n収集中にエラーが発生しました:', err);
  process.exit(1);
});
