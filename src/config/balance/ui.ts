/**
 * config/balance/ui.ts —— 埋点/判据/节奏常量（UI 与局终判据域）
 *
 * balance.ts 域拆分（EG-1）纯搬移：数值与注释原样保留，不改任何行为。
 */

/** 纠结时刻埋点（upgrade-pool §⑧.3 / design-review-e3 交接项 2）：停留 >3s 记为纠结 */
export const HESITATION = {
  DWELL_SECONDS: 3,
} as const;

/** 局终判据（enemies §⑤ / design-review-e3 交接项 4）：Boss 战 60~90s 为最终判据 */
export const GAME = {
  BOSS_FIGHT_TARGET_MIN: 60,
  BOSS_FIGHT_TARGET_MAX: 90,
} as const;
