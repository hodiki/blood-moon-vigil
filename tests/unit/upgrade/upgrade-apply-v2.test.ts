import { describe, it, expect } from 'vitest';
import { PlayerStats } from '@/player/player-stats';
import { UpgradeState } from '@/upgrade/upgrade-pool';
import {
  applyUpgradeByIdV2,
  deriveKeyPassives,
  unownedWeaponsOfClass,
  deathShieldConfig,
  type UpgradeV2WriteTargets,
} from '@/upgrade/upgrade-apply-v2';
import { GLOBAL_UPGRADE_EFFECTS, DEATH_SHIELD, type WeaponId } from '@/config/balance';

function makeTargets(): {
  calls: string[];
  stats: PlayerStats;
  targets: UpgradeV2WriteTargets;
} {
  const calls: string[] = [];
  const stats = new PlayerStats();
  const targets: UpgradeV2WriteTargets = {
    stats,
    weapons: {
      setMissileSplit: (n) => calls.push(`missile.split:${n}`),
      setMissilePierce: (n) => calls.push(`missile.pierce:${n}`),
      setCooldownMultiplier: (m) => calls.push(`cooldown:${m}`),
      setClassUpgrade: () => calls.push('class-upgrade'),
      setKeyPassives: (k) => calls.push(`keys:range=${k.rangeMult},dmg=${k.damageMult},summon=${k.summonCountBonus}`),
      unlockWeapon: (w) => calls.push(`unlock:${w}`),
      // M3-DESIGN-1 专精疾射：目标武器 + 独立冷却乘区
      setFocusedCooldown: (weaponIds, mult) => calls.push(`focused:${weaponIds.join(',')}:${mult}`),
    },
    xp: {
      setMagnetMultiplier: (m) => calls.push(`magnet:${m}`),
      setMagnetRadiusBonus: (b) => calls.push(`magnetBonus:${b}`),
      addPickupRadiusBonus: (b) => calls.push(`pickup:${b}`),
    },
    activeSkill: {
      applyActiveSkillUpgrade: (id) => calls.push(`active:${id}`),
    },
  };
  return { calls, stats, targets };
}

function unlockCtx(ownedWeaponIds: readonly WeaponId[] = ['wpn_a_1']) {
  return { ownedWeaponIds, random: () => 0 };
}

