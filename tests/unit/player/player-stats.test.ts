import { describe, it, expect } from 'vitest';
import {
  HEROES,
  PLAYER,
  GROWTH,
  type HeroId,
} from '@/config/balance';
import {
  PlayerStats,
  moveDisplacement,
  HIT_SPEED_BOOST,
  PASSIVE_MAGNET_RADIUS_BONUS,
  PASSIVE_HEAL_BOOST_MULTIPLIER,
  PASSIVE_LIFESTEAL_PER_KILL,
} from '@/player/player-stats';
import { clampToWorld } from '@/utils/math';

/** E4-S1 角色开局属性断言（content-design-outline §2.6 + 运行时口径） */
const EXPECTED_INIT: Array<{
  hero: HeroId;
  initialHp: number;
  hpPerLevel: number;
  /** 运行时移速（守夜人吸收 PLAYER.MOVE_SPEED=235；其余按 HEROES 配置） */
  runtimeSpeed: number;
  speedEveryNLevels: number;
}> = [
  { hero: 'hero_edmund', initialHp: 100, hpPerLevel: 8, runtimeSpeed: 235, speedEveryNLevels: 5 },
  { hero: 'hero_cassandra', initialHp: 85, hpPerLevel: 6, runtimeSpeed: 245, speedEveryNLevels: 4 },
  { hero: 'hero_violet', initialHp: 115, hpPerLevel: 10, runtimeSpeed: 205, speedEveryNLevels: 6 },
  { hero: 'hero_galvan', initialHp: 125, hpPerLevel: 12, runtimeSpeed: 215, speedEveryNLevels: 5 },
];

describe('E4-S1 角色开局属性（new PlayerStats(hero)）', () => {
  it('4 角色：初始 HP / 移速（守夜人运行时吸收 235）/ HP每级 / 移速级频 与 HEROES + PLAYER 一致', () => {
    for (const row of EXPECTED_INIT) {
      const stats = new PlayerStats(HEROES[row.hero]);
      expect(stats.maxHp).toBe(row.initialHp);
      expect(stats.hp).toBe(row.initialHp);
      expect(stats.moveSpeed).toBe(row.runtimeSpeed);
      expect(stats.hpPerLevel).toBe(row.hpPerLevel);
      expect(stats.speedEveryNLevels).toBe(row.speedEveryNLevels);
      expect(stats.heroId).toBe(row.hero);
    }
  });

  it('守夜人运行时移速 235 = PLAYER.MOVE_SPEED（TASK-39 已批，覆盖 HEROES 草图 220；断言注明差异）', () => {
    const edmund = new PlayerStats(HEROES.hero_edmund);
    expect(edmund.moveSpeed).toBe(PLAYER.MOVE_SPEED);
    expect(PLAYER.MOVE_SPEED).toBe(235);
    // 配置表草图 220 仍保留（heroes-config.test 断言），运行时吸收 235
    expect(HEROES.hero_edmund.initialSpeed).toBe(220);
    expect(edmund.moveSpeed).not.toBe(HEROES.hero_edmund.initialSpeed);
  });

  it('角色成长曲线：血猎手每 4 级 +4px/s、修女每 6 级 +4px/s（levelUp 用角色曲线）', () => {
    const cassandra = new PlayerStats(HEROES.hero_cassandra);
    for (let i = 0; i < 2; i += 1) cassandra.levelUp(); // 到 3 级
    expect(cassandra.moveSpeed).toBe(245); // 3 级未触发（每 4 级 = 第 4 级触发）
    cassandra.levelUp(); // 到 4 级
    expect(cassandra.moveSpeed).toBe(249); // 245 + 4

    const violet = new PlayerStats(HEROES.hero_violet);
    for (let i = 0; i < 4; i += 1) violet.levelUp(); // 到 5 级
    expect(violet.moveSpeed).toBe(205); // 5 级未触发（每 6 级 = 第 6 级触发）
    violet.levelUp(); // 到 6 级
    expect(violet.moveSpeed).toBe(209); // 205 + 4
  });

  it('角色 HP 成长：狼裔每级 +12、血猎手每级 +6（超肉 vs 脆皮）', () => {
    const galvan = new PlayerStats(HEROES.hero_galvan);
    galvan.levelUp();
    expect(galvan.maxHp).toBe(125 + 12);
    const cassandra = new PlayerStats(HEROES.hero_cassandra);
    cassandra.levelUp();
    expect(cassandra.maxHp).toBe(85 + 6);
  });

  it('无角色参数 = Demo 默认口径（既有测试回归：HP 100 / 移速 235 / 标准成长）', () => {
    const s = new PlayerStats();
    expect(s.heroId).toBeNull();
    expect(s.maxHp).toBe(PLAYER.MAX_HP);
    expect(s.moveSpeed).toBe(235);
    expect(s.hpPerLevel).toBe(GROWTH.HP_PER_LEVEL);
    expect(s.damagePctPerLevel).toBe(GROWTH.DAMAGE_PCT_PER_LEVEL);
    s.levelUp();
    expect(s.maxHp).toBe(PLAYER.MAX_HP + GROWTH.HP_PER_LEVEL);
  });
});

