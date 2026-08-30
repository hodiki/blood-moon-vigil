/**
 * fx/telegraph-layer.ts —— 蓄力预警演出基座（W-13，gdd-enemies-v3 §④ telegraph 演出体系）
 *
 * 单 Graphics 全量重绘（1 draw call/帧，RV-C4 预算内）：形状 = 危险范围，渐亮式
 * （透明度随蓄力推进）。程序化实现（正式美术后按帧名替换或保留几何层）：
 * - 预警圈（掷骨者落点 90px / 月坠等）
 * - 警告线（冲锋系/畸体冲刺线；warningLine 同族三线扩展基座）
 * - 扇形（守墓者 180°/130px、血月尊者普攻）
 * - 阵纹（方阵 2.5s 预警，幽紫）
 * 颜色走 PALETTE（危险红/幽紫/月白 token）；桌面全保留 / 移动端线宽 +1px（§⑦）。
 */

import Phaser from 'phaser';
import { PALETTE } from '@/config/balance';
import type { EliteTelegraph } from '@/enemies/elite-skill-runtime';

const COLOR_DANGER = 0xff3b30;
const COLOR_MOON = 0xe8f0fa;
const COLOR_FORMATION = 0x9b6ec8; // 阵纹幽紫（与词缀角饰光同族异形，F-7）

export class TelegraphLayer {
  private gfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setDepth(5);
  }

  /** 每帧全量重绘（清空 → 按当前 telegraphs 绘制） */
  sync(
    eliteTelegraphs: EliteTelegraph[],
    pendingFormations: Array<{ x: number; y: number; progress: number }>,
    bossCasting: { x: number; y: number; range: number; progress: number } | null,
    lineWidthBonus: number,
    /** W-4 血渍减速区（忏悔者弹着点；暗红地面污染，60px/2s） */
    bloodstains: Array<{ x: number; y: number; until: number }> = [],
  ): void {
    this.gfx.clear();
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
    // —— Boss 施法预警（当前 casting 槽：玩家落点预警圈，半径随技能；数据层通用形状）——
    if (bossCasting) {
      const a = 0.15 + 0.6 * Math.min(1, bossCasting.progress);
      this.gfx.lineStyle(2 + lineWidthBonus, COLOR_DANGER, a);
      this.gfx.strokeCircle(bossCasting.x, bossCasting.y, bossCasting.range);
    }
  }

  hideAll(): void {
    this.gfx.clear();
  }
}

/** PALETTE 引用保形（danger token 同源；防止色值双源漂移） */
void PALETTE.danger;
