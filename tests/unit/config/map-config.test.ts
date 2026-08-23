import { describe, it, expect } from 'vitest';
import { MAP_CONFIGS, type MapId } from '@/config/balance';

/**
 * E1-S6（S1a 子集）地图配置表 3（gdd-maps §3.1~3.4 / content-design-outline §5）。
 * 纯数据层：3 图尺寸/tile/障碍密度/Boss/生成器参数覆盖总表与 GDD 一致。
 */

describe('地图表 3（gdd-maps §3.1~3.4）', () => {
  it('恰好 3 图，内容 ID 全覆盖', () => {
    expect(Object.keys(MAP_CONFIGS)).toEqual(['map_graveyard', 'map_cathedral', 'map_den']);
  });

  it('地图 1 月下墓地：3000×3000 / 石板+草地 / 密度 12 / Boss 血月尊者 / 默认解锁', () => {
    expect(MAP_CONFIGS.map_graveyard).toMatchObject({
      name: '月下墓地', width: 3000, height: 3000,
      obstacleDensityPer1000: 12, boss: 'boss_1', unlock: null,
      enemySpeedMultiplier: 1.0,
      spawnRingDesktop: [600, 900], spawnRingMobile: [500, 800],
    });
    expect(MAP_CONFIGS.map_graveyard.tiles).toEqual(['tile-ground', 'tile-grass', 'tile-grave-soil']);
    expect(MAP_CONFIGS.map_graveyard.obstacles).toEqual(['obst-grave-tomb', 'obst-grave-fence']);
    expect(MAP_CONFIGS.map_graveyard.stageWeightOverride).toHaveLength(0); // 基准曲线，无覆盖
  });

  it('地图 2 血教堂：2800×2800 / 石砖+地毯 / 密度 22 / Boss 尼禄 / 通关墓地解锁 / 血池危险', () => {
    expect(MAP_CONFIGS.map_cathedral).toMatchObject({
      name: '血教堂', width: 2800, height: 2800,
      obstacleDensityPer1000: 22, boss: 'boss_2', unlock: 'map_graveyard',
      enemySpeedMultiplier: 1.0,
      spawnRingDesktop: [500, 800], spawnRingMobile: [420, 680],
      danger: expect.stringContaining('血池'),
    });
    expect(MAP_CONFIGS.map_cathedral.tiles).toEqual(['tile-church-stone', 'tile-church-carpet']);
    expect(MAP_CONFIGS.map_cathedral.obstacles).toEqual(['obst-church-pillar', 'obst-church-bench', 'obst-church-altar']);
  });

  it('地图 3 狼穴：3200×3200 / 岩地+暗绿草 / 密度 14 / Boss 芬里厄 / 通关教堂解锁 / 移速 ×1.08', () => {
    expect(MAP_CONFIGS.map_den).toMatchObject({
      name: '狼穴', width: 3200, height: 3200,
      obstacleDensityPer1000: 14, boss: 'boss_3', unlock: 'map_cathedral',
      enemySpeedMultiplier: 1.08,
      spawnRingDesktop: [600, 900], spawnRingMobile: [500, 800],
    });
    expect(MAP_CONFIGS.map_den.tiles).toEqual(['tile-den-earth', 'tile-den-grass']);
    expect(MAP_CONFIGS.map_den.obstacles).toEqual(['obst-den-rock', 'obst-den-log']);
  });

  it('生成器参数覆盖：教堂 S2/S3 wolf +0.05；狼穴 S1/S2/S3 wolf +0.055/+0.07/+0.09（§3.3/§3.4）', () => {
    const cathedral = MAP_CONFIGS.map_cathedral.stageWeightOverride;
    expect(cathedral).toEqual([
      { stage: 'S2', wolfDelta: 0.05 },
      { stage: 'S3', wolfDelta: 0.05 },
    ]);
    const den = MAP_CONFIGS.map_den.stageWeightOverride;
    expect(den).toEqual([
      { stage: 'S1', wolfDelta: 0.055 },
      { stage: 'S2', wolfDelta: 0.07 },
      { stage: 'S3', wolfDelta: 0.09 },
    ]);
  });

  it('解锁链闭环：墓地默认 → 教堂 → 狼穴；唯一性（每图至多一个解锁前置）', () => {
    const unlockOf = (id: MapId): MapId | null => MAP_CONFIGS[id].unlock;
    expect(unlockOf('map_graveyard')).toBeNull();
    expect(unlockOf('map_cathedral')).toBe('map_graveyard');
    expect(unlockOf('map_den')).toBe('map_cathedral');
    expect(new Set(Object.values(MAP_CONFIGS).map((m) => m.unlock)).size).toBe(3);
  });
});
