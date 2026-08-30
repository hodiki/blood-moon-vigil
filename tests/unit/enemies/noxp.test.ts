import { describe, it, expect } from 'vitest';
import {
  ENEMY_CONFIGS,
  BOSSES,
  type MapId,
} from '@/config/balance';
import {
  isNoXpSource,
  xpAwardForKill,
  DECOY_XP_MULT,
  SKILL_SUMMON_SOURCES,
  applyCaseHpLink,
  type KillXpSource,
} from '@/enemies/noxp';
import { enemiesForMap } from '@/enemies/enemy-types';

/**
 * W-12 召唤物 noXp 全量原则（gdd-spawner-v2 §③-7 / gdd-enemies-v3 F-4 / MN-23）：
 * - 判定口径：生成来源 = 敌方技能 → noXp；生成来源 = 生成器/方阵本体 → 正常 XP。
 * - 祭品（decoy）方阵本体特例 XP ×3；狂化复活体/召唤物 noXp。
 * - c 案 HP 联动锚（gdd-difficulty-v3 §5.1 SC-2）：字段位挂点 + 精英不吃。
 */

describe('noXp 来源判定口径（spawner-v2 §③-7）', () => {
  it('敌方技能来源 → noXp=true（方阵召唤/普通敌技能/Boss 技能）', () => {
    expect(isNoXpSource('formation-summon')).toBe(true);
    expect(isNoXpSource('enemy-skill')).toBe(true);
    expect(isNoXpSource('boss-skill')).toBe(true);
  });

  it('生成器来源 → noXp=false（槽位池/保底预约/方阵本体）', () => {
    expect(isNoXpSource('spawner-slot')).toBe(false);
    expect(isNoXpSource('spawner-guarantee')).toBe(false);
    expect(isNoXpSource('formation-body')).toBe(false);
  });

  it('正表恰好 3 条技能来源（判定口径防漂移）', () => {
    expect(SKILL_SUMMON_SOURCES).toHaveLength(3);
  });
});

describe('击杀 XP 结算 xpAwardForKill（唯一出口；kills/xpGained 分账口径）', () => {
  it('noXp 实体 → 0（宝石零生成路径，F-4 天然区分）', () => {
    expect(xpAwardForKill({ baseXp: 3, noXp: true })).toBe(0);
    expect(xpAwardForKill({ baseXp: 100, noXp: true })).toBe(0);
  });

  it('方阵本体成员 → 按敌种面板 XP（MN-25 保守锚：面板 + 宝石簇 + 召唤物 0）', () => {
    expect(xpAwardForKill({ baseXp: ENEMY_CONFIGS.enemy_g1_5.xp, noXp: false })).toBe(3);
    expect(xpAwardForKill({ baseXp: ENEMY_CONFIGS.enemy_g1_7.xp, noXp: false })).toBe(10);
  });

  it('祭品（decoy）→ XP ×3（enemies-v3 §③-6 阵 9 高价值诱饵锚）', () => {
    expect(DECOY_XP_MULT).toBe(3);
    expect(xpAwardForKill({ baseXp: 1, noXp: false, decoy: true })).toBe(3);
  });

  it('noXp 优先于 decoy（狂化复活体等技能实体即便带诱饵语义也是 0）', () => {
    expect(xpAwardForKill({ baseXp: 3, noXp: true, decoy: true })).toBe(0);
  });
});

describe('静态 noXp 配置字段位（ENEMY_CONFIGS）', () => {
  it('既有 15 敌无 noXp 标记（noXp 属动态召唤/后续敌技整档标记；g1_7 方阵本体不掉）', () => {
    const flagged = Object.values(ENEMY_CONFIGS).filter((e) => e.noXp === true);
    expect(flagged).toEqual([]);
  });

  it('enemiesForMap 全图不含方阵专属 g1_7（验收 1：仅方阵/Boss 生成断言）', () => {
    for (const map of ['map_graveyard', 'map_cathedral', 'map_den'] as const satisfies readonly MapId[]) {
      expect(enemiesForMap(map).includes('enemy_g1_7')).toBe(false);
    }
  });
});

describe('c 案 HP 联动锚字段位（gdd-difficulty-v3 §5.1 SC-2 ×1.05~1.20 预留）', () => {
  it('未启用（undefined）→ 面板原值', () => {
    expect(applyCaseHpLink(12, undefined, 'normal')).toBe(12);
  });

  it('普通敌 → 面板 × 联动系数（c-温和下限 1.05 / c-陡峭上限 1.20 区间内）', () => {
    expect(applyCaseHpLink(12, 1.05, 'normal')).toBeCloseTo(12.6, 6);
    expect(applyCaseHpLink(12, 1.2, 'normal')).toBeCloseTo(14.4, 6);
  });

  it('精英不吃联动（独立曲线：350~500 HP 基座）', () => {
    expect(applyCaseHpLink(ENEMY_CONFIGS.enemy_g1_6.hp, 1.15, 'elite')).toBe(350);
  });

  it('Boss 不吃联动（独立曲线：3000~4500 锚）', () => {
    expect(applyCaseHpLink(BOSSES.boss_1.hp, 1.15, 'boss')).toBe(4000);
  });
});

describe('全量召唤来源枚举自洽（防来源登记漏项）', () => {
  it('KillXpSource 全枚举可判定（isNoXpSource 对每个值返回布尔）', () => {
    const all: KillXpSource[] = [
      'spawner-slot', 'spawner-guarantee', 'formation-body',
      'formation-summon', 'enemy-skill', 'boss-skill',
    ];
    for (const s of all) expect(typeof isNoXpSource(s)).toBe('boolean');
  });
});
