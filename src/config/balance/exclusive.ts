/**
 * config/balance/exclusive.ts —— 专武层配置（gdd-exclusive-weapons §4/§⑤/尾章）
 *
 * ⚠ 全部数值为**锚点，待模拟验证**（GDD 附录 B 21 项；沙盘 tools/sim 产出开局 DPS 平台带后校准）。
 * B2 批次新增配置直接落域文件（EG-1 拆分后的纪律）。
 *
 * 结构：EXCLUSIVE_WEAPONS（8 专武基础形态）+ MUTATION_CARDS（16 质变卡，顺序解锁）
 *      + DERIVATIVE_SKILLS（8 衍生技 = 落选专武的技形态，CC 走状态层 §4.8）
 *      + RELICS（5 圣物，演出型，伤害占比 <5% 红线）+ RELIC_RULES。
 */

import type { HeroId, PowerTag } from './ids';

// ============================================================================
// 专武 ID / 衍生技 ID / 质变卡 ID
// ============================================================================

/** 专武 8（每角色 2 把，开局 2 选 1，gdd-exclusive-weapons §1.1） */
export type ExclusiveWeaponId =
  | 'xw_lantern'     // 破旧提灯（守夜人）
  | 'xw_revolver'    // 圣徒左轮（守夜人）
  | 'xw_twinblades'  // 血契双刃（血猎手）
  | 'xw_longbow'     // 月痕长弓（血猎手）
  | 'xw_bell'        // 安魂圣铃（修女）
  | 'xw_cross'       // 圣辉十字（修女）
  | 'xw_axe'         // 葬仪巨斧（狼裔）
  | 'xw_horn';       // 月啸号角（狼裔）

/** 衍生技 8 = 落选专武的技形态（专武 → 技 1:1，§4.8 对照表） */
export type DerivativeSkillId =
  | 'dv_lantern_flash'   // 破旧提灯技（选左轮时，提灯落选转化）
  | 'dv_revolver_burst'  // 圣徒左轮技（选提灯时）
  | 'dv_blood_dash'      // 血影突袭（双刃落选）
  | 'dv_moon_snipe'      // 月痕狙击（长弓落选）
  | 'dv_requiem'         // 安魂曲（圣铃落选）
  | 'dv_holy_judgment'   // 圣辉审判（十字落选）
  | 'dv_blood_rage'      // 血月狂化（巨斧落选）
  | 'dv_wolf_charge';    // 月啸冲锋（号角落选）

/**
 * 专武 → 衍生技映射（§4.8；统一语义：键 = 选中者，值 = **落选者**的技形态）。
 * NV-INTEG-FIX ③ 修正：原表 cassandra/violet/galvan 三对 6 条写成「键=该武→自己的技」，
 * 与表头语义及 DERIVATIVE_SKILLS[*].sourceExclusiveId 冲突（仅 edmund 对正确）。
 * 校验式：EXCLUSIVE_TO_DERIVATIVE[chosen] 的 sourceExclusiveId === rejectedExclusive(chosen)。
 */
export const EXCLUSIVE_TO_DERIVATIVE: Record<ExclusiveWeaponId, DerivativeSkillId> = {
  xw_lantern: 'dv_revolver_burst',    // 选提灯 → 左轮落选 → 圣徒左轮技
  xw_revolver: 'dv_lantern_flash',    // 选左轮 → 提灯落选 → 破旧提灯技
  xw_twinblades: 'dv_moon_snipe',     // 选双刃 → 长弓落选 → 月痕狙击
  xw_longbow: 'dv_blood_dash',        // 选长弓 → 双刃落选 → 血影突袭
  xw_bell: 'dv_holy_judgment',        // 选圣铃 → 十字落选 → 圣辉审判
  xw_cross: 'dv_requiem',             // 选十字 → 圣铃落选 → 安魂曲
  xw_axe: 'dv_wolf_charge',           // 选巨斧 → 号角落选 → 月啸冲锋
  xw_horn: 'dv_blood_rage',           // 选号角 → 巨斧落选 → 血月狂化
};

