/**
 * scenes/run/bench-smoke-runner.ts —— ?smoke=1 / ?bench=1 / ?qa=1 运行模式承载
 * （NV-REVIEW-FIX-F W-F1：自 PlayScene 机械搬移，行为零变化）
 *
 * 职责：
 * - ?smoke=1：60 帧内 RUNNING 判据 → 写冒烟结果（tests/smoke/smoke-embed.ts 判定规则）
 * - ?bench=1：36s 连续 20× 采样（20× 时缩放由场景侧 apply，本层只记录/断言）→
 *   avg/min fps、实体峰值、draw call 估算 → window.__BENCH_RESULT__
 * - ?qa=1：方阵掷点观测开关（PlayScene 据此装配 spawner.groupRollLogger）
 *
 * 依赖以 ports 注入（场景 create 装配完成后 attach；update 期才解引用，构造期无场景依赖）。
 */

import { collectSmokeResult, writeSmokeResult, SMOKE_FRAMES_COUNT } from '@/utils/smoke';
import { FpsMonitor, estimateDrawCalls, writeBenchResult } from '@/utils/perf';

/**
 * E4-S5 基准：36s 峰值压力窗（TASK-31 收尾 rhythm-pace-adj §6：60_000→36_000，
 * 36s = 完整 1 局 + Boss 战全程 + 第 2 局爬升，峰值段 18s 持续采样）。
 */
const BENCH_DURATION_MS = 36_000;

export interface BenchSmokePorts {
  /** 冒烟判据：RUNNING 且玩家在场（tickSmoke 期调用） */
  sceneReady: () => boolean;
  activeEnemies: () => number;
  activeBullets: () => number;
  playerActive: () => boolean;
  orbCount: () => number;
  shockwaveActive: () => boolean;
  fxActive: () => boolean;
  isMobile: () => boolean;
}

export class BenchSmokeRunner {
  /** ?smoke=1（冒烟自检） */
  readonly smoke: boolean;
  /** ?bench=1（性能基准） */
  readonly bench: boolean;
  /** ?qa=1（NV-INTEG-FIX ⑤ 观测模式） */
  readonly qa: boolean;

  // 冒烟自检状态
  private smokeStartedAt = 0;
  private smokeFrames = 0;
  private smokeWritten = false;

  // E4-S5 性能基准状态
  private readonly benchFps = new FpsMonitor();
  private benchStartedAt = 0;
  private benchDone = false;
  private benchPeakEnemies = 0;
  private benchPeakBullets = 0;

  private ports: BenchSmokePorts | null = null;

  constructor() {
    const params =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    this.smoke = params.has('smoke');
    this.bench = params.has('bench');
    this.qa = params.has('qa');
  }

  /** 场景装配完成后注入依赖（闭包解引用，无构造期耦合） */
  attach(ports: BenchSmokePorts): void {
    this.ports = ports;
  }

  /** 基准模式起点（原 PlayScene.create 尾段 bench 块的计时部分） */
  beginBench(): void {
    this.benchStartedAt = performance.now();
    this.benchFps.reset();
  }

  /** 冒烟模式起点（原 PlayScene.create 尾段 smoke 块） */
  beginSmoke(): void {
    this.smokeStartedAt = performance.now();
  }

  /** 每帧基准采样（非 bench 模式 no-op；原 PlayScene.update 首段） */
  updateBench(delta: number): void {
    if (!this.bench) return;
    this.benchFps.record(delta);
    this.trackBenchPeaks();
    if (!this.benchDone && performance.now() - this.benchStartedAt >= BENCH_DURATION_MS) {
      this.benchDone = true;
      this.finishBench();
    }
  }

  /** 内嵌自检：跑 N 帧后写入结果一次（tests/smoke/smoke-embed.ts 判定规则） */
  tickSmoke(): void {
    if (!this.smoke || this.smokeWritten) return;
    this.smokeFrames += 1;
    if (this.smokeFrames >= SMOKE_FRAMES_COUNT) {
      this.smokeWritten = true;
      const result = collectSmokeResult(
        {
          sceneReady: this.ports?.sceneReady() ?? false,
          frame: this.smokeFrames,
        },
        this.smokeStartedAt,
      );
      writeSmokeResult(result);
    }
  }

  // —— E4-S5 性能基准（原 PlayScene 私有实现，原样搬移） ——

  private trackBenchPeaks(): void {
    const ports = this.ports;
    if (!ports) return;
    const enemies = ports.activeEnemies();
    const bullets = ports.activeBullets();
    if (enemies > this.benchPeakEnemies) this.benchPeakEnemies = enemies;
    if (bullets > this.benchPeakBullets) this.benchPeakBullets = bullets;
  }

  /** 36s 峰值压力结束：聚合断言数据 → window.__BENCH_RESULT__（TASK-28：draw call 模型含 ambient/粒子组） */
  private finishBench(): void {
    const ports = this.ports;
    if (!ports) return;
    const charactersActive =
      this.benchPeakEnemies +
      this.benchPeakBullets +
      (ports.playerActive() ? 1 : 0) +
      ports.orbCount();
    const effectsActive = ports.shockwaveActive() ? 1 : 0;
    // TASK-28：ambient 组（血月/渐晕/贴花）常驻 1；粒子发射器计 extra pass（活跃时 1）
    const ambientActive = 1;
    const particlePasses = ports.fxActive() ? 1 : 0;
    const drawCallEstimate = estimateDrawCalls(
      { characters: charactersActive, effects: effectsActive, ambient: ambientActive },
      particlePasses,
    );
    writeBenchResult({
      platform: ports.isMobile() ? 'mobile' : 'desktop',
      avgFps: this.benchFps.avgFps,
      minFps: this.benchFps.minFps,
      frames: this.benchFps.sampleCount,
      peakActiveEnemies: this.benchPeakEnemies,
      peakActiveBullets: this.benchPeakBullets,
      drawCallEstimate,
      // TASK-31 收尾：36 真实秒 × 20× 时缩放 = 720 局时秒（2 局；6:00 Boss 收束覆盖）
      simulatedGameSeconds: 720,
    });
  }
}
