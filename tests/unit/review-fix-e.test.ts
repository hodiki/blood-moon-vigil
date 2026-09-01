/**
 * tests/unit/review-fix-e.test.ts —— NV-REVIEW-FIX 批次 E · 共鸣补完（P1-3~P1-6）
 *
 * 覆盖（gdd-resonance §④/§⑦；审查单 P1-3/P1-4/P1-5/P1-6）：
 *   · P1-3 R-3 印记 ×1.2：stepTwinblades 主斩乘 resonanceTwinbladesDamageMult
 *     （machine['twinbladesMarkMult'] 可覆写；非 R-3 印记不加成）
 *   · P1-4 R-7 拖拽：onResonanceChainHit 返回落点（真位移语义）+
 *     stepAxe 对被拖拽者 ×1.5（喂食即耗：挥击后 consumeResonanceDrag）
 *   · P1-5 R-5 圣域：resonanceSanctuaryBonus 锚（18%/20pp）+
 *     PlayerStats.dynamicDamageReductionPct 帧级减伤（不占静态池 30% 上限）+
 *     convertHealToRevive machine['reviveConvertBonusPp'] 墓碑转化 +20pp
 *   · P1-6 R-8 共享上限：sharedSummonCount 边界 + stepHorn externalOccupants 占位
 *
 * 分层纪律：全部为运行时用例（纯函数/状态机），不依赖 Phaser 场景。
 */

import { describe, it, expect } from 'vitest';
import { emptyStatusState } from '@/combat/status/status-engine';
import type { ExclusiveTarget } from '@/weapons/exclusive/exclusive-math';
import {
  createTwinbladesState, stepTwinblades,
  createAxeState, stepAxe,
  createHornState, stepHorn,
} from '@/weapons/exclusive/exclusive-math';
import { PlayerStats } from '@/player/player-stats';
import { createOathkeeperState, convertHealToRevive } from '@/weapons/companion/oathkeeper';
import {
  resonanceTwinbladesDamageMult,
  resonanceAxeDamageMult, createResonanceDragState, onResonanceChainHit,
  resonanceSanctuaryBonus,
  sharedSummonCount,
} from '@/weapons/resonance/resonance-math';

// ============================================================================
// 测试替身
// ============================================================================

function makeTarget(hp = 1000, x = 90, opts: Partial<ExclusiveTarget> = {}): ExclusiveTarget {
  const t = {
    active: true, x, y: 0, radius: 14, hp,
    cc: emptyStatusState(),
    kill() { t.hp = 0; },
    ...opts,
  };
  return t as ExclusiveTarget;
}

function makePlayer(hp = 100, maxHp = 100): { x: number; y: number; hp: number; maxHp: number } {
  return { x: 0, y: 0, hp, maxHp };
}

/** R-3 印记载荷（status-engine 口径：vulnerable source='resonance_R3'） */
function markR3(t: ExclusiveTarget, value = 0.15, until = 10): void {
  t.cc!.vulnerable = { until, value, source: 'resonance_R3' };
}

// ============================================================================
// P1-3 · R-3 印记 ×1.2（双刃主斩乘区）
// ============================================================================

describe('NV-REVIEW-FIX E · P1-3 R-3 印记 ×1.2（stepTwinblades 主斩）', () => {
  it('主斩对 R-3 印记目标 ×1.2（默认 machine 锚）；无 machine 覆写', () => {
    const player = makePlayer();
    // 对照：无印记
    const plain = makeTarget(1000);
    const s0 = createTwinbladesState();
    const r0 = stepTwinblades(s0, 0.01, 0, player, [plain], 1, {});
    expect(r0.damageDealt).toBeCloseTo(6); // damage 6 × 1（无易伤）

    // 印记目标：6 × 1.2（mark）× 1.15（vulnerable 增伤）= 8.28
    const marked = makeTarget(1000);
    markR3(marked);
    const s1 = createTwinbladesState();
    const r1 = stepTwinblades(s1, 0.01, 0, player, [marked], 1, {});
    expect(r1.damageDealt).toBeCloseTo(6 * 1.2 * 1.15);
  });

  it('machine 覆写 twinbladesMarkMult 可调；非 R-3 来源易伤不加成', () => {
    const player = makePlayer();
    // 覆写 1.5 → 6 × 1.5 × 1.15
    const m15 = makeTarget(1000);
    markR3(m15);
    const sA = createTwinbladesState();
    const rA = stepTwinblades(sA, 0.01, 0, player, [m15], 1, { twinbladesMarkMult: 1.5 });
    expect(rA.damageDealt).toBeCloseTo(6 * 1.5 * 1.15);

    // 非 R-3 来源（dv_*）→ 乘区恒 1（6 × 1.15）
    const other = makeTarget(1000);
    other.cc!.vulnerable = { until: 10, value: 0.15, source: 'dv_revolver_burst' };
    const sB = createTwinbladesState();
    const rB = stepTwinblades(sB, 0.01, 0, player, [other], 1, {});
    expect(rB.damageDealt).toBeCloseTo(6 * 1.15);
  });

  it('印记过期（until 已过）不加成（未共鸣形态零变化）', () => {
    const player = makePlayer();
    const t = makeTarget(1000);
    markR3(t, 0.15, -1); // until = -1（已过期）
    const s = createTwinbladesState();
    const r = stepTwinblades(s, 0.01, 0, player, [t], 1, {});
    expect(r.damageDealt).toBeCloseTo(6);
    expect(resonanceTwinbladesDamageMult(t, 0, {})).toBe(1);
  });
});

