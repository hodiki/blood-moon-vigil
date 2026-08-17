import { defineConfig } from '@playwright/test';

/**
 * Playwright 冒烟配置（L2 可选增强，test-framework §1.1/§3.3 / CI §5 P2）
 * 运行前需先 `npm run build`（webServer 起 vite preview 服务 dist）。
 */
export default defineConfig({
  testDir: 'tests/smoke',
  testMatch: '**/*.e2e.spec.ts',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4173',
  },
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
