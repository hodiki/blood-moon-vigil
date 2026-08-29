/**
 * stats/save.ts —— 局外存档数据层（E4-S8，gdd-codex §3.2/§6）
 *
 * localStorage 持久化：图鉴解锁记录 + 功绩点数 + 已装备加成 + 通关地图 + 纯局内模式。
 * - 损坏回退空存档不崩溃（gdd-codex §6.1）；损坏文件备份 `.bak`。
 * - 多端存档独立（桌面/移动 key 后缀，gdd-codex §6.2；不做云同步）。
 * - 重开/换角色不重复解锁（幂等由 CodexTracker.record 保证）。
 *
 * storage 抽象为最小接口（getItem/setItem/removeItem），测试注入 fake。
 *
 * ⚠ v2 迁移骨架（B1 批次，gdd-talent-tree §⑩-11 / EG 裁决「迁移函数先于版本号落地」）：
 * - SAVE_VERSION 1→2 前先落地 migrateSaveV1toV2（R2 风险：直接 bump 会静默清掉全量玩家进度）；
 * - v2 新增 treeState（节点/层数/spent 占位）+ preselectedWeapon（Q-d 占位），
 *   语义由 B5 天赋树批次填充，本批仅保证旧档无损迁移 + 新字段默认值；
 * - loadSave 增 v1 旧键回读迁移链（bmv.save.v1 → 迁移 → v2）；旧键数据保留不覆盖；
 * - 未来版本档/损坏档口径照既有行为延续（回退空存档 + .bak 备份，原键不删）。
 */

import type { MapId } from '@/config/balance';
import type { MeritId } from '@/stats/merit';

export const SAVE_VERSION = 3;
/** 迁移链版本号（v2 = B3 treeState 空占位档；v1 = 功绩旧档）；迁移函数先于 bump 落地，EG 裁决 */
export const SAVE_VERSION_PREVIOUS = 2;
export const SAVE_VERSION_V1 = 1;

/** 存档键前缀（多端独立：桌面 '' / 移动 '-mobile'，gdd-codex §6.2） */
export function saveKey(platform: 'desktop' | 'mobile' = 'desktop'): string {
  return `bmv.save.v${SAVE_VERSION}${platform === 'mobile' ? '-mobile' : ''}`;
}

/** v1 旧档键（迁移回读源；v2 上线后旧键数据只读保留，不覆盖不删除） */
export function saveKeyLegacy(platform: 'desktop' | 'mobile' = 'desktop'): string {
  return `bmv.save.v${SAVE_VERSION_PREVIOUS}${platform === 'mobile' ? '-mobile' : ''}`;
}

/** v3 起实结构：滤月余辉天赋树状态（gdd-talent-tree A-4） */
export interface TreeStateSave {
  /** 已点亮节点 id（树配置表主键；去重列表） */
  unlockedNodeIds: string[];
  /** 节点 → 已购层数（属性点位重复点亮） */
  purchases: Record<string, number>;
  /** 已消耗余辉点数（余额 = meritPoints − pointsSpent） */
  pointsSpent: number;
}

/**
 * v2 → v3 迁移（gdd-talent-tree §⑩-11 验收判据）：
 * - 余辉余额 1:1 平移（meritPoints 沿用）；
 * - 旧 4 加成各折算对应属性节点 1 层自动点亮（merit_hp→a_life / merit_dmg→a_damage /
 *   merit_magnet→a_magnet / merit_speed→a_move_speed；差额不找零，锚）；
 * - meritEquipped 退役（字段保留兼容读，写不再消费）；
 * - preselectedWeapon 透传（v2 占位 null）。
 */
