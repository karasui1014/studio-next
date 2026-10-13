#!/usr/bin/env node
/**
 * カラスイ Picks コレクター
 *
 * Substack の RSS を取得して public/content/picks.json を作ります。
 * これで「Substackに記事を書く → Studioのホームに自動で出る」が成立します。
 *
 * ■ 設計方針
 * Studio に全文は載せません。Studio は入口、本文は Substack で読んでもらいます。
 * そうしないと Substack の読者が育たず、3つの場所が一緒に育たないためです。
 * Premium の追加価値（制作メモ・関連プロンプト）は content/home.json の
 * pickNotes に手で書き、記事のURLで紐づけます。
 *
 * 使い方:  npm run picks
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(ROOT, '..', 'public', 'content', 'picks.json');

const FEED_URL = process.env.SUBSTACK_FEED || 'https://karasui.substack.com/feed';
/**
 * 回り道。Substack は GitHub Actions からの直接の取得を HTTP 403（Cloudflare の確認画面）で
 * 断ることがある（2026-08〜09、2026-09-09〜10-13 に発生）。
 * 直接取れなかったときだけ、feed2json（Toptal の無料サービス）に RSS を取ってきてもらい、
 * JSON Feed 形式で受け取る（2026-10-13 に Actions から取得できることを確認）。
 * SUBSTACK_FALLBACK=off で回り道を使わない。
 */
const FALLBACK_URL = process.env.SUBSTACK_FALLBACK_URL || `https://www.toptal.com/developers/feed2json/convert?url=${encodeURIComponent(FEED_URL)}`;
const USE_FALLBACK = process.env.SUBSTACK_FALLBACK !== 'off';
const MAX_ITEMS = 20;
const EXCERPT_MAX = 300;   // ホームで見せる冒頭の長さ
const TIMEOUT_MS = 15000;

// ---------- XMLの最小パーサー（collect-news.mjs と同じ考え方） ----------

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…' };

function decodeEntities(str) {
  return String(str || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m);
}

function safeChar(code) {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  try { return String.fromCodePoint(code); } catch { return ''; }
}

function stripHtml(str) {
  return decodeEntities(
    String(str || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]*>/g, ' '),
  ).replace(/\s+/g, ' ').trim();
}

function unwrapCdata(str) {
  const m = String(str || '').match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return m ? m[1] : str;
}

function tagContent(xml, name) {
  const re = new RegExp(
    `<(?:[a-z0-9_-]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[a-z0-9_-]+:)?${name}\\s*>`,
    'i',
  );
  const m = xml.match(re);
  return m ? unwrapCdata(m[1]) : '';
}

function isSafeUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Substack が本文に差し込む購読の案内を取り除く。
 * これが残ると、記事の冒頭のはずが「購読してください」で埋まってしまう。
 */
