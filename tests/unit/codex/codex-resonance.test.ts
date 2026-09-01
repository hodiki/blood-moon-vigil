/**
 * P2-4 · 图鉴共鸣形态条目 + evo 退役区（NW-5 裁决 / gdd-resonance §3.5-2 验收判据 5）
 *
 * - 共鸣形态条目 8 条：内容 ID 沿用共鸣后通武（codex_reso_<commonWeaponId>）；
 *   解锁口径 = 共鸣达成（ResonanceState 提交 → recordResonance，幂等）。
 * - evo_* 条目退役区：数据保留不删（isRetiredCategory('evo')，UI 分组标注「已退役」）。
 * - 共鸣形态无独立立绘帧（frame-map v1.3）→ codexIconFrame 返回 null（占位图 + 徽记）。
 */

import { describe, it, expect } from 'vitest';
import {
  CODEX_ENTRIES,
  CodexTracker,
  codexEntryById,
  isRetiredCategory,
  resonanceConditionText,
  resonanceEntryId,
  RESONANCE_ENTRY_PREFIX,
} from '@/codex/codex';
import { RESONANCE_PAIRS } from '@/config/balance';
import { codexIconFrame } from '@/codex/codex-icon-frame';
import {
  CODEX_TABS,
  codexTabCounts,
  resonanceEmblemFrame,
} from '@/ui/codex-overlay';

describe('P2-4 共鸣形态条目（数据层）', () => {
  it('8 条共鸣条目：entryId 沿用共鸣后通武内容 ID，名称/解锁口径对齐 RESONANCE_PAIRS', () => {
    for (const pair of RESONANCE_PAIRS) {
      const entry = codexEntryById(resonanceEntryId(pair));
      expect(entry, pair.id).toBeTruthy();
      expect(entry!.category).toBe('resonance');
      expect(entry!.name).toBe(pair.name);
      expect(entry!.unlock).toBe('resonance');
      expect(entry!.entryId).toBe(`${RESONANCE_ENTRY_PREFIX}${pair.commonWeaponId}`);
    }
    expect(CODEX_ENTRIES.filter((e) => e.category === 'resonance')).toHaveLength(8);
  });

  it('解锁条件文案 = 配对专武名 × 共鸣钥名（R-1：破旧提灯 × 圣辉坠饰 / R-6：圣辉十字 × 兽骨图腾）', () => {
    const r1 = RESONANCE_PAIRS.find((p) => p.id === 'R1')!;
    const r6 = RESONANCE_PAIRS.find((p) => p.id === 'R6')!;
    expect(resonanceConditionText(r1)).toBe('达成共鸣：破旧提灯 × 圣辉坠饰');
    expect(resonanceConditionText(r6)).toBe('达成共鸣：圣辉十字 × 兽骨图腾');
  });

  it('CodexTracker.recordResonance：共鸣达成解锁幂等（重开/重复提交不重复计数）', () => {
    const tracker = new CodexTracker();
    expect(tracker.recordResonance('wpn_b_1')).toBe(true); // R-1 守夜环灯
    expect(tracker.recordResonance('wpn_b_1')).toBe(false); // 幂等
    expect(tracker.recordResonance('wpn_c_3')).toBe(true); // R-6 圣火十诫
    expect(tracker.isUnlocked('codex_reso_wpn_b_1')).toBe(true);
    expect(tracker.isUnlocked('codex_reso_wpn_c_3')).toBe(true);
    expect(tracker.isUnlocked('codex_reso_wpn_a_2')).toBe(false);
    expect(tracker.unlockCount()).toBe(2);
  });

  it('共存档口径：初始解锁集恢复后 recordResonance 幂等（存档快照含共鸣条目）', () => {
    const tracker = new CodexTracker(['codex_reso_wpn_b_1']);
    expect(tracker.recordResonance('wpn_b_1')).toBe(false);
  });
});

describe('P2-4 evo 退役区（NW-5：数据保留不删，UI 分组标注已退役）', () => {
  it('isRetiredCategory：仅 evo 退役；数据层 7 条 evo_* 条目原样保留', () => {
    expect(isRetiredCategory('evo')).toBe(true);
    expect(isRetiredCategory('hero')).toBe(false);
    expect(isRetiredCategory('resonance')).toBe(false);
    expect(CODEX_ENTRIES.filter((e) => e.category === 'evo')).toHaveLength(7);
    expect(codexEntryById('codex_evo_evo_packleader')).toBeTruthy(); // 兽骨图腾旧进化目标仍在档
  });
});

describe('P2-4 共鸣形态 UI（页签/徽记/占位图）', () => {
  it('页签含「共鸣」；分项计数含 resonance 8', () => {
    expect(CODEX_TABS.map((t) => t.category)).toContain('resonance');
    expect(codexTabCounts().resonance).toBe(8);
  });

  it('共鸣形态无独立立绘帧：codexIconFrame 返回 null（程序化占位图兜底）', () => {
    const pair = RESONANCE_PAIRS[0]!;
    const entry = codexEntryById(resonanceEntryId(pair))!;
    expect(codexIconFrame(entry)).toBeNull();
  });

  it('配对专武徽记帧（frame-map §5A.3）：xw_lantern → exw-emblem-lantern；非共鸣条目 null', () => {
    const r1 = RESONANCE_PAIRS.find((p) => p.id === 'R1')!;
    const r6 = RESONANCE_PAIRS.find((p) => p.id === 'R6')!;
    expect(resonanceEmblemFrame(codexEntryById(resonanceEntryId(r1))!)).toBe('exw-emblem-lantern');
    expect(resonanceEmblemFrame(codexEntryById(resonanceEntryId(r6))!)).toBe('exw-emblem-cross');
    expect(resonanceEmblemFrame(codexEntryById('codex_wpn_wpn_a_1')!)).toBeNull();
  });
});
