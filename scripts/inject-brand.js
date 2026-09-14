// scripts/inject-brand.js
// 构建后把品牌名写进 dist 的 HTML：
//   1) <title>/<meta> 里的默认品牌（GameHub）直接替换成 site.json 的 brand.name —— 页签首帧即正确；
//   2) <head> 首部注入 window.__BRAND__ / window.__BRAND_ACCENT__，供 useBrand() 首帧读取 —— logo 不再先渲染 GameHub 再换名。
// 品牌是构建期常量：Admin 改 site.json 会 push → CI 重建，两边自动同步。
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = resolve(root, 'dist')
const DEFAULT_BRAND = 'GameHub'

const site = JSON.parse(readFileSync(resolve(root, 'public/data/site.json'), 'utf8'))
const name = site?.brand?.name || site?.siteName || DEFAULT_BRAND
const accent = site?.brand?.accent ?? ''
const marker = '<script>window.__BRAND__'

const inject =
  `<script>window.__BRAND__=${JSON.stringify(name)};` +
  `window.__BRAND_ACCENT__=${JSON.stringify(accent)}</script>`

let n = 0
for (const f of readdirSync(DIST).filter((f) => f.endsWith('.html'))) {
  const p = resolve(DIST, f)
  let html = readFileSync(p, 'utf8')
  if (html.includes(marker)) continue // 幂等：重复 postbuild 不叠加
  html = html.split(DEFAULT_BRAND).join(name)
  html = html.replace(/<head>/, `<head>\n  ${inject}`)
  writeFileSync(p, html)
  n++
}
console.log(`✅ 品牌注入：${name}${accent ? `（高亮 ${accent}）` : ''} → dist/*.html（${n} 个）`)
