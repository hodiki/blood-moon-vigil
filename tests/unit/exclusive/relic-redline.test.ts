import { describe, it, expect } from 'vitest';
import { RELICS, RELIC_RULES } from '@/config/balance';
import { assertRelicDpsShare, relicDpsShare } from '@/relics/relic-engine';

/**
 * EN-09 圣物回归断言（D12 · gdd-exclusive-weapons v1.3 尾章表 #3/#4）。
 *
 * GDD 权威算式（尾章）：
 *   占比 = Σ(圣物窗口总伤) / 全源总伤 ≤ (2 × 8s × 40) / (440 × 40) = 640 / 17600 = 3.64% < 5%（余量 1.36pp）
 *   逐枚换算：十二灯誓约 = 8 伤/s × N̄(140px 环内亡者类，软上限 5) × 8s ≤ 320（单枚 ≤1.82%）
 *             银潮汐     = 6 伤/s × N̄(220px 域内敌人，软上限 7) × 8s ≤ 336（单枚 ≤1.91%）
 *   两枚合计 ≤ 3.64~3.82% ✓。目标数软上限（5 / 7）是「<5%」成立的**必要条件**。
 *
 * 「全源总伤」参考分母取 GDD 尾章给的 440 × 40 = 17600（工程锚，模拟批次校准）。
 */

/** GDD 尾章「全源总伤」参考分母（440 × 40）。 */
const REF_TOTAL_DAMAGE = 440 * 40; // 17600

/** 单枚窗口总伤 = burnDps × 目标数软上限 × 持续秒（最坏情况按软上限封顶）。 */
function windowDamage(burnDps: number, softCapTargets: number, duration: number): number {
  return burnDps * softCapTargets * duration;
}

describe('EN-09 · 圣物配置锚（D12 v1.3 尾章 #3/#4）', () => {
  it('十二灯誓约：burnDps 8 / auraRadius 140 / 软上限 5 / 承伤 −20% / 8s', () => {
    const p = RELICS.relic_twelve_lamps.params;
    expect(p['burnDps']).toBe(8);
    expect(p['auraRadius']).toBe(140);
    expect(p['softCapTargets']).toBe(5);
    expect(p['damageReductionPct']).toBe(0.2);
    expect(p['duration']).toBe(8);
  });

  it('银潮汐：radius 220 / burnDps 6 / 软上限 7 / 8s', () => {
    const p = RELICS.relic_silver_tide.params;
    expect(p['radius']).toBe(220);
    expect(p['burnDps']).toBe(6);
    expect(p['softCapTargets']).toBe(7);
    expect(p['duration']).toBe(8);
  });
});

describe('EN-09 · 伤害占比 <5% 算式与目标数断言', () => {
  it('逐枚窗口总伤 = 320 / 336（≤1.82% / ≤1.91%）', () => {
    const lamps = windowDamage(8, 5, 8);
    const tide = windowDamage(6, 7, 8);
    expect(lamps).toBe(320);
    expect(tide).toBe(336);
    expect(relicDpsShare(lamps, REF_TOTAL_DAMAGE)).toBeCloseTo(0.0182, 3); // ≤1.82%
    expect(relicDpsShare(tide, REF_TOTAL_DAMAGE)).toBeCloseTo(0.0191, 3); // ≤1.91%
    expect(assertRelicDpsShare(lamps, REF_TOTAL_DAMAGE).pass).toBe(true);
    expect(assertRelicDpsShare(tide, REF_TOTAL_DAMAGE).pass).toBe(true);
  });

  it('两枚合计 ≤ 656 / 17600 = 3.73% < 5%（GDD 头条算式 640/17600 = 3.64% 同向）', () => {
    const total = windowDamage(8, 5, 8) + windowDamage(6, 7, 8); // 656
    expect(total).toBe(656);
    expect(relicDpsShare(total, REF_TOTAL_DAMAGE)).toBeLessThan(RELIC_RULES.DPS_SHARE_MAX);
    expect(assertRelicDpsShare(total, REF_TOTAL_DAMAGE).pass).toBe(true);
    // GDD 尾章头条算式（2 × 8s × 40）/（440 × 40）
    const headline = (2 * 8 * 40) / (440 * 40);
    expect(headline).toBeCloseTo(0.0364, 4);
    expect(headline).toBeLessThan(RELIC_RULES.DPS_SHARE_MAX);
  });

  it('目标数软上限是「<5%」成立的必要条件：越限（N=10）→ 两枚合计越 5%', () => {
    // 软上限封顶 → 合规
    const capped = windowDamage(8, 5, 8) + windowDamage(6, 7, 8);
    expect(assertRelicDpsShare(capped, REF_TOTAL_DAMAGE).pass).toBe(true);
    // 若实测 N̄ 越过软上限（亡潮高峰 N=10）→ 十二灯 640 + 银潮汐 480 = 1120 → 6.36% > 5%
    const uncapped = windowDamage(8, 10, 8) + windowDamage(6, 10, 8);
    expect(uncapped).toBe(1120);
    expect(relicDpsShare(uncapped, REF_TOTAL_DAMAGE)).toBeGreaterThan(RELIC_RULES.DPS_SHARE_MAX);
    expect(assertRelicDpsShare(uncapped, REF_TOTAL_DAMAGE).pass).toBe(false);
  });
});
