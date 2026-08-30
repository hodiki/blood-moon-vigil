import { describe, it, expect } from 'vitest';
import {
  ENEMY_CONFIGS,
  BOSSES,
  type EnemyId,
  type EnemyTier,
  type MapId,
  type PowerTag,
  type BossId,
} from '@/config/balance';
import { FRAME_BY_CONTENT_ID } from '@/config/frame-registry';
import { enemiesForMap } from '@/enemies/enemy-types';

/**
 * E1-S3 敌人表 15 + Boss 表 4 面板断言（gdd-enemies-v2 §3.1~3.4；
 * content-design-outline §4.2/§4.3 / content-id-frame-map §3）。
 * R-C3-RULING：14→15 补墓地 elite 守墓者 enemy_g1_6。
 * 纯数据层：与 GDD 表逐项一致；特殊行为每地图 ≤2 种；Boss powerTag 由 GDD 明确。
 * S1b 补全：18 项面板逐项断言（HP/移速/伤/攻击间隔/碰撞半径/经验 + 视觉编码帧名 + powerTag）。
 */

const POWER_TAGS: readonly PowerTag[] = ['SILVER', 'HALLOWED', 'BEAST', 'BLOOD', 'MOON'];

describe('敌人表 16（gdd-enemies-v3 §③-2 定稿口径）', () => {
  it('恰好 16 只，内容 ID 全覆盖（enemy_<地图>_<id>；15 + 腐朽骑士 g1_7 方阵专属）', () => {
    const ids = Object.keys(ENEMY_CONFIGS) as EnemyId[];
    expect(ids).toHaveLength(16);
    expect(ids).toEqual([
      'enemy_g1_1', 'enemy_g1_2', 'enemy_g1_3', 'enemy_g1_4', 'enemy_g1_5', 'enemy_g1_6', 'enemy_g1_7',
      'enemy_g2_1', 'enemy_g2_2', 'enemy_g2_3', 'enemy_g2_4', 'enemy_g2_5',
      'enemy_g3_1', 'enemy_g3_2', 'enemy_g3_3', 'enemy_g3_4',
    ]);
  });

  it('腐朽骑士 g1_7 方阵专属（MN-16）：面板锚 + formationOnly 不入任何生成池', () => {
    expect(ENEMY_CONFIGS.enemy_g1_7).toMatchObject({
      name: '腐朽骑士', hp: 280, speed: 90, damage: 14, attackInterval: 1.2, xp: 10, powerTag: 'MOON',
    });
    expect(ENEMY_CONFIGS.enemy_g1_7.formationOnly).toBe(true);
    // enemies-v3 验收 1：不进普通槽位池 —— enemiesForMap 全图过滤（仅方阵/Boss 高威胁技生成）
    for (const map of ['map_graveyard', 'map_cathedral', 'map_den'] as const) {
      expect(enemiesForMap(map)).not.toContain('enemy_g1_7');
    }
  });

  it('powerTag 全覆盖（敌人表未单列，按阵营语义：墓地/教堂 BLOOD、狼穴 BEAST）', () => {
    for (const e of Object.values(ENEMY_CONFIGS)) {
      expect(POWER_TAGS).toContain(e.powerTag);
      expect(e.frame.length).toBeGreaterThan(0);
      expect(e.name.length).toBeGreaterThan(0);
    }
    expect(ENEMY_CONFIGS.enemy_g1_1.powerTag).toBe('BLOOD');
    expect(ENEMY_CONFIGS.enemy_g3_1.powerTag).toBe('BEAST');
  });

  it('地图 1 月下墓地 6 只（gdd-enemies-v3 §③-2/§③-3：甲虫并轨 MN-14 / 亡魂退役 MN-15）', () => {
    expect(ENEMY_CONFIGS.enemy_g1_1).toMatchObject({ name: '行尸', hp: 12, speed: 55, damage: 10, attackInterval: 1.0, radius: 14, xp: 1 });
    expect(ENEMY_CONFIGS.enemy_g1_2).toMatchObject({ name: '血犬', hp: 10, speed: 150, damage: 8, attackInterval: 0.8, radius: 12, xp: 2 });
    // MN-14 变体化：与行尸共用面板/行为（同参数并轨 = 12/55/10/1.0/14），甲虫壳 = 出场皮肤替换
    expect(ENEMY_CONFIGS.enemy_g1_3).toMatchObject({ name: '墓穴甲虫', hp: 12, speed: 55, damage: 10, attackInterval: 1.0, radius: 14, xp: 1 });
    // MN-15 叙事化退役：配置保留 + 补句，生成池移除
    expect(ENEMY_CONFIGS.enemy_g1_4).toMatchObject({ name: '亡魂', retiredNarrative: true, special: expect.stringContaining('退役') });
    expect(ENEMY_CONFIGS.enemy_g1_5).toMatchObject({ name: '尸巫', hp: 16, speed: 45, damage: 6, attackInterval: 1.5, radius: 16, xp: 3, special: expect.stringContaining('光环') });
    // R-C3-RULING：墓地 elite 守墓者（纯厚血精英，无特殊行为）
    expect(ENEMY_CONFIGS.enemy_g1_6).toMatchObject({ name: '守墓者', tier: 'elite', hp: 350, speed: 40, damage: 15, attackInterval: 1.8, radius: 22, xp: 10 });
    expect(ENEMY_CONFIGS.enemy_g1_6.special).toBeUndefined();
  });

  it('地图 2 血教堂 5 只：血信徒/血蝠/圣杯侍僧/血肉畸体/忏悔者（§3.2 面板）', () => {
    expect(ENEMY_CONFIGS.enemy_g2_1).toMatchObject({ name: '血信徒', hp: 14, speed: 60, damage: 12, attackInterval: 1.0, radius: 14, xp: 1 });
    // 血蝠 tier='air'（空中=相位障碍无效）是层级属性，GDD 特殊行为列记为「—」，不计入特殊行为计数
    expect(ENEMY_CONFIGS.enemy_g2_2).toMatchObject({ name: '血蝠', hp: 8, speed: 130, damage: 8, attackInterval: 0.8, radius: 10, xp: 2, tier: 'air' });
    expect(ENEMY_CONFIGS.enemy_g2_2.special).toBeUndefined();
    expect(ENEMY_CONFIGS.enemy_g2_3).toMatchObject({ name: '圣杯侍僧', hp: 16, speed: 50, damage: 8, attackInterval: 1.2, radius: 15, xp: 3, special: expect.stringContaining('召唤') });
    expect(ENEMY_CONFIGS.enemy_g2_4).toMatchObject({ name: '血肉畸体', hp: 500, speed: 40, damage: 18, attackInterval: 1.8, radius: 24, xp: 12 });
    // MN-17 升格精英（§③-4-5）：340/55/10/1.8/XP 12，轨③ 180s
    expect(ENEMY_CONFIGS.enemy_g2_5).toMatchObject({ name: '忏悔者', tier: 'elite', hp: 340, speed: 55, damage: 10, attackInterval: 1.8, xp: 12, rangedDamage: 8, unlockAt: 180 });
  });

  it('地图 3 狼穴 4 只：灰狼/暗影狼/石甲狼/狼裔猎手（§3.3 面板）', () => {
    expect(ENEMY_CONFIGS.enemy_g3_1).toMatchObject({ name: '灰狼', hp: 12, speed: 85, damage: 10, attackInterval: 0.8, radius: 13, xp: 1 });
    expect(ENEMY_CONFIGS.enemy_g3_2).toMatchObject({ name: '暗影狼', hp: 10, speed: 160, damage: 10, attackInterval: 0.7, radius: 11, xp: 2 });
    expect(ENEMY_CONFIGS.enemy_g3_3).toMatchObject({ name: '石甲狼', hp: 400, speed: 45, damage: 15, attackInterval: 1.8, radius: 22, xp: 10 });
    expect(ENEMY_CONFIGS.enemy_g3_4).toMatchObject({ name: '狼裔猎手', hp: 16, speed: 70, damage: 12, attackInterval: 1.2, radius: 14, xp: 3, special: expect.stringContaining('冲锋') });
  });

  it('特殊行为敌人每地图 ≤2 种（content-design-outline §4.1；gdd-enemies-v2 ①）', () => {
    const byMap = new Map<MapId, number>();
    for (const e of Object.values(ENEMY_CONFIGS)) {
      if (e.special) byMap.set(e.map, (byMap.get(e.map) ?? 0) + 1);
    }
    expect(byMap.get('map_graveyard')).toBeLessThanOrEqual(2); // 亡魂（相位）+ 尸巫（光环）
    expect(byMap.get('map_cathedral')).toBeLessThanOrEqual(2); // 圣杯侍僧（召唤）+ 忏悔者（远程）；血蝠 tier=air 不计
    expect(byMap.get('map_den')).toBeLessThanOrEqual(2); // 狼裔猎手（冲锋）
  });

  it('反制字段完整：每只普通/特殊怪均有明确反制（gdd-enemies-v2 ① 可检验含义③）', () => {
    for (const e of Object.values(ENEMY_CONFIGS)) {
      expect(e.counter && e.counter.length > 0).toBe(true);
    }
  });
});