/** 角色双专武表（§4.1~4.7：每角色 2 把） */
export const HERO_EXCLUSIVE_PAIRS: Record<HeroId, readonly [ExclusiveWeaponId, ExclusiveWeaponId]> = {
  hero_edmund: ['xw_lantern', 'xw_revolver'],
  hero_cassandra: ['xw_twinblades', 'xw_longbow'],
  hero_violet: ['xw_bell', 'xw_cross'],
  hero_galvan: ['xw_axe', 'xw_horn'],
};

// ============================================================================
// 质变卡（16 张 = 8 专武 × 2，全质变、顺序解锁，§3.2）
// ============================================================================

export interface MutationCardConfig {
  id: string;
  /** 所属专武 */
  exclusiveId: ExclusiveWeaponId;
  /** 解锁顺序：1 先取，2 需已取 1（§3.2 顺序解锁） */
  order: 1 | 2;
  name: string;
  desc: string;
  /**
   * 机器可读参数覆写（行为层按键消费；键名与 EXCLUSIVE_WEAPONS.params 字段/扩展字段对齐）。
   * 全质变 = 行为/形态级变化，非数值阶梯（§② 支柱 2）。
   */
  machine: Readonly<Record<string, number>>;
}

/** 质变卡 16（§4.1~4.7 各专武卡 1/卡 2；参数为锚点） */
export const MUTATION_CARDS: readonly MutationCardConfig[] = [
  // 破旧提灯
  { id: 'mc_lantern_1', exclusiveId: 'xw_lantern', order: 1, name: '长明灯阵', desc: '灯环半径 +50%（→135px）；环外缘 4 盏巡游灯焰（180°/s，6 伤/0.4s）；减速 10%→18%', machine: { auraRadius: 135, orbitFlameCount: 4, orbitFlameDamage: 6, orbitFlameInterval: 0.4, slowPct: 0.18 } },
  { id: 'mc_lantern_2', exclusiveId: 'xw_lantern', order: 2, name: '亡者灯引', desc: '灯环内击杀留残焰 3s（60px，8 伤/s + 减速 10%）；每盏在场残焰本体伤 +15%（上限 5）', machine: { emberDuration: 3, emberRadius: 60, emberDps: 8, emberSlowPct: 0.1, emberBodyBonusPct: 0.15, emberMax: 5 } },
  // 圣徒左轮
  { id: 'mc_revolver_1', exclusiveId: 'xw_revolver', order: 1, name: '圣痕连锁', desc: '命中后弹射至最近 1 名敌人（×0.7 伤，1 次跳弹），跳弹附带穿透 1', machine: { chainDamageMult: 0.7, chainCount: 1, chainPierce: 1 } },
  { id: 'mc_revolver_2', exclusiveId: 'xw_revolver', order: 2, name: '处决装填', desc: '击杀立即 +1 弹（上限弹巢 6）；装弹时间 −30%（1.0→0.7s）', machine: { killGrantAmmo: 1, reloadMult: 0.7 } },
  // 血契双刃
  { id: 'mc_twinblades_1', exclusiveId: 'xw_twinblades', order: 1, name: '血之回响', desc: '血契满层触发血爆——120px 爆发 25 伤 + 回复 3 HP，清空层数', machine: { burstRadius: 120, burstDamage: 25, burstHeal: 3 } },
  { id: 'mc_twinblades_2', exclusiveId: 'xw_twinblades', order: 2, name: '猩红新月', desc: '双刃合一新月弯刃，范围 120→160px；血爆附带新月波（直线 200px 穿透，20 伤）', machine: { range: 160, crescentRange: 200, crescentDamage: 20 } },
  // 月痕长弓
  { id: 'mc_longbow_1', exclusiveId: 'xw_longbow', order: 1, name: '月相贯矢', desc: '每第 3 矢为满蓄月痕矢——伤害 ×2.2、贯穿 3→全部', machine: { chargeEveryN: 3, chargedDamageMult: 2.2, chargedPierceAll: 1 } },
  { id: 'mc_longbow_2', exclusiveId: 'xw_longbow', order: 2, name: '猎首之约', desc: '满蓄矢命中标记「猎物」（易伤 +20%/8s，单目标）；对猎物普通矢伤害 ×1.3', machine: { preyVulnerable: 0.2, preyDuration: 8, preyDamageMult: 1.3 } },
  // 安魂圣铃
  { id: 'mc_bell_1', exclusiveId: 'xw_bell', order: 1, name: '安魂钟鸣', desc: '铃响升格钟鸣——治疗量 ×2.5，领域内亡者类额外 12 伤 + 减速 20%/2s', machine: { healMult: 2.5, undeadBonusDamage: 12, undeadSlowPct: 0.2, undeadSlowDuration: 2 } },
  { id: 'mc_bell_2', exclusiveId: 'xw_bell', order: 2, name: '守誓誓约', desc: '承伤转移 50%→65%、撕咬 8→14 伤、墓碑回血 2→4 HP/s；治疗转化率 50%→70%', machine: { transferPct: 0.65, biteDamage: 14, tombHealPerSec: 4, reviveConvertRate: 0.7 } },
  // 圣辉十字
  { id: 'mc_cross_1', exclusiveId: 'xw_cross', order: 1, name: '审判降临', desc: '落点悬停 2s 持续灼烧 12 伤/s 后再爆（单点总伤 ≈ ×2.1）', machine: { hoverDuration: 2, hoverDps: 12 } },
  { id: 'mc_cross_2', exclusiveId: 'xw_cross', order: 2, name: '三重颂歌', desc: '一次掷出三枚十字品字落点，命中同目标的相邻爆炸每枚 +30%（去重单次加成，不叠乘）', machine: { crossCount: 3, adjacentBonusPct: 0.3 } },
  // 葬仪巨斧
  { id: 'mc_axe_1', exclusiveId: 'xw_axe', order: 1, name: '血债血偿', desc: '挥击伤害 +40%，每击杀回复 3 HP', machine: { damageMult: 1.4, killHeal: 3 } },
  { id: 'mc_axe_2', exclusiveId: 'xw_axe', order: 2, name: '葬仪狂欢', desc: '当前 HP 每低 10%，伤害 +6%（上限 +30%）；间隔 2.2→1.8s', machine: { lowHpStepPct: 0.06, lowHpStepPer: 0.1, lowHpBonusCap: 0.3, cooldown: 1.8 } },
  // 月啸号角
  { id: 'mc_horn_1', exclusiveId: 'xw_horn', order: 1, name: '群狼协议', desc: '场上限 2→3 + 协同集火（全体月狼优先同一目标，该目标受全体狼伤 +15%）', machine: { maxWolves: 3, focusBonusPct: 0.15 } },
  { id: 'mc_horn_2', exclusiveId: 'xw_horn', order: 2, name: '长夜月啸', desc: '吹号附带长啸——全体在场月狼狂化 6s（伤害 ×2、移速 +30%），狂化期击杀刷新存在时间', machine: { rageDuration: 6, rageDamageMult: 2, rageSpeedPct: 0.3 } },
];

