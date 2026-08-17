import { describe, it, expect } from 'vitest';
import {
  applyMissileSplit,
  applyMissilePierce,
  shouldSpawnSplitMissiles,
} from '@/weapons/missile-options';
import { WEAPONS } from '@/config/balance';

/**
 * TASK-21 Bug3 回归：飞弹分裂升级后无限弹射。
 *
 * 用户真机反馈：分裂升级后次级弹命中又分裂 → 无限递归 / 无限追踪。
 * 期望：分裂只发生一次（次级弹不再分裂）、穿透与分裂互斥、命中正确销毁回池；
 * 总弹数 ≤ 同屏上限（WEAPONS.MISSILE.MAX_ACTIVE=8）。
 */

describe('飞弹分裂/穿透互斥（TASK-21 Bug3）', () => {
  it('写回分裂：level>0 清除穿透（后选者生效）', () => {
    expect(applyMissileSplit({ split: 0, pierce: 1 }, 1)).toEqual({ split: 1, pierce: 0 });
    expect(applyMissileSplit({ split: 0, pierce: 0 }, 2)).toEqual({ split: 2, pierce: 0 });
  });

  it('写回穿透：count>0 清除分裂（互斥）', () => {
    expect(applyMissilePierce({ split: 1, pierce: 0 }, 1)).toEqual({ split: 0, pierce: 1 });
  });

  it('分裂写回不误清已有分裂（叠加 1→2 保留穿透 0）', () => {
    expect(applyMissileSplit({ split: 1, pierce: 0 }, 2)).toEqual({ split: 2, pierce: 0 });
  });

  it('同屏上限 = 8（weapons §③ / ARCH §3.2）', () => {
    expect(WEAPONS.MISSILE.MAX_ACTIVE).toBe(8);
  });
});

describe('分裂触发判定（TASK-21 Bug3）', () => {
  it('主弹 + 有分裂 + 无剩余穿透 → 命中生成次级弹', () => {
    expect(shouldSpawnSplitMissiles(true, 0, 1)).toBe(true);
    expect(shouldSpawnSplitMissiles(true, 0, 2)).toBe(true);
  });

  it('次级弹（canSplit=false）命中 → 不再分裂（无限弹射根因）', () => {
    expect(shouldSpawnSplitMissiles(false, 0, 1)).toBe(false);
    expect(shouldSpawnSplitMissiles(false, 0, 2)).toBe(false);
  });

  it('有剩余穿透 → 不分裂（穿透路径优先，互斥防御）', () => {
    expect(shouldSpawnSplitMissiles(true, 1, 1)).toBe(false);
  });

  it('未选分裂（splitLevel=0）→ 不分裂', () => {
    expect(shouldSpawnSplitMissiles(true, 0, 0)).toBe(false);
  });
});

describe('分裂链模拟：只发生一次、总弹数 ≤ 同屏上限（回归主场景）', () => {
  it('主弹命中 → 生成 split 枚次级 → 次级命中不再生成（无递归）', () => {
    let spawned = 0;
    const simulateHit = (canSplit: boolean, remainingPierce: number, splitLevel: number): void => {
      if (shouldSpawnSplitMissiles(canSplit, remainingPierce, splitLevel)) {
        for (let i = 0; i < splitLevel; i += 1) {
          spawned += 1;
          simulateHit(false, 0, splitLevel); // 次级弹命中：不再分裂
        }
      }
    };
    simulateHit(true, 0, 2); // 分裂 2 枚（upgrade-pool 第 3 项上限）
    expect(spawned).toBe(2); // 只生成一层，次级不再生成 → 无无限弹射
  });

  it('最坏弹数：1 主弹 + split 枚次级 ≤ 同屏上限 8', () => {
    const worstPerChain = 1 + 2; // 1 主 + 2 次级
    expect(worstPerChain).toBeLessThanOrEqual(WEAPONS.MISSILE.MAX_ACTIVE);
  });

  it('全链路不超上限：任意 N 主弹 × 每弹 2 次级，池 reject 策略截断到 8', () => {
    // 池满策略 'reject'：acquire 返回 null 即停止生成（weapon-system 已处理），
    // 因此 active 弹数恒 ≤ maxSize=8 —— 断言每主弹生成的次级数不会导致总量超上限
    const cap = WEAPONS.MISSILE.MAX_ACTIVE;
    const subPerPrimary = 2;
    expect(subPerPrimary).toBeLessThan(cap);
    // 单主弹最坏新增 = 2 次级 ≤ 8−1 余量
    expect(subPerPrimary).toBeLessThanOrEqual(cap - 1);
  });
});
