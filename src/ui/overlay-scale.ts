/**
 * ui/overlay-scale.ts —— DOM 覆盖层与画布对齐（ADR-004 / ARCH §4.4）
 *
 * 背景（TASK-43 P0 根因）：Phaser Scale.FIT 会把画布按视口等比缩放并居中（letterbox），
 * 但 `#ui-overlay`（HUD/升级卡/结算页等 DOM 覆盖层）此前以视口坐标系直接定位
 * （CSS `inset: 0` + 设计空间坐标如 HP 条 top:1018px）。当视口高度 < 设计高（1080）时，
 * 底部元素（HP 数值/血条）渲染到可视区外 —— 用户"看不到主角血条"。
 *
 * 本模块：把 `#ui-overlay` 同步到画布的「渲染矩形 + 缩放」，使覆盖层内容始终按
 * 设计空间（1920×1080 / 720×1280）布局、再整体缩放到画布实际渲染尺寸。
 * 纯函数 `computeOverlayLayout` 可脱离 DOM 单测（test-framework §1.2）。
 *
 * 注意：`transform: scale()` 只做视觉缩放，指针命中（升级卡/暂停键/结算按钮）
 * 由浏览器按变换矩阵反算，天然支持。
 */

import Phaser from 'phaser';

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface OverlayLayout {
  left: number;
  top: number;
  width: number;
  height: number;
  /** 画布渲染宽度 ÷ 设计宽度（Scale.FIT 等比，x/y 同因子） */
  scale: number;
}

/**
 * 纯函数：由 game-root 矩形 + 画布渲染矩形 + 设计尺寸推导覆盖层布局。
 * 覆盖层按设计尺寸布局（内容坐标即设计坐标），transform: scale(scale) 缩放到画布渲染尺寸，
 * 再定位到画布左上角（相对 game-root）。
 */
export function computeOverlayLayout(
  rootRect: Rect,
  canvasRect: Rect,
  designWidth: number,
  designHeight: number,
): OverlayLayout {
  const scale = designWidth > 0 ? canvasRect.width / designWidth : 1;
  return {
    left: Math.round(canvasRect.left - rootRect.left),
    top: Math.round(canvasRect.top - rootRect.top),
    width: designWidth,
    height: designHeight,
    scale,
  };
}

/** 把覆盖层同步到画布渲染矩形（main.ts 在游戏创建后 + resize 时调用） */
export function syncOverlayToCanvas(game: Phaser.Game): void {
  const host = document.getElementById('ui-overlay');
  if (!host) return;
  const root = host.parentElement;
  const canvas = game.canvas;
  if (!root || !canvas) return;
  const rootRect = root.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
  if (canvasRect.width <= 0 || canvasRect.height <= 0) return; // 画布未就绪
  const designWidth = Number(game.config.width);
  const designHeight = Number(game.config.height);
  const layout = computeOverlayLayout(
    { left: rootRect.left, top: rootRect.top, width: rootRect.width, height: rootRect.height },
    { left: canvasRect.left, top: canvasRect.top, width: canvasRect.width, height: canvasRect.height },
    designWidth,
    designHeight,
  );
  host.style.position = 'absolute';
  host.style.left = `${layout.left}px`;
  host.style.top = `${layout.top}px`;
  host.style.width = `${layout.width}px`;
  host.style.height = `${layout.height}px`;
  host.style.transform = `scale(${layout.scale})`;
  host.style.transformOrigin = 'top left';
  // M3 叙事双端：注入缩放因子供覆盖层 CSS 消费（移动端字号 ≥16px 物理：
  // 设计字号 = 16/scale 向上取整，narratives-spec §1.3/§11 —— narrative-overlays.ts）
  host.style.setProperty('--bmv-overlay-scale', String(layout.scale));
}
