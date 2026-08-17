/**
 * weapons/orbit-orb.ts —— 护体环绕球「守夜之环」（ARCH §3.2 / S3 / E2-S3/E2-S5）
 *
 * - 基础 3 颗、环绕半径 80px、转速 240°/s（1.5s/圈）；伤害 8/次命中（weapons §③）
 * - 同目标 0.4s 内置冷却：命中后写 enemy.orbitHitCooldownUntil，防单目标多段秒杀
 *   （W8 §⑥.4，Boss 也适用）
 * - 升级接口（E3-S5 写回）：addOrb() 至多 6 颗、setAngularSpeedMultiplier() 转速 +40%
 * - 玩家死亡清除全部环绕球（W8 §⑥.5，PlayScene GAMEOVER 时调用 clearAll）
 * - 环绕球常驻（非频繁生成），不占对象池；伤害走手动圆-圆距离检测（3 颗 × 250/400 敌，开销可忽略）
 */

import Phaser from 'phaser';
import { WEAPONS } from '@/config/balance';
import { hitEnemy } from '@/combat/damage';
import { advanceOrbitAngle, orbitPosition, circlesOverlap, type TargetLike } from '@/weapons/weapon-math';
import type { Player } from '@/player/player';

export interface OrbDamageTarget extends TargetLike {
  hp: number;
  kill(): void;
  orbitHitCooldownUntil: number;
  /** 碰撞半径（来自敌人面板，Enemy.radius） */
  radius: number;
}

export class OrbitWeapon {
  private readonly orbs: Phaser.GameObjects.Sprite[] = [];
  private angleRad = 0;
  private count: number = WEAPONS.ORBIT.BASE_COUNT;
  private radius: number = WEAPONS.ORBIT.RADIUS;
  private angularSpeedDeg: number = WEAPONS.ORBIT.ANGULAR_SPEED_DEG;
  /** E3 门控：初始未解锁（upgrade-pool 第 1 项「解锁守夜之环」后才可见可伤） */
  private enabled = false;

  constructor(scene: Phaser.Scene) {
    for (let i = 0; i < WEAPONS.ORBIT.MAX_COUNT; i += 1) {
      const orb = scene.add.sprite(0, 0, 'characters', 'orb').setActive(false).setVisible(false).setDepth(90);
      this.orbs.push(orb);
    }
    this.syncOrbVisibility();
  }

  get orbCount(): number {
    return this.count;
  }

  /** E3-S5 写回：解锁「守夜之环」（3 颗可见，即时生效 W8-3） */
  unlock(): void {
    this.setEnabled(true);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.syncOrbVisibility();
  }

  /** TASK-28：是否已解锁（环绕球轨道残影环显隐判定；未解锁 count=3 但不可见） */
  get unlocked(): boolean {
    return this.enabled;
  }

  /** E3 升级接口：+1 颗（最多 6 颗，W8-3 / upgrade-pool 第 4 项） */
  addOrb(): void {
    this.count = Math.min(this.count + 1, WEAPONS.ORBIT.MAX_COUNT);
    this.syncOrbVisibility();
  }

  /** E3 升级接口：转速 +40%（336°/s，W8-3 / upgrade-pool 第 4 项） */
  setAngularSpeedMultiplier(multiplier: number): void {
    this.angularSpeedDeg = WEAPONS.ORBIT.ANGULAR_SPEED_DEG * multiplier;
  }

  /** 每帧：旋转 + 命中判定（同目标 0.4s 内置冷却；伤害 = 8 × 总倍率，E2-S1） */
  update(
    dt: number,
    now: number,
    player: Player,
    enemies: readonly OrbDamageTarget[],
    damageMultiplier: number,
  ): void {
    if (!this.enabled) return; // E3 门控：未解锁不旋转不命中
    this.angleRad = advanceOrbitAngle(this.angleRad, this.angularSpeedDeg, dt);
    const damage = WEAPONS.ORBIT.DAMAGE * damageMultiplier;
    for (let i = 0; i < this.count; i += 1) {
      const orb = this.orbs[i];
      if (!orb) continue;
      const pos = orbitPosition({ x: player.x, y: player.y }, this.angleRad + (i * 2 * Math.PI) / this.count, this.radius);
      orb.setPosition(pos.x, pos.y);

      for (const enemy of enemies) {
        if (!enemy.active) continue;
        if (now < enemy.orbitHitCooldownUntil) continue; // 同目标 0.4s CD
        if (!circlesOverlap(pos.x, pos.y, WEAPONS.ORBIT.ORB_RADIUS, enemy.x, enemy.y, enemy.radius)) continue;
        enemy.orbitHitCooldownUntil = now + WEAPONS.ORBIT.PER_TARGET_COOLDOWN;
        hitEnemy(enemy, damage);
      }
    }
  }

  /** 玩家死亡：清除全部环绕球（W8 §⑥.5） */
  clearAll(): void {
    for (const orb of this.orbs) orb.setActive(false).setVisible(false);
  }

  private syncOrbVisibility(): void {
    this.orbs.forEach((orb, i) => {
      const show = this.enabled && i < this.count;
      orb.setActive(show).setVisible(show);
    });
  }
}
