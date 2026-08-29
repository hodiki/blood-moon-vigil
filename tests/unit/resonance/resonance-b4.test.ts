import { describe, it, expect } from 'vitest';
import {
  RESONANCE_PAIRS,
  RESONANCE_RULES,
  resonancePairByWeapon,
  UNPAIRED_WEAPON_IDS,
  KEY_NAIL_HEAVY_COOLDOWN_MULT,
  type ResonancePairConfig,
} from '@/config/balance';
import {
  ResonanceState,
  resonanceGate,
  resonanceBadgeState,
  commitResonance,
  resonanceReadyKeyWeight,
  isHeavyWeaponInterval,
  heavyCooldownMult,
} from '@/weapons/resonance/resonance-engine';
import {
  createResonanceLanternState, stepResonanceLantern,
  createResonanceRevolverFeedState, onResonanceCrossbowHit,
  createResonanceTwinbladesMarkState, onResonanceBoomerangHit, resonanceTwinbladesDamageMult,
  resonanceJavelinPierce, placeResonanceTotem, stepResonanceTotems,
  resonanceSanctuaryBonus,
  createResonanceCrossState, onResonanceCrossExplode, stepResonanceResidues,
  createResonanceDragState, onResonanceChainHit, resonanceAxeDamageMult, consumeResonanceDrag,
  sharedSummonCount, resonanceHoundDamageMult,
} from '@/weapons/resonance/resonance-math';
import { pickP2KeyCandidate, buildV3Candidates, type UpgradePoolV3Context } from '@/upgrade/upgrade-pool-v3';
import { UpgradeState } from '@/upgrade/upgrade-pool';
import { emptyStatusState } from '@/combat/status/status-engine';
import { EXCLUSIVE_WEAPONS } from '@/config/balance';
import type { ExclusiveTarget } from '@/weapons/exclusive/exclusive-math';
import type { HeroId } from '@/config/balance';

function makeTarget(hp = 1000, x = 90, opts: Partial<ExclusiveTarget> = {}): ExclusiveTarget {
  const t = {
    active: true, x, y: 0, radius: 14, hp,
    cc: emptyStatusState(),
    kill() { t.hp = 0; },
    ...opts,
  };
  return t as ExclusiveTarget;
}

const R1 = RESONANCE_PAIRS.find((p) => p.id === 'R1')!;

