/**
 * xp/xp-gem.ts —— 经验宝石实体（ARCH §3.2 池表 / S6 / E3-S1）
 *
 * - 蓝菱 #4FC3F7（art-bible 色板 + upgrade-pool 经验关联），本体 12px 视觉。
 * - 池化（kind='gems'，maxSize 桌面 300 / 移动 200，ARCH §3.2 池表）。
 * - 磁吸/拾取数学在 xp-manager.ts 的 stepGem 纯函数；本类只做字段与激活/回收。
 * - 拾取识别区 16px / 磁吸半径 80px（升级第 9 项 +100% → 160/240）由 balance GEM 常量驱动。
 */

import Phaser from 'phaser';

export class XpGem extends Phaser.Physics.Arcade.Sprite {
  /** 本宝石经验值（僵尸 1 / 疾行 2 / 厚血 15 / Boss 100，enemies §③） */
  xpValue = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, texture?: string, frame?: string | number) {
    super(scene, x, y, texture ?? 'effects', frame ?? 'gem');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.enable = false;
    this.setActive(false).setVisible(false);
  }

  /** 从池取出：重置经验值并激活（ADR-001 组件式数据字段） */
  spawn(x: number, y: number, xpValue: number): void {
    this.xpValue = xpValue;
    this.setPosition(x, y);
    this.setActive(true).setVisible(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.reset(x, y);
  }

  /** 拾取完成：回收回池（不销毁） */
  deactivate(): void {
    if (!this.active) return;
    this.setActive(false).setVisible(false);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.stop();
    body.enable = false;
  }
}
