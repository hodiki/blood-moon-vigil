/**
 * tools/sim/batch-xp-cases.ts —— XP c 案三档 × budget 分段五端点跑批（W-E，difficulty-v3 §5.2/§5.3）
 *
 * CLI：npx vite-node tools/sim/batch-xp-cases.ts --seeds 25
 * 矩阵：3 c 档 × 8 专武 × 双口径（与 batch-calib 同构）——
 *  · XP 曲线口径（invincible，DPS 平台带）：隔离承伤/走位变量，硬约束 1~5 全在此测；
 *  · 生存口径（movement）：死亡/存活/Boss 击杀参考指标。
 * budget = 分段五端点中值 + 波幅 0.25 / 周期 60s（gdd-spawner-v2 §③-1）。
 * 输出：tools/sim/output/xp-cases-report.json —— 硬约束（首级 18~22s / 首精英前 offers ≥3 /
 *       6min offers 12~18 / 等级终值 Lv14~20 / 中后段最长升级间隔 ≤30s）逐档 PASS/FAIL。
 * ⚠ 只出数据不回填 balance（c 案裁决归用户；difficulty-v3 §5.2「模拟裁决后单轮冻结」）。
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ExclusiveWeaponId, MapId } from '@/config/balance';
import { simulateRun } from './sim-run';
import { XP_C_CASES, BUDGET_PIECEWISE_ENDPOINTS, checkHardConstraints, type XpCaseRunAgg, type HardConstraintResult } from './xp-cases';

function argValue(flag: string, fallback: number): number {
  const i = process.argv.indexOf(flag);
  return i >= 0 && i + 1 < process.argv.length ? Number(process.argv[i + 1]) || fallback : fallback;
}

const seeds = Math.max(1, Math.floor(argValue('--seeds', 25)));
const baseSeed = Math.floor(argValue('--seed', 20260831));

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

interface TierResult {
  caseId: string;
  label: string;
  params: { needFirst: number; earlyStep: number; lateStep: number; enemyXpMult: number; enemyHpLink: number };
  expectedOffersConvergence: string;
  runs: number;
  /** XP 曲线口径局数（invincible） */
  xpRuns: number;
  /** 生存口径局数（movement） */
  survivalRuns: number;
  agg: XpCaseRunAgg;
  constraints: HardConstraintResult[];
  allPass: boolean;
  /** 参考指标（死亡/存活/Boss 击杀；模型口径见 README-sim） */
  reference: { medianDeathTime: number | null; survivalRate: number; bossKillRate: number; medianKills: number };
}

