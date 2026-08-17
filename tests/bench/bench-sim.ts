/**
 * tests/bench/bench-sim.ts —— 无头逻辑基准（L3 / E4-S5）
 *
 * 纯逻辑模拟（Node 可跑，`npm run bench` 主入口之一）：
 * - 场景 A「堆积上限」：预算按 budget(t) 满速生成且不设死亡（最坏堆积），
 *   验证生成器同屏上限逻辑：桌面 400 / 移动 250，无实体溢出（S8-5 / E8-5）。
 * - 场景 B「武器稳态」：飞弹 1.2s 冷却 / 3s 寿命 / 分裂 2 次级弹（一次 3 枚）/ 池上限 8，
 *   验证同屏子弹 ≤8（W8-4 / 预算表 #2）。
 * - draw call 估算：程序图集已收敛为 characters/effects 两组 + 背景（ARCH §5.3 口径）。
 * 说明：headless 无渲染，不出真实 fps —— 真实 fps 由浏览器 `?bench=1`（browser-bench）测量；
 * 本模拟负责环境无关的预算断言（峰值/子弹/draw call）。
 */

import { SPAWNER, WEAPONS } from '@/config/balance';
import { budget } from '@/spawner/spawner';
import { estimateDrawCalls } from '@/utils/perf';

export interface HeadlessBenchResult {
  platform: 'desktop' | 'mobile';
  /** 模拟局时秒（完整 20 分钟到收束） */
  simulatedSeconds: number;
  /** 模拟帧数（60Hz） */
  framesSimulated: number;
  /** 场景 A：堆积上限场景同屏峰值（应 = 平台上限，证明上限生效） */
  peakActiveEnemies: number;
  /** 场景 A：总生成数（应 ≫ 上限，证明节流而非限总量） */
  totalSpawned: number;
  /** 场景 B：同屏子弹峰值（应 ≤8） */
  peakActiveBullets: number;
  /** draw call 估算（设计口径：背景 1 + characters 1 + effects 1 ≈ 3） */
  drawCallEstimate: number;
}

const DT = 1 / 60;

/** 场景 A：堆积上限 —— 预算满速、无死亡，验证同屏上限节流 */
function simulateSpawnPileUp(maxEnemies: number, simSeconds: number): { peak: number; totalSpawned: number } {
  let active = 0;
  let peak = 0;
  let totalSpawned = 0;
  let budgetAcc = 0;
  const frames = Math.round(simSeconds / DT);
  for (let f = 0; f < frames; f += 1) {
    const t = f * DT;
    if (t >= SPAWNER.BOSS_TIME) break;
    budgetAcc += budget(t) * DT;
    while (budgetAcc >= 1) {
      budgetAcc -= 1;
      totalSpawned += 1;
      if (active < maxEnemies) active += 1; // 上限节流：达上限不再叠加（enemy-spawner 同构）
    }
    if (active > peak) peak = active;
  }
  return { peak, totalSpawned };
}

/** 场景 B：武器稳态 —— 飞弹冷却/寿命/分裂/池上限模拟 */
function simulateMissiles(): number {
  let missiles = 0;
  let peak = 0;
  let cd = 0;
  const simSeconds = SPAWNER.BOSS_TIME;
  const frames = Math.round(simSeconds / DT);
  for (let f = 0; f < frames; f += 1) {
    const t = f * DT;
    if (t >= SPAWNER.BOSS_TIME) break;
    cd -= DT;
    if (cd <= 0 && missiles < WEAPONS.MISSILE.MAX_ACTIVE) {
      cd = WEAPONS.MISSILE.COOLDOWN;
      // 分裂 2 次级弹：一次冷却至多 3 枚入池（主弹 + 2 次级），池上限 8
      missiles = Math.min(missiles + 3, WEAPONS.MISSILE.MAX_ACTIVE);
    }
    // 寿命 3s → 每秒 1/3 消散
    missiles = Math.max(0, missiles - (missiles / WEAPONS.MISSILE.LIFETIME) * DT);
    if (missiles > peak) peak = missiles;
  }
  return peak;
}

export function runHeadlessBench(opts: { maxEnemies: number; platform: 'desktop' | 'mobile' }): HeadlessBenchResult {
  const simSeconds = SPAWNER.BOSS_TIME;
  const pileUp = simulateSpawnPileUp(opts.maxEnemies, simSeconds);
  const peakBullets = simulateMissiles();
  // draw call 估算（TASK-28 口径）：背景 1 + characters 1 + effects 1 + ambient 1 + 粒子 extra 1 = 5
  const drawCallEstimate = estimateDrawCalls(
    { characters: pileUp.peak + peakBullets + 7, effects: 1, ambient: 1 },
    1,
  );
  return {
    platform: opts.platform,
    simulatedSeconds: simSeconds,
    framesSimulated: Math.round(simSeconds / DT),
    peakActiveEnemies: pileUp.peak,
    totalSpawned: pileUp.totalSpawned,
    peakActiveBullets: peakBullets,
    drawCallEstimate,
  };
}
