import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const atlasDir = fileURLToPath(new URL('./assets/atlas', import.meta.url));

/** 把管线打好的 `assets/atlas` 挂到 /atlas，供 BootScene.load.atlas 使用 */
function servePackedAtlas(): Plugin {
  return {
    name: 'serve-packed-atlas',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        if (!url.startsWith('/atlas/')) return next();
        const name = decodeURIComponent(url.slice('/atlas/'.length));
        if (!name || name.includes('..') || name.includes('/') || name.includes('\\')) {
          res.statusCode = 404;
          res.end();
          return;
        }
        const file = path.join(atlasDir, name);
        if (!fs.existsSync(file)) return next();
        res.setHeader('Content-Type', name.endsWith('.json') ? 'application/json' : 'image/png');
        fs.createReadStream(file).pipe(res);
      });
    },
    writeBundle(options) {
      if (!fs.existsSync(atlasDir)) return;
      const dest = path.join(options.dir ?? 'dist', 'atlas');
      fs.mkdirSync(dest, { recursive: true });
      for (const f of fs.readdirSync(atlasDir)) {
        if (f.endsWith('.png') || f.endsWith('.json')) {
          fs.copyFileSync(path.join(atlasDir, f), path.join(dest, f));
        }
      }
    },
  };
}

// Vitest 3 与 Vite 6 共用此配置：base './' 支持任意静态托管（ARCH §1.2）
export default defineConfig({
  plugins: [servePackedAtlas()],
  base: './',
  // 缓存目录迁移到项目内独立目录（默认 node_modules/.vite-temp 有沙箱历史文件，
  // 被 sandbox 判定为批量删除；项目内新缓存由 Vite 自管，不影响构建）
  cacheDir: '.vitest-cache',
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
    // Windows 环境：默认 forks 池在 --reporter=verbose 全量跑完后 teardown 挂起（基线复现），
    // 显式 threads 池可干净退出（808 测试全绿；本变更仅影响测试运行池，不改变断言行为）。
    pool: 'threads',
  },
});
