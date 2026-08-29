/**
 * config/balance/upgrade.ts —— 升级池（12 项 Demo + 40 项 v2 池 + 抽取规则 + 全局效果参数）
 *
 * balance.ts 域拆分（EG-1）纯搬移：数值与注释原样保留，不改任何行为。
 */

import type { UpgradeType, UpgradeId, UpgradeTag, EvoId } from './ids';

export interface UpgradeItemData {
  id: number;
  name: string;
  type: UpgradeType;
  desc: string;
  /** UI 数值变化文案（如「+15%」「-8%」） */
  effectText: string;
  /** 叠加上限：可重复 = Infinity；第 4 项上限 3 = 6 颗 − 基础 3 颗 */
  maxStack: number;
}

/**
 * 升级池 12 项（upgrade-pool §③ 表，与 GDD 逐项一致 —— E3-S3 / upgrade-pool.test 埋点断言）。
 * 机制改变型 9/12 = 75% ≥ 50% ✔；初始武器为自动飞弹，1/2 号项为「新武器解锁」。
 */
export const UPGRADES: readonly UpgradeItemData[] = [
  { id: 1, name: '解锁「守夜之环」', type: 'mechanic', desc: '获得护体环绕球（3 颗）', effectText: '解锁新武器', maxStack: 1 },
  { id: 2, name: '解锁「月蚀脉冲」', type: 'mechanic', desc: '获得定时冲击波（280px）', effectText: '解锁新武器', maxStack: 1 },
  { id: 3, name: '飞弹分裂', type: 'mechanic', desc: '命中时额外生成 1 枚次级弹（×0.6 伤害）', effectText: '+1 次级弹', maxStack: 2 },
  { id: 4, name: '护体球 +1', type: 'mechanic', desc: '环绕球数量 +1（最多 6 颗）', effectText: '+1 颗', maxStack: 3 },
  { id: 5, name: '冲击波范围 +50%', type: 'mechanic', desc: '半径 280→420→560px', effectText: '+50%', maxStack: 2 },
  { id: 6, name: '飞弹穿透', type: 'mechanic', desc: '命中后继续飞行，穿透 1 个敌人', effectText: '穿透 1', maxStack: 1 },
  { id: 7, name: '冲击波击退', type: 'mechanic', desc: '命中附加 80px 击退', effectText: '击退 80px', maxStack: 1 },
  { id: 8, name: '吸血', type: 'mechanic', desc: '每次击杀回复 1 HP', effectText: '+1 HP/击杀', maxStack: 1 },
  { id: 9, name: '经验磁力 +100%', type: 'mechanic', desc: '拾取范围 80→160→240px', effectText: '+100%', maxStack: 2 },
  { id: 10, name: '伤害强化 +15%', type: 'numeric', desc: '总伤害倍率 +0.15', effectText: '+15%', maxStack: Number.POSITIVE_INFINITY },
  { id: 11, name: '冷却缩减 -8%', type: 'numeric', desc: '全部武器冷却 ×0.92（飞弹 1.2→1.10s）', effectText: '-8%', maxStack: 3 },
  { id: 12, name: '最大生命 +20', type: 'numeric', desc: '最大生命 +20', effectText: '+20', maxStack: 5 },
] as const;

/** 升级池项（gdd-upgrade-pool-v2 §3.2~3.5；cardKind 卡面底色分型 asset-spec §1.6） */
export interface UpgradePoolItem {
  id: UpgradeId;
  name: string;
  type: UpgradeType;
  tags: readonly UpgradeTag[];
  desc: string;
  maxStack: number;
  cardKind: 'blue-purple' | 'amber-gold';
  /** 超武钥：对应进化目标（key_* 项） */
  evolutionTarget?: EvoId;
}

/**
 * 升级池 40 项（gdd-upgrade-pool-v2 §3.2~3.5 逐项；主动技强化按角色展开 12 项）。
 * 类型口径：按 GDD v1.2 裁定 R-M1b-RULING-1 + M3-DESIGN-1 数值方向化（36/40 = 90%）——
 * 全局 6/9 机制（up_g_3 鲜血契约、up_g_4 踏月而行转机制型 + up_g_7 减伤、up_g_9 拾取范围按行为影响归机制）、
 * 钥 5/7 机制（key_scope 鹰眼镜片、key_holy 圣辉坠饰同口径归机制）、武器 12/12、主动技 12/12
 * → 合计 36/40 = 90% ≥ 50%（支柱 2）。机制型卡面一律蓝紫底（asset-spec §1.6）。
 */
