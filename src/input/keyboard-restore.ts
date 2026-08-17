/**
 * input/keyboard-restore.ts —— 键盘恢复守卫（纯逻辑，可脱离 Phaser 单测）
 *
 * TASK-21 Bug1：PC 端三选一后 WASD 移动失效。
 * 根因：旧实现恢复 RUNNING 时置 requiresFreshPress=true，必须等一次 fresh keydown
 * 才恢复移动 —— 但「选卡前就按住 W 并持续按住」的玩家不会产生新 keydown，移动永久失效。
 *
 * 修复语义（ux-spec §3 防误触 ②④ 的精确化）：
 * - freeze(选卡/暂停开始)：快照「此刻仍按住的移动键」heldAtFreeze。
 * - restore(恢复 RUNNING)：冻结前按住且恢复时仍按住的键 → 立即有效（UX 期望连续移动）；
 *   其余键 → 需一次「恢复后 ≥MIN_ACTIVATE_MS 的 fresh keydown」才激活（防选卡瞬间误触 / 防瞬移）。
 *
 * 约束（CM §1.1 / ux-spec §3）：
 * - 移动向量归零保护保留：未被快照覆盖的键在恢复瞬间不产生移动（防瞬移）。
 * - 仅选卡瞬间（冻结期 / 恢复后 50ms 内）的按键事件被忽略，其余正常响应。
 */

export interface AxisState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export type MoveAxis = keyof AxisState;

export const NONE_AXIS: AxisState = Object.freeze({ up: false, down: false, left: false, right: false });

/** fresh keydown 最小生效间隔（恢复 RUNNING 后 50ms 内的按键忽略，防选卡瞬间误触） */
export const MIN_ACTIVATE_MS = 50;

export class KeyboardRestoreGuard {
  private heldAtFreeze: AxisState = { ...NONE_AXIS };
  /** 恢复时刻（ms）；0 = 尚未恢复（正常运行期所有键直接有效） */
  private restoreAtMs = 0;
  /** 恢复后仍待 fresh keydown 的轴（= 冻结前未按住，或恢复瞬间未按住） */
  private pending: AxisState = { ...NONE_AXIS };

  /** 冻结开始（LEVEL_UP/PAUSED）：快照当前按住键 */
  freeze(currentlyDown: AxisState, _nowMs: number): void {
    this.heldAtFreeze = { ...currentlyDown };
    this.restoreAtMs = 0;
    this.pending = { ...NONE_AXIS };
  }

  /**
   * 恢复（RUNNING）：冻结前按住且当前仍按住的键立即激活；
   * 其余键置 pending，等待 fresh keydown（≥MIN_ACTIVATE_MS）清除。
   */
  restore(currentlyDown: AxisState, nowMs: number): void {
    this.restoreAtMs = nowMs;
    this.pending = {
      up: !(this.heldAtFreeze.up && currentlyDown.up),
      down: !(this.heldAtFreeze.down && currentlyDown.down),
      left: !(this.heldAtFreeze.left && currentlyDown.left),
      right: !(this.heldAtFreeze.right && currentlyDown.right),
    };
  }

  /** 记录一次 fresh keydown：仅恢复后 ≥MIN_ACTIVATE_MS 生效（冻结期 / 选卡瞬间忽略） */
  onKeyDown(axis: MoveAxis, nowMs: number): void {
    if (this.restoreAtMs <= 0) return; // 尚未经历 freeze→restore，正常运行期
    if (nowMs - this.restoreAtMs < MIN_ACTIVATE_MS) return; // 选卡瞬间防误触
    this.pending[axis] = false;
  }

  /** 该键当前是否应参与移动（需当前按住） */
  isActive(axis: MoveAxis, currentlyDown: boolean): boolean {
    return currentlyDown && !this.pending[axis];
  }
}
