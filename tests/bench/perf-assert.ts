/**
 * tests/bench/perf-assert.ts —— 性能基准断言（L3 / E4-S5 / test-framework §3.4）
 *
 * 双端预算阈值（epics E4-S5 / ARCH §6 预算表）：
 * - 桌面：avgFps≥58、minFps≥50、同屏峰值 ≤400、子弹 ≤8、draw call ≤8
 * - 移动：avgFps≥30（无最低帧要求，minFps 阈值置 0 跳过）、同屏峰值 ≤250、子弹 ≤8、draw call ≤8
 * 纯函数：可被 vitest 单测，也可被 bench-run / browser-bench 直接调用。
 */

export interface BenchThresholds {
  avgFps: number;
  /** 0 = 不断言（移动端无最低帧要求） */
  minFps: number;
  maxEnemies: number;
  maxBullets: number;
  maxDrawCalls: number;
}

export const DESKTOP_THRESHOLDS: BenchThresholds = Object.freeze({
  avgFps: 58,
  minFps: 50,
  maxEnemies: 400,
  maxBullets: 8,
  maxDrawCalls: 8,
});

export const MOBILE_THRESHOLDS: BenchThresholds = Object.freeze({
  avgFps: 30,
  minFps: 0,
  maxEnemies: 250,
  maxBullets: 8,
  maxDrawCalls: 8,
});

export function thresholdsForPlatform(platform: 'desktop' | 'mobile'): BenchThresholds {
  return platform === 'mobile' ? MOBILE_THRESHOLDS : DESKTOP_THRESHOLDS;
}

export interface BenchAssertReport {
  pass: boolean;
  failures: string[];
}

export interface BenchMetricsInput {
  /** 无头逻辑基准无渲染，fps 可缺省（仅峰值/draw call 断言） */
  avgFps?: number;
  minFps?: number;
  peakActiveEnemies: number;
  peakActiveBullets: number;
  drawCallEstimate: number;
}

/** 断言基准结果（纯函数，可单测）；返回失败清单（空 = 通过） */
export function assertBenchMetrics(m: BenchMetricsInput, t: BenchThresholds): BenchAssertReport {
  const failures: string[] = [];
  if (m.avgFps !== undefined && m.avgFps < t.avgFps) failures.push(`avgFps ${m.avgFps.toFixed(1)} < 阈值 ${t.avgFps}`);
  if (m.minFps !== undefined && t.minFps > 0 && m.minFps < t.minFps) {
    failures.push(`minFps ${m.minFps.toFixed(1)} < 阈值 ${t.minFps}`);
  }
  if (m.peakActiveEnemies > t.maxEnemies) {
    failures.push(`同屏敌人峰值 ${m.peakActiveEnemies} > 上限 ${t.maxEnemies}`);
  }
  if (m.peakActiveBullets > t.maxBullets) {
    failures.push(`同屏子弹峰值 ${m.peakActiveBullets} > 上限 ${t.maxBullets}`);
  }
  if (m.drawCallEstimate > t.maxDrawCalls) {
    failures.push(`draw call 估算 ${m.drawCallEstimate} > 预算 ${t.maxDrawCalls}`);
  }
  return { pass: failures.length === 0, failures };
}
