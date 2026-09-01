/**
 * weapons/weapon-system.ts —— 武器系统（E2-S1 注册表驱动重构 / ARCH §3.1 装配 / S3）
 *
 * 重构目标（sprint-m2-plan E2-S1）：由「3 硬编码」→「WeaponId → WeaponBehavior 注册表」。
 * - 统一接口 WeaponBehavior.update(dt, now, ctx)（weapons-v2 §3.0 / weapon-behavior.ts）；
 * - 既有血月猎手/守夜之环/月蚀脉冲迁移为注册行为（DPS/冷却/上限断言不变，回归门）；
 * - 新武器四类（A2~A5 / B2~B3 / C2~C3 / D1~D3）按类注册，update 统一遍历注册表。
 *
 * 公开 API 保持（PlayScene 消费）：missilePool / orbit / shockwave /
 * setMissileSplit / setMissilePierce / setCooldownMultiplier / update / clearAll。
 * 纯逻辑（冷却/命中/上限/扫掠）在 weapon-runtime.ts / weapon-math.ts（可单测）。
 */

import Phaser from 'phaser';
import type { RuntimeConfig } from '@/config/runtime-config';
import { createArcadePool, type ArcadePoolLike } from '@/core/object-pools';
import { WEAPONS, type WeaponId } from '@/config/balance';
import { GameEvents, GameEvent } from '@/core/events';
import { computeHitDamage, hitEnemy } from '@/combat/damage';
import { splitSubDamageMultiplier } from '@/upgrade/upgrade-apply';
import {
  applyMissileSplit,
  applyMissilePierce,
  shouldSpawnSplitMissiles,
} from '@/weapons/missile-options';
import {
  isCooldownReady,
  tickCooldown,
  circlesOverlap,
  nearestEnemy,
  type TargetLike,
  type DamageTargetLike,
} from '@/weapons/weapon-math';
import { HomingMissile } from '@/weapons/homing-missile';
import { OrbitWeapon, type OrbDamageTarget } from '@/weapons/orbit-orb';
import { ShockwaveWeapon } from '@/weapons/shockwave';
import { WeaponRegistry, type WeaponBehavior, type WeaponUpdateContext } from '@/weapons/weapon-behavior';
import { ProjectileWeaponBehavior } from '@/weapons/projectile-weapon';
import { OrbitWeaponBehavior } from '@/weapons/orbit-weapons';
import { GroundPoolWeaponBehavior } from '@/weapons/ground-weapons';
import { SummonWeaponBehavior } from '@/weapons/summon-weapons';
import { SuperWeaponBehavior } from '@/weapons/super-weapon-behavior';
import { SUPER_WEAPON_EVOLUTION } from '@/weapons/super-weapons';
import { EvolutionState } from '@/weapons/evolution-engine';
import { createExclusiveBehaviors } from '@/weapons/exclusive/exclusive-behaviors';
import type { LoadoutResult } from '@/weapons/loadout';
import { ResonanceState, commitResonance, heavyCooldownMult } from '@/weapons/resonance/resonance-engine';
import {
  createResonanceLanternState, stepResonanceLantern,
  createResonanceJavelinState, stepResonanceTotems,
  createResonanceCrossState, stepResonanceResidues, onResonanceCrossExplode,
  createResonanceRevolverFeedState, onResonanceCrossbowHit,
  createResonanceTwinbladesMarkState, onResonanceBoomerangHit,
  createResonanceDragState, onResonanceChainHit, placeResonanceTotem,
} from '@/weapons/resonance/resonance-math';
import type { ExclusiveWeaponBehavior } from '@/weapons/exclusive/exclusive-behaviors';
import type { RevolverState } from '@/weapons/exclusive/exclusive-math';
import { resonancePairByExclusive, type ResonancePairConfig } from '@/config/balance';
import { emptyKeyPassiveState, type KeyPassiveState } from '@/upgrade/upgrade-apply-v2';
import type { FxManager } from '@/fx/fx-manager';
import type { Enemy } from '@/enemies/enemy';
import type { Player } from '@/player/player';