describe('E4-S1 专属被动（content-design-outline §2.2~2.5）', () => {
  it('守夜人「提灯圣辉」：经验磁力 +20px（magnetRadiusBonus；其余角色 0）', () => {
    expect(new PlayerStats(HEROES.hero_edmund).magnetRadiusBonus).toBe(PASSIVE_MAGNET_RADIUS_BONUS);
    expect(new PlayerStats(HEROES.hero_cassandra).magnetRadiusBonus).toBe(0);
    expect(PASSIVE_MAGNET_RADIUS_BONUS).toBe(20);
  });

  it('血猎手「半裔之血」：受击后 3s 内移速 +10%（triggerHitSpeedBoost / effectiveMoveSpeed）', () => {
    const s = new PlayerStats(HEROES.hero_cassandra);
    expect(s.isHitSpeedBoostActive(0)).toBe(false);
    s.triggerHitSpeedBoost(10);
    expect(s.isHitSpeedBoostActive(10.5)).toBe(true);
    expect(s.effectiveMoveSpeed(10.5)).toBeCloseTo(245 * 1.1, 6);
    expect(s.effectiveMoveSpeed(13)).toBeCloseTo(245, 6); // 3s 后恢复
    expect(HIT_SPEED_BOOST.DURATION_SECONDS).toBe(3);
    expect(HIT_SPEED_BOOST.PCT).toBe(0.1);
  });

  it('修女「执烛之心」：治疗道具效果 +50%（数据层标记，M3 治疗道具消费）', () => {
    const s = new PlayerStats(HEROES.hero_violet);
    expect(s.healBoostMultiplier).toBe(PASSIVE_HEAL_BOOST_MULTIPLIER);
    // 放大口径：基础 10 治疗 → 15（M3 治疗道具落地后消费）
    expect(s.boostedHealAmount(10)).toBe(15);
    expect(new PlayerStats(HEROES.hero_edmund).healBoostMultiplier).toBe(1);
  });

  it('狼裔「兽血愈合」：击杀回复 0.5 HP，与吸血升级加法叠加（applyLifesteal）', () => {
    const s = new PlayerStats(HEROES.hero_galvan);
    expect(s.passiveLifestealPerKill).toBe(PASSIVE_LIFESTEAL_PER_KILL);
    s.hp = 100;
    s.applyLifesteal();
    expect(s.hp).toBeCloseTo(100.5, 6); // 被动 0.5
    // 吸血升级叠加：lifestealPerKill=1 → 1 + 0.5 = 1.5
    s.hp = 100;
    s.setLifesteal(1);
    s.applyLifesteal();
    expect(s.hp).toBeCloseTo(101.5, 6);
    expect(PASSIVE_LIFESTEAL_PER_KILL).toBe(0.5);
  });

  it('E4-S2 狂化倍率：totalDamageMultiplier 包含 rageBonusMultiplier（加法叠加）', () => {
    const s = new PlayerStats(HEROES.hero_galvan);
    s.levelUp(); // 倍率 1.04
    s.setRageBonus(0.4);
    expect(s.totalDamageMultiplier).toBeCloseTo(1.44, 6);
    s.setRageBonus(0);
    expect(s.totalDamageMultiplier).toBeCloseTo(1.04, 6);
  });

  it('E4-S2 狂化移速 buff：effectiveMoveSpeed 叠加 rageSpeedPct', () => {
    const s = new PlayerStats(HEROES.hero_galvan);
    s.rageSpeedPct = 0.3;
    expect(s.effectiveMoveSpeed(0)).toBeCloseTo(215 * 1.3, 6);
  });
});

describe('移动位移与边界 clamp（E1-S6 验收；E4-S9 地图尺寸联动）', () => {
  it('getMove × 235px/s：1 秒位移 235px（守夜人运行时）', () => {
    const d = moveDisplacement({ x: 1, y: 0 }, PLAYER.MOVE_SPEED, 1);
    expect(d.x).toBe(235);
    expect(d.y).toBe(0);
  });

  it('clampToWorld：坐标恒在 [0,W]²（教堂 2800 / 狼穴 3200，E4-S9）', () => {
    expect(clampToWorld({ x: -50, y: 2850 }, 2800, 2800)).toEqual({ x: 0, y: 2800 });
    expect(clampToWorld({ x: 3300, y: 1500 }, 3200, 3200)).toEqual({ x: 3200, y: 1500 });
  });
});
