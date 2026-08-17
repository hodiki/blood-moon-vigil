import { describe, it, expect } from 'vitest';
import {
  assertBenchMetrics,
  DESKTOP_THRESHOLDS,
  MOBILE_THRESHOLDS,
  thresholdsForPlatform,
} from './perf-assert';
import { runHeadlessBench } from './bench-sim';
import { SPAWNER, WEAPONS } from '@/config/balance';

/**
 * E4-S5 性能基准断言（test-framework §3.4 / epics E4-S5）：
 * 纯函数断言 + 无头逻辑基准（20 分钟峰值模拟）—— 环境无关、可机械判定。
 */

const desktopMetrics = {
  avgFps: 60,
  minFps: 52,
  peakActiveEnemies: 400,
  peakActiveBullets: 8,
  drawCallEstimate: 3,
};

const mobileMetrics = {
  avgFps: 45,
  minFps: 30,
  peakActiveEnemies: 250,
  peakActiveBullets: 8,
  drawCallEstimate: 3,
};

describe('阈值表（epics E4-S5）', () => {
  it('桌面：avg≥58 / min≥50 / 敌人 400 / 子弹 8 / draw call 8', () => {
    expect(DESKTOP_THRESHOLDS).toEqual({ avgFps: 58, minFps: 50, maxEnemies: 400, maxBullets: 8, maxDrawCalls: 8 });
  });

  it('移动：avg≥30 / 无最低帧 / 敌人 250 / 子弹 8 / draw call 8', () => {
    expect(MOBILE_THRESHOLDS).toEqual({ avgFps: 30, minFps: 0, maxEnemies: 250, maxBullets: 8, maxDrawCalls: 8 });
  });

  it('thresholdsForPlatform 按平台取阈值', () => {
    expect(thresholdsForPlatform('desktop')).toBe(DESKTOP_THRESHOLDS);
    expect(thresholdsForPlatform('mobile')).toBe(MOBILE_THRESHOLDS);
  });
});

describe('assertBenchMetrics（纯函数断言）', () => {
  it('桌面达标 → pass', () => {
    expect(assertBenchMetrics(desktopMetrics, DESKTOP_THRESHOLDS).pass).toBe(true);
  });

  it('移动达标 → pass（minFps 阈值 0 跳过）', () => {
    expect(assertBenchMetrics(mobileMetrics, MOBILE_THRESHOLDS).pass).toBe(true);
  });

  it('avgFps 低于阈值 → fail 且给出明确原因', () => {
    const r = assertBenchMetrics({ ...desktopMetrics, avgFps: 57 }, DESKTOP_THRESHOLDS);
    expect(r.pass).toBe(false);
    expect(r.failures.join()).toContain('avgFps');
  });

  it('minFps 低于桌面阈值 → fail（移动端不判定）', () => {
    const r = assertBenchMetrics({ ...desktopMetrics, minFps: 49 }, DESKTOP_THRESHOLDS);
    expect(r.pass).toBe(false);
    expect(r.failures.join()).toContain('minFps');
    expect(assertBenchMetrics({ ...mobileMetrics, minFps: 10 }, MOBILE_THRESHOLDS).pass).toBe(true);
  });

  it('实体/子弹/draw call 超限 → fail', () => {
    expect(assertBenchMetrics({ ...desktopMetrics, peakActiveEnemies: 401 }, DESKTOP_THRESHOLDS).pass).toBe(false);
    expect(assertBenchMetrics({ ...desktopMetrics, peakActiveBullets: 9 }, DESKTOP_THRESHOLDS).pass).toBe(false);
    expect(assertBenchMetrics({ ...desktopMetrics, drawCallEstimate: 9 }, DESKTOP_THRESHOLDS).pass).toBe(false);
  });
});

describe('无头逻辑基准（20 分钟峰值模拟）', () => {
  it('桌面：同屏峰值 = 上限 400（上限节流生效），总生成 ≫ 上限', () => {
    const r = runHeadlessBench({ maxEnemies: DESKTOP_THRESHOLDS.maxEnemies, platform: 'desktop' });
    expect(r.peakActiveEnemies).toBe(400);
    // 20 分钟均值预算 ≈2.7 点/s × 1200s ≈ 3240 只，远超上限 400 → 证明节流而非限总量
    expect(r.totalSpawned).toBeGreaterThan(3000);
    expect(r.simulatedSeconds).toBe(SPAWNER.BOSS_TIME);
    expect(r.peakActiveBullets).toBeLessThanOrEqual(WEAPONS.MISSILE.MAX_ACTIVE);
  });

  it('移动：同屏峰值 = 上限 250', () => {
    const r = runHeadlessBench({ maxEnemies: MOBILE_THRESHOLDS.maxEnemies, platform: 'mobile' });
    expect(r.peakActiveEnemies).toBe(250);
  });

  it('draw call 估算 ≤8（程序图集收敛：背景 1 + characters 1 + effects 1）', () => {
    const r = runHeadlessBench({ maxEnemies: DESKTOP_THRESHOLDS.maxEnemies, platform: 'desktop' });
    expect(r.drawCallEstimate).toBeLessThanOrEqual(8);
    expect(r.drawCallEstimate).toBe(3);
  });

  it('桌面/移动无头结果全部通过 assertBenchMetrics 预算断言', () => {
    const d = runHeadlessBench({ maxEnemies: DESKTOP_THRESHOLDS.maxEnemies, platform: 'desktop' });
    const m = runHeadlessBench({ maxEnemies: MOBILE_THRESHOLDS.maxEnemies, platform: 'mobile' });
    // 无头无渲染：fps 不参与断言（真实 fps 由浏览器 ?bench=1 测量）
    expect(assertBenchMetrics({ ...d, avgFps: 60, minFps: 60 }, DESKTOP_THRESHOLDS).pass).toBe(true);
    expect(assertBenchMetrics({ ...m, avgFps: 60, minFps: 60 }, MOBILE_THRESHOLDS).pass).toBe(true);
  });
});
