import { describe, it, expect } from 'vitest';
import {
  PrologueOverlay,
  PROLOGUE_DEFAULT_DURATION_MS,
  indexForAdvance,
} from '@/ui/prologue-overlay';
import { splitPrologueLines } from '@/narratives/narratives';

describe('序章屏组件纯逻辑（narratives-spec §3）', () => {
  it('默认每屏时长 = 3s（spec §1.2 序章固定 3s；「2~3s 自动进入」）', () => {
    expect(PROLOGUE_DEFAULT_DURATION_MS).toBe(3000);
  });

  it('indexForAdvance：非末屏推进 +1；末屏返回 -1（完成信号）', () => {
    // 2 屏序列（通用 + 地图）：0 → 1 → -1
    expect(indexForAdvance(0, 2)).toBe(1);
    expect(indexForAdvance(1, 2)).toBe(-1);
    // 1 屏序列：0 → -1
    expect(indexForAdvance(0, 1)).toBe(-1);
    // 空序列 / 越界兜底
    expect(indexForAdvance(0, 0)).toBe(-1);
    expect(indexForAdvance(3, 2)).toBe(-1);
  });

  it('PrologueOverlay 类导出（组件本体需 DOM；本测试只验模块面，不实例化）', () => {
    expect(typeof PrologueOverlay).toBe('function');
    // 行拆分与 narratives 表同源（组件渲染消费 splitPrologueLines）
    expect(splitPrologueLines('血月升起，死者自墓中爬出。今夜，守夜人独守月光。')).toHaveLength(3);
  });
});
