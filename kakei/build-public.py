#!/usr/bin/env python3
"""GitHub Pages に置く公開版を public/kakei/ に作る。

公開版は window.claude が無いので localOnly で動く。つまり、
書いた数字はその端末の localStorage にだけ残り、公開ページに
数字が出ることはない（暗号化されたうえ、そもそも書き戻さない）。

ふたりで共有したいときは Artifact 版（claude.ai の共有リンク）を使う。
"""
import pathlib, shutil, json

here = pathlib.Path(__file__).resolve().parent
root = here.parent
out = root / "public" / "kakei"
out.mkdir(parents=True, exist_ok=True)

html = (here / "index.html").read_text(encoding="utf-8")
# ホーム画面に追加できるようにする。Artifact 版は外部ファイルを読めないので、公開版だけに足す。
extra = (
    '<meta name="theme-color" content="#2E5F63">\n'
    '<link rel="manifest" href="app.webmanifest">\n'
    '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n'
)
html = html.replace("<title>ふたりの家計</title>\n", "<title>ふたりの家計</title>\n" + extra, 1)
(out / "index.html").write_text(html, encoding="utf-8")

# アイコンは引き継ぎ書と同じ探偵なので、そのまま借りる
icons_src = root / "public" / "shukatsu" / "icons"
if icons_src.is_dir():
    shutil.copytree(icons_src, out / "icons", dirs_exist_ok=True)

manifest = {
    "name": "ふたりの家計",
    "short_name": "家計",
    "start_url": "./",
    "scope": "./",
    "display": "standalone",
    "background_color": "#F5F1E8",
    "theme_color": "#2E5F63",
    "icons": [
        {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
        {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png"},
        {"src": "icons/icon-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
    ],
}
(out / "app.webmanifest").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("作った:", out)
