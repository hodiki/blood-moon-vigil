/**
 * fx/skill-pose.ts —— 主动技姿态叠层（纯函数；TA：伤害瞬发，表现 300+150ms，不挡移动）
 *
 * 玩法无蓄力资源（gdd-active-skill §3.1）；本模块只决定播哪一帧。
 * 艾德蒙 skill-a / skill-b 是两套独立基础姿，禁止 a→b 连播。
 * 其它角色仍可 combo（前摇→施放）。
 */

import { FX } from '@/config/balance';

export type SkillPosePhase = 'a' | 'b';
export type SkillPosePlay = { kind: 'combo' } | { kind: 'hold'; phase: SkillPosePhase };

/**
 * 姿态计时（纯逻辑，可脱离 Phaser 单测）：Player 委托本类记录释放时刻。
 * <0 = 未在播（skillPosePhase 判 null → 回 idle）。
 */
export class SkillPoseClock {
  private startedAtMs = -1;
  private play: SkillPosePlay = { kind: 'combo' };

  /** 释放瞬间调用（与 fx 模板并行；不挡移动） */
  start(nowMs: number, play: SkillPosePlay = { kind: 'combo' }): void {
    this.startedAtMs = nowMs;
    this.play = play;
  }

  stop(): void {
    this.startedAtMs = -1;
  }

  /** 距释放的毫秒；未开始为 -1 */
  elapsedMs(nowMs: number): number {
    return this.startedAtMs < 0 ? -1 : nowMs - this.startedAtMs;
  }

  posePlay(): SkillPosePlay {
    return this.play;
  }
}

/** 释放后经过 elapsedMs：combo = a → b → null；hold = 单帧到底 → null */
export function skillPosePhase(elapsedMs: number, play: SkillPosePlay = { kind: 'combo' }): SkillPosePhase | null {
  if (elapsedMs < 0) return null;
  const total = FX.SKILL_POSE_A_MS + FX.SKILL_POSE_B_MS;
  if (play.kind === 'hold') return elapsedMs < total ? play.phase : null;
  if (elapsedMs < FX.SKILL_POSE_A_MS) return 'a';
  if (elapsedMs < total) return 'b';
  return null;
}

/** 艾德蒙按衍生技钉一帧；左轮开火姿未过则不叠层。其余角色仍 combo。 */
export function skillPosePlayForCast(visualFrame: string, skillId: string): SkillPosePlay | null {
  if (visualFrame === 'player') {
    if (skillId === 'dv_lantern_flash') return { kind: 'hold', phase: 'a' };
    if (skillId === 'dv_revolver_burst') return null;
    return { kind: 'hold', phase: 'a' };
  }
  return { kind: 'combo' };
}

/** 专武在手的站姿（不挡走循环）。艾德蒙提灯 → skill-b 灯前探。左轮开火姿归专武阶段。 */
export function skillPoseStanceForExclusive(visualFrame: string, exclusiveId: string | null): SkillPosePhase | null {
  if (visualFrame === 'player' && exclusiveId === 'xw_lantern') return 'b';
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
