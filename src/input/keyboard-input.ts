/**
 * input/keyboard-input.ts —— 桌面键盘适配器（ARCH §4.1 / ADR-002 / CM §1.1）
 *
 * - WASD + 方向键 8 向合并（computeMoveVector 纯函数，M1–M6）
 * - Esc / P JustDown 触发暂停切换（P1/P2）
 * - 不持有游戏状态、不 import 玩法模块（ARCH §2 依赖方向铁律）
 */

import Phaser from 'phaser';
import type { InputSource } from '@/input/input-source';
import { computeMoveVector, type KeyState } from '@/input/move-vector';
import { KeyboardRestoreGuard, type AxisState, type MoveAxis } from '@/input/keyboard-restore';
import type { Vec2 } from '@/utils/math';

export class KeyboardInput implements InputSource {
  private readonly keys: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private readonly arrows: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private readonly pause1: Phaser.Input.Keyboard.Key;
  private readonly pause2: Phaser.Input.Keyboard.Key;
  private pauseCb: (() => void) | null = null;
  private enabled = true;
  /**
   * ux-spec §3 防误触 ②④ 精确化（TASK-21 Bug1）：
   * 冻结时快照「仍按住的键」，恢复时仍按住的键立即重新激活（用户真机反馈：
   * 持续按住 WASD 不应在选卡后失效）；其余键需恢复后 ≥50ms 的 fresh keydown
   * 才激活（防选卡瞬间误触 / 防恢复瞬间瞬移）。决策逻辑在 keyboard-restore.ts（可单测）。
   */
  private readonly restoreGuard = new KeyboardRestoreGuard();

  constructor(private readonly scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (!kb) throw new Error('KeyboardInput: 场景未启用键盘输入');
    // M1–M4：WASD + 方向键双映射；addKey 按 KeyCodes[name] 解析（'UP'→38 等）
    this.keys = {
      up: kb.addKey('W'),
      down: kb.addKey('S'),
      left: kb.addKey('A'),
      right: kb.addKey('D'),
    };
    this.arrows = {
      up: kb.addKey('UP'),
      down: kb.addKey('DOWN'),
      left: kb.addKey('LEFT'),
      right: kb.addKey('RIGHT'),
    };
    this.pause1 = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.pause2 = kb.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    // 暂停检测独立于 GamePhase（PAUSED 态也须响应恢复键，P1/P2）
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.checkPause, this);
    // fresh keydown 清除「需重新按下」标记（按轴路由；恢复后 ≥50ms 生效，TASK-21 Bug1）
    const movementKeys: Array<{ key: Phaser.Input.Keyboard.Key; axis: MoveAxis }> = [
      { key: this.keys.up, axis: 'up' },
      { key: this.keys.down, axis: 'down' },
      { key: this.keys.left, axis: 'left' },
      { key: this.keys.right, axis: 'right' },
      { key: this.arrows.up, axis: 'up' },
      { key: this.arrows.down, axis: 'down' },
      { key: this.arrows.left, axis: 'left' },
      { key: this.arrows.right, axis: 'right' },
    ];
    for (const { key, axis } of movementKeys) {
      key.on(Phaser.Input.Keyboard.Events.DOWN, () => {
        this.restoreGuard.onKeyDown(axis, performance.now());
      });
    }
  }

  private checkPause(): void {
    if (!this.pauseCb) return;
    if (Phaser.Input.Keyboard.JustDown(this.pause1) || Phaser.Input.Keyboard.JustDown(this.pause2)) {
      this.pauseCb();
    }
  }

  getMove(): Vec2 {
    if (!this.enabled) return { x: 0, y: 0 };
    const held = this.currentDownState();
    // 恢复瞬间向量归零：仅「冻结前按住且仍按住」的键立即有效，其余待 fresh keydown（ux-spec §3 ②④）
    const effective: KeyState = {
      up: this.restoreGuard.isActive('up', held.up),
      down: this.restoreGuard.isActive('down', held.down),
      left: this.restoreGuard.isActive('left', held.left),
      right: this.restoreGuard.isActive('right', held.right),
    };
    return computeMoveVector(effective);
  }

  /** WASD + 方向键双映射 → 轴按下状态（供守卫快照/恢复判定） */
  private currentDownState(): AxisState {
    return {
      up: this.keys.up.isDown || this.arrows.up.isDown,
      down: this.keys.down.isDown || this.arrows.down.isDown,
      left: this.keys.left.isDown || this.arrows.left.isDown,
      right: this.keys.right.isDown || this.arrows.right.isDown,
    };
  }

  onPauseToggle(cb: () => void): void {
    this.pauseCb = cb;
  }

  onTap(_cb: (x: number, y: number) => void): void {
    // 桌面键盘无战斗内点按（ADR-002 仅预留接口）
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    const now = performance.now();
    if (enabled) {
      // 恢复：冻结前按住且仍按住的键立即重新激活（TASK-21 Bug1）；其余待 fresh keydown
      this.restoreGuard.restore(this.currentDownState(), now);
    } else {
      // 冻结（LEVEL_UP/PAUSED）：快照此刻仍按住的键
      this.restoreGuard.freeze(this.currentDownState(), now);
    }
  }

  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.checkPause, this);
  }
}
