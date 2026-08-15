import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 构建产物直接输出到 frontend/ 根目录：Cloudflare Pages 将本目录作为静态输出托管。
// emptyOutDir 必须为 false —— 输出目录就是源码目录，绝不能清空（旧哈希产物由 scripts/build.mjs 清理）。
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '.',
    emptyOutDir: false,
    target: 'es2022',
  },
  server: {
    port: 5173,
    proxy: {
      // 本地开发时代理到 wrangler dev (默认 8787)
      '/api': 'http://127.0.0.1:8787',
    },
  },
})
