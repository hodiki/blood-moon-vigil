import { describe, it, expect } from 'vitest';
import { burstVectors, ringParticles, capBurstCount } from '@/fx/fx-math';

describe('fx-math 粒子数学（TASK-28 美术表现力专项）', () => {
  it('burstVectors 确定性：同 seed 同输出、count 一致、单位长度 ≈1', () => {
    const a = burstVectors(16, 42);
    const b = burstVectors(16, 42);
    expect(a).toEqual(b);
    expect(a).toHaveLength(16);
    for (const v of a) {
      expect(Math.hypot(v.x, v.y)).toBeCloseTo(1, 6);
    }
  });

  it('burstVectors 不同 seed 输出不同（多样性）', () => {
    expect(burstVectors(8, 1)).not.toEqual(burstVectors(8, 2));
  });

  it('ringParticles 均匀分布在半径圆周上（冲击波涟漪/Boss 出场环）', () => {
    const r = ringParticles(8, 100);
    expect(r).toHaveLength(8);
    for (const v of r) {
      expect(Math.hypot(v.x, v.y)).toBeCloseTo(100, 6);
    }
  });

  it('ringParticles count=0 安全返回空数组', () => {
    expect(ringParticles(0, 50)).toEqual([]);
  });

  it('capBurstCount：不超池空闲数、非正输入安全', () => {
    expect(capBurstCount(16, 5)).toBe(5);
    expect(capBurstCount(3, 10)).toBe(3);
    expect(capBurstCount(0, 5)).toBe(0);
    expect(capBurstCount(5, 0)).toBe(0);
  });
});
