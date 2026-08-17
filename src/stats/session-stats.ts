/**
 * stats/session-stats.ts —— Session 级统计持久化纯函数（TASK-21 P1 / concept §9 重开率数据源）
 *
 * 文策渊 E4 评审发现：重开率（再来一局 ≥50%）缺数据源 —— game:over 埋点只有单局统计，
 * 无 session 级「再来一局」点击累计。
 *
 * 修复：
 * - LocalStorage 累计键 `restartCount`：ResultsOverlay 重启按钮 onClick 时 increment。
 * - game:over 事件 payload 携带 `sessionRestartCount`（PlayScene.finishGame 读当前累计），
 *   供 concept §9 重开率验证（累计重启次数 / 结算次数）。
 *
 * storage 抽象为最小接口（getItem/setItem），测试注入 fake，Node 环境可单测。
 */

export const RESTART_COUNT_KEY = 'bmv.restartCount';

/** LocalStorage 最小读写接口（真实传 window.localStorage；测试传 fake） */
export interface RestartStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function parseCount(raw: string | null): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

/** 读取 session 累计重启次数（缺键/损坏 → 0） */
export function readRestartCount(storage: RestartStorage): number {
  try {
    return parseCount(storage.getItem(RESTART_COUNT_KEY));
  } catch {
    return 0; // localStorage 不可用（隐私模式等）不阻断流程
  }
}

/** 「再来一局」点击：累计 +1，返回新值（同时写回 storage） */
export function incrementRestartCount(storage: RestartStorage): number {
  const next = readRestartCount(storage) + 1;
  try {
    storage.setItem(RESTART_COUNT_KEY, String(next));
  } catch {
    // 写失败不抛错：统计尽力而为，不阻断重开
  }
  return next;
}
