#!/usr/bin/env python3
"""ふたりの家計のアイコンとファビコンを作る。

  python3 kakei/assets/build-icons.py

出力:
  public/kakei/icons/icon-32.png          ファビコン
  public/kakei/icons/icon-48.png          ファビコン（高解像度のタブ）
  public/kakei/icons/apple-touch-icon.png iOSのホーム画面（180・角丸なし）
  public/kakei/icons/icon-192.png         Androidのホーム画面
  public/kakei/icons/icon-512.png         スプラッシュ・ストア表示
  public/kakei/icons/icon-maskable.png    Androidのアダプティブ用（余白多め）

あわせて kakei/index.html の FAVICON（data URI）を差し替える。

引き継ぎ書のアイコンは深い浅葱の地だが、こちらは**白系**にしている。
ただし真っ白だと、白いタブやホーム画面に置いたとき輪郭が消える。
そこで生成りの地に、タン色の細い縁を1本入れて形が残るようにした。
縁の太さは辺の2.5%。16pxでも1px弱残る。

元絵は ../../shukatsu/assets/akari-normal.webp（同じ探偵）。
差し替えるときは shukatsu 側で build-art.py を動かしてから、これを実行する。
"""
import base64, io, os, re, sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
KAKEI = os.path.dirname(HERE)
ROOT = os.path.dirname(KAKEI)
SRC = os.path.join(ROOT, "shukatsu", "assets", "akari-normal.webp")
OUT = os.path.join(ROOT, "public", "kakei", "icons")
HTML = os.path.join(KAKEI, "index.html")

BG = (247, 244, 236, 255)       # 生成り（--paper より少し明るい）
EDGE = (217, 185, 140, 255)     # タン。白地でも輪郭が残るように
EDGE_W = 0.025                  # 縁の太さ（辺に対する比）
BOX = (0.02, 0.00, 0.98, 0.88)  # 元絵のどこを使うか（肩を落とす）
ROUND = 0.22                    # 角丸の半径（辺に対する比）


def head():
    im = Image.open(SRC).convert("RGBA")
    w, h = im.size
    return im.crop((int(w * BOX[0]), int(h * BOX[1]), int(w * BOX[2]), int(h * BOX[3])))


def icon(size, pad=0.06, rounded=True, edge=True):
    """pad を大きくすると顔が小さくなる。Android のマスク用は削られる前提で小さく置く。"""
    hd = head()
    r = int(size * ROUND) if rounded else 0
    w = max(1, round(size * EDGE_W))
    c = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(c)
    box = [0, 0, size - 1, size - 1]
    if rounded:
        d.rounded_rectangle(box, radius=r, fill=BG, outline=EDGE if edge else None, width=w)
    else:
        d.rectangle(box, fill=BG, outline=EDGE if edge else None, width=w)

    inner = int(size * (1 - pad * 2))
    s = min(inner / hd.width, inner / hd.height)
    hh = hd.resize((max(1, round(hd.width * s)), max(1, round(hd.height * s))), Image.LANCZOS)
    c.alpha_composite(hh, ((size - hh.width) // 2, int((size - hh.height) * 0.5)))

    if rounded:
        m = Image.new("L", (size, size), 0)
        ImageDraw.Draw(m).rounded_rectangle(box, radius=r, fill=255)
        o = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        o.paste(c, (0, 0), m)
        return o
    return c


def main():
    if not os.path.exists(SRC):
        sys.exit("元絵が無い: %s（先に shukatsu/assets/build-art.py を動かす）" % SRC)
    os.makedirs(OUT, exist_ok=True)
    plan = [
        # タブの中は小さい。ここだけ余白を詰めて、顔を大きく見せる
        ("icon-32.png",          icon(32, pad=0.035)),
        ("icon-48.png",          icon(48, pad=0.035)),
        ("icon-192.png",         icon(192)),
        ("icon-512.png",         icon(512)),
        # iOS は自分で角を丸めるので、こちらは四角のまま渡す
        ("apple-touch-icon.png", icon(180, pad=0.08, rounded=False)),
        # Android のマスクは最大で外側20%が削られる。縁は削られるので描かない
        ("icon-maskable.png",    icon(512, pad=0.20, rounded=False, edge=False)),
    ]
    for name, im in plan:
        p = os.path.join(OUT, name)
        im.save(p, "PNG", optimize=True)
        print("%-22s %4dpx %6.1f KB" % (name, im.width, os.path.getsize(p) / 1024))

    buf = io.BytesIO()
    icon(48, pad=0.035).save(buf, "PNG", optimize=True)
    uri = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    with open(HTML, encoding="utf-8") as f:
        html = f.read()
    new, n = re.subn(r'var FAVICON = "[^"]*";', 'var FAVICON = "%s";' % uri, html, count=1)
    if not n:
        sys.exit("index.html に FAVICON の行が見つからない。生成を中止した。")
    with open(HTML, "w", encoding="utf-8") as f:
        f.write(new)
    print("index.html の FAVICON を差し替え（%.1f KB）" % (len(uri) / 1024))


if __name__ == "__main__":
    main()
