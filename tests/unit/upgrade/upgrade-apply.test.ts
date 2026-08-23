import { describe, it, expect } from 'vitest';
import { PlayerStats } from '@/player/player-stats';
import { UpgradeState } from '@/upgrade/upgrade-pool';
import {
  applyUpgrade,
  applyUpgradeById,
  splitSubDamageMultiplier,
  shockwaveRadiusMultiplierForStacks,
  magnetMultiplierForStacks,
  cooldownMultiplierForStacks,
  type UpgradeWriteTargets,
} from '@/upgrade/upgrade-apply';

function makeTargets(): { calls: string[]; stats: PlayerStats; targets: UpgradeWriteTargets } {
  const calls: string[] = [];
  const stats = new PlayerStats();
  const targets: UpgradeWriteTargets = {
    stats,
    orbit: {
      unlock: () => calls.push('orbit.unlock'),
      addOrb: () => calls.push('orbit.addOrb'),
    },
    shockwave: {
      unlock: () => calls.push('shockwave.unlock'),
      setRadiusMultiplier: (m) => calls.push(`shockwave.radius:${m}`),
      setKnockback: (b) => calls.push(`shockwave.knockback:${b}`),
    },
    weapons: {
      setMissileSplit: (n) => calls.push(`missile.split:${n}`),
      setMissilePierce: (n) => calls.push(`missile.pierce:${n}`),
      setCooldownMultiplier: (m) => calls.push(`cooldown:${m}`),
      setClassUpgrade: (s) => calls.push(`class-upgrade:a1=${s.a1},b1=${s.b1},c1=${s.c1},d1=${s.d1}`),
    },
    xp: { setMagnetMultiplier: (m) => calls.push(`xp.magnet:${m}`) },
  };
  return { calls, stats, targets };
}

