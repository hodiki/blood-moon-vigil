import { describe, it, expect } from 'vitest';
import { ACTIVE_SKILLS, ACTIVE_SKILL_RULES } from '@/config/balance';
import {
  isMarked,
  weaponDamageOnTarget,
  applyMarkInRadius,
  dashDirection,
  dashStep,
  dashSegmentHits,
  damageAndMarkDash,
  applySlowInRadius,
  slowedSpeed,
  healFractionOfMax,
  rageMultiplierAdd,
  rageMoveSpeedPct,
  contactAuraFlatDps,
  contactAuraTick,
  RageBuff,
  type DashEnemyLike,
  type SlowableLike,
} from '@/active-skill/active-skill-effects';

/** 构造可标记/可减速/可伤害假敌（结构性满足各接口） */
function makeEnemy(overrides: Partial<DashEnemyLike> = {}): DashEnemyLike {
  const enemy: DashEnemyLike = {
    active: true,
    x: 0,
    y: 0,
    radius: 10,
    hp: 100,
    markUntil: 0,
    markDamageMult: 1,
    kill: () => {
      (enemy as DashEnemyLike & { active: boolean }).active = false;
    },
    ...overrides,
  };
  return enemy;
}

describe('E4-S2 血影突袭·标记（MOBILITY：命中标记 4s 受武器伤害 +20%）', () => {
  it('isMarked：now < markUntil 为真；未标记（0）恒假', () => {
    expect(isMarked({ markUntil: 10 }, 5)).toBe(true);
    expect(isMarked({ markUntil: 10 }, 10)).toBe(false);
    expect(isMarked({ markUntil: 0 }, 5)).toBe(false);
  });

  it('weaponDamageOnTarget：标记目标 ×1.20；未标记 ×1（血影突袭 markDamageMult=1.2）', () => {
    const cfg = ACTIVE_SKILLS.hero_cassandra;
    expect(cfg.markDamageMult).toBe(1.2);
    expect(cfg.markDuration).toBe(4);
    expect(weaponDamageOnTarget(100, { markUntil: 10, markDamageMult: 1.2 }, 5)).toBe(120);
    expect(weaponDamageOnTarget(100, { markUntil: 5, markDamageMult: 1.2 }, 5)).toBe(100); // 标记过期
    expect(weaponDamageOnTarget(100, { markUntil: 0, markDamageMult: 1.2 }, 5)).toBe(100);
  });

  it('applyMarkInRadius：半径内标记 active 敌人；重复标记刷新截止为较晚者', () => {
    const e1 = makeEnemy({ x: 0, y: 0, markUntil: 5, markDamageMult: 1 });
    const e2 = makeEnemy({ x: 0, y: 60, markUntil: 0, markDamageMult: 1 });
    const e3 = makeEnemy({ x: 0, y: 300, markUntil: 0, markDamageMult: 1 });
    const n = applyMarkInRadius([e1, e2, e3], { x: 0, y: 0 }, 100, 4, 1.2, 10);
    expect(n).toBe(2);
    expect(e1.markUntil).toBe(Math.max(5, 14)); // 刷新为较晚者
    expect(e2.markUntil).toBe(14);
    expect(e3.markUntil).toBe(0); // 半径外不标记
  });
});

