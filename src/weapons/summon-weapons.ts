/**
 * weapons/summon-weapons.ts —— D 类召唤定向行为（E2-S5，配置驱动）
 *
 * - wpn_d_1 血蝠群：2 只 / 6 伤 / 0.5s 攻击间隔 / 存在 12s / 重召唤 5s
 * - wpn_d_2 狼影猎犬：1 只 / 15 伤 / 1.0s / 存在 15s / 重召唤 4s
 * - wpn_d_3 断罪锁链：朝最近敌方向直线 200px，命中首个敌人 25 伤 + 击退 100px；CD 3.5s
 *   （gdd-weapons-v2 §3.5 注：D 类定向挥击，吃 D 类强化）
 *
 * 召唤物规则（gdd-weapons-v2 §⑥.5）：召唤物死亡/到期 → 按重召唤间隔重新召唤；
 * 召唤物死亡瞬间移除碰撞，不再造成伤害。召唤物为独立实体（玩家侧色系：月银白+冷青
 * 描边，与同名敌暗红区分，§3.5 R-D 裁定）。
 */

import Phaser from 'phaser';
import type { WeaponConfig, WeaponId } from '@/config/balance';
import { WEAPON_CONFIGS } from '@/config/balance';
import { GameEvents, GameEvent } from '@/core/events';
import { computeHitDamage, hitEnemy } from '@/combat/damage';
import { nearestEnemy } from '@/weapons/weapon-math';
import { deriveSummonParams, applyKeyPassivesToSummon, type SummonDerivedParams } from '@/weapons/weapon-runtime';
import type { KeyPassiveState } from '@/upgrade/upgrade-apply-v2';
import type { ClassUpgradeStacks } from '@/weapons/class-upgrades';
import type { WeaponBehavior, WeaponUpdateContext } from '@/weapons/weapon-behavior';
import type { FxManager } from '@/fx/fx-manager';
import { sceneWeaponVisual } from '@/fx/external-atlas';
import type { Enemy } from '@/enemies/enemy';

/** 召唤物实体（独立 Sprite，不叠加在玩家身上；玩家侧月银白） */
class SummonSprite extends Phaser.Physics.Arcade.Sprite {
  damage = 0;
  remaining = 0;
  /** 是否已死亡（到期/被击杀后置 true → 移除碰撞） */
  dead = false;

  constructor(scene: Phaser.Scene, x: number, y: number, texture?: string, frame?: string | number) {
    super(scene, x, y, texture ?? 'characters', frame ?? 'orb');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.enable = false;
    this.setActive(false).setVisible(false);
    this.setTint(0xe8f0fa); // 月银白（玩家侧色系）
  }

  activate(x: number, y: number, damage: number, lifetime: number): void {
    this.damage = damage;
    this.remaining = lifetime;
    this.dead = false;
    this.setPosition(x, y);
    this.setActive(true).setVisible(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.reset(x, y);
  }

  /** 每帧：寿命递减；到期标记死亡（碰撞移除由 behavior 处理） */
  tick(dt: number): boolean {
    this.remaining -= dt;
    if (this.remaining <= 0) {
      this.dead = true;
      return false;
    }
    return true;
  }

  deactivate(): void {
    if (!this.active) return;
    this.setActive(false).setVisible(false);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.stop();
    body.enable = false;
  }
}

/** D 类召唤行为（d1/d2 召唤；d3 定向锁链） */
export class SummonWeaponBehavior implements WeaponBehavior {
  readonly weaponClass = 'D' as const;
  private readonly config: WeaponConfig;
  private enabled = false;
  private params: SummonDerivedParams;
  private readonly summons: SummonSprite[] = [];
  /** 召唤物攻击计时（一轮撕咬） */
  private attackTimer = 0;
  /** 重召唤倒计时（d3 为定向冷却） */
  private respawnTimer = 0;
  private d3Cooldown = 0;
  private readonly chain: Phaser.GameObjects.Sprite;
  /** B4-W2 R-7 葬仪断罪钩子（WeaponSystem 注入）：返回拖拽落点 {x,y} = 已拖拽（真位移至落点并跳过击退）；
   *  null = 未共鸣/超程（击退原行为）；未配置 = 击退原行为 */
  onHitResonance?: (target: Enemy, now: number) => { x: number; y: number } | null;
  /** B6-W4 R-8 狼群誓约：召唤上限共享门控（返回 false = 上限满静默丢弃 §⑦-2）；未配置 = 不设限 */
  summonGate?: () => boolean;
  /** M3-DESIGN-1 专精疾射：独立冷却乘区（×0.88^stack；非目标 1.0） */
  private focusedCooldownMultiplier = 1;
  /** E4-S4 钥被动（D3 锁链独立字段；召唤群走 params） */
  private keyRangeMult = 1;
  private keyCooldownMult = 1;
  private keyDamageMult = 1;

