import { describe, it, expect } from 'vitest';
import { buildObstacleLayout, SPAWN_SAFE_RADIUS, OBSTACLE_LAYOUT_SEED, buildDecorLayout, DECOR_SEED } from '@/map/map';
import { WORLD, TILE, MAP_CONFIGS, type MapId } from '@/config/balance';
import {
  mapRenderSpec,
  obstacleCountFor,
  buildObstacleCircles,
  buildBloodPools,
  isOnBloodPool,
  OBSTACLE_MIN_PASSAGE,
  OBSTACLE_SPAWN_SAFE,
  BLOODPOOL_COUNT_MIN,
  BLOODPOOL_COUNT_MAX,
  BLOODPOOL_RADIUS_MIN,
  BLOODPOOL_RADIUS_MAX,
} from '@/map/map-generator';
import { FRAME_BY_CONTENT_ID } from '@/config/frame-registry';

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

describe('E3-S6 3 图数据驱动渲染规格（gdd-maps §3.1~3.3 / content-id-frame-map §4）', () => {
  it('墓地：石板+草地+墓地土；墓碑/断墙障碍；枯树/鬼火/兽骨装饰；无环境危险；Boss 尊者', () => {
    const spec = mapRenderSpec('map_graveyard');
    expect(spec.tiles).toEqual(['tile-ground', 'tile-grass', 'tile-grave-soil']);
    expect(spec.obstacles).toEqual(['obst-grave-tomb', 'obst-grave-fence']);
    expect(spec.decor).toEqual(['decor-grave-tree', 'decor-grave-candle', 'decor-grave-bone']);
    expect(spec.danger).toBeNull();
    expect(spec.boss).toBe('boss_1');
  });

  it('教堂：石砖+地毯；立柱/长椅/祭坛障碍；彩玻光斑装饰；血池危险（红斜纹编码与地毯区分）；Boss 尼禄', () => {
    const spec = mapRenderSpec('map_cathedral');
    expect(spec.tiles).toEqual(['tile-church-stone', 'tile-church-carpet']);
    expect(spec.obstacles).toEqual(['obst-church-pillar', 'obst-church-bench', 'obst-church-altar']);
    expect(spec.decor).toEqual(['decor-church-glasslight']);
    expect(spec.danger).toContain('血池');
    expect(spec.boss).toBe('boss_2');
  });

  it('狼穴：岩地+暗绿草；巨石/倒木障碍；兽骨/篝火/尖刺装饰；无环境危险；Boss 芬里厄', () => {
    const spec = mapRenderSpec('map_den');
    expect(spec.tiles).toEqual(['tile-den-earth', 'tile-den-grass']);
    expect(spec.obstacles).toEqual(['obst-den-rock', 'obst-den-log']);
    expect(spec.decor).toEqual(['decor-den-bone', 'decor-den-fire', 'decor-den-spike']);
    expect(spec.danger).toBeNull();
    expect(spec.boss).toBe('boss_3');
  });

  it('全部帧名在帧名注册表中闭合（tile/障碍/装饰 ⊆ content-id-frame-map 交付集）', () => {
    for (const mapId of Object.keys(MAP_CONFIGS) as MapId[]) {
      const spec = mapRenderSpec(mapId);
      const registry = FRAME_BY_CONTENT_ID[mapId];
      expect(registry).toBeDefined();
      for (const f of [...spec.tiles, ...spec.obstacles, ...spec.decor]) {
        expect(registry).toContain(f);
      }
    }
  });
});

