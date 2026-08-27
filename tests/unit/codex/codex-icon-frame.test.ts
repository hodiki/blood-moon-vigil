import { describe, expect, it } from 'vitest';
import { CODEX_ENTRIES } from '@/codex/codex';
import { codexIconFrame } from '@/codex/codex-icon-frame';

describe('codexIconFrame 图鉴卡图标帧', () => {
  it('角色 / 敌 / Boss / 武器 / 超武走注册表第一帧', () => {
    const hero = CODEX_ENTRIES.find((e) => e.entryId === 'codex_hero_hero_edmund')!;
    expect(codexIconFrame(hero)).toBe('player');
    const enemy = CODEX_ENTRIES.find((e) => e.entryId === 'codex_enemy_enemy_g1_1')!;
    expect(codexIconFrame(enemy)).toBe('enemy-zombie');
    const boss = CODEX_ENTRIES.find((e) => e.entryId === 'codex_boss_boss_2')!;
    expect(codexIconFrame(boss)).toBe('boss-cardinal');
    const wpn = CODEX_ENTRIES.find((e) => e.entryId === 'codex_wpn_wpn_a_1')!;
    expect(codexIconFrame(wpn)).toBe('missile');
    const evo = CODEX_ENTRIES.find((e) => e.entryId === 'codex_evo_evo_moonwrath')!;
    expect(codexIconFrame(evo)).toBe('super-moonwrath');
  });

  it('事件 6 条映射到 codex-event-1..6', () => {
    const events = CODEX_ENTRIES.filter((e) => e.category === 'event');
    expect(events).toHaveLength(6);
    expect(events.map((e) => codexIconFrame(e))).toEqual([
      'codex-event-1', 'codex-event-2', 'codex-event-3',
      'codex-event-4', 'codex-event-5', 'codex-event-6',
    ]);
  });
});
