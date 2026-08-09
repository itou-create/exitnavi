import { defineConfig } from 'vite'

// GitHub Pages のサブディレクトリに置く場合は base を '/<repo名>/' にする。
// 例: https://user.github.io/exitnavi/ に置くなら base: '/exitnavi/'
export default defineConfig({
  base: './',
  server: {
    // ODPT API をブラウザから直接叩くと CORS で弾かれる可能性があるため、
    // 開発時だけ Vite のプロキシ経由にする。
    // 本番でも弾かれる場合は CLAUDE.md の「CORS について」を読むこと。
    proxy: {
      '/odpt': {
        target: 'https://api.odpt.org',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/odpt/, '/api/v4'),
      },
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
})
