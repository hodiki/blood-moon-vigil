/**
 * xp/xp-manager.ts —— 经验累计与升级曲线（ARCH §2 / S6 / E3-S1/S2）
 *
 * 纯函数层（test-framework §1.2，可脱离 Phaser 单测）：
 * - needXp(level) = 5 + 3×(level−1)（upgrade-pool §③，首级 5 点约 30s）
 * - cumulativeXpToReach(level)：到某级累计需求（Lv30 = 1363；含第 30 级 = 1455）
 * - stepGem：磁吸/拾取单步（80px 磁吸 / 16px 拾取 / 320px/s 磁吸速度）
 *
 * XpManager（Phaser 装配）：遍历宝石池做磁吸/拾取 → addXp 累加 →
 * 跨过 need(n) 阈值记 pendingLevelUps → consumePendingLevelUp() emit level:up
 * （由 PlayScene 在 RUNNING 恢复后消费，支持一次大宝石连升多级的链式触发）。
 */

import { XP, GEM } from '@/config/balance';
import { GameEvents, GameEvent } from '@/core/events';
import type { XpGem } from '@/xp/xp-gem';

/** 宝石池最小接口（ArcadePoolLike<XpGem> 满足；测试可注入 fake） */
export interface GemPoolLike {
  eachActive(fn: (gem: XpGem) => void): void;
  acquire(x: number, y: number, texture?: string, frame?: string | number): XpGem | null;
}

/** 玩家最小形状（Player 满足 x/y；测试可注入 {x,y}） */
export interface GemPlayerLike {
  x: number;
  y: number;
}

/** need(n) = 5 + 3×(n−1)：从 level 升到 level+1 所需经验（upgrade-pool §③） */
export function needXp(level: number): number {
  return XP.BASE_NEED + XP.NEED_STEP * (level - 1);
}

/** 累计到某级所需经验（sum need(1..level-1)）；Lv30 = 1363（design-review-e2 §3 口径） */
export function cumulativeXpToReach(level: number): number {
  let total = 0;
  for (let n = 1; n < level; n += 1) total += needXp(n);
  return total;
}

/** 磁吸/拾取目标的最小形状（Phaser Sprite 天然满足：x/y 为可写访问器） */
export interface GemLike {
  x: number;
  y: number;
}

export type GemStepResult = 'idle' | 'moving' | 'collected';

/**
 * 磁吸/拾取单步（纯函数）：
 * - 距离 ≤ pickupRadius → collected（拾取，E3-S1）
 * - 距离 ≤ magnetRadius → 以 magnetSpeed 向玩家移动（磁吸 80px，upgrade-pool 第 9 项可强化）
 * - 否则 idle（不吸附）
 * 返回结果并原地修改 gem 坐标（Phaser Sprite 的 x/y 访问器即位移渲染）。
 */
export function stepGem(
  gem: GemLike,
  player: { x: number; y: number },
  dtSeconds: number,
  magnetRadius: number,
  magnetSpeed: number,
  pickupRadius: number,
): GemStepResult {
  const dx = player.x - gem.x;
  const dy = player.y - gem.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= pickupRadius) return 'collected';
  if (dist > magnetRadius) return 'idle';
  if (dist > 0.0001) {
    const step = Math.min(dist, magnetSpeed * dtSeconds);
    gem.x += (dx / dist) * step;
    gem.y += (dy / dist) * step;
  }
  return 'moving';
}

export class XpManager {
  xp = 0;
  level = 1;
  /** 磁吸半径倍率（upgrade-pool 第 9 项：+100% → ×2，×3）；1 = 80px */
  private magnetMultiplier = 1;
  /** 跨阈值但尚未进入选卡流程的升级次数（大宝石一次连升） */
  private pendingLevelUps = 0;

  constructor(
    private readonly gemPool: GemPoolLike,
    private readonly player: GemPlayerLike,
  ) {}

  get magnetRadius(): number {
    return GEM.MAGNET_RADIUS * this.magnetMultiplier;
  }

  /** E3-S5 写回：经验磁力 +100%（upgrade-pool 第 9 项） */
  setMagnetMultiplier(multiplier: number): void {
    this.magnetMultiplier = multiplier;
  }

  /** 每帧：磁吸 + 拾取（只遍历 active 宝石，磁吸每帧距离检查 ≤300 次，RV-C4 可忽略） */
  update(dt: number): void {
    this.gemPool.eachActive((gem) => {
      const result = stepGem(gem, this.player, dt, this.magnetRadius, GEM.MAGNET_SPEED, GEM.PICKUP_RADIUS);
      if (result === 'collected') {
        this.addXp(gem.xpValue);
        GameEvents.emit(GameEvent.GemCollected, { amount: gem.xpValue });
        gem.deactivate();
      }
    });
  }

  /**
   * 累加经验：跨过 need(n) 阈值则升级并记 pendingLevelUps（不立即 emit，
   * 由 consumePendingLevelUp 逐个消费，保证 LEVEL_UP 选卡流程串行）。
   * 返回本次新增升级次数（0 或 ≥1）。
   */
  addXp(amount: number): number {
    this.xp += amount;
    let ups = 0;
    while (this.xp >= needXp(this.level) && this.level < XP.MAX_LEVEL) {
      this.xp -= needXp(this.level);
      this.level += 1;
      this.pendingLevelUps += 1;
      ups += 1;
    }
    return ups;
  }

  /** 消费一个挂起升级并 emit level:up；无挂起返回 false（PlayScene 恢复 RUNNING 后调用） */
  consumePendingLevelUp(): boolean {
    if (this.pendingLevelUps <= 0) return false;
    this.pendingLevelUps -= 1;
    GameEvents.emit(GameEvent.LevelUp, { level: this.level, xpNeeded: needXp(this.level) });
    return true;
  }

  /** 击杀掉落宝石（enemy:killed → 池 acquire；池满静默丢弃，不报错） */
  dropGem(xpValue: number, x: number, y: number): void {
    const gem = this.gemPool.acquire(x, y, 'effects', 'gem');
    if (!gem) return;
    gem.spawn(x, y, xpValue);
  }
}