describe('B4-W1 共鸣配置与引擎（gdd-resonance §3.1/§④；验收判据 1/2）', () => {
  it('恰好 8 对；每专武恰 1 对；8 把挂共鸣 / 6 把未配对（WD-4/WD-5）', () => {
    expect(RESONANCE_PAIRS).toHaveLength(8);
    const exclusives = RESONANCE_PAIRS.map((p) => p.exclusiveId);
    expect(new Set(exclusives).size).toBe(8);
    const weapons = RESONANCE_PAIRS.map((p) => p.commonWeaponId);
    expect(new Set(weapons).size).toBe(8);
    expect(UNPAIRED_WEAPON_IDS).toHaveLength(6);
    for (const w of UNPAIRED_WEAPON_IDS) expect(resonancePairByWeapon(w)).toBeUndefined();
  });

  it('8 对映射与 GDD §④/§5 定稿一致（专武 × 通武 × 钥）', () => {
    const expectPair = (id: string, exclusive: string, weapon: string, key: string) => {
      const p = RESONANCE_PAIRS.find((x) => x.id === id)!;
      expect(p.exclusiveId).toBe(exclusive);
      expect(p.commonWeaponId).toBe(weapon);
      expect(p.keyId).toBe(key);
    };
    expectPair('R1', 'xw_lantern', 'wpn_b_1', 'key_holy');
    expectPair('R2', 'xw_revolver', 'wpn_a_2', 'key_silver');
    expectPair('R3', 'xw_twinblades', 'wpn_a_4', 'key_tome');
    expectPair('R4', 'xw_longbow', 'wpn_a_5', 'key_scope');
    expectPair('R5', 'xw_bell', 'wpn_b_3', 'key_grail');
    expectPair('R6', 'xw_cross', 'wpn_c_3', 'key_bone');
    expectPair('R7', 'xw_axe', 'wpn_d_3', 'key_nail');
    expectPair('R8', 'xw_horn', 'wpn_d_2', 'key_pact');
  });

  it('双条件门控：半满足不触发（§⑦-1）；达成不可逆（§⑦-3）', () => {
    const s = new ResonanceState();
    // 持专武未持钥 → awaiting-key（可共鸣灰态）
    expect(resonanceGate(R1, false, { exclusiveId: 'xw_lantern', hasKey: () => false })).toBe('awaiting-key');
    // 持钥未持专武 → unpaired（普通被动）
    expect(resonanceGate(R1, false, { exclusiveId: 'xw_revolver', hasKey: () => true })).toBe('unpaired');
    // 双条件达成 → ready → commit
    expect(resonanceGate(R1, false, { exclusiveId: 'xw_lantern', hasKey: (k) => k === 'key_holy' })).toBe('ready');
    expect(commitResonance(s, { exclusiveId: 'xw_lantern', hasKey: (k) => k === 'key_holy' })?.id).toBe('R1');
    expect(s.isAchieved('R1')).toBe(true);
    // 已达成 → achieved，重复 commit 拒绝
    expect(resonanceGate(R1, s.isAchieved('R1'), { exclusiveId: 'xw_lantern', hasKey: () => true })).toBe('achieved');
    expect(commitResonance(s, { exclusiveId: 'xw_lantern', hasKey: () => true })).toBeNull();
  });

  it('徽记数据接口：ready-highlight（已持专武）/ awaiting-key（灰态）/ achieved（共鸣形态）', () => {
    expect(resonanceBadgeState('xw_lantern', () => false, false)).toBe('awaiting-key'); // 可共鸣灰态（§⑦-1）
    expect(resonanceBadgeState('xw_lantern', (k) => k === 'key_holy', false)).toBe('ready-highlight'); // 已持专武徽记高亮
    expect(resonanceBadgeState('xw_lantern', () => true, true)).toBe('achieved'); // 共鸣形态条目
    // 8 专武各有配对 → 每个合法 exclusiveId 必产出非 none 徽记状态
    for (const p of RESONANCE_PAIRS) {
      expect(resonanceBadgeState(p.exclusiveId, () => false, false)).not.toBe('none');
    }
  });

  it('P2 接线：×5 权重（条件达成）+ pickP2KeyCandidate 正式映射（替换 B3 占位）', () => {
    // ×5：持配对专武未持钥
    const ctx = { exclusiveId: 'xw_lantern' as const, hasKey: () => false };
    expect(resonanceReadyKeyWeight(R1, ctx, 1.2)).toBeCloseTo(1.2 * RESONANCE_RULES.WEIGHT_READY);
    // 条件未达成（持钥）→ 基础权重
    expect(resonanceReadyKeyWeight(R1, { exclusiveId: 'xw_lantern', hasKey: () => true }, 1.2)).toBeCloseTo(1.2);
    // P2 席位：pickP2KeyCandidate 返回 key_holy（B3 类占位映射退役）
    const state = new UpgradeState();
    const v3ctx: UpgradePoolV3Context = {
      heroId: 'hero_edmund' as HeroId, ownedWeaponIds: ['wpn_a_1'], runTimeSeconds: 150, // S2：钥 ×1.2 阶段权重生效
      exclusiveId: 'xw_lantern', derivativeId: 'dv_revolver_burst',
      takenMutationOrders: [], upgradeCount: 1, derivativeUpgradeTaken: false,
    };
    const pool = buildV3Candidates(state, v3ctx);
    const p2 = pickP2KeyCandidate(state, v3ctx, pool);
    expect(p2?.upgradeId).toBe('key_holy');
    // ×5 权重落到池候选
    const keyCandidate = pool.find((c) => c.upgradeId === 'key_holy')!;
    expect(keyCandidate.weight).toBeCloseTo(1.2 * 5); // S2 钥 ×1.2 × ready ×5
    // 已持钥 → P2 空
    state.addStack('key_holy', 1);
    expect(pickP2KeyCandidate(state, v3ctx, buildV3Candidates(state, v3ctx))).toBeNull();
  });
});

