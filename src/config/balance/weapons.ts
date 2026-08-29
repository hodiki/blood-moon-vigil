/**
 * config/balance/weapons.ts —— 武器数值（Demo 3 武 + 通武 14 配置 + 超武 7 合成）
 *
 * balance.ts 域拆分（EG-1）纯搬移：数值与注释原样保留，不改任何行为。
 * legacy ENEMIES 与 CONFIGS 双源现状原样搬移（双源收敛属后续批次，B1 不动语义）。
 */

import type { PowerTag, WeaponClass, WeaponId, EvoId, UpgradeId } from './ids';

/**
 * 武器数值（weapons §③ 数值表，E2-S3 / weapons/*.test 埋点断言）。
 * 伤害流程：命中伤害 = 基础伤害 × 总倍率（weapons §③，初始倍率 1.0）。
 */
export const WEAPONS = {
  /** 自动飞弹「血月猎手」：12 伤 / 1.2s 冷却 / 400px/s 追踪 / 3s 飞行寿命 / 同屏 ≤8 */
  MISSILE: { DAMAGE: 12, COOLDOWN: 1.2, SPEED: 400, LIFETIME: 3, MAX_ACTIVE: 8, RADIUS: 6 },
  /** 护体环绕球「守夜之环」：3 颗基础 / 半径 80px / 240°/s（1.5s/圈）/ 8 伤 / 同目标 0.4s CD / 最多 6 颗 */
  ORBIT: {
    BASE_COUNT: 3,
    RADIUS: 80,
    ANGULAR_SPEED_DEG: 240,
    DAMAGE: 8,
    PER_TARGET_COOLDOWN: 0.4,
    MAX_COUNT: 6,
    ORB_RADIUS: 10,
  },
  /** 定时冲击波「月蚀脉冲」：60 伤 / 8s 冷却 / 半径 280px / 扩散 0.4s / 全方向穿透 */
  SHOCKWAVE: {
    DAMAGE: 60,
    COOLDOWN: 8,
    RADIUS: 280,
    EXPAND_SECONDS: 0.4,
    KNOCKBACK_DISTANCE: 80, // 击退 80px（upgrade-pool 第 7 项，E3-S5 写回）
  },
} as const;

/** 武器初始 DPS 参考（weapons §③：飞弹 10 · 环绕球 ~16（60% 命中率）· 冲击波 7.5 → 合计 ≈33.5）
 * 口径说明（design-review-e3 §3）：33.5 为「三武器齐备」FULL_KIT 参考值，非开局实际 DPS
 * （开局仅自动飞弹，实际 DPS=10，见 upgrade-pool §③ 初始武器门控）。不改数值，仅澄清口径。 */
export const INITIAL_DPS_REFERENCE = 33.5;

/**
 * 武器配置（gdd-weapons-v2 §3.2~3.5，逐项继承 content-design-outline §3.2）。
 * 字段按类可选：骨架阶段全量落表；伤害列口径见 damageDesc（C2/C3 为每秒 tick）。
 */
export interface WeaponConfig {
  id: WeaponId;
  name: string;
  class: WeaponClass;
  powerTag: PowerTag;
  /** 帧名（content-id-frame-map §2；M4 替换基准，须在 frame-registry 中） */
  frame: string;
  /** 基础单目标等效 DPS（gdd-weapons-v2 §3.6，倍率 1.0） */
  baseDps: number;
  /** 手感/定位（GDD §3.2~3.5 手感列） */
  feel: string;
  /** GDD 伤害列原文（如 10×5 发 / 20/s） */
  damageDesc?: string;
  damage?: number;
  cooldown?: number;
  speed?: number;
  returnSpeed?: number;
  lifetime?: number;
  maxActive?: number;
  range?: number;
  pierce?: number;
  hitRate?: number;
  pellets?: number;
  spreadDeg?: number;
  baseCount?: number;
  maxCount?: number;
  radius?: number;
  angularSpeedDeg?: number;
  perTargetCooldown?: number;
  slowPct?: number;
  slowDuration?: number;
  auraDps?: number;
  auraRadius?: number;
  damageReduction?: number;
  duration?: number;
  summonCount?: number;
  attackInterval?: number;
  respawnCd?: number;
  knockback?: number;
}

