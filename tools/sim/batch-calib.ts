/**
 * tools/sim/batch-calib.ts —— 校准批跑矩阵（SIM-W2，eng-impact §4.3）
 *
 * CLI：npx vite-node tools/sim/batch-calib.ts --seeds 25 [--out calib-report.json]
 * 矩阵：8 专武 × 4 树工况（none/b/bd/bds1）× seeds（movement 生存口径）
 *      + 8 专武 × 4 工况 × 5 种子（invincible DPS 平台带口径）
 * 输出：每工况聚合（死亡中位/存活率/首伤中位/等级/offer 数/DPS 平台带 + 窗口峰值）→ JSON 供校准报告引用。
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ExclusiveWeaponId, MapId } from '@/config/balance';
import { simulateRun } from './sim-run';
import { treeScenarioDps, type TreeScenario } from './sim-config';

function argValue(flag: string, fallback: number): number {
  const i = process.argv.indexOf(flag);
  return i >= 0 && i + 1 < process.argv.length ? Number(process.argv[i + 1]) || fallback : fallback;
}

const seeds = Math.max(1, Math.floor(argValue('--seeds', 25)));
const baseSeed = Math.floor(argValue('--seed', 20260830));

const EXCLUSIVES: ExclusiveWeaponId[] = [
  'xw_lantern', 'xw_revolver', 'xw_twinblades', 'xw_longbow',
  'xw_bell', 'xw_cross', 'xw_axe', 'xw_horn',
];
const MAPS: MapId[] = ['map_graveyard', 'map_cathedral', 'map_den'];
const SCENARIOS: TreeScenario[] = ['none', 'b', 'bd', 'bds1'];

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const a = s[mid - 1];
  const b = s[mid];
  return s.length % 2 === 1 || a === undefined || b === undefined ? (b ?? a ?? 0) : (a + b) / 2;
}
const r2 = (v: number): number => Math.round(v * 100) / 100;

interface ScenarioAgg {
  scenario: TreeScenario;
  runs: number;
  /** 死亡时点中位 s（null = 全存活） */
  medianDeathTime: number | null;
  /** 首次承伤时点中位 s（MD-1 首死/首伤判据输入） */
  medianFirstHit: number | null;
  survivalRate: number;
  bossKillRate: number;
  medianLevel: number;
  medianOffers: number;
  /** 开局 DPS 平台带（invincible 口径；30/60s 桶中位） */
  openingDps: { at30: number; at60: number };
  /** 窗口峰值（bds1 的 30s 桶；GDD §6.2 ×1.44 → 39~62 对照） */
  windowPeakDps: number | null;
}

function runScenario(exclusiveId: ExclusiveWeaponId, scenario: TreeScenario, seedBase: number, useInvincible: boolean, runCount: number): ScenarioAgg {
  const runs = [];
  for (let s = 0; s < runCount; s += 1) {
    runs.push(simulateRun({
      seed: seedBase + s,
      mapId: MAPS[s % MAPS.length]!,
      exclusiveId,
      bucketSeconds: 30,
      tree: scenario,
      invincible: useInvincible,
    }));
  }
  const deaths = runs.map((r) => r.deathTimeSeconds).filter((d): d is number => d !== null);
  const firstHits = runs.map((r) => r.firstHitAtSeconds).filter((d): d is number => d !== null);
  const at30 = runs.map((r) => r.dpsCurve[0]?.dps ?? 0);
  const at60 = runs.map((r) => r.dpsCurve[1]?.dps ?? 0);
  const peak = scenario === 'bds1' ? Math.max(...runs.map((r) => r.dpsCurve[0]?.dps ?? 0)) : null;
  return {
    scenario,
    runs: runs.length,
    medianDeathTime: deaths.length > 0 ? r2(median(deaths)) : null,
    medianFirstHit: firstHits.length > 0 ? r2(median(firstHits)) : null,
    survivalRate: r2(runs.filter((r) => r.deathTimeSeconds === null).length / runs.length),
    bossKillRate: r2(runs.filter((r) => r.bossKilled).length / runs.length),
    medianLevel: r2(median(runs.map((r) => r.levelReached))),
    medianOffers: r2(median(runs.map((r) => r.levelUpOffers.length))),
    openingDps: { at30: r2(median(at30)), at60: r2(median(at60)) },
    windowPeakDps: peak === null ? null : r2(peak),
  };
}

const matrix: Array<{ exclusiveId: ExclusiveWeaponId; survival: ScenarioAgg; dpsPlatform: ScenarioAgg }> = [];
let cursor = baseSeed;
for (const id of EXCLUSIVES) {
  for (const scenario of SCENARIOS) {
    const survival = runScenario(id, scenario, cursor, false, seeds);
    cursor += seeds;
    const dpsPlatform = runScenario(id, scenario, cursor, true, Math.min(seeds, 5));
    cursor += Math.min(seeds, 5);
    matrix.push({ exclusiveId: id, survival, dpsPlatform });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  seedsPerScenario: seeds,
  totalRuns: matrix.length * seeds * 2,
  modelNote: '近似模型（1D 径向等效走位，README-sim 假设清单）；生存结论需真机复测',
  matrix,
};

const outDir = resolve(process.cwd(), 'tools/sim/output');
mkdirSync(outDir, { recursive: true });
const outFile = resolve(outDir, 'calib-matrix.json');
writeFileSync(outFile, JSON.stringify(report, null, 2));
// eslint-disable-next-line no-console
console.log(`[batch-calib] ${matrix.length * seeds * 2} 局 → ${outFile}`);
for (const m of matrix) {
  // eslint-disable-next-line no-console
  console.log(
    `${m.exclusiveId.padEnd(14)} ${m.survival.scenario.padEnd(5)} | 死亡 ${String(m.survival.medianDeathTime ?? '存活').padEnd(7)} | 首伤 ${String(m.survival.medianFirstHit ?? '–').padEnd(7)} | 存活 ${m.survival.survivalRate} | Lv ${m.survival.medianLevel} | offers ${m.survival.medianOffers} | DPS30 ${m.dpsPlatform.openingDps.at30} / DPS60 ${m.dpsPlatform.openingDps.at60}`,
  );
}
void treeScenarioDps;
