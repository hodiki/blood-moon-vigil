/**
 * ui/overlay-host.ts —— DOM 覆盖层宿主（ADR-004 / ARCH §4.4）
 *
 * 唯一职责：定位 `#ui-overlay` 根节点（index.html 已预置，绝对定位盖在 canvas 上）。
 * 各 UI 模块（hud / levelup-overlay / results）只写本节点内容，不裸操作全局 DOM。
 * RUNNING 态 overlay 由 CSS `pointer-events: none` 放行给 canvas；LEVEL_UP/PAUSED/GAMEOVER
 * 时各模块自行切换为可交互（control-manifest §5 状态联动由 PlayScene 驱动）。
 */

export function getOverlayHost(): HTMLElement {
  const root = document.getElementById('ui-overlay');
  if (!root) {
    throw new Error('ui-overlay 根节点缺失（index.html ADR-004 要求 #ui-overlay 存在）');
  }
  return root;
}
