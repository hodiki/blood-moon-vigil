/**
 * spawner/spawner.ts —— 敌潮生成器·纯函数层（ARCH §2 / S5 / E2-S4）
 *
 * 纯逻辑（test-framework §1.2：budget(t) / 阶段权重 / 同屏节流决策抽为纯函数，
 * 可脱离 Phaser 单测）。Phaser 装配类在 spawner/enemy-spawner.ts。
 * 数值全部来自 config/balance.ts SPAWNER 常量（唯一数据源）。
 *
 * 帧率无关（S8 §⑥.5）：预算按秒累加、掉帧不跳怪 —— 秒制累加由 EnemySpawner 负责，
 * 本层只给「每秒点数」「某时刻构成」「某次抽签结果」。
 */

import { SPAWNER } from '@/config/balance';
import type { EnemyKindId } from '@/enemies/enemy-types';

export interface StageWeights {
  zombie: number;
  wolf: number;
  tank: number;
}

export interface SpawnStage {
  /** 阶段起止秒（左闭右开；末阶段到 BOSS_TIME 为止） */
  start: number;
  end: number;
  weights: StageWeights;
  /** 厚血保底间隔 s：S2=30s、S3=20s；无保底阶段 = Infinity */
  tankGuaranteeEvery: number;
}

/**
 * 构成权重阶段表（spawner §③；TASK-31 收尾节奏调整 rhythm-pace-adj §2：4 段→3 段；
 * TASK-32 裁决 CONCERNS #1（rhythm-pace-adj §9）：S3 tank 0.12→0.05，C3 判据重标定）：
 * - S1 0–120s（0–2min）：上手爽感；tank 0.5% 随机保留「惊喜首见」
 * - S2 120–240s（2–4min）：精英期，保底每 30s 开启（2:00/2:30/3:00 各 1 只 → 3min 前必见 ≥2 保底精英）
 * - S3 240–360s（4–6min）：Boss 前峰值爬升，保底加密至每 20s；
 *   tank 0.05（TASK-32 裁决，防「0.12→360s≈27.5 绝望墙」；wolf 0.33 提速逼走位）
 * 权重和均为 1.0（0.90+0.095+0.005 / 0.80+0.17+0.03 / 0.62+0.33+0.05）。
 */
export const SPAWN_STAGES: readonly SpawnStage[] = [
  { start: 0, end: 120, weights: { zombie: 0.9, wolf: 0.095, tank: 0.005 }, tankGuaranteeEvery: Number.POSITIVE_INFINITY },
  { start: 120, end: 240, weights: { zombie: 0.8, wolf: 0.17, tank: 0.03 }, tankGuaranteeEvery: SPAWNER.TANK_GUARANTEE_EVERY_SECONDS },
  { start: 240, end: SPAWNER.BOSS_TIME, weights: { zombie: 0.62, wolf: 0.33, tank: 0.05 }, tankGuaranteeEvery: SPAWNER.TANK_GUARANTEE_EVERY_SECONDS_S3 },
] as const;

/**
 * 生成预算（点数/s）：budget(t) = 1.2 × (1 + 1.2×t/360) × (1 + 0.3×sin(2πt/60))
 * 完整公式（含正弦波峰波谷，spawner §③；TASK-39 R1 波次2 + TASK-43 R2 + TASK-31 收尾
 * 参数收敛于 balance SPAWNER）。
 */
export function budget(t: number): number {
  const linear = 1 + (SPAWNER.LINEAR_SCALE * t) / SPAWNER.LINEAR_TOTAL_SECONDS;
  const wave = 1 + SPAWNER.WAVE_AMPLITUDE * Math.sin((2 * Math.PI * t) / SPAWNER.WAVE_PERIOD_SECONDS);
  return SPAWNER.BASE_BUDGET * linear * wave;
}

/**
 * 平均预算（去掉正弦项，即 spawner §③ 压力曲线表的"平均预算"列）：
 * 1.2 → 1.44 → 1.68 → ... → 2.64。文档对照用；实际生成用 budget(t)。
 */
export function budgetMean(t: number): number {
  return SPAWNER.BASE_BUDGET * (1 + (SPAWNER.LINEAR_SCALE * t) / SPAWNER.LINEAR_TOTAL_SECONDS);
}

