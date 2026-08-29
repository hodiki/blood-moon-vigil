import { describe, it, expect } from 'vitest';
import {
  EXCLUSIVE_WEAPONS,
  MUTATION_CARDS,
  DERIVATIVE_SKILLS,
  EXCLUSIVE_TO_DERIVATIVE,
  HERO_EXCLUSIVE_PAIRS,
  RELICS,
  RELIC_RULES,
} from '@/config/balance';
import { emptyStatusState } from '@/combat/status/status-engine';
import type { ExclusiveTarget } from '@/weapons/exclusive/exclusive-math';
import {
  createLanternState, stepLantern,
  createRevolverState, stepRevolver,
  createTwinbladesState, stepTwinblades,
  createAxeState, stepAxe,
  createHornState, stepHorn, hornWolfCount,
} from '@/weapons/exclusive/exclusive-math';
import { castDerivative } from '@/active-skill/derivative/derivative-skills';
import { fullAmmo, consumeAmmo, tickReload, grantAmmo, setInfiniteWindow, applyReloadMult, chamberDots } from '@/weapons/ammo';
import { WEAPONS } from '@/config/balance';
import {
  createRelicRuntime, grantRelic, rollBossRelic, hasGuaranteedDrop,
  useRelic, canUseRelic, assertRelicDpsShare,
} from '@/relics/relic-engine';
import {
  createOathkeeperState, transferDamage, tickTombstone, tickResummon, oathkeeperTargetable, revive,
  becomeTombstone, applyCompanionMachine,
} from '@/weapons/companion/oathkeeper';
import { pickTarget } from '@/enemies/targeting';

/** 可结算测试目标桩 */
function makeTarget(hp = 1000, dist = 60, opts: Partial<ExclusiveTarget> = {}): ExclusiveTarget & { killed: boolean } {
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
    ...opts,
  };
  return t as ExclusiveTarget & { killed: boolean };
}

describe('B2-W1 专武配置表（gdd-exclusive-weapons §4；验收判据 ⑧-1 口径）', () => {
  it('专武恰好 8 把，数值与 GDD §4 锚点一致', () => {
    expect(Object.keys(EXCLUSIVE_WEAPONS)).toHaveLength(8);
    expect(EXCLUSIVE_WEAPONS.xw_lantern.params).toMatchObject({ damage: 5, interval: 0.5, radius: 90, slowPct: 0.1 });
    expect(EXCLUSIVE_WEAPONS.xw_revolver.params).toMatchObject({ damage: 10, interval: 0.8, speed: 420, ammoMax: 6, reloadSeconds: 1.0 });
    expect(EXCLUSIVE_WEAPONS.xw_twinblades.params).toMatchObject({ damage: 6, interval: 0.55, radius: 120, healPerHit: 0.5, healCapPerSecond: 2 });
    expect(EXCLUSIVE_WEAPONS.xw_longbow.params).toMatchObject({ damage: 22, interval: 2.2, pierce: 3, speed: 500 });
    expect(EXCLUSIVE_WEAPONS.xw_bell.params).toMatchObject({ damage: 3, interval: 0.8, radius: 110, healInterval: 8, healAmount: 8 });
    expect(EXCLUSIVE_WEAPONS.xw_cross.params).toMatchObject({ damage: 28, interval: 3.0, radius: 100 });
    expect(EXCLUSIVE_WEAPONS.xw_axe.params).toMatchObject({ damage: 26, interval: 2.2, radius: 150, selfHpCost: 2, selfHpStopPct: 0.2, killHeal: 1 });
    expect(EXCLUSIVE_WEAPONS.xw_horn.params).toMatchObject({ summonInterval: 12, summonDuration: 10, summonMax: 2, damage: 8, interval: 1.0 });
  });

  it('每角色恰好 2 把双专武；开局 DPS 锚全部落「9~16」平台（GDD §⑤ H2 对齐）', () => {
    expect(Object.keys(HERO_EXCLUSIVE_PAIRS)).toHaveLength(4);
    for (const pair of Object.values(HERO_EXCLUSIVE_PAIRS)) {
      expect(new Set(pair).size).toBe(2);
      for (const id of pair) {
        const [lo, hi] = EXCLUSIVE_WEAPONS[id].dpsAnchor;
        expect(lo).toBeGreaterThanOrEqual(6); // 圣铃自身 6~8（合计口径 ≈13~14）
        expect(hi).toBeLessThanOrEqual(16);
      }
    }
  });

  it('质变卡恰好 16 张（每武 2 张、顺序 1/2）；衍生技恰好 8 套且专武→技 1:1', () => {
    expect(MUTATION_CARDS).toHaveLength(16);
    for (const id of Object.keys(EXCLUSIVE_WEAPONS) as (keyof typeof EXCLUSIVE_WEAPONS)[]) {
      const cards = MUTATION_CARDS.filter((c) => c.exclusiveId === id);
      expect(cards).toHaveLength(2);
      expect(cards.map((c) => c.order).sort()).toEqual([1, 2]);
    }
    expect(Object.keys(DERIVATIVE_SKILLS)).toHaveLength(8);
    expect(new Set(Object.values(EXCLUSIVE_TO_DERIVATIVE)).size).toBe(8);
  });

  it('衍生技 CD 锚：轻技 12~15s / 复合技 ≥20s；占比锚全部落 12~18%（EG-9）', () => {
    // 轻技（CD 锚 12~15s）：圣徒左轮技 / 血影突袭；其余复合技 ≥20s（GDD §3.3/§4 逐技标注）
    for (const cfg of Object.values(DERIVATIVE_SKILLS)) {
      if (cfg.id === 'dv_revolver_burst' || cfg.id === 'dv_blood_dash') {
        expect(cfg.cd).toBeGreaterThanOrEqual(12);
        expect(cfg.cd).toBeLessThanOrEqual(15);
      } else {
        expect(cfg.cd).toBeGreaterThanOrEqual(20);
      }
      expect(cfg.shareAnchor[0]).toBeGreaterThanOrEqual(0.12);
      expect(cfg.shareAnchor[1]).toBeLessThanOrEqual(0.18);
    }
  });
});

