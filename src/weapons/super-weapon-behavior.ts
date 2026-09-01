/**
 * weapons/super-weapon-behavior.ts —— 超武行为（E2-S7，装配层）
 *
 * 7 超武质变装配（gdd-weapons-v2 §5.2）：按模式路由到既有/复用实现
 * （弹幕 / 环绕 / 双脉冲 / 地面池 / 召唤），全部参数走 SUPER_WEAPON_SPECS（禁止硬编码）。
 * 超武不再吃类强化（applyClassUpgrade 为 no-op，防再膨胀）。
 * M2 渲染复用既有帧 + 染色（程序剪影兜底；M4 按 frame-registry 换 super-* 帧）。
 */

import Phaser from 'phaser';
import type { RuntimeConfig } from '@/config/runtime-config';
import type { EvoId, WeaponId } from '@/config/balance';
import { GameEvents, GameEvent } from '@/core/events';
import { computeHitDamage, hitEnemy } from '@/combat/damage';
import { applyStatus } from '@/combat/status/status-engine';
import { createArcadePool, type ArcadePoolLike } from '@/core/object-pools';
import { nearestEnemy, circlesOverlap } from '@/weapons/weapon-math';
import { superWeaponSpec, type SuperWeaponSpec } from '@/weapons/super-weapons';
import type { ClassUpgradeStacks } from '@/weapons/class-upgrades';
import type { WeaponBehavior, WeaponUpdateContext } from '@/weapons/weapon-behavior';
import type { FxManager } from '@/fx/fx-manager';
import { sceneWeaponVisual } from '@/fx/external-atlas';

/** 超武追踪弹（复用 HomingMissile 池化模式：追踪最近敌、命中分裂） */
class SuperHomingProjectile extends Phaser.Physics.Arcade.Sprite {
  damage = 0;
  lifetime = 0;
  splitPerHit = 0;
  subDamageMult = 0.6;

  constructor(scene: Phaser.Scene, x: number, y: number, texture?: string, frame?: string | number) {
    super(scene, x, y, texture ?? 'characters', frame ?? 'missile');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.enable = false;
    this.setActive(false).setVisible(false);
  }

  launch(x: number, y: number, damage: number, lifetime: number, splitPerHit: number, subDamageMult: number): void {
    this.damage = damage;
    this.lifetime = lifetime;
    this.splitPerHit = splitPerHit;
    this.subDamageMult = subDamageMult;
    this.setPosition(x, y);
    this.setActive(true).setVisible(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.reset(x, y);
  }

  tick(dt: number, ctx: WeaponUpdateContext): void {
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
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const len = Math.hypot(dx, dy) || 1;
    const v = 460;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity((dx / len) * v, (dy / len) * v);
    this.setRotation(Math.atan2(dy, dx));
  }

  dissipate(): void {
    if (!this.active) return;
    this.setActive(false).setVisible(false);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.stop();
    body.enable = false;
  }
}

/**
 * 超武行为（按 evoId 质变模式路由；不可逆；不吃类强化）。
 * 本冲刺装配核心行为数学（命中/冷却/上限），进化触发（升级池进化卡）由 E4-S4 接线。
 */
export class SuperWeaponBehavior implements WeaponBehavior {
  readonly weaponClass = 'A' as const; // 超武独立类目，不吃类强化（weaponClass 仅供结构）
  /**
   * QA-BUG-1（2026-08-27）根因修复：spec 必须在构造体内赋值，不得用字段初始化器引用
   * 构造参数属性。useDefineForClassFields 下字段初始化先于构造体（参数属性绑定）执行，
   * 原 `private readonly spec = superWeaponSpec(this.evoId)` 实际拿到 undefined →
   * 进化选卡瞬间 SuperWeaponBehavior 构造抛 TypeError → onUpgradeChosen 中断在
   * state.set(RUNNING) 之前 → 世界停在 LEVEL_UP 且选卡层已隐藏 = 整局隐形卡死。
   */
  private readonly spec: SuperWeaponSpec;
  private enabled = false;
  private readonly pool: ArcadePoolLike<SuperHomingProjectile>;
  private cooldown = 0;
  /** M3-DESIGN-1 专精疾射：独立冷却乘区（×0.88^stack；非目标 1.0） */
  private focusedCooldownMultiplier = 1;
  private readonly orbs: Phaser.GameObjects.Sprite[] = [];
  private angleRad = 0;
  private readonly visual: { atlas: string; frame: string; dedicated: boolean };
  private readonly pulseRing: Phaser.GameObjects.Sprite;
  private readonly sea: Phaser.GameObjects.Sprite;

