import { describe, it, expect, beforeEach } from 'vitest';
import {
  HERO_CARD_ORDER,
  buildHeroCardStates,
} from '@/ui/start-overlay';
import { emptySave, unlockStatusFromSave, type SaveData } from '@/stats/save';
import { HEROES } from '@/config/balance';
import { getSelectedHero, setSelectedHero, selectHeroSafely, resetSessionSelection } from '@/config/session-selection';

/**
 * QA-FIX-2 A-2：启动页角色选择栏逻辑态单测（E4-S1 遗漏 UI 补齐）。
 * QA-FIX-3 追加①：0.2.x 当前阵容全开放——四角色/三图一开始即可自由选择：
 * - 任意解锁状态下四卡全部可选（locked 恒 false，灰剪影/🔒/解锁文案不再出现）；
 * - desc 一律展示配置副标题位（主动技能名），锁定文案仅保留 dormant 分支给未来新增；
 * - 点击语义（selectHeroSafely）：任意已知角色直接生效。
 * 解锁门禁数据层（save.ts unlockStatusFromSave）保留，供未来新增内容复用。
 */

const ALL_LOCKED_UNLOCK = { clearedGraveyard: false, clearedCathedral: false, clearedDen: false };
const GRAVEYARD_CLEARED = { clearedGraveyard: true, clearedCathedral: false, clearedDen: false };
const ALL_CLEARED = { clearedGraveyard: true, clearedCathedral: true, clearedDen: true };

describe('QA-FIX-2 A 启动页角色选择栏（卡片逻辑态；QA-FIX-3 追加① 全开放）', () => {
  beforeEach(() => {
    resetSessionSelection();
  });

  it('① 0.2.x 全开放：任意解锁状态（含全未通关）四卡全部可选', () => {
    const states = buildHeroCardStates(ALL_LOCKED_UNLOCK);
    expect(states.map((s) => s.id)).toEqual(HERO_CARD_ORDER);
    expect(states.map((s) => s.locked)).toEqual([false, false, false, false]);
    expect(buildHeroCardStates(GRAVEYARD_CLEARED).map((s) => s.locked)).toEqual([false, false, false, false]);
    expect(buildHeroCardStates(ALL_CLEARED).map((s) => s.locked)).toEqual([false, false, false, false]);
  });

  it('② 锁定文案不再出现：desc 一律为配置副标题位（主动技能名）', () => {
    const states = buildHeroCardStates(ALL_LOCKED_UNLOCK);
    for (const s of states) {
      expect(s.desc).toBe(HEROES[s.id].activeSkillName);
      expect(s.desc).not.toContain('解锁');
    }
  });

  it('③ powerTag 标识齐全且为色板内 token 色（HALLOWED=圣辉/SILVER=银器/BEAST=兽血）', () => {
    const states = buildHeroCardStates(ALL_CLEARED);
    for (const s of states) {
      expect(s.powerTagLabel.length).toBeGreaterThan(0);
      expect(s.powerTagColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
      // 标签取自 NP 拼写表：与 HEROES 配置的 powerTag 一致
      expect(['圣辉', '银器', '兽血', '血术', '月光']).toContain(s.powerTagLabel);
    }
    expect(states.find((s) => s.id === 'hero_edmund')!.name).toBe(HEROES.hero_edmund.name);
    expect(states.find((s) => s.id === 'hero_cassandra')!.name).toBe(HEROES.hero_cassandra.name);
  });

  it('④ 点击任意角色卡直接生效（selectHeroSafely 全开放；API 兜底保留）', () => {
    expect(selectHeroSafely('hero_cassandra', ALL_LOCKED_UNLOCK)).toBe('hero_cassandra');
    expect(getSelectedHero()).toBe('hero_cassandra');
    expect(selectHeroSafely('hero_galvan', ALL_CLEARED)).toBe('hero_galvan');
    expect(getSelectedHero()).toBe('hero_galvan');
    // 默认选中态数据源仍为 getSelectedHero
    setSelectedHero('hero_edmund');
    expect(getSelectedHero()).toBe('hero_edmund');
  });

  it('⑤ 解锁数据源兼容：unlockStatusFromSave 空存档语义不变（未来门禁复用）', () => {
    const save: SaveData = emptySave();
    expect(unlockStatusFromSave(save)).toEqual(ALL_LOCKED_UNLOCK);
  });
});
