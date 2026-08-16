// 构建脚本：产物直接输出到 frontend/ 根目录（Cloudflare Pages 将本目录作为静态站点输出）。
// index.html 会被构建版本覆盖，开发模板保存在 index.dev.html，构建前自动还原为入口。
// 后端打包为 _worker.js（Pages 高级模式），使 /api/* 在 Pages 上可用。
import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import esbuild from 'esbuild'

const templateOnly = process.argv.includes('--template-only')
const root = fileURLToPath(new URL('..', import.meta.url))
const publicDir = fileURLToPath(new URL('../../public/', import.meta.url))

// 1) 还原开发模板作为 vite 构建入口
copyFileSync(`${root}index.dev.html`, `${root}index.html`)

if (templateOnly) process.exit(0)

// 2) 清理旧哈希产物后构建（emptyOutDir 为 false 以保护源码目录）
rmSync(`${root}assets`, { recursive: true, force: true })
const result = spawnSync('npx', ['vite', 'build'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
})
if (result.status !== 0) process.exit(result.status ?? 1)

// 3) 打包后端 Worker 为 Pages 高级模式入口 frontend/_worker.js
await esbuild.build({
  entryPoints: [fileURLToPath(new URL('../../src/server.js', import.meta.url))],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  outfile: `${root}_worker.js`,
  legalComments: 'none',
  minify: true,
})
console.log('✅ Backend bundled to frontend/_worker.js (Pages advanced mode)')

// 4) 镜像到 ../public/，保持本机 wrangler deploy（Worker + Assets）路径可用
rmSync(`${publicDir}assets`, { recursive: true, force: true })
mkdirSync(`${publicDir}assets`, { recursive: true })
copyFileSync(`${root}index.html`, `${publicDir}index.html`)
for (const file of readdirSync(`${root}assets`)) {
  copyFileSync(`${root}assets/${file}`, `${publicDir}assets/${file}`)
}
console.log('✅ Build output in frontend/ (Pages) and mirrored to public/ (Workers)')
