#!/usr/bin/env python3
"""shukatsu/index.html から、人ごとの公開版を作る。

  python3 shukatsu/build-standalone.py                    # people.json の通りに作る
  python3 shukatsu/build-standalone.py otto=太郎 tsuma=花子  # 名前を指定して作り直す
  python3 shukatsu/build-standalone.py --list             # いま誰のぶんがあるか見る

出力:
  public/shukatsu/index.html        … 一覧（誰のノートを開くか選ぶページ）
  public/shukatsu/<id>/index.html   … その人のノート

なぜ人ごとに分けるか
--------------------
localStorage は origin（ドメイン）単位で共有される。パスが違っても同じ
場所を読み書きするので、ページを分けただけでは二人の記入が混ざる。
そこでビルド時に `var NOTE = {}` を差し替え、保存キーに id を混ぜている
（endingnote.v1.otto / endingnote.v1.tsuma）。

公開版は window.claude が無い環境で動くため localOnly モードになり、
書いた内容はその端末の localStorage にだけ残る。誰かの記入内容が
公開されることはない。このリポジトリは Public なので、記入済みの
内容は絶対にコミットしないこと。
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(HERE, "index.html")
CONF = os.path.join(HERE, "people.json")
OUTDIR = os.path.join(ROOT, "public", "shukatsu")
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,31}$")

def esc(t):
    return (str(t).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def head(title, depth, manifest=None):
    """depth … 一覧からの階層。アイコンへの相対パスに使う。"""
    up = "../" * depth
    return (
        "<!doctype html>\n<html lang=\"ja\">\n<head>\n"
        "<meta charset=\"utf-8\">\n"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
        "<meta name=\"robots\" content=\"noindex, nofollow\">\n"
        "<meta name=\"theme-color\" content=\"#2E5F63\">\n"
        "<title>" + esc(title) + "</title>\n"
        "<link rel=\"icon\" sizes=\"32x32\" href=\"" + up + "icons/icon-32.png\">\n"
        "<link rel=\"icon\" sizes=\"48x48\" href=\"" + up + "icons/icon-48.png\">\n"
        "<link rel=\"apple-touch-icon\" href=\"" + up + "icons/apple-touch-icon.png\">\n"
        "<meta name=\"apple-mobile-web-app-title\" content=\"" + esc(title) + "\">\n"
        "<meta name=\"apple-mobile-web-app-capable\" content=\"yes\">\n"
        + ("<link rel=\"manifest\" href=\"" + manifest + "\">\n" if manifest else "")
        + "</head>\n<body>\n"
    )


def manifest_json(name, short, start, depth):
    """ホーム画面に追加したとき、その人のノートが開くようにする。"""
    up = "../" * depth
    return json.dumps({
        "name": name, "short_name": short, "start_url": start,
        "display": "standalone", "orientation": "portrait",
        "background_color": "#F5F1E8", "theme_color": "#2E5F63",
        "icons": [
            {"src": up + "icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": up + "icons/icon-512.png", "sizes": "512x512", "type": "image/png"},
            {"src": up + "icons/icon-maskable.png", "sizes": "512x512",
             "type": "image/png", "purpose": "maskable"}
        ]
    }, ensure_ascii=False, indent=2)


def load_people(args):
    """引数があればそれを採用し、people.json に書き戻す。無ければ設定を読む。"""
    if args:
        people = []
        for a in args:
            pid, _, name = a.partition("=")
            pid = pid.strip()
            name = (name or pid).strip()
            if not ID_RE.match(pid):
                sys.exit("id は半角英小文字・数字・ハイフンで（32文字まで）: %r" % pid)
            people.append({"id": pid, "name": name})
        conf = {}
        if os.path.exists(CONF):
            with open(CONF, encoding="utf-8") as f:
                conf = json.load(f)
        conf["people"] = people
        with open(CONF, "w", encoding="utf-8") as f:
            json.dump(conf, f, ensure_ascii=False, indent=2)
            f.write("\n")
        return people

    if not os.path.exists(CONF):
        sys.exit("people.json が無い。名前を引数で渡すか、設定を作る。")
    with open(CONF, encoding="utf-8") as f:
        people = json.load(f).get("people", [])
    seen = set()
    for p in people:
        if not ID_RE.match(p.get("id", "")):
            sys.exit("people.json の id が不正: %r" % p.get("id"))
        if p["id"] in seen:
            sys.exit("id が重複している: %s" % p["id"])
        seen.add(p["id"])
    if not people:
        sys.exit("people.json に誰も書かれていない。")
    return people


def build_note(body, person):
    """その人ぶんのノートを組み立てる。NOTE を差し替えて保存先を分ける。"""
    note = json.dumps({"id": person["id"], "name": person["name"]}, ensure_ascii=False)
    out, n = re.subn(r"var NOTE = \{\};", "var NOTE = " + note + ";", body, count=1)
    if not n:
        sys.exit("index.html に `var NOTE = {};` が見つからない。生成を中止した。")
    title = "%s の引き継ぎ書" % person["name"]
    return head(title, 1, manifest="./app.webmanifest") + out + "\n</body>\n</html>\n"


def build_index(people):
    cards = "\n".join(
        '  <a class="card" href="./{id}/" data-id="{id}"><span class="nm">{name}</span>'
        '<span class="go">ひらく →</span></a>'.format(id=esc(p["id"]), name=esc(p["name"]))
        for p in people
    )
    return head("夫婦引き継ぎ書", 0, manifest="./app.webmanifest") + """<style>