/** 血月猎手行为（迁移既有飞弹逻辑，E2-S1 等价迁移） */
export class MissileWeaponBehavior implements WeaponBehavior {
  readonly weaponClass = 'A' as const;
  readonly weaponId = 'wpn_a_1' as const;
  private enabled = true; // 血月猎手 = 初始武器，默认启用（角色初始武器门控在 E4-S1）
  private cooldown = 0;
  private split = 0;
  private pierce = 0;
  private cooldownMultiplier = 1;
  /** M3-DESIGN-1 专精疾射：独立冷却乘区（×0.88^stack；非目标 1.0） */
  private focusedCooldownMultiplier = 1;
  /** E4-S4 钥被动（key_tome 冷却 ×0.9 / key_silver 伤害 ×1.12；key_scope 射程对追踪弹不接线——
   *  追踪飞弹行程 = 3s×400px/s = 1200px 已远超出生环带 900px，射程 +15% 无实际收益，记档不实现） */
  private keyCooldownMult = 1;
  private keyDamageMult = 1;
  /** E4-S2 血影突袭标记：命中时刻（秒时间戳，由 ctx.now 每帧同步） */
  private now = 0;

  constructor(
    private readonly pool: ArcadePoolLike<HomingMissile>,
    private readonly player: Player,
    private readonly fx: FxManager,
  ) {}

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  applyClassUpgrade(stacks: { a1: number; a2: number; a3: number }): void {
    this.split = stacks.a1;
    this.pierce = stacks.a2;
  }

  setMissileSplit(level: number): void {
    const next = applyMissileSplit({ split: this.split, pierce: this.pierce }, level);
    this.split = next.split;
    this.pierce = next.pierce;
  }

  setMissilePierce(count: number): void {
    const next = applyMissilePierce({ split: this.split, pierce: this.pierce }, count);
    this.pierce = next.pierce;
    this.split = next.split;
  }

  setCooldownMultiplier(multiplier: number): void {
    this.cooldownMultiplier = multiplier;
  }

  /** M3-DESIGN-1 专精疾射：独立冷却乘区（×0.88^stack；非目标 1.0；乘法叠加于全局冷却） */
  applyFocusedCooldown(multiplier: number): void {
    this.focusedCooldownMultiplier = multiplier;
  }

  /** E4-S4 钥被动（key_tome 冷却 ×0.9 独立乘区 / key_silver 伤害 ×1.12） */
  applyKeyPassives(keys: KeyPassiveState): void {
    this.keyCooldownMult = keys.cooldownMult;
    this.keyDamageMult = keys.damageMult;
  }

  clearAll(): void {
    this.pool.eachActive((m) => m.dissipate());
    this.cooldown = 0;
  }

  update(ctx: WeaponUpdateContext): void {
    if (!this.enabled) return;
    this.now = ctx.now; // E4-S2 标记命中时刻同步
    const mult = ctx.damageMultiplier;
    this.cooldown = tickCooldown(this.cooldown, ctx.dt);
    if (isCooldownReady(this.cooldown)) {
      this.cooldown = this.missileCooldownSeconds() * this.cooldownMultiplier * this.focusedCooldownMultiplier * this.keyCooldownMult;
      this.tryFireMissile(mult, ctx.enemies);
    }
    const homingCtx = { enemies: ctx.enemies as readonly TargetLike[] };
    this.pool.eachActive((m) => m.tick(ctx.dt, homingCtx));
    this.checkMissileHits(ctx.enemies);
  }

  private missileCooldownSeconds(): number {
    // 读 WEAPONS.MISSILE.COOLDOWN（import 侧常量，避免重复魔法数字）
    return WEAPONS_MISSILE_COOLDOWN;
  }

  private tryFireMissile(multiplier: number, enemies: readonly Enemy[]): void {
    const target = nearestEnemy({ x: this.player.x, y: this.player.y }, enemies);
    if (!target) return; // 无目标不发射（省资源）
    const missile = this.pool.acquire(this.player.x, this.player.y, 'characters', 'missile');
    if (!missile) return; // 同屏 ≤8：达上限跳过本冷却，不积压
    missile.launch(
      this.player.x,
      this.player.y,
      computeHitDamage(WEAPONS_MISSILE_DAMAGE * this.keyDamageMult, multiplier), // key_silver 伤害 ×1.12
      this.pierce,
      this.split > 0,
    );
    GameEvents.emit(GameEvent.WeaponFired, { x: this.player.x, y: this.player.y });
    this.fx.missileLaunch(this.player.x, this.player.y);
  }

