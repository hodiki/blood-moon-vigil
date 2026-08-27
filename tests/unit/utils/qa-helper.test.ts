import { describe, it, expect, beforeEach } from 'vitest';
import { installQaHelper } from '@/utils/qa-helper';
import { emptySave, loadSave, unlockStatusFromSave, type SaveStorage } from '@/stats/save';
import { getSelectedHero, getSelectedMap, resetSessionSelection } from '@/config/session-selection';

/**
 * QA-FIX-2 B-3：`?qa=1` 控制台测试辅助（window.__BMV_QA）单测。
 * 安装层在 main.ts（URL 含 qa=1 才调用，不带参数零暴露——生产行为由 URL 门禁保证，
 * 与 smoke 参数同款做法）。本文件用 fake storage 直测 installQaHelper 三个方法：
 * 全部走 save.ts / session-selection.ts 正式 API。
 */

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

describe('QA-FIX-2 B ?qa=1 控制台测试辅助', () => {
  let storage: ReturnType<typeof makeStorage>;
  beforeEach(() => {
    storage = makeStorage();
    resetSessionSelection();
  });

  it('① unlockAll：三图 cleared 标记全置 true 并持久化（正式 save API；刷新后仍可读回全解锁）', () => {
    const qa = installQaHelper(storage, 'desktop');
    const saved = qa.unlockAll();
    expect(saved.clearedMaps).toEqual(['map_graveyard', 'map_cathedral', 'map_den']);
    // 持久化：重新 loadSave（刷新等价路径）读回的仍是全解锁
    expect(unlockStatusFromSave(loadSave(storage, 'desktop'))).toEqual({
      clearedGraveyard: true,
      clearedCathedral: true,
      clearedDen: true,
    });
  });

  it('② status/setHero/setMap：0.2.x 全开放——空存档下切任意角色/地图直接生效（门禁休眠）', () => {
    const qa = installQaHelper(storage, 'desktop');
    expect(qa.setHero('hero_cassandra')).toBe('hero_cassandra'); // 全开放，无需解锁
    expect(getSelectedHero()).toBe('hero_cassandra');
    const snap = qa.status();
    expect(snap.hero).toBe('hero_cassandra');
    expect(snap.map).toBe('map_graveyard');
    expect(snap.unlocks).toEqual({ clearedGraveyard: false, clearedCathedral: false, clearedDen: false });
  });

  it('③ unlockAll 后 setHero/setMap 免刷新生效；未知 id 不动当前选择', () => {
    const qa = installQaHelper(storage, 'desktop');
    qa.unlockAll();
    expect(qa.setHero('hero_violet')).toBe('hero_violet'); // 全解锁后可选修女
    expect(qa.setMap('map_den')).toBe('map_den');
    expect(qa.setHero('hero_not_exist')).toBe('hero_violet'); // 未知 id 保持不变
    expect(qa.setMap('bad_map')).toBe('map_den');
    expect(qa.status()).toEqual({
      hero: 'hero_violet',
      map: 'map_den',
      unlocks: { clearedGraveyard: true, clearedCathedral: true, clearedDen: true },
    });
    expect(getSelectedMap()).toBe('map_den');
  });

  it('④ 纯局内模式兜底语义不破坏：unlockAll 幂等、空存档场景不抛错', () => {
    const qa = installQaHelper(storage, 'desktop');
    qa.unlockAll();
    qa.unlockAll(); // recordMapCleared 幂等 → 不重复追加
    expect(emptySave().clearedMaps).toEqual([]);
    expect(loadSave(storage, 'desktop').clearedMaps.length).toBe(3);
  });
});
