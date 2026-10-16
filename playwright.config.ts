import path from 'node:path';
import { createRequire } from 'node:module';
import { defineConfig } from '@playwright/test';

const require = createRequire(import.meta.url);
// 直接解析 Vite 的 CLI 入口（不走 `npm run preview`）。
const vitePkg = require.resolve('vite/package.json');
const viteBin = path.join(path.dirname(vitePkg), 'bin', 'vite.js');

/**
 * Playwright 冒烟配置（L2 可选增强，test-framework §1.1/§3.3 / CI §5 P2）
 * 运行前需先 `npm run build`（webServer 起 vite preview 服务 dist）。
 *
 * ── 关于 Windows 进程回收（NV-ENG-EXEC-15）──────────────────────────────
 * Playwright 关停 webServer 时，在 Windows 上执行 `taskkill /pid <直接子进程> /T /F`
 * 回收整棵进程树。原命令 `npm run preview -- ...` 的树为
 *     cmd → node(npm) → cmd(vite shim) → node(vite)          （4 层）
 * 中间层越多，越可能因中间进程先退出/被孤儿化而使 `taskkill /T` 漏掉 vite 孙进程；
 * 一旦孙进程存活，它会继续持有 Playwright 为 webServer 创建的 stdout 管道 →
 * Playwright 等待的 `close` 事件永不触发 → 用例虽 `1 passed`，Node 进程却不退出。
 *
 * 故此处改为**直接调用 Vite CLI**，把树压到                               （2 层）
 *     cmd → node(vite)
 * 减少漏杀面（不改动任何断言 / 退出码语义）。
 *
 * 备注：`gracefulShutdown` 在 Playwright 1.62.1 中**受支持但在 Windows 上被忽略**
 * （Windows 不支持 SIGTERM/SIGINT，源码会直接抛错并回退到 taskkill），故它不是本机
 * 修复手段；此处保留配置是为 POSIX/CI runner 提供优雅关闭语义。
 */
export default defineConfig({
  testDir: 'tests/smoke',
  testMatch: '**/*.e2e.spec.ts',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4173',
  },
  webServer: {
    // 直接调用 Vite CLI（非 npm）：cmd → node(vite)，进程树更短，taskkill /T 更可靠。
    command: `"${process.execPath}" "${viteBin}" preview --port 4173 --strictPort`,
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    // POSIX/CI 优雅关闭（SIGTERM，超时后 SIGKILL）；Windows 下被 Playwright 忽略。
    gracefulShutdown: { signal: 'SIGTERM', timeout: 1_000 },
  },
});