// ============================================================================
// 专武基础形态（8；数值 = GDD §4 锚点）
// ============================================================================

/** 专武面板参数（字段按武可选；行为层按 id 消费对应键） */
export interface ExclusiveWeaponParams {
  /** 伤害/单次/tick 值 */
  damage?: number;
  /** 触发间隔 s（tick/攻击间隔/冷却） */
  interval?: number;
  /** 领域/范围半径 px */
  radius?: number;
  /** 减速值（0~1，走状态层 slow） */
  slowPct?: number;
  /** 弹速 px/s（投射类） */
  speed?: number;
  /** 贯穿数 */
  pierce?: number;
  /** 弹药（左轮，§4.9；usesAmmo=true 才消费 ammo 框架） */
  ammoMax?: number;
  reloadSeconds?: number;
  /** 吸血/回复 */
  healPerHit?: number;
  healCapPerSecond?: number;
  killHeal?: number;
  /** 自损（巨斧） */
  selfHpCost?: number;
  selfHpStopPct?: number;
  /** 召唤（号角） */
  summonInterval?: number;
  summonDuration?: number;
  summonMax?: number;
  /** 圣铃治疗 */
  healInterval?: number;
  healAmount?: number;
  /** 守誓者（圣铃专属；GDD §4.4，HP 口径 EG-4 = 固定 200） */
  companion?: { hp: number; transferPct: number; biteDamage: number; biteInterval: number; leashRadius: number; tombDurationMin: number; tombDurationMax: number; tombHealPerSec: number; reviveConvertRate: number; resummonCd: number };
}

