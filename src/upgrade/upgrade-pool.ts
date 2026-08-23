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
import {
  emptyClassUpgradeStacks,
  classUpgradeTotal,
  isClassFullyUpgraded,
  type ClassUpgradeStacks,
} from '@/weapons/class-upgrades';
import type { WeaponClass } from '@/config/balance';

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

/** rollThree 可选参数（TASK-39 E2 首级强制武器） */
export interface RollThreeOptions {
  /**
   * 首级强制武器：保证三选一至少含 1 或 2 号（守夜之环/月蚀脉冲）之一。
   * 规则：先在候选池随机取一把可用武器（未满级）入三选一，其余 2 项正常加权抽取。
   * 仅首级调用方传 true（PlayScene 记首次抽取标志）；两把武器都满级时自然跳过。
   */
  forceWeaponFirst?: boolean;
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
  /** 上次选择项 id（抽取权重 ×0.5；无则 null；E4-S4 v2 池为内容 ID 字符串） */
  lastPickId: number | string | null = null;

  /**
   * E2-S8 泛化：内容 ID → 叠加次数（40 项池，up_w_a1~d3 / key_* / up_g_*）。
   * 既有 12 项仍走命名域（back-compat，既有测试断言）；新 40 项写本 map。
   * 武器类强化 12 分支：单分支上限 2（gdd-upgrade-pool-v2 §3.3）。
   */
  stacks: Record<string, number> = {};

  /** 某内容 ID 项当前叠加（0 = 未选） */
  stackOf(upgradeId: string): number {
    return this.stacks[upgradeId] ?? 0;
  }

  /** 叠加一层（clamp 到上限）；返回新值 */
  addStack(upgradeId: string, maxStack: number): number {
    const next = Math.min((this.stacks[upgradeId] ?? 0) + 1, maxStack);
    this.stacks[upgradeId] = next;
    return next;
  }

  /** 武器类强化堆叠快照（E2-S8：类强化写回 / 超武合成条件判定用） */
  classUpgradeStacks(): ClassUpgradeStacks {
    const s = emptyClassUpgradeStacks();
    s.a1 = this.stackOf('up_w_a1');
    s.a2 = this.stackOf('up_w_a2');
    s.a3 = this.stackOf('up_w_a3');
    s.b1 = this.stackOf('up_w_b1');
    s.b2 = this.stackOf('up_w_b2');
    s.b3 = this.stackOf('up_w_b3');
    s.c1 = this.stackOf('up_w_c1');
    s.c2 = this.stackOf('up_w_c2');
    s.c3 = this.stackOf('up_w_c3');
    s.d1 = this.stackOf('up_w_d1');
    s.d2 = this.stackOf('up_w_d2');
    s.d3 = this.stackOf('up_w_d3');
    return s;
  }

  /** 某类累计强化次数（超武合成条件 1：≥3） */
  classUpgradeTotalFor(cls: WeaponClass): number {
    return classUpgradeTotal(this.classUpgradeStacks(), cls);
  }

  /** 类满级判定（累计 ≥3 次，gdd-weapons-v2 §5.1） */
  isClassFullyUpgraded(cls: WeaponClass): boolean {
    return isClassFullyUpgraded(this.classUpgradeStacks(), cls);
  }

  /** 是否持有某被动钥（key_*，超武合成条件 2） */
  hasKey(keyId: string): boolean {
    return this.stackOf(keyId) >= 1;
  }
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
 * 2. TASK-39 E2（opts.forceWeaponFirst）：首级先保证 1/2 号武器之一入三选一（随机取一）。
 * 3. 加权不放回取足 3 项（未解锁 ×2 / 上次选过 ×0.5）。
 * 4. 极端兜底：候选不足 3 时用项 10 补齐（理论不发生，项 10 恒可用）。
 * random 可注入（测试用确定性 rng），默认 Math.random。
 */
export function rollThree(
  state: UpgradeState,
  random: () => number = Math.random,
  opts: RollThreeOptions = {},
): UpgradeOption[] {
  let candidates = UPGRADES.filter((item) => !isMaxed(item, state));
  if (candidates.length === 0) candidates = [UPGRADE_BY_ID[10]!];

  const pool = [...candidates];
  const picks: UpgradeOption[] = [];

  // TASK-39 E2：首级强制武器 —— 先随机取 1 或 2 号（守夜之环/月蚀脉冲）入三选一
  if (opts.forceWeaponFirst) {
    const weaponIds = [1, 2] as const;
    const available = weaponIds.filter((id) => pool.some((i) => i.id === id));
    if (available.length > 0) {
      const chosenId = available[Math.floor(random() * available.length)]!;
      const idx = pool.findIndex((i) => i.id === chosenId);
      if (idx >= 0) {
        const item = pool[idx]!;
        pool.splice(idx, 1);
        picks.push({ id: item.id, item });
      }
    }
  }

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
