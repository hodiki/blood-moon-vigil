/**
 * fx/telegraph-layer.ts —— 蓄力预警演出基座（W-13，gdd-enemies-v3 §④ telegraph 演出体系）
 *
 * 单 Graphics 全量重绘（1 draw call/帧，RV-C4 预算内）：形状 = 危险范围，渐亮式
 * （透明度随蓄力推进）。程序化实现（正式美术后按帧名替换或保留几何层）：
 * - 预警圈（掷骨者落点 90px / 月坠等）
 * - 警告线（冲锋系/畸体冲刺线；warningLine 同族三线扩展基座）
 * - 扇形（守墓者 180°/130px、血月尊者普攻）
 * - 阵纹（方阵 2.5s 预警，幽紫）
 * - Boss 技能区（P0-6：扇形/环形留缝/落点圈/走廊/持续场，形状 = 危险范围，渐亮式）
 * 颜色走 PALETTE（危险红/幽紫/月白 token）；桌面全保留 / 移动端线宽 +1px（§⑦）。
 */

import Phaser from 'phaser';
import { PALETTE } from '@/config/balance';
import type { EliteTelegraph } from '@/enemies/elite-skill-runtime';
import type { BossZoneView } from '@/enemies/boss-skill-runtime';

const COLOR_DANGER = 0xff3b30;
const COLOR_MOON = 0xe8f0fa;
const COLOR_FORMATION = 0x9b6ec8; // 阵纹幽紫（与词缀角饰光同族异形，F-7）

