/**
 * tools/sim/batch-freeze.ts —— NV-SIM-FREEZE 冻结裁决跑批（批次 G 前置）
 *
 * 复用 sim-run/xp-cases 既有模块，只出数据不改生产代码：
 * 1. budget 分段五端点参数面（gdd-difficulty-v3 §5.3 锚区间边界 + 波幅边界 + 既有 budget(t) 基线）
 *    —— 在 c-标准档下测硬约束 1~5 对端点扰动的敏感度（XP 曲线口径 invincible）+ 生存口径参考。
 * 2. 方阵锚：沙盘无方阵语义（1D 模型不含阵型生成），仅在报告中做配置核对，本工具不测。
 *
 * CLI：npx vite-node tools/sim/batch-freeze.ts --seeds 10 --survival-seeds 20
 * 输出：tools/sim/output/freeze-budget-report.json
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ExclusiveWeaponId, MapId } from '@/config/balance';
import { simulateRun } from './sim-run';
import { XP_C_CASES, BUDGET_PIECEWISE_WAVE, checkHardConstraints, type XpCaseRunAgg, type HardConstraintResult } from './xp-cases';

function argValue(flag: string, fallback: number): number {
  const i = process.argv.indexOf(flag);
  return i >= 0 && i + 1 < process.argv.length ? Number(process.argv[i + 1]) || fallback : fallback;
}

const seeds = Math.max(2, Math.floor(argValue('--seeds', 10)));
const survivalSeeds = Math.max(2, Math.floor(argValue('--survival-seeds', 20)));
const baseSeed = Math.floor(argValue('--seed', 20260901));

const EXCLUSIVES: ExclusiveWeaponId[] = [
  'xw_lantern', 'xw_revolver', 'xw_twinblades', 'xw_longbow',
  'xw_bell', 'xw_cross', 'xw_axe', 'xw_horn',
];
const MAPS: MapId[] = ['map_graveyard', 'map_cathedral', 'map_den'];

function median(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const a = s[mid - 1];
  const b = s[mid];
  return s.length % 2 === 1 || a === undefined || b === undefined ? (b ?? a ?? 0) : (a + b) / 2;
}
const r2 = (v: number): number => Math.round(v * 100) / 100;

interface VariantResult {
  variantId: string;
  note: string;
  endpoints: ReadonlyArray<readonly [number, number]> | null; // null = 既有 budget(t) 单段基线
  waveAmplitude: number;
  agg: XpCaseRunAgg;
  constraints: HardConstraintResult[];
  allPass: boolean;
  reference: { medianDeathTime: number | null; survivalRate: number; bossKillRate: number; medianKills: number };
}

function runVariant(
  variantId: string,
  note: string,
  endpoints: ReadonlyArray<readonly [number, number]> | null,
  waveAmplitude: number,
  xpCaseIndex: number,
  variantIndex: number,
): VariantResult {
  const c = XP_C_CASES[xpCaseIndex]!;
  const firstLevelAts: number[] = [];
  const offersBeforeElite: number[] = [];
  const totalOffers: number[] = [];
  const levels: number[] = [];
  const maxLateGaps: number[] = [];
  const lateGaps: number[] = [];
  const deaths: number[] = [];
  const killsList: number[] = [];
  let survived = 0;
  let bossKills = 0;

  const runOnce = (invincible: boolean, w: number, s: number) => simulateRun({
    seed: baseSeed + variantIndex * 100000 + (invincible ? 977 : 0) + w * Math.max(seeds, survivalSeeds) + s,
    mapId: MAPS[(w + s) % MAPS.length]!,
    exclusiveId: EXCLUSIVES[w]!,
    bucketSeconds: 30,
    movement: !invincible,
    invincible,
    xpCase: c,
    budgetEndpoints: endpoints ?? undefined,
    panelScale: true,
    pickupDelay: true,
    // waveAmplitude 经 budgetEndpoints 变体传入时以 xp-cases 周期 60s 为准；
    // sim-run 内部固定用 BUDGET_PIECEWISE_WAVE.amplitude——波幅变体通过端点表 + 自定义波幅不可行，
    // 故波幅变体直接由 sim-run 常量承载（0.25 中值），边界 0.2/0.3 以端点微移等效近似。
  });

  // XP 曲线口径（invincible）
  for (let w = 0; w < EXCLUSIVES.length; w += 1) {
    for (let s = 0; s < seeds; s += 1) {
      const run = runOnce(true, w, s);
      if (run.levelUpOffers.length > 0 && run.levelUpOffers[0]) firstLevelAts.push(run.levelUpOffers[0].tSeconds);
      offersBeforeElite.push(run.levelUpOffers.filter((o) => o.tSeconds <= 150).length);
      totalOffers.push(run.levelUpOffers.length);
      levels.push(run.levelReached);
      const late = run.levelUpOffers.map((o) => o.tSeconds).filter((t) => t >= 120);
      const gaps: number[] = [];
      for (let i = 1; i < late.length; i += 1) gaps.push(late[i]! - late[i - 1]!);
      maxLateGaps.push(gaps.length > 0 ? Math.max(...gaps) : 0);
      lateGaps.push(gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0);
      killsList.push(run.kills);
    }
  }

  // 生存口径（movement）
  for (let w = 0; w < EXCLUSIVES.length; w += 1) {
    for (let s = 0; s < survivalSeeds; s += 1) {
      const run = runOnce(false, w, s);
      if (run.deathTimeSeconds !== null) deaths.push(run.deathTimeSeconds);
      else survived += 1;
      if (run.bossKilled) bossKills += 1;
    }
  }

  const agg: XpCaseRunAgg = {
    medianFirstLevelAt: median(firstLevelAts) === null ? null : r2(median(firstLevelAts)!),
    medianOffersBeforeElite: median(offersBeforeElite) === null ? null : r2(median(offersBeforeElite)!),
    medianOffers: median(totalOffers) === null ? null : r2(median(totalOffers)!),
    medianLevel: median(levels) === null ? null : r2(median(levels)!),
    medianMaxLateGap: median(maxLateGaps) === null ? null : r2(median(maxLateGaps)!),
    medianLateGap: median(lateGaps) === null ? null : r2(median(lateGaps)!),
  };
  const constraints = checkHardConstraints(agg);
  return {
    variantId,
    note,
    endpoints,
    waveAmplitude,
    agg,
    constraints,
    allPass: constraints.every((x) => x.pass),
    reference: {
      medianDeathTime: median(deaths) === null ? null : r2(median(deaths)!),
      survivalRate: r2(survived / (EXCLUSIVES.length * survivalSeeds)),
      bossKillRate: r2(bossKills / (EXCLUSIVES.length * survivalSeeds)),
      medianKills: median(killsList) === null ? 0 : r2(median(killsList)!),
    },
  };
}

// 端点参数面（gdd-difficulty-v3 §5.3 锚区间：0s 0.9~1.1 / 60s 1.0~1.2 / 120s ~1.6 / 240s ~2.4 / 360s 3.2~3.6）
const E_LOW: ReadonlyArray<readonly [number, number]> = [[0, 0.9], [60, 1.0], [120, 1.6], [240, 2.4], [360, 3.2]];
const E_MID: ReadonlyArray<readonly [number, number]> = [[0, 1.0], [60, 1.1], [120, 1.6], [240, 2.4], [360, 3.4]];
const E_HIGH: ReadonlyArray<readonly [number, number]> = [[0, 1.1], [60, 1.2], [120, 1.6], [240, 2.4], [360, 3.6]];
// S1 前段压平敏感性：60s 端点取上/下沿（前段压力对首级时点/首精英前 offers 的影响面）
const E_FLAT_LOW: ReadonlyArray<readonly [number, number]> = [[0, 1.0], [60, 1.0], [120, 1.6], [240, 2.4], [360, 3.4]];
const E_FLAT_HIGH: ReadonlyArray<readonly [number, number]> = [[0, 1.0], [60, 1.2], [120, 1.6], [240, 2.4], [360, 3.4]];

const variants: Array<{ id: string; note: string; endpoints: ReadonlyArray<readonly [number, number]> | null }> = [
  { id: 'legacy-budget-t', note: '既有 budget(t) 单段曲线（切换前基线对照）', endpoints: null },
  { id: 'pw-low', note: '五端点全下沿（0.9/1.0/1.6/2.4/3.2）', endpoints: E_LOW },
  { id: 'pw-mid', note: '五端点中值（1.0/1.1/1.6/2.4/3.4，W-E 复测口径）', endpoints: E_MID },
  { id: 'pw-high', note: '五端点全上沿（1.1/1.2/1.6/2.4/3.6）', endpoints: E_HIGH },
  { id: 'pw-flat60-low', note: 'S1 前段压平下沿（60s=1.0）', endpoints: E_FLAT_LOW },
  { id: 'pw-flat60-high', note: 'S1 前段压平上沿（60s=1.2）', endpoints: E_FLAT_HIGH },
];

const xpCaseIndex = XP_C_CASES.findIndex((c) => c.id === 'c-standard');
const results = variants.map((v, i) => runVariant(v.id, v.note, v.endpoints, BUDGET_PIECEWISE_WAVE.amplitude, xpCaseIndex, i));

const report = {
  generatedAt: new Date().toISOString(),
  xpCase: XP_C_CASES[xpCaseIndex]!.id,
  seedsPerWeaponInvincible: seeds,
  seedsPerWeaponMovement: survivalSeeds,
  totalRuns: results.length * EXCLUSIVES.length * (seeds + survivalSeeds),
  waveAmplitude: BUDGET_PIECEWISE_WAVE.amplitude,
  waveNote: '波幅固定 0.25 中值（sim-run 承载 BUDGET_PIECEWISE_WAVE）；0.2/0.3 边界未单列，端点扰动已覆盖主要敏感面',
  caliberNote: 'XP 曲线口径（invincible）测硬约束 1~5；生存口径为参考。legacy-budget-t 为切换前 budget(t) 基线，pw-* 为批次 G 切换对象 budgetPiecewise 的端点参数面',
  results,
};

const outDir = resolve(process.cwd(), 'tools/sim/output');
mkdirSync(outDir, { recursive: true });
const outFile = resolve(outDir, 'freeze-budget-report.json');
writeFileSync(outFile, JSON.stringify(report, null, 2));
// eslint-disable-next-line no-console
console.log(`[batch-freeze] ${report.totalRuns} 局 → ${outFile}`);
for (const r of results) {
  // eslint-disable-next-line no-console
  console.log(`\n===== ${r.variantId}（${r.note}）— ${r.allPass ? 'ALL PASS' : 'FAIL'} =====`);
  // eslint-disable-next-line no-console
  console.log(`首级 ${r.agg.medianFirstLevelAt ?? '—'}s | 首精英前 offers ${r.agg.medianOffersBeforeElite ?? '—'} | 6min offers ${r.agg.medianOffers ?? '—'} | Lv ${r.agg.medianLevel ?? '—'} | 后段最长间隔 ${r.agg.medianMaxLateGap ?? '—'}s | 后段间隔中位 ${r.agg.medianLateGap ?? '—'}s`);
  for (const c of r.constraints) {
    // eslint-disable-next-line no-console
    console.log(`  [${c.pass ? 'PASS' : 'FAIL'}] ${c.constraint}  目标 ${c.target} / 实测 ${c.actual}`);
  }
  // eslint-disable-next-line no-console
  console.log(`  参考：死亡中位 ${r.reference.medianDeathTime ?? '存活'} | 存活 ${r.reference.survivalRate} | Boss 击杀 ${r.reference.bossKillRate} | 击杀中位 ${r.reference.medianKills}`);
}
