import { describe, it, expect, beforeEach } from 'vitest';
import {
  HERO_CARD_ORDER,
  MAP_CARD_ORDER,
  HERO_CHIP_FRAMES,
  HERO_CHIP_NATIVE_PX,
  HERO_CHIP_DISPLAY_PX,
  DEFAULT_HERO_PRESELECT,
  buildHeroCardStates,
  buildMapCardStates,
  nextStartStep,
  prevStartStep,
  canConfirmHeroPreselect,
  heroChipIntegerScale,
  heroSelectPlateSrc,
} from '@/ui/start-overlay';
import { PALETTE } from '@/config/balance';
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

  it('⑥ 入口三屏步进：首页 → 选人 → 选图，Esc 原路返回', () => {
    expect(nextStartStep('title')).toBe('hero');
    expect(nextStartStep('hero')).toBe('map');
    expect(nextStartStep('map')).toBe('map');
    expect(prevStartStep('map')).toBe('hero');
    expect(prevStartStep('hero')).toBe('title');
    expect(prevStartStep('title')).toBe('title');
  });
});

describe('入口地图卡玩家语言（ui-redesign-handoff v1.3 §1.4）', () => {
  it('三图叙事名齐全，不含内部 id / 像素尺寸', () => {
    const states = buildMapCardStates(ALL_LOCKED_UNLOCK);
    expect(states.map((s) => s.id)).toEqual([...MAP_CARD_ORDER]);
    expect(states.map((s) => s.name)).toEqual(['月下墓地', '血教堂', '狼穴']);
    expect(states.map((s) => s.threat)).toEqual(['血月尊者', '血主教·尼禄', '狼王·芬里厄']);
    for (const s of states) {
      expect(s.node.length).toBeGreaterThan(0);
      expect(`${s.node}${s.threat}${s.blurb}`).not.toMatch(/boss_\d|×\d{3,}/);
    }
  });

  it('圣辉标签在入口改走余辉金（灯下哥特选中语义）', () => {
    const edmund = buildHeroCardStates(ALL_CLEARED).find((s) => s.id === 'hero_edmund')!;
    expect(edmund.powerTagColor).toBe(PALETTE.amber);
  });
});

describe('选人页：插画底 + 128 芯片预选与确认', () => {
  it('默认预选艾德蒙；芯片帧沿用正式战斗待机', () => {
    expect(DEFAULT_HERO_PRESELECT).toBe('hero_edmund');
    expect(HERO_CHIP_FRAMES).toEqual({
      hero_edmund: 'player',
      hero_cassandra: 'hero-cassandra',
      hero_violet: 'hero-violet',
      hero_galvan: 'hero-galvan',
    });
    expect(HERO_CHIP_DISPLAY_PX).toBe(128);
    expect(heroSelectPlateSrc('hero_edmund')).toBe('./ui-menu/hero-select-hero_edmund.png');
  });

  it('芯片按整数倍放大：64→128（2×），128→128（1×）；160 无法整倍落入 128', () => {
    expect(HERO_CHIP_NATIVE_PX.hero_edmund).toBe(64);
    expect(heroChipIntegerScale('hero_edmund')).toBe(2);
    expect(HERO_CHIP_NATIVE_PX.hero_cassandra).toBe(128);
    expect(heroChipIntegerScale('hero_cassandra')).toBe(1);
    expect(HERO_CHIP_NATIVE_PX.hero_violet).toBe(128);
    expect(heroChipIntegerScale('hero_violet')).toBe(1);
    expect(HERO_CHIP_NATIVE_PX.hero_galvan).toBe(160);
    expect(heroChipIntegerScale('hero_galvan')).toBe(1);
  });

  it('锁定角色可预览，但不能确认；未锁定可确认', () => {
    expect(canConfirmHeroPreselect({ locked: true })).toBe(false);
    expect(canConfirmHeroPreselect({ locked: false })).toBe(true);
  });

  it('芯片点击不得写入会话选择：预选与确认分离（确认才调用 selectHeroSafely）', () => {
    resetSessionSelection();
    expect(getSelectedHero()).toBe('hero_edmund');
    // 预选只是 UI 态：本文件不实例化 DOM，这里断言数据层在未确认前保持默认
    expect(getSelectedHero()).toBe(DEFAULT_HERO_PRESELECT);
    expect(selectHeroSafely('hero_cassandra', ALL_LOCKED_UNLOCK)).toBe('hero_cassandra');
    expect(getSelectedHero()).toBe('hero_cassandra');
  });
});
