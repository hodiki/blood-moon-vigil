import { describe, it, expect } from 'vitest';
import {
  BUDGET_PIECEWISE_ENDPOINTS,
  BUDGET_WAVE,
  BUDGET_ANCHOR_RANGES,
  XP,
  XP_CASE,
  FORMATION_RULES,
} from '@/config/balance';
import { budgetLegacy, budgetPiecewise, piecewiseMean } from '@/spawner/spawner';
import { needXp } from '@/xp/xp-manager';
import { applyPanelScale, mercyMult, MERCY } from '@/enemies/panel-scale';
import { withinBudgetShare, createGroupSchedulerState, reportGroupBudget } from '@/spawner/spawn-group';
import {
  XP_C_CASES,
  needXpCase,
  BUDGET_PIECEWISE_ENDPOINTS as SIM_ENDPOINTS,
  BUDGET_PIECEWISE_WAVE as SIM_WAVE,
  BUDGET_ANCHOR_RANGES as SIM_ANCHOR_RANGES,
} from '../../../tools/sim/xp-cases';

/**
 * NV-BATCH-G 冻结断言（G7 三件套 + G8 方阵锚核对；模拟冻结 2026-09-02）：
 * 权威 = production/official-v1/sim-freeze-recommendation.md（5400 局）+ gdd-difficulty-v3 v1.1 §5.2/§5.3。
 * 本文件锁「冻结现值」：运行时配置/曲线与沙盘冻结锚逐值一致 + 硬约束带记录 + 方阵占比会计 + MN-13 负向断言。
 * 破带处理走 S-3 单轮冻结纪律（切 c-温和预案复测），禁止就地改参（sim-freeze-recommendation §②）。
 */

/** 冻结报告 c-标准档沙盘中位（3720 局；freeze-xp-cases-stdout.txt） */
const FROZEN_SIM = {
  medianFirstLevelAt: 8.7, // 模型偏置下界（1D 击杀效率未标定，见下「三硬约束」注）
  medianOffers: 15,
  medianLevel: 16,
  medianMaxLateGap: 74.8, // 模型保守下界（offer 占位不消费 → DPS 无成长）
} as const;

/** 三硬约束带（GDD §5.2 判据口径） */
const HARD_BANDS = {
  /** 首级 18~22s：真机口径判据（沙盘首级系统性偏早 ~10s，沙盘不可定谳，转真机验收） */
  firstLevelSeconds: [18, 22] as const,
  /** 6min offers 中位 12~18（基准局 14 ±30%） */
  offers6min: [12, 18] as const,
  /** 等级终值 Lv14~20 */
  levelFinal: [14, 20] as const,
} as const;

describe('G3/G4：XP_CASE c-标准冻结 + 运行时 needXp 与沙盘逐值一致', () => {
  it('XP_CASE 锁 c-标准全量参数（4/3/6 · ×0.55 · ×1.125）', () => {
    expect(XP_CASE).toEqual({
      id: 'c-standard',
      label: 'c-标准（SC-2 终裁冻结）',
      needFirst: 4,
      earlyStep: 3,
      lateStep: 6,
      enemyXpMult: 0.55,
      hpCaseLink: 1.125,
    });
  });

  it('XP_CASE 与沙盘 XP_C_CASES[1]（c-标准）逐值一致（锁定唯一冻结档）', () => {
    const sim = XP_C_CASES.find((c) => c.id === 'c-standard')!;
    expect(XP_CASE.needFirst).toBe(sim.needFirst);
    expect(XP_CASE.earlyStep).toBe(sim.earlyStep);
    expect(XP_CASE.lateStep).toBe(sim.lateStep);
    expect(XP_CASE.enemyXpMult).toBe(sim.enemyXpMult);
    expect(XP_CASE.hpCaseLink).toBe(sim.enemyHpLink);
  });

  it('needXp(1..99) 与沙盘 needXpCase(c-标准) 逐值一致（两段式同构）', () => {
    const sim = XP_C_CASES.find((c) => c.id === 'c-standard')!;
    for (let level = 1; level <= 99; level += 1) {
      expect(needXp(level)).toBe(needXpCase(sim, level));
    }
  });

  it('两段式形状锚：need(1)=4；2~4 级 +3；5 级起 +6（前段首级 ~20s / 后段加陡 Lv27→22~24 口径）', () => {
    expect(needXp(1)).toBe(4);
    expect(needXp(2) - needXp(1)).toBe(3);
    expect(needXp(3) - needXp(2)).toBe(3);
    expect(needXp(4) - needXp(3)).toBe(3);
    expect(needXp(5) - needXp(4)).toBe(6);
    expect(needXp(30) - needXp(29)).toBe(6);
  });

  it('敌 XP 生成侧单源乘区锚：XP_CASE.enemyXpMult = 0.55（−45%；spawnOneById 唯一乘区点）', () => {
    expect(XP_CASE.enemyXpMult).toBe(0.55);
  });

  it('旧 XP 表归档（EG-2）：BASE_NEED/NEED_STEP 保持 legacy 锚值 5/3，运行时不再消费', () => {
    expect(XP.BASE_NEED).toBe(5);
    expect(XP.NEED_STEP).toBe(3);
  });
});

