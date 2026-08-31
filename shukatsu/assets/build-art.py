#!/usr/bin/env python3
"""キャラクターシートから立ち絵を切り出し、index.html の ART に埋め込み直す。

  python3 assets/build-art.py            # 切り出し＋埋め込み
  python3 assets/build-art.py --crop     # 切り出しのみ

元絵を差し替えるときは character-sheet.webp を置きかえて、下の BOXES を測り直す。
"""
import base64, os, re, sys
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SHEET = os.path.join(HERE, "character-sheet.webp")
HTML = os.path.join(HERE, "..", "index.html")
MAGIC = (255, 0, 255)

# キャラクターシート（2000x1116）上の位置
R1, R2 = (66, 326), (346, 582)
COLS = {"c1": (1332, 1552), "c2": (1572, 1790), "c3": (1808, 1996)}
BOXES = [
    ("normal",   (COLS["c1"][0], R1[0], COLS["c1"][1], R1[1]), 280, None),
    ("think",    (COLS["c2"][0], R1[0], COLS["c2"][1], R1[1]), 280, None),
    ("surprise", (COLS["c3"][0], R1[0], COLS["c3"][1], R1[1]), 280, None),
    ("point",    (COLS["c1"][0], R2[0], COLS["c1"][1], R2[1]), 280, None),
    ("smile",    (COLS["c2"][0], R2[0], COLS["c2"][1], R2[1]), 280, None),
    ("wink",     (COLS["c3"][0], R2[0], COLS["c3"][1], R2[1]), 280, None),
    # 猫は右上に「Partner／シャム」の手書きが重なるので、その矩形を消す
    ("cat",      (266, 716, 422, 942), 210, [(366, 738, 422, 818)]),
    ("front",    (462, 88, 740, 714),  640, None),
]
NAMES = [b[0] for b in BOXES]


def trim(im, box, thr=18, pad=3):
    """紙の地色と違う画素の外接矩形まで詰める"""
    c = im.crop(box); px = c.load(); w, h = c.size
    corners = [px[1, 1], px[w - 2, 1], px[1, h - 2], px[w - 2, h - 2]]
    bg = tuple(sum(v[i] for v in corners) // 4 for i in range(3))
    minx, miny, maxx, maxy = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if abs(r - bg[0]) > thr or abs(g - bg[1]) > thr or abs(b - bg[2]) > thr:
                minx = min(minx, x); maxx = max(maxx, x)
                miny = min(miny, y); maxy = max(maxy, y)
    if maxx <= minx:
        return box
    return (box[0] + max(0, minx - pad), box[1] + max(0, miny - pad),
            box[0] + min(w, maxx + pad) + 1, box[1] + min(h, maxy + pad) + 1)


def cutout(crop, thresh=30):
    """外周から塗りつぶして、紙の地色を透明にする"""
    work = crop.copy(); w, h = work.size
    seeds = [(i, 0) for i in range(0, w, 4)] + [(i, h - 1) for i in range(0, w, 4)]
    seeds += [(0, j) for j in range(0, h, 4)] + [(w - 1, j) for j in range(0, h, 4)]
    for s in seeds:
        if work.getpixel(s) != MAGIC:
            ImageDraw.floodfill(work, s, MAGIC, thresh=thresh)
    px = work.load()
    a = Image.new("L", (w, h), 255); ap = a.load()
    for y in range(h):
        for x in range(w):
            if px[x, y] == MAGIC:
                ap[x, y] = 0
    return a


def crop_all():
    im = Image.open(SHEET).convert("RGB")
    for name, box, target_h, erase in BOXES:
        b = trim(im, box)
        crop = im.crop(b)
        a = cutout(crop)
        if erase:
            d = ImageDraw.Draw(a)
            for x0, y0, x1, y1 in erase:
                d.rectangle([x0 - b[0], y0 - b[1], x1 - b[0], y1 - b[1]], fill=0)
        a = a.filter(ImageFilter.GaussianBlur(0.5))
        out = crop.convert("RGBA"); out.putalpha(a)
        out = out.crop(out.getbbox() or (0, 0, out.width, out.height))
        s = target_h / out.height
        out = out.resize((max(1, round(out.width * s)), target_h), Image.LANCZOS)
        p = os.path.join(HERE, "akari-%s.webp" % name)
        out.save(p, "WEBP", quality=84, method=6, exact=True)
        print("%-9s %s %5.1fKB" % (name, out.size, os.path.getsize(p) / 1024))


def embed():
    art = {}
    for n in NAMES:
        with open(os.path.join(HERE, "akari-%s.webp" % n), "rb") as f:
            art[n] = "data:image/webp;base64," + base64.b64encode(f.read()).decode()
    block = "var ART = {\n" + ",\n".join('  %s: "%s"' % (k, art[k]) for k in NAMES) + "\n};\n"
    with open(HTML, encoding="utf-8") as f:
        html = f.read()
    new, n = re.subn(r"var ART = \{.*?\n\};\n", block, html, count=1, flags=re.S)
    if not n:
        sys.exit("index.html に ART ブロックが見つかりません")
    with open(HTML, "w", encoding="utf-8") as f:
        f.write(new)
    print("埋め込み完了: %.0fKB" % (os.path.getsize(HTML) / 1024))


if __name__ == "__main__":
    crop_all()
    if "--crop" not in sys.argv:
        embed()