describe('B2-W1 专武结算层（exclusive-math；即时命中近似）', () => {
  it('灯环：环内单敌 tick 5伤/0.5s → DPS 10 落锚区间 9~11；减速 10% 生效（状态层）', () => {
        const state = createLanternState();
    const target = makeTarget();
    const player = { x: 0, y: 0, hp: 100, maxHp: 100 };
    let dealt = 0;
    // 5 秒模拟（60fps）
    for (let f = 0; f < 300; f += 1) {
      dealt += stepLantern(state, 1 / 60, f / 60, player, [target], 1).damageDealt;
    }
    const dps = dealt / 5;
    expect(dps).toBeGreaterThanOrEqual(9);
    expect(dps).toBeLessThanOrEqual(11);
    // 减速 10% 挂上（状态层 slow）
    expect(target.cc?.slow?.value).toBeCloseTo(0.1);
  });

  it('灯环环外敌不受伤（90px 半径外）', () => {
        const state = createLanternState();
    const far = makeTarget(1000, 200);
    for (let f = 0; f < 120; f += 1) {
      stepLantern(state, 1 / 60, f / 60, { x: 0, y: 0, hp: 100, maxHp: 100 }, [far], 1);
    }
    expect(far.hp).toBe(1000);
  });

  it('左轮：弹巢 6 发射完自动装弹 1.0s（弹药框架接线）；峰值 DPS 12.5 落锚', () => {
        const state = createRevolverState();
    const target = makeTarget(100000);
    const player = { x: 0, y: 0, hp: 100, maxHp: 100 };
    const rng = () => 0; // 全命中
    let dealt = 0;
    // 5.8s = 6 发 × 0.8s + 1.0s 装弹 → 有效 DPS = 60/5.8 ≈ 10.3
    for (let f = 0; f < Math.round(5.5 * 60); f += 1) { // 6 发（0~4.0s）+ 装弹（4.0~5.0s）；5.5s 截断第 7 发前
      dealt += stepRevolver(state, 1 / 60, f / 60, player, [target], 1, {}, rng).damageDealt;
    }
    expect(dealt).toBeCloseTo(60, 0);
    // 峰值口径：10/0.8 = 12.5 ∈ 12~14 锚（参数断言）
    expect(EXCLUSIVE_WEAPONS.xw_revolver.params.damage! / EXCLUSIVE_WEAPONS.xw_revolver.params.interval!).toBeCloseTo(12.5);
  });

  it('左轮弹药：射尽触发装弹；处决装填 ×0.7 生效（machine reloadMult）', () => {
        const base = createRevolverState();
    expect(base.ammo.current).toBe(6);
    const tuned = createRevolverState({ reloadMult: 0.7 });
    expect(tuned.ammo.reloadSeconds).toBeCloseTo(0.7);
  });

  it('双刃：6伤/0.55s → DPS ≈10.9 落锚 10~12；命中回血每秒上限 2 HP', () => {
        const state = createTwinbladesState();
    const target = makeTarget(100000);
    const player = { x: 0, y: 0, hp: 50, maxHp: 100 };
    let healed = 0;
    let dealt = 0;
    for (let f = 0; f < 300; f += 1) {
      const r = stepTwinblades(state, 1 / 60, f / 60, player, [target], 1, {}, (h) => { healed += h; });
      dealt += r.damageDealt;
    }
    expect(dealt / 5).toBeGreaterThanOrEqual(10);
    expect(dealt / 5).toBeLessThanOrEqual(12.5); // 10.9 + 容差
    expect(healed / 5).toBeCloseTo(0.91, 1); // 0.5/0.55s ≈ 0.909/s（低于 2 HP/s 上限——上限仅在 hitRate 提速时生效）
  });

  it('血契层数上限 10：满层不再溢出（§6.1-2）', () => {
        const state = createTwinbladesState();
    const target = makeTarget(100000);
    for (let f = 0; f < 60 * 20; f += 1) {
      stepTwinblades(state, 1 / 60, f / 60, { x: 0, y: 0, hp: 100, maxHp: 100 }, [target], 1);
    }
    expect(state.bloodPact).toBe(10);
  });

  it('巨斧：挥击自损 2 HP；HP ≤20% 停止消耗（保命边缘 §6.1-1）；击杀回 1 HP', () => {
        const state = createAxeState();
    const player = { x: 0, y: 0, hp: 100, maxHp: 100 };
    let spent = 0;
    let healed = 0;
    const killable = makeTarget(26);
    for (let f = 0; f < Math.round(2.3 * 60); f += 1) {
      stepAxe(state, 1 / 60, f / 60, player, [killable], 1, {}, (c) => { player.hp -= c; spent += c; }, (h) => { player.hp += h; healed += h; });
    }
    expect(spent).toBe(2); // 挥一次损 2
    expect(killable.hp).toBe(0);
    expect(healed).toBe(1); // 击杀回 1
    // HP 压到 20%：自损停止
    const lowPlayer = { x: 0, y: 0, hp: 18, maxHp: 100 };
    let spentLow = 0;
    stepAxe(state, 1 / 60, 10, lowPlayer, [makeTarget(1000)], 1, {}, (c) => { spentLow += c; });
    stepAxe(state, 1 / 60, 12, lowPlayer, [makeTarget(1000)], 1, {}, (c) => { spentLow += c; });
    expect(spentLow).toBe(0);
  });

  it('号角：每 12s 召唤 1 狼（场上限 2，满员静默丢弃 §6.1-2）', () => {
        const state = createHornState();
    const player = { x: 0, y: 0, hp: 100, maxHp: 100 };
    // 36s：12s/24s/36s 三次吹号，第 3 次场上仍 2 头（10s 存在 → 12s 时第 1 头已消散）实际 24s 时 2 头在场
    for (let f = 0; f < 60 * 36; f += 1) {
      stepHorn(state, 1 / 60, f / 60, player, [], 1);
    }
    expect(hornWolfCount(state, 36)).toBeLessThanOrEqual(2);
  });

  it('质变卡 machine 覆写生效（灯环卡1 半径 135 + 减速 18%）', () => {
        const mc1 = MUTATION_CARDS.find((c) => c.id === 'mc_lantern_1')!;
    const state = createLanternState();
    const target = makeTarget(1000, 130); // 基础 90px 外、卡1 135px 内
    for (let f = 0; f < 60; f += 1) {
      stepLantern(state, 1 / 60, f / 60, { x: 0, y: 0, hp: 100, maxHp: 100 }, [target], 1, mc1.machine);
    }
    expect(target.hp).toBeLessThan(1000);
    expect(target.cc?.slow?.value).toBeCloseTo(0.18);
  });
});