describe('E3-S5 升级写回（upgrade-pool §③ 12 项逐一生效）', () => {
  it('1/2 号：解锁「守夜之环」「月蚀脉冲」', () => {
    const { calls, targets } = makeTargets();
    const state = new UpgradeState();
    applyUpgrade(state, targets, 1);
    applyUpgrade(state, targets, 2);
    expect(state.orbitUnlocked).toBe(true);
    expect(state.shockwaveUnlocked).toBe(true);
    expect(calls).toContain('orbit.unlock');
    expect(calls).toContain('shockwave.unlock');
  });

  it('3 号：飞弹分裂 ×2 → 次级弹数 1→2（×0.6 伤）', () => {
    const { calls, targets } = makeTargets();
    const state = new UpgradeState();
    applyUpgrade(state, targets, 3);
    applyUpgrade(state, targets, 3);
    expect(state.missileSplit).toBe(2);
    expect(calls).toContain('missile.split:1');
    expect(calls).toContain('missile.split:2');
    expect(splitSubDamageMultiplier()).toBe(0.6);
  });

  it('4 号：护体球 +1（≤6 颗，upgrade-apply 只转发 addOrb；上限由 OrbitWeapon 保证）', () => {
    const { calls, targets } = makeTargets();
    const state = new UpgradeState();
    applyUpgrade(state, targets, 4);
    applyUpgrade(state, targets, 4);
    applyUpgrade(state, targets, 4);
    expect(state.orbBonus).toBe(3);
    expect(calls.filter((c) => c === 'orbit.addOrb')).toHaveLength(3);
  });

  it('5 号：冲击波范围 +50% ×2 → 半径倍率 1.5→2.0（280→420→560px）', () => {
    const { calls, targets } = makeTargets();
    const state = new UpgradeState();
    applyUpgrade(state, targets, 5);
    expect(calls).toContain('shockwave.radius:1.5');
    expect(shockwaveRadiusMultiplierForStacks(1)).toBe(1.5);
    applyUpgrade(state, targets, 5);
    expect(calls).toContain('shockwave.radius:2');
    expect(shockwaveRadiusMultiplierForStacks(2)).toBe(2);
  });

  it('6 号：飞弹穿透 1', () => {
    const { calls, targets } = makeTargets();
    const state = new UpgradeState();
    applyUpgrade(state, targets, 6);
    expect(state.missilePierce).toBe(1);
    expect(calls).toContain('missile.pierce:1');
  });

  it('7 号：冲击波击退 80px', () => {
    const { calls, targets } = makeTargets();
    const state = new UpgradeState();
    applyUpgrade(state, targets, 7);
    expect(state.shockwaveKnockback).toBe(true);
    expect(calls).toContain('shockwave.knockback:true');
  });

  it('8 号：吸血 1HP/击杀（击杀回复，upgrade-pool 第 8 项）', () => {
    const { stats, targets } = makeTargets();
    const state = new UpgradeState();
    applyUpgrade(state, targets, 8);
    expect(state.lifesteal).toBe(true);
    expect(stats.lifestealPerKill).toBe(1);
    stats.hp = 50;
    stats.applyLifesteal();
    expect(stats.hp).toBe(51);
  });

  it('9 号：经验磁力 +100% ×2 → 磁吸半径 ×2→×3（80→160→240px）', () => {
    const { calls, targets } = makeTargets();
    const state = new UpgradeState();
    applyUpgrade(state, targets, 9);
    expect(calls).toContain('xp.magnet:2');
    applyUpgrade(state, targets, 9);
    expect(calls).toContain('xp.magnet:3');
    expect(magnetMultiplierForStacks(1)).toBe(2);
    expect(magnetMultiplierForStacks(2)).toBe(3);
  });

  it('10 号：伤害强化 +15%（可重复）→ 总倍率累加', () => {
    const { stats, targets } = makeTargets();
    const state = new UpgradeState();
    applyUpgrade(state, targets, 10);
    applyUpgrade(state, targets, 10);
    expect(state.damageBonusStacks).toBe(2);
    expect(stats.totalDamageMultiplier).toBeCloseTo(1.3, 6); // 1.0 + 0.15×2
  });

  it('11 号：冷却缩减 -8% ×3 → 0.92→0.8464→0.778688', () => {
    const { calls, targets } = makeTargets();
    const state = new UpgradeState();
    applyUpgrade(state, targets, 11);
    applyUpgrade(state, targets, 11);
    applyUpgrade(state, targets, 11);
    expect(state.cooldownReductionStacks).toBe(3);
    expect(calls).toContain('cooldown:0.8464');
    expect(calls).toContain('cooldown:0.778688');
    expect(cooldownMultiplierForStacks(3)).toBeCloseTo(0.778688, 6);
  });

  it('12 号：最大生命 +20 ×5 → 200（同时回复等量 HP）', () => {
    const { stats, targets } = makeTargets();
    const state = new UpgradeState();
    stats.hp = 30;
    for (let i = 0; i < 5; i += 1) applyUpgrade(state, targets, 12);
    expect(state.maxHpBonusStacks).toBe(5);
    expect(stats.maxHp).toBe(200);
    expect(stats.hp).toBe(130); // 30 + 20×5
  });
});

describe('总伤害倍率聚合（design-review-e2 #2 / upgrade-pool §③）', () => {
  it('Lv30（29 次升级）+ 2 次伤害强化 = 1 + 0.04×29 + 0.15×2 = 2.46（战力核算）', () => {
    const stats = new PlayerStats();
    for (let i = 0; i < 29; i += 1) stats.levelUp();
    expect(stats.damageMultiplier).toBeCloseTo(2.16, 6); // 等级成长部分 = baseMultiplier
    stats.addDamageBonus(0.15);
    stats.addDamageBonus(0.15);
    expect(stats.totalDamageMultiplier).toBeCloseTo(2.46, 6);
  });

  it('加法叠加防指数膨胀：0.15×2 = 0.30 而非 (1.15)²', () => {
    const stats = new PlayerStats();
    stats.addDamageBonus(0.15);
    stats.addDamageBonus(0.15);
    expect(stats.upgradeBonusMultiplier).toBeCloseTo(0.3, 6);
    expect(stats.totalDamageMultiplier).toBeCloseTo(1.3, 6);
  });
});

