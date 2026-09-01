/**
 * fx/float-text.ts —— 世界内短飘字层（P2-7②，复用 = 伤害飘字管线的共享底座）
 *
 * - FloatTextLayer：小容量 Text 对象池（同屏 ≤FLOAT_TEXT_POOL_SIZE 条，超出丢弃最旧），
 *   上浮 + 淡出手动驱动（不走 Tween，避免每条 tweens 开销）；PlayScene create 装配、shutdown 销毁。
 * - Boss 免疫飘字：状态层 applyStatus reason='immune' ∧ kind='stun'（Boss 硬控免疫，WD-6）
 *   经 GameEvents.StatusImmune 事件送达 → showImmune；同位节流防弹幕式连刷。
 * - 纯函数（immuneFloatAllowed）可脱离 Phaser 单测（test-framework §1.2）。
 */

import Phaser from 'phaser';

/** 单目标免疫飘字节流窗口（秒）：同目标 1.2s 内只飘 1 条（节流口径，§⑧ 表现预算） */
export const IMMUNE_FLOAT_THROTTLE_SECONDS = 1.2;

/** 同目标节流半径（px）：目标位移 ≤ 半径视为同一目标（Boss 体型量级） */
export const IMMUNE_FLOAT_THROTTLE_RADIUS = 80;

/** 同屏飘字上限（条）：池容量硬顶，超出复用最旧（性能预算：≤8 个 Text 对象） */
export const FLOAT_TEXT_POOL_SIZE = 8;

/** 单条飘字寿命（秒）：上浮 24px + 淡出 */
export const FLOAT_TEXT_LIFE_SECONDS = 0.6;

export interface FloatTextItem extends Phaser.GameObjects.Text {
  fxLife: number;
  fxMaxLife: number;
  fxBaseY: number;
}

/**
 * 免疫飘字节流判定（纯函数）：
 * - 首条直接放行；同目标（位移 ≤ throttleRadius）在 throttleSeconds 内 → 拒绝；
 * - 不同目标 / 窗口外 → 放行。
 */
export function immuneFloatAllowed(
  last: { x: number; y: number; at: number } | null,
  x: number,
  y: number,
  now: number,
  throttleSeconds = IMMUNE_FLOAT_THROTTLE_SECONDS,
  throttleRadius = IMMUNE_FLOAT_THROTTLE_RADIUS,
): boolean {
  if (!last) return true;
  if (now - last.at < throttleSeconds) {
    const dx = x - last.x;
    const dy = y - last.y;
    if (dx * dx + dy * dy <= throttleRadius * throttleRadius) return false;
  }
  return true;
}

export class FloatTextLayer {
  private readonly items: FloatTextItem[] = [];
  private used = 0;
  /** 最近一条免疫飘字（节流状态；场景重开随层重建） */
  private lastImmune: { x: number; y: number; at: number } | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  /** Boss 硬控免疫飘字：节流后飘「免疫」（金红短文本，命中点上浮） */
  showImmune(x: number, y: number, now: number): void {
    if (!immuneFloatAllowed(this.lastImmune, x, y, now)) return;
    this.lastImmune = { x, y, at: now };
    this.show(x, y, '免疫', '#FFC93C');
  }

  /** 通用短飘字（伤害数字等后续消费共用管线） */
  show(x: number, y: number, text: string, color: string): void {
    let item = this.items[this.used];
    if (!item) {
      if (this.items.length >= FLOAT_TEXT_POOL_SIZE) {
        // 池满：复用最旧（used 环回 0）
        this.used = 0;
        item = this.items[0]!;
      } else {
        const created = this.scene.add
          .text(0, 0, '', {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '14px',
            fontStyle: 'bold',
            color,
            stroke: '#131722',
            strokeThickness: 3,
          })
          .setDepth(95)
          .setOrigin(0.5) as FloatTextItem;
        created.fxLife = 0;
        created.fxMaxLife = FLOAT_TEXT_LIFE_SECONDS;
        created.fxBaseY = 0;
        this.items.push(created);
        item = created;
      }
    }
    if (!item) return; // 防御：池异常空（理论不可达）
    item.setText(text);
    item.setColor(color);
    item.setPosition(x, y - 24);
    item.fxBaseY = y - 24;
    item.setAlpha(1);
    item.setVisible(true);
    item.fxLife = 0;
    item.fxMaxLife = FLOAT_TEXT_LIFE_SECONDS;
    this.used = (this.used + 1) % FLOAT_TEXT_POOL_SIZE;
  }

  /** 帧驱动：上浮 + 淡出（dt 秒） */
  update(dt: number): void {
    for (const item of this.items) {
      if (!item.visible) continue;
      item.fxLife += dt;
      const t = item.fxLife / item.fxMaxLife;
      if (t >= 1) {
        item.setVisible(false);
        continue;
      }
      item.setY(item.fxBaseY - 24 * t);
      item.setAlpha(1 - t);
    }
  }

  hideAll(): void {
    for (const item of this.items) item.setVisible(false);
    this.lastImmune = null;
  }

  destroy(): void {
    this.hideAll();
    for (const item of this.items) item.destroy();
    this.items.length = 0;
    this.used = 0;
  }
}
