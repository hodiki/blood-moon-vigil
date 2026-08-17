import { describe, it, expect } from 'vitest';
import {
  clampDelta,
  toSeconds,
  accumulate,
  DEFAULT_MAX_DELTA_MS,
  HARD_MAX_DELTA_MS,
} from '@/core/time';

describe('clampDelta（ARCH §3.5 防跳怪 / 极端掉帧保护）', () => {
  it('常规上限 50ms：clampDelta(80) = 0.05s', () => {
    expect(clampDelta(80)).toBe(0.05);
  });

  it('正常帧率不截断：clampDelta(16) ≈ 0.016s', () => {
    expect(clampDelta(16)).toBeCloseTo(0.016, 6);
  });

  it('帧间隔 >250ms 按 250ms 处理（硬上限 0.25s）', () => {
    expect(clampDelta(300)).toBe(0.25);
    expect(clampDelta(1000)).toBe(0.25);
  });

  it('帧间隔 =250ms 不触发硬上限（严格 >）', () => {
    expect(clampDelta(HARD_MAX_DELTA_MS)).toBe(DEFAULT_MAX_DELTA_MS / 1000);
  });

  it('非法输入返回 0（负数 / NaN / Infinity）', () => {
    expect(clampDelta(-1)).toBe(0);
    expect(clampDelta(Number.NaN)).toBe(0);
    expect(clampDelta(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('返回值为秒制（供秒制累加器，帧率解耦）', () => {
    expect(clampDelta(16)).toBe(toSeconds(16));
  });
});

describe('accumulate 秒制累加器', () => {
  it('累计达到阈值触发一次并自动扣减', () => {
    let acc = 0;
    let fired = 0;
    for (let i = 0; i < 10; i += 1) {
      if (accumulate(acc, 0.1, 0.3)) {
        fired += 1;
        acc = 0;
      } else {
        acc += 0.1;
      }
    }
    expect(fired).toBe(3); // 0.3s 阈值，0.1s 步进 → 第 3/6/9 次触发
  });

  it('阈值非正数恒触发（无冷却语义）', () => {
    expect(accumulate(0, 0.1, 0)).toBe(true);
  });
});