function removeSubscribeCta(text) {
  return String(text || '')
    .replace(/読んでくださり(?:あ|有)りがとうございます[^。]{0,120}?購読してください[。！!]?/g, ' ')
    .replace(/[^。]{0,40}?(?:無料で)?購読(?:して|し)ください[。！!]?/g, ' ')
    .replace(/Thanks for reading[\s\S]{0,140}?support my work[.!]?/gi, ' ')
    .replace(/Subscribe (?:for free )?to receive[\s\S]{0,140}?[.!]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clamp(str, max) {
  const s = String(str || '').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** 記事URLの末尾（/p/xxxx）。手書きメモと紐づけるキーに使う */
function slugOf(url) {
  const m = String(url).match(/\/p\/([^/?#]+)/);
  return m ? m[1] : url;
}

// ---------- 取得 ----------

async function fetchFeed(url, accept = 'application/rss+xml, application/xml, text/xml, */*') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'AIMusicClubStudio/2.0 (personal reader)',
        Accept: accept,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/** Substack の RSS（XML）から記事を取り出す */
function itemsFromRss(xml) {
  const chunks = [...xml.matchAll(/<item\b[\s\S]*?<\/item\s*>/gi)]
    .map((m) => m[0])
    .slice(0, MAX_ITEMS);

  const items = [];
  for (const chunk of chunks) {
    const url = decodeEntities(tagContent(chunk, 'link')).trim();
    const title = stripHtml(tagContent(chunk, 'title'));
    if (!title || !isSafeUrl(url)) continue;

    // 冒頭は本文の書き出しから取る（description はメタ用で短すぎることがある）。
    // 全文は載せない。あくまで「続きを読みたくなる」ところまで。
    const body = removeSubscribeCta(stripHtml(tagContent(chunk, 'encoded')));
    const meta = removeSubscribeCta(stripHtml(tagContent(chunk, 'description')));
    const summary = body.length > meta.length ? body : meta;
    // enclosure は画像とは限らない（ポッドキャスト回は音声が入る）
    const enclosure = chunk.match(/<enclosure[^>]*url="([^"]+)"[^>]*(?:type="([^"]*)")?/i);
    const encUrl = enclosure?.[1] || '';
    const encType = enclosure?.[2] || '';
    const looksImage =
      /^image\//i.test(encType) ||
      (!encType && /substackcdn\.com\/image/i.test(encUrl));
    const image = looksImage ? encUrl : '';
    const dateRaw = tagContent(chunk, 'pubDate');
    const published = Number.isNaN(Date.parse(dateRaw)) ? null : new Date(dateRaw).toISOString();

    items.push({
      id: slugOf(url),
      title: clamp(title, 200),
      url,
      excerpt: clamp(summary, EXCERPT_MAX),
      image: isSafeUrl(image) ? image : '',
      published,
    });
  }
  return items;
}

/** feed2json が返す JSON Feed から記事を取り出す（RSS と同じ形にそろえる） */
function itemsFromJsonFeed(text) {
  const feed = JSON.parse(text);
  const items = [];
  for (const it of (Array.isArray(feed.items) ? feed.items : []).slice(0, MAX_ITEMS)) {
    const url = String(it.url || it.id || it.guid || '').trim();
    const title = stripHtml(it.title);
    if (!title || !isSafeUrl(url)) continue;

    const body = removeSubscribeCta(stripHtml(it.content_html || it.content_text));
    const meta = removeSubscribeCta(stripHtml(it.summary));
    const summary = body.length > meta.length ? body : meta;
    // JSON Feed には enclosure が無いので、本文の最初の Substack の画像を使う
    const imgMatch = String(it.image || it.content_html || '').match(/https:\/\/substackcdn\.com\/image\/[^"'\s)]+/i);
    const image = it.image || (imgMatch ? decodeEntities(imgMatch[0]) : '');
    const published = Number.isNaN(Date.parse(it.date_published)) ? null : new Date(it.date_published).toISOString();

    items.push({
      id: slugOf(url),
      title: clamp(title, 200),
      url,
      excerpt: clamp(summary, EXCERPT_MAX),
      image: isSafeUrl(image) ? image : '',
      published,
    });
  }
  return items;
}

/** まず Substack に直接取りに行き、だめなら回り道を使う */
async function collect() {
  try {
    const items = itemsFromRss(await fetchFeed(FEED_URL));
    if (items.length) return { items, source: FEED_URL };
    throw new Error('記事が0件でした（確認画面が返ってきた可能性）');
  } catch (err) {
    if (!USE_FALLBACK) throw err;
    console.log(`⚠️ Substack から直接取得できませんでした（${err.message}）。回り道（feed2json）を使います。`);
  }
  const items = itemsFromJsonFeed(await fetchFeed(FALLBACK_URL, 'application/json'));
  if (!items.length) throw new Error('回り道（feed2json）からも記事を取得できませんでした');
  return { items, source: FALLBACK_URL };
}

async function main() {
  if (!isSafeUrl(FEED_URL)) throw new Error('取得先のURLが不正です');

  console.log(`▶ Substackから記事を取得します\n   ${FEED_URL}\n`);
  const { items, source } = await collect();
  items.forEach((i) => console.log(`  ✅ ${clamp(i.title, 46)}`));

  items.sort((a, b) => Date.parse(b.published || 0) - Date.parse(a.published || 0));

  const payload = {
    generatedAt: new Date().toISOString(),
    source,
    count: items.length,
    items,
  };

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  console.log(`\n📄 public/content/picks.json を書き出しました（${items.length}件）\n`);

  // 手書きメモが無い記事を知らせる（Premiumの価値になる部分）
  try {
    const home = JSON.parse(await readFile(join(ROOT, '..', 'public', 'content', 'home.json'), 'utf-8'));
    const notes = home.pickNotes || {};
    const missing = items.filter((i) => !notes[i.id]).map((i) => i.id);
    if (missing.length) {
      console.log('💡 制作メモ（Premium向け）がまだ無い記事:');
      missing.forEach((id) => console.log(`   - ${id}`));
      console.log('   public/content/home.json の pickNotes に追記できます。\n');
    }
  } catch {
    /* home.json が読めなくても収集は成功とする */
  }
}

main().catch((err) => {
  console.error('\n取得中にエラーが発生しました:', err.message);
  process.exit(1);
});