export interface ExclusiveWeaponConfig {
  id: ExclusiveWeaponId;
  name: string;
  heroId: HeroId;
  powerTag: PowerTag;
  /** 手感归属（gdd-weapons-v2 §3 四类） */
  feel: string;
  /** 开局 DPS 锚区间（GDD §⑤；圣铃为自身口径，合计 ≈13~14） */
  dpsAnchor: readonly [number, number];
  /** 衍生技占比锚（12~15 / 15~18，§⑤） */
  derivativeShareAnchor: readonly [number, number];
  params: ExclusiveWeaponParams;
  /** GDD 原文效果描述 */
  effect: string;
}

/** 专武表 8（gdd-exclusive-weapons §4.1~4.7 逐项；全部锚点待模拟验证） */
export const EXCLUSIVE_WEAPONS: Record<ExclusiveWeaponId, ExclusiveWeaponConfig> = {
  xw_lantern: {
    id: 'xw_lantern', name: '破旧提灯', heroId: 'hero_edmund', powerTag: 'MOON',
    feel: 'B 环绕/领域混合（领域控场）', dpsAnchor: [9, 11], derivativeShareAnchor: [0.12, 0.15],
    params: { damage: 5, interval: 0.5, radius: 90, slowPct: 0.1 },
    effect: '常驻周身灯环 90px，环内敌人 5 伤/0.5s；附加减速 10%（状态层）；暗金光域 + 灯焰粒子',
  },
  xw_revolver: {
    id: 'xw_revolver', name: '圣徒左轮', heroId: 'hero_edmund', powerTag: 'SILVER',
    feel: 'A 弹幕投射（爆发资源管理）', dpsAnchor: [9, 12], derivativeShareAnchor: [0.15, 0.18],
    params: { damage: 10, interval: 0.8, speed: 420, ammoMax: 6, reloadSeconds: 1.0 },
    effect: '直线银弹，不追踪不穿透，10 伤/0.8s，弹速 420px/s；6 发弹巢，射完自动装弹 1.0s（峰值 DPS 锚 12~14 / 有效 9~12）',
  },
  xw_twinblades: {
    id: 'xw_twinblades', name: '血契双刃', heroId: 'hero_cassandra', powerTag: 'BLOOD',
    feel: 'B 近战环绕（贴身高频变体）', dpsAnchor: [10, 12], derivativeShareAnchor: [0.12, 0.15],
    params: { damage: 6, interval: 0.55, radius: 120, healPerHit: 0.5, healCapPerSecond: 2 },
    effect: '双刃自动斩击 120px 内最近敌，6 伤/0.55s；命中回复 0.5 HP（每秒回血上限 2 HP）；命中积累血契层数（上限 10）',
  },
  xw_longbow: {
    id: 'xw_longbow', name: '月痕长弓', heroId: 'hero_cassandra', powerTag: 'MOON',
    feel: 'A 弹幕投射（重型狙击变体）', dpsAnchor: [9, 11], derivativeShareAnchor: [0.15, 0.18],
    params: { damage: 22, interval: 2.2, speed: 500, pierce: 3 },
    effect: '22 伤/2.2s，直线，贯穿 3，弹速 500px/s',
  },
  xw_bell: {
    id: 'xw_bell', name: '安魂圣铃', heroId: 'hero_violet', powerTag: 'HALLOWED',
    feel: 'B 环绕/领域（辅助流）', dpsAnchor: [6, 8], derivativeShareAnchor: [0.12, 0.15],
    params: { damage: 3, interval: 0.8, radius: 110, healInterval: 8, healAmount: 8, companion: { hp: 200, transferPct: 0.5, biteDamage: 8, biteInterval: 1.0, leashRadius: 150, tombDurationMin: 8, tombDurationMax: 10, tombHealPerSec: 2, reviveConvertRate: 0.5, resummonCd: 20 } },
    effect: '常驻铃音领域 110px，对敌 3 伤/0.8s（自身 DPS 锚 6~8，合计口径 ≈13~14）；每 8s 铃响治疗自身与守誓者 8 HP；守誓者开局自带（FQ-2）',
  },
  xw_cross: {
    id: 'xw_cross', name: '圣辉十字', heroId: 'hero_violet', powerTag: 'HALLOWED',
    feel: 'C 清屏（定点爆发变体）', dpsAnchor: [9, 11], derivativeShareAnchor: [0.15, 0.18],
    params: { damage: 28, interval: 3.0, radius: 100 },
    effect: '每 3.0s 掷出旋转十字飞向最近敌群，落点爆炸 28 伤/半径 100px',
  },
  xw_axe: {
    id: 'xw_axe', name: '葬仪巨斧', heroId: 'hero_galvan', powerTag: 'BEAST',
    feel: '近战重斩（自损重斩）', dpsAnchor: [11, 13], derivativeShareAnchor: [0.15, 0.18],
    params: { damage: 26, interval: 2.2, radius: 150, selfHpCost: 2, selfHpStopPct: 0.2, killHeal: 1 },
    effect: '重斩 150px 弧形内最近敌，26 伤/2.2s；每次挥击消耗自身 2 HP（HP ≤20% 停止消耗）；击杀回复 1 HP',
  },
  xw_horn: {
    id: 'xw_horn', name: '月啸号角', heroId: 'hero_galvan', powerTag: 'BEAST',
    feel: 'D 召唤（狼群协同）', dpsAnchor: [8, 10], derivativeShareAnchor: [0.15, 0.18],
    params: { summonInterval: 12, summonDuration: 10, summonMax: 2, damage: 8, interval: 1.0 },
    effect: '每 12s 吹号召唤 1 头月狼（存在 10s，撕咬 8 伤/1.0s，场上限 2）',
  },
};

