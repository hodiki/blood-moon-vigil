/**
 * active-skill/active-skill-effects.ts —— 主动技效果结算·纯函数层（E4-S2，4 角色效果注册表）
 *
 * 纯函数（可脱离 Phaser 单测，test-framework §1.2）：标记/减速/回复/冲刺/狂化接触光环。
 * 数据源：gdd-active-skill §3.2 数值表 + ACTIVE_SKILLS（balance.ts）。
 * Phaser 装配（冲刺位移/粒子/FX）在 PlayScene；本模块只做「数值结算」。
 *
 * 覆盖（gdd-active-skill §3.2）：
 * - 血影突袭（MOBILITY）：冲刺 240px / 路径 40 伤 / 命中标记 4s +20% 武器伤；伤害吃 0.5× 总倍率
 * - 安魂曲（DEFENSE）：300px 内减速 40%（4s）+ 回复 20% 最大生命
 * - 血月狂化（BURST）：8s 移速 +30%、倍率 +0.40（加法）；接触光环 25 伤/s 平摊（不按敌数叠加）；击杀回 1 HP
 * - 提灯闪耀（DEFENSE）：眩晕 + 无敌（active-skill-math.stunEnemiesInRadius / player.grantInvulnerability）
 */

import { ACTIVE_SKILL_RULES } from '@/config/balance';
import { computeHitDamage, hitEnemy } from '@/combat/damage';
import {
  applyStatus,
  damageTakenMultiplier,
  type StatusState,
} from '@/combat/status/status-engine';
import type { CcProfile } from '@/combat/status/status-config';

// ============================================================================
// 易伤（原「血影突袭标记」：NV-REVIEW-FIX P0-3 迁入状态层）
// ============================================================================

/**
 * 可被施加易伤的目标（Enemy 结构性满足）。
 * P0-3：原 `markUntil` / `markDamageMult` 平行字段已退役——易伤唯一载体是状态层 `cc.vulnerable`，
 * 抗性（Boss 易伤免疫等）由 `ccProfile` 承接，伤害乘区由 `combat/damage` 唯一入口消费。
 */
export interface MarkableLike {
  readonly active: boolean;
  x: number;
  y: number;
  cc?: StatusState;
  ccProfile?: CcProfile;
}

/** 易伤只读结构（保留旧名以免扩散改名；语义 = 状态层 cc 载荷） */
export interface MarkTargetLike {
  cc?: StatusState;
}

/** 目标当前是否处于易伤（未接状态载荷 = 否） */
export function isMarked(target: Pick<MarkTargetLike, 'cc'>, now: number): boolean {
  return target.cc ? damageTakenMultiplier(target.cc, now) > 1 : false;
}

/**
 * 武器伤害结算：易伤期内 ×(1 + 易伤值)（gdd-status-effects §3.1）。
 * P0-3：委托 `combat/damage.computeHitDamage`（唯一乘区入口），本函数不再自乘 markDamageMult。
 */
export function weaponDamageOnTarget(
  baseDamage: number,
  target: Pick<MarkTargetLike, 'cc'>,
  now: number,
): number {
  return computeHitDamage(baseDamage, 1, target, now);
}

/** 半径内施加易伤（走 applyStatus 抗性/叠加规则；返回被施加数） */
export function applyMarkInRadius(
  enemies: readonly MarkableLike[],
  center: { x: number; y: number },
  radius: number,
  durationSeconds: number,
  mult: number,
  now: number,
): number {
  let marked = 0;
  const radiusSq = radius * radius;
  for (const e of enemies) {
    if (!e.active || !e.cc) continue;
    const dx = e.x - center.x;
    const dy = e.y - center.y;
    if (dx * dx + dy * dy > radiusSq) continue;
    // 易伤值 = mult − 1（旧标记 ×1.20 → 易伤 +0.20）
    e.cc = applyStatus(
      e.cc,
      { kind: 'vulnerable', value: Math.max(0, mult - 1), durationSeconds, source: 'mark' },
      now,
      e.ccProfile,
    ).state;
    marked += 1;
  }
  return marked;
}

// ============================================================================
// 冲刺（血影突袭：向移动方向冲刺 240px；路径上 40 伤）
// ============================================================================

