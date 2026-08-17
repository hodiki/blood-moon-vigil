/**
 * enemies/boss-math.ts —— Boss 机制纯函数层（E4-S2，可脱离 Phaser 单测）
 *
 * 霸体逻辑（enemies §⑥.5 / art-bible §4）：出场 0.5s 霸体闪红，期内不承伤。
 * WeaponSystem.refreshEnemies 用 `isBossInGrace(now, e.graceUntil)` 过滤目标。
 */

import { BOSS } from '@/config/balance';

/** 霸体截止 = 出场时刻 + 0.5s（enemies §⑥.5） */
export function bossGraceEndsAt(nowSeconds: number): number {
  return nowSeconds + BOSS.GRACE_SECONDS;
}

/** 是否处于霸体（now < graceUntil → 期内不承伤） */
export function isBossInGrace(nowSeconds: number, graceUntil: number): boolean {
  return nowSeconds < graceUntil;
}
