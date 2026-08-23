import { describe, it, expect } from 'vitest';
import { WEAPON_CONFIGS } from '@/config/balance';
import {
  deriveProjectileParams,
  tickProjectileWeapon,
  decayActiveProjectiles,
  segmentCircleOverlap,
  pointSegmentDistance,
  createProjectileState,
} from '@/weapons/weapon-runtime';
import { emptyClassUpgradeStacks, addClassUpgrade } from '@/weapons/class-upgrades';

/**
 * E2-S2 A 类弹幕 5 把（gdd-weapons-v2 §3.2）：
 * 血月猎手（继承）/ 银针连弩（穿透 1）/ 圣银火铳（5 发扇形 45°）/ 幽灵飞刃（往返双段）/
 * 骨钉标枪（贯穿 3 + 扫掠碰撞）。全部参数走 WEAPON_CONFIGS（禁止硬编码，sprint-m2-plan §5.1）。
 */
describe('A 类弹幕派生参数（E2-S2 / gdd-weapons-v2 §3.2 + upgrade-pool-v2 §3.3 A1/A2/A3）', () => {
  it('银针连弩：直线 520px/s / 穿透 1 / 射程 400 / 上限 6（基础派生）', () => {
    const p = deriveProjectileParams(WEAPON_CONFIGS.wpn_a_2, emptyClassUpgradeStacks());
    expect(p.damage).toBe(8);
    expect(p.cooldown).toBe(0.45);
    expect(p.speed).toBe(520);
    expect(p.pierce).toBe(1);
    expect(p.maxActive).toBe(6);
    expect(p.range).toBe(400);
  });

  it('圣银火铳：5 发 / 扇形 45° / 近距 220px / 上限 15', () => {
    const p = deriveProjectileParams(WEAPON_CONFIGS.wpn_a_3, emptyClassUpgradeStacks());
    expect(p.pellets).toBe(5);
    expect(p.spreadDeg).toBe(45);
    expect(p.range).toBe(220);
    expect(p.maxActive).toBe(15);
  });

  it('幽灵飞刃：去 380 / 回 500 / 上限 4（往返双段）', () => {
    const p = deriveProjectileParams(WEAPON_CONFIGS.wpn_a_4, emptyClassUpgradeStacks());
    expect(p.speed).toBe(380);
    expect(p.returnSpeed).toBe(500);
    expect(p.maxActive).toBe(4);
  });

  it('骨钉标枪：700px/s / 贯穿 3 / 射程 560 / 上限 3（重型低频）', () => {
    const p = deriveProjectileParams(WEAPON_CONFIGS.wpn_a_5, emptyClassUpgradeStacks());
    expect(p.speed).toBe(700);
    expect(p.pierce).toBe(3);
    expect(p.range).toBe(560);
    expect(p.maxActive).toBe(3);
  });

  it('A1 分裂：每层 +1 次级弹（≤2）；A2 穿透：基础 + 层数；A3 弹速：×1.20^层', () => {
    let stacks = emptyClassUpgradeStacks();
    stacks = addClassUpgrade(stacks, 'a1');
    stacks = addClassUpgrade(stacks, 'a1');
    stacks = addClassUpgrade(stacks, 'a2');
    stacks = addClassUpgrade(stacks, 'a3');
    stacks = addClassUpgrade(stacks, 'a3');
    // 银针连弩（基础穿透 1 + a2 1 = 2；弹速 520×1.44 = 748.8；分裂 2）
    const p = deriveProjectileParams(WEAPON_CONFIGS.wpn_a_2, stacks);
    expect(p.split).toBe(2);
    expect(p.pierce).toBe(2);
    expect(p.speed).toBeCloseTo(748.8, 6);
    // A3 满层 400→576（血月猎手口径，gdd-upgrade-pool-v2 §3.3 注）
    const m = deriveProjectileParams(WEAPON_CONFIGS.wpn_a_1, stacks);
    expect(m.speed).toBeCloseTo(576, 6);
  });
});

