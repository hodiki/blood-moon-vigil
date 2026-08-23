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

/** 环绕球尾迹源（OrbitWeapon 结构性满足：遍历可见球体位置） */
export interface OrbitTrailSource {
  eachOrbPosition(fn: (x: number, y: number) => void): void;
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
  /** TASK-36 双层轨道环：内环（细暗反向慢旋，同 fx-ambient 批次 +0 draw call） */
  private readonly orbitRingSecondary: Phaser.GameObjects.Image;
  /** TASK-36 蓄力脉冲提示环（冲击波最后 2s 呼吸；随 fxTrails 开关） */
  private readonly chargePulse: Phaser.GameObjects.Image;
  private readonly moon: Phaser.GameObjects.Image;
  private readonly vignette: Phaser.GameObjects.Image;
  /** 飞弹拖尾节流累计（ms） */
  private trailAccum = 0;
  /** 宝石磁吸拖尾节流累计（ms） */
  private gemTrailAccum = 0;
  /** TASK-36 环绕球尾迹节流累计（ms） */
  private orbitTrailAccum = 0;
  /** TASK-36 环绕球命中火花全局节流截止（秒时间戳） */
  private orbitHitThrottleUntil = 0;
  /** TASK-36 蓄力脉冲呼吸相位（rad） */
  private chargePulsePhase = 0;

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
    // TASK-36 双层轨道环内环：半径 RADIUS-12、alpha 0.12、反向 -12°/s（同批次 +0 draw call）
    this.orbitRingSecondary = scene.add
      .image(0, 0, 'fx-ambient', 'p-ring')
      .setDepth(88)
      .setAlpha(FX.ORBIT_RING_SECONDARY_ALPHA)
      .setDisplaySize(
        (WEAPONS.ORBIT.RADIUS - FX.ORBIT_RING_SECONDARY_OFFSET) * 2,
        (WEAPONS.ORBIT.RADIUS - FX.ORBIT_RING_SECONDARY_OFFSET) * 2,
      )
      .setTint(hexToRgbInt(FX_COLORS.trail))
      .setVisible(false);
    // TASK-36 蓄力脉冲提示环：冲击波最后 2s 呼吸（低透明，非持续闪烁源）
    this.chargePulse = scene.add
      .image(0, 0, 'fx-ambient', 'p-ring')
      .setDepth(88)
      .setAlpha(FX.SHOCKWAVE_CHARGE_PULSE_ALPHA)
      .setDisplaySize(FX.SHOCKWAVE_CHARGE_PULSE_RADIUS * 2, FX.SHOCKWAVE_CHARGE_PULSE_RADIUS * 2)
      .setTint(hexToRgbInt(FX_COLORS.shockwave))
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
   * 飞弹拖尾：节流发射（每 TRAIL_INTERVAL_MS 对全部活跃飞弹各发 1 颗冷青彗尾）。
   * TASK-36：p-circle 点 → p-streak 彗尾（spawnParticle 已按速度方向 setAngle，沿飞行方向拉长）。
   * 移动端（fxTrails=false）关闭。
   */
  tickMissileTrails(pool: FxPoolLike<FxPosLike>, dt: number): void {
    if (!this.cfg.fxTrails) return;
    this.trailAccum += dt * 1000;
    if (this.trailAccum < FX.TRAIL_INTERVAL_MS) return;
    this.trailAccum = 0;
    pool.eachActive((m) => {
      this.emitBurst(FX.TRAIL_FRAME, m.x, m.y, [FX_COLORS.trail], FX.TRAIL_COUNT_PER_MISSILE, 26, 2.0, FX.TRAIL_LIFE);
    });
  }

  /** TASK-36 飞弹发射喷涌：玩家位置开火小 puff（冷青，短命）；随 fxBursts */
  missileLaunch(x: number, y: number): void {
    if (!this.cfg.fxBursts) return;
    this.emitBurst('p-circle', x, y, [FX_COLORS.trail], FX.MISSILE_LAUNCH_PUFF_COUNT, 40, 1.8, 0.25);
  }

  /** TASK-36 飞弹命中反馈：冷青小冲击环 + 火花（命中即消失，事件驱动） */
  missileImpact(x: number, y: number): void {
    if (!this.cfg.fxBursts) return;
    this.emitRing('p-ring', x, y, [FX_COLORS.trail], FX.MISSILE_IMPACT_RING_COUNT, FX.MISSILE_IMPACT_RING_RADIUS, 30, 2.5, 0.18);
    this.emitBurst('p-circle', x, y, [FX_COLORS.trail], FX.MISSILE_IMPACT_SPARK_COUNT, 120, 2, 0.3);
  }

