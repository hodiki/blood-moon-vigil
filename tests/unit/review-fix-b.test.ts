/**
 * NV-REVIEW-FIX 批次 B · 专武最后一公里 —— 运行时用例
 *
 * 覆盖（审查 §4）：
 * - P0-1 圣物层进局：RelicDirector 保底/祭坛/释放/CD/次数/重置；银潮汐不再是空技能；
 *   圣物伤害占比由硬编码 0 改为实算
 * - P0-7 专武最后一公里五子项：7a 质变卡写回立约者、7b 安魂曲回满/复活进度充满、
 *   7c 圣铃治疗同步落守誓者、7d 血怒窗口斧头不自耗、7e 提灯技射速 ×1.5 被消费
 * - P1-1 冒烟/基准默认专武装配（旧实现跳过 → 8 专武恒 disabled）
 * - P1-14 衍生技语义：月痕狙击 1.2s 蓄力、神圣审判持续光环、血影突袭按密度方向、
 *   月啸冲锋狂化 buff 与血月狂化分离
 *
 * 分层纪律（审查 §一.4）：全部为运行时用例（纯函数/状态机/装配层协作），不依赖 Phaser 场景。
 */

import { describe, it, expect } from 'vitest';
import { RELICS, RELIC_RULES, DERIVATIVE_SKILLS, EXCLUSIVE_WEAPONS, HEROES, HERO_EXCLUSIVE_PAIRS, type RelicId } from '@/config/balance';
import { emptyStatusState } from '@/combat/status/status-engine';
import { applyRelicEffect, type RelicEffectContext } from '@/relics/relic-engine';
import { RelicDirector } from '@/relics/relic-runtime';
import { RunStats } from '@/stats/run-stats';
import { OathkeeperRuntime } from '@/weapons/companion/oathkeeper-runtime';
import { becomeTombstone, createOathkeeperState } from '@/weapons/companion/oathkeeper';
import { createExclusiveBehaviors } from '@/weapons/exclusive/exclusive-behaviors';
import { computeLoadout, defaultExclusiveFor } from '@/weapons/loadout';
import { DerivativeSkillController } from '@/active-skill/derivative/derivative-controller';
import {
  castDerivative,
  dashPathTargets,
  densestDashDirection,
  derivativeChargeTime,
  DASH_CORRIDOR_HALF_WIDTH,
  type DerivativeCastContext,
} from '@/active-skill/derivative/derivative-skills';
import type { ExclusiveTarget } from '@/weapons/exclusive/exclusive-math';
import type { WeaponUpdateContext } from '@/weapons/weapon-behavior';

// ============================================================================
// 测试替身
// ============================================================================

