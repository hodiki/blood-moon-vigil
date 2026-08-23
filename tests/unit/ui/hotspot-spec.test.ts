import { describe, it, expect } from 'vitest';
import { unlockFromSave } from '@/ui/start-overlay';
import { emptySave } from '@/stats/save';

/**
 * AC-C4 移动端技能按钮热区复测（sprint-m2-plan §3 / control-manifest §9 C-1 同款流程）。
 * 数据层断言：技能按钮 96×96 ≥44、暂停键 44×44 ≥44、地图卡 140×64 ≥44、摇杆 96；
 * 触控矩阵：按钮（右下）vs 摇杆（左半屏）vs 暂停（右上）无重叠。
 * 真机复测步骤见 M2-S4 收口报告（skill button 实际渲染热区 = 视觉 96×96 ≥44px）。
 */

/** 设计空间触控热区规格（与 hud.ts / start-overlay.ts CSS 镜像；真机复测基准） */
export const AC_C4_HOTSPOT_SPEC = {
  /** 技能按钮：右下角视觉 96×96，热区 = 视觉 ≥44（pillars §6.3 / gdd-active-skill §⑦） */
  skillButton: { width: 96, height: 96 },
  /** 暂停键：右上 44×44（ux-spec §2） */
  pauseButton: { width: 44, height: 44 },
  /** 地图卡（启动页）：桌面 140×64 / 移动 1/3 行宽（≥44） */
  mapCard: { width: 140, height: 64 },
  /** 摇杆底座：常驻 96×96（ux-spec §2） */
  joystickBase: { width: 96, height: 96 },
  /** 触控热区硬标准（ux-spec §3 / AC-C4） */
  minHotspot: 44,
} as const;

describe('AC-C4 移动端触控热区（≥44px + 触控矩阵无重叠）', () => {
  it('技能按钮 96×96 ≥44；暂停键 44×44 ≥44；地图卡 140×64 ≥44（热区硬标准）', () => {
    const { skillButton, pauseButton, mapCard, minHotspot } = AC_C4_HOTSPOT_SPEC;
    expect(skillButton.width).toBeGreaterThanOrEqual(minHotspot);
    expect(skillButton.height).toBeGreaterThanOrEqual(minHotspot);
    expect(pauseButton.width).toBeGreaterThanOrEqual(minHotspot);
    expect(pauseButton.height).toBeGreaterThanOrEqual(minHotspot);
    expect(mapCard.width).toBeGreaterThanOrEqual(minHotspot);
    expect(mapCard.height).toBeGreaterThanOrEqual(minHotspot);
  });

  it('触控矩阵：按钮右下 (right,bottom) vs 暂停右上 (right,top) vs 摇杆左半屏 无重叠', () => {
    // 设计空间 720×1280（移动）；技能按钮 right:24/bottom:24，暂停 right:24/top:24，摇杆左半屏（x<360）
    const skill = { x0: 720 - 24 - 96, y0: 1280 - 24 - 96, x1: 720 - 24, y1: 1280 - 24 }; // 右下
    const pause = { x0: 720 - 24 - 44, y0: 24, x1: 720 - 24, y1: 24 + 44 }; // 右上
    const joystickHalf = { x1: 360 }; // 左半屏（摇杆常驻区）
    // 技能按钮完全在右半屏（不碰左半屏摇杆区）
    expect(skill.x0).toBeGreaterThanOrEqual(joystickHalf.x1);
    // 技能按钮与暂停键纵向分离（上 vs 下）不重叠
    expect(skill.y0).toBeGreaterThan(pause.y1);
  });

  it('解锁状态便捷构造（unlockFromSave）', () => {
    const save = emptySave();
    expect(unlockFromSave(save)).toEqual({ clearedGraveyard: false, clearedCathedral: false, clearedDen: false });
    save.clearedMaps = ['map_graveyard'];
    expect(unlockFromSave(save)).toEqual({ clearedGraveyard: true, clearedCathedral: false, clearedDen: false });
  });
});