export function migrateSaveV2toV3(v2: Record<string, unknown>): SaveData {
  const common = parseCommonFields(v2);
  // 旧 4 加成折算：meritEquipped（≤2）各点亮对应属性节点 1 层（ purchases 累计，防重复折算）
  const purchases: Record<string, number> = {};
  let pointsSpent = 0;
  const meritToNode: Record<string, string> = {
    merit_hp: 'a_life',
    merit_dmg: 'a_damage',
    merit_magnet: 'a_magnet',
    merit_speed: 'a_move_speed',
  };
  for (const m of common.meritEquipped) {
    const node = meritToNode[m];
    if (!node) continue;
    purchases[node] = (purchases[node] ?? 0) + 1;
    pointsSpent += 10; // 属性单价锚（talent-tree cost 10/层；差额不找零）
  }
  return {
    version: SAVE_VERSION,
    ...common,
    treeState: { unlockedNodeIds: Object.keys(purchases), purchases, pointsSpent },
    preselectedWeapon: typeof v2.preselectedWeapon === 'string' ? v2.preselectedWeapon : null,
  };
}

/** v1 → v2 迁移沿用（B3），v1 直达 v3 = 先 v2 迁移再 v3 迁移 */
export function migrateSaveV1toV3(v1: Record<string, unknown>): SaveData {
  return migrateSaveV2toV3(migrateSaveV1toV2Raw(v1));
}

/** v1 → v2（B3 原迁移逻辑内联保留，供 v1 直达链） */
function migrateSaveV1toV2Raw(v1: Record<string, unknown>): Record<string, unknown> {
  const common = parseCommonFields(v1);
  return { version: SAVE_VERSION_PREVIOUS, ...common, treeState: { unlockedNodeIds: [], pointsSpent: 0 }, preselectedWeapon: null };
}

export interface SaveData {
  version: number;
  /** 已解锁图鉴条目 id（幂等；重开不重复） */
  codexUnlocked: string[];
  /** 累计功绩点数（局外成长；总成本 120 解锁全部 4 加成。v2 起 1:1 平移为余辉） */
  meritPoints: number;
  /** 已装备功绩加成（≤2，gdd-codex §3.4；树批次 B5 后退役——迁移期保留字段兼容 merit-overlay） */
  meritEquipped: MeritId[];
  /** 已通关地图（解锁流数据源，E4-S9） */
  clearedMaps: MapId[];
  /** 纯局内模式（关闭全部功绩加成） */
  pureInGame: boolean;
  /** v2 新增：天赋树状态（占位默认空树，B5 接线） */
  treeState: TreeStateSave;
  /** v2 新增：Q-d 预选通武（gdd-talent-tree A-4；占位默认 null，B5 接线） */
  preselectedWeapon: string | null;
}

