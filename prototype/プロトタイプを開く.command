#!/bin/bash
# ダブルクリックで、Studio Next のトップページ設計案をブラウザで開きます。
cd "$(dirname "$0")" || exit 1
PORT=8766
echo ""
echo "  AI音楽部 Studio Next — トップページ設計案"
echo "  http://localhost:${PORT}/studio-home.html を開きます。"
echo "  終わるときは Control + C を押してください。"
echo ""
( sleep 1 && open "http://localhost:${PORT}/studio-home.html" ) &
python3 -m http.server "${PORT}" --bind 127.0.0.1
