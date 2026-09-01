/**
 * NV-REVIEW-FIX 批次 D-3 · P1-7 角色支线 machine + 接线 —— 运行时用例
 *
 * 覆盖（审查 §5 P1-7；gdd-talent-tree §4.3 轻规格）：
 * - 支线节点 machine 锚补齐（8 条：4 角色 × ①②；顶点同袍之诺 = 图鉴联动节点无数值）
 * - computeTreeApplication 支线段汇总（attributeDeltaOf 并入 kind==='branch'；×层数；纯局内置空）
 * - 消费点接线：
 *   · 拾取半径/治疗效能 → 既有 TreeAttributeDelta 字段（PlayerStats/XpManager 口，回归不重复测）
 *   · 受击移速 → PlayerStats.hitSpeedBoostBonusPct（仅受击加速窗口内生效）
 *   · 击杀回血 → PlayerStats.killHealBonus（applyLifesteal 与吸血/兽血愈合加法叠加）
 *   · 狂化移速 → PlayerStats.rageSpeedBonusPct（仅 rageSpeedPct > 0 窗口内生效）
 *   · 吸血效 → stepTwinblades machine['healPerHitPct']（命中回复与每秒上限同源乘区）
 *   · 范围 → stepLantern/stepBell machine['areaPct']（灯环/领域半径乘区）
 *   · 墓碑回血 → oathkeeper machine['tombHealFlatBonus']（tickTombstone 加法）
 *
 * 分层纪律：全部为运行时用例（纯函数/状态机），不依赖 Phaser 场景。
 */

import { describe, it, expect } from 'vitest';
import { TALENT_TREE, talentNodeById, type TalentNodeId } from '@/config/balance';
import {
  createTreeLedger,
  unlockNode,
  computeTreeApplication,
  type TreeLedger,
} from '@/progression/tree-state';
import { PlayerStats } from '@/player/player-stats';
import { emptyStatusState } from '@/combat/status/status-engine';
import type { ExclusiveTarget } from '@/weapons/exclusive/exclusive-math';
import {
  createLanternState, stepLantern,
  createBellState, stepBell,
  createTwinbladesState, stepTwinblades,
} from '@/weapons/exclusive/exclusive-math';
import { createOathkeeperState, becomeTombstone, tickTombstone } from '@/weapons/companion/oathkeeper';

// ============================================================================
// 测试替身
// ============================================================================

function makeTarget(hp = 1000, dist = 60): ExclusiveTarget & { killed: boolean } {
  const t = {
    active: true,
    x: dist,
    y: 0,
    radius: 14,
    hp,
    killed: false,
    cc: emptyStatusState(),
    kill() {
      t.killed = true;
    },
  };
  return t as ExclusiveTarget & { killed: boolean };
}

/** 支线 ledger：直接写 purchases（树 UI 购买路径由 unlockNode 单测覆盖） */
function ledgerWith(purchases: Record<string, number>, points = 10000): TreeLedger {
  const ledger = createTreeLedger(points);
  for (const [id, n] of Object.entries(purchases)) ledger.purchases[id] = n;
  return ledger;
}

// ============================================================================
// 配置表：支线 machine 锚（§4.3）
// ============================================================================

describe('NV-REVIEW-FIX D-3 · 支线 machine 锚（talent-tree §4.3）', () => {
  it('8 条支线节点 machine 全部非空；顶点 4 条为图鉴联动节点（machine 空 = 零数值）', () => {
    for (const hero of ['edmund', 'cassandra', 'violet', 'galvan'] as const) {
      for (const suffix of ['1', '2'] as const) {
        const node = talentNodeById(`br_${hero}_${suffix}` as TalentNodeId);
        expect(node, `br_${hero}_${suffix} 存在`).not.toBeNull();
        expect(Object.keys(node!.machine).length, `br_${hero}_${suffix} machine 已填`).toBeGreaterThan(0);
      }
      const top = talentNodeById(`br_${hero}_top` as TalentNodeId);
      expect(top!.machine).toEqual({});
      expect(top!.codexPrerequisite).toBe('codex_heroes_all');
    }
  });

  it('支线 machine 数值与 §4.3 锚一致（字段名 = 消费键）', () => {
    expect(talentNodeById('br_edmund_1')!.machine).toEqual({ pickupRadius: 10 });
    expect(talentNodeById('br_edmund_2')!.machine).toEqual({ areaPct: 0.05 });
    expect(talentNodeById('br_cassandra_1')!.machine).toEqual({ hitMoveSpeedPct: 0.1 });
    expect(talentNodeById('br_cassandra_2')!.machine).toEqual({ lifestealHealPct: 0.25 });
    expect(talentNodeById('br_violet_1')!.machine).toEqual({ healEfficiencyPct: 0.1 });
    expect(talentNodeById('br_violet_2')!.machine).toEqual({ tombHealFlat: 1 });
    expect(talentNodeById('br_galvan_1')!.machine).toEqual({ killHealFlat: 0.5 });
    expect(talentNodeById('br_galvan_2')!.machine).toEqual({ rageMoveSpeedPct: 0.05 });
  });

  it('全树总量断言不回归：38 条目、总成本仍在 800~1000 区间', () => {
    expect(TALENT_TREE).toHaveLength(38);
  });
});

