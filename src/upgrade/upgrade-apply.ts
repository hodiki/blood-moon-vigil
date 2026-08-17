/**
 * upgrade/upgrade-apply.ts —— 升级效果写回（ARCH §2 唯一写回入口之一 / S7 → S2/S3 / E3-S5）
 *
 * 12 项效果逐一写回：改属性走 player-stats.ts，改武器走 UpgradeWriteTargets 接口
 * （WeaponSystem 在 PlayScene 装配时实现该接口；测试可用 fake target 断言纯逻辑）。
 *
 * 数值规则（upgrade-pool §③，纯函数供单测）：
 * - 飞弹分裂 +1：次级弹 ×0.6 伤害（最多 2 次）
 * - 护体球 +1：环绕球 +1（最多 6 颗 = 基础 3 + 3 次）
 * - 冲击波范围 +50%：半径 280→420→560（×2 次）
 * - 飞弹穿透：命中后继续飞行穿透 1 敌（1 次）
 * - 冲击波击退 80px（1 次）
 * - 吸血 1HP/击杀（1 次）
 * - 经验磁力 +100%：80→160→240px（×2 次）
 * - 伤害强化 +15%：总倍率 +0.15（可重复）
 * - 冷却缩减 -8%：全部武器冷却 ×0.92（×3 次）
 * - 最大生命 +20（×5 次）
 * - 1/2 号项：解锁「守夜之环」「月蚀脉冲」
 */

import type { PlayerStats } from '@/player/player-stats';
import type { UpgradeState } from '@/upgrade/upgrade-pool';

/** 写回目标接口（PlayScene 装配真实实现；测试注入 fake） */
export interface UpgradeWriteTargets {
  stats: PlayerStats;
  orbit: {
    unlock(): void; // 解锁「守夜之环」（3 颗可见）
    addOrb(): void; // 护体球 +1（≤6）
  };
  shockwave: {
    unlock(): void; // 解锁「月蚀脉冲」
    setRadiusMultiplier(multiplier: number): void; // 范围 +50%
    setKnockback(enabled: boolean): void; // 击退 80px
  };
  weapons: {
    setMissileSplit(level: number): void; // 分裂次级弹数量
    setMissilePierce(count: number): void; // 穿透数
    setCooldownMultiplier(multiplier: number): void; // 全部武器冷却 ×m
  };
  xp: {
    setMagnetMultiplier(multiplier: number): void; // 磁吸半径 ×m
  };
}

/** 分裂次级弹伤害倍率 ×0.6（upgrade-pool 第 3 项） */
export function splitSubDamageMultiplier(): number {
  return 0.6;
}

/** 冲击波半径倍率 = 1 + 0.5×stacks（第 5 项：+50%×2） */
export function shockwaveRadiusMultiplierForStacks(stacks: number): number {
  return 1 + 0.5 * stacks;
}

/** 磁吸半径倍率 = 1 + stacks（第 9 项：+100%×2 → ×2/×3） */
export function magnetMultiplierForStacks(stacks: number): number {
  return 1 + stacks;
}

/** 冷却倍率 = 0.92^stacks（第 11 项：-8%×3） */
export function cooldownMultiplierForStacks(stacks: number): number {
  return Math.pow(0.92, stacks);
}

/** 伤害强化单次 +0.15（第 10 项） */
export function damageBonusPerStack(): number {
  return 0.15;
}

/** 最大生命单次 +20（第 12 项） */
export function maxHpBonusPerStack(): number {
  return 20;
}

/** 冲击波击退距离 80px（第 7 项） */
export function shockwaveKnockbackDistance(): number {
  return 80;
}

/**
 * 应用一项升级：更新 UpgradeState 并写回 targets。
 * 写回数值全部经上方纯函数计算（单测可对数值断言）。
 */
export function applyUpgrade(state: UpgradeState, targets: UpgradeWriteTargets, itemId: number): void {
  switch (itemId) {
    case 1:
      state.orbitUnlocked = true;
      targets.orbit.unlock();
      break;
    case 2:
      state.shockwaveUnlocked = true;
      targets.shockwave.unlock();
      break;
    case 3:
      state.missileSplit += 1;
      targets.weapons.setMissileSplit(state.missileSplit);
      break;
    case 4:
      state.orbBonus += 1;
      targets.orbit.addOrb();
      break;
    case 5:
      state.shockwaveRangeBonus += 1;
      targets.shockwave.setRadiusMultiplier(shockwaveRadiusMultiplierForStacks(state.shockwaveRangeBonus));
      break;
    case 6:
      state.missilePierce = 1;
      targets.weapons.setMissilePierce(1);
      break;
    case 7:
      state.shockwaveKnockback = true;
      targets.shockwave.setKnockback(true);
      break;
    case 8:
      state.lifesteal = true;
      targets.stats.setLifesteal(1);
      break;
    case 9:
      state.magnetBonus += 1;
      targets.xp.setMagnetMultiplier(magnetMultiplierForStacks(state.magnetBonus));
      break;
    case 10:
      state.damageBonusStacks += 1;
      targets.stats.addDamageBonus(damageBonusPerStack());
      break;
    case 11:
      state.cooldownReductionStacks += 1;
      targets.weapons.setCooldownMultiplier(cooldownMultiplierForStacks(state.cooldownReductionStacks));
      break;
    case 12:
      state.maxHpBonusStacks += 1;
      targets.stats.addMaxHpBonus(maxHpBonusPerStack());
      break;
    default:
      break;
  }
}
