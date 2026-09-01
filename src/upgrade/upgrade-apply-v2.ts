/**
 * upgrade/upgrade-apply-v2.ts —— 升级池 40 项效果写回（E4-S4/S5，gdd-upgrade-pool-v2 §3.2~3.5）
 *
 * 承接 E2-S8 泛化（upgrade-apply.ts applyUpgradeById 已覆盖类强化 12 + 钥记录），
 * 本模块补齐**全量 40 项**：全局 9 / 武器类 12 / 被动钥 7（含数值效果派生）/ 主动技强化 12。
 * 写回目标接口 UpgradeV2WriteTargets（PlayScene 装配真实实现；测试注入 fake）。
 *
 * 新武器解锁变体（E4-S5）：选择某类强化项时，若玩家未拥有该类任何武器且类内仍有
 * 未拥有武器 → 解锁 1 把随机该类未拥有武器（不应用分支强化，卡面 ★）；
 * 已拥有该类 ≥1 把 → 正常应用分支强化；已拥有该类全部 → 纯强化。
 */

import type { PlayerStats } from '@/player/player-stats';
import type { UpgradeState } from '@/upgrade/upgrade-pool';
import type { ClassUpgradeStacks } from '@/weapons/class-upgrades';
import {
  GLOBAL_UPGRADE_EFFECTS,
  DEATH_SHIELD,
  type UpgradeId,
  type WeaponId,
  type WeaponClass,
} from '@/config/balance';
import { WEAPON_CONFIGS } from '@/config/balance';

/** 被动钥数值效果派生（key_* 8 枚，gdd-upgrade-pool-v2 §3.4 + gdd-resonance §5；超武合成条件 2 由 hasKey 提供） */
export interface KeyPassiveState {
  /** key_scope 武器射程 +15% */
  rangeMult: number;
  /** key_holy 范围 +15% */
  areaRadiusMult: number;
  /** key_tome 冷却 -10% */
  cooldownMult: number;
  /** key_silver 伤害 +12% */
  damageMult: number;
  /** key_pact 召唤数 +1 */
  summonCountBonus: number;
  /**
   * key_bone 兽骨图腾：地面火（圣火十诫 R-6 审判余焰）时长 +20%（GDD R-6 FQ-3 定稿）。
   * P2-5 语义修正：旧「召唤存在 +20%」实现退役（EG-2 归档原则——消费口已拆除，
   * 仅保留本字段新语义）；消费点 = weapon-system.placeResonanceResidueAt → 余焰登记 durationMult。
   */
  groundFireDurationMult: number;
  /** key_grail 范围持续 +25% */
  areaDurationMult: number;
  /** key_nail 葬仪铁钉：重击类冷却 −8%（B3 新增钥；重击类判定/消费留 B4 共鸣批） */
  heavyCooldownMult: number;
}

export function emptyKeyPassiveState(): KeyPassiveState {
  return {
    rangeMult: 1,
    areaRadiusMult: 1,
    cooldownMult: 1,
    damageMult: 1,
    summonCountBonus: 0,
    groundFireDurationMult: 1,
    areaDurationMult: 1,
    heavyCooldownMult: 1,
  };
}

const KEY_PASSIVE_MAP: Record<string, (s: KeyPassiveState) => void> = {
  key_scope: (s) => { s.rangeMult = 1.15; },
  key_holy: (s) => { s.areaRadiusMult = 1.15; },
  key_tome: (s) => { s.cooldownMult = 0.9; },
  key_silver: (s) => { s.damageMult = 1.12; },
  key_pact: (s) => { s.summonCountBonus = 1; },
  key_bone: (s) => { s.groundFireDurationMult = 1.2; },
  key_grail: (s) => { s.areaDurationMult = 1.25; },
  key_nail: (s) => { s.heavyCooldownMult = 0.92; },
};

/** 从 UpgradeState 派生钥被动效果（PlayScene 开局 + 每次取钥后调用） */
export function deriveKeyPassives(state: UpgradeState): KeyPassiveState {
  const s = emptyKeyPassiveState();
  for (const key of Object.keys(KEY_PASSIVE_MAP) as UpgradeId[]) {
    if (state.hasKey(key)) KEY_PASSIVE_MAP[key]!(s);
  }
  return s;
}

