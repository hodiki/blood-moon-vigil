import { describe, it, expect } from 'vitest';
import {
  HEROES,
  ACTIVE_SKILLS,
  PLAYER,
  GROWTH,
  type HeroId,
  type HeroConfig,
} from '@/config/balance';

/**
 * E1-S6 玩家验收基线（content-design-outline v1.1 §2.6 成长曲线草图）。
 * 断言 4 角色初始 HP / 初始移速 / HP每级 / 移速级频 / 每级倍率 + 初始武器 + 主动技名跨表闭合。
 *
 * 口径说明（草图 vs 运行时）：
 * - §2.6 为设计草图值：守夜人初始移速 **220** px/s（220/245/205/215）；
 * - 运行时 PLAYER.MOVE_SPEED = **235** px/s（TASK-39 R1 波次2 用户已批 220→235，
 *   E4-S1 角色选择落地时吸收）；E1-S6 按 outline 草图断言配置表（220），不强行统一，
 *   差异在 E4-S1 落地时以运行时值与评审裁决为准（balance.ts HEROES 注释同步口径）。
 */

const EXPECTED_GROWTH: Array<{
  hero: HeroId;
  name: string;
  initialHp: number;
  hpPerLevel: number;
  initialSpeed: number;
  speedEveryNLevels: number;
  speedPerStep: number;
  damagePctPerLevel: number;
  initialWeapon: string;
  powerTag: string;
}> = [
  { hero: 'hero_edmund', name: '守夜人·艾德蒙', initialHp: 100, hpPerLevel: 8, initialSpeed: 220, speedEveryNLevels: 5, speedPerStep: 4, damagePctPerLevel: 0.04, initialWeapon: 'wpn_a_1', powerTag: 'HALLOWED' },
  { hero: 'hero_cassandra', name: '血猎手·卡珊德拉', initialHp: 85, hpPerLevel: 6, initialSpeed: 245, speedEveryNLevels: 4, speedPerStep: 4, damagePctPerLevel: 0.04, initialWeapon: 'wpn_a_2', powerTag: 'SILVER' },
  { hero: 'hero_violet', name: '夜祷修女·薇奥莱', initialHp: 115, hpPerLevel: 10, initialSpeed: 205, speedEveryNLevels: 6, speedPerStep: 4, damagePctPerLevel: 0.04, initialWeapon: 'wpn_a_3', powerTag: 'HALLOWED' },
  { hero: 'hero_galvan', name: '狼裔·加尔文', initialHp: 125, hpPerLevel: 12, initialSpeed: 215, speedEveryNLevels: 5, speedPerStep: 4, damagePctPerLevel: 0.04, initialWeapon: 'wpn_d_2', powerTag: 'BEAST' },
];

describe('E1-S6 角色表 4（content-design-outline v1.1 §2.6 成长曲线草图）', () => {
  it('恰好 4 角色，key 顺序 = hero_edmund / hero_cassandra / hero_violet / hero_galvan', () => {
    expect(Object.keys(HEROES)).toEqual(['hero_edmund', 'hero_cassandra', 'hero_violet', 'hero_galvan']);
    expect(Object.keys(HEROES)).toEqual(Object.keys(ACTIVE_SKILLS));
  });

  it('§2.6 逐项断言：初始 HP / HP每级 / 初始移速（220/245/205/215）/ 移速级频 / 每级倍率 / 初始武器 / 力量来源', () => {
    for (const row of EXPECTED_GROWTH) {
      expect(HEROES[row.hero]).toMatchObject({
        id: row.hero,
        name: row.name,
        initialHp: row.initialHp,
        hpPerLevel: row.hpPerLevel,
        initialSpeed: row.initialSpeed,
        speedEveryNLevels: row.speedEveryNLevels,
        speedPerStep: row.speedPerStep,
        damagePctPerLevel: row.damagePctPerLevel,
        initialWeapon: row.initialWeapon,
        powerTag: row.powerTag,
      });
    }
  });

  it('成长斜率：血猎手最脆最快（85HP/245速）、修女肉盾慢速（115HP/205速）、狼裔超肉（125HP/215速）', () => {
    const hp = Object.values(HEROES).map((h) => h.initialHp);
    const speed = Object.values(HEROES).map((h) => h.initialSpeed);
    expect(Math.min(...hp)).toBe(85); // 血猎手最脆
    expect(Math.max(...hp)).toBe(125); // 狼裔最肉
    expect(Math.max(...speed)).toBe(245); // 血猎手最快
    expect(Math.min(...speed)).toBe(205); // 修女最慢
  });

  it('移速成长常量一致：speedPerStep = 4 px/s（§2.6「+4 / N级」），每级倍率 0.04（§1.2）', () => {
    for (const h of Object.values(HEROES)) {
      expect(h.speedPerStep).toBe(4);
      expect(h.damagePctPerLevel).toBe(GROWTH.DAMAGE_PCT_PER_LEVEL);
    }
  });

  it('草图口径 vs 运行时差异注释：守夜人 initialSpeed=220（outline §2.6）≠ PLAYER.MOVE_SPEED=235（TASK-39 已批运行时值）', () => {
    const edmund = HEROES.hero_edmund as HeroConfig;
    expect(edmund.initialSpeed).toBe(220); // 配置表按 outline 草图
    expect(PLAYER.MOVE_SPEED).toBe(235); // 运行时已批值（E4-S1 落地吸收，不强行统一）
    // 差异只发生在守夜人基准；其余角色无独立运行时常量，配置表即验收值
    expect(edmund.initialSpeed).not.toBe(PLAYER.MOVE_SPEED);
  });
});

describe('E1-S6 主动技关联（HEROES.activeSkillName ↔ ACTIVE_SKILLS 跨表闭合）', () => {
  it('每角色 activeSkillName 与主动技表 name 一致（content-design-outline §2.2~2.5）', () => {
    for (const [heroId, hero] of Object.entries(HEROES) as Array<[HeroId, HeroConfig]>) {
      expect(ACTIVE_SKILLS[heroId].name).toBe(hero.activeSkillName);
      expect(hero.activeSkillName.length).toBeGreaterThan(0);
    }
  });

  it('技能名锚点：提灯闪耀 / 血影突袭 / 安魂曲 / 血月狂化', () => {
    expect(HEROES.hero_edmund.activeSkillName).toBe('提灯闪耀');
    expect(HEROES.hero_cassandra.activeSkillName).toBe('血影突袭');
    expect(HEROES.hero_violet.activeSkillName).toBe('安魂曲');
    expect(HEROES.hero_galvan.activeSkillName).toBe('血月狂化');
  });
});
