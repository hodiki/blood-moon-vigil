import { describe, it, expect, afterEach } from 'vitest';
import {
  DEFAULT_HERO,
  DEFAULT_MAP,
  getSelectedHero,
  getSelectedMap,
  setSelectedHero,
  setSelectedMap,
  resetSessionSelection,
  canSelectHero,
  canSelectMap,
  selectHeroSafely,
  selectMapSafely,
} from '@/config/session-selection';
import type { HeroId, MapId } from '@/config/balance';

describe('session-selection（E4-S1 角色 / E4-S9 地图 会话选择）', () => {
  afterEach(() => resetSessionSelection());

  it('默认：守夜人 + 墓地（gdd-codex §3.5 默认解锁）', () => {
    expect(getSelectedHero()).toBe('hero_edmund');
    expect(getSelectedMap()).toBe('map_graveyard');
    expect(DEFAULT_HERO).toBe('hero_edmund');
    expect(DEFAULT_MAP).toBe('map_graveyard');
  });

  it('set/get 读写；scene.restart 保留（会话级不自动重置）', () => {
    setSelectedHero('hero_cassandra');
    setSelectedMap('map_cathedral');
    expect(getSelectedHero()).toBe('hero_cassandra');
    expect(getSelectedMap()).toBe('map_cathedral');
    resetSessionSelection();
    expect(getSelectedHero()).toBe('hero_edmund');
    expect(getSelectedMap()).toBe('map_graveyard');
  });

  it('QA-FIX-3 追加① 0.2.x 全开放：四角色任意解锁状态一律可选（门禁机制保留给未来新增）', () => {
    const none = { clearedGraveyard: false, clearedCathedral: false, clearedDen: false };
    const all = { clearedGraveyard: true, clearedCathedral: true, clearedDen: true };
    const heroes: HeroId[] = ['hero_edmund', 'hero_cassandra', 'hero_violet', 'hero_galvan'];
    for (const hero of heroes) {
      expect(canSelectHero(hero, none)).toBe(true);
      expect(canSelectHero(hero, all)).toBe(true);
    }
  });

  it('QA-FIX-3 追加① 0.2.x 全开放：三图任意解锁状态一律可选', () => {
    const none = { clearedGraveyard: false, clearedCathedral: false, clearedDen: false };
    const maps: MapId[] = ['map_graveyard', 'map_cathedral', 'map_den'];
    for (const map of maps) {
      expect(canSelectMap(map, none)).toBe(true);
      expect(canSelectMap(map, { clearedGraveyard: true, clearedCathedral: true, clearedDen: true })).toBe(true);
    }
  });

  it('API 形状保留：unlock 参数签名不变（未来新增角色/地图按 unlock 记录恢复门禁）', () => {
    // 编译期保证：canSelectHero/canSelectMap 仍接受 { clearedGraveyard, clearedCathedral, clearedDen }
    const unlock = { clearedGraveyard: false, clearedCathedral: false, clearedDen: false };
    expect(typeof canSelectHero('hero_edmund', unlock)).toBe('boolean');
    expect(typeof canSelectMap('map_graveyard', unlock)).toBe('boolean');
  });

  it('selectSafely 兜底（API 保留）：已知 id 全开放下不回退；未知 id 防御回退默认', () => {
    const none = { clearedGraveyard: false, clearedCathedral: false, clearedDen: false };
    // 全开放：任意已知角色/地图直接生效
    expect(selectHeroSafely('hero_galvan', none)).toBe('hero_galvan');
    expect(getSelectedHero()).toBe('hero_galvan');
    expect(selectMapSafely('map_den', none)).toBe('map_den');
    expect(getSelectedMap()).toBe('map_den');
    // 防御分支（当前联合类型下不可达，保留防数据层/UI 越权）
    expect(selectHeroSafely('hero_not_exist' as HeroId, none)).toBe('hero_edmund');
    expect(selectMapSafely('bad_map' as MapId, none)).toBe('map_graveyard');
  });
});

// 类型守卫：确保 4 角色 / 3 地图均进入联合类型（编译期保证）
const _heroKeys: HeroId[] = ['hero_edmund', 'hero_cassandra', 'hero_violet', 'hero_galvan'];
const _mapKeys: MapId[] = ['map_graveyard', 'map_cathedral', 'map_den'];
void _heroKeys;
void _mapKeys;
