#!/usr/bin/env python3
"""shukatsu/index.html から、人ごとの公開版を作る。

  python3 shukatsu/build-standalone.py                    # people.json の通りに作る
  python3 shukatsu/build-standalone.py otto=太郎 tsuma=花子  # 名前を指定して作り直す
  python3 shukatsu/build-standalone.py --list             # いま誰のぶんがあるか見る

出力:
  public/shukatsu/index.html        … 入口（鍵の画面で誰のぶんを開くか選ぶ）
  public/shukatsu/<id>/index.html   … その人から始まる同じアプリ（ホーム画面用）

どのページも中身は同じで、`var PEOPLE` に全員が入る。鍵の画面で
どちらのぶんを開くか選び、その人の暗証番号で解錠する。人ごとのURLは
「最初に選ばれている人」が違うだけで、開いたあとに選びなおせる。

なぜ人ごとに保存先を分けるか
----------------------------
localStorage は origin（ドメイン）単位で共有される。パスが違っても同じ
場所を読み書きするので、ページを分けただけでは二人の記入が混ざる。
そこで保存キーに id を混ぜている（endingnote.v1.otto / endingnote.v1.tsuma）。

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

def jsval(obj):
    """JS のソースへ埋める値。名前に `</script>` が入っても抜け出せないようにする。"""
    return (json.dumps(obj, ensure_ascii=False)
            .replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026"))


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


def inject(body, people, person):
    """PEOPLE に全員を、NOTE に最初に選ばれている人を入れる。"""
    roster = jsval([{"id": p["id"], "name": p["name"]} for p in people])
    out, n = re.subn(r"var PEOPLE = \[.*?\n\];",
                     lambda m: "var PEOPLE = " + roster + ";", body, count=1, flags=re.S)
    if not n:
        sys.exit("index.html に `var PEOPLE = [...]` が見つからない。生成を中止した。")
    note = jsval({"id": person["id"], "name": person["name"]}) if person else "{}"
    out, n = re.subn(r"var NOTE = \{\};", lambda m: "var NOTE = " + note + ";", out, count=1)
    if not n:
        sys.exit("index.html に `var NOTE = {};` が見つからない。生成を中止した。")
    return out


def build_note(body, people, person):
    """その人から始まるページ。ホーム画面に追加したときの入口になる。"""
    title = "%s の引き継ぎ書" % person["name"]
    return (head(title, 1, manifest="./app.webmanifest")
            + inject(body, people, person) + "\n</body>\n</html>\n")


def build_index(body, people):
    """入口。誰も選ばずに開く（前に開いた人か、いちばん上の人から始まる）。"""
    return (head("夫婦引き継ぎ書", 0, manifest="./app.webmanifest")
            + inject(body, people, None) + "\n</body>\n</html>\n")


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
            f.write(build_note(body, people, p))
        with open(os.path.join(d, "app.webmanifest"), "w", encoding="utf-8") as f:
            f.write(manifest_json("%s の引き継ぎ書" % p["name"], p["name"], "./", 1))
        print("%-12s %-8s %5.0f KB  → /shukatsu/%s/"
              % (p["id"], p["name"], os.path.getsize(dest) / 1024, p["id"]))

    idx = os.path.join(OUTDIR, "index.html")
    with open(idx, "w", encoding="utf-8") as f:
        f.write(build_index(body, people))
    with open(os.path.join(OUTDIR, "app.webmanifest"), "w", encoding="utf-8") as f:
        f.write(manifest_json("夫婦引き継ぎ書", "引き継ぎ書", "./", 0))
    print("入口 %.0f KB  → /shukatsu/" % (os.path.getsize(idx) / 1024))


if __name__ == "__main__":
    main()
