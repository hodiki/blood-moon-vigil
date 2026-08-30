/**
 * xp/heal-manager.ts —— 治疗道具掉落与拾取（M3；规格终稿 = merit-ui-spec §11「治疗道具规格确认」）
 *
 * 纯函数层（test-framework §1.2，可脱离 Phaser 单测）：
 * - isHealDropSource(enemyType)：掉落来源 = 精英（tank 槽）/Boss 保底掉 1 个；普通怪不掉
 * - healAmountForPickup(boostedHeal, hp, maxHp)：治疗量 = 基础 × 修女被动 ×1.5，上限钳制到 maxHp
 *
 * HealManager（Phaser 装配）：池化治疗道具 + 每帧拾取判定（拾取区 = HEAL.PICKUP_RADIUS；
 * 无磁吸，走位主动拾取）+ 拾取时应用治疗并 emit HealCollected。
 * 满血拾取（§11）：healed=0 时**保留地面不消失**（回血后再捡有效，防浪费/挫败）。
 * 治疗应用目标用接口（PlayerStats 满足：hp/maxHp/boostedHealAmount），测试注入 fake。
 */

import { HEAL } from '@/config/balance';
import { GameEvents, GameEvent } from '@/core/events';
import { stepGem } from '@/xp/xp-manager';
import type { HealPickup } from '@/xp/heal-pickup';

/** 治疗道具池最小接口（ArcadePoolLike<HealPickup> 满足；测试可注入 fake） */
export interface HealPoolLike {
  eachActive(fn: (pickup: HealPickup) => void): void;
  acquire(x: number, y: number, texture?: string, frame?: string | number): HealPickup | null;
}

/** 治疗目标最小形状（PlayerStats 满足：hp/maxHp/boostedHealAmount） */
export interface HealTargetLike {
  hp: number;
  maxHp: number;
  /** 治疗量放大（修女「执烛之心」×1.5；其余 ×1） */
  boostedHealAmount(baseHeal: number): number;
}

/** 玩家最小形状（拾取判定；Player 满足 x/y） */
export interface HealPlayerLike {
  x: number;
  y: number;
}

/**
 * 掉落来源判定（merit-ui-spec §11：精英「tank」/「boss」保底掉 1 个；普通怪不掉防稀释）。
 * runtime kind 口径：elite tier 敌 → 'tank'（enemy-types.runtimeKindForEnemyId）；Boss → 'boss'。
 */
export function isHealDropSource(enemyType: string): boolean {
  return enemyType === 'tank' || enemyType === 'boss';
}

/**
 * 是否掉落治疗道具（M3 平衡模拟调整，merit-ui-spec §11 预案）：
 * - Boss/血月化身：保底 100% 掉 1 个；
 * - 精英（tank 槽）：掉率 HEAL.ELITE_DROP_CHANCE（100%→50%）——
 *   单局治疗总量 10 保底精英 × 0.5 × 30 + Boss 30 = 180 ≤ 200 红线（调整前 330 超标）。
 * 随机源注入可测；普通怪 false。
 */
export function shouldDropHeal(enemyType: string, random: () => number = Math.random): boolean {
  if (!isHealDropSource(enemyType)) return false;
  if (enemyType === 'boss') return true;
  return random() < HEAL.ELITE_DROP_CHANCE;
}

/**
 * 治疗量：上限钳制到 maxHp（不溢出）。boostedHeal 已含修女被动 ×1.5；
 * 满血 → 0（调用方据此**保留地面不消失**，merit-ui-spec §11）。
 */
export function healAmountForPickup(boostedHeal: number, hp: number, maxHp: number): number {
  if (maxHp <= hp) return 0;
  return Math.min(boostedHeal, maxHp - hp);
}

export class HealManager {
  /** MN-4 腐蚀词缀：治疗效能倍率提供器（120px 内腐蚀精英 → ×0.7；缺省 = 1）。
   *  覆盖「道具/铃/回血同折」口径中的道具拾取路径（词缀域消费）。 */
  healEfficiencyProvider: (() => number) | null = null;

  constructor(
    private readonly pool: HealPoolLike,
    private readonly player: HealPlayerLike,
    private readonly target: HealTargetLike,
  ) {}

  /** 精英/Boss 保底掉落：池 acquire（池满静默丢弃；来源判定由调用方 PlayScene 按 isHealDropSource 执行） */
  dropHeal(x: number, y: number): void {
    const pickup = this.pool.acquire(x, y, 'effects', 'heal');
    if (!pickup) return;
    pickup.spawn(x, y);
  }

  /** 每帧：拾取判定（距离 ≤ HEAL.PICKUP_RADIUS 即拾取；复用 stepGem 的距离数学） */
  update(dt: number): void {
    this.pool.eachActive((pickup) => {
      const result = stepGem(pickup, this.player, dt, 0, 0, HEAL.PICKUP_RADIUS);
      if (result !== 'collected') return;
      // 治疗应用：基础 × 修女被动（boostedHealAmount）× 腐蚀词缀效能（MN-4）→ 上限钳制 → 写入 HP
      const boosted = this.target.boostedHealAmount(HEAL.AMOUNT) * (this.healEfficiencyProvider?.call(null) ?? 1);
      const healed = healAmountForPickup(boosted, this.target.hp, this.target.maxHp);
      if (healed <= 0) return; // 满血：保留地面不消失（回血后再捡有效，§11）
      this.target.hp += healed;
      GameEvents.emit(GameEvent.HealCollected, { amount: healed, x: pickup.x, y: pickup.y });
      pickup.deactivate();
    });
  }
}
