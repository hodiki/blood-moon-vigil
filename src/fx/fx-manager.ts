/**
 * fx/fx-manager.ts —— 特效管理器（TASK-28 美术表现力专项 · 粒子池 ≤200/100）
 *
 * 职责：
 * - 环境氛围常驻：血月天幕 + 暗角渐晕（scrollFactor 0 屏幕空间，静态精灵）
 * - 粒子池：容量 = cfg.maxParticles（桌面 200 / 移动 100），全部粒子共用 'fx-ambient'
 *   图集白底形状帧 + setTint 染色 → 1 组批次；池满 reject（soft-cap，绝不超预算）。
 * - 特效方法（全部带降级开关）：
 *   · 拖尾类（cfg.fxTrails）：飞弹拖尾 / 环绕球轨道残影 / 宝石磁吸拖尾 —— 移动端关闭
 *   · 氛围类（cfg.fxAmbient）：血月 / 渐晕 —— 双端保留（静态精灵，几乎零成本）
 *   · 爆发类（cfg.fxBursts）：击杀溅射 / 宝石拾取 / 升级 / Boss 出场 / 冲击波涟漪 —— 稀有触发
 * 性能口径（E4-S5）：粒子池每帧 O(maxParticles) 遍历 + 事件驱动爆发，均在线性预算内；
 * 粒子寿命用真实 dt（基准 20× 时缩放不加速特效寿命，视觉节奏不崩）。
 */

import Phaser from 'phaser';
import type { RuntimeConfig } from '@/config/runtime-config';
import { WEAPONS, FX, type EnemyKindId } from '@/config/balance';
import { hexToRgbInt } from '@/utils/math';
import { DEATH_BURST, FX_COLORS, type ParticleFrameName } from '@/fx/fx-spec';

/** 最小池接口（ArcadePoolLike<Missile>/<Gem> 结构性满足） */
export interface FxPoolLike<T> {
  eachActive(fn: (item: T) => void): void;
}

/** 拖尾源/宝石/玩家最小形状 */
export interface FxPosLike {
  x: number;
  y: number;
}

/** 粒子实体（Image + 运动字段；字段挂在对象上避免每帧 Map 查找） */
interface Particle extends Phaser.GameObjects.Image {
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

function pickColor(colors: readonly string[]): string {
  return colors[Math.floor(Math.random() * colors.length)] ?? colors[0] ?? '#FFFFFF';
}

export class FxManager {
  private readonly cfg: RuntimeConfig;
  private readonly particles: Particle[] = [];
  private readonly orbitRing: Phaser.GameObjects.Image;
  private readonly moon: Phaser.GameObjects.Image;
  private readonly vignette: Phaser.GameObjects.Image;
  /** 飞弹拖尾节流累计（ms） */
  private trailAccum = 0;
  /** 宝石磁吸拖尾节流累计（ms） */
  private gemTrailAccum = 0;

  constructor(scene: Phaser.Scene, cfg: RuntimeConfig) {
    this.cfg = cfg;

    // 粒子池（容量 = cfg.maxParticles；预创建全部实例，池满 reject）
    for (let i = 0; i < cfg.maxParticles; i += 1) {
      const p = scene.add.image(0, 0, 'fx-ambient', 'p-circle') as Particle;
      p.setActive(false).setVisible(false).setDepth(70);
      p.vx = 0;
      p.vy = 0;
      p.life = 0;
      p.maxLife = 1;
      this.particles.push(p);
    }

    // 环绕球轨道残影环（升级解锁后可见；p-ring 帧 48×48，环半径 22 → 缩放到轨道直径 160）
    this.orbitRing = scene.add
      .image(0, 0, 'fx-ambient', 'p-ring')
      .setDepth(89)
      .setAlpha(FX.ORBIT_RING_ALPHA)
      .setDisplaySize(WEAPONS.ORBIT.RADIUS * 2, WEAPONS.ORBIT.RADIUS * 2)
      .setTint(hexToRgbInt(FX_COLORS.trail))
      .setVisible(false);

    // 血月天幕（屏幕空间常驻；桌面 190 / 移动 120）
    this.moon = scene.add
      .image(cfg.designWidth / 2, cfg.designHeight * 0.16, 'fx-ambient', 'moon')
      .setScrollFactor(0)
      .setDepth(-80)
      .setDisplaySize(cfg.isMobile ? 120 : 190, cfg.isMobile ? 120 : 190);

    // 暗角渐晕（屏幕空间常驻，压暗边缘；DOM HUD/选卡在 canvas 之上不受影响）
    this.vignette = scene.add
      .image(cfg.designWidth / 2, cfg.designHeight / 2, 'fx-ambient', 'vignette')
      .setScrollFactor(0)
      .setDepth(800)
      .setDisplaySize(cfg.designWidth, cfg.designHeight);

    if (!cfg.fxAmbient) {
      this.moon.setVisible(false);
      this.vignette.setVisible(false);
    }
  }

