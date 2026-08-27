/**
 * weapons/ground-weapons.ts —— C 类范围清屏行为（E2-S4，配置驱动）
 *
 * - wpn_c_1 月蚀脉冲：既有 ShockwaveWeapon（WeaponSystem.shockwave 直挂，注册为 ShockwaveBehaviorAdapter）
 * - wpn_c_2 血池喷涌：地面池 r180 / 3s / 20 伤/s / 减速 20%（gdd-weapons-v2 §3.4）
 * - wpn_c_3 审判圣火：地面火 r200 / 2.5s / 35 伤/s（无减速）
 *
 * 地面池规则（gdd-weapons-v2 §⑥.6）：
 * - 每池独立 tick（0.5s，§3.3 注）；
 * - 同目标同一武器只计最高伤害源一次（防刷伤）—— applyGroundPoolTick 纯函数实现；
 * - C 类范围「无目标照常释放」（§⑥.1 清屏价值）：冷却就绪即铺池（血池/圣火）。
 *   （月蚀脉冲保留「有目标才释放」的 TASK-15 决策，见 shockwave.ts 注释 —— 差异为
 *   design-review-e2 C2 细化，属既有已授权行为，此处不回归。）
 */

import Phaser from 'phaser';
import type { WeaponConfig, WeaponId } from '@/config/balance';
import { WEAPON_CONFIGS } from '@/config/balance';
import { GameEvents, GameEvent } from '@/core/events';
import { computeHitDamage } from '@/combat/damage';
import {
  deriveGroundAreaParams,
  applyKeyPassivesToGround,
  applyGroundPoolTick,
  tickGroundPools,
  type GroundPoolInstance,
  type GroundAreaDerivedParams,
} from '@/weapons/weapon-runtime';
import type { ClassUpgradeStacks } from '@/weapons/class-upgrades';
import type { KeyPassiveState } from '@/upgrade/upgrade-apply-v2';
import type { WeaponBehavior, WeaponUpdateContext } from '@/weapons/weapon-behavior';
import type { FxManager } from '@/fx/fx-manager';
import { sceneHasFrame, sceneWeaponVisual } from '@/fx/external-atlas';

/** C 类地面池行为（c2/c3；c1 用既有 ShockwaveWeapon） */
export class GroundPoolWeaponBehavior implements WeaponBehavior {
  readonly weaponClass = 'C' as const;
  private readonly config: WeaponConfig;
  private enabled = false;
  private cooldown = 0;
  /** M3-DESIGN-1 专精疾射：独立冷却乘区（×0.88^stack；非目标 1.0） */
  private focusedCooldownMultiplier = 1;
  private params: GroundAreaDerivedParams;
  private readonly pools: GroundPoolInstance[] = [];
  private readonly poolSprites: Phaser.GameObjects.Sprite[] = [];
  private readonly decalSprites: Phaser.GameObjects.Sprite[] = [];
  private poolSeq = 0;
  /** 最近一次类强化堆叠（钥被动派生用；初始空） */
  private currentClassStacks: ClassUpgradeStacks = {
    a1: 0, a2: 0, a3: 0, b1: 0, b2: 0, b3: 0, c1: 0, c2: 0, c3: 0, d1: 0, d2: 0, d3: 0,
  };

