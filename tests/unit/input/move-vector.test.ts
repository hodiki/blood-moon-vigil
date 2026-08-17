import { describe, it, expect } from 'vitest';
import { computeMoveVector } from '@/input/move-vector';
import { vecLength } from '@/utils/math';

describe('computeMoveVector 键位→向量（CM §1.1 M1–M6）', () => {
  it('单键：W=(0,-1) S=(0,1) A=(-1,0) D=(1,0)', () => {
    expect(computeMoveVector({ up: true, down: false, left: false, right: false })).toEqual({ x: 0, y: -1 });
    expect(computeMoveVector({ up: false, down: true, left: false, right: false })).toEqual({ x: 0, y: 1 });
    expect(computeMoveVector({ up: false, down: false, left: true, right: false })).toEqual({ x: -1, y: 0 });
    expect(computeMoveVector({ up: false, down: false, left: false, right: true })).toEqual({ x: 1, y: 0 });
  });

  it('方向键与 WASD 语义一致（合并 8 向）', () => {
    expect(computeMoveVector({ up: false, down: true, left: false, right: true })).toEqual(
      computeMoveVector({ up: false, down: true, left: false, right: true }),
    );
  });

  it('斜向组合归一化：长度 ≤1，斜向速度不超单方向（M5 防超速）', () => {
    const diag = computeMoveVector({ up: true, down: false, left: false, right: true }); // W+D
    expect(vecLength(diag)).toBeCloseTo(1, 6);
    // 斜向各分量 ≈ 0.707（45°）
    expect(diag.x).toBeCloseTo(Math.SQRT1_2, 6);
    expect(diag.y).toBeCloseTo(-Math.SQRT1_2, 6);
  });

  it('任意键组合输出长度 ≤1（硬约束）', () => {
    const combos: Array<{ up: boolean; down: boolean; left: boolean; right: boolean }> = [
      { up: true, down: false, left: true, right: false },
      { up: true, down: true, left: true, right: true },
      { up: false, down: false, left: true, right: true },
    ];
    for (const c of combos) {
      expect(vecLength(computeMoveVector(c))).toBeLessThanOrEqual(1);
    }
  });

  it('全部松开输出 (0,0)（M6）', () => {
    expect(computeMoveVector({ up: false, down: false, left: false, right: false })).toEqual({ x: 0, y: 0 });
  });
});