  /** 每帧：粒子运动 + 衰减 + 回收（真实 dt，基准 20× 时缩放不影响特效寿命） */
  update(dt: number): void {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.setActive(false).setVisible(false);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.setAlpha(p.maxLife > 0 ? Math.max(0, p.life / p.maxLife) : 1);
    }
  }

  /**
   * 飞弹拖尾：节流发射（每 TRAIL_INTERVAL_MS 对全部活跃飞弹各发 1 颗冷青尾迹）。
   * 移动端（fxTrails=false）关闭。
   */
  tickMissileTrails(pool: FxPoolLike<FxPosLike>, dt: number): void {
    if (!this.cfg.fxTrails) return;
    this.trailAccum += dt * 1000;
    if (this.trailAccum < FX.TRAIL_INTERVAL_MS) return;
    this.trailAccum = 0;
    pool.eachActive((m) => {
      this.emitBurst('p-circle', m.x, m.y, [FX_COLORS.trail], FX.TRAIL_COUNT_PER_MISSILE, 26, 2.2, FX.TRAIL_LIFE);
    });
  }

  /** 环绕球轨道残影：残影环随玩家平移 + 缓慢旋转；解锁护体球后可见（移动端关闭） */
  tickOrbitRing(player: FxPosLike, visible: boolean, dt: number): void {
    if (!this.cfg.fxTrails) {
      this.orbitRing.setVisible(false);
      return;
    }
    this.orbitRing.setPosition(player.x, player.y).setVisible(visible);
    if (visible) this.orbitRing.angle += FX.ORBIT_RING_SPIN_DEG * dt;
  }

  /** 宝石磁吸拖尾：仅对磁吸半径内宝石节流发射冷青微光（移动端关闭） */
  tickGemTrails(gemPool: FxPoolLike<FxPosLike>, player: FxPosLike, magnetRadius: number, dt: number): void {
    if (!this.cfg.fxTrails) return;
    this.gemTrailAccum += dt * 1000;
    if (this.gemTrailAccum < FX.GEM_TRAIL_INTERVAL_MS) return;
    this.gemTrailAccum = 0;
    gemPool.eachActive((gem) => {
      const dx = gem.x - player.x;
      const dy = gem.y - player.y;
      if (dx * dx + dy * dy > magnetRadius * magnetRadius) return;
      this.emitBurst('p-circle', gem.x, gem.y, [FX_COLORS.trail], 1, 30, 2, FX.GEM_TRAIL_LIFE);
    });
  }

  /** 击杀溅射：颜色/形状按敌人类型分化（fx-spec.DEATH_BURST） */
  deathBurst(x: number, y: number, kind: EnemyKindId): void {
    if (!this.cfg.fxBursts) return;
    const spec = DEATH_BURST[kind];
    if (!spec) return;
    this.emitBurst(spec.frame, x, y, spec.colors, spec.count, spec.speed, spec.size, spec.life);
  }

  /** 宝石拾取爆点：小规模电光蓝喷点 */
  gemPickup(x: number, y: number): void {
    if (!this.cfg.fxBursts) return;
    this.emitBurst('p-circle', x, y, [FX_COLORS.gem], FX.GEM_PICKUP_COUNT, 90, 2.5, 0.3);
  }

