import { describe, it, expect } from 'vitest';
import {
  UPGRADE_POOL_V3,
  UPGRADE_POOL_V3_GLOBAL,
  UPGRADE_POOL_V3_MUTATION_1,
  UPGRADE_POOL_V3_MUTATION_2,
  UPGRADE_POOL_V3_KEYS,
  UPGRADE_POOL_V3_WEAPON,
  UPGRADE_POOL_V3_WEAPON_COMMON,
  UPGRADE_POOL_V3_ACTIVE,
  UPGRADE_POOL_V3_LIMITS,
  UPGRADE_POOL_V3_RULES,
  MUTATION_PIPELINE_DEFAULTS,
  DERIVATIVE_UPGRADE_MAP,
  KEY_NAIL_HEAVY_COOLDOWN_MULT,
  MUTATION_CARDS,
} from '@/config/balance';
import { UPGRADE_POOL } from '@/config/balance';
import { buildV3Candidates, rollThreeV3, pickGuaranteeCandidateV3, pickP2KeyCandidate, type UpgradePoolV3Context } from '@/upgrade/upgrade-pool-v3';
import { applyUpgradeByIdV3, COMMON_ENHANCEMENT_PER_STACK, type UpgradeV3WriteTargets } from '@/upgrade/upgrade-apply-v3';
import {
  createMutationPipeline, defaultMutationChannels, takeCard1,
  onEliteKilled, onEliteChestOpened, onUpgradeChosenForPipeline, card2Ready, checkBeats,
} from '@/upgrade/mutation-pipeline';
import { UpgradeState } from '@/upgrade/upgrade-pool';
import type { HeroId, WeaponId } from '@/config/balance';

/** 测试上下文工厂（守夜人默认；xw_lantern → dv_revolver_burst） */
function makeCtx(overrides: Partial<UpgradePoolV3Context> = {}): UpgradePoolV3Context {
  return {
    heroId: 'hero_edmund' as HeroId,
    ownedWeaponIds: ['wpn_a_1'],
    runTimeSeconds: undefined,
    exclusiveId: 'xw_lantern',
    derivativeId: 'dv_revolver_burst',
    takenMutationOrders: [],
    upgradeCount: 1,
    derivativeUpgradeTaken: false,
    ...overrides,
  };
}

function makeState(): UpgradeState {
  return new UpgradeState();
}