  private checkMissileHits(enemies: readonly Enemy[]): void {
    this.pool.eachActive((m) => {
      for (const enemy of enemies) {
        if (!enemy.active) continue;
        if (m.hasHit(enemy)) continue;
        if (!circlesOverlap(m.x, m.y, m.radius, enemy.x, enemy.y, enemy.radius)) continue;
        // P0-3：易伤乘区由 hitEnemy 唯一入口结算（原 markDamageMult 平行乘区已退役）
        hitEnemy(enemy, m.damageValue, this.now);
        m.recordHit(enemy);
        if (m.remainingPierce > 0) {
          m.consumePierce();
          continue;
        }
        if (shouldSpawnSplitMissiles(m.splitEligible, m.remainingPierce, this.split)) {
          this.spawnSplitSubMissiles(m);
        }
        this.fx.missileImpact(m.x, m.y);
        m.dissipate();
        break;
      }
    });
  }

  private spawnSplitSubMissiles(parent: HomingMissile): void {
    for (let i = 0; i < this.split; i += 1) {
      const sub = this.pool.acquire(parent.x, parent.y, 'characters', 'missile');
      if (!sub) return; // 池满跳过本批（不积压）
      sub.launch(parent.x, parent.y, parent.damageValue * splitSubDamageMultiplier(), 0, false);
    }
  }
}

/** 血月猎手常量（数值源在 balance.ts） */
const WEAPONS_MISSILE_COOLDOWN = WEAPONS.MISSILE.COOLDOWN;
const WEAPONS_MISSILE_DAMAGE = WEAPONS.MISSILE.DAMAGE;

/** 守夜之环行为适配器（既有 OrbitWeapon 包装为 WeaponBehavior） */
class OrbitBehaviorAdapter implements WeaponBehavior {
  readonly weaponClass = 'B' as const;
  readonly weaponId = 'wpn_b_1' as const;

  constructor(private readonly orbit: OrbitWeapon, private readonly player: Player) {}

  setEnabled(enabled: boolean): void {
    this.orbit.setEnabled(enabled);
  }

  applyClassUpgrade(stacks: { b1: number; b2: number; b3: number }): void {
    for (let i = 0; i < stacks.b1; i += 1) this.orbit.addOrb();
    if (stacks.b2 > 0) this.orbit.setAngularSpeedMultiplier(Math.pow(1.2, stacks.b2));
    // B3 半径派生：OrbitWeapon 无 setRadius 接口，E2-S8 后经 OrbitWeaponBehavior 统一处理；
    // 守夜之环保留既有接口（radius 由 E4-S4 升级池扩展接入），此处不回归
  }

  /** E4-S4 钥被动：key_holy 范围 ×1.15 / key_silver 伤害 ×1.12（守夜之环） */
  applyKeyPassives(keys: KeyPassiveState): void {
    this.orbit.setKeyRadiusMultiplier(keys.areaRadiusMult);
    this.orbit.setKeyDamageMultiplier(keys.damageMult);
  }

  clearAll(): void {
    this.orbit.clearAll();
  }

  update(ctx: WeaponUpdateContext): void {
    this.orbit.update(ctx.dt, ctx.now, this.player, ctx.enemies as readonly OrbDamageTarget[], ctx.damageMultiplier);
  }
}

/** 月蚀脉冲行为适配器（既有 ShockwaveWeapon 包装为 WeaponBehavior） */
class ShockwaveBehaviorAdapter implements WeaponBehavior {
  readonly weaponClass = 'C' as const;
  readonly weaponId = 'wpn_c_1' as const;

  constructor(private readonly shockwave: ShockwaveWeapon, private readonly player: Player) {}

  setEnabled(enabled: boolean): void {
    this.shockwave.setEnabled(enabled);
  }

  applyClassUpgrade(): void {
    // 月蚀脉冲半径/伤害/持续派生走既有升级接口（E3-S5 setRadiusMultiplier 等）；
    // C1 类强化写回由 E4-S4 升级池统一接入（本冲刺保留既有接口语义，不回归）
  }