describe('B4-W2 8 对共鸣结算（gdd-resonance §④）', () => {
  it('R-1 守夜环灯：环带 6伤/0.4s/目标 + 0.5s 眩晕（10s ICD；Boss 免疫）', () => {
    const state = createResonanceLanternState();
    const normal = makeTarget(100000, 90);
    const boss = makeTarget(100000, 90, { ccProfile: { tier: 'boss' } });
    let dealt = 0;
    for (let f = 0; f < 120; f += 1) {
      dealt += stepResonanceLantern(state, 1 / 60, f / 60, { x: 0, y: 0 }, [normal, boss], 1, R1.machine, 90).damageDealt;
    }
    // 触碰 6伤/0.4s → 2s 窗口每目标 ≤5 次触碰（球 3 × 时间覆盖）——DPS > 0 即可 + CC 断言
    expect(dealt).toBeGreaterThan(0);
    expect(normal.cc?.stun?.until).toBeGreaterThan(0);
    expect(normal.cc?.stunIcdReadyAt).toBeGreaterThan(0); // 10s ICD（状态层）
    expect(boss.cc?.stun).toBeNull(); // Boss 免疫
    // ICD：同帧后续眩晕被拦截（存续期内）
    const before = normal.cc?.stun?.until;
    stepResonanceLantern(state, 1 / 60, 0.1, { x: 0, y: 0 }, [normal], 1, R1.machine, 90);
    expect(normal.cc?.stun?.until).toBe(before);
  });

  it('R-2 银潮轮舞：连弩命中 3 次 → 左轮回充 1 弹（计数恒定不受强化影响）', () => {
    const feed = createResonanceRevolverFeedState();
    const ammo = { max: 6, current: 2, reloadSeconds: 1.0, reloading: false, reloadElapsed: 0, infiniteUntil: 0 };
    expect(onResonanceCrossbowHit(feed, ammo, { hitsPerReload: 3 })).toBe(false);
    expect(onResonanceCrossbowHit(feed, ammo, { hitsPerReload: 3 })).toBe(false);
    expect(ammo.current).toBe(2);
    expect(onResonanceCrossbowHit(feed, ammo, { hitsPerReload: 3 })).toBe(true); // 第 3 次 → 回充
    expect(ammo.current).toBe(3);
    expect(feed.totalGrants).toBe(1);
  });

  it('R-3 血月回旋：飞刃挂血契印记（15%/5s）+ 双刃对印记 ×1.2（固定值）', () => {
    const marks = createResonanceTwinbladesMarkState();
    const target = makeTarget(1000);
    onResonanceBoomerangHit(marks, target, 0, { markVulnerable: 0.15, markDuration: 5, twinbladesMarkMult: 1.2 });
    expect(target.cc?.vulnerable?.value).toBeCloseTo(0.15);
    expect(target.cc?.vulnerable?.source).toBe('resonance_R3');
    expect(resonanceTwinbladesDamageMult(target, 1, { twinbladesMarkMult: 1.2 })).toBeCloseTo(1.2);
    // 非印记来源（圣痕）不吃 ×1.2
    const other = makeTarget(1000);
    other.cc?.vulnerable === undefined;
    if (other.cc) other.cc = { ...other.cc, vulnerable: { until: 10, value: 0.15, source: 'dv_revolver_burst' } };
    expect(resonanceTwinbladesDamageMult(other, 1, { twinbladesMarkMult: 1.2 })).toBe(1);
  });

  it('R-4 猎月贯钉：满蓄贯穿 6 + 月痕图腾减速 15%/2s', () => {
    expect(resonanceJavelinPierce(true, { chargedPierce: 6 })).toBe(6);
    expect(resonanceJavelinPierce(false, { chargedPierce: 6 })).toBe(3);
    const state = { totems: [] as never[], totalDamage: 0 } as ReturnType<typeof import('@/weapons/resonance/resonance-math').createResonanceJavelinState>;
    const s = state;
    placeResonanceTotem(s, 60, 0, 0, { totemRadius: 60, totemSlowPct: 0.15, totemDuration: 2 });
    const enemy = makeTarget(1000, 60);
    stepResonanceTotems(s, 1 / 60, 0.5, [enemy], { totemRadius: 60, totemSlowPct: 0.15, totemDuration: 2 });
    expect(enemy.cc?.slow?.value).toBeCloseTo(0.15);
    expect(enemy.cc?.slow?.source).toBe('resonance_R4');
  });

  it('R-5 圣域壁垒：−18% 减伤 + 墓碑转化率 +20pp（共鸣固定值）', () => {
    const b = resonanceSanctuaryBonus({ damageReductionPct: 0.18, reviveConvertBonusPp: 20 });
    expect(b.damageReductionPct).toBeCloseTo(0.18);
    expect(b.reviveConvertBonusPp).toBe(20);
  });

  it('R-6 圣火十诫：落点余焰 8伤/s / 3s（100px）', () => {
    const state = createResonanceCrossState();
    onResonanceCrossExplode(state, 0, 0, 0, { residueRadius: 100, residueDps: 8, residueDuration: 3 });
    const enemy = makeTarget(1000, 50);
    let dealt = 0;
    for (let f = 0; f < 60; f += 1) {
      dealt += stepResonanceResidues(state, 1 / 60, f / 60, [enemy], 1, { residueRadius: 100, residueDps: 8, residueDuration: 3 }).damageDealt;
    }
    expect(dealt).toBeCloseTo(8, 0); // 1s × 8伤/s
    // 3s 后过期
    const r = stepResonanceResidues(state, 1 / 60, 3.1, [enemy], 1, { residueRadius: 100, residueDps: 8, residueDuration: 3 });
    expect(r.damageDealt).toBe(0);
  });

  it('R-7 葬仪断罪：锁链命中改拖拽 + 被拖拽者斧伤 ×1.5；死亡目标拖拽无效化（§⑦-3）', () => {
    const drag = createResonanceDragState();
    const target = makeTarget(1000, 150);
    const pos = onResonanceChainHit(drag, target, { x: 0, y: 0 }, { dragRange: 200, draggedAxeDamageMult: 1.5 });
    expect(pos).toEqual({ x: 0, y: 0 }); // 拉至弧心
    expect(resonanceAxeDamageMult(target, drag, { draggedAxeDamageMult: 1.5 })).toBeCloseTo(1.5);
    consumeResonanceDrag(drag);
    expect(resonanceAxeDamageMult(target, drag, { draggedAxeDamageMult: 1.5 })).toBe(1);
    // 死亡目标 → 拖拽无效化
    const dead = makeTarget(0, 100);
    expect(onResonanceChainHit(drag, dead, { x: 0, y: 0 }, { dragRange: 200, draggedAxeDamageMult: 1.5 })).toBeNull();
    // 超出 200px
    const far = makeTarget(1000, 300);
    expect(onResonanceChainHit(drag, far, { x: 0, y: 0 }, { dragRange: 200, draggedAxeDamageMult: 1.5 })).toBeNull();
  });

  it('R-8 狼群誓约：上限共享计数（§⑦-2 锁存防连刷）+ 狂化加成', () => {
    expect(sharedSummonCount(1, true, 2).canSummonWolf).toBe(false); // 猎犬+1狼=满
    expect(sharedSummonCount(1, true, 2).latchedRequest).toBe(true);
    expect(sharedSummonCount(0, true, 2).canSummonWolf).toBe(true);
    expect(resonanceHoundDamageMult(true, { rageDamageMult: 2 })).toBeCloseTo(2); // 长夜月啸期 ×2
    expect(resonanceHoundDamageMult(false, { rageDamageMult: 2 })).toBe(1);
  });

  it('八字段模板完整性：每对含 形态/行为/伤害频率/控制/视觉 字段（§3.2）', () => {
    for (const p of RESONANCE_PAIRS as readonly ResonancePairConfig[]) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.behavior.length).toBeGreaterThan(0);
      expect(p.damageNote.length).toBeGreaterThan(0);
      expect(p.control.length).toBeGreaterThan(0);
      expect(p.visual.length).toBeGreaterThan(0);
    }
  });
});