describe('Boss 表 4（gdd-enemies-v2 §3.4 / content-design-outline §4.3）', () => {
  it('恰好 4 个，面板与 GDD §3.4 一致', () => {
    expect(Object.keys(BOSSES)).toEqual(['boss_1', 'boss_2', 'boss_3', 'boss_4']);
    expect(BOSSES.boss_1).toMatchObject({ name: '血月尊者', map: 'map_graveyard', hp: 4000, speed: 28, damage: 30, attackInterval: 2.0, radius: 40, xp: 100 });
    expect(BOSSES.boss_2).toMatchObject({ name: '血主教·尼禄', map: 'map_cathedral', hp: 4500, speed: 30, damage: 32, attackInterval: 2.2, radius: 42, xp: 120 });
    expect(BOSSES.boss_3).toMatchObject({ name: '狼王·芬里厄', map: 'map_den', hp: 4200, speed: 32, damage: 30, attackInterval: 2.0, radius: 42, xp: 120 });
    expect(BOSSES.boss_4).toMatchObject({ name: '血月化身', map: 'any', hp: 3000, speed: 40, damage: 25, attackInterval: 1.8, radius: 40, xp: 150 });
  });

  it('powerTag 由 GDD 明确：boss_1/4 = MOON、boss_2 = BLOOD、boss_3 = BEAST', () => {
    expect(BOSSES.boss_1.powerTag).toBe('MOON');
    expect(BOSSES.boss_2.powerTag).toBe('BLOOD');
    expect(BOSSES.boss_3.powerTag).toBe('BEAST');
    expect(BOSSES.boss_4.powerTag).toBe('MOON');
  });

  it('阶段/机制字段：boss_2 召唤、boss_3 冲锋、boss_4 月坠', () => {
    expect(BOSSES.boss_2.phase2).toContain('召唤');
    expect(BOSSES.boss_3.phase2).toContain('冲锋');
    expect(BOSSES.boss_4.phase2).toContain('月坠');
    expect(BOSSES.boss_1.phase2).toBeUndefined(); // 基准 Boss 无阶段 2
  });
});

