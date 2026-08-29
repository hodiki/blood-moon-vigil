/**
 * tools/sim/dps-baseline.ts —— 开局 DPS 平台带基线（B2-W6 交付物）
 *
 * 8 专武真实结算层 × N 种子 × 0~60s 窗口（10s 分桶）→ 平台带（中位/最小/最大）。
 * 这是怪物域 39+ 数值锚点校准的输入（eng-impact-assessment §4.3）。
 *
 * 运行：
 *   npx vite-node tools/sim/dps-baseline.ts                 # 默认 12 种子/专武
 *   npx vite-node tools/sim/dps-baseline.ts --seeds 30
 *
 * 输出：tools/sim/output/dps-baseline.json（不入库，见 .gitignore / README 口径）+ stdout 摘要。
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ExclusiveWeaponId, MapId } from '@/config/balance';
import { simulateRun } from './sim-run';

const EXCLUSIVES: ExclusiveWeaponId[] = [
  'xw_lantern', 'xw_revolver', 'xw_twinblades', 'xw_longbow',
  'xw_bell', 'xw_cross', 'xw_axe', 'xw_horn',
];

/** 8 专武的宿主地图（真实生成器曲线随图不同；角色-地图对应口径） */
const WEAPON_MAP: Record<ExclusiveWeaponId, MapId> = {
  xw_lantern: 'map_graveyard', xw_revolver: 'map_graveyard',
  xw_twinblades: 'map_cathedral', xw_longbow: 'map_cathedral',
  xw_bell: 'map_cathedral', xw_cross: 'map_cathedral',
  xw_axe: 'map_den', xw_horn: 'map_den',
};

function argValue(flag: string, fallback: number): number {
  const i = process.argv.indexOf(flag);
  return i >= 0 && i + 1 < process.argv.length ? Number(process.argv[i + 1]) || fallback : fallback;
}

const seeds = Math.max(1, Math.floor(argValue('--seeds', 12)));
const baseSeed = Math.floor(argValue('--seed', 20260829));
const WINDOW_END = 60;
const BUCKET = 10;

interface Band {
  tSeconds: number;
  median: number;
  min: number;
  max: number;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const a = s[mid - 1];
  const b = s[mid];
  return s.length % 2 === 1 || a === undefined || b === undefined ? (b ?? a ?? 0) : (a + b) / 2;
}

const result: Record<string, { bands: Band[]; deaths: number[]; note: string }> = {};

for (const id of EXCLUSIVES) {
  const runsPerBucket: number[][] = Array.from({ length: WINDOW_END / BUCKET }, () => []);
  const deaths: number[] = [];
  for (let s = 0; s < seeds; s += 1) {
    const run = simulateRun({
      seed: baseSeed + s,
      mapId: WEAPON_MAP[id],
      exclusiveId: id,
      maxSeconds: WINDOW_END,
      bucketSeconds: BUCKET,
      invincible: true, // 开局 DPS 平台带：隔离承伤/走位变量（玩家生存模型留沙盘校准批次）
    });
    run.dpsCurve.slice(0, WINDOW_END / BUCKET).forEach((p, i) => {
      runsPerBucket[i]!.push(p.dps);
    });
    if (run.deathTimeSeconds !== null) deaths.push(run.deathTimeSeconds);
  }
  const bands: Band[] = runsPerBucket.map((values, i) => ({
    tSeconds: (i + 1) * BUCKET,
    median: round2(median(values)),
    min: round2(values.length > 0 ? Math.min(...values) : 0),
    max: round2(values.length > 0 ? Math.max(...values) : 0),
  }));
  result[id] = {
    bands,
    deaths,
    note: 'exclusive-math 真实结算层 × 1D 径向敌模型；数值锚点待模拟验证（gdd-exclusive-weapons §⑤）',
  };
  // eslint-disable-next-line no-console
  console.log(
    `[dps-baseline] ${id}: ` +
      bands.map((b) => `${b.tSeconds}s med=${b.median} [${b.min}~${b.max}]`).join(' | ') +
      ` | 提前死亡 ${deaths.length}/${seeds}`,
  );
}

const outDir = resolve(process.cwd(), 'tools/sim/output');
mkdirSync(outDir, { recursive: true });
const outFile = resolve(outDir, 'dps-baseline.json');
writeFileSync(
  outFile,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      seeds,
      baseSeed,
      windowSeconds: WINDOW_END,
      bucketSeconds: BUCKET,
      weapons: result,
    },
    null,
    2,
  ),
);
// eslint-disable-next-line no-console
console.log(`[dps-baseline] 已写出 ${outFile}（不入库）`);

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
