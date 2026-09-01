/**
 * weapons/loadout.ts —— 专武 2 选 1 宿主数据 + loadout 单一汇聚点
 *
 * gdd-exclusive-weapons §1.1/§3.1：角色选定后、进图前 2 选 1，本局不可反悔；
 * 落选专武转化为衍生技（EXCLUSIVE_TO_DERIVATIVE）。
 *
 * applyLoadout = 开局装配的**单一汇聚点**（eng-impact-assessment §二.1）：
 * B5 树驱动重写 PlayScene 开局前，先收敛「专武 + 初始通武」门控于一处；
 * 组合矩阵同名去重防重逻辑在此落位（b/Q-d 同名通武不重复发放，§⑩-6 前置）。
 */

import { HERO_EXCLUSIVE_PAIRS, EXCLUSIVE_TO_DERIVATIVE, type ExclusiveWeaponId, type DerivativeSkillId } from '@/config/balance';
import type { WeaponId } from '@/config/balance';

/** 每角色专武对校验（非法组合拒绝——选择屏只可能给这两把） */
export function isValidChoice(heroId: string, chosen: ExclusiveWeaponId): boolean {
  const pair = HERO_EXCLUSIVE_PAIRS[heroId as keyof typeof HERO_EXCLUSIVE_PAIRS];
  return !!pair && pair.includes(chosen);
}

/** 落选专武（pair 中另一把；非法组合 = null） */
export function rejectedExclusive(heroId: string, chosen: ExclusiveWeaponId): ExclusiveWeaponId | null {
  const pair = HERO_EXCLUSIVE_PAIRS[heroId as keyof typeof HERO_EXCLUSIVE_PAIRS];
  if (!pair || !pair.includes(chosen)) return null;
  return pair.find((w) => w !== chosen) ?? null;
}

/** 落选专武 → 衍生技（选择层直接查询；非法组合 = null）
 *  QA-FIX（NV-INTEG-FIX ③）：EXCLUSIVE_TO_DERIVATIVE 的键 = **选中者**（§4.8 注释
 *  「选择 X → 落选 Y → 技 = Y 的衍生技形态」，dv id 注释同证），原实现先取 rejected
 *  再查表属二次转换 → 返回了选中者自己的技形态。修正为直查 chosen。 */
export function derivativeForChoice(heroId: string, chosen: ExclusiveWeaponId): DerivativeSkillId | null {
  if (!isValidChoice(heroId, chosen)) return null;
  return EXCLUSIVE_TO_DERIVATIVE[chosen];
}

/**
 * P1-1 冒烟/基准默认专武（smoke/bench 跳过 2 选 1 插页时的确定性选择）。
 * 取该角色专武对的第 1 把（HERO_EXCLUSIVE_PAIRS[hero][0]）；非法 heroId = null。
 * 抽成纯函数是为了让「smoke/bench 也必须走 applyExclusiveSelection」有一条可单测的
 * 契约——旧实现在 smoke/bench 分支里内联跳过，8 专武恒 disabled 且无从断言。
 */
export function defaultExclusiveFor(heroId: string): ExclusiveWeaponId | null {
  const pair = HERO_EXCLUSIVE_PAIRS[heroId as keyof typeof HERO_EXCLUSIVE_PAIRS];
  return pair?.[0] ?? null;
}

/** loadout 汇聚结果（WeaponSystem.applyLoadout 的入参契约） */
export interface LoadoutResult {
  /** 选中专武 */
  exclusiveId: ExclusiveWeaponId;
  /** 落选专武（→衍生技由装配层接 ActiveSkill 控制器，标注「转化为技能」） */
  rejectedId: ExclusiveWeaponId;
  /** 衍生技 id */
  derivativeId: DerivativeSkillId;
  /** 开局通武 id（B5 前为角色初始通武；同名专武/通武去重后） */
  initialCommonWeapon: WeaponId;
  /** 去重后的武器 id 序列（门控开启集合；applyLoadout 开集合、关其余） */
  enabledWeaponIds: WeaponId[];
}

/**
 * 计算 loadout（纯函数；不触碰 WeaponSystem）。
 * 去重：专武与通武同 id 时通武位不重复发放（防 §⑩-6 同名重复）。
 */
export function computeLoadout(heroId: string, chosen: ExclusiveWeaponId, initialCommonWeapon: WeaponId): LoadoutResult | null {
  if (!isValidChoice(heroId, chosen)) return null;
  const rejected = rejectedExclusive(heroId, chosen)!;
  // QA-FIX（NV-INTEG-FIX ③）：同 derivativeForChoice —— 表键 = 选中者，直查 chosen
  const derivativeId = EXCLUSIVE_TO_DERIVATIVE[chosen];
  const enabled = [...new Set<WeaponId>([initialCommonWeapon])];
  return { exclusiveId: chosen, rejectedId: rejected, derivativeId, initialCommonWeapon, enabledWeaponIds: enabled };
}
