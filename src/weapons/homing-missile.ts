/**
 * weapons/homing-missile.ts —— 自动飞弹「血月猎手」（ARCH §3.2 / S3 / E2-S3）
 *
 * - 冷却 1.2s 自动触发；命中伤害 = 12 × 总倍率（E2-S1，由 WeaponSystem 传入最终值）
 * - 追踪最近敌人 400px/s、飞行寿命 3s（行程 1200px > 出生环带 900px，RV-N9）
 * - 无目标不发射（W8 §⑥.1）；目标中途死亡立即重寻、无目标原地消散（W8 §⑥.2）
 * - 同屏 ≤8：池 maxSize=8，达上限跳过本冷却（W8-4，由 WeaponSystem 处理）
 * - 池化：从 Arcade.Group get/killAndHide 复用（ADR-001），零频繁 new/destroy
 */

import Phaser from 'phaser';
import { WEAPONS } from '@/config/balance';
import { steerToward, nearestEnemy, type TargetLike } from '@/weapons/weapon-math';

/** 飞弹需要感知的敌人集合（active 过滤由 nearestEnemy 完成） */
export interface MissileEnemyContext {
  readonly enemies: readonly TargetLike[];
}

export class HomingMissile extends Phaser.Physics.Arcade.Sprite {
  private lifetime = 0;
  /** 本次发射的最终伤害（基础 12 × 总倍率，E2-S1 计算后传入） */
  private damage = 0;
  /** 剩余可穿透次数（upgrade-pool 第 6 项：命中后继续飞行穿透 1 敌；0 = 命中即消散） */
  private pierceRemaining = 0;
  /**
   * 是否可分裂（TASK-21 Bug3：仅主弹 true，次级弹 false → 次级弹不再分裂，杜绝无限弹射）。
   * 分裂触发决策在 weapon-system（shouldSpawnSplitMissiles 纯函数），本字段是 per-missile 依据。
   */
  private canSplit = false;
  /** 已命中目标（穿透时跳过，避免同帧/残留重复命中同一目标） */
  private readonly piercedTargets = new Set<object>();
  readonly radius = WEAPONS.MISSILE.RADIUS;

  constructor(scene: Phaser.Scene, x: number, y: number, texture?: string, frame?: string | number) {
    super(scene, x, y, texture ?? 'characters', frame ?? 'missile');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.enable = false;
    this.setActive(false).setVisible(false);
  }

  /** 发射：激活 + 设置追踪寿命、伤害、穿透次数（坐标已由池 acquire 设定） */
  launch(x: number, y: number, damage: number, pierce = 0, split = false): void {
    this.damage = damage;
    this.pierceRemaining = pierce;
    this.canSplit = split; // 主弹可分裂；次级弹 false（TASK-21 Bug3）
    this.piercedTargets.clear();
    this.lifetime = WEAPONS.MISSILE.LIFETIME;
    this.setPosition(x, y);
    this.setActive(true).setVisible(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.reset(x, y);
  }

  /** 命中记录（穿透判断：已命中目标不再重复命中） */
  recordHit(target: object): void {
    this.piercedTargets.add(target);
  }

  hasHit(target: object): boolean {
    return this.piercedTargets.has(target);
  }

  /** 穿透一次（命中后继续飞行；调用方在 remainingPierce > 0 时调用） */
  consumePierce(): void {
    this.pierceRemaining -= 1;
  }

  get remainingPierce(): number {
    return this.pierceRemaining;
  }

  /** 是否主弹（可分裂）；次级弹为 false（TASK-21 Bug3：分裂只发生一次） */
  get splitEligible(): boolean {
    return this.canSplit;
  }

  /** 每帧：寿命递减 → 重寻最近目标 → 400px/s 追踪；无目标原地消散（W8 §⑥.2） */
  tick(dt: number, ctx: MissileEnemyContext): void {
    this.lifetime -= dt;
    if (this.lifetime <= 0) {
      this.dissipate();
      return;
    }
    const target = nearestEnemy({ x: this.x, y: this.y }, ctx.enemies);
    if (!target) {
      this.dissipate();
      return;
    }
    const v = steerToward({ x: this.x, y: this.y }, { x: target.x, y: target.y }, WEAPONS.MISSILE.SPEED);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(v.x, v.y);
    this.setRotation(Math.atan2(v.y, v.x));
  }

  /** 命中/寿命尽：回收回池 */
  dissipate(): void {
    if (!this.active) return;
    this.setActive(false).setVisible(false);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.stop();
    body.enable = false;
  }

  get damageValue(): number {
    return this.damage;
  }
}
