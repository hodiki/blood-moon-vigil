import { describe, it, expect } from 'vitest';
import { PlayerStats, moveDisplacement } from '@/player/player-stats';
import { PLAYER, GROWTH } from '@/config/balance';
import { clampToWorld } from '@/utils/math';

describe('PlayerStats 初始属性（upgrade-pool §③ / E1-S6；TASK-39 移速 220→235）', () => {
  it('初始：HP=100、移速 235、倍率 1.0、无敌帧 0.5s、等级 1', () => {
    const s = new PlayerStats();
    expect(s.maxHp).toBe(PLAYER.MAX_HP);
    expect(s.hp).toBe(PLAYER.MAX_HP);
    expect(s.moveSpeed).toBe(235);
    expect(s.damageMultiplier).toBe(1.0);
    expect(s.invulnerableTime).toBe(0.5);
    expect(s.level).toBe(1);
  });
});

describe('PlayerStats 升级成长（upgrade-pool §③）', () => {
  it('每级：最大生命 +8、伤害倍率 +4%', () => {
    const s = new PlayerStats();
    s.levelUp();
    expect(s.level).toBe(2);
    expect(s.maxHp).toBe(PLAYER.MAX_HP + GROWTH.HP_PER_LEVEL);
    expect(s.damageMultiplier).toBeCloseTo(1.04, 6);
  });

  it('每 5 级移速 +4px/s（第 5/10 级生效；235 基线）', () => {
    const s = new PlayerStats();
    for (let i = 0; i < 4; i += 1) s.levelUp(); // 到 5 级
    expect(s.moveSpeed).toBe(235 + 4);
    for (let i = 0; i < 5; i += 1) s.levelUp(); // 到 10 级
    expect(s.moveSpeed).toBe(235 + 8);
  });

  it('第 5 级前移速不变（4 级时仍 235）', () => {
    const s = new PlayerStats();
    for (let i = 0; i < 3; i += 1) s.levelUp(); // 到 4 级
    expect(s.moveSpeed).toBe(235);
  });
});

describe('E3-S2 升级池倍率与吸血（upgrade-pool §③ / E3-S5 写回）', () => {
  it('totalDamageMultiplier = 等级成长 + 升级池加成（加法叠加）', () => {
    const s = new PlayerStats();
    s.addDamageBonus(0.15);
    expect(s.totalDamageMultiplier).toBeCloseTo(1.15, 6);
    s.levelUp(); // 等级成长 +0.04
    expect(s.totalDamageMultiplier).toBeCloseTo(1.19, 6);
  });

  it('Lv30 等级成长 = 1 + 0.04×29 = 2.16；+2 次伤害强化 = 2.46（design-review §5 战力核算）', () => {
    const s = new PlayerStats();
    for (let i = 0; i < 29; i += 1) s.levelUp();
    expect(s.level).toBe(30);
    expect(s.damageMultiplier).toBeCloseTo(2.16, 6);
    s.addDamageBonus(0.15);
    s.addDamageBonus(0.15);
    expect(s.totalDamageMultiplier).toBeCloseTo(2.46, 6);
  });

  it('吸血：击杀回复 1 HP（upgrade-pool 第 8 项）', () => {
    const s = new PlayerStats();
    s.hp = 50;
    s.setLifesteal(1);
    s.applyLifesteal();
    expect(s.hp).toBe(51);
    // 未解锁时无操作
    s.hp = 60;
    s.lifestealPerKill = 0;
    s.applyLifesteal();
    expect(s.hp).toBe(60);
  });

  it('最大生命 +20 同时回复等量 HP（第 12 项）', () => {
    const s = new PlayerStats();
    s.hp = 30;
    s.addMaxHpBonus(20);
    expect(s.maxHp).toBe(120);
    expect(s.hp).toBe(50);
  });
});

describe('移动位移与边界 clamp（E1-S6 验收；TASK-39 移速 220→235）', () => {
  it('getMove × 235px/s：1 秒位移 235px', () => {
    const d = moveDisplacement({ x: 1, y: 0 }, PLAYER.MOVE_SPEED, 1);
    expect(d.x).toBe(235);
    expect(d.y).toBe(0);
  });

  it('斜向向量 × 移速：位移长度 = 移速 × dt', () => {
    const move = { x: Math.SQRT1_2, y: -Math.SQRT1_2 };
    const d = moveDisplacement(move, PLAYER.MOVE_SPEED, 0.5);
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(117.5, 6);
  });

  it('clampToWorld：坐标恒在 [0,3000]²（S9 边界）', () => {
    expect(clampToWorld({ x: -50, y: 3050 }, 3000, 3000)).toEqual({ x: 0, y: 3000 });
    expect(clampToWorld({ x: 1500, y: 1500 }, 3000, 3000)).toEqual({ x: 1500, y: 1500 });
    expect(clampToWorld({ x: 5000, y: -10 }, 3000, 3000)).toEqual({ x: 3000, y: 0 });
  });
});