/** v2 写回目标接口（PlayScene 装配真实实现；测试注入 fake） */
export interface UpgradeV2WriteTargets {
  stats: PlayerStats;
  weapons: {
    setMissileSplit(level: number): void;
    setMissilePierce(count: number): void;
    setCooldownMultiplier(multiplier: number): void;
    setClassUpgrade(stacks: ClassUpgradeStacks): void;
    /** 钥被动派生重算（key_* 数值效果） */
    setKeyPassives(keys: KeyPassiveState): void;
    /** E4-S5 新武器解锁 */
    unlockWeapon(weaponId: WeaponId): void;
    /** M3-DESIGN-1 up_g_2 专精疾射：目标武器 id 列表 + 独立冷却乘区（×0.88^stack，乘法叠加） */
    setFocusedCooldown(weaponIds: readonly WeaponId[], multiplier: number): void;
  };
  xp: {
    setMagnetMultiplier(multiplier: number): void;
    setMagnetRadiusBonus(bonus: number): void;
    addPickupRadiusBonus(bonus: number): void;
  };
  activeSkill: {
    /** 主动技强化分支（E4-S3，up_a_* 12 项） */
    applyActiveSkillUpgrade(upgradeId: UpgradeId): void;
  };
}

/** 武器类强化 12 分支 id（up_w_*） */
const CLASS_BRANCH_IDS: readonly UpgradeId[] = [
  'up_w_a1', 'up_w_a2', 'up_w_a3',
  'up_w_b1', 'up_w_b2', 'up_w_b3',
  'up_w_c1', 'up_w_c2', 'up_w_c3',
  'up_w_d1', 'up_w_d2', 'up_w_d3',
];

const KEY_IDS: readonly UpgradeId[] = [
  'key_scope', 'key_holy', 'key_tome', 'key_silver', 'key_pact', 'key_bone', 'key_grail', 'key_nail',
];

/** 类强化分支 → 所属类（up_w_a1 → A；'up_w_b1'[5]='b'） */
export function classOfBranch(upgradeId: UpgradeId): WeaponClass {
  return upgradeId[5]!.toUpperCase() as WeaponClass; // 'up_w_b1' → index5='b'
}

/** 单分支叠加上限 2（gdd-upgrade-pool-v2 §3.3） */
export const V2_CLASS_BRANCH_MAX = 2;

/** E4-S5 解锁上下文：当前已拥有武器 + 随机源（测试注入确定性） */
export interface UnlockContext {
  ownedWeaponIds: readonly WeaponId[];
  random: () => number;
}

/** 某类未拥有武器（可解锁候选；全拥有则空数组） */
export function unownedWeaponsOfClass(
  cls: WeaponClass,
  ownedWeaponIds: readonly WeaponId[],
): WeaponId[] {
  return (Object.keys(WEAPON_CONFIGS) as WeaponId[]).filter(
    (w) => WEAPON_CONFIGS[w].class === cls && !ownedWeaponIds.includes(w),
  );
}

/** 武器「冷却」口径（专精疾射目标选择用）：cooldown 字段优先；召唤类用 attackInterval；无则 +∞ 永不选 */
export function effectiveWeaponCooldown(w: WeaponId): number {
  const cfg = WEAPON_CONFIGS[w];
  return cfg.cooldown ?? cfg.attackInterval ?? Number.POSITIVE_INFINITY;
}

/**
 * M3-DESIGN-1 up_g_2 专精疾射：持有武器中「冷却最短的 N 把」。
 * 按 effectiveWeaponCooldown 升序取前 N（upgrade-experience-v2 §2.3 / §4.3）。
 */
export function focusedCooldownTargets(
  ownedWeaponIds: readonly WeaponId[],
  targetCount: number,
): WeaponId[] {
  return [...ownedWeaponIds]
    .sort((a, b) => effectiveWeaponCooldown(a) - effectiveWeaponCooldown(b))
    .slice(0, targetCount);
}

/**
 * 应用一项升级（40 项全量写回）。
 * 返回 { unlockVariant?: WeaponId } —— 若走了新武器解锁变体（E4-S5），返回解锁的武器 id；
 * 其余返回 {}。
 */
