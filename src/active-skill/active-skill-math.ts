/**
 * active-skill/active-skill-math.ts —— 主动技纯数学层（M1b 主动技迷你验证）
 *
 * 纯函数（可脱离 Phaser 单测，test-framework §1.2）：眩晕半径结算 / 无敌延长 /
 * 主动技 DPS 占比 / 释放次数模拟。Phaser 装配在 active-skill.ts 与 PlayScene。
 *
 * 数据源：content-design-outline §2.2 + pillars-v1 §5/§6（红线：CD ≥12s、
 * 每局触发 ≤18 次、中位 ~12 次、DPS 占比 ≤15%、不打断移动、无资源条）。
 *
 * 口径说明：
 * - 提灯闪耀为 DEFENSE 型（眩晕+无敌），本身 0 伤害 → activeSkillDpsShare 恒 0，
 *   ≤15% 红线对防御型天然满足（「效果型不计伤害但必须有可感知战局影响」，pillars §6.5）。
 * - 本模块同时提供「伤害型主动技」边界分析函数（simulateActiveSkillDpsShare），
 *   供 M2 若新增 BURST 型技能时复用的占比校验。
 */

import { ACTIVE_SKILL_RULES } from '@/config/balance';

/** 可被眩晕的目标（Enemy 结构性满足） */
export interface StunnableLike {
  readonly active: boolean;
  x: number;
  y: number;
  /** 眩晕截止（秒时间戳）：> now 期间冻结移动与接触伤害 */
  stunnedUntil: number;
}

/**
 * 眩晕半径内 active 敌人：`stunnedUntil = max(现截止, now + duration)`（不缩短已有更长眩晕）。
 * 返回被眩晕（含刷新）数量；对空/全 inactive 安全。
 */
export function stunEnemiesInRadius(
  enemies: readonly StunnableLike[],
  center: { x: number; y: number },
  radius: number,
  durationSeconds: number,
  now: number,
): number {
  let stunned = 0;
  const radiusSq = radius * radius;
  for (const e of enemies) {
    if (!e.active) continue;
    const dx = e.x - center.x;
    const dy = e.y - center.y;
    if (dx * dx + dy * dy > radiusSq) continue;
    e.stunnedUntil = Math.max(e.stunnedUntil, now + durationSeconds);
    stunned += 1;
  }
  return stunned;
}

/**
 * 主动技 DPS 占比 = 主动技总伤害 / 总伤害（0 ≤ share）。
 * 防御型（0 伤害）→ 恒 0；totalDamage ≤ 0 兜底 0（防除零）。
 */
export function activeSkillDpsShare(activeSkillTotalDamage: number, totalDamage: number): number {
  if (totalDamage <= 0) return 0;
  return activeSkillTotalDamage / totalDamage;
}

/** 窗口内理论最大释放次数 = floor(窗口 / CD)（CD 20s、360s → 18；pillars §5-②） */
export function maxCastsInWindow(windowSeconds: number, cdSeconds: number): number {
  if (cdSeconds <= 0) return 0;
  return Math.floor(windowSeconds / cdSeconds);
}

/** 按中位间隔释放次数 ≈ floor(窗口 / 间隔)（间隔 30s、360s → 12；pillars §5-②） */
export function castsAtInterval(windowSeconds: number, intervalSeconds: number): number {
  if (intervalSeconds <= 0) return 0;
  return Math.floor(windowSeconds / intervalSeconds);
}

/** 主动技总伤害 = 次数 × 单次价值 */
export function activeSkillDamageTotal(casts: number, damagePerCast: number): number {
  return casts * damagePerCast;
}

/** 6 分钟模拟入参（对伤害型技能的占比边界分析；防御型 damagePerCast = 0） */
export interface DpsShareSimInput {
  /** 模拟局时秒（6:00 收束 = 360） */
  windowSeconds: number;
  /** 主动技释放次数（maxCastsInWindow / castsAtInterval 产出） */
  casts: number;
  /** 主动技单次价值（伤害型 90~150 = 1.5~2.5×冲击波 60；防御型 0） */
  damagePerCast: number;
  /** 武器平均 DPS（含成长；设计口径 Boss 期 60~75，保守下限可给 33.5 全开参考） */
  weaponDps: number;
}

export interface DpsShareSimResult {
  casts: number;
  activeSkillTotalDamage: number;
  weaponTotalDamage: number;
  totalDamage: number;
  /** 主动技 DPS 占比（判据 ≤ ACTIVE_SKILL_RULES.DPS_SHARE_MAX） */
  share: number;
}

/** 6 分钟模拟：主动技 DPS 占比（模拟口径与 pillars §5-③ 埋点 activeSkillDpsShare 一致） */
export function simulateActiveSkillDpsShare(input: DpsShareSimInput): DpsShareSimResult {
  const activeSkillTotalDamage = activeSkillDamageTotal(input.casts, input.damagePerCast);
  const weaponTotalDamage = input.weaponDps * input.windowSeconds;
  const totalDamage = activeSkillTotalDamage + weaponTotalDamage;
  return {
    casts: input.casts,
    activeSkillTotalDamage,
    weaponTotalDamage,
    totalDamage,
    share: activeSkillDpsShare(activeSkillTotalDamage, totalDamage),
  };
}

/** 便捷：防御型（无伤害）6 分钟模拟 —— 占比恒 0，且释放次数不越红线 */
export function simulateDefenseSkillUsage(windowSeconds: number, cdSeconds: number): {
  maxCasts: number;
  typicalCasts: number;
  share: number;
  maxCastsWithinRedline: boolean;
} {
  const maxCasts = maxCastsInWindow(windowSeconds, cdSeconds);
  const typicalCasts = castsAtInterval(windowSeconds, ACTIVE_SKILL_RULES.CAST_INTERVAL_MEDIAN);
  return {
    maxCasts,
    typicalCasts,
    share: 0, // 防御型无伤害
    maxCastsWithinRedline: maxCasts <= ACTIVE_SKILL_RULES.MAX_CASTS_PER_RUN,
  };
}

/**
 * BURST 型守则合规判定（AC-C2 / sprint-m2-plan R7）：
 * **CD ≥18s 或单次价值 ≤120** → 允许入池；违例配置（CD<18 且单次>120）
 * 在 `simulateActiveSkillDpsShare` 强制断言 FAIL（满 18 次 × 150 伤 × 40 DPS ≈ 15.8% 越线）。
 * 供 M2 后续 BURST 技能（狼裔血月狂化/未来伤害型技能）入池校验复用。
 */
export function burstGuardCompliant(cdSeconds: number, damagePerCast: number): boolean {
  return (
    cdSeconds >= ACTIVE_SKILL_RULES.BURST_MIN_CD ||
    damagePerCast <= ACTIVE_SKILL_RULES.BURST_MAX_DAMAGE_PER_CAST
  );
}
