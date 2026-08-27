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
 * DOM 渲染由 createStartOverlay 消费 buildHeroCardStates（纯函数共用），本文件断言：
 * - 默认只有守夜人可选，其余三卡锁定文案与 canSelectHero 门禁一一匹配；
 * - 全解锁后四卡可选；powerTag 标识齐全；
 * - 点击语义（selectHeroSafely）：选中已解锁卡生效、点击未解锁卡不改变当前选择。
 */

const ALL_LOCKED_UNLOCK = { clearedGraveyard: false, clearedCathedral: false, clearedDen: false };
const GRAVEYARD_CLEARED = { clearedGraveyard: true, clearedCathedral: false, clearedDen: false };
const ALL_CLEARED = { clearedGraveyard: true, clearedCathedral: true, clearedDen: true };

describe('QA-FIX-2 A 启动页角色选择栏（卡片逻辑态）', () => {
  beforeEach(() => {
    resetSessionSelection();
  });

  it('① 默认解锁状态：仅 hero_edmund 可选，其余三卡 locked', () => {
    const states = buildHeroCardStates(ALL_LOCKED_UNLOCK);
    expect(states.map((s) => s.id)).toEqual(HERO_CARD_ORDER);
    expect(states.map((s) => s.locked)).toEqual([false, true, true, true]);
  });

  it('② 锁定文案与门禁匹配：cassandra/violet/galvan 分别对应通关地图 1/2/3 解锁', () => {
    const states = buildHeroCardStates(ALL_LOCKED_UNLOCK);
    expect(states.find((s) => s.id === 'hero_cassandra')!.desc).toBe('通关地图 1 解锁');
    expect(states.find((s) => s.id === 'hero_violet')!.desc).toBe('通关地图 2 解锁');
    expect(states.find((s) => s.id === 'hero_galvan')!.desc).toBe('通关地图 3 解锁');
  });

  it('③ 门禁逐级递进：通关墓地只解 cassandra；全解锁四卡全开', () => {
    expect(buildHeroCardStates(GRAVEYARD_CLEARED).map((s) => s.locked)).toEqual([false, false, true, true]);
    expect(buildHeroCardStates(ALL_CLEARED).map((s) => s.locked)).toEqual([false, false, false, false]);
  });

  it('④ powerTag 标识齐全且为色板内 token 色（HALLOWED=圣辉/SILVER=银器/BEAST=兽血）', () => {
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

  it('⑤ 未锁定卡 desc 展示配置副标题位（主动技能名），如 edmund 提灯闪耀', () => {
    const states = buildHeroCardStates(ALL_CLEARED);
    expect(states.find((s) => s.id === 'hero_edmund')!.desc).toBe(HEROES.hero_edmund.activeSkillName);
  });

  it('⑥ 点击未解锁卡不改变 selectedHero（selectHeroSafely 非法回退默认并保持锁定观感）', () => {
    setSelectedHero('hero_edmund'); // 默认守夜人已选中
    const applied = selectHeroSafely('hero_cassandra', ALL_LOCKED_UNLOCK); // 锁定卡点击
    expect(applied).toBe('hero_edmund');
    expect(getSelectedHero()).toBe('hero_edmund');
  });

  it('⑦ 选中描边态数据源：点击已解锁卡 → selectedHero 生效（DOM 高亮消费 getSelectedHero）', () => {
    const applied = selectHeroSafely('hero_galvan', ALL_CLEARED);
    expect(applied).toBe('hero_galvan');
    expect(getSelectedHero()).toBe('hero_galvan');
  });

  it('⑧ 解锁数据源联动：unlockStatusFromSave 空存档 → 三门禁全关（save.ts 正式 API 路径）', () => {
    const save: SaveData = emptySave();
    expect(unlockStatusFromSave(save)).toEqual(ALL_LOCKED_UNLOCK);
  });
});