export const UPGRADE_POOL: readonly UpgradePoolItem[] = [
  // ---- 全局基础 9（§3.2，tag=global；M3-DESIGN-1 数值方向化改造 up_g_1~4）----
  { id: 'up_g_1', name: '武器共鸣', type: 'numeric', tags: ['global'], desc: '总伤害倍率 +0.15（数值不变；卡面动态展示当前 build 受益武器图标）', maxStack: Number.POSITIVE_INFINITY, cardKind: 'amber-gold' },
  { id: 'up_g_2', name: '专精疾射', type: 'numeric', tags: ['global'], desc: '你持有类中冷却最短的 2 把武器冷却 ×0.88（×2）', maxStack: 2, cardKind: 'amber-gold' },
  { id: 'up_g_3', name: '鲜血契约', type: 'mechanic', tags: ['global'], desc: '最大生命 +20；受击后 5s 回复 10 HP（内置 12s CD）（×3）', maxStack: 3, cardKind: 'blue-purple' },
  { id: 'up_g_4', name: '踏月而行', type: 'mechanic', tags: ['global'], desc: '移速 +8%；击杀后 2s 移速额外 +15%（×3）', maxStack: 3, cardKind: 'blue-purple' },
  { id: 'up_g_5', name: '吸血 1HP', type: 'mechanic', tags: ['global'], desc: '每次击杀回复 1 HP', maxStack: 1, cardKind: 'blue-purple' },
  { id: 'up_g_6', name: '经验磁力 +100%', type: 'mechanic', tags: ['global'], desc: '拾取范围 ×2（140→280→420px）', maxStack: 2, cardKind: 'blue-purple' },
  { id: 'up_g_7', name: '减伤 +10%', type: 'mechanic', tags: ['global'], desc: '承伤 -10%（与圣光壁垒 -10% 加法叠加，上限 -30%）', maxStack: 3, cardKind: 'blue-purple' },
  { id: 'up_g_8', name: '濒死护盾', type: 'mechanic', tags: ['global'], desc: 'HP<25% 时获得 60 护盾，每局 1 次', maxStack: 1, cardKind: 'blue-purple' },
  { id: 'up_g_9', name: '拾取范围 +40px', type: 'mechanic', tags: ['global'], desc: '拾取范围 +40px（与磁力叠加）', maxStack: 2, cardKind: 'blue-purple' },
  // ---- 武器类强化 12（§3.3，各分支可叠 2 次）----
  { id: 'up_w_a1', name: 'A1 弹幕分裂 +1', type: 'mechanic', tags: ['weapon_class_a'], desc: '命中时额外生成 1 枚次级弹（×0.6 伤害，自动追踪）', maxStack: 2, cardKind: 'blue-purple' },
  { id: 'up_w_a2', name: 'A2 弹幕穿透 +1', type: 'mechanic', tags: ['weapon_class_a'], desc: '弹体额外穿透 1 个敌人', maxStack: 2, cardKind: 'blue-purple' },
  { id: 'up_w_a3', name: 'A3 弹幕弹速 +20%', type: 'mechanic', tags: ['weapon_class_a'], desc: '弹速 ×1.20（满层 ×1.44）', maxStack: 2, cardKind: 'blue-purple' },
  { id: 'up_w_b1', name: 'B1 环绕数量 +1', type: 'mechanic', tags: ['weapon_class_b'], desc: '环绕球/尖刺 +1', maxStack: 2, cardKind: 'blue-purple' },
  { id: 'up_w_b2', name: 'B2 环绕转速 +20%', type: 'mechanic', tags: ['weapon_class_b'], desc: '转速 ×1.20（满层 ×1.44）', maxStack: 2, cardKind: 'blue-purple' },
  { id: 'up_w_b3', name: 'B3 环绕半径 +15%', type: 'mechanic', tags: ['weapon_class_b'], desc: '半径 ×1.15（满层 ×1.32）', maxStack: 2, cardKind: 'blue-purple' },
  { id: 'up_w_c1', name: 'C1 范围半径 +25%', type: 'mechanic', tags: ['weapon_class_c'], desc: '半径 ×1.25（满层 ×1.56）', maxStack: 2, cardKind: 'blue-purple' },
  { id: 'up_w_c2', name: 'C2 范围伤害 +20%', type: 'mechanic', tags: ['weapon_class_c'], desc: '伤害 ×1.20（满层 ×1.44）', maxStack: 2, cardKind: 'blue-purple' },
  { id: 'up_w_c3', name: 'C3 范围持续 +30%', type: 'mechanic', tags: ['weapon_class_c'], desc: '持续 ×1.30（满层 ×1.69）', maxStack: 2, cardKind: 'blue-purple' },
  { id: 'up_w_d1', name: 'D1 召唤数 +1', type: 'mechanic', tags: ['weapon_class_d'], desc: '召唤物 +1', maxStack: 2, cardKind: 'blue-purple' },
  { id: 'up_w_d2', name: 'D2 召唤索敌 +30%', type: 'mechanic', tags: ['weapon_class_d'], desc: '索敌半径/追击距离 ×1.30', maxStack: 2, cardKind: 'blue-purple' },
  { id: 'up_w_d3', name: 'D3 召唤存在 +30%', type: 'mechanic', tags: ['weapon_class_d'], desc: '存在时间 ×1.30', maxStack: 2, cardKind: 'blue-purple' },
  // ---- 被动·超武钥 7（§3.4，兼进化钥）----
  { id: 'key_scope', name: '鹰眼镜片', type: 'mechanic', tags: ['key'], desc: '武器射程 +15%', maxStack: 1, cardKind: 'blue-purple', evolutionTarget: 'evo_moonwrath' },
  { id: 'key_holy', name: '圣辉坠饰', type: 'mechanic', tags: ['key'], desc: '范围 +15%', maxStack: 1, cardKind: 'blue-purple', evolutionTarget: 'evo_seraphring' },
  { id: 'key_tome', name: '月相秘典', type: 'numeric', tags: ['key'], desc: '冷却 -10%', maxStack: 1, cardKind: 'amber-gold', evolutionTarget: 'evo_totaleclipse' },
  { id: 'key_silver', name: '圣银弹丸', type: 'numeric', tags: ['key'], desc: '伤害 +12%', maxStack: 1, cardKind: 'amber-gold', evolutionTarget: 'evo_silverblast' },
  { id: 'key_pact', name: '血契印', type: 'mechanic', tags: ['key'], desc: '召唤数 +1', maxStack: 1, cardKind: 'blue-purple', evolutionTarget: 'evo_batstorm' },
  { id: 'key_bone', name: '兽骨图腾', type: 'mechanic', tags: ['key'], desc: '召唤存在 +20%', maxStack: 1, cardKind: 'blue-purple', evolutionTarget: 'evo_packleader' },
  { id: 'key_grail', name: '血祭圣杯', type: 'mechanic', tags: ['key'], desc: '范围持续 +25%', maxStack: 1, cardKind: 'blue-purple', evolutionTarget: 'evo_bloodsea' },
  // ---- 主动技强化 12（§3.5，按角色展开；各分支 1 次）----
  { id: 'up_a_cd_edmund', name: 'CD -25%（守夜人）', type: 'mechanic', tags: ['hero_edmund'], desc: '提灯闪耀 CD 20s→15s', maxStack: 1, cardKind: 'blue-purple' },
  { id: 'up_a_charge_edmund', name: '二次充能（守夜人·替换）', type: 'mechanic', tags: ['hero_edmund'], desc: '眩晕 +1s（CD 型不适用，替换槽）', maxStack: 1, cardKind: 'blue-purple' },
  { id: 'up_a_effect_edmund', name: '效果增强（守夜人）', type: 'mechanic', tags: ['hero_edmund'], desc: '眩晕 +1s / 无敌 +0.5s', maxStack: 1, cardKind: 'blue-purple' },
  { id: 'up_a_cd_cassandra', name: 'CD -25%（血猎手）', type: 'mechanic', tags: ['hero_cassandra'], desc: '血影突袭 CD 12s→9s', maxStack: 1, cardKind: 'blue-purple' },
  { id: 'up_a_charge_cassandra', name: '二次充能（血猎手）', type: 'mechanic', tags: ['hero_cassandra'], desc: '充能 8s→4s/段（等效总 CD 12s）', maxStack: 1, cardKind: 'blue-purple' },
  { id: 'up_a_effect_cassandra', name: '效果增强（血猎手）', type: 'mechanic', tags: ['hero_cassandra'], desc: '冲刺距离 +25%（240→300px）/ 标记伤害 +10%（+20%→+30%）', maxStack: 1, cardKind: 'blue-purple' },
  { id: 'up_a_cd_violet', name: 'CD -25%（修女）', type: 'mechanic', tags: ['hero_violet'], desc: '安魂曲 CD 22s→16.5s', maxStack: 1, cardKind: 'blue-purple' },
  { id: 'up_a_charge_violet', name: '二次充能（修女·替换）', type: 'mechanic', tags: ['hero_violet'], desc: '回复 +10%（CD 型不适用，替换槽）', maxStack: 1, cardKind: 'blue-purple' },
  { id: 'up_a_effect_violet', name: '效果增强（修女）', type: 'mechanic', tags: ['hero_violet'], desc: '减速 +20%（40%→60%）/ 回复 +10%（20%→30% 最大生命）', maxStack: 1, cardKind: 'blue-purple' },
  { id: 'up_a_cd_galvan', name: 'CD -25%（狼裔）', type: 'mechanic', tags: ['hero_galvan'], desc: '血月狂化 CD 24s→18s', maxStack: 1, cardKind: 'blue-purple' },
  { id: 'up_a_charge_galvan', name: '二次充能（狼裔·替换）', type: 'mechanic', tags: ['hero_galvan'], desc: '狂化中吸血 +1 HP（CD 型不适用，替换槽）', maxStack: 1, cardKind: 'blue-purple' },
  { id: 'up_a_effect_galvan', name: '效果增强（狼裔）', type: 'mechanic', tags: ['hero_galvan'], desc: '狂化 +2s（8s→10s）/ 吸血 +1 HP（击杀回 2 HP）', maxStack: 1, cardKind: 'blue-purple' },
];

