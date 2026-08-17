/**
 * enemies/boss.ts —— Boss「血月尊者」实体（S4 / E4-S2 / enemies §③/§⑥.5）
 *
 * 设计说明：
 * - 复用 Enemy 基类（面板驱动 + 直线 AI + kill 分发），Boss 面板见 balance.ENEMIES.boss
 *   （6000HP / 28px/s / 30伤 / 2.0s / 40px / 100经验，E2-S2 埋点断言已含）。
 * - 与普通敌同池（ARCH §3.3 普通 3 敌共用一池，Boss 由 E4 单独 spawn 进同一池，
 *   使 WeaponSystem 自动将 Boss 纳入目标列表——飞弹/环绕球/冲击波可命中 Boss）。
 * - 出场 0.5s 霸体（enemies §⑥.5 / art-bible §4）：`beginGrace(now)` 后 graceUntil 内不承伤，
 *   WeaponSystem.refreshEnemies 按 graceUntil 过滤目标；闪红由 PlayScene 出场 tween 承担。
 * - kill() 重写：普通敌只发 enemy:killed；kind==='boss' 额外发 boss:defeated（E4-S3 终局入口）。
 * - 描边纪律 RV-C1：Boss 允许描边（猩红 4px），普通敌仍禁。描边烘焙进程序贴图
 *   （见 utils/procedural-textures.ts），不产生额外 FX pass，draw call 受控。
 */

import { Enemy } from '@/enemies/enemy';
import { GameEvents, GameEvent } from '@/core/events';
import { bossGraceEndsAt, isBossInGrace } from '@/enemies/boss-math';
import type { EnemyKindId } from '@/enemies/enemy-types';

export class Boss extends Enemy {
  /** 霸体截止（秒时间戳）：期内不承伤（weapons refreshEnemies 过滤） */
  graceUntil = 0;

  /** 出场 0.5s 霸体开始（PlayScene 在 spawn 后调用，now = this.time.now/1000） */
  beginGrace(now: number): void {
    this.graceUntil = bossGraceEndsAt(now);
  }

  /** 是否处于霸体期（期内不承伤） */
  isInGrace(now: number): boolean {
    return isBossInGrace(now, this.graceUntil);
  }

  override spawn(kind: EnemyKindId, x: number, y: number): void {
    super.spawn(kind, x, y);
    this.graceUntil = 0; // 霸体由调用方显式 beginGrace
  }

  override kill(): void {
    if (!this.active) return;
    super.kill(); // enemy:killed（enemyType 'boss'，xp 100）
    if (this.kind === 'boss') {
      // E4-S3 终局入口：PlayScene 监听 → 记录 Boss 战时长 → 胜利结算
      GameEvents.emit(GameEvent.BossDefeated, { bossHp: this.hp });
    }
  }
}
