import { describe, it, expect } from 'vitest';
import {
  budget,
  budgetMean,
  stageForTime,
  pickEnemyKind,
  tankGuaranteeDue,
  spawnPosition,
  SPAWN_STAGES,
} from '@/spawner/spawner';
import { SPAWNER } from '@/config/balance';

describe('生成预算 budget(t)（E2-S4 / spawner §③ / S8-1）', () => {
  // 任务指定断言点 t=0/300/600/1200（恰为 sin(2πt/75)=0，与压力曲线表一致）
  it('t=0/300/600/1200 期望值 1.2 / 1.95 / 2.7 / 4.2（±1e-6）', () => {
    expect(budget(0)).toBeCloseTo(1.2, 6);
    expect(budget(300)).toBeCloseTo(1.95, 6);
    expect(budget(600)).toBeCloseTo(2.7, 6);
    expect(budget(1200)).toBeCloseTo(4.2, 6);
  });

  it('压力曲线表为「平均预算」（budgetMean，正弦项均值为 0）：60→1.35 … 1080→3.9', () => {
    const table: [number, number][] = [
      [0, 1.2], [60, 1.35], [180, 1.65], [300, 1.95], [480, 2.4],
      [720, 3.0], [900, 3.45], [1080, 3.9], [1200, 4.2],
    ];
    for (const [t, expected] of table) {
      expect(budgetMean(t)).toBeCloseTo(expected, 6);
    }
  });

  it('正弦项 ±40%：波峰 = 平均 ×1.4、波谷 = 平均 ×0.6（spawner §③）', () => {
    expect(budget(18.75)).toBeCloseTo(budgetMean(18.75) * 1.4, 6); // 峰值（sin=1）
    expect(budget(56.25)).toBeCloseTo(budgetMean(56.25) * 0.6, 6); // 谷值（sin=-1）
  });

  it('相邻 75s 周期生成速率差异 ≥40%（波峰波谷可感知，S8-3）', () => {
    const samples: number[] = [];
    for (let t = 0; t <= 1200; t += 5) samples.push(budget(t));
    const peak = Math.max(...samples);
    const trough = Math.min(...samples);
    expect((peak - trough) / trough).toBeGreaterThanOrEqual(0.4);
  });

  it('20 分钟线性项达 4.2 点/s（1.2×(1+2.5×1200/1200)）', () => {
    expect(budget(1200)).toBeCloseTo(4.2, 6);
  });
});

describe('构成权重阶段表（spawner §③ / S8-1）', () => {
  it('0–3min：95/5/0，无厚血保底', () => {
    const stage = stageForTime(60);
    expect(stage.weights).toEqual({ zombie: 0.95, wolf: 0.05, tank: 0 });
    expect(Number.isFinite(stage.tankGuaranteeEvery)).toBe(false);
  });

  it('3–8min：80/17/3，每 30s 保底 1 厚血（E4 Sprint4 用户回调 40→30，C-7）', () => {
    const stage = stageForTime(300);
    expect(stage.weights).toEqual({ zombie: 0.8, wolf: 0.17, tank: 0.03 });
    expect(stage.tankGuaranteeEvery).toBe(30);
  });

  it('8–15min：65/28/7，无保底', () => {
    expect(stageForTime(600).weights).toEqual({ zombie: 0.65, wolf: 0.28, tank: 0.07 });
    expect(Number.isFinite(stageForTime(600).tankGuaranteeEvery)).toBe(false);
  });

  it('15–20min：50/35/15，无保底', () => {
    expect(stageForTime(1000).weights).toEqual({ zombie: 0.5, wolf: 0.35, tank: 0.15 });
  });

  it('阶段边界：t=180/480/900 进入下一阶段（左闭右开）', () => {
    expect(stageForTime(179.9).weights.zombie).toBe(0.95);
    expect(stageForTime(180).weights.zombie).toBe(0.8);
    expect(stageForTime(480).weights.zombie).toBe(0.65);
    expect(stageForTime(900).weights.zombie).toBe(0.5);
  });

  it('阶段表覆盖 0→BOSS_TIME 且末阶段收于 1200（S8-4 收束钩子）', () => {
    expect(SPAWN_STAGES[0]!.start).toBe(0);
    expect(SPAWN_STAGES[SPAWN_STAGES.length - 1]!.end).toBe(SPAWNER.BOSS_TIME);
  });
});

describe('抽签与保底（纯函数）', () => {
  it('pickEnemyKind 按权重区间抽签（r∈[0,1)）', () => {
    const stage1 = { zombie: 0.95, wolf: 0.05, tank: 0 };
    expect(pickEnemyKind(stage1, 0.5)).toBe('zombie');
    expect(pickEnemyKind(stage1, 0.96)).toBe('wolf'); // tank 权重 0 抽不到
    const stage2 = { zombie: 0.8, wolf: 0.17, tank: 0.03 };
    expect(pickEnemyKind(stage2, 0.5)).toBe('zombie');
    expect(pickEnemyKind(stage2, 0.9)).toBe('wolf');
    expect(pickEnemyKind(stage2, 0.98)).toBe('tank');
  });

  it('tankGuaranteeDue：累计达标才强制厚血；无保底阶段恒 false', () => {
    expect(tankGuaranteeDue(19, 20)).toBe(false);
    expect(tankGuaranteeDue(20, 20)).toBe(true);
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