/**
 * E1-S3 全量（S1b 补全）：gdd-enemies-v2 §3.1~3.3 面板表逐项转写。
 * 视觉编码列 = content-id-frame-map §3 帧名（主帧 + `-v` pose 变体）；
 * powerTag 按 world-bible §3 阵营语义（墓地/教堂亡者与血廷 = BLOOD，狼穴兽群 = BEAST）。
 */
const GDD_ENEMY_PANELS: ReadonlyArray<{
  id: EnemyId;
  name: string;
  map: MapId;
  tier: EnemyTier;
  hp: number;
  speed: number;
  damage: number;
  attackInterval: number;
  radius: number;
  xp: number;
  powerTag: PowerTag;
  frame: string;
  special?: string;
  rangedDamage?: number;
}> = [
  // ---- §3.1 地图 1 · 月下墓地（6；R-C3-RULING 补守墓者）----
  { id: 'enemy_g1_1', name: '行尸', map: 'map_graveyard', tier: 'normal', hp: 12, speed: 55, damage: 10, attackInterval: 1.0, radius: 14, xp: 1, powerTag: 'BLOOD', frame: 'enemy-zombie' },
  { id: 'enemy_g1_2', name: '血犬', map: 'map_graveyard', tier: 'fast', hp: 10, speed: 150, damage: 8, attackInterval: 0.8, radius: 12, xp: 2, powerTag: 'BLOOD', frame: 'enemy-hound' },
  { id: 'enemy_g1_3', name: '墓穴甲虫', map: 'map_graveyard', tier: 'normal', hp: 12, speed: 55, damage: 10, attackInterval: 1.0, radius: 14, xp: 1, powerTag: 'BLOOD', frame: 'enemy-beetle' }, // MN-14 并轨行尸
  { id: 'enemy_g1_4', name: '亡魂', map: 'map_graveyard', tier: 'special', hp: 12, speed: 95, damage: 10, attackInterval: 1.0, radius: 13, xp: 2, powerTag: 'BLOOD', frame: 'enemy-wraith', special: '（退役）曾可穿越障碍；守夜会记录：近百年亡魂渐稀，今夜尤为罕见' }, // MN-15
  { id: 'enemy_g1_5', name: '尸巫', map: 'map_graveyard', tier: 'special', hp: 16, speed: 45, damage: 6, attackInterval: 1.5, radius: 16, xp: 3, powerTag: 'BLOOD', frame: 'enemy-necro', special: '光环：120px 内亡者攻速 +20%（叠 3 层）' },
  { id: 'enemy_g1_6', name: '守墓者', map: 'map_graveyard', tier: 'elite', hp: 350, speed: 40, damage: 15, attackInterval: 1.8, radius: 22, xp: 10, powerTag: 'BLOOD', frame: 'enemy-gravekeeper' },
  // ---- §3.2 地图 2 · 血教堂（5）----
  { id: 'enemy_g2_1', name: '血信徒', map: 'map_cathedral', tier: 'normal', hp: 14, speed: 60, damage: 12, attackInterval: 1.0, radius: 14, xp: 1, powerTag: 'BLOOD', frame: 'enemy-acolyte' },
  { id: 'enemy_g2_2', name: '血蝠', map: 'map_cathedral', tier: 'air', hp: 8, speed: 130, damage: 8, attackInterval: 0.8, radius: 10, xp: 2, powerTag: 'BLOOD', frame: 'enemy-bat' },
  { id: 'enemy_g2_3', name: '圣杯侍僧', map: 'map_cathedral', tier: 'special', hp: 16, speed: 50, damage: 8, attackInterval: 1.2, radius: 15, xp: 3, powerTag: 'BLOOD', frame: 'enemy-cupbearer', special: '每 5s 召唤 1 血信徒（上限 3）' },
  { id: 'enemy_g2_4', name: '血肉畸体', map: 'map_cathedral', tier: 'elite', hp: 500, speed: 40, damage: 18, attackInterval: 1.8, radius: 24, xp: 12, powerTag: 'BLOOD', frame: 'enemy-fleshmass' },
  { id: 'enemy_g2_5', name: '忏悔者', map: 'map_cathedral', tier: 'elite', hp: 340, speed: 55, damage: 10, attackInterval: 1.8, radius: 15, xp: 12, powerTag: 'BLOOD', frame: 'enemy-penitent', special: '弹幕与血渍：260~320px 轮射 3 连烛火弹 + 血渍减速 15%/2s', rangedDamage: 8 }, // MN-17 升格
  // ---- §3.3 地图 3 · 狼穴（4）----
  { id: 'enemy_g3_1', name: '灰狼', map: 'map_den', tier: 'fast', hp: 12, speed: 85, damage: 10, attackInterval: 0.8, radius: 13, xp: 1, powerTag: 'BEAST', frame: 'enemy-greywolf' },
  { id: 'enemy_g3_2', name: '暗影狼', map: 'map_den', tier: 'fast', hp: 10, speed: 160, damage: 10, attackInterval: 0.7, radius: 11, xp: 2, powerTag: 'BEAST', frame: 'enemy-shadowwolf' },
  { id: 'enemy_g3_3', name: '石甲狼', map: 'map_den', tier: 'elite', hp: 400, speed: 45, damage: 15, attackInterval: 1.8, radius: 22, xp: 10, powerTag: 'BEAST', frame: 'enemy-stonewolf' },
  { id: 'enemy_g3_4', name: '狼裔猎手', map: 'map_den', tier: 'special', hp: 16, speed: 70, damage: 12, attackInterval: 1.2, radius: 14, xp: 3, powerTag: 'BEAST', frame: 'enemy-wolfhunter', special: '每 6s 蓄力冲锋（警告线后冲刺 500px/s）' },
];