:root{--paper:#F5F1E8;--surface:#FFFDF7;--line:#E2D9C7;--ink:#3E4540;--ink2:#6E6C5E;
  --ink3:#9C947F;--accent:#4C888C;--tan:#D9B98C;
  --sans:'Zen Kaku Gothic New','Hiragino Sans','Noto Sans JP',system-ui,sans-serif;
  --serif:'Shippori Mincho','Hiragino Mincho ProN','Yu Mincho',serif;
  --mono:'IBM Plex Mono',ui-monospace,Menlo,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --paper:#1A1D1B;--surface:#232724;--line:#363B37;--ink:#EDE7DA;--ink2:#B5AF9F;
  --ink3:#8B8677;--accent:#7FC4C6;--tan:#C9A97C}}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);
  font-size:16px;line-height:1.8;-webkit-font-smoothing:antialiased}
.wrap{max-width:520px;margin:0 auto;padding:48px 20px 60px}
.eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.2em;color:var(--tan);margin:0 0 10px}
h1{font-family:var(--serif);font-size:clamp(26px,7vw,34px);font-weight:700;margin:0 0 12px;line-height:1.35}
.lead{margin:0 0 30px;color:var(--ink2);font-size:14.5px}
.card{display:flex;align-items:center;gap:14px;padding:20px 22px;margin-bottom:11px;
  background:var(--surface);border:1px solid var(--line);border-radius:14px;
  text-decoration:none;color:inherit;transition:border-color .15s,transform .12s}
.card:hover{border-color:var(--accent);transform:translateY(-1px)}
.nm{flex:1;font-family:var(--serif);font-weight:700;font-size:19px}
.go{font-family:var(--mono);font-size:12px;color:var(--accent)}
.note{margin-top:28px;padding:14px 16px;background:var(--surface);border:1px solid var(--line);
  border-radius:12px;font-size:13px;color:var(--ink2);line-height:1.75}
</style>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400&family=Shippori+Mincho:wght@700&family=Zen+Kaku+Gothic+New:wght@400;500&display=swap">
<main class="wrap">
  <p class="eyebrow">HANDOVER NOTE</p>
  <h1>夫婦引き継ぎ書</h1>
  <p class="lead">どちらのノートを開きますか。ひとりずつ別々に保存されます。</p>
""" + cards + """
  <p class="note">中身は暗証番号で暗号化して、開いた端末のブラウザにだけ残ります。
  相手の端末には送られず、インターネットにも公開されません。1時間さわらないと自動で鍵がかかります。
  二人で同じ内容を見たいときは、Claude の共有リンクの方を使ってください。</p>
</main>
<script>
/* ノート側で名前を変えたら、この一覧にも反映する。
   名前だけは暗号化せずに置いてある（一覧が読むため）。本文は読めない。 */
(function(){
  try {
    document.querySelectorAll(".card[data-id]").forEach(function(a){
      var label = localStorage.getItem("endingnote.v1." + a.dataset.id + ".label");
      if(label) a.querySelector(".nm").textContent = label;
    });
  } catch(e){}
})();
</script>
</body>
</html>
"""


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--list" in sys.argv:
        for p in load_people([]):
            print("%-12s %s   → /shukatsu/%s/" % (p["id"], p["name"], p["id"]))
        return

    people = load_people(args)
    with open(SRC, encoding="utf-8") as f:
        body = f.read()
    if '<script id="app-js">' not in body:
        sys.exit("index.html の形が変わっている。生成を中止した。")

    os.makedirs(OUTDIR, exist_ok=True)
    for p in people:
        d = os.path.join(OUTDIR, p["id"])
        os.makedirs(d, exist_ok=True)
        dest = os.path.join(d, "index.html")
        with open(dest, "w", encoding="utf-8") as f:
            f.write(build_note(body, p))
        with open(os.path.join(d, "app.webmanifest"), "w", encoding="utf-8") as f:
            f.write(manifest_json("%s の引き継ぎ書" % p["name"], p["name"], "./", 1))
        print("%-12s %-8s %5.0f KB  → /shukatsu/%s/"
              % (p["id"], p["name"], os.path.getsize(dest) / 1024, p["id"]))

    idx = os.path.join(OUTDIR, "index.html")
    with open(idx, "w", encoding="utf-8") as f:
        f.write(build_index(people))
    with open(os.path.join(OUTDIR, "app.webmanifest"), "w", encoding="utf-8") as f:
        f.write(manifest_json("夫婦引き継ぎ書", "引き継ぎ書", "./", 0))
    print("一覧 %.0f KB  → /shukatsu/" % (os.path.getsize(idx) / 1024))


if __name__ == "__main__":
    main()
