import { describe, it, expect, beforeEach } from 'vitest';
import {
  emptySave,
  parseSave,
  loadSave,
  writeSave,
  saveKey,
  saveKeyLegacy,
  SAVE_VERSION,
  SAVE_VERSION_PREVIOUS,
  migrateSaveV1toV2,
  recordMapCleared,
  unlockStatusFromSave,
  type SaveData,
  type SaveStorage,
} from '@/stats/save';

function makeStorage(): SaveStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

describe('E4-S8 存档数据层（gdd-codex §3.2/§6）', () => {
  let storage: ReturnType<typeof makeStorage>;
  beforeEach(() => {
    storage = makeStorage();
  });

  it('空存档：缺键 → 默认（不崩溃）', () => {
    const data = loadSave(storage, 'desktop');
    expect(data).toEqual(emptySave());
  });

  it('写入/读取往返；多端存档独立（桌面/移动 key 后缀）', () => {
    const data: SaveData = {
      ...emptySave(),
      codexUnlocked: ['codex_enemy_enemy_g1_1'],
      meritPoints: 30,
      meritEquipped: ['merit_hp'],
      clearedMaps: ['map_graveyard'],
      pureInGame: true,
    };
    writeSave(storage, data, 'desktop');
    expect(saveKey('desktop')).toContain('bmv.save');
    expect(saveKey('mobile')).toContain('-mobile');
    const loaded = loadSave(storage, 'desktop');
    expect(loaded.codexUnlocked).toEqual(['codex_enemy_enemy_g1_1']);
    expect(loaded.meritPoints).toBe(30);
    expect(loaded.meritEquipped).toEqual(['merit_hp']);
    expect(loaded.clearedMaps).toEqual(['map_graveyard']);
    expect(loaded.pureInGame).toBe(true);
    // 移动端独立：desktop 写入不污染 mobile
    expect(loadSave(storage, 'mobile')).toEqual(emptySave());
  });

  it('损坏 JSON → 回退空存档 + 备份 .bak（gdd-codex §6.1）', () => {
    storage.setItem(saveKey('desktop'), '{broken json!!!');
    const data = loadSave(storage, 'desktop');
    expect(data).toEqual(emptySave());
    expect(storage.getItem(saveKey('desktop') + '.bak')).toBe('{broken json!!!');
  });

  it('未来版本档 → 回退空存档 + 备份；原档数据保留不覆盖（口径延续）', () => {
    const future = JSON.stringify({ version: 999, codexUnlocked: ['codex_enemy_enemy_g1_1'], meritPoints: 88 });
    storage.setItem(saveKey('desktop'), future);
    const data = loadSave(storage, 'desktop');
    expect(data.version).toBe(SAVE_VERSION);
    expect(data).toEqual(emptySave());
    // .bak 备份 + 原键不删除（旧数据保留，防迁移回退/取证）
    expect(storage.getItem(saveKey('desktop') + '.bak')).toBe(future);
    expect(storage.getItem(saveKey('desktop'))).toBe(future);
  });

  it('parseSave 宽松：非法字段回退默认（meritEquipped 过滤非法 id；v2 新增字段缺省回退）', () => {
    const parsed = parseSave(
      JSON.stringify({ version: 3, codexUnlocked: ['ok', 42], meritEquipped: ['merit_hp', 'bogus'], meritPoints: -5, pureInGame: 'yes', treeState: 'bad', preselectedWeapon: 42 }),
    );
    expect(parsed.codexUnlocked).toEqual(['ok']);
    expect(parsed.meritEquipped).toEqual(['merit_hp']);
    expect(parsed.meritPoints).toBe(0);
    expect(parsed.pureInGame).toBe(false);
    expect(parsed.treeState).toEqual({ unlockedNodeIds: [], purchases: {}, pointsSpent: 0 });
    expect(parsed.preselectedWeapon).toBeNull();
  });

  it('通关记录幂等 + 解锁流查询（E4-S9）', () => {
    const data = emptySave();
    expect(recordMapCleared(data, 'map_graveyard')).toBe(true);
    expect(recordMapCleared(data, 'map_graveyard')).toBe(false); // 幂等
    const status = unlockStatusFromSave(data);
    expect(status.clearedGraveyard).toBe(true);
    expect(status.clearedCathedral).toBe(false);
    expect(status.clearedDen).toBe(false);
    recordMapCleared(data, 'map_cathedral');
    expect(unlockStatusFromSave(data).clearedCathedral).toBe(true);
  });

  it('写失败不抛错（隐私模式/配额）', () => {
    const broken: SaveStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(() => writeSave(broken, emptySave(), 'desktop')).not.toThrow();
    expect(loadSave(broken, 'desktop')).toEqual(emptySave());
  });
});

