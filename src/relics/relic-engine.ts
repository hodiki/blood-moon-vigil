/**
 * relics/relic-engine.ts —— 圣物层引擎（B2-W4，gdd-exclusive-weapons §3.4/尾章）
 *
 * 获取（NW-1 = C 混合）：Boss 击杀必掉 1 枚（本图圣物池权重抽取）+ 祭坛概率第 2 枚；
 * 每局保底 1、上限 2（RELIC_RULES）。使用：专用按键 + CD 240s + 每局每枚 1 次；
 * 局内唯一、不可叠加、不可升级。
 * 红线：全程伤害占比 <5%（遥测断言 assertRelicDpsShare）。
 * CC 类效果（月蚀之陨眩晕 / 血海退潮减速）一律走状态层 applyStatus（Boss 免疫天然生效）。
 * 演出（≥1.5s 全屏级）= B6 表现批；本引擎只做数据与结算。
 */

import { RELICS, RELIC_RULES, type RelicId } from '@/config/balance';
import { applyStatus, type StatusState } from '@/combat/status/status-engine';
import type { CcProfile } from '@/combat/status/status-config';

// ============================================================================
// 获取（Boss 必掉池 / 祭坛概率池）
// ============================================================================

/** 池内圣物 id（按 RELICS.pools 过滤） */
export function relicsInPool(pool: 'boss' | 'altar'): RelicId[] {
  return (Object.keys(RELICS) as RelicId[]).filter((id) => RELICS[id].pools.includes(pool));
}

/**
 * Boss 击杀必掉抽取（本图圣物池权重抽取——首版等权；权重表 = 怪物域重做时的配置挂点）。
 * rng 注入（沙盘/测试确定性）；已持有的圣物不重复（局内唯一）。
 * 返回 null = 池空（全部已持有）。
 */
export function rollBossRelic(
  owned: readonly RelicId[],
  rng: () => number = Math.random,
): RelicId | null {
  return rollPool(relicsInPool('boss'), owned, rng);
}

/**
 * 祭坛概率第 2 枚：ALTAR_CHANCE 通过后才抽取（祭坛专属池；不与 Boss 池重复持有）。
 * 返回 { granted, relic }（granted=false = 概率未中或池空）。
 */
export function rollAltarRelic(
  owned: readonly RelicId[],
  rng: () => number = Math.random,
): { granted: boolean; relic: RelicId | null } {
  if (rng() >= RELIC_RULES.ALTAR_CHANCE) return { granted: false, relic: null };
  return { granted: true, relic: rollPool(relicsInPool('altar'), owned, rng) };
}

function rollPool(pool: readonly RelicId[], owned: readonly RelicId[], rng: () => number): RelicId | null {
  const available = pool.filter((id) => !owned.includes(id));
  if (available.length === 0) return null;
  return available[Math.floor(rng() * available.length)] ?? null;
}

// ============================================================================
// 持有与使用（每局 1~2 枚 / CD 240s / 每局每枚 1 次）
// ============================================================================

/** 单枚圣物运行时状态 */
export interface RelicSlotState {
  id: RelicId;
  /** 已使用（每局每枚 1 次） */
  used: boolean;
  /** CD 就绪时刻（秒时间戳；使用后 now + 240） */
  cdReadyAt: number;
}

/** 全局圣物运行时（每局重置） */
export interface RelicRuntimeState {
  slots: RelicSlotState[];
}

export function createRelicRuntime(): RelicRuntimeState {
  return { slots: [] };
}

/** 授予（Boss/祭坛获取统一入口；超上限拒绝——每局上限 2，返回是否授予） */
export function grantRelic(state: RelicRuntimeState, id: RelicId): boolean {
  if (state.slots.length >= RELIC_RULES.MAX_PER_RUN) return false;
  if (state.slots.some((s) => s.id === id)) return false; // 局内唯一
  state.slots.push({ id, used: false, cdReadyAt: 0 });
  return true;
}

/** 保底校验（Boss 击杀后持有数 ≥1；遥测/测试口径） */
export function hasGuaranteedDrop(state: RelicRuntimeState): boolean {
  return state.slots.length >= RELIC_RULES.GUARANTEED_PER_RUN;
}

/** 可用判定：已持有 + 未使用 + CD 就绪 */
export function canUseRelic(state: RelicRuntimeState, id: RelicId, now: number): boolean {
  const slot = state.slots.find((s) => s.id === id);
  return !!slot && !slot.used && now >= slot.cdReadyAt;
}

/**
 * 使用圣物（结算走 applyRelicEffect；返回是否真正触发）。
 * used 置位 + CD 写入（240s）；同一枚每局仅 1 次（再次使用 = false）。
 */
export function useRelic(
  state: RelicRuntimeState,
  id: RelicId,
  now: number,
  ctx: RelicEffectContext,
): boolean {
  if (!canUseRelic(state, id, now)) return false;
  const slot = state.slots.find((s) => s.id === id)!;
  slot.used = true;
  slot.cdReadyAt = now + RELIC_RULES.CD_SECONDS;
  applyRelicEffect(id, now, ctx);
  return true;
}

