import { describe, it, expect } from 'vitest';
import { WEAPONS } from '@/config/balance';
import {
  tickCooldown,
  isCooldownReady,
  steerToward,
  nearestEnemy,
  circlesOverlap,
  type TargetLike,
} from '@/weapons/weapon-math';

describe('自动飞弹「血月猎手」数值与追踪数学（E2-S3 / weapons §③ / W8）', () => {
  it('面板：12 伤 / 1.2s 冷却 / 400px/s / 3s 寿命 / 同屏 ≤8', () => {
    expect(WEAPONS.MISSILE.DAMAGE).toBe(12);
    expect(WEAPONS.MISSILE.COOLDOWN).toBe(1.2);
    expect(WEAPONS.MISSILE.SPEED).toBe(400);
    expect(WEAPONS.MISSILE.LIFETIME).toBe(3);
    expect(WEAPONS.MISSILE.MAX_ACTIVE).toBe(8);
  });

  it('冷却秒制递减且 clamp ≥0（帧率无关，ARCH §3.5）', () => {
    expect(tickCooldown(1.2, 0.5)).toBeCloseTo(0.7, 6);
    expect(tickCooldown(0.3, 0.5)).toBe(0); // 不为负
    expect(isCooldownReady(0)).toBe(true);
    expect(isCooldownReady(0.1)).toBe(false);
  });

  it('追踪向量：指向目标、长度 = 400px/s（400px/s 追踪，W8）', () => {
    const v = steerToward({ x: 0, y: 0 }, { x: 300, y: 400 }, WEAPONS.MISSILE.SPEED);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(400, 6);
    expect(v.x).toBeCloseTo(240, 6);
    expect(v.y).toBeCloseTo(320, 6);
  });

  it('飞行寿命 3s × 400px/s = 行程 1200px > 出生环带 900px（RV-N9 可达性）', () => {
    expect(WEAPONS.MISSILE.LIFETIME * WEAPONS.MISSILE.SPEED).toBe(1200);
  });

  it('nearestEnemy 选最近 active 敌人；无目标返回 null（W8 §⑥.1/2 重寻）', () => {
    const enemies: TargetLike[] = [
      { active: true, x: 100, y: 0 },
      { active: false, x: 10, y: 0 }, // inactive 跳过
      { active: true, x: 50, y: 0 },
    ];
    const nearest = nearestEnemy({ x: 0, y: 0 }, enemies);
    expect(nearest).toBe(enemies[2]);
    expect(nearestEnemy({ x: 0, y: 0 }, [])).toBeNull();
    expect(nearestEnemy({ x: 0, y: 0 }, [{ active: false, x: 1, y: 1 }])).toBeNull();
  });

  it('圆-圆命中判定（飞弹 vs 敌人）', () => {
    expect(circlesOverlap(0, 0, 6, 10, 0, 14)).toBe(true); // 6+14=20 ≥ 10
    expect(circlesOverlap(0, 0, 6, 30, 0, 14)).toBe(false);
  });
});
