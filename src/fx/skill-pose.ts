/**
 * fx/skill-pose.ts —— 主动技姿态叠层（纯函数；TA：伤害瞬发，表现 300+150ms，不挡移动）
 *
 * 玩法无蓄力资源（gdd-active-skill §3.1）；本模块只决定播哪一帧。
 */

import { FX } from '@/config/balance';

export type SkillPosePhase = 'a' | 'b';

/**
 * 姿态计时（纯逻辑，可脱离 Phaser 单测）：Player 委托本类记录释放时刻。
 * <0 = 未在播（skillPosePhase 判 null → 回 idle）。
 */
export class SkillPoseClock {
  private startedAtMs = -1;

  /** 释放瞬间调用（与 fx 模板并行；不挡移动） */
  start(nowMs: number): void {
    this.startedAtMs = nowMs;
  }

  /** 距释放的毫秒；未开始为 -1 */
  elapsedMs(nowMs: number): number {
    return this.startedAtMs < 0 ? -1 : nowMs - this.startedAtMs;
  }
}

/** 释放后经过 elapsedMs：a → b → null（回 idle） */
export function skillPosePhase(elapsedMs: number): SkillPosePhase | null {
  if (elapsedMs < 0) return null;
  if (elapsedMs < FX.SKILL_POSE_A_MS) return 'a';
  if (elapsedMs < FX.SKILL_POSE_A_MS + FX.SKILL_POSE_B_MS) return 'b';
  return null;
}

export function skillPoseFrameName(base: string, phase: SkillPosePhase): string {
  return `${base}-skill-${phase}`;
}

export function bossEntranceFrameName(base: string): string {
  return `${base}-entrance`;
}

export function skillPoseTotalMs(): number {
  return FX.SKILL_POSE_A_MS + FX.SKILL_POSE_B_MS;
}
