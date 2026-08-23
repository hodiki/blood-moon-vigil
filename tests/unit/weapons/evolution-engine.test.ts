import { describe, it, expect } from 'vitest';
import { EVOLUTIONS, UPGRADE_POOL_RULES } from '@/config/balance';
import {
  evolutionEligibility,
  evolutionCardWeight,
  findEvolutionForWeapon,
  findEvolutionForKey,
  eligibilityForWeapon,
  createEvolutionResult,
  EvolutionState,
  EVOLUTION_MIN_CLASS_STACKS,
} from '@/weapons/evolution-engine';

/**
 * E2-S6 超武合成规则引擎（gdd-weapons-v2 §5.1；M3-DESIGN-1 进化前置）：
 * 条件 1 类成型累计 ≥2 次 + 条件 2 持钥 → 进化卡入三选一（权重 ×5，P1 必占一席）；不可逆；
 * 进化瞬间清旧弹体（原子切换）；超武不再吃类强化。
 */
describe('超武合成条件（E2-S6 / gdd-weapons-v2 §5.1）', () => {
  it('条件 1 阈值 = 类成型累计 ≥2 次（任意分支组合；M3-DESIGN-1 3→2）', () => {
    expect(EVOLUTION_MIN_CLASS_STACKS).toBe(2);
  });

  it('不满足：类强化不足（<2）即使持钥 → 不出现（no-class-stacks）', () => {
    const r = evolutionEligibility({ classStacks: 1, hasKey: true });
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe('no-class-stacks');
    expect(r.weight).toBe(0);
  });

  it('不满足：无钥即使类成型 2 → 不出现（no-key）', () => {
    const r = evolutionEligibility({ classStacks: 2, hasKey: false });
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe('no-key');
    expect(r.weight).toBe(0);
  });

  it('满足：类成型 2 + 持钥 → 进化卡入池，权重 ×5', () => {
    const r = evolutionEligibility({ classStacks: 2, hasKey: true });
    expect(r.eligible).toBe(true);
    expect(r.reason).toBe('eligible');
    expect(r.weight).toBe(5);
    expect(evolutionCardWeight()).toBe(UPGRADE_POOL_RULES.WEIGHT_EVOLUTION);
    expect(evolutionCardWeight()).toBe(5);
  });

  it('边界：类强化 2 次恰好满足（≥2）；3/4/6 次同样满足', () => {
    expect(evolutionEligibility({ classStacks: 2, hasKey: true }).eligible).toBe(true);
    expect(evolutionEligibility({ classStacks: 3, hasKey: true }).eligible).toBe(true);
    expect(evolutionEligibility({ classStacks: 4, hasKey: true }).eligible).toBe(true);
    expect(evolutionEligibility({ classStacks: 6, hasKey: true }).eligible).toBe(true);
  });
});

describe('进化映射（weapon_evolution { wpnId, keyId, evoId }）', () => {
  it('7 条映射齐全：主武器 / 钥 / 超武一一对应（gdd-weapons-v2 §5.2）', () => {
    const expectMap = {
      wpn_a_1: { keyId: 'key_scope', evoId: 'evo_moonwrath' },
      wpn_a_3: { keyId: 'key_silver', evoId: 'evo_silverblast' },
      wpn_b_1: { keyId: 'key_holy', evoId: 'evo_seraphring' },
      wpn_c_1: { keyId: 'key_tome', evoId: 'evo_totaleclipse' },
      wpn_c_2: { keyId: 'key_grail', evoId: 'evo_bloodsea' },
      wpn_d_1: { keyId: 'key_pact', evoId: 'evo_batstorm' },
      wpn_d_2: { keyId: 'key_bone', evoId: 'evo_packleader' },
    } as const;
    for (const [wpnId, expected] of Object.entries(expectMap) as [string, { keyId: string; evoId: string }][]) {
      const evo = findEvolutionForWeapon(wpnId as never);
      expect(evo).not.toBeNull();
      expect(evo!.keyId).toBe(expected.keyId);
      expect(evo!.evoId).toBe(expected.evoId);
      const byKey = findEvolutionForKey(expected.keyId as never);
      expect(byKey?.wpnId).toBe(wpnId);
    }
  });

  it('无超武武器（7 把）无进化映射 → eligibilityForWeapon 返回 no-evolution', () => {
    const state = { classStacksFor: () => 3, hasKeyFor: () => true }; // 即便条件全满足
    for (const wpnId of ['wpn_a_2', 'wpn_a_4', 'wpn_a_5', 'wpn_b_2', 'wpn_b_3', 'wpn_c_3', 'wpn_d_3'] as const) {
      const r = eligibilityForWeapon(wpnId, state);
      expect(r.eligible).toBe(false);
      expect(r.reason).toBe('no-evolution');
    }
  });

  it('eligibilityForWeapon 汇总：满足条件的主武器返回 eligible（权重 ×5）', () => {
    const state = { classStacksFor: (w: string) => (w === 'wpn_a_1' ? 2 : 0), hasKeyFor: (w: string) => w === 'wpn_a_1' };
    const r = eligibilityForWeapon('wpn_a_1', state);
    expect(r.eligible).toBe(true);
    expect(r.weight).toBe(5);
  });
});

describe('进化原子性与不可逆（E2-S6 / gdd-weapons-v2 §5.1）', () => {
  it('createEvolutionResult：清旧弹体 + 不吃类强化', () => {
    const r = createEvolutionResult('wpn_a_1', 'evo_moonwrath');
    expect(r.from).toBe('wpn_a_1');
    expect(r.to).toBe('evo_moonwrath');
    expect(r.clearedProjectiles).toBe(true); // 进化瞬间清空旧弹体
    expect(r.ignoresClassUpgrades).toBe(true); // 超武不再吃类强化
  });

  it('EvolutionState 提交进化：不可逆（重复提交幂等 false）；已进化查询', () => {
    const es = new EvolutionState();
    expect(es.isEvolved('wpn_a_1')).toBe(false);
    expect(es.commit('wpn_a_1', 'evo_moonwrath')).toBe(true);
    expect(es.isEvolved('wpn_a_1')).toBe(true);
    expect(es.evoOf('wpn_a_1')).toBe('evo_moonwrath');
    expect(es.commit('wpn_a_1', 'evo_moonwrath')).toBe(false); // 不可逆
  });
});

describe('进化卡权重（gdd-weapons-v2 §5.1 / upgrade-pool-v2 §3.6.3）', () => {
  it('权重常量 ×5（M3-DESIGN-1 3→5）与升级池规则一致', () => {
    expect(UPGRADE_POOL_RULES.WEIGHT_EVOLUTION).toBe(5);
    expect(evolutionCardWeight()).toBe(UPGRADE_POOL_RULES.WEIGHT_EVOLUTION);
  });

  it('超武表 7 条与进化映射一一对应（不重不漏）', () => {
    expect(EVOLUTIONS).toHaveLength(7);
    expect(EVOLUTIONS.map((e) => e.wpnId).sort()).toEqual([
      'wpn_a_1', 'wpn_a_3', 'wpn_b_1', 'wpn_c_1', 'wpn_c_2', 'wpn_d_1', 'wpn_d_2',
    ]);
  });
});
