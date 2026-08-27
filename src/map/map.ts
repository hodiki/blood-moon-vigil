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
import { WORLD, TILE, PALETTE, MAP_CONFIGS, type MapId } from '@/config/balance';
import { mulberry32, hexToRgbInt } from '@/utils/math';
import { buildObstacleCircles, buildBloodPools } from '@/map/map-generator';

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

/** TASK-28 地面贴花：确定性散布 seed 与数量（桌面 28 / 移动 14；静态精灵，随 effects 组批次） */
export const DECAL_SEED = 20260828;
export const DECAL_COUNT_DESKTOP = 28;
export const DECAL_COUNT_MOBILE = 14;
/** 装饰散布（纯视觉，无碰撞；与贴花错开种子） */
export const DECOR_SEED = 20260829;
export const DECOR_COUNT_DESKTOP = 18;
export const DECOR_COUNT_MOBILE = 10;

export interface DecorSprite {
  x: number;
  y: number;
  frame: string;
  angle: number;
}

/** 确定性装饰点：避开出生安全区；帧从 MAP_CONFIGS.decor 轮询 */
export function buildDecorLayout(
  worldW: number,
  worldH: number,
  seed: number,
  count: number,
  frames: readonly string[],
): DecorSprite[] {
  if (frames.length === 0 || count <= 0) return [];
  const rng = mulberry32(seed);
  const out: DecorSprite[] = [];
  const margin = TILE.SIZE * 2;
  const cx = worldW / 2;
  const cy = worldH / 2;
  let guard = 0;
  while (out.length < count && guard < 400) {
    guard += 1;
    const x = margin + rng() * (worldW - margin * 2);
    const y = margin + rng() * (worldH - margin * 2);
    if (overlapsSpawnSafe({ x, y, w: 1, h: 1 }, cx, cy)) continue;
    const frame = frames[Math.floor(rng() * frames.length)] ?? frames[0]!;
    out.push({ x, y, frame, angle: rng() * 360 });
  }
  return out;
}

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
  /** 中心覆盖区（TASK-22：石板/草地双材质；教堂=暗红地毯装饰语义 α0.35） */
  readonly grass: Phaser.GameObjects.TileSprite;
  /** TASK-28 地面贴花：碎石/草叶/血迹（静态精灵，depth -98，随 effects 组批次；graveyard 基准） */
  readonly decals: Phaser.GameObjects.Image[];
  /** 批次 3：地图装饰（枯树/烛/骨/彩玻光斑等，无碰撞） */
  readonly decor: Phaser.GameObjects.Image[];
  readonly blockers: Phaser.Physics.Arcade.StaticGroup;
  readonly bounds: Phaser.GameObjects.Graphics;

  /**
   * E3-S6 数据驱动：mapId 默认 graveyard（基准行为与既有完全一致，L2 冒烟回归安全）；
   * 教堂/狼穴按 MAP_CONFIGS 渲染 tile/圆形障碍/血池（M2-S4 地图解锁流接入选择）。
   * graveyard 保留 AABB 布局（layout 参数）；其余图用圆形碰撞体（buildObstacleCircles 确定性种子）。
   */
  constructor(
    scene: Phaser.Scene,
    layout: ObstacleRect[] = buildObstacleLayout(),
    decalCount: number = DECAL_COUNT_DESKTOP,
    mapId: MapId = 'map_graveyard',
  ) {
    const mapCfg = MAP_CONFIGS[mapId];
    const w = mapCfg.width;
    const h = mapCfg.height;
    // 墓地：有独立土砖时用 tile-grave-soil 作地面（石板仍作共享兜底）
    const groundKey =
      mapId === 'map_graveyard' && scene.textures.exists('tile-grave-soil')
        ? 'tile-grave-soil'
        : (mapCfg.tiles[0] ?? 'tile-ground');
    this.ground = scene.add
      .tileSprite(w / 2, h / 2, w, h, groundKey)
      .setDepth(-100);
    this.grass = scene.add
      .tileSprite(w / 2, h / 2, GRASS_ZONE_SIZE, GRASS_ZONE_SIZE, mapCfg.tiles[1] ?? 'tile-grass')
      .setDepth(-99);
    // 暗红地毯 = 装饰语义（低饱和 α0.35 无闪烁），与血池危险编码（红斜纹+闪烁+白描边）区分（gdd-maps §3.2）
    if (mapId === 'map_cathedral') this.grass.setAlpha(0.35);

    // TASK-28 地面贴花：确定性散布，避开出生安全区；贴花不参与碰撞（纯视觉，graveyard 基准）
    const decalFrames = ['decal-rock', 'decal-grass', 'decal-blood'] as const;
    const decalRng = mulberry32(DECAL_SEED);
    this.decals = [];
    for (let i = 0; i < decalCount; i += 1) {
      const x = 2 * TILE.SIZE + decalRng() * (w - 4 * TILE.SIZE);
      const y = 2 * TILE.SIZE + decalRng() * (h - 4 * TILE.SIZE);
      if (overlapsSpawnSafe({ x, y, w: 1, h: 1 }, w / 2, h / 2)) continue;
      const frame = decalFrames[Math.floor(decalRng() * decalFrames.length)] ?? 'decal-rock';
      const img = scene.add.image(x, y, 'effects', frame).setDepth(-98);
      img.setAlpha(frame === 'decal-blood' ? 0.35 + decalRng() * 0.2 : 0.6 + decalRng() * 0.35);
      img.setAngle(decalRng() * 360);
      this.decals.push(img);
    }

    const baseDecor = decalCount >= DECAL_COUNT_DESKTOP ? DECOR_COUNT_DESKTOP : DECOR_COUNT_MOBILE;
    const decorCount = mapId === 'map_cathedral' ? Math.max(6, Math.round(baseDecor * 0.4)) : baseDecor;
    this.decor = [];
    const effectsTex = scene.textures.exists('effects') ? scene.textures.get('effects') : null;
    for (const d of buildDecorLayout(w, h, DECOR_SEED, decorCount, mapCfg.decor)) {
      if (!effectsTex?.has(d.frame)) continue;
      const img = scene.add.image(d.x, d.y, 'effects', d.frame).setDepth(d.frame === 'decor-church-glasslight' ? -96 : -90);
      if (d.frame === 'decor-church-glasslight') {
        img.setAlpha(0.42);
        img.setDisplaySize(96, 96);
        img.setAngle(d.angle);
      } else {
        img.setAngle(d.frame.includes('tree') || d.frame.includes('pillar') ? 0 : d.angle);
      }
      this.decor.push(img);
    }

    // 障碍 StaticGroup：graveyard AABB（既有）；教堂/狼穴 圆形碰撞体（E3-S8 生成器）
    this.blockers = scene.physics.add.staticGroup();
    if (mapId === 'map_graveyard') {
      for (const rect of layout) {
        const sprite = this.blockers.create(rect.x + rect.w / 2, rect.y + rect.h / 2, 'blocker') as Phaser.Physics.Arcade.Sprite;
        sprite.setDisplaySize(rect.w, rect.h);
        const body = sprite.body as Phaser.Physics.Arcade.StaticBody;
        body.setSize(rect.w, rect.h);
        body.updateFromGameObject();
      }
    } else {
      // 圆形障碍（obst-* 帧）；血池优先：血池覆盖处不生成障碍（map-generator 已保证）
      for (const c of buildObstacleCircles(mapId, OBSTACLE_LAYOUT_SEED)) {
        const sprite = this.blockers.create(c.x, c.y, 'effects', c.frame) as Phaser.Physics.Arcade.Sprite;
        sprite.setDisplaySize(c.radius * 2, c.radius * 2);
        const body = sprite.body as Phaser.Physics.Arcade.StaticBody;
        body.setCircle(c.radius, c.radius, c.radius);
        body.updateFromGameObject();
      }
      // 教堂血池贴花（decal-bloodpool，危险编码由渲染层叠加红斜纹/闪烁/白描边）
      for (const p of buildBloodPools(mapId, OBSTACLE_LAYOUT_SEED)) {
        const decal = scene.add.image(p.x, p.y, 'effects', 'decal-bloodpool').setDepth(-97);
        decal.setDisplaySize(p.radius * 2, p.radius * 2);
        this.decals.push(decal);
      }
    }

    // 世界边界描线（垂直切片可见性；正式版由 edgeWarning 红光替代，E2+）
    this.bounds = scene.add.graphics().setDepth(50);
    this.bounds.lineStyle(3, hexToRgbInt(PALETTE.danger), 0.4);
    this.bounds.strokeRect(1.5, 1.5, w - 3, h - 3);
  }
}