/** 冲刺路径可命中目标（Enemy 结构性满足：cc/radius/hp/kill） */
export interface DashEnemyLike extends MarkableLike {
  radius: number;
  hp: number;
  kill(): void;
}

/** 点-线段距离（复用 weapon-runtime 扫掠数学语义；本地内联防循环依赖） */
function pointSegmentDistance(
  px: number, py: number,
  x0: number, y0: number, x1: number, y1: number,
): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 0.0001) return Math.hypot(px - x0, py - y0);
  let t = ((px - x0) * dx + (py - y0) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = x0 + t * dx;
  const cy = y0 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** 冲刺路径命中判定：从→线段与敌人圆扫掠重叠（gdd §⑥.7 冲刺路径） */
export function dashSegmentHits(
  enemies: readonly DashEnemyLike[],
  from: { x: number; y: number },
  to: { x: number; y: number },
  hitRadius: number,
): DashEnemyLike[] {
  const hits: DashEnemyLike[] = [];
  for (const e of enemies) {
    if (!e.active) continue;
    if (pointSegmentDistance(e.x, e.y, from.x, from.y, to.x, to.y) <= e.radius + hitRadius) {
      hits.push(e);
    }
  }
  return hits;
}

/** 冲刺路径伤害 + 标记（返回 { hit, killed }；damage 已乘 0.5× 总倍率） */
export function damageAndMarkDash(
  enemies: readonly DashEnemyLike[],
  from: { x: number; y: number },
  to: { x: number; y: number },
  hitRadius: number,
  damage: number,
  markDuration: number,
  markMult: number,
  now: number,
): { hit: number; killed: number } {
  const targets = dashSegmentHits(enemies, from, to, hitRadius);
  let killed = 0;
  for (const e of targets) {
    // P0-3：伤害走唯一入口（易伤乘区已在 hitEnemy 内结算），标记改挂状态层易伤
    if (hitEnemy(e, damage, now)) killed += 1;
    if (e.cc) {
      e.cc = applyStatus(
        e.cc,
        { kind: 'vulnerable', value: Math.max(0, markMult - 1), durationSeconds: markDuration, source: 'mark' },
        now,
        e.ccProfile,
      ).state;
    }
  }
  return { hit: targets.length, killed };
}

/**
 * 冲刺位移步进：dashRemaining 距离剩余 → 本帧推进 dt 的距离（dashDuration 内跑完 dashDistance）。
 * 返回 { remaining, step }；step = 本帧位移量（≤ remaining）。
 */
export function dashStep(
  remaining: number,
  dt: number,
  dashDistance: number,
  dashDuration: number,
): { remaining: number; step: number } {
  const speed = dashDuration > 0 ? dashDistance / dashDuration : 0;
  const step = Math.min(remaining, speed * dt);
  return { remaining: remaining - step, step };
}

/** 冲刺方向 = 输入方向（无输入时保留默认右向；调用方记录释放前输入向量 gdd §⑥.2） */
export function dashDirection(move: { x: number; y: number }): { x: number; y: number } {
  const len = Math.hypot(move.x, move.y);
  if (len <= 0.0001) return { x: 1, y: 0 };
  return { x: move.x / len, y: move.y / len };
}

// ============================================================================
// 减速（安魂曲：300px 内敌人减速 40%，4s）
// ============================================================================

/** 可被减速的目标（Enemy 结构性满足：slowUntil/slowPct） */
export interface SlowableLike {
  readonly active: boolean;
  x: number;
  y: number;
  /** 减速截止（秒时间戳） */
  slowUntil: number;
  /** 减速比例 0~1（40% = 0.4） */
  slowPct: number;
}

/** 半径内减速（重复刷新截止为较晚者；返回减速数） */
export function applySlowInRadius(
  enemies: readonly SlowableLike[],
  center: { x: number; y: number },
  radius: number,
  durationSeconds: number,
  pct: number,
  now: number,
): number {
  let slowed = 0;
  const radiusSq = radius * radius;
  for (const e of enemies) {
    if (!e.active) continue;
    const dx = e.x - center.x;
    const dy = e.y - center.y;
    if (dx * dx + dy * dy > radiusSq) continue;
    e.slowUntil = Math.max(e.slowUntil, now + durationSeconds);
    e.slowPct = pct;
    slowed += 1;
  }
  return slowed;
}

/** 目标当前移速（减速期内 ×(1-slowPct)；否则原速；slowUntil 未设置 = 无减速） */
export function slowedSpeed(
  baseSpeed: number,
  target: Pick<SlowableLike, 'slowUntil' | 'slowPct'>,
  now: number,
): number {
  return now < (target.slowUntil ?? 0) ? baseSpeed * (1 - (target.slowPct ?? 0)) : baseSpeed;
}

// ============================================================================
// 回复（安魂曲：自身回复 20% 最大生命；修女强化 +10% → 30%）
// ============================================================================

/** 回复 = maxHp × pct（clamp 到 maxHp）；返回实际回复量 */
export function healFractionOfMax(stats: { hp: number; maxHp: number }, pct: number): number {
  const before = stats.hp;
  stats.hp = Math.min(stats.maxHp, stats.hp + stats.maxHp * pct);
  return stats.hp - before;
}

// ============================================================================
// 血月狂化（BURST：8s 移速 +30% / 倍率 +0.40 / 接触光环 25 伤/s 平摊 / 击杀回 1 HP）
// ============================================================================

/** 狂化移速加成（gdd §3.2：+30%） */
export function rageMoveSpeedPct(): number {
  return 0.3;
}

/** 狂化倍率加法叠加（gdd §3.2 口径 1 / ACTIVE_SKILL_RULES.RAGE_MULTIPLIER_ADD = +0.40） */
export function rageMultiplierAdd(): number {
  return ACTIVE_SKILL_RULES.RAGE_MULTIPLIER_ADD;
}

/** 接触光环平摊 DPS（gdd §3.2 口径 3 / ACTIVE_SKILL_RULES.CONTACT_AURA_FLAT_DPS = 25） */
export function contactAuraFlatDps(): number {
  return ACTIVE_SKILL_RULES.CONTACT_AURA_FLAT_DPS;
}

/** 可被接触光环伤害的目标（Enemy 结构性满足） */
export interface ContactAuraEnemyLike {
  readonly active: boolean;
  x: number;
  y: number;
  radius: number;
  hp: number;
  kill(): void;
  cc?: StatusState;
}

/**
 * 接触光环 tick（gdd §3.2 口径 3 / R3）：
 * **接触半径内任一敌人在场即全额 tick，不按敌人数量叠加** —— 总伤害 = flatDps × damageMult × dt，
 * 在接触敌间平摊（total 不随敌数膨胀；单 Boss 全额吃满）。
 * damageMult = 0.5 × 总倍率（伤害型主动技只吃 0.5× 总倍率，gdd §3.1）。
 * 返回 { hit, killed, damageDealt }。
 */
export function contactAuraTick(
  enemies: readonly ContactAuraEnemyLike[],
  player: { x: number; y: number },
  contactRadius: number,
  dt: number,
  flatDps: number,
  damageMult: number,
  now?: number,
): { hit: number; killed: number; damageDealt: number } {
  const targets: ContactAuraEnemyLike[] = [];
  const rr = contactRadius * contactRadius;
  for (const e of enemies) {
    if (!e.active) continue;
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    if (dx * dx + dy * dy <= rr) targets.push(e);
  }
  if (targets.length === 0) return { hit: 0, killed: 0, damageDealt: 0 };
  const total = flatDps * damageMult * dt;
  const perTarget = total / targets.length;
  let killed = 0;
  for (const e of targets) {
    // P0-3：走 hitEnemy 唯一入口（易伤乘区内结算）
    if (hitEnemy(e, perTarget, now)) killed += 1;
  }
  return { hit: targets.length, killed, damageDealt: total };
}

/** 狂化 buff 状态（8s 窗口；玩家死亡/重开清空 gdd §⑥.8） */
export class RageBuff {
  activeUntil = 0;

  /** 开始狂化（now + duration） */
  apply(now: number, duration: number): void {
    this.activeUntil = now + duration;
  }

  /** 狂化中（now < activeUntil） */
  active(now: number): boolean {
    return now < this.activeUntil;
  }

  /** 剩余秒（clamp ≥0） */
  remaining(now: number): number {
    return Math.max(0, this.activeUntil - now);
  }

  /** 清除（玩家死亡 gdd §⑥.8） */
  clear(): void {
    this.activeUntil = 0;
  }
}