/** 武器表 14（gdd-weapons-v2 §3.2~3.5；wpn_a_5 骨钉标枪 powerTag 归 BLOOD，consistency C1） */
export const WEAPON_CONFIGS: Record<WeaponId, WeaponConfig> = {
  wpn_a_1: {
    id: 'wpn_a_1', name: '血月猎手', class: 'A', powerTag: 'MOON', frame: 'missile', baseDps: 9.0,
    feel: '高频单体·银制月光箭（银质材质共存，主 tag MOON，无数值影响）',
    damage: 12, cooldown: 1.2, speed: 400, lifetime: 3, maxActive: 8, pierce: 0, hitRate: 0.9, damageDesc: '12',
  },
  wpn_a_2: {
    id: 'wpn_a_2', name: '银针连弩', class: 'A', powerTag: 'SILVER', frame: 'proj-crossbow', baseDps: 10.7,
    feel: '高速直射·穿群',
    damage: 8, cooldown: 0.45, speed: 520, lifetime: 1.2, maxActive: 6, range: 400, pierce: 1, hitRate: 0.75, damageDesc: '8',
  },
  wpn_a_3: {
    id: 'wpn_a_3', name: '圣银火铳', class: 'A', powerTag: 'SILVER', frame: 'proj-blunderbuss', baseDps: 15.9,
    feel: '霰弹爆发·近距',
    damage: 10, cooldown: 2.2, speed: 420, lifetime: 0.8, maxActive: 15, range: 220, pellets: 5, spreadDeg: 45, hitRate: 0.6, damageDesc: '10×5 发（扇形 45°）',
  },
  wpn_a_4: {
    id: 'wpn_a_4', name: '幽灵飞刃', class: 'A', powerTag: 'MOON', frame: 'proj-boomerang', baseDps: 13.3,
    feel: '往返双段·穿怪',
    damage: 18, cooldown: 1.6, speed: 380, returnSpeed: 500, maxActive: 4, hitRate: 0.75, damageDesc: '18+18（去/回）',
  },
  wpn_a_5: {
    id: 'wpn_a_5', name: '骨钉标枪', class: 'A', powerTag: 'BLOOD', frame: 'proj-javelin', baseDps: 8.0,
    feel: '低频贯穿·重型（穿群 22+）',
    damage: 30, cooldown: 3.0, speed: 700, lifetime: 1.2, maxActive: 3, range: 560, pierce: 3, hitRate: 0.75, damageDesc: '30（贯穿 3，射程 560）',
  },
  wpn_b_1: {
    id: 'wpn_b_1', name: '守夜之环', class: 'B', powerTag: 'HALLOWED', frame: 'orb', baseDps: 16.0,
    feel: '防御环绕·均衡',
    damage: 8, baseCount: 3, maxCount: 6, radius: 80, angularSpeedDeg: 240, perTargetCooldown: 0.4, hitRate: 0.6, damageDesc: '8',
  },
  wpn_b_2: {
    id: 'wpn_b_2', name: '荆棘圣环', class: 'B', powerTag: 'HALLOWED', frame: 'orb-thorn', baseDps: 12.8,
    feel: '控制环绕·减速',
    damage: 8, baseCount: 4, maxCount: 6, radius: 72, angularSpeedDeg: 180, perTargetCooldown: 0.4, slowPct: 0.3, slowDuration: 1, hitRate: 0.6, damageDesc: '8 + 减速 30%（1s）',
  },
  wpn_b_3: {
    id: 'wpn_b_3', name: '圣光壁垒', class: 'B', powerTag: 'HALLOWED', frame: 'aura-barrier', baseDps: 4.8,
    feel: '防御领域·减伤',
    auraDps: 6, auraRadius: 120, damageReduction: 0.1, damageDesc: '6/s（光环 120px）+ 承伤 -10%',
  },
  wpn_c_1: {
    id: 'wpn_c_1', name: '月蚀脉冲', class: 'C', powerTag: 'MOON', frame: 'shockwave', baseDps: 7.5,
    feel: '低频清屏·冲击波',
    damage: 60, cooldown: 8, radius: 280, duration: 0.4, hitRate: 1.0, damageDesc: '60（全向穿透）',
  },
  wpn_c_2: {
    id: 'wpn_c_2', name: '血池喷涌', class: 'C', powerTag: 'BLOOD', frame: 'ring-bloodpool', baseDps: 8.0,
    feel: '持续区域·血池',
    damage: 20, cooldown: 6, radius: 180, duration: 3, slowPct: 0.2, hitRate: 1.0, damageDesc: '20/s（池内多敌 ×4~6）',
  },
  wpn_c_3: {
    id: 'wpn_c_3', name: '审判圣火', class: 'C', powerTag: 'HALLOWED', frame: 'ring-holyfire', baseDps: 8.8,
    feel: '爆发灼烧·圣火',
    damage: 35, cooldown: 8, radius: 200, duration: 2.5, hitRate: 1.0, damageDesc: '35/s（火内多敌 ×4~6）',
  },
  wpn_d_1: {
    id: 'wpn_d_1', name: '血蝠群', class: 'D', powerTag: 'BLOOD', frame: 'summon-bat', baseDps: 11.1,
    feel: '自动增援·吸血流',
    damage: 6, summonCount: 2, attackInterval: 0.5, lifetime: 12, respawnCd: 5, hitRate: 0.75, damageDesc: '2 只 × 6/0.5s',
  },
  wpn_d_2: {
    id: 'wpn_d_2', name: '狼影猎犬', class: 'D', powerTag: 'BEAST', frame: 'summon-hound', baseDps: 8.9,
    feel: '召唤肉盾·撕咬',
    damage: 15, summonCount: 1, attackInterval: 1.0, lifetime: 15, respawnCd: 4, hitRate: 0.75, damageDesc: '1 只 × 15/1s',
  },
  wpn_d_3: {
    id: 'wpn_d_3', name: '断罪锁链', class: 'D', powerTag: 'HALLOWED', frame: 'beam-chain', baseDps: 7.4,
    feel: '定向击退·打断',
    damage: 25, cooldown: 3.5, range: 200, knockback: 100, hitRate: 0.75, damageDesc: '25 + 击退 100（直线 200px）',
  },
};