  /** M3-DESIGN-1 专精疾射：转发独立冷却乘区到 ShockwaveWeapon */
  applyFocusedCooldown(multiplier: number): void {
    this.shockwave.setFocusedCooldownMultiplier(multiplier);
  }

  /** E4-S4 钥被动：key_holy 范围 ×1.15 / key_tome 冷却 ×0.9 / key_silver 伤害 ×1.12（月蚀脉冲） */
  applyKeyPassives(keys: KeyPassiveState): void {
    this.shockwave.setKeyPassives(keys);
  }

  clearAll(): void {
    this.shockwave.clearAll();
  }

  update(ctx: WeaponUpdateContext): void {
    this.shockwave.update(ctx.dt, this.player, ctx.enemies as readonly DamageTargetLike[], ctx.damageMultiplier, ctx.now);
  }
}

/** 新武器注册（四类，E2-S2~S5）：A2~A5 弹幕 / B2~B3 环绕 / C2~C3 地面池 / D1~D3 召唤 */
function registerNewWeaponBehaviors(
  registry: WeaponRegistry,
  scene: Phaser.Scene,
  cfg: RuntimeConfig,
  fx: FxManager,
  onHitResonance?: (weaponId: WeaponId, target: Enemy, now: number) => void,
): void {
  // A 类：银针连弩 / 圣银火铳 / 幽灵飞刃 / 骨钉标枪（血月猎手由 MissileWeaponBehavior 注册）
  for (const id of ['wpn_a_2', 'wpn_a_3', 'wpn_a_4', 'wpn_a_5'] as const) {
    const behavior = new ProjectileWeaponBehavior(scene, cfg, id, fx);
    behavior.onHitResonance = onHitResonance;
    registry.register(behavior);
  }
  // B 类：荆棘圣环 / 圣光壁垒（守夜之环由 OrbitBehaviorAdapter 注册）
  for (const id of ['wpn_b_2', 'wpn_b_3'] as const) {
    registry.register(new OrbitWeaponBehavior(scene, id, fx));
  }
  // C 类：血池喷涌 / 审判圣火（月蚀脉冲由 ShockwaveBehaviorAdapter 注册）
  for (const id of ['wpn_c_2', 'wpn_c_3'] as const) {
    registry.register(new GroundPoolWeaponBehavior(scene, id, fx));
  }
  // D 类：血蝠群 / 狼影猎犬 / 断罪锁链
  for (const id of ['wpn_d_1', 'wpn_d_2', 'wpn_d_3'] as const) {
    registry.register(new SummonWeaponBehavior(scene, id, fx));
  }
}

export class WeaponSystem {
  readonly missilePool: ArcadePoolLike<HomingMissile>;
  readonly orbit: OrbitWeapon;
  readonly shockwave: ShockwaveWeapon;
  /** E2-S1：WeaponId → WeaponBehavior 注册表 */
  readonly registry = new WeaponRegistry();

  private readonly missile: MissileWeaponBehavior;
  private readonly activeEnemies: Enemy[] = [];
  /** E2-S6：超武进化状态（不可逆；源武器 → 超武） */
  readonly evolution = new EvolutionState();
  /** E4-S4：被动钥数值效果派生（key_* 7；超武合成条件 2 由 UpgradeState.hasKey 提供） */
  private keyPassives: KeyPassiveState = emptyKeyPassiveState();

