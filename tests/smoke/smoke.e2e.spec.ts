import { test, expect } from '@playwright/test';

/**
 * L2 冒烟 e2e（test-framework §3.3 / E1-S1 验收 #3/#4）：
 * - canvas 出现
 * - 内嵌自检（?smoke=1）60 帧后写入 window.__SMOKE_RESULT__
 * - framesAdvanced / sceneReady / 无 console error 全通过（判定规则与 smoke-embed.ts 一致）
 */

interface SmokeResult {
  framesAdvanced: boolean;
  sceneReady: boolean;
  consoleErrors: string[];
  elapsedMs: number;
  frame: number;
}

test('游戏启动冒烟：canvas 出现、60 帧推进、自检断言通过、无 console error', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('/?smoke=1');
  await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 });

  // 等待内嵌自检写入（PlayScene 60 帧后调用 writeSmokeResult）
  await page.waitForFunction(
    () => (window as unknown as { __SMOKE_RESULT__?: SmokeResult }).__SMOKE_RESULT__ !== undefined,
    undefined,
    { timeout: 15_000 },
  );

  const result = await page.evaluate(
    () => (window as unknown as { __SMOKE_RESULT__: SmokeResult }).__SMOKE_RESULT__,
  );

  expect(result.framesAdvanced).toBe(true); // 帧号递增，引擎主循环在跑
  expect(result.sceneReady).toBe(true); // PlayScene 装配完成
  expect(result.consoleErrors).toEqual([]); // 内嵌捕获无 console.error
  expect(errors).toEqual([]); // 浏览器侧无 console.error / 未捕获异常
});