  /** 环绕球轨道残影：残影环随玩家平移 + 缓慢旋转；解锁护体球后可见（移动端关闭） */
  tickOrbitRing(player: FxPosLike, visible: boolean, dt: number): void {
    if (!this.cfg.fxTrails) {
      this.orbitRing.setVisible(false);
      this.orbitRingSecondary.setVisible(false);
      return;
    }
    this.orbitRing.setPosition(player.x, player.y).setVisible(visible);
    if (visible) this.orbitRing.angle += FX.ORBIT_RING_SPIN_DEG * dt;
    // TASK-36 双层轨道环内环：细暗反向慢旋
    this.orbitRingSecondary.setPosition(player.x, player.y).setVisible(visible);
    if (visible) this.orbitRingSecondary.angle += FX.ORBIT_RING_SECONDARY_SPIN_DEG * dt;
  }

  /** TASK-36 环绕球尾迹：每球每节流拍发 1 颗原地淡出冷青光点（速度 0），球体绕行留下光之环 */
  tickOrbitTrails(source: OrbitTrailSource, dt: number): void {
    if (!this.cfg.fxTrails) return;
    this.orbitTrailAccum += dt * 1000;
    if (this.orbitTrailAccum < FX.ORBIT_TRAIL_INTERVAL_MS) return;
    this.orbitTrailAccum = 0;
    source.eachOrbPosition((x, y) => {
      this.emitBurst('p-circle', x, y, [FX_COLORS.trail], 1, 0, FX.ORBIT_TRAIL_SIZE, FX.ORBIT_TRAIL_LIFE);
    });
  }

  /** TASK-36 环绕球命中火花：全局节流（每 ORBIT_HIT_THROTTLE_MS ≤1 次，防 6 球高频刷屏） */
  orbitHit(x: number, y: number, now: number): void {
    if (!this.cfg.fxBursts) return;
    if (now < this.orbitHitThrottleUntil) return;
    this.orbitHitThrottleUntil = now + FX.ORBIT_HIT_THROTTLE_MS / 1000;
    this.emitBurst('p-circle', x, y, [FX_COLORS.trail], FX.ORBIT_HIT_SPARK_COUNT, 90, 1.8, 0.28);
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

  /** M3 治疗道具拾取发光：治疗绿 #43D17C 喷点（复用粒子池/帧，不新增 draw call；绿=治疗语义） */
  healPickup(x: number, y: number): void {
    if (!this.cfg.fxBursts) return;
    this.emitBurst('p-circle', x, y, [FX_COLORS.heal], FX.GEM_PICKUP_COUNT, 90, 2.5, 0.3);
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

  /** 冲击波涟漪：沿当前半径均匀分布、径向外扩的血橙红粒子（8s CD 稀有触发；TASK-36 加密提速 36/24 + speed 90 + size 4） */
  shockwaveRipple(x: number, y: number, radius: number): void {
    if (!this.cfg.fxBursts) return;
    const count = this.cfg.isMobile ? FX.RIPPLE_COUNT_MOBILE : FX.RIPPLE_COUNT;
    this.emitRing('p-circle', x, y, [FX_COLORS.shockwave], count, radius, FX.RIPPLE_SPEED, FX.RIPPLE_SIZE, 0.5);
  }

  /** M1b 主动技「提灯闪耀」：冷青扩散环 + 纸白核心闪（20s CD 稀有触发；纯粒子，不新增 draw call） */
  lanternFlash(x: number, y: number, radius: number): void {
    if (!this.cfg.fxBursts) return;
    this.emitRing('p-ring', x, y, [FX_COLORS.lanternFlash], 14, radius, 60, 3, 0.5);
    this.emitBurst('p-circle', x, y, [FX_COLORS.lanternFlashCore, FX_COLORS.lanternFlash], 10, 90, 2.5, 0.4);
  }

  /** TASK-36 冲击波最大半径白闪环：扩散到位的月蚀亮边（纸白短命） */
  shockwaveEdgeFlash(x: number, y: number, radius: number): void {
    if (!this.cfg.fxBursts) return;
    this.emitRing('p-circle', x, y, [FX_COLORS.paper], FX.SHOCKWAVE_EDGE_FLASH_COUNT, radius, 20, 3, FX.SHOCKWAVE_EDGE_FLASH_LIFE);
  }

  /** TASK-36 蓄力脉冲提示：冲击波冷却最后 2s 玩家周围 60px 脉冲环（正弦呼吸，低透明；随 fxTrails） */
  tickShockwaveCharge(player: FxPosLike, secondsUntilReady: number, dt: number): void {
    if (!this.cfg.fxTrails) {
      this.chargePulse.setVisible(false);
      return;
    }
    const inLead =
      secondsUntilReady > 0 && secondsUntilReady <= FX.SHOCKWAVE_CHARGE_PULSE_LEAD_SECONDS;
    this.chargePulse.setPosition(player.x, player.y).setVisible(inLead);
    if (inLead) {
      this.chargePulsePhase += dt * Math.PI * 2; // 1Hz 呼吸
      const breath = FX.SHOCKWAVE_CHARGE_PULSE_ALPHA + Math.sin(this.chargePulsePhase) * 0.05;
      this.chargePulse.setAlpha(Math.max(0.08, Math.min(0.22, breath)));
    }
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
