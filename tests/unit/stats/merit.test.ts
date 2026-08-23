import { describe, it, expect } from 'vitest';
import {
  MERIT_BONUSES,
  MERIT_MAX_EQUIPPED,
  PURE_IN_GAME_MODE_KEY,
  calculateMeritPoints,
  meritImpactPct,
  allMeritBonusesWithinRedline,
  canEquipMerit,
  toggleMeritEquipped,
  computeMeritApplication,
} from '@/stats/merit';
import { HEROES } from '@/config/balance';

describe('E4-S7 功绩点数结算（gdd-codex §3.4）', () => {
  it('单局典型 28~32：存活 12 + 击杀 8 + 通关 10 + 首杀 2 = 32', () => {
    const pts = calculateMeritPoints({
      survivalSeconds: 360, // 6:00 → +12
      kills: 400, // → +8
      victory: true, // +10
      firstBossKills: 1, // +2
      avatarKills: 0,
    });
    expect(pts).toBe(32);
  });

  it('存活 +1/30s；击杀 +1/50；首杀 Boss/精英 +2/只；化身 +5', () => {
    expect(calculateMeritPoints({ survivalSeconds: 90, kills: 0, victory: false, firstBossKills: 0, avatarKills: 0 })).toBe(3);
    expect(calculateMeritPoints({ survivalSeconds: 0, kills: 120, victory: false, firstBossKills: 0, avatarKills: 0 })).toBe(2);
    expect(calculateMeritPoints({ survivalSeconds: 0, kills: 0, victory: false, firstBossKills: 3, avatarKills: 0 })).toBe(6);
    expect(calculateMeritPoints({ survivalSeconds: 0, kills: 0, victory: false, firstBossKills: 0, avatarKills: 1 })).toBe(5);
  });

  it('典型 28~32 下限：存活 10 + 击杀 6 + 通关 10 + 首杀 2 = 28', () => {
    const pts = calculateMeritPoints({
      survivalSeconds: 300, // +10
      kills: 300, // +6
      victory: true, // +10
      firstBossKills: 1, // +2
      avatarKills: 0,
    });
    expect(pts).toBe(28);
  });
});

describe('E4-S7 功绩加成 4（≤10% 红线 + 同时最多装 2）', () => {
  it('恰好 4 个加成；同时最多装 2 个', () => {
    expect(MERIT_BONUSES).toHaveLength(4);
    expect(MERIT_MAX_EQUIPPED).toBe(2);
    const ids = MERIT_BONUSES.map((m) => m.id);
    expect(ids).toEqual(['merit_hp', 'merit_dmg', 'merit_magnet', 'merit_speed']);
  });

  it('全部 4 加成对 6 分钟成型强度影响 ≤10%（红线口径，gdd-codex §3.4 注）', () => {
    expect(allMeritBonusesWithinRedline()).toBe(true);
    for (const m of MERIT_BONUSES) {
      expect(meritImpactPct(m)).toBeLessThanOrEqual(0.1);
    }
  });

  it('装备校验：2 个上限；toggle 加/移除', () => {
    expect(canEquipMerit([], 'merit_hp')).toBe(true);
    expect(canEquipMerit(['merit_hp', 'merit_dmg'], 'merit_magnet')).toBe(false); // 已 2 个
    expect(canEquipMerit(['merit_hp'], 'merit_hp')).toBe(true); // 重复 = 移除
    expect(toggleMeritEquipped(['merit_hp'], 'merit_dmg')).toEqual(['merit_hp', 'merit_dmg']);
    expect(toggleMeritEquipped(['merit_hp', 'merit_dmg'], 'merit_hp')).toEqual(['merit_dmg']);
    expect(toggleMeritEquipped(['merit_hp', 'merit_dmg'], 'merit_magnet')).toEqual(['merit_hp', 'merit_dmg']); // 上限拒绝
  });

  it('纯局内模式开关常量（gdd-codex §3.4：关闭全部加成）', () => {
    expect(PURE_IN_GAME_MODE_KEY).toBe('bmv.pureInGame');
    const pure = computeMeritApplication(['merit_hp', 'merit_dmg', 'merit_magnet', 'merit_speed'], true, HEROES.hero_edmund);
    expect(pure.pureInGame).toBe(true);
    expect(pure.applied).toEqual([]);
    expect(pure.maxHpDelta).toBe(0);
  });

  it('开局生效：merit_hp +20 HP / merit_dmg +5% / merit_magnet +40px / merit_speed +4%（守夜人运行时 235）', () => {
    const app = computeMeritApplication(
      ['merit_hp', 'merit_dmg', 'merit_magnet', 'merit_speed'],
      false,
      HEROES.hero_edmund,
    );
    expect(app.applied).toHaveLength(4);
    expect(app.maxHpDelta).toBe(20);
    expect(app.damageMultDelta).toBeCloseTo(0.05, 6);
    expect(app.magnetRadiusDelta).toBe(40);
    expect(app.moveSpeedDelta).toBeCloseTo(235 * 0.04, 6); // 守夜人运行时 235
  });

  it('移速加成按角色基线：血猎手 245 × 4% = 9.8', () => {
    const app = computeMeritApplication(['merit_speed'], false, HEROES.hero_cassandra);
    expect(app.moveSpeedDelta).toBeCloseTo(245 * 0.04, 6);
  });
});
