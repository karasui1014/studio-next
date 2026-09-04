#!/usr/bin/env python3
"""GitHub Pages に置く公開版を public/kakei/ に作る。

公開版は window.claude が無いので localOnly で動く。つまり、
書いた数字はその端末の localStorage にだけ残り、公開ページに
数字が出ることはない（暗号化されたうえ、そもそも書き戻さない）。

ふたりで共有したいときは Artifact 版（claude.ai の共有リンク）を使う。
"""
import pathlib, json

here = pathlib.Path(__file__).resolve().parent
root = here.parent
out = root / "public" / "kakei"
out.mkdir(parents=True, exist_ok=True)

html = (here / "index.html").read_text(encoding="utf-8")
# ホーム画面に追加できるようにする。Artifact 版は外部ファイルを読めないので、公開版だけに足す。
extra = (
    '<meta name="theme-color" content="#F5F1E8">\n'
    '<link rel="manifest" href="app.webmanifest">\n'
    '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n'
)
html = html.replace("<title>ふたりの家計</title>\n", "<title>ふたりの家計</title>\n" + extra, 1)
(out / "index.html").write_text(html, encoding="utf-8")

# アイコンは assets/build-icons.py が public/kakei/icons/ に直接作る。
# ここで上書きしないこと（引き継ぎ書のアイコンで潰してしまうため）。
if not (out / "icons" / "icon-192.png").exists():
    print("※ アイコンがまだ無い: python3 kakei/assets/build-icons.py を先に実行")

manifest = {
    "name": "ふたりの家計",
    "short_name": "家計",
    "start_url": "./",
    "scope": "./",
    "display": "standalone",
    "background_color": "#F5F1E8",
    "theme_color": "#F5F1E8",
    "icons": [
        {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
        {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png"},
        {"src": "icons/icon-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
    ],
}
(out / "app.webmanifest").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("作った:", out)
