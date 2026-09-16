#!/usr/bin/env node
/**
 * scripts/gen-notify.js
 * 从 public/data/resources.json 生成 public/data/notify.json —— App 每日摘要通知的数据源。
 *
 * 设计要点：
 *  - 无状态：只输出"最近 N 天"的窗口，不存 diff、不存"上次推到哪"。
 *    App 端自己存 lastLatestAt，比对后才弹通知；同一份文件重复拉取不会重复打扰。
 *  - 标题池 titles 在这里维护：App 每次弹通知从池里随机挑一条并填占位符，
 *    改文案只需 push 代码，不用发新版 APK。
 *  - 构建期生成（见 package.json prebuild），生成物随仓库提交。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.join(__dirname, '../public/data/resources.json')
const CATS = path.join(__dirname, '../public/data/categories.json')
const OUT = path.join(__dirname, '../public/data/notify.json')

const WINDOW_DAYS = 3
const MAX_ITEMS = 30
const DAY_MS = 24 * 60 * 60 * 1000

// 通知标题池 —— 钩子文案。占位符：{count} 条数 / {top} 最新一条标题 / {cat} 主分类名。
// 每次弹通知随机挑一条，所以同一批更新在不同设备上标题不一样。
const TITLES = [
  '🔥 仓库又偷偷塞了 {count} 个游戏，不来看看？',
  '别刷了，{count} 个新资源已就位',
  '{top} 只是开头，今天一共 {count} 个更新',
  '有人连夜往仓库里加了 {count} 个好东西',
  '{count} 个新游戏正在等你翻牌子',
  '你的下一个神作，可能就在这 {count} 个里',
  '深夜放毒：{count} 个新资源已上架',
  '仓库更新了，今天有 {count} 个新面孔',
  '刚上架的 {count} 个，错过要等下一次',
  '{count} 个新货入库，手慢无',
]

const DAY_LABELS = ['今天', '昨天', '前天', '最近']
const dayLabel = (days) => DAY_LABELS[Math.min(Math.max(days, 0), DAY_LABELS.length - 1)]

function readResources() {
  if (!fs.existsSync(SRC)) {
    console.error(`❌ 找不到 ${SRC}`)
    process.exit(1)
  }
  return JSON.parse(fs.readFileSync(SRC, 'utf8'))
}

// 分类 key → 中文名（App 用它填 {cat} 占位符，站点改分类名不用发版）
function readCategoryNames() {
  try {
    return Object.fromEntries(
      JSON.parse(fs.readFileSync(CATS, 'utf8')).map((c) => [c.key, c.name])
    )
  } catch {
    return {}
  }
}

const resources = readResources()
const categoryNames = readCategoryNames()
const now = Date.now()
const cutoff = now - WINDOW_DAYS * DAY_MS

const ts = (s) => {
  const t = s ? Date.parse(s) : NaN
  return Number.isNaN(t) ? 0 : t
}

const slim = (r) => ({
  id: r.id,
  title: r.title,
  category: r.category,
  cover: r.cover,
  addedAt: r.addedAt,
  updatedAt: r.updatedAt,
})

// 新增：addedAt 落在窗口内
const newItems = resources
  .filter((r) => ts(r.addedAt) >= cutoff)
  .sort((a, b) => ts(b.addedAt) - ts(a.addedAt))
  .slice(0, MAX_ITEMS)
  .map(slim)

// 更新：addedAt 在窗口外但 updatedAt 在窗口内（老资源被改动）
const updatedItems = resources
  .filter((r) => ts(r.updatedAt) >= cutoff && ts(r.addedAt) < cutoff)
  .sort((a, b) => ts(b.updatedAt) - ts(a.updatedAt))
  .slice(0, MAX_ITEMS)
  .map(slim)

const items = [...newItems, ...updatedItems]
const count = items.length

// 最新一条的时间戳，App 拿它做「推过没有」的判据
const latestAt = items.reduce((acc, r) => {
  const t = Math.max(ts(r.addedAt), ts(r.updatedAt))
  return t > acc ? t : acc
}, 0)

const byCategory = {}
for (const r of items) {
  const key = r.category || 'other'
  byCategory[key] = (byCategory[key] || 0) + 1
}

const categories = Object.entries(byCategory)
  .sort((a, b) => b[1] - a[1])
  .map(([key, n]) => ({ key, name: categoryNames[key] || key, count: n }))

const topTitle = items[0]?.title || ''
// 主分类名：分类数量最大的一项（App 用来填 {cat}）
const topCategory = categories[0]?.key || 'other'

const payload = {
  generatedAt: new Date(now).toISOString(),
  windowDays: WINDOW_DAYS,
  latestAt: latestAt ? new Date(latestAt).toISOString() : null,
  digest: {
    count,
    newCount: newItems.length,
    updateCount: updatedItems.length,
    dayLabel: count ? dayLabel(Math.floor((now - latestAt) / DAY_MS)) : '',
    topTitle,
    topCategory,
    categories,
  },
  items,
  titles: TITLES,
  tapUrl: '/category.html',
}

fs.writeFileSync(OUT, JSON.stringify(payload))

const kb = (fs.statSync(OUT).size / 1024).toFixed(1)
console.log(
  `✅ notify.json 已生成：近 ${WINDOW_DAYS} 天 新增 ${newItems.length} / 更新 ${updatedItems.length} · ` +
    `latestAt=${payload.latestAt || '无'} · ${kb} KB`
)
