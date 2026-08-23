import { describe, it, expect, beforeEach } from 'vitest';
import {
  emptySave,
  parseSave,
  loadSave,
  writeSave,
  saveKey,
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

  it('版本不符 → 回退空存档 + 备份', () => {
    storage.setItem(saveKey('desktop'), JSON.stringify({ version: 999, codexUnlocked: [] }));
    const data = loadSave(storage, 'desktop');
    expect(data.version).toBe(1);
    expect(storage.getItem(saveKey('desktop') + '.bak')).toBeTruthy();
  });

  it('parseSave 宽松：非法字段回退默认（meritEquipped 过滤非法 id）', () => {
    const parsed = parseSave(
      JSON.stringify({ version: 1, codexUnlocked: ['ok', 42], meritEquipped: ['merit_hp', 'bogus'], meritPoints: -5, pureInGame: 'yes' }),
    );
    expect(parsed.codexUnlocked).toEqual(['ok']);
    expect(parsed.meritEquipped).toEqual(['merit_hp']);
    expect(parsed.meritPoints).toBe(0);
    expect(parsed.pureInGame).toBe(false);
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
