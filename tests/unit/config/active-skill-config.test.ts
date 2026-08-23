import { describe, it, expect } from 'vitest';
import {
  ACTIVE_SKILLS,
  ACTIVE_SKILL_RULES,
  HEROES,
  GROWTH,
  UPGRADE_POOL,
  type ActiveSkillType,
  type HeroId,
} from '@/config/balance';

/**
 * E1-S5 主动技表完整断言（gdd-active-skill §3.2 / content-design-outline v1.1 §2.2~2.5）。
 * 逐项断言：每角色主动技类型 / CD / 充能 / 数值与设计稿一致；
 * ACTIVE_SKILL_RULES 红线常量（BURST_MIN_CD=18 / BURST_MAX_DAMAGE_PER_CAST=120 /
 * RAGE_MULTIPLIER_ADD=0.40 / CONTACT_AURA_FLAT_DPS=25）；
 * 关键数值口径：伤害型只吃 0.5× 总倍率、狂化倍率加法叠加 +0.40、标记乘算 ×1.20。
 */

const TYPES: readonly ActiveSkillType[] = ['DEFENSE', 'BURST', 'MOBILITY'];

describe('E1-S5 ACTIVE_SKILLS 表结构（每角色恰 1 主动技，gdd-active-skill §3.1）', () => {
  it('恰好 4 角色，key 与 HEROES / content-design-outline §2 一一对应', () => {
    expect(Object.keys(ACTIVE_SKILLS)).toEqual(Object.keys(HEROES));
    expect(Object.keys(ACTIVE_SKILLS)).toEqual(['hero_edmund', 'hero_cassandra', 'hero_violet', 'hero_galvan']);
  });

  it('类型标签合法：DEFENSE/BURST/MOBILITY 三选一（pillars §6.2）', () => {
    for (const s of Object.values(ACTIVE_SKILLS)) {
      expect(TYPES).toContain(s.type);
    }
  });

  it('CD 落在统一红线 12~25s（pillars §6.4），且均 ≥12s（低频红线 ①）', () => {
    for (const s of Object.values(ACTIVE_SKILLS)) {
      expect(s.cd).toBeGreaterThanOrEqual(12);
      expect(s.cd).toBeLessThanOrEqual(25);
    }
  });

  it('技能名与 HEROES.activeSkillName 跨表一致（角色表 ↔ 主动技表闭合）', () => {
    for (const [heroId, s] of Object.entries(ACTIVE_SKILLS) as Array<[HeroId, (typeof ACTIVE_SKILLS)[HeroId]]>) {
      expect(s.name).toBe(HEROES[heroId].activeSkillName);
    }
  });

  it('每角色主动技强化分支 3 项（content-design-outline §6.5 / gdd-upgrade-pool-v2 §3.5）', () => {
    for (const heroId of Object.keys(ACTIVE_SKILLS) as HeroId[]) {
      expect(UPGRADE_POOL.filter((u) => u.tags.includes(heroId))).toHaveLength(3);
    }
  });
});

describe('E1-S5 守夜人·艾德蒙「提灯闪耀」（content §2.2 / gdd-active-skill §3.2）', () => {
  it('DEFENSE / CD 20s / 240px 眩晕 2.5s / 无敌 1.5s；效果型无伤害倍率', () => {
    expect(ACTIVE_SKILLS.hero_edmund).toMatchObject({
      heroId: 'hero_edmund',
      name: '提灯闪耀',
      type: 'DEFENSE',
      cd: 20,
      radius: 240,
      stunDuration: 2.5,
      invulnDuration: 1.5,
    });
    expect(ACTIVE_SKILLS.hero_edmund.damageMultFactor).toBeUndefined(); // 效果型不吃倍率
    expect(ACTIVE_SKILLS.hero_edmund.charges).toBeUndefined(); // 非充能制
  });
});

