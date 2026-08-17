/**
 * ui/start-overlay.ts —— 启动页「点击开始」（ux-spec §1 / audio-bible §4）
 *
 * Web 音频策略硬前提：AudioContext 需用户手势解锁。本层是唯一解锁点——
 * 点击回调内调 AudioManager.unlock()，随后进入 PlayScene（ux-spec §1 屏幕流）。
 * ADR-004：DOM 覆盖层；色板抄 art-bible（底 #131722、文字 #F2F5F9、冷青 #54E6C9）。
 * 按钮热区 240×56 ≥ 44px（ux-spec §3 触控热区硬标准）。
 */

import { getOverlayHost } from '@/ui/overlay-host';

export interface StartOverlay {
  destroy(): void;
}

export function createStartOverlay(onStart: () => void): StartOverlay {
  const host = getOverlayHost();
  ensureStyles(host);

  const root = document.createElement('div');
  root.className = 'bmv-start';
  root.setAttribute('aria-label', '血月守夜 点击开始');
  root.innerHTML = `
    <div class="bmv-start-mask"></div>
    <div class="bmv-start-panel">
      <div class="bmv-start-title">血月守夜</div>
      <div class="bmv-start-sub">Blood Moon Vigil</div>
      <button class="bmv-start-btn" type="button">点击开始</button>
    </div>
  `;
  host.appendChild(root);

  const btn = root.querySelector('.bmv-start-btn') as HTMLButtonElement;
  btn.addEventListener('click', onStart);

  return {
    destroy(): void {
      btn.removeEventListener('click', onStart);
      root.remove();
    },
  };
}

/** CSS 注入一次（ADR-004：布局/动画走 CSS；与 levelup/results 视觉协调） */
function ensureStyles(host: HTMLElement): void {
  if (document.getElementById('bmv-start-styles')) return;
  const style = document.createElement('style');
  style.id = 'bmv-start-styles';
  style.textContent = `
    .bmv-start {
      position: absolute; inset: 0;
      display: flex;
      align-items: center; justify-content: center;
      pointer-events: auto;
      z-index: 70; /* 首屏最高层 */
      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px)
               env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
    }
    .bmv-start-mask {
      position: absolute; inset: 0;
      background: rgba(11, 14, 20, 0.92); /* PALETTE.base 蒙层 */
    }
    .bmv-start-panel {
      position: relative;
      display: flex; flex-direction: column;
      align-items: center;
      padding: 40px 48px;
      background: #131722;
      border: 2px solid #2A3346;
      border-radius: 12px;
    }
    .bmv-start-title {
      font-size: 40px; font-weight: 700;
      color: #F2F5F9;
      letter-spacing: 4px;
    }
    .bmv-start-sub {
      font-size: 16px; color: #A9B4C4;
      margin-top: 8px; margin-bottom: 28px;
      letter-spacing: 2px;
    }
    .bmv-start-btn {
      width: 240px; height: 56px;
      font-size: 22px; font-weight: 700;
      color: #F2F5F9;
      background: #131722;
      border: 2px solid #54E6C9; border-radius: 8px;
      cursor: pointer;
      transition: transform 0.1s ease-out, box-shadow 0.1s ease-out;
    }
    .bmv-start-btn:hover {
      transform: scale(1.03);
      box-shadow: 0 0 0 2px #54E6C9;
    }
    /* 移动端：面板随视口收缩，按钮保持全宽热区 ≥44px（ux-spec §3） */
    @media (max-width: 900px) {
      .bmv-start-panel { padding: 28px 20px; max-width: calc(100vw - 32px); box-sizing: border-box; }
      .bmv-start-title { font-size: 30px; }
      .bmv-start-btn { width: 100%; height: 56px; min-width: 200px; }
    }
  `;
  host.appendChild(style);
}
