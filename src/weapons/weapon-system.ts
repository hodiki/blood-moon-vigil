/**
 * weapons/weapon-system.ts —— 武器系统（ARCH §3.1 装配 / S3 / E2-S3/E2-S6）
 *
 * 三武器全自动触发、无任何手动瞄准/攻击输入（W8-1 / 支柱 1）：
 * - 飞弹：冷却 1.2s → 发射 → 追踪 → 命中/消散（同屏 ≤8，达上限跳过本冷却）
 * - 环绕球：常驻旋转 + 命中（同目标 0.4s 内置冷却）
 * - 冲击波：8s 冷却 → 半径内全方向穿透（无目标也释放）
 * 伤害统一走 E2-S1 入口：基础伤害 × 玩家总倍率（computeHitDamage / hitEnemy）。
 * 本系统只做装配与帧转发，冷却/命中数学在 weapon-math.ts（可单测）。
 */

import Phaser from 'phaser';
import type { RuntimeConfig } from '@/config/runtime-config';
import { createArcadePool, type ArcadePoolLike } from '@/core/object-pools';
import { WEAPONS } from '@/config/balance';
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
import type { Enemy } from '@/enemies/enemy';
import type { Player } from '@/player/player';

export class WeaponSystem {
  readonly missilePool: ArcadePoolLike<HomingMissile>;
  readonly orbit: OrbitWeapon;
  readonly shockwave: ShockwaveWeapon;

  /** 复用数组，避免每帧分配（core 零热路径分配纪律的 gameplay 侧近似） */
  private readonly activeEnemies: Enemy[] = [];
  private missileCooldown = 0;
  /** E3-S5 写回：飞弹分裂次级弹数（upgrade-pool 第 3 项，≤2） */
  private missileSplit = 0;
  /** E3-S5 写回：飞弹穿透次数（第 6 项，≤1） */
  private missilePierce = 0;
  /** E3-S5 写回：全部武器冷却倍率 0.92^stacks（第 11 项） */
  private cooldownMultiplier = 1;

  constructor(
    scene: Phaser.Scene,
    cfg: RuntimeConfig,
    private readonly player: Player,
    private readonly enemyPool: ArcadePoolLike<Enemy>,
  ) {
    this.missilePool = createArcadePool(scene, cfg, 'bullets', HomingMissile);
    this.orbit = new OrbitWeapon(scene);
    this.shockwave = new ShockwaveWeapon(scene);
    // E3 门控（upgrade-pool §③ 初始武器为自动飞弹）：守夜之环/月蚀脉冲由升级 1/2 解锁
    this.orbit.setEnabled(false);
    this.shockwave.setEnabled(false);
  }

  // —— E3-S5 升级写回接口（UpgradeWriteTargets.weapons） ——
  // TASK-21 Bug3：分裂与穿透互斥（后选者生效；applyMissileSplit/Pierce 纯函数互清）
  setMissileSplit(level: number): void {
    const next = applyMissileSplit({ split: this.missileSplit, pierce: this.missilePierce }, level);
    this.missileSplit = next.split;
    this.missilePierce = next.pierce;
  }

  setMissilePierce(count: number): void {
    const next = applyMissilePierce({ split: this.missileSplit, pierce: this.missilePierce }, count);
    this.missileSplit = next.split;
    this.missilePierce = next.pierce;
  }

  setCooldownMultiplier(multiplier: number): void {
    this.cooldownMultiplier = multiplier;
    this.shockwave.setCooldownMultiplier(multiplier);
  }

  update(dt: number, now: number): void {
    this.refreshEnemies(now);
    const mult = this.player.stats.totalDamageMultiplier;

    // 飞弹：冷却触发（无目标不发射，W8 §⑥.1）
    this.missileCooldown = tickCooldown(this.missileCooldown, dt);
    if (isCooldownReady(this.missileCooldown)) {
      this.missileCooldown = WEAPONS.MISSILE.COOLDOWN * this.cooldownMultiplier;
      this.tryFireMissile(mult);
    }
    // 飞弹：追踪 + 命中
    const ctx = { enemies: this.activeEnemies as readonly TargetLike[] };
    this.missilePool.eachActive((m) => m.tick(dt, ctx));
    this.checkMissileHits();

    // 环绕球 + 冲击波
    this.orbit.update(dt, now, this.player, this.activeEnemies as readonly OrbDamageTarget[], mult);
    this.shockwave.update(dt, this.player, this.activeEnemies as readonly DamageTargetLike[], mult);
  }

