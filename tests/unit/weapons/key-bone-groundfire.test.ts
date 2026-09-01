/**
 * P2-5 · key_bone 兽骨图腾语义修正（GDD R-6 FQ-3 定稿）
 *
 * 旧语义「召唤存在 +20%」退役（EG-2 归档）；新语义「地面圣火（R-6 审判余焰）时长 +20%」：
 * 持 key_bone 时余焰 duration ×1.2（3s → 3.6s），空钥恒等 3s。
 */

import { describe, it, expect } from 'vitest';
import { UpgradeState } from '@/upgrade/upgrade-pool';
import { deriveKeyPassives } from '@/upgrade/upgrade-apply-v2';
import {
  createResonanceCrossState,
  onResonanceCrossExplode,
  stepResonanceResidues,
} from '@/weapons/resonance/resonance-math';
import { resonancePairById } from '@/config/balance';

const MACHINE = resonancePairById('R6')!.machine;

function keyBoneMult(): number {
  const state = new UpgradeState();
  state.addStack('key_bone', 1);
  return deriveKeyPassives(state).groundFireDurationMult;
}

describe('P2-5 key_bone → groundFireDurationMult（余焰 duration ×1.2）', () => {
  it('持 key_bone：派生 groundFireDurationMult = 1.2（旧召唤寿命字段退役）', () => {
    expect(keyBoneMult()).toBe(1.2);
  });

  it('余焰登记：持 key_bone 时 until = now + 3 × 1.2 = 3.6s（R-6 residues 路径）', () => {
    const state = createResonanceCrossState();
    onResonanceCrossExplode(state, 10, 10, 100, MACHINE, keyBoneMult());
    expect(state.residues).toHaveLength(1);
    expect(state.residues[0]!.until).toBeCloseTo(103.6, 6);
  });

  it('空钥恒等：until = now + 3s（默认形态零变化）', () => {
    const state = createResonanceCrossState();
    onResonanceCrossExplode(state, 10, 10, 100, MACHINE);
    expect(state.residues[0]!.until).toBeCloseTo(103, 6);
  });

  it('加长后余焰在 3s ~ 3.6s 区间仍生效（8 伤/s 独立段随 durationMult 延长）', () => {
    const state = createResonanceCrossState();
    onResonanceCrossExplode(state, 0, 0, 0, MACHINE, 1.2);
    const enemy = { active: true, hp: 100, maxHp: 100, x: 0, y: 0, radius: 12, kill: () => {} };
    // t=3.2s：旧实现（until=3）已过期；新实现仍烧
    const r = stepResonanceResidues(state, 0.1, 3.2, [enemy], 1, MACHINE);
    expect(r.damageDealt).toBeCloseTo(0.8, 6); // 8 × 0.1
    // t=3.7s：新实现也过期
    const r2 = stepResonanceResidues(state, 0.1, 3.7, [enemy], 1, MACHINE);
    expect(r2.damageDealt).toBe(0);
    expect(state.residues).toHaveLength(0);
  });
});
