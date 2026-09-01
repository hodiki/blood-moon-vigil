/**
 * fx/status-dots.ts —— P2-7① 敌怪头顶状态微标 · 纯函数部分
 *
 * 与 status-markers.ts（Phaser 渲染层）分离，保持可脱离 Phaser 单测
 * （test-framework §1.2 惯例）。
 */

import { PALETTE } from '@/config/balance';
import { queryStatus, type StatusState } from '@/combat/status/status-engine';

/**
 * 状态点池同屏上限：48 个 Image（约 16 敌 × 3 态，或 48 敌 × 1 态）。
 * 预算内优先级天然按遍历序（先遍历到的敌怪先占位）；超限目标不绘制微标（零额外 draw call）。
 */
export const STATUS_DOTS_MAX = 48;

/**
 * 敌怪头顶状态微标三态（纯函数；queryStatus 消费者）：
 * 眩晕（marker-stun，月纸白）/ 减速（marker-slow，冷青）/ 易伤（marker-mark，月银白）。
 * marker-* 帧到货前走 p-circle tint 圆点兜底（fxSlot 惯例）。
 */
export function statusDotsFor(
  cc: StatusState | null | undefined,
  now: number,
): readonly { color: string; frame: string }[] {
  const dots: { color: string; frame: string }[] = [];
  if (!cc) return dots;
  // NV-REVIEW-FIX P0-3：状态图标统一读状态层 `cc`（旧散落字段 stunnedUntil/slowUntil/markUntil
  // 已无生产写入方——markUntil 随易伤迁入状态层后彻底退役）。
  if (queryStatus(cc, 'stun', now).active) {
    dots.push({ color: PALETTE.uiPaper, frame: 'marker-stun' });
  }
  if (queryStatus(cc, 'slow', now).active) {
    dots.push({ color: PALETTE.playerAccent, frame: 'marker-slow' });
  }
  if (queryStatus(cc, 'vulnerable', now).active) {
    dots.push({ color: PALETTE.player, frame: 'marker-mark' });
  }
  return dots;
}
