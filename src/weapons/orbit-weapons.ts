/**
 * weapons/orbit-weapons.ts —— B 类环绕护体行为（E2-S3，配置驱动）
 *
 * - wpn_b_1 守夜之环：既有 OrbitWeapon（WeaponSystem.orbit 直挂，注册为 OrbitBehaviorAdapter）
 * - wpn_b_2 荆棘圣环：4 颗 / r72 / 180°/s / 命中减速 30%（1s）/ 同目标 0.4s 内置 CD
 * - wpn_b_3 圣光壁垒：光环 6/s（r120）常驻 tick（0.5s）+ 承伤 -10%
 *
 * B3 承伤 -10%：与升级项「减伤 +10%」加法叠加（上限 -30%，gdd-weapons-v2 §3.3 注；
 * 叠加口径在 upgrade-apply，行为只暴露 damageReduction）。
 * 全部参数走 WEAPON_CONFIGS + weapon-runtime.deriveOrbitParams（禁止硬编码）。
 */

import Phaser from 'phaser';
import type { WeaponConfig, WeaponId } from '@/config/balance';
import { WEAPON_CONFIGS } from '@/config/balance';
import { hitEnemy } from '@/combat/damage';
import { advanceOrbitAngle, orbitPosition, circlesOverlap } from '@/weapons/weapon-math';
import {
  deriveOrbitParams,
  applyKeyPassivesToOrbit,
  type OrbitDerivedParams,
} from '@/weapons/weapon-runtime';
import type { ClassUpgradeStacks } from '@/weapons/class-upgrades';
import type { KeyPassiveState } from '@/upgrade/upgrade-apply-v2';
import type { WeaponBehavior, WeaponUpdateContext } from '@/weapons/weapon-behavior';
import type { FxManager } from '@/fx/fx-manager';
import { sceneWeaponVisual } from '@/fx/external-atlas';

/** B 类环绕/光环行为（b1/b2 环绕球；b3 光环常驻） */
export class OrbitWeaponBehavior implements WeaponBehavior {
  readonly weaponClass = 'B' as const;
  private readonly config: WeaponConfig;
  private readonly orbs: Phaser.GameObjects.Sprite[] = [];
  private angleRad = 0;
  private enabled = false;
  private params: OrbitDerivedParams;
  /** 最近一次类强化堆叠（钥被动派生用；初始空） */
  private currentClassStacks: ClassUpgradeStacks = {
    a1: 0, a2: 0, a3: 0, b1: 0, b2: 0, b3: 0, c1: 0, c2: 0, c3: 0, d1: 0, d2: 0, d3: 0,
  };

