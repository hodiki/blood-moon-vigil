/**
 * map/map-generator.ts —— 地图障碍/血池生成器·纯函数层（E3-S6/S8）
 *
 * 数据驱动（gdd-maps §3.1~3.4）：3 图差异全部来自 MAP_CONFIGS（尺寸/tile/障碍密度/Boss）；
 * 障碍为圆形碰撞体（§3.0 obst-* 帧），确定性种子散布（mulberry32，可单测）。
 *
 * 生成约束（gdd-maps §⑥）：
 * - 禁贴出生点：障碍边缘距中心 ≥200px（§⑥.1 防出生即卡死）
 * - 禁重叠：相邻障碍边缘间距 ≥64px（§⑥.2/§⑥.5 防叠碰撞体穿模 + 最小过道）
 * - 血池优先于障碍：危险区覆盖障碍位，不生成重叠碰撞（§⑥.3）
 * - 血池上不生成敌人出生点（§⑥.8；isOnBloodPool 供生成器消费）
 */

import { TILE, MAP_CONFIGS, type MapId, type BossId } from '@/config/balance';
import { mulberry32 } from '@/utils/math';

/** 障碍圆形碰撞体 */
export interface ObstacleCircle {
  x: number;
  y: number;
  radius: number;
  /** 障碍帧（config.obstacles 内，content-id-frame-map §4） */
  frame: string;
}

/** 环境危险（血池，仅教堂） */
export interface BloodPool {
  x: number;
  y: number;
  radius: number;
}

/** 障碍边缘最小间距 / 最小过道（§⑥.2/§⑥.5） */
export const OBSTACLE_MIN_PASSAGE = 64;
/** 障碍/血池禁贴出生点距离（§⑥.1） */
export const OBSTACLE_SPAWN_SAFE = 200;
/** 障碍半径范围（工程常量：圆形碰撞体 20~40px） */
export const OBSTACLE_RADIUS_MIN = 20;
export const OBSTACLE_RADIUS_MAX = 40;
/** 血池数量 8~10、半径 120~180（gdd-maps §3.2） */
export const BLOODPOOL_COUNT_MIN = 8;
export const BLOODPOOL_COUNT_MAX = 10;
export const BLOODPOOL_RADIUS_MIN = 120;
export const BLOODPOOL_RADIUS_MAX = 180;

/** 障碍数 = 密度（座/1000²）× 面积（百万 px²）四舍五入 */
export function obstacleCountFor(mapId: MapId): number {
  const m = MAP_CONFIGS[mapId];
  return Math.round((m.width * m.height) / 1_000_000 * m.obstacleDensityPer1000);
}

/** E3-S6 渲染规格（3 图 tile/障碍/装饰/Boss/危险数据化；MapSystem 消费） */
export function mapRenderSpec(mapId: MapId): {
  tiles: readonly string[];
  obstacles: readonly string[];
  decor: readonly string[];
  danger: string | null;
  boss: BossId;
} {
  const m = MAP_CONFIGS[mapId];
  return {
    tiles: m.tiles,
    obstacles: m.obstacles,
    decor: m.decor,
    danger: m.danger ?? null,
    boss: m.boss,
  };
}

/** 血池生成（仅教堂有环境危险；确定性种子） */
export function buildBloodPools(mapId: MapId, seed: number): BloodPool[] {
  const m = MAP_CONFIGS[mapId];
  if (!m.danger) return [];
  const rng = mulberry32(seed);
  const cx = m.width / 2;
  const cy = m.height / 2;
  const margin = TILE.SIZE * 2;
  const count = BLOODPOOL_COUNT_MIN + Math.floor(rng() * (BLOODPOOL_COUNT_MAX - BLOODPOOL_COUNT_MIN + 1));
  const pools: BloodPool[] = [];
  let guard = 0;
  while (pools.length < count && guard < 4000) {
    guard += 1;
    const radius = BLOODPOOL_RADIUS_MIN + rng() * (BLOODPOOL_RADIUS_MAX - BLOODPOOL_RADIUS_MIN);
    const x = margin + radius + rng() * (m.width - 2 * (margin + radius));
    const y = margin + radius + rng() * (m.height - 2 * (margin + radius));
    // 不覆盖出生点（池边缘距中心 ≥200px）
    if (Math.hypot(x - cx, y - cy) < radius + OBSTACLE_SPAWN_SAFE) continue;
    // 池间不重叠（中心距 ≥ r1 + r2）
    if (pools.some((p) => Math.hypot(p.x - x, p.y - y) < p.radius + radius)) continue;
    pools.push({ x, y, radius });
  }
  return pools;
}

/** 障碍生成（圆形碰撞体；确定性种子；血池优先，池半径内不生成） */
export function buildObstacleCircles(mapId: MapId, seed: number): ObstacleCircle[] {
  const m = MAP_CONFIGS[mapId];
  const count = obstacleCountFor(mapId);
  const rng = mulberry32(seed);
  // 与 buildBloodPools(mapId, seed) 同种子同序 → 血池优先（§⑥.3）一致性：
  // 障碍避开「本图同种子」生成的血池，调用方用同一 seed 即可获得不重叠布局。
  const pools = buildBloodPools(mapId, seed);
  const cx = m.width / 2;
  const cy = m.height / 2;
  const margin = TILE.SIZE * 2;
  const circles: ObstacleCircle[] = [];
  let guard = 0;
  while (circles.length < count && guard < 8000) {
    guard += 1;
    const radius = OBSTACLE_RADIUS_MIN + rng() * (OBSTACLE_RADIUS_MAX - OBSTACLE_RADIUS_MIN);
    const x = margin + radius + rng() * (m.width - 2 * (margin + radius));
    const y = margin + radius + rng() * (m.height - 2 * (margin + radius));
    // 禁贴出生点：障碍边缘距中心 ≥200px
    if (Math.hypot(x - cx, y - cy) < radius + OBSTACLE_SPAWN_SAFE) continue;
    // 禁重叠/最小过道：与既有障碍边缘间距 ≥64px
    if (circles.some((o) => Math.hypot(o.x - x, o.y - y) < o.radius + radius + OBSTACLE_MIN_PASSAGE)) continue;
    // 血池优先：不在血池半径内生成障碍
    if (pools.some((p) => Math.hypot(p.x - x, p.y - y) < p.radius + radius)) continue;
    const frame = m.obstacles[Math.floor(rng() * m.obstacles.length)] ?? m.obstacles[0]!;
    circles.push({ x, y, radius, frame });
  }
  return circles;
}

/** 点是否在血池内（§⑥.8 血池上不生成敌人出生点） */
export function isOnBloodPool(x: number, y: number, pools: readonly BloodPool[]): boolean {
  return pools.some((p) => Math.hypot(p.x - x, p.y - y) <= p.radius);
}