describe('E1-S3 敌人 15 全量面板断言（gdd-enemies-v2 §3.1~3.3 逐项）', () => {
  it('HP/移速/伤/攻击间隔/碰撞半径/经验/层级逐项与 GDD 表一致', () => {
    for (const row of GDD_ENEMY_PANELS) {
      const e = ENEMY_CONFIGS[row.id];
      expect(e).toMatchObject({
        id: row.id,
        name: row.name,
        map: row.map,
        tier: row.tier,
        hp: row.hp,
        speed: row.speed,
        damage: row.damage,
        attackInterval: row.attackInterval,
        radius: row.radius,
        xp: row.xp,
      });
    }
  });

  it('powerTag 逐敌断言：墓地/教堂 = BLOOD、狼穴 = BEAST（world-bible §3 阵营语义）', () => {
    for (const row of GDD_ENEMY_PANELS) {
      expect(ENEMY_CONFIGS[row.id].powerTag).toBe(row.powerTag);
    }
    // 边界抽查：BLOOD 与 BEAST 均出现且无 MOON（MOON 仅 Boss 血月亲军，§3.4）
    expect(GDD_ENEMY_PANELS.filter((r) => r.powerTag === 'BLOOD')).toHaveLength(11); // 墓地 6 + 教堂 5（R-C3-RULING 守墓者 BLOOD）
    expect(GDD_ENEMY_PANELS.filter((r) => r.powerTag === 'BEAST')).toHaveLength(4);
  });

  it('视觉编码（帧名）与 content-id-frame-map §3 闭合：每敌主帧 + `-v` pose 变体', () => {
    for (const row of GDD_ENEMY_PANELS) {
      expect(ENEMY_CONFIGS[row.id].frame).toBe(row.frame);
      const frames = FRAME_BY_CONTENT_ID[row.id];
      expect(frames).toBeDefined();
      expect(frames).toContain(row.frame);
      expect(frames).toContain(`${row.frame}-v`);
    }
  });

  it('特殊行为列逐项与 GDD 一致（无 = undefined；远程怪投射伤害单列）', () => {
    for (const row of GDD_ENEMY_PANELS) {
      const e = ENEMY_CONFIGS[row.id];
      if (row.special) expect(e.special).toBe(row.special);
      else expect(e.special).toBeUndefined();
      if (row.rangedDamage !== undefined) expect(e.rangedDamage).toBe(row.rangedDamage);
      else expect(e.rangedDamage).toBeUndefined();
    }
    expect(ENEMY_CONFIGS.enemy_g2_5.rangedDamage).toBe(8); // 忏悔者烛火弹（精英技能伤锚，W-16 消费）
  });

  it('掉落 XP 与 §5.3 对齐：普通 1~3 / 精英 12·10·10（血肉畸体 12、石甲狼 10、守墓者 10）', () => {
    for (const row of GDD_ENEMY_PANELS) {
      const e = ENEMY_CONFIGS[row.id];
      if (e.tier === 'elite') {
        expect([10, 12]).toContain(e.xp);
      } else {
        expect(e.xp).toBeGreaterThanOrEqual(1);
        expect(e.xp).toBeLessThanOrEqual(3);
      }
    }
    expect(ENEMY_CONFIGS.enemy_g2_4.xp).toBe(12);
    expect(ENEMY_CONFIGS.enemy_g3_3.xp).toBe(10);
    expect(ENEMY_CONFIGS.enemy_g1_6.xp).toBe(10); // R-C3-RULING 守墓者
  });
});

