import { describe, it, expect } from 'vitest';
import { budgetPiecewise, piecewiseMean } from '@/spawner/spawner';
import {
  XP_C_CASES,
  needXpCase,
  BUDGET_PIECEWISE_ENDPOINTS,
  BUDGET_ANCHOR_RANGES,
  checkHardConstraints,
  type XpCaseRunAgg,
} from '../../../tools/sim/xp-cases';

describe('budget 分段五端点（gdd-spawner-v2 §③-1 / difficulty-v3 §5.3）', () => {
  it('五端点均值逐点落在 GDD 锚区间（0/60/120/240/360 可独立断言）', () => {
    for (const [t, lo, hi] of BUDGET_ANCHOR_RANGES) {
      const mean = piecewiseMean(t, BUDGET_PIECEWISE_ENDPOINTS);
      expect(mean).toBeGreaterThanOrEqual(lo);
      expect(mean).toBeLessThanOrEqual(hi);
    }
  });

  it('分段线性插值：段内线性（60~120 段中点 = 端点均值）', () => {
    const mid = piecewiseMean(90, BUDGET_PIECEWISE_ENDPOINTS);
    const [m60, m120] = [1.1, 1.6];
    expect(mid).toBeCloseTo((m60 + m120) / 2, 6);
  });

  it('t 越界 clamp 首末端点', () => {
    expect(piecewiseMean(-5, BUDGET_PIECEWISE_ENDPOINTS)).toBe(1.0);
    expect(piecewiseMean(400, BUDGET_PIECEWISE_ENDPOINTS)).toBe(3.4);
  });

  it('60s 均值落 1.0~1.2（H2 前段压平断言；旧曲线 1.44 → 压平）', () => {
    const mean = piecewiseMean(60, BUDGET_PIECEWISE_ENDPOINTS);
    expect(mean).toBeGreaterThanOrEqual(1.0);
    expect(mean).toBeLessThanOrEqual(1.2);
  });

  it('正弦波保留：波峰 = 均值 ×(1+amp)、波谷 = 均值 ×(1−amp)（周期 60s）', () => {
    // 60s 处均值 1.1，sin(2π×15/60)=1 → 峰在段内 15s（均值 ≈1.0125）
    const peak = budgetPiecewise(15, BUDGET_PIECEWISE_ENDPOINTS, 0.25, 60);
    const mean15 = piecewiseMean(15, BUDGET_PIECEWISE_ENDPOINTS);
    expect(peak).toBeCloseTo(mean15 * 1.25, 6);
    const trough = budgetPiecewise(45, BUDGET_PIECEWISE_ENDPOINTS, 0.25, 60);
    const mean45 = piecewiseMean(45, BUDGET_PIECEWISE_ENDPOINTS);
    expect(trough).toBeCloseTo(mean45 * 0.75, 6);
  });

  it('波峰波谷差 ≥30% 可感知判据维持', () => {
    const samples: number[] = [];
    for (let t = 0; t <= 360; t += 5) samples.push(budgetPiecewise(t, BUDGET_PIECEWISE_ENDPOINTS, 0.25, 60));
    const peak = Math.max(...samples);
    const trough = Math.min(...samples);
    expect((peak - trough) / trough).toBeGreaterThanOrEqual(0.3);
  });
});

describe('XP c 案两段式 needXp（difficulty-v3 §5.2 SC-2 定稿参数）', () => {
  it('三档参数与 GDD 表逐项一致', () => {
    expect(XP_C_CASES.map((c) => [c.needFirst, c.earlyStep, c.lateStep, c.enemyXpMult, c.enemyHpLink])).toEqual([
      [4, 3, 5, 0.6, 1.075], // c-温和 4/3/5 −40% ×1.05~1.10（中值 1.075）
      [4, 3, 6, 0.55, 1.125], // c-标准 4/3/6 −45% ×1.10~1.15
      [5, 4, 7, 0.5, 1.175], // c-陡峭 5/4/7 −50% ×1.15~1.20
    ]);
  });

  it('两段式形状：need(1)=needFirst；前 3 级增量 earlyStep；第 5 级起 lateStep（c-标准）', () => {
    const c = XP_C_CASES[1]!;
    expect(needXpCase(c, 1)).toBe(4);
    expect(needXpCase(c, 2)).toBe(7); // +3
    expect(needXpCase(c, 3)).toBe(10); // +3
    expect(needXpCase(c, 4)).toBe(13); // +3（前 3 级增量）
    expect(needXpCase(c, 5)).toBe(19); // +6（中后段）
    expect(needXpCase(c, 6)).toBe(25); // +6
  });

  it('c-陡峭：need(1)=5 / 增量 4→7', () => {
    const c = XP_C_CASES[2]!;
    expect(needXpCase(c, 1)).toBe(5);
    expect(needXpCase(c, 2)).toBe(9);
    expect(needXpCase(c, 4)).toBe(17);
    expect(needXpCase(c, 5)).toBe(24); // +7
  });

  it('敌 XP 下调倍率：0.6/0.55/0.5（−40%/−45%/−50%）', () => {
    expect(XP_C_CASES.map((c) => c.enemyXpMult)).toEqual([0.6, 0.55, 0.5]);
  });
});

describe('硬约束判定（difficulty-v3 §5.2 任一档必须满足，违者换档）', () => {
  const base: XpCaseRunAgg = {
    medianFirstLevelAt: 20,
    medianOffersBeforeElite: 5,
    medianOffers: 14,
    medianLevel: 17,
    medianMaxLateGap: 25,
    medianLateGap: 15,
  };

  it('全约束满足 → 全 PASS', () => {
    const results = checkHardConstraints(base);
    expect(results).toHaveLength(5);
    expect(results.every((r) => r.pass)).toBe(true);
  });

  it('首级越带（<18 或 >22）→ 约束 1 FAIL', () => {
    expect(checkHardConstraints({ ...base, medianFirstLevelAt: 8 })[0]!.pass).toBe(false);
    expect(checkHardConstraints({ ...base, medianFirstLevelAt: 25 })[0]!.pass).toBe(false);
  });

  it('offers 出带（<12 或 >18）→ 约束 3 FAIL；等级出带 → 约束 4 FAIL', () => {
    expect(checkHardConstraints({ ...base, medianOffers: 11 })[2]!.pass).toBe(false);
    expect(checkHardConstraints({ ...base, medianOffers: 19 })[2]!.pass).toBe(false);
    expect(checkHardConstraints({ ...base, medianLevel: 13 })[3]!.pass).toBe(false);
    expect(checkHardConstraints({ ...base, medianLevel: 21 })[3]!.pass).toBe(false);
  });

  it('后段最长升级间隔 >30s → 约束 5 FAIL（防 XP 断层取最坏间隔口径）', () => {
    expect(checkHardConstraints({ ...base, medianMaxLateGap: 31 })[4]!.pass).toBe(false);
  });
});