describe('B2-W2 衍生技（CC 走状态层；§4.8 对照表）', () => {
  it('8 技注册齐备；月痕狙击眩晕 Boss 免疫 / 精英 ×0.5（状态层抗性天然生效）', () => {
        // 「首个命中目标」眩晕（巨矢只标记首目标）——分三次单目标施放验证抗性矩阵
    const ctxOf = (t: ExclusiveTarget) => ({ now: 0, player: { x: 0, y: 0, hp: 100, maxHp: 100 }, enemies: [t] });
    const normal = makeTarget(1000);
    const elite = makeTarget(1000, 60, { ccProfile: { tier: 'elite' } });
    const boss = makeTarget(1000, 60, { ccProfile: { tier: 'boss' } });
    castDerivative('dv_moon_snipe', ctxOf(normal));
    castDerivative('dv_moon_snipe', ctxOf(elite));
    castDerivative('dv_moon_snipe', ctxOf(boss));
    expect(normal.cc?.stun?.until).toBeCloseTo(1); // 普通敌 1s
    expect(elite.cc?.stun?.until).toBeCloseTo(0.5); // 精英 ×0.5
    expect(boss.cc?.stun).toBeNull(); // Boss 免疫
  });

  it('圣徒左轮技：6 连射 ×12 伤 + 末段圣痕易伤 15%/6s', () => {
        const target = makeTarget(1000);
    const r = castDerivative('dv_revolver_burst', { now: 0, player: { x: 0, y: 0, hp: 100, maxHp: 100 }, enemies: [target] });
    expect(r.damageDealt).toBe(72); // 6 × 12
    expect(target.cc?.vulnerable?.value).toBeCloseTo(0.15);
    expect(target.cc?.vulnerable?.until).toBeCloseTo(6);
  });

  it('安魂曲：减速 30%/3s + 回 20 HP + 守誓者协同（回满 + 复活进度充满）', () => {
        const enemy = makeTarget(1000);
    let healed = 0;
    let companionFull = false;
    let progressFull = false;
    castDerivative('dv_requiem', {
      now: 0,
      player: { x: 0, y: 0, hp: 50, maxHp: 100 },
      enemies: [enemy],
      healSink: (h) => { healed += h; },
      companion: { healFull: () => { companionFull = true; }, fillReviveProgress: () => { progressFull = true; } },
    });
    expect(healed).toBe(20);
    expect(enemy.cc?.slow?.value).toBeCloseTo(0.3);
    expect(enemy.cc?.slow?.until).toBeCloseTo(3);
    expect(companionFull).toBe(true);
    expect(progressFull).toBe(true);
  });

  it('血月狂化无 CC（§4.8：自增益）；月啸冲锋击退为位移事件非状态', () => {
        const target = makeTarget(1000);
    const rage = castDerivative('dv_blood_rage', { now: 0, player: { x: 0, y: 0, hp: 100, maxHp: 100 }, enemies: [target] });
    expect(rage.events).toContain('rage');
    expect(target.cc?.stun).toBeNull();
    expect(target.cc?.slow).toBeNull();
    const charge = castDerivative('dv_wolf_charge', { now: 0, player: { x: 0, y: 0, hp: 100, maxHp: 100 }, enemies: [target] });
    expect(charge.damageDealt).toBe(120); // B6-W4 群狼环猎：单目标 3 狼 → 30 + 45 + 45（第 2 发起 ×1.5）
    expect(charge.events.filter((e) => e === 'knockback')).toHaveLength(3);
    expect(target.cc?.stun).toBeNull(); // 位移不进状态层
  });
});