// ============================================================================
// 衍生技（8；CD 锚 轻技 12~15s / 复合技 ≥20s，§3.3；CC 全走状态层 §4.8）
// ============================================================================

export interface DerivativeSkillConfig {
  id: DerivativeSkillId;
  name: string;
  /** 来源专武（落选者转化） */
  sourceExclusiveId: ExclusiveWeaponId;
  /** CD 锚 s */
  cd: number;
  /** 占比锚 12~18%（EG-9 放宽口径，逐技标注） */
  shareAnchor: readonly [number, number];
  params: Readonly<Record<string, number>>;
  effect: string;
}

/** 衍生技表 8（§4.1~4.7 + §4.8 对照表；参数锚点） */
export const DERIVATIVE_SKILLS: Record<DerivativeSkillId, DerivativeSkillConfig> = {
  dv_revolver_burst: {
    id: 'dv_revolver_burst', name: '圣徒左轮技', sourceExclusiveId: 'xw_revolver',
    cd: 14, shareAnchor: [0.12, 0.15],
    params: { shots: 6, damage: 12, shotInterval: 0.1, vulnerable: 0.15, vulnerableDuration: 6 },
    effect: '6 连射银弹（直线不追踪，12 伤/发，间隔 0.1s）；末段命中挂圣痕易伤（受所有伤害 +15% / 6s）',
  },
  dv_lantern_flash: {
    id: 'dv_lantern_flash', name: '破旧提灯技', sourceExclusiveId: 'xw_lantern',
    cd: 20, shareAnchor: [0.15, 0.18],
    params: { stunDuration: 2.0, fireRateMult: 1.5, fireRateDuration: 4, infiniteAmmoDuration: 5 },
    effect: '周身眩晕 1.5~2s（Boss 免疫、精英 ×0.5）+ 射速爆发（4s 内 ×1.5）+ 立即补满弹巢 + 5s 无限弹',
  },
  dv_blood_dash: {
    id: 'dv_blood_dash', name: '血影突袭', sourceExclusiveId: 'xw_twinblades',
    cd: 14, shareAnchor: [0.12, 0.15],
    params: { dashDistance: 200, damage: 15, vulnerable: 0.15, vulnerableDuration: 5 },
    effect: '向敌群最密方向突进 200px 沿途斩击（15 伤/段）+ 挂血契印记（受所有伤害 +15% / 5s）',
  },
  dv_moon_snipe: {
    id: 'dv_moon_snipe', name: '月痕狙击', sourceExclusiveId: 'xw_longbow',
    cd: 20, shareAnchor: [0.15, 0.18],
    params: { chargeTime: 1.2, damage: 60, stunDuration: 1 },
    effect: '1.2s 蓄力后发射贯穿全屏巨矢（60 伤、全贯穿）+ 首个命中目标眩晕 1s（Boss 免疫、精英 ×0.5）',
  },
  dv_requiem: {
    id: 'dv_requiem', name: '安魂曲', sourceExclusiveId: 'xw_bell',
    cd: 20, shareAnchor: [0.12, 0.15],
    params: { slowPct: 0.3, slowDuration: 3, heal: 20, radius: 300 },
    effect: '周身减速 30%/3s + 回复 20 HP + 守誓者立即回满（若为墓碑则复活进度直接充满）',
  },
  dv_holy_judgment: {
    id: 'dv_holy_judgment', name: '圣辉审判', sourceExclusiveId: 'xw_cross',
    cd: 20, shareAnchor: [0.15, 0.18],
    params: { radius: 160, damage: 50, stunDuration: 2, healAuraDuration: 5, healAuraPerSec: 3 },
    effect: '大十字从天而降——160px 半径 50 伤 + 眩晕 2s（Boss 免疫、精英 ×0.5）+ 5s 治疗光环（3 HP/s）',
  },
  dv_blood_rage: {
    id: 'dv_blood_rage', name: '血月狂化', sourceExclusiveId: 'xw_axe',
    cd: 20, shareAnchor: [0.15, 0.18],
    params: { duration: 6, damageBonusPct: 0.4, moveSpeedPct: 0.15 },
    effect: '6s 狂化——伤害 +40%、挥击不耗 HP、移速 +15%，结束增益清空（自增益，无 CC）',
  },
  dv_wolf_charge: {
    id: 'dv_wolf_charge', name: '月啸冲锋', sourceExclusiveId: 'xw_horn',
    cd: 20, shareAnchor: [0.15, 0.18],
    params: { wolves: 3, damage: 30, knockback: 100, rageDuration: 4 },
    effect: '3 头狼影自场边全屏直线冲锋（每头 30 伤 + 击退 100px）+ 加尔文狂化 4s（攻速）——击退为位移非状态（§4.8）',
  },
};

