import { describe, it, expect } from 'vitest';
import { WEAPON_CONFIGS } from '@/config/balance';
import {
  deriveProjectileParams,
  deriveOrbitParams,
  deriveGroundAreaParams,
  deriveSummonParams,
  applyKeyPassivesToProjectile,
  applyKeyPassivesToOrbit,
  applyKeyPassivesToGround,
  applyKeyPassivesToSummon,
} from '@/weapons/weapon-runtime';
import {
  emptyKeyPassiveState,
  deriveKeyPassives,
  type KeyPassiveState,
} from '@/upgrade/upgrade-apply-v2';
import { UpgradeState } from '@/upgrade/upgrade-pool';
import { emptyClassUpgradeStacks, addClassUpgrade } from '@/weapons/class-upgrades';

/** 全 7 钥同时持有的派生状态（setKeyPassives 全量生效口径） */
function fullKeys(): KeyPassiveState {
  const state = new UpgradeState();
  for (const k of ['key_scope', 'key_holy', 'key_tome', 'key_silver', 'key_pact', 'key_bone', 'key_grail'] as const) {
    state.addStack(k, 1);
  }
  return deriveKeyPassives(state);
}

describe('E4-S4 被动钥 7 项数值效果（content-design-outline §6.4 / gdd-upgrade-pool-v2 §3.4）', () => {
  it('deriveKeyPassives：全 7 钥 → 射程 1.15 / 范围 1.15 / 冷却 0.9 / 伤害 1.12 / 召唤 +1 / 地面火 1.2 / 持续 1.25', () => {
    const k = fullKeys();
    expect(k.rangeMult).toBe(1.15);        // key_scope
    expect(k.areaRadiusMult).toBe(1.15);   // key_holy
    expect(k.cooldownMult).toBe(0.9);      // key_tome
    expect(k.damageMult).toBe(1.12);       // key_silver
    expect(k.summonCountBonus).toBe(1);    // key_pact
    expect(k.groundFireDurationMult).toBe(1.2); // key_bone（P2-5：GDD R-6 FQ-3 地面火时长）
    expect(k.areaDurationMult).toBe(1.25); // key_grail
  });

  it('空钥状态恒等：全乘区 1 / 加成 0（不改变派生参数）', () => {
    const k = emptyKeyPassiveState();
    expect(k.rangeMult).toBe(1);
    expect(k.areaRadiusMult).toBe(1);
    expect(k.cooldownMult).toBe(1);
    expect(k.damageMult).toBe(1);
    expect(k.summonCountBonus).toBe(0);
    expect(k.groundFireDurationMult).toBe(1);
    expect(k.areaDurationMult).toBe(1);
  });
});

describe('A 类钥被动派生（key_scope/key_tome/key_silver，gdd §3.4）', () => {
  it('银针连弩：射程 400→460 / 冷却 0.45→0.405 / 伤害 8→8.96 / 寿命 ×1.15', () => {
    const base = deriveProjectileParams(WEAPON_CONFIGS.wpn_a_2, emptyClassUpgradeStacks());
    const p = applyKeyPassivesToProjectile(base, fullKeys());
    expect(p.range).toBeCloseTo(460, 6);        // 400 × 1.15
    expect(p.cooldown).toBeCloseTo(0.405, 6);   // 0.45 × 0.9
    expect(p.damage).toBeCloseTo(8.96, 6);      // 8 × 1.12
    expect(p.lifetime).toBeCloseTo(1.2 * 1.15, 6);
    // 未受钥影响的字段保持不变（maxActive/pierce 等）
    expect(p.maxActive).toBe(6);
    expect(p.pierce).toBe(1);
  });

  it('key_tome 与类强化/专精疾射独立乘区：总冷却 = 基础 × 类强化 × key × focused（乘法叠加）', () => {
    const stacks = addClassUpgrade(addClassUpgrade(emptyClassUpgradeStacks(), 'a1'), 'a1'); // 类强化（无冷却项，验证不冲突）
    const base = deriveProjectileParams(WEAPON_CONFIGS.wpn_a_2, stacks);
    const p = applyKeyPassivesToProjectile(base, fullKeys());
    const focusedMult = 0.88; // up_g_2 专精疾射 ×0.88（独立乘区示例）
    const total = p.cooldown * focusedMult;
    expect(total).toBeCloseTo(0.45 * 0.9 * 0.88, 6); // 基础 × key_tome × focused，互不覆盖
  });
});