describe('E3-S8 障碍/血池生成器（gdd-maps §3.0/§⑥；确定性种子散布）', () => {
  it('障碍数 = 密度×面积：墓地 3000²×12 → 108 / 教堂 2800²×22 → 172 / 狼穴 3200²×14 → 143', () => {
    expect(obstacleCountFor('map_graveyard')).toBe(108);
    expect(obstacleCountFor('map_cathedral')).toBe(172);
    expect(obstacleCountFor('map_den')).toBe(143);
  });

  it('同种子同布局（可复现，RV-C5）', () => {
    for (const mapId of ['map_graveyard', 'map_cathedral', 'map_den'] as const) {
      expect(buildObstacleCircles(mapId, 20240816)).toEqual(buildObstacleCircles(mapId, 20240816));
    }
  });

  it('障碍全部在世界内（含 2 tile 边距）+ 圆形碰撞体', () => {
    for (const mapId of ['map_graveyard', 'map_cathedral', 'map_den'] as const) {
      const m = MAP_CONFIGS[mapId];
      for (const o of buildObstacleCircles(mapId, 20240816)) {
        expect(o.x - o.radius).toBeGreaterThanOrEqual(TILE.SIZE * 2);
        expect(o.y - o.radius).toBeGreaterThanOrEqual(TILE.SIZE * 2);
        expect(o.x + o.radius).toBeLessThanOrEqual(m.width - TILE.SIZE * 2);
        expect(o.y + o.radius).toBeLessThanOrEqual(m.height - TILE.SIZE * 2);
        expect(o.radius).toBeGreaterThan(0);
      }
    }
  });

  it('禁贴出生点：障碍边缘距中心 ≥200px（§⑥.1 防出生即卡死）', () => {
    for (const mapId of ['map_graveyard', 'map_cathedral', 'map_den'] as const) {
      const m = MAP_CONFIGS[mapId];
      const cx = m.width / 2;
      const cy = m.height / 2;
      for (const o of buildObstacleCircles(mapId, 20240816)) {
        const edgeDist = Math.hypot(o.x - cx, o.y - cy) - o.radius;
        expect(edgeDist).toBeGreaterThanOrEqual(OBSTACLE_SPAWN_SAFE);
      }
    }
  });

  it('禁重叠/最小过道：相邻障碍边缘间距 ≥64px（§⑥.2/§⑥.5 防卡死）', () => {
    for (const mapId of ['map_graveyard', 'map_cathedral', 'map_den'] as const) {
      const circles = buildObstacleCircles(mapId, 20240816);
      for (let i = 0; i < circles.length; i += 1) {
        for (let j = i + 1; j < circles.length; j += 1) {
          const a = circles[i]!;
          const b = circles[j]!;
          const gap = Math.hypot(a.x - b.x, a.y - b.y) - a.radius - b.radius;
          expect(gap).toBeGreaterThanOrEqual(OBSTACLE_MIN_PASSAGE - 1e-6);
        }
      }
    }
  });

  it('血池仅教堂 8~10 处 r120~180（§3.2；墓地/狼穴无环境危险）', () => {
    expect(buildBloodPools('map_graveyard', 1)).toHaveLength(0);
    expect(buildBloodPools('map_den', 1)).toHaveLength(0);
    const pools = buildBloodPools('map_cathedral', 20240816);
    expect(pools.length).toBeGreaterThanOrEqual(BLOODPOOL_COUNT_MIN);
    expect(pools.length).toBeLessThanOrEqual(BLOODPOOL_COUNT_MAX);
    for (const p of pools) {
      expect(p.radius).toBeGreaterThanOrEqual(BLOODPOOL_RADIUS_MIN);
      expect(p.radius).toBeLessThanOrEqual(BLOODPOOL_RADIUS_MAX);
    }
  });

  it('血池优先于障碍（§⑥.3：危险区覆盖障碍位，不生成重叠碰撞）', () => {
    const pools = buildBloodPools('map_cathedral', 20240816);
    for (const o of buildObstacleCircles('map_cathedral', 20240816)) {
      for (const p of pools) {
        expect(Math.hypot(o.x - p.x, o.y - p.y)).toBeGreaterThan(p.radius + o.radius);
      }
    }
  });

  it('血池不覆盖出生点（池边缘距中心 ≥200px）', () => {
    const m = MAP_CONFIGS.map_cathedral;
    const cx = m.width / 2;
    const cy = m.height / 2;
    for (const p of buildBloodPools('map_cathedral', 20240816)) {
      expect(Math.hypot(p.x - cx, p.y - cy)).toBeGreaterThanOrEqual(p.radius + OBSTACLE_SPAWN_SAFE);
    }
  });

  it('血池上不生成敌人出生点（isOnBloodPool 判定供生成器消费，§⑥.8）', () => {
    const pools = buildBloodPools('map_cathedral', 20240816);
    // 池内点 → true；池外远点 → false
    const p = pools[0]!;
    expect(isOnBloodPool(p.x, p.y, pools)).toBe(true);
    expect(isOnBloodPool(p.x + p.radius - 1, p.y, pools)).toBe(true);
    expect(isOnBloodPool(p.x + p.radius + 50, p.y, pools)).toBe(false);
  });
});

describe('批次 3 装饰散布（纯视觉，无碰撞）', () => {
  it('空帧表返回空', () => {
    expect(buildDecorLayout(WORLD.WIDTH, WORLD.HEIGHT, DECOR_SEED, 18, [])).toEqual([]);
  });

  it('同种子确定性 + 避开出生安全区 + 帧来自传入表', () => {
    const frames = MAP_CONFIGS.map_graveyard.decor;
    const a = buildDecorLayout(WORLD.WIDTH, WORLD.HEIGHT, DECOR_SEED, 18, frames);
    const b = buildDecorLayout(WORLD.WIDTH, WORLD.HEIGHT, DECOR_SEED, 18, frames);
    expect(a).toEqual(b);
    expect(a).toHaveLength(18);
    const cx = WORLD.WIDTH / 2;
    const cy = WORLD.HEIGHT / 2;
    for (const d of a) {
      expect(frames).toContain(d.frame);
      const dist = Math.hypot(d.x - cx, d.y - cy);
      expect(dist).toBeGreaterThan(SPAWN_SAFE_RADIUS);
    }
  });
});
