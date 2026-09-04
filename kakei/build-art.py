#!/usr/bin/env python3
"""案内役の絵とファビコンを引き継ぎ書から取り込んで index.html に埋め込む。

絵の元は shukatsu/assets/character-sheet.webp（同じ探偵）。
切り出しは shukatsu/assets/build-art.py が済ませてあるので、
ここでは shukatsu/index.html に埋まっている ART と FAVICON を
そのまま持ってくるだけにしている。切り出し位置を変えたいときは
shukatsu 側で作り直してから、これを実行する。
"""
import pathlib, re, sys

here = pathlib.Path(__file__).resolve().parent
src = here.parent / "shukatsu" / "index.html"
dst = here / "index.html"

s = src.read_text(encoding="utf-8")
d = dst.read_text(encoding="utf-8")

art = re.search(r"^var ART = \{.*?^\};$", s, re.S | re.M)
fav = re.search(r'^var FAVICON = "[^"]*";', s, re.M)
if not art or not fav:
    sys.exit("shukatsu/index.html から ART / FAVICON を見つけられなかった")

art_txt = art.group(0).rstrip(";") + "; /*ART*/"
fav_txt = fav.group(0) + " /*FAVICON*/"

d, n1 = re.subn(r'^var FAVICON = "[^"]*"; /\*FAVICON\*/$', lambda m: fav_txt, d, flags=re.M)
d, n2 = re.subn(r"^var ART = \{.*?\}; /\*ART\*/$", lambda m: art_txt, d, flags=re.S | re.M)
if not n1 or not n2:
    sys.exit("index.html の差し込み先が見つからなかった（/*ART*/ と /*FAVICON*/ の目印）")

dst.write_text(d, encoding="utf-8")
print("入れた: 絵 %d点" % len(re.findall(r'^\s+\w+: "data:', art.group(0), re.M)))
