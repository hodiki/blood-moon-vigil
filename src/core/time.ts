/**
 * core/time.ts —— 时间工具：delta 归一化 / 防跳怪（ARCH §3.5 / 性能预算表 #10）
 *
 * 语义（两档上限）：
 * - 常规上限 maxMs=50ms：clampDelta(80) = 0.05s（正常帧率波动下逻辑帧不超 50ms）；
 * - 极端掉帧保护 hardMs=250ms：帧间隔 >250ms 时按 250ms 处理
 *   （宁可短暂卡顿不错乱逻辑；不按真实间隔补帧导致实体瞬移穿墙）。
 * 返回值为「秒」，所有冷却/生成预算/无敌帧均以秒为单位累加，与帧率解耦。
 */

export const DEFAULT_MAX_DELTA_MS = 50;
export const HARD_MAX_DELTA_MS = 250;

export function clampDelta(
  deltaMs: number,
  maxMs: number = DEFAULT_MAX_DELTA_MS,
  hardMs: number = HARD_MAX_DELTA_MS,
): number {
  if (!Number.isFinite(deltaMs) || deltaMs < 0) return 0;
  const capped = deltaMs > hardMs ? hardMs : Math.min(deltaMs, maxMs);
  return capped / 1000;
}

/** 毫秒 → 秒（供秒制累加器统一换算） */
export function toSeconds(ms: number): number {
  return ms / 1000;
}

/**
 * 秒制累加判定（纯函数）：返回 acc + dtSeconds 是否达到阈值。
 * 不修改 acc —— 由调用方持有并更新累加值（如 `this.acc = fired ? 0 : this.acc + dt`）。
 * 用于「帧率无关」的生成预算 / 冷却计时（ARCH §3.5）。
 */
export function accumulate(acc: number, dtSeconds: number, thresholdSeconds: number): boolean {
  if (thresholdSeconds <= 0) return true;
  return acc + dtSeconds >= thresholdSeconds;
}
