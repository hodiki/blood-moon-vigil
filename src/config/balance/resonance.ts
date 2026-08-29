/**
 * config/balance/resonance.ts —— 共鸣系统配置（B4-W1，gdd-resonance §3.1/§4/§5）
 *
 * 8 对共鸣（R2-7：每专武 1 把共鸣通武，首版锁 8 对不扩 WD-4）；
 * 双条件 = 持配对专武（开局 2 选 1 确认）∧ 持对应共鸣钥（P2 席位）。
 * 旧 7 钥数值效果全保留、身份重挂为共鸣前置（R2 §B3）；未配对 6 把普通形态零变化。
 * 全部数值为**锚点，待模拟验证**（GDD §⑥）。
 */

import type { ExclusiveWeaponId } from './exclusive';
import type { WeaponId, UpgradeId, PowerTag } from './ids';

/** 共鸣对 id（R-1~R-8） */
export type ResonancePairId = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'R8';

/** 8 对共鸣完整配置（GDD §④ 八字段模板机器化） */
export interface ResonancePairConfig {
  id: ResonancePairId;
  /** 共鸣名（world-bible §7 词根） */
  name: string;
  powerTag: PowerTag;
  /** 触发条件 · 配对专武 */
  exclusiveId: ExclusiveWeaponId;
  /** 触发条件 · 共鸣通武 */
  commonWeaponId: WeaponId;
  /** 触发条件 · 共鸣钥（对应共鸣前置） */
  keyId: UpgradeId;
  /** 行为变化（GDD §④ 原文） */
  behavior: string;
  /** 伤害频率（锚点口径） */
  damageNote: string;
  /** 控制效果（进 CC 状态层带 ICD；'none' = 无） */
  control: string;
  /** 形态变化（剪影/颜色/光效 ≥2 项，§② 支柱 3） */
  visual: string;
  /** 机器参数（结算层消费；键随对而定，锚点） */
  machine: Readonly<Record<string, number>>;
}

/**
 * 8 对共鸣配置表（GDD §④ R-1~R-8 逐对；定稿规格）
 * 配对映射（FQ-3/§5 定稿）：提灯×守夜之环 / 左轮×银针连弩 / 双刃×幽灵飞刃 /
 * 长弓×骨钉标枪 / 圣铃×圣光壁垒 / 十字×审判圣火 / 巨斧×断罪锁链 / 号角×狼影猎犬。
 */
