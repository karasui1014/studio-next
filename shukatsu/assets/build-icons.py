#!/usr/bin/env python3
"""キャラクターシートからアプリのアイコンとファビコンを作る。

  python3 shukatsu/assets/build-icons.py

出力:
  public/shukatsu/icons/icon-32.png          ファビコン
  public/shukatsu/icons/icon-48.png          ファビコン（高解像度のタブ）
  public/shukatsu/icons/apple-touch-icon.png iOSのホーム画面（180・角丸なし）
  public/shukatsu/icons/icon-192.png         Androidのホーム画面
  public/shukatsu/icons/icon-512.png         スプラッシュ・ストア表示
  public/shukatsu/icons/icon-maskable.png    Androidのアダプティブ用（余白多め）

あわせて shukatsu/index.html の FAVICON（data URI）を差し替える。
Artifact 版は外部ファイルを読めないので、そちらは埋め込みで持つ。

元絵は assets/akari-normal.webp（顔まわりに詰めた通常表情）。
肩を少し落として、瞳と同じ深い浅葱の角丸の上に置いている。
16pxでは細部は潰れるが、タン色の帽子と暗い髪のかたまりで見分けがつく。
"""
import base64, io, os, re, sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
SHUKATSU = os.path.dirname(HERE)
ROOT = os.path.dirname(SHUKATSU)
SRC = os.path.join(HERE, "akari-normal.webp")
OUT = os.path.join(ROOT, "public", "shukatsu", "icons")
HTML = os.path.join(SHUKATSU, "index.html")

BG = (46, 95, 99, 255)          # 深い浅葱（--eye と同系）
BOX = (0.02, 0.00, 0.98, 0.88)  # 元絵のどこを使うか（肩を落とす）
ROUND = 0.22                    # 角丸の半径（辺に対する比）


def head():
    im = Image.open(SRC).convert("RGBA")
    w, h = im.size
    return im.crop((int(w*BOX[0]), int(h*BOX[1]), int(w*BOX[2]), int(h*BOX[3])))


def icon(size, pad=0.06, rounded=True, bleed=False):
    """bleed=True は Android のマスク用。切り取られても顔が残るよう小さめに置く。"""
    hd = head()
    r = int(size * ROUND) if rounded else 0
    c = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(c)
    if rounded:
        d.rounded_rectangle([0, 0, size-1, size-1], radius=r, fill=BG)
    else:
        d.rectangle([0, 0, size-1, size-1], fill=BG)
    inner = int(size * (1 - pad*2))
    s = min(inner / hd.width, inner / hd.height)
    hh = hd.resize((max(1, round(hd.width*s)), max(1, round(hd.height*s))), Image.LANCZOS)
    c.alpha_composite(hh, ((size - hh.width)//2, int((size - hh.height) * 0.5)))
    if rounded:
        m = Image.new("L", (size, size), 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, size-1, size-1], radius=r, fill=255)
        o = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        o.paste(c, (0, 0), m)
        return o
    return c


def main():
    if not os.path.exists(SRC):
        sys.exit("元絵が無い: %s（先に build-art.py を動かす）" % SRC)
    os.makedirs(OUT, exist_ok=True)
    plan = [
        ("icon-32.png",          icon(32)),
        ("icon-48.png",          icon(48)),
        ("icon-192.png",         icon(192)),
        ("icon-512.png",         icon(512)),
        # iOS は自分で角を丸めるので、こちらは四角のまま渡す
        ("apple-touch-icon.png", icon(180, pad=0.08, rounded=False)),
        # Android のマスクは最大で外側20%が削られる。余白を多めに取る
        ("icon-maskable.png",    icon(512, pad=0.20, rounded=False)),
    ]
    for name, im in plan:
        p = os.path.join(OUT, name)
        im.save(p, "PNG", optimize=True)
        print("%-22s %4dpx %6.1f KB" % (name, im.width, os.path.getsize(p)/1024))

    # Artifact 版に埋め込む data URI（外部ファイルを読めないため）
    buf = io.BytesIO()
    icon(48).save(buf, "PNG", optimize=True)
    uri = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    with open(HTML, encoding="utf-8") as f:
        html = f.read()
    new, n = re.subn(r'var FAVICON = "[^"]*";', 'var FAVICON = "%s";' % uri, html, count=1)
    if not n:
        sys.exit("index.html に FAVICON の行が見つからない。生成を中止した。")
    with open(HTML, "w", encoding="utf-8") as f:
        f.write(new)
    print("index.html の FAVICON を差し替え（%.1f KB）" % (len(uri)/1024))


if __name__ == "__main__":
    main()