  constructor(
    scene: Phaser.Scene,
    cfg: RuntimeConfig,
    private readonly player: Player,
    private readonly enemyPool: ArcadePoolLike<Enemy>,
    private readonly fx: FxManager,
  ) {
    this.missilePool = createArcadePool(scene, cfg, 'bullets', HomingMissile);
    this.orbit = new OrbitWeapon(scene, fx);
    this.shockwave = new ShockwaveWeapon(scene, fx);

    // 注册 3 既有武器行为（E2-S1 等价迁移）
    this.missile = new MissileWeaponBehavior(this.missilePool, this.player, this.fx);
    this.registry.register(this.missile);
    this.registry.register(new OrbitBehaviorAdapter(this.orbit, this.player));
    this.registry.register(new ShockwaveBehaviorAdapter(this.shockwave, this.player));

    // 注册新武器四类行为（E2-S2~S5）+ B4-W2 共鸣命中钩子（R-2/R-3；未达成 = no-op 普通形态）
    registerNewWeaponBehaviors(this.registry, scene, cfg, fx, (weaponId, target, now) => {
      if (this.resonance.isAchieved('R2') && weaponId === 'wpn_a_2') {
        const revolver = this.exclusiveBehaviors.xw_revolver as ExclusiveWeaponBehavior<RevolverState>;
        const ammo = (revolver.getState() as RevolverState).ammo;
        onResonanceCrossbowHit(this.resonanceFeed, ammo, resonancePairByExclusive('xw_revolver')!.machine);
      }
      if (this.resonance.isAchieved('R3') && weaponId === 'wpn_a_4') {
        onResonanceBoomerangHit(this.resonanceMarks, target as unknown as import('@/weapons/exclusive/exclusive-math').ExclusiveTarget, now, resonancePairByExclusive('xw_twinblades')!.machine);
      }
    });

    // B2-W1：注册 8 专武行为（默认 disabled，applyLoadout 门控开启；结算层零 Phaser 依赖）
    this.exclusiveBehaviors = createExclusiveBehaviors();
    for (const behavior of Object.values(this.exclusiveBehaviors)) {
      this.registry.register(behavior as unknown as WeaponBehavior);
    }
    // NV-INTEG-FIX P0-5：专武结算事件 → 视觉层（B6 欠账「即时结算无弹体」的可见化补口）
    for (const [id, behavior] of Object.entries(this.exclusiveBehaviors)) {
      (behavior as unknown as {
        onEvents?: (events: string[], ctx: WeaponUpdateContext) => void;
      }).onEvents = (events, ctx) => {
        if (id === 'xw_revolver' && events.includes('fired')) {
          this.fx.spawnRevolverTracer(ctx.player, ctx.enemies as readonly Enemy[]);
        }
      };
    }
    // B4-W2 R-6：十字落点爆炸 → 余焰登记（共鸣达成后生效）
    let lastNow = 0;
    const crossBehavior = this.exclusiveBehaviors.xw_cross as unknown as { onExplode?: (x: number, y: number) => void };
    crossBehavior.onExplode = (x: number, y: number) => {
      if (this.resonance.isAchieved('R6')) {
        onResonanceCrossExplode(this.resonanceCross, x, y, lastNow, resonancePairByExclusive('xw_cross')!.machine);
      }
    };
    this.setNow = (now: number) => { lastNow = now; };
    this.lastNowSeconds = 0;
    // B4-W2 R-7 葬仪断罪：锁链命中 → 拖拽（拉至巨斧弧心；×1.5 伤害段经 resonanceAxeDamageMult 结算口径）
    const chainBehavior = this.registry.get('wpn_d_3') as unknown as { onHitResonance?: (t: Enemy, now: number) => boolean } | undefined;
    if (chainBehavior) {
      // B6-W4 R-8 狼群誓约：猎犬召唤上限共享门控（月狼在场计数占位；§⑦-2 静默丢弃）
    const hound = this.registry.get('wpn_d_2') as unknown as { summonGate?: () => boolean } | undefined;
    if (hound) {
      hound.summonGate = () => {
        if (!this.resonance.isAchieved('R8')) return true;
        // 猎犬自身 count=1（重召节拍即上限）；月狼侧共享计数由 exclusive-math.sharedSummonCount 承载
        return true;
      };
    }
    // B6-W4 R-4 猎月贯钉：长弓满蓄同步（shotCounter 每 3 矢）→ 标枪贯穿 6 + 落点图腾
      const javelin = this.registry.get('wpn_a_5') as ProjectileWeaponBehavior;
      javelin.resonancePierceProvider = () => {
        if (!this.resonance.isAchieved('R4')) return null;
        const longbow = this.exclusiveBehaviors.xw_longbow as ExclusiveWeaponBehavior<import('@/weapons/exclusive/exclusive-math').LongbowState>;
        const charged = (longbow.getState().shotCounter % 3) === 0; // 满蓄窗口（每第 3 矢）
        return charged ? 6 : 3;
      };
      javelin.onProjectileLand = (x: number, y: number) => {
        if (this.resonance.isAchieved('R4')) {
          placeResonanceTotem(this.resonanceTotems, x, y, lastNow, resonancePairByExclusive('xw_longbow')!.machine);
        }
      };
      chainBehavior.onHitResonance = (target: Enemy, _now: number) => {
        if (!this.resonance.isAchieved('R7')) return false;
        return onResonanceChainHit(
          this.resonanceDrag,
          target as unknown as import('@/weapons/exclusive/exclusive-math').ExclusiveTarget,
          { x: this.player.x, y: this.player.y },
          resonancePairByExclusive('xw_axe')!.machine,
        ) !== null;
      };
    }

    // E3 门控（upgrade-pool §③ 初始武器为自动飞弹）：守夜之环/月蚀脉冲初始未解锁；
    // 其余新武器由 E4-S5 解锁流开启（本冲刺保持未启用，行为注册但不运行）
    this.orbit.setEnabled(false);
    this.shockwave.setEnabled(false);
    for (const id of ['wpn_a_2', 'wpn_a_3', 'wpn_a_4', 'wpn_a_5', 'wpn_b_2', 'wpn_b_3', 'wpn_c_2', 'wpn_c_3', 'wpn_d_1', 'wpn_d_2', 'wpn_d_3'] as const) {
      this.registry.get(id)?.setEnabled(false);
    }
  }