export class TelegraphLayer {
  private gfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setDepth(5);
  }

  /**
   * 每帧全量重绘（清空 → 按当前 telegraphs 绘制）。
   * lungeTelegraphs（P0-4 突袭三敌）：短突进线（90px 蓄身渐亮）——与冲锋猎手
   * 300px 警告线同族异形（短距离 + 无第二段警告相位，手感可区分）。
   */
  sync(
    eliteTelegraphs: EliteTelegraph[],
    pendingFormations: Array<{ x: number; y: number; progress: number }>,
    /** P0-6 Boss 技能区（boss-skill-runtime zoneViews；形状 = 危险范围） */
    bossZones: BossZoneView[] = [],
    lineWidthBonus: number,
    /** W-4 血渍减速区（忏悔者弹着点；暗红地面污染，60px/2s） */
    bloodstains: Array<{ x: number; y: number; until: number }> = [],
    /** P0-4 突袭型蓄身预警（方向锁定段渐亮；形状 = 危险范围） */
    lungeTelegraphs: Array<{ x: number; y: number; angle: number; alpha: number; range: number }> = [],
  ): void {
    this.gfx.clear();
    // —— P0-4 突袭型蓄身预警（先画：衬在最底层，与精英预警不互斥）——
    for (const l of lungeTelegraphs) {
      const a = Math.max(0.12, Math.min(0.9, l.alpha));
      const ex = l.x + Math.cos(l.angle) * l.range;
      const ey = l.y + Math.sin(l.angle) * l.range;
      this.gfx.lineStyle(2 + lineWidthBonus, COLOR_DANGER, a);
      this.gfx.beginPath();
      this.gfx.moveTo(l.x, l.y);
      this.gfx.lineTo(ex, ey);
      this.gfx.strokePath();
    }
    // —— 精英技能 telegraph ——
    for (const t of eliteTelegraphs) {
      const a = Math.max(0.12, t.alpha); // 渐亮下限（可读性）
      const px = t.elite.x;
      const py = t.elite.y;
      if (t.shape === 'arc') {
        // 180° 扇形（朝向玩家方向为中心角）
        this.gfx.fillStyle(COLOR_DANGER, a * 0.35);
        this.gfx.beginPath();
        this.gfx.moveTo(px, py);
        this.gfx.arc(px, py, t.range, t.angle - Math.PI / 2, t.angle + Math.PI / 2);
        this.gfx.closePath();
        this.gfx.fillPath();
        this.gfx.lineStyle(1 + lineWidthBonus, COLOR_DANGER, a);
        this.gfx.beginPath();
        this.gfx.arc(px, py, t.range, t.angle - Math.PI / 2, t.angle + Math.PI / 2);
        this.gfx.strokePath();
      } else if (t.shape === 'dash-line') {
        // 地面箭头线（长 300px，宽 60px 等效 = 两侧偏移线）
        const len = 300;
        const ex = px + Math.cos(t.angle) * len;
        const ey = py + Math.sin(t.angle) * len;
        this.gfx.lineStyle(2 + lineWidthBonus, COLOR_DANGER, a);
        this.gfx.beginPath();
        this.gfx.moveTo(px, py);
        this.gfx.lineTo(ex, ey);
        this.gfx.strokePath();
      } else {
        // 预警圈（掷骨者落点）/ 弹道细线（忏悔者：细线 + 落点小圈）
        if (t.shape === 'volley-line') {
          this.gfx.lineStyle(1 + lineWidthBonus, COLOR_MOON, a);
          this.gfx.beginPath();
          this.gfx.moveTo(px, py);
          this.gfx.lineTo(px + Math.cos(t.angle) * t.range, py + Math.sin(t.angle) * t.range);
          this.gfx.strokePath();
        }
        this.gfx.lineStyle(1.5 + lineWidthBonus, COLOR_DANGER, a);
        this.gfx.strokeCircle(px + Math.cos(t.angle) * Math.min(t.range, 200), py + Math.sin(t.angle) * Math.min(t.range, 200), t.shape === 'warning-circle' ? t.range : 30);
      }
    }
    // —— 方阵阵纹（2.5s 渐亮，幽紫；F-7）——
    for (const f of pendingFormations) {
      const a = 0.15 + 0.65 * Math.min(1, f.progress);
      this.gfx.lineStyle(2 + lineWidthBonus, COLOR_FORMATION, a);
      this.gfx.strokeCircle(f.x, f.y, 90);
      this.gfx.lineStyle(1 + lineWidthBonus, COLOR_FORMATION, a * 0.7);
      this.gfx.strokeCircle(f.x, f.y, 60);
    }
    // —— W-4 血渍区（暗红地面污染，渐隐）——
    for (const b of bloodstains) {
      this.gfx.fillStyle(0x8c1f1f, 0.35);
      this.gfx.fillCircle(b.x, b.y, 60);
    }
    // —— P0-6 Boss 技能区（扇形/环形留缝/落点圈/走廊/持续场；形状 = 危险范围，渐亮式）——
    for (const z of bossZones) {
      const a = 0.15 + 0.6 * Math.min(1, z.progress);
      if (z.shape === 'arc') {
        this.gfx.fillStyle(COLOR_DANGER, a * 0.35);
        this.gfx.beginPath();
        this.gfx.moveTo(z.x, z.y);
        this.gfx.arc(z.x, z.y, z.range, z.angle - z.halfAngle, z.angle + z.halfAngle);
        this.gfx.closePath();
        this.gfx.fillPath();
        this.gfx.lineStyle(2 + lineWidthBonus, COLOR_DANGER, a);
        this.gfx.beginPath();
        this.gfx.arc(z.x, z.y, z.range, z.angle - z.halfAngle, z.angle + z.halfAngle);
        this.gfx.strokePath();
      } else if (z.shape === 'ring') {
        // 环形带（缺口段不画 = 缺口即安全缝）
        const a0 = z.gapAngle + z.gapHalf;
        const a1 = z.gapAngle - z.gapHalf + Math.PI * 2;
        this.gfx.lineStyle(2 + lineWidthBonus, COLOR_DANGER, a);
        this.gfx.beginPath();
        this.gfx.arc(z.x, z.y, z.range + z.halfWidth, a0, a1);
        this.gfx.strokePath();
        this.gfx.beginPath();
        this.gfx.arc(z.x, z.y, Math.max(1, z.range - z.halfWidth), a0, a1);
        this.gfx.strokePath();
        // 缺口端径向线（可读性）
        for (const ang of [a0, a1]) {
          this.gfx.beginPath();
          this.gfx.moveTo(z.x + Math.cos(ang) * (z.range - z.halfWidth), z.y + Math.sin(ang) * (z.range - z.halfWidth));
          this.gfx.lineTo(z.x + Math.cos(ang) * (z.range + z.halfWidth), z.y + Math.sin(ang) * (z.range + z.halfWidth));
          this.gfx.strokePath();
        }
      } else if (z.shape === 'corridor') {
        // 走廊两侧线 + 端线（冲锋线/连射走廊）
        const nx = -Math.sin(z.angle);
        const ny = Math.cos(z.angle);
        const ex = z.x + Math.cos(z.angle) * z.range;
        const ey = z.y + Math.sin(z.angle) * z.range;
        this.gfx.lineStyle(2 + lineWidthBonus, COLOR_DANGER, a);
        this.gfx.beginPath();
        this.gfx.moveTo(z.x + nx * z.halfWidth, z.y + ny * z.halfWidth);
        this.gfx.lineTo(ex + nx * z.halfWidth, ey + ny * z.halfWidth);
        this.gfx.strokePath();
        this.gfx.beginPath();
        this.gfx.moveTo(z.x - nx * z.halfWidth, z.y - ny * z.halfWidth);
        this.gfx.lineTo(ex - nx * z.halfWidth, ey - ny * z.halfWidth);
        this.gfx.strokePath();
        this.gfx.beginPath();
        this.gfx.moveTo(ex + nx * z.halfWidth, ey + ny * z.halfWidth);
        this.gfx.lineTo(ex - nx * z.halfWidth, ey - ny * z.halfWidth);
        this.gfx.strokePath();
      } else if (z.shape === 'field') {
        // 持续场（血池/血雾：暗红地面污染语义）
        this.gfx.fillStyle(COLOR_DANGER, a * 0.3);
        this.gfx.fillCircle(z.x, z.y, z.range);
        this.gfx.lineStyle(1.5 + lineWidthBonus, COLOR_DANGER, a * 0.8);
        this.gfx.strokeCircle(z.x, z.y, z.range);
      } else {
        // 落点圈（血池直击/血井/月坠/引力圈）
        this.gfx.fillStyle(COLOR_DANGER, a * 0.2);
        this.gfx.fillCircle(z.x, z.y, z.range);
        this.gfx.lineStyle(2 + lineWidthBonus, COLOR_DANGER, a);
        this.gfx.strokeCircle(z.x, z.y, z.range);
      }
    }
  }

  hideAll(): void {
    this.gfx.clear();
  }
}

/** PALETTE 引用保形（danger token 同源；防止色值双源漂移） */
void PALETTE.danger;
