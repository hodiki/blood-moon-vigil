import { describe, it, expect } from 'vitest';
import {
  scaleForTime,
  mercyMult,
  applyPanelScale,
  SCALE_ANCHORS,
  MERCY,
  expectedLevelFor,
} from '@/enemies/panel-scale';
import { applyCaseHpLink } from '@/enemies/noxp';
import { pickEnemyIdForMap, MAP_ENEMY_SLOTS } from '@/spawner/map-spawner';
import { weightedWeightsForStage } from '@/spawner/map-spawner';
import { stageForTime } from '@/spawner/spawner';
import { ENEMY_CONFIGS, BOSSES, type MapId } from '@/config/balance';
import { ENEMIES as LEGACY_ENEMIES } from '../../../src/_archived/enemies-legacy-panel';

/**
 * W-8/W-9/W-1/W-3 基线批收口断言（NV-MON-IMPL-2）：
 * - W-8 M3 混合缩放（0~60s 豁免 / 360s 终值 / 滞后宽容）+ legacy ENEMIES 收档
 * - W-9 轨① per-kind unlockAt 过滤 + 回退
 * - W-3 Boss 面板单源化（BOSSES ccProfile 覆写）
 */

describe('W-8 M3 混合缩放 scale(t)（gdd-difficulty-v3 §5.1 MN-1）', () => {
  it('0~60s 豁免 = 1.0（H2 对冲怪物侧条款断言）', () => {
    expect(scaleForTime(0)).toBe(1);
    expect(scaleForTime(30)).toBe(1);
    expect(scaleForTime(60)).toBe(1);
  });

  it('60~120s 线性爬入（90s = 段内中点）', () => {
    const [m60, m120] = [SCALE_ANCHORS[1]![1], SCALE_ANCHORS[2]![1]];
    expect(scaleForTime(90)).toBeCloseTo((m60 + m120) / 2, 6);
  });

  it('360s 终值锚 2.2~3.2（当前参数化 2.7 中值）', () => {
    expect(scaleForTime(360)).toBeGreaterThanOrEqual(2.2);
    expect(scaleForTime(360)).toBeLessThanOrEqual(3.2);
  });

  it('t 越界 clamp（负值/超 360 → 端点）', () => {
    expect(scaleForTime(-10)).toBe(1);
    expect(scaleForTime(400)).toBe(scaleForTime(360));
  });

  it('等级滞后宽容：滞后 <3 级不触发；≥3 级每级 −10%、下限 ×0.7（只救落后者）', () => {
    // 预期等级 @120s = 1 + 120/24 = 6
    expect(expectedLevelFor(120)).toBeCloseTo(6, 6);
    expect(mercyMult(6, 120)).toBe(1); // 无滞后
    expect(mercyMult(4, 120)).toBe(1); // 滞后 2 < 3
    expect(mercyMult(3, 120)).toBeCloseTo(1 - 0.1 * 3, 6); // 滞后 3
    expect(mercyMult(0, 120)).toBe(MERCY.MIN_MULT); // 下限钳制
  });

  it('缩放链：HP = base × scale × caseLink × mercy（仅 HP；伤害不动 MN-2）', () => {
    const r = applyPanelScale({ baseHp: 12, t: 360, playerLevel: 20, caseLink: 1.125 });
    // 360s 玩家 Lv20 vs 预期 16 → 无宽容（领先者不削）
    expect(r.mercy).toBe(1);
    expect(r.hp).toBe(Math.round(12 * scaleForTime(360) * 1.125));
    // 落后者：360s 玩家 Lv5 → 预期 16 → 滞后 11 → 宽容钳下限 0.7
    const r2 = applyPanelScale({ baseHp: 12, t: 360, playerLevel: 5 });
    expect(r2.mercy).toBe(0.7);
  });

  it('c 案 HP 联动不吃精英（独立曲线）——缩放链调用方过滤口径复核', () => {
    expect(applyCaseHpLink(ENEMY_CONFIGS.enemy_g2_5.hp, 1.125, 'elite')).toBe(340);
  });
});

