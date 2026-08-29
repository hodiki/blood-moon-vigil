/**
 * upgrade/upgrade-apply-v3.ts —— 升级池 v3 效果写回（B3，gdd-upgrade-pool-v3 §4）
 *
 * 复用 v2 写回骨架（全局 9 / 钥 / 类强化语义不变），v3 新增：
 * - 质变卡（mc_*）→ exclusiveBehaviors.applyMutationCard（B2 预留接口，顺序解锁由管线保证）；
 * - 主动技强化 8（up_d_*）→ targets.derivative.applyDerivativeUpgrade（形态级效果登记，
 *   运行时消费随衍生技装配收拢，本批写回 UpgradeState + 回调）；
 * - 通用通武强化 2（up_w_g1/g2）→ setCommonEnhancement（射程/弹速 +10% / 范围/持续 +10%，×2）。
 * 旧 up_a_* 12 项（v2 主动技强化）随 R2-6 退役：v3 池不产出，apply 不再支持（写回归档原则见 _archived）。
 */

import type { UpgradeId, WeaponId } from '@/config/balance';
import { MUTATION_CARDS } from '@/config/balance';
import type { UpgradeV2WriteTargets, KeyPassiveState } from '@/upgrade/upgrade-apply-v2';
import { deriveKeyPassives } from '@/upgrade/upgrade-apply-v2';
import type { UnlockContext } from '@/upgrade/upgrade-apply-v2';
import type { UpgradeState } from '@/upgrade/upgrade-pool';
import { applyUpgradeByIdV2 } from '@/upgrade/upgrade-apply-v2';
import { GLOBAL_UPGRADE_EFFECTS } from '@/config/balance';

/** v3 写回目标（v2 + 质变卡/衍生技强化/通用强化扩展） */
export interface UpgradeV3WriteTargets extends UpgradeV2WriteTargets {
  exclusive: {
    /** 质变卡 machine 参数写回（B2 ExclusiveWeaponBehavior.applyMutationCard） */
    applyMutationCard(machine: Record<string, number>): void;
  };
  derivative: {
    /** 衍生技强化卡写回（up_d_* 质变级效果；形态消费随装配收拢） */
    applyDerivativeUpgrade(upgradeId: UpgradeId): void;
  };
  weapons_extra: {
    /** 通用通武强化独立乘区（up_w_g1 射程/弹速 +10%×stack / up_w_g2 范围/持续 +10%×stack） */
    setCommonEnhancement(e: { rangeMult: number; areaMult: number }): void;
  };
}

/** 质变卡 id → machine 参数（MUTATION_CARDS 唯一来源） */
function mutationMachine(upgradeId: UpgradeId): Record<string, number> | null {
  const card = MUTATION_CARDS.find((c) => c.id === upgradeId);
  return card ? { ...card.machine } : null;
}

/** 通用强化堆叠乘区（×1.1^stack） */
function commonEnhancementFor(state: UpgradeState): { rangeMult: number; areaMult: number } {
  const g1 = state.stackOf('up_w_g1');
  const g2 = state.stackOf('up_w_g2');
  return { rangeMult: Math.pow(1.1, g1), areaMult: Math.pow(1.1, g2) };
}

/**
 * 应用一项 v3 升级（37 项定义全量写回）。
 * - 全局/钥/类强化/解锁变体 → 复用 v2 写回（语义不变，§4.1 继承口径）；
 * - 质变卡/衍生技强化/通用强化 → v3 扩展目标。
 * 返回 { unlockVariant?: WeaponId }（解锁变体透传，同 v2）。
 */
export function applyUpgradeByIdV3(
  state: UpgradeState,
  targets: UpgradeV3WriteTargets,
  upgradeId: UpgradeId,
  unlockCtx: UnlockContext,
): { unlockVariant?: WeaponId } {
  // ---- 质变卡（§4.2；顺序解锁由 mutation-pipeline 保证，本函数信任管线） ----
  if (upgradeId.startsWith('mc_')) {
    const machine = mutationMachine(upgradeId);
    if (machine) {
      state.addStack(upgradeId, 1);
      targets.exclusive.applyMutationCard(machine);
    }
    return {};
  }

  // ---- 主动技强化 8（§4.5 单局 1 张） ----
  if (upgradeId.startsWith('up_d_')) {
    state.addStack(upgradeId, 1);
    targets.derivative.applyDerivativeUpgrade(upgradeId);
    return {};
  }

  // ---- 通用通武强化 2（§4.4 通用行；独立乘区） ----
  if (upgradeId === 'up_w_g1' || upgradeId === 'up_w_g2') {
    state.addStack(upgradeId, 2);
    targets.weapons_extra.setCommonEnhancement(commonEnhancementFor(state));
    return {};
  }

  // ---- 葬仪铁钉（key_nail）：钥数值派生 + 通用强化乘区折叠（保持乘区一致性） ----
  if (upgradeId === 'key_nail') {
    state.addStack(upgradeId, 1);
    const keys = deriveKeyPassives(state);
    const common = commonEnhancementFor(state);
    targets.weapons.setKeyPassives({
      ...keys,
      rangeMult: keys.rangeMult * common.rangeMult,
      areaRadiusMult: keys.areaRadiusMult * common.areaMult,
    });
    return {};
  }

  // ---- 其余（全局 9 / 通武强化 8 / 钥 7）→ v2 写回语义不变（继承口径） ----
  return applyUpgradeByIdV2(state, targets, upgradeId, unlockCtx);
}

/** 通用强化常量（单层 +10%，§4.4 锚点） */
export const COMMON_ENHANCEMENT_PER_STACK = 1.1;

/** GLOBAL_UPGRADE_EFFECTS 再导出（apply 链消费方免双 import） */
export { GLOBAL_UPGRADE_EFFECTS };
export type { KeyPassiveState };
