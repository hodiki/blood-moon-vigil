/**
 * utils/device.ts —— 平台检测（ARCH §4.2）
 *
 * 在 main.ts 最先执行，写入 RuntimeConfig，全局唯一、运行期只读。
 * 规则（ARCH §4.2）：`maxTouchPoints > 0 && 'ontouchstart' in window`，或宽度 < 768px。
 * 注意：触屏笔记本会被判为移动端——这是架构定案规则，可接受（触屏设备本就该走触控交互）。
 */

export function detectIsMobile(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const touchCapable = navigator.maxTouchPoints > 0 && 'ontouchstart' in window;
  const narrow = window.innerWidth < 768;
  return touchCapable || narrow;
}
