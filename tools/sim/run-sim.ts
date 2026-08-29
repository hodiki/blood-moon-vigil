/**
 * tools/sim/run-sim.ts —— 整局模拟沙盘 CLI 入口（B1 骨架冒烟）
 *
 * 运行（vite-node 复用 src 真实模块，模式沿用 tests/bench/bench-run.ts）：
 *   npx vite-node tools/sim/run-sim.ts                 # 默认 10 局冒烟（3 图 × 种子基线）
 *   npx vite-node tools/sim/run-sim.ts --runs 50       # 指定局数
 *   npx vite-node tools/sim/run-sim.ts --seed 42       # 指定基线种子（各局 seed 递增）
 *
 * 输出：结构化 JSON（SimSummary + 逐局 RunMetrics）打到 stdout；
 * 指标校准与 5000-run 大批量留后续批次（eng-impact-assessment §4.3）。
 */

import type { MapId } from '@/config/balance';
import { simulateRun, summarizeRuns, type RunMetrics } from './sim-run';

function argValue(flag: string, fallback: number): number {
  const i = process.argv.indexOf(flag);
  return i >= 0 && i + 1 < process.argv.length ? Number(process.argv[i + 1]) || fallback : fallback;
}

const runs = argValue('--runs', 10);
const baseSeed = Math.floor(argValue('--seed', 20260829));
/** 3 图轮转（后续批次扩 loadout/角色矩阵） */
const mapCycle: MapId[] = ['map_graveyard', 'map_cathedral', 'map_den'];

const all: RunMetrics[] = [];
for (let i = 0; i < runs; i += 1) {
  const mapId = mapCycle[i % mapCycle.length] ?? mapCycle[0]!;
  const run = simulateRun({ seed: baseSeed + i, mapId });
  all.push(run);
  // eslint-disable-next-line no-console
  console.log(
    `[sim] 局 ${i + 1}/${runs} seed=${run.seed} map=${run.mapId} ` +
      `death=${run.deathTimeSeconds ?? 'survived'} bossKilled=${run.bossKilled} ` +
      `lv=${run.levelReached} kills=${run.kills} offers=${run.levelUpOffers.length}`,
  );
}

// eslint-disable-next-line no-console
console.log(JSON.stringify(summarizeRuns(all), null, 2));