  /** B2-W1：8 专武行为表（id → behavior；loadout/沙盘/遥测消费） */
  readonly exclusiveBehaviors: Record<keyof ReturnType<typeof createExclusiveBehaviors>, WeaponBehavior>;
  /** B4-W1 共鸣达成状态（每局重置；不可逆 commit） */
  readonly resonance = new ResonanceState();
  private readonly resonanceLantern = createResonanceLanternState();
  private readonly resonanceTotems = createResonanceJavelinState();
  private readonly resonanceCross = createResonanceCrossState();
  private readonly resonanceFeed = createResonanceRevolverFeedState();
  private readonly resonanceMarks = createResonanceTwinbladesMarkState();
  private readonly resonanceDrag = createResonanceDragState();
  private lastNowSeconds = 0;
  /** R-6 落点时刻桥接（update 起始写；onExplode 读） */
  private setNow: (now: number) => void = () => {};

  // —— 既有升级写回接口（UpgradeWriteTargets.weapons，PlayScene 消费） ——
  setMissileSplit(level: number): void {
    this.missile.setMissileSplit(level);
  }

  setMissilePierce(count: number): void {
    this.missile.setMissilePierce(count);
  }

  setCooldownMultiplier(multiplier: number): void {
    this.missile.setCooldownMultiplier(multiplier);
    this.shockwave.setCooldownMultiplier(multiplier);
  }

  /** E2-S8：武器类强化写回广播（up_w_a1~d3）—— 由 upgrade-apply 调用 */
  applyClassUpgrade(stacks: { a1: number; a2: number; a3: number; b1: number; b2: number; b3: number; c1: number; c2: number; c3: number; d1: number; d2: number; d3: number }): void {
    this.registry.applyClassUpgrade(stacks);
  }

  /** E4-S4：被动钥数值效果写回（key_* 7；记录派生状态 + 广播到支持的行为） */
  setKeyPassives(keys: KeyPassiveState): void {
    this.keyPassives = keys;
    this.registry.applyKeyPassives(keys);
  }

  /** M3-DESIGN-1 up_g_2 专精疾射：目标武器独立冷却乘区写回（广播；无冷却行为 no-op） */
  setFocusedCooldown(weaponIds: readonly WeaponId[], multiplier: number): void {
    this.registry.applyFocusedCooldown(weaponIds, multiplier);
  }

  /** E4-S4：当前钥被动派生（供行为/测试查询） */
  get keyPassiveState(): KeyPassiveState {
    return this.keyPassives;
  }

  /** 解锁某武器（E4-S5 解锁流；本冲刺供测试/调试） */
  unlockWeapon(weaponId: Parameters<WeaponRegistry['get']>[0]): void {
    this.registry.get(weaponId)?.setEnabled(true);
  }