export function applyUpgradeByIdV2(
  state: UpgradeState,
  targets: UpgradeV2WriteTargets,
  upgradeId: UpgradeId,
  unlockCtx: UnlockContext,
): { unlockVariant?: WeaponId } {
  // ---- 全局基础 9（gdd §3.2） ----
  switch (upgradeId) {
    case 'up_g_1': {
      state.addStack(upgradeId, Number.POSITIVE_INFINITY);
      targets.stats.addDamageBonus(GLOBAL_UPGRADE_EFFECTS.DAMAGE_BONUS_PER_STACK);
      return {};
    }
    case 'up_g_2': {
      // M3-DESIGN-1 专精疾射：持有类中冷却最短的 2 把武器冷却 ×0.88（×2；独立乘区乘法叠加）
      state.addStack(upgradeId, 2);
      const focused = focusedCooldownTargets(
        unlockCtx.ownedWeaponIds,
        GLOBAL_UPGRADE_EFFECTS.FOCUSED_COOLDOWN_TARGET,
      );
      targets.weapons.setFocusedCooldown(
        focused,
        Math.pow(GLOBAL_UPGRADE_EFFECTS.FOCUSED_COOLDOWN_MULT, state.stackOf(upgradeId)),
      );
      return {};
    }
    case 'up_g_3': {
      // M3-DESIGN-1 鲜血契约：+20 HP + 受击后 5s 回复 10 HP（12s CD）（×3，转机制型）
      state.addStack(upgradeId, 3);
      targets.stats.addMaxHpBonus(GLOBAL_UPGRADE_EFFECTS.MAX_HP_BONUS_PER_STACK);
      targets.stats.setHitHeal({
        amount: GLOBAL_UPGRADE_EFFECTS.HIT_HEAL,
        window: GLOBAL_UPGRADE_EFFECTS.HIT_HEAL_WINDOW,
        cd: GLOBAL_UPGRADE_EFFECTS.HIT_HEAL_CD,
      });
      return {};
    }
    case 'up_g_4': {
      // M3-DESIGN-1 踏月而行：移速 +8% + 击杀后 2s 移速额外 +15%（×3，转机制型）
      state.addStack(upgradeId, 3);
      targets.stats.addMoveSpeedPctBonus(GLOBAL_UPGRADE_EFFECTS.MOVE_SPEED_PCT_PER_STACK);
      targets.stats.setKillSpeedBuff({
        pct: GLOBAL_UPGRADE_EFFECTS.KILL_SPEED_PCT,
        duration: GLOBAL_UPGRADE_EFFECTS.KILL_SPEED_DURATION,
      });
      return {};
    }
    case 'up_g_5': {
      state.addStack(upgradeId, 1);
      targets.stats.setLifesteal(GLOBAL_UPGRADE_EFFECTS.LIFESTEAL_PER_KILL);
      return {};
    }
    case 'up_g_6': {
      state.addStack(upgradeId, 2);
      targets.xp.setMagnetMultiplier(
        Math.pow(GLOBAL_UPGRADE_EFFECTS.MAGNET_MULT_PER_STACK, state.stackOf(upgradeId)),
      );
      return {};
    }
    case 'up_g_7': {
      state.addStack(upgradeId, 3);
      targets.stats.addDamageReduction(GLOBAL_UPGRADE_EFFECTS.DAMAGE_REDUCTION_PER_STACK);
      return {};
    }
    case 'up_g_8': {
      state.addStack(upgradeId, 1);
      // 濒死护盾为被动触发（Player.hurt 消费 DEATH_SHIELD 常量）；本处仅记录持有
      return {};
    }
    case 'up_g_9': {
      state.addStack(upgradeId, 2);
      targets.xp.addPickupRadiusBonus(GLOBAL_UPGRADE_EFFECTS.PICKUP_RADIUS_BONUS_PER_STACK);
      return {};
    }
  }

  // ---- 武器类强化 12（gdd §3.3 + E4-S5 解锁变体） ----
  if ((CLASS_BRANCH_IDS as readonly string[]).includes(upgradeId)) {
    const cls = classOfBranch(upgradeId);
    const unowned = unownedWeaponsOfClass(cls, unlockCtx.ownedWeaponIds);
    const ownsClass = unlockCtx.ownedWeaponIds.some((w) => WEAPON_CONFIGS[w].class === cls);
    // E4-S5：未拥有该类任何武器且类内仍有未拥有武器 → 解锁 1 把（不应用分支强化）
    if (!ownsClass && unowned.length > 0) {
      const pick = unowned[Math.floor(unlockCtx.random() * unowned.length)]!;
      targets.weapons.unlockWeapon(pick);
      return { unlockVariant: pick };
    }
    // 正常分支强化（含「已拥有该类全部 = 纯强化」）
    state.addStack(upgradeId, V2_CLASS_BRANCH_MAX);
    targets.weapons.setClassUpgrade(state.classUpgradeStacks());
    return {};
  }

  // ---- 被动·超武钥 7（gdd §3.4：记录持有 + 数值效果派生） ----
  if ((KEY_IDS as readonly string[]).includes(upgradeId)) {
    state.addStack(upgradeId, 1);
    targets.weapons.setKeyPassives(deriveKeyPassives(state));
    return {};
  }

  // ---- 主动技强化 12（E4-S3，up_a_*） ----
  if (upgradeId.startsWith('up_a_')) {
    state.addStack(upgradeId, 1);
    targets.activeSkill.applyActiveSkillUpgrade(upgradeId);
    return {};
  }

  return {};
}

/** 便捷：濒死护盾常量口径（供测试断言；实际触发在 Player.hurt） */
export function deathShieldConfig(): { hpFractionThreshold: number; shieldAmount: number } {
  return {
    hpFractionThreshold: DEATH_SHIELD.HP_FRACTION_THRESHOLD,
    shieldAmount: DEATH_SHIELD.SHIELD_AMOUNT,
  };
}