describe('W-8 legacy ENEMIES 收档（EG-2 归档不删；运行时零消费）', () => {
  it('归档表数值与历史口径一致（回归对照）', () => {
    expect(LEGACY_ENEMIES.zombie).toEqual({ hp: 12, speed: 55, damage: 10, attackInterval: 1.0, radius: 14, xp: 1 });
    expect(LEGACY_ENEMIES.boss.hp).toBe(4000);
  });

  it('单源化：Boss 面板 = BOSSES 表（非 legacy 4000 硬点；per-map 面板可达）', () => {
    expect(BOSSES.boss_2.hp).toBe(4500);
    expect(BOSSES.boss_3.hp).toBe(4200);
    expect(BOSSES.boss_4.hp).toBe(3000);
  });

  it('W-3 ccProfile 覆写：化身易伤免疫（MN-9 名额 3 之常驻项）', () => {
    expect(BOSSES.boss_4.ccProfile?.ccResistance?.vulnerable?.immune).toBe(true);
  });

  it('P1-18 相位抗性不写常驻配置：石甲狼/芬里厄的减速 ×0.5 改由 AI 运行时按相位覆写', () => {
    // 原实现把「仅石甲期 / 仅蓄力期」的减速折减写进配置恒常驻（抗性范围错误）。
    // 修正后配置侧只留 tier，相位差异走 Enemy.setPhaseCcResistance；
    // 运行时断言见 tests/unit/combat/review-fix-a.test.ts。
    expect(ENEMY_CONFIGS.enemy_g3_3.ccProfile).toEqual({ tier: 'elite' });
    expect(BOSSES.boss_3.ccProfile).toEqual({ tier: 'boss' });
  });
});

describe('W-9 轨① 敌种分批解锁（per-kind unlockAt 过滤 + 回退）', () => {
  it('配置锚：突袭 60~90 / 特殊行为 120~150（血犬 60 / 血蝠 75 / 暗影狼 90 / 尸巫 120 / 侍僧 135 / 猎手 150）', () => {
    expect(ENEMY_CONFIGS.enemy_g1_2.unlockAt).toBe(60);
    expect(ENEMY_CONFIGS.enemy_g2_2.unlockAt).toBe(75);
    expect(ENEMY_CONFIGS.enemy_g3_2.unlockAt).toBe(90);
    expect(ENEMY_CONFIGS.enemy_g1_5.unlockAt).toBe(120);
    expect(ENEMY_CONFIGS.enemy_g2_3.unlockAt).toBe(135);
    expect(ENEMY_CONFIGS.enemy_g3_4.unlockAt).toBe(150);
    // 炮灰 0（缺省）
    expect(ENEMY_CONFIGS.enemy_g1_1.unlockAt).toBeUndefined();
  });

  it('轨① 过滤：墓地 wolf 槽 @50s 全过滤 → 回退基础敌血犬（§③-2 槽基础=突袭档）；@120s 尸巫可达', () => {
    const w = weightedWeightsForStage('map_graveyard', stageForTime(50));
    for (let i = 0; i < 64; i += 1) {
      const r = ((i * 7 + 3) % 100) / 100;
      const subR = ((i * 11 + 5) % 100) / 100;
      if (r >= w.zombie && r < w.zombie + w.wolf) {
        // 血犬(60)/尸巫(120) 全过滤 → 回退槽基础敌血犬（最低 unlockAt）
        expect(pickEnemyIdForMap('map_graveyard', w, r, subR, 50)).toBe('enemy_g1_2');
      }
    }
    // @120s：尸巫（120）可达
    const w2 = weightedWeightsForStage('map_graveyard', stageForTime(120));
    const ids = new Set<string>();
    for (let i = 0; i < 128; i += 1) {
      ids.add(pickEnemyIdForMap('map_graveyard', w2, ((i * 7 + 3) % 100) / 100, ((i * 11 + 5) % 100) / 100, 120));
    }
    expect(ids.has('enemy_g1_5')).toBe(true);
  });

  it('过滤后池空 → 回退该槽 unlockAt=0 基础敌（§⑥-3）', () => {
    // 墓地 wolf 槽 = [血犬(60), 尸巫(120)]；t=50 → 全过滤 → 回退血犬（首个 unlockAt=0 找不到 → 池首）
    const w = weightedWeightsForStage('map_graveyard', stageForTime(50));
    const id = pickEnemyIdForMap('map_graveyard', w, w.zombie, 0.9, 50);
    expect(MAP_ENEMY_SLOTS.map_graveyard.wolf).toContain(id);
  });

  it('结构校验：炮灰槽 unlockAt=0 基础敌恒在；wolf 槽基础 = 突袭档最低 unlockAt（§③-2 口径）', () => {
    for (const map of ['map_graveyard', 'map_cathedral', 'map_den'] as const satisfies readonly MapId[]) {
      for (const slot of ['zombie', 'wolf', 'tank'] as const) {
        const pool = MAP_ENEMY_SLOTS[map][slot];
        expect(pool.length).toBeGreaterThan(0);
        const minUnlock = Math.min(...pool.map((id) => ENEMY_CONFIGS[id].unlockAt ?? 0));
        if (slot === 'zombie') expect(minUnlock).toBe(0); // 炮灰基础盘恒常驻
      }
    }
  });
});
