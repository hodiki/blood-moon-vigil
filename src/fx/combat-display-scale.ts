/**
 * 已过 C/E 64 抬到英雄世界边 128：scale = 128 / frameW。
 * 128 英雄 1:1。比 128 大的画布（守誓者 192）也 1:1，不要压回 128——他必须比她高。
 * 狂化：`rage × combatDisplayScale(frameW)`。
 */
export const COMBAT_WORLD_PX = 128;

export function combatDisplayScale(frameW: number, worldPx = COMBAT_WORLD_PX): number {
  if (!frameW) return 1;
  if (frameW >= worldPx) return 1;
  return worldPx / frameW;
}

export function applyCombatDisplayScale(
  sprite: { frame?: { width?: number }; setScale: (s: number) => unknown },
  rageMult = 1,
): number {
  const w = sprite.frame?.width ?? 0;
  const s = combatDisplayScale(w) * rageMult;
  sprite.setScale(s);
  return s;
}

/* ─────────────────────────── 地线锚点（originY） ───────────────────────────
 *
 * 问题：全仓角色/敌人一律**默认居中锚点**（originY 0.5）。脚底到锚点的距离随画布变大：
 *   画布 128（薇奥莱/卡珊德拉/魔化）脚底 127 → 居中锚点下脚在 `y + 63.5`
 *   画布 160（加尔文 NV-ENG-EXEC-35）脚底 159 → 居中锚点下脚在 `y + 79.5`（**沉 16px**）
 * ⇒ 同一 world y 上，160 画布的脚比 128 画布低 16px（陷进地面）。
 *
 * 解法：当画布比 128 大时，把 originY 从 0.5 抬到「脚底恰好仍在 y + 63.5」的位置。
 * 为什么不是交付单 P1 的字面写法 `setOrigin(0.5, 159/160)`：那会把**脚放在 y 本身**，
 * 即比同一 world y 的薇奥莱**高 63.5px**（实测见 production/official-v1/加尔文160换服-落地报告-2026-11-18.md）。
 * y 的语义是「画布锚点中心」而不是「地面」，全仓定位/相机/拾取/索敌都用它——不能改它的含义，
 * 只能让新画布的锚点走到「脚底仍在老地线上」的地方。
 *
 * 与 `weapons/companion/oathkeeper-view.ts` 的 192 守誓者 yOffset −32 等价（那边用常量偏移，
 * 因为 y 由 `state.y` 驱动；玩家 y 是玩法权威值，故在此改锚点）。
 */

/** 128 画布英雄脚底相对锚点的世界 px（= 最低不透明像素行 127 的中心 127.5 − 锚点 64） */
export const PLAYER_FOOT_OFFSET = 63.5;

/** 地线基准画布边长：128 画布 + 默认锚点即现网全部英雄的现状 */
export const GROUND_BASELINE_CANVAS = 128;

/** 默认居中锚点（128 及更小画布保持不变） */
export const GROUND_CENTER_ORIGIN = 0.5;

/**
 * 画布高 → 让「脚底（画布最后一行像素的中心）落在地线 `y + PLAYER_FOOT_OFFSET`」所需的 originY。
 * 128 及更小画布返回 0.5（= 默认居中，现有角色/敌人行为零变化）。160 → 0.6，192 → 2/3。
 */
export function groundAnchorOriginY(canvasH: number): number {
  if (!canvasH || canvasH <= GROUND_BASELINE_CANVAS) return GROUND_CENTER_ORIGIN;
  const footCenter = canvasH - 1 + 0.5; // 最后一行像素中心（与 PLAYER_FOOT_OFFSET 同口径）
  return (footCenter - PLAYER_FOOT_OFFSET) / canvasH;
}

/**
 * 画布变大后把 Arcade Body 的 offset 补回「128 画布 + 默认锚点」时的位置。
 *
 * 为什么需要：`Body.updateFromGameObject` 每帧按 `sprite.x/y − displayOrigin + offset` 推 body 位置，
 * 所以**画布变大**和**改 originY** 都会把碰撞体推走：
 *   128 画布 · origin 0.5 → body 左上角 = (x − 64, y − 64)
 *   160 画布 · origin 0.6 → body 左上角 = (x − 80, y − 96)  ← 不补偿就整体上移 32px
 * 回归到 (−64, −64) 后，接触判定圆（PLAYER.RADIUS）与障碍 AABB 与换画布前**逐像素一致**，
 * 也即与同 world y 的 128 画布英雄一致 —— 换图纯视觉，不动玩法。
 */
export function groundAnchorBodyOffset(canvasW: number, displayOriginY: number): { x: number; y: number } {
  return {
    x: canvasW / 2 - GROUND_BASELINE_CANVAS / 2,
    y: displayOriginY - GROUND_BASELINE_CANVAS / 2,
  };
}