export function emptySave(): SaveData {
  return {
    version: SAVE_VERSION,
    codexUnlocked: [],
    meritPoints: 0,
    meritEquipped: [],
    clearedMaps: [],
    pureInGame: false,
    treeState: { unlockedNodeIds: [], purchases: {}, pointsSpent: 0 },
    preselectedWeapon: null,
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

/** 逐字段宽松校验（v1/v2 共用的基础字段解析；非法字段回退默认，gdd-codex §6.1） */
function parseCommonFields(o: Record<string, unknown>): Pick<SaveData, 'codexUnlocked' | 'meritPoints' | 'meritEquipped' | 'clearedMaps' | 'pureInGame'> {
  const codexUnlocked = Array.isArray(o.codexUnlocked) ? o.codexUnlocked.filter((v): v is string => typeof v === 'string') : [];
  const meritEquipped = Array.isArray(o.meritEquipped) ? o.meritEquipped.filter(isMeritId) : [];
  const clearedMaps = Array.isArray(o.clearedMaps) ? o.clearedMaps.filter(isMapId) : [];
  return {
    codexUnlocked,
    meritPoints: typeof o.meritPoints === 'number' && Number.isFinite(o.meritPoints) && o.meritPoints >= 0 ? Math.floor(o.meritPoints) : 0,
    meritEquipped,
    clearedMaps,
    pureInGame: typeof o.pureInGame === 'boolean' ? o.pureInGame : false,
  };
}

/** treeState 宽松校验（非法/缺失 → 空树占位；B5 接树配置表后收紧主键校验） */
function parseTreeState(v: unknown): TreeStateSave {
  if (typeof v !== 'object' || v === null) return { unlockedNodeIds: [], purchases: {}, pointsSpent: 0 };
  const o = v as Record<string, unknown>;
  const unlockedNodeIds = Array.isArray(o.unlockedNodeIds)
    ? o.unlockedNodeIds.filter((n): n is string => typeof n === 'string')
    : [];
  const purchases: Record<string, number> = {};
  if (typeof o.purchases === 'object' && o.purchases !== null) {
    for (const [k, n] of Object.entries(o.purchases as Record<string, unknown>)) {
      if (typeof n === 'number' && Number.isFinite(n) && n > 0) purchases[k] = Math.floor(n);
    }
  }
  const pointsSpent = typeof o.pointsSpent === 'number' && Number.isFinite(o.pointsSpent) && o.pointsSpent >= 0
    ? Math.floor(o.pointsSpent)
    : 0;
  return { unlockedNodeIds, purchases, pointsSpent };
}

/**
 * v1 → v2 迁移（gdd-talent-tree §⑩-11 / EG 裁决）：
 * - meritPoints 1:1 平移（功绩 → 余辉，calculateMeritPoints 管线沿用零改动）；
 * - meritEquipped 保留（merit-overlay 迁移期兼容；树批次 B5 后随加成折算退役）；
 * - treeState = 空树占位 / preselectedWeapon = null（默认值占位，B5 填语义）。
 * 输入为已 JSON.parse 的 v1 对象（parseSave 迁移链调用；字段校验与 v1 parseSave 同宽入口径）。
 */
export function migrateSaveV1toV2(v1: Record<string, unknown>): SaveData {
  return migrateSaveV2toV3(((): Record<string, unknown> => {
    const common = parseCommonFields(v1);
    return { version: SAVE_VERSION_PREVIOUS, ...common, treeState: { unlockedNodeIds: [], pointsSpent: 0 }, preselectedWeapon: null };
  })());
}

/**
 * 解析存档 JSON（宽松：非法字段回退默认）。
 * 版本分派（迁移链）：
 * - version = SAVE_VERSION(3) → 按 v3 校验（含 treeState purchases/preselectedWeapon）；
 * - version = 1（旧档）→ migrateSaveV1toV2 迁移；
 * - 未来版本 / 其他 → 回退空存档（口径延续：调用方 loadSave 负责备份 .bak，原数据保留不覆盖）。
 */
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
  if (o.version === 1) return migrateSaveV1toV3(o);
  if (o.version === 2) return migrateSaveV2toV3(o);
  if (o.version !== SAVE_VERSION) return base;
  return {
    version: SAVE_VERSION,
    ...parseCommonFields(o),
    treeState: parseTreeState(o.treeState),
    preselectedWeapon: typeof o.preselectedWeapon === 'string' ? o.preselectedWeapon : null,
  };
}

/** 读存档（缺键/损坏 → 空存档 + 损坏文件备份 .bak；不抛错，gdd-codex §6.1） */
export function loadSave(storage: SaveStorage, platform: 'desktop' | 'mobile' = 'desktop'): SaveData {
  const key = saveKey(platform);
  try {
    const raw = storage.getItem(key);
    if (raw === null) {
      // v3 键缺失 → 旧键回读迁移链（v2 → v3 / v1 → v3；旧键只读保留，不覆盖不删除）
      const v2Raw = storage.getItem(saveKeyLegacy(platform));
      if (v2Raw !== null) return parseSave(v2Raw);
      const v1Raw = storage.getItem(`bmv.save.v${SAVE_VERSION_V1}${platform === 'mobile' ? '-mobile' : ''}`);
      if (v1Raw !== null) return parseSave(v1Raw);
      return emptySave();
    }
    const data = parseSave(raw);
    // parseSave 返回空存档的两种非正常情况：损坏 JSON / 未来版本 → 备份 .bak 后回退空存档；
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
