import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 构建产物输出到仓库根目录的 public/，由 Cloudflare Workers Assets 直接托管（wrangler deploy）。
// emptyOutDir 保持 false，避免误删 public/pic 等文档资源。
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../public',
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
