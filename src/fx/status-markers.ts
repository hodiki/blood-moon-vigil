/**
 * fx/status-markers.ts —— 特殊行为标记（TA：程序帧先挂；1 Image/怪，不消费粒子池）
 *
 * - 亡魂：本体 α0.5
 * - 尸巫：脚下 p-ring 幽紫呼吸
 * - 狼裔猎手：Graphics 红警告线（蓄力淡入 + 亮起）
 * - 侍僧：头顶 p-circle
 * - 眩晕 / 减速 / 标记：头顶小点（marker-* 到货后自动换帧）
 */

import Phaser from 'phaser';
import { ENEMY_BEHAVIORS, PALETTE, type ChargeBehaviorConfig } from '@/config/balance';
import type { RuntimeConfig } from '@/config/runtime-config';
import { chargeCycleElapsed, warningLineAlpha } from '@/enemies/enemy-behaviors';
import type { Enemy } from '@/enemies/enemy';
import { SPECIAL_MARKERS } from '@/fx/fx-spec';
import type { Player } from '@/player/player';
import { hexToRgbInt } from '@/utils/math';

const DEPTH_AURA = 40;
const DEPTH_LINE = 85;
const DEPTH_HEAD = 92;

function fxFrame(scene: Phaser.Scene, preferred: string, fallback: string): string {
  if (!scene.textures.exists('fx-ambient')) return fallback;
  return scene.textures.get('fx-ambient').has(preferred) ? preferred : fallback;
}

class ImagePool {
  private readonly items: Phaser.GameObjects.Image[] = [];
  private used = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly fallbackFrame: string,
    private readonly depth: number,
  ) {}

  begin(): void {
    this.used = 0;
  }

  take(): Phaser.GameObjects.Image {
    let img = this.items[this.used];
    if (!img) {
      img = this.scene.add.image(0, 0, 'fx-ambient', this.fallbackFrame);
      img.setDepth(this.depth);
      this.items.push(img);
    }
    this.used += 1;
    img.setActive(true).setVisible(true);
    return img;
  }

  end(): void {
    for (let i = this.used; i < this.items.length; i += 1) {
      this.items[i]?.setActive(false).setVisible(false);
    }
  }

  hideAll(): void {
    this.used = 0;
    this.end();
  }

  destroy(): void {
    for (const img of this.items) img.destroy();
    this.items.length = 0;
    this.used = 0;
  }
}

export class StatusMarkerLayer {
  private readonly aura: ImagePool;
  private readonly rune: ImagePool;
  private readonly dots: ImagePool;
  private readonly lines: Phaser.GameObjects.Graphics;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly cfg: RuntimeConfig,
  ) {
    this.aura = new ImagePool(scene, 'p-ring', DEPTH_AURA);
    this.rune = new ImagePool(scene, 'p-circle', DEPTH_HEAD);
    this.dots = new ImagePool(scene, 'p-circle', DEPTH_HEAD);
    this.lines = scene.add.graphics().setDepth(DEPTH_LINE);
  }

  sync(pool: { eachActive(fn: (e: Enemy) => void): void }, player: Player, now: number): void {
    this.aura.begin();
    this.rune.begin();
    this.dots.begin();
    this.lines.clear();
    const lineW = this.cfg.isMobile
      ? SPECIAL_MARKERS.warningline.widthMobile
      : SPECIAL_MARKERS.warningline.widthDesktop;

    pool.eachActive((e) => {
      if (e.enemyId === 'enemy_g1_4') {
        e.setAlpha(SPECIAL_MARKERS.phase.bodyAlpha);
      }
      if (e.enemyId === 'enemy_g1_5') this.placeAura(e, now);
      if (e.enemyId === 'enemy_g2_3') this.placeRune(e, now);
      const behavior = e.enemyId ? ENEMY_BEHAVIORS[e.enemyId] : undefined;
      if (behavior?.kind === 'charge') {
        this.drawWarning(e, player, now, behavior, lineW);
      }
      this.placeStatusDots(e, now);
    });

    this.aura.end();
    this.rune.end();
    this.dots.end();
  }

  hideAll(): void {
    this.aura.hideAll();
    this.rune.hideAll();
    this.dots.hideAll();
    this.lines.clear();
  }

  destroy(): void {
    this.hideAll();
    this.aura.destroy();
    this.rune.destroy();
    this.dots.destroy();
    this.lines.destroy();
  }

  private placeAura(e: Enemy, now: number): void {
    const spec = SPECIAL_MARKERS.aura;
    const img = this.aura.take();
    const size = spec.radius * 2;
    const breath = spec.alpha + Math.sin((now * Math.PI * 2) / spec.breatheSeconds) * 0.08;
    img.setTexture('fx-ambient', fxFrame(this.scene, spec.frame, 'p-ring'));
    img.setPosition(e.x, e.y + e.radius * 0.35);
    img.setDisplaySize(size, size);
    img.setTint(hexToRgbInt(spec.color));
    img.setAlpha(Math.max(0.18, Math.min(0.4, breath)));
  }

  private placeRune(e: Enemy, now: number): void {
    const spec = SPECIAL_MARKERS.rune;
    const img = this.rune.take();
    const breath = 0.75 + Math.sin((now * Math.PI * 2) / spec.breatheSeconds) * 0.2;
    img.setTexture('fx-ambient', fxFrame(this.scene, spec.frame, 'p-circle'));
    img.setPosition(e.x, e.y - e.radius - 10);
    img.setDisplaySize(spec.size, spec.size);
    img.setTint(hexToRgbInt(spec.color));
    img.setAlpha(breath);
  }

  private drawWarning(
    e: Enemy,
    player: Player,
    now: number,
    b: ChargeBehaviorConfig,
    width: number,
  ): void {
    const cycle = chargeCycleElapsed(now, e.spawnedAt, b.interval);
    const alpha = warningLineAlpha(b, cycle);
    if (alpha <= 0) return;
    this.lines.lineStyle(width, hexToRgbInt(SPECIAL_MARKERS.warningline.color), alpha);
    this.lines.beginPath();
    this.lines.moveTo(e.x, e.y);
    this.lines.lineTo(player.x, player.y);
    this.lines.strokePath();
  }

  private placeStatusDots(e: Enemy, now: number): void {
    const dots: { color: string; frame: string }[] = [];
    if (e.stunnedUntil > now) {
      dots.push({ color: PALETTE.uiPaper, frame: 'marker-stun' });
    }
    if (e.slowUntil > now) {
      dots.push({ color: PALETTE.playerAccent, frame: 'marker-slow' });
    }
    if (e.markUntil > now) {
      dots.push({ color: PALETTE.player, frame: 'marker-mark' });
    }
    const n = dots.length;
    if (n === 0) return;
    const y = e.y - e.radius - 18;
    for (let i = 0; i < n; i += 1) {
      const spec = dots[i];
      if (!spec) continue;
      const img = this.dots.take();
      const dx = (i - (n - 1) / 2) * 7;
      img.setTexture('fx-ambient', fxFrame(this.scene, spec.frame, 'p-circle'));
      img.setPosition(e.x + dx, y);
      img.setDisplaySize(8, 8);
      img.setTint(hexToRgbInt(spec.color));
      img.setAlpha(0.95);
    }
  }
}