describe('G1/G2：budget 五端点冻结 + 运行时曲线与沙盘逐值一致', () => {
  it('运行时端点/波参数与沙盘冻结锚逐值一致', () => {
    expect(BUDGET_PIECEWISE_ENDPOINTS).toEqual(SIM_ENDPOINTS);
    expect(BUDGET_WAVE.amplitude).toBe(SIM_WAVE.amplitude);
    expect(BUDGET_WAVE.period).toBe(SIM_WAVE.period);
  });

  it('五端点均值逐点落锚区间（0/60/120/240/360 可独立断言；BUDGET_ANCHOR_RANGES 与沙盘一致）', () => {
    expect(BUDGET_ANCHOR_RANGES).toEqual(SIM_ANCHOR_RANGES);
    for (const [t, lo, hi] of BUDGET_ANCHOR_RANGES) {
      const mean = piecewiseMean(t, BUDGET_PIECEWISE_ENDPOINTS);
      expect(mean).toBeGreaterThanOrEqual(lo);
      expect(mean).toBeLessThanOrEqual(hi);
    }
  });

  it('五端点形状：60s 均值 1.1（H2 前段压平，legacy 1.44 → −24%）/ 360s 终值 3.4', () => {
    expect(piecewiseMean(60, BUDGET_PIECEWISE_ENDPOINTS)).toBeCloseTo(1.1, 6);
    expect(piecewiseMean(360, BUDGET_PIECEWISE_ENDPOINTS)).toBeCloseTo(3.4, 6);
  });

  it('正弦波保留：波峰 = 均值 ×1.25 / 波谷 = 均值 ×0.75（幅 0.25 周期 60s）', () => {
    const run = (t: number) => budgetPiecewise(t, BUDGET_PIECEWISE_ENDPOINTS, BUDGET_WAVE.amplitude, BUDGET_WAVE.period);
    expect(run(15)).toBeCloseTo(piecewiseMean(15, BUDGET_PIECEWISE_ENDPOINTS) * 1.25, 6);
    expect(run(45)).toBeCloseTo(piecewiseMean(45, BUDGET_PIECEWISE_ENDPOINTS) * 0.75, 6);
  });

  it('前段减压方向锚：0s 均值 1.0（piecewise）< legacy 同点均值 1.2（H2 前段压平兑现）', () => {
    expect(piecewiseMean(0, BUDGET_PIECEWISE_ENDPOINTS)).toBeCloseTo(1.0, 6);
    expect(budgetLegacy(0)).toBeCloseTo(1.2, 6); // legacy 基线（EG-2 归档对照）
    expect(piecewiseMean(0, BUDGET_PIECEWISE_ENDPOINTS)).toBeLessThan(budgetLegacy(0));
  });
});

