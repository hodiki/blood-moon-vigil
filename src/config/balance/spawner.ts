/**
 * config/balance/spawner.ts —— 敌潮生成器预算曲线
 *
 * balance.ts 域拆分（EG-1）纯搬移：数值与注释原样保留，不改任何行为。
 */

/**
 * 敌潮生成器（spawner §③，E2-S4 / spawner.test 埋点断言）。
 * budget(t) = 1.2 × (1 + 1.2×t/360) × (1 + 0.3×sin(2πt/60))。
 * TASK-39 R1 波次2：LINEAR_SCALE 2.5→3.0、WAVE_AMPLITUDE 0.4→0.3；
 * TASK-43 R2：LINEAR_SCALE 3.0→3.3（20min 均值 4.8→5.16 点/s，整体 +10% 密度，
 * 前期小怪/经验节奏提速）；WAVE_AMPLITUDE 0.3 不动（峰谷比 1.86 仍 ≥40%，S8-3）。
 * TASK-31 收尾节奏调整（rhythm-pace-adj §4）：6min 局压缩 3.3 倍 ——
 * LINEAR_TOTAL_SECONDS 1200→360（对齐 BOSS_TIME）、LINEAR_SCALE 3.3→1.2
 * （前期斜率放缓保「就爽」，360s 均值 2.64 点/s vs 旧 20min 5.16）、
 * WAVE_PERIOD_SECONDS 75→60（360s 局 6 个波峰波谷，30s 交替咬合升级间隔）。
 */
export const SPAWNER = {
  BASE_BUDGET: 1.2, // 基数 点/s
  LINEAR_SCALE: 1.2, // 线性项系数（TASK-31 收尾：3.3→1.2，对齐 6min 局）
  LINEAR_TOTAL_SECONDS: 360, // 6 分钟线性项分母（对齐 BOSS_TIME）
  WAVE_AMPLITUDE: 0.3, // 正弦波幅 ±30%（R1 波次2；仍满足相邻周期差异 ≥40%）
  WAVE_PERIOD_SECONDS: 60, // 正弦周期（TASK-31 收尾：75→60，6 个波峰波谷）
  BOSS_TIME: 360, // 6:00 Boss 收束（TASK-31 收尾：1200→360）
  RETRY_PAUSE_SECONDS: 2, // 达上限暂停生成 2s 后重试（不丢弃预算）
  /**
   * 厚血保底按阶段（TASK-31 收尾，rhythm-pace-adj §2：由全局 30s → S2=30s / S3=20s）。
   * 本常量即 S2 阶段保底（spawner.ts SPAWN_STAGES 引用）；S3=20s 见 TANK_GUARANTEE_EVERY_SECONDS_S3。
   * 决策记录：E3 C3 首验 20s→40s（TASK-15）；E4 用户真机回调 40s→30s（TASK-18）；
   * TASK-43 R2 保持 30s 并靠 0–3min 随机 0.5% 提前首见（8/8 种子 ≤3.2min）。
   * TASK-31 后：S1 无保底（随机 0.5% 保留惊喜首见）、S2=30s（2:00/2:30/3:00 各 1 只 → 3min 前必见 ≥2 保底精英）、
   * S3=20s（Boss 前峰值爬升）。
   */
  TANK_GUARANTEE_EVERY_SECONDS: 30, // S2（120–240s）保底间隔
  /** TASK-31 收尾：S3（240–360s）保底间隔（Boss 前峰值段加密） */
  TANK_GUARANTEE_EVERY_SECONDS_S3: 20,
  /** TASK-39 E2 屠夫预警：保底厚血出生前 N 秒在出生点显示血月印记（红圈精灵 + 低音） */
  TANK_WARNING_SECONDS: 2.5,
} as const;

/**
 * budget 分段五端点（NV-BATCH-G G1 冻结：模拟冻结 2026-09-02，5400 局，
 * production/official-v1/sim-freeze-recommendation.md §③）。
 * 均值端点 [t, mean]（gdd-spawner-v2 §③-1 分段线性插值 + 正弦波）：
 * 0s 1.0（锚 0.9~1.1）/ 60s 1.1（锚 1.0~1.2，H2 前段压平）/ 120s 1.6 /
 * 240s 2.4 / 360s 3.4（锚 3.2~3.6）。
 * 鲁棒性依据：六变体扰动（legacy 基线 + 端点下/中/上沿 + S1 压平两沿）约束 2/3/4 判定零翻转。
 */
export const BUDGET_PIECEWISE_ENDPOINTS: ReadonlyArray<readonly [number, number]> = [
  [0, 1.0], [60, 1.1], [120, 1.6], [240, 2.4], [360, 3.4],
] as const;

/** 正弦波参数（NV-BATCH-G G1 冻结：波幅 ±0.25 为 0.2~0.3 锚中值、周期 60s 保留） */
export const BUDGET_WAVE = { amplitude: 0.25, period: 60 } as const;

/**
 * 端点锚区间表（GDD §5.3 五端点可独立断言；自 tools/sim/xp-cases.ts BUDGET_ANCHOR_RANGES
 * 迁移为运行时断言数据源，NV-BATCH-G G1）。
 */
export const BUDGET_ANCHOR_RANGES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0.9, 1.1], [60, 1.0, 1.2], [120, 1.6, 1.6], [240, 2.4, 2.4], [360, 3.2, 3.6],
] as const;