describe('E1-S5 血猎手·卡珊德拉「血影突袭」（content §2.3 / gdd-active-skill §3.2）', () => {
  it('MOBILITY / CD 12s / 2 段充能（8s/段）/ 冲刺 240px / 40 伤 / 标记 4s +20%', () => {
    expect(ACTIVE_SKILLS.hero_cassandra).toMatchObject({
      heroId: 'hero_cassandra',
      name: '血影突袭',
      type: 'MOBILITY',
      cd: 12,
      charges: 2,
      chargeInterval: 8,
      dashDistance: 240,
      dashDamage: 40,
      markDamageMult: 1.2,
      markDuration: 4,
      damageMultFactor: 0.5,
    });
  });

  it('充能制差异化：等效总 CD ~16s（2×8s 间隔，gdd-active-skill §3.1 充能制口径）', () => {
    const s = ACTIVE_SKILLS.hero_cassandra;
    expect(s.charges! * s.chargeInterval!).toBe(16);
  });

  it('标记为乘算 debuff ×1.20（gdd-active-skill §3.2 口径 2），非加法', () => {
    expect(ACTIVE_SKILLS.hero_cassandra.markDamageMult).toBe(1.2);
  });
});

describe('E1-S5 夜祷修女·薇奥莱「安魂曲」（content §2.4 / gdd-active-skill §3.2）', () => {
  it('DEFENSE / CD 22s / 300px 减速 40%（4s）/ 回复 20% 最大生命；效果型无伤害倍率', () => {
    expect(ACTIVE_SKILLS.hero_violet).toMatchObject({
      heroId: 'hero_violet',
      name: '安魂曲',
      type: 'DEFENSE',
      cd: 22,
      radius: 300,
      slowPct: 0.4,
      slowDuration: 4,
      healPct: 0.2,
    });
    expect(ACTIVE_SKILLS.hero_violet.damageMultFactor).toBeUndefined();
    expect(ACTIVE_SKILLS.hero_violet.charges).toBeUndefined();
  });
});

describe('E1-S5 狼裔·加尔文「血月狂化」（content §2.5 / gdd-active-skill §3.2）', () => {
  it('BURST / CD 24s / 8s 移速 +30% / 击杀回 1 HP；接触光环伤害型只吃 0.5×', () => {
    expect(ACTIVE_SKILLS.hero_galvan).toMatchObject({
      heroId: 'hero_galvan',
      name: '血月狂化',
      type: 'BURST',
      cd: 24,
      duration: 8,
      moveSpeedPct: 0.3,
      lifestealOnKill: 1,
      damageMultFactor: 0.5,
    });
  });

  it('狂化倍率 = 加法叠加 +0.40（口径 1），引用 ACTIVE_SKILL_RULES.RAGE_MULTIPLIER_ADD 同源', () => {
    expect(ACTIVE_SKILL_RULES.RAGE_MULTIPLIER_ADD).toBe(0.4);
    expect(ACTIVE_SKILLS.hero_galvan.rageMultiplierAdd).toBe(ACTIVE_SKILL_RULES.RAGE_MULTIPLIER_ADD);
  });

  it('接触光环 = 平摊 25 伤/s（口径 3），引用 ACTIVE_SKILL_RULES.CONTACT_AURA_FLAT_DPS 同源', () => {
    expect(ACTIVE_SKILL_RULES.CONTACT_AURA_FLAT_DPS).toBe(25);
    expect(ACTIVE_SKILLS.hero_galvan.contactAuraFlat).toBe(ACTIVE_SKILL_RULES.CONTACT_AURA_FLAT_DPS);
  });

  it('加法叠加公式验证（gdd-active-skill §3.2 口径 1 例）：Lv27 基础倍率 2.04 → 狂化 2.44', () => {
    const baseAtLv27 = 1 + GROWTH.DAMAGE_PCT_PER_LEVEL * 26; // 1 + 0.04×26 = 2.04
    expect(baseAtLv27).toBeCloseTo(2.04, 6);
    const raged = baseAtLv27 + ACTIVE_SKILL_RULES.RAGE_MULTIPLIER_ADD;
    expect(raged).toBeCloseTo(2.44, 6); // 加法，不是 ×1.40 → 2.856
    expect(raged).toBeLessThan(baseAtLv27 * 1.4); // 反证：加法的相对收益 < 乘算
  });
});

