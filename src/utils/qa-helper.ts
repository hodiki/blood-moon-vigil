/**
 * utils/qa-helper.ts —— `?qa=1` 控制台测试辅助（QA-FIX-2 B）
 *
 * 仅当 URL 带 `?qa=1` 时由 main.ts 安装到 window.__BMV_QA（生产玩家不可见作弊入口）。
 * 全部走 save.ts / session-selection.ts 正式 API，不裸写 localStorage：
 * - unlockAll(): 三个 clearedMaps 标记置 true 并持久化 → 刷新/返回主菜单即全解锁。
 * - setHero(id)/setMap(id): selectHeroSafely/selectMapSafely（带当前存档解锁校验，
 *   非法回退默认并返回实际生效值）——免刷新切角色/地图。
 * - status(): 当前 { hero, map, unlocks } JSON 快照。
 *
 * 注意：全局对象一律 __BMV_QA；不带 qa=1 时 installQaHelper 不被调用、零副作用。
 */

import {
  loadSave,
  writeSave,
  recordMapCleared,
  unlockStatusFromSave,
  type SaveData,
  type SaveStorage,
} from '@/stats/save';
import { detectIsMobile } from '@/utils/device';
import { getSelectedHero, getSelectedMap, selectHeroSafely, selectMapSafely } from '@/config/session-selection';
import { HEROES, MAP_CONFIGS, type HeroId, type MapId } from '@/config/balance';

export interface QaHelper {
  /** 全解锁：三图通关标记持久化（正式 recordMapCleared + writeSave API） */
  unlockAll(): SaveData;
  /** 免刷新切角色（非法 id/未解锁 → 回退默认守夜人；返回实际生效 heroId） */
  setHero(id: string): HeroId;
  /** 免刷新切地图（非法 id/未解锁 → 回退默认墓地；返回实际生效 mapId） */
  setMap(id: string): MapId;
  /** 当前选择与解锁状态快照 */
  status(): { hero: string; map: string; unlocks: ReturnType<typeof unlockStatusFromSave> };
}

/** 安装 QA 辅助（main.ts 在 URL 含 qa=1 时调用；storage/platform 注入便于单测） */
export function installQaHelper(storage: SaveStorage, platform?: 'desktop' | 'mobile'): QaHelper {
  const plat = platform ?? (detectIsMobile() ? 'mobile' : 'desktop');

  const loadCurrent = (): SaveData => loadSave(storage, plat);

  return {
    unlockAll(): SaveData {
      const data = loadCurrent();
      for (const map of ['map_graveyard', 'map_cathedral', 'map_den'] as const) {
        recordMapCleared(data, map); // 幂等
      }
      writeSave(storage, data, plat);
      return data;
    },

    setHero(id: string): HeroId {
      const known = Object.prototype.hasOwnProperty.call(HEROES, id);
      if (!known) return getSelectedHero(); // 未知 id 不动当前选择
      const unlock = unlockStatusFromSave(loadCurrent());
      return selectHeroSafely(id as HeroId, unlock);
    },

    setMap(id: string): MapId {
      const known = Object.prototype.hasOwnProperty.call(MAP_CONFIGS, id);
      if (!known) return getSelectedMap();
      const unlock = unlockStatusFromSave(loadCurrent());
      return selectMapSafely(id as MapId, unlock);
    },

    status() {
      return {
        hero: getSelectedHero(),
        map: getSelectedMap(),
        unlocks: unlockStatusFromSave(loadCurrent()),
      };
    },
  };
}
