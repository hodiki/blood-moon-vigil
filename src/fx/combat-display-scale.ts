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