describe('E4-S4 全局基础 9 项写回（gdd-upgrade-pool-v2 §3.2）', () => {
  it('up_g_1 伤害强化 +15%（可重复）：倍率累加', () => {
    const { stats, targets } = makeTargets();
    const state = new UpgradeState();
    applyUpgradeByIdV2(state, targets, 'up_g_1', unlockCtx());
    applyUpgradeByIdV2(state, targets, 'up_g_1', unlockCtx());
    expect(state.stackOf('up_g_1')).toBe(2);
    expect(stats.upgradeBonusMultiplier).toBeCloseTo(0.3, 6);
  });

  it('up_g_2 专精疾射（M3-DESIGN-1）：持有类中冷却最短 2 把 ×0.88^stack（×2 满层 0.7744）', () => {
    const { calls, targets } = makeTargets();
    const state = new UpgradeState();
    // 开局持有 wpn_a_1（CD 1.2s）；加入 wpn_a_2（CD 0.45s）后最短 2 把 = a_2 + a_1
    applyUpgradeByIdV2(state, targets, 'up_g_2', unlockCtx(['wpn_a_1']));
    expect(state.stackOf('up_g_2')).toBe(1);
    expect(calls).toContain('focused:wpn_a_1:0.88');
    // 第二层：×0.88^2 = 0.7744；加入更短冷却武器后目标变为最短 2 把
    applyUpgradeByIdV2(state, targets, 'up_g_2', unlockCtx(['wpn_a_1', 'wpn_a_2']));
    expect(calls).toContain('focused:wpn_a_2,wpn_a_1:0.7744');
  });

  it('up_g_3 鲜血契约（M3-DESIGN-1）：+20 HP + 受击回血 10/5s/12s CD（×3 封顶）', () => {
    const { stats, targets } = makeTargets();
    const state = new UpgradeState();
    for (let i = 0; i < 3; i += 1) applyUpgradeByIdV2(state, targets, 'up_g_3', unlockCtx());
    expect(state.stackOf('up_g_3')).toBe(3); // ×3（原 ×5 → ×3，upgrade-experience-v2 §2.3）
    expect(stats.maxHp).toBe(100 + 20 * 3);
    // 受击回血：受击掉血至 70 → 触发 hitHeal 回 10 → 80（maybeTriggerHitHeal 由 Player.hurt 消费）
    stats.hp = 70;
    expect(stats.maybeTriggerHitHeal(10)).toBe(true);
    expect(stats.isHitHealWindowActive(10)).toBe(true);
    expect(stats.applyHitHeal()).toBe(10);
    expect(stats.hp).toBe(80);
    // 12s CD：22s 内再受击不触发；满 12s 后恢复
    expect(stats.maybeTriggerHitHeal(21)).toBe(false);
    expect(stats.maybeTriggerHitHeal(22.5)).toBe(true);
  });

  it('up_g_4 踏月而行（M3-DESIGN-1）：移速 +8% ×3 + 击杀后 2s 移速 +15%', () => {
    const { stats, targets } = makeTargets();
    const state = new UpgradeState();
    for (let i = 0; i < 3; i += 1) applyUpgradeByIdV2(state, targets, 'up_g_4', unlockCtx());
    expect(stats.moveSpeedBonusPct).toBeCloseTo(0.24, 6);
    expect(stats.effectiveMoveSpeed(0)).toBeCloseTo(235 * 1.24, 6);
    // 击杀触发：2s 内额外 +15%
    stats.triggerKillSpeedBuff(100);
    expect(stats.isKillSpeedBuffActive(100)).toBe(true);
    expect(stats.effectiveMoveSpeed(101)).toBeCloseTo(235 * (1 + 0.24 + 0.15), 6);
    // 2s 后失效
    expect(stats.isKillSpeedBuffActive(102.5)).toBe(false);
    expect(stats.effectiveMoveSpeed(102.5)).toBeCloseTo(235 * 1.24, 6);
  });

  it('up_g_5 吸血 1HP / up_g_6 磁力 ×2 / up_g_9 拾取 +40px', () => {
    const { calls, stats, targets } = makeTargets();
    const state = new UpgradeState();
    applyUpgradeByIdV2(state, targets, 'up_g_5', unlockCtx());
    expect(stats.lifestealPerKill).toBe(1);
    applyUpgradeByIdV2(state, targets, 'up_g_6', unlockCtx());
    expect(calls).toContain('magnet:2');
    applyUpgradeByIdV2(state, targets, 'up_g_9', unlockCtx());
    expect(calls).toContain('pickup:40');
  });

  it('up_g_7 减伤 +10% ×3 → 30%（上限）', () => {
    const { stats, targets } = makeTargets();
    const state = new UpgradeState();
    for (let i = 0; i < 4; i += 1) applyUpgradeByIdV2(state, targets, 'up_g_7', unlockCtx()); // 第 4 次 clamp
    expect(stats.damageReduction).toBeCloseTo(0.3, 6);
    // 减伤生效：absorbDamage 只扣 70%
    expect(stats.absorbDamage(100)).toBeCloseTo(70, 6);
  });

  it('up_g_8 濒死护盾：HP<25% 一次性 60 护盾（Player.hurt 消费口径）', () => {
    const cfg = deathShieldConfig();
    expect(cfg).toEqual({ hpFractionThreshold: DEATH_SHIELD.HP_FRACTION_THRESHOLD, shieldAmount: DEATH_SHIELD.SHIELD_AMOUNT });
    const { stats, targets } = makeTargets();
    const state = new UpgradeState();
    applyUpgradeByIdV2(state, targets, 'up_g_8', unlockCtx());
    expect(state.stackOf('up_g_8')).toBe(1);
    // 触发语义：hp 25 时触发护盾（由 Player.hurt 调 maybeTriggerDeathShield）
    stats.hp = 20;
    const triggered = stats.maybeTriggerDeathShield(0.25, 60);
    expect(triggered).toBe(true);
    expect(stats.shield).toBe(60);
    // 护盾吸收：60 伤 → 护盾挡 60 → HP 不变
    const remaining = stats.absorbDamage(60);
    expect(remaining).toBe(0);
    expect(stats.shield).toBe(0);
    // 每局 1 次：二次触发 false
    stats.hp = 10;
    expect(stats.maybeTriggerDeathShield(0.25, 60)).toBe(false);
  });
});

describe('E4-S4/E4-S5 武器类强化 + 新武器解锁变体', () => {
  it('持有类：正常分支强化（类堆叠 + 写回 setClassUpgrade）', () => {
    const { calls, targets } = makeTargets();
    const state = new UpgradeState();
    applyUpgradeByIdV2(state, targets, 'up_w_a1', unlockCtx(['wpn_a_1']));
    expect(state.stackOf('up_w_a1')).toBe(1);
    expect(calls).toContain('class-upgrade');
  });

  it('未持有类：解锁 1 把随机该类未拥有武器（不应用分支强化，卡面 ★）', () => {
    const { calls, targets } = makeTargets();
    const state = new UpgradeState();
    const result = applyUpgradeByIdV2(state, targets, 'up_w_b1', unlockCtx(['wpn_a_1']));
    expect(result.unlockVariant).toBeDefined();
    expect((result.unlockVariant as string).startsWith('wpn_b_')).toBe(true); // 解锁 B 类武器
    expect(calls.some((c) => c.startsWith('unlock:wpn_b_'))).toBe(true);
    expect(state.stackOf('up_w_b1')).toBe(0); // 不应用分支强化
    // 解锁后持有 B 类 → 下次同卡纯强化
    applyUpgradeByIdV2(state, targets, 'up_w_b1', unlockCtx(['wpn_a_1', result.unlockVariant!]));
    expect(state.stackOf('up_w_b1')).toBe(1);
  });

  it('unownedWeaponsOfClass：B 类 3 把（b1/b2/b3）', () => {
    expect(unownedWeaponsOfClass('B', ['wpn_a_1'])).toEqual(['wpn_b_1', 'wpn_b_2', 'wpn_b_3']);
    expect(unownedWeaponsOfClass('B', ['wpn_a_1', 'wpn_b_2'])).toEqual(['wpn_b_1', 'wpn_b_3']);
    expect(unownedWeaponsOfClass('B', ['wpn_b_1', 'wpn_b_2', 'wpn_b_3'])).toEqual([]);
  });
});