/** E1-S3 Boss 全量：gdd-enemies-v2 §3.4 面板表逐项转写 */
const GDD_BOSS_PANELS: ReadonlyArray<{
  id: BossId;
  name: string;
  map: MapId | 'any';
  hp: number;
  speed: number;
  damage: number;
  attackInterval: number;
  radius: number;
  xp: number;
  powerTag: PowerTag;
  frame: string;
  visualKeyword: readonly string[];
}> = [
  { id: 'boss_1', name: '血月尊者', map: 'map_graveyard', hp: 4000, speed: 28, damage: 30, attackInterval: 2.0, radius: 40, xp: 100, powerTag: 'MOON', frame: 'enemy-boss', visualKeyword: ['残破守夜袍', '锈蚀', '提灯'] },
  { id: 'boss_2', name: '血主教·尼禄', map: 'map_cathedral', hp: 4500, speed: 30, damage: 32, attackInterval: 2.2, radius: 42, xp: 120, powerTag: 'BLOOD', frame: 'boss-cardinal', visualKeyword: ['主教冠冕', '圣杯'] },
  { id: 'boss_3', name: '狼王·芬里厄', map: 'map_den', hp: 4200, speed: 32, damage: 30, attackInterval: 2.0, radius: 42, xp: 120, powerTag: 'BEAST', frame: 'boss-fenrir', visualKeyword: ['狼鬃王冠'] },
  { id: 'boss_4', name: '血月化身', map: 'any', hp: 3000, speed: 40, damage: 25, attackInterval: 1.8, radius: 40, xp: 150, powerTag: 'MOON', frame: 'boss-moonavatar', visualKeyword: ['半透明', '月光人形'] },
];