describe('E1-S5 ACTIVE_SKILL_RULES 红线常量（gdd-active-skill §3.2 / AC-C2）', () => {
  it('BURST 守则：BURST_MIN_CD = 18、BURST_MAX_DAMAGE_PER_CAST = 120（sprint-m2-plan R7）', () => {
    expect(ACTIVE_SKILL_RULES.BURST_MIN_CD).toBe(18);
    expect(ACTIVE_SKILL_RULES.BURST_MAX_DAMAGE_PER_CAST).toBe(120);
  });

  it('狂化红线条目：RAGE_MULTIPLIER_ADD = 0.40、CONTACT_AURA_FLAT_DPS = 25（E1-S5 定稿）', () => {
    expect(ACTIVE_SKILL_RULES.RAGE_MULTIPLIER_ADD).toBe(0.4);
    expect(ACTIVE_SKILL_RULES.CONTACT_AURA_FLAT_DPS).toBe(25);
  });

  it('占比/次数红线：DPS_SHARE_MAX = 15%、MAX_CASTS_PER_RUN = 18、TYPICAL_CASTS = 12、中位间隔 30s（pillars §5）', () => {
    expect(ACTIVE_SKILL_RULES.DPS_SHARE_MAX).toBe(0.15);
    expect(ACTIVE_SKILL_RULES.MAX_CASTS_PER_RUN).toBe(18);
    expect(ACTIVE_SKILL_RULES.TYPICAL_CASTS).toBe(12);
    expect(ACTIVE_SKILL_RULES.CAST_INTERVAL_MEDIAN).toBe(30);
  });

  it('每角色 BURST 型守则合规（狼裔 CD 24 ≥18 合规；防御/机动型非 BURST 不受限）', () => {
    const galvan = ACTIVE_SKILLS.hero_galvan;
    expect(galvan.type).toBe('BURST');
    expect(galvan.cd).toBeGreaterThanOrEqual(ACTIVE_SKILL_RULES.BURST_MIN_CD);
    const burstCount = Object.values(ACTIVE_SKILLS).filter((s) => s.type === 'BURST').length;
    expect(burstCount).toBe(1); // 当前仅狼裔 1 个 BURST
  });
});

describe('E1-S5 主动技强化分支数值（gdd-active-skill §3.3 / content-design-outline §6.5）', () => {
  it('CD -25% 分支数值在升级池描述中与基础 CD 一致（20→15 / 12→9 / 22→16.5 / 24→18）', () => {
    const expected: Array<[HeroId, number, number]> = [
      ['hero_edmund', 20, 15],
      ['hero_cassandra', 12, 9],
      ['hero_violet', 22, 16.5],
      ['hero_galvan', 24, 18],
    ];
    for (const [heroId, baseCd, reducedCd] of expected) {
      expect(ACTIVE_SKILLS[heroId].cd).toBe(baseCd);
      const item = UPGRADE_POOL.find((u) => u.id === `up_a_cd_${heroId.slice('hero_'.length)}`);
      expect(item).toBeDefined();
      expect(item!.desc).toContain(String(reducedCd));
      expect(item!.type).toBe('mechanic');
    }
  });

  it('充能制分支仅血猎手（二次充能 8s→4s/段），其余角色为替换槽（gdd-active-skill §3.3 注）', () => {
    const cassandraCharge = UPGRADE_POOL.find((u) => u.id === 'up_a_charge_cassandra');
    expect(cassandraCharge).toBeDefined();
    expect(cassandraCharge!.desc).toContain('4s/段');
    // 非充能角色「二次充能」槽位为同强度替换（守夜人 = 眩晕 +1s）
    const edmundCharge = UPGRADE_POOL.find((u) => u.id === 'up_a_charge_edmund');
    expect(edmundCharge!.desc).toContain('眩晕 +1s');
  });
});
