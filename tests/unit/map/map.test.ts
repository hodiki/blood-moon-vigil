import { describe, it, expect } from 'vitest';
import { buildObstacleLayout, SPAWN_SAFE_RADIUS, OBSTACLE_LAYOUT_SEED } from '@/map/map';
import { WORLD, TILE } from '@/config/balance';

describe('buildObstacleLayout 确定性障碍布局（S9 / epics E1-S6 #3）', () => {
  it('生成固定数量（少量障碍）', () => {
    expect(buildObstacleLayout()).toHaveLength(8);
  });

  it('全部矩形位于世界内（含 2 tile 边距）', () => {
    for (const r of buildObstacleLayout()) {
      expect(r.x).toBeGreaterThanOrEqual(TILE.SIZE * 2);
      expect(r.y).toBeGreaterThanOrEqual(TILE.SIZE * 2);
      expect(r.x + r.w).toBeLessThanOrEqual(WORLD.WIDTH - TILE.SIZE * 2);
      expect(r.y + r.h).toBeLessThanOrEqual(WORLD.HEIGHT - TILE.SIZE * 2);
    }
  });

  it('不覆盖出生安全区（中心 SPAWN_SAFE_RADIUS 内无障碍，防出生即卡）', () => {
    const cx = WORLD.WIDTH / 2;
    const cy = WORLD.HEIGHT / 2;
    for (const r of buildObstacleLayout()) {
      const nearestX = Math.max(r.x, Math.min(cx, r.x + r.w));
      const nearestY = Math.max(r.y, Math.min(cy, r.y + r.h));
      const dist = Math.hypot(nearestX - cx, nearestY - cy);
      expect(dist).toBeGreaterThan(SPAWN_SAFE_RADIUS);
    }
  });

  it('同种子确定性：可复现（程序化地图可测试）', () => {
    expect(buildObstacleLayout(WORLD.WIDTH, WORLD.HEIGHT, OBSTACLE_LAYOUT_SEED)).toEqual(
      buildObstacleLayout(WORLD.WIDTH, WORLD.HEIGHT, OBSTACLE_LAYOUT_SEED),
    );
  });

  it('矩形尺寸为 2–5 tile（AABB 规模受控）', () => {
    for (const r of buildObstacleLayout()) {
      expect(r.w / TILE.SIZE).toBeGreaterThanOrEqual(2);
      expect(r.w / TILE.SIZE).toBeLessThanOrEqual(5);
      expect(r.h / TILE.SIZE).toBeGreaterThanOrEqual(2);
      expect(r.h / TILE.SIZE).toBeLessThanOrEqual(5);
    }
  });
});