  /** 升级三选一出现：金 + 冷青双色喷点 + 金点扩散环（稀有/奖励语义） */
  levelUpBurst(x: number, y: number): void {
    if (!this.cfg.fxBursts) return;
    this.emitBurst('p-circle', x, y, [FX_COLORS.upgradeCyan, FX_COLORS.upgradeGold], FX.LEVELUP_COUNT, 120, 3, 0.55);
    this.emitRing('p-circle', x, y, [FX_COLORS.upgradeGold], 10, 66, 90, 2.5, 0.5);
  }

  /** Boss 出场：猩红金冲击环 + 金点喷发（霸体闪红由 PlayScene tween 承担） */
  bossEntrance(x: number, y: number): void {
    if (!this.cfg.fxBursts) return;
    this.emitRing('p-circle', x, y, [FX_COLORS.boss, FX_COLORS.bossGold], FX.BOSS_RING_COUNT, FX.BOSS_RING_RADIUS, 130, 3.5, 0.7);
    this.emitBurst('p-circle', x, y, [FX_COLORS.bossGold], 8, 100, 3, 0.6);
  }

  /** 冲击波涟漪：沿当前半径均匀分布、径向外扩的血橙红粒子（8s CD 稀有触发） */
  shockwaveRipple(x: number, y: number, radius: number): void {
    if (!this.cfg.fxBursts) return;
    this.emitRing('p-circle', x, y, [FX_COLORS.shockwave], FX.RIPPLE_COUNT, radius, 60, 3, 0.5);
  }

  /** 当前活跃粒子数（bench draw call / 审计用） */
  get activeCount(): number {
    let n = 0;
    for (const p of this.particles) if (p.active) n += 1;
    return n;
  }

  /** 清空全部粒子（终局/场景关闭兜底；场景 destroy 亦会回收子对象） */
  clearAll(): void {
    for (const p of this.particles) {
      if (p.active) p.setActive(false).setVisible(false);
    }
  }

  // —— 内部发射 ——

  /** 随机方向爆发（每颗粒子独立角度/速度/颜色） */
  private emitBurst(
    frame: ParticleFrameName,
    x: number,
    y: number,
    colors: readonly string[],
    count: number,
    speed: number,
    size: number,
    life: number,
  ): number {
    let emitted = 0;
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.6 + Math.random() * 0.8);
      if (this.spawnParticle(frame, x, y, pickColor(colors), Math.cos(a) * s, Math.sin(a) * s, size, life)) {
        emitted += 1;
      }
    }
    return emitted;
  }

  /** 圆周环爆发：均匀分布在半径圆周、速度径向向外（涟漪/出场环） */
  private emitRing(
    frame: ParticleFrameName,
    x: number,
    y: number,
    colors: readonly string[],
    count: number,
    radius: number,
    speed: number,
    size: number,
    life: number,
  ): number {
    let emitted = 0;
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2;
      const px = x + Math.cos(a) * radius;
      const py = y + Math.sin(a) * radius;
      if (this.spawnParticle(frame, px, py, pickColor(colors), Math.cos(a) * speed, Math.sin(a) * speed, size, life)) {
        emitted += 1;
      }
    }
    return emitted;
  }

  /** 找第一个空闲粒子并配置（池满 reject；形状帧基准 8×8，streak 12×4 按视觉接受） */
  private spawnParticle(
    frame: ParticleFrameName,
    x: number,
    y: number,
    color: string,
    vx: number,
    vy: number,
    size: number,
    life: number,
  ): boolean {
    for (const p of this.particles) {
      if (p.active) continue;
      p.setTexture('fx-ambient', frame);
      p.setPosition(x, y);
      p.setTint(hexToRgbInt(color));
      p.setScale(size / 8);
      p.setAngle((Math.atan2(vy, vx) * 180) / Math.PI);
      p.vx = vx;
      p.vy = vy;
      p.maxLife = life;
      p.life = life;
      p.setAlpha(1);
      p.setActive(true).setVisible(true);
      return true;
    }
    return false;
  }
}
