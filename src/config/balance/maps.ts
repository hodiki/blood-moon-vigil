/**
 * config/balance/maps.ts —— 地图表 3（生成器参数覆盖总表）
 *
 * balance.ts 域拆分（EG-1）纯搬移：数值与注释原样保留，不改任何行为。
 */

import type { MapId, BossId } from './ids';

/** 地图生成器阶段权重覆盖（gdd-maps §3.4；wolf 增量，zombie/tank 相应减，权重和保持 1.00） */
export interface StageWeightOverride {
  stage: 'S1' | 'S2' | 'S3';
  /** wolf 权重增量（教堂 S2/S3 +0.05；狼穴按 §3.3 具体值） */
  wolfDelta: number;
}

/** 地图配置（gdd-maps §3.1~3.4；生成器参数覆盖总表） */
export interface MapConfig {
  id: MapId;
  name: string;
  width: number;
  height: number;
  /** 地面 tile 帧（content-id-frame-map §4） */
  tiles: readonly string[];
  /** 障碍帧 */
  obstacles: readonly string[];
  /** 装饰帧 */
  decor: readonly string[];
  /** 障碍密度（座/1000²，§3.0） */
  obstacleDensityPer1000: number;
  boss: BossId;
  /** 解锁条件：null = 默认解锁 */
  unlock: MapId | null;
  spawnRingDesktop: readonly [number, number];
  spawnRingMobile: readonly [number, number];
  /** 阶段权重覆盖（§3.4；无覆盖 = 基准） */
  stageWeightOverride: readonly StageWeightOverride[];
  /** 敌潮移速加权（不含 Boss；狼穴 ×1.08，其余 1.0） */
  enemySpeedMultiplier: number;
  /** 环境危险（仅教堂血池） */
  danger?: string;
}

/** 地图表 3（gdd-maps §3.1~3.4） */
export const MAP_CONFIGS: Record<MapId, MapConfig> = {
  map_graveyard: {
    id: 'map_graveyard', name: '月下墓地', width: 3000, height: 3000,
    tiles: ['tile-ground', 'tile-grass', 'tile-grave-soil'],
    obstacles: ['obst-grave-tomb', 'obst-grave-fence'],
    decor: ['decor-grave-tree', 'decor-grave-candle', 'decor-grave-bone'],
    obstacleDensityPer1000: 12, boss: 'boss_1', unlock: null,
    spawnRingDesktop: [600, 900], spawnRingMobile: [500, 800],
    stageWeightOverride: [], enemySpeedMultiplier: 1.0,
  },
  map_cathedral: {
    id: 'map_cathedral', name: '血教堂', width: 2800, height: 2800,
    tiles: ['tile-church-stone', 'tile-church-carpet'],
    obstacles: ['obst-church-pillar', 'obst-church-bench', 'obst-church-altar'],
    decor: ['decor-church-glasslight'],
    obstacleDensityPer1000: 22, boss: 'boss_2', unlock: 'map_graveyard',
    spawnRingDesktop: [500, 800], spawnRingMobile: [420, 680],
    stageWeightOverride: [{ stage: 'S2', wolfDelta: 0.05 }, { stage: 'S3', wolfDelta: 0.05 }],
    enemySpeedMultiplier: 1.0,
    danger: '血池 ×8~10（r120~180）：减速 30% + 持续伤 8/s',
  },
  map_den: {
    id: 'map_den', name: '狼穴', width: 3200, height: 3200,
    tiles: ['tile-den-earth', 'tile-den-grass'],
    obstacles: ['obst-den-rock', 'obst-den-log'],
    decor: ['decor-den-bone', 'decor-den-fire', 'decor-den-spike'],
    obstacleDensityPer1000: 14, boss: 'boss_3', unlock: 'map_cathedral',
    spawnRingDesktop: [600, 900], spawnRingMobile: [500, 800],
    stageWeightOverride: [
      { stage: 'S1', wolfDelta: 0.055 },
      { stage: 'S2', wolfDelta: 0.07 },
      { stage: 'S3', wolfDelta: 0.09 },
    ],
    enemySpeedMultiplier: 1.08,
  },
};
