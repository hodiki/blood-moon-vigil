/**
 * tools/sim/sim-config.ts —— 沙盘移动/生存模型参数（SIM-W1，eng-impact §4.3 校准批次）
 *
 * ⚠ 近似模型声明：1D 径向等效走位（玩家移动 = 敌相对速度修正），最终以真机为准。
 * 全部参数配置化（校准批次可机械回填）；假设清单见 README-sim.md。
 */

/** 专武走位模板（GDD §3 手感归属 → 距离带，px）：min=后撤阈值 / max=逼近阈值 */
export type KitingBand = { min: number; max: number };

export interface SimMovementParams {
  /** 玩家移速 px/s（PLAYER 基准锚） */
  playerSpeed: number;
  /** 绕行等效系数（最重要近似参数，真机校准目标）：1D 后撤速度 = playerSpeed × 本系数。
   *  语义 = 2D 沿环切向绕行时的径向拉开等效 >1（敌群非单列，玩家可穿缝绕行）；1.0 = 最坏直线对逃。 */
  retreatSpeedMult: number;
  /** 达后撤边界后的沿边绕行径向分量倍率（×playerSpeed；等效贴边绕大圈的残余拉开） */
  capEdgeDriftMult: number;
  /** 各武器距离带（键 = exclusiveId 或 'fallback'） */
  kitingBands: Record<string, KitingBand>;
  /** 逼近速度倍率（趋近敌群时打折——攻击需站定窗口的近似） */
  advanceSpeedMult: number;
  /** 玩家碰撞半径（接触判定 radius + grace） */
  playerRadius: number;
}

export const SIM_MOVEMENT_DEFAULTS: SimMovementParams = {
  playerSpeed: 150,
  retreatSpeedMult: 1.5,
  capEdgeDriftMult: 0.6,
  kitingBands: {
    // 贴身近战系：领域/连击贴脸
    xw_lantern: { min: 70, max: 120 },
    xw_twinblades: { min: 40, max: 80 },
    xw_axe: { min: 50, max: 90 },
    // 中距领域/爆发
    xw_bell: { min: 110, max: 170 },
    xw_cross: { min: 150, max: 230 },
    xw_horn: { min: 140, max: 210 },
    // 风筝远程系
    xw_revolver: { min: 200, max: 280 },
    xw_longbow: { min: 260, max: 340 },
    fallback: { min: 140, max: 200 },
  },
  advanceSpeedMult: 0.6,
  playerRadius: 14,
};

/** 通武锚 DPS 表（gdd-weapons-v2 §3；b/d 树工况的通武贡献近似——锚点待武器域复核） */
export const COMMON_WEAPON_ANCHOR_DPS: Record<string, number> = {
  wpn_a_1: 12.5, wpn_a_2: 10.7, wpn_a_3: 11.2, wpn_a_4: 13.3, wpn_a_5: 8.0,
  wpn_b_1: 16.0, wpn_b_2: 9.5, wpn_b_3: 4.8,
  wpn_c_1: 10.3, wpn_c_2: 9.8, wpn_c_3: 8.8,
  wpn_d_1: 9.6, wpn_d_2: 8.9, wpn_d_3: 7.4,
};

/** 树工况（GT-7/8 知情设计矩阵；eng-impact §B6 校准） */
export type TreeScenario = 'none' | 'b' | 'bd' | 'bds1';

/** 树工况 → 开局附加 DPS（专武 partner 通武锚 + 预选锚）与 s1 窗口乘区 */
export function treeScenarioDps(scenario: TreeScenario, exclusiveId: string): { flatDps: number; s1Mult: number } {
  const pairWeapon: Record<string, string> = {
    xw_lantern: 'wpn_b_1', xw_revolver: 'wpn_a_2', xw_twinblades: 'wpn_a_4', xw_longbow: 'wpn_a_5',
    xw_bell: 'wpn_b_3', xw_cross: 'wpn_c_3', xw_axe: 'wpn_d_3', xw_horn: 'wpn_d_2',
  };
  let flatDps = 0;
  if (scenario === 'b' || scenario === 'bd' || scenario === 'bds1') {
    flatDps += COMMON_WEAPON_ANCHOR_DPS[pairWeapon[exclusiveId] ?? 'wpn_b_1'] ?? 0;
  }
  if (scenario === 'bd' || scenario === 'bds1') {
    flatDps += COMMON_WEAPON_ANCHOR_DPS['wpn_a_2'] ?? 0; // Q-d 预选典型 = 银针连弩
  }
  return { flatDps, s1Mult: scenario === 'bds1' ? 1.2 : 1 };
}