describe('B 类钥被动派生（key_holy/key_silver，gdd §3.4）', () => {
  it('守夜之环：半径 80→92 / 伤害 8→8.96（环绕无冷却，冷却乘区不参与）', () => {
    const base = deriveOrbitParams(WEAPON_CONFIGS.wpn_b_1, emptyClassUpgradeStacks());
    const o = applyKeyPassivesToOrbit(base, fullKeys());
    expect(o.radius).toBeCloseTo(92, 6);     // 80 × 1.15
    expect(o.damage).toBeCloseTo(8.96, 6);   // 8 × 1.12
    expect(o.count).toBe(3);                 // 不受钥影响
  });

  it('圣光壁垒：光环半径 120→138 / auraDps 6→6.72 / 伤害 ×1.12', () => {
    const base = deriveOrbitParams(WEAPON_CONFIGS.wpn_b_3, emptyClassUpgradeStacks());
    const o = applyKeyPassivesToOrbit(base, fullKeys());
    expect(o.auraRadius).toBeCloseTo(138, 6);     // 120 × 1.15
    expect(o.auraDps).toBeCloseTo(6.72, 6);       // 6 × 1.12
    expect(o.damageReduction).toBe(0.1);          // 减伤不受钥影响
  });
});

describe('C 类钥被动派生（key_holy/key_grail/key_tome/key_silver，gdd §3.4）', () => {
  it('血池喷涌：半径 180→207 / 持续 3→3.75 / 冷却 6→5.4 / 伤害 20→22.4', () => {
    const base = deriveGroundAreaParams(WEAPON_CONFIGS.wpn_c_2, emptyClassUpgradeStacks());
    const g = applyKeyPassivesToGround(base, fullKeys());
    expect(g.radius).toBeCloseTo(207, 6);        // 180 × 1.15
    expect(g.duration).toBeCloseTo(3.75, 6);     // 3 × 1.25
    expect(g.cooldown).toBeCloseTo(5.4, 6);      // 6 × 0.9
    expect(g.damagePerSec).toBeCloseTo(22.4, 6); // 20 × 1.12
    expect(g.slowPct).toBe(0.2);                 // 减速不受钥影响
  });

  it('C 类钥被动与类强化乘法叠加：C1 范围 ×1.25 后再乘 key_holy ×1.15', () => {
    const stacks = addClassUpgrade(emptyClassUpgradeStacks(), 'c1');
    const base = deriveGroundAreaParams(WEAPON_CONFIGS.wpn_c_2, stacks);
    const g = applyKeyPassivesToGround(base, fullKeys());
    expect(g.radius).toBeCloseTo(180 * 1.25 * 1.15, 6); // 类强化与钥乘区互不覆盖
  });
});

describe('D 类钥被动派生（key_pact/key_bone/key_silver/key_tome，gdd §3.4）', () => {
  it('血蝠群：召唤 2→3 / 伤害 6→6.72 / 攻击节拍 0.5→0.45（P2-5：存在不再吃 key_bone，保持 12）', () => {
    const base = deriveSummonParams(WEAPON_CONFIGS.wpn_d_1, emptyClassUpgradeStacks());
    const s = applyKeyPassivesToSummon(base, fullKeys());
    expect(s.count).toBe(3);               // 2 + 1（key_pact）
    expect(s.lifetime).toBeCloseTo(12, 6); // P2-5：key_bone 旧召唤寿命乘区退役 → 12 原值
    expect(s.damage).toBeCloseTo(6.72, 6);   // 6 × 1.12（key_silver）
    expect(s.attackInterval).toBeCloseTo(0.45, 6); // 0.5 × 0.9（key_tome）
    expect(s.respawnCd).toBe(5);           // 重召间隔不受钥影响
  });

  it('召唤数上限 6：血蝠 2 + key_pact + D1×2 = 5（≤6）；狼影猎犬 1 + 1 = 2', () => {
    let stacks = emptyClassUpgradeStacks();
    stacks = addClassUpgrade(addClassUpgrade(stacks, 'd1'), 'd1');
    const base = deriveSummonParams(WEAPON_CONFIGS.wpn_d_1, stacks);
    const s = applyKeyPassivesToSummon(base, fullKeys());
    expect(s.count).toBe(5);
    expect(s.count).toBeLessThanOrEqual(6);
  });
});