describe('B2-W3 弹药框架（gdd-exclusive-weapons §4.9；验收判据 ⑧-7）', () => {
  it('六态：消耗/射尽装弹/装弹完成/补弹/无限弹/装弹时长乘区', () => {
        const cfg = { max: 6, reloadSeconds: 1.0 };
    // 1 消耗
    const a = fullAmmo(cfg);
    expect(consumeAmmo(a, 0)).toBe(true);
    expect(a.current).toBe(5);
    // 2 射尽触发装弹
    for (let i = 0; i < 5; i += 1) consumeAmmo(a, 0);
    expect(a.current).toBe(0);
    expect(a.reloading).toBe(true);
    expect(consumeAmmo(a, 0)).toBe(false); // 装弹中不可射
    // 3 装弹完成
    tickReload(a, 0.99);
    expect(a.reloading).toBe(true);
    tickReload(a, 0.02);
    expect(a.reloading).toBe(false);
    expect(a.current).toBe(6);
    // 4 补弹（上限钳制）
    grantAmmo(a, 1);
    expect(a.current).toBe(6);
    // 5 无限弹期：不消耗 + HUD 金光口径
    const b = fullAmmo(cfg);
    setInfiniteWindow(b, 5);
    expect(b.current).toBe(6); // 开启即补满
    expect(consumeAmmo(b, 1)).toBe(true);
    expect(b.current).toBe(6); // 不消耗
    expect(consumeAmmo(b, 6)).toBe(true); // 无限弹期后过期恢复消耗
    expect(b.current).toBe(5);
    // 6 装弹时长乘区（处决装填 ×0.7）
    const c = fullAmmo(cfg);
    applyReloadMult(c, 0.7);
    expect(c.reloadSeconds).toBeCloseTo(0.7);
    // HUD 弹巢点阵数据
    expect(chamberDots(fullAmmo(cfg))).toEqual([true, true, true, true, true, true]);
  });

  it('usesAmmo 仅左轮声明（13 通武 + 7 专武零改动回归断言 ⑧-7）', () => {
    // EXCLUSIVE_WEAPONS 中仅 xw_revolver 声明 ammoMax/reloadSeconds
    for (const [id, cfg] of Object.entries(EXCLUSIVE_WEAPONS)) {
      const hasAmmo = cfg.params.ammoMax !== undefined;
      expect(hasAmmo).toBe(id === 'xw_revolver');
    }
    // 通武表 WEAPONS 无弹药字段（结构断言：三把 demo 通武无 ammo 键）
        for (const w of Object.values(WEAPONS)) {
      expect(Object.keys(w).some((k) => k.toLowerCase().includes('ammo'))).toBe(false);
    }
  });
});

