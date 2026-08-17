/**
 * upgrade/upgrade-pool.ts —— 升级池 12 项 + 抽取规则（ARCH §2 / S7 / E3-S3）
 *
 * 纯逻辑（test-framework §1.2：抽取规则抽为纯函数，可脱离 Phaser 单测）：
 * - UPGRADES 12 项元数据来自 balance.ts（唯一数据源，GDD upgrade-pool §③ 表）。
 * - UpgradeState：当前叠加/解锁状态（E3-S5 写回也改它，来源唯一）。
 * - rollThree(state, random)：三选一 —— 未解锁项权重 ×2、上次选过 ×0.5、
 *   已满级剔除、全满级回退数值项 10（U8-§③）；不重复（不放回抽样）。
 *
 * 数值校验：机制改变型 9/12 = 75% ≥ 50%（U8-1）。
 */

import { UPGRADES, type UpgradeItemData } from '@/config/balance';

export type { UpgradeType } from '@/config/balance';

/** id → 项（rollThree 兜底 / 写回用） */
export const UPGRADE_BY_ID: Record<number, UpgradeItemData> = (() => {
  const map: Record<number, UpgradeItemData> = {};
  for (const item of UPGRADES) map[item.id] = item;
  return map;
})();

export function isMechanicType(item: UpgradeItemData): boolean {
  return item.type === 'mechanic';
}

/** 机制改变型占比（12 项中 9 项 = 75%，U8-1 静态断言） */
export function mechanicRatio(): number {
  return UPGRADES.filter(isMechanicType).length / UPGRADES.length;
}

export interface UpgradeOption {
  id: number;
  item: UpgradeItemData;
}

/** 当前升级叠加/解锁状态（E3-S3 抽取与 E3-S5 写回共用） */
export class UpgradeState {
  missileSplit = 0; // 3 飞弹分裂（≤2）
  missilePierce = 0; // 6 飞弹穿透（≤1）
  orbitUnlocked = false; // 1 解锁守夜之环
  shockwaveUnlocked = false; // 2 解锁月蚀脉冲
  orbBonus = 0; // 4 护体球 +1（≤3，即最多 6 颗）
  shockwaveRangeBonus = 0; // 5 冲击波范围 +50%（≤2）
  shockwaveKnockback = false; // 7 冲击波击退（≤1）
  lifesteal = false; // 8 吸血（≤1）
  magnetBonus = 0; // 9 经验磁力 +100%（≤2）
  damageBonusStacks = 0; // 10 伤害强化 +15%（可重复）
  cooldownReductionStacks = 0; // 11 冷却缩减 -8%（≤3）
  maxHpBonusStacks = 0; // 12 最大生命 +20（≤5）
  /** 上次选择项 id（抽取权重 ×0.5；无则 null） */
  lastPickId: number | null = null;
}

/** 某项当前叠加次数（0 = 从未选择 = 未解锁） */
export function stacksFor(state: UpgradeState, itemId: number): number {
  switch (itemId) {
    case 1: return state.orbitUnlocked ? 1 : 0;
    case 2: return state.shockwaveUnlocked ? 1 : 0;
    case 3: return state.missileSplit;
    case 4: return state.orbBonus;
    case 5: return state.shockwaveRangeBonus;
    case 6: return state.missilePierce;
    case 7: return state.shockwaveKnockback ? 1 : 0;
    case 8: return state.lifesteal ? 1 : 0;
    case 9: return state.magnetBonus;
    case 10: return state.damageBonusStacks;
    case 11: return state.cooldownReductionStacks;
    case 12: return state.maxHpBonusStacks;
    default: return 0;
  }
}

/** 已满级 = 叠加次数达到上限（可重复项恒不满级） */
export function isMaxed(item: UpgradeItemData, state: UpgradeState): boolean {
  return stacksFor(state, item.id) >= item.maxStack;
}

/** 抽取权重：未解锁 ×2；上次选过 ×0.5（upgrade-pool §③） */
export function pickWeight(item: UpgradeItemData, state: UpgradeState): number {
  let weight = 1;
  if (stacksFor(state, item.id) === 0) weight *= 2;
  if (state.lastPickId === item.id) weight *= 0.5;
  return weight;
}

/**
 * 三选一抽取（不放回抽样）：
 * 1. 候选 = 未满级项；全满级 → 回退数值项 10（可重复，恒在池内）。
 * 2. 加权不放回取 3 项（未解锁 ×2 / 上次选过 ×0.5）。
 * 3. 极端兜底：候选不足 3 时用项 10 补齐（理论不发生，项 10 恒可用）。
 * random 可注入（测试用确定性 rng），默认 Math.random。
 */
export function rollThree(state: UpgradeState, random: () => number = Math.random): UpgradeOption[] {
  let candidates = UPGRADES.filter((item) => !isMaxed(item, state));
  if (candidates.length === 0) candidates = [UPGRADE_BY_ID[10]!];

  const pool = [...candidates];
  const picks: UpgradeOption[] = [];
  while (picks.length < 3 && pool.length > 0) {
    const weights = pool.map((item) => pickWeight(item, state));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = random() * total;
    let idx = pool.length - 1;
    for (let i = 0; i < pool.length; i += 1) {
      r -= weights[i]!;
      if (r < 0) {
        idx = i;
        break;
      }
    }
    const item = pool[idx]!;
    pool.splice(idx, 1);
    picks.push({ id: item.id, item });
  }
  while (picks.length < 3) picks.push({ id: 10, item: UPGRADE_BY_ID[10]! });
  return picks;
}

/** DOM 覆盖层卡片渲染数据（ADR-004：UI 只读，不持有游戏状态） */
export function formatUpgradeOption(option: UpgradeOption): { title: string; desc: string; effectText: string } {
  return { title: option.item.name, desc: option.item.desc, effectText: option.item.effectText };
}
