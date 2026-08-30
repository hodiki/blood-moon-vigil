/**
 * enemies/noxp.ts —— 召唤物 noXp 全量原则·判定口径（W-12 / gdd-spawner-v2 §③-7 / F-4）
 *
 * 纯函数层（test-framework §1.2，可脱离 Phaser 单测）：
 * - 判定口径：生成来源 = 敌方技能 → noXp=true（零 XP / 零宝石路径）；
 *   生成来源 = 生成器（槽位池 / 方阵本体 / 保底预约）→ 正常 XP。
 * - 击杀反馈链消费：enemy.kill() payload.noXp → PlayScene 宝石生成挂点跳过；
 *   sim（tools/sim）侧 xpAcc += xpAwardForKill(...) 同口径（遥测 kills/xpGained 分账）。
 * - 祭品（decoy）为方阵本体成员，noXp=false 且 XP ×3（F-6 / enemies-v3 §⑥-8）。
 * - c 案 HP 联动系数（W-8 字段位）同层挂出：基础面板 HP × 档位系数（仅普通敌；
 *   精英/Boss 独立曲线不吃，gdd-difficulty-v3 §5.1）。
 */

/** 击杀 XP 产出来源（生成侧登记；spawner/skill 引擎按实际来源传参） */
export type KillXpSource =
  | 'spawner-slot' // 生成器槽位池（普通 XP）
  | 'spawner-guarantee' // 精英保底预约（普通 XP）
  | 'formation-body' // 方阵本体成员（普通 XP；F-4）
  | 'formation-summon' // 方阵内召唤（尸巫重召/血旗增援/苏生唤尸/狂化复活体）→ noXp
  | 'enemy-skill' // 普通敌技能召唤（圣杯侍僧等）→ noXp
  | 'boss-skill'; // Boss 技能召唤（全量）→ noXp（MN-23）

/** 敌方技能来源集合（= noXp 判定正表；spawner-v2 §③-7 判定口径） */
export const SKILL_SUMMON_SOURCES: readonly KillXpSource[] = [
  'formation-summon',
  'enemy-skill',
  'boss-skill',
];

/** 来源 → noXp 判定（敌方技能 = true；生成器/方阵本体 = false） */
export function isNoXpSource(source: KillXpSource): boolean {
  return SKILL_SUMMON_SOURCES.includes(source);
}

/** 祭品（decoy）XP 倍率锚（enemies-v3 §③-6 阵 9：XP ×3 = 高价值诱饵） */
export const DECOY_XP_MULT = 3;

/** 击杀 XP 结算入参（击杀反馈链统一消费形状） */
export interface XpAwardInput {
  /** 敌面板 / 实体携带的基础 XP（方阵本体按敌种面板，MN-25 保守锚） */
  baseXp: number;
  /** noXp 标记（静态配置 or 动态召唤来源判定；true = 零 XP） */
  noXp: boolean;
  /** 祭品标记（方阵本体特例：XP ×3） */
  decoy?: boolean;
}

/** 击杀 XP 结算（唯一出口）：noXp → 0；decoy → ×3；其余 → baseXp */
export function xpAwardForKill(input: XpAwardInput): number {
  if (input.noXp) return 0;
  if (input.decoy) return input.baseXp * DECOY_XP_MULT;
  return input.baseXp;
}

// ---- c 案 HP 联动（W-8 字段位消费；数值由 W-E 模拟裁决后冻结，本批不回填） ----

/**
 * 基础面板 HP × c 档位联动系数（gdd-difficulty-v3 §5.1 SC-2 三联动之三）。
 * 口径：仅基础面板（tier normal/fast/air/special）；精英/Boss 独立曲线不吃
 * （enemies-v3 §③-1：精英 350~500 基座、Boss 3000~4500 不随普通缩放）。
 */
export function applyCaseHpLink(
  baseHp: number,
  caseLink: number | undefined,
  tier: string,
): number {
  if (caseLink === undefined) return baseHp;
  // 精英/Boss 独立曲线（enemies-v3 §③-1 / difficulty-v3 §5.1）
  if (tier === 'elite' || tier === 'boss') return baseHp;
  return baseHp * caseLink;
}
