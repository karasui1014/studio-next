/**
 * 英語の見出し・要約を日本語にする処理。
 *
 * APIキーの登録が要らない2つの経路を用意し、順に試します。
 *   1. MyMemory（公式API・無料枠あり・1回500文字まで）
 *   2. Google翻訳の非公式エンドポイント（速いが非公式なので予告なく止まる可能性あり）
 *
 * どちらも失敗したら翻訳をあきらめて原文のままにします（表示は止めません）。
 *
 * 環境変数 MYMEMORY_EMAIL を設定すると MyMemory の1日あたり上限が
 * 5,000語 → 50,000語 に増えます（GitHubのSecretsに入れる想定。任意）。
 */

const TIMEOUT_MS = 12000;
const MAX_CHARS = 480; // MyMemory の上限は500文字
const USER_AGENT = 'AIMusicNewsBot/1.0 (personal feed reader)';

/** 日本語の文字が含まれているか（翻訳が成立したかの簡易チェック） */
function hasJapanese(text) {
  return /[぀-ヿ㐀-鿿]/.test(String(text || ''));
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ---- 経路1: MyMemory ----------------------------------------------------

async function viaMyMemory(text, email) {
  let url =
    'https://api.mymemory.translated.net/get?langpair=en|ja&q=' +
    encodeURIComponent(text);
  if (email) url += '&de=' + encodeURIComponent(email);

  const json = await fetchJson(url);
  const status = Number(json.responseStatus);
  if (status !== 200) {
    throw new Error(String(json.responseDetails || `status ${status}`));
  }

  const out = String(json.responseData?.translatedText || '');
  // 上限超過などの警告が本文として返ってくることがある
  if (/MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID/i.test(out)) {
    throw new Error(out.slice(0, 80));
  }
  if (!hasJapanese(out)) throw new Error('日本語が返ってこなかった');
  return out;
}

// ---- 経路2: Google翻訳（非公式） ----------------------------------------

async function viaGoogle(text) {
  const url =
    'https://translate.googleapis.com/translate_a/single' +
    '?client=gtx&sl=en&tl=ja&dt=t&q=' +
    encodeURIComponent(text);

  const json = await fetchJson(url);
  if (!Array.isArray(json) || !Array.isArray(json[0])) {
    throw new Error('想定外の応答');
  }
  const out = json[0]
    .map(function (chunk) { return Array.isArray(chunk) ? chunk[0] : ''; })
    .join('');
  if (!hasJapanese(out)) throw new Error('日本語が返ってこなかった');
  return out;
}

// ---- まとめ役 -----------------------------------------------------------

/**
 * 翻訳する人。経路の生死を覚えていて、死んだ経路は以降スキップします。
 */
export function createTranslator(options) {
  var opts = options || {};
  var email = opts.email || null;
  var delayMs = opts.delayMs != null ? opts.delayMs : 350;

  var routes = [
    { name: 'MyMemory', fn: function (t) { return viaMyMemory(t, email); }, alive: true },
    { name: 'Google', fn: viaGoogle, alive: true },
  ];

  var stats = { ok: 0, failed: 0, byRoute: {} };
  var lastCall = 0;

  async function pace() {
    var wait = delayMs - (Date.now() - lastCall);
    if (wait > 0) await new Promise(function (r) { setTimeout(r, wait); });
    lastCall = Date.now();
  }

  async function translate(text) {
    var src = String(text || '').trim();
    if (!src) return null;
    if (hasJapanese(src)) return null; // すでに日本語なら何もしない

    var target = src.length > MAX_CHARS ? src.slice(0, MAX_CHARS) : src;

    for (var i = 0; i < routes.length; i++) {
      var route = routes[i];
      if (!route.alive) continue;
      try {
        await pace();
        var out = await route.fn(target);
        stats.ok++;
        stats.byRoute[route.name] = (stats.byRoute[route.name] || 0) + 1;
        return out;
      } catch (err) {
        // 上限超過・遮断とみられる場合はこの経路を今回は使わない
        if (/429|LIMIT|QUOTA|403|blocked/i.test(err.message)) {
          route.alive = false;
          console.log(`     （${route.name} は今回打ち止め: ${err.message.slice(0, 60)}）`);
        }
      }
    }

    stats.failed++;
    return null;
  }

  return {
    translate: translate,
    stats: stats,
    anyAlive: function () {
      return routes.some(function (r) { return r.alive; });
    },
  };
}