describe('E2-S8 武器类强化 12 分支写回（up_w_a1~d3，gdd-upgrade-pool-v2 §3.3）', () => {
  it('A1 弹幕分裂：叠加 2 层（≤2）；写回 setClassUpgrade 含 a1 派生', () => {
    const { calls, targets } = makeTargets();
    const state = new UpgradeState();
    applyUpgradeById(state, targets, 'up_w_a1');
    applyUpgradeById(state, targets, 'up_w_a1');
    expect(state.stackOf('up_w_a1')).toBe(2);
    expect(state.classUpgradeStacks().a1).toBe(2);
    expect(calls).toContain('class-upgrade:a1=1,b1=0,c1=0,d1=0');
    expect(calls).toContain('class-upgrade:a1=2,b1=0,c1=0,d1=0');
  });

  it('A2/A3/B/C/D 分支各自独立叠加；单分支上限 2（第 3 次不再叠加）', () => {
    const { targets } = makeTargets();
    const state = new UpgradeState();
    applyUpgradeById(state, targets, 'up_w_a2');
    applyUpgradeById(state, targets, 'up_w_a2');
    applyUpgradeById(state, targets, 'up_w_a2'); // 超限：clamp 2
    expect(state.stackOf('up_w_a2')).toBe(2);
    const stacks = state.classUpgradeStacks();
    expect(stacks.a2).toBe(2);
    expect(stacks.a1).toBe(0); // 互不影响
  });

  it('12 分支覆盖：A/B/C/D 各 3 分支写入正确', () => {
    const { targets } = makeTargets();
    const state = new UpgradeState();
    const ids = ['up_w_a1', 'up_w_a2', 'up_w_a3', 'up_w_b1', 'up_w_b2', 'up_w_b3', 'up_w_c1', 'up_w_c2', 'up_w_c3', 'up_w_d1', 'up_w_d2', 'up_w_d3'] as const;
    for (const id of ids) applyUpgradeById(state, targets, id);
    const s = state.classUpgradeStacks();
    expect(s.a1).toBe(1); expect(s.a2).toBe(1); expect(s.a3).toBe(1);
    expect(s.b1).toBe(1); expect(s.b2).toBe(1); expect(s.b3).toBe(1);
    expect(s.c1).toBe(1); expect(s.c2).toBe(1); expect(s.c3).toBe(1);
    expect(s.d1).toBe(1); expect(s.d2).toBe(1); expect(s.d3).toBe(1);
  });

  it('类成型判定（M3-DESIGN-1 阈值 3→2）：A 类 2 次（a1×2）→ isClassFullyUpgraded(A) = true；1 次不满足', () => {
    const { targets } = makeTargets();
    const state = new UpgradeState();
    applyUpgradeById(state, targets, 'up_w_a1');
    expect(state.classUpgradeTotalFor('A')).toBe(1);
    expect(state.isClassFullyUpgraded('A')).toBe(false); // 1 < 2
    applyUpgradeById(state, targets, 'up_w_a1');
    expect(state.classUpgradeTotalFor('A')).toBe(2);
    expect(state.isClassFullyUpgraded('A')).toBe(true); // ≥2（超武合成条件 1；M3-DESIGN-1 进化前置）
    applyUpgradeById(state, targets, 'up_w_a3');
    expect(state.classUpgradeTotalFor('A')).toBe(3);
    expect(state.isClassFullyUpgraded('A')).toBe(true); // 3 ≥ 2 仍满足
  });

  it('被动钥记录持有（key_*，叠加上限 1）；hasKey 驱动超武合成条件 2', () => {
    const { targets } = makeTargets();
    const state = new UpgradeState();
    applyUpgradeById(state, targets, 'key_scope');
    expect(state.hasKey('key_scope')).toBe(true);
    expect(state.stackOf('key_scope')).toBe(1);
    expect(state.hasKey('key_holy')).toBe(false); // 未取
  });
});
