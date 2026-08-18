import { describe, it, expect } from 'vitest';
import { WORLD, TILE, PALETTE, PLAYER, GROWTH, JOYSTICK, ENEMIES, WEAPONS, SPAWNER, XP, GEM, UPGRADES } from '@/config/balance';

describe('balance 数值常量表与 GDD 一致（test-framework §4 埋点断言基线）', () => {
  it('世界 3000×3000、tile 64×64（S9 / art-bible §5）', () => {
    expect(WORLD.WIDTH).toBe(3000);
    expect(WORLD.HEIGHT).toBe(3000);
    expect(TILE.SIZE).toBe(64);
  });

  it('色板与 art-bible §2/§5 一致（工程 token 唯一来源）', () => {
    expect(PALETTE.base).toBe('#0B0E14');
    expect(PALETTE.baseLight).toBe('#131722');
    expect(PALETTE.player).toBe('#E8F0FA');
    expect(PALETTE.playerAccent).toBe('#54E6C9');
    expect(PALETTE.blocker).toBe('#2A3346');
    expect(PALETTE.danger).toBe('#FF3B30');
  });

  it('玩家初始属性（upgrade-pool §③ / E1-S6 验收；TASK-39 R1 波次2 移速 220→235）', () => {
    expect(PLAYER.MOVE_SPEED).toBe(235);
    expect(PLAYER.DAMAGE_MULTIPLIER).toBe(1.0);
    expect(PLAYER.INVULNERABLE_TIME).toBe(0.5);
    expect(PLAYER.MAX_HP).toBe(100); // ⚠️ 工程假设，待设计确认（CONCERNS）
    expect(PLAYER.SPAWN_X).toBe(1500);
    expect(PLAYER.SPAWN_Y).toBe(1500);
  });

  it('升级成长规则（upgrade-pool §③）', () => {
    expect(GROWTH.HP_PER_LEVEL).toBe(8);
    expect(GROWTH.DAMAGE_PCT_PER_LEVEL).toBe(0.04);
    expect(GROWTH.SPEED_EVERY_N_LEVELS).toBe(5);
    expect(GROWTH.SPEED_PER_STEP).toBe(4);
  });

  it('摇杆常量（ux-spec §2/§5：常驻底座 (180,1120)、半径 48、死区 10%）', () => {
    expect(JOYSTICK.DEFAULT_BASE_X).toBe(180);
    expect(JOYSTICK.DEFAULT_BASE_Y).toBe(1120);
    expect(JOYSTICK.RADIUS).toBe(48);
    expect(JOYSTICK.DEAD_ZONE_FRACTION).toBe(0.1);
  });
});

describe('敌人面板常量与 enemies §③ 一致（E2-S2 基线；TASK-39 厚血经验 15→10）', () => {
  it('僵尸 12HP/55/10/1.0/14/1；疾行 10HP/150/8/0.8/12/2；厚血 600HP/35/20/1.5/22/10；Boss 6000HP/28/30/2.0/40/100', () => {
    expect(ENEMIES.zombie).toEqual({ hp: 12, speed: 55, damage: 10, attackInterval: 1.0, radius: 14, xp: 1 });
    expect(ENEMIES.wolf).toEqual({ hp: 10, speed: 150, damage: 8, attackInterval: 0.8, radius: 12, xp: 2 });
    expect(ENEMIES.tank).toEqual({ hp: 600, speed: 35, damage: 20, attackInterval: 1.5, radius: 22, xp: 10 });
    expect(ENEMIES.boss).toEqual({ hp: 6000, speed: 28, damage: 30, attackInterval: 2.0, radius: 40, xp: 100 });
  });
});

