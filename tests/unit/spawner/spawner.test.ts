import { describe, it, expect } from 'vitest';
import {
  budgetLegacy,
  budgetMean,
  stageForTime,
  pickEnemyKind,
  tankGuaranteeDue,
  spawnPosition,
  SPAWN_STAGES,
} from '@/spawner/spawner';
import {
  MAP_ENEMY_SLOTS,
  applyWeightOverride,
  weightedWeightsForStage,
  pickEnemyIdForMap,
  enemySpeedFor,
  spawnRingFor,
  stageNameFor,
} from '@/spawner/map-spawner';
import { SPAWNER, MAP_CONFIGS, ENEMY_CONFIGS, type MapId } from '@/config/balance';

describe('生成预算 budgetLegacy（EG-2 归档：NV-BATCH-G G2 已切 budgetPiecewise，本组锚保留历史曲线对照；E2-S4 / spawner §③ / S8-1）', () => {
  // 任务指定断言点 t=0/180/360（恰为 sin(2πt/60)=0，与压力曲线表一致）
  it('t=0/180/360 期望值 1.2 / 1.92 / 2.64（±1e-6；TASK-31 收尾 LINEAR 1.2）', () => {
    expect(budgetLegacy(0)).toBeCloseTo(1.2, 6);
    expect(budgetLegacy(180)).toBeCloseTo(1.92, 6);
    expect(budgetLegacy(360)).toBeCloseTo(2.64, 6);
  });

  it('压力曲线表为「平均预算」（budgetMean，正弦项均值为 0）：60→1.44 … 360→2.64（rhythm-pace-adj §4）', () => {
    const table: [number, number][] = [
      [0, 1.2], [60, 1.44], [120, 1.68], [180, 1.92], [240, 2.16], [360, 2.64],
    ];
    for (const [t, expected] of table) {
      expect(budgetMean(t)).toBeCloseTo(expected, 6);
    }
  });

  it('正弦项 ±30%：波峰 = 平均 ×1.3、波谷 = 平均 ×0.7（spawner §③；R1 波次2 0.4→0.3）', () => {
    expect(budgetLegacy(15)).toBeCloseTo(budgetMean(15) * 1.3, 6); // 峰值（sin=1，周期 60s）
    expect(budgetLegacy(45)).toBeCloseTo(budgetMean(45) * 0.7, 6); // 谷值（sin=-1）
  });

  it('相邻 60s 周期生成速率差异 ≥40%（波峰波谷可感知，S8-3；峰谷比 1.3/0.7 ≈ 86% 仍达标）', () => {
    const samples: number[] = [];
    for (let t = 0; t <= 360; t += 5) samples.push(budgetLegacy(t));
    const peak = Math.max(...samples);
    const trough = Math.min(...samples);
    expect((peak - trough) / trough).toBeGreaterThanOrEqual(0.4);
  });

  it('6 分钟线性项达 2.64 点/s（1.2×(1+1.2×360/360)）', () => {
    expect(budgetLegacy(360)).toBeCloseTo(2.64, 6);
  });
});

describe('构成权重阶段表（spawner §③；TASK-31 收尾 rhythm-pace-adj §2：4 段→3 段）', () => {
  it('S1 0–120s：90/9.5/0.5，无厚血保底（随机 0.5% 保留惊喜首见）', () => {
    const stage = stageForTime(60);
    expect(stage.weights).toEqual({ zombie: 0.9, wolf: 0.095, tank: 0.005 });
    expect(Number.isFinite(stage.tankGuaranteeEvery)).toBe(false);
  });

  it('S2 120–240s：80/17/3，每 30s 保底 1 厚血（2:00/2:30/3:00 → 3min 前必见 ≥2 保底精英）', () => {
    const stage = stageForTime(150);
    expect(stage.weights).toEqual({ zombie: 0.8, wolf: 0.17, tank: 0.03 });
    expect(stage.tankGuaranteeEvery).toBe(30);
  });

  it('S3 240–360s：62/33/5，每 20s 保底 1 厚血（Boss 前峰值爬升；TASK-32 裁决 tank 0.12→0.05，rhythm-pace-adj §9）', () => {
    const stage = stageForTime(300);
    expect(stage.weights).toEqual({ zombie: 0.62, wolf: 0.33, tank: 0.05 });
    expect(stage.tankGuaranteeEvery).toBe(20);
  });

  it('阶段边界：t=120/240 进入下一阶段（左闭右开）', () => {
    expect(stageForTime(119.9).weights.zombie).toBe(0.9);
    expect(stageForTime(120).weights.zombie).toBe(0.8);
    expect(stageForTime(240).weights.zombie).toBe(0.62);
  });

  it('阶段表覆盖 0→BOSS_TIME 且末阶段收于 360（S8-4 收束钩子）', () => {
    expect(SPAWN_STAGES[0]!.start).toBe(0);
    expect(SPAWN_STAGES[SPAWN_STAGES.length - 1]!.end).toBe(SPAWNER.BOSS_TIME);
  });
});

