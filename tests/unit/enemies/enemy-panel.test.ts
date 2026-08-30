import { describe, it, expect } from 'vitest';
import {
  ENEMY_CONFIGS,
  type EnemyKindId,
  type EnemyId,
} from '@/config/balance';
import { ENEMIES } from '@/../src/_archived/enemies-legacy-panel'; // W-8 收档：legacy 面板归档对照（禁止运行时消费）
import { ENEMY_CONFIGS, BOSSES } from '@/config/balance';
import { ENEMY_PANELS, NORMAL_ENEMY_KINDS, isNormalEnemy, enemyPanel, enemiesForMap, runtimeKindForEnemyId } from '@/enemies/enemy-types';

/** enemies §③ 数值表（埋点断言基线，与 GDD 逐项一致；TASK-39 厚血经验 15→10） */
const PANEL_TABLE: Record<EnemyKindId, { hp: number; speed: number; damage: number; attackInterval: number; radius: number; xp: number }> = {
  zombie: { hp: 12, speed: 55, damage: 10, attackInterval: 1.0, radius: 14, xp: 1 },
  wolf: { hp: 10, speed: 150, damage: 8, attackInterval: 0.8, radius: 12, xp: 2 },
  tank: { hp: 600, speed: 35, damage: 20, attackInterval: 1.5, radius: 22, xp: 10 },
  boss: { hp: 4000, speed: 28, damage: 30, attackInterval: 2.0, radius: 40, xp: 100 },
};

describe('敌人面板与 GDD 一致（E2-S2 / enemies §③ / E8-1）', () => {
  it('僵尸「行尸」12HP/55px/s/10伤/1.0s/14px/1经验', () => {
    expect(ENEMIES.zombie).toEqual(PANEL_TABLE.zombie);
  });

  it('疾行者「血犬」10HP/150px/s/8伤/0.8s/12px/2经验', () => {
    expect(ENEMIES.wolf).toEqual(PANEL_TABLE.wolf);
  });

  it('厚血怪「屠夫」600HP/35px/s/20伤/1.5s/22px/10经验（TASK-39 15→10 压后期经验通胀）', () => {
    expect(ENEMIES.tank).toEqual(PANEL_TABLE.tank);
  });

  it('Boss「血月尊者」4000HP/28px/s/30伤/2.0s/40px/100经验（E8-1 全表，实体 E4 接入；TASK-31 收尾 6000→4000）', () => {
    expect(ENEMIES.boss).toEqual(PANEL_TABLE.boss);
  });

  it('厚血怪死亡掉 10 经验（TASK-39 R1 波次2：15→10，E3 预授权判据「R1 满局 Lv47」触发压通胀）', () => {
    expect(ENEMIES.tank.xp).toBe(10);
  });

  it('Boss 死亡掉 100 经验（E8-3）', () => {
    expect(ENEMIES.boss.xp).toBe(100);
  });
});

describe('enemy-types 收敛（唯一出口）', () => {
  it('W-8 单源化：ENEMY_PANELS 从 ENEMY_CONFIGS/BOSSES 派生（legacy ENEMIES 已收档）', () => {
    expect(ENEMY_PANELS.zombie).toBe(ENEMY_CONFIGS.enemy_g1_1);
    expect(ENEMY_PANELS.boss).toBe(BOSSES.boss_1);
    // legacy 表数值对照（收档回归守卫；运行时零消费）
    expect(ENEMY_PANELS.zombie.hp).toBe(ENEMIES.zombie.hp);
  });

  it('普通 3 敌：僵尸/疾行/厚血（共用一池，ARCH §3.3）', () => {
    expect(NORMAL_ENEMY_KINDS).toEqual(['zombie', 'wolf', 'tank']);
  });

  it('描边纪律 RV-C1：普通敌非 Boss（Boss 才允许 FX.Outline）', () => {
    expect(NORMAL_ENEMY_KINDS.every((k) => isNormalEnemy(k))).toBe(true);
    expect(isNormalEnemy('boss')).toBe(false);
  });

  it('enemyPanel 查询安全（noUncheckedIndexedAccess 兼容）', () => {
    expect(enemyPanel('zombie').hp).toBe(12);
    expect(enemyPanel('boss').xp).toBe(100);
  });
});

describe('E3-S1 敌人运行时注册（15 敌按 ENEMY_CONFIGS；E3-S7 槽位池输入）', () => {
  it('按地图聚合：墓地 6 / 教堂 5 / 狼穴 4（gdd-enemies-v2 §3.1~3.3；R-C3-RULING 补守墓者）', () => {
    expect(enemiesForMap('map_graveyard')).toHaveLength(6);
    expect(enemiesForMap('map_cathedral')).toHaveLength(5);
    expect(enemiesForMap('map_den')).toHaveLength(4);
    const all = new Set<EnemyId>([
      ...enemiesForMap('map_graveyard'),
      ...enemiesForMap('map_cathedral'),
      ...enemiesForMap('map_den'),
    ]);
    expect(all.size).toBe(15); // 不重不漏
  });

  it('15 敌面板全走配置（spawnByConfig 数据源）；抽查面板值', () => {
    expect(ENEMY_CONFIGS.enemy_g1_1.hp).toBe(12);
    expect(ENEMY_CONFIGS.enemy_g2_4.hp).toBe(500); // 血肉畸体精英
    expect(ENEMY_CONFIGS.enemy_g3_3.hp).toBe(400); // 石甲狼精英
    expect(ENEMY_CONFIGS.enemy_g1_6.hp).toBe(350); // R-C3-RULING 守墓者精英
  });

  it('运行时池分类 runtimeKindForEnemyId：elite→tank / fast·air→wolf / 其余→zombie（死亡溅射/剪影 4 类消费）', () => {
    expect(runtimeKindForEnemyId('enemy_g2_4')).toBe('tank'); // 血肉畸体 elite
    expect(runtimeKindForEnemyId('enemy_g3_3')).toBe('tank'); // 石甲狼 elite
    expect(runtimeKindForEnemyId('enemy_g1_6')).toBe('tank'); // R-C3-RULING 守墓者 elite
    expect(runtimeKindForEnemyId('enemy_g1_2')).toBe('wolf'); // 血犬 fast
    expect(runtimeKindForEnemyId('enemy_g2_2')).toBe('wolf'); // 血蝠 air
    expect(runtimeKindForEnemyId('enemy_g1_1')).toBe('zombie'); // 行尸 normal
    expect(runtimeKindForEnemyId('enemy_g1_5')).toBe('zombie'); // 尸巫 special
  });
});
