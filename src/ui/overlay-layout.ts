/**
 * ui/overlay-layout.ts —— DOM 覆盖层响应式布局纯函数（TASK-21 Bug2，可脱离 DOM 单测）
 *
 * 用户真机反馈：移动端竖屏三选一仅部分可见（3×200px+间距=632px > 390px 视口溢出）；
 * 横屏画面偏移。根因：覆盖层使用固定 px（320/200 卡宽），在窄视口下溢出。
 *
 * 修复语义：卡片宽度 = min(基准宽, (视口宽 − 2×边距 − 2×间距)/3)，保证任意视口
 * 三卡完整居中不溢出；高度同样按视口收缩兜底（热区 ≥44px 下限）。
 * 数值与 levelup-overlay.ts 内嵌 CSS 的 `min()`/`max-width` 公式一一镜像
 * （CSS 不支持 import TS 常量，此处为唯一数值源，改动需同步两侧并跑本单测）。
 */

export interface LevelUpCardLayout {
  /** 单卡宽（px，≤基准 320/200，且 ≥44 热区下限） */
  cardWidth: number;
  /** 单卡高（px，≤基准 180/112，且 ≥44） */
  cardHeight: number;
  /** 卡间距（px，桌面 24 / 移动 16；极窄兜底 0） */
  gap: number;
  /** 三卡整行宽 = 3×cardWidth + 2×gap（应 ≤ 视口宽） */
  rowWidth: number;
  /** 侧边距（px，桌面 40 / 移动 12） */
  margin: number;
  /** 是否完整可见：整行宽 ≤ 视口宽 且 卡高 ≤ 视口高 */
  fits: boolean;
}

export const MOBILE_BREAKPOINT_PX = 900;
export const MIN_HOT_ZONE_PX = 44;

export function computeLevelUpCardLayout(viewportWidth: number, viewportHeight: number): LevelUpCardLayout {
  const isNarrow = viewportWidth <= MOBILE_BREAKPOINT_PX;
  const baseCardWidth = isNarrow ? 200 : 320;
  const baseCardHeight = isNarrow ? 112 : 180;
  const baseGap = isNarrow ? 16 : 24;
  const margin = isNarrow ? 12 : 40;

  const available = Math.max(0, viewportWidth - margin * 2);
  // 间距按需收缩（极窄兜底 0），避免可用宽为负
  let gap = baseGap;
  let cardWidth = (available - gap * 2) / 3;
  if (cardWidth <= 0) {
    gap = 0;
    cardWidth = available / 3;
  }
  cardWidth = Math.min(baseCardWidth, cardWidth);
  // 热区下限 44px：仅在不导致整行溢出时生效 —— 极端窄视口（<~220px）下
  // 「完整可见」是硬要求，热区让位（真实设备最小 320px 时 3×44+32=164 ≤ 320 恒成立）
  const hotZoneFloor = Math.min(MIN_HOT_ZONE_PX, (viewportWidth - gap * 2) / 3);
  cardWidth = Math.max(hotZoneFloor, cardWidth);
  // 高度兜底：超短横屏（vh 过小）时收缩，仍保 ≥44 热区
  const cardHeight = Math.min(baseCardHeight, Math.max(MIN_HOT_ZONE_PX, viewportHeight - 16));

  const rowWidth = cardWidth * 3 + gap * 2;
  return {
    cardWidth,
    cardHeight,
    gap,
    rowWidth,
    margin,
    fits: rowWidth <= viewportWidth && cardHeight <= viewportHeight,
  };
}