/**
 * 升级池抽取规则参数（gdd-upgrade-pool-v2 §3.6 五条，v1.1 裁定后数据化）。
 * 说明：v2 抽取引擎在 E2/E3 落地；本组常量先固化为配置（禁止硬编码），
 * E1-S4 断言对齐 GDD 数值。与 Demo 差异：未解锁 ×2 → 「已拥有该类 ×2 + 未拥有 ×1」
 * （§3.6.2 注：v2 池武器解锁走类强化项解锁变体，不再需要为新类武器强制 ×2）。
 */
export const UPGRADE_POOL_RULES = {
  /** 超时自动选：三选一 30s 未选择自动取第 1 张（§3.6.5 / §⑥.1） */
  TIMEOUT_SECONDS: 30,
  /** 自动取的卡位（第 1 张 = index 0） */
  AUTO_PICK_INDEX: 0,
  /** 已拥有某类武器 ≥1 把时，该类强化项权重 ×2（§3.6.2 引导成型） */
  WEIGHT_OWNED_CLASS: 2,
  /** 未拥有该类武器时权重 ×1（§3.6.2 不强行引导冷门类） */
  WEIGHT_UNOWNED_CLASS: 1,
  /** 超武进化卡权重 ×5（§3.6.3；M3-DESIGN-1 进化前置：×3→×5，供第二张/多进化进剩下 2 席） */
  WEIGHT_EVOLUTION: 5,
  /** 上次选过项权重 ×0.5（§3.6.4 防重复） */
  WEIGHT_LAST_PICK: 0.5,
  /** 全满级回退项：up_g_1 伤害强化（可重复，§3.6.4 / §⑥.3） */
  FALLBACK_ID: 'up_g_1',
  /**
   * 向心性保底席位（M3-DESIGN-1，upgrade-experience-v2 §2.1）：
   * 每轮三选一按优先级保证 1 张「build 相关卡」；优先级与权重独立，保底不额外加权。
   * P1~P5 全空（理论仅全池满级）→ 回退 up_g_1。
   */
  GUARANTEE_RELATED: true,
  /** 保底优先级（P1 进化 → P2 领先类钥 → P3 已拥有类强化 → P4 主动技 → P5 解锁卡兜底） */
  GUARANTEE_PRIORITY: ['evolution', 'pathKey', 'ownedClass', 'active', 'unlock'] as const,
  /**
   * 阶段节奏权重表（M3-DESIGN-1，upgrade-experience-v2 §2.2）：
   * 阶段由 ctx.runTimeSeconds 推导（0–120 S1 / 120–240 S2 / 240–360 S3 / 360+ BOSS）。
   * 乘算顺序 = 基础权重 × 阶段倍率 × 防重复倍率（§4.2-4）；保底项不乘防重复（已剔除）。
   * 类目：unlock 未拥有类解锁卡 / ownedClass 已拥有类强化 / key 被动钥 / active 主动技强化 /
   *       numeric 数值方向卡 up_g_1~4 / evolution 进化卡（不乘阶段，由 P1 保底 + ×5 权重处理）。
   */
  STAGE_WEIGHT_MULT: {
    S1: { unlock: 1.0, ownedClass: 1.0, key: 1.0, active: 1.0, numeric: 0.5 },
    S2: { unlock: 0.8, ownedClass: 1.5, key: 1.2, active: 1.0, numeric: 1.0 },
    S3: { unlock: 0.6, ownedClass: 1.0, key: 1.0, active: 1.0, numeric: 1.2 },
    BOSS: { unlock: 0.5, ownedClass: 1.0, key: 1.0, active: 1.0, numeric: 1.2 },
  } as const,
} as const;