describe('E4-S4 被动钥 7（记录 + 数值效果派生）', () => {
  it('取钥记录持有 + setKeyPassives 派生（key_scope 射程 1.15 / key_silver 伤害 1.12 / key_pact 召唤 +1）', () => {
    const { calls, targets } = makeTargets();
    const state = new UpgradeState();
    applyUpgradeByIdV2(state, targets, 'key_scope', unlockCtx());
    expect(state.hasKey('key_scope')).toBe(true);
    applyUpgradeByIdV2(state, targets, 'key_silver', unlockCtx());
    applyUpgradeByIdV2(state, targets, 'key_pact', unlockCtx());
    expect(calls).toContain('keys:range=1.15,dmg=1.12,summon=1');
    const derived = deriveKeyPassives(state);
    expect(derived.rangeMult).toBe(1.15);
    expect(derived.damageMult).toBe(1.12);
    expect(derived.summonCountBonus).toBe(1);
    expect(derived.cooldownMult).toBe(1); // 未取 key_tome
  });

  it('key_tome 冷却 -10% / key_bone 地面火时长 +20%（P2-5）/ key_grail 持续 +25%', () => {
    const state = new UpgradeState();
    state.addStack('key_tome', 1);
    state.addStack('key_bone', 1);
    state.addStack('key_grail', 1);
    const d = deriveKeyPassives(state);
    expect(d.cooldownMult).toBe(0.9);
    expect(d.groundFireDurationMult).toBe(1.2);
    expect(d.areaDurationMult).toBe(1.25);
  });
});

describe('E4-S3 主动技强化 12 分支写回（up_a_*）', () => {
  it('up_a_effect_edmund → activeSkill.applyActiveSkillUpgrade 调用', () => {
    const { calls, targets } = makeTargets();
    const state = new UpgradeState();
    applyUpgradeByIdV2(state, targets, 'up_a_effect_edmund', unlockCtx());
    expect(calls).toContain('active:up_a_effect_edmund');
    expect(state.stackOf('up_a_effect_edmund')).toBe(1);
  });

  it('GLOBAL_UPGRADE_EFFECTS 常量口径（与 GDD §3.2 表 + M3-DESIGN-1 数值方向化逐项一致）', () => {
    expect(GLOBAL_UPGRADE_EFFECTS.DAMAGE_BONUS_PER_STACK).toBe(0.15);
    // up_g_2 专精疾射（M3-DESIGN-1：冷却最短 2 把 ×0.88）
    expect(GLOBAL_UPGRADE_EFFECTS.FOCUSED_COOLDOWN_TARGET).toBe(2);
    expect(GLOBAL_UPGRADE_EFFECTS.FOCUSED_COOLDOWN_MULT).toBe(0.88);
    // up_g_3 鲜血契约（M3-DESIGN-1：+20 HP + 受击回血 10/5s/12s）
    expect(GLOBAL_UPGRADE_EFFECTS.MAX_HP_BONUS_PER_STACK).toBe(20);
    expect(GLOBAL_UPGRADE_EFFECTS.HIT_HEAL).toBe(10);
    expect(GLOBAL_UPGRADE_EFFECTS.HIT_HEAL_WINDOW).toBe(5);
    expect(GLOBAL_UPGRADE_EFFECTS.HIT_HEAL_CD).toBe(12);
    // up_g_4 踏月而行（M3-DESIGN-1：+8% + 击杀 2s +15%）
    expect(GLOBAL_UPGRADE_EFFECTS.MOVE_SPEED_PCT_PER_STACK).toBe(0.08);
    expect(GLOBAL_UPGRADE_EFFECTS.KILL_SPEED_PCT).toBe(0.15);
    expect(GLOBAL_UPGRADE_EFFECTS.KILL_SPEED_DURATION).toBe(2);
    expect(GLOBAL_UPGRADE_EFFECTS.LIFESTEAL_PER_KILL).toBe(1);
    expect(GLOBAL_UPGRADE_EFFECTS.MAGNET_MULT_PER_STACK).toBe(2);
    expect(GLOBAL_UPGRADE_EFFECTS.DAMAGE_REDUCTION_PER_STACK).toBe(0.1);
    expect(GLOBAL_UPGRADE_EFFECTS.PICKUP_RADIUS_BONUS_PER_STACK).toBe(40);
  });
});