describe('B3-W1 池构成（gdd-upgrade-pool-v3 §3.1/§4；验收判据 1/3）', () => {
  it('全局 9 全量继承 v2 §3.1（同对象引用，迁移不改值防双源漂移）', () => {
    expect(UPGRADE_POOL_V3_GLOBAL).toHaveLength(9);
    const v2Globals = UPGRADE_POOL.filter((u) => u.id.startsWith('up_g_'));
    for (let i = 0; i < v2Globals.length; i += 1) {
      expect(UPGRADE_POOL_V3_GLOBAL[i]).toBe(v2Globals[i]); // 同一对象引用
    }
  });

  it('质变卡 16 条数据（8 专武 × 卡1/卡2）；卡 2 与 MUTATION_CARDS 参数同源', () => {
    expect(UPGRADE_POOL_V3_MUTATION_1).toHaveLength(8);
    expect(UPGRADE_POOL_V3_MUTATION_2).toHaveLength(8);
    const card = UPGRADE_POOL_V3_MUTATION_1[0]!;
    const mc = MUTATION_CARDS.find((c) => c.id === card.id)!;
    expect(card.name).toBe(mc.name);
    expect(card.desc).toBe(mc.desc);
  });

  it('共鸣钥 8：旧 7 同源 + 葬仪铁钉新增（重击类冷却 ×0.92 锚）', () => {
    expect(UPGRADE_POOL_V3_KEYS).toHaveLength(8);
    expect(UPGRADE_POOL_V3_KEYS.map((k) => k.id)).toContain('key_nail');
    const v2Keys = UPGRADE_POOL.filter((u) => u.id.startsWith('key_'));
    for (const vk of v2Keys) expect(UPGRADE_POOL_V3_KEYS.find((k) => k.id === vk.id)).toBe(vk);
    expect(KEY_NAIL_HEAVY_COOLDOWN_MULT).toBeCloseTo(0.92);
  });

  it('通武强化 10 = v2 前两分支 8（同源）+ 通用 2（×2 叠加）', () => {
    expect(UPGRADE_POOL_V3_WEAPON).toHaveLength(8);
    expect(UPGRADE_POOL_V3_WEAPON_COMMON).toHaveLength(2);
    for (const item of [...UPGRADE_POOL_V3_WEAPON, ...UPGRADE_POOL_V3_WEAPON_COMMON]) {
      expect(UPGRADE_POOL_V3.find((u) => u.id === item.id)).toBe(item);
    }
  });

  it('主动技强化 8 定义（单局仅当前衍生技 1 张进池——NW-4）', () => {
    expect(UPGRADE_POOL_V3_ACTIVE).toHaveLength(8);
    expect(Object.keys(DERIVATIVE_UPGRADE_MAP)).toHaveLength(8);
    for (const d of Object.keys(DERIVATIVE_UPGRADE_MAP)) {
      expect(UPGRADE_POOL_V3_ACTIVE.some((a) => a.id === DERIVATIVE_UPGRADE_MAP[d as keyof typeof DERIVATIVE_UPGRADE_MAP])).toBe(true);
    }
  });

  it('池规模红线：定义 37 落 32~40 区间（NW-7）；数据条目 = 9+16+8+10+8 = 51', () => {
    expect(UPGRADE_POOL_V3_LIMITS.DEFINED).toBe(37);
    expect(UPGRADE_POOL_V3_LIMITS.PER_RUN_MAX).toBe(30);
    const [lo, hi] = UPGRADE_POOL_V3_LIMITS.DEFINED_REDLINE;
    expect(37).toBeGreaterThanOrEqual(lo);
    expect(37).toBeLessThanOrEqual(hi);
    // 数据条目口径（专武 16 条全量在表，定义按单局当前专武 2 计）
    expect(UPGRADE_POOL_V3).toHaveLength(9 + 16 + 8 + 8 + 2 + 8);
  });

  it('反例红线：圣物不进池；池无 evo_ 进化卡（R2-3 废止）', () => {
    for (const item of UPGRADE_POOL_V3) {
      expect(item.id.startsWith('relic_')).toBe(false);
      expect(item.id.startsWith('evo_')).toBe(false);
    }
  });

  it('单局可选 ≤30：默认上下文构建候选池（9 全局 + 1 质变卡 + 8 钥 + 8 通武强化(持 A 类) + 1 主动技 = 27）', () => {
    const ctx = makeCtx({ ownedWeaponIds: ['wpn_a_1'] });
    const pool = buildV3Candidates(makeState(), ctx);
    expect(pool.length).toBeLessThanOrEqual(UPGRADE_POOL_V3_LIMITS.PER_RUN_MAX);
    // 持有 A 类（飞弹）→ A1/A2 以强化形态出现；B/C/D 未持有但有可解锁武器 → 解锁变体 6 项 + 通用 2
    expect(pool.length).toBe(9 + 1 + 8 + (2 + 6 + 2) + 1);
    // 卡 2 不进三选一（赠送制，验收判据 4）
    expect(pool.some((c) => c.upgradeId === 'mc_lantern_2')).toBe(false);
  });

  it('非当前专武质变卡不入池（反例红线）', () => {
    const pool = buildV3Candidates(makeState(), makeCtx());
    expect(pool.some((c) => c.upgradeId?.startsWith('mc_') && c.upgradeId !== 'mc_lantern_1')).toBe(false);
  });
});

