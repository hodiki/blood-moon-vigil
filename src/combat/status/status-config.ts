/**
 * combat/status/status-config.ts —— CC 状态效果层 · 配置（gdd-status-effects §3.3/§3.4/§④/§⑥）
 *
 * 配置驱动（GDD 验收判据 ⑧-1：叠加规则/ICD/抗性全部实装且配置驱动，非硬编码）。
 *
 * 抗性默认表（§3.4，裁决来源 WD-6「Boss 硬控免疫、精英受控折减 ×0.5」）：
 * | 目标   | 眩晕（硬控）      | 减速（软控）      | 易伤       |
 * | Boss   | 免疫              | 生效              | 生效       |
 * | 精英   | 生效，时长 ×0.5   | 生效，时长 ×0.5   | 生效（不折减）|
 * | 普通   | 生效              | 生效              | 生效       |
 *
 * 每敌 CC 抗性覆写字段位（§⑥-1）：怪物域重做（enemies-v3）时在敌配置逐敌覆写；
 * 本批仅预留字段位与解析函数，接线在怪物域批次（B1 范围裁定：只建层 + API + 字段位）。
 */

import type { StatusKind } from './status-types';

/** 硬控（眩晕）通用内置冷却：10s / 单目标（锚，gdd-status-effects §3.3） */
export const CC_ICD_SECONDS = 10;

/** 精英受控时长折减倍率（gdd-status-effects §3.4：硬控/软控 ×0.5；易伤不折减） */
export const ELITE_CC_DURATION_MULT = 0.5;

/** 敌怪 tier（抗性默认表的维度；与 ENEMY_CONFIGS.tier 语义对齐，Boss 走 Boss 类） */
export type CcTier = 'normal' | 'elite' | 'boss';

/** 单维 CC 抗性覆写（gdd-status-effects §⑥-1 字段位；怪物域批次逐敌填充，字段可省略=走 tier 默认） */
export interface CcResistanceOverride {
  /** 免疫：true = 完全免疫该维（如 Boss 对硬控） */
  immune?: boolean;
  /** 时长折减倍率（1 = 无折减；精英硬控/软控 = 0.5） */
  durationMult?: number;
}

/** 单维 CC 抗性完整规则（默认表用：immune/durationMult 必填，解析结果不再有 undefined） */
export interface CcResistanceRule {
  immune: boolean;
  durationMult: number;
}

/** 目标 CC 抗性画像（applyStatus 的抗性入参；默认 {} = 普通敌全额生效） */
export interface CcProfile {
  /** tier：默认抗性按 §3.4 表解析；缺省 = normal */
  tier?: CcTier;
  /** 每敌覆写字段位（§⑥-1；优先级高于 tier 默认表） */
  ccResistance?: Partial<Record<StatusKind, CcResistanceOverride>>;
}

/** 抗性解析结果（引擎消费） */
export interface ResolvedCcResistance {
  /** 完全免疫（硬控被 Boss 免疫 / 逐敌覆写免疫） */
  immune: boolean;
  /** 时长折减倍率（≥0；0 等效瞬时即无意义，配置侧应改用 immune） */
  durationMult: number;
}

/** tier → 各维默认抗性（gdd-status-effects §3.4 表的唯一数据源；规则必填形态） */
export const CC_RESISTANCE_DEFAULTS: Record<CcTier, Readonly<Record<StatusKind, CcResistanceRule>>> = {
  normal: {
    stun: { immune: false, durationMult: 1 },
    slow: { immune: false, durationMult: 1 },
    vulnerable: { immune: false, durationMult: 1 },
  },
  elite: {
    // 精英：硬控/软控时长 ×0.5（0.5s 级微眩晕等效 0.25s，R2 §C1）；易伤不折减（数值减益，锚点）
    stun: { immune: false, durationMult: ELITE_CC_DURATION_MULT },
    slow: { immune: false, durationMult: ELITE_CC_DURATION_MULT },
    vulnerable: { immune: false, durationMult: 1 },
  },
  boss: {
    // Boss：硬控免疫（定稿，WD-6；韧性条不做）；软控/易伤生效
    stun: { immune: true, durationMult: 1 },
    slow: { immune: false, durationMult: 1 },
    vulnerable: { immune: false, durationMult: 1 },
  },
};

/**
 * 抗性解析：逐敌覆写（§⑥-1）优先于 tier 默认表；同维字段逐项覆盖（immune/durationMult 可独立覆写）。
 * 纯函数（无副作用），测试断言「Boss 免疫 / 精英 ×0.5 / 覆写优先」矩阵用。
 */