  constructor(
    scene: Phaser.Scene,
    readonly weaponId: WeaponId,
    _fx: FxManager,
  ) {
    this.config = WEAPON_CONFIGS[weaponId];
    this.params = deriveGroundAreaParams(this.config, { a1: 0, a2: 0, a3: 0, b1: 0, b2: 0, b3: 0, c1: 0, c2: 0, c3: 0, d1: 0, d2: 0, d3: 0 });
    const vis = sceneWeaponVisual(scene, this.config.frame, 'shockwave');
    const useDecal = this.config.id === 'wpn_c_2' && sceneHasFrame(scene, 'effects', 'decal-bloodpool');
    for (let i = 0; i < 8; i += 1) {
      const s = scene.add
        .sprite(0, 0, vis.atlas, vis.frame)
        .setActive(false)
        .setVisible(false)
        .setDepth(75)
        .setAlpha(0.45);
      if (!vis.dedicated) {
        // 缺帧：血池暗红 / 圣火冷青（禁金）
        s.setTint(this.config.id === 'wpn_c_2' ? 0x7e1e1e : 0x54e6c9);
      }
      this.poolSprites.push(s);
      if (useDecal) {
        const d = scene.add
          .sprite(0, 0, 'effects', 'decal-bloodpool')
          .setActive(false)
          .setVisible(false)
          .setDepth(74)
          .setAlpha(0.55);
        this.decalSprites.push(d);
      }
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  applyClassUpgrade(stacks: ClassUpgradeStacks): void {
    this.currentClassStacks = stacks;
    this.params = deriveGroundAreaParams(this.config, stacks);
  }

  /** E4-S4 钥被动（key_holy 范围 ×1.15 / key_grail 持续 ×1.25 / key_tome 冷却 ×0.9 / key_silver 伤害 ×1.12） */
  applyKeyPassives(keys: KeyPassiveState): void {
    this.params = applyKeyPassivesToGround(deriveGroundAreaParams(this.config, this.currentClassStacks), keys);
  }

  /** M3-DESIGN-1 专精疾射：独立冷却乘区（×0.88^stack；非目标 1.0） */
  applyFocusedCooldown(multiplier: number): void {
    this.focusedCooldownMultiplier = multiplier;
  }

  clearAll(): void {
    this.pools.length = 0;
    for (const s of this.poolSprites) s.setActive(false).setVisible(false);
    for (const d of this.decalSprites) d.setActive(false).setVisible(false);
    this.cooldown = 0;
  }

  /** 当前活跃地面池数（基准 draw call 用） */
  get activePoolCount(): number {
    return this.pools.length;
  }

  update(ctx: WeaponUpdateContext): void {
    if (!this.enabled) return;
    // 冷却触发：C 类无目标照常释放（清屏价值，gdd-weapons-v2 §⑥.1）
    this.cooldown = Math.max(0, this.cooldown - ctx.dt);
    if (this.cooldown <= 0) {
      this.cooldown = this.params.cooldown * this.focusedCooldownMultiplier;
      this.placePool(ctx);
    }
    // 池寿命推进
    const alive = tickGroundPools(this.pools, ctx.dt);
    this.pools.length = 0;
    this.pools.push(...alive);
    this.syncSprites();
    // 池 tick（0.5s 间隔由调用侧累加；applyGroundPoolTick 处理同目标最高源）
    this.tickAccumulator -= ctx.dt;
    if (this.tickAccumulator <= 0) {
      this.tickAccumulator = this.params.tickInterval;
      const damagePerTick = computeHitDamage(this.params.damagePerSec, ctx.damageMultiplier) * this.params.tickInterval;
      const livePools = this.pools.map((p) => ({ ...p, damagePerTick }));
      const enemies = ctx.enemies as unknown as {
        active: boolean; x: number; y: number; radius: number; hp: number; kill(): void;
      }[];
      applyGroundPoolTick(livePools, enemies, ctx.now);
    }
  }

  private tickAccumulator = 0;

  private placePool(ctx: WeaponUpdateContext): void {
    const pool: GroundPoolInstance = {
      x: ctx.player.x,
      y: ctx.player.y,
      radius: this.params.radius,
      remaining: this.params.duration,
      damagePerTick: 0,
      slowPct: this.params.slowPct ?? 0,
      lastTick: 0,
    };
    this.pools.push(pool);
    GameEvents.emit(GameEvent.WeaponFired, { x: ctx.player.x, y: ctx.player.y });
    this.syncSprites();
  }

  private syncSprites(): void {
    for (let i = 0; i < this.poolSprites.length; i += 1) {
      const s = this.poolSprites[i];
      if (!s) continue;
      const p = this.pools[i];
      const d = this.decalSprites[i];
      if (p) {
        const pulse = 0.3 + 0.15 * Math.sin(this.poolSeq * 0.7);
        s.setPosition(p.x, p.y).setActive(true).setVisible(true);
        s.setDisplaySize(p.radius * 2, p.radius * 2);
        s.setAlpha(pulse);
        if (d) {
          d.setPosition(p.x, p.y).setActive(true).setVisible(true);
          d.setDisplaySize(p.radius * 1.7, p.radius * 1.7);
          d.setAlpha(pulse * 0.9);
        }
        this.poolSeq += 1;
      } else {
        s.setActive(false).setVisible(false);
        d?.setActive(false).setVisible(false);
      }
    }
  }
}
