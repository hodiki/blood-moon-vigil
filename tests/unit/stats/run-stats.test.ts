import { describe, it, expect } from 'vitest';
import { GAME, UPGRADES, type UpgradeId } from '@/config/balance';
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
  relatedCardShareOf,
  evolutionCompleted,
} from '@/stats/run-stats';
import type { UpgradeV2Option } from '@/upgrade/upgrade-pool-v2';

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

/** M3 真机埋点：构造 v2 三选一选项（仅统计关注 related 标记） */
function v2Opt(upgradeId: string, related: boolean): UpgradeV2Option {
  return {
    kind: 'upgrade',
    upgradeId: upgradeId as UpgradeId,
    name: upgradeId,
    desc: '',
    effectText: '',
    cardKind: 'blue-purple',
    related,
  };
}

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

describe('Boss 战时长 / DPS 判据（enemies §⑤ / design-review-e3 交接项 4；TASK-31 Boss HP 4000）', () => {
  const spawn = { spawnTimeSeconds: 360, defeatedTimeSeconds: 420 as number | null, spawnHp: 4000 };

  it('战时长 = 击杀 − 出场；未击杀 null', () => {
    expect(bossFightSeconds(spawn)).toBe(60);
    expect(bossFightSeconds({ ...spawn, defeatedTimeSeconds: null })).toBeNull();
  });

  it('DPS 估算 = spawnHp / 战时长（4000/60 ≈ 66.67）', () => {
    expect(bossDpsEstimate(spawn)).toBeCloseTo(4000 / 60, 6);
  });

  it('60~90s 为最终判据窗口：60 达标、59 不达标、90 达标、91 不达标', () => {
    expect(bossInTargetWindow({ ...spawn, defeatedTimeSeconds: 420 })).toBe(true);
    expect(bossInTargetWindow({ ...spawn, defeatedTimeSeconds: 419 })).toBe(false);
    expect(bossInTargetWindow({ ...spawn, defeatedTimeSeconds: 450 })).toBe(true);
    expect(bossInTargetWindow({ ...spawn, defeatedTimeSeconds: 451 })).toBe(false);
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
    stats.recordBossSpawn(360, 4000);
    stats.recordBossDefeated(440);

    const r = stats.finish(true, 440);
    expect(r.victory).toBe(true);
    expect(r.survivalSeconds).toBe(440);
    expect(r.kills).toBe(2);
    expect(r.level).toBe(3);
    expect(r.build).toEqual(['解锁「守夜之环」', '伤害强化 +15%']);
    expect(r.hesitationCount).toBe(1);
    expect(r.firstLevelUpSeconds).toBe(30);
    expect(r.lastUpgradeIntervalSeconds).toBe(50);
    expect(r.reachedLevel47).toBe(false);
    expect(r.bossFightSeconds).toBe(80);
    expect(r.bossDpsEstimate).toBeCloseTo(4000 / 80, 6);
    expect(r.bossInTargetWindow).toBe(true);
  });

  it('死亡终局（victory=false）与未打 Boss 场景', () => {
    const stats = new RunStats();
    stats.recordKill();
    stats.recordLevelUp(5, 120);
    const r = stats.finish(false, 300.36);
    expect(r.victory).toBe(false);
    expect(r.survivalSeconds).toBeCloseTo(300.4, 6); // 保留 1 位小数
    expect(r.bossFightSeconds).toBeNull();
    expect(r.bossInTargetWindow).toBe(false);
    expect(r.build).toEqual([]);
  });

  it('Lv47 预警：等级 ≥47 → reachedLevel47=true（纯统计聚合，输入为任意时间戳）', () => {
    const stats = new RunStats();
    stats.recordLevelUp(47, 300);
    expect(stats.finish(true, 360).reachedLevel47).toBe(true);
  });

  it('M1b 主动技埋点：activeSkillCasts 逐次累加并进 RunResult（判据 ≤18）', () => {
    const stats = new RunStats();
    expect(stats.finish(true, 360).activeSkillCasts).toBe(0); // 默认 0
    for (let i = 0; i < 12; i += 1) stats.recordActiveSkillCast();
    const r = stats.finish(true, 360);
    expect(r.activeSkillCasts).toBe(12);
  });
});

