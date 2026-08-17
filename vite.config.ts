import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

// Vitest 3 与 Vite 6 共用此配置：base './' 支持任意静态托管（ARCH §1.2）
export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    // 沙箱环境删除拦截规避：不清空 outDir，构建覆盖同名文件（旧 hash 资产可手动清理）
    emptyOutDir: false,
  },
  test: {
    // L1 单测全部为纯逻辑，Node 环境即可（tests/unit/**，ARCH §1.1 / test-framework §1.1）
    // 另收 tests/bench/**/*.test.ts（E4-S5 性能断言纯函数）
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/bench/**/*.test.ts'],
    globals: false,
  },
});
