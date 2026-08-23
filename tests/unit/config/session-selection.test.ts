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

  it('角色解锁流：守夜人默认；血猎手需通关墓地；修女需通关教堂；狼裔需击败芬里厄（通关狼穴）', () => {
    const none = { clearedGraveyard: false, clearedCathedral: false, clearedDen: false };
    const g1 = { clearedGraveyard: true, clearedCathedral: false, clearedDen: false };
    const g2 = { clearedGraveyard: true, clearedCathedral: true, clearedDen: false };
    const g3 = { clearedGraveyard: true, clearedCathedral: true, clearedDen: true };
    expect(canSelectHero('hero_edmund', none)).toBe(true);
    expect(canSelectHero('hero_cassandra', none)).toBe(false);
    expect(canSelectHero('hero_cassandra', g1)).toBe(true);
    expect(canSelectHero('hero_violet', g1)).toBe(false);
    expect(canSelectHero('hero_violet', g2)).toBe(true);
    expect(canSelectHero('hero_galvan', g2)).toBe(false);
    expect(canSelectHero('hero_galvan', g3)).toBe(true);
  });

  it('地图解锁流：墓地默认；教堂需通关墓地；狼穴需通关教堂', () => {
    const none = { clearedGraveyard: false, clearedCathedral: false, clearedDen: false };
    const g1 = { clearedGraveyard: true, clearedCathedral: false, clearedDen: false };
    const g2 = { clearedGraveyard: true, clearedCathedral: true, clearedDen: false };
    expect(canSelectMap('map_graveyard', none)).toBe(true);
    expect(canSelectMap('map_cathedral', none)).toBe(false);
    expect(canSelectMap('map_cathedral', g1)).toBe(true);
    expect(canSelectMap('map_den', g1)).toBe(false);
    expect(canSelectMap('map_den', g2)).toBe(true);
  });

  it('selectSafely 兜底：非法选择回退默认（防数据层/UI 越权）', () => {
    const none = { clearedGraveyard: false, clearedCathedral: false, clearedDen: false };
    expect(selectHeroSafely('hero_galvan', none)).toBe('hero_edmund');
    expect(getSelectedHero()).toBe('hero_edmund');
    expect(selectMapSafely('map_den', none)).toBe('map_graveyard');
    expect(getSelectedMap()).toBe('map_graveyard');
    // 合法选择不回退
    const g3 = { clearedGraveyard: true, clearedCathedral: true, clearedDen: true };
    expect(selectHeroSafely('hero_galvan', g3)).toBe('hero_galvan');
    expect(selectMapSafely('map_den', g3)).toBe('map_den');
  });
});

// 类型守卫：确保 4 角色 / 3 地图均进入联合类型（编译期保证）
const _heroKeys: HeroId[] = ['hero_edmund', 'hero_cassandra', 'hero_violet', 'hero_galvan'];
const _mapKeys: MapId[] = ['map_graveyard', 'map_cathedral', 'map_den'];
void _heroKeys;
void _mapKeys;