describe('B3-W2 P1~P5 保底序列（WD-13；验收判据 2）', () => {
  it('P1：质变卡 1 在 30~60s 窗口内命中席位；窗口外不出现；全局限 1', () => {
    const state = makeState();
    // 窗口内（45s）→ P1 = mc_lantern_1
    const inside = pickGuaranteeCandidateV3(state, makeCtx({ runTimeSeconds: 45 }), buildV3Candidates(state, makeCtx({ runTimeSeconds: 45 })));
    expect(inside?.upgradeId).toBe('mc_lantern_1');
    // 窗口外（20s / 61s）→ P1 不出现（保底落到 P3 通武强化）
    const early = pickGuaranteeCandidateV3(state, makeCtx({ runTimeSeconds: 20 }), buildV3Candidates(state, makeCtx({ runTimeSeconds: 20 })));
    expect(early?.upgradeId).not.toBe('mc_lantern_1');
    const late = pickGuaranteeCandidateV3(state, makeCtx({ runTimeSeconds: 61 }), buildV3Candidates(state, makeCtx({ runTimeSeconds: 61 })));
    expect(late?.upgradeId).not.toBe('mc_lantern_1');
    // 已取卡 1 → 不再出现（全局限 1）
    const taken = makeCtx({ runTimeSeconds: 45, takenMutationOrders: [1] });
    const p = pickGuaranteeCandidateV3(state, taken, buildV3Candidates(state, taken));
    expect(p?.upgradeId).not.toBe('mc_lantern_1');
  });

  it('P2：正式 8 对映射（B4-W1 接管 B3 占位）——持配对专武未持钥 → 该对钥入席位；已持钥跳过', () => {
    const state = makeState();
    const ctx = makeCtx({ ownedWeaponIds: ['wpn_a_1', 'wpn_b_1', 'wpn_c_1'] });
    const pool = buildV3Candidates(state, ctx);
    const p2 = pickP2KeyCandidate(state, ctx, pool);
    expect(p2?.upgradeId).toBe('key_holy'); // 当前专武 xw_lantern 配对钥 = 圣辉坠饰（R-1）
    // 取钥后 → P2 跳过（每专武恰 1 对，单候选；WD-4）
    state.addStack('key_holy', 1);
    expect(pickP2KeyCandidate(state, ctx, buildV3Candidates(state, ctx))).toBeNull();
  });

  it('P4：第 8~14 次升级窗口内席位命中当前衍生技强化卡；窗口外/已取不出现（错过不补 §⑧-2）', () => {
    const state = makeState();
    state.addStack('up_w_a1', 2); state.addStack('up_w_a1', 2); // P3 满（叠满 2 层剔除）→ 席位落到 P4
    state.addStack('up_w_a2', 2); state.addStack('up_w_a2', 2);
    state.addStack('key_scope', 1); // P2 满（A 类钥已持）
    state.addStack('key_holy', 1); // B4 正式映射：R-1 钥也持 → P2 完全跳过，席位落 P4
    const inWindow = makeCtx({ upgradeCount: 10, runTimeSeconds: 150 });
    const pool = buildV3Candidates(state, inWindow);
    const p4 = pickGuaranteeCandidateV3(state, inWindow, pool);
    expect(p4?.upgradeId).toBe('up_d_revolver');
    // 窗口外（第 7 次）
    const early = makeCtx({ upgradeCount: 7, runTimeSeconds: 150 });
    const p4early = pickGuaranteeCandidateV3(state, early, buildV3Candidates(state, early));
    expect(p4early?.upgradeId).not.toBe('up_d_revolver');
    // 错过不补：第 15 次
    const missed = makeCtx({ upgradeCount: 15, runTimeSeconds: 150 });
    expect(pickGuaranteeCandidateV3(state, missed, buildV3Candidates(state, missed))?.upgradeId).not.toBe('up_d_revolver');
    // 已取
    state.addStack('up_d_revolver', 1);
    const takenCtx = makeCtx({ upgradeCount: 10, runTimeSeconds: 150, derivativeUpgradeTaken: true });
    expect(pickGuaranteeCandidateV3(state, takenCtx, buildV3Candidates(state, takenCtx))?.upgradeId).not.toBe('up_d_revolver');
  });

  it('同帧席位冲突裁决 P1>P2>P3>P4>P5（§⑧-3 必须实装）', () => {
    const state = makeState();
    state.addStack('up_w_b1', 2);
    const ctx = makeCtx({ ownedWeaponIds: ['wpn_a_1', 'wpn_b_1'], runTimeSeconds: 45, upgradeCount: 10 });
    const pool = buildV3Candidates(state, ctx);
    // 45s 在 P1 窗口 且 P2/P4 条件也满足 → 席位给 P1
    const g = pickGuaranteeCandidateV3(state, ctx, pool);
    expect(g?.upgradeId).toBe('mc_lantern_1');
  });

  it('rollThreeV3：三选一含 1 张保底卡 + 不放回 + 不足回退 up_g_1', () => {
    const state = makeState();
    const ctx = makeCtx({ runTimeSeconds: 45 });
    const opts = rollThreeV3(state, ctx, () => 0.99);
    expect(opts).toHaveLength(3);
    const ids = opts.map((o) => o.upgradeId);
    expect(new Set(ids).size).toBe(3); // 不放回
    expect(opts.some((o) => o.upgradeId === 'mc_lantern_1')).toBe(true); // P1 席位
    expect(opts.every((o) => o.related !== undefined)).toBe(true);
    // 全满级极端 → 回退 up_g_1（§⑧-4 正常收敛）
    const full = makeState();
    for (let i = 0; i < 10; i += 1) for (const item of UPGRADE_POOL_V3) full.addStack(item.id, item.maxStack);
    const fb = rollThreeV3(full, makeCtx());
    expect(fb.every((o) => o.upgradeId === 'up_g_1')).toBe(true);
  });

  it('阶段权重修订：专武卡 S1 ×1.2 / 钥 S2 起 ×1.2 / 数值卡 S1 ×0.5→S3 ×1.2（§3.3）', () => {
    const state = makeState();
    const s1 = buildV3Candidates(state, makeCtx({ runTimeSeconds: 45 }));
    const s2 = buildV3Candidates(state, makeCtx({ runTimeSeconds: 150 }));
    const s3 = buildV3Candidates(state, makeCtx({ runTimeSeconds: 300 }));
    const exclS1 = s1.find((c) => c.upgradeId === 'mc_lantern_1')!.weight;
    expect(exclS1).toBeCloseTo(2 * 1.2); // ×2 × S1 1.2
    const keyS1 = s1.find((c) => c.upgradeId === 'key_scope')!.weight;
    const keyS2 = s2.find((c) => c.upgradeId === 'key_scope')!.weight;
    expect(keyS1).toBe(1); // S1 钥无加成
    expect(keyS2).toBeCloseTo(1.2); // S2 起 ×1.2
    const numS1 = s1.find((c) => c.upgradeId === 'up_g_1')!.weight;
    const numS3 = s3.find((c) => c.upgradeId === 'up_g_1')!.weight;
    expect(numS1).toBeCloseTo(0.5);
    expect(numS3).toBeCloseTo(1.2);
  });

  it('机制型占比 ≥85%（§② 支柱 4）', () => {
    // 定义口径 37：全局 9 + 当前专武 2 + 钥 8 + 通武强化 10 + 主动技 8
    const defs = [
      ...UPGRADE_POOL_V3_GLOBAL,
      ...UPGRADE_POOL_V3_MUTATION_1.filter((m) => m.id === 'mc_lantern_1'),
      ...UPGRADE_POOL_V3_MUTATION_2.filter((m) => m.id === 'mc_lantern_2'), // 卡 2 定义口径计入（获取=赠送，§3.4）
      ...UPGRADE_POOL_V3_KEYS,
      ...UPGRADE_POOL_V3_WEAPON,
      ...UPGRADE_POOL_V3_WEAPON_COMMON,
      ...UPGRADE_POOL_V3_ACTIVE,
    ];
    expect(defs).toHaveLength(37);
    const mech = defs.filter((d) => d.type === 'mechanic').length;
    expect(mech / 37).toBeGreaterThanOrEqual(0.85);
  });
});

