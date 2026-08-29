/**
 * tools/sim/batch-run.ts —— 5000-run 批跑（B6-W6，eng-impact-assessment §4.3 收官）
 *
 * CLI：
 *   npx vite-node tools/sim/batch-run.ts --runs 5000 --seed 20260829
 *   npx vite-node tools/sim/batch-run.ts --runs 500 --runs-per-weapon 4
 *
 * 输出聚合报告 tools/sim/output/batch-report.json（不入库）+ stdout 摘要：
 * - 死亡时点分布（30s 分桶，存活率/Boss 击杀率）
 * - 开局 DPS 平台带（每 30s 中位，跨专武聚合）
 * - P1 窗口命中率（专武模式升级时点落 30~60s 窗口的局占比——引擎级近似）
 * - offersPerRun 口径复测（基准局 14，gdd-upgrade-pool-v3 §3.5）
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ExclusiveWeaponId, MapId } from '@/config/balance';
import { simulateRun, type RunMetrics } from './sim-run';

function argValue(flag: string, fallback: number): number {
  const i = process.argv.indexOf(flag);
  return i >= 0 && i + 1 < process.argv.length ? Number(process.argv[i + 1]) || fallback : fallback;
}

const runs = Math.max(1, Math.floor(argValue('--runs', 5000)));
const baseSeed = Math.floor(argValue('--seed', 20260829));
const bucket = Math.floor(argValue('--bucket', 30));

const EXCLUSIVES: ExclusiveWeaponId[] = [
  'xw_lantern', 'xw_revolver', 'xw_twinblades', 'xw_longbow',
  'xw_bell', 'xw_cross', 'xw_axe', 'xw_horn',
];
const MAPS: MapId[] = ['map_graveyard', 'map_cathedral', 'map_den'];

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const a = s[mid - 1];
  const b = s[mid];
  return s.length % 2 === 1 || a === undefined || b === undefined ? (b ?? a ?? 0) : (a + b) / 2;
}
const r2 = (v: number): number => Math.round(v * 100) / 100;

const perWeapon = Math.max(1, Math.floor(argValue('--runs-per-weapon', Math.ceil(runs / EXCLUSIVES.length))));
const all: RunMetrics[] = [];
let seedCursor = baseSeed;

for (const id of EXCLUSIVES) {
  for (let i = 0; i < perWeapon; i += 1) {
    seedCursor += 1;
    all.push(simulateRun({
      seed: seedCursor,
      mapId: MAPS[i % MAPS.length]!,
      exclusiveId: id,
      bucketSeconds: bucket,
      invincible: true, // 平台带口径（承伤模型校准批次前隔离生存变量）
    }));
  }
}

// —— 聚合 ——
const maxBucket = Math.max(0, ...all.map((r) => r.dpsCurve.length));
const dpsBands = Array.from({ length: maxBucket }, (_, i) => {
  const values = all.map((r) => r.dpsCurve[i]?.dps).filter((v): v is number => typeof v === 'number');
  return {
    tSeconds: (i + 1) * bucket,
    median: r2(median(values)),
    p10: r2(values.length ? values[Math.floor(values.length * 0.1)] ?? 0 : 0),
    p90: r2(values.length ? values[Math.floor(values.length * 0.9)] ?? 0 : 0),
  };
});
const deathTimes = all.map((r) => r.deathTimeSeconds).filter((d): d is number => d !== null);
const deathBuckets: Array<{ fromSeconds: number; count: number }> = [];
for (let t = bucket; t <= 480; t += bucket) {
  deathBuckets.push({ fromSeconds: t - bucket, count: deathTimes.filter((d) => d > t - bucket && d <= t).length });
}
// P1 窗口命中率近似：存活局的首次升级（levelUpOffers[0]）时点落 30~60s 窗口的占比
const p1Hits = all.filter((r) => {
  const first = r.levelUpOffers[0]?.tSeconds;
  return first !== undefined && first >= 30 && first <= 60;
}).length;
// offersPerRun：升级次数近似（levelUpOffers 长度）
const offerCounts = all.map((r) => r.levelUpOffers.length);

const report = {
  generatedAt: new Date().toISOString(),
  runsRequested: runs,
  runsExecuted: all.length,
  perWeapon,
  bucketSeconds: bucket,
  survivalRate: r2(all.filter((r) => r.deathTimeSeconds === null).length / all.length),
  bossKillRate: r2(all.filter((r) => r.bossKilled).length / all.length),
  deathTimeBuckets: deathBuckets,
  deathRateWithinBossWindow: r2(deathTimes.filter((d) => d >= 360).length / Math.max(1, deathTimes.length)),
  openingDpsBands: dpsBands,
  p1WindowHitRate: r2(p1Hits / all.length),
  offersPerRunMedian: r2(median(offerCounts)),
  offersPerRunP10: r2(median(offerCounts.slice(0, Math.floor(offerCounts.length * 0.1)))),
  note: '专武结算层 × 1D 径向敌模型 × 无敌口径；敌面板/XP 曲线为 pre-怪物域重做基线（H5 联调挂账）',
};

const outDir = resolve(process.cwd(), 'tools/sim/output');
mkdirSync(outDir, { recursive: true });
const outFile = resolve(outDir, 'batch-report.json');
writeFileSync(outFile, JSON.stringify(report, null, 2));
// eslint-disable-next-line no-console
console.log(
  `[batch-run] ${all.length} 局 | 存活率 ${report.survivalRate} | Boss 击杀率 ${report.bossKillRate} | ` +
  `P1 窗口命中 ${report.p1WindowHitRate} | offers 中位 ${report.offersPerRunMedian} | → ${outFile}`,
);
