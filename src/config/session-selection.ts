/**
 * config/session-selection.ts —— 局外会话选择（E4-S1 角色 / E4-S9 地图）
 *
 * 纯数据层（可脱离 Phaser 单测）：本轮开局选哪个角色、哪张图。
 * - 默认：守夜人 hero_edmund + 墓地 map_graveyard（gdd-codex §3.5 默认解锁）。
 * - 0.2.x 全开放（QA-FIX-3 追加①用户决策）：当前四角色/三图一开始即可自由选择；
 *   解锁门禁机制（save.ts 记录 + selectSafely 兜底）保留给未来新增内容。
 * - 本模块只提供选择读写与门禁查询；UI（主菜单角色卡/地图选择）按门禁结果渲染，
 *   PlayScene 开局读本模块。
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
 * 角色是否可选（QA-FIX-3 追加①：0.2.x 当前阵容全开放——用户决策，
 * 四角色一开始即可自由选择，R3 外测锁定门禁观感移除）。
 * unlock 门禁机制保留给未来新增角色：届时按 unlock 记录恢复分支（API 签名不变）；
 * unlock 参数当前仅作签名占位（未来门禁复用），不影响结果。
 * - hero_edmund / hero_cassandra / hero_violet / hero_galvan 一律返回 true；
 * - 未知 id 防御返回 false（selectHeroSafely 兜底回退默认仍保留）。
 */
export function canSelectHero(
  hero: HeroId,
  unlock: { clearedGraveyard: boolean; clearedCathedral: boolean; clearedDen: boolean },
): boolean {
  void unlock; // 0.2.x 全开放；未来新增角色按 unlock 记录门禁（E4-S9 原条件见 git 历史）
  switch (hero) {
    case 'hero_edmund':
    case 'hero_cassandra':
    case 'hero_violet':
    case 'hero_galvan':
      return true;
    default:
      return false;
  }
}

/**
 * 地图是否可选（QA-FIX-3 追加①：0.2.x 三图全开放，同 canSelectHero——
 * 门禁机制保留给未来新增地图，API 签名不变；未知 id 防御返回 false）。
 */
export function canSelectMap(
  map: MapId,
  unlock: { clearedGraveyard: boolean; clearedCathedral: boolean; clearedDen: boolean },
): boolean {
  void unlock; // 0.2.x 全开放；未来新增地图按 unlock 记录门禁
  switch (map) {
    case 'map_graveyard':
    case 'map_cathedral':
    case 'map_den':
      return true;
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
