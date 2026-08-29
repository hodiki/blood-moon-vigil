/**
 * upgrade/mutation-pipeline.ts —— 专武质变卡双节拍管线（B3-W3，gdd-upgrade-pool-v3 §3.4 / EG-3）
 *
 * 卡 1：P1 保底席位承载（S1 30~60s 窗口，全局限 1——席位判定在 upgrade-pool-v3，本管线管状态）。
 * 卡 2：赠送制不进池（§3.4），三渠道配置开关（EG-3）：
 *   1. 首精英击杀必掉（默认开）
 *   2. 兜底 N=8 次升级直发（默认开，距卡 1 后计）
 *   3. 精英宝箱（默认关，NW-2 挂账，怪物域批次回填后开启）
 * 防卡死规则（专武 GDD §6.1-4，必须实装）：卡 2 在卡 1 未取得时开出 → 进入待发队列，
 * 取卡 1 后立即补发。
 *
 * 顺序解锁（R2-2）：卡 2 写回前置 = 卡 1 已取；管线在补发/直发时保证。
 * 双节拍时点锚（模拟口径）：卡 1 30~60s / 卡 2 90~150s（UPGRADE_POOL_V3_RULES.CARD*_BEAT）。
 */

import { MUTATION_PIPELINE_DEFAULTS, UPGRADE_POOL_V3_RULES } from '@/config/balance';

/** 渠道配置（EG-3 双渠道开关；PlayScene/测试注入） */
export interface MutationChannelConfig {
  firstEliteDrop: boolean;
  fallbackNGrant: boolean;
  eliteChest: boolean;
  /** 兜底 N（距卡 1 后升级次数） */
  fallbackN: number;
}

export function defaultMutationChannels(): MutationChannelConfig {
  return {
    firstEliteDrop: MUTATION_PIPELINE_DEFAULTS.FIRST_ELITE_DROP,
    fallbackNGrant: MUTATION_PIPELINE_DEFAULTS.FALLBACK_N_GRANT,
    eliteChest: MUTATION_PIPELINE_DEFAULTS.ELITE_CHEST,
    fallbackN: UPGRADE_POOL_V3_RULES.CARD2_FALLBACK_N,
  };
}

/** 管线运行时状态（每局重置） */
export interface MutationPipelineState {
  /** 卡 1 已取（P1 席位承载结果） */
  card1Taken: boolean;
  /** 卡 2 已取 */
  card2Taken: boolean;
  /** 待发队列：卡 2 先于卡 1 开出（§6.1-4 防卡死） */
  card2Pending: boolean;
  /** 距卡 1 后升级计数（兜底 N 计） */
  upgradesSinceCard1: number;
  /** 首精英击杀是否已触发（必掉渠道一次性） */
  firstEliteConsumed: boolean;
  /** 卡 1 获取时刻（双节拍遥测口径） */
  card1TakenAtSeconds: number | null;
  /** 卡 2 获取时刻 */
  card2TakenAtSeconds: number | null;
}

export function createMutationPipeline(): MutationPipelineState {
  return {
    card1Taken: false,
    card2Taken: false,
    card2Pending: false,
    upgradesSinceCard1: 0,
    firstEliteConsumed: false,
    card1TakenAtSeconds: null,
    card2TakenAtSeconds: null,
  };
}

/** 卡 2 是否可用（顺序解锁：需卡 1 已取；待发队列中有货也算可用） */
export function card2Ready(s: MutationPipelineState): boolean {
  return s.card1Taken && (s.card2Pending || !s.card2Taken);
}

/**
 * 取卡 1（P1 席位选择回调）。
 * 若待发队列有卡 2（先开后场景）→ **立即补发**（§6.1-4 防卡死），返回 card2Granted=true。
 */
export function takeCard1(
  s: MutationPipelineState,
  nowSeconds: number,
): { card2Granted: boolean } {
  s.card1Taken = true;
  s.card1TakenAtSeconds = nowSeconds;
  if (s.card2Pending && !s.card2Taken) {
    s.card2Pending = false;
    s.card2Taken = true;
    s.card2TakenAtSeconds = nowSeconds;
    return { card2Granted: true };
  }
  return { card2Granted: false };
}