describe('E1-S3 Boss 4 全量面板断言（gdd-enemies-v2 §3.4 逐项）', () => {
  it('HP/移速/伤/攻击间隔/碰撞半径/经验逐项与 GDD 表一致', () => {
    for (const row of GDD_BOSS_PANELS) {
      expect(BOSSES[row.id]).toMatchObject({
        id: row.id,
        name: row.name,
        map: row.map,
        hp: row.hp,
        speed: row.speed,
        damage: row.damage,
        attackInterval: row.attackInterval,
        radius: row.radius,
        xp: row.xp,
      });
    }
  });

  it('powerTag 由 GDD 明确：boss_1/4 = MOON、boss_2 = BLOOD、boss_3 = BEAST', () => {
    for (const row of GDD_BOSS_PANELS) {
      expect(BOSSES[row.id].powerTag).toBe(row.powerTag);
    }
  });

  it('视觉编码（帧名）与 content-id-frame-map §3 闭合：主帧 + `-v`；boss_2/3/4 另含 `-entrance` 出场帧', () => {
    for (const row of GDD_BOSS_PANELS) {
      expect(BOSSES[row.id].frame).toBe(row.frame);
      const frames = FRAME_BY_CONTENT_ID[row.id];
      expect(frames).toBeDefined();
      expect(frames).toContain(row.frame);
      expect(frames).toContain(`${row.frame}-v`);
    }
    expect(FRAME_BY_CONTENT_ID.boss_2).toContain('boss-cardinal-entrance');
    expect(FRAME_BY_CONTENT_ID.boss_3).toContain('boss-fenrir-entrance');
    expect(FRAME_BY_CONTENT_ID.boss_4).toContain('boss-moonavatar-entrance');
    expect(FRAME_BY_CONTENT_ID.boss_1).not.toContain('enemy-boss-entrance'); // 基准 Boss 无 entrance 帧
  });

  it('visual 视觉编码字段含身份锚点（B9：血月尊者残破守夜袍 + 锈蚀提灯）', () => {
    for (const row of GDD_BOSS_PANELS) {
      const visual = BOSSES[row.id].visual;
      expect(visual.length).toBeGreaterThan(0);
      for (const kw of row.visualKeyword) expect(visual).toContain(kw);
    }
  });

  it('Boss XP 100~150 且 §3.4 逐项 100/120/120/150', () => {
    expect(BOSSES.boss_1.xp).toBe(100);
    expect(BOSSES.boss_2.xp).toBe(120);
    expect(BOSSES.boss_3.xp).toBe(120);
    expect(BOSSES.boss_4.xp).toBe(150);
    for (const b of Object.values(BOSSES)) {
      expect(b.xp).toBeGreaterThanOrEqual(100);
      expect(b.xp).toBeLessThanOrEqual(150);
    }
  });

  it('Boss 战时长判据素材：HP 与 §3.4 一致（4000/4500/4200/3000），血月化身低于收束 Boss（稀有奖励非进度门）', () => {
    expect(BOSSES.boss_4.hp).toBeLessThan(BOSSES.boss_1.hp);
    expect(BOSSES.boss_4.hp).toBeLessThan(BOSSES.boss_2.hp);
    expect(BOSSES.boss_4.hp).toBeLessThan(BOSSES.boss_3.hp);
  });
});
