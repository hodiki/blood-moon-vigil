import { describe, it, expect } from 'vitest';
import {
  AFFIXES,
  AFFIX_RULES,
  rollAffix,
  corruptHealMultFor,
  type AffixId,
} from '@/config/balance';
import { ENEMY_CONFIGS } from '@/config/balance';

/** W-6 / MN-4 精英词缀（gdd-enemies-v3 §③-5：3 词缀 + 单词缀 + 方阵互斥 + 180s） */
describe('MN-4 三词缀配置（§③-5 定稿表）', () => {
  it('恰好 3 词缀：坚韧（HP ×1.5~1.8 中值 1.65 + 体型 +10%）/ 迅捷（移速 ×1.25 攻速 −15%）/ 腐蚀（120px 治疗效能 ×0.7）', () => {
    const ids = Object.keys(AFFIXES) as AffixId[];
    expect(ids).toEqual(['affix_tough', 'affix_swift', 'affix_corrupt']);
    expect(AFFIXES.affix_tough.hpMult).toBeGreaterThanOrEqual(1.5);
    expect(AFFIXES.affix_tough.hpMult).toBeLessThanOrEqual(1.8);
    expect(AFFIXES.affix_tough.sizeMult).toBeCloseTo(1.1, 6);
    expect(AFFIXES.affix_swift.speedMult).toBeCloseTo(1.25, 6);
    expect(AFFIXES.affix_swift.attackIntervalMult).toBeCloseTo(0.85, 6);
    expect(AFFIXES.affix_corrupt.healEffMult).toBeCloseTo(0.7, 6);
    expect(AFFIXES.affix_corrupt.auraRadius).toBe(120);
  });

  it('每词缀均有可读反制（P2 可读性红线）+ 叙事词根', () => {
    for (const a of Object.values(AFFIXES)) {
      expect(a.counter.length).toBeGreaterThan(0);
      expect(a.narrative.length).toBeGreaterThan(0);
    }
  });

  it('纪律：unlockAt 180 / 单词缀 / 方阵互斥 / XP ×1.2 / 无硬控免疫字段', () => {
    expect(AFFIX_RULES.unlockAt).toBe(180);
    expect(AFFIX_RULES.singlePerElite).toBe(true);
    expect(AFFIX_RULES.formationExcluded).toBe(true);
    expect(AFFIX_RULES.xpMult).toBeCloseTo(1.2, 6);
    expect(AFFIX_RULES.noHardCcImmunity).toBe(true);
  });

  it('远程技能化精英首版不叠词缀（掷骨者/忏悔者排除表——认知过载红线）', () => {
    expect(AFFIX_RULES.excludedEnemyIds).toContain('enemy_g1_8');
    expect(AFFIX_RULES.excludedEnemyIds).toContain('enemy_g2_5');
    expect(rollAffix('enemy_g1_8', 300, 0.1)).toBeNull();
    expect(rollAffix('enemy_g2_5', 300, 0.1)).toBeNull();
  });
});

describe('词缀掷取 rollAffix（180s 起 tank 槽精英）', () => {
  it('t < 180 → null（与轨③ 同期解锁）', () => {
    expect(rollAffix('enemy_g1_6', 179, 0.1)).toBeNull();
  });

  it('t ≥ 180 → 三选一均匀（r 区间三分）', () => {
    expect(rollAffix('enemy_g1_6', 180, 0.0)).toBe('affix_tough');
    expect(rollAffix('enemy_g1_6', 180, 0.34)).toBe('affix_swift');
    expect(rollAffix('enemy_g1_6', 180, 0.67)).toBe('affix_corrupt');
  });
});

describe('腐蚀光环治疗效能（MN-4：道具/铃/回血同折——道具拾取路径消费口）', () => {
  const player = { x: 0, y: 0 };

  it('120px 内腐蚀精英 → ×0.7；外/无腐蚀 → ×1', () => {
    const sources = [
      { x: 100, y: 0, affix: 'affix_corrupt' },
      { x: 500, y: 0, affix: 'affix_tough' },
    ];
    expect(corruptHealMultFor(sources, player)).toBeCloseTo(0.7, 6);
    expect(corruptHealMultFor([{ x: 121, y: 0, affix: 'affix_corrupt' }], player)).toBe(1);
    expect(corruptHealMultFor([{ x: 50, y: 0, affix: 'affix_tough' }], player)).toBe(1);
  });

  it('多腐蚀源不叠乘（取单值 ×0.7）', () => {
    const sources = [
      { x: 10, y: 0, affix: 'affix_corrupt' },
      { x: 20, y: 0, affix: 'affix_corrupt' },
    ];
    expect(corruptHealMultFor(sources, player)).toBeCloseTo(0.7, 6);
  });
});

describe('F-8 方阵互斥（生成侧口径复核）', () => {
  it('方阵成员敌种走 formationRuntime 路径（allowAffix 不置位）——配置层无词缀字段位', () => {
    // 方阵成员（腐朽骑士）不吃词缀：rollAffix 仅由 spawner tank 槽调用，方阵落地不走
    expect(AFFIX_RULES.formationExcluded).toBe(true);
    expect(ENEMY_CONFIGS.enemy_g1_7.formationOnly).toBe(true);
  });
});
