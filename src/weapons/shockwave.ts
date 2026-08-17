/**
 * weapons/shockwave.ts —— 定时冲击波「月蚀脉冲」（ARCH §3.2 池表注释 / S3 / E2-S3/E2-S6）
 *
 * - 冷却 8s；半径 280px、扩散 0.4s；伤害 60 × 总倍率 / 次、全方向穿透所有敌人（weapons §③）
 * - E3 冲击波空放决策（design-review-e2 C2，TASK-15 授权落地）：**有目标才释放**——
 *   冷却就绪但半径内无 active 敌人时保持就绪等待，不空放。原因：E3 接入经验宝石后，
 *   空放 = 损失宝石产出；「半径内有敌人才放」既保清屏价值又保产出（采纳文策渊 C2 建议方案）。
 * - E3 门控：初始未解锁（upgrade-pool 第 2 项「解锁月蚀脉冲」后才生效）
 * - E3-S5 写回：setRadiusMultiplier() 范围 +50%（280→420→560px）；setKnockback() 击退 80px；
 *   setCooldownMultiplier() 冷却 ×0.92（upgrade-pool 第 11 项）
 * - 冲击波用单 Sprite + 0.4s 缩放动画复用，不做频繁生成销毁（ARCH §3.2 池表注释）
 * - 玩家死亡：清除扩散环 + 冷却重置（W8 §⑥.5）
 */

import Phaser from 'phaser';
import { WEAPONS } from '@/config/balance';
import type { FxManager } from '@/fx/fx-manager';
import {
  isCooldownReady,
  tickCooldown,
  distance,
  damageAllInRadius,
  knockbackEnemies,
  type DamageTargetLike,
} from '@/weapons/weapon-math';
import type { Player } from '@/player/player';

export class ShockwaveWeapon {
  private readonly scene: Phaser.Scene;
  private readonly fx: FxManager;
  private readonly ring: Phaser.GameObjects.Sprite;
  private readonly baseSize: number;
  private cooldown = 0;
  private radius: number = WEAPONS.SHOCKWAVE.RADIUS;
  /** E3 门控：初始未解锁（upgrade-pool 第 2 项） */
  private enabled = false;
  /** E3-S5 写回：击退 80px（第 7 项） */
  private knockback = false;
  /** E3-S5 写回：冷却倍率 0.92^stacks（第 11 项） */
  private cooldownMultiplier = 1;

  constructor(scene: Phaser.Scene, fx: FxManager) {
    this.scene = scene;
    this.fx = fx;
    this.ring = scene.add.sprite(0, 0, 'effects', 'shockwave').setDepth(85).setActive(false).setVisible(false);
    // 帧宽（不是图集整张宽）：effects 图集内 'shockwave' 帧 32px
    const frame = scene.textures.getFrame('effects', 'shockwave');
    this.baseSize = frame?.width ?? WEAPONS.SHOCKWAVE.RADIUS; // 兜底：无帧时按半径估
  }

  /** E3-S5 写回：解锁「月蚀脉冲」（280px 生效） */
  unlock(): void {
    this.setEnabled(true);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** E3 升级接口：范围 +50%（280→420→560px，W8-3 / upgrade-pool 第 5 项） */
  setRadiusMultiplier(multiplier: number): void {
    this.radius = WEAPONS.SHOCKWAVE.RADIUS * multiplier;
  }

  /** E3-S5 写回：击退 80px（upgrade-pool 第 7 项） */
  setKnockback(enabled: boolean): void {
    this.knockback = enabled;
  }

  /** E3-S5 写回：冷却 ×0.92^stacks（upgrade-pool 第 11 项，飞弹/冲击波共用） */
  setCooldownMultiplier(multiplier: number): void {
    this.cooldownMultiplier = multiplier;
  }

  /** E4-S5 基准：扩散环当前是否活跃（draw call 估算用） */
  get active(): boolean {
    return this.ring.active;
  }

  /** TASK-28：当前扩散半径（升级范围 +50% 后 280→420→560；冲击波涟漪粒子用） */
  get radiusPx(): number {
    return this.radius;
  }

  /** TASK-36：冷却剩余秒（蓄力脉冲提示用；就绪=0） */
  get cooldownRemaining(): number {
    return this.cooldown;
  }

  /** 每帧：冷却递减 → 就绪且半径内有目标才释放（E3 空放决策） */
  update(dt: number, player: Player, enemies: readonly DamageTargetLike[], damageMultiplier: number): void {
    if (!this.enabled) return; // E3 门控：未解锁不冷却不释放
    this.cooldown = tickCooldown(this.cooldown, dt);
    if (!isCooldownReady(this.cooldown)) return;
    // 有目标才释放：半径内无 active 敌人则保持就绪等待（保宝石产出，design-review-e2 C2）
    const hasTargetInRadius = enemies.some((e) => e.active && distance(player, e) <= this.radius);
    if (!hasTargetInRadius) return;
    this.cooldown = WEAPONS.SHOCKWAVE.COOLDOWN * this.cooldownMultiplier;
    this.fire(player, enemies, damageMultiplier);
  }

  /** 玩家死亡：清除扩散环 + 冷却重置（W8 §⑥.5） */
  clearAll(): void {
    this.cooldown = WEAPONS.SHOCKWAVE.COOLDOWN * this.cooldownMultiplier;
    this.scene.tweens.killTweensOf(this.ring);
    this.ring.setActive(false).setVisible(false);
  }

  private fire(player: Player, enemies: readonly DamageTargetLike[], damageMultiplier: number): void {
    // 全方向穿透：半径内全部敌人受 60 × 总倍率；击杀已由 damageAllInRadius 内 kill 处理
    damageAllInRadius(enemies, { x: player.x, y: player.y }, this.radius, WEAPONS.SHOCKWAVE.DAMAGE * damageMultiplier);
    // E3-S5 写回：击退 80px（第 7 项）；同步 Arcade body 位置，避免下一物理步回弹
    if (this.knockback) {
      knockbackEnemies(enemies, { x: player.x, y: player.y }, this.radius, WEAPONS.SHOCKWAVE.KNOCKBACK_DISTANCE);
      for (const e of enemies) {
        if (!e.active) continue;
        const sprite = e as unknown as Phaser.Physics.Arcade.Sprite;
        const body = sprite.body as Phaser.Physics.Arcade.Body | null;
        body?.reset(e.x, e.y);
      }
    }

    this.ring.setPosition(player.x, player.y).setActive(true).setVisible(true).setAlpha(1);
    const targetScale = (this.radius * 2) / this.baseSize;
    this.ring.setScale(0.05, 0.05);
    this.scene.tweens.add({
      targets: this.ring,
      scaleX: targetScale,
      scaleY: targetScale,
      alpha: 0,
      duration: WEAPONS.SHOCKWAVE.EXPAND_SECONDS * 1000,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.ring.setActive(false).setVisible(false);
        // TASK-36 最大半径白闪环：扩散到位瞬间一圈薄白闪（月蚀亮边；用 ring 固定位置防玩家漂移）
        this.fx.shockwaveEdgeFlash(this.ring.x, this.ring.y, this.radius);
      },
    });
  }
}
