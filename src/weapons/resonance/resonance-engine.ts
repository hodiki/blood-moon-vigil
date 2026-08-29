/**
 * weapons/resonance/resonance-engine.ts —— 共鸣引擎（B4-W1，gdd-resonance §3.1/§⑦）
 *
 * 双条件门控：持配对专武（ctx.exclusiveId）∧ 持对应共鸣钥（UpgradeState.hasKey）→ 可共鸣；
 * 半满足不触发（§⑦-1：持钥未持专武 = 普通被动；持专武未持钥 = 普通通武 + 「可共鸣」灰态）。
 * 共鸣达成 = 原子形态切换（复用 evolve 骨架语义：clearAll 配对通武 → 同位标记 → 不可逆 commit）；
 * 切换瞬间在途弹体/伤害段沿用旧形态结算完毕（§⑦-3，装配层 clearAll 语义承担）。
 */

import {
  RESONANCE_PAIRS,
  RESONANCE_RULES,
  resonancePairByExclusive,
  type ResonancePairConfig,
  type ResonancePairId,
} from '@/config/balance';
import type { ExclusiveWeaponId, WeaponId } from '@/config/balance';

/** 共鸣达成状态（每局重置；不可逆） */
export class ResonanceState {
  private achieved = new Set<ResonancePairId>();

  /** 该对是否已共鸣 */
  isAchieved(id: ResonancePairId): boolean {
    return this.achieved.has(id);
  }

  /** 按专武查询（装配层/遥测消费） */
  isAchievedForExclusive(exclusiveId: ExclusiveWeaponId): boolean {
    const pair = resonancePairByExclusive(exclusiveId);
    return !!pair && this.achieved.has(pair.id);
  }

  /** 已达成对 id 列表（遥测：共鸣达成率） */
  achievedIds(): ResonancePairId[] {
    return [...this.achieved];
  }

  /** 原子 commit（不可逆；重复 commit 返回 false——§⑦-3 取得即保留） */
  commit(id: ResonancePairId): boolean {
    if (this.achieved.has(id)) return false;
    this.achieved.add(id);
    return true;
  }

  /** 局重置 */
  reset(): void {
    this.achieved.clear();
  }
}

/** 双条件判定入参（PlayScene/装配层装配；测试注入） */
export interface ResonanceGateContext {
  /** 当前配对专武（开局 2 选 1 结果） */
  exclusiveId: ExclusiveWeaponId;
  /** 钥持有查询（UpgradeState.hasKey） */
  hasKey: (keyId: string) => boolean;
}

/**
 * 共鸣门控（纯函数）：
 * - achieved → 'achieved'（已共鸣，不重复）
 * - 持专武 ∧ 持钥 → 'ready'（可共鸣——×5 权重与 P2 席位接管）
 * - 持专武 ∧ 未持钥 → 'awaiting-key'（普通通武 + 可共鸣灰态徽记）
 * - 未持专武 → 'unpaired'（钥为普通被动；通武普通形态）
 */
export type ResonanceGate = 'achieved' | 'ready' | 'awaiting-key' | 'unpaired';

export function resonanceGate(pair: ResonancePairConfig | undefined, achieved: boolean, ctx: ResonanceGateContext): ResonanceGate {
  if (!pair) return 'unpaired';
  if (ctx.exclusiveId !== pair.exclusiveId) return 'unpaired';
  if (achieved) return 'achieved';
  if (ctx.hasKey(pair.keyId)) return 'ready';
  return 'awaiting-key';
}

/**
 * 共鸣预告徽记数据接口（B4-W3 收口；B6 UI 渲染消费）：
 * 'none' = 非配对/未持专武；'ready-highlight' = 已持专武徽记高亮（卡面）；
 * 'awaiting-key' = 可共鸣灰态（§⑦-1 预告不达成可视化）；'achieved' = 共鸣形态条目。
 */
export type ResonanceBadgeState = 'none' | 'ready-highlight' | 'awaiting-key' | 'achieved';

export function resonanceBadgeState(exclusiveId: ExclusiveWeaponId, hasKey: (keyId: string) => boolean, achieved: boolean): ResonanceBadgeState {
  const pair = resonancePairByExclusive(exclusiveId);
  if (!pair) return 'none';
  if (achieved) return 'achieved';
  return hasKey(pair.keyId) ? 'ready-highlight' : 'awaiting-key';
}

/**
 * 共鸣达成提交（引擎层原子语义）：
 * 1. 门控必须 'ready'（半满足拒绝）；
 * 2. commit（不可逆）；
 * 3. 返回配对配置（调用方执行原子 clearAll 配对通武 + 形态标记）。
 * 失败返回 null（半满足/已达成）。
 */
export function commitResonance(state: ResonanceState, ctx: ResonanceGateContext): ResonancePairConfig | null {
  const pair = resonancePairByExclusive(ctx.exclusiveId);
  if (!pair) return null;
  const gate = resonanceGate(pair, state.isAchieved(pair.id), ctx);
  if (gate !== 'ready') return null; // 半满足/已达成拒绝（§⑦-1/§⑦-3）
  if (!state.commit(pair.id)) return null;
  return pair;
}

/** P2 席位权重：共鸣条件达成（持专武、只差该钥 = awaiting-key）时该钥权重 ×5（§3.1 前置锚，待模拟） */
export function resonanceReadyKeyWeight(pair: ResonancePairConfig | undefined, ctx: ResonanceGateContext, baseWeight: number): number {
  if (!pair) return baseWeight;
  return resonanceGate(pair, false, ctx) === 'awaiting-key' ? baseWeight * RESONANCE_RULES.WEIGHT_READY : baseWeight;
}

// ============================================================================
// W3 · 葬仪铁钉消费（key_nail 重击类冷却 ×0.92；gdd-resonance §5）
// ============================================================================

/** 重击类判定阈值：攻击/触发间隔 ≥2.0s（GDD §5：巨斧挥击、锁链挥击、十字投掷等） */
export const HEAVY_WEAPON_THRESHOLD_SECONDS = 2.0;

/** 重击类判定（纯函数；锚点阈值常量在 balance.upgrade-v3 KEY_NAIL_HEAVY_THRESHOLD_SECONDS） */
export function isHeavyWeaponInterval(intervalSeconds: number): boolean {
  return intervalSeconds >= HEAVY_WEAPON_THRESHOLD_SECONDS;
}

/** 铁钉冷却乘区：重击类 ×0.92（keys.heavyCooldownMult）；非重击类 ×1 */
export function heavyCooldownMult(intervalSeconds: number, keys: { heavyCooldownMult: number } | undefined): number {
  if (!keys || !isHeavyWeaponInterval(intervalSeconds)) return 1;
  return keys.heavyCooldownMult;
}

/** 配对通武 id（WeaponSystem.tryResonance 的 clearAll 目标查询） */
export function resonanceTargetWeapon(exclusiveId: ExclusiveWeaponId): WeaponId | null {
  return resonancePairByExclusive(exclusiveId)?.commonWeaponId ?? null;
}

/** 全部对（测试/图鉴遍历） */
export function allResonancePairs(): readonly ResonancePairConfig[] {
  return RESONANCE_PAIRS;
}
