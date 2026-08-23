/**
 * config/session-selection.ts —— 局外会话选择（E4-S1 角色 / E4-S9 地图）
 *
 * 纯数据层（可脱离 Phaser 单测）：本轮开局选哪个角色、哪张图。
 * - 默认：守夜人 hero_edmund + 墓地 map_graveyard（gdd-codex §3.5 默认解锁）。
 * - 解锁门禁（E4-S9）：非默认角色/地图须先满足解锁记录（save.ts 数据层在 M2-S4 段2 落地），
 *   本模块只提供选择读写；解锁校验由 `canSelectHero/canSelectMap`（依赖解锁记录）完成。
 * - UI（主菜单角色卡/地图选择）归 M3 最小实现；PlayScene 开局读本模块。
 * - 会话级（非持久）：scene.restart 保留选择；返回主菜单重进 Play 仍保留（用户回到
 *   开始界面重新选择才更新）——与「再来一局」同会话语义一致。
 */

import type { HeroId, MapId } from '@/config/balance';

/** 默认角色（gdd-codex §3.5：守夜人默认解锁） */
export const DEFAULT_HERO: HeroId = 'hero_edmund';
/** 默认地图（gdd-codex §3.5：地图 1 = 墓地默认解锁） */
export const DEFAULT_MAP: MapId = 'map_graveyard';

/** 当前选中角色（默认守夜人） */
let selectedHero: HeroId = DEFAULT_HERO;
/** 当前选中地图（默认墓地） */
let selectedMap: MapId = DEFAULT_MAP;

export function getSelectedHero(): HeroId {
  return selectedHero;
}

export function setSelectedHero(hero: HeroId): void {
  selectedHero = hero;
}

export function getSelectedMap(): MapId {
  return selectedMap;
}

export function setSelectedMap(map: MapId): void {
  selectedMap = map;
}

/** 测试/返回主菜单：重置为默认（gdd-codex §3.5） */
export function resetSessionSelection(): void {
  selectedHero = DEFAULT_HERO;
  selectedMap = DEFAULT_MAP;
}

/**
 * 角色是否可选（E4-S9 解锁流；unlock 记录由 save.ts 数据层提供）。
 * - hero_edmund 默认可选；
 * - hero_cassandra 需通关地图 1（graveyard）；
 * - hero_violet 需通关地图 2（cathedral）；
 * - hero_galvan 需击败狼王·芬里厄（通关地图 3，gdd-codex §3.5 情感闭环）。
 * unlock 参数：{ clearedGraveyard?, clearedCathedral?, clearedDen? } —— 缺省全部 false（未解锁）。
 */
export function canSelectHero(
  hero: HeroId,
  unlock: { clearedGraveyard: boolean; clearedCathedral: boolean; clearedDen: boolean },
): boolean {
  switch (hero) {
    case 'hero_edmund':
      return true;
    case 'hero_cassandra':
      return unlock.clearedGraveyard;
    case 'hero_violet':
      return unlock.clearedCathedral;
    case 'hero_galvan':
      return unlock.clearedDen;
    default:
      return false;
  }
}

/**
 * 地图是否可选（E4-S9 解锁流）。
 * - map_graveyard 默认；
 * - map_cathedral 需通关墓地；
 * - map_den 需通关教堂。
 */
export function canSelectMap(
  map: MapId,
  unlock: { clearedGraveyard: boolean; clearedCathedral: boolean; clearedDen: boolean },
): boolean {
  switch (map) {
    case 'map_graveyard':
      return true;
    case 'map_cathedral':
      return unlock.clearedGraveyard;
    case 'map_den':
      return unlock.clearedCathedral;
    default:
      return false;
  }
}

/** 选择并校验：非法选择回退默认（防数据层/UI 越权，PlayScene 开局兜底） */
export function selectHeroSafely(hero: HeroId, unlock: Parameters<typeof canSelectHero>[1]): HeroId {
  const target = canSelectHero(hero, unlock) ? hero : DEFAULT_HERO;
  setSelectedHero(target);
  return target;
}

/** 选择并校验地图：非法选择回退默认 */
export function selectMapSafely(map: MapId, unlock: Parameters<typeof canSelectMap>[1]): MapId {
  const target = canSelectMap(map, unlock) ? map : DEFAULT_MAP;
  setSelectedMap(target);
  return target;
}
