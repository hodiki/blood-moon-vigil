import { describe, it, expect } from 'vitest';
import { computeJoystickVector } from '@/input/joystick-math';
import { JOYSTICK } from '@/config/balance';
import { vecLength } from '@/utils/math';

const CFG = { radius: JOYSTICK.RADIUS, deadZoneFraction: JOYSTICK.DEAD_ZONE_FRACTION };
const ORIGIN = { x: 0, y: 0 };

describe('computeJoystickVector 摇杆位移→向量（CM §1.2 M7–M9 / ADR-002）', () => {
  it('死区 10% 内输出 (0,0)（防误触抖动，M8）', () => {
    const deadZone = JOYSTICK.RADIUS * 0.1;
    expect(computeJoystickVector(ORIGIN, { x: deadZone * 0.9, y: 0 }, CFG)).toEqual({ x: 0, y: 0 });
    expect(computeJoystickVector(ORIGIN, { x: deadZone * 0.5, y: deadZone * 0.5 }, CFG)).toEqual({ x: 0, y: 0 });
  });

  it('死区边界（恰好 10%）仍输出 (0,0)', () => {
    const deadZone = JOYSTICK.RADIUS * 0.1;
    expect(computeJoystickVector(ORIGIN, { x: deadZone, y: 0 }, CFG)).toEqual({ x: 0, y: 0 });
  });

  it('幅度 = 速度百分比：位移 50% 半径 → 幅度 0.5（ADR-002）', () => {
    const v = computeJoystickVector(ORIGIN, { x: JOYSTICK.RADIUS * 0.5, y: 0 }, CFG);
    expect(v.x).toBeCloseTo(0.5, 6);
    expect(v.y).toBe(0);
  });

  it('位移超半径 clamp 到 ≤1（拇指贴边）', () => {
    const far = { x: JOYSTICK.RADIUS * 2, y: 0 };
    const v = computeJoystickVector(ORIGIN, far, CFG);
    expect(vecLength(v)).toBeCloseTo(1, 6);
    expect(v.x).toBe(1);
  });

  it('任意位移输出长度 ≤1（硬约束）', () => {
    for (let r = 0; r <= 3; r += 0.37) {
      const v = computeJoystickVector(ORIGIN, { x: JOYSTICK.RADIUS * r, y: JOYSTICK.RADIUS * r * 0.5 }, CFG);
      expect(vecLength(v)).toBeLessThanOrEqual(1);
    }
  });

  it('方向保持：位移方向与输出向量一致', () => {
    const v = computeJoystickVector(ORIGIN, { x: 30, y: 40 }, CFG); // 3-4-5 三角形
    expect(v.x / v.y).toBeCloseTo(30 / 40, 6);
  });
});
