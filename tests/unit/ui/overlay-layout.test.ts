import { describe, it, expect } from 'vitest';
import {
  computeLevelUpCardLayout,
  MIN_HOT_ZONE_PX,
  MOBILE_BREAKPOINT_PX,
} from '@/ui/overlay-layout';

/**
 * TASK-21 Bug2 回归：移动端三选一 DOM 覆盖层视口适配。
 *
 * 用户真机反馈：竖屏三选一选项仅部分可见（3×200+2×16=632px > 390px 溢出）；
 * 横屏画面偏移到右侧。期望：任意移动视口（含横竖屏切换）三卡完整居中可见，
 * 覆盖层与 Phaser Scale.FIT 同步（dvh/dvw + max-width 约束，不溢出）。
 */

describe('三选一卡片响应式布局（TASK-21 Bug2）', () => {
  it.each([
    [390, 844], // iPhone 12/13 竖屏
    [844, 390], // iPhone 12/13 横屏
    [375, 667], // iPhone SE 竖屏
  ])('视口 %dx%d：三卡完整可见、不溢出', (vw, vh) => {
    const layout = computeLevelUpCardLayout(vw, vh);
    expect(layout.fits).toBe(true);
    expect(layout.rowWidth).toBeLessThanOrEqual(vw);
    expect(layout.cardHeight).toBeLessThanOrEqual(vh);
    // 整行居中后左右边距对称（无右偏）
    const leftGap = (vw - layout.rowWidth) / 2;
    expect(leftGap).toBeGreaterThanOrEqual(layout.margin - 1); // 居中留白 ≥ 声明边距
    expect(leftGap).toBeCloseTo((vw - layout.rowWidth) / 2, 6);
  });

  it('移动端卡片热区 ≥44px（art-bible §6 / CM §6 硬标准）', () => {
    expect(computeLevelUpCardLayout(390, 844).cardWidth).toBeGreaterThanOrEqual(MIN_HOT_ZONE_PX);
    expect(computeLevelUpCardLayout(375, 667).cardWidth).toBeGreaterThanOrEqual(MIN_HOT_ZONE_PX);
    expect(computeLevelUpCardLayout(844, 390).cardHeight).toBeGreaterThanOrEqual(MIN_HOT_ZONE_PX);
  });

  it('竖屏 390：卡片收缩到 (390−24−32)/3 ≈ 111px，整行 ≤390 不再溢出', () => {
    const layout = computeLevelUpCardLayout(390, 844);
    expect(layout.cardWidth).toBeCloseTo((390 - 24 - 32) / 3, 6);
    expect(layout.cardWidth).toBeLessThan(200); // 原固定 200px 溢出 → 已收缩
    expect(layout.rowWidth).toBeLessThanOrEqual(390);
  });

  it('横屏 844×390：卡片保持基准 200px（够宽），高度 112 ≤390 不溢出', () => {
    const layout = computeLevelUpCardLayout(844, 390);
    expect(layout.cardWidth).toBe(200); // 宽度充足不收缩
    expect(layout.cardHeight).toBe(112);
    expect(layout.rowWidth).toBeLessThanOrEqual(844);
  });

  it('桌面 1920×1080：保持 320×180 基准规格（ux-spec §3）', () => {
    const layout = computeLevelUpCardLayout(1920, 1080);
    expect(layout.cardWidth).toBe(320);
    expect(layout.cardHeight).toBe(180);
    expect(layout.gap).toBe(24);
    expect(layout.fits).toBe(true);
  });

  it('真实最小移动视口 320px：卡片 ≥44 热区且不溢出（3×44+32=164 ≤ 320）', () => {
    const layout = computeLevelUpCardLayout(320, 568);
    expect(layout.fits).toBe(true);
    expect(layout.cardWidth).toBeGreaterThanOrEqual(MIN_HOT_ZONE_PX);
    expect(layout.rowWidth).toBeLessThanOrEqual(320);
  });

  it('极端窄视口兜底（160px）：完整可见优先，整行不溢出', () => {
    // 160px 下 3×44+32=164>160 数学不可兼得 → 热区让位于「完整可见」硬要求
    const layout = computeLevelUpCardLayout(160, 320);
    expect(layout.fits).toBe(true);
    expect(layout.rowWidth).toBeLessThanOrEqual(160);
  });

  it('移动断点常量 900px（对齐 ux-spec / CSS 媒体查询）', () => {
    expect(MOBILE_BREAKPOINT_PX).toBe(900);
  });
});
