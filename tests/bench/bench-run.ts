/**
 * tests/bench/bench-run.ts —— `npm run bench` 入口（L3 性能基准 / E4-S5 / M2 闸门）
 *
 * 执行流程：
 * 1. 无头逻辑基准（headless，环境无关，CI 可跑）：
 *    - 桌面 & 移动配置各跑 6 分钟峰值模拟（TASK-31 收尾 BOSS_TIME=360）
 *    - 断言：同屏敌人峰值 ≤400/250（上限节流生效）、子弹 ≤8、draw call ≤8
 * 2. 浏览器真实 fps 基准（可选，BENCH_BROWSER=1 时执行）：
 *    - spawn `vite preview`（需先 `npm run build`）→ Playwright chromium 打开 `/?bench=1`
 *    - 36s 峰值压力（游戏 20× 时缩放 → 覆盖 6:00 收束）→ 读 window.__BENCH_RESULT__
 *    - 断言桌面 avgFps≥58 / minFps≥50；BENCH_STRICT_FPS=1 时 fps 未达标 → 退出码非 0
 * 说明：headless 无渲染，不出真实 fps；真实 fps 以桌面 Chrome（集显）浏览器为准
 * （ARCH §6.1「桌面 Chrome 最新 + 集显」）—— headless swiftshader 数值仅作参考。
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { runHeadlessBench, type HeadlessBenchResult } from './bench-sim';
import { assertBenchMetrics, DESKTOP_THRESHOLDS, MOBILE_THRESHOLDS } from './perf-assert';
import type { BenchResult } from '@/utils/perf';

const DIST_INDEX = resolve(process.cwd(), 'dist', 'index.html');
const PREVIEW_PORT = 4173;

function printHeadless(label: string, r: HeadlessBenchResult): void {
  // eslint-disable-next-line no-console
  console.log(
    `[bench] ${label} 无头逻辑基准：模拟 ${r.simulatedSeconds}s（${r.framesSimulated} 帧@60Hz）` +
      `| 同屏峰值 ${r.peakActiveEnemies}/${r.totalSpawned} 生成 | 子弹峰值 ${r.peakActiveBullets}` +
      ` | draw call 估算 ${r.drawCallEstimate}`,
  );
}

function headlessAll(): boolean {
  const desktop = runHeadlessBench({ maxEnemies: DESKTOP_THRESHOLDS.maxEnemies, platform: 'desktop' });
  const mobile = runHeadlessBench({ maxEnemies: MOBILE_THRESHOLDS.maxEnemies, platform: 'mobile' });
  printHeadless('桌面', desktop);
  printHeadless('移动', mobile);

  const dReport = assertBenchMetrics(desktop, DESKTOP_THRESHOLDS);
  const mReport = assertBenchMetrics(mobile, MOBILE_THRESHOLDS);
  let ok = true;
  if (!dReport.pass) {
    ok = false;
    // eslint-disable-next-line no-console
    console.error(`[bench] 桌面断言失败：${dReport.failures.join('；')}`);
  }
  if (!mReport.pass) {
    ok = false;
    // eslint-disable-next-line no-console
    console.error(`[bench] 移动断言失败：${mReport.failures.join('；')}`);
  }
  if (ok) {
    // eslint-disable-next-line no-console
    console.log('[bench] 无头预算断言全通过（峰值/子弹/draw call ≤ 预算）。');
  }
  return ok;
}

function waitForServer(url: string, timeoutMs: number): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const started = Date.now();
    const check = async (): Promise<void> => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`等待服务 ${url} 超时`));
        return;
      }
      try {
        const res = await fetch(url);
        if (res.ok) {
          resolvePromise();
          return;
        }
      } catch {
        // 未就绪，继续等
      }
      setTimeout(check, 500);
    };
    void check();
  });
}

async function browserBench(): Promise<{ result: BenchResult | null; note: string }> {
  const args = process.argv.slice(2);
  const wantsBrowser = process.env.BENCH_BROWSER === '1' || args.includes('--browser');
  if (!existsSync(DIST_INDEX)) {
    return { result: null, note: 'dist 未构建（先运行 npm run build），跳过浏览器真实 fps 基准。' };
  }
  if (!wantsBrowser) {
    return { result: null, note: '未启用（BENCH_BROWSER=1 或 --browser 时执行浏览器真实 fps 基准）。' };
  }

  // eslint-disable-next-line no-console
  console.log('[bench] 启动 vite preview + Playwright chromium（36s 峰值压力，请耐心等待…）');
  const server: ChildProcess = spawn('npx', ['vite', 'preview', '--port', String(PREVIEW_PORT), '--strictPort'], {
    stdio: 'ignore',
    shell: process.platform === 'win32',
  });
  try {
    await waitForServer(`http://localhost:${PREVIEW_PORT}`, 30_000);
    // 动态 import（vite-node ESM；Playwright 为 CJS 依赖，兼容）
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({
      headless: true,
      args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu-sandbox'],
    });
    try {
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
      await page.goto(`http://localhost:${PREVIEW_PORT}/?bench=1`, { waitUntil: 'load' });
      await page.waitForFunction(
        () => (window as unknown as { __BENCH_RESULT__?: BenchResult }).__BENCH_RESULT__ !== undefined,
        undefined,
        { timeout: 100_000 },
      );
      const result = (await page.evaluate(
        () => (window as unknown as { __BENCH_RESULT__: BenchResult }).__BENCH_RESULT__,
      )) as BenchResult;
      return { result, note: '' };
    } finally {
      await browser.close();
    }
  } finally {
    server.kill();
  }
}

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('[bench] === 血月守夜 性能基准（E4-S5 / M2 闸门）===');

  const headlessOk = headlessAll();

  const { result, note } = await browserBench();
  if (note) {
    // eslint-disable-next-line no-console
    console.log(`[bench] ${note}`);
  }
  let browserOk = true;
  if (result) {
    // eslint-disable-next-line no-console
    console.log(
      `[bench] 浏览器真实 fps（${result.platform}）：avg ${result.avgFps.toFixed(1)} / min ${result.minFps.toFixed(1)}` +
        ` | 峰值敌人 ${result.peakActiveEnemies} / 子弹 ${result.peakActiveBullets}` +
        ` | draw call 估算 ${result.drawCallEstimate} | 帧 ${result.frames}`,
    );
    const report = assertBenchMetrics(result, DESKTOP_THRESHOLDS);
    const strictFps = process.env.BENCH_STRICT_FPS === '1' || process.argv.slice(2).includes('--strict-fps');
    if (!report.pass) {
      browserOk = false;
      // eslint-disable-next-line no-console
      console.error(`[bench] 浏览器基准断言失败：${report.failures.join('；')}`);
      if (!strictFps) {
        // eslint-disable-next-line no-console
        console.error(
          '[bench] 提示：headless swiftshader 为软件渲染，不代表真实桌面 GPU。' +
            '请用真机桌面 Chrome 跑 `npm run bench:browser` 复核 M2 fps 闸门。',
        );
        browserOk = true; // 非严格模式下 fps 仅参考，不阻塞 CI
      }
    } else {
      // eslint-disable-next-line no-console
      console.log('[bench] 浏览器基准断言通过。');
    }
  }

  const pass = headlessOk && browserOk;
  // eslint-disable-next-line no-console
  console.log(pass ? '[bench] 通过：退出码 0。' : '[bench] 失败：退出码 1。');
  process.exit(pass ? 0 : 1);
}

void main();