describe('A 类触发与上限容错（E2-S9 / gdd-weapons-v2 §⑥.1/§⑥.3）', () => {
  it('无目标不发射（gdd-weapons-v2 §⑥.1）：冷却就绪但 hasTarget=false → skippedNoTarget', () => {
    const params = deriveProjectileParams(WEAPON_CONFIGS.wpn_a_2, emptyClassUpgradeStacks());
    const state = createProjectileState();
    const r = tickProjectileWeapon(state, params, 1.0, { hasTarget: false });
    expect(r.fired).toBe(false);
    expect(r.skippedNoTarget).toBe(true);
    expect(state.active).toBe(0);
  });

  it('达上限跳过本冷却（不积压、不报错，§⑥.3）：active ≥ maxActive → skippedDueToCap', () => {
    const params = deriveProjectileParams(WEAPON_CONFIGS.wpn_a_2, emptyClassUpgradeStacks());
    const state = createProjectileState();
    state.active = params.maxActive; // 满
    const r = tickProjectileWeapon(state, params, 1.0, { hasTarget: true });
    expect(r.fired).toBe(false);
    expect(r.skippedDueToCap).toBe(true);
    expect(state.active).toBe(params.maxActive);
  });

  it('正常开火：冷却就绪 + 有目标 + 未满 → fired，active += pellets（火铳 5 发占 5 弹位）', () => {
    const params = deriveProjectileParams(WEAPON_CONFIGS.wpn_a_3, emptyClassUpgradeStacks());
    const state = createProjectileState();
    const r = tickProjectileWeapon(state, params, 1.0, { hasTarget: true });
    expect(r.fired).toBe(true);
    expect(state.active).toBe(5);
  });

  it('冷却重置语义：就绪即重置（无论是否开火），下一发须等冷却', () => {
    const params = deriveProjectileParams(WEAPON_CONFIGS.wpn_a_2, emptyClassUpgradeStacks());
    const state = createProjectileState();
    tickProjectileWeapon(state, params, 1.0, { hasTarget: true });
    expect(state.cooldown).toBe(params.cooldown);
    const again = tickProjectileWeapon(state, params, 0.1, { hasTarget: true });
    expect(again.fired).toBe(false); // 冷却未就绪
  });

  it('active 弹体随寿命消散（寿命模型）', () => {
    const params = deriveProjectileParams(WEAPON_CONFIGS.wpn_a_2, emptyClassUpgradeStacks());
    const state = createProjectileState();
    state.active = 6;
    decayActiveProjectiles(state, params, params.lifetime); // 满寿命 → 全部消散
    expect(state.active).toBe(0);
    state.active = 6;
    decayActiveProjectiles(state, params, params.lifetime / 2); // 半寿命 → 剩 3
    expect(state.active).toBeCloseTo(3, 6);
  });
});

describe('扫掠碰撞（E2-S9 / gdd-weapons-v2 §⑥.9 骨钉标枪 700px/s 防穿透漏判）', () => {
  it('高速弹一帧穿过小半径敌人：圆-圆（帧末位置）漏判，扫掠线段命中', () => {
    // 弹从 (0,0) 到 (60,0)，敌人圆心 (30,0) r=6 —— 帧末弹在 (60,0) 距敌 30 > 命中
    const sweptHit = segmentCircleOverlap(0, 0, 60, 0, 30, 0, 6);
    expect(sweptHit).toBe(true);
    // 对照：只测帧末圆-圆会漏判（(60,0) vs (30,0) r6 → 24 > 6+6）
    const dx = 60 - 30;
    const rr = 6 + 6;
    expect(dx * dx > rr * rr).toBe(true);
  });

  it('点-线段距离：垂足投影正确（最近点在线段内）', () => {
    expect(pointSegmentDistance(3, 4, 0, 0, 10, 0)).toBeCloseTo(4, 6); // 垂足 (3,0)
    expect(pointSegmentDistance(12, 0, 0, 0, 10, 0)).toBeCloseTo(2, 6); // 端点外 → 最近端点
  });

  it('扫掠不误伤：线段远离敌人 → false', () => {
    expect(segmentCircleOverlap(0, 0, 60, 0, 30, 200, 10)).toBe(false);
  });
});