  /**
   * E4-S1 角色初始武器门控：禁用默认飞弹（wpn_a_1），启用角色初始武器。
   * 非守夜人角色开局无血月猎手（content-design-outline §2.3~2.5）；守夜人保持飞弹。
   */
  applyInitialWeapon(initialWeapon: WeaponId): void {
    this.registry.get('wpn_a_1')?.setEnabled(initialWeapon === 'wpn_a_1');
    this.registry.get(initialWeapon)?.setEnabled(true);
  }

  /**
   * B2-W1 专武装配（gdd-exclusive-weapons §3.1；loadout 单一汇聚点）：
   * - 开启选中专武行为（其余专武保持 disabled）；
   * - 开启开局通武（computeLoadout 去重后的集合；开集合、关其余默认飞弹门控语义保留）；
   * - 落选专武 → 衍生技由 PlayScene 装配 ActiveSkill/衍生技控制器（B5 开局重写时收拢至此）。
   * 返回衍生技 id（落选转化，「转化为技能」标注数据源）。
   */
  applyLoadout(loadout: LoadoutResult): LoadoutResult['derivativeId'] {
    // 开集合：专武 + 通武
    for (const [id, behavior] of this.exclusiveEntries()) {
      behavior.setEnabled(id === loadout.exclusiveId);
    }
    this.applyInitialWeapon(loadout.initialCommonWeapon);
    return loadout.derivativeId;
  }

  /** 专武行为条目（id → behavior；applyLoadout 内部遍历用） */
  private *exclusiveEntries(): Generator<[string, WeaponBehavior]> {
    for (const [id, behavior] of Object.entries(this.exclusiveBehaviors)) {
      yield [id, behavior];
    }
  }

  /** B6-W4 P4 形态挂点：贯月审判图腾落点（公共桥接；衍生技 cast 注入） */
  placeResonanceTotemAt(x: number, y: number): void {
    if (!this.resonance.isAchieved('R4')) return;
    placeResonanceTotem(this.resonanceTotems, x, y, this.lastNowSeconds, resonancePairByExclusive('xw_longbow')!.machine);
  }

  /** B6-W4 P4 形态挂点：终审庭余焰登记（公共桥接） */
  placeResonanceResidueAt(x: number, y: number): void {
    if (!this.resonance.isAchieved('R6')) return;
    onResonanceCrossExplode(this.resonanceCross, x, y, this.lastNowSeconds, resonancePairByExclusive('xw_cross')!.machine);
  }

  /**
   * B4-W1 共鸣达成提交（gdd-resonance §3.1）：双条件门控（持配对专武 ∧ 持钥）→
   * 原子形态切换（clearAll 配对通武在途弹体，§⑦-3）→ 不可逆 commit。
   * 半满足（未持钥/未持专武）返回 null——普通形态零变化（验收判据 2）。
   * hasKey 由调用方注入（UpgradeState.hasKey）。
   */
  tryResonance(exclusiveId: Parameters<ResonanceState['isAchievedForExclusive']>[0], hasKey: (keyId: string) => boolean): ResonancePairConfig | null {
    const pair = commitResonance(this.resonance, { exclusiveId, hasKey });
    if (!pair) return null;
    this.registry.get(pair.commonWeaponId)?.clearAll(); // 原子切换：在途弹体清空（结算沿用旧形态完毕）
    return pair;
  }

  /**
   * E2-S6：超武进化（原子切换，gdd-weapons-v2 §5.1）。
   * 流程：进化瞬间清空旧弹体 → 源武器行为替换为超武行为（注册表同 key 覆盖）→ 标记不可逆。
   * 超武不再吃类强化（SuperWeaponBehavior.applyClassUpgrade 为 no-op）。
   * 返回是否成功（无进化映射 / 已进化 → false）。
   */
  evolve(weaponId: WeaponId, scene: Phaser.Scene, cfg: RuntimeConfig): boolean {
    const evoId = SUPER_WEAPON_EVOLUTION[weaponId];
    if (!evoId) return false; // 7 把无超武武器不可进化
    if (this.evolution.isEvolved(weaponId)) return false; // 不可逆
    const source = this.registry.get(weaponId);
    if (!source) return false;
    source.clearAll(); // 进化瞬间清空该武器旧弹体（原子切换）
    const superBehavior = new SuperWeaponBehavior(scene, cfg, weaponId, evoId, this.fx);
    superBehavior.setEnabled(true);
    this.registry.register(superBehavior); // 同 key 覆盖：源武器 → 超武
    this.evolution.commit(weaponId, evoId);
    return true;
  }

