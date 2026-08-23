/**
 * stats/save.ts —— 局外存档数据层（E4-S8，gdd-codex §3.2/§6）
 *
 * localStorage 持久化：图鉴解锁记录 + 功绩点数 + 已装备加成 + 通关地图 + 纯局内模式。
 * - 损坏回退空存档不崩溃（gdd-codex §6.1）；损坏文件备份 `.bak`。
 * - 多端存档独立（桌面/移动 key 后缀，gdd-codex §6.2；不做云同步）。
 * - 重开/换角色不重复解锁（幂等由 CodexTracker.record 保证）。
 *
 * storage 抽象为最小接口（getItem/setItem/removeItem），测试注入 fake。
 */

import type { MapId } from '@/config/balance';
import type { MeritId } from '@/stats/merit';

export const SAVE_VERSION = 1;

/** 存档键前缀（多端独立：桌面 '' / 移动 '-mobile'，gdd-codex §6.2） */
export function saveKey(platform: 'desktop' | 'mobile' = 'desktop'): string {
  return `bmv.save.v${SAVE_VERSION}${platform === 'mobile' ? '-mobile' : ''}`;
}

export interface SaveData {
  version: number;
  /** 已解锁图鉴条目 id（幂等；重开不重复） */
  codexUnlocked: string[];
  /** 累计功绩点数（局外成长；总成本 120 解锁全部 4 加成） */
  meritPoints: number;
  /** 已装备功绩加成（≤2，gdd-codex §3.4） */
  meritEquipped: MeritId[];
  /** 已通关地图（解锁流数据源，E4-S9） */
  clearedMaps: MapId[];
  /** 纯局内模式（关闭全部功绩加成） */
  pureInGame: boolean;
}

export function emptySave(): SaveData {
  return {
    version: SAVE_VERSION,
    codexUnlocked: [],
    meritPoints: 0,
    meritEquipped: [],
    clearedMaps: [],
    pureInGame: false,
  };
}

/** 最小 storage 接口（真实 window.localStorage；测试注入 fake） */
export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

function isMeritId(v: unknown): v is MeritId {
  return v === 'merit_hp' || v === 'merit_dmg' || v === 'merit_magnet' || v === 'merit_speed';
}

function isMapId(v: unknown): v is MapId {
  return v === 'map_graveyard' || v === 'map_cathedral' || v === 'map_den';
}

/** 解析存档 JSON（宽松：非法字段回退默认；版本不符回退空存档） */
export function parseSave(raw: string): SaveData {
  const base = emptySave();
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return base; // 损坏 JSON → 空存档
  }
  if (typeof obj !== 'object' || obj === null) return base;
  const o = obj as Record<string, unknown>;
  if (o.version !== SAVE_VERSION) return base;
  const codexUnlocked = Array.isArray(o.codexUnlocked) ? o.codexUnlocked.filter((v): v is string => typeof v === 'string') : [];
  const meritEquipped = Array.isArray(o.meritEquipped) ? o.meritEquipped.filter(isMeritId) : [];
  const clearedMaps = Array.isArray(o.clearedMaps) ? o.clearedMaps.filter(isMapId) : [];
  return {
    version: SAVE_VERSION,
    codexUnlocked,
    meritPoints: typeof o.meritPoints === 'number' && Number.isFinite(o.meritPoints) && o.meritPoints >= 0 ? Math.floor(o.meritPoints) : 0,
    meritEquipped,
    clearedMaps,
    pureInGame: typeof o.pureInGame === 'boolean' ? o.pureInGame : false,
  };
}

/** 读存档（缺键/损坏 → 空存档 + 损坏文件备份 .bak；不抛错，gdd-codex §6.1） */
export function loadSave(storage: SaveStorage, platform: 'desktop' | 'mobile' = 'desktop'): SaveData {
  const key = saveKey(platform);
  try {
    const raw = storage.getItem(key);
    if (raw === null) return emptySave();
    const data = parseSave(raw);
    // parseSave 返回空存档的两种非正常情况：损坏 JSON / 版本不符 → 备份 .bak 后回退空存档；
    // 正常「全空」存档（raw 恰为 emptySave JSON）不做备份。
    const isGenuinelyEmpty = raw === JSON.stringify(emptySave());
    if (data.version !== SAVE_VERSION || (!isGenuinelyEmpty && JSON.stringify(data) === JSON.stringify(emptySave()))) {
      try {
        storage.setItem(`${key}.bak`, raw);
      } catch {
        // 备份失败不阻断
      }
      return emptySave();
    }
    return data;
  } catch {
    return emptySave(); // localStorage 不可用（隐私模式）不阻断
  }
}

/** 写存档（尽力而为：写失败不抛错） */
export function writeSave(storage: SaveStorage, data: SaveData, platform: 'desktop' | 'mobile' = 'desktop'): void {
  try {
    storage.setItem(saveKey(platform), JSON.stringify(data));
  } catch {
    // 写失败不抛错：存档尽力而为
  }
}

/** 通关记录：标记某图已通关（幂等；返回是否新增） */
export function recordMapCleared(data: SaveData, map: MapId): boolean {
  if (data.clearedMaps.includes(map)) return false;
  data.clearedMaps = [...data.clearedMaps, map];
  return true;
}

/** 解锁流查询：地图/角色解锁条件（E4-S9，gdd-codex §3.5） */
export function unlockStatusFromSave(data: SaveData): {
  clearedGraveyard: boolean;
  clearedCathedral: boolean;
  clearedDen: boolean;
} {
  return {
    clearedGraveyard: data.clearedMaps.includes('map_graveyard'),
    clearedCathedral: data.clearedMaps.includes('map_cathedral'),
    clearedDen: data.clearedMaps.includes('map_den'),
  };
}