// ============================================================================
// computeTreeApplication：支线段汇总
// ============================================================================

describe('NV-REVIEW-FIX D-3 · computeTreeApplication 支线汇总（tree-state）', () => {
  it('买支线节点 → 对应字段 ×层数 进 attributes（用例：买 1 条即变化）', () => {
    const app = computeTreeApplication(ledgerWith({ br_edmund_1: 2 }), false);
    expect(app.attributes.pickupRadius).toBeCloseTo(20); // +10px ×2
    const app2 = computeTreeApplication(ledgerWith({ br_cassandra_2: 1 }), false);
    expect(app2.attributes.lifestealHealPct).toBeCloseTo(0.25);
    const app3 = computeTreeApplication(ledgerWith({ br_galvan_2: 2 }), false);
    expect(app3.attributes.rageMoveSpeedPct).toBeCloseTo(0.1); // +5% ×2
    const app4 = computeTreeApplication(ledgerWith({ br_violet_2: 2 }), false);
    expect(app4.attributes.tombHealFlat).toBeCloseTo(2); // +1 HP/s ×2
  });

  it('支线与属性节点同构汇总（买 edmund 支线① + a_pickup_radius 叠加）', () => {
    const app = computeTreeApplication(ledgerWith({ br_edmund_1: 1, a_pickup_radius: 2 }), false);
    expect(app.attributes.pickupRadius).toBeCloseTo(10 + 20);
  });

  it('顶点同袍之诺购买不产生属性变化（machine 空）', () => {
    const app = computeTreeApplication(ledgerWith({ br_edmund_top: 1 }), false);
    expect(Object.values(app.attributes).every((v) => v === 0)).toBe(true);
  });

  it('纯局内模式：支线属性段随属性段一并置空（GT-11）', () => {
    const app = computeTreeApplication(ledgerWith({ br_galvan_1: 2 }), true);
    expect(app.attributes.killHealFlat).toBe(0);
    expect(app.pureInGame).toBe(true);
  });

  it('unlockNode 购买路径：点亮 br_violet_1 后 computeTreeApplication 可见', () => {
    const ledger = createTreeLedger(1000);
    expect(unlockNode(ledger, 'br_violet_1')).toBe(true);
    const app = computeTreeApplication(ledger, false);
    expect(app.attributes.healEfficiencyPct).toBeCloseTo(0.1);
  });
});

// ============================================================================
// 消费点：PlayerStats（受击移速 / 击杀回血 / 狂化移速）
// ============================================================================

describe('NV-REVIEW-FIX D-3 · PlayerStats 支线消费', () => {
  it('受击移速：hitSpeedBoostBonusPct 仅在受击加速窗口内叠加（+10% ×2 层）', () => {
    const stats = new PlayerStats();
    stats.moveSpeed = 200;
    stats.hitSpeedBoostBonusPct = 0.2; // ×2 层
    const base = stats.effectiveMoveSpeed(10);
    expect(base).toBe(200); // 窗口外无感
    stats.triggerHitSpeedBoost(10);
    const boosted = stats.effectiveMoveSpeed(11);
    expect(boosted).toBeCloseTo(200 * (1 + 0.1 + 0.2));
    expect(stats.effectiveMoveSpeed(10 + 3.1)).toBe(200); // 3s 窗口过后回落
  });

  it('击杀回血：killHealBonus 与吸血/兽血愈合加法叠加（+0.5 ×2 层）', () => {
    const stats = new PlayerStats();
    stats.hp = 50;
    expect(stats.applyLifesteal()).toBe(false); // 无来源无操作
    stats.killHealBonus = 1; // +0.5 ×2
    expect(stats.applyLifesteal()).toBe(true);
    expect(stats.hp).toBe(51);
    stats.lifestealPerKill = 2; // 吸血升级叠加
    stats.hp = 50;
    stats.applyLifesteal();
    expect(stats.hp).toBe(53); // 2 + 0 + 1
  });

  it('狂化移速：rageSpeedBonusPct 仅在 rageSpeedPct > 0（狂化窗口）内生效（+5% ×2 层）', () => {
    const stats = new PlayerStats();
    stats.moveSpeed = 200;
    stats.rageSpeedBonusPct = 0.1; // ×2 层
    expect(stats.effectiveMoveSpeed(10)).toBe(200); // 非狂化无感
    stats.rageSpeedPct = 0.3; // 狂化开启（技能写回）
    expect(stats.effectiveMoveSpeed(10)).toBeCloseTo(200 * (1 + 0.3 + 0.1));
    stats.rageSpeedPct = 0; // 狂化结束归 0（既有语义）
    expect(stats.effectiveMoveSpeed(10)).toBe(200);
  });
});

