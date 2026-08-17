/**
 * enemies/enemy.ts —— 敌人实体（ARCH §3.2/§3.3 / ADR-001 / E2-S2/E2-S5 / S4）
 *
 * 组件式数据字段（ADR-001）：面板值直接写在实体上，跨实体逻辑（移动/伤害）由
 * PlayScene / combat / weapons 统一驱动，实体只持有数据与「被打/死亡」响应。
 * - 普通 3 敌共用一池（classType+maxSize，ARCH §3.3）；Boss 由 E4-S2 单独接入。
 * - 描边纪律 RV-C1：普通敌绝不调用 postFX.addOutline（此处为硬编码纪律，
 *   400 个描边 pass 会直接爆 draw call 预算）。
 * - 敌人互不碰撞（允许重叠成尸潮，enemies §⑥.2）—— 由不设敌-敌 collider 保证。
 */

import Phaser from 'phaser';
import { enemyPanel, type EnemyKindId } from '@/enemies/enemy-types';
import { GameEvents, GameEvent } from '@/core/events';
import type { Player } from '@/player/player';

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  kind: EnemyKindId = 'zombie';
  maxHp = 0;
  hp = 0;
  speed = 0;
  damage = 0;
  xp = 0;
  attackInterval = 0;
  /** 碰撞半径（面板值，供武器圆-圆命中检测） */
  radius = 14;
  /** 接触攻击计时（秒）：与玩家 overlap 且 ≤0 才造成伤害，命中后重置为攻击间隔 */
  attackTimer = 0;
  /** 环绕球同目标内置冷却截止（秒时间戳，weapons §⑥.4，Boss 也适用） */
  orbitHitCooldownUntil = 0;
  /** 霸体截止（秒时间戳）：期内不承伤（E4-S2 Boss 出场 0.5s 霸体；普通敌恒 0） */
  graceUntil = 0;

  /**
   * 构造器：池契约 acquire(x,y,texture?,frame?) —— 由调用方显式传 'characters' + 帧名
   * （TASK-36：与 XpGem/Boss/Missile 对齐，杜绝 'enemy-zombie' 误入 texture 槽产生 __MISSING 警告；
   * 具体 kind 帧在 spawn() 内 setTexture 纠正，构造器帧仅占位）。
   */
  constructor(scene: Phaser.Scene, x: number, y: number, texture?: string, frame?: string | number) {
    super(scene, x, y, texture ?? 'characters', frame ?? 'enemy-zombie');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.enable = false;
    this.setActive(false).setVisible(false);
  }

  /** 从池取出：按面板重置字段并激活（ADR-001 组件式数据字段） */
  spawn(kind: EnemyKindId, x: number, y: number): void {
    const panel = enemyPanel(kind);
    this.kind = kind;
    this.maxHp = panel.hp;
    this.hp = panel.hp;
    this.speed = panel.speed;
    this.damage = panel.damage;
    this.xp = panel.xp;
    this.attackInterval = panel.attackInterval;
    this.radius = panel.radius;
    this.attackTimer = 0;
    this.orbitHitCooldownUntil = 0;
    this.graceUntil = 0; // 霸体由 Boss.beginGrace 显式设置；普通敌恒 0
    this.setTexture('characters', `enemy-${kind}`);
    this.setPosition(x, y);
    this.setActive(true).setVisible(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setCircle(panel.radius);
    body.reset(x, y);
  }

  /** AI 移动：向玩家直线移动（各自移速，enemies §③ / E8-2）；帧率无关由 velocity 驱动 */
  updateMovement(dt: number, player: Player): void {
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    const body = this.body as Phaser.Physics.Arcade.Body;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const len = Math.hypot(dx, dy);
    if (len <= 0.0001) {
      body.setVelocity(0, 0);
      return;
    }
    body.setVelocity((dx / len) * this.speed, (dy / len) * this.speed);
  }

  /**
   * 死亡：回收回池 + 事件分发（E2-S6 / ARCH §3.4）。
   * payload { enemyType, xp, x, y } —— E3 经验宝石 / E4 击杀统计 / 吸血 消费。
   */
  kill(): void {
    if (!this.active) return;
    this.setActive(false).setVisible(false);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.stop();
    body.enable = false;
    GameEvents.emit(GameEvent.EnemyKilled, {
      enemyType: this.kind,
      xp: this.xp,
      x: this.x,
      y: this.y,
    });
  }
}
