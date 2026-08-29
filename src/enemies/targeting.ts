/**
 * enemies/targeting.ts —— 敌方 AI 索敌扩展（B2-W5，gdd-exclusive-weapons §4.4 ⚠ 工程依赖）
 *
 * 需求（R2 §D）：守誓者承伤替身需要「敌方 AI 可选中友方实体」。
 * 本模块提供**目标选择纯函数**（targetFilter 最小实现，eng-impact-assessment §2.2 登记的
 * 接口字段位）——enemy.updateMovement 当前直线朝玩家移动，接线方式：
 * 调用方（PlayScene/怪物域重做）每帧对敌调 pickTarget，返回值决定移动目标；
 * 墓碑期实体不可被攻击（敌 AI 跳过该实体，§6.1-1）。
 */

/** 友方可选目标（守誓者/月狼等满足） */
export interface FriendlyTargetLike {
  /** 是否可被索敌（墓碑/死亡 = false；敌 AI 跳过） */
  readonly targetable: boolean;
  x: number;
  y: number;
}

export type TargetChoice = 'player' | 'companion';

/**
 * 敌体目标选择（守誓者替身口径）：
 * - 守誓者 targetable（召唤期）且距玩家 ≤ leashRadius（150px 承伤替身圈）→ 强制索敌守誓者；
 * - 否则保持玩家目标。
 * 墓碑期 targetable=false：敌 AI 跳过该实体（不可被攻击），自动回落玩家。
 */
export function pickTarget(
  _enemy: { x: number; y: number },
  player: { x: number; y: number },
  companion: FriendlyTargetLike | null,
  leashRadius: number,
): TargetChoice {
  if (!companion || !companion.targetable) return 'player';
  const dc = Math.hypot(companion.x - player.x, companion.y - player.y);
  if (dc > leashRadius) return 'player';
  // 敌与守誓者距离不设上限（替身圈以「守誓者随行」定义；远离即回落玩家）
  return 'companion';
}
