/**
 * weapons/class-upgrades.ts —— 武器类强化 12 分支纯逻辑（E2-S8 / gdd-upgrade-pool-v2 §3.3）
 *
 * 纯函数（可脱离 Phaser 单测）：12 分支（A1~D3）每层效果、类累计、派生倍率。
 * 数据源：UPGRADE_POOL 中 up_w_a1~d3（各分支可叠 2 次，gdd-upgrade-pool-v2 §3.3）。
 *
 * 分支效果（每层，gdd-upgrade-pool-v2 §3.3 表）：
 * - A1 分裂 +1：命中额外 1 枚次级弹（×0.6 伤，自动追踪）      —— split
 * - A2 穿透 +1：弹体额外穿透 1 敌（穿透上限 = 基础 + 2）      —— pierce
 * - A3 弹速 +20%：弹速 ×1.20（满层 ×1.44）                  —— speed
 * - B1 数量 +1：环绕球/尖刺 +1（上限 6）                     —— count
 * - B2 转速 +20%：转速 ×1.20（满层 ×1.44）                  —— angularSpeed
 * - B3 半径 +15%：半径 ×1.15（满层 ×1.32）                  —— radius
 * - C1 范围 +25%：半径 ×1.25（满层 ×1.56）                  —— areaRadius
 * - C2 伤害 +20%：伤害 ×1.20（满层 ×1.44）                  —— damage
 * - C3 持续 +30%：持续 ×1.30（满层 ×1.69）                  —— duration
 * - D1 召唤数 +1：召唤物 +1（上限 6）                        —— summonCount
 * - D2 索敌 +30%：索敌半径/追击距离 ×1.30（满层 ×1.69）      —— aggro
 * - D3 存在 +30%：存在时间 ×1.30（满层 ×1.69）              —— lifetime
 *
 * 类成型判定（超武合成条件 1，gdd-weapons-v2 §5.1）：该类累计强化 ≥2 次
 * （任意分支组合，单分支上限 2 次）。阈值由 3 降至 2（M3-DESIGN-1 进化前置）。
 * 满 6 次 = 类全满（极端 build）；进化后超武不再吃类强化。
 */

import type { WeaponClass } from '@/config/balance';

/** 12 分支唯一 id（up_w_a1~d3 后缀） */
export type ClassBranch =
  | 'a1' | 'a2' | 'a3'
  | 'b1' | 'b2' | 'b3'
  | 'c1' | 'c2' | 'c3'
  | 'd1' | 'd2' | 'd3';

/** 类强化堆叠状态（每分支 0~2 层） */
export interface ClassUpgradeStacks {
  a1: number; a2: number; a3: number;
  b1: number; b2: number; b3: number;
  c1: number; c2: number; c3: number;
  d1: number; d2: number; d3: number;
}

/** 空堆叠（全 0） */
export function emptyClassUpgradeStacks(): ClassUpgradeStacks {
  return { a1: 0, a2: 0, a3: 0, b1: 0, b2: 0, b3: 0, c1: 0, c2: 0, c3: 0, d1: 0, d2: 0, d3: 0 };
}

/** 单分支叠加上限 2 次（gdd-upgrade-pool-v2 §3.3：各分支可叠 2 次） */
export const CLASS_BRANCH_MAX_STACK = 2;

/** 类成型阈值：该类累计强化 ≥2 次（超武合成条件 1，gdd-weapons-v2 §5.1；M3-DESIGN-1 进化前置 3→2） */
export const CLASS_UPGRADE_EVOLUTION_THRESHOLD = 2;

/** 分支所属类 */
export function branchClass(branch: ClassBranch): WeaponClass {
  return branch[0]!.toUpperCase() as WeaponClass;
}

/** 该类包含的分支列表（a 类 = ['a1','a2','a3']） */
export function branchesOfClass(cls: WeaponClass): ClassBranch[] {
  const prefix = cls.toLowerCase();
  return (['1', '2', '3'] as const).map((n) => `${prefix}${n}` as ClassBranch);
}

/** 累计某类强化次数（任意分支组合，单分支 ≤2）—— 超武合成条件 1 判定用 */
export function classUpgradeTotal(stacks: ClassUpgradeStacks, cls: WeaponClass): number {
  let total = 0;
  for (const b of branchesOfClass(cls)) total += stacks[b];
  return total;
}

/** 类成型判定（累计 ≥2 次；gdd-weapons-v2 §5.1 条件 1，M3-DESIGN-1 阈值 3→2） */
export function isClassFullyUpgraded(stacks: ClassUpgradeStacks, cls: WeaponClass): boolean {
  return classUpgradeTotal(stacks, cls) >= CLASS_UPGRADE_EVOLUTION_THRESHOLD;
}

/** 读取单分支堆叠（越界 clamp 0） */
export function branchStack(stacks: ClassUpgradeStacks, branch: ClassBranch): number {
  return stacks[branch];
}

/** 叠加一层（上限 2）；返回新堆叠（不可变） */
export function addClassUpgrade(stacks: ClassUpgradeStacks, branch: ClassBranch): ClassUpgradeStacks {
  const next = { ...stacks };
  next[branch] = Math.min(next[branch] + 1, CLASS_BRANCH_MAX_STACK);
  return next;
}

// ============================================================================
// 派生倍率（每层效果，gdd-upgrade-pool-v2 §3.3）
// ============================================================================

/** A1 分裂：每层 +1 次级弹（×0.6 伤）；满层 +2 */
export function splitPerStack(): number {
  return 1;
}

/** A2 穿透：每层 +1 穿透（穿透上限 = 基础 + 2） */
export function piercePerStack(): number {
  return 1;
}

/** A3 弹速：每层 ×1.20（满层 ×1.44） */
export function speedMultiplierForStacks(stacks: number): number {
  return Math.pow(1.2, stacks);
}

/** B1 数量：每层 +1（上限 6 颗，守夜之环 3→5；荆棘圣环 4→6） */
export function countPerStack(): number {
  return 1;
}

/** B2 转速：每层 ×1.20（满层 ×1.44） */
export function angularSpeedMultiplierForStacks(stacks: number): number {
  return Math.pow(1.2, stacks);
}

/** B3 半径：每层 ×1.15（满层 ×1.32） */
export function radiusMultiplierForStacks(stacks: number): number {
  return Math.pow(1.15, stacks);
}

/** C1 范围半径：每层 ×1.25（满层 ×1.56） */
export function areaRadiusMultiplierForStacks(stacks: number): number {
  return Math.pow(1.25, stacks);
}

/** C2 伤害：每层 ×1.20（满层 ×1.44） */
export function damageMultiplierForStacks(stacks: number): number {
  return Math.pow(1.2, stacks);
}

/** C3 持续：每层 ×1.30（满层 ×1.69） */
export function durationMultiplierForStacks(stacks: number): number {
  return Math.pow(1.3, stacks);
}

/** D1 召唤数：每层 +1（血蝠 2→4；猎犬 1→3；上限 6） */
export function summonPerStack(): number {
  return 1;
}

/** D2 索敌：每层 ×1.30（满层 ×1.69） */
export function aggroMultiplierForStacks(stacks: number): number {
  return Math.pow(1.3, stacks);
}

/** D3 存在：每层 ×1.30（满层 ×1.69） */
export function lifetimeMultiplierForStacks(stacks: number): number {
  return Math.pow(1.3, stacks);
}

/** 次级弹伤害倍率 ×0.6（A1 分裂，gdd-upgrade-pool-v2 §3.3；与 upgrade-apply.splitSubDamageMultiplier 同源口径） */
export function subProjectileDamageMultiplier(): number {
  return 0.6;
}