/** 取卡 2（写回回调；状态收尾） */
export function takeCard2(s: MutationPipelineState, nowSeconds: number): void {
  s.card2Taken = true;
  s.card2Pending = false;
  s.card2TakenAtSeconds = nowSeconds;
}

/**
 * 渠道触发：首精英击杀（渠道 1 默认开）。
 * 卡 1 未取 → 待发队列（防卡死）；卡 1 已取且卡 2 未取 → 直接授予。
 * 返回 { granted, queued }（granted/queued = 是否需要写回/入队）。
 */
export function onEliteKilled(
  s: MutationPipelineState,
  channels: MutationChannelConfig,
  nowSeconds: number,
  isElite: boolean,
): { granted: boolean; queued: boolean } {
  if (!channels.firstEliteDrop || s.firstEliteConsumed || !isElite) return { granted: false, queued: false };
  s.firstEliteConsumed = true;
  return grantCard2(s, channels, nowSeconds);
}

/** 渠道 3：精英宝箱（默认关；怪物域批次开启后由宝箱开启事件调用） */
export function onEliteChestOpened(
  s: MutationPipelineState,
  channels: MutationChannelConfig,
  nowSeconds: number,
): { granted: boolean; queued: boolean } {
  if (!channels.eliteChest) return { granted: false, queued: false };
  return grantCard2(s, channels, nowSeconds);
}

/** 渠道 2：兜底——距卡 1 后 N=8 次升级直发（每次升级回调判定） */
export function onUpgradeChosenForPipeline(
  s: MutationPipelineState,
  channels: MutationChannelConfig,
  nowSeconds: number,
): { granted: boolean; queued: boolean } {
  if (!s.card1Taken) {
    // 卡 1 未取：不计数（N 口径 = 距卡 1 后）；卡 2 渠道在此场景由首精英/宝箱进入待发队列
    return { granted: false, queued: false };
  }
  s.upgradesSinceCard1 += 1;
  if (!channels.fallbackNGrant || s.card2Taken) return { granted: false, queued: false };
  if (s.upgradesSinceCard1 >= channels.fallbackN) {
    return grantCard2(s, channels, nowSeconds);
  }
  return { granted: false, queued: false };
}

/** 授予/入队核心：卡 1 未取 → 待发队列；否则直接授予 */
function grantCard2(
  s: MutationPipelineState,
  _channels: MutationChannelConfig,
  nowSeconds: number,
): { granted: boolean; queued: boolean } {
  if (s.card2Taken) return { granted: false, queued: false };
  if (!s.card1Taken) {
    s.card2Pending = true; // 待发队列（防卡死；takeCard1 时立即补发）
    return { granted: false, queued: true };
  }
  s.card2Taken = true;
  s.card2TakenAtSeconds = nowSeconds;
  return { granted: true, queued: false };
}

/**
 * 双节拍校验（模拟口径，§W3 时点断言）：
 * 卡 1 ∈ 30~60s / 卡 2 ∈ 90~150s（锚；实跑分布由沙盘批次校准）。
 * 返回 { card1InWindow, card2InWindow }（null 时段 = 未获取，按 false）。
 */
export function checkBeats(s: MutationPipelineState): { card1InWindow: boolean; card2InWindow: boolean } {
  const [c1lo, c1hi] = UPGRADE_POOL_V3_RULES.CARD1_BEAT;
  const [c2lo, c2hi] = UPGRADE_POOL_V3_RULES.CARD2_BEAT;
  const card1InWindow = s.card1TakenAtSeconds !== null && s.card1TakenAtSeconds >= c1lo && s.card1TakenAtSeconds <= c1hi;
  const card2InWindow = s.card2TakenAtSeconds !== null && s.card2TakenAtSeconds >= c2lo && s.card2TakenAtSeconds <= c2hi;
  return { card1InWindow, card2InWindow };
}
