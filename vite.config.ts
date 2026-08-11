import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// GitHub Pages のサブパスでも動くように相対パスで出力する
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5180,
    strictPort: true,
    fs: {
      /**
       * Premium 限定コンテンツを開発サーバーからも配信しない。
       *
       * 本番ビルド（dist/）には元々含まれないが、`vite dev` はプロジェクト直下の
       * ファイルを静的配信するため、この指定が無いと
       * http://localhost:5180/content/premium.json で本文が読めてしまう。
       * 「開発中は漏れていた」を残さないため、ここでも塞ぐ。
       */
      deny: ['**/content/premium.json', '**/.dev.vars', '**/.env.local'],
    },
  },
})
