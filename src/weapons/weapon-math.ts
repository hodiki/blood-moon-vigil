/**
 * weapons/weapon-math.ts —— 武器纯数学层（ARCH §2 / S3 / E2-S3）
 *
 * 纯函数（可脱离 Phaser 单测）：冷却计时 / 追踪向量 / 最近敌人 / 环绕球位置 /
 * 范围伤害 / 初始 DPS 估算。Phaser 装配在 homing-missile.ts / orbit-orb.ts /
 * shockwave.ts / weapon-system.ts。
 *
 * 冷却语义：秒制累加（ARCH §3.5），`tickCooldown` 返回剩余秒（clamp ≥0）；
 * 武器层持有剩余值，达到 0 即触发。
 */

import { WEAPONS } from '@/config/balance';
import type { Vec2 } from '@/utils/math';

/** 冷却剩余递减（秒制，clamp ≥0）；返回新剩余值 */
export function tickCooldown(remaining: number, dtSeconds: number): number {
  return Math.max(0, remaining - dtSeconds);
}

/** 冷却就绪 = 剩余 ≤0（阈值 0 也视为就绪，如环绕球无冷却） */
export function isCooldownReady(remaining: number): boolean {
  return remaining <= 0;
}

/** 从 origin 指向 target 的速度向量（长度 = speed，单位 px/s） */
export function steerToward(origin: Vec2, target: Vec2, speed: number): Vec2 {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const len = Math.hypot(dx, dy);
  if (len <= 0.0001) return { x: 0, y: 0 };
  return { x: (dx / len) * speed, y: (dy / len) * speed };
}

/** 距离（2D） */
export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** 可被武器选中的目标（active + 坐标） */
export interface TargetLike {
  active: boolean;
  x: number;
  y: number;
}

/** 最近敌人（只考虑 active；无则 null —— W8 §⑥.1 无目标不发射） */
export function nearestEnemy<T extends TargetLike>(origin: Vec2, enemies: readonly T[]): T | null {
  let best: T | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const e of enemies) {
    if (!e.active) continue;
    const d = distance(origin, e);
    if (d < bestDist) {
      bestDist = d;
      best = e;
    }
  }
  return best;
}

/**
 * 飞弹制导目标选择（TASK-37 B2）：从候选敌人中选最近的一个，**跳过已命中目标**。
 * 命中记录由调用方提供（missile.piercedTargets），用于穿透飞弹穿透后重新选目标、
 * 以及「无新目标可命中」时触发消散（W8 §⑥.2 重寻/消散语义）。
 *
 * 若全部候选均已命中或未激活，返回 null。
 */
export function selectHomingTarget<T extends TargetLike>(
  origin: Vec2,
  enemies: readonly T[],
  hasHit: (target: T) => boolean,
): T | null {
  let best: T | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const e of enemies) {
    if (!e.active) continue;
    if (hasHit(e)) continue; // TASK-37 B2：跳过已命中，防飞弹绕着已穿过的目标抖动至寿命结束
    const d = distance(origin, e);
    if (d < bestDist) {
      bestDist = d;
      best = e;
    }
  }
  return best;
}

/** 度/秒 → 弧度/秒（环绕球转速换算，240°/s = 1.5s/圈） */
export function degPerSecToRadPerSec(degPerSec: number): number {
  return (degPerSec * Math.PI) / 180;
}

/** 环绕球角度推进：angle(rad) + 转速 × dt，返回新角度（不归零，sin/cos 自然周期） */
export function advanceOrbitAngle(angleRad: number, degPerSec: number, dtSeconds: number): number {
  return angleRad + degPerSecToRadPerSec(degPerSec) * dtSeconds;
}

/** 环绕球位置：中心 + 半径 × (cos, sin)（angle 为当前全局角） */
export function orbitPosition(center: Vec2, angleRad: number, radius: number): Vec2 {
  return { x: center.x + Math.cos(angleRad) * radius, y: center.y + Math.sin(angleRad) * radius };
}

/** 圆-圆命中判定（子弹/环绕球 vs 敌人） */
export function circlesOverlap(
  ax: number,
  ay: number,
  aRadius: number,
  bx: number,
  by: number,
  bRadius: number,
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const rr = aRadius + bRadius;
  return dx * dx + dy * dy <= rr * rr;
}

export interface DamageTargetLike extends TargetLike {
  hp: number;
  kill(): void;
}

/**
 * 范围伤害（冲击波「月蚀脉冲」）：对半径内全部敌人造成 damage（全方向穿透，W8 §③）。
 * 返回 { hit, killed }。damage 为已乘总倍率的最终值。
 */
export function damageAllInRadius(
  enemies: readonly DamageTargetLike[],
  center: Vec2,
  radius: number,
  damage: number,
): { hit: number; killed: number } {
  let hit = 0;
  let killed = 0;
  for (const e of enemies) {
    if (!e.active) continue;
    if (distance(center, e) > radius) continue;
    hit += 1;
    e.hp = Math.max(0, e.hp - damage);
    if (e.hp <= 0) {
      killed += 1;
      e.kill();
    }
  }
  return { hit, killed };
}

/**
 * 冲击波击退（upgrade-pool 第 7 项）：半径内 active 敌人沿背离中心方向位移 pushDistance。
 * 原地修改目标 x/y（Phaser Sprite 的 x/y 访问器即位移渲染；Arcade body 下一帧自动同步）。
 * 返回被击退数量。不处理死亡（damageAllInRadius 已先行击杀）。
 */
export function knockbackEnemies(
  enemies: readonly DamageTargetLike[],
  center: Vec2,
  radius: number,
  pushDistance: number,
): number {
  let pushed = 0;
  for (const e of enemies) {
    if (!e.active) continue;
    const dx = e.x - center.x;
    const dy = e.y - center.y;
    const len = Math.hypot(dx, dy);
    if (len > radius || len <= 0.0001) continue;
    e.x = center.x + (dx / len) * (len + pushDistance);
    e.y = center.y + (dy / len) * (len + pushDistance);
    pushed += 1;
  }
  return pushed;
}

/**
 * 武器初始 DPS 参考（weapons §③：飞弹 12/1.2=10 · 环绕球 ~16（按 60% 命中率）· 冲击波 60/8=7.5）
 * 合计 ≈ 33.5。数值断言基线（INITIAL_DPS_REFERENCE）。
 */
export function initialDpsEstimate(): number {
  const missile = WEAPONS.MISSILE.DAMAGE / WEAPONS.MISSILE.COOLDOWN;
  const shockwave = WEAPONS.SHOCKWAVE.DAMAGE / WEAPONS.SHOCKWAVE.COOLDOWN;
  // 环绕球启发式 16 直接取 GDD（命中率 60% 与旋转几何耦合，不做解析推导）
  return missile + shockwave + 16;
}
