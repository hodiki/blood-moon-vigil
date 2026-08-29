/**
 * progression/revive.ts —— 复活判定序（B5-W3，gdd-talent-tree §⑥-3 GT-9 判定序列表）
 *
 * 判定序（同帧多来源不叠用，取最高优先级一者）：
 * 1. 濒死护盾（up_g_8）：未死（护盾先扣）——Player.hurt 既有消费，本模块只见「已用否」；
 * 2. 圣物级免死：**接口预留**（当前圣物池无；新增时优先于天赋复活）；
 * 3. 天赋复活（Q-c/Q-e）：最低触发优先级——第一次 50%、第二次 30% 递减；1.5s 无敌 + 击退 100px。
 * 1~2 均不可用且无天赋复活 → 正常死亡。
 * 纯函数（test-framework §1.2）；HP 恢复/无敌帧/击退执行由调用方（Player.hurt 链）承担。
 */

import { TALENT_REVIVE } from '@/config/balance';

/** 复活判定入参 */
export interface ReviveJudgeInput {
  /** 濒死护盾是否可用（up_g_8 未使用） */
  shieldAvailable: boolean;
  /** 圣物级免死是否可用（接口预留；当前恒 false） */
  relicFreeDeathAvailable: boolean;
  /** 天赋复活剩余次数（Q-c=1 / Q-c+Q-e=2） */
  talentChargesRemaining: number;
  /** 本局已用天赋复活次数（第二次 30% 递减） */
  talentRevivesUsed: number;
}

export type ReviveVerdict = 'shield' | 'relic' | 'talent' | 'death';

/**
 * 复活判定序（GT-9 落档）：护盾 → 圣物（预留）→ 天赋复活（最低优先级）→ 死亡。
 * talentChargesRemaining > 0 才走天赋复活；同帧多来源不叠用（返回单一裁决）。
 */
export function judgeRevive(input: ReviveJudgeInput): ReviveVerdict {
  if (input.shieldAvailable) return 'shield';
  if (input.relicFreeDeathAvailable) return 'relic';
  if (input.talentChargesRemaining > 0) return 'talent';
  return 'death';
}

/** 天赋复活恢复 HP 比例：第一次 50% / 第二次 30% 递减（GT-9；第三次起不可达——次数锁 2） */
export function talentReviveHpPct(revivesUsed: number): number {
  return revivesUsed <= 0 ? TALENT_REVIVE.FIRST_HP_PCT : TALENT_REVIVE.SECOND_HP_PCT;
}

/** 复活后无敌帧时长 s（1.5，防「复活即死」循环） */
export function talentReviveInvulnSeconds(): number {
  return TALENT_REVIVE.INVULN_SECONDS;
}

/** 复活瞬间周身击退 px（100） */
export function talentReviveKnockbackPx(): number {
  return TALENT_REVIVE.KNOCKBACK_PX;
}

/** Q-c/Q-e 全点亮后的总次数（2） */
export function maxTalentReviveCharges(hasQc: boolean, hasQe: boolean): number {
  if (!hasQc) return 0;
  return hasQe ? 2 : 1;
}
