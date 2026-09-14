// src/lib/appEnv.js
// 是否运行在「游戏源神」安卓 App 的 WebView 内。命中后隐藏「安卓APP」下载入口 ——
// 人已经在 App 里了，再让他装一遍是噪音。
//
// 判据（任一命中）：
//   ① 壳自定义 UA 标记 `GameHubApp/`：需壳里 settings.userAgentString 追加，下次发版才生效；
//   ② Android WebView 默认 UA 的 `; wv)` 标记：当前已发布的壳就是这个，改站点即生效，无需重发 APK。
// 注意 ② 会一并命中其它 Android WebView（微信、QQ 等内置浏览器）——在那里下载 APK 本来也常被拦，
// 收起入口是更合理的行为，代价可接受。
const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || ''

export const IS_APP_WEBVIEW = /GameHubApp\//i.test(ua) || (/Android/i.test(ua) && /;\s*wv\)/i.test(ua))
