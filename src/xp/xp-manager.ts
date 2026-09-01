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

export type GemStepResult = 'idle' | 'drifting' | 'moving' | 'collected';

/** TASK-39 E1 E-lite 滞留慢漂配置（由 XpManager 从 balance GEM + 宝石 age 组装） */
export interface GemDriftOptions {
  /** 宝石已落地秒数（gem.age，XpManager 每帧累加） */
  ageSeconds: number;
  /** 超过该年龄才开始漂移（GEM.DRIFT_AGE_THRESHOLD = 3s） */
  ageThreshold: number;
  /** 漂移速度 px/s（GEM.DRIFT_SPEED = 80，低于玩家移速 → 不会"免费全屏拾取"） */
  driftSpeed: number;
}

/**
 * 磁吸/拾取单步（纯函数）：
 * - 距离 ≤ pickupRadius → collected（拾取，E3-S1）
 * - 距离 ≤ magnetRadius → 以 magnetSpeed 向玩家移动（磁吸 140px，upgrade-pool 第 9 项可强化）
 * - 距离 > magnetRadius → 若启用漂移且已落地超时 → 以 driftSpeed 慢漂向玩家（drifting）；
 *   否则 idle（不吸附）
 * 返回结果并原地修改 gem 坐标（Phaser Sprite 的 x/y 访问器即位移渲染）。
 */
export function stepGem(
  gem: GemLike,
  player: { x: number; y: number },
  dtSeconds: number,
  magnetRadius: number,
  magnetSpeed: number,
  pickupRadius: number,
  drift?: GemDriftOptions,
): GemStepResult {
  const dx = player.x - gem.x;
  const dy = player.y - gem.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= pickupRadius) return 'collected';
  if (dist > magnetRadius) {
    // E-lite 滞留漂移：落地超时且距玩家超出磁吸半径 → 慢漂向玩家（保留"地面战利品"张力）
    if (drift && drift.ageSeconds >= drift.ageThreshold) {
      const step = Math.min(dist, drift.driftSpeed * dtSeconds);
      gem.x += (dx / dist) * step;
      gem.y += (dy / dist) * step;
      return 'drifting';
    }
    return 'idle';
  }
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
  /** M3 真机埋点：本局经验拾取总量（xpGainedPerRun 数据源；addXp 每次累加，局终由 PlayScene 汇入 RunStats） */
  xpGained = 0;
  /** 磁吸半径倍率（upgrade-pool 第 9 项：+100% → ×2，×3）；1 = 80px */
  private magnetMultiplier = 1;
  /** E4-S1 守夜人「提灯圣辉」：磁吸半径附加 px（与倍率叠加，content-design-outline §2.2） */
  private magnetRadiusBonus = 0;
  /** E4-S4 升级池 up_g_9：拾取半径附加 px（+40px ×2，与磁力叠加） */
  private pickupRadiusBonus = 0;
  /** P1-8 滤月余辉经验获取乘区（1 + 天赋 xpGainPct；默认 1） */
  private xpGainMult = 1;
  /** 跨阈值但尚未进入选卡流程的升级次数（大宝石一次连升） */
  private pendingLevelUps = 0;

  constructor(
    private readonly gemPool: GemPoolLike,
    private readonly player: GemPlayerLike,
  ) {}

  get magnetRadius(): number {
    return GEM.MAGNET_RADIUS * this.magnetMultiplier + this.magnetRadiusBonus;
  }

  get pickupRadius(): number {
    return GEM.PICKUP_RADIUS + this.pickupRadiusBonus;
  }

  /** E3-S5 写回：经验磁力 +100%（upgrade-pool 第 9 项） */
  setMagnetMultiplier(multiplier: number): void {
    this.magnetMultiplier = multiplier;
  }

  /** E4-S1 写回：磁吸半径附加 px（守夜人专属被动 +20px；随角色装配） */
  setMagnetRadiusBonus(bonus: number): void {
    this.magnetRadiusBonus = bonus;
  }

  /** E4-S4 写回：拾取半径附加 px（up_g_9 拾取范围 +40px；与磁力叠加） */
  addPickupRadiusBonus(bonus: number): void {
    this.pickupRadiusBonus += bonus;
  }

  /** 每帧：漂移年龄累加 + 磁吸 + 拾取（只遍历 active 宝石，磁吸每帧距离检查 ≤300 次，RV-C4 可忽略） */
  update(dt: number): void {
    this.gemPool.eachActive((gem) => {
      gem.age += dt; // TASK-39 E1 E-lite：落地年龄（滞留 >3s 才启动慢漂）
      const drift: GemDriftOptions = {
        ageSeconds: gem.age,
        ageThreshold: GEM.DRIFT_AGE_THRESHOLD,
        driftSpeed: GEM.DRIFT_SPEED,
      };
      const result = stepGem(gem, this.player, dt, this.magnetRadius, GEM.MAGNET_SPEED, this.pickupRadius, drift);
      if (result === 'collected') {
        this.addXp(gem.xpValue);
        // TASK-28：负载补 x/y（拾取爆点定位）；既有消费方（HUD/音频）只读 amount，加字段不破坏
        GameEvents.emit(GameEvent.GemCollected, { amount: gem.xpValue, x: gem.x, y: gem.y });
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
    // P1-8 滤月余辉经验获取 +x%（天赋 A-5/A-5Ⅱ）：实际入账 = 拾取量 × 乘区
    const gained = amount * this.xpGainMult;
    this.xp += gained;
    this.xpGained += gained; // M3 真机埋点：拾取累计（含升级消耗，口径 = 有效获取总量）
    let ups = 0;
    while (this.xp >= needXp(this.level) && this.level < XP.MAX_LEVEL) {
      this.xp -= needXp(this.level);
      this.level += 1;
      this.pendingLevelUps += 1;
      ups += 1;
    }
    return ups;
  }

  /** P1-8 天赋经验获取乘区（1 + xpGainPct；默认 1） */
  setXpGainMultiplier(mult: number): void {
    this.xpGainMult = mult;
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