  /** E2-S6：合成条件判定辅助（供升级池进化卡入池；7 把无超武武器返回 false） */
  isEvolutionEligible(weaponId: WeaponId, classStacks: number, hasKey: boolean): boolean {
    if (this.evolution.isEvolved(weaponId)) return false; // 已进化不再出现
    return SUPER_WEAPON_EVOLUTION[weaponId] !== undefined && classStacks >= 3 && hasKey;
  }

  update(dt: number, now: number, windowDamageMult = 1): void {
    this.setNow(now);
    this.refreshEnemies(now);
    const mult = this.player.stats.totalDamageMultiplier * windowDamageMult; // B5-W3 Q-s1 窗口乘区（独立结算）

    const ctx: WeaponUpdateContext = {
      dt,
      now,
      player: this.player,
      enemies: this.activeEnemies,
      damageMultiplier: mult,
      keyPassives: this.keyPassives,
    };
    // 注册表统一遍历（既有 3 武器 + 新武器四类）
    this.registry.each((behavior) => behavior.update(ctx));
    this.tickResonanceSegments(ctx);
  }

  /** B4-W2 共鸣持续结算段（独立伤害段由系统级驱动；R-1 环带 / R-4 图腾 / R-6 余焰） */
  private tickResonanceSegments(ctx: WeaponUpdateContext): void {
    const targets = ctx.enemies as unknown as import('@/weapons/exclusive/exclusive-math').ExclusiveTarget[];
    const playerPos = { x: ctx.player.x, y: ctx.player.y };
    // R-1 守夜环灯：环带沿灯环边缘巡行（半径 = 灯环当前半径，含质变卡 1 外扩）
    if (this.resonance.isAchieved('R1')) {
      const lanternBehavior = this.exclusiveBehaviors.xw_lantern as unknown as { machine: Record<string, number> };
      const ringRadius = lanternBehavior.machine['auraRadius'] ?? 90;
      stepResonanceLantern(this.resonanceLantern, ctx.dt, ctx.now, playerPos, targets, ctx.damageMultiplier, resonancePairByExclusive('xw_lantern')!.machine, ringRadius);
    }
    // R-4 猎月贯钉：月痕图腾减速段
    if (this.resonance.isAchieved('R4')) {
      stepResonanceTotems(this.resonanceTotems, ctx.dt, ctx.now, targets, resonancePairByExclusive('xw_longbow')!.machine);
    }
    // R-6 圣火十诫：十字落点余焰（落点由 exclusive-behaviors 经 stepCross onExplode 注入）
    if (this.resonance.isAchieved('R6')) {
      stepResonanceResidues(this.resonanceCross, ctx.dt, ctx.now, targets, ctx.damageMultiplier, resonancePairByExclusive('xw_cross')!.machine);
    }
  }

  /** B4-W3 铁钉冷却乘区（重击类专武 ×0.92；exclusive-behaviors 消费） */
  heavyCooldownMultiplierFor(exclusiveId: 'xw_axe' | 'xw_cross', baseInterval: number): number {
    void exclusiveId;
    return heavyCooldownMult(baseInterval, this.keyPassives);
  }

  /** 玩家死亡：清除全部弹体/环绕球/召唤物/地面领域 + 冷却重置（gdd-weapons-v2 §⑥.7） */
  clearAll(): void {
    this.registry.each((behavior) => behavior.clearAll());
  }

  private refreshEnemies(now: number): void {
    this.activeEnemies.length = 0;
    this.enemyPool.eachActive((e) => {
      if (e.graceUntil > now) return; // 霸体期内跳过（Boss 出场 0.5s）
      this.activeEnemies.push(e);
    });
  }
}
