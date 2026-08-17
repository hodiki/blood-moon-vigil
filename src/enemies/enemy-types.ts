/**
 * enemies/enemy-types.ts —— 敌人面板数据（ARCH §2 目录职责 / S4 / E2-S2）
 *
 * 纯数据模块（可脱离 Phaser 单测）：数值全部来自 config/balance.ts（唯一数据源），
 * 本模块只做类型收敛与导出，禁止在此改数值（改数值 = 改 GDD，需评审）。
 * Boss「血月尊者」面板本阶段落地（enemy-panel.test 断言 4 面板），实体由 E4-S2 接入。
 */

import { ENEMIES, type EnemyKindId } from '@/config/balance';

export type { EnemyKindId } from '@/config/balance';

/** 敌人面板（与 ENEMIES 同构，字段注释见 balance.ts） */
export interface EnemyPanelData {
  hp: number;
  speed: number;
  damage: number;
  attackInterval: number;
  radius: number;
  xp: number;
}

/** 面板表（唯一出口；平衡改动只允许改 balance.ts） */
export const ENEMY_PANELS: Record<EnemyKindId, EnemyPanelData> = ENEMIES;

/** 普通 3 敌（共用一池，ARCH §3.3）；Boss 独立（E4） */
export const NORMAL_ENEMY_KINDS: readonly EnemyKindId[] = ['zombie', 'wolf', 'tank'] as const;

/** 是否为普通敌人（描边纪律 RV-C1：普通敌禁止 FX.Outline，Boss 允许） */
export function isNormalEnemy(kind: EnemyKindId): boolean {
  return NORMAL_ENEMY_KINDS.includes(kind);
}

/** 面板查询（undefined 安全，避免 noUncheckedIndexedAccess 报错） */
export function enemyPanel(kind: EnemyKindId): EnemyPanelData {
  return ENEMY_PANELS[kind];
}
