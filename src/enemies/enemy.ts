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
import { enemyPanel, runtimeKindForEnemyId, type EnemyKindId } from '@/enemies/enemy-types';
import type { EnemyConfig, EnemyId } from '@/config/balance';
import { GameEvents, GameEvent } from '@/core/events';
import { slowedSpeed } from '@/active-skill/active-skill-effects';
import type { Player } from '@/player/player';

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  kind: EnemyKindId = 'zombie';
  /** E3-S1 内容 ID（15 敌；旧 kind 三敌/Boss 为 null） */
  enemyId: EnemyId | null = null;
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
  /** M1b 主动技：眩晕截止（秒时间戳）：> now 期间冻结移动（updateMovement）且不造成接触伤害（contact） */
  stunnedUntil = 0;
  /** E4-S2 主动技「安魂曲」：减速截止（秒时间戳）+ 减速比例（40% = 0.4） */
  slowUntil = 0;
  slowPct = 0;
  /** E4-S2 主动技「血影突袭」：标记截止（秒时间戳）+ 标记武器伤害倍率（+20% = 1.2） */
  markUntil = 0;
  markDamageMult = 1;

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
    this.enemyId = null;
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
    this.stunnedUntil = 0; // M1b 主动技：眩晕截止重置（重开/复用不残留）
    this.slowUntil = 0; // E4-S2 安魂曲：减速重置
    this.slowPct = 0;
    this.markUntil = 0; // E4-S2 血影突袭：标记重置
    this.markDamageMult = 1;
    this.setTexture('characters', `enemy-${kind}`);
    this.setPosition(x, y);
    this.setActive(true).setVisible(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setCircle(panel.radius);
    body.reset(x, y);
  }

  /**
   * E3-S1 从池取出：按 EnemyConfig（15 敌）注册 —— 面板/移速/攻击间隔/碰撞半径/经验全走配置。
   * 帧名取 config.frame（如 enemy-hound/enemy-wraith），池分类由 runtimeKindForEnemyId 派生
   * （死亡溅射/剪影颜色等 4 类消费）。特殊行为运行时由 enemy-behaviors.ts 纯函数驱动。
   */
  spawnByConfig(cfg: EnemyConfig, x: number, y: number): void {
    this.enemyId = cfg.id;
    this.kind = runtimeKindForEnemyId(cfg.id);
    this.maxHp = cfg.hp;
    this.hp = cfg.hp;
    this.speed = cfg.speed;
    this.damage = cfg.damage;
    this.xp = cfg.xp;
    this.attackInterval = cfg.attackInterval;
    this.radius = cfg.radius;
    this.attackTimer = 0;
    this.orbitHitCooldownUntil = 0;
    this.graceUntil = 0;
    this.stunnedUntil = 0;
    this.slowUntil = 0; // E4-S2 安魂曲：减速重置
    this.slowPct = 0;
    this.markUntil = 0; // E4-S2 血影突袭：标记重置
    this.markDamageMult = 1;
    this.setTexture('characters', cfg.frame);
    this.setPosition(x, y);
    this.setActive(true).setVisible(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setCircle(cfg.radius);
    body.reset(x, y);
  }

  /** AI 移动：向玩家直线移动（各自移速，enemies §③ / E8-2）；帧率无关由 velocity 驱动。
   *  M1b 主动技：`now` 秒时间戳（scene.time.now/1000）；眩晕期内冻结（速度 0、攻击计时不递减，
   *  眩晕结束自然恢复移动与攻击节奏）。缺省 now=0 → 永不眩晕（兼容旧调用方）。 */
  updateMovement(dt: number, player: Player, now = 0): void {
    if (this.stunnedUntil > now) {
      const body = this.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(0, 0);
      return; // 眩晕：冻结移动与攻击计时（contact.ts 同步阻止接触伤害）
    }
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    const body = this.body as Phaser.Physics.Arcade.Body;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const len = Math.hypot(dx, dy);
    if (len <= 0.0001) {
      body.setVelocity(0, 0);
      return;
    }
    // E4-S2 安魂曲：减速期内移速 ×(1-slowPct)（slowUntil 截止后自然恢复）
    const currentSpeed = slowedSpeed(this.speed, this, now);
    body.setVelocity((dx / len) * currentSpeed, (dy / len) * currentSpeed);
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
      // E4-S6 图鉴数据层：15 敌/Boss 内容 ID（旧 kind 三敌为 null，图鉴只记录内容 ID 击杀）
      enemyId: this.enemyId,
      xp: this.xp,
      x: this.x,
      y: this.y,
    });
  }
}
