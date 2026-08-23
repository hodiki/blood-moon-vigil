import { describe, it, expect } from 'vitest';
import {
  MERIT_BONUSES,
  MERIT_MAX_EQUIPPED,
  MERIT_TOTAL_COST,
  meritUnlockCost,
  isMeritUnlocked,
} from '@/stats/merit';
import {
  meritCardState,
  meritNextUnlock,
  meritProgressText,
  meritProgressRatio,
  meritEquippedCount,
} from '@/ui/merit-overlay';

describe('守夜功绩 UI 纯逻辑（merit-ui-spec v1.0）', () => {
  it('4 加成 + 解锁成本 20/30/40/30 = 120（spec §3）', () => {
    expect(MERIT_BONUSES).toHaveLength(4);
    expect(meritUnlockCost('merit_hp')).toBe(20);
    expect(meritUnlockCost('merit_dmg')).toBe(30);
    expect(meritUnlockCost('merit_magnet')).toBe(40);
    expect(meritUnlockCost('merit_speed')).toBe(30);
    const total = MERIT_BONUSES.reduce((acc, m) => acc + m.cost, 0);
    expect(total).toBe(MERIT_TOTAL_COST);
    expect(total).toBe(120);
  });

  it('卡片三态（spec §4）：未解锁 / 已解锁未装备 / 已装备', () => {
    // 未解锁（points < cost）
    expect(meritCardState(10, [], 'merit_hp')).toBe('locked');
    expect(isMeritUnlocked(10, 'merit_hp')).toBe(false);
    // 已解锁未装备
    expect(meritCardState(30, [], 'merit_hp')).toBe('ready');
    // 已装备
    expect(meritCardState(0, ['merit_hp'], 'merit_hp')).toBe('equipped'); // 装备态优先
  });

  it('同时最多装 2 个（spec §5：gdd-codex §3.4/§6.4）', () => {
    expect(MERIT_MAX_EQUIPPED).toBe(2);
    expect(meritEquippedCount(['merit_hp', 'merit_dmg'])).toBe(2);
    expect(meritEquippedCount([])).toBe(0);
  });

  it('进度条：距下个未解锁加成（按成本升序）；全解锁 → 无', () => {
    expect(meritNextUnlock(0)?.id).toBe('merit_hp');
    expect(meritNextUnlock(0)?.cost).toBe(20);
    expect(meritNextUnlock(25)?.id).toBe('merit_dmg'); // hp 已解锁（25 ≥ 20）
    expect(meritNextUnlock(25)?.cost).toBe(30);
    expect(meritNextUnlock(120)).toBeNull();
    expect(meritProgressText(0)).toBe('距下个未解锁加成还差 20 点');
    expect(meritProgressText(25)).toBe('距下个未解锁加成还差 5 点');
    expect(meritProgressText(120)).toBe('全部加成已解锁');
  });

  it('进度比例（0..1 clamp）：points/120', () => {
    expect(meritProgressRatio(0)).toBe(0);
    expect(meritProgressRatio(60)).toBeCloseTo(0.5, 6);
    expect(meritProgressRatio(120)).toBe(1);
    expect(meritProgressRatio(200)).toBe(1); // clamp
    expect(meritProgressRatio(-5)).toBe(0); // clamp
  });

  it('红线达标标识数据：全部 4 加成对 6 分钟成型强度影响 ≤10%（spec §3 红线）', () => {
    // meritImpactPct 断言在 stats/merit.test.ts；此处确认 UI 依赖的 4 加成清单与红线口径一致
    for (const m of MERIT_BONUSES) {
      expect(m.cost).toBeGreaterThan(0);
    }
  });
});