export function resolveCcResistance(kind: StatusKind, profile: CcProfile = {}): ResolvedCcResistance {
  const tier: CcTier = profile.tier ?? 'normal';
  const base = CC_RESISTANCE_DEFAULTS[tier][kind];
  const override = profile.ccResistance?.[kind];
  return {
    immune: override?.immune ?? base.immune,
    durationMult: override?.durationMult ?? base.durationMult,
  };
}

// ============================================================================
// §④ 现役 CC 效果登记表（定稿口径；来源-状态-参数断言测试的数据源，验收判据 ⑧-2）
// 数值一律为锚点，待模拟验证（gdd-status-effects §⑤）。
// ============================================================================

/** 登记表条目种类：三类状态之一，或 'none'（非状态行——位移/待迁移收编） */
export type CcRegistryKind = StatusKind | 'none';

export interface CcEffectRegistryEntry {
  /** 来源（§④ 表「来源」列原文） */
  source: string;
  /** 状态种类（'none' = 非状态行：R-7 位移不走枚举 / 旧武器收编待逐项映射） */
  kind: CcRegistryKind;
  /**
   * 参数值：slow = 减速比例 / vulnerable = 易伤加成 / stun = 1（占位语义）；
   * kind 'none' 行恒 0。
   */
  value: number;
  /** 持续 s；null = 常驻/随在场刷新（如破旧提灯基础减速）或非状态行 */
  durationSeconds: number | null;
  /** 备注列（含质变/共鸣/免疫口径提示） */
  note: string;
}

/** §④ 登记表 15 项逐条配置化（验收判据 ⑧-2：来源-状态-参数断言测试） */
export const CC_EFFECT_REGISTRY: readonly CcEffectRegistryEntry[] = [
  { source: '破旧提灯（基础）', kind: 'slow', value: 0.1, durationSeconds: null, note: '常驻，随在场刷新（质变 1 后 18%）' },
  { source: '亡者灯引残焰', kind: 'slow', value: 0.1, durationSeconds: 3, note: '残焰存续期' },
  { source: '圣徒左轮衍生技', kind: 'vulnerable', value: 0.15, durationSeconds: 6, note: '易伤（圣痕），末段命中挂' },
  { source: '血契双刃衍生技（血影突袭）', kind: 'vulnerable', value: 0.15, durationSeconds: 5, note: '易伤（血契印记），突进沿途' },
  { source: '月痕长弓质变卡 2（猎首之约）', kind: 'vulnerable', value: 0.2, durationSeconds: 8, note: '易伤（猎物标记），单目标' },
  { source: '月痕长弓衍生技（月痕狙击）', kind: 'stun', value: 1, durationSeconds: 1, note: 'Boss 免疫 / 精英 ×0.5' },
  { source: '安魂圣铃衍生技（安魂曲）', kind: 'slow', value: 0.3, durationSeconds: 3, note: '周身' },
  { source: '安魂钟鸣（质变 1）', kind: 'slow', value: 0.2, durationSeconds: 2, note: '亡者类敌人' },
  { source: '圣辉十字衍生技（圣辉审判）', kind: 'stun', value: 1, durationSeconds: 2, note: 'Boss 免疫 / 精英 ×0.5' },
  { source: '葬仪断罪（共鸣 R-7）', kind: 'none', value: 0, durationSeconds: null, note: '位移（拖拽 200px 拉至弧心）非状态，不走本层枚举' },
  { source: '守夜环灯（共鸣 R-1）', kind: 'stun', value: 1, durationSeconds: 0.5, note: '10s ICD（锚）；精英等效 0.25s' },
  { source: '猎月贯钉（共鸣 R-4）', kind: 'slow', value: 0.15, durationSeconds: 2, note: '图腾 60px' },
  { source: '圣物·月蚀之陨', kind: 'stun', value: 1, durationSeconds: 2, note: '全屏非 Boss；Boss 天然免疫（演出照常，视觉与逻辑分离 §⑦-2）' },
  { source: '圣物·血海退潮', kind: 'slow', value: 0.4, durationSeconds: 6, note: '全屏；单源减速上限锚 40%' },
  { source: '旧武器收编（提灯闪耀/荆棘圣环/血池等）', kind: 'none', value: 0, durationSeconds: null, note: '迁移时逐项映射（实施阶段清点，gdd-status-effects §3.5）' },
] as const;
