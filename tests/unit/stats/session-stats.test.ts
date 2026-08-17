import { describe, it, expect } from 'vitest';
import {
  RESTART_COUNT_KEY,
  readRestartCount,
  incrementRestartCount,
  type RestartStorage,
} from '@/stats/session-stats';

/**
 * TASK-21 P1：重开率数据源（concept §9 再来一局 ≥50%）。
 * Session 级「再来一局」点击计数 → LocalStorage 累计 + game:over payload 携带。
 */

function makeStorage(seed: Record<string, string> = {}): RestartStorage & { map: Map<string, string> } {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

describe('SessionStats 重开率埋点（TASK-21 P1）', () => {
  it('缺键时读 0，不抛错', () => {
    expect(readRestartCount(makeStorage())).toBe(0);
  });

  it('累计 +1 并写回；连续点击递增', () => {
    const storage = makeStorage();
    expect(incrementRestartCount(storage)).toBe(1);
    expect(incrementRestartCount(storage)).toBe(2);
    expect(readRestartCount(storage)).toBe(2);
    expect(storage.map.get(RESTART_COUNT_KEY)).toBe('2');
  });

  it('已有累计可跨局读取（session 级，非单局）', () => {
    const storage = makeStorage({ [RESTART_COUNT_KEY]: '5' });
    expect(readRestartCount(storage)).toBe(5);
    expect(incrementRestartCount(storage)).toBe(6);
  });

  it('损坏值兜底 0（非数字/负数）', () => {
    expect(readRestartCount(makeStorage({ [RESTART_COUNT_KEY]: 'abc' }))).toBe(0);
    expect(readRestartCount(makeStorage({ [RESTART_COUNT_KEY]: '-3' }))).toBe(0);
    expect(readRestartCount(makeStorage({ [RESTART_COUNT_KEY]: '2.7' }))).toBe(2); // 向下取整
  });

  it('storage 抛错不阻断流程（隐私模式兜底）', () => {
    const broken: RestartStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(readRestartCount(broken)).toBe(0);
    expect(incrementRestartCount(broken)).toBe(1); // 读取失败按 0+1，写失败吞掉
  });
});
