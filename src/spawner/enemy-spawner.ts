/**
 * spawner/enemy-spawner.ts —— 敌潮生成器·Phaser 装配（ARCH §3.1 / S5 / E2-S4）
 *
 * 纯逻辑在 spawner/spawner.ts（budget/阶段/抽签/保底/环带），本类只做秒制累加与
 * 池交互：
 * - 预算按秒累加（budget(t)×dt），帧率无关、掉帧不跳怪（S8 §⑥.5）
 * - 同屏达上限：暂停生成 2s 后重试，不丢弃预算（S8-5 / E8-5）
 * - 3–8min 每 30s 保底 1 厚血（spawner §③ / C-7）；保底厚血出生前 2.5s 血月印记预警（TASK-39 E2）
 * - 20:00 Boss 收束钩子：停止生成 + 清场接口（E4-S3 复用）
 */

import Phaser from 'phaser';
import type { RuntimeConfig } from '@/config/runtime-config';
import type { ArcadePoolLike } from '@/core/object-pools';
import { SPAWNER } from '@/config/balance';
import { GameEvents, GameEvent } from '@/core/events';
import {
  budget,
  stageForTime,
  pickEnemyKind,
  tankGuaranteeDue,
  bossTriggerDue,
  spawnPosition,
} from '@/spawner/spawner';
import type { Enemy } from '@/enemies/enemy';
import type { EnemyKindId } from '@/enemies/enemy-types';
import type { Player } from '@/player/player';

export class EnemySpawner {
  /** 局时秒（仅 RUNNING 累加；20:00 收束后不再累计） */
  private t = 0;
  /** 预算累计（点，≥1 才生成一只） */
  private budgetAcc = 0;
  /** 达上限暂停剩余秒（2s 后重试，不丢弃预算） */
  private retryCooldown = 0;
  /** 厚血保底累计秒（仅 3–8min 阶段使用） */
  private tankGuaranteeAcc = 0;
  /**
   * TASK-39 E2 屠夫预警：保底厚血已「预约」出生（血月印记标记出生点，等待落地）。
   * remaining 倒计时（SPAWNER.TANK_WARNING_SECONDS=2.5s）结束后在标记位置落地。
   */
  private pendingTank: { x: number; y: number; remaining: number } | null = null;
  private stopped = false;

  /** E4-S3 复用：20:00 到达时回调（PlayScene 在此做清场 + Boss 出场） */
  onBossTime: (() => void) | null = null;

  constructor(
    private readonly cfg: RuntimeConfig,
    private readonly enemyPool: ArcadePoolLike<Enemy>,
    private readonly player: Player,
  ) {}

  update(dt: number): void {
    if (this.stopped) return;
    this.t += dt;
    // TASK-39 E2 屠夫预警：预约厚血倒计时（随世界冻结 pause，dt 由 PlayScene RUNNING 秒制驱动）
    this.tickPendingTank(dt);
    // E4-S3：20:00 准时触发（±0.1s，RV-C8）——停止生成 + 回调（PlayScene 清场 + Boss 出场）
    if (bossTriggerDue(this.t, SPAWNER.BOSS_TIME)) {
      this.stopped = true;
      this.pendingTank = null; // 收束后不落地
      this.onBossTime?.();
      return;
    }
    this.budgetAcc += budget(this.t) * dt;
    this.tick(dt);
  }

  /** 玩家死亡：立即停止生成（S8 §⑥.2），重开倒计时无残留刷怪、无残留预警 */
  stop(): void {
    this.stopped = true;
    this.pendingTank = null;
  }

  /**
   * 清场接口（E4-S3：20:00 清场后 Boss 出场）：批量回收全部普通敌。
   * 静默回收（不触发 enemy:killed，避免清场怪掉落经验，语义=「移除」而非「击杀」）。
   */
  clearAll(): void {
    this.enemyPool.eachActive((e) => {
      e.setActive(false).setVisible(false);
      const body = e.body as Phaser.Physics.Arcade.Body;
      body.stop();
      body.enable = false;
    });
  }

  /** 当前局时（秒） */
  get elapsedSeconds(): number {
    return this.t;
  }

  private tick(dt: number): void {
    const stage = stageForTime(this.t);
    if (Number.isFinite(stage.tankGuaranteeEvery)) {
      this.tankGuaranteeAcc += dt;
    } else {
      this.tankGuaranteeAcc = 0;
    }

    if (this.retryCooldown > 0) {
      this.retryCooldown = Math.max(0, this.retryCooldown - dt);
      return; // 暂停期间预算继续累计，不丢弃
    }

    while (this.budgetAcc >= 1) {
      if (this.enemyPool.activeCount >= this.cfg.maxEnemies) {
        this.retryCooldown = SPAWNER.RETRY_PAUSE_SECONDS;
        return; // 达上限暂停 2s 后重试
      }
      const forceTank = tankGuaranteeDue(this.tankGuaranteeAcc, stage.tankGuaranteeEvery);
      const kind: EnemyKindId = forceTank ? 'tank' : pickEnemyKind(stage.weights, Math.random());
      if (kind === 'tank') this.tankGuaranteeAcc = 0; // 自然/保底出厚血都重置累计
      if (forceTank && !this.pendingTank) {
        // TASK-39 E2 屠夫预警：保底厚血先「预约」——出生点血月印记，TANK_WARNING_SECONDS 后落地
        const pos = this.spawnRingPosition();
        this.pendingTank = { x: pos.x, y: pos.y, remaining: SPAWNER.TANK_WARNING_SECONDS };
        GameEvents.emit(GameEvent.TankWarning, { x: pos.x, y: pos.y });
      } else {
        this.spawnOne(kind);
      }
      this.budgetAcc -= 1;
    }
  }

  /** TASK-39 E2：预约厚血倒计时归零 → 在标记位置落地 + 广播 tank:spawned（消费方销毁印记） */
  private tickPendingTank(dt: number): void {
    if (!this.pendingTank) return;
    this.pendingTank.remaining -= dt;
    if (this.pendingTank.remaining > 0) return;
    const p = this.pendingTank;
    this.pendingTank = null;
    this.spawnOneAt('tank', p.x, p.y);
    GameEvents.emit(GameEvent.TankSpawned, { x: p.x, y: p.y });
  }

  /** 出生环带内随机位置（桌面 [600,900] / 移动 [500,800]，S8 §③） */
  private spawnRingPosition(): { x: number; y: number } {
    const ringMin = this.cfg.spawnRing[0]!;
    const ringMax = this.cfg.spawnRing[1]!;
    return spawnPosition(this.player.x, this.player.y, ringMin, ringMax, Math.random() * Math.PI * 2, Math.random());
  }

  private spawnOne(kind: EnemyKindId): void {
    const pos = this.spawnRingPosition();
    this.spawnOneAt(kind, pos.x, pos.y);
  }

  private spawnOneAt(kind: EnemyKindId, x: number, y: number): void {
    // TASK-36：池契约 acquire(x,y,texture?,frame?) —— 显式 'characters' + 帧名（消除 __MISSING 警告）
    const enemy = this.enemyPool.acquire(x, y, 'characters', `enemy-${kind}`);
    if (!enemy) return; // 已检查 activeCount，正常不会为 null
    enemy.spawn(kind, x, y);
  }
}