function runTier(caseIndex: number): TierResult {
  const c = XP_C_CASES[caseIndex]!;
  const firstLevelAts: number[] = [];
  const offersBeforeElite: number[] = [];
  const totalOffers: number[] = [];
  const levels: number[] = [];
  const maxLateGaps: number[] = [];
  const lateGaps: number[] = [];
  const deaths: number[] = [];
  let survived = 0;
  let bossKills = 0;
  const killsList: number[] = [];

  const runOnce = (invincible: boolean, w: number, s: number) => simulateRun({
    seed: baseSeed + (invincible ? 977 : 0) + w * seeds + s,
    mapId: MAPS[(w + s) % MAPS.length]!,
    exclusiveId: EXCLUSIVES[w]!,
    bucketSeconds: 30,
    movement: !invincible,
    invincible,
    xpCase: c,
    budgetEndpoints: BUDGET_PIECEWISE_ENDPOINTS,
    panelScale: true, // W-8 复测：M3 缩放链生效
    pickupDelay: true, // S-3 复测：gem 磁吸时延
  });

  // —— XP 曲线口径（invincible = 全程 6min，隔离承伤变量；batch-calib DPS 平台带同构）——
  const xpSeeds = Math.min(seeds, 5);
  for (let w = 0; w < EXCLUSIVES.length; w += 1) {
    for (let s = 0; s < xpSeeds; s += 1) {
      const run = runOnce(true, w, s);
      // 硬约束 1：首级时点
      if (run.levelUpOffers.length > 0 && run.levelUpOffers[0]) firstLevelAts.push(run.levelUpOffers[0].tSeconds);
      // 硬约束 2：首精英前（≤150s 锚）offers
      offersBeforeElite.push(run.levelUpOffers.filter((o) => o.tSeconds <= 150).length);
      // 硬约束 3：6min offers（= 升级次数，sim 占位口径）
      totalOffers.push(run.levelUpOffers.length);
      // 硬约束 4：等级终值
      levels.push(run.levelReached);
      // 硬约束 5：中后段（≥120s）升级间隔（最长/中位）
      const late = run.levelUpOffers.map((o) => o.tSeconds).filter((t) => t >= 120);
      const gaps: number[] = [];
      for (let i = 1; i < late.length; i += 1) gaps.push(late[i]! - late[i - 1]!);
      maxLateGaps.push(gaps.length > 0 ? Math.max(...gaps) : 0);
      lateGaps.push(gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0);
      killsList.push(run.kills);
    }
  }

  // —— 生存口径（movement；参考指标）——
  for (let w = 0; w < EXCLUSIVES.length; w += 1) {
    for (let s = 0; s < seeds; s += 1) {
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
    caseId: c.id,
    label: c.label,
    params: { needFirst: c.needFirst, earlyStep: c.earlyStep, lateStep: c.lateStep, enemyXpMult: c.enemyXpMult, enemyHpLink: c.enemyHpLink },
    expectedOffersConvergence: c.expectedOffersConvergence,
    runs: EXCLUSIVES.length * (seeds + Math.min(seeds, 5)),
    xpRuns: EXCLUSIVES.length * Math.min(seeds, 5),
    survivalRuns: EXCLUSIVES.length * seeds,
    agg,
    constraints,
    allPass: constraints.every((x) => x.pass),
    reference: {
      medianDeathTime: median(deaths) === null ? null : r2(median(deaths)!),
      survivalRate: r2(survived / (EXCLUSIVES.length * seeds)),
      bossKillRate: r2(bossKills / (EXCLUSIVES.length * seeds)),
      medianKills: median(killsList) === null ? 0 : r2(median(killsList)!),
    },
  };
}

const results = XP_C_CASES.map((_, i) => runTier(i));

const report = {
  generatedAt: new Date().toISOString(),
  seedsPerWeapon: seeds,
  totalRuns: results.reduce((sum, r) => sum + r.runs, 0),
  caliberNote: '硬约束 1~5 在 XP 曲线口径（invincible，全程 6min）测得；死亡/存活/Boss 击杀为生存口径参考。已知模型偏置：1D 真空拾取假设令 XP 获取速率系统性偏快（首级提前），S-3 裁决需 gem 磁吸/拾取时延模型回填（遗留项）',
  budgetCurve: {
    endpoints: BUDGET_PIECEWISE_ENDPOINTS,
    wave: { amplitude: 0.25, period: 60 },
    note: '五端点中值锚（0.9~1.1/1.0~1.2/~1.6/~2.4/3.2~3.6）；分段线性插值 + 正弦波（gdd-spawner-v2 §③-1）',
  },
  panelScale: true,
  pickupDelayModel: 'XP 入账延迟 = (击杀点距离 − 拾取半径 16px) / 磁吸速度 360px/s（1D 径向）',
  modelNote: '近似模型（1D 径向等效走位 + Boss 五槽调度桩，README-sim 假设清单）；XP 三档只出数据不回填 balance，c 案裁决归用户（difficulty-v3 §5.2）',
  results,
};

const outDir = resolve(process.cwd(), 'tools/sim/output');
mkdirSync(outDir, { recursive: true });
const outFile = resolve(outDir, 'xp-cases-report.json');
writeFileSync(outFile, JSON.stringify(report, null, 2));
// eslint-disable-next-line no-console
console.log(`[batch-xp-cases] ${report.totalRuns} 局 → ${outFile}`);
for (const r of results) {
  // eslint-disable-next-line no-console
  console.log(`\n===== ${r.label}（need ${r.params.needFirst}/${r.params.earlyStep}/${r.params.lateStep} · XP ×${r.params.enemyXpMult} · HP ×${r.params.enemyHpLink}）— ${r.allPass ? 'ALL PASS' : 'FAIL'} =====`);
  // eslint-disable-next-line no-console
  console.log(`首级 ${r.agg.medianFirstLevelAt ?? '—'}s | 首精英前 offers ${r.agg.medianOffersBeforeElite ?? '—'} | 6min offers ${r.agg.medianOffers ?? '—'} | Lv ${r.agg.medianLevel ?? '—'} | 后段最长间隔 ${r.agg.medianMaxLateGap ?? '—'}s`);
  for (const c of r.constraints) {
    // eslint-disable-next-line no-console
    console.log(`  [${c.pass ? 'PASS' : 'FAIL'}] ${c.constraint}  目标 ${c.target} / 实测 ${c.actual}`);
  }
  // eslint-disable-next-line no-console
  console.log(`  参考：死亡中位 ${r.reference.medianDeathTime ?? '存活'} | 存活 ${r.reference.survivalRate} | Boss 击杀 ${r.reference.bossKillRate} | 击杀中位 ${r.reference.medianKills}`);
}