  constructor(
    private readonly scene: Phaser.Scene,
    readonly weaponId: WeaponId,
    private readonly fx: FxManager,
  ) {
    this.config = WEAPON_CONFIGS[weaponId];
    this.params = deriveOrbitParams(this.config, { a1: 0, a2: 0, a3: 0, b1: 0, b2: 0, b3: 0, c1: 0, c2: 0, c3: 0, d1: 0, d2: 0, d3: 0 });
    const maxSprites = this.config.maxCount ?? 6;
    const fallback = this.config.id === 'wpn_b_3' ? 'shockwave' : 'orb';
    const vis = sceneWeaponVisual(scene, this.config.frame, fallback);
    for (let i = 0; i < maxSprites; i += 1) {
      const orb = scene.add
        .sprite(0, 0, vis.atlas, vis.frame)
        .setActive(false)
        .setVisible(false)
        .setDepth(90);
      if (this.config.id === 'wpn_b_3') {
        orb.setAlpha(0.35);
        if (!vis.dedicated) orb.setTint(0x54e6c9);
      }
      this.orbs.push(orb);
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.syncVisibility();
  }

  applyClassUpgrade(stacks: ClassUpgradeStacks): void {
    this.currentClassStacks = stacks;
    this.params = deriveOrbitParams(this.config, stacks);
    this.syncVisibility();
  }

  /** E4-S4 钥被动（key_holy 范围 ×1.15 / key_silver 伤害 ×1.12；类强化之上乘法叠加） */
  applyKeyPassives(keys: KeyPassiveState): void {
    this.params = applyKeyPassivesToOrbit(deriveOrbitParams(this.config, this.currentClassStacks), keys);
    this.syncVisibility();
  }

  clearAll(): void {
    for (const orb of this.orbs) orb.setActive(false).setVisible(false);
    this.angleRad = 0;
  }

  /** 当前环绕数（HUD/基准 draw call 用） */
  get orbCount(): number {
    return this.enabled ? this.params.count : 0;
  }

  update(ctx: WeaponUpdateContext): void {
    if (!this.enabled) return;
    const p = this.params;
    // B3 光环：常驻 tick（0.5s），半径内敌人 6/s 伤害 + 暴露 damageReduction
    if (this.config.id === 'wpn_b_3') {
      this.tickAura(ctx);
      return;
    }
    this.angleRad = advanceOrbitAngle(this.angleRad, p.angularSpeedDeg, ctx.dt);
    const damage = computeOrbitDamage(p.damage, ctx.damageMultiplier);
    for (let i = 0; i < p.count; i += 1) {
      const orb = this.orbs[i];
      if (!orb?.active) continue;
      const pos = orbitPosition(
        { x: ctx.player.x, y: ctx.player.y },
        this.angleRad + (i * 2 * Math.PI) / Math.max(1, p.count),
        p.radius,
      );
      orb.setPosition(pos.x, pos.y);
      for (const enemy of ctx.enemies) {
        if (!enemy.active) continue;
        if (ctx.now < enemy.orbitHitCooldownUntil) continue; // 同目标 0.4s 内置 CD
        if (!circlesOverlap(pos.x, pos.y, 10, enemy.x, enemy.y, enemy.radius)) continue;
        enemy.orbitHitCooldownUntil = ctx.now + p.perTargetCooldown;
        hitEnemy(enemy, damage);
        // B2 荆棘圣环：减速 30%（1s）—— 记录原速，到期恢复。
        // M2 收口（15 敌运行时接入）：原速取 enemy.speed（spawnByConfig 面板 + 地图移速加权），
        // 不取 enemyPanel(kind) 基准面板 —— 配置敌种面板 ≠ 三槽基准（灰狼 85 ≠ wolf 150；
        // 狼穴 ×1.08 加权须保留）。与 super-weapon-behavior summon-slow 恢复口径一致。
        if (this.config.id === 'wpn_b_2' && p.slowPct && p.slowDuration) {
          const originalSpeed = enemy.speed;
          enemy.speed = Math.max(30, enemy.speed * (1 - p.slowPct));
          this.scene.time.delayedCall(p.slowDuration * 1000, () => {
            if (enemy.active) enemy.speed = originalSpeed;
          });
        }
        this.fx.orbitHit(pos.x, pos.y, ctx.now);
      }
    }
  }

  private tickAura(ctx: WeaponUpdateContext): void {
    const p = this.params;
    const aura = this.orbs[0];
    if (aura) {
      aura.setPosition(ctx.player.x, ctx.player.y).setActive(true).setVisible(true);
      const r = p.auraRadius ?? 120;
      aura.setDisplaySize(r * 2, r * 2);
    }
    // 光环伤害 6/s：0.5s tick（gdd-weapons-v2 §3.3 注）
    this.auraAccumulator -= ctx.dt;
    if (this.auraAccumulator > 0) return;
    this.auraAccumulator = 0.5;
    const damage = computeOrbitDamage(p.auraDps ?? 6, ctx.damageMultiplier) * 0.5;
    for (const enemy of ctx.enemies) {
      if (!enemy.active) continue;
      const dx = enemy.x - ctx.player.x;
      const dy = enemy.y - ctx.player.y;
      const r = (p.auraRadius ?? 120) + enemy.radius;
      if (dx * dx + dy * dy <= r * r) hitEnemy(enemy, damage);
    }
  }

  private auraAccumulator = 0;

  private syncVisibility(): void {
    const showCount = this.enabled ? this.params.count : 0;
    this.orbs.forEach((orb, i) => {
      const show = this.enabled && i < showCount;
      orb.setActive(show).setVisible(show);
    });
  }
}

/** 环绕球单发伤害 = 基础 × 总倍率（computeHitDamage 同口径） */
function computeOrbitDamage(base: number, multiplier: number): number {
  return base * multiplier;
}
