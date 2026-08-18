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
  /** 厚血保底间隔 s：仅 3–8min 阶段为 20s；其余阶段无保底 = Infinity */
  tankGuaranteeEvery: number;
}

/** 构成权重阶段表（spawner §③：0–3min / 3–8min / 8–15min / 15–20min；TASK-39 R1 波次2 权重重构） */
export const SPAWN_STAGES: readonly SpawnStage[] = [
  { start: 0, end: 180, weights: { zombie: 0.9, wolf: 0.1, tank: 0 }, tankGuaranteeEvery: Number.POSITIVE_INFINITY },
  { start: 180, end: 480, weights: { zombie: 0.78, wolf: 0.2, tank: 0.02 }, tankGuaranteeEvery: SPAWNER.TANK_GUARANTEE_EVERY_SECONDS },
  { start: 480, end: 900, weights: { zombie: 0.55, wolf: 0.36, tank: 0.09 }, tankGuaranteeEvery: Number.POSITIVE_INFINITY },
  { start: 900, end: SPAWNER.BOSS_TIME, weights: { zombie: 0.45, wolf: 0.35, tank: 0.16 }, tankGuaranteeEvery: Number.POSITIVE_INFINITY },
] as const;

/**
 * 生成预算（点数/s）：budget(t) = 1.2 × (1 + 3.0×t/1200) × (1 + 0.3×sin(2πt/75))
 * 完整公式（含正弦波峰波谷，spawner §③；TASK-39 R1 波次2 参数已收敛于 balance SPAWNER）。
 */
export function budget(t: number): number {
  const linear = 1 + (SPAWNER.LINEAR_SCALE * t) / SPAWNER.LINEAR_TOTAL_SECONDS;
  const wave = 1 + SPAWNER.WAVE_AMPLITUDE * Math.sin((2 * Math.PI * t) / SPAWNER.WAVE_PERIOD_SECONDS);
  return SPAWNER.BASE_BUDGET * linear * wave;
}

/**
 * 平均预算（去掉正弦项，即 spawner §③ 压力曲线表的"平均预算"列）：
 * 1.2 → 1.35 → 1.65 → ... → 4.2。文档对照用；实际生成用 budget(t)。
 */
export function budgetMean(t: number): number {
  return SPAWNER.BASE_BUDGET * (1 + (SPAWNER.LINEAR_SCALE * t) / SPAWNER.LINEAR_TOTAL_SECONDS);
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
 * 20:00 Boss 收束触发判定（S8 §⑥.3 / E4-S3）：局时秒 ≥ BOSS_TIME（1200s）即触发。
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
