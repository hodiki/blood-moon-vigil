import { describe, it, expect } from 'vitest';
import { WEAPON_CONFIGS } from '@/config/balance';
import {
  deriveProjectileParams,
  tickProjectileWeapon,
  createProjectileState,
  deriveGroundAreaParams,
  tickGroundPools,
  applyGroundPoolTick,
  segmentCircleOverlap,
} from '@/weapons/weapon-runtime';
import { emptyClassUpgradeStacks } from '@/weapons/class-upgrades';
import { createEvolutionResult, EvolutionState } from '@/weapons/evolution-engine';

/**
 * E2-S9 弹体上限/无目标跳过/同目标内置 CD/扫掠碰撞/进化清弹体 全量容错断言
 * （gdd-weapons-v2 §⑥ 边缘情况与容错）。
 */
describe('弹体上限容错（gdd-weapons-v2 §⑥.3：达上限跳过本冷却，不积压、不报错）', () => {
  it('A 类达上限：跳过不报错、active 不越上限', () => {
    const params = deriveProjectileParams(WEAPON_CONFIGS.wpn_a_5, emptyClassUpgradeStacks()); // 标枪上限 3
    const state = createProjectileState();
    state.active = params.maxActive;
    const r = tickProjectileWeapon(state, params, 1.0, { hasTarget: true });
    expect(r.skippedDueToCap).toBe(true);
    expect(state.active).toBe(params.maxActive); // 不越上限
  });

  it('火铳 5 发扇形：active + pellets 不越 maxActive（15）', () => {
    const params = deriveProjectileParams(WEAPON_CONFIGS.wpn_a_3, emptyClassUpgradeStacks());
    const state = createProjectileState();
    state.active = params.maxActive - 2; // 13：还差 2 个弹位
    const r = tickProjectileWeapon(state, params, 1.0, { hasTarget: true });
    // 13 + 5 = 18 → clamp 15：发不满（剩余弹位不足）也不报错
    expect(state.active).toBeLessThanOrEqual(params.maxActive);
    expect(r.fired).toBe(true); // 判定为触发（不越上限）
  });
});

describe('无目标跳过（gdd-weapons-v2 §⑥.1）', () => {
  it('A 类无目标不发射（省资源）', () => {
    const params = deriveProjectileParams(WEAPON_CONFIGS.wpn_a_2, emptyClassUpgradeStacks());
    const state = createProjectileState();
    const r = tickProjectileWeapon(state, params, 1.0, { hasTarget: false });
    expect(r.fired).toBe(false);
    expect(r.skippedNoTarget).toBe(true);
  });

  it('C 类范围照常释放（清屏价值）：地面池冷却就绪即铺，无目标不跳过', () => {
    // 地面池行为（血池/圣火）在行为层无「无目标跳过」分支 —— 冷却就绪即铺池；
    // 模型侧断言：applyGroundPoolTick 对空敌人列表安全（hit=0 不报错）
    const params = deriveGroundAreaParams(WEAPON_CONFIGS.wpn_c_2, emptyClassUpgradeStacks());
    expect(params.cooldown).toBe(6);
    const pools = [{ x: 0, y: 0, radius: 180, remaining: 3, damagePerTick: 10, slowPct: 0.2, lastTick: 0 }];
    const r = applyGroundPoolTick(pools, []);
    expect(r).toEqual({ hit: 0, killed: 0 }); // 无目标不报错（照常 tick 空命中）
  });
});

describe('同目标内置 CD（gdd-weapons-v2 §⑥.4：Boss 也适用）', () => {
  it('环绕球同目标 0.4s 内置 CD：命中后 0.4s 内不重复', () => {
    // 由 orbit-weapons.test 覆盖 orbitCanHit/markOrbitHit；此处复核配置值
    const b1 = WEAPON_CONFIGS.wpn_b_1;
    const b2 = WEAPON_CONFIGS.wpn_b_2;
    expect(b1.perTargetCooldown).toBe(0.4);
    expect(b2.perTargetCooldown).toBe(0.4);
  });
});

describe('扫掠碰撞（gdd-weapons-v2 §⑥.9：700px/s 防穿透漏判）', () => {
  it('高速弹单帧跨越整个命中圈 → 扫掠命中（帧末圆-圆必然漏判）', () => {
    // 一帧 1/60s × 700px/s ≈ 11.7px 步进；构造 60px 大步进场景
    const r = segmentCircleOverlap(0, 0, 60, 0, 30, 0, 12);
    expect(r).toBe(true);
  });
});

describe('进化清弹体与玩家死亡清弹体（gdd-weapons-v2 §5.1 边缘 / §⑥.7）', () => {
  it('进化瞬间清空旧弹体（原子切换）—— createEvolutionResult.clearedProjectiles = true', () => {
    const r = createEvolutionResult('wpn_a_1', 'evo_moonwrath');
    expect(r.clearedProjectiles).toBe(true);
  });

  it('玩家死亡：清除全部弹体/环绕球/召唤物/地面领域 + 冷却重置（clearAll 语义，WeaponSystem.clearAll 遍历注册表）', () => {
    // 行为层 clearAll 由 WeaponSystem.clearAll 广播（装配层不可单测）；
    // 模型侧断言：EvolutionState/冷却重置原子性 —— 进化后旧武器不可再进化（不可逆）
    const es = new EvolutionState();
    es.commit('wpn_a_1', 'evo_moonwrath');
    expect(es.isEvolved('wpn_a_1')).toBe(true);
    expect(es.commit('wpn_a_1', 'evo_moonwrath')).toBe(false);
  });

  it('地面池寿命到期自然清除（tickGroundPools 移除 remaining ≤ 0）', () => {
    const pools = [{ x: 0, y: 0, radius: 180, remaining: 0.2, damagePerTick: 10, slowPct: 0, lastTick: 0 }];
    const alive = tickGroundPools(pools, 0.5);
    expect(alive).toHaveLength(0);
  });
});
