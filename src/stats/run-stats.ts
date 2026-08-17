/**
 * stats/run-stats.ts —— 单局统计收集（ARCH §2 纯函数层 / S10 / E4-S1~S4）
 *
 * 纯逻辑类（可脱离 Phaser 单测，test-framework §1.2）：
 * - 击杀数 / 等级 / 所选升级清单（Build 回顾，E4-S4 复用 UpgradeState 序列）
 * - 纠结时刻埋点（design-review-e3 交接项 2 / upgrade-pool §⑧.3）：
 *   停留 >3s 或选项强度接近 → 计一次；单局 ≥3 为设计判据
 * - 升级时间戳统计（验证 Lv47 预警与后期升级间隔，供文策渊评审）
 * - Boss 战时长 / DPS 埋点（design-review-e3 交接项 4 / enemies §⑤）：60~90s 为最终判据
 * - finish() 聚合为 RunResult 供结算页渲染与 game:over 埋点（C9-留存数据源）
 */

import { HESITATION, GAME } from '@/config/balance';
import type { UpgradeOption } from '@/upgrade/upgrade-pool';

export interface UpgradeChoiceRecord {
  id: number;
  name: string;
  /** 选择时的局时秒 */
  timeSeconds: number;
}

export interface BossMetrics {
  spawnTimeSeconds: number;
  defeatedTimeSeconds: number | null;
  spawnHp: number;
}

/** 结算页渲染数据（game:over payload / ResultsOverlay 消费） */
export interface RunResult {
  victory: boolean;
  /** 存活时间秒（保留 1 位小数） */
  survivalSeconds: number;
  kills: number;
  level: number;
  /** Build 回顾：所选升级名（按选择顺序，E4-S4） */
  build: string[];
  hesitationCount: number;
  upgradeTimestamps: number[];
  firstLevelUpSeconds: number | null;
  /** 最近一次升级间隔秒（后期升级间隔，design-review-e3 预警数据） */
  lastUpgradeIntervalSeconds: number | null;
  /** 是否达到 Lv47（design-review-e3：模拟 Lv47 越过预警线） */
  reachedLevel47: boolean;
  bossFightSeconds: number | null;
  /** 平均击杀 DPS ≈ spawnHp / 战时长 */
  bossDpsEstimate: number | null;
  /** Boss 战时长是否落在 60~90s 最终判据窗口 */
  bossInTargetWindow: boolean;
}

// —— 纠结时刻纯函数（可单测） ——

/**
 * 纠结判定：停留 >3s 或选项强度接近（upgrade-pool §⑧.3「停留 >3s 或选项强度接近」）。
 * 「选项强度接近」操作化定义：三张全为机制改变型（机制型改变行为、普遍都想选 →
 * 等价于"两个都想选"的纠结场景）。该定义为工程代理指标，真机校准记录于
 * control-manifest §9 C-7 埋点说明（供文策渊评审）。
 */
export function optionsStrengthClose(options: readonly UpgradeOption[]): boolean {
  return options.length >= 2 && options.every((o) => o.item.type === 'mechanic');
}

export function isHesitation(dwellSeconds: number, options: readonly UpgradeOption[]): boolean {
  if (dwellSeconds >= HESITATION.DWELL_SECONDS) return true;
  return optionsStrengthClose(options);
}

// —— Boss 战时长 / DPS 纯函数（可单测） ——

export function bossFightSeconds(boss: BossMetrics | null): number | null {
  if (!boss || boss.defeatedTimeSeconds === null) return null;
  return Math.max(0, boss.defeatedTimeSeconds - boss.spawnTimeSeconds);
}

export function bossDpsEstimate(boss: BossMetrics | null): number | null {
  const secs = bossFightSeconds(boss);
  if (!boss || secs === null || secs <= 0) return null;
  return boss.spawnHp / secs;
}

/** Boss 战时长是否落在 60~90s 最终判据窗口（enemies §⑤ / design-review-e3 交接项 4） */
export function bossInTargetWindow(boss: BossMetrics | null): boolean {
  const secs = bossFightSeconds(boss);
  if (secs === null) return false;
  return secs >= GAME.BOSS_FIGHT_TARGET_MIN && secs <= GAME.BOSS_FIGHT_TARGET_MAX;
}

// —— 升级时间戳纯函数（可单测） ——

export function firstLevelUpSeconds(timestamps: readonly number[]): number | null {
  return timestamps.length > 0 ? timestamps[0]! : null;
}

export function lastUpgradeIntervalSeconds(timestamps: readonly number[]): number | null {
  if (timestamps.length < 2) return null;
  const n = timestamps.length;
  return Math.max(0, timestamps[n - 1]! - timestamps[n - 2]!);
}

export function reachedLevelAtLeast(level: number, target: number): boolean {
  return level >= target;
}

// —— 单局收集器 ——

export class RunStats {
  kills = 0;
  level = 1;
  hesitationCount = 0;
  upgradeTimestamps: number[] = [];
  upgrades: UpgradeChoiceRecord[] = [];
  boss: BossMetrics | null = null;

  recordKill(): void {
    this.kills += 1;
  }

  /** 升级（level:up）：记录等级与局时时间戳（后期升级间隔数据源） */
  recordLevelUp(level: number, timeSeconds: number): void {
    this.level = level;
    this.upgradeTimestamps.push(timeSeconds);
  }

  /** 三选一完成：记录 Build 项（E4-S4 回顾） */
  recordUpgradeChosen(id: number, name: string, timeSeconds: number): void {
    this.upgrades.push({ id, name, timeSeconds });
  }

  /** 纠结埋点：dwell 停留时长 + 本次三张选项（>=3/局 为设计判据，FUNC-E3-06） */
  recordHesitation(dwellSeconds: number, options: readonly UpgradeOption[]): void {
    if (isHesitation(dwellSeconds, options)) this.hesitationCount += 1;
  }

  recordBossSpawn(timeSeconds: number, spawnHp: number): void {
    this.boss = { spawnTimeSeconds: timeSeconds, defeatedTimeSeconds: null, spawnHp };
  }

  recordBossDefeated(timeSeconds: number): void {
    if (this.boss) this.boss.defeatedTimeSeconds = timeSeconds;
  }

  /** 局终聚合：victory + 存活时间 → RunResult（结算页 / game:over 埋点） */
  finish(victory: boolean, survivalSeconds: number): RunResult {
    return {
      victory,
      survivalSeconds: Math.round(survivalSeconds * 10) / 10,
      kills: this.kills,
      level: this.level,
      build: this.upgrades.map((u) => u.name),
      hesitationCount: this.hesitationCount,
      upgradeTimestamps: [...this.upgradeTimestamps],
      firstLevelUpSeconds: firstLevelUpSeconds(this.upgradeTimestamps),
      lastUpgradeIntervalSeconds: lastUpgradeIntervalSeconds(this.upgradeTimestamps),
      reachedLevel47: reachedLevelAtLeast(this.level, 47),
      bossFightSeconds: bossFightSeconds(this.boss),
      bossDpsEstimate: bossDpsEstimate(this.boss),
      bossInTargetWindow: bossInTargetWindow(this.boss),
    };
  }
}
