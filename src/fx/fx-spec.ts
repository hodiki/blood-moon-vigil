/**
 * fx/fx-spec.ts —— 特效规格（纯数据，可单测；TASK-28 美术表现力专项）
 *
 * 色值一律取 PALETTE / BOSS / GEM token（token 统一来源纪律，禁止硬编码装饰色）；
 * 时长/数量为视觉参数，不动 GDD 数值（GDD 数值在 balance.ts 各表）。
 */

import { PALETTE, BOSS, GEM, type EnemyKindId } from '@/config/balance';

/** 粒子形状帧（fx-ambient 图集内，白底可 tint；p-ring 为轨道残影/升级环） */
export type ParticleFrameName = 'p-circle' | 'p-square' | 'p-streak' | 'p-diamond' | 'p-ring';

/** 击杀溅射规格：形状/颜色/数量/速度/尺寸/寿命 按敌人类型分化（art-bible §4 敌型编码） */
export interface DeathBurstSpec {
  frame: ParticleFrameName;
  colors: readonly string[];
  count: number;
  speed: number;
  size: number;
  life: number;
}

/**
 * 死亡溅射表：
 * - zombie 行尸：方块碎块（血肉横飞）
 * - wolf 疾行：横条切痕（速度感）
 * - tank 厚血：菱形晶片（紫色精英质感）
 * - boss 血月尊者：圆点 + 猩红金双色（终局大爆）
 */
export const DEATH_BURST: Record<EnemyKindId, DeathBurstSpec> = {
  zombie: { frame: 'p-square', colors: [PALETTE.enemyZombie], count: 10, speed: 130, size: 3, life: 0.5 },
  wolf: { frame: 'p-streak', colors: [PALETTE.enemyWolf], count: 8, speed: 170, size: 3, life: 0.42 },
  tank: { frame: 'p-diamond', colors: [PALETTE.enemyTank], count: 16, speed: 110, size: 4, life: 0.6 },
  boss: { frame: 'p-circle', colors: [BOSS.COLOR_MAIN, BOSS.COLOR_GOLD], count: 24, speed: 150, size: 5, life: 0.8 },
};

/** 特效配色（全部 token 来源；tint 色 = 粒子白底 × 该色） */
export const FX_COLORS = {
  /** 飞弹拖尾 / 环绕球残影 / 宝石磁吸拖尾：冷青（= 玩家描边 accent） */
  trail: PALETTE.playerAccent,
  /** 宝石拾取爆点：电光蓝（= 经验宝石本体） */
  gem: GEM.COLOR,
  /** 升级粒子：金（稀有/奖励语义，art-bible §2） */
  upgradeGold: BOSS.COLOR_GOLD,
  /** 升级粒子：冷青 */
  upgradeCyan: PALETTE.playerAccent,
  /** 冲击波涟漪：血橙红 */
  shockwave: PALETTE.shockwave,
  /** Boss 出场：猩红 + 金 */
  boss: BOSS.COLOR_MAIN,
  bossGold: BOSS.COLOR_GOLD,
  /** TASK-36 冲击波白闪环：纸白（= PALETTE.uiPaper，token 别名，无新色相） */
  paper: PALETTE.uiPaper,
  /** M1b 主动技「提灯闪耀」：冷青外环（= 玩家 accent，提灯冷青语义） */
  lanternFlash: PALETTE.playerAccent,
  /** M1b 主动技「提灯闪耀」：纸白核心闪（闪光高亮） */
  lanternFlashCore: PALETTE.uiPaper,
  /** M3 治疗道具拾取发光：治疗绿 #43D17C（art-bible 绿=治疗语义） */
  heal: PALETTE.heal,
  /** 血影突袭轨迹：月银白（T2 银刃） */
  dash: PALETTE.player,
  /** 血月狂化兽纹 accent（暗红 token，主体仍走月银白） */
  rageBeast: PALETTE.enemyZombie,
} as const;

/**
 * E3-S9 特殊行为标记 5 类（gdd-enemies §4.2 / asset-spec §2.6）。
 * 预算纪律：标记 = 静态 Image 随敌人组批次（1 Image/怪），不消费粒子池。
 * 反制依赖：移动端全保留；警告线加粗 2px（§⑦）。
 */
export const SPECIAL_MARKERS = {
  /** 幽紫光环（尸巫）：敌脚下 40~48px 幽紫 #B06AF0，α0.30 呼吸 1s 周期 */
  aura: {
    frame: 'marker-aura',
    /** GDD §4.2 直接指定幽紫 #B06AF0（非调色板 token，注释标注来源） */
    color: '#B06AF0',
    alpha: 0.3,
    radius: 44,
    breatheSeconds: 1,
  },
  /** 半透明 + 残影（亡魂）：本体 α0.5 + 2~3 ghost（α0.25、间隔 60ms、冷青微光） */
  phase: {
    bodyAlpha: 0.5,
    ghostAlpha: 0.25,
    ghostIntervalMs: 60,
    ghostCount: 3,
  },
  /** 蓄力红警告线（狼裔猎手/狼王）：玩家↔怪红线段，移动端加粗 2px */
  warningline: {
    frame: 'marker-warningline',
    color: PALETTE.danger,
    widthDesktop: 1,
    widthMobile: 2,
  },
  /** 头顶符文（圣杯侍僧/尼禄召唤）：16×16 圣杯符文，纸白 + 幽紫微光呼吸 1s */
  rune: {
    frame: 'marker-rune',
    size: 16,
    color: PALETTE.uiPaper,
    breatheSeconds: 1,
  },
  /** 投射红色预警（忏悔者/尼禄血池）：烛火弹 1.5px 红描边 + 外圈红晕 r12 α0.25 */
  ranged: {
    outline: 1.5,
    haloRadius: 12,
    haloAlpha: 0.25,
  },
} as const;