  constructor(
    private readonly scene: Phaser.Scene,
    cfg: RuntimeConfig,
    readonly weaponId: WeaponId,
    readonly evoId: EvoId,
    private readonly fx: FxManager,
  ) {
    this.spec = superWeaponSpec(evoId); // 构造体内赋值（依赖参数属性；见类字段注释）
    this.pool = createArcadePool(this.scene, cfg, 'bullets', SuperHomingProjectile, 12);
    const vis = sceneWeaponVisual(this.scene, this.spec.frame, this.spec.fallbackFrame);
    this.visual = vis;
    for (let i = 0; i < 6; i += 1) {
      const orb = this.scene.add
        .sprite(0, 0, vis.atlas, vis.frame)
        .setActive(false)
        .setVisible(false)
        .setDepth(90)
        .setScale(vis.dedicated ? 1.15 : 1.6);
      if (!vis.dedicated) orb.setTint(0xb06af0);
      this.orbs.push(orb);
    }
    this.pulseRing = this.scene.add
      .sprite(0, 0, vis.atlas, vis.frame)
      .setDepth(84)
      .setActive(false)
      .setVisible(false)
      .setAlpha(0.55);
    this.sea = this.scene.add
      .sprite(0, 0, vis.atlas, vis.frame)
      .setDepth(74)
      .setActive(false)
      .setVisible(false)
      .setAlpha(0.45);
    if (!vis.dedicated) {
      this.pulseRing.setTint(0xb06af0);
      this.sea.setTint(0x7e1e1e);
    }
  }

  /** 超武不吃类强化（gdd-weapons-v2 §5.1：已质变，防再膨胀） */
  applyClassUpgrade(_stacks: ClassUpgradeStacks): void {
    // no-op
  }

  /** M3-DESIGN-1 专精疾射：独立冷却乘区（×0.88^stack；非目标 1.0） */
  applyFocusedCooldown(multiplier: number): void {
    this.focusedCooldownMultiplier = multiplier;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.clearAll();
  }

  clearAll(): void {
    this.pool.eachActive((p) => p.dissipate());
    for (const o of this.orbs) o.setActive(false).setVisible(false);
    this.pulseRing.setActive(false).setVisible(false);
    this.sea.setActive(false).setVisible(false);
    this.cooldown = 0;
  }

  update(ctx: WeaponUpdateContext): void {
    if (!this.enabled) return;
    switch (this.spec.mode) {
      case 'homing-salvo':
        this.updateHomingSalvo(ctx);
        break;
      case 'fan-splash':
        this.updateFanSplash(ctx);
        break;
      case 'orbit-knock':
        this.updateOrbit(ctx);
        break;
      case 'double-pulse':
        this.updateDoublePulse(ctx);
        break;
      case 'ground-pool':
        this.updateGroundPool(ctx);
        break;
      case 'summon-lifesteal':
      case 'summon-slow':
        this.updateSummon(ctx);
        break;
    }
  }