// ============================================================================
// 效果结算（演出型；数值锚点）
// ============================================================================

/** 圣物效果上下文（目标集合/玩家回复/承伤减免挂点） */
export interface RelicEffectContext {
  player: { x: number; y: number };
  /** 敌集合（全场；CC/伤害由效果函数筛选） */
  enemies: readonly {
    readonly active: boolean;
    hp: number;
    cc?: StatusState;
    ccProfile?: CcProfile;
    kind?: string;
  }[];
  /** 玩家回复落点（狼灵/十二灯不回血——预留） */
  healSink?: (amount: number) => void;
  /** 玩家承伤减免挂点（十二灯誓约 −20%，8s 窗口由调用方计时） */
  damageReductionSink?: (pct: number, duration: number) => void;
  /** 伤害结算落点（狼灵冲撞 30 伤；返回伤害供占比遥测） */
  damageSink?: (target: unknown, amount: number) => void;
  /**
   * P0-1 银潮汐落场银雨（GDD 尾章 #4）：(半径 px, 每秒灼烧伤, 持续秒)。
   * GDD 未列伤害值（KNOWN-GAP）→ 工程锚 220px / 6 伤/s / 8s，红线 <5% 由遥测断言守。
   * 未注入时退化为纯演出（不产生伤害）——调用方必须注入，禁止空技能。
   */
  silverRainSink?: (radius: number, dps: number, duration: number) => void;
}

/** 圣物效果总入口（CC 走状态层；每枚效果见 RELICS.effect） */
export function applyRelicEffect(id: RelicId, now: number, ctx: RelicEffectContext): void {
  const cfg = RELICS[id];
  switch (id) {
    case 'relic_moonfall': {
      // 全场月光脉冲：非 Boss 敌眩晕 2s（Boss 免疫由 resolveCcResistance 天然生效；
      // 「非 Boss」与免疫口径一致——Boss 的 ccProfile.stun.immune=true，演出照常逻辑不生效 §⑦-2）
      for (const e of ctx.enemies) {
        if (!e.active) continue;
        // P2-7② 口径注：圣物月蚀之陨为全屏脉冲，目标载荷无坐标（RelicEffectContext 最小形状），
        // 免疫反馈不接入（演出照常逻辑不生效 §⑦-2）；Boss 免疫飘字覆盖武器/衍生技/超武路径。
        if (e.cc) e.cc = applyStatus(e.cc, { kind: 'stun', value: 1, durationSeconds: cfg.params['stunDuration']!, source: id }, now, e.ccProfile).state;
      }
      break;
    }
    case 'relic_bloodtide': {
      // 全场减速 40% / 6s
      for (const e of ctx.enemies) {
        if (!e.active) continue;
        if (e.cc) e.cc = applyStatus(e.cc, { kind: 'slow', value: cfg.params['slowPct']!, durationSeconds: cfg.params['duration']!, source: id }, now, e.ccProfile).state;
      }
      break;
    }
    case 'relic_twelve_lamps': {
      // 灯环内亡者类灼烧 8 伤/s（持续 8s，tick 归调用方帧循环按 dps×dt 走 damageSink）+ 承伤 −20%
      ctx.damageReductionSink?.(cfg.params['damageReductionPct']!, cfg.params['duration']!);
      break;
    }
    case 'relic_silver_tide': {
      // P0-1：落场银雨（8s 银质灼烧场）——GDD「8s 内所有攻击附带银质灼烧演出 + 落场银雨」的
      // 伤害段落地：半径/每秒伤/时长全走配置锚（KNOWN-GAP 数值待模拟校准，红线 <5%）。
      ctx.silverRainSink?.(
        cfg.params['radius'] ?? 220,
        cfg.params['burnDps'] ?? 6,
        cfg.params['duration'] ?? 8,
      );
      break;
    }
    case 'relic_wolf_spirit': {
      // 全屏直线冲撞 30 伤 + 击退 100px（击退位移由表现层执行；伤害即时结算）
      for (const e of ctx.enemies) {
        if (!e.active || e.hp <= 0) continue;
        ctx.damageSink?.(e, cfg.params['damage']!);
      }
      break;
    }
  }
}

// ============================================================================
// 遥测：伤害占比 <5% 红线（验收判据 ⑤）
// ============================================================================

/**
 * 圣物伤害占比断言（<5%，模拟口径）：relicDamage / totalDamage。
 * totalDamage ≤ 0 兜底 0（防除零）；沙盘/结算遥测消费。
 */
export function relicDpsShare(relicDamage: number, totalDamage: number): number {
  if (totalDamage <= 0) return 0;
  return relicDamage / totalDamage;
}

/** 红线判定（占位校验口径，EG-9 同款：断言改遥测） */
export function assertRelicDpsShare(relicDamage: number, totalDamage: number): { pass: boolean; share: number } {
  const share = relicDpsShare(relicDamage, totalDamage);
  return { pass: share < RELIC_RULES.DPS_SHARE_MAX, share };
}
