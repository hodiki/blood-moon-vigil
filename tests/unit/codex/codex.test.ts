import { describe, it, expect } from 'vitest';
import {
  CODEX_ENTRIES,
  CodexTracker,
  codexCategoryCounts,
  codexEntryById,
  MOON_AVATAR_ENTRY_ID,
  eventEntriesForMapCleared,
} from '@/codex/codex';

describe('E4-S6 图鉴数据层（gdd-codex §3.1）', () => {
  it('条目分项：角色 4 / 敌人 17 / Boss 4 / 武器 14 / 共鸣 8 / 超武 7 / 事件 6（合计 60；gdd-enemies-v3 §③-2 敌 15→16 增补腐朽骑士）', () => {
    const counts = codexCategoryCounts();
    expect(counts.hero).toBe(4);
    expect(counts.enemy).toBe(17);
    expect(counts.boss).toBe(4);
    expect(counts.weapon).toBe(14);
    expect(counts.resonance).toBe(8); // P2-4 共鸣形态条目
    expect(counts.evo).toBe(7);
    expect(counts.event).toBe(6);
    // GDD 表头「合计 35」与分项和 50 不一致 —— 工程按分项全量落表（口径注明见 codex.ts 头注释）
    expect(CODEX_ENTRIES.length).toBe(60);
  });

  it('条目含 entryId/类别/解锁类型/条件；血月化身 Boss 为隐藏条目', () => {
    const boss4 = codexEntryById(MOON_AVATAR_ENTRY_ID);
    expect(boss4).toBeTruthy();
    expect(boss4?.category).toBe('boss');
    expect(boss4?.hidden).toBe(true);
    expect(codexEntryById('codex_enemy_enemy_g1_1')).toMatchObject({ category: 'enemy', unlock: 'kill' });
    expect(codexEntryById('codex_wpn_wpn_a_1')).toMatchObject({ category: 'weapon', unlock: 'obtain' });
  });
});

describe('E4-S6 codex_unlock 五类幂等记录（gdd-codex §3.2/§6.5）', () => {
  it('首杀/首获/首进化/首通/触发 均幂等（重复 record 返回 false）', () => {
    const tracker = new CodexTracker();
    expect(tracker.recordKill('enemy_g1_1')).toBe(true); // 首杀
    expect(tracker.recordKill('enemy_g1_1')).toBe(false); // 幂等
    expect(tracker.recordObtain('wpn_a_2')).toBe(true);
    expect(tracker.recordObtain('wpn_a_2')).toBe(false);
    expect(tracker.recordEvolve('evo_moonwrath')).toBe(true);
    expect(tracker.recordEvolve('evo_moonwrath')).toBe(false);
    expect(tracker.recordProgress('codex_event_1')).toBe(true);
    expect(tracker.recordProgress('codex_event_1')).toBe(false);
    expect(tracker.recordTrigger(MOON_AVATAR_ENTRY_ID)).toBe(true);
    expect(tracker.recordTrigger(MOON_AVATAR_ENTRY_ID)).toBe(false);
    expect(tracker.unlockCount()).toBe(5);
  });

  it('未知条目不记录；解锁计数与快照正确', () => {
    const tracker = new CodexTracker();
    expect(tracker.record('codex_nope')).toBe(false);
    tracker.recordKill('enemy_g1_1');
    expect(tracker.isUnlocked('codex_enemy_enemy_g1_1')).toBe(true);
    expect(tracker.snapshot()).toEqual(['codex_enemy_enemy_g1_1']);
  });

  it('初始解锁加载（存档恢复）；Boss/敌人 kill 前缀正确', () => {
    const tracker = new CodexTracker(['codex_enemy_enemy_g1_1', 'codex_boss_boss_1']);
    expect(tracker.recordKill('boss_1')).toBe(false); // 已解锁
    expect(tracker.isUnlocked('codex_boss_boss_1')).toBe(true);
    expect(tracker.recordKill('boss_2')).toBe(true);
    expect(tracker.isUnlocked('codex_boss_boss_2')).toBe(true);
  });

  it('事件条目按首通地图解锁（gdd-codex §6.7）', () => {
    expect(eventEntriesForMapCleared('map_graveyard')).toEqual(['codex_event_1', 'codex_event_2']);
    expect(eventEntriesForMapCleared('map_cathedral')).toEqual(['codex_event_3', 'codex_event_4']);
    expect(eventEntriesForMapCleared('map_den')).toEqual(['codex_event_5']);
  });
});