/**
 * budget 分段曲线（gdd-spawner-v2 §③-1 修订定稿 / gdd-difficulty-v3 §5.3 B2 案）：
 * 分段线性插值端点 + 正弦波幅/周期共 6 参数（端点参数化，五端点可独立断言）。
 * 端点锚（均值 点/s）：0s 0.9~1.1 / 60s 1.0~1.2（H2 前段压平）/ 120s ~1.6 /
 * 240s ~2.4 / 360s 3.2~3.6。端点值由调用方传入（模拟复测锚裁决后冻结；
 * 运行时切换属 B2 实装基线批 W-8 联动，本批不替换既有 budget(t)）。
 *
 * @param t 局时秒
 * @param endpoints 均值端点表 [t, mean]（升序；t 越界 clamp 首末段）
 * @param waveAmplitude 正弦波幅（±0.2~0.3 锚）
 * @param wavePeriodSeconds 正弦周期（60s 锚）
 */
export function budgetPiecewise(
  t: number,
  endpoints: ReadonlyArray<readonly [number, number]>,
  waveAmplitude: number,
  wavePeriodSeconds: number,
): number {
  if (endpoints.length === 0) return 0;
  const mean = piecewiseMean(t, endpoints);
  const wave = 1 + waveAmplitude * Math.sin((2 * Math.PI * t) / wavePeriodSeconds);
  return mean * wave;
}

/** 分段线性插值（均值；t 越界 clamp 首末端点） */
export function piecewiseMean(
  t: number,
  endpoints: ReadonlyArray<readonly [number, number]>,
): number {
  const first = endpoints[0]!;
  const last = endpoints[endpoints.length - 1]!;
  if (t <= first[0]) return first[1];
  if (t >= last[0]) return last[1];
  for (let i = 1; i < endpoints.length; i += 1) {
    const [t1, m1] = endpoints[i]!;
    const [t0, m0] = endpoints[i - 1]!;
    if (t <= t1) return m0 + ((m1 - m0) * (t - t0)) / (t1 - t0);
  }
  return last[1];
}

/** 局时 → 阶段（t 越界 clamp 到首/末阶段） */
export function stageForTime(t: number): SpawnStage {
  for (const stage of SPAWN_STAGES) {
    if (t >= stage.start && t < stage.end) return stage;
  }
  if (t < SPAWN_STAGES[0]!.start) return SPAWN_STAGES[0]!;
  return SPAWN_STAGES[SPAWN_STAGES.length - 1]!;
}

/**
 * 按阶段权重抽敌人类型：r ∈ [0,1) 均匀随机数 → 类型。
 * 权重和为 1；tank 权重 0 的阶段 r<1 永远抽不到 tank（r 恒 < 1）。
 */
export function pickEnemyKind(weights: StageWeights, r: number): EnemyKindId {
  if (r < weights.zombie) return 'zombie';
  if (r < weights.zombie + weights.wolf) return 'wolf';
  return 'tank';
}

/** 厚血保底判定：该阶段有保底且累计秒数达标 → 强制下一只厚血（spawner §③） */
export function tankGuaranteeDue(accumulatedSeconds: number, guaranteeEvery: number): boolean {
  return Number.isFinite(guaranteeEvery) && accumulatedSeconds >= guaranteeEvery;
}

/**
 * 6:00 Boss 收束触发判定（S8 §⑥.3 / E4-S3）：局时秒 ≥ BOSS_TIME（360s）即触发。
 * 由 EnemySpawner.update 在 RUNNING 态秒制累加后调用；dt ≤50ms（clampDelta），
 * 触发误差 ≤ 单帧 dt ≤ 0.05s，满足 RV-C8「±0.1s」精度。
 */
export function bossTriggerDue(elapsedSeconds: number, bossTime: number): boolean {
  return elapsedSeconds >= bossTime;
}

/**
 * 出生环带位置（S8 §③：距玩家 [ringMin, ringMax] 随机角度，屏外生成）。
 * angle ∈ [0, 2π)、distFraction ∈ [0,1)。
 */
export function spawnPosition(
  centerX: number,
  centerY: number,
  ringMin: number,
  ringMax: number,
  angle: number,
  distFraction: number,
): { x: number; y: number } {
  const dist = ringMin + (ringMax - ringMin) * distFraction;
  return { x: centerX + Math.cos(angle) * dist, y: centerY + Math.sin(angle) * dist };
}
