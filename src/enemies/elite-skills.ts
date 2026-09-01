/**
 * enemies/elite-skills.ts —— 精英技能化·参数与纯函数（W-16，gdd-enemies-v3 §③-4 / MN-20）
 *
 * 统一模板：触发距离 → 蓄力（telegraph 渐亮）→ 释放 → 反制窗口/硬直 → CD。
 * 技能伤 = 独立技能伤字段（不沿用面板接触伤），进精英独立曲线。
 *
 * MN-20 打断原则（全精英通用，定稿）：
 * 1. 硬控（眩晕）可打断蓄力——受控时长走精英 ×0.5（ccProfile tier 派生，status 层）
 * 2. 蓄力末段 0.3s 锁定窗（霸体，硬控无效）——防 ICD 内连环锁死
 * 3. 软控（减速）不打断不延长蓄力
 * 4. ICD 沿用状态层 10s/单目标（状态结束起算，status-engine 已实现）
 * 5. Boss「吟唱/施法硬直」不是蓄力，不适用本原则（§③-4-0 ⑤；Boss 硬控免疫独立）
 * 打断 = 取消本次攻击并进入 CD 的 50%（防白嫖）。
 */

import type { EnemyId } from '@/config/balance';

/**
 * P0-5 精英技能化门控（gdd-spawner-v2 §5.4 轨③ / gdd-enemies-v3 §⑥-6）：
 * 局时 < 180s 精英 = 厚血无技能（不进 windup）；180s 起技能化 + 词缀。
 * 已在场精英不追溯切形态（§⑥-6 可读性红线）：本门控逐帧判定，到点后下一次
 * 触发距离检查才进入 windup = 「下一循环才开技能」语义。
 */
export const ELITE_SKILL_UNLOCK_SECONDS = 180;

/** 精英技能相位（统一状态机） */
export type EliteSkillPhase = 'idle' | 'windup' | 'warning' | 'active' | 'recover';

/** 精英技能参数（§③-4 逐项锚） */
export interface EliteSkillParams {
  eliteId: EnemyId;
  name: string;
  /** 触发距离 px */
  triggerDist: number;
  /** 蓄力时长 s（telegraph 渐亮；MN-20 可打断段） */
  windup: number;
  /** 预警亮起时长 s（锁定窗；warning 相位） */
  telegraph: number;
  /** 释放持续 s（扫 0.1 瞬发 / 冲刺 0.67 / 连射 0.9） */
  activeDur: number;
  /** 硬直 s（反制输出窗：扫挥空 0.6 / 冲过头 1.2 / 驻停后 0.5） */
  recover: number;
  /** CD s */
  cd: number;
  /** 技能伤（独立字段） */
  damage: number;
  /** 蓄力末段锁定窗 s（MN-20，0.3） */
  lockWindow: number;
  /** 释放判定形状（W-13 telegraph 演出消费） */
  shape: 'arc' | 'dash-line' | 'warning-circle' | 'volley-line';
  /** 判定范围 px（arc 半径 / 线宽半宽 / 圈半径） */
  range: number;
}

/** 五精英技能参数（§③-4-1~4-5；g3_3 石甲狼无主动技能 = 双阶段，另走 armor 分池） */
export const ELITE_SKILLS: Record<'enemy_g1_6' | 'enemy_g2_4' | 'enemy_g1_8' | 'enemy_g2_5', EliteSkillParams> = {
  enemy_g1_6: {
    eliteId: 'enemy_g1_6', name: '180° 蓄力扫',
    triggerDist: 100, windup: 0.9, telegraph: 0, activeDur: 0.1, recover: 0.6,
    cd: 4, damage: 22, lockWindow: 0.3, shape: 'arc', range: 130,
  },
  enemy_g2_4: {
    eliteId: 'enemy_g2_4', name: '锁定冲刺',
    triggerDist: 150, windup: 0.5, telegraph: 0, activeDur: 0.67, recover: 1.2,
    cd: 4.5, damage: 20, lockWindow: 0.3, shape: 'dash-line', range: 30,
  },
  enemy_g1_8: {
    eliteId: 'enemy_g1_8', name: '读圈骨矛 3 连射',
    triggerDist: 260, windup: 1.0, telegraph: 0.8, activeDur: 0.3, recover: 0.5,
    cd: 4, damage: 18, lockWindow: 0.3, shape: 'warning-circle', range: 90,
  },
  enemy_g2_5: {
    eliteId: 'enemy_g2_5', name: '3 连烛火血弹',
    triggerDist: 320, windup: 0.4, telegraph: 0, activeDur: 0.6, recover: 0.4,
    cd: 3.5, damage: 8, lockWindow: 0.3, shape: 'volley-line', range: 260,
  },
};

/** 石甲狼双阶段（§③-4-3）：石甲分池 = 总 HP 60%（400 → 石甲 240 + 本体 160） */
export function stoneWolfArmorSplit(totalHp: number): { stone: number; body: number } {
  return { stone: Math.round(totalHp * 0.6), body: totalHp - Math.round(totalHp * 0.6) };
}

/** 石甲期面板（移速 45→36 = ×0.8；攻击抬手 ×1.3 → interval ×1.3） */
export const STONE_WOLF_STONE_PHASE = { speedMult: 0.8, intervalMult: 1.3 } as const;
/** 破甲后（移速 ×1.35 ≈ 48.6；攻速 ×1.4 → interval ÷1.4；狂暴期持续至死亡） */
export const STONE_WOLF_BROKEN_PHASE = { speedMult: 1.35, intervalDiv: 1.4 } as const;

/**
 * MN-20 蓄力可打断判定：
 * - 相位须为 windup；蓄力已进入末段锁定窗（elapsed ≥ windup − 0.3）→ 不可打断（霸体）
 * - 打断代价 = 本次攻击取消 + CD ×50%（返回 cdRemaining）
 */
export function eliteInterruptible(params: EliteSkillParams, phase: EliteSkillPhase, windupElapsed: number): boolean {
  if (phase !== 'windup') return false;
  return windupElapsed < params.windup - params.lockWindow - 1e-9; // 浮点边界容差
}

export function interruptCd(params: EliteSkillParams): number {
  return params.cd * 0.5;
}

/** 破甲判定（石甲池清零 → 完全破碎；溢出伤害不跨池由调用方分池结算） */
export function stoneWolfBroken(armorRemaining: number): boolean {
  return armorRemaining <= 0;
}

/** 石甲期外观（ENEMY_CONFIGS.enemy_g3_3.frame） */
export const STONE_WOLF_FRAME = 'enemy-stonewolf';
/** 破甲期外观（G-4；同族剥甲，缺帧时 tick 保持上一 idle） */
export const STONE_WOLF_BROKEN_FRAME = 'enemy-stonewolf-broken';

export function stoneWolfCostumeFrame(broken: boolean): typeof STONE_WOLF_FRAME | typeof STONE_WOLF_BROKEN_FRAME {
  return broken ? STONE_WOLF_BROKEN_FRAME : STONE_WOLF_FRAME;
}
