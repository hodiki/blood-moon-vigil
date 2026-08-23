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

// ============================================================================
// 标记（血影突袭：命中目标标记 4s，受武器伤害 +20%，gdd §3.2）
// ============================================================================

/** 可被标记的目标（Enemy 结构性满足：markUntil/markDamageMult 字段） */
export interface MarkableLike {
  readonly active: boolean;
  x: number;
  y: number;
  /** 标记截止（秒时间戳）：> now 期间武器伤害 ×markDamageMult */
  markUntil: number;
  markDamageMult: number;
}

/** 标记只读结构（允许可选字段：weapons 命中目标接口 markUntil 为可选） */
export interface MarkTargetLike {
  markUntil?: number;
  markDamageMult?: number;
}

/** 目标当前是否被标记（markUntil 未设置 = 未标记） */
export function isMarked(target: Pick<MarkTargetLike, 'markUntil'>, now: number): boolean {
  return now < (target.markUntil ?? 0);
}

/** 武器伤害加成：被标记目标 ×markDamageMult（血影突袭 +20% → ×1.20；未标记 ×1） */
export function weaponDamageOnTarget(
  baseDamage: number,
  target: Pick<MarkTargetLike, 'markUntil' | 'markDamageMult'>,
  now: number,
): number {
  return isMarked(target, now) ? baseDamage * (target.markDamageMult ?? 1) : baseDamage;
}

/** 半径内标记 active 敌人（重复标记刷新截止为较晚者；返回新标记数） */
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
    if (!e.active) continue;
    const dx = e.x - center.x;
    const dy = e.y - center.y;
    if (dx * dx + dy * dy > radiusSq) continue;
    e.markUntil = Math.max(e.markUntil, now + durationSeconds);
    e.markDamageMult = mult;
    marked += 1;
  }
  return marked;
}

// ============================================================================
// 冲刺（血影突袭：向移动方向冲刺 240px；路径上 40 伤）
// ============================================================================

/** 冲刺路径可命中目标（Enemy 结构性满足：markUntil/markDamageMult/radius/hp/kill） */
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
    e.hp = Math.max(0, e.hp - damage);
    e.markUntil = Math.max(e.markUntil, now + markDuration);
    e.markDamageMult = markMult;
    if (e.hp <= 0) {
      killed += 1;
      e.kill();
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
    e.hp = Math.max(0, e.hp - perTarget);
    if (e.hp <= 0) {
      killed += 1;
      e.kill();
    }
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
