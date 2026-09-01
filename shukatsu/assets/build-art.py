#!/usr/bin/env python3
"""キャラクターシートから絵を切り出し、index.html の ART に埋め込み直す。

  python3 assets/build-art.py            # 切り出し＋埋め込み
  python3 assets/build-art.py --crop     # 切り出しのみ

表情の 6 枚は「顔まわりだけ」に詰めて書き出す。アプリ内では 52〜74px と
小さく置くので、胸から上の全身を入れると顔が 20px ほどに潰れてしまうため。
元絵を差し替えるときは character-sheet.webp を置きかえて、下の BOXES を測り直す。
"""
import base64, os, re, sys
from collections import deque
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SHEET = os.path.join(HERE, "character-sheet.webp")
HTML = os.path.join(HERE, "..", "index.html")
MAGIC = (255, 0, 255)

# キャラクターシート（2000x1116）上の位置
R1, R2 = (66, 326), (346, 582)
COLS = {"c1": (1332, 1552), "c2": (1572, 1790), "c3": (1808, 1996)}
# 名前, 範囲, 書き出す高さ, 消す矩形, 顔だけに詰めるか
BOXES = [
    ("normal",   (COLS["c1"][0], R1[0], COLS["c1"][1], R1[1]), 260, None, True),
    ("think",    (COLS["c2"][0], R1[0], COLS["c2"][1], R1[1]), 260, None, True),
    ("surprise", (COLS["c3"][0], R1[0], COLS["c3"][1], R1[1]), 260, None, True),
    ("point",    (COLS["c1"][0], R2[0], COLS["c1"][1], R2[1]), 260, None, True),
    ("smile",    (COLS["c2"][0], R2[0], COLS["c2"][1], R2[1]), 260, None, True),
    ("wink",     (COLS["c3"][0], R2[0], COLS["c3"][1], R2[1]), 260, None, True),
    # 猫は右上に「Partner／シャム」の手書きが重なるので、その矩形を消す
    ("cat",      (266, 716, 422, 942), 210, [(366, 738, 422, 818)], False),
    ("front",    (462, 88, 740, 714),  640, None, False),
]
NAMES = [b[0] for b in BOXES]


def trim(im, box, thr=18, pad=3):
    """紙の地色と違う画素の外接矩形まで詰める"""
    c = im.crop(box); px = c.load(); w, h = c.size
    bg = paper_colour(c)
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


def paper_colour(crop):
    px = crop.load(); w, h = crop.size
    c = [px[1, 1], px[w - 2, 1], px[1, h - 2], px[w - 2, h - 2]]
    return tuple(sum(v[i] for v in c) // 4 for i in range(3))


def cutout(crop, thresh=8, tol=55, steps=4):
    """紙の地色を透明にする。

    ふつうに塗りつぶすと、帽子のつばの裏など「紙とほぼ同じ明るさで、外の
    余白と地続きになっている」ところへ塗りが流れこみ、帽子に穴があく。
    そこで二段構えにする。

      1. しきい値を 8 まで絞って外周から塗る（漏れないが、輪郭に白が残る）
      2. その縁から数ピクセルだけ、紙に近い色へ広げて白フチを消す

    2 は歩数を limit しているので、奥の淡い部分までは届かない。
    """
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
    debur(crop, a, tol, steps)
    return a


def debur(crop, alpha, tol, steps):
    """透明の縁から steps 歩だけ、紙に近い色を追加で透明にする（白フチ取り）"""
    w, h = crop.size
    px = crop.load(); ap = alpha.load()
    paper = paper_colour(crop)

    def near(x, y):
        p = px[x, y]
        return (abs(p[0] - paper[0]) + abs(p[1] - paper[1])
                + abs(p[2] - paper[2])) <= tol

    seen = bytearray(w * h)
    q = deque()
    for y in range(h):
        for x in range(w):
            if ap[x, y] == 0:
                seen[y * w + x] = 1; q.append((x, y, 0))
    while q:
        x, y, d = q.popleft()
        if d >= steps:
            continue
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h:
                j = ny * w + nx
                if not seen[j] and near(nx, ny):
                    seen[j] = 1; ap[nx, ny] = 0; q.append((nx, ny, d + 1))


def body_mask(rgba, thr=24):
    """いちばん大きい連結成分＝本体。？！♪ などの記号は離れているので落ちる。"""
    a = rgba.getchannel("A"); w, h = a.size
    ap = a.load()
    seen = bytearray(w * h)
    best, best_n = None, 0
    for sy in range(h):
        for sx in range(w):
            if seen[sy * w + sx] or ap[sx, sy] <= thr:
                continue
            mask = bytearray(w * h)
            q = deque([(sx, sy)]); seen[sy * w + sx] = 1; mask[sy * w + sx] = 1
            n = 0; x0, y0, x1, y1 = sx, sy, sx, sy
            while q:
                x, y = q.popleft(); n += 1
                if x < x0: x0 = x
                if x > x1: x1 = x
                if y < y0: y0 = y
                if y > y1: y1 = y
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h:
                        j = ny * w + nx
                        if not seen[j] and ap[nx, ny] > thr:
                            seen[j] = 1; mask[j] = 1; q.append((nx, ny))
            if n > best_n:
                best_n, best = n, (mask, (x0, y0, x1, y1))
    return best


def only_body(rgba, found):
    """本体から離れた点（？！♪ や紙の汚れ）を消す。顔だけに詰めると目立つため。"""
    mask, _ = found
    w, h = rgba.size
    keep = bytearray(mask)
    for _ in range(2):                       # ふちの半透明を巻きこむぶんだけ太らせる
        grown = bytearray(keep)
        for y in range(h):
            for x in range(w):
                if keep[y * w + x]:
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h:
                            grown[ny * w + nx] = 1
        keep = grown
    a = rgba.getchannel("A"); ap = a.load()
    for y in range(h):
        for x in range(w):
            if not keep[y * w + x]:
                ap[x, y] = 0
    rgba.putalpha(a)


def head_box(rgba, found):
    """帽子のつば＝本体上部でいちばん横に広い行。その幅を一辺にした正方形を返す。"""
    mask, (x0, y0, x1, y1) = found
    w, h = rgba.size
    ylim = min(h, y0 + max(1, int(0.35 * (y1 - y0 + 1))))
    brim_w, brim_cx = 0, (x0 + x1 + 1) / 2
    for y in range(y0, ylim):
        run = start = 0; bw = bs = 0
        for x in range(w):
            if mask[y * w + x]:
                if run == 0: start = x
                run += 1
                if run > bw: bw, bs = run, start
            else:
                run = 0
        if bw > brim_w:
            brim_w, brim_cx = bw, bs + bw / 2
    side = brim_w * 1.08
    top = y0 - side * 0.04
    # あごが切れないように、縦だけ少し伸ばす
    return (brim_cx - side / 2, top, brim_cx + side / 2, top + side * 1.15)


def crop_all():
    im = Image.open(SHEET).convert("RGB")
    for name, box, target_h, erase, head in BOXES:
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
        if head:
            found = body_mask(out)
            if found:
                only_body(out, found)
                hb = head_box(out, found)
                out = out.crop(tuple(int(round(v)) for v in hb))
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
