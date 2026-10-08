import { describe, it, expect } from 'vitest';
import {
  COMBAT_WORLD_PX,
  applyCombatDisplayScale,
  combatDisplayScale,
} from '@/fx/combat-display-scale';

describe('combatDisplayScale（评 C · 锁稿日才接到精灵）', () => {
  it('世界 128：64 帧 ×2，128 帧 ×1', () => {
    expect(COMBAT_WORLD_PX).toBe(128);
    expect(combatDisplayScale(64)).toBe(2);
    expect(combatDisplayScale(128)).toBe(1);
  });

  it('小于 128 的纹理才抬到英雄世界边；192 守誓者 1:1 比她高', () => {
    expect(combatDisplayScale(96)).toBeCloseTo(128 / 96);
    expect(combatDisplayScale(192)).toBe(1);
  });

  it('缺宽时不放大', () => {
    expect(combatDisplayScale(0)).toBe(1);
  });

  it('狂化乘在占地缩放上：128 帧 ×1.1，64 帧 ×2.2', () => {
    const seen: number[] = [];
    const sprite128 = { frame: { width: 128 }, setScale: (s: number) => seen.push(s) };
    expect(applyCombatDisplayScale(sprite128, 1.1)).toBeCloseTo(1.1);
    const sprite64 = { frame: { width: 64 }, setScale: (s: number) => seen.push(s) };
    expect(applyCombatDisplayScale(sprite64, 1.1)).toBeCloseTo(2.2);
    expect(seen).toEqual([1.1, 2.2]);
  });
});
