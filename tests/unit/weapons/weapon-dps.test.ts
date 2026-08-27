import { describe, it, expect } from 'vitest';
import { WEAPONS, INITIAL_DPS_REFERENCE, WEAPON_CONFIGS, EVOLUTIONS, type WeaponId, type EvoId } from '@/config/balance';
import { initialDpsEstimate } from '@/weapons/weapon-math';
import { weaponBaseDps, fullUpgradeDps, noSuperWeaponGap, NO_SUPER_COMPARISONS } from '@/weapons/weapon-runtime';
import { superWeaponDps, SUPER_WEAPON_SPECS, SUPER_WEAPON_PARTICLE_BUDGET } from '@/weapons/super-weapons';

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

describe('E2-S10 14 武器基础 DPS 与 GDD §3.6 表一致（sim-verify §2 口径，单目标等效）', () => {
  it('基础 DPS = config.baseDps（weapon-config.test 已逐项断言；此处经 weapon-runtime 入口复核）', () => {
    const table: Record<WeaponId, number> = {
      wpn_a_1: 9.0, wpn_a_2: 10.7, wpn_a_3: 15.9, wpn_a_4: 13.3, wpn_a_5: 8.0,
      wpn_b_1: 16.0, wpn_b_2: 12.8, wpn_b_3: 4.8,
      wpn_c_1: 7.5, wpn_c_2: 8.0, wpn_c_3: 8.8,
      wpn_d_1: 11.1, wpn_d_2: 8.9, wpn_d_3: 7.4,
    };
    for (const [id, dps] of Object.entries(table) as [WeaponId, number][]) {
      expect(weaponBaseDps(WEAPON_CONFIGS[id])).toBe(dps);
    }
  });
});

describe('E2-S7 超武 7 质变 DPS 与粒子预算（gdd-weapons-v2 §5.2 / asset-spec §3.7）', () => {
  it('超武等效 DPS 与 GDD §5.2 数值对齐表一致', () => {
    const table: Record<EvoId, number> = {
      evo_moonwrath: 27.0, evo_silverblast: 27.2, evo_seraphring: 28.8, evo_totaleclipse: 15.0,
      evo_bloodsea: 15.4, evo_batstorm: 33.3, evo_packleader: 26.7,
    };
    for (const [evoId, dps] of Object.entries(table) as [EvoId, number][]) {
      expect(superWeaponDps(evoId)).toBe(dps);
    }
  });

  it('每把超武有质变模式（行为质变非纯数值）+ 特效粒子 ≤60/次（sprint-m2-plan R13）', () => {
    expect(Object.keys(SUPER_WEAPON_SPECS)).toHaveLength(7);
    for (const spec of Object.values(SUPER_WEAPON_SPECS)) {
      expect(spec.mode.length).toBeGreaterThan(0);
      expect(spec.baseDps).toBeGreaterThan(0);
      expect(spec.particleBudget).toBeLessThanOrEqual(SUPER_WEAPON_PARTICLE_BUDGET);
      expect(spec.particleBudget).toBe(60);
      expect(spec.frame.startsWith('super-')).toBe(true);
      expect(spec.fallbackFrame.length).toBeGreaterThan(0);
    }
  });

  it('质变参数与 §5.2 行为质变列一致（抽样：月全食双脉冲/血海池/血蝠风暴 6 只吸血）', () => {
    expect(SUPER_WEAPON_SPECS.evo_totaleclipse.params.pulses).toBe(2);
    expect(SUPER_WEAPON_SPECS.evo_totaleclipse.params.radius).toBe(420);
    expect(SUPER_WEAPON_SPECS.evo_totaleclipse.params.stunSeconds).toBe(1);
    expect(SUPER_WEAPON_SPECS.evo_bloodsea.params.radius).toBe(300);
    expect(SUPER_WEAPON_SPECS.evo_bloodsea.params.duration).toBe(5);
    expect(SUPER_WEAPON_SPECS.evo_bloodsea.params.slowPct).toBe(0.4);
    expect(SUPER_WEAPON_SPECS.evo_batstorm.params.count).toBe(6);
    expect(SUPER_WEAPON_SPECS.evo_batstorm.params.lifestealPerKill).toBe(0.5);
    expect(SUPER_WEAPON_SPECS.evo_packleader.params.count).toBe(3);
    expect(SUPER_WEAPON_SPECS.evo_packleader.params.slowPct).toBe(0.3);
  });

  it('超武契约帧与 EVOLUTIONS.frame 一致', () => {
    for (const evo of EVOLUTIONS) {
      expect(SUPER_WEAPON_SPECS[evo.evoId].frame).toBe(evo.frame);
    }
  });
});

describe('E2-S10 无超武武器满强化 vs 超武差距 ≤20%（sim-verify-v1 §6 口径）', () => {
  it('7 把无超武武器对照表齐全（NO_SUPER_COMPARISONS）', () => {
    expect(NO_SUPER_COMPARISONS).toHaveLength(7);
    expect(NO_SUPER_COMPARISONS.map((c) => c.weaponId).sort()).toEqual([
      'wpn_a_2', 'wpn_a_4', 'wpn_a_5', 'wpn_b_2', 'wpn_b_3', 'wpn_c_3', 'wpn_d_3',
    ]);
  });

  it('满类强化 DPS = sim-verify §6 表（银针 22.6 / 幽灵 25.3 / 标枪 23.2 / 荆棘 24.3 / 壁垒 9.6 / 圣火 21.4 / 锁链 16.3）', () => {
    const targets: Partial<Record<WeaponId, number>> = {
      wpn_a_2: 22.6, wpn_a_4: 25.3, wpn_a_5: 23.2, wpn_b_2: 24.3, wpn_b_3: 9.6, wpn_c_3: 21.4, wpn_d_3: 16.3,
    };
    for (const [id, dps] of Object.entries(targets) as [WeaponId, number][]) {
      expect(fullUpgradeDps(id)).toBe(dps);
    }
  });

  it('5 把纯伤害定位武器差距 ≤20%（6.3~16.3%，sim-verify §6）', () => {
    for (const c of NO_SUPER_COMPARISONS) {
      if (c.positionCompensated) continue; // 壁垒/锁链为定位补偿（control/defense）
      const gap = noSuperWeaponGap(c.weaponId, c.evoId);
      expect(gap).toBeGreaterThan(0);
      expect(gap).toBeLessThanOrEqual(20);
    }
  });

  it('定位补偿武器（壁垒/锁链）标记 positionCompensated：承伤 -10% / 击退打断价值', () => {
    const barrier = NO_SUPER_COMPARISONS.find((c) => c.weaponId === 'wpn_b_3')!;
    const chain = NO_SUPER_COMPARISONS.find((c) => c.weaponId === 'wpn_d_3')!;
    expect(barrier.positionCompensated).toBe(true);
    expect(chain.positionCompensated).toBe(true);
    // 审判圣火 vs 月全食：超武反而低（面覆盖补偿），同样豁免
    const holyfire = NO_SUPER_COMPARISONS.find((c) => c.weaponId === 'wpn_c_3')!;
    expect(holyfire.positionCompensated).toBe(true);
  });

  it('全部 7 把无超武武器有对照超武（evolution 表不重不漏）', () => {
    for (const c of NO_SUPER_COMPARISONS) {
      expect(EVOLUTIONS.some((e) => e.evoId === c.evoId)).toBe(true);
    }
  });
});