/** 濒死护盾（up_g_8：HP<25% 时获得 60 护盾，每局 1 次，gdd-upgrade-pool-v2 §3.2） */
export const DEATH_SHIELD = {
  HP_FRACTION_THRESHOLD: 0.25,
  SHIELD_AMOUNT: 60,
} as const;

/** 全局基础升级效果参数（gdd-upgrade-pool-v2 §3.2；E4-S4 写回数值源；M3-DESIGN-1 数值方向化） */
export const GLOBAL_UPGRADE_EFFECTS = {
  /** up_g_1 武器共鸣（伤害强化）单次 +0.15（数值锚点保留） */
  DAMAGE_BONUS_PER_STACK: 0.15,
  /** up_g_2 专精疾射：目标武器数（冷却最短 2 把） */
  FOCUSED_COOLDOWN_TARGET: 2,
  /** up_g_2 专精疾射：目标武器冷却 ×0.88（每层独立乘区，乘法叠加；×2 满层 0.7744） */
  FOCUSED_COOLDOWN_MULT: 0.88,
  /** up_g_3 鲜血契约：最大生命 +20（与 up_g_3 同参数名保留，数值不变） */
  MAX_HP_BONUS_PER_STACK: 20,
  /** up_g_3 鲜血契约：受击后 5s 内回复 HP（每次受击窗口内回 10） */
  HIT_HEAL: 10,
  /** up_g_3 鲜血契约：受击回血内置 CD s */
  HIT_HEAL_CD: 12,
  /** up_g_3 鲜血契约：受击回血窗口 s（受击后 5s 内回复） */
  HIT_HEAL_WINDOW: 5,
  /** up_g_4 踏月而行：移速 +8%（与 up_g_4 同参数名保留） */
  MOVE_SPEED_PCT_PER_STACK: 0.08,
  /** up_g_4 踏月而行：击杀后移速额外 +15% */
  KILL_SPEED_PCT: 0.15,
  /** up_g_4 踏月而行：击杀后额外移速持续 s */
  KILL_SPEED_DURATION: 2,
  /** up_g_5 吸血 1 HP */
  LIFESTEAL_PER_KILL: 1,
  /** up_g_6 经验磁力单次 ×2（×2→×3） */
  MAGNET_MULT_PER_STACK: 2,
  /** up_g_7 减伤单次 +10%（上限 30%，与圣光壁垒叠加） */
  DAMAGE_REDUCTION_PER_STACK: 0.1,
  /** up_g_9 拾取范围单次 +40px */
  PICKUP_RADIUS_BONUS_PER_STACK: 40,
} as const;
