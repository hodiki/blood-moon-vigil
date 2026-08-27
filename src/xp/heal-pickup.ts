/**
 * xp/heal-pickup.ts —— 治疗道具实体（M3；asset-spec §1.5 `heal` 帧 16×16）
 *
 * - 治疗绿 #43D17C（art-bible 绿=治疗语义；token 来源 balance.HEAL.COLOR）
 * - 池化（kind='heals'，复用 ArcadePoolLike；视觉 16×16 + 1.5px 纸白描边由帧负责）
 * - 拾取识别/掉落/治疗数学在 heal-manager.ts（纯函数可单测）；本类只做字段与激活/回收。
 */

import Phaser from 'phaser';

export class HealPickup extends Phaser.Physics.Arcade.Sprite {
  /** 落地年龄 s（暂留；后续慢漂/E-lite 复用经验宝石漂移语义时消费） */
  age = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, texture?: string, frame?: string | number) {
    super(scene, x, y, texture ?? 'effects', frame ?? 'heal');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.enable = false;
    this.setActive(false).setVisible(false);
    // 治疗绿画在帧内（asset-spec §1.5）；外部素材已着色时不再乘 tint
    this.clearTint();
  }

  /** 从池取出：重置年龄、呼吸发光 + 激活（merit-ui-spec §11：呼吸发光 1s） */
  spawn(x: number, y: number): void {
    this.age = 0;
    this.setPosition(x, y);
    this.setActive(true).setVisible(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.reset(x, y);
    // 呼吸发光（1s 周期 yoyo；低透明脉动，绿=治疗语义；回收时 kill）
    this.setAlpha(1);
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      alpha: 0.65,
      scale: 1.08,
      duration: 1000,
      yoyo: true,
      repeat: -1,
    });
  }

  /** 拾取完成：回收回池（不销毁） */
  deactivate(): void {
    if (!this.active) return;
    this.scene.tweens.killTweensOf(this);
    this.setScale(1).setAlpha(1);
    this.setActive(false).setVisible(false);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.stop();
    body.enable = false;
  }
}