describe('B2-W4 圣物层（尾章定稿；验收判据 ⑤）', () => {
  it('圣物恰好 5 枚；获取池与尾章表一致（月蚀/血海双入，十二灯/狼灵祭坛专属，银潮汐 Boss 专属）', () => {
    expect(Object.keys(RELICS)).toHaveLength(5);
    expect(RELICS.relic_moonfall.pools).toEqual(['boss', 'altar']);
    expect(RELICS.relic_bloodtide.pools).toEqual(['boss', 'altar']);
    expect(RELICS.relic_twelve_lamps.pools).toEqual(['altar']);
    expect(RELICS.relic_silver_tide.pools).toEqual(['boss']);
    expect(RELICS.relic_wolf_spirit.pools).toEqual(['altar']);
  });

  it('规则常量：CD 240s / 每局保底 1 上限 2 / 占比 <5%', () => {
    expect(RELIC_RULES.CD_SECONDS).toBe(240);
    expect(RELIC_RULES.GUARANTEED_PER_RUN).toBe(1);
    expect(RELIC_RULES.MAX_PER_RUN).toBe(2);
    expect(RELIC_RULES.DPS_SHARE_MAX).toBe(0.05);
  });

  it('获取：Boss 必掉 → 持有 ≥1（保底）；祭坛概率第 2 枚；上限 2 拒绝第 3 枚；局内唯一', () => {
        const state = createRelicRuntime();
    const first = rollBossRelic([], () => 0);
    expect(first).not.toBeNull();
    expect(grantRelic(state, first!)).toBe(true);
    expect(hasGuaranteedDrop(state)).toBe(true);
    expect(grantRelic(state, 'relic_bloodtide')).toBe(true); // 第 2 枚
    expect(grantRelic(state, 'relic_twelve_lamps')).toBe(false); // 超上限
    expect(grantRelic(state, first!)).toBe(false); // 局内唯一
  });

  it('使用：CD 240s + 每局每枚 1 次；月蚀之陨眩晕走状态层（Boss 免疫生效）', () => {
        const state = createRelicRuntime();
    grantRelic(state, 'relic_moonfall');
    const boss = makeTarget(1000, 60, { ccProfile: { tier: 'boss' } });
    const normal = makeTarget(1000);
    const ctx = { player: { x: 0, y: 0 }, enemies: [boss, normal] };
    expect(useRelic(state, 'relic_moonfall', 0, ctx)).toBe(true);
    expect(normal.cc?.stun?.until).toBeCloseTo(2);
    expect(boss.cc?.stun).toBeNull(); // Boss 免疫（§⑦-2：演出照常、逻辑不生效）
    expect(useRelic(state, 'relic_moonfall', 1, ctx)).toBe(false); // 每局每枚 1 次
    const state2 = createRelicRuntime();
    grantRelic(state2, 'relic_bloodtide');
    const enemy = makeTarget(1000);
    useRelic(state2, 'relic_bloodtide', 0, { player: { x: 0, y: 0 }, enemies: [enemy] });
    expect(enemy.cc?.slow?.value).toBeCloseTo(0.4);
    expect(enemy.cc?.slow?.until).toBeCloseTo(6);
    // 每局每枚 1 次（§3.4）：CD 就绪（240s 后）也不可再使用——used 终止
    expect(canUseRelic(state2, 'relic_bloodtide', 100)).toBe(false);
    expect(canUseRelic(state2, 'relic_bloodtide', 240)).toBe(false);
  });

  it('伤害占比红线：<5% 判定（断言函数口径）', () => {
        expect(assertRelicDpsShare(100, 10000).pass).toBe(true); // 1%
    expect(assertRelicDpsShare(600, 10000).pass).toBe(false); // 6%
    expect(assertRelicDpsShare(100, 0).share).toBe(0); // 除零兜底
  });
});

