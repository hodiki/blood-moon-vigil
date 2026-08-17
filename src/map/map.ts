/**
 * map/map.ts —— 3000×3000 地图（ARCH §3.2 池表注释 / E1-S6 / S9）
 *
 * - 程序生成基础地砖：tile 64×64（art-bible §5），石板铺满 + 中心草地区（双材质，2 draw call）
 * - 边界 clamp [0,3000]² 由 player.update 负责（clampToWorld）
 * - 少量障碍物 AABB 阻挡（epics E1-S6 #3）：确定性布局（seed PRNG，可单测），
 *   StaticGroup + 玩家 collider
 * - 边界描线：灰蓝/危险红细线标识世界范围（垂直切片可见性）
 * - TASK-22 资产审计：新增 tile-grass（art-bible §5 石板/草地双材质），中心区草地块
 */

import type Phaser from 'phaser';
import { WORLD, TILE, PALETTE } from '@/config/balance';
import { mulberry32, hexToRgbInt } from '@/utils/math';

export interface ObstacleRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const OBSTACLE_LAYOUT_SEED = 20240816;

/** 中心草地区边长（art-bible §5 石板/草地双材质：出生安全区即草地，外围石板） */
export const GRASS_ZONE_SIZE = 1200;

/** 玩家出生安全区半径（中心无障碍，防出生即卡） */
export const SPAWN_SAFE_RADIUS = 120;

/**
 * 确定性障碍布局（纯函数，可单测）：
 * - 全部矩形位于世界内（含 2 tile 边距）
 * - 不覆盖出生安全区（中心 SPAWN_SAFE_RADIUS）
 * - 尺寸 2–5 tile、数量固定（E1 少量障碍，S9 验收「少量障碍物 AABB」）
 */
export function buildObstacleLayout(
  worldW: number = WORLD.WIDTH,
  worldH: number = WORLD.HEIGHT,
  seed: number = OBSTACLE_LAYOUT_SEED,
  count = 8,
): ObstacleRect[] {
  const rng = mulberry32(seed);
  const rects: ObstacleRect[] = [];
  const margin = TILE.SIZE * 2;
  const cx = worldW / 2;
  const cy = worldH / 2;
  let guard = 0;
  while (rects.length < count && guard < 200) {
    guard += 1;
    const w = (2 + Math.floor(rng() * 4)) * TILE.SIZE; // 2–5 tile
    const h = (2 + Math.floor(rng() * 4)) * TILE.SIZE;
    const x = margin + rng() * (worldW - w - margin * 2);
    const y = margin + rng() * (worldH - h - margin * 2);
    const rect = { x, y, w, h };
    if (overlapsSpawnSafe(rect, cx, cy)) continue;
    rects.push(rect);
  }
  return rects;
}

function overlapsSpawnSafe(rect: ObstacleRect, cx: number, cy: number): boolean {
  // AABB 与圆最近点距离 ≤ 半径 → 重叠
  const nearestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = nearestX - cx;
  const dy = nearestY - cy;
  return dx * dx + dy * dy <= SPAWN_SAFE_RADIUS * SPAWN_SAFE_RADIUS;
}

export class MapSystem {
  readonly ground: Phaser.GameObjects.TileSprite;
  /** 中心草地区（TASK-22：石板/草地双材质，depth -99 铺在石板之上） */
  readonly grass: Phaser.GameObjects.TileSprite;
  readonly blockers: Phaser.Physics.Arcade.StaticGroup;
  readonly bounds: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, layout: ObstacleRect[] = buildObstacleLayout()) {
    this.ground = scene.add
      .tileSprite(WORLD.WIDTH / 2, WORLD.HEIGHT / 2, WORLD.WIDTH, WORLD.HEIGHT, 'tile-ground')
      .setDepth(-100);
    this.grass = scene.add
      .tileSprite(WORLD.WIDTH / 2, WORLD.HEIGHT / 2, GRASS_ZONE_SIZE, GRASS_ZONE_SIZE, 'tile-grass')
      .setDepth(-99);

    // 障碍 StaticGroup（AABB，S9）
    this.blockers = scene.physics.add.staticGroup();
    for (const rect of layout) {
      const sprite = this.blockers.create(rect.x + rect.w / 2, rect.y + rect.h / 2, 'blocker') as Phaser.Physics.Arcade.Sprite;
      sprite.setDisplaySize(rect.w, rect.h);
      const body = sprite.body as Phaser.Physics.Arcade.StaticBody;
      body.setSize(rect.w, rect.h);
      body.updateFromGameObject();
    }

    // 世界边界描线（垂直切片可见性；正式版由 edgeWarning 红光替代，E2+）
    this.bounds = scene.add.graphics().setDepth(50);
    this.bounds.lineStyle(3, hexToRgbInt(PALETTE.danger), 0.4);
    this.bounds.strokeRect(1.5, 1.5, WORLD.WIDTH - 3, WORLD.HEIGHT - 3);
  }
}
