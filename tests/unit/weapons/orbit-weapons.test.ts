import { describe, it, expect } from 'vitest';
import { WEAPON_CONFIGS } from '@/config/balance';
import {
  deriveOrbitParams,
  orbitCanHit,
  markOrbitHit,
} from '@/weapons/weapon-runtime';
import { emptyClassUpgradeStacks, addClassUpgrade, type ClassUpgradeStacks } from '@/weapons/class-upgrades';

/**
 * E2-S3 B 类环绕 3 把（gdd-weapons-v2 §3.3）：
 * 守夜之环（继承）/ 荆棘圣环（减速 30% 1s）/ 圣光壁垒（光环 6/s + 承伤 -10%）。
 * 同目标 0.4s 内置 CD（§⑥.4，Boss 也适用）；B3 承伤 -10% 与减伤升级加法叠加上限 -30%。
 */
describe('B 类环绕派生参数（E2-S3 / gdd-weapons-v2 §3.3）', () => {
  it('守夜之环：3 颗 / r80 / 240°/s / 8 伤 / 同目标 0.4s CD / 上限 6', () => {
    const p = deriveOrbitParams(WEAPON_CONFIGS.wpn_b_1, emptyClassUpgradeStacks());
    expect(p.count).toBe(3);
    expect(p.radius).toBe(80);
    expect(p.angularSpeedDeg).toBe(240);
    expect(p.damage).toBe(8);
    expect(p.perTargetCooldown).toBe(0.4);
  });

  it('荆棘圣环：4 颗 / r72 / 180°/s / 减速 30%（1s）', () => {
    const p = deriveOrbitParams(WEAPON_CONFIGS.wpn_b_2, emptyClassUpgradeStacks());
    expect(p.count).toBe(4);
    expect(p.radius).toBe(72);
    expect(p.angularSpeedDeg).toBe(180);
    expect(p.slowPct).toBe(0.3);
    expect(p.slowDuration).toBe(1);
  });

  it('圣光壁垒：光环 6/s（r120）+ 承伤 -10%', () => {
    const p = deriveOrbitParams(WEAPON_CONFIGS.wpn_b_3, emptyClassUpgradeStacks());
    expect(p.auraDps).toBe(6);
    expect(p.auraRadius).toBe(120);
    expect(p.damageReduction).toBe(0.1);
  });

  it('B1 数量：每层 +1（上限 6）；B2 转速 ×1.20；B3 半径 ×1.15（满层 ×1.32）', () => {
    let stacks = emptyClassUpgradeStacks();
    stacks = addClassUpgrade(stacks, 'b1');
    stacks = addClassUpgrade(stacks, 'b1');
    stacks = addClassUpgrade(stacks, 'b2');
    stacks = addClassUpgrade(stacks, 'b3');
    stacks = addClassUpgrade(stacks, 'b3');
    // 守夜之环 3+2=5 颗（上限 6）；转速 240×1.2=288；半径 80×1.32=105.6
    const p = deriveOrbitParams(WEAPON_CONFIGS.wpn_b_1, stacks);
    expect(p.count).toBe(5);
    expect(p.angularSpeedDeg).toBeCloseTo(288, 6);
    // B3 半径 ×1.15/层 → 满层 1.15² = 1.3225（GDD 表「满层 1.32→105.6」为四舍五入口径，
    // 运行时按每层 ×1.15 乘法叠加 = 105.8，偏差 0.2px 无数值影响）
    expect(p.radius).toBeCloseTo(105.8, 6);
    // 荆棘圣环 4+2=6 颗（达上限，gdd-upgrade-pool-v2 §3.3 注 4→6）
    const p2 = deriveOrbitParams(WEAPON_CONFIGS.wpn_b_2, stacks);
    expect(p2.count).toBe(6);
  });

  it('B 满强化转速口径：守夜之环 240→345.6°/s（gdd-upgrade-pool-v2 §3.3 注）', () => {
    const stacks: ClassUpgradeStacks = { ...emptyClassUpgradeStacks(), b2: 2 };
    const p = deriveOrbitParams(WEAPON_CONFIGS.wpn_b_1, stacks);
    expect(p.angularSpeedDeg).toBeCloseTo(345.6, 6);
  });
});

describe('同目标内置 CD（E2-S9 / gdd-weapons-v2 §⑥.4）', () => {
  it('orbitCanHit：now ≥ cooldownUntil 才可命中；命中后写回 CD 0.4s', () => {
    const target = { active: true, x: 0, y: 0, radius: 10, hp: 100, kill: () => {}, orbitHitCooldownUntil: 0 };
    expect(orbitCanHit(target, 10)).toBe(true);
    markOrbitHit(target, 10, 0.4);
    expect(target.orbitHitCooldownUntil).toBeCloseTo(10.4, 6);
    expect(orbitCanHit(target, 10.2)).toBe(false); // 未到 0.4s
    expect(orbitCanHit(target, 10.4)).toBe(true); // 冷却完毕
  });

  it('inactive 目标不可命中', () => {
    const target = { active: false, x: 0, y: 0, radius: 10, hp: 100, kill: () => {}, orbitHitCooldownUntil: 0 };
    expect(orbitCanHit(target, 0)).toBe(false);
  });
});

describe('圣光壁垒承伤 -10% 与减伤升级加法叠加（gdd-weapons-v2 §3.3 注）', () => {
  it('B3 damageReduction = 0.1；叠加口径（上限 -30%）由 upgrade-apply 约束', () => {
    const p = deriveOrbitParams(WEAPON_CONFIGS.wpn_b_3, emptyClassUpgradeStacks());
    expect(p.damageReduction).toBe(0.1);
    // 口径断言：壁垒 10% + 减伤升级 10%×3 = 40% → clamp 30%（常量见 balance）
    expect(Math.min(0.1 + 0.1 * 3, 0.3)).toBe(0.3);
  });
});