describe('武器数值常量与 weapons §③ 一致（E2-S3 基线）', () => {
  it('飞弹 12 伤 / 1.2s / 400px/s / 3s 寿命 / ≤8 发', () => {
    expect(WEAPONS.MISSILE.DAMAGE).toBe(12);
    expect(WEAPONS.MISSILE.COOLDOWN).toBe(1.2);
    expect(WEAPONS.MISSILE.SPEED).toBe(400);
    expect(WEAPONS.MISSILE.LIFETIME).toBe(3);
    expect(WEAPONS.MISSILE.MAX_ACTIVE).toBe(8);
  });

  it('环绕球 3 颗 / 80px / 240°/s / 8 伤 / 同目标 0.4s / ≤6 颗', () => {
    expect(WEAPONS.ORBIT.BASE_COUNT).toBe(3);
    expect(WEAPONS.ORBIT.RADIUS).toBe(80);
    expect(WEAPONS.ORBIT.ANGULAR_SPEED_DEG).toBe(240);
    expect(WEAPONS.ORBIT.DAMAGE).toBe(8);
    expect(WEAPONS.ORBIT.PER_TARGET_COOLDOWN).toBe(0.4);
    expect(WEAPONS.ORBIT.MAX_COUNT).toBe(6);
  });

  it('冲击波 60 伤 / 8s / 280px / 扩散 0.4s', () => {
    expect(WEAPONS.SHOCKWAVE.DAMAGE).toBe(60);
    expect(WEAPONS.SHOCKWAVE.COOLDOWN).toBe(8);
    expect(WEAPONS.SHOCKWAVE.RADIUS).toBe(280);
    expect(WEAPONS.SHOCKWAVE.EXPAND_SECONDS).toBe(0.4);
  });
});

describe('生成器常量与 spawner §③ 一致（E2-S4 基线；TASK-39 R1 波次2 + TASK-43 R2 预算参数）', () => {
  it('budget 参数：基数 1.2 / 线性 3.3 / 周期 1200 / 波幅 0.3 / 周期 75s', () => {
    expect(SPAWNER.BASE_BUDGET).toBe(1.2);
    expect(SPAWNER.LINEAR_SCALE).toBe(3.3);
    expect(SPAWNER.LINEAR_TOTAL_SECONDS).toBe(1200);
    expect(SPAWNER.WAVE_AMPLITUDE).toBe(0.3);
    expect(SPAWNER.WAVE_PERIOD_SECONDS).toBe(75);
  });

  it('20:00 Boss 收束 + 同屏节流参数 + 屠夫预警（TASK-39 E2）', () => {
    expect(SPAWNER.BOSS_TIME).toBe(1200);
    expect(SPAWNER.RETRY_PAUSE_SECONDS).toBe(2);
    expect(SPAWNER.TANK_GUARANTEE_EVERY_SECONDS).toBe(30); // E4 Sprint4 用户回调 40→30（C-7）
    expect(SPAWNER.TANK_WARNING_SECONDS).toBe(2.5); // 保底厚血出生前 2.5s 血月印记预警
  });
});

describe('经验/宝石/升级池常量（E3 基线）', () => {
  it('经验曲线常量（upgrade-pool §③）：need(n)=5+3(n−1) 参数', () => {
    expect(XP.BASE_NEED).toBe(5);
    expect(XP.NEED_STEP).toBe(3);
  });

  it('宝石常量（E3-S1；TASK-39 R1 波次2 磁吸 80→140 / 速度 360 / E-lite 漂移）：蓝菱 #4FC3F7、本体 12px、拾取 16px、磁吸 140px', () => {
    expect(GEM.COLOR).toBe('#4FC3F7');
    expect(GEM.BODY_SIZE).toBe(12);
    expect(GEM.PICKUP_RADIUS).toBe(16);
    expect(GEM.MAGNET_RADIUS).toBe(140);
    expect(GEM.MAGNET_SPEED).toBe(360);
    expect(GEM.DRIFT_AGE_THRESHOLD).toBe(3);
    expect(GEM.DRIFT_SPEED).toBe(80);
  });

  it('升级池 12 项与 upgrade-pool §③ 一致（机制 9/12 = 75%）', () => {
    expect(UPGRADES).toHaveLength(12);
    expect(UPGRADES.filter((u) => u.type === 'mechanic')).toHaveLength(9);
    expect(UPGRADES.filter((u) => u.type === 'numeric')).toHaveLength(3);
  });

  it('12 项表头抽查：新武器解锁 / 数值项（10/11/12）', () => {
    expect(UPGRADES[0]).toMatchObject({ id: 1, name: '解锁「守夜之环」', type: 'mechanic', maxStack: 1 });
    expect(UPGRADES[1]).toMatchObject({ id: 2, name: '解锁「月蚀脉冲」', type: 'mechanic', maxStack: 1 });
    expect(UPGRADES[9]).toMatchObject({ id: 10, name: '伤害强化 +15%', type: 'numeric', maxStack: Number.POSITIVE_INFINITY });
    expect(UPGRADES[10]).toMatchObject({ id: 11, name: '冷却缩减 -8%', type: 'numeric', maxStack: 3 });
    expect(UPGRADES[11]).toMatchObject({ id: 12, name: '最大生命 +20', type: 'numeric', maxStack: 5 });
  });
});