// ============================================================================
// 圣物层（尾章正式规格 ×5；演出型，伤害占比 <5% 红线）
// ============================================================================

export type RelicId = 'relic_moonfall' | 'relic_bloodtide' | 'relic_twelve_lamps' | 'relic_silver_tide' | 'relic_wolf_spirit';

/** 圣物获取池（NW-1 = C 混合：Boss 必掉池 / 祭坛概率池） */
export type RelicPool = 'boss' | 'altar';

export interface RelicConfig {
  id: RelicId;
  name: string;
  powerTag: PowerTag;
  pools: readonly RelicPool[];
  /** 效果参数（锚点） */
  params: Readonly<Record<string, number>>;
  effect: string;
  /** 叙事锚点（world-bible v1.1） */
  lore: string;
}

/** 圣物表 5（尾章定稿；伤害数值为锚点） */
export const RELICS: Record<RelicId, RelicConfig> = {
  relic_moonfall: {
    id: 'relic_moonfall', name: '月蚀之陨', powerTag: 'MOON', pools: ['boss', 'altar'],
    params: { stunDuration: 2 },
    effect: '全场月光脉冲：非 Boss 敌人眩晕 2s（走状态层，Boss 免疫规则天然生效）+ 月影坠落演出',
    lore: '血月盈满之夜的倒影——月亮「眨了下眼」（§2）',
  },
  relic_bloodtide: {
    id: 'relic_bloodtide', name: '血海退潮', powerTag: 'BLOOD', pools: ['boss', 'altar'],
    params: { slowPct: 0.4, duration: 6 },
    effect: '全场敌人减速 40% / 6s（状态层）+ 血浪倒卷入地演出',
    lore: '血教堂地下血井片刻倒吸——血术源头也有潮汐（§6.2）',
  },
  relic_twelve_lamps: {
    id: 'relic_twelve_lamps', name: '十二灯誓约', powerTag: 'HALLOWED', pools: ['altar'],
    params: { duration: 8, burnDps: 8, damageReductionPct: 0.2, auraRadius: 140 },
    effect: '十二盏圣辉提灯虚影环列，灯环内亡者类敌人持续灼烧 8 伤/s、玩家承伤 −20%，持续 8s',
    lore: '千年前 First Vigil 十二守夜人提灯残影仍记得誓词（§2 封印之锁）',
  },
  relic_silver_tide: {
    id: 'relic_silver_tide', name: '银潮汐', powerTag: 'SILVER', pools: ['boss'],
    // P0-1：GDD 尾章未列伤害值（KNOWN-GAP）→ 工程锚「落场银雨」220px / 6 伤/s / 8s（须守住 <5% 红线）
    params: { duration: 8, radius: 220, burnDps: 6 },
    effect: '8s 落场银雨（220px 银质灼烧 6 伤/s，对血族类生成银光爆点）+ 全场攻击附带银质演出——伤害段不进 DPS 预算主线（<5% 红线）',
    lore: '守夜驻地银炉最后一炉银，今夜铸成弹雨（§6.4）',
  },
  relic_wolf_spirit: {
    id: 'relic_wolf_spirit', name: '狼灵巡夜', powerTag: 'BEAST', pools: ['altar'],
    params: { damage: 30, knockback: 100 },
    effect: '先祖狼灵虚影横扫全场一次（全屏直线冲撞，30 伤 + 击退 100px）+ 狼嚎演出',
    lore: '狼穴爪痕是血月契约——今夜有狼拒绝履约（§6.3 + §9 加尔文镜像）',
  },
};

/** 圣物层规则（§3.4：CD 锚 240s；每局保底 1 上限 2；局内每枚 1 次；伤害占比 <5%） */
export const RELIC_RULES = {
  CD_SECONDS: 240,
  /** 每局保底（Boss 击杀必掉 1 枚） */
  GUARANTEED_PER_RUN: 1,
  /** 每局上限（祭坛概率第 2 枚） */
  MAX_PER_RUN: 2,
  /** 祭坛第 2 枚概率锚 */
  ALTAR_CHANCE: 0.5,
  /** 演出时长锚（≥1.5s 全屏级，可降级） */
  CINEMATIC_MIN_SECONDS: 1.5,
  /** 伤害占比红线（遥测断言） */
  DPS_SHARE_MAX: 0.05,
} as const;
