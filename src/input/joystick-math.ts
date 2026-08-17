/**
 * input/joystick-math.ts —— 摇杆位移 → 移动向量（纯函数，可脱离 Phaser 单测）
 *
 * 规则（CM §1.2 M7–M9 / ADR-002）：
 * - 死区：中心 10% 半径内输出 (0,0)，防误触抖动（CM M8）
 * - clamp：位移超半径时幅度=1（拇指贴边）
 * - 幅度 = 速度百分比（ADR-002：摇杆幅度即速度百分比）
 */

import { type Vec2 } from '@/utils/math';

export interface JoystickConfig {
  radius: number;
  deadZoneFraction?: number; // 默认 0.1（中心 10%）
}

export function computeJoystickVector(
  origin: Vec2,
  pointer: Vec2,
  config: JoystickConfig,
): Vec2 {
  const deadZoneFraction = config.deadZoneFraction ?? 0.1;
  const dx = pointer.x - origin.x;
  const dy = pointer.y - origin.y;
  const dist = Math.hypot(dx, dy);
  const deadZone = config.radius * deadZoneFraction;
  if (dist <= deadZone || dist === 0) return { x: 0, y: 0 };
  const magnitude = Math.min(1, dist / config.radius);
  return {
    x: (dx / dist) * magnitude,
    y: (dy / dist) * magnitude,
  };
}
