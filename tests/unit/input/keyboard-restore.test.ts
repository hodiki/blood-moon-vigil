import { describe, it, expect } from 'vitest';
import {
  KeyboardRestoreGuard,
  MIN_ACTIVATE_MS,
  type AxisState,
} from '@/input/keyboard-restore';
import { computeMoveVector } from '@/input/move-vector';

/**
 * TASK-21 Bug1 回归：PC 端三选一后 WASD 移动失效。
 *
 * 用户真机反馈：选卡期间键盘冻结，恢复 RUNNING 要求 fresh keydown 才激活 →
 * 持续按住的 WASD 无法继续移动。
 * 期望：持续按住的键在选卡恢复时立即重新激活（仅选卡瞬间的事件需忽略），
 * 同时保留向量归零防瞬移（ux-spec §3 防误触 ②④）。
 */

function down(state: Partial<AxisState> = {}): AxisState {
  return { up: false, down: false, left: false, right: false, ...state };
}

describe('键盘恢复守卫（TASK-21 Bug1）', () => {
  it('选卡前按住 W → 选卡 → 恢复 → W 立即重新激活为移动输入（用户反馈场景）', () => {
    const guard = new KeyboardRestoreGuard();
    // 选卡开始：W 仍按住 → 快照
    guard.freeze(down({ up: true }), 1000);
    // 选卡结束恢复：W 仍按住 → 立即有效，无需 fresh keydown
    guard.restore(down({ up: true }), 2000);
    expect(guard.isActive('up', true)).toBe(true);
    expect(guard.isActive('down', false)).toBe(false);
    // 组合进移动向量：W 应输出 (0,-1)
    const move = computeMoveVector({
      up: guard.isActive('up', true),
      down: guard.isActive('down', false),
      left: guard.isActive('left', false),
      right: guard.isActive('right', false),
    });
    expect(move.x).toBe(0);
    expect(move.y).toBe(-1);
  });

  it('选卡期间松开并重按 W：恢复瞬间未按住 → 需恢复后 fresh keydown 才激活（防恢复瞬间瞬移）', () => {
    const guard = new KeyboardRestoreGuard();
    guard.freeze(down({ up: true }), 1000);
    // 恢复瞬间 W 已松开（选卡时松手点卡）→ 不立即激活，向量归零
    guard.restore(down(), 2000);
    expect(guard.isActive('up', true)).toBe(false); // 虽当前按住，但 pending
    expect(guard.isActive('up', false)).toBe(false);
  });

  it('fresh keydown 在恢复后 ≥50ms 才生效；选卡瞬间（<50ms）事件忽略', () => {
    const guard = new KeyboardRestoreGuard();
    guard.freeze(down(), 1000);
    guard.restore(down(), 2000);
    // 恢复后 20ms 的 keydown：选卡瞬间事件 → 忽略
    guard.onKeyDown('up', 2000 + 20);
    expect(guard.isActive('up', true)).toBe(false);
    // 恢复后 60ms 的 keydown：正常 fresh → 激活
    guard.onKeyDown('up', 2000 + 60);
    expect(guard.isActive('up', true)).toBe(true);
  });

  it('冻结期内的 keydown 不计为 fresh（restoreAt=0 期间忽略）', () => {
    const guard = new KeyboardRestoreGuard();
    guard.freeze(down(), 1000);
    // 冻结期玩家尝试按 W（移动已冻结）
    guard.onKeyDown('up', 1500);
    guard.restore(down(), 2000);
    // 该 keydown 发生于冻结期 → 不激活
    expect(guard.isActive('up', true)).toBe(false);
  });

  it('MIN_ACTIVATE_MS = 50（防误触最小间隔常量）', () => {
    expect(MIN_ACTIVATE_MS).toBe(50);
  });

  it('正常运行期（未经历 freeze→restore）：所有键直接有效，无恢复开销', () => {
    const guard = new KeyboardRestoreGuard();
    expect(guard.isActive('up', true)).toBe(true);
    expect(guard.isActive('left', true)).toBe(true);
  });

  it('暂停恢复同样适用：按住 W 过暂停 → 恢复后 W 立即移动（CM P4 冻结语义一致）', () => {
    const guard = new KeyboardRestoreGuard();
    guard.freeze(down({ left: true }), 1000); // 暂停前按住 ←
    guard.restore(down({ left: true }), 2000);
    expect(guard.isActive('left', true)).toBe(true);
    // 斜向组合：W + D 恢复时都按住 → 斜向移动立即生效
    const guard2 = new KeyboardRestoreGuard();
    guard2.freeze(down({ up: true, right: true }), 1000);
    guard2.restore(down({ up: true, right: true }), 2000);
    const move = computeMoveVector({
      up: guard2.isActive('up', true),
      down: guard2.isActive('down', false),
      left: guard2.isActive('left', false),
      right: guard2.isActive('right', true),
    });
    expect(Math.hypot(move.x, move.y)).toBeCloseTo(1, 6); // 归一化，斜向不超速（CM M5）
    expect(move.x).toBeCloseTo(Math.SQRT1_2, 6);
  });
});
