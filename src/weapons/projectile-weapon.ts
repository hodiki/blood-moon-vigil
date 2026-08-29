/**
 * weapons/projectile-weapon.ts —— A 类弹幕投射行为（E2-S2，配置驱动）
 *
 * 一把 A 类武器一个行为实例（weaponId 区分），全部参数走 WEAPON_CONFIGS +
 * weapon-runtime.deriveProjectileParams（禁止硬编码，sprint-m2-plan §5.1）。
 * 行为差异（gdd-weapons-v2 §3.2）：
 * - wpn_a_1 血月猎手：追踪最近敌（HomingMissile 既有逻辑，注册为 MissileWeaponBehavior）
 * - wpn_a_2 银针连弩：直线 520px/s、穿透 1、射程 400
 * - wpn_a_3 圣银火铳：5 发扇形 45°、近距 220px
 * - wpn_a_4 幽灵飞刃：往返双段（去 380 / 回 500）、穿怪
 * - wpn_a_5 骨钉标枪：直线 700px/s、贯穿 3、**扫掠命中**防穿透漏判（gdd-weapons-v2 §⑥.9）
 *
 * M2 渲染：复用 characters 图集既有 missile 帧 + 按 powerTag 染色（程序剪影兜底，
 * sprint-m2-plan §5.8；M4 按 frame-registry 替换 proj-* 帧，实体零改动）。
 * 本类只做装配与帧转发；冷却/上限/扫掠数学在 weapon-runtime.ts（可单测）。
 */

import Phaser from 'phaser';
import type { RuntimeConfig } from '@/config/runtime-config';
import type { WeaponConfig, WeaponId } from '@/config/balance';
import { WEAPON_CONFIGS } from '@/config/balance';
import { createArcadePool, type ArcadePoolLike } from '@/core/object-pools';
import { GameEvents, GameEvent } from '@/core/events';
import { computeHitDamage, hitEnemy } from '@/combat/damage';
import { weaponDamageOnTarget } from '@/active-skill/active-skill-effects';
import { circlesOverlap } from '@/weapons/weapon-math';
import { segmentCircleOverlap } from '@/weapons/weapon-runtime';
import type { ClassUpgradeStacks } from '@/weapons/class-upgrades';
import type { KeyPassiveState } from '@/upgrade/upgrade-apply-v2';
import type { WeaponBehavior, WeaponUpdateContext } from '@/weapons/weapon-behavior';
import type { FxManager } from '@/fx/fx-manager';
import { sceneWeaponVisual } from '@/fx/external-atlas';
import type { Enemy } from '@/enemies/enemy';

/** A 类直线/扇形弹体（池化，Arcade.Sprite；扫掠命中由 behavior 用上一帧位置判定） */
class StraightProjectile extends Phaser.Physics.Arcade.Sprite {
  damage = 0;
  pierceRemaining = 0;
  vx = 0;
  vy = 0;
  lifetime = 0;
  prevX = 0;
  prevY = 0;
  /** 已命中目标（穿透跳过） */
  private readonly hitSet = new Set<object>();

  constructor(scene: Phaser.Scene, x: number, y: number, texture?: string, frame?: string | number) {
    super(scene, x, y, texture ?? 'characters', frame ?? 'missile');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.enable = false;
    this.setActive(false).setVisible(false);
  }

  launch(x: number, y: number, angle: number, speed: number, damage: number, pierce: number, lifetime: number): void {
    this.damage = damage;
    this.pierceRemaining = pierce;
    this.lifetime = lifetime;
    this.hitSet.clear();
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.setPosition(x, y);
    this.prevX = x;
    this.prevY = y;
    this.setActive(true).setVisible(true);
    this.setRotation(angle);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.reset(x, y);
    body.setVelocity(this.vx, this.vy);
  }

  /** 每帧推进：寿命 + 记录上一帧位置（扫掠判定用） */
  tick(dt: number): boolean {
    this.prevX = this.x;
    this.prevY = this.y;
    this.lifetime -= dt;
    return this.lifetime > 0;
  }

  hasHit(target: object): boolean {
    return this.hitSet.has(target);
  }

  recordHit(target: object): void {
    this.hitSet.add(target);
  }

  consumePierce(): void {
    this.pierceRemaining -= 1;
  }

  dissipate(): void {
    if (!this.active) return;
    this.setActive(false).setVisible(false);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.stop();
    body.enable = false;
  }
}

