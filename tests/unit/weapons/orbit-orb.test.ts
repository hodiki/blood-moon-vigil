import { describe, it, expect } from 'vitest';
import { WEAPONS } from '@/config/balance';
import {
  orbitPosition,
  advanceOrbitAngle,
  degPerSecToRadPerSec,
  isCooldownReady,
} from '@/weapons/weapon-math';

describe('护体环绕球「守夜之环」数值与几何（E2-S3 / weapons §③ / W8）', () => {
  it('面板：基础 3 颗 / 半径 80px / 240°/s / 8 伤 / 同目标 0.4s CD / 最多 6 颗', () => {
    expect(WEAPONS.ORBIT.BASE_COUNT).toBe(3);
    expect(WEAPONS.ORBIT.RADIUS).toBe(80);
    expect(WEAPONS.ORBIT.ANGULAR_SPEED_DEG).toBe(240);
    expect(WEAPONS.ORBIT.DAMAGE).toBe(8);
    expect(WEAPONS.ORBIT.PER_TARGET_COOLDOWN).toBe(0.4);
    expect(WEAPONS.ORBIT.MAX_COUNT).toBe(6);
  });

  it('转速 240°/s = 1.5s/圈（2π/240°/s）', () => {
    expect(degPerSecToRadPerSec(WEAPONS.ORBIT.ANGULAR_SPEED_DEG)).toBeCloseTo((2 * Math.PI) / 1.5, 6);
  });

  it('环绕球位置：angle=0 → (cx+80, cy)；angle=π/2 → (cx, cy+80)', () => {
    expect(orbitPosition({ x: 100, y: 100 }, 0, WEAPONS.ORBIT.RADIUS)).toEqual({ x: 180, y: 100 });
    const p = orbitPosition({ x: 100, y: 100 }, Math.PI / 2, WEAPONS.ORBIT.RADIUS);
    expect(p.x).toBeCloseTo(100, 6);
    expect(p.y).toBeCloseTo(180, 6);
  });

  it('角度推进：1s 后转过 240°（4π/3 rad），3 颗均匀分布夹角 2π/3', () => {
    const angle = advanceOrbitAngle(0, WEAPONS.ORBIT.ANGULAR_SPEED_DEG, 1);
    expect(angle).toBeCloseTo((4 * Math.PI) / 3, 6);
    const step = (2 * Math.PI) / WEAPONS.ORBIT.BASE_COUNT;
    expect(step).toBeCloseTo((2 * Math.PI) / 3, 6);
  });

  it('同目标 0.4s 内置冷却就绪判定（防单目标被多段秒杀，W8 §⑥.4）', () => {
    // 冷却语义：命中后 0.4s 内不可再打同一目标（Boss 也适用）
    const cooldown = WEAPONS.ORBIT.PER_TARGET_COOLDOWN;
    expect(cooldown).toBe(0.4);
    expect(isCooldownReady(0.4)).toBe(false); // 刚命中，未就绪
    expect(isCooldownReady(0)).toBe(true); // 0.4s 后冷却完毕
  });
});
