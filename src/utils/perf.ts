/**
 * utils/perf.ts —— 性能基准辅助（ARCH §6 / E4-S5 / test-framework §3.4）
 *
 * 三件套：
 * 1. FpsMonitor：帧率统计（平均/最低/样本数）。浏览器 `?bench=1` 模式逐帧喂 deltaMs。
 * 2. estimateDrawCalls：draw call 估算。按「渲染组」计数（设计口径，ARCH §5.3）：
 *    背景 1 + 每个有活跃精灵的逻辑组（characters/effects）1 + 粒子发射器等附加 pass；
 *    DOM HUD/结算/选卡 = 0（ADR-004）。阈值 ≤8（art-bible §7 / RV 放行 4）。
 *    注：程序生成贴图（procedural-textures）已收敛为 characters/effects 两组，
 *    故设计口径与真实纹理批次数一致；未经合批的散纹理会在 Phase 6 正式图集时复核。
 * 3. BenchResult：`?bench=1` 60s 峰值压力后写入 window.__BENCH_RESULT__ 的结构。
 */

declare global {
  interface Window {
    __BENCH_RESULT__?: BenchResult;
  }
}

export interface BenchResult {
  platform: 'desktop' | 'mobile';
  avgFps: number;
  minFps: number;
  frames: number;
  peakActiveEnemies: number;
  peakActiveBullets: number;
  drawCallEstimate: number;
  simulatedGameSeconds: number;
}

/** 帧率统计（按 deltaMs 喂入；window 内 fps = 1000/deltaMs） */
export class FpsMonitor {
  private samples: number[] = [];
  private min = Number.POSITIVE_INFINITY;

  record(deltaMs: number): void {
    if (deltaMs <= 0) return;
    const fps = 1000 / deltaMs;
    this.samples.push(fps);
    if (fps < this.min) this.min = fps;
  }

  get avgFps(): number {
    if (this.samples.length === 0) return 0;
    const sum = this.samples.reduce((a, b) => a + b, 0);
    return sum / this.samples.length;
  }

  get minFps(): number {
    return Number.isFinite(this.min) ? this.min : 0;
  }

  get sampleCount(): number {
    return this.samples.length;
  }

  reset(): void {
    this.samples = [];
    this.min = Number.POSITIVE_INFINITY;
  }
}

/**
 * draw call 估算（设计口径，ARCH §5.3：背景 1 + 角色组 1 + 特效组 1 + 附加 pass）。
 * activeByGroup：逻辑渲染组名 → 活跃精灵数（如 { characters: 321, effects: 12 }）。
 * extraPasses：粒子发射器 / FX pass 数（当前 Demo 无粒子，传 0）。
 */
export function estimateDrawCalls(activeByGroup: Record<string, number>, extraPasses = 0): number {
  let calls = 1; // 背景（tile-ground）
  for (const n of Object.values(activeByGroup)) {
    if (n > 0) calls += 1;
  }
  calls += extraPasses;
  return calls;
}

/** 写入基准结果（浏览器 ?bench=1 模式结束调用） */
export function writeBenchResult(result: BenchResult): void {
  if (typeof window !== 'undefined') {
    window.__BENCH_RESULT__ = result;
  }
  // eslint-disable-next-line no-console
  console.log(`BENCH_RESULT: ${JSON.stringify(result)}`);
}