export const RESONANCE_PAIRS: readonly ResonancePairConfig[] = [
  {
    id: 'R1', name: '守夜环灯', powerTag: 'HALLOWED',
    exclusiveId: 'xw_lantern', commonWeaponId: 'wpn_b_1', keyId: 'key_holy',
    behavior: '环绕球沿提灯灯环边缘巡行（半径=灯环当前半径，转速 240°/s 维持）',
    damageNote: '环带触碰 6 伤 / 0.4s / 目标',
    control: '0.5s 眩晕，单目标 10s ICD；Boss 免疫、精英 ×0.25（0.5×0.5）',
    visual: '3 环绕球 → 提灯色环带（灯焰剪影 + 命中白闪）',
    machine: { touchDamage: 6, touchInterval: 0.4, stunDuration: 0.5, stunIcd: 10, angularSpeedDeg: 240 },
  },
  {
    id: 'R2', name: '银潮轮舞', powerTag: 'SILVER',
    exclusiveId: 'xw_revolver', commonWeaponId: 'wpn_a_2', keyId: 'key_silver',
    behavior: '连弩每命中 3 次（累计）为左轮回充 1 弹——弹药互助资源网',
    damageNote: '连弩本体不变（8 伤/0.45s，穿透 1）',
    control: '无',
    visual: '弩箭染银辉流光；左轮弹巢点阵旁生成联动脉冲指示',
    machine: { hitsPerReload: 3 },
  },
  {
    id: 'R3', name: '血月回旋', powerTag: 'BLOOD',
    exclusiveId: 'xw_twinblades', commonWeaponId: 'wpn_a_4', keyId: 'key_tome',
    behavior: '飞刃去/回程命中附加血契印记（易伤 +15%/5s）；持印记敌人被双刃斩击伤 ×1.2',
    damageNote: '飞刃本体不变（18+18/1.6s）；印记伤害为独立加成段',
    control: '易伤类（无 ICD）',
    visual: '飞刃染血雾轨迹（去/回程双血痕）',
    machine: { markVulnerable: 0.15, markDuration: 5, twinbladesMarkMult: 1.2 },
  },
  {
    id: 'R4', name: '猎月贯钉', powerTag: 'MOON',
    exclusiveId: 'xw_longbow', commonWeaponId: 'wpn_a_5', keyId: 'key_scope',
    behavior: '长弓满蓄窗口时标枪同步充能——下一标枪贯穿 3→6，终点插钉成月痕图腾（60px，减速 15%/2s）',
    damageNote: '标枪本体不变（30 伤/3.0s）；图腾无伤害仅减速',
    control: '减速 15%（软控，无 ICD）',
    visual: '标枪附月纹流光；落点月痕图腾为发光标识',
    machine: { chargedPierce: 6, totemRadius: 60, totemSlowPct: 0.15, totemDuration: 2 },
  },
  {
    id: 'R5', name: '圣域壁垒', powerTag: 'HALLOWED',
    exclusiveId: 'xw_bell', commonWeaponId: 'wpn_b_3', keyId: 'key_grail',
    behavior: '壁垒光环与铃音领域重叠区成圣域：域内承伤减免 −10%→−18%；域内墓碑治疗转化率 +20 个百分点',
    damageNote: '两武器本体均不变',
    control: '无（减伤/转化为成长类效果）',
    visual: '光环重叠区呈现金色圣域特效（壁垒环 × 铃音波纹叠加）',
    machine: { damageReductionPct: 0.18, reviveConvertBonusPp: 20 },
  },
  {
    id: 'R6', name: '圣火十诫', powerTag: 'HALLOWED',
    exclusiveId: 'xw_cross', commonWeaponId: 'wpn_c_3', keyId: 'key_bone',
    behavior: '十字每次落点残留余焰（100px，8 伤/s / 3s）——爆发与持续区域缝合',
    damageNote: '余焰 8 伤/s / 3s（独立伤害段，锚点）',
    control: '无',
    visual: '十字落点残留审判余焰（暗金火焰印记）',
    machine: { residueRadius: 100, residueDps: 8, residueDuration: 3 },
  },
  {
    id: 'R7', name: '葬仪断罪', powerTag: 'BEAST',
    exclusiveId: 'xw_axe', commonWeaponId: 'wpn_d_3', keyId: 'key_nail',
    behavior: '锁链击退（100px）改拖拽：200px 内命中敌人拉至巨斧弧心；被拖拽者受巨斧斩击伤 ×1.5',
    damageNote: '锁链本体不变（25 伤/3.5s，直线 200px）；×1.5 为伤害加成段',
    control: '位移类（拖拽，非硬控状态，不走 ICD）',
    visual: '锁链染血锈痕 + 拖拽血线特效',
    machine: { dragRange: 200, draggedAxeDamageMult: 1.5 },
  },
  {
    id: 'R8', name: '狼群誓约', powerTag: 'BEAST',
    exclusiveId: 'xw_horn', commonWeaponId: 'wpn_d_2', keyId: 'key_pact',
    behavior: '猎犬入编狼群：享受协同集火与号角狂化加成，且占月狼场上限（上限共享计数）',
    damageNote: '猎犬本体不变（15 伤/1.0s 撕咬）',
    control: '无',
    visual: '猎犬披月纹项圈（与月狼同族视觉）',
    machine: {},
  },
] as const;

/** 按 id 查对 */
export function resonancePairById(id: ResonancePairId): ResonancePairConfig | undefined {
  return RESONANCE_PAIRS.find((p) => p.id === id);
}

/** 按专武查对（每专武恰 1 对） */
export function resonancePairByExclusive(exclusiveId: ExclusiveWeaponId): ResonancePairConfig | undefined {
  return RESONANCE_PAIRS.find((p) => p.exclusiveId === exclusiveId);
}

/** 按通武查对（8 把挂共鸣；未配对 6 把返回 undefined = 普通形态） */
export function resonancePairByWeapon(weaponId: WeaponId): ResonancePairConfig | undefined {
  return RESONANCE_PAIRS.find((p) => p.commonWeaponId === weaponId);
}

/** 未配对 6 把（普通形态，§3.3：零变化回归口径） */
export const UNPAIRED_WEAPON_IDS: readonly WeaponId[] = [
  'wpn_a_1', 'wpn_a_3', 'wpn_b_2', 'wpn_c_1', 'wpn_c_2', 'wpn_d_1',
];

/** 共鸣规则（§3.1 前置锚 + §⑦ 边缘） */
export const RESONANCE_RULES = {
  /** 共鸣条件达成时的出现权重（对齐旧进化卡 ×5 惯例，待模拟） */
  WEIGHT_READY: 5,
  /** 切换不可逆（取得即保留至局终） */
  IRREVERSIBLE: true,
  /** 原子切换：在途弹体/伤害段沿用旧形态结算完毕（§⑦-3） */
  ATOMIC_SWITCH: true,
  /** R-2 回充计数恒定（不受通武强化影响） */
  R2_HITS_PER_RELOAD: 3,
  /** R-3 印记倍率固定（不随强化变化，§④） */
  R3_MARK_MULT: 1.2,
} as const;
