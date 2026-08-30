import { describe, it, expect } from 'vitest';
import { needXp } from '@/xp/xp-manager';
import { budget, stageForTime, pickEnemyKind } from '@/spawner/spawner';
import { ENEMIES } from '@/../src/_archived/enemies-legacy-panel'; // W-8 收档：legacy 面板归档对照（禁止运行时消费）
import { mulberry32 } from '@/utils/math';

/**
 * 20 分钟经验曲线模拟（U8-5 / RV-C5 埋点断言基线，E3 DoD）：
 * - 生成模型：budget(t) 预算 + 阶段权重抽签（与 enemy-spawner 同构）
 * - efficiency：击杀 + 拾取效率标定（设计评审 §3 指出"宝石拾取率与死亡提前结束会压低
 *   实际等级"，3000–3500 点区间对应效率 ~0.45；原始生成经验为全击杀+全拾取上界）
 */
function simulate20MinXp(efficiency: number, seed: number): { spawnCount: number; rawXp: number; effectiveXp: number; level: number } {
  const rng = mulberry32(seed);
  const dt = 0.1;
  let t = 0;
  let budgetAcc = 0;
  let spawnCount = 0;
  let rawXp = 0;
  while (t < 1200) {
    t += dt;
    budgetAcc += budget(t) * dt;
    while (budgetAcc >= 1) {
      budgetAcc -= 1;
      const stage = stageForTime(t);
      const kind = pickEnemyKind(stage.weights, rng());
      rawXp += ENEMIES[kind].xp;
      spawnCount += 1;
    }
  }
  const effectiveXp = rawXp * efficiency;
  let xp = effectiveXp;
  let level = 1;
  while (xp >= needXp(level) && level < 99) {
    xp -= needXp(level);
    level += 1;
  }
  return { spawnCount, rawXp, effectiveXp, level };
}

describe('20 分钟经验曲线（E3 DoD：累计经验 ≥3000、可达 Lv30+）', () => {
  it('原始生成经验（全击杀+全拾取上界）≥ 3000 点', () => {
    const r = simulate20MinXp(1, 7);
    expect(r.rawXp).toBeGreaterThanOrEqual(3000);
  });

  it('效率 0.45（对齐 design-review 3000–3500 区间）累计经验 ≥ 3000 点', () => {
    const r = simulate20MinXp(0.45, 7);
    expect(r.effectiveXp).toBeGreaterThanOrEqual(3000);
  });

  it('可达 Lv30+（need 曲线消费后 level ≥ 30，U8-5）', () => {
    const r = simulate20MinXp(0.45, 7);
    expect(r.level).toBeGreaterThanOrEqual(30);
  });

  it('模拟可复现（同种子结果一致，RV-C5 埋点可复现）', () => {
    const a = simulate20MinXp(0.45, 7);
    const b = simulate20MinXp(0.45, 7);
    expect(a).toEqual(b);
  });
});