describe('M3 真机埋点（upgrade-experience-v2 §4.4）', () => {
  it('relatedCardShareOf：related/总卡数；无卡 null；越界钳制', () => {
    expect(relatedCardShareOf(3, 9)).toBeCloseTo(1 / 3, 6);
    expect(relatedCardShareOf(9, 9)).toBe(1);
    expect(relatedCardShareOf(0, 3)).toBe(0);
    expect(relatedCardShareOf(0, 0)).toBeNull();
    expect(relatedCardShareOf(5, 3)).toBe(1); // 异常输入钳制到 [0,1]
  });

  it('evolutionCompleted：≥1 次进化 = 达成（§1.2 口径）', () => {
    expect(evolutionCompleted(0)).toBe(false);
    expect(evolutionCompleted(1)).toBe(true);
    expect(evolutionCompleted(3)).toBe(true);
  });

  it('recordUpgradeOffered：每轮 offersPerRun +1，按 related 标记统计占比', () => {
    const stats = new RunStats();
    stats.recordUpgradeOffered([v2Opt('up_w_a1', true), v2Opt('up_g_1', false), v2Opt('up_a_cd_edmund', true)]);
    stats.recordUpgradeOffered([v2Opt('up_w_b1', true), v2Opt('up_g_2', false), v2Opt('up_w_a2', true)]);
    const r = stats.finish(true, 120);
    expect(r.offersPerRun).toBe(2);
    expect(r.relatedCardShare).toBeCloseTo(4 / 6, 6); // 4 related / 6 卡
  });

  it('recordUpgradeOffered：无 offer 时 relatedCardShare null', () => {
    const stats = new RunStats();
    expect(stats.finish(true, 60).offersPerRun).toBe(0);
    expect(stats.finish(true, 60).relatedCardShare).toBeNull();
  });

  it('recordXpGained：经验拾取累计进 RunResult（xpGainedPerRun）', () => {
    const stats = new RunStats();
    expect(stats.finish(true, 60).xpGainedPerRun).toBe(0); // 默认 0
    stats.recordXpGained(5);
    stats.recordXpGained(8);
    stats.recordXpGained(11);
    expect(stats.finish(true, 60).xpGainedPerRun).toBe(24);
  });

  it('recordEvolutionComplete：次数累计 + 达成布尔（多次进化仍达成）', () => {
    const stats = new RunStats();
    expect(stats.finish(true, 60).evolutionComplete).toBe(false);
    stats.recordEvolutionComplete();
    const r1 = stats.finish(true, 60);
    expect(r1.evolutionCompleteCount).toBe(1);
    expect(r1.evolutionComplete).toBe(true);
    stats.recordEvolutionComplete();
    stats.recordEvolutionComplete();
    const r2 = stats.finish(true, 60);
    expect(r2.evolutionCompleteCount).toBe(3);
    expect(r2.evolutionComplete).toBe(true);
  });

  it('五埋点全流程汇入 RunResult（offers/xp/evolution/related/bossFightSeconds）', () => {
    const stats = new RunStats();
    stats.recordUpgradeOffered([v2Opt('up_w_a1', true), v2Opt('up_g_1', false), v2Opt('up_a_cd_edmund', true)]);
    stats.recordUpgradeOffered([v2Opt('evo_moonwrath', true), v2Opt('up_g_3', false), v2Opt('up_w_a2', true)]);
    stats.recordXpGained(100);
    stats.recordEvolutionComplete();
    stats.recordBossSpawn(360, 4000);
    stats.recordBossDefeated(430);
    const r = stats.finish(true, 430);
    expect(r.offersPerRun).toBe(2);
    expect(r.xpGainedPerRun).toBe(100);
    expect(r.evolutionCompleteCount).toBe(1);
    expect(r.evolutionComplete).toBe(true);
    expect(r.relatedCardShare).toBeCloseTo(4 / 6, 6);
    expect(r.bossFightSeconds).toBe(70); // Boss HP 4000 不改，仅时长埋点
  });
});
