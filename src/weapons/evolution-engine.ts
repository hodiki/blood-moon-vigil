/**
 * weapons/evolution-engine.ts —— 超武合成规则引擎（E2-S6 / gdd-weapons-v2 §5.1）
 *
 * 超武合成规则（gdd-weapons-v2 §5.1，纯函数可单测）：
 * - 条件 1：武器所属类累计强化 ≥2 次（任意分支组合，单分支上限 2 次；「类成型」判定，
 *   M3-DESIGN-1 进化前置：阈值 3→2）
 * - 条件 2：持有对应被动钥（weapon_evolution { wpnId, keyId, evoId }）
 * - 触发：满足条件后，下次升级三选一**必占一席**（保底 P1，upgrade-experience-v2 §2.1）；权重 ×5
 * - 效果：超武 = 行为质变（非纯数值），不可逆；超武不再吃类强化（已质变，防再膨胀）
 * - 权重：进化卡满足条件时自动加入可选池（权重 ×5，供第二张/多进化进剩下 2 席）
 * - 边缘：进化瞬间清空该武器旧弹体；新旧武器行为切换原子（无中间态）
 *
 * 边界（E2-S6 验收）：无钥不出现 / 类强化不足不出现 / 满足后必入池 权重×5（+ P1 必占一席）；
 * 进化原子性；超武不再吃类强化。
 */

import { EVOLUTIONS, UPGRADE_POOL_RULES, type EvoId, type UpgradeId, type WeaponId } from '@/config/balance';
import { CLASS_UPGRADE_EVOLUTION_THRESHOLD } from '@/weapons/class-upgrades';

/** 类成型阈值：该类累计强化 ≥2 次（gdd-weapons-v2 §5.1 条件 1；M3-DESIGN-1 阈值 3→2） */
export const EVOLUTION_MIN_CLASS_STACKS = CLASS_UPGRADE_EVOLUTION_THRESHOLD;

/** 进化卡权重 ×5（gdd-weapons-v2 §5.1 / upgrade-pool-v2 §3.6.3；M3-DESIGN-1 ×3→×5） */
export function evolutionCardWeight(): number {
  return UPGRADE_POOL_RULES.WEIGHT_EVOLUTION;
}

/** 按主武器查进化映射（无则 null） */
export function findEvolutionForWeapon(weaponId: WeaponId): (typeof EVOLUTIONS)[number] | null {
  return EVOLUTIONS.find((e) => e.wpnId === weaponId) ?? null;
}

/** 按被动钥查进化映射（无则 null） */
export function findEvolutionForKey(keyId: UpgradeId): (typeof EVOLUTIONS)[number] | null {
  return EVOLUTIONS.find((e) => e.keyId === keyId) ?? null;
}

/** 合成条件判定输入（由 UpgradeState 提供：类累计 + 持钥） */
export interface EvolutionConditionInput {
  /** 该武器所属类累计强化次数 */
  classStacks: number;
  /** 是否持有对应被动钥 */
  hasKey: boolean;
}

export type EvolutionEligibilityReason =
  | 'eligible'          // 满足：类成型 2 + 持钥 → 进化卡入池（保底 P1 必占一席）
  | 'no-class-stacks'   // 类强化不足（<2）：不出现
  | 'no-key'            // 无钥：不出现
  | 'no-evolution';     // 该武器无进化（7 把无超武武器）

export interface EvolutionEligibility {
  eligible: boolean;
  reason: EvolutionEligibilityReason;
  /** 满足时进化卡权重（×5；不满足时无意义） */
  weight: number;
}

/** 合成条件判定（gdd-weapons-v2 §5.1；边界：不满足不出现） */
export function evolutionEligibility(input: EvolutionConditionInput): EvolutionEligibility {
  if (input.classStacks < EVOLUTION_MIN_CLASS_STACKS) {
    return { eligible: false, reason: 'no-class-stacks', weight: 0 };
  }
  if (!input.hasKey) {
    return { eligible: false, reason: 'no-key', weight: 0 };
  }
  return { eligible: true, reason: 'eligible', weight: evolutionCardWeight() };
}

/**
 * 单武器合成条件判定（按主武器；7 把无超武武器返回 no-evolution）。
 * state 提供 classStacks（该类累计）与 keyOf(weaponId)（是否持对应钥）。
 */
export function eligibilityForWeapon(
  weaponId: WeaponId,
  state: { classStacksFor(weaponId: WeaponId): number; hasKeyFor(weaponId: WeaponId): boolean },
): EvolutionEligibility {
  const evo = findEvolutionForWeapon(weaponId);
  if (!evo) return { eligible: false, reason: 'no-evolution', weight: 0 };
  return evolutionEligibility({
    classStacks: state.classStacksFor(weaponId),
    hasKey: state.hasKeyFor(weaponId),
  });
}

/** 原子切换结果（进化瞬间清空旧弹体；不可逆） */
export interface EvolutionResult {
  from: WeaponId;
  to: EvoId;
  /** 进化瞬间清空该武器旧弹体（gdd-weapons-v2 §5.1 边缘） */
  clearedProjectiles: boolean;
  /** 超武不再吃类强化（已质变，防再膨胀） */
  ignoresClassUpgrades: boolean;
}

/** 生成原子切换结果（调用方负责：清旧弹体 → 替换行为 → 标记不可逆） */
export function createEvolutionResult(from: WeaponId, to: EvoId): EvolutionResult {
  return { from, to, clearedProjectiles: true, ignoresClassUpgrades: true };
}

/** 已进化武器集（不可逆：进化后原武器不可再进化/回退） */
export class EvolutionState {
  /** weaponId → evoId（已进化的源武器） */
  private readonly evolved = new Map<WeaponId, EvoId>();

  isEvolved(weaponId: WeaponId): boolean {
    return this.evolved.has(weaponId);
  }

  evoOf(weaponId: WeaponId): EvoId | undefined {
    return this.evolved.get(weaponId);
  }

  /** 提交进化（不可逆；重复提交幂等返回 false） */
  commit(weaponId: WeaponId, evoId: EvoId): boolean {
    if (this.evolved.has(weaponId)) return false;
    this.evolved.set(weaponId, evoId);
    return true;
  }
}