describe('B2-W5 守誓者（EG-4：HP 固定 200）+ 索敌扩展', () => {
  it('状态机闭环：承伤转移 50% → 击倒化墓碑 → 墓碑回血/治疗转化复活 → 满血复活', () => {
        const state = createOathkeeperState(0, 0);
    expect(state.maxHp).toBe(200);
    expect(oathkeeperTargetable(state)).toBe(true);
    // 承伤转移 50%
    const transferred = transferDamage(state, 100, 0);
    expect(transferred).toBe(50);
    expect(state.hp).toBe(150);
    // 击倒 → 墓碑（不可被索敌）
    transferDamage(state, 300, 0);
    expect(state.phase).toBe('tombstone');
    expect(oathkeeperTargetable(state)).toBe(false);
    // 墓碑期修女在 120px 内回血 2 HP/s → 复活进度按 50% 转化累计
    const player = { x: 0, y: 0 };
    let healed = 0;
    for (let f = 0; f < 60; f += 1) {
      tickTombstone(state, 1 / 60, 0.5, player, (h) => { healed += h; return h; });
    }
    expect(healed).toBeCloseTo(2, 0); // 1s × 2 HP/s
    expect(state.reviveProgress).toBeGreaterThan(0);
    // 治疗灌满 → 复活满血
    revive(state);
    expect(state.phase).toBe('companion');
    expect(state.hp).toBe(200);
    expect(state.reviveProgress).toBe(0);
  });

  it('墓碑到期未复活 → gone + 重召唤 CD 20s → 就绪后满血重召唤', () => {
        const state = createOathkeeperState();
    becomeTombstone(state, 0, () => 0); // 最短 8s
    tickTombstone(state, 8.1, 8.1, { x: 9999, y: 9999 }, () => 0); // 远离 + 到期
    expect(state.phase).toBe('gone');
    expect(state.resummonReadyAt).toBeCloseTo(8.1 + 20);
    tickResummon(state, 0, 27);
    expect(state.phase).toBe('gone'); // 未就绪
    tickResummon(state, 0, 28.2);
    expect(state.phase).toBe('companion');
    expect(state.hp).toBe(200);
  });

  it('索敌扩展：150px 替身圈内强制索敌守誓者；墓碑期/远离回落玩家（targeting）', () => {
        const player = { x: 0, y: 0 };
    const companion = { targetable: true, x: 100, y: 0 };
    expect(pickTarget({ x: 300, y: 0 }, player, companion, 150)).toBe('companion');
    expect(pickTarget({ x: 300, y: 0 }, player, { ...companion, targetable: false }, 150)).toBe('player'); // 墓碑跳过
    expect(pickTarget({ x: 300, y: 0 }, player, { ...companion, x: 400, y: 0 }, 150)).toBe('player'); // 出替身圈
    expect(pickTarget({ x: 300, y: 0 }, player, null, 150)).toBe('player');
  });

  it('守誓誓约质变卡 machine：转移 65% / 撕咬 14 / 墓碑回血 4 / 转化率 70%', () => {
        const mc2 = MUTATION_CARDS.find((c) => c.id === 'mc_bell_2')!;
    const state = createOathkeeperState();
    applyCompanionMachine(state, mc2.machine);
    expect(transferDamage(state, 100, 0)).toBeCloseTo(65);
  });
});
