import { describe, it, expect } from 'vitest';
import {
  COMBAT_WORLD_PX,
  GROUND_BASELINE_CANVAS,
  GROUND_CENTER_ORIGIN,
  PLAYER_FOOT_OFFSET,
  applyCombatDisplayScale,
  combatDisplayScale,
  groundAnchorBodyOffset,
  groundAnchorOriginY,
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

/**
 * NV-ENG-EXEC-35：加尔文换 160 画布后的地线锚点。
 *
 * 口径与 `weapons/companion/oathkeeper-view.ts` 的 PLAYER_FOOT_OFFSET 完全一致：
 * 「地面线 = 最低不透明像素行中心」。128 画布英雄（薇奥莱/卡珊德拉/魔化）脚底 = y + 63.5，
 * 加尔文画布升到 160 后仍是 y + 63.5，故 originY 必须从 0.5 抬到 0.6（= 96/160）。
 *
 * 反例（交付单 P1 的字面写法 159/160）会把脚放到 y 本身 → 比同 y 的薇奥莱**高 63px**。
 */
describe('groundAnchorOriginY（画布高 → 落同一条地线的 originY）', () => {
  it('128 及以下画布保持默认居中锚点（现有角色零行为变化）', () => {
    expect(GROUND_CENTER_ORIGIN).toBe(0.5);
    expect(GROUND_BASELINE_CANVAS).toBe(128);
    expect(groundAnchorOriginY(128)).toBe(0.5);
    expect(groundAnchorOriginY(64)).toBe(0.5);
    expect(groundAnchorOriginY(0)).toBe(0.5);
  });

  it('160 画布 → 0.6；192 画布 → 2/3', () => {
    expect(groundAnchorOriginY(160)).toBeCloseTo(0.6, 10);
    expect(groundAnchorOriginY(192)).toBeCloseTo(128 / 192, 10);
  });

  it('换算回「脚底相对 y 的偏移」恒等于 PLAYER_FOOT_OFFSET（128 / 160 / 192 三档）', () => {
    expect(PLAYER_FOOT_OFFSET).toBe(63.5);
    for (const h of [128, 160, 192]) {
      const anchor = groundAnchorOriginY(h) * h; // displayOriginY
      const footBelowAnchor = h - 1 + 0.5 - anchor;
      expect(footBelowAnchor).toBeCloseTo(PLAYER_FOOT_OFFSET, 10);
    }
  });

  it('交付单 P1 字面值（159/160）不满足地线：脚会高出 63px', () => {
    const displayOrigin = (159 / 160) * 160;
    expect(160 - 1 + 0.5 - displayOrigin).toBeCloseTo(0.5, 10);
    expect(PLAYER_FOOT_OFFSET - 0.5).toBeCloseTo(63, 10);
  });
});

describe('groundAnchorBodyOffset（换画布后把 Arcade Body 补回 128 画布位置）', () => {
  it('128 画布 + 默认锚点 → (0,0)（现网玩家零变化）', () => {
    expect(groundAnchorBodyOffset(128, 0.5 * 128)).toEqual({ x: 0, y: 0 });
  });

  it('160 画布 + originY 0.6 → (16,32)：body 左上角仍停在 128 画布时代的 (-64,-64)', () => {
    const off = groundAnchorBodyOffset(160, 0.6 * 160);
    expect(off).toEqual({ x: 16, y: 32 });
    // Phaser：body.x = sprite.x - displayOriginX + offset.x（Body.updateFromGameObject）
    expect(0.5 * 160 - off.x).toBeCloseTo(0.5 * 128, 10);
    expect(0.6 * 160 - off.y).toBeCloseTo(0.5 * 128, 10);
  });
});
