/**
 * input/touch-input.ts —— 移动端虚拟摇杆（ARCH §4.1 / ADR-002 / CM §1.2）
 *
 * 混合方案（主理人裁决 / ux-spec §2/§5）：
 * - 常驻底座：空闲时底座固定在默认位 (180,1120)（720×1280 设计空间）
 * - 左半屏任意处起手：pointerdown(x < 屏宽/2) 时底座移至按下点、原点=按下点；
 *   拖动经 computeJoystickVector（死区 10% / clamp ≤1）输出向量；
 *   pointerup/cancel 归零、底座回常驻位。
 * - 摇杆为 Phaser 内对象（setScrollFactor(0) 固定在屏，不随相机），draw call 受控
 *   （1 底座 + 1 拇指，effects 图集规格，E1 用程序生成贴图，art-bible §8 允许）。
 * - setEnabled(false)：LEVEL_UP/PAUSED 隐藏且输入冻结（CM M10）。
 */

import Phaser from 'phaser';
import type { InputSource } from '@/input/input-source';
import { computeJoystickVector } from '@/input/joystick-math';
import { JOYSTICK } from '@/config/balance';
import type { RuntimeConfig } from '@/config/runtime-config';
import type { Vec2 } from '@/utils/math';

export class TouchInput implements InputSource {
  private readonly base: Phaser.GameObjects.Image;
  private readonly thumb: Phaser.GameObjects.Image;
  private readonly origin: Vec2 = { x: 0, y: 0 };
  private move: Vec2 = { x: 0, y: 0 };
  private active = false;
  private pointerId: number | null = null;
  private enabled = true;
  private pauseCb: (() => void) | null = null;
  private tapCb: ((x: number, y: number) => void) | null = null;
  /** M1b 主动技：移动端由 DOM 技能按钮 notify 触发（按钮在 HUD，经此回调进同一入口） */
  private skillCb: (() => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly cfg: RuntimeConfig,
  ) {
    this.ensureTextures(scene);
    this.base = scene.add
      .image(JOYSTICK.DEFAULT_BASE_X, JOYSTICK.DEFAULT_BASE_Y, 'effects', 'joystick-base')
      .setScrollFactor(0)
      .setDepth(1000);
    this.thumb = scene.add
      .image(JOYSTICK.DEFAULT_BASE_X, JOYSTICK.DEFAULT_BASE_Y, 'effects', 'joystick-thumb')
      .setScrollFactor(0)
      .setDepth(1001)
      .setVisible(false);

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);
  }

  /** 摇杆贴图已收敛进 effects 程序图集（fx/procedural-textures.ts），无需单独生成 */
  private ensureTextures(_scene: Phaser.Scene): void {
    // no-op：'effects' 图集由 PlayScene.create 先生成，包含 joystick-base / joystick-thumb 帧
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.enabled) return;
    // 仅左半屏响应（CM M7），右半屏留给 UI/暂停键
    if (pointer.x >= this.cfg.designWidth / 2) return;
    this.active = true;
    this.pointerId = pointer.id;
    this.origin.x = pointer.x;
    this.origin.y = pointer.y;
    this.base.setPosition(pointer.x, pointer.y); // 底座移至按下点（浮动起手）
    this.thumb.setPosition(pointer.x, pointer.y).setVisible(true);
    this.move = { x: 0, y: 0 };
    if (this.tapCb) this.tapCb(pointer.x, pointer.y);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.active || pointer.id !== this.pointerId) return;
    this.move = computeJoystickVector(this.origin, { x: pointer.x, y: pointer.y }, {
      radius: JOYSTICK.RADIUS,
      deadZoneFraction: JOYSTICK.DEAD_ZONE_FRACTION,
    });
    // 拇指贴边 clamp：位置 = 原点 + 向量 × 半径
    this.thumb.setPosition(
      this.origin.x + this.move.x * JOYSTICK.RADIUS,
      this.origin.y + this.move.y * JOYSTICK.RADIUS,
    );
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this.active || pointer.id !== this.pointerId) return;
    this.resetJoystick();
  }

  private resetJoystick(): void {
    this.active = false;
    this.pointerId = null;
    this.move = { x: 0, y: 0 };
    this.thumb.setVisible(false);
    // 底座回常驻位（常驻底座语义）
    this.base.setPosition(JOYSTICK.DEFAULT_BASE_X, JOYSTICK.DEFAULT_BASE_Y);
  }

  getMove(): Vec2 {
    return this.enabled ? this.move : { x: 0, y: 0 };
  }

  /** E4 移动端暂停键（DOM）调用，触发 onPauseToggle 回调（P3） */
  notifyPauseToggle(): void {
    this.pauseCb?.();
  }

  onPauseToggle(cb: () => void): void {
    this.pauseCb = cb;
  }

  /** M1b 主动技：移动端注册释放回调（由 DOM 技能按钮 notifyActiveSkill 触发） */
  onActiveSkill(cb: () => void): void {
    this.skillCb = cb;
  }

  /** M1b 主动技：HUD 技能按钮点按 → 触发释放请求（相位门禁在 PlayScene.tryCastActiveSkill） */
  notifyActiveSkill(): void {
    this.skillCb?.();
  }

  onTap(cb: (x: number, y: number) => void): void {
    this.tapCb = cb;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.resetJoystick(); // LEVEL_UP/PAUSED：摇杆隐藏且向量归零（CM M10 / ux §3 防误触 ④）
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);
    this.base.destroy();
    this.thumb.destroy();
  }
}
