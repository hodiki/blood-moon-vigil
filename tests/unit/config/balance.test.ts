import { describe, it, expect } from 'vitest';
import {
  WORLD,
  TILE,
  PALETTE,
  PLAYER,
  GROWTH,
  JOYSTICK,
  WEAPONS,
  SPAWNER,
  XP,
  GEM,
  UPGRADES,
  ACTIVE_SKILL_RULES,
  WEAPON_CONFIGS,
  EVOLUTIONS,
  ENEMY_CONFIGS,
  BOSSES,
  HEROES,
  ACTIVE_SKILLS,
  MAP_CONFIGS,
  UPGRADE_POOL,
  type PowerTag,
} from '@/config/balance';
import { ENEMIES } from '@/../src/_archived/enemies-legacy-panel'; // W-8 收档：legacy 面板归档对照（禁止运行时消费）

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

describe('敌人面板常量与 enemies §③ 一致（E2-S2 基线；TASK-39 厚血经验 15→10；TASK-31 Boss HP 6000→4000）', () => {
  it('僵尸 12HP/55/10/1.0/14/1；疾行 10HP/150/8/0.8/12/2；厚血 600HP/35/20/1.5/22/10；Boss 4000HP/28/30/2.0/40/100', () => {
    expect(ENEMIES.zombie).toEqual({ hp: 12, speed: 55, damage: 10, attackInterval: 1.0, radius: 14, xp: 1 });
    expect(ENEMIES.wolf).toEqual({ hp: 10, speed: 150, damage: 8, attackInterval: 0.8, radius: 12, xp: 2 });
    expect(ENEMIES.tank).toEqual({ hp: 600, speed: 35, damage: 20, attackInterval: 1.5, radius: 22, xp: 10 });
    expect(ENEMIES.boss).toEqual({ hp: 4000, speed: 28, damage: 30, attackInterval: 2.0, radius: 40, xp: 100 });
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

describe('生成器常量与 spawner §③ 一致（E2-S4 基线；TASK-39 R1 波次2 + TASK-43 R2 + TASK-31 收尾预算参数）', () => {
  it('budget 参数：基数 1.2 / 线性 1.2 / 周期 360 / 波幅 0.3 / 周期 60s（TASK-31 收尾 6min 局）', () => {
    expect(SPAWNER.BASE_BUDGET).toBe(1.2);
    expect(SPAWNER.LINEAR_SCALE).toBe(1.2);
    expect(SPAWNER.LINEAR_TOTAL_SECONDS).toBe(360);
    expect(SPAWNER.WAVE_AMPLITUDE).toBe(0.3);
    expect(SPAWNER.WAVE_PERIOD_SECONDS).toBe(60);
  });

  it('6:00 Boss 收束 + 同屏节流参数 + 屠夫预警（TASK-39 E2；TASK-31 收尾 1200→360）', () => {
    expect(SPAWNER.BOSS_TIME).toBe(360);
    expect(SPAWNER.RETRY_PAUSE_SECONDS).toBe(2);
    expect(SPAWNER.TANK_GUARANTEE_EVERY_SECONDS).toBe(30); // S2（120–240s）阶段保底
    expect(SPAWNER.TANK_GUARANTEE_EVERY_SECONDS_S3).toBe(20); // S3（240–360s）阶段保底（TASK-31 新增）
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

describe('M2-S1a 内容表骨架（content-design-outline v1.1 数据驱动，纯数据层）', () => {
  it('表规模：武器 14 / 超武 7 / 敌人 16 / Boss 4 / 角色 4 / 主动技 4 / 地图 3 / 升级池 40（gdd-enemies-v3 §③-2 敌 15→16）', () => {
    expect(Object.keys(WEAPON_CONFIGS)).toHaveLength(14);
    expect(EVOLUTIONS).toHaveLength(7);
    expect(Object.keys(ENEMY_CONFIGS)).toHaveLength(16);
    expect(Object.keys(BOSSES)).toHaveLength(4);
    expect(Object.keys(HEROES)).toHaveLength(4);
    expect(Object.keys(ACTIVE_SKILLS)).toHaveLength(4);
    expect(Object.keys(MAP_CONFIGS)).toHaveLength(3);
    expect(UPGRADE_POOL).toHaveLength(40);
  });

  it('powerTag 五 tag 规范（SILVER/HALLOWED/BEAST/BLOOD/MOON）全覆盖', () => {
    const tags = new Set<PowerTag>(['SILVER', 'HALLOWED', 'BEAST', 'BLOOD', 'MOON']);
    for (const w of Object.values(WEAPON_CONFIGS)) expect(tags.has(w.powerTag)).toBe(true);
    for (const e of Object.values(ENEMY_CONFIGS)) expect(tags.has(e.powerTag)).toBe(true);
    for (const b of Object.values(BOSSES)) expect(tags.has(b.powerTag)).toBe(true);
    for (const h of Object.values(HEROES)) expect(tags.has(h.powerTag)).toBe(true);
  });

  it('角色表 4：成长曲线草图与 content-design-outline §2.6 一致', () => {
    expect(HEROES.hero_edmund).toMatchObject({ initialHp: 100, hpPerLevel: 8, initialSpeed: 220, speedEveryNLevels: 5, damagePctPerLevel: 0.04, initialWeapon: 'wpn_a_1' });
    expect(HEROES.hero_cassandra).toMatchObject({ initialHp: 85, hpPerLevel: 6, initialSpeed: 245, speedEveryNLevels: 4, initialWeapon: 'wpn_a_2' });
    expect(HEROES.hero_violet).toMatchObject({ initialHp: 115, hpPerLevel: 10, initialSpeed: 205, speedEveryNLevels: 6, initialWeapon: 'wpn_a_3' });
    expect(HEROES.hero_galvan).toMatchObject({ initialHp: 125, hpPerLevel: 12, initialSpeed: 215, speedEveryNLevels: 5, initialWeapon: 'wpn_d_2' });
  });

  it('主动技表 4：类型/CD/充能与 gdd-active-skill §3.2 一致', () => {
    expect(ACTIVE_SKILLS.hero_edmund).toMatchObject({ type: 'DEFENSE', cd: 20, radius: 240, stunDuration: 2.5, invulnDuration: 1.5 });
    expect(ACTIVE_SKILLS.hero_cassandra).toMatchObject({ type: 'MOBILITY', cd: 12, charges: 2, chargeInterval: 8, dashDistance: 240, dashDamage: 40, markDamageMult: 1.2, markDuration: 4, damageMultFactor: 0.5 });
    expect(ACTIVE_SKILLS.hero_violet).toMatchObject({ type: 'DEFENSE', cd: 22, radius: 300, slowPct: 0.4, slowDuration: 4, healPct: 0.2 });
    expect(ACTIVE_SKILLS.hero_galvan).toMatchObject({ type: 'BURST', cd: 24, duration: 8, moveSpeedPct: 0.3, lifestealOnKill: 1, damageMultFactor: 0.5 });
  });

  it('红线条目常量（E1-S5）：狂化倍率加法 +0.40、接触光环平摊 25 伤/s（与主动技表同源）', () => {
    expect(ACTIVE_SKILL_RULES.RAGE_MULTIPLIER_ADD).toBe(0.4);
    expect(ACTIVE_SKILL_RULES.CONTACT_AURA_FLAT_DPS).toBe(25);
    expect(ACTIVE_SKILLS.hero_galvan.rageMultiplierAdd).toBe(ACTIVE_SKILL_RULES.RAGE_MULTIPLIER_ADD);
    expect(ACTIVE_SKILLS.hero_galvan.contactAuraFlat).toBe(ACTIVE_SKILL_RULES.CONTACT_AURA_FLAT_DPS);
  });

  it('升级池 40 项结构：每项带内容 ID / 名称 / 类型 / 标签 / 卡面 / 叠加上限；机制型 ≥50%', () => {
    const ids = new Set(UPGRADE_POOL.map((u) => u.id));
    expect(ids.size).toBe(40); // 内容 ID 唯一
    for (const u of UPGRADE_POOL) {
      expect(u.name.length).toBeGreaterThan(0);
      expect(u.tags.length).toBeGreaterThan(0);
      expect(['blue-purple', 'amber-gold']).toContain(u.cardKind);
      expect(u.maxStack).toBeGreaterThan(0);
    }
    const mechanicRatio = UPGRADE_POOL.filter((u) => u.type === 'mechanic').length / UPGRADE_POOL.length;
    expect(mechanicRatio).toBeGreaterThanOrEqual(0.5);
  });

  it('升级池标签语义：全局/key 面向所有人；武器类按类；主动技强化仅当前角色（gdd-upgrade-pool-v2 §3.1）', () => {
    expect(UPGRADE_POOL.filter((u) => u.tags.includes('global'))).toHaveLength(9);
    expect(UPGRADE_POOL.filter((u) => u.tags.includes('key'))).toHaveLength(7);
    expect(UPGRADE_POOL.filter((u) => u.tags.some((t) => t.startsWith('weapon_class_')))).toHaveLength(12);
    expect(UPGRADE_POOL.filter((u) => u.tags.includes('hero_edmund'))).toHaveLength(3);
    expect(UPGRADE_POOL.filter((u) => u.tags.includes('hero_galvan'))).toHaveLength(3);
  });

  it('超武钥 7 项带进化目标，与 EVOLUTIONS 映射闭环（weapon_evolution { wpnId, keyId, evoId }）', () => {
    const keys = UPGRADE_POOL.filter((u) => u.tags.includes('key'));
    expect(keys).toHaveLength(7);
    for (const k of keys) expect(k.evolutionTarget).toBeDefined();
    for (const evo of EVOLUTIONS) {
      const key = UPGRADE_POOL.find((u) => u.id === evo.keyId);
      expect(key).toBeDefined();
      expect(key!.evolutionTarget).toBe(evo.evoId);
      expect(WEAPON_CONFIGS[evo.wpnId].frame.length).toBeGreaterThan(0);
    }
  });
});