  constructor(
    scene: Phaser.Scene,
    readonly weaponId: WeaponId,
    private readonly fx: FxManager,
  ) {
    this.config = WEAPON_CONFIGS[weaponId];
    this.params = deriveSummonParams(this.config, { a1: 0, a2: 0, a3: 0, b1: 0, b2: 0, b3: 0, c1: 0, c2: 0, c3: 0, d1: 0, d2: 0, d3: 0 });
    const fallback = this.config.frame === 'summon-bat' ? 'orb' : 'missile';
    const vis = sceneWeaponVisual(scene, this.config.frame, fallback);
    // 召唤物上限 6（gdd-upgrade-pool-v2 §3.3 D1 注：上限 6）
    for (let i = 0; i < 6; i += 1) {
      const s = new SummonSprite(scene, 0, 0, vis.atlas, vis.frame);
      if (vis.dedicated) s.clearTint();
      this.summons.push(s);
    }
    const chainVis = sceneWeaponVisual(scene, 'beam-chain', 'missile');
    this.chain = scene.add
      .sprite(0, 0, chainVis.atlas, chainVis.frame)
      .setOrigin(0.5, 0)
      .setDepth(88)
      .setActive(false)
      .setVisible(false);
    this.chain.setData('dedicated', chainVis.dedicated);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.clearAll();
  }

  applyClassUpgrade(stacks: ClassUpgradeStacks): void {
    this.currentClassStacks = stacks;
    this.params = deriveSummonParams(this.config, stacks);
  }

  /** E4-S4 钥被动（key_pact 召唤数 +1 / key_bone 存在 +20% / key_silver 伤害 ×1.12 / key_tome 节拍 ×0.9；
   *  D3 锁链独立吃 key_scope 射程 +15% / key_tome 冷却 -10%，gdd-upgrade-pool-v2 §3.4） */
  applyKeyPassives(keys: KeyPassiveState): void {
    this.params = applyKeyPassivesToSummon(deriveSummonParams(this.config, this.currentClassStacks), keys);
    // D3 锁链字段（params 不承载锁链的射程/冷却；直接乘区叠加，与专精疾射独立）
    this.keyRangeMult = keys.rangeMult;
    this.keyCooldownMult = keys.cooldownMult;
    this.keyDamageMult = keys.damageMult;
  }

  /** M3-DESIGN-1 专精疾射：独立冷却乘区（×0.88^stack；非目标 1.0） */
  applyFocusedCooldown(multiplier: number): void {
    this.focusedCooldownMultiplier = multiplier;
  }

  /** 最近一次类强化堆叠（钥被动派生用；初始空） */
  private currentClassStacks: ClassUpgradeStacks = {
    a1: 0, a2: 0, a3: 0, b1: 0, b2: 0, b3: 0, c1: 0, c2: 0, c3: 0, d1: 0, d2: 0, d3: 0,
  };

  clearAll(): void {
    for (const s of this.summons) s.deactivate();
    this.chain.setActive(false).setVisible(false);
    this.respawnTimer = 0;
    this.d3Cooldown = 0;
  }

  /** 当前活跃召唤物数 */
  get activeCount(): number {
    return this.summons.filter((s) => s.active).length;
  }

  update(ctx: WeaponUpdateContext): void {
    if (!this.enabled) return;
    if (this.config.id === 'wpn_d_3') {
      this.updateChain(ctx);
      return;
    }
    const p = this.params;
    // 召唤物推进（寿命/攻击节拍/重召）
    let alive = 0;
    for (const s of this.summons) {
      if (!s.active) continue;
      if (!s.tick(ctx.dt)) {
        // 到期：移除碰撞（gdd-weapons-v2 §⑥.5），进入重召倒计时
        s.deactivate();
        this.respawnTimer = p.respawnCd;
        continue;
      }
      alive += 1;
      // 索敌攻击：朝最近敌撕咬（D2 索敌 ×1.30 建模：追击距离放大）
      this.updateSummonAttack(s, ctx);
    }
    // 重召唤：补足至 params.count（B6-W4 R-8：狼群誓约上限共享——召唤门控 false 时静默丢弃，§⑦-2）
    if (alive < p.count) {
      this.respawnTimer -= ctx.dt;
      if (this.respawnTimer <= 0 && alive < p.count && (this.summonGate?.() ?? true)) {
        const slot = this.summons.find((s) => !s.active);
        if (slot) {
          slot.activate(
            ctx.player.x + (Math.random() - 0.5) * 40,
            ctx.player.y + (Math.random() - 0.5) * 40,
            computeHitDamage(p.damage, ctx.damageMultiplier),
            p.lifetime,
          );
          this.respawnTimer = p.respawnCd;
          alive += 1;
        }
      }
    }
  }

