/**
 * weapons/missile-options.ts —— 飞弹分裂/穿透选项纯逻辑（TASK-21 Bug3，可脱离 Phaser 单测）
 *
 * 用户真机反馈：飞弹分裂升级后无限弹射。
 * 根因：分裂由 WeaponSystem 级 missileSplit 标志驱动，次级弹继承该标志 → 次级弹命中
 * 又分裂 → 无限递归（直至池满弹幕泛滥）。
 *
 * 修复语义：
 * - 分裂只发生在主弹（per-missile canSplit 标志；次级弹 canSplit=false 不再分裂）。
 * - 穿透与分裂互斥（applyMissileSplit/Pierce 写回互清；命中时 remainingPierce>0 优先穿透）。
 * - 命中后正常消散回池（应由调用方在 shouldSpawnSplitMissiles 后 dissipate）。
 */

export interface MissileSplitOptions {
  /** 分裂次级弹数（0 = 无分裂；upgrade-pool 第 3 项，≤2） */
  split: number;
  /** 穿透次数（0 = 无穿透；upgrade-pool 第 6 项，≤1） */
  pierce: number;
}

/** 写回分裂：level>0 时清除穿透（穿透与分裂互斥，weapons §⑤ / TASK-21 Bug3） */
export function applyMissileSplit(opts: MissileSplitOptions, level: number): MissileSplitOptions {
  return { split: level, pierce: level > 0 ? 0 : opts.pierce };
}

/** 写回穿透：count>0 时清除分裂（互斥） */
export function applyMissilePierce(opts: MissileSplitOptions, count: number): MissileSplitOptions {
  return { pierce: count, split: count > 0 ? 0 : opts.split };
}

/**
 * 命中后是否生成次级弹（TASK-21 Bug3 无限弹射根因修复）：
 * - 仅主弹可分裂（canSplit；次级弹不分裂）；
 * - 分裂等级 >0；
 * - 无剩余穿透（remainingPierce>0 走穿透路径优先，防御互斥）。
 */
export function shouldSpawnSplitMissiles(
  canSplit: boolean,
  remainingPierce: number,
  splitLevel: number,
): boolean {
  return canSplit && splitLevel > 0 && remainingPierce <= 0;
}
