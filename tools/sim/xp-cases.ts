/**
 * tools/sim/xp-cases.ts —— XP 曲线 c 案三档参数 + budget 分段端点（W-E，gdd-difficulty-v3 §5.2/§5.3）
 *
 * SC-2 定稿：c 案 = needXp 两段式上调（X1 前段加速保首级时点 + X2 中后段加陡）
 * × 敌 XP 下调 × 敌面板 HP 联动，三联动合并核算。
 * ⚠ 三档均为**模拟复测锚**（本批只出数据不回填 balance，c 案裁决归用户）；
 * 裁决后单轮冻结（S-3），届时参数迁入 config/balance/xp.ts。
 */

/** c 案档位参数（need(1) / 前 3 级增量 / 中后段增量 / 敌 XP 下调 / HP 联动） */
export interface XpCaseParams {
  id: 'c-mild' | 'c-standard' | 'c-steep';
  label: string;
  /** need(1)：首级需求（4~5 锚；与敌 XP 大降构成对冲组） */
  needFirst: number;
  /** 前 3 级增量（X1 前段加速） */
  earlyStep: number;
  /** 中后段增量（X2/c 加陡） */
  lateStep: number;
  /** 敌 XP 产出倍率（−40%/−45%/−50% → 0.60/0.55/0.50） */
  enemyXpMult: number;
  /** 敌面板 HP 联动系数（仅基础面板；精英/Boss 独立曲线不吃，§5.1） */
  enemyHpLink: number;
  /** GDD 预期 offers 落差收敛带（对照参考） */
  expectedOffersConvergence: string;
}

/** 三档参数（difficulty-v3 §5.2 表；HP 联动取区间中值） */
export const XP_C_CASES: readonly XpCaseParams[] = [
  {
    id: 'c-mild', label: 'c-温和',
    needFirst: 4, earlyStep: 3, lateStep: 5,
    enemyXpMult: 0.6, enemyHpLink: 1.075,
    expectedOffersConvergence: '1.4~1.6×',
  },
  {
    id: 'c-standard', label: 'c-标准（推荐基准）',
    needFirst: 4, earlyStep: 3, lateStep: 6,
    enemyXpMult: 0.55, enemyHpLink: 1.125,
    expectedOffersConvergence: '1.2~1.4×',
  },
  {
    id: 'c-steep', label: 'c-陡峭',
    needFirst: 5, earlyStep: 4, lateStep: 7,
    enemyXpMult: 0.5, enemyHpLink: 1.175,
    expectedOffersConvergence: '1.0~1.2×',
  },
];

/**
 * c 案两段式 needXp：need(1) = needFirst；第 2~4 级增量 = earlyStep（前 3 级增量）；
 * 第 5 级起增量 = lateStep（中后段）。
 */
export function needXpCase(c: XpCaseParams, level: number): number {
  if (level <= 1) return c.needFirst;
  return c.needFirst + (level <= 4 ? c.earlyStep : c.lateStep) * (level - 1) - (level <= 4 ? 0 : (c.lateStep - c.earlyStep) * 3);
}

/**
 * budget 分段五端点（gdd-difficulty-v3 §5.3 四段均值端点锚中值）：
 * 0s 1.0（0.9~1.1）/ 60s 1.1（1.0~1.2 压平）/ 120s 1.6 / 240s 2.4 / 360s 3.4（3.2~3.6）。
 * 波幅 ±0.25（0.2~0.3 中值）、周期 60s 保留。
 */
export const BUDGET_PIECEWISE_ENDPOINTS: ReadonlyArray<readonly [number, number]> = [
  [0, 1.0], [60, 1.1], [120, 1.6], [240, 2.4], [360, 3.4],
] as const;

export const BUDGET_PIECEWISE_WAVE = { amplitude: 0.25, period: 60 } as const;

/** 端点锚区间（验收断言：五端点可独立断言） */
export const BUDGET_ANCHOR_RANGES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0.9, 1.1], [60, 1.0, 1.2], [120, 1.6, 1.6], [240, 2.4, 2.4], [360, 3.2, 3.6],
] as const;

// ---- 硬约束判据（difficulty-v3 §5.2：任一档必须满足，违者换档） ----

export interface HardConstraintResult {
  constraint: string;
  target: string;
  actual: string;
  pass: boolean;
}

export interface XpCaseRunAgg {
  /** 首级时点中位 s */
  medianFirstLevelAt: number | null;
  /** 首精英前（≤150s）offers 中位 */
  medianOffersBeforeElite: number | null;
  /** 6min offers 中位（全口径 = 升级次数，sim 占位口径与 calib 矩阵一致） */
  medianOffers: number | null;
  /** 等级终值中位 */
  medianLevel: number | null;
  /** 中后段（≥120s）最长升级间隔中位 s（防 XP 断层判据取最坏间隔） */
  medianMaxLateGap: number | null;
  /** 中后段升级间隔中位（参考） */
  medianLateGap: number | null;
}

/** 硬约束逐项判定（PASS/FAIL） */
export function checkHardConstraints(agg: XpCaseRunAgg): HardConstraintResult[] {
  const results: HardConstraintResult[] = [];
  const first = agg.medianFirstLevelAt;
  results.push({
    constraint: '1. 首级 18~22s（X1 保留，H2/H3 对冲）',
    target: '18~22s',
    actual: first === null ? '—' : `${first}s`,
    pass: first !== null && first >= 18 && first <= 22,
  });
  results.push({
    constraint: '2. 首精英前（90~150s）offers ≥3（P1 保底席位可承接）',
    target: '≥3',
    actual: `${agg.medianOffersBeforeElite ?? '—'}`,
    pass: (agg.medianOffersBeforeElite ?? 0) >= 3,
  });
  results.push({
    constraint: '3. 6min offers 中位 12~18（基准局 14 ±30%）',
    target: '12~18',
    actual: `${agg.medianOffers ?? '—'}`,
    pass: (agg.medianOffers ?? 0) >= 12 && (agg.medianOffers ?? 0) <= 18,
  });
  results.push({
    constraint: '4. 等级终值 Lv14~20（两段式 + c 案重标）',
    target: 'Lv14~20',
    actual: `Lv${agg.medianLevel ?? '—'}`,
    pass: (agg.medianLevel ?? 0) >= 14 && (agg.medianLevel ?? 0) <= 20,
  });
  results.push({
    constraint: '5. 中后段最长升级间隔 ≤30s（防 XP 断层挫败；取最坏间隔口径）',
    target: '≤30s',
    actual: agg.medianMaxLateGap === null ? '—' : `${agg.medianMaxLateGap}s`,
    pass: (agg.medianMaxLateGap ?? 999) <= 30,
  });
  return results;
}
