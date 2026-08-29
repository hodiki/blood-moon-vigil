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
import type { UpgradeV2Option } from '@/upgrade/upgrade-pool-v2';

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
  /** M1b 主动技：本局释放次数（埋点 activeSkillCasts；判据 ≤18、目标中位 ~12） */
  activeSkillCasts: number;
  /** M3 真机埋点：单局升级三选一出现轮数（upgrade-experience-v2 §4.4 / §1.1，校验基准局 14 口径） */
  offersPerRun: number;
  /** M3 真机埋点：单局经验拾取总量（xpGainedPerRun，校验拾取率；中位 <400 需先修磁力再谈升级体验） */
  xpGainedPerRun: number;
  /** M3 真机埋点：单局进化完成次数（进化达成率数据源 = 完成 ≥1 次的局数 / 局数，§1.2） */
  evolutionCompleteCount: number;
  /** M3 真机埋点：单局是否完成 ≥1 次进化（基准局 ≥50% / 全通局 ≥80% 判据） */
  evolutionComplete: boolean;
  /** M3 真机埋点：单局三选一「build 相关卡」占比（related/总 offer 卡，向心性 ≥50% 判据） */
  relatedCardShare: number | null;
  // ───── B6-W5 遥测全量（EG-9 口径；gdd-upgrade-pool-v3/gdd-resonance/gdd-talent-tree 验收判据）─────
  /** 衍生技 DPS 占比（12~18% 锚 EG-9；衍生技伤害 / 全局伤害，沙盘口径近似 = cast 结算累计/总伤） */
  derivativeDpsShare: number | null;
  /** 圣物伤害占比（<5% 红线 §⑤；占位校验口径） */
  relicDpsShare: number | null;
  /** 质变卡 1 获取时点 s（双节拍锚 30~60s） */
  mutationCard1AtSeconds: number | null;
  /** 质变卡 2 获取时点 s（双节拍锚 90~150s） */
  mutationCard2AtSeconds: number | null;
  /** 共鸣达成时点 s（null = 本局未达成） */
  resonanceAtSeconds: number | null;
  /** 共鸣达成对 id（R1~R8） */
  resonancePairId: string | null;
  /** 天赋复活触发次数（Q-c/Q-e；HUD 复活次数指示同源） */
  talentReviveCount: number;
  /** 精英抽卡 offer 发放次数（Q-f1/f2/f3） */
  eliteOfferCount: number;
  /** 树质变节点点亮数（树节奏遥测） */
  treeMutationCount: number;
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

/** E4-S4：v2 池（内容 ID）选项强度接近判定（进化卡/机制卡 = 蓝紫/幽紫 → 都想选） */
export function optionsStrengthCloseV2(options: readonly UpgradeV2Option[]): boolean {
  return options.length >= 2 && options.every((o) => o.kind === 'evolution' || o.cardKind === 'blue-purple');
}

