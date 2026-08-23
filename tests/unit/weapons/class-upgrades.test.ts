import { describe, it, expect } from 'vitest';
import {
  emptyClassUpgradeStacks,
  addClassUpgrade,
  branchClass,
  branchesOfClass,
  classUpgradeTotal,
  isClassFullyUpgraded,
  branchStack,
  CLASS_BRANCH_MAX_STACK,
  CLASS_UPGRADE_EVOLUTION_THRESHOLD,
  speedMultiplierForStacks,
  radiusMultiplierForStacks,
  areaRadiusMultiplierForStacks,
  damageMultiplierForStacks,
  durationMultiplierForStacks,
  aggroMultiplierForStacks,
  lifetimeMultiplierForStacks,
  angularSpeedMultiplierForStacks,
} from '@/weapons/class-upgrades';

/**
 * E2-S8 武器类强化 12 分支纯函数（gdd-upgrade-pool-v2 §3.3）。
 * 分支效果：A1 分裂 / A2 穿透 / A3 弹速 / B1 数量 / B2 转速 / B3 半径 /
 * C1 范围 / C2 伤害 / C3 持续 / D1 召唤数 / D2 索敌 / D3 存在。
 */
describe('类强化堆叠（gdd-upgrade-pool-v2 §3.3）', () => {
  it('单分支叠加上限 2 次；addClassUpgrade 不可变且 clamp', () => {
    let s = emptyClassUpgradeStacks();
    s = addClassUpgrade(s, 'a1');
    s = addClassUpgrade(s, 'a1');
    s = addClassUpgrade(s, 'a1'); // 超限 clamp 2
    expect(branchStack(s, 'a1')).toBe(2);
    expect(branchStack(s, 'a2')).toBe(0);
    expect(CLASS_BRANCH_MAX_STACK).toBe(2);
  });

  it('分支归属类与类分支列表', () => {
    expect(branchClass('a1')).toBe('A');
    expect(branchClass('d3')).toBe('D');
    expect(branchesOfClass('B')).toEqual(['b1', 'b2', 'b3']);
  });

  it('类累计：任意分支组合累计（超武合成条件 1 判定源；M3-DESIGN-1 阈值 3→2）', () => {
    let s = emptyClassUpgradeStacks();
    s = addClassUpgrade(s, 'a1');
    s = addClassUpgrade(s, 'a2');
    expect(classUpgradeTotal(s, 'A')).toBe(2);
    expect(isClassFullyUpgraded(s, 'A')).toBe(true); // ≥2（类成型）
    s = addClassUpgrade(s, 'a3');
    expect(classUpgradeTotal(s, 'A')).toBe(3);
    expect(isClassFullyUpgraded(s, 'A')).toBe(true);
    expect(classUpgradeTotal(s, 'B')).toBe(0); // 不影响其它类
    expect(CLASS_UPGRADE_EVOLUTION_THRESHOLD).toBe(2);
  });

  it('满 6 = 类全满（3 分支 × 2 层，极端 build）', () => {
    let s = emptyClassUpgradeStacks();
    for (const b of ['a1', 'a2', 'a3'] as const) {
      s = addClassUpgrade(s, b);
      s = addClassUpgrade(s, b);
    }
    expect(classUpgradeTotal(s, 'A')).toBe(6);
    expect(isClassFullyUpgraded(s, 'A')).toBe(true);
  });
});

describe('派生倍率（gdd-upgrade-pool-v2 §3.3 每层效果）', () => {
  it('A3 弹速 ×1.20/层 → 满层 1.44（400→576px/s）', () => {
    expect(speedMultiplierForStacks(1)).toBeCloseTo(1.2, 6);
    expect(speedMultiplierForStacks(2)).toBeCloseTo(1.44, 6);
  });

  it('B2 转速 ×1.20/层 → 满层 1.44（240→345.6°/s）；B3 半径 ×1.15/层', () => {
    expect(angularSpeedMultiplierForStacks(2)).toBeCloseTo(1.44, 6);
    expect(radiusMultiplierForStacks(1)).toBeCloseTo(1.15, 6);
    expect(radiusMultiplierForStacks(2)).toBeCloseTo(1.3225, 6); // 1.15²（GDD 表 1.32 为四舍五入）
  });

  it('C1 范围 ×1.25 / C2 伤害 ×1.20 / C3 持续 ×1.30（满层 1.5625 / 1.44 / 1.69）', () => {
    expect(areaRadiusMultiplierForStacks(2)).toBeCloseTo(1.5625, 6);
    expect(damageMultiplierForStacks(2)).toBeCloseTo(1.44, 6);
    expect(durationMultiplierForStacks(2)).toBeCloseTo(1.69, 6);
  });

  it('D2 索敌 ×1.30 / D3 存在 ×1.30（满层 1.69）', () => {
    expect(aggroMultiplierForStacks(2)).toBeCloseTo(1.69, 6);
    expect(lifetimeMultiplierForStacks(2)).toBeCloseTo(1.69, 6);
  });
});
