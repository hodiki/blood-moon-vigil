import { describe, it, expect } from 'vitest';
import { UPGRADES } from '@/config/balance';
import {
  rollThree,
  mechanicRatio,
  isMaxed,
  pickWeight,
  stacksFor,
  UpgradeState,
  type UpgradeOption,
} from '@/upgrade/upgrade-pool';

describe('升级池 12 项（upgrade-pool §③ / E3-S3）', () => {
  it('恰好 12 项（U8-1）', () => {
    expect(UPGRADES).toHaveLength(12);
  });

  it('机制改变型 9/12 = 75% ≥ 50%（U8-1）', () => {
    expect(mechanicRatio()).toBeCloseTo(0.75, 6);
  });

  it('叠加上限与 GDD 一致：3 分裂×2 / 4 球+3 / 5 范围×2 / 9 磁吸×2 / 10 可重复 / 11 冷却×3 / 12 HP×5', () => {
    const max = (id: number) => UPGRADES.find((u) => u.id === id)!.maxStack;
    expect(max(3)).toBe(2);
    expect(max(4)).toBe(3); // 最多 6 颗 = 基础 3 + 3
    expect(max(5)).toBe(2);
    expect(max(9)).toBe(2);
    expect(max(10)).toBe(Number.POSITIVE_INFINITY);
    expect(max(11)).toBe(3);
    expect(max(12)).toBe(5);
  });

  it('1/2 号项为「新武器解锁」（机制型，maxStack 1）', () => {
    expect(UPGRADES[0]).toMatchObject({ id: 1, name: '解锁「守夜之环」', type: 'mechanic', maxStack: 1 });
    expect(UPGRADES[1]).toMatchObject({ id: 2, name: '解锁「月蚀脉冲」', type: 'mechanic', maxStack: 1 });
  });
});

describe('抽取规则（upgrade-pool §③ / U8-4）', () => {
  const item = (id: number) => UPGRADES.find((u) => u.id === id)!;

  it('未解锁项权重 ×2：0 次 = 2，≥1 次 = 1', () => {
    const state = new UpgradeState();
    const i3 = item(3);
    expect(pickWeight(i3, state)).toBe(2);
    state.missileSplit = 1;
    expect(pickWeight(i3, state)).toBe(1);
  });

  it('上次选过项权重 ×0.5（未解锁×上次选过叠加 = 2×0.5 = 1）', () => {
    const state = new UpgradeState();
    state.lastPickId = 3;
    expect(pickWeight(item(3), state)).toBe(1); // 未解锁 2 × 0.5
    state.missileSplit = 1;
    expect(pickWeight(item(3), state)).toBe(0.5); // 已解锁 1 × 0.5
  });

  it('stacksFor 与满级判定（isMaxed）', () => {
    const state = new UpgradeState();
    state.orbitUnlocked = true;
    expect(stacksFor(state, 1)).toBe(1);
    expect(isMaxed(item(1), state)).toBe(true);
    state.missileSplit = 2;
    expect(isMaxed(item(3), state)).toBe(true);
    expect(isMaxed(item(10), state)).toBe(false); // 可重复项恒不满级
  });

  it('rollThree：三选一不重复、剔除已满级（U8-4）', () => {
    const state = new UpgradeState();
    state.missileSplit = 2; // 3 号满级
    const picks = rollThree(state, () => 0.5);
    expect(picks).toHaveLength(3);
    expect(new Set(picks.map((p) => p.id)).size).toBe(3);
    expect(picks.some((p) => p.id === 3)).toBe(false);
  });

  it('新武器（1/2 号）未解锁权重 ×2：低随机数首先命中 1 号', () => {
    const state = new UpgradeState();
    const picks = rollThree(state, () => 0.01); // 极小 r → 落在权重序首位
    expect(picks[0]!.id).toBe(1); // 全部未解锁时 1 号排在候选首位（权重序同 GDD 表序）
  });

  it('全满级回退到可重复数值项 10（U8-§③）', () => {
    const state = new UpgradeState();
    state.orbitUnlocked = true;
    state.shockwaveUnlocked = true;
    state.missileSplit = 2;
    state.orbBonus = 3;
    state.shockwaveRangeBonus = 2;
    state.missilePierce = 1;
    state.shockwaveKnockback = true;
    state.lifesteal = true;
    state.magnetBonus = 2;
    state.cooldownReductionStacks = 3;
    state.maxHpBonusStacks = 5;
    // 项 10 可重复恒在池内 → 候选只剩 10 号
    const picks = rollThree(state, () => 0);
    expect(picks.every((p) => p.id === 10)).toBe(true);
  });

  it('rollThree 返回结构含 item 元数据（供 DOM 渲染）', () => {
    const state = new UpgradeState();
    const picks: UpgradeOption[] = rollThree(state, () => 0.5);
    for (const p of picks) {
      expect(p.item.id).toBe(p.id);
      expect(typeof p.item.name).toBe('string');
      expect(typeof p.item.desc).toBe('string');
    }
  });

  describe('TASK-39 E2 首级强制武器（forceWeaponFirst）', () => {
    it('forceWeaponFirst=true：三选一必含 1 或 2 号（即使 rng 偏向末尾项）', () => {
      const state = new UpgradeState();
      // rng 恒 0.999 → 加权不放回正常会取末尾数值项（10/11/12…），不含 1/2 号武器
      const picks = rollThree(state, () => 0.999, { forceWeaponFirst: true });
      expect(picks.some((p) => p.id === 1 || p.id === 2)).toBe(true);
    });

    it('forceWeaponFirst=true 且武器已满级（1/2 号都选过）：自然回落、不强制', () => {
      const state = new UpgradeState();
      state.orbitUnlocked = true;
      state.shockwaveUnlocked = true;
      // 武器满级后 force 无可用项 → 正常加权抽取（此时首抽仍可能抽到任意未满级项）
      const picks = rollThree(state, () => 0.01, { forceWeaponFirst: true });
      expect(picks.some((p) => p.id === 1 || p.id === 2)).toBe(false); // 已满级不可能再出现
      expect(picks).toHaveLength(3);
    });

    it('forceWeaponFirst=false（默认）：保持纯随机（不含武器也可能）', () => {
      const state = new UpgradeState();
      const picks = rollThree(state, () => 0.999);
      // 纯随机可能完全不含 1/2 号（末尾数值项优先）——这正是"首级无武器"旧问题的复现前提
      expect(picks.some((p) => p.id === 1 || p.id === 2)).toBe(false);
    });

    it('首级强制后其余 2 项不重复且来自候选池（不放回）', () => {
      const state = new UpgradeState();
      const picks = rollThree(state, () => 0.5, { forceWeaponFirst: true });
      expect(picks).toHaveLength(3);
      expect(new Set(picks.map((p) => p.id)).size).toBe(3);
    });
  });
});