describe('E4-S2 血影突袭·冲刺（240px / 路径 40 伤 / 标记）', () => {
  it('配置：dashDistance 240 / dashDamage 40 / damageMultFactor 0.5（只吃 0.5× 总倍率）', () => {
    const cfg = ACTIVE_SKILLS.hero_cassandra;
    expect(cfg.dashDistance).toBe(240);
    expect(cfg.dashDamage).toBe(40);
    expect(cfg.damageMultFactor).toBe(0.5);
  });

  it('dashDirection：朝输入方向；无输入默认右向（释放前输入向量语义 gdd §⑥.2）', () => {
    expect(dashDirection({ x: 1, y: 0 })).toEqual({ x: 1, y: 0 });
    expect(dashDirection({ x: 0, y: -1 })).toEqual({ x: 0, y: -1 });
    const d = dashDirection({ x: 0.6, y: 0.8 });
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(1, 6);
    expect(dashDirection({ x: 0, y: 0 })).toEqual({ x: 1, y: 0 });
  });

  it('dashStep：0.2s 内跑完 240px（1200px/s）；step ≤ remaining', () => {
    const r1 = dashStep(240, 0.1, 240, 0.2);
    expect(r1.step).toBeCloseTo(120, 6);
    expect(r1.remaining).toBeCloseTo(120, 6);
    const r2 = dashStep(10, 0.1, 240, 0.2);
    expect(r2.step).toBeCloseTo(10, 6); // 尾段 clamp
    expect(r2.remaining).toBe(0);
  });

  it('dashSegmentHits：路径线段命中敌人（扫掠）；路径外不命中', () => {
    const onPath = makeEnemy({ x: 120, y: 0, radius: 10 });
    const offPath = makeEnemy({ x: 120, y: 50, radius: 10 });
    const hits = dashSegmentHits([onPath, offPath], { x: 0, y: 0 }, { x: 240, y: 0 }, 14);
    expect(hits).toContain(onPath);
    expect(hits).not.toContain(offPath);
  });

  it('damageAndMarkDash：路径命中扣血 + 标记 + 击杀回收', () => {
    const e1 = makeEnemy({ x: 100, y: 0, hp: 50 });
    const e2 = makeEnemy({ x: 200, y: 0, hp: 5 });
    const result = damageAndMarkDash([e1, e2], { x: 0, y: 0 }, { x: 240, y: 0 }, 14, 40, 4, 1.2, 100);
    expect(result.hit).toBe(2);
    expect(e1.hp).toBe(10); // 50 - 40
    expect(e1.markUntil).toBe(104); // 标记 4s
    expect(e2.active).toBe(false); // 40 ≥ 5 → 击杀
    expect(result.killed).toBe(1);
  });
});

describe('E4-S2 安魂曲·减速 + 回复（DEFENSE：300px 减速 40% 4s + 回复 20%）', () => {
  it('配置：radius 300 / slowPct 0.4 / slowDuration 4 / healPct 0.2', () => {
    const cfg = ACTIVE_SKILLS.hero_violet;
    expect(cfg.radius).toBe(300);
    expect(cfg.slowPct).toBe(0.4);
    expect(cfg.slowDuration).toBe(4);
    expect(cfg.healPct).toBe(0.2);
  });

  it('applySlowInRadius：半径内减速 40% 4s；重复刷新截止为较晚者', () => {
    const e1: SlowableLike = { active: true, x: 0, y: 0, slowUntil: 5, slowPct: 0 };
    const e2: SlowableLike = { active: true, x: 0, y: 200, slowUntil: 0, slowPct: 0 };
    const e3: SlowableLike = { active: true, x: 0, y: 400, slowUntil: 0, slowPct: 0 };
    const n = applySlowInRadius([e1, e2, e3], { x: 0, y: 0 }, 300, 4, 0.4, 10);
    expect(n).toBe(2);
    expect(e1.slowUntil).toBe(14);
    expect(e1.slowPct).toBe(0.4);
    expect(e2.slowUntil).toBe(14);
    expect(e3.slowUntil).toBe(0); // 半径外
  });

  it('slowedSpeed：减速期内 ×0.6（1-0.4）；过期恢复原速', () => {
    expect(slowedSpeed(100, { slowUntil: 10, slowPct: 0.4 }, 5)).toBe(60);
    expect(slowedSpeed(100, { slowUntil: 10, slowPct: 0.4 }, 10)).toBe(100);
    expect(slowedSpeed(100, { slowUntil: 0, slowPct: 0.4 }, 5)).toBe(100);
  });

  it('healFractionOfMax：回复 20% 最大生命（clamp 到 maxHp；返回实际回复量）', () => {
    const stats = { hp: 50, maxHp: 100 };
    const healed = healFractionOfMax(stats, 0.2);
    expect(healed).toBe(20);
    expect(stats.hp).toBe(70);
    // 满血回复 0
    const full = { hp: 100, maxHp: 100 };
    expect(healFractionOfMax(full, 0.2)).toBe(0);
  });
});