/** A 类通用行为（直线/扇形/往返/扫掠；血月猎手单独用 MissileWeaponBehavior） */
export class ProjectileWeaponBehavior implements WeaponBehavior {
  readonly weaponClass = 'A' as const;
  private readonly pool: ArcadePoolLike<StraightProjectile>;
  private enabled = false;
  private cooldown = 0;
  private split = 0;
  private pierceBonus = 0;
  private speedMult = 1;
  /** M3-DESIGN-1 专精疾射：独立冷却乘区（×0.88^stack；非目标 1.0） */
  private focusedCooldownMultiplier = 1;
  /** E4-S4 钥被动（key_scope 射程 / key_tome 冷却 / key_silver 伤害；与专精疾射独立乘区乘法叠加） */
  private keyRangeMult = 1;
  private keyCooldownMult = 1;
  private keyDamageMult = 1;
  private readonly config: WeaponConfig;
  /** 往返类：飞刃去程角（回程由 behavior 记录） */
  private readonly boomerangs = new Map<StraightProjectile, { angle: number; phase: 'out' | 'back' }>();
  /** B4-W2 共鸣命中钩子（WeaponSystem 注入；未配置 = 普通形态零变化——验收判据 1） */
  onHitResonance?: (weaponId: WeaponId, target: Enemy, now: number) => void;

