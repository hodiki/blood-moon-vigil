/**
 * utils/smoke.ts —— Phaser 内嵌自检（L2 冒烟，test-framework §2/§3.2）
 *
 * 仅 `?smoke=1` 启用：跑 N 帧后断言帧推进、场景装配、无 console error，
 * 结果写入 `window.__SMOKE_RESULT__` 并打印 `SMOKE_RESULT: {...}` 供自动化/人工判定。
 * 判定规则（与 tests/smoke/smoke-embed.ts 一致）：
 *   framesAdvanced === true && sceneReady === true && consoleErrors.length === 0
 */

export interface SmokeResult {
  framesAdvanced: boolean;
  sceneReady: boolean;
  consoleErrors: string[];
  elapsedMs: number;
  frame: number;
}

declare global {
  interface Window {
    __SMOKE_RESULT__?: SmokeResult;
  }
}

const SMOKE_FRAMES = 60;

let consoleErrors: string[] = [];
let originalError: ((...args: unknown[]) => void) | null = null;

/** 安装 console.error 捕获（main.ts 在 ?smoke=1 时调用，仅一次） */
export function installConsoleErrorCapture(): void {
  if (originalError) return;
  originalError = console.error;
  console.error = (...args: unknown[]) => {
    consoleErrors.push(args.map(String).join(' '));
    originalError?.(...args);
  };
}

export interface SmokeContext {
  sceneReady: boolean;
  frame: number;
}

/** 收集自检结果（在 N 帧后由 PlayScene 调用） */
export function collectSmokeResult(ctx: SmokeContext, startedAt: number): SmokeResult {
  return {
    framesAdvanced: ctx.frame >= SMOKE_FRAMES,
    sceneReady: ctx.sceneReady,
    consoleErrors: [...consoleErrors],
    elapsedMs: performance.now() - startedAt,
    frame: ctx.frame,
  };
}

/** 写入结果（window 全局 + console 标记） */
export function writeSmokeResult(result: SmokeResult): void {
  if (typeof window !== 'undefined') {
    window.__SMOKE_RESULT__ = result;
  }
  // eslint-disable-next-line no-console
  console.log(`SMOKE_RESULT: ${JSON.stringify(result)}`);
}

export const SMOKE_FRAMES_COUNT = SMOKE_FRAMES;
