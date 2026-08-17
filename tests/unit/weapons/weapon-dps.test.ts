import { describe, it, expect } from 'vitest';
import { WEAPONS, INITIAL_DPS_REFERENCE } from '@/config/balance';
import { initialDpsEstimate } from '@/weapons/weapon-math';

describe('武器初始 DPS 参考（weapons §③：10 + 16 + 7.5 ≈ 33.5）', () => {
  it('飞弹 DPS = 12/1.2 = 10', () => {
    expect(WEAPONS.MISSILE.DAMAGE / WEAPONS.MISSILE.COOLDOWN).toBeCloseTo(10, 6);
  });

  it('冲击波 DPS = 60/8 = 7.5', () => {
    expect(WEAPONS.SHOCKWAVE.DAMAGE / WEAPONS.SHOCKWAVE.COOLDOWN).toBeCloseTo(7.5, 6);
  });

  it('三武器全开初始 DPS ≈ 33.5（环绕球 ~16 按 60% 命中率，GDD 启发式）', () => {
    expect(initialDpsEstimate()).toBeCloseTo(INITIAL_DPS_REFERENCE, 6);
    expect(INITIAL_DPS_REFERENCE).toBe(33.5);
  });

  it('E3 门控说明：初始武器为自动飞弹，实际开局 DPS = 10（守夜之环/月蚀脉冲由升级 1/2 解锁）', () => {
    // upgrade-pool §③「初始武器为自动飞弹」；33.5 为三武器全开静态参考，非开局实际值。
    expect(WEAPONS.MISSILE.DAMAGE / WEAPONS.MISSILE.COOLDOWN).toBeCloseTo(10, 6);
  });
});