  constructor(
    private readonly scene: Phaser.Scene,
    cfg: RuntimeConfig,
    readonly weaponId: WeaponId,
    private readonly fx: FxManager,
  ) {
    this.config = WEAPON_CONFIGS[weaponId];
    // 弹道上限按武器配置（maxActive：银针 6 / 火铳 15 / 飞刃 4 / 标枪 3），不一律走 RuntimeConfig
    this.pool = createArcadePool(this.scene, cfg, 'bullets', StraightProjectile, this.config.maxActive ?? 8);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  applyClassUpgrade(stacks: ClassUpgradeStacks): void {
    this.split = stacks.a1;
    this.pierceBonus = stacks.a2;
    this.speedMult = Math.pow(1.2, stacks.a3);
  }

  /** M3-DESIGN-1 专精疾射：独立冷却乘区（×0.88^stack；非目标 1.0） */
  applyFocusedCooldown(multiplier: number): void {
    this.focusedCooldownMultiplier = multiplier;
  }

  /** E4-S4 钥被动（key_scope 射程 ×1.15 / key_tome 冷却 ×0.9 / key_silver 伤害 ×1.12；
   *  数学与 weapon-runtime.applyKeyPassivesToProjectile 一致，A 类行为为字段式消费） */
  applyKeyPassives(keys: KeyPassiveState): void {
    this.keyRangeMult = keys.rangeMult;
    this.keyCooldownMult = keys.cooldownMult;
    this.keyDamageMult = keys.damageMult;
  }

  clearAll(): void {
    this.pool.eachActive((p) => p.dissipate());
    this.boomerangs.clear();
    this.cooldown = 0;
  }

  update(ctx: WeaponUpdateContext): void {
    if (!this.enabled) return;
    const c = this.config;
    const speed = (c.speed ?? 0) * this.speedMult;
    const damage = computeHitDamage((c.damage ?? 0) * this.keyDamageMult, ctx.damageMultiplier);
    const pierce = (c.pierce ?? 0) + this.pierceBonus;

    // 冷却触发（无目标不发射，gdd-weapons-v2 §⑥.1）；key_tome 与专精疾射独立乘区乘法叠加
    this.cooldown = Math.max(0, this.cooldown - ctx.dt);
    if (this.cooldown <= 0) {
      this.cooldown = (c.cooldown ?? 0) * this.focusedCooldownMultiplier * this.keyCooldownMult;
      if (ctx.enemies.some((e) => e.active)) {
        const pellets = c.pellets ?? 1;
        const spread = (c.spreadDeg ?? 0) * (Math.PI / 180);
        const baseAngle = this.aimAngle(ctx.player, ctx.enemies);
        const count = this.pool.activeCount;
        const cap = c.maxActive ?? 0;
        if (count + pellets <= cap || cap <= 0) {
          for (let i = 0; i < pellets; i += 1) {
            const angle = pellets > 1 ? baseAngle + (i - (pellets - 1) / 2) * (spread / pellets) : baseAngle;
            this.fireOne(ctx, angle, speed, damage, pierce, c);
          }
          GameEvents.emit(GameEvent.WeaponFired, { x: ctx.player.x, y: ctx.player.y });
        }
        // 达上限跳过本冷却（不积压、不报错，gdd-weapons-v2 §⑥.3）
      }
    }

    // 弹体推进 + 命中（直线：扫掠判定；往返：相位切换）
    this.pool.eachActive((p) => {
      const alive = p.tick(ctx.dt);
      if (!alive) {
        p.dissipate();
        return;
      }
      this.checkProjectileHits(p, ctx.enemies, damage, c, ctx.now);
    });
    // 往返回程：飞刃到达射程后回程（射程吃 key_scope ×1.15）
    for (const [p, meta] of this.boomerangs) {
      if (!p.active) continue;
      const c4 = this.config;
      if (meta.phase === 'out') {
        const dist = Math.hypot(p.x - ctx.player.x, p.y - ctx.player.y);
        if (dist >= (c4.range ?? 240) * this.keyRangeMult) {
          meta.phase = 'back';
          const angle = Math.atan2(ctx.player.y - p.y, ctx.player.x - p.x);
          const rs = (c4.returnSpeed ?? 0) || (c4.speed ?? 0);
          p.vx = Math.cos(angle) * rs;
          p.vy = Math.sin(angle) * rs;
          const body = p.body as Phaser.Physics.Arcade.Body;
          body.setVelocity(p.vx, p.vy);
          p.setRotation(angle);
        }
      } else if (Math.hypot(p.x - ctx.player.x, p.y - ctx.player.y) < 24) {
        p.dissipate();
      }
    }
  }

  private aimAngle(player: { x: number; y: number }, enemies: readonly Enemy[]): number {
    const target = enemies.find((e) => e.active);
    if (!target) return 0;
    return Math.atan2(target.y - player.y, target.x - player.x);
  }

  private fireOne(
    ctx: WeaponUpdateContext,
    angle: number,
    speed: number,
    damage: number,
    pierce: number,
    c: WeaponConfig,
  ): void {
    const vis = sceneWeaponVisual(this.scene, c.frame, 'missile');
    const p = this.pool.acquire(ctx.player.x, ctx.player.y, vis.atlas, vis.frame);
    if (!p) return;
    // 飞行寿命 × key_scope（射程 = 速度 × 寿命，A 类直线弹的射程口径）
    p.launch(ctx.player.x, ctx.player.y, angle, speed, damage, pierce, (c.lifetime ?? 1.2) * this.keyRangeMult);
    if (c.id === 'wpn_a_4') this.boomerangs.set(p, { angle, phase: 'out' });
    // 契约帧到货后不再套 powerTag 染色（会脏 14 token）；缺帧才染程序剪影
    if (vis.dedicated) p.clearTint();
    else p.setTint(this.tintFor(c.powerTag));
  }

  private checkProjectileHits(
    p: StraightProjectile,
    enemies: readonly Enemy[],
    damage: number,
    c: WeaponConfig,
    now: number,
  ): void {
    for (const enemy of enemies) {
      if (!enemy.active) continue;
      if (p.hasHit(enemy)) continue;
      const hit =
        c.speed !== undefined && c.speed >= 600
          ? segmentCircleOverlap(p.prevX, p.prevY, p.x, p.y, enemy.x, enemy.y, enemy.radius + 6)
          : circlesOverlap(p.x, p.y, 6, enemy.x, enemy.y, enemy.radius);
      if (!hit) continue;
      // E4-S2 血影突袭标记：被标记目标武器伤害 ×1.20
      hitEnemy(enemy, weaponDamageOnTarget(damage, enemy, now));
      p.recordHit(enemy);
      // B4-W2 共鸣命中钩子（R-2 银潮轮舞回充计数 / R-3 血月回旋印记）
      this.onHitResonance?.(c.id, enemy, now);
      this.fx.missileImpact(p.x, p.y);
      if (p.pierceRemaining > 0) {
        p.consumePierce();
        continue;
      }
      // 分裂（A1）：命中后生成次级弹 ×0.6（同屏上限内）
      for (let i = 0; i < this.split; i += 1) {
        const vis = sceneWeaponVisual(this.scene, c.frame, 'missile');
        const sub = this.pool.acquire(p.x, p.y, vis.atlas, vis.frame);
        if (sub) {
          sub.launch(p.x, p.y, Math.random() * Math.PI * 2, 320, damage * 0.6, 0, 0.8);
          if (vis.dedicated) sub.clearTint();
          else sub.setTint(this.tintFor(c.powerTag));
        }
      }
      p.dissipate();
      break;
    }
  }

  private tintFor(powerTag: string): number {
    switch (powerTag) {
      case 'SILVER':
        return 0xcfd8e6;
      case 'BLOOD':
        return 0xc05252;
      case 'MOON':
        return 0xe8f0fa;
      case 'BEAST':
        return 0x9aa37a;
      default:
        return 0xe8f0fa;
    }
  }
}