/** 超武合成映射（content-design-outline §3.3 / gdd-weapons-v2 §5.2：weapon_evolution { wpnId, keyId, evoId }） */
export interface EvolutionConfig {
  evoId: EvoId;
  name: string;
  wpnId: WeaponId;
  keyId: UpgradeId;
  /** 等效 DPS（gdd-weapons-v2 §5.2 数值对齐） */
  baseDps: number;
  frame: string;
  effect: string;
}

/** 超武表 7（gdd-weapons-v2 §5.2 / content-id-frame-map §2） */
export const EVOLUTIONS: readonly EvolutionConfig[] = [
  { evoId: 'evo_moonwrath', name: '血月天罚', wpnId: 'wpn_a_1', keyId: 'key_scope', baseDps: 27.0, frame: 'super-moonwrath', effect: '3 连追踪弹幕，每发命中分裂 1 次级弹（×0.6）' },
  { evoId: 'evo_silverblast', name: '血银霰弹', wpnId: 'wpn_a_3', keyId: 'key_silver', baseDps: 27.2, frame: 'super-silverblast', effect: '8 发扇形，命中爆炸（60px 溅射）' },
  { evoId: 'evo_seraphring', name: '炽天使之环', wpnId: 'wpn_b_1', keyId: 'key_holy', baseDps: 28.8, frame: 'super-seraphring', effect: '6 颗大球，命中击退 60px，球体碰撞后 0.5s 小爆' },
  { evoId: 'evo_totaleclipse', name: '月全食', wpnId: 'wpn_c_1', keyId: 'key_tome', baseDps: 15.0, frame: 'super-totaleclipse', effect: '双脉冲（0.4s 间隔），半径 420，附加 1s 眩晕' },
  { evoId: 'evo_bloodsea', name: '血海', wpnId: 'wpn_c_2', keyId: 'key_grail', baseDps: 15.4, frame: 'super-bloodsea', effect: '地面池 300px，持续 5s，减速 40%' },
  { evoId: 'evo_batstorm', name: '血蝠风暴', wpnId: 'wpn_d_1', keyId: 'key_pact', baseDps: 33.3, frame: 'super-batstorm', effect: '6 只蝙蝠，击杀吸血 0.5 HP/只' },
  { evoId: 'evo_packleader', name: '狼群领袖', wpnId: 'wpn_d_2', keyId: 'key_bone', baseDps: 26.7, frame: 'super-packleader', effect: '3 只猎犬，撕咬附带 30% 减速 1s' },
];