// ============================================================================
// P1-4 · R-7 拖拽真位移落点 + 斧 ×1.5
// ============================================================================

describe('NV-REVIEW-FIX E · P1-4 R-7 斧对被拖拽者 ×1.5（喂食即耗）', () => {
  it('stepAxe 对 drag.dragged 目标 ×1.5；挥击结算后拖拽标记消费', () => {
    const player = makePlayer();
    const drag = createResonanceDragState();

    // 对照：无 drag → 26（cc 空，乘区 1）
    const plain = makeTarget(1000);
    const s0 = createAxeState();
    const r0 = stepAxe(s0, 0.01, 0, player, [plain], 1, {});
    expect(r0.damageDealt).toBeCloseTo(26);

    // 被拖拽者：26 × 1.5 = 39；结算后 dragged 清空（一次性喂食）
    const dragged = makeTarget(1000);
    drag.dragged = dragged;
    const s1 = createAxeState();
    const r1 = stepAxe(s1, 0.01, 0, player, [dragged], 1, {}, () => {}, () => {}, drag);
    expect(r1.damageDealt).toBeCloseTo(26 * 1.5);
    expect(drag.dragged).toBeNull();

    // 下一击（标记已消费）恢复 ×1
    const s2 = createAxeState();
    const r2 = stepAxe(s2, 0.01, 0, player, [dragged], 1, {}, () => {}, () => {}, drag);
    expect(r2.damageDealt).toBeCloseTo(26);
  });

  it('drag 标记指向其他目标时 ×1（resonanceAxeDamageMult 引用匹配）', () => {
    const player = makePlayer();
    const drag = createResonanceDragState();
    const other = makeTarget(1000, 60);
    const target = makeTarget(1000, 90);
    drag.dragged = other;
    const s = createAxeState();
    const r = stepAxe(s, 0.01, 0, player, [target], 1, {}, () => {}, () => {}, drag);
    expect(r.damageDealt).toBeCloseTo(26);
    expect(resonanceAxeDamageMult(target, drag, {})).toBe(1);
  });

  it('onResonanceChainHit 返回拖拽落点（玩家位 = 巨斧弧心；超程返回 null）', () => {
    const player = { x: 0, y: 0 };
    const drag = createResonanceDragState();
    const near = makeTarget(1000, 90);
    const p1 = onResonanceChainHit(drag, near, player, {});
    expect(p1).toEqual({ x: 0, y: 0 }); // 真位移落点（updateChain 据此写 enemy 坐标）
    expect(drag.dragged).toBe(near);

    const far = makeTarget(1000, 400); // dragRange 200 外
    expect(onResonanceChainHit(drag, far, player, {})).toBeNull();
  });
});

// ============================================================================
// P1-5 · R-5 圣域重叠区 DR + 墓碑转化 +20pp
// ============================================================================