  /** 玩家死亡：清除全部子弹与环绕球、冲击波冷却重置（W8 §⑥.5 / CM R5） */
  clearAll(): void {
    this.missilePool.eachActive((m) => m.dissipate());
    this.orbit.clearAll();
    this.shockwave.clearAll();
  }

  /**
   * 刷新目标列表（只收集 active 敌人）。
   * E4-S2：Boss 出场 0.5s 霸体期内不承伤（enemies §⑥.5）——按 `graceUntil` 过滤，
   * 飞弹/环绕球/冲击波在霸体期不把 Boss 当目标；霸体结束自然恢复可命中。
   */
  private refreshEnemies(now: number): void {
    this.activeEnemies.length = 0;
    this.enemyPool.eachActive((e) => {
      if (e.graceUntil > now) return; // 霸体期内跳过（Boss 出场 0.5s）
      this.activeEnemies.push(e);
    });
  }

  private tryFireMissile(multiplier: number): void {
    const target = nearestEnemy({ x: this.player.x, y: this.player.y }, this.activeEnemies);
    if (!target) return; // 无目标不发射（省资源）
    const missile = this.missilePool.acquire(this.player.x, this.player.y, 'missile');
    if (!missile) return; // 同屏 ≤8：达上限跳过本冷却，不积压（W8-4）
    missile.launch(
      this.player.x,
      this.player.y,
      computeHitDamage(WEAPONS.MISSILE.DAMAGE, multiplier),
      this.missilePierce,
      this.missileSplit > 0, // 主弹可分裂（TASK-21 Bug3）
    );
    // Phase 6 音频：发射成功 → weapon:fired（audio-bible §2 SFX#1）
    GameEvents.emit(GameEvent.WeaponFired, { x: this.player.x, y: this.player.y });
  }

  private checkMissileHits(): void {
    this.missilePool.eachActive((m) => {
      for (const enemy of this.activeEnemies) {
        if (!enemy.active) continue;
        if (m.hasHit(enemy)) continue; // 穿透已命中目标不重复命中
        if (!circlesOverlap(m.x, m.y, m.radius, enemy.x, enemy.y, enemy.radius)) continue;
        hitEnemy(enemy, m.damageValue); // 击杀已由 hitEnemy 内 kill() 分发（enemy:killed）
        m.recordHit(enemy);
        if (m.remainingPierce > 0) {
          m.consumePierce(); // 穿透：继续飞行（W8 §⑤ / upgrade-pool 第 6 项）
          continue;
        }
        // 命中即消散（W8 §③）；TASK-21 Bug3：仅主弹且无剩余穿透时分裂（次级弹不再分裂，
        // 穿透优先路径已消费），随后正常消散回池
        if (shouldSpawnSplitMissiles(m.splitEligible, m.remainingPierce, this.missileSplit)) {
          this.spawnSplitSubMissiles(m);
        }
        m.dissipate();
        break;
      }
    });
  }

  /** 飞弹分裂：主弹命中消散时生成 split 枚次级弹（×0.6 伤，upgrade-pool 第 3 项） */
  private spawnSplitSubMissiles(parent: HomingMissile): void {
    for (let i = 0; i < this.missileSplit; i += 1) {
      const sub = this.missilePool.acquire(parent.x, parent.y, 'missile');
      if (!sub) return; // 同屏 ≤8：池满跳过本批（不积压）
      // 次级弹：不穿透、不再分裂（TASK-21 Bug3 无限弹射根因）
      sub.launch(parent.x, parent.y, parent.damageValue * splitSubDamageMultiplier(), 0, false);
    }
  }
}
