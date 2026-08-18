import { describe, it, expect } from 'vitest';
import { computeOverlayLayout } from '@/ui/overlay-scale';

/**
 * TASK-43 P0 覆盖层-画布对齐（ADR-004）：纯函数布局推导单测。
 * 背景：Scale.FIT 等比缩放画布并居中，DOM 覆盖层须按设计空间布局 + scale 到画布渲染尺寸，
 * 否则视口高度 < 设计高时底部 HUD（HP 条）渲染到可视区外（"看不到主角血条"）。
 */

const DESIGN_W = 1920;
const DESIGN_H = 1080;

/** 设计空间某坐标（如 HP 数值 (24,1018)）经覆盖层缩放/平移后的视口位置 */
function designPointToViewport(
  layout: { left: number; top: number; scale: number },
  designX: number,
  designY: number,
): { x: number; y: number } {
  return { x: layout.left + designX * layout.scale, y: layout.top + designY * layout.scale };
}

describe('computeOverlayLayout 覆盖层-画布对齐（TASK-43 P0）', () => {
  it('满尺寸视口 1920×1080：scale=1、偏移 0（与旧行为完全一致，无回归）', () => {
    const layout = computeOverlayLayout(
      { left: 0, top: 0, width: 1920, height: 1080 },
      { left: 0, top: 0, width: 1920, height: 1080 },
      DESIGN_W,
      DESIGN_H,
    );
    expect(layout).toEqual({ left: 0, top: 0, width: 1920, height: 1080, scale: 1 });
  });

  it('1280×720（常见笔记本窗口）：scale≈0.667、HP 条(24,1042) 渲染到视口内（P0 回归点）', () => {
    const root = { left: 0, top: 0, width: 1280, height: 720 };
    const canvas = { left: 0, top: 0, width: 1280, height: 720 }; // Scale.FIT 1920×1080 → 1280×720
    const layout = computeOverlayLayout(root, canvas, DESIGN_W, DESIGN_H);
    expect(layout.scale).toBeCloseTo(1280 / 1920, 6);
    expect(layout.left).toBe(0);
    expect(layout.top).toBe(0);
    // HP 条左下角 (24,1042) 与 HP 数值 (24,1018) 均落在视口 [0,720) 内
    const bar = designPointToViewport(layout, 24, 1042);
    expect(bar.y).toBeLessThan(720);
    expect(bar.y).toBeGreaterThan(0);
    const num = designPointToViewport(layout, 24, 1018);
    expect(num.y).toBeLessThan(720);
  });

  it('1366×768（常见笔记本）：scale≈0.711、HP 条可见', () => {
    const layout = computeOverlayLayout(
      { left: 0, top: 0, width: 1366, height: 768 },
      { left: 0, top: 0, width: 1366, height: 768 },
      DESIGN_W,
      DESIGN_H,
    );
    expect(layout.scale).toBeCloseTo(1366 / 1920, 6);
    const bar = designPointToViewport(layout, 24, 1042);
    expect(bar.y).toBeLessThan(768);
    expect(bar.y).toBeGreaterThan(0);
  });

  it('方形视口 1000×1000（letterbox）：画布 1000×562 垂直居中，覆盖层随画布偏移、HP 条仍可见', () => {
    // Scale.FIT: scale = min(1000/1920, 1000/1080) = 1000/1920 ≈ 0.5208；画布 1000×562，top=(1000-562)/2=219
    const layout = computeOverlayLayout(
      { left: 0, top: 0, width: 1000, height: 1000 },
      { left: 0, top: 219, width: 1000, height: 562 },
      DESIGN_W,
      DESIGN_H,
    );
    expect(layout.left).toBe(0);
    expect(layout.top).toBe(219);
    expect(layout.scale).toBeCloseTo(1000 / 1920, 6);
    const bar = designPointToViewport(layout, 24, 1042);
    expect(bar.x).toBeCloseTo(24 * (1000 / 1920), 3);
    expect(bar.y).toBeLessThan(1000); // 仍在视口内
    expect(bar.y).toBeGreaterThan(219);
  });

  it('game-root 非零偏移：覆盖层定位相对 game-root（canvasRect - rootRect）', () => {
    const root = { left: 100, top: 50, width: 1280, height: 720 };
    const canvas = { left: 100, top: 50, width: 1280, height: 720 };
    const layout = computeOverlayLayout(root, canvas, DESIGN_W, DESIGN_H);
    expect(layout.left).toBe(0);
    expect(layout.top).toBe(0);
  });

  it('designWidth ≤ 0 防御：scale 回退 1，不 NaN', () => {
    const layout = computeOverlayLayout(
      { left: 0, top: 0, width: 1280, height: 720 },
      { left: 0, top: 0, width: 1280, height: 720 },
      0,
      1080,
    );
    expect(layout.scale).toBe(1);
    expect(Number.isFinite(layout.left)).toBe(true);
    expect(Number.isFinite(layout.top)).toBe(true);
  });
});
