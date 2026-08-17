/**
 * player/player.ts —— 守夜人实体（ARCH §3.2 / E1-S6 / E2-S1/E2-S5 / S2）
 *
 * E1 范围：移动（getMove × 移速 × clampDelta）、世界边界 clamp [0,3000]²、障碍 AABB。
 * E2 范围：受击（接触伤害 + 0.5s 无敌帧）、死亡分发（emit player:died）。
 * 伤害计算统一走 combat/damage.ts 纯函数（倍率/无敌帧判定），本类只做响应与副作用。
 * 视觉：程序生成贴图（art-bible §8 允许），月银白剪影 + 冷青描边。
 */

import Phaser from 'phaser';
import { WORLD, PLAYER } from '@/config/balance';
import { PlayerStats } from '@/player/player-stats';
import { isInvulnerable, applyDamage } from '@/combat/damage';
import { GameEvents, GameEvent } from '@/core/events';
import { clampToWorld, type Vec2 } from '@/utils/math';

export class Player extends Phaser.Physics.Arcade.Sprite {
  readonly stats: PlayerStats;
  /** 无敌帧截止（秒时间戳）：0.5s（enemies §⑥.3 / RV-C7） */
  private invulnerableUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'characters', 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.stats = new PlayerStats();
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(PLAYER.RADIUS);
    body.setAllowGravity(false);
    // 边界用 clampToWorld 手动钳制（精确 [0,3000]²，S9），不依赖 Arcade worldBounds
    body.setCollideWorldBounds(false);
    this.setDepth(100);
  }

  /**
   * 每帧移动：输入向量 × 移速（Arcade velocity，fixedStep 60Hz 与渲染帧率解耦；
   * 位移数值断言见 player-stats.moveDisplacement + clampDelta 单测）
   */
  update(move: Vec2): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(move.x * this.stats.moveSpeed, move.y * this.stats.moveSpeed);
    const clamped = clampToWorld({ x: this.x, y: this.y }, WORLD.WIDTH, WORLD.HEIGHT);
    this.setPosition(clamped.x, clamped.y);
  }

  /**
   * 受击：无敌帧 0.5s 内免疫（多敌同帧接触只扣 1 次，E8 §⑥.3）；
   * 命中 → 扣血 + emit player:hurt；HP≤0 → emit player:died（E2-S1 #4）。
   * 返回是否真正受到伤害。
   */
  hurt(amount: number, nowSeconds: number): boolean {
    if (isInvulnerable(nowSeconds, this.invulnerableUntil)) return false;
    applyDamage(this.stats, amount);
    this.invulnerableUntil = nowSeconds + this.stats.invulnerableTime;
    GameEvents.emit(GameEvent.PlayerHurt, { hp: this.stats.hp, maxHp: this.stats.maxHp });
    // E4-S1 HUD：HP 变化统一走 hp:changed（受击/升级回血/吸血/生命上限提升）
    GameEvents.emit(GameEvent.HpChanged, { hp: this.stats.hp, maxHp: this.stats.maxHp });
    if (this.stats.hp <= 0) {
      GameEvents.emit(GameEvent.PlayerDied);
    }
    return true;
  }

  /** 当前是否处于无敌帧（测试/表现层查询） */
  isInvulnerableNow(nowSeconds: number): boolean {
    return isInvulnerable(nowSeconds, this.invulnerableUntil);
  }
}