describe('NV-REVIEW-FIX E · P1-5 R-5 圣域重叠区（dynamicDamageReductionPct）', () => {
  it('resonanceSanctuaryBonus 锚值：DR 18% / 墓碑转化 +20pp（machine 覆写可调）', () => {
    expect(resonanceSanctuaryBonus({})).toEqual({ damageReductionPct: 0.18, reviveConvertBonusPp: 20 });
    expect(resonanceSanctuaryBonus({ damageReductionPct: 0.25, reviveConvertBonusPp: 30 })).toEqual({
      damageReductionPct: 0.25,
      reviveConvertBonusPp: 30,
    });
  });

  it('PlayerStats.dynamicDamageReductionPct 生效且不占静态池 30% 上限', () => {
    const stats = new PlayerStats();
    // 基线：无减免
    expect(stats.absorbDamage(100)).toBeCloseTo(100);
    // 动态 18% → 82
    stats.dynamicDamageReductionPct = 0.18;
    expect(stats.absorbDamage(100)).toBeCloseTo(82);
    // 静态池打满 30% 后仍独立加算：0.3 + 0.18 = 0.48 → 52
    stats.addDamageReduction(0.3);
    expect(stats.addDamageReduction(0.1), '静态池 30% 上限保护').toBeUndefined();
    expect(stats.damageReduction).toBeCloseTo(0.3);
    expect(stats.absorbDamage(100)).toBeCloseTo(52);
  });
});

describe('NV-REVIEW-FIX E · P1-5 R-5 墓碑转化 +20pp（reviveConvertBonusPp）', () => {
  it('convertHealToRevive：machine +20pp 后速率 0.5→0.7（与 mc_bell_2 覆写独立叠加）', () => {
    // 对照组：无 pp → 进度 = 2 × 0.5 × 100/20 = 5
    const a = createOathkeeperState();
    a.phase = 'tombstone';
    convertHealToRevive(a, 2);
    expect(a.reviveProgress).toBeCloseTo(5);

    // 实验组：+20pp → 2 × 0.7 × 100/20 = 7
    const b = createOathkeeperState();
    b.phase = 'tombstone';
    b.machine['reviveConvertBonusPp'] = 20;
    convertHealToRevive(b, 2);
    expect(b.reviveProgress).toBeCloseTo(7);

    // 质变卡覆写 rate 0.7 叠加 pp → 0.9（2 HP 治疗 → 9）
    const c = createOathkeeperState();
    c.phase = 'tombstone';
    c.machine['reviveConvertRate'] = 0.7;
    c.machine['reviveConvertBonusPp'] = 20;
    convertHealToRevive(c, 2);
    expect(c.reviveProgress).toBeCloseTo(9);
  });
});

// ============================================================================
// P1-6 · R-8 狼群誓约共享召唤上限
// ============================================================================

describe('NV-REVIEW-FIX E · P1-6 R-8 共享召唤上限（sharedSummonCount）', () => {
  it('边界：月狼+猎犬合计 ≤ maxWolves；满员锁存请求（latchedRequest）', () => {
    // hound 参数 = 猎犬已入场占位（月狼请求方视角）；猎犬请求方视角传 false（wolves = 已在场月狼数）
    expect(sharedSummonCount(0, false, 2)).toEqual({ canSummonWolf: true, latchedRequest: false });
    expect(sharedSummonCount(1, false, 2)).toEqual({ canSummonWolf: true, latchedRequest: false });
    expect(sharedSummonCount(1, true, 2)).toEqual({ canSummonWolf: false, latchedRequest: true }); // 猎犬占位后月狼满
    expect(sharedSummonCount(2, false, 2)).toEqual({ canSummonWolf: false, latchedRequest: true });
  });

  it('stepHorn externalOccupants：猎犬占 1 席 → 月狼最多 maxWolves-1', () => {
    const player = makePlayer();
    const enemies = [makeTarget(1000, 90)];

    // 对照：无外部占位 → 吹两次满 2 狼（summonInterval 12，手动清 timer 模拟连续吹号）
    const free = createHornState();
    stepHorn(free, 0.01, 0, player, enemies, 1, {});
    free.summonTimer = 0;
    stepHorn(free, 0.01, 0.01, player, enemies, 1, {});
    expect(free.wolves).toHaveLength(2);

    // 猎犬在场（occupants=1）→ 只召 1 狼（1+1 = 2 不 < 2）
    const shared = createHornState();
    stepHorn(shared, 0.01, 0, player, enemies, 1, {}, 1);
    shared.summonTimer = 0;
    stepHorn(shared, 0.01, 0.01, player, enemies, 1, {}, 1);
    expect(shared.wolves).toHaveLength(1);
  });
});
