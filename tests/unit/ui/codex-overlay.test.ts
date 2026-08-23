import { describe, it, expect } from 'vitest';
import { CODEX_ENTRIES, MOON_AVATAR_ENTRY_ID } from '@/codex/codex';
import {
  codexCardState,
  CODEX_TABS,
  codexTabCounts,
  codexUnlockedCount,
  codexTotalUnlocked,
  codexUnlockedSet,
  codexConditionText,
} from '@/ui/codex-overlay';
import { emptySave } from '@/stats/save';

describe('图鉴「守夜日志」UI 纯逻辑（codex-ui-spec v1.0）', () => {
  it('6 页签 + 计数徽章：角色 4 / 敌人 15 / Boss 4 / 武器 14 / 超武 7 / 事件 6 = 50', () => {
    expect(CODEX_TABS.map((t) => t.category)).toEqual(['hero', 'enemy', 'boss', 'weapon', 'evo', 'event']);
    const counts = codexTabCounts();
    expect(counts.hero).toBe(4);
    expect(counts.enemy).toBe(15);
    expect(counts.boss).toBe(4);
    expect(counts.weapon).toBe(14);
    expect(counts.evo).toBe(7);
    expect(counts.event).toBe(6);
    expect(CODEX_ENTRIES.length).toBe(50);
  });

  it('三态卡片（spec §4）：解锁 / 锁定剪影 + ？ / 血月化身隐藏？？？保密', () => {
    const unlocked = new Set(['codex_hero_hero_edmund', MOON_AVATAR_ENTRY_ID]);
    // 解锁态
    expect(codexCardState(CODEX_ENTRIES.find((e) => e.entryId === 'codex_hero_hero_edmund')!, unlocked)).toBe('unlocked');
    // 锁定态
    expect(codexCardState(CODEX_ENTRIES.find((e) => e.entryId === 'codex_enemy_enemy_g1_1')!, unlocked)).toBe('locked');
    // 血月化身：未解锁 → hidden（保密？？？）；已解锁 → unlocked
    const avatar = CODEX_ENTRIES.find((e) => e.entryId === MOON_AVATAR_ENTRY_ID)!;
    expect(avatar.hidden).toBe(true);
    expect(codexCardState(avatar, new Set())).toBe('hidden');
    expect(codexCardState(avatar, new Set([MOON_AVATAR_ENTRY_ID]))).toBe('unlocked');
  });

  it('锁定/隐藏态解锁条件文案（spec §4：隐藏条目不展示剧情字段，条件固定）', () => {
    const avatar = CODEX_ENTRIES.find((e) => e.entryId === MOON_AVATAR_ENTRY_ID)!;
    expect(codexConditionText(avatar)).toBe('任意地图击杀（稀有月坠）');
    const enemy = CODEX_ENTRIES.find((e) => e.entryId === 'codex_enemy_enemy_g1_1')!;
    expect(codexConditionText(enemy)).toBe('首次击杀');
  });

  it('计数徽章与收集进度（save.codexUnlocked ∩ 条目；损坏存档回退空集不崩溃）', () => {
    const unlocked = new Set(['codex_hero_hero_edmund', 'codex_wpn_wpn_a_1', 'codex_hero_hero_violet']);
    expect(codexUnlockedCount(unlocked, 'hero')).toBe(2);
    expect(codexUnlockedCount(unlocked, 'weapon')).toBe(1);
    expect(codexTotalUnlocked(unlocked)).toBe(3);
    // 存档快照：损坏/非数组回退空集
    const save = emptySave();
    save.codexUnlocked = ['codex_hero_hero_edmund', 'codex_bad_id'];
    const set = codexUnlockedSet(save);
    expect(set.has('codex_hero_hero_edmund')).toBe(true);
    expect(set.has('codex_bad_id')).toBe(true); // 未知 id 由 data 层 record 拦截，读集不过滤
    expect(codexUnlockedSet({ ...emptySave(), codexUnlocked: undefined as unknown as string[] }).size).toBe(0);
  });
});