  private updateHomingSalvo(ctx: WeaponUpdateContext): void {
    const p = this.spec.params;
    this.cooldown -= ctx.dt;
    if (this.cooldown > 0) return;
    if (!ctx.enemies.some((e) => e.active)) return;
    this.cooldown = 1.2 * this.focusedCooldownMultiplier;
    const salvos = p.salvos ?? 3;
    const damage = computeHitDamage(p.damage ?? 12, ctx.damageMultiplier);
    for (let i = 0; i < salvos; i += 1) {
      const proj = this.pool.acquire(ctx.player.x, ctx.player.y, this.visual.atlas, this.visual.frame);
      if (!proj) break;
      proj.launch(ctx.player.x, ctx.player.y, damage, 3, p.splitPerHit ?? 1, p.subDamageMult ?? 0.6);
      this.applySuperTint(proj);
    }
    GameEvents.emit(GameEvent.WeaponFired, { x: ctx.player.x, y: ctx.player.y });
    // 命中：分裂 + 次级弹（与 A1 分裂同语义）
    this.pool.eachActive((proj) => {
      proj.tick(ctx.dt, ctx);
      if (!proj.active) return;
      for (const e of ctx.enemies) {
        if (!e.active) continue;
        if (!circlesOverlap(proj.x, proj.y, 6, e.x, e.y, e.radius)) continue;
        hitEnemy(e, proj.damage, ctx.now);
        for (let s = 0; s < proj.splitPerHit; s += 1) {
          const sub = this.pool.acquire(proj.x, proj.y, this.visual.atlas, this.visual.frame);
          if (sub) {
            sub.launch(proj.x, proj.y, proj.damage * proj.subDamageMult, 1.5, 0, 0.6);
            this.applySuperTint(sub);
          }
        }
        this.fx.missileImpact(proj.x, proj.y);
        proj.dissipate();
        break;
      }
    });
  }

  private updateFanSplash(ctx: WeaponUpdateContext): void {
    const p = this.spec.params;
    this.cooldown -= ctx.dt;
    if (this.cooldown > 0) return;
    if (!ctx.enemies.some((e) => e.active)) return;
    this.cooldown = 2.2 * this.focusedCooldownMultiplier;
    const target = nearestEnemy({ x: ctx.player.x, y: ctx.player.y }, ctx.enemies);
    const baseAngle = target ? Math.atan2(target.y - ctx.player.y, target.x - ctx.player.x) : 0;
    const pellets = p.pellets ?? 8;
    const spread = ((p.spreadDeg ?? 60) * Math.PI) / 180;
    const damage = computeHitDamage(p.damage ?? 10, ctx.damageMultiplier);
    const speed = 420;
    for (let i = 0; i < pellets; i += 1) {
      const proj = this.pool.acquire(ctx.player.x, ctx.player.y, this.visual.atlas, this.visual.frame);
      if (!proj) break;
      const angle = baseAngle + (i - (pellets - 1) / 2) * (spread / pellets);
      proj.launch(ctx.player.x, ctx.player.y, damage, 0.8, 0, 0.6);
      const body = proj.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
      proj.setRotation(angle);
      this.applySuperTint(proj);
    }
    GameEvents.emit(GameEvent.WeaponFired, { x: ctx.player.x, y: ctx.player.y });
    // 命中：爆炸 60px 溅射
    const splash = p.splashRadius ?? 60;
    this.pool.eachActive((proj) => {
      proj.tick(ctx.dt, ctx);
      if (!proj.active) return;
      for (const e of ctx.enemies) {
        if (!e.active) continue;
        if (!circlesOverlap(proj.x, proj.y, 6, e.x, e.y, e.radius)) continue;
        hitEnemy(e, proj.damage, ctx.now);
        // 溅射：命中点 60px 内其它敌人
        for (const other of ctx.enemies) {
          if (!other.active || other === e) continue;
          if (Math.hypot(other.x - proj.x, other.y - proj.y) <= splash + other.radius) hitEnemy(other, proj.damage * 0.5, ctx.now);
        }
        this.fx.missileImpact(proj.x, proj.y);
        proj.dissipate();
        break;
      }
    });
  }

