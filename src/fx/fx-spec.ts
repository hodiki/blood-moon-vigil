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
} as const;