describe('E4-S2 血月狂化·BURST（8s 移速 +30% / 倍率 +0.40 / 接触光环 25 伤/s 平摊 / 击杀回 1 HP）', () => {
  it('配置：duration 8 / moveSpeedPct 0.3 / rageMultiplierAdd +0.40（加法）/ contactAuraFlat 25 / lifestealOnKill 1', () => {
    const cfg = ACTIVE_SKILLS.hero_galvan;
    expect(cfg.duration).toBe(8);
    expect(cfg.moveSpeedPct).toBe(0.3);
    expect(rageMultiplierAdd()).toBe(ACTIVE_SKILL_RULES.RAGE_MULTIPLIER_ADD);
    expect(rageMoveSpeedPct()).toBe(0.3);
    expect(contactAuraFlatDps()).toBe(ACTIVE_SKILL_RULES.CONTACT_AURA_FLAT_DPS);
    expect(cfg.lifestealOnKill).toBe(1);
  });

  it('RageBuff：8s 窗口 active/remaining/clear', () => {
    const rage = new RageBuff();
    expect(rage.active(0)).toBe(false);
    rage.apply(10, 8);
    expect(rage.active(10)).toBe(true);
    expect(rage.active(17.9)).toBe(true);
    expect(rage.remaining(15)).toBeCloseTo(3, 6);
    expect(rage.active(18)).toBe(false);
    rage.clear();
    expect(rage.active(12)).toBe(false);
  });

  it('contactAuraTick：接触半径内任一敌人在场即全额 tick，不按敌数叠加（平摊）', () => {
    // 单敌：全额 25 伤/s × mult
    const one = makeEnemy({ x: 20, y: 0, hp: 100 });
    const r1 = contactAuraTick([one], { x: 0, y: 0 }, 60, 1, 25, 1);
    expect(r1.hit).toBe(1);
    expect(r1.damageDealt).toBeCloseTo(25, 6);
    expect(one.hp).toBeCloseTo(75, 6);
    // 多敌：总伤害仍 25/s，在敌间平摊（不随敌数膨胀）
    const a = makeEnemy({ x: 20, y: 0, hp: 100 });
    const b = makeEnemy({ x: -20, y: 0, hp: 100 });
    const c = makeEnemy({ x: -40, y: 0, hp: 100 });
    const r2 = contactAuraTick([a, b, c], { x: 0, y: 0 }, 60, 1, 25, 1);
    expect(r2.damageDealt).toBeCloseTo(25, 6);
    expect(a.hp).toBeCloseTo(100 - 25 / 3, 6);
    expect(b.hp).toBeCloseTo(100 - 25 / 3, 6);
    // 半径外不 tick
    const far = makeEnemy({ x: 100, y: 0, hp: 100 });
    const r3 = contactAuraTick([far], { x: 0, y: 0 }, 60, 1, 25, 1);
    expect(r3.hit).toBe(0);
    expect(far.hp).toBe(100);
  });

  it('接触光环吃 0.5× 总倍率（damageMult = 0.5 × total）', () => {
    const e = makeEnemy({ x: 10, y: 0, hp: 100 });
    const r = contactAuraTick([e], { x: 0, y: 0 }, 60, 2, 25, 0.5 * 2.04);
    expect(r.damageDealt).toBeCloseTo(25 * 2.04, 6); // 2s × 25 × 1.02
  });
});

describe('E4-S2 主动技配置跨表闭合（gdd-active-skill §3.2）', () => {
  it('4 角色各 1 主动技：类型/CD/充能与 §3.2 一致', () => {
    expect(ACTIVE_SKILLS.hero_edmund).toMatchObject({ type: 'DEFENSE', cd: 20 });
    expect(ACTIVE_SKILLS.hero_cassandra).toMatchObject({ type: 'MOBILITY', cd: 12, charges: 2, chargeInterval: 8 });
    expect(ACTIVE_SKILLS.hero_violet).toMatchObject({ type: 'DEFENSE', cd: 22 });
    expect(ACTIVE_SKILLS.hero_galvan).toMatchObject({ type: 'BURST', cd: 24 });
  });

  it('BURST 守则（AC-C2）：狼裔 CD 24 ≥18 合规（burstGuardCompliant 口径）', () => {
    const cfg = ACTIVE_SKILLS.hero_galvan;
    expect(cfg.cd).toBeGreaterThanOrEqual(ACTIVE_SKILL_RULES.BURST_MIN_CD);
  });
});
