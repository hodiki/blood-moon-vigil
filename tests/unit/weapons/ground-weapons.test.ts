import { describe, it, expect } from 'vitest';
import { WEAPON_CONFIGS } from '@/config/balance';
import {
  deriveGroundAreaParams,
  applyGroundPoolTick,
  tickGroundPools,
  type GroundPoolInstance,
} from '@/weapons/weapon-runtime';
import { emptyClassUpgradeStacks, addClassUpgrade } from '@/weapons/class-upgrades';

/**
 * E2-S4 C 类范围 3 把（gdd-weapons-v2 §3.4）：
 * 月蚀脉冲（继承）/ 血池喷涌（池 180px 3s 减速 20%）/ 审判圣火（火 200px 2.5s）。
 * 地面池规则（§⑥.6）：每池独立 tick（0.5s）；同目标同一武器只计最高伤害源一次（防刷伤）。
 */
describe('C 类地面池派生参数（E2-S4 / gdd-weapons-v2 §3.4）', () => {
  it('血池喷涌：20/s · 池 180px · 持续 3s · 减速 20% · tick 0.5s', () => {
    const p = deriveGroundAreaParams(WEAPON_CONFIGS.wpn_c_2, emptyClassUpgradeStacks());
    expect(p.damagePerSec).toBe(20);
    expect(p.cooldown).toBe(6);
    expect(p.radius).toBe(180);
    expect(p.duration).toBe(3);
    expect(p.slowPct).toBe(0.2);
    expect(p.tickInterval).toBe(0.5);
  });

  it('审判圣火：35/s · 火 200px · 持续 2.5s（无减速）', () => {
    const p = deriveGroundAreaParams(WEAPON_CONFIGS.wpn_c_3, emptyClassUpgradeStacks());
    expect(p.damagePerSec).toBe(35);
    expect(p.radius).toBe(200);
    expect(p.duration).toBe(2.5);
    expect(p.slowPct).toBeUndefined();
  });

  it('月蚀脉冲：60 伤 / 8s / 半径 280（单发，非持续 tick）', () => {
    const p = deriveGroundAreaParams(WEAPON_CONFIGS.wpn_c_1, emptyClassUpgradeStacks());
    expect(p.damagePerSec).toBe(60);
    expect(p.cooldown).toBe(8);
    expect(p.radius).toBe(280);
  });

  it('C1 范围 ×1.25 / C2 伤害 ×1.20 / C3 持续 ×1.30（满层：1.56 / 1.44 / 1.69）', () => {
    let stacks = emptyClassUpgradeStacks();
    stacks = addClassUpgrade(stacks, 'c1');
    stacks = addClassUpgrade(stacks, 'c1');
    stacks = addClassUpgrade(stacks, 'c2');
    stacks = addClassUpgrade(stacks, 'c2');
    stacks = addClassUpgrade(stacks, 'c3');
    stacks = addClassUpgrade(stacks, 'c3');
    const p = deriveGroundAreaParams(WEAPON_CONFIGS.wpn_c_2, stacks);
    // C1 半径 ×1.25/层 → 满层 1.25² = 1.5625（GDD 表「满层 1.56→280.8」为四舍五入口径，
    // 运行时按每层 ×1.25 乘法叠加 = 281.25，偏差 0.45px 无数值影响）
    expect(p.radius).toBeCloseTo(281.25, 6);
    expect(p.damagePerSec).toBeCloseTo(28.8, 6); // 20×1.44
    expect(p.duration).toBeCloseTo(5.07, 6); // 3×1.69（gdd-upgrade-pool-v2 §3.3 注）
  });
});

describe('地面池 tick 与同目标最高源（E2-S9 / gdd-weapons-v2 §⑥.6）', () => {
  function makePool(x: number, y: number, damagePerTick: number): GroundPoolInstance {
    return { x, y, radius: 180, remaining: 3, damagePerTick, slowPct: 0.2, lastTick: 0 };
  }

  function makeEnemy(id: string, x: number, y: number, hp: number) {
    return { id, active: true, x, y, radius: 14, hp, kill() { this.active = false; this.hp = 0; } };
  }

  it('单池覆盖：半径内敌人扣 damagePerTick；半径外不扣', () => {
    const pools = [makePool(0, 0, 10)];
    const inside = makeEnemy('a', 100, 0, 100);
    const outside = makeEnemy('b', 500, 0, 100);
    const r = applyGroundPoolTick(pools, [inside, outside]);
    expect(r.hit).toBe(1);
    expect(inside.hp).toBe(90);
    expect(outside.hp).toBe(100);
  });

  it('多池重叠：每池独立 tick（不合并），但同目标同一武器只计最高伤害源一次（防刷伤）', () => {
    // 两个池重叠覆盖同一敌人：伤害 15（最高源），非 10+15=25
    const pools = [makePool(0, 0, 10), makePool(20, 0, 15)];
    const enemy = makeEnemy('a', 10, 0, 100);
    const r = applyGroundPoolTick(pools, [enemy]);
    expect(r.hit).toBe(1);
    expect(enemy.hp).toBe(85); // 100 - max(10,15)
  });

  it('不同敌人分别命中各自覆盖池（hit 数正确）', () => {
    const pools = [makePool(0, 0, 10), makePool(300, 0, 15)];
    const a = makeEnemy('a', 10, 0, 100); // 池 1
    const b = makeEnemy('b', 310, 0, 100); // 池 2
    const r = applyGroundPoolTick(pools, [a, b]);
    expect(r.hit).toBe(2);
    expect(a.hp).toBe(90);
    expect(b.hp).toBe(85);
  });

  it('击杀：HP ≤ 0 触发 kill；killed 计数正确', () => {
    const pools = [makePool(0, 0, 10)];
    const enemy = makeEnemy('a', 10, 0, 5);
    const r = applyGroundPoolTick(pools, [enemy]);
    expect(r.killed).toBe(1);
    expect(enemy.hp).toBe(0);
    expect(enemy.active).toBe(false);
  });

  it('池寿命推进：remaining ≤ 0 移除', () => {
    const pools = [makePool(0, 0, 10), makePool(100, 0, 10)];
    pools[1]!.remaining = 0.3;
    const alive = tickGroundPools(pools, 0.5);
    expect(alive).toHaveLength(1);
    expect(alive[0]).toBe(pools[0]);
  });
});