describe('抽签与保底（纯函数）', () => {
  it('pickEnemyKind 按权重区间抽签（r∈[0,1)）', () => {
    const stage1 = { zombie: 0.9, wolf: 0.095, tank: 0.005 };
    expect(pickEnemyKind(stage1, 0.5)).toBe('zombie');
    expect(pickEnemyKind(stage1, 0.95)).toBe('wolf'); // 0.95 < 0.995
    expect(pickEnemyKind(stage1, 0.998)).toBe('tank'); // 0.998 ≥ 0.995
    const stage2 = { zombie: 0.8, wolf: 0.17, tank: 0.03 };
    expect(pickEnemyKind(stage2, 0.5)).toBe('zombie');
    expect(pickEnemyKind(stage2, 0.9)).toBe('wolf');
    expect(pickEnemyKind(stage2, 0.99)).toBe('tank');
  });

  it('tankGuaranteeDue：累计达标才强制厚血；无保底阶段恒 false', () => {
    expect(tankGuaranteeDue(19, 20)).toBe(false);
    expect(tankGuaranteeDue(20, 20)).toBe(true);
    expect(tankGuaranteeDue(29, 30)).toBe(false);
    expect(tankGuaranteeDue(30, 30)).toBe(true);
    expect(tankGuaranteeDue(999, Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe('出生环带（S8 §③：距玩家 [ringMin,ringMax] 随机角度，屏外生成）', () => {
  it('angle=0、distFraction=0.5 → (cx+750, cy)（桌面环带 [600,900]）', () => {
    expect(spawnPosition(1500, 1500, 600, 900, 0, 0.5)).toEqual({ x: 2250, y: 1500 });
  });

  it('angle=π/2、distFraction=1 → (cx, cy+900)', () => {
    expect(spawnPosition(1500, 1500, 600, 900, Math.PI / 2, 1)).toEqual({ x: 1500, y: 2400 });
  });

  it('任意采样距离恒在环带内（[600,900]，浮点容差 ±1e-6）', () => {
    for (let i = 0; i < 32; i += 1) {
      const angle = (i / 32) * Math.PI * 2;
      const frac = (i % 4) / 4;
      const p = spawnPosition(1500, 1500, 600, 900, angle, frac);
      const d = Math.hypot(p.x - 1500, p.y - 1500);
      expect(d).toBeGreaterThanOrEqual(600 - 1e-6);
      expect(d).toBeLessThanOrEqual(900 + 1e-6);
    }
  });
});

describe('E3-S7 生成器参数覆盖（gdd-maps §3.4；仅调 wolf，权重和保持 1.00）', () => {
  it('教堂 S2 wolf 0.17→0.22 / S3 wolf 0.33→0.38（快速怪权重 ↑，§3.2）', () => {
    const s2 = weightedWeightsForStage('map_cathedral', stageForTime(150));
    const s3 = weightedWeightsForStage('map_cathedral', stageForTime(300));
    expect(s2.wolf).toBeCloseTo(0.22, 6);
    expect(s3.wolf).toBeCloseTo(0.38, 6);
  });

  it('狼穴 S1/S2/S3 wolf 0.095→0.15 / 0.17→0.24 / 0.33→0.42（野兽构成 ↑，§3.3）', () => {
    expect(weightedWeightsForStage('map_den', stageForTime(60)).wolf).toBeCloseTo(0.15, 6);
    expect(weightedWeightsForStage('map_den', stageForTime(150)).wolf).toBeCloseTo(0.24, 6);
    expect(weightedWeightsForStage('map_den', stageForTime(300)).wolf).toBeCloseTo(0.42, 6);
  });

  it('墓地基准曲线无覆盖（wolf 0.095/0.17/0.33，与 TASK-31 阶段表一致）', () => {
    expect(weightedWeightsForStage('map_graveyard', stageForTime(60))).toEqual({ zombie: 0.9, wolf: 0.095, tank: 0.005 });
    expect(weightedWeightsForStage('map_graveyard', stageForTime(150))).toEqual({ zombie: 0.8, wolf: 0.17, tank: 0.03 });
    expect(weightedWeightsForStage('map_graveyard', stageForTime(300))).toEqual({ zombie: 0.62, wolf: 0.33, tank: 0.05 });
  });

  it('权重和 = 1.00（覆盖后 z/t 相应减；±1e-6）', () => {
    for (const mapId of ['map_graveyard', 'map_cathedral', 'map_den'] as const) {
      for (const t of [60, 150, 300]) {
        const w = weightedWeightsForStage(mapId, stageForTime(t));
        expect(w.zombie + w.wolf + w.tank).toBeCloseTo(1.0, 6);
        expect(w.zombie).toBeGreaterThan(0);
        expect(w.wolf).toBeGreaterThan(0);
        expect(w.tank).toBeGreaterThan(0);
      }
    }
  });

  it('applyWeightOverride 纯函数：wolf 增量 + zombie/tank 比例削减（round6 容差）', () => {
    const w = applyWeightOverride({ zombie: 0.62, wolf: 0.33, tank: 0.05 }, 0.05);
    expect(w.wolf).toBeCloseTo(0.38, 6);
    expect(w.zombie).toBeCloseTo(0.62 - 0.05 * (0.62 / 0.67), 6);
    expect(w.tank).toBeCloseTo(0.05 - 0.05 * (0.05 / 0.67), 6);
    expect(w.zombie + w.wolf + w.tank).toBeCloseTo(1.0, 6);
    expect(applyWeightOverride({ zombie: 0.9, wolf: 0.095, tank: 0.005 }, 0)).toEqual({ zombie: 0.9, wolf: 0.095, tank: 0.005 });
  });

  it('狼穴全敌移速加权 ×1.08（enemySpeedFor；MAP_CONFIGS 驱动）', () => {
    expect(MAP_CONFIGS.map_den.enemySpeedMultiplier).toBe(1.08);
    expect(enemySpeedFor('map_den', 55)).toBeCloseTo(59.4, 6);
    expect(enemySpeedFor('map_graveyard', 55)).toBeCloseTo(55, 6);
    expect(enemySpeedFor('map_cathedral', 55)).toBeCloseTo(55, 6);
  });

  it('出生环带覆盖：教堂桌面 [500,800] / 移动 [420,680]（§3.2 回廊入场可见对齐）', () => {
    expect(spawnRingFor('map_cathedral', false)).toEqual([500, 800]);
    expect(spawnRingFor('map_cathedral', true)).toEqual([420, 680]);
    expect(spawnRingFor('map_graveyard', false)).toEqual([600, 900]);
    expect(spawnRingFor('map_den', true)).toEqual([500, 800]);
  });

  it('槽位池：每地图槽位 ⊆ 该图敌人（zombie/wolf/tank 三槽覆盖 15 敌不重不漏；R-C3-RULING）', () => {
    const all = new Set<string>();
    for (const mapId of Object.keys(MAP_ENEMY_SLOTS) as MapId[]) {
      for (const slot of ['zombie', 'wolf', 'tank'] as const) {
        for (const id of MAP_ENEMY_SLOTS[mapId][slot]) {
          expect(ENEMY_CONFIGS[id].map).toBe(mapId); // 槽位敌人属于该图
          all.add(id);
        }
      }
    }
    expect(all.size).toBe(15);
  });

  it('pickEnemyIdForMap：权重抽槽位 → 槽内选具体敌（r 抽槽、subR 选敌）', () => {
    const w = weightedWeightsForStage('map_graveyard', stageForTime(300)); // {0.62, 0.33, 0.05}
    expect(pickEnemyIdForMap('map_graveyard', w, 0.5, 0)).toBe('enemy_g1_1'); // zombie 槽第 1 只
    expect(pickEnemyIdForMap('map_graveyard', w, 0.9, 0)).toBe('enemy_g1_2'); // wolf 槽（0.62 ≤ 0.9 < 0.95）
    expect(pickEnemyIdForMap('map_graveyard', w, 0.9, 0.9)).toBe('enemy_g1_5'); // wolf 槽第 3 只（R-C3-RULING：尸巫归 wolf）
    expect(pickEnemyIdForMap('map_graveyard', w, 0.99, 0)).toBe('enemy_g1_6'); // tank 槽（R-C3-RULING：tank 只放 elite 守墓者）
  });

  it('stageNameFor：阶段表 start → S1/S2/S3（覆盖表联动）', () => {
    expect(stageNameFor(stageForTime(60))).toBe('S1');
    expect(stageNameFor(stageForTime(150))).toBe('S2');
    expect(stageNameFor(stageForTime(300))).toBe('S3');
  });
});
