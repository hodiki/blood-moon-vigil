/**
 * P2-7 · 状态微标三态 + Boss 免疫飘字
 *
 * ① 敌怪头顶状态微标：statusDotsFor（queryStatus 消费者）——施加 CC 后出现 / 过期消失 / 三态共存；
 *    同屏上限 STATUS_DOTS_MAX（预算写明：48 Image，超限零 draw call）。
 * ② Boss 免疫飘字：applyStatusWithImmuneFeedback（Boss 硬控免疫 reason='immune' → StatusImmune 事件）
 *    + FloatTextLayer 节流纯函数 immuneFloatAllowed（同目标 1.2s 内 1 条）。
 */

import { describe, it, expect, afterEach } from 'vitest';
import { emptyStatusState, applyStatus, tickStatuses, type StatusState } from '@/combat/status/status-engine';
import { GameEvents, GameEvent, resetGameEvents } from '@/core/events';
import { applyStatusWithImmuneFeedback } from '@/combat/status/immune-feedback';
import { statusDotsFor, STATUS_DOTS_MAX } from '@/fx/status-dots';
import { immuneFloatAllowed, IMMUNE_FLOAT_THROTTLE_SECONDS } from '@/fx/float-text';

function bossStun(state: StatusState, now: number, target: { x: number; y: number }) {
  return applyStatusWithImmuneFeedback(
    state,
    { kind: 'stun', value: 1, durationSeconds: 1, source: 'test' },
    now,
    target,
    { tier: 'boss' },
  );
}

afterEach(() => resetGameEvents());

describe('P2-7① 敌怪头顶状态微标（statusDotsFor 三态）', () => {
  it('施加眩晕后微标出现；过期（tickStatuses）后消失', () => {
    const state = emptyStatusState();
    expect(statusDotsFor(state, 10)).toHaveLength(0);
    const r = applyStatus(state, { kind: 'stun', value: 1, durationSeconds: 1, source: 'test' }, 10);
    const cc = r.state;
    expect(statusDotsFor(cc, 10.5)).toHaveLength(1);
    expect(statusDotsFor(cc, 10.5)[0]!.frame).toBe('marker-stun');
    // 过期清除 → 微标消失
    tickStatuses(cc, 11.5);
    expect(statusDotsFor(cc, 11.5)).toHaveLength(0);
  });

  it('减速/易伤微标对应 marker-slow / marker-mark；三态共存 3 点', () => {
    let cc = emptyStatusState();
    cc = applyStatus(cc, { kind: 'stun', value: 1, durationSeconds: 2, source: 'a' }, 0).state;
    cc = applyStatus(cc, { kind: 'slow', value: 0.2, durationSeconds: 2, source: 'b' }, 0).state;
    cc = applyStatus(cc, { kind: 'vulnerable', value: 0.15, durationSeconds: 2, source: 'c' }, 0).state;
    const dots = statusDotsFor(cc, 1);
    expect(dots).toHaveLength(3);
    expect(dots.map((d) => d.frame)).toEqual(['marker-stun', 'marker-slow', 'marker-mark']);
  });

  it('未接状态载荷（null/undefined）不崩溃且无微标；同屏上限常量已写明（48）', () => {
    expect(statusDotsFor(null, 0)).toHaveLength(0);
    expect(statusDotsFor(undefined, 0)).toHaveLength(0);
    expect(STATUS_DOTS_MAX).toBe(48);
  });
});

describe('P2-7② Boss 免疫飘字（StatusImmune 事件 + 节流）', () => {
  it('硬控命中 Boss：applyStatus reason=immune → 广播 StatusImmune（含坐标）', () => {
    const events: Array<{ x: number; y: number; now: number }> = [];
    GameEvents.on(GameEvent.StatusImmune, (args) => events.push(args as { x: number; y: number; now: number }));
    const r = bossStun(emptyStatusState(), 5, { x: 100, y: 200 });
    expect(r.reason).toBe('immune');
    expect(events).toEqual([{ x: 100, y: 200, now: 5 }]);
  });

  it('普通敌眩晕生效 / 软控免疫 / 非免疫拒绝路径 → 不广播', () => {
    const events: unknown[] = [];
    GameEvents.on(GameEvent.StatusImmune, (args) => events.push(args));
    // 普通敌：applied
    const applied = applyStatusWithImmuneFeedback(
      emptyStatusState(),
      { kind: 'stun', value: 1, durationSeconds: 1, source: 'test' },
      5,
      { x: 0, y: 0 },
    );
    expect(applied.reason).toBe('applied');
    expect(events).toHaveLength(0);
    // Boss 软控（slow 生效，不免疫）不广播
    applyStatusWithImmuneFeedback(
      emptyStatusState(),
      { kind: 'slow', value: 0.2, durationSeconds: 2, source: 'test' },
      5,
      { x: 0, y: 0 },
      { tier: 'boss' },
    );
    expect(events).toHaveLength(0);
    // ICD 拦截（非免疫）不广播
    let cc = applyStatus(emptyStatusState(), { kind: 'stun', value: 1, durationSeconds: 1, source: 'a' }, 0).state;
    const icd = applyStatusWithImmuneFeedback(cc, { kind: 'stun', value: 1, durationSeconds: 1, source: 'b' }, 1, { x: 0, y: 0 });
    expect(icd.reason).toBe('icd');
    expect(events).toHaveLength(0);
  });

  it('immuneFloatAllowed 节流：首条放行 / 同目标 1.2s 内拒绝 / 窗口外或不同目标放行', () => {
    expect(immuneFloatAllowed(null, 0, 0, 10)).toBe(true);
    const last = { x: 100, y: 100, at: 10 };
    // 同目标（位移 30px ≤ 80）窗口内 → 拒绝
    expect(immuneFloatAllowed(last, 130, 100, 10 + IMMUNE_FLOAT_THROTTLE_SECONDS - 0.1)).toBe(false);
    // 窗口外 → 放行
    expect(immuneFloatAllowed(last, 130, 100, 10 + IMMUNE_FLOAT_THROTTLE_SECONDS + 0.1)).toBe(true);
    // 窗口内但不同目标（位移 > 80）→ 放行
    expect(immuneFloatAllowed(last, 100, 300, 10.5)).toBe(true);
  });
});