describe('B3-W3 质变卡双节拍管线（EG-3 双渠道开关；验收判据 4）', () => {
  it('渠道 1（默认开）：首精英击杀必掉卡 2；卡 1 未取 → 待发队列；一次性', () => {
    const s = createMutationPipeline();
    const ch = defaultMutationChannels();
    // 卡 1 未取 → 入队
    const r1 = onEliteKilled(s, ch, 40, true);
    expect(r1.queued).toBe(true);
    expect(s.card2Pending).toBe(true);
    expect(s.card2Taken).toBe(false);
    // 一次性（第二只精英不再触发）
    const r2 = onEliteKilled(s, ch, 50, true);
    expect(r2.granted).toBe(false);
    expect(r2.queued).toBe(false);
    // 普通敌不触发
    const s2 = createMutationPipeline();
    expect(onEliteKilled(s2, ch, 40, false).queued).toBe(false);
  });

  it('防卡死（§6.1-4）：待发队列中取卡 1 → 立即补发卡 2', () => {
    const s = createMutationPipeline();
    const ch = defaultMutationChannels();
    onEliteKilled(s, ch, 40, true); // 卡 2 入队（卡 1 未取）
    expect(card2Ready(s)).toBe(false); // 顺序解锁：卡 1 未取不可用
    const r = takeCard1(s, 45);
    expect(r.card2Granted).toBe(true); // 立即补发
    expect(s.card2Taken).toBe(true);
    expect(card2Ready(s)).toBe(false); // 已取完
  });

  it('渠道 2（默认开）：距卡 1 后 N=8 次升级直发；未取卡 1 不计数', () => {
    const s = createMutationPipeline();
    const ch = defaultMutationChannels();
    takeCard1(s, 45);
    for (let i = 0; i < 7; i += 1) {
      expect(onUpgradeChosenForPipeline(s, ch, 50 + i).granted).toBe(false);
    }
    expect(onUpgradeChosenForPipeline(s, ch, 58).granted).toBe(true); // 第 8 次
    expect(s.card2Taken).toBe(true);
    // 未取卡 1 不计数
    const s2 = createMutationPipeline();
    for (let i = 0; i < 20; i += 1) onUpgradeChosenForPipeline(s2, ch, i);
    expect(s2.upgradesSinceCard1).toBe(0);
  });

  it('渠道 3（默认关）：精英宝箱开关关闭不授予；开启后授予', () => {
    const s = createMutationPipeline();
    const ch = defaultMutationChannels();
    takeCard1(s, 45);
    expect(onEliteChestOpened(s, ch, 60).granted).toBe(false);
    expect(onEliteChestOpened(s, { ...ch, eliteChest: true }, 60).granted).toBe(true);
  });

  it('开关配置：精英宝箱默认关（怪物域批次开）；首精英/兜底默认开（EG-3）', () => {
    const d = MUTATION_PIPELINE_DEFAULTS;
    expect(d.FIRST_ELITE_DROP).toBe(true);
    expect(d.FALLBACK_N_GRANT).toBe(true);
    expect(d.ELITE_CHEST).toBe(false);
    expect(UPGRADE_POOL_V3_RULES.CARD2_FALLBACK_N).toBe(8);
  });

  it('双节拍时点锚：卡 1 30~60s / 卡 2 90~150s（checkBeats 模拟口径）', () => {
    const [c1lo, c1hi] = UPGRADE_POOL_V3_RULES.CARD1_BEAT;
    const [c2lo, c2hi] = UPGRADE_POOL_V3_RULES.CARD2_BEAT;
    expect([c1lo, c1hi]).toEqual([30, 60]);
    expect([c2lo, c2hi]).toEqual([90, 150]);
    // 管线时点记录 → 校验
    const s = createMutationPipeline();
    const ch = defaultMutationChannels();
    takeCard1(s, 45);
    onUpgradeChosenForPipeline(s, ch, 120); // 计数 1
    // 直发卡 2 模拟（绕过 N 直接收尾以测 checkBeats）
    s.card2Taken = true;
    s.card2TakenAtSeconds = 120;
    const beats = checkBeats(s);
    expect(beats.card1InWindow).toBe(true);
    expect(beats.card2InWindow).toBe(true);
  });

  it('顺序解锁写回（applyUpgradeByIdV3 + ExclusiveWeaponBehavior.applyMutationCard 接线）', () => {
    const state = makeState();
    const applied: Record<string, number> = {};
    const targets = {
      stats: {} as never,
      weapons: {} as never,
      xp: {} as never,
      activeSkill: {} as never,
      exclusive: { applyMutationCard: (m: Record<string, number>) => { applied['mc'] = (applied['mc'] ?? 0) + 1; void m; } },
      derivative: { applyDerivativeUpgrade: () => {} },
      weapons_extra: { setCommonEnhancement: () => {} },
    } as unknown as UpgradeV3WriteTargets;
    applyUpgradeByIdV3(state, targets, 'mc_lantern_1', { ownedWeaponIds: [] as WeaponId[], random: () => 0 });
    expect(state.stackOf('mc_lantern_1')).toBe(1);
    expect(applied['mc']).toBe(1);
  });
});

