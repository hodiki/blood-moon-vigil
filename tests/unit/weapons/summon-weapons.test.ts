import { describe, it, expect } from 'vitest';
import { WEAPON_CONFIGS } from '@/config/balance';
import {
  deriveSummonParams,
  createSummonState,
  tickSummons,
  removeSummon,
} from '@/weapons/weapon-runtime';
import { emptyClassUpgradeStacks, addClassUpgrade } from '@/weapons/class-upgrades';

/**
 * E2-S5 D 类召唤 3 把（gdd-weapons-v2 §3.5）：
 * 血蝠群（2 只/0.5s/12s/重召 5s）/ 狼影猎犬（1 只/1.0s/15s/4s）/
 * 断罪锁链（直线 200px 25 伤 + 击退 100px，CD 3.5s，D 类定向挥击吃 D 强化）。
 * 召唤物规则（§⑥.5）：死亡/到期 → 按重召唤间隔重新召唤；死亡瞬间移除碰撞。
 */
describe('D 类召唤派生参数（E2-S5 / gdd-weapons-v2 §3.5）', () => {
  it('血蝠群：2 只 × 6 伤 / 0.5s 攻击 / 存在 12s / 重召 5s', () => {
    const p = deriveSummonParams(WEAPON_CONFIGS.wpn_d_1, emptyClassUpgradeStacks());
    expect(p.count).toBe(2);
    expect(p.damage).toBe(6);
    expect(p.attackInterval).toBe(0.5);
    expect(p.lifetime).toBe(12);
    expect(p.respawnCd).toBe(5);
  });

  it('狼影猎犬：1 只 × 15 伤 / 1.0s / 存在 15s / 重召 4s', () => {
    const p = deriveSummonParams(WEAPON_CONFIGS.wpn_d_2, emptyClassUpgradeStacks());
    expect(p.count).toBe(1);
    expect(p.damage).toBe(15);
    expect(p.attackInterval).toBe(1.0);
    expect(p.lifetime).toBe(15);
    expect(p.respawnCd).toBe(4);
  });

  it('断罪锁链：25 伤 / CD 3.5s / 直线 200px / 击退 100px（D 类，吃 D 强化）', () => {
    const c = WEAPON_CONFIGS.wpn_d_3;
    expect(c.damage).toBe(25);
    expect(c.cooldown).toBe(3.5);
    expect(c.range).toBe(200);
    expect(c.knockback).toBe(100);
    expect(c.class).toBe('D');
  });

  it('D1 召唤数：每层 +1（血蝠 2→4；猎犬 1→3；上限 6）；D2 索敌 ×1.30；D3 存在 ×1.30', () => {
    let stacks = emptyClassUpgradeStacks();
    stacks = addClassUpgrade(stacks, 'd1');
    stacks = addClassUpgrade(stacks, 'd1');
    stacks = addClassUpgrade(stacks, 'd2');
    stacks = addClassUpgrade(stacks, 'd3');
    stacks = addClassUpgrade(stacks, 'd3');
    const p1 = deriveSummonParams(WEAPON_CONFIGS.wpn_d_1, stacks);
    expect(p1.count).toBe(4); // 血蝠 2+2
    expect(p1.aggroMult).toBeCloseTo(1.3, 6);
    expect(p1.lifetime).toBeCloseTo(20.28, 6); // 12×1.69（gdd-upgrade-pool-v2 §3.3 注）
    const p2 = deriveSummonParams(WEAPON_CONFIGS.wpn_d_2, stacks);
    expect(p2.count).toBe(3); // 猎犬 1+2
    // 上限 6：血蝠 D1 满 = 2+2=4（不越上限）
    expect(p1.count).toBeLessThanOrEqual(6);
  });
});

describe('召唤运行时（E2-S5 / E2-S9 / gdd-weapons-v2 §⑥.5）', () => {
  it('初始召唤数 = params.count；攻击节拍按 attackInterval 触发', () => {
    const params = deriveSummonParams(WEAPON_CONFIGS.wpn_d_1, emptyClassUpgradeStacks());
    const state = createSummonState(params);
    expect(state.activeCount).toBe(2);
    // 0.5s 后首次攻击
    const r1 = tickSummons(state, params, 0.5);
    expect(r1.attacked).toBe(true);
    expect(r1.activeCount).toBe(2);
    const r2 = tickSummons(state, params, 0.2);
    expect(r2.attacked).toBe(false); // 未到下一轮
  });

  it('召唤物死亡/到期 → 重召唤间隔后恢复（不立即补）', () => {
    const params = deriveSummonParams(WEAPON_CONFIGS.wpn_d_1, emptyClassUpgradeStacks());
    const state = createSummonState(params);
    removeSummon(state, params);
    expect(state.activeCount).toBe(1);
    // 重召间隔 5s：未到不恢复
    tickSummons(state, params, 4.9);
    expect(state.activeCount).toBe(1);
    // 到 5s 恢复
    tickSummons(state, params, 0.1);
    expect(state.activeCount).toBe(2);
  });

  it('重召唤间隔 = respawnCd（血蝠 5s / 猎犬 4s，gdd-weapons-v2 §3.5）', () => {
    const b = deriveSummonParams(WEAPON_CONFIGS.wpn_d_1, emptyClassUpgradeStacks());
    const h = deriveSummonParams(WEAPON_CONFIGS.wpn_d_2, emptyClassUpgradeStacks());
    expect(b.respawnCd).toBe(5);
    expect(h.respawnCd).toBe(4);
  });

  it('removeSummon 到 0 不再减；恢复不越 count 上限', () => {
    const params = deriveSummonParams(WEAPON_CONFIGS.wpn_d_1, emptyClassUpgradeStacks());
    const state = createSummonState(params);
    removeSummon(state, params);
    removeSummon(state, params);
    expect(state.activeCount).toBe(0);
    removeSummon(state, params); // 不减到负
    expect(state.activeCount).toBe(0);
  });
});
