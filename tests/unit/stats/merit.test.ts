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
  meritProgress,
} from '@/stats/merit';
import { HEROES } from '@/config/balance';
import { PlayerStats } from '@/player/player-stats';

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

describe('E4-S7 功绩累计进度（merit-ui-spec §7 结算页进度条数据源）', () => {
  it('按成本升序取第一个未解锁加成（成本 20/30/40/30 → 升序 20/30/30/40）', () => {
    // 0 点：下个 = 20（初始 +20 HP），还差 20
    const p0 = meritProgress(0);
    expect(p0.nextCost).toBe(20);
    expect(p0.nextName).toBe('初始 +20 HP');
    expect(p0.remaining).toBe(20);
    // 15 点：还差 5
    expect(meritProgress(15).remaining).toBe(5);
    // 20 点：已解锁 hp，下个 = 30（dmg 或 speed，成本同为 30）
    const p20 = meritProgress(20);
    expect(p20.nextCost).toBe(30);
    expect(p20.remaining).toBe(10);
    // 30 点：两个 30 成本加成均已解锁，下个 = 40（merit_magnet），还差 10
    const p30 = meritProgress(30);
    expect(p30.nextCost).toBe(40);
    expect(p30.remaining).toBe(10);
  });

  it('全部解锁（≥120）→ nextCost null / remaining 0 / fraction 1', () => {
    const p = meritProgress(120);
    expect(p.nextCost).toBeNull();
    expect(p.nextName).toBeNull();
    expect(p.remaining).toBe(0);
    expect(p.fraction).toBe(1);
  });

  it('进度填充比例 fraction：已解锁成本 → 下个成本区间内 0..1', () => {
    // 0 点 → 区间 [0,20]：0
    expect(meritProgress(0).fraction).toBe(0);
    // 10 点 → 区间 [0,20]：0.5
    expect(meritProgress(10).fraction).toBe(0.5);
    // 20 点 → 区间 [20,30]：0
    expect(meritProgress(20).fraction).toBe(0);
    // 25 点 → 区间 [20,30]：0.5
    expect(meritProgress(25).fraction).toBe(0.5);
    // 30 点 → 两个 30 成本解锁，区间 [30,40]：0
    expect(meritProgress(30).fraction).toBe(0);
    // 35 点 → 区间 [30,40]：0.5
    expect(meritProgress(35).fraction).toBe(0.5);
    // 全部解锁 → 1
    expect(meritProgress(120).fraction).toBe(1);
  });
});

// —— QA-FIX-3 修复 3：开局属性接线（R3 T-F40「装备 +20 HP 开局仍 100」回归锚点） ——

describe('功绩加成 → PlayerStats 开局接线（PlayScene.applyMeritToStats 消费契约）', () => {
  it('装备 merit_hp：开局 PlayerStats maxHp/hp = 120/120（PlayerStats 消费 delta 的标准写法）', () => {
    const stats = new PlayerStats(HEROES.hero_edmund);
    const merit = computeMeritApplication(['merit_hp'], false, HEROES.hero_edmund);
    // PlayScene.applyMeritToStats 的写回语义：maxHp += delta 且 hp += delta（满血起步）
    stats.maxHp += merit.maxHpDelta;
    stats.hp += merit.maxHpDelta;
    expect(stats.maxHp).toBe(120);
    expect(stats.hp).toBe(120);
  });

  it('纯局内模式开启：applied 为空 → delta 全 0，不写 PlayerStats（开局仍 100/100）', () => {
    const stats = new PlayerStats(HEROES.hero_edmund);
    const merit = computeMeritApplication(['merit_hp', 'merit_dmg', 'merit_magnet', 'merit_speed'], true, HEROES.hero_edmund);
    expect(merit.applied).toEqual([]);
    if (!merit.pureInGame) {
      stats.maxHp += merit.maxHpDelta;
      stats.addDamageBonus(merit.damageMultDelta);
      stats.moveSpeed += merit.moveSpeedDelta;
      stats.magnetRadiusBonus += merit.magnetRadiusDelta;
    }
    expect(stats.maxHp).toBe(100);
    expect(stats.hp).toBe(100);
    expect(stats.magnetRadiusBonus).toBe(20); // 守夜人专属被动 +20px，与功绩无关
  });

  it('四加成全装备：HP +20 / 伤害倍率 1.05 / 磁力 +40 / 移速 244.4（数值对齐 merit-ui-spec）', () => {
    const stats = new PlayerStats(HEROES.hero_edmund);
    const merit = computeMeritApplication(['merit_hp', 'merit_dmg', 'merit_magnet', 'merit_speed'], false, HEROES.hero_edmund);
    stats.maxHp += merit.maxHpDelta;
    stats.hp += merit.maxHpDelta;
    stats.addDamageBonus(merit.damageMultDelta);
    stats.moveSpeed += merit.moveSpeedDelta;
    stats.magnetRadiusBonus += merit.magnetRadiusDelta;
    expect(stats.maxHp).toBe(120);
    expect(stats.totalDamageMultiplier).toBeCloseTo(1.05, 6);
    expect(stats.magnetRadiusBonus).toBe(60); // 守夜人被动 20 + 功绩 40
    expect(stats.moveSpeed).toBeCloseTo(244.4, 6); // 235 × 1.04
  });
});
