import { describe, it, expect } from 'vitest';
import {
  NarrativeDispatcher,
  TOAST_MERGE_TRIGGER,
  TOAST_MERGE_WINDOW_MS,
} from '@/narratives/narrative-dispatcher';
import { NARRATIVES, type NarrativeText, type NarrativeForm } from '@/narratives/narratives';
import type { NarrativeComponent } from '@/narratives/narrative-overlays';

interface FakeCall {
  text: string;
  durationMs: number;
}

/** fake 叙事组件（记录 show 调用；不触 DOM） */
function makeFake(form: NarrativeForm): NarrativeComponent & { calls: FakeCall[] } {
  const calls: FakeCall[] = [];
  return {
    form,
    calls,
    show(text: string, durationMs: number): void {
      calls.push({ text, durationMs });
    },
    hide(): void {
      calls.length = 0;
    },
  };
}

const ALL_FORMS: readonly NarrativeForm[] = ['top-banner', 'bottom-banner', 'side-toast', 'center-gold', 'result-title'];

function makeComponents(): Readonly<Record<NarrativeForm, NarrativeComponent & { calls: FakeCall[] }>> {
  return Object.fromEntries(ALL_FORMS.map((f) => [f, makeFake(f)])) as Readonly<
    Record<NarrativeForm, NarrativeComponent & { calls: FakeCall[] }>
  >;
}

describe('NV-PLAYER-UI W-B6 守夜日志 toast：停留缩短 + 连发合并计数', () => {
  it('合并常量与触发指向 codex-updated', () => {
    expect(TOAST_MERGE_TRIGGER).toBe('codex-updated');
    expect(TOAST_MERGE_WINDOW_MS).toBeGreaterThan(0);
  });

  it('窗口期内连发：刷新为「守夜日志已更新。×N」，不叠新文案', () => {
    let now = 1000;
    const comps = makeComponents();
    const toast = comps['side-toast']!;
    const d = new NarrativeDispatcher({ entries: NARRATIVES, components: comps, now: () => now });
    expect(d.show('codex-updated')).toBe(true);
    now += 1500; // 窗口内
    expect(d.show('codex-updated')).toBe(true);
    now += 1500; // 窗口内
    expect(d.show('codex-updated')).toBe(true);
    expect(toast.calls.map((c) => c.text)).toEqual([
      '守夜日志已更新。',
      '守夜日志已更新。×2',
      '守夜日志已更新。×3',
    ]);
    // 刷新语义：时长仍按条目 durationSec（1.3s，W-B6 缩短后）
    expect(toast.calls.every((c) => c.durationMs === 1300)).toBe(true);
  });

  it('超出窗口：视为新的一轮，计数从 1 重来（不再累加 ×）', () => {
    let now = 1000;
    const comps = makeComponents();
    const toast = comps['side-toast']!;
    const d = new NarrativeDispatcher({ entries: NARRATIVES, components: comps, now: () => now });
    expect(d.show('codex-updated')).toBe(true);
    now += TOAST_MERGE_WINDOW_MS + 1;
    expect(d.show('codex-updated')).toBe(true);
    expect(toast.calls.map((c) => c.text)).toEqual(['守夜日志已更新。', '守夜日志已更新。']);
  });

  it('resetRunState 清零合并计数（新一局首条不带 ×N）', () => {
    let now = 1000;
    const comps = makeComponents();
    const toast = comps['side-toast']!;
    const d = new NarrativeDispatcher({ entries: NARRATIVES, components: comps, now: () => now });
    d.show('codex-updated');
    d.show('codex-updated'); // ×2
    d.resetRunState();
    expect(d.show('codex-updated')).toBe(true);
    expect(toast.calls[2]!.text).toBe('守夜日志已更新。');
  });

  it('其余 trigger 不受合并影响（first-level-up 连发各自展示）', () => {
    const comps = makeComponents();
    const toast = comps['side-toast']!;
    const d = new NarrativeDispatcher({ entries: NARRATIVES, components: comps, now: () => 1000 });
    d.show('first-level-up');
    d.resetRunState(); // once 语义重置，模拟下一局
    d.show('first-level-up');
    expect(toast.calls.map((c) => c.text)).toEqual(['月光在回应你。', '月光在回应你。']);
  });

  it('n_toast_codex 表值已按玩家反馈缩短为 1.3s（spec §6 偏差待修订回写）', () => {
    const entry = NARRATIVES.find((e: NarrativeText) => e.key === 'n_toast_codex')!;
    expect(entry.durationSec).toBe(1.3);
  });
});