describe('B1 存档 v2 迁移骨架（EG 裁决：迁移函数先于版本号落地）', () => {
  let storage: ReturnType<typeof makeStorage>;
  beforeEach(() => {
    storage = makeStorage();
  });

  it('版本常量：SAVE_VERSION=3 / 迁移链 v2→v3 / v1 直达链（先迁移后 bump 的落地顺序锚点）', () => {
    expect(SAVE_VERSION).toBe(3);
    expect(SAVE_VERSION_PREVIOUS).toBe(2);
  });

  it('矩阵 A · v1 标准档 → 迁移：逐字段保留 + meritPoints 1:1 + 新字段默认值', () => {
    const v1 = {
      version: 1,
      codexUnlocked: ['codex_enemy_enemy_g1_1', 'codex_boss_boss_1'],
      meritPoints: 57,
      meritEquipped: ['merit_hp', 'merit_dmg'],
      clearedMaps: ['map_graveyard', 'map_cathedral'],
      pureInGame: false,
    };
    const migrated = migrateSaveV1toV2(v1); // B5：v1 → v2 → v3 合成迁移
    expect(migrated.version).toBe(3);
    expect(migrated.codexUnlocked).toEqual(['codex_enemy_enemy_g1_1', 'codex_boss_boss_1']);
    expect(migrated.meritPoints).toBe(57); // 1:1 平移（功绩 → 余辉）
    expect(migrated.meritEquipped).toEqual(['merit_hp', 'merit_dmg']); // 迁移期保留（merit-overlay 兼容）
    expect(migrated.clearedMaps).toEqual(['map_graveyard', 'map_cathedral']);
    expect(migrated.pureInGame).toBe(false);
    // 旧 4 加成折算：装备的 merit_hp/merit_dmg → a_life/a_damage 各 1 层自动点亮（§⑩-11，差额不找零）
    expect(migrated.treeState).toEqual({
      unlockedNodeIds: ['a_life', 'a_damage'],
      purchases: { a_life: 1, a_damage: 1 },
      pointsSpent: 20,
    });
    expect(migrated.preselectedWeapon).toBeNull(); // Q-d 占位（B5 接线）
  });

  it('矩阵 B · v1 空字段档（缺字段）→ 迁移：全部回退默认，不崩溃', () => {
    const migrated = migrateSaveV1toV2({ version: 1 });
    expect(migrated.version).toBe(3);
    expect(migrated.codexUnlocked).toEqual([]);
    expect(migrated.meritPoints).toBe(0);
    expect(migrated.meritEquipped).toEqual([]);
    expect(migrated.clearedMaps).toEqual([]);
    expect(migrated.pureInGame).toBe(false);
    expect(migrated.treeState).toEqual({ unlockedNodeIds: [], purchases: {}, pointsSpent: 0 });
    expect(migrated.preselectedWeapon).toBeNull();
  });

  it('矩阵 A2 · 旧 4 加成折算（§⑩-11）：merit_hp/merit_dmg 装备 → a_life/a_damage 各 1 层自动点亮（差额不找零）', () => {
    const m = migrateSaveV1toV2({ version: 1, meritEquipped: ['merit_hp', 'merit_dmg'] });
    expect(m.treeState.purchases).toEqual({ a_life: 1, a_damage: 1 });
    expect(m.treeState.pointsSpent).toBe(20);
  });

  it('矩阵 B2 · v1 非法字段档 → 迁移：非法过滤（与 v1 parseSave 同宽入口径）', () => {
    const migrated = migrateSaveV1toV2({
      version: 1,
      codexUnlocked: ['ok', 42],
      meritEquipped: ['merit_hp', 'bogus'],
      meritPoints: -5,
      clearedMaps: ['map_den', 'bogus_map'],
      pureInGame: 'yes',
    });
    expect(migrated.codexUnlocked).toEqual(['ok']);
    expect(migrated.meritEquipped).toEqual(['merit_hp']);
    expect(migrated.meritPoints).toBe(0);
    expect(migrated.clearedMaps).toEqual(['map_den']);
    expect(migrated.pureInGame).toBe(false);
  });

  it('矩阵 C · parseSave 内嵌 v1 档 → 走迁移链（version=1 分派到 migrateSaveV1toV2）', () => {
    const migrated = parseSave(JSON.stringify({ version: 1, meritPoints: 30, meritEquipped: ['merit_speed'] }));
    expect(migrated.version).toBe(3);
    expect(migrated.meritPoints).toBe(30);
    expect(migrated.meritEquipped).toEqual(['merit_speed']);
    expect(migrated.treeState.purchases).toEqual({ a_move_speed: 1 }); // 旧加成折算（§⑩-11）
  });

  it('矩阵 D · 未来版本档 → 空存档；旧数据保留不覆盖（原键不删 + .bak）', () => {
    const future = JSON.stringify({ version: 999, codexUnlocked: ['x'], meritPoints: 99 });
    storage.setItem(saveKey('desktop'), future);
    const data = loadSave(storage, 'desktop');
    expect(data).toEqual(emptySave());
    expect(storage.getItem(saveKey('desktop'))).toBe(future); // 不覆盖
    expect(storage.getItem(saveKey('desktop') + '.bak')).toBe(future); // 备份
  });

  it('矩阵 E · 损坏档 → 空存档安全兜底 + .bak（口径延续）', () => {
    storage.setItem(saveKey('desktop'), 'not json {{{');
    const data = loadSave(storage, 'desktop');
    expect(data).toEqual(emptySave());
    expect(storage.getItem(saveKey('desktop') + '.bak')).toBe('not json {{{');
  });

  it('迁移链 · 仅 v1 旧键存在 → loadSave 经旧键回读迁移出 v2 结构；旧键保留', () => {
    const v1 = { version: 1, codexUnlocked: ['codex_enemy_enemy_g1_1'], meritPoints: 42, meritEquipped: [], clearedMaps: ['map_den'], pureInGame: true };
    storage.setItem(saveKeyLegacy('desktop'), JSON.stringify(v1));
    const loaded = loadSave(storage, 'desktop');
    expect(loaded.version).toBe(3);
    expect(loaded.meritPoints).toBe(42);
    expect(loaded.codexUnlocked).toEqual(['codex_enemy_enemy_g1_1']);
    expect(loaded.clearedMaps).toEqual(['map_den']);
    expect(loaded.pureInGame).toBe(true);
    expect(loaded.treeState).toEqual({ unlockedNodeIds: [], purchases: {}, pointsSpent: 0 });
    expect(loaded.preselectedWeapon).toBeNull();
    // 旧键数据保留（只读迁移，不覆盖不删除）
    expect(storage.getItem(saveKeyLegacy('desktop'))).toBe(JSON.stringify(v1));
  });

  it('迁移链 · v2 键优先：两键并存时只读 v2（v1 旧键忽略）', () => {
    storage.setItem(saveKeyLegacy('desktop'), JSON.stringify({ version: 1, meritPoints: 1 }));
    storage.setItem(saveKey('desktop'), JSON.stringify({ ...emptySave(), meritPoints: 200 }));
    const loaded = loadSave(storage, 'desktop');
    expect(loaded.meritPoints).toBe(200);
  });

  it('迁移链 · 损坏 v1 旧档 → 安全兜底空存档（不崩溃）', () => {
    storage.setItem(saveKeyLegacy('desktop'), 'broken!!!');
    const loaded = loadSave(storage, 'desktop');
    expect(loaded).toEqual(emptySave());
  });

  it('迁移链 · 全空 v1 旧档（恰为 v1 emptySave）→ 迁移出 v2 空存档，不误判损坏', () => {
    storage.setItem(saveKeyLegacy('desktop'), JSON.stringify({ version: 1, codexUnlocked: [], meritPoints: 0, meritEquipped: [], clearedMaps: [], pureInGame: false }));
    const loaded = loadSave(storage, 'desktop');
    expect(loaded).toEqual(emptySave());
  });

  it('迁移链 · v2 占位档（B3）→ v3：merit 折算 + purchases 透传', () => {
    storage.setItem(saveKeyLegacy('desktop'), JSON.stringify({ version: 2, meritPoints: 50, meritEquipped: ['merit_magnet'], treeState: { unlockedNodeIds: [], pointsSpent: 0 }, preselectedWeapon: 'wpn_b_1' }));
    const loaded = loadSave(storage, 'desktop');
    expect(loaded.version).toBe(3);
    expect(loaded.treeState.purchases).toEqual({ a_magnet: 1 });
    expect(loaded.preselectedWeapon).toBe('wpn_b_1');
  });

  it('多端独立迁移：desktop/mobile 旧键互不串档', () => {
    storage.setItem(saveKeyLegacy('desktop'), JSON.stringify({ version: 1, meritPoints: 11 }));
    storage.setItem(saveKeyLegacy('mobile'), JSON.stringify({ version: 1, meritPoints: 22 }));
    expect(loadSave(storage, 'desktop').meritPoints).toBe(11);
    expect(loadSave(storage, 'mobile').meritPoints).toBe(22);
  });

  it('roundtrip：迁移结果可写回 v2 键并读回一致', () => {
    storage.setItem(saveKeyLegacy('desktop'), JSON.stringify({ version: 1, meritPoints: 66, meritEquipped: ['merit_magnet'] }));
    const migrated = loadSave(storage, 'desktop');
    writeSave(storage, migrated, 'desktop');
    const reloaded = loadSave(storage, 'desktop');
    expect(reloaded).toEqual(migrated);
    expect(reloaded.meritPoints).toBe(66);
  });
});
