import { describe, it, expect } from 'vitest';
import { GAME } from '@/config/balance';
import {
  RunStats,
  isHesitation,
  optionsStrengthClose,
  bossFightSeconds,
  bossDpsEstimate,
  bossInTargetWindow,
  firstLevelUpSeconds,
  lastUpgradeIntervalSeconds,
  reachedLevelAtLeast,
} from '@/stats/run-stats';
import { UPGRADES } from '@/config/balance';

/**
 * E4 统计纯函数（S10 / E4-S1~S4）：
 * - 纠结时刻埋点（design-review-e3 交接项 2：停留 >3s 或选项强度接近 → ≥3/局）
 * - 升级时间戳（Lv47 预警 + 后期升级间隔）
 * - Boss 战时长 / DPS（60~90s 最终判据，design-review-e3 交接项 4）
 * - 结算聚合（E4-S4 数据准确性）
 */

const optionsAllMechanic = [0, 1, 2].map((i) => ({ id: i, item: UPGRADES[i]! }));
const optionsMixed = [
  { id: 1, item: UPGRADES[0]! }, // mechanic
  { id: 10, item: UPGRADES[9]! }, // numeric
  { id: 12, item: UPGRADES[11]! }, // numeric
];

describe('纠结时刻判定（upgrade-pool §⑧.3 / FUNC-E3-06）', () => {
  it('停留 >3s → 纠结（dwell >= HESITATION.DWELL_SECONDS）', () => {
    expect(isHesitation(3.0, optionsAllMechanic)).toBe(true);
    expect(isHesitation(3.5, optionsMixed)).toBe(true);
    expect(isHesitation(0.5, optionsMixed)).toBe(false);
  });

  it('选项强度接近：三张全为机制改变型 → 纠结（"两个都想选"代理定义）', () => {
    expect(optionsStrengthClose(optionsAllMechanic)).toBe(true);
    expect(optionsStrengthClose(optionsMixed)).toBe(false);
    expect(isHesitation(0.1, optionsAllMechanic)).toBe(true); // 全机制 → 即便秒选也记纠结
  });

  it('空/单选项不算强度接近（防御）', () => {
    expect(optionsStrengthClose([])).toBe(false);
    expect(optionsStrengthClose([optionsAllMechanic[0]!])).toBe(false);
  });
});

describe('升级时间戳统计（design-review-e3：Lv47 预警与后期升级间隔）', () => {
  it('firstLevelUpSeconds：无升级 null；有升级取首个', () => {
    expect(firstLevelUpSeconds([])).toBeNull();
    expect(firstLevelUpSeconds([42])).toBe(42);
  });

  it('lastUpgradeIntervalSeconds：不足两次 null；取最近两次差值', () => {
    expect(lastUpgradeIntervalSeconds([10])).toBeNull();
    expect(lastUpgradeIntervalSeconds([10, 15, 40])).toBe(25);
  });

  it('reachedLevelAtLeast：Lv47 预警阈值判定', () => {
    expect(reachedLevelAtLeast(47, 47)).toBe(true);
    expect(reachedLevelAtLeast(30, 47)).toBe(false);
  });
});

describe('Boss 战时长 / DPS 判据（enemies §⑤ / design-review-e3 交接项 4）', () => {
  const spawn = { spawnTimeSeconds: 1200, defeatedTimeSeconds: 1260 as number | null, spawnHp: 6000 };

  it('战时长 = 击杀 − 出场；未击杀 null', () => {
    expect(bossFightSeconds(spawn)).toBe(60);
    expect(bossFightSeconds({ ...spawn, defeatedTimeSeconds: null })).toBeNull();
  });

  it('DPS 估算 = spawnHp / 战时长（6000/60 = 100）', () => {
    expect(bossDpsEstimate(spawn)).toBe(100);
  });

  it('60~90s 为最终判据窗口：60 达标、59 不达标、90 达标、91 不达标', () => {
    expect(bossInTargetWindow({ ...spawn, defeatedTimeSeconds: 1260 })).toBe(true);
    expect(bossInTargetWindow({ ...spawn, defeatedTimeSeconds: 1259 })).toBe(false);
    expect(bossInTargetWindow({ ...spawn, defeatedTimeSeconds: 1290 })).toBe(true);
    expect(bossInTargetWindow({ ...spawn, defeatedTimeSeconds: 1291 })).toBe(false);
    expect(bossInTargetWindow(null)).toBe(false);
  });

  it('GAME 判据常量：60~90', () => {
    expect(GAME.BOSS_FIGHT_TARGET_MIN).toBe(60);
    expect(GAME.BOSS_FIGHT_TARGET_MAX).toBe(90);
  });
});

describe('RunStats 结算聚合（E4-S4 数据准确性）', () => {
  it('击杀/升级/Build/纠结/Boss 汇总到 RunResult', () => {
    const stats = new RunStats();
    stats.recordKill();
    stats.recordKill();
    stats.recordLevelUp(2, 30);
    stats.recordLevelUp(3, 80);
    stats.recordUpgradeChosen(1, '解锁「守夜之环」', 30);
    stats.recordUpgradeChosen(10, '伤害强化 +15%', 80);
    stats.recordHesitation(4.0, optionsMixed); // dwell>3s → 纠结
    stats.recordHesitation(0.2, optionsMixed); // 不纠结
    stats.recordBossSpawn(1200, 6000);
    stats.recordBossDefeated(1280);

    const r = stats.finish(true, 1280);
    expect(r.victory).toBe(true);
    expect(r.survivalSeconds).toBe(1280);
    expect(r.kills).toBe(2);
    expect(r.level).toBe(3);
    expect(r.build).toEqual(['解锁「守夜之环」', '伤害强化 +15%']);
    expect(r.hesitationCount).toBe(1);
    expect(r.firstLevelUpSeconds).toBe(30);
    expect(r.lastUpgradeIntervalSeconds).toBe(50);
    expect(r.reachedLevel47).toBe(false);
    expect(r.bossFightSeconds).toBe(80);
    expect(r.bossDpsEstimate).toBeCloseTo(6000 / 80, 6);
    expect(r.bossInTargetWindow).toBe(true);
  });

  it('死亡终局（victory=false）与未打 Boss 场景', () => {
    const stats = new RunStats();
    stats.recordKill();
    stats.recordLevelUp(5, 120);
    const r = stats.finish(false, 452.36);
    expect(r.victory).toBe(false);
    expect(r.survivalSeconds).toBeCloseTo(452.4, 6); // 保留 1 位小数
    expect(r.bossFightSeconds).toBeNull();
    expect(r.bossInTargetWindow).toBe(false);
    expect(r.build).toEqual([]);
  });

  it('Lv47 预警：等级 ≥47 → reachedLevel47=true', () => {
    const stats = new RunStats();
    stats.recordLevelUp(47, 1100);
    expect(stats.finish(true, 1200).reachedLevel47).toBe(true);
  });
});
