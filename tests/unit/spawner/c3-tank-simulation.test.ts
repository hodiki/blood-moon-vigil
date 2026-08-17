import { describe, it, expect } from 'vitest';
import { SPAWNER, ENEMIES } from '@/config/balance';
import { budget, stageForTime, pickEnemyKind, tankGuaranteeDue } from '@/spawner/spawner';
import { mulberry32 } from '@/utils/math';

/**
 * C3 厚血首验（design-review-e2 C3 / FUNC-E2-07 判据）：
 * 模型与 design-review C3 静态模型同构：
 * - 生成：budget(t) 预算 + 阶段权重抽签 + 3–8min 保底（参数化 guaranteeEvery）
 * - 击杀：玩家 DPS（默认 26，design-review「23s/只」口径）全部分摊到厚血，
 *   600 HP 击杀一只；场上厚血 = 生成 − 击杀
 * 决策记录：基线 20s 保底 5 分钟节点场上厚血 >2 只（判据超限）→ 20s→40s（TASK-15）；
 * E4 Sprint 4 用户真机回调 40s→30s（TASK-18 / control-manifest §9 C-7）——3 分钟前权重 0%
 * + 40s 保底双重削弱导致厚血怪"未发现"。30s 后同种子 5 分钟节点 ≤2（判据满足）；
 * 仍偏稀与否的最终裁决归设计侧（C-7 记录），不擅自再调。
 */
interface TankSimOptions {
  guaranteeEvery: number;
  dps: number;
  seed: number;
  simSeconds: number;
}

function simulateTankField(opts: TankSimOptions): { spawned: number; killed: number; onField: number } {
  const rng = mulberry32(opts.seed);
  const dt = 0.1;
  const tankHp = ENEMIES.tank.hp;
  let t = 0;
  let budgetAcc = 0;
  let tankGuaranteeAcc = 0;
  let spawned = 0;
  let alive = 0;
  let tankDamagePool = 0;

  while (t < opts.simSeconds) {
    t += dt;
    budgetAcc += budget(t) * dt;
    const stage = stageForTime(t);
    // 保底仅 3–8min 阶段生效（其余阶段 Infinity）
    const guaranteeEvery = Number.isFinite(stage.tankGuaranteeEvery) ? opts.guaranteeEvery : Number.POSITIVE_INFINITY;
    if (Number.isFinite(guaranteeEvery)) tankGuaranteeAcc += dt;
    else tankGuaranteeAcc = 0;

    while (budgetAcc >= 1) {
      budgetAcc -= 1;
      const forceTank = tankGuaranteeDue(tankGuaranteeAcc, guaranteeEvery);
      const kind = forceTank ? 'tank' : pickEnemyKind(stage.weights, rng());
      if (kind === 'tank') {
        tankGuaranteeAcc = 0; // 自然/保底出厚血都重置累计（与 enemy-spawner 同构）
        spawned += 1;
        alive += 1;
      }
    }

    // 玩家 DPS 分摊到厚血（design-review 模型：600/26 ≈ 23s/只）；
    // 仅场上存在厚血时累计，避免无目标时伤害池虚积（模拟「DPS 转火小怪」）
    if (alive > 0) {
      tankDamagePool += opts.dps * dt;
      while (tankDamagePool >= tankHp && alive > 0) {
        tankDamagePool -= tankHp;
        alive -= 1;
      }
    }
  }
  return { spawned, killed: spawned - alive, onField: alive };
}

const SEED = 42;
const DPS = 26; // design-review C3：玩家 DPS 26

describe('C3 厚血首验（design-review-e2 C3 / FUNC-E2-07 ≤2 判据）', () => {
  it('基线（保底 20s）5 分钟节点场上厚血 >2 只 —— 触发调参预案', () => {
    const r = simulateTankField({ guaranteeEvery: 20, dps: DPS, seed: SEED, simSeconds: 300 });
    expect(r.onField).toBeGreaterThan(2);
  });

  it('调整（保底 30s，同种子）场上厚血下降且 5min 节点 ≤2 —— 回调达标', () => {
    const base = simulateTankField({ guaranteeEvery: 20, dps: DPS, seed: SEED, simSeconds: 300 });
    const adj = simulateTankField({ guaranteeEvery: 30, dps: DPS, seed: SEED, simSeconds: 300 });
    expect(adj.onField).toBeLessThan(base.onField);
    // FUNC-E2-07 判据：5 分钟节点场上厚血 ≤2（保底 30s 后满足；仍偏稀的裁决归设计侧 C-7）
    expect(adj.onField).toBeLessThanOrEqual(2);
  });

  it('balance 已落地 30s 保底（TASK-18 用户真机回调 C-7）', () => {
    expect(SPAWNER.TANK_GUARANTEE_EVERY_SECONDS).toBe(30);
  });
});