  private updateSummonAttack(s: SummonSprite, ctx: WeaponUpdateContext): void {
    this.attackTimer -= ctx.dt;
    if (this.attackTimer > 0) return;
    this.attackTimer = this.params.attackInterval * this.focusedCooldownMultiplier;
    const aggroRange = 260 * this.params.aggroMult;
    const target = nearestEnemy({ x: s.x, y: s.y }, ctx.enemies);
    if (!target) return;
    const dx = target.x - s.x;
    const dy = target.y - s.y;
    const dist = Math.hypot(dx, dy);
    if (dist > aggroRange) return;
    // 命中：召唤物攻击判定（碰撞半径近似）
    if (dist <= 24 + (target as Enemy).radius) {
      // E4-S2 血影突袭标记：被标记目标武器伤害 ×1.20
      hitEnemy(target as Enemy, s.damage, ctx.now);
      this.fx.orbitHit(s.x, s.y, ctx.now);
    } else {
      // 追击（玩家侧移速 ~ 敌快）
      const v = 170;
      const body = s.body as Phaser.Physics.Arcade.Body;
      body.setVelocity((dx / dist) * v, (dy / dist) * v);
    }
  }

  private updateChain(ctx: WeaponUpdateContext): void {
    this.d3Cooldown = Math.max(0, this.d3Cooldown - ctx.dt);
    if (this.d3Cooldown > 0) return;
    const target = nearestEnemy({ x: ctx.player.x, y: ctx.player.y }, ctx.enemies);
    if (!target) return; // 无目标不挥击（定向）
    this.d3Cooldown = (this.config.cooldown ?? 3.5) * this.focusedCooldownMultiplier * this.keyCooldownMult;
    const c = this.config;
    const angle = Math.atan2(target.y - ctx.player.y, target.x - ctx.player.x);
    const range = (c.range ?? 200) * this.keyRangeMult; // 射程吃 key_scope ×1.15（D3 锁链）
    const endX = ctx.player.x + Math.cos(angle) * range;
    const endY = ctx.player.y + Math.sin(angle) * range;
    const damage = computeHitDamage((c.damage ?? 25) * this.keyDamageMult, ctx.damageMultiplier); // 伤害吃 key_silver ×1.12
    // 直线命中首个敌人 + 击退 100px（gdd-weapons-v2 §3.5）
    let bestEnemy: Enemy | null = null;
    let bestT = Number.POSITIVE_INFINITY;
    for (const e of ctx.enemies) {
      if (!e.active) continue;
      const t = projectPointOnSegmentT(ctx.player.x, ctx.player.y, endX, endY, e.x, e.y);
      if (t < 0 || t > 1) continue;
      const hitX = ctx.player.x + t * (endX - ctx.player.x);
      const hitY = ctx.player.y + t * (endY - ctx.player.y);
      if (Math.hypot(e.x - hitX, e.y - hitY) <= e.radius + 8 && t < bestT) {
        bestT = t;
        bestEnemy = e;
      }
    }
    if (bestEnemy) {
      // E4-S2 血影突袭标记：被标记目标武器伤害 ×1.20
      hitEnemy(bestEnemy, damage, ctx.now);
      // B4-W2 R-7 葬仪断罪：击退改拖拽（P1-4 真位移：拉至巨斧弧心 = 玩家位；位移非状态不走 ICD）——钩子未配置 = 击退原行为
      const dragPoint = this.onHitResonance?.(bestEnemy, ctx.now);
      if (dragPoint) {
        bestEnemy.x = dragPoint.x;
        bestEnemy.y = dragPoint.y;
        const body = (bestEnemy as unknown as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body | null;
        body?.reset(bestEnemy.x, bestEnemy.y);
        return;
      }
      // 击退 100px（沿锁链方向）
      bestEnemy.x += Math.cos(angle) * (c.knockback ?? 100);
      bestEnemy.y += Math.sin(angle) * (c.knockback ?? 100);
      const body = (bestEnemy as unknown as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body | null;
      body?.reset(bestEnemy.x, bestEnemy.y);
    }
    GameEvents.emit(GameEvent.WeaponFired, { x: ctx.player.x, y: ctx.player.y });
    this.fx.missileImpact(endX, endY);
    if (this.chain.getData('dedicated')) {
      this.chain.setPosition(ctx.player.x, ctx.player.y);
      this.chain.setRotation(angle - Math.PI / 2);
      this.chain.setDisplaySize(28, range);
      this.chain.setAlpha(0.9).setActive(true).setVisible(true);
      ctx.player.scene.time.delayedCall(180, () => {
        this.chain.setActive(false).setVisible(false);
      });
    }
  }
}

/** 点在线段上的投影参数 t∈[0,1]（锁链直线命中判定） */
function projectPointOnSegmentT(x0: number, y0: number, x1: number, y1: number, px: number, py: number): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 0.0001) return 0;
  return ((px - x0) * dx + (py - y0) * dy) / lenSq;
}
