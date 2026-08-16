// 构建脚本：产物直接输出到 frontend/ 根目录（部署渠道将本目录作为静态站点输出）。
// index.html 会被构建版本覆盖，开发模板保存在 index.dev.html，构建前自动还原为入口。
import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

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

// 3) 镜像到 ../public/，保持本机 wrangler deploy（Worker + Assets）路径可用
rmSync(`${publicDir}assets`, { recursive: true, force: true })
mkdirSync(`${publicDir}assets`, { recursive: true })
copyFileSync(`${root}index.html`, `${publicDir}index.html`)
for (const file of readdirSync(`${root}assets`)) {
  copyFileSync(`${root}assets/${file}`, `${publicDir}assets/${file}`)
}
console.log('✅ Build output in frontend/ (Pages) and mirrored to public/ (Workers)')
