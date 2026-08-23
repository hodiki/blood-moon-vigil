/**
 * weapons/super-weapons.ts —— 超武 7 质变规格（E2-S7 / gdd-weapons-v2 §5.2）
 *
 * 超武 = 行为质变（非纯数值），不可逆；超武不再吃类强化（已质变，防再膨胀）。
 * 本模块为纯规格层（可单测）：每把超武的质变参数 + 等效 DPS（§5.2 数值对齐表）。
 * Phaser 装配（SuperWeaponBehavior / WeaponSystem.evolve）消费本规格。
 *
 * 质变参数（§5.2 行为质变列）：
 * - 血月天罚：3 连追踪弹幕，每发命中分裂 1 次级弹（×0.6）
 * - 血银霰弹：8 发扇形，命中爆炸（60px 溅射）
 * - 炽天使之环：6 颗大球，命中击退 60px，球体碰撞后 0.5s 小爆
 * - 月全食：双脉冲（0.4s 间隔），半径 420，附加 1s 眩晕
 * - 血海：地面池 300px，持续 5s，减速 40%
 * - 血蝠风暴：6 只蝙蝠，击杀吸血 0.5 HP/只
 * - 狼群领袖：3 只猎犬，撕咬附带 30% 减速 1s
 */

import { EVOLUTIONS, type EvoId } from '@/config/balance';

/** 超武质变模式（按行为质变列归类，装配层按模式路由） */
export type SuperWeaponMode =
  | 'homing-salvo'    // 血月天罚：3 连追踪 + 命中分裂
  | 'fan-splash'      // 血银霰弹：8 发扇形 + 命中爆炸溅射
  | 'orbit-knock'     // 炽天使之环：6 大球 + 击退 + 碰撞小爆
  | 'double-pulse'    // 月全食：双脉冲 + 眩晕
  | 'ground-pool'     // 血海：大池 + 强减速
  | 'summon-lifesteal' // 血蝠风暴：6 蝙蝠 + 击杀吸血
  | 'summon-slow';    // 狼群领袖：3 猎犬 + 撕咬减速

export interface SuperWeaponSpec {
  evoId: EvoId;
  mode: SuperWeaponMode;
  /** 等效 DPS（gdd-weapons-v2 §5.2 数值对齐列） */
  baseDps: number;
  /** 质变特效粒子预算上限（asset-spec §3.7：≤60 粒子/次，sprint-m2-plan R13） */
  particleBudget: number;
  /** 质变参数（按模式取用） */
  params: Readonly<Record<string, number>>;
  effect: string;
}

/** 超武表 7（gdd-weapons-v2 §5.2 逐项；粒子预算统一 60，asset-spec §3.7） */
export const SUPER_WEAPON_SPECS: Readonly<Record<EvoId, SuperWeaponSpec>> = {
  evo_moonwrath: {
    evoId: 'evo_moonwrath', mode: 'homing-salvo', baseDps: 27.0, particleBudget: 60,
    params: { salvos: 3, splitPerHit: 1, subDamageMult: 0.6 },
    effect: '3 连追踪弹幕，每发命中分裂 1 次级弹（×0.6）',
  },
  evo_silverblast: {
    evoId: 'evo_silverblast', mode: 'fan-splash', baseDps: 27.2, particleBudget: 60,
    params: { pellets: 8, spreadDeg: 60, splashRadius: 60, damage: 10 },
    effect: '8 发扇形，命中爆炸（60px 溅射）',
  },
  evo_seraphring: {
    evoId: 'evo_seraphring', mode: 'orbit-knock', baseDps: 28.8, particleBudget: 60,
    params: { count: 6, knockback: 60, smallBurstDelay: 0.5, radius: 96, angularSpeedDeg: 260, damage: 12 },
    effect: '6 颗大球，命中击退 60px，球体碰撞后 0.5s 小爆',
  },
  evo_totaleclipse: {
    evoId: 'evo_totaleclipse', mode: 'double-pulse', baseDps: 15.0, particleBudget: 60,
    params: { pulses: 2, pulseGap: 0.4, radius: 420, stunSeconds: 1, damage: 60 },
    effect: '双脉冲（0.4s 间隔），半径 420，附加 1s 眩晕',
  },
  evo_bloodsea: {
    evoId: 'evo_bloodsea', mode: 'ground-pool', baseDps: 15.4, particleBudget: 60,
    params: { radius: 300, duration: 5, slowPct: 0.4, damagePerSec: 20 },
    effect: '地面池 300px，持续 5s，减速 40%',
  },
  evo_batstorm: {
    evoId: 'evo_batstorm', mode: 'summon-lifesteal', baseDps: 33.3, particleBudget: 60,
    params: { count: 6, lifestealPerKill: 0.5, damage: 6, attackInterval: 0.5, lifetime: 12, respawnCd: 5 },
    effect: '6 只蝙蝠，击杀吸血 0.5 HP/只',
  },
  evo_packleader: {
    evoId: 'evo_packleader', mode: 'summon-slow', baseDps: 26.7, particleBudget: 60,
    params: { count: 3, slowPct: 0.3, slowDuration: 1, damage: 15, attackInterval: 1.0, lifetime: 15, respawnCd: 4 },
    effect: '3 只猎犬，撕咬附带 30% 减速 1s',
  },
};

/** 超武规格查询（未知 evoId → null） */
export function superWeaponSpec(evoId: EvoId): SuperWeaponSpec {
  return SUPER_WEAPON_SPECS[evoId];
}

/** 超武等效 DPS（gdd-weapons-v2 §5.2 数值对齐；与 weapon-runtime.evolutionDps 同源） */
export function superWeaponDps(evoId: EvoId): number {
  return SUPER_WEAPON_SPECS[evoId]?.baseDps ?? 0;
}

/** 全部 7 超武粒子预算 ≤60（asset-spec §3.7 / sprint-m2-plan R13） */
export const SUPER_WEAPON_PARTICLE_BUDGET = 60;

/** 超武进化链映射（源武器 → 超武；供 WeaponSystem.evolve 原子切换） */
export const SUPER_WEAPON_EVOLUTION: Readonly<Record<string, EvoId>> = (() => {
  const map: Record<string, EvoId> = {};
  for (const evo of EVOLUTIONS) map[evo.wpnId] = evo.evoId;
  return map;
})();
