/**
 * fx/skill-pose.ts —— 主动技姿态叠层（纯函数；TA：伤害瞬发，表现 300+150ms，不挡移动）
 *
 * 玩法无蓄力资源（gdd-active-skill §3.1）；本模块只决定播哪一帧。
 */

import { FX } from '@/config/balance';

export type SkillPosePhase = 'a' | 'b';

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