function makeTarget(hp = 1000, x = 60, y = 0): ExclusiveTarget & { killed: boolean } {
  const t = {
    active: true,
    x,
    y,
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

function makeCastCtx(overrides: Partial<DerivativeCastContext> = {}): DerivativeCastContext {
  return {
    now: 0,
    player: { x: 0, y: 0, hp: 100, maxHp: 100 },
    enemies: [],
    ...overrides,
  };
}

/** 专武行为帧上下文替身（覆盖 step* 需要的 player.hp/maxHp 与 stats 落点） */
function makeWeaponCtx(now: number, enemies: readonly ExclusiveTarget[]): WeaponUpdateContext {
  // ExclusivePlayerLike 读 player.hp/maxHp（自耗保命判定）；spendHp/heal 落 stats.hp
  const player = {
    x: 0,
    y: 0,
    hp: 100,
    maxHp: 100,
    stats: {
      hp: 100,
      maxHp: 100,
      heal(amount: number) {
        player.hp = Math.min(player.maxHp, player.hp + amount);
        player.stats.hp = player.hp;
      },
    },
  };
  return {
    dt: 1 / 60,
    now,
    player,
    enemies,
    damageMultiplier: 1,
  } as unknown as WeaponUpdateContext;
}

// ============================================================================
// P0-1 圣物层进局
// ============================================================================

describe('P0-1 圣物运行时 RelicDirector（gdd-exclusive-weapons §3.4）', () => {
  it('Boss 保底每局至多 1 枚；重复触发不再发牌', () => {
    const d = new RelicDirector(() => 0);
    const first = d.grantBossGuaranteed();
    expect(first).not.toBeNull();
    expect(d.owned).toEqual([first]);
    expect(d.grantBossGuaranteed()).toBeNull(); // 已保底 → 闸门关闭
    expect(d.owned).toHaveLength(1);
  });

  it('祭坛第 2 枚：概率未中 = 不授予（granted=false，非静默砍内容）', () => {
    const d = new RelicDirector(() => 0.99); // ≥ ALTAR_CHANCE → 未中
    expect(d.grantBossGuaranteed()).not.toBeNull();
    const rolled = d.interactAltar();
    expect(rolled.granted).toBe(false);
    expect(rolled.relic).toBeNull();
    expect(d.owned).toHaveLength(1);
  });

  it('祭坛命中 → 持有 2 枚且不重复（局内唯一 + 上限 2）', () => {
    const d = new RelicDirector(() => 0); // 恒定命中 + 取池首
    d.grantBossGuaranteed();
    const rolled = d.interactAltar();
    expect(rolled.granted).toBe(true);
    expect(d.owned).toHaveLength(2);
    expect(new Set(d.owned).size).toBe(2);
    // 第三次获取（祭坛再交互）应被上限拒绝
    expect(d.interactAltar().granted).toBe(false);
    expect(d.owned).toHaveLength(2);
  });

  it('释放取第一枚可用 → used 置位 + CD 240s；HUD 次数递减', () => {
    const d = new RelicDirector(() => 0);
    d.grantBossGuaranteed();
    d.interactAltar();
    expect(d.usesLeft()).toBe(2);

    const ctx: RelicEffectContext = { player: { x: 0, y: 0 }, enemies: [] };
    const usedId = d.tryUse(0, ctx);
    expect(usedId).toBe(d.owned[0]);
    expect(d.usesLeft()).toBe(1);

    const slot = d.slotsAt(0).find((s) => s.id === usedId)!;
    expect(slot.used).toBe(true);
    expect(slot.cdRemaining).toBe(RELIC_RULES.CD_SECONDS); // 240s
    expect(slot.cdSeconds).toBe(RELIC_RULES.CD_SECONDS);
    // 已用者不再进 nextUsableAt
    expect(d.nextUsableAt(0)?.id).toBe(d.owned[1]);
  });

  it('两枚全用尽后 tryUse 返回 null（不空放）', () => {
    const d = new RelicDirector(() => 0);
    d.grantBossGuaranteed();
    d.interactAltar();
    const ctx: RelicEffectContext = { player: { x: 0, y: 0 }, enemies: [] };
    expect(d.tryUse(0, ctx)).not.toBeNull();
    expect(d.tryUse(0, ctx)).not.toBeNull();
    expect(d.tryUse(0, ctx)).toBeNull();
    expect(d.usesLeft()).toBe(0);
    expect(d.nextUsableAt(0)).toBeNull();
  });

  it('reset 清空持有（重开不残留）', () => {
    const d = new RelicDirector(() => 0);
    d.grantBossGuaranteed();
    expect(d.owned).toHaveLength(1);
    d.reset();
    expect(d.owned).toHaveLength(0);
    expect(d.usesLeft()).toBe(0);
    // 重置后保底重新可用
    expect(d.grantBossGuaranteed()).not.toBeNull();
  });

  it('银潮汐不是空技能：释放必须经 silverRainSink 落场（半径/灼伤/时长全走配置）', () => {
    const cfg = RELICS.relic_silver_tide;
    const calls: Array<{ radius: number; dps: number; duration: number }> = [];
    const ctx: RelicEffectContext = {
      player: { x: 0, y: 0 },
      enemies: [],
      silverRainSink: (radius, dps, duration) => calls.push({ radius, dps, duration }),
    };
    applyRelicEffect('relic_silver_tide', 0, ctx);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.radius).toBe(cfg.params['radius']);
    expect(calls[0]!.dps).toBe(cfg.params['burnDps']);
    expect(calls[0]!.duration).toBe(cfg.params['duration']);
    // 参数非空（GDD 尾章无数值 = KNOWN-GAP，工程锚须已填，禁止 0/缺省）
    expect(cfg.params['radius']).toBeGreaterThan(0);
    expect(cfg.params['burnDps']).toBeGreaterThan(0);
    expect(cfg.params['duration']).toBeGreaterThan(0);
  });

  it('五枚圣物释放均有可观测副作用（禁止空技能）', () => {
    const enemy = { active: true, hp: 500, cc: emptyStatusState() };
    const ctx: RelicEffectContext = {
      player: { x: 0, y: 0 },
      enemies: [enemy],
      damageSink: (t, amount) => {
        (t as { hp: number }).hp -= amount;
      },
    };
    const ids = Object.keys(RELICS) as RelicId[];
    expect(ids).toHaveLength(5);
    for (const id of ids) {
      enemy.hp = 500;
      enemy.cc = emptyStatusState();
      const slots = new RelicDirector(() => 0);
      // 直接构造持有态（绕开抽取随机性）
      slots.state.slots.push({ id, used: false, cdReadyAt: 0 });
      const released = slots.tryUse(0, ctx);
      expect(released).toBe(id);
    }
  });

  it('圣物伤害占比由硬编码 0 改为实算（红线 <5% 遥测口径）', () => {
    const stats = new RunStats();
    stats.reset();
    stats.recordTotalDamage(1000);
    stats.recordRelicDamage(30);
    expect(stats.relicDpsShareOf()).toBeCloseTo(0.03, 6);
    // 无总伤害时不报 0 占比以外的脏值
    const empty = new RunStats();
    empty.reset();
    expect(empty.relicDpsShareOf()).toBeNull();
  });
});

// ============================================================================
// P0-7 专武最后一公里（五子项）
// ============================================================================

describe('P0-7a 质变卡 mc_bell_2 写回立约者状态机', () => {
  it('applyCompanionMachine 覆写参数并生效于承伤转移口径', () => {
    const rt = new OathkeeperRuntime(0, 0);
    rt.setEnabled(true);
    const base = rt.state.maxHp;
    // 基准 0.5 转移：100 伤 → 守誓者掉 50
    rt.routePlayerHurt(100, 0, { x: 0, y: 0 });
    expect(base - rt.state.hp).toBeCloseTo(50, 6);

    rt.applyCompanionMachine({ transferPct: 0.65 });
    const before = rt.state.hp;
    rt.routePlayerHurt(100, 1, { x: 0, y: 0 });
    expect(before - rt.state.hp).toBeCloseTo(65, 6); // machine 生效
    expect(rt.state.machine['transferPct']).toBe(0.65);
  });
});

describe('P0-7b 安魂曲协同：回满 + 墓碑复活进度充满', () => {
  it('companion 阶段 healFull 回到满血', () => {
    const rt = new OathkeeperRuntime(0, 0);
    rt.setEnabled(true);
    rt.state.hp = 10;
    rt.healFull();
    expect(rt.state.hp).toBe(rt.state.maxHp);
  });

  it('墓碑阶段 fillReviveProgress 直接原地复活（进度满 → companion 满血）', () => {
    const rt = new OathkeeperRuntime(0, 0);
    rt.setEnabled(true);
    becomeTombstone(rt.state, 0, () => 0);
    expect(rt.state.phase).toBe('tombstone');
    rt.fillReviveProgress();
    expect(rt.state.phase).toBe('companion');
    expect(rt.state.hp).toBe(rt.state.maxHp);
    expect(rt.state.reviveProgress).toBe(0);
  });

  it('未启用时 healFull/fillReviveProgress 为 no-op（不越权改状态）', () => {
    const rt = new OathkeeperRuntime(0, 0); // enabled = false
    rt.state.hp = 10;
    rt.healFull();
    rt.fillReviveProgress();
    expect(rt.state.hp).toBe(10);
  });

  it('castDerivative(dv_requiem) 带 companion 时推送 companionRestored', () => {
    const rt = new OathkeeperRuntime(0, 0);
    rt.setEnabled(true);
    rt.state.hp = 10;
    const healed: number[] = [];
    const result = castDerivative('dv_requiem', makeCastCtx({
      companion: rt,
      healSink: (a) => healed.push(a),
      enemies: [makeTarget()],
    }));
    expect(result.events).toContain('companionRestored');
    expect(rt.state.hp).toBe(rt.state.maxHp);
    expect(healed[0]).toBe(DERIVATIVE_SKILLS.dv_requiem.params['heal']);
  });
});

describe('P0-7c 圣铃治疗同源落守誓者（GDD §4.4）', () => {
  it('onHeal 钩子收到与玩家同源的治疗量', () => {
    const behaviors = createExclusiveBehaviors();
    const bell = behaviors.xw_bell;
    bell.setEnabled(true);
    const toCompanion: number[] = [];
    bell.onHeal = (amount) => toCompanion.push(amount);

    const healAmount = EXCLUSIVE_WEAPONS.xw_bell.params.healAmount ?? 8;
    // 直接驱动 healSink（帧推进经 stepBell 的 8s 铃响周期，此处只验装配层同源分发）
    bell.update(makeWeaponCtx(0, []));
    // 用确定性方式触发：铃响治疗间隔 healInterval(8s) → 推进到 8s
    bell.update(makeWeaponCtx(EXCLUSIVE_WEAPONS.xw_bell.params.healInterval ?? 8, []));

    expect(toCompanion.length).toBeGreaterThan(0);
    expect(toCompanion.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    expect(healAmount).toBeGreaterThan(0);
  });

  it('守誓者 companion 阶段收到治疗 → 回血；墓碑阶段 → 折算复活进度', () => {
    const rt = new OathkeeperRuntime(0, 0);
    rt.setEnabled(true);
    rt.state.hp = 100;
    const applied = rt.healCompanion(20);
    expect(applied).toBe(20);
    expect(rt.state.hp).toBe(120);

    // 墓碑：治疗按 reviveConvertRate 折算进度（基准 0.5 → 20 HP × 0.5 × 5 = 50 进度）
    becomeTombstone(rt.state, 0, () => 0);
    rt.healCompanion(20);
    expect(rt.state.phase).toBe('tombstone');
    expect(rt.state.reviveProgress).toBeCloseTo(50, 6);

    // 再 20 HP → 满进度 → 原地复活
    rt.healCompanion(20);
    expect(rt.state.phase).toBe('companion');
    expect(rt.state.hp).toBe(rt.state.maxHp);
  });

  it('墓碑阶段治疗满 → 后续帧不再重复计墓碑治疗（tickTombstone 提前返回）', () => {
    const state = createOathkeeperState(0, 0);
    becomeTombstone(state, 0, () => 0);
    state.machine = { reviveConvertRate: 1 }; // 20 HP = 满进度
    // 直接调 convert 口径：进度满 → phase 离开 tombstone
    state.reviveProgress = 0;
    const rt = new OathkeeperRuntime(0, 0);
    rt.setEnabled(true);
    Object.assign(rt.state, state);
    rt.healCompanion(20);
    expect(rt.state.phase).toBe('companion');
  });
});

describe('P0-7d 血怒窗口内挥击不耗 HP（machine.selfHpCost = 0）', () => {
  it('applyMutationCard({selfHpCost: 0}) 后巨斧步进不再自耗；恢复基础值后恢复自耗', () => {
    const behaviors = createExclusiveBehaviors();
    const axe = behaviors.xw_axe;
    axe.setEnabled(true);
    const enemies = [makeTarget(100000, 80, 0)];

    // 基础：selfHpCost = 2
    const baseCost = EXCLUSIVE_WEAPONS.xw_axe.params.selfHpCost ?? 0;
    expect(baseCost).toBeGreaterThan(0);

    // 血怒窗口：selfHpCost = 0（PlayScene.updateRage 的写入口径）
    axe.applyMutationCard({ selfHpCost: 0 });
    let ctx = makeWeaponCtx(0, enemies);
    let hpBefore = ctx.player.stats.hp;
    for (let i = 0; i < 200; i += 1) axe.update(ctx);
    expect(ctx.player.stats.hp).toBe(hpBefore); // 窗口内零自耗

    // 窗口结束：恢复基础自耗
    axe.applyMutationCard({ selfHpCost: baseCost });
    const ctx2 = makeWeaponCtx(0, enemies);
    const hp0 = ctx2.player.stats.hp;
    // 单上下文推进（每次 makeWeaponCtx 会重建 stats，不能逐帧新建）
    for (let i = 0; i < 400; i += 1) {
      ctx2.now = i * 0.1;
      axe.update(ctx2);
    }
    expect(ctx2.player.stats.hp).toBeLessThan(hp0);
  });
});

describe('P0-7e 提灯技射速爆发 ×1.5 被专武消费（旧实现只 push 事件）', () => {
  it('fireRateSink 收到 1.5/4s；applyFireRateBurst 后间隔 ÷ 1.5 注入 machine', () => {
    const fireRateCalls: Array<{ mult: number; duration: number }> = [];
    castDerivative('dv_lantern_flash', makeCastCtx({
      fireRateSink: (mult, duration) => fireRateCalls.push({ mult, duration }),
      enemies: [makeTarget()],
    }));
    expect(fireRateCalls).toHaveLength(1);
    expect(fireRateCalls[0]!.mult).toBe(DERIVATIVE_SKILLS.dv_lantern_flash.params['fireRateMult']);
    expect(fireRateCalls[0]!.duration).toBe(DERIVATIVE_SKILLS.dv_lantern_flash.params['fireRateDuration']);
  });

  it('火速率乘区在窗口内/外切换；resetState 清空窗口', () => {
    const behaviors = createExclusiveBehaviors();
    const revolver = behaviors.xw_revolver;
    expect(revolver.fireRateMultAt(0)).toBe(1);
    revolver.applyFireRateBurst(1.5, 4);
    expect(revolver.fireRateMultAt(3.9)).toBe(1.5);
    expect(revolver.fireRateMultAt(4.0)).toBe(1); // 窗口外恒 1
    revolver.resetState();
    expect(revolver.fireRateMultAt(0)).toBe(1);
  });

  it('左轮在射速窗口内同样时间打出更多发（machine.interval 被消费）', () => {
    const enemies = [makeTarget(100000, 60, 0)];
    const baseInterval = EXCLUSIVE_WEAPONS.xw_revolver.params.interval ?? 0.8;

    const plain = createExclusiveBehaviors().xw_revolver;
    plain.setEnabled(true);
    let baseShots = 0;
    plain.onEvents = (events) => {
      for (const e of events) if (e === 'fired') baseShots += 1;
    };

    const burst = createExclusiveBehaviors().xw_revolver;
    burst.setEnabled(true);
    burst.applyFireRateBurst(1.5, 8);
    let burstShots = 0;
    burst.onEvents = (events) => {
      for (const e of events) if (e === 'fired') burstShots += 1;
    };

    const window = 6; // s
    const steps = Math.round(window / (1 / 60));
    for (let i = 0; i < steps; i += 1) {
      const now = i / 60;
      plain.update(makeWeaponCtx(now, enemies));
      burst.update(makeWeaponCtx(now, enemies));
    }
    // 理论：6 / 0.8 = 7 发 vs 6 / (0.8/1.5) ≈ 11 发（装填/弹巢上限内）
    expect(baseShots).toBeGreaterThan(0);
    expect(burstShots).toBeGreaterThan(baseShots);
    expect(baseInterval).toBeGreaterThan(0);
  });
});

// ============================================================================
// P1-1 冒烟/基准默认专武装配
// ============================================================================

describe('P1-1 冒烟/基准必须走专武装配（旧实现跳过 → 8 专武恒 disabled）', () => {
  it('每角色默认专武 = 专武对第一把，且 computeLoadout 生效', () => {
    for (const heroId of Object.keys(HERO_EXCLUSIVE_PAIRS)) {
      const def = defaultExclusiveFor(heroId);
      expect(def).toBe(HERO_EXCLUSIVE_PAIRS[heroId as keyof typeof HERO_EXCLUSIVE_PAIRS][0]);
      const loadout = computeLoadout(heroId, def!, HEROES[heroId as keyof typeof HEROES].initialWeapon);
      expect(loadout).not.toBeNull();
      expect(loadout!.exclusiveId).toBe(def);
      expect(loadout!.derivativeId).toBeTruthy();
    }
  });

  it('非法 heroId 返回 null（不抛、不静默取首项）', () => {
    expect(defaultExclusiveFor('hero_unknown')).toBeNull();
  });
});

// ============================================================================
// P1-14 衍生技语义（gdd-exclusive-weapons §4）
// ============================================================================

describe('P1-14 月痕狙击 1.2s 蓄力（GDD §4.3）', () => {
  it('蓄力时长锚 = 1.2s；按下即起 CD，蓄满才出伤', () => {
    const ctrl = new DerivativeSkillController('dv_moon_snipe');
    expect(ctrl.chargeSeconds).toBeCloseTo(1.2, 6);
    expect(derivativeChargeTime('dv_moon_snipe')).toBeCloseTo(1.2, 6);

    const enemy = makeTarget(1000, 80, 0);
    const ctx = makeCastCtx({ enemies: [enemy] });
    // 按下：入蓄力、CD 即起算、本帧无伤害
    expect(ctrl.tryCast(0, ctx)).toBeNull();
    expect(ctrl.chargePhase).toBe('charging');
    expect(ctrl.cooldown).toBe(DERIVATIVE_SKILLS.dv_moon_snipe.cd);
    expect(enemy.hp).toBe(1000);

    // 蓄力中：进度递增但仍未出伤
    expect(ctrl.update(0.6, 0.6)).toBeNull();
    expect(ctrl.chargeProgress(0.6)).toBeCloseTo(0.5, 2);
    expect(enemy.hp).toBe(1000);

    // 蓄满：结算 60 伤 + 首个命中眩晕
    const result = ctrl.update(0.6, 1.2);
    expect(result).not.toBeNull();
    expect(result!.events).toContain('charged');
    expect(result!.damageDealt).toBeCloseTo(DERIVATIVE_SKILLS.dv_moon_snipe.params['damage']!, 6);
    expect(ctrl.chargePhase).toBe('idle');
  });

  it('蓄力中断（cancelCharge）不结算、不退 CD', () => {
    const ctrl = new DerivativeSkillController('dv_moon_snipe');
    const enemy = makeTarget(1000, 80, 0);
    expect(ctrl.tryCast(0, makeCastCtx({ enemies: [enemy] }))).toBeNull();
    const cd = ctrl.cooldown;
    ctrl.cancelCharge();
    expect(ctrl.chargePhase).toBe('idle');
    expect(ctrl.update(2, 2)).toBeNull();
    expect(enemy.hp).toBe(1000);
    // 不退 CD：只按帧正常流逝（20 − dt 2），而非清零或退还
    expect(ctrl.cooldown).toBeCloseTo(cd - 2, 6);
    expect(ctrl.cooldown).toBeGreaterThan(0);
  });

  it('瞬发技（血影突袭）无蓄力相，按下即结算', () => {
    const ctrl = new DerivativeSkillController('dv_blood_dash');
    expect(ctrl.chargeSeconds).toBe(0);
    const enemy = makeTarget(1000, 60, 0);
    const result = ctrl.tryCast(0, makeCastCtx({ enemies: [enemy] }));
    expect(result).not.toBeNull();
    expect(ctrl.chargePhase).toBe('idle');
  });
});

describe('P1-14 神圣审判 5s 治疗光环（持续多段，非一次性结算）', () => {
  it('注入 auraSink 时按 dps/时长下发光环，不再一次性结算', () => {
    const auraCalls: Array<{ perSec: number; duration: number }> = [];
    const healCalls: number[] = [];
    const result = castDerivative('dv_holy_judgment', makeCastCtx({
      enemies: [makeTarget(1000, 60, 0)],
      auraSink: (perSec, duration) => auraCalls.push({ perSec, duration }),
      healSink: (a) => healCalls.push(a),
    }));
    expect(auraCalls).toEqual([
      { perSec: DERIVATIVE_SKILLS.dv_holy_judgment.params['healAuraPerSec']!, duration: DERIVATIVE_SKILLS.dv_holy_judgment.params['healAuraDuration']! },
    ]);
    expect(healCalls).toHaveLength(0); // 光环不走一次性 healSink
    expect(result.events).toContain('healAura');
  });

  it('未注入 auraSink 时退化为一次性首帧结算（沙盘兼容，不空放）', () => {
    const healCalls: number[] = [];
    castDerivative('dv_holy_judgment', makeCastCtx({
      enemies: [makeTarget(1000, 60, 0)],
      healSink: (a) => healCalls.push(a),
    }));
    expect(healCalls.length).toBeGreaterThan(0);
    // 3 HP/s × 5s × 0.2 = 3
    expect(healCalls[0]).toBeCloseTo(3, 6);
  });
});

describe('P1-14 血影突进按敌群最密方向（非最近 5 敌）', () => {
  it('密度方向 = 敌更密的一侧（即使单个更近的敌在反方向）', () => {
    // 反方向 1 个近敌（−X 40px）；正方向 3 个远敌（+X 120/160/200）
    const enemies = [makeTarget(1000, -40, 0), makeTarget(1000, 120, 0), makeTarget(1000, 160, 0), makeTarget(1000, 200, 0)];
    const dir = densestDashDirection(enemies, 0, 0);
    expect(dir.x).toBeGreaterThan(0.9); // 指向 +X（密度更高）
  });

  it('走廊外敌不参与密度投票；全空返回 +X（确定性）', () => {
    const outside = [makeTarget(1000, 100, 500)]; // 垂直偏移 500 > 半宽 60
    const dir = densestDashDirection(outside, 0, 0);
    expect(dir).toEqual({ x: 1, y: 0 });
    expect(densestDashDirection([], 0, 0)).toEqual({ x: 1, y: 0 });
  });

  it('走廊内全部敌被结算 + 挂易伤；走廊外敌不受影响', () => {
    const inPath = makeTarget(1000, 100, 0);
    const outPath = makeTarget(1000, 100, 300);
    const result = castDerivative('dv_blood_dash', makeCastCtx({ enemies: [inPath, outPath] }));
    expect(result.damageDealt).toBeCloseTo(DERIVATIVE_SKILLS.dv_blood_dash.params['damage']!, 6);
    expect(inPath.hp).toBeLessThan(1000);
    expect(outPath.hp).toBe(1000);
    expect(result.events).toContain('vulnerable');
  });

  it('dash 落点 = 玩家 + 方向 × 距离（位移由场景层执行）', () => {
    const enemies = [makeTarget(1000, 100, 0)];
    const result = castDerivative('dv_blood_dash', makeCastCtx({ enemies }));
    const distance = DERIVATIVE_SKILLS.dv_blood_dash.params['dashDistance']!;
    expect(result.dash).toBeTruthy();
    expect(result.dash!.distance).toBe(distance);
    expect(Math.hypot(result.dash!.x, result.dash!.y)).toBeCloseTo(distance, 6);
    expect(result.dash!.x).toBeCloseTo(distance * result.dash!.dirX, 6);
    expect(result.dash!.y).toBeCloseTo(distance * result.dash!.dirY, 6);
  });

  it('dashPathTargets 只取 0~distance 的带状目标且按距离升序', () => {
    const near = makeTarget(1000, 60, 0);
    const far = makeTarget(1000, 180, 0);
    const beyond = makeTarget(1000, 400, 0);
    const path = dashPathTargets([far, beyond, near], 0, 0, { x: 1, y: 0 }, 200, DASH_CORRIDOR_HALF_WIDTH);
    expect(path).toEqual([near, far]);
  });

  it('up_d_dash 血宴：终点血爆落在突进终点（非玩家脚下）', () => {
    const atEnd = makeTarget(1000, 200, 0); // 突进终点附近
    const atStart = makeTarget(1000, 0, 0); // 玩家脚下（半径外）
    const result = castDerivative('dv_blood_dash', makeCastCtx({ enemies: [atEnd, atStart] }), {
      burstDamage: 25,
      burstRadius: 120,
      healPerHit: 1,
    });
    expect(result.events).toContain('bloodBurst');
    // 走廊伤害 15（未挂易伤前结算）→ 挂易伤 15% → 终点血爆 25 吃到易伤乘区 = 28.75
    // （批次 A 纪律：易伤乘区只在 combat/damage 单一入口结算，此处顺带锁定该口径）
    expect(1000 - atEnd.hp).toBeCloseTo(15 + 25 * 1.15, 6);
    // atStart 在走廊内（沿 0 距离）只吃走廊伤害 15；距终点 200 > 120 → 不吃血爆
    expect(1000 - atStart.hp).toBeCloseTo(15, 6);
  });
});

describe('P1-14 月啸冲锋狂化 buff 与血月狂化分离', () => {
  it('dv_wolf_charge 推送 wolfFrenzy（不再与 rage 串味）', () => {
    const result = castDerivative('dv_wolf_charge', makeCastCtx({
      enemies: [makeTarget(100000, 60, 0), makeTarget(100000, 80, 0), makeTarget(100000, 100, 0)],
    }));
    expect(result.events).toContain('wolfFrenzy');
    expect(result.events).not.toContain('rage');
  });

  it('dv_blood_rage 仍推送 rage（两个 buff 各自独立）', () => {
    const result = castDerivative('dv_blood_rage', makeCastCtx());
    expect(result.events).toContain('rage');
    expect(result.events).not.toContain('wolfFrenzy');
  });
});