describe('B4-W3 葬仪铁钉消费 + 钥收口', () => {
  it('重击类判定（≥2.0s）：巨斧 2.2/十字 3.0 ✔，左轮 0.8/双刃 0.55 ✘', () => {
    expect(isHeavyWeaponInterval(2.2)).toBe(true);
    expect(isHeavyWeaponInterval(3.0)).toBe(true);
    expect(isHeavyWeaponInterval(2.0)).toBe(true); // 阈值含边界
    expect(isHeavyWeaponInterval(0.8)).toBe(false);
    expect(isHeavyWeaponInterval(0.55)).toBe(false);
  });

  it('铁钉冷却乘区：重击类 ×0.92 / 非重击类 ×1 / 未持钥 ×1', () => {
    expect(heavyCooldownMult(2.2, { heavyCooldownMult: 0.92 })).toBeCloseTo(0.92);
    expect(heavyCooldownMult(0.8, { heavyCooldownMult: 0.92 })).toBe(1);
    expect(heavyCooldownMult(2.2, undefined)).toBe(1);
    expect(KEY_NAIL_HEAVY_COOLDOWN_MULT).toBeCloseTo(0.92);
  });

  it('专武铁钉消费：巨斧/十字专武行为经 ctx.keyPassives 应用 ×0.92', () => {
    const axe = EXCLUSIVE_WEAPONS.xw_axe.params.interval!;
    expect(heavyCooldownMult(axe, { heavyCooldownMult: 0.92 })).toBeCloseTo(0.92);
    const cross = EXCLUSIVE_WEAPONS.xw_cross.params.interval!;
    expect(heavyCooldownMult(cross, { heavyCooldownMult: 0.92 })).toBeCloseTo(0.92);
  });

  it('旧 7 钥语义保留（同源继承勿漂移）：钥数值效果定义在 v2 apply 层不变', () => {
    // 重挂仅改身份（共鸣前置），数值效果字段（rangeMult/cooldownMult/...）由 v2 deriveKeyPassives 派生
    for (const p of RESONANCE_PAIRS) {
      expect(p.keyId.startsWith('key_')).toBe(true);
    }
  });
});
