/**
 * ui/panel-a11y.ts —— 启动页二级面板（守夜日志 / 守夜功绩）键盘可达性（QA-BUG-2）
 *
 * QA 报告（2026-08-27 BUG-2）要求：
 * ② 面板打开时 Esc 关闭面板而非穿透；③ 焦点陷阱锁面板内，关闭后焦点还给触发按钮。
 * 本模块只做事件接线，不持有游戏状态（ADR-004 单向数据流约定）。
 *
 * 用法：构造完成后 bind()，返回解绑函数在 close/destroy 时调用。
 */

/** 面板内可聚焦元素选择器（与面板 DOM 结构对齐；热区均 ≥44px 由各层 CSS 保证） */
const FOCUSABLE_SELECTOR = [
  'button',
  '[href]',
  'input',
  'select',
  'textarea',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusablesWithin(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    (el) => !el.hasAttribute('disabled') && el.tabIndex >= 0 && el.offsetParent !== null,
  );
}

export interface PanelA11yOptions {
  /** 面板根节点（Tab 陷阱与初始聚焦范围） */
  root: HTMLElement;
  /** Esc 按下回调（抽屉开→关抽屉由调用方自行分流；返回 true 表示已消费） */
  onEscape: () => boolean;
}

/**
 * 绑定 Esc 关闭 + Tab 焦点陷阱 + 初始聚焦。
 * 返回解绑函数（幂等可重复调用）。
 */
export function bindPanelA11y(opts: PanelA11yOptions): () => void {
  const { root, onEscape } = opts;

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      if (onEscape()) e.preventDefault();
      return;
    }
    if (e.key !== 'Tab') return;
    // 焦点陷阱：Shift+Tab / Tab 在面板首尾循环，不漏到面板外（防盲触「点击开始」开局）
    const items = focusablesWithin(root);
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey) {
      if (active === first || !root.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last || !root.contains(active)) {
      e.preventDefault();
      first.focus();
    }
  };

  window.addEventListener('keydown', onKeyDown, true); // capture：先于游戏内快捷键
  // 初始焦点入面板（首个可聚焦元素 = 「返回」），收起后由调用方还原外部焦点
  queueMicrotask(() => {
    const target = focusablesWithin(root)[0];
    target?.focus();
  });

  return () => window.removeEventListener('keydown', onKeyDown, true);
}
