/**
 * tests/unit/weapons/loadout.test.ts —— 专武装配汇聚（NV-INTEG-FIX ③ 回归）
 *
 * 修复点：EXCLUSIVE_TO_DERIVATIVE 键 = 选中者（§4.8「选择 X → 落选 Y → 技 = Y 的衍生技」），
 * 原 computeLoadout/derivativeForChoice 先取 rejected 再查表属二次转换 → 返回选中者自己的技形态。
 */
import { describe, it, expect } from 'vitest';
import { computeLoadout, derivativeForChoice, rejectedExclusive } from '@/weapons/loadout';
import { EXCLUSIVE_TO_DERIVATIVE, HERO_EXCLUSIVE_PAIRS, DERIVATIVE_SKILLS } from '@/config/balance';

describe('loadout 专武装配（NV-INTEG-FIX ③）', () => {
  it('computeLoadout：衍生技 = 落选专武的技形态（选提灯 → 左轮技）', () => {
    const r = computeLoadout('hero_edmund', 'xw_lantern', 'wpn_a_1');
    expect(r).not.toBeNull();
    expect(r!.exclusiveId).toBe('xw_lantern');
    expect(r!.rejectedId).toBe('xw_revolver');
    expect(r!.derivativeId).toBe('dv_revolver_burst'); // 左轮技（落选转化），非提灯技
    expect(r!.enabledWeaponIds).toEqual(['wpn_a_1']);
  });

  it('derivativeForChoice：反向选择对称（选左轮 → 提灯技）', () => {
    expect(derivativeForChoice('hero_edmund', 'xw_revolver')).toBe('dv_lantern_flash');
    expect(derivativeForChoice('hero_cassandra', 'xw_twinblades')).toBe('dv_moon_snipe');
  });

  it('映射表全对一致性：每对选择 ×2 → 技来源 = 落选专武（sourceExclusiveId 校验）', () => {
    for (const [heroId, pair] of Object.entries(HERO_EXCLUSIVE_PAIRS)) {
      for (const chosen of pair) {
        const derivative = EXCLUSIVE_TO_DERIVATIVE[chosen];
        const rejected = rejectedExclusive(heroId, chosen);
        expect(rejected).not.toBeNull();
        expect(DERIVATIVE_SKILLS[derivative].sourceExclusiveId).toBe(rejected);
      }
    }
  });

  it('rejectedExclusive / 非法组合', () => {
    expect(rejectedExclusive('hero_violet', 'xw_bell')).toBe('xw_cross');
    expect(computeLoadout('hero_edmund', 'xw_bell', 'wpn_a_1')).toBeNull(); // 跨角色组合拒绝
    expect(derivativeForChoice('hero_edmund', 'xw_bell')).toBeNull();
  });
});