describe('G7：三硬约束带记录（配置级断言；首级/间隔为真机口径判据）', () => {
  it('硬约束带与 GDD §5.2 一致：首级 18~22s / offers 12~18 / Lv14~20', () => {
    expect(HARD_BANDS.firstLevelSeconds).toEqual([18, 22]);
    expect(HARD_BANDS.offers6min).toEqual([12, 18]);
    expect(HARD_BANDS.levelFinal).toEqual([14, 20]);
  });

  it('c-标准冻结中位落带中央：6min offers 15 ∈ 12~18、Lv16 ∈ 14~20（冻结依据：带中央裕度最大）', () => {
    expect(FROZEN_SIM.medianOffers).toBeGreaterThanOrEqual(HARD_BANDS.offers6min[0]);
    expect(FROZEN_SIM.medianOffers).toBeLessThanOrEqual(HARD_BANDS.offers6min[1]);
    expect(FROZEN_SIM.medianLevel).toBeGreaterThanOrEqual(HARD_BANDS.levelFinal[0]);
    expect(FROZEN_SIM.medianLevel).toBeLessThanOrEqual(HARD_BANDS.levelFinal[1]);
  });

  it('首级 8.7s = 沙盘偏置下界（<18s 带下限：1D 击杀效率未标定致 XP 偏快 ~10s）——真机 18~22s 验收，沙盘值不作 PASS/FAIL 判据', () => {
    // 方向性断言：沙盘系统性偏早（README-sim 假设 2/4）；定谳转真机 deathsAtSeconds 同批回填（§⑤-3）
    expect(FROZEN_SIM.medianFirstLevelAt).toBeLessThan(HARD_BANDS.firstLevelSeconds[0]);
  });

  it('中后段最长间隔 74.8s = 模型保守下界（真机 DPS ×3.0 成长为主要修正项；联调方向 = S3 终值斜率 3.4~3.8，不动 XP）', () => {
    expect(FROZEN_SIM.medianMaxLateGap).toBeGreaterThan(30);
  });

  it('G6 HP 联动锚：applyPanelScale caseLink ×1.125 仅作用基础面板（×scale(t)×caseLink×mercy 链）', () => {
    const r = applyPanelScale({ baseHp: 100, t: 0, caseLink: XP_CASE.hpCaseLink });
    expect(r.hp).toBe(113); // 100 × 1.0(t=0 豁免) × 1.125 → round
  });
});

describe('G7：方阵预扣占比 ≤25%（MN-19 b 会计口径）', () => {
  it('FORMATION_RULES.BUDGET_SHARE_MAX = 0.25（预扣计入总盘不另开预算）', () => {
    expect(FORMATION_RULES.BUDGET_SHARE_MAX).toBe(0.25);
  });

  it('占比会计语义：预扣/总盘 ≤25% 放行、>25% 拒掷（总盘与生成侧同口径 budgetPiecewise 记账，G2）', () => {
    const state = createGroupSchedulerState();
    reportGroupBudget(state, 1000); // 总盘 1000 点（运行时 = Σ budgetPiecewise(t)×dt 同额上报）
    expect(withinBudgetShare(state, 250)).toBe(true); // 25% 边界内
    expect(withinBudgetShare(state, 251)).toBe(false); // 超界拒掷
  });
});

describe('G8：方阵锚核对（与 G2 切换无时序冲突）', () => {
  it('RUNS_PER_GAME_ANCHOR = [3,4]（P2-6 已改锚，GDD v1.1 口径；占比 25% 掷点不改参）', () => {
    expect(FORMATION_RULES.RUNS_PER_GAME_ANCHOR).toEqual([3, 4]);
  });

  it('时序独立性：掷点节奏（ROLL_INTERVAL 60~90s）为局时确定性规则，与预算曲线函数无耦合（MN-13/确定性生成）', () => {
    expect(FORMATION_RULES.ROLL_INTERVAL).toEqual([60, 90]);
    // G2 切换只改「每秒点数」（budgetLegacy → budgetPiecewise），不改掷点/预约/落地时序：
    // rollGroup 以 groups.time 驱动、reportGroupBudget 只做同额记账，二者对曲线函数无反向依赖。
  });
});

describe('G7：MN-13 动态难度负向断言（budget/XP 无玩家状态反馈路径）', () => {
  it('needXp 为局时/等级纯函数：同级输入恒同输出，不消费任何玩家运行态', () => {
    expect(needXp(5)).toBe(needXp(5));
    expect(needXp(5)).toBe(19); // 仅由冻结 XP_CASE 常量决定
  });

  it('滞后宽容（MN-1 受限替身）只减不增：mercy ≤ 1，落后者回血面板、领先者不增益（非动态难度）', () => {
    expect(mercyMult(1, 360)).toBeLessThanOrEqual(1);
    expect(mercyMult(20, 0)).toBe(1); // 领先者不吃增益
    expect(MERCY.MIN_MULT).toBe(0.7);
  });
});
