import { describe, it, expect } from 'vitest';
import { ACTIVE_SKILL, ACTIVE_SKILL_RULES } from '@/config/balance';
import {
  stunEnemiesInRadius,
  activeSkillDpsShare,
  maxCastsInWindow,
  castsAtInterval,
  activeSkillDamageTotal,
  simulateActiveSkillDpsShare,
  simulateDefenseSkillUsage,
  type StunnableLike,
} from '@/active-skill/active-skill-math';

function makeEnemy(x: number, y: number, opts: Partial<StunnableLike> = {}): StunnableLike {
  return { active: true, x, y, stunnedUntil: 0, ...opts };
}

describe('主动技纯数学层（M1b 迷你验证 / content §2.2 / pillars §5-②）', () => {
  it('配置：提灯闪耀 = DEFENSE / CD 20s / 半径 240px / 眩晕 2.5s / 无敌 1.5s / 防抖 0.1s', () => {
    expect(ACTIVE_SKILL.ID).toBe('hero_edmund_lantern_flash');
    expect(ACTIVE_SKILL.TYPE).toBe('DEFENSE');
    expect(ACTIVE_SKILL.CD).toBe(20);
    expect(ACTIVE_SKILL.RADIUS).toBe(240);
    expect(ACTIVE_SKILL.STUN_DURATION).toBe(2.5);
    expect(ACTIVE_SKILL.INVULN_DURATION).toBe(1.5);
    expect(ACTIVE_SKILL.INPUT_LOCK_SECONDS).toBe(0.1);
    // CD 落在 pillars §6.4 红线 12~25s
    expect(ACTIVE_SKILL.CD).toBeGreaterThanOrEqual(12);
    expect(ACTIVE_SKILL.CD).toBeLessThanOrEqual(25);
  });

  it('stunEnemiesInRadius：240px 内 active 敌人被眩晕 2.5s，界外/未激活不眩晕', () => {
    const center = { x: 0, y: 0 };
    const in1 = makeEnemy(100, 0);
    const in2 = makeEnemy(-200, 0); // 距 200 < 240
    const edge = makeEnemy(240, 0); // 距 240 = 半径（圆-圆含边界：<= radius²）
    const out = makeEnemy(300, 0); // 距 300 > 240
    const inactive = makeEnemy(50, 0, { active: false });
    const stunned = stunEnemiesInRadius([in1, in2, edge, out, inactive], center, ACTIVE_SKILL.RADIUS, ACTIVE_SKILL.STUN_DURATION, 10);
    expect(stunned).toBe(3);
    expect(in1.stunnedUntil).toBeCloseTo(12.5, 6);
    expect(in2.stunnedUntil).toBeCloseTo(12.5, 6);
    expect(edge.stunnedUntil).toBeCloseTo(12.5, 6);
    expect(out.stunnedUntil).toBe(0);
    expect(inactive.stunnedUntil).toBe(0);
  });

  it('stunEnemiesInRadius：不缩短已有更长眩晕（Math.max）', () => {
    const e = makeEnemy(50, 0, { stunnedUntil: 30 }); // 已有眩晕到 30
    stunEnemiesInRadius([e], { x: 0, y: 0 }, ACTIVE_SKILL.RADIUS, ACTIVE_SKILL.STUN_DURATION, 10);
    expect(e.stunnedUntil).toBe(30); // 不缩短
  });

  it('stunEnemiesInRadius：空/全 inactive 安全返回 0', () => {
    expect(stunEnemiesInRadius([], { x: 0, y: 0 }, 240, 2.5, 10)).toBe(0);
    expect(stunEnemiesInRadius([makeEnemy(0, 0, { active: false })], { x: 0, y: 0 }, 240, 2.5, 10)).toBe(0);
  });

  it('activeSkillDpsShare：防御型 0 伤害 → 占比恒 0（≤15% 红线天然满足）', () => {
    expect(activeSkillDpsShare(0, 20_000)).toBe(0);
    expect(activeSkillDpsShare(0, 0)).toBe(0); // 除零兜底
    expect(activeSkillDpsShare(1500, 10_000)).toBeCloseTo(0.15, 6); // 伤害型边界示例
  });

  it('maxCastsInWindow：CD 20s、360s 窗口 → 理论 18 次（≤18 红线，pillars §5-②）', () => {
    expect(maxCastsInWindow(360, ACTIVE_SKILL.CD)).toBe(18);
    expect(maxCastsInWindow(360, 20)).toBe(18);
    expect(maxCastsInWindow(0, 20)).toBe(0);
    expect(maxCastsInWindow(360, 0)).toBe(0);
  });

  it('castsAtInterval：中位 30s 一次、360s → 12 次（pillars §5-② 目标中位 ~12）', () => {
    expect(castsAtInterval(360, ACTIVE_SKILL_RULES.CAST_INTERVAL_MEDIAN)).toBe(12);
    expect(castsAtInterval(360, 30)).toBe(12);
  });

  it('simulateDefenseSkillUsage：防御型 6 分钟模拟 —— 次数不越红线、占比 0', () => {
    const r = simulateDefenseSkillUsage(360, ACTIVE_SKILL.CD);
    expect(r.maxCasts).toBe(18);
    expect(r.typicalCasts).toBe(12);
    expect(r.share).toBe(0);
    expect(r.maxCastsWithinRedline).toBe(true);
  });

  it('simulateActiveSkillDpsShare：伤害型边界分析（BURST 型 M2 复用）', () => {
    // 中位 12 次 × 单次 150（2.5×冲击波）在 33.5 武器 DPS 下占比 <15%
    const typical = simulateActiveSkillDpsShare({ windowSeconds: 360, casts: 12, damagePerCast: 150, weaponDps: 33.5 });
    expect(typical.share).toBeLessThan(ACTIVE_SKILL_RULES.DPS_SHARE_MAX);
    // 全满 18 次 × 150 在低 DPS 33.5 下逼近红线 —— 边界敏感点（报告 CONCERNS 素材）
    const worst = simulateActiveSkillDpsShare({ windowSeconds: 360, casts: 18, damagePerCast: 150, weaponDps: 33.5 });
    expect(activeSkillDamageTotal(18, 150)).toBe(2700);
    expect(worst.totalDamage).toBeGreaterThan(0);
  });
});