/** E4-S4：v2 池纠结判定（停留 >3s 或全机制卡） */
export function isHesitationV2(dwellSeconds: number, options: readonly UpgradeV2Option[]): boolean {
  if (dwellSeconds >= HESITATION.DWELL_SECONDS) return true;
  return optionsStrengthCloseV2(options);
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

// —— M3 真机埋点纯函数（可单测，upgrade-experience-v2 §4.4） ——

/** relatedCardShare = related 卡数 / 总 offer 卡数；无 offer 卡时 null（不参与占比） */
export function relatedCardShareOf(related: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.min(1, Math.max(0, related / total));
}

/** 进化达成（口径 §1.2：完成 ≥1 次进化 = 达成） */
export function evolutionCompleted(count: number): boolean {
  return count >= 1;
}

// —— 单局收集器 ——

export class RunStats {
  kills = 0;
  level = 1;
  hesitationCount = 0;
  upgradeTimestamps: number[] = [];
  upgrades: UpgradeChoiceRecord[] = [];
  boss: BossMetrics | null = null;
  /** M1b 主动技：本局释放次数（activeSkillCasts 埋点；局终进 RunResult） */
  activeSkillCasts = 0;
  /** M3 真机埋点：三选一出现轮数（offersPerRun；onLevelUp 每轮 +1） */
  offersPerRun = 0;
  /** M3 真机埋点：本局经验拾取总量（xpGainedPerRun；XpManager.addXp 累计，局终进 RunResult） */
  xpGainedPerRun = 0;
  /** M3 真机埋点：本局进化完成次数（evolutionComplete；消费进化卡成功时 +1） */
  evolutionCompleteCount = 0;
  /** M3 真机埋点：三选一中标记为「build 相关卡」的卡数（relatedCardShare 分子） */
  relatedOfferCards = 0;
  // ───── B6-W5 遥测全量（运行时累计）─────
  /** 衍生技累计伤害（castDerivative damageDealt 汇总） */
  derivativeDamage = 0;
  /** 全局伤害累计（占比分母；PlayScene 击杀/伤害事件近似 —— 敌 hp 消耗累计） */
  totalDamageDealt = 0;
  mutationCard1AtSeconds: number | null = null;
  mutationCard2AtSeconds: number | null = null;
  resonanceAtSeconds: number | null = null;
  resonancePairId: string | null = null;
  talentReviveCount = 0;
  eliteOfferCount = 0;
  treeMutationCount = 0;
  /** M3 真机埋点：三选一总卡数（relatedCardShare 分母；= offersPerRun × 每轮卡数） */
  totalOfferCards = 0;

  /**
   * 每局开始重置全部 per-run 字段（R3 外测 §6「再来一局」__BMV_LAST_RUN 串号修复）。
   * PlayScene 复用同一场景实例（scene.restart 不重建实例、类字段不重初始化），
   * 累积数组（build/upgradeTimestamps）与累计计数（offersPerRun/xpGained/...）跨局存活；
   * 本方法在每局开始（PlayScene.create，含 restart 路径）调用，第二局 JSON 只含第二局数据。
   */
  reset(): void {
    this.kills = 0;
    this.level = 1;
    this.hesitationCount = 0;
    this.upgradeTimestamps = [];
    this.upgrades = [];
    this.boss = null;
    this.activeSkillCasts = 0;
    this.offersPerRun = 0;
    this.derivativeDamage = 0;
    this.totalDamageDealt = 0;
    this.mutationCard1AtSeconds = null;
    this.mutationCard2AtSeconds = null;
    this.resonanceAtSeconds = null;
    this.resonancePairId = null;
    this.talentReviveCount = 0;
    this.eliteOfferCount = 0;
    this.treeMutationCount = 0;
    this.xpGainedPerRun = 0;
    this.evolutionCompleteCount = 0;
    this.relatedOfferCards = 0;
    this.totalOfferCards = 0;
  }

  /** M1b 主动技：成功释放一次（PlayScene 在 ActiveSkill.tryCast 返回 true 后调用） */
  recordActiveSkillCast(): void {
    this.activeSkillCasts += 1;
  }

  /**
   * M3 真机埋点：一次三选一出现（PlayScene.onLevelUp 在 rollThreeV2 返回后调用）。
  /** B6-W5：衍生技伤害累计（占比分母由 totalDamageDealt 提供；share = derivative/total） */
  recordDerivativeDamage(damage: number): void {
    this.derivativeDamage += Math.max(0, damage);
  }

  /** B6-W5：全局伤害累计（PlayScene 击杀/武器伤害事件近似） */
  recordTotalDamage(damage: number): void {
    this.totalDamageDealt += Math.max(0, damage);
  }

  /** B6-W5：质变卡获取时点（双节拍锚 30~60s / 90~150s） */
  recordMutationTaken(order: 1 | 2, nowSeconds: number): void {
    if (order === 1) this.mutationCard1AtSeconds = nowSeconds;
    else this.mutationCard2AtSeconds = nowSeconds;
  }

  /** B6-W5：共鸣达成（时点 + 对 id） */
  recordResonance(pairId: string, nowSeconds: number): void {
    this.resonancePairId = pairId;
    this.resonanceAtSeconds = nowSeconds;
  }

  /** B6-W5：复活触发 +1（HUD 复活次数指示同源） */
  recordTalentRevive(): void {
    this.talentReviveCount += 1;
  }

  /** B6-W5：精英 offer 发放 +1（Q-f 串联每次） */
  recordEliteOffer(): void {
    this.eliteOfferCount += 1;
  }

  /** B6-W5：树质变节点点亮数（开局时从树应用快照写入） */
  setTreeMutationCount(count: number): void {
    this.treeMutationCount = count;
  }

  /** B6-W5：衍生技 DPS 占比（EG-9 12~18% 锚；分母 ≤0 → null） */
  derivativeDpsShareOf(): number | null {
    return this.totalDamageDealt > 0 ? this.derivativeDamage / this.totalDamageDealt : null;
  }

  /** B6-W5：圣物伤害占比（<5% 红线；圣物无独立伤害段（演出型）→ 恒 0，断言口径预留） */
  relicDpsShareOf(): number | null {
    return this.totalDamageDealt > 0 ? 0 : null;
  }

  /** M3 真机埋点：三选一出现轮数（offersPerRun；onLevelUp 每轮 +1）。
   * offersPerRun +1；逐卡统计 related 标记（保底席位判定写回 option.related）。
   */
  recordUpgradeOffered(options: readonly UpgradeV2Option[]): void {
    this.offersPerRun += 1;
    this.totalOfferCards += options.length;
    for (const o of options) if (o.related) this.relatedOfferCards += 1;
  }

  /** M3 真机埋点：拾取经验累计（PlayScene.finishGame 从 XpManager.xpGained 汇入） */
  recordXpGained(amount: number): void {
    this.xpGainedPerRun += amount;
  }

  /** M3 真机埋点：一次进化完成（PlayScene.onUpgradeChosen 消费进化卡成功时调用） */
  recordEvolutionComplete(): void {
    this.evolutionCompleteCount += 1;
  }

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

  /** E4-S4：v2 池纠结埋点 */
  recordHesitationV2(dwellSeconds: number, options: readonly UpgradeV2Option[]): void {
    if (isHesitationV2(dwellSeconds, options)) this.hesitationCount += 1;
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
      activeSkillCasts: this.activeSkillCasts,
      offersPerRun: this.offersPerRun,
      xpGainedPerRun: this.xpGainedPerRun,
      evolutionCompleteCount: this.evolutionCompleteCount,
      evolutionComplete: evolutionCompleted(this.evolutionCompleteCount),
      relatedCardShare: relatedCardShareOf(this.relatedOfferCards, this.totalOfferCards),
      derivativeDpsShare: this.derivativeDpsShareOf(),
      relicDpsShare: this.relicDpsShareOf(),
      mutationCard1AtSeconds: this.mutationCard1AtSeconds,
      mutationCard2AtSeconds: this.mutationCard2AtSeconds,
      resonanceAtSeconds: this.resonanceAtSeconds,
      resonancePairId: this.resonancePairId,
      talentReviveCount: this.talentReviveCount,
      eliteOfferCount: this.eliteOfferCount,
      treeMutationCount: this.treeMutationCount,
    };
  }
}