describe('B3-W4 写回（v3 扩展层）', () => {
  it('通用通武强化 ×1.1^stack 独立乘区；衍生技强化/钥/全局走对应目标', () => {
    const state = makeState();
    let lastCommon = { rangeMult: 1, areaMult: 1 };
    const keyCalls: Array<{ rangeMult: number; heavyCooldownMult: number }> = [];
    let derivativeCalls = 0;
    const targets = {
      stats: {} as never,
      weapons: { setKeyPassives: (k: { rangeMult: number; heavyCooldownMult: number }) => { keyCalls.push(k); } } as never,
      xp: {} as never,
      activeSkill: {} as never,
      exclusive: { applyMutationCard: () => {} },
      derivative: { applyDerivativeUpgrade: () => { derivativeCalls += 1; } },
      weapons_extra: { setCommonEnhancement: (e: { rangeMult: number; areaMult: number }) => { lastCommon = e; } },
    } as unknown as UpgradeV3WriteTargets;
    const ctx = { ownedWeaponIds: [] as WeaponId[], random: () => 0.5 };
    applyUpgradeByIdV3(state, targets, 'up_w_g1', ctx);
    expect(lastCommon.rangeMult).toBeCloseTo(COMMON_ENHANCEMENT_PER_STACK);
    applyUpgradeByIdV3(state, targets, 'up_w_g1', ctx);
    expect(lastCommon.rangeMult).toBeCloseTo(COMMON_ENHANCEMENT_PER_STACK ** 2);
    applyUpgradeByIdV3(state, targets, 'up_d_requiem', ctx);
    expect(derivativeCalls).toBe(1);
    expect(state.stackOf('up_d_requiem')).toBe(1);
    applyUpgradeByIdV3(state, targets, 'key_nail', ctx);
    expect(keyCalls[0]?.rangeMult).toBeCloseTo(1.21); // 钥派生（无射程钥 =1）× 通用强化 1.21（两层 g1，applyV3 折叠）
    expect(keyCalls[0]?.heavyCooldownMult).toBeCloseTo(0.92); // 葬仪铁钉独立字段（重击类消费留 B4）
  });
});