  private updateOrbit(ctx: WeaponUpdateContext): void {
    const p = this.spec.params;
    this.angleRad += ((p.angularSpeedDeg ?? 260) * Math.PI) / 180 * ctx.dt;
    const count = p.count ?? 6;
    const radius = p.radius ?? 96;
    const damage = computeHitDamage(p.damage ?? 12, ctx.damageMultiplier);
    for (let i = 0; i < count; i += 1) {
      const orb = this.orbs[i];
      if (!orb) continue;
      const a = this.angleRad + (i * 2 * Math.PI) / Math.max(1, count);
      orb.setPosition(ctx.player.x + Math.cos(a) * radius, ctx.player.y + Math.sin(a) * radius)
        .setActive(true).setVisible(true);
      for (const e of ctx.enemies) {
        if (!e.active) continue;
        if (ctx.now < e.orbitHitCooldownUntil) continue;
        if (!circlesOverlap(orb.x, orb.y, 16, e.x, e.y, e.radius)) continue;
        e.orbitHitCooldownUntil = ctx.now + 0.4;
        hitEnemy(e, damage, ctx.now);
        // 击退 60px + 0.5s 小爆（简化：击退 + 命中反馈）
        const dx = e.x - ctx.player.x;
        const dy = e.y - ctx.player.y;
        const len = Math.hypot(dx, dy) || 1;
        e.x += (dx / len) * (p.knockback ?? 60);
        e.y += (dy / len) * (p.knockback ?? 60);
        const body = (e as unknown as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body | null;
        body?.reset(e.x, e.y);
        this.fx.orbitHit(orb.x, orb.y, ctx.now);
      }
    }
  }

  private updateDoublePulse(ctx: WeaponUpdateContext): void {
    const p = this.spec.params;
    this.cooldown -= ctx.dt;
    if (this.cooldown > 0) return;
    if (!ctx.enemies.some((e) => e.active)) return;
    this.cooldown = 8 * this.focusedCooldownMultiplier;
    const damage = computeHitDamage(p.damage ?? 60, ctx.damageMultiplier);
    const radius = p.radius ?? 420;
    // 双脉冲（0.4s 间隔）+ 1s 眩晕（gdd-weapons-v2 §5.2）
    this.pulseOnce(ctx, radius, damage, p.stunSeconds ?? 1);
    ctx.player.scene.time.delayedCall((p.pulseGap ?? 0.4) * 1000, () => {
      if (ctx.player.active) this.pulseOnce(ctx, radius, damage, p.stunSeconds ?? 1);
    });
    GameEvents.emit(GameEvent.WeaponFired, { x: ctx.player.x, y: ctx.player.y });
  }

  private pulseOnce(ctx: WeaponUpdateContext, radius: number, damage: number, stunSeconds: number): void {
    for (const e of ctx.enemies) {
      if (!e.active) continue;
      if (Math.hypot(e.x - ctx.player.x, e.y - ctx.player.y) > radius + e.radius) continue;
      hitEnemy(e, damage, ctx.now);
      // P0-2：眩晕写状态层（applyStatus 走抗性表：Boss 免疫 / 精英 ×0.5），不再写 stunnedUntil
      if (stunSeconds > 0 && e.cc) {
        e.cc = applyStatus(e.cc, { kind: 'stun', value: 1, durationSeconds: stunSeconds, source: 'super_moon_eclipse' }, ctx.now, e.ccProfile).state;
      }
    }
    this.fx.shockwaveEdgeFlash(ctx.player.x, ctx.player.y, radius);
    this.pulseRing
      .setPosition(ctx.player.x, ctx.player.y)
      .setDisplaySize(Math.max(48, radius * 2 * 0.35), Math.max(48, radius * 2 * 0.35))
      .setAlpha(0.7)
      .setActive(true)
      .setVisible(true);
    ctx.player.scene.time.delayedCall(180, () => {
      this.pulseRing.setActive(false).setVisible(false);
    });
  }

  private updateGroundPool(ctx: WeaponUpdateContext): void {
    // 已有池 tick 伤害（血海：300px / 5s / 减速 40%）
    if (this.groundPoolRemaining > 0) {
      this.groundPoolRemaining -= ctx.dt;
      if (this.groundPoolRemaining <= 0) {
        this.sea.setActive(false).setVisible(false);
      }
      const damage = computeHitDamage(this.groundPoolDamage, ctx.damageMultiplier) * ctx.dt;
      for (const e of ctx.enemies) {
        if (!e.active) continue;
        if (Math.hypot(e.x - this.groundPoolX, e.y - this.groundPoolY) > this.groundPoolRadius + e.radius) continue;
        hitEnemy(e, damage, ctx.now);
        if (this.groundPoolSlow > 0) {
          e.speed = Math.max(30, e.speed * (1 - this.groundPoolSlow));
        }
      }
      return;
    }
    const p = this.spec.params;
    this.cooldown -= ctx.dt;
    if (this.cooldown > 0) return;
    this.cooldown = 6 * this.focusedCooldownMultiplier;
    this.groundPoolRemaining = p.duration ?? 5;
    this.groundPoolX = ctx.player.x;
    this.groundPoolY = ctx.player.y;
    this.groundPoolRadius = p.radius ?? 300;
    this.groundPoolDamage = p.damagePerSec ?? 20;
    this.groundPoolSlow = p.slowPct ?? 0.4;
    GameEvents.emit(GameEvent.WeaponFired, { x: ctx.player.x, y: ctx.player.y });
    this.fx.shockwaveEdgeFlash(ctx.player.x, ctx.player.y, this.groundPoolRadius);
    this.sea
      .setPosition(this.groundPoolX, this.groundPoolY)
      .setDisplaySize(this.groundPoolRadius * 2, this.groundPoolRadius * 2)
      .setActive(true)
      .setVisible(true);
  }

  private groundPoolRemaining = 0;
  private groundPoolX = 0;
  private groundPoolY = 0;
  private groundPoolRadius = 0;
  private groundPoolDamage = 0;
  private groundPoolSlow = 0;

  private updateSummon(ctx: WeaponUpdateContext): void {
    const p = this.spec.params;
    const count = p.count ?? (this.spec.mode === 'summon-slow' ? 3 : 6);
    this.angleRad += 2.2 * ctx.dt;
    for (let i = 0; i < this.orbs.length; i += 1) {
      const spr = this.orbs[i];
      if (!spr) continue;
      if (i >= count) {
        spr.setActive(false).setVisible(false);
        continue;
      }
      const a = this.angleRad + (i * 2 * Math.PI) / count;
      spr
        .setPosition(ctx.player.x + Math.cos(a) * 42, ctx.player.y + Math.sin(a) * 42)
        .setActive(true)
        .setVisible(true);
    }
    // 血蝠风暴/狼群领袖：简化装配为「自动攻击最近敌 + 击杀吸血/减速」（E4 深化动画）
    this.attackTimer -= ctx.dt;
    if (this.attackTimer <= 0) {
      this.attackTimer = (p.attackInterval ?? 0.5) * this.focusedCooldownMultiplier;
      const damage = computeHitDamage(p.damage ?? 6, ctx.damageMultiplier);
      for (const e of ctx.enemies) {
        if (!e.active) continue;
        if (Math.hypot(e.x - ctx.player.x, e.y - ctx.player.y) > 260 + e.radius) continue;
        const killed = hitEnemy(e, damage, ctx.now);
        if (this.spec.mode === 'summon-slow') {
          // 撕咬减速 30%（1s）—— 记录原速，到期恢复（gdd-weapons-v2 §5.2）
          const originalSpeed = e.speed;
          e.speed = Math.max(30, e.speed * (1 - (p.slowPct ?? 0.3)));
          ctx.player.scene.time.delayedCall((p.slowDuration ?? 1) * 1000, () => {
            if (e.active) e.speed = originalSpeed;
          });
        }
        if (killed && this.spec.mode === 'summon-lifesteal') {
          // 击杀吸血 0.5 HP/只（gdd-weapons-v2 §5.2）
          ctx.player.stats.hp = Math.min(ctx.player.stats.maxHp, ctx.player.stats.hp + (p.lifestealPerKill ?? 0.5));
        }
        break;
      }
    }
  }

  private attackTimer = 0;

  private applySuperTint(proj: SuperHomingProjectile): void {
    if (this.visual.dedicated) proj.clearTint();
    else proj.setTint(0xb06af0);
  }
}
