/**
 * _archived/enemies-legacy-panel.ts —— legacy ENEMIES 面板表·收档（W-8 双源退役，EG-2 归档不删）
 *
 * 原集成于 config/balance/enemies.ts（B1 前的唯一面板源）。W-8 起运行时面板链
 * 单源化为 ENEMY_CONFIGS / BOSSES + panel-scale（M3 仅 HP），本表仅作历史口径
 * 存档与回归对照（balance.test 归档守卫引用），禁止任何运行时消费。
 *
 * 收档时点：NV-MON-IMPL-2 基线批（W-1~9 收口）。
 * 历史决策记录：TASK-39 厚血经验 15→10 / TASK-31 Boss HP 6000→4000（数值语义见原注释）。
 */

/** 敌人面板（legacy 形状；与 ENEMY_CONFIGS 字段同构） */
export interface EnemyPanel {
  hp: number;
  speed: number;
  damage: number;
  attackInterval: number;
  radius: number;
  xp: number;
}

export type EnemyKindId = 'zombie' | 'wolf' | 'tank' | 'boss';

export const ENEMIES: Record<EnemyKindId, EnemyPanel> = {
  zombie: { hp: 12, speed: 55, damage: 10, attackInterval: 1.0, radius: 14, xp: 1 },
  wolf: { hp: 10, speed: 150, damage: 8, attackInterval: 0.8, radius: 12, xp: 2 },
  // TASK-39 R1 波次2：厚血经验 15→10（E3 预授权判据触发：R1 满局 Lv47 → 压后期经验通胀，目标 Lv42–45）
  tank: { hp: 600, speed: 35, damage: 20, attackInterval: 1.5, radius: 22, xp: 10 },
  // TASK-31 收尾节奏调整（rhythm-pace-adj §3）：Boss HP 6000→4000（-33%，匹配 6min 局成型强度）
  boss: { hp: 4000, speed: 28, damage: 30, attackInterval: 2.0, radius: 40, xp: 100 },
};