// ============================================================================
// 消费点：exclusive-math（吸血效 / 范围）
// ============================================================================

describe('NV-REVIEW-FIX D-3 · 专武 machine 支线消费', () => {
  it('吸血效：machine.healPerHitPct 放大双刃命中回复与每秒上限（+25%：0.5→0.625 / 2→2.5）', () => {
    const state = createTwinbladesState();
    const target = makeTarget(100000);
    const player = { x: 0, y: 0, hp: 100, maxHp: 100 };
    let healed = 0;
    const sink = (h: number) => { healed += h; };
    // 基线：无 machine → 0.5/次
    stepTwinblades(state, 1 / 60, 0, player, [target], 1, {}, sink);
    expect(healed).toBeCloseTo(0.5);
    // ×1 层 +25% → 0.625/次（同帧第二次攻击节拍未到，单独重建状态）
    const state2 = createTwinbladesState();
    let healed2 = 0;
    stepTwinblades(state2, 1 / 60, 0, player, [target], 1, { healPerHitPct: 0.25 }, (h) => { healed2 += h; });
    expect(healed2).toBeCloseTo(0.625);
  });

  it('吸血效每秒上限同步放大（cap 2→2.5：同秒窗 5 连击累计 2.5；基线口径为 2.0）', () => {
    const target = makeTarget(100000);
    const player = { x: 0, y: 0, hp: 100, maxHp: 100 };
    // 同一秒窗内连续 5 次命中（手动清 attackTimer；0.01s 步进不跨窗口重置）
    const runHits = (machine: Record<string, number>): number => {
      const state = createTwinbladesState();
      let healed = 0;
      for (let i = 0; i < 5; i += 1) {
        state.attackTimer = 0;
        stepTwinblades(state, 0.01, i * 0.01, player, [target], 1, machine, (h) => { healed += h; });
      }
      return healed;
    };
    expect(runHits({})).toBeCloseTo(2.0); // 基线：0.5×4 触 cap 2 → 第 5 次 0
    expect(runHits({ healPerHitPct: 0.25 })).toBeCloseTo(2.5); // 0.625×4 触 cap 2.5 → 第 5 次 0
  });

  it('范围：machine.areaPct 放大灯环半径（90 → ×1.05 = 94.5；93px 处敌由环外变环内）', () => {
    const outside = makeTarget(1000, 93);
    const stateBase = createLanternState();
    for (let f = 0; f < 60; f += 1) stepLantern(stateBase, 1 / 60, f / 60, { x: 0, y: 0, hp: 100, maxHp: 100 }, [outside], 1);
    expect(outside.hp).toBe(1000); // 基线 90px 环外
    const inside = makeTarget(1000, 93);
    const stateBuffed = createLanternState();
    for (let f = 0; f < 60; f += 1) {
      stepLantern(stateBuffed, 1 / 60, f / 60, { x: 0, y: 0, hp: 100, maxHp: 100 }, [inside], 1, { areaPct: 0.05 });
    }
    expect(inside.hp).toBeLessThan(1000); // ×1.05 = 94.5px 环内
  });

  it('范围：machine.areaPct 放大铃音领域半径（110 → ×1.05 ×2 = 121；115px 处敌由域外变域内）', () => {
    const at115 = makeTarget(1000, 115);
    const stateBase = createBellState();
    for (let f = 0; f < 60; f += 1) stepBell(stateBase, 1 / 60, f / 60, { x: 0, y: 0, hp: 100, maxHp: 100 }, [at115], 1);
    expect(at115.hp).toBe(1000); // 基线 110px 域外
    const buffed = makeTarget(1000, 115);
    const stateBuffed = createBellState();
    for (let f = 0; f < 60; f += 1) {
      stepBell(stateBuffed, 1 / 60, f / 60, { x: 0, y: 0, hp: 100, maxHp: 100 }, [buffed], 1, { areaPct: 0.1 });
    }
    expect(buffed.hp).toBeLessThan(1000); // ×1.1 = 121px 域内
  });

  it('墓碑回血：machine.tombHealFlatBonus 加法叠加墓碑 HP/s（基线 2 + 2 层 = 4 HP/s）', () => {
    const state = createOathkeeperState(0, 0);
    becomeTombstone(state, 0, () => 0); // 持续取 min 8s
    state.machine['tombHealFlatBonus'] = 2; // ×2 层
    const player = { x: 0, y: 0 }; // 120px 环内
    let healed = 0;
    tickTombstone(state, 1, 1, player, (h) => { healed += h; return h; });
    expect(healed).toBeCloseTo(4); // (2 + 2) × 1s
  });
});
