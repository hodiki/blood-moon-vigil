import { describe, it, expect } from 'vitest';
import { createActiveSkillRuntime, ActiveSkillRuntimeConfig } from '@/active-skill/active-skill-runtime';
import { ACTIVE_SKILLS } from '@/config/balance';

describe('E4-S3 主动技强化分支 12 项（gdd-active-skill §3.3）', () => {
  it('基础运行时 = ACTIVE_SKILLS 配置（未强化）', () => {
    const r = createActiveSkillRuntime('hero_edmund');
    expect(r.cd).toBe(ACTIVE_SKILLS.hero_edmund.cd);
    expect(r.stunDuration).toBe(ACTIVE_SKILLS.hero_edmund.stunDuration);
    expect(r.invulnDuration).toBe(ACTIVE_SKILLS.hero_edmund.invulnDuration);
  });

  it('CD -25%：守夜人 20→15 / 血猎手 12→9 / 修女 22→16.5 / 狼裔 24→18', () => {
    const cases: Array<[string, string, number, number]> = [
      ['hero_edmund', 'up_a_cd_edmund', 20, 15],
      ['hero_cassandra', 'up_a_cd_cassandra', 12, 9],
      ['hero_violet', 'up_a_cd_violet', 22, 16.5],
      ['hero_galvan', 'up_a_cd_galvan', 24, 18],
    ];
    for (const [hero, upId, before, after] of cases) {
      const r = createActiveSkillRuntime(hero as 'hero_edmund');
      expect(r.cd).toBe(before);
      expect(r.applyUpgrade(upId as never)).toBe(true);
      expect(r.cd).toBeCloseTo(after, 6);
    }
  });

  it('二次充能：血猎手充能 8s→4s/段（充能型原生）；CD 型替换为同强度效果增强', () => {
    const cassandra = createActiveSkillRuntime('hero_cassandra');
    expect(cassandra.isCharged).toBe(true);
    cassandra.applyUpgrade('up_a_charge_cassandra' as never);
    expect(cassandra.chargeInterval).toBe(4);

    const edmund = createActiveSkillRuntime('hero_edmund');
    edmund.applyUpgrade('up_a_charge_edmund' as never);
    expect(edmund.stunDuration).toBe(3.5); // 2.5 + 1（替换：眩晕 +1s）

    const violet = createActiveSkillRuntime('hero_violet');
    violet.applyUpgrade('up_a_charge_violet' as never);
    expect(violet.healPct).toBeCloseTo(0.3, 6); // 0.2 + 0.1（替换：回复 +10%）

    const galvan = createActiveSkillRuntime('hero_galvan');
    galvan.applyUpgrade('up_a_charge_galvan' as never);
    expect(galvan.lifestealOnKill).toBe(2); // 1 + 1（替换：狂化中吸血 +1 HP）
  });

  it('效果增强：守夜人眩晕 +1s/无敌 +0.5s；血猎手冲刺 +25%/标记 +10%；修女减速 +20%/回复 +10%；狼裔 +2s/吸血 +1', () => {
    const edmund = createActiveSkillRuntime('hero_edmund');
    edmund.applyUpgrade('up_a_effect_edmund' as never);
    expect(edmund.stunDuration).toBe(3.5);
    expect(edmund.invulnDuration).toBe(2.0);

    const cassandra = createActiveSkillRuntime('hero_cassandra');
    cassandra.applyUpgrade('up_a_effect_cassandra' as never);
    expect(cassandra.dashDistance).toBe(300); // 240 × 1.25
    expect(cassandra.markDamageMult).toBeCloseTo(1.3, 6); // 1.2 + 0.1

    const violet = createActiveSkillRuntime('hero_violet');
    violet.applyUpgrade('up_a_effect_violet' as never);
    expect(violet.slowPct).toBeCloseTo(0.6, 6); // 0.4 + 0.2
    expect(violet.healPct).toBeCloseTo(0.3, 6);

    const galvan = createActiveSkillRuntime('hero_galvan');
    galvan.applyUpgrade('up_a_effect_galvan' as never);
    expect(galvan.duration).toBe(10); // 8 + 2
    expect(galvan.lifestealOnKill).toBe(2);
  });

  it('非本角色分支拒绝（防越权）；非 up_a_* 拒绝', () => {
    const r = createActiveSkillRuntime('hero_edmund');
    expect(r.applyUpgrade('up_a_cd_cassandra' as never)).toBe(false);
    expect(r.applyUpgrade('up_g_1' as never)).toBe(false);
  });
});

describe('ActiveSkillRuntimeConfig 结构', () => {
  it('4 角色各自构造（heroId/name 锁定）', () => {
    const list: Array<[string, string]> = [
      ['hero_edmund', '提灯闪耀'],
      ['hero_cassandra', '血影突袭'],
      ['hero_violet', '安魂曲'],
      ['hero_galvan', '血月狂化'],
    ];
    for (const [hero, name] of list) {
      const r = new ActiveSkillRuntimeConfig(ACTIVE_SKILLS[hero as 'hero_edmund']);
      expect(r.heroId).toBe(hero);
      expect(r.name).toBe(name);
    }
  });
});
