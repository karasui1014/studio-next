#!/usr/bin/env python3
"""shukatsu/index.html から、単体で開ける完全なHTMLを作る。

  python3 shukatsu/build-standalone.py

出力先は2つ:
  public/shukatsu/index.html  … GitHub Pages で配信される公開版
  dist/shukatsu/index.html    … vite build が public/ をそのままコピーする

index.html は Artifact 用にヘッダを持たない断片なので、ここで doctype と
<head> を付けて完全な文書にする。Artifact 側の publish には影響しない。

公開版は window.claude が無い環境で動くため、書いた内容はその端末の
localStorage にだけ残る。誰かの記入内容が公開されることはない。
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(HERE, "index.html")
DEST = os.path.join(ROOT, "public", "shukatsu", "index.html")

HEAD = """<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="description" content="夫婦のための引き継ぎ書。死後の手続きと、申請しないと出ないお金の一覧つき。">
<title>夫婦引き継ぎ書</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ctext y='26' font-size='26'%3E%F0%9F%95%8A%3C/text%3E%3C/svg%3E">
</head>
<body>
"""
FOOT = "\n</body>\n</html>\n"


def main():
    with open(SRC, encoding="utf-8") as f:
        body = f.read()
    if "<script id=\"app-js\">" not in body:
        sys.exit("index.html の形が変わっている。生成を中止した。")
    os.makedirs(os.path.dirname(DEST), exist_ok=True)
    with open(DEST, "w", encoding="utf-8") as f:
        f.write(HEAD + body + FOOT)
    print("生成: %s  (%.0f KB)" % (DEST, os.path.getsize(DEST) / 1024))


if __name__ == "__main__":
    main()
