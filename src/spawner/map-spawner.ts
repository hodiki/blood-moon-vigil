/**
 * spawner/map-spawner.ts —— 生成器参数覆盖·纯函数层（E3-S7）
 *
 * 3 图 3 套生成器参数（gdd-maps §3.4）：差异全部以「MAP_CONFIGS 覆盖」数据化，不新增系统。
 * - 墓地 = 基准曲线（TASK-31 阶段表原样）
 * - 教堂 = 出生环带缩近 + 快速怪权重 ↑（S2/S3 wolf +0.05）
 * - 狼穴 = 敌潮移速（不含 Boss）×1.08 + 野兽构成 ↑（S1/S2/S3 wolf +0.055/+0.07/+0.09）
 *
 * 权重覆盖规则（§3.4）：仅调 wolf，zombie/tank 相应减，**权重和保持 1.00**（校验断言）。
 * 槽位池：阶段权重（zombie/wolf/tank 抽象槽）→ 每地图槽位 → 具体敌人 id（E3-S1 enemiesForMap 派生）。
 */

import { MAP_CONFIGS, type MapId, type EnemyId } from '@/config/balance';
import { SPAWN_STAGES, pickEnemyKind, type StageWeights, type SpawnStage } from '@/spawner/spawner';

/** 生成器三抽象槽（pickEnemyKind 输出收敛，排除 boss；M2 收口 15 敌运行时接入） */
export type EnemySlot = 'zombie' | 'wolf' | 'tank';

/** 每地图槽位 → 具体敌人（E3-S7；15 敌不重不漏；墓地/教堂/狼穴各 6/5/4）。
 *  R-C3-RULING（gdd-enemies-v2 §3.1~3.3 槽位语义裁定）：tank 槽只放 elite tier
 *  （墓地=守墓者 / 教堂=血肉畸体 / 狼穴=石甲狼），特殊行为敌全部归 wolf 槽
 *  （尸巫→墓地 wolf、圣杯侍僧→教堂 wolf、狼裔猎手→狼穴 wolf）——保底厚血 100% 精英。 */
export const MAP_ENEMY_SLOTS: Record<MapId, Record<EnemySlot, EnemyId[]>> = {
  map_graveyard: {
    zombie: ['enemy_g1_1', 'enemy_g1_3'], // 行尸 / 墓穴甲虫（纯尸潮）
    wolf: ['enemy_g1_2', 'enemy_g1_4', 'enemy_g1_5'], // 血犬 / 亡魂（相位）/ 尸巫（光环）
    tank: ['enemy_g1_6'], // 守墓者（精英；R-C3-RULING tank 只放 elite）
  },
  map_cathedral: {
    zombie: ['enemy_g2_1', 'enemy_g2_5'], // 血信徒 / 忏悔者（远程）
    wolf: ['enemy_g2_2', 'enemy_g2_3'], // 血蝠（空中·相位）/ 圣杯侍僧（召唤）
    tank: ['enemy_g2_4'], // 血肉畸体（精英）
  },
  map_den: {
    zombie: ['enemy_g3_1'], // 灰狼
    wolf: ['enemy_g3_2', 'enemy_g3_4'], // 暗影狼（高速）/ 狼裔猎手（冲锋）
    tank: ['enemy_g3_3'], // 石甲狼（精英）
  },
};

/** 阶段表 start → 阶段名（S1/S2/S3；覆盖表联动） */
export function stageNameFor(stage: SpawnStage): 'S1' | 'S2' | 'S3' {
  const idx = SPAWN_STAGES.indexOf(stage);
  if (idx === 1) return 'S2';
  if (idx === 2) return 'S3';
  return 'S1';
}

/**
 * 权重覆盖应用（gdd-maps §3.4）：wolf += delta，zombie/tank 按原占比比例削减，权重和 = 1.00。
 * delta = 0 → 原样返回（基准曲线）。
 */
export function applyWeightOverride(base: StageWeights, wolfDelta: number): StageWeights {
  if (wolfDelta === 0) return { ...base };
  const reduceTarget = base.zombie + base.tank;
  if (reduceTarget <= 0) return { ...base, wolf: base.wolf + wolfDelta };
  return {
    zombie: round6(base.zombie - wolfDelta * (base.zombie / reduceTarget)),
    wolf: round6(base.wolf + wolfDelta),
    tank: round6(base.tank - wolfDelta * (base.tank / reduceTarget)),
  };
}

/** 该阶段实际生效权重（基准 + 该图覆盖；墓地 = 基准原样） */
export function weightedWeightsForStage(mapId: MapId, stage: SpawnStage): StageWeights {
  const name = stageNameFor(stage);
  const delta = MAP_CONFIGS[mapId].stageWeightOverride.find((o) => o.stage === name)?.wolfDelta ?? 0;
  return applyWeightOverride(stage.weights, delta);
}

/** 权重抽槽位 → 槽内选具体敌人（r 抽槽、subR 选敌；E3-S7 生成器消费） */
export function pickEnemyIdForMap(mapId: MapId, weights: StageWeights, r: number, subR: number): EnemyId {
  // pickEnemyKind 面板三槽 {zombie,wolf,tank} 不会返回 'boss'（r 恒 < 1，权重表无 boss）
  const slot = pickEnemyKind(weights, r) as EnemySlot;
  const pool = MAP_ENEMY_SLOTS[mapId][slot];
  const idx = Math.min(pool.length - 1, Math.floor(subR * pool.length));
  return pool[idx]!;
}

/**
 * 让权重抽签 r 稳定落入指定槽位（供已定槽场景：保底厚血强制 tank 槽；M2 收口）。
 * 区间口径与 pickEnemyKind 一致：zombie [0,zombie) / wolf [zombie,zombie+wolf) / tank [zombie+wolf,1)。
 * 覆盖后权重和经 round6 仍 ≈1.00，边界判定与权重表同源。
 */
export function rForSlot(slot: EnemySlot, weights: StageWeights): number {
  switch (slot) {
    case 'zombie': return 0;
    case 'wolf': return weights.zombie;
    case 'tank': return weights.zombie + weights.wolf;
  }
}

/** 全敌移速加权（狼穴 ×1.08，其余 ×1.0；gdd-maps §3.3/§3.4） */
export function enemySpeedFor(mapId: MapId, baseSpeed: number): number {
  return baseSpeed * MAP_CONFIGS[mapId].enemySpeedMultiplier;
}

/** 出生环带覆盖（教堂桌面 [500,800] / 移动 [420,680]；其余基准） */
export function spawnRingFor(mapId: MapId, isMobile: boolean): readonly [number, number] {
  return isMobile ? MAP_CONFIGS[mapId].spawnRingMobile : MAP_CONFIGS[mapId].spawnRingDesktop;
}

/** 6 位小数取整（权重和 1.00 校验浮点稳定） */
function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
