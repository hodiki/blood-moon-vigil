/**
 * ui/pause-overlay.ts —— 暂停菜单 DOM 覆盖层（ADR-004 / ux-spec §6 / audio-bible §6）
 *
 * 内容：
 * - 「继续」恢复对局（PLAY 状态机 PAUSED → RUNNING，CM §5）
 * - 「静音」开关：全局 muted（LocalStorage 持久化；静音 ≠ 关 AudioContext，bible §6）
 * - 「减少闪烁」开关：accessibility Basic#5 共用入口（ux-spec §6 表第 5 行）；
 *   开启后暴露「触觉反馈」开关（navigator.vibrate 默认关，随该入口可选开启，bible §6）
 *
 * 热区：全部行高 ≥44px、按钮 320×56（桌面）/ 全宽 64px（移动），满足 ux-spec §3。
 * 单向数据流（ARCH §2 / ADR-004）：本层只读设置状态、只回调用户动作，不持有游戏状态。
 */

import { getOverlayHost } from '@/ui/overlay-host';

export interface PauseState {
  muted: boolean;
  reduceFlash: boolean;
  haptics: boolean;
}

export interface PauseOverlayOptions {
  onResume: () => void;
  onMuteToggle: (next: boolean) => void;
  onReduceFlashToggle: (next: boolean) => void;
  onHapticsToggle: (next: boolean) => void;
}

export class PauseOverlay {
  private readonly root: HTMLElement;
  private readonly resumeBtn: HTMLElement;
  private readonly muteInput: HTMLInputElement;
  private readonly reduceInput: HTMLInputElement;
  private readonly hapticsWrap: HTMLElement;
  private readonly hapticsInput: HTMLInputElement;
  private readonly destroyFns: Array<() => void> = [];

  constructor(host: HTMLElement, opts: PauseOverlayOptions) {
    this.ensureStyles(host);

    this.root = document.createElement('div');
    this.root.className = 'bmv-pause';
    this.root.innerHTML = `
      <div class="bmv-pause-mask"></div>
      <div class="bmv-pause-panel">
        <div class="bmv-pause-title">暂停</div>
        <label class="bmv-pause-row">
          <span class="bmv-pause-row-label">静音</span>
          <input type="checkbox" class="bmv-pause-switch" data-setting="muted" aria-label="静音" />
        </label>
        <label class="bmv-pause-row">
          <span class="bmv-pause-row-label">减少闪烁（辅助）</span>
          <input type="checkbox" class="bmv-pause-switch" data-setting="reduce" aria-label="减少闪烁" />
        </label>
        <div class="bmv-pause-haptics-wrap" data-haptics>
          <label class="bmv-pause-row">
            <span class="bmv-pause-row-label">触觉反馈</span>
            <input type="checkbox" class="bmv-pause-switch" data-setting="haptics" aria-label="触觉反馈" />
          </label>
        </div>
        <button class="bmv-pause-resume" type="button">继续</button>
      </div>
    `;
    host.appendChild(this.root);

    this.resumeBtn = this.root.querySelector('.bmv-pause-resume') as HTMLElement;
    this.muteInput = this.root.querySelector('[data-setting="muted"]') as HTMLInputElement;
    this.reduceInput = this.root.querySelector('[data-setting="reduce"]') as HTMLInputElement;
    this.hapticsWrap = this.root.querySelector('[data-haptics]') as HTMLElement;
    this.hapticsInput = this.root.querySelector('[data-setting="haptics"]') as HTMLInputElement;

    const bind = (el: HTMLElement, type: string, fn: (e: Event) => void): void => {
      el.addEventListener(type, fn);
      this.destroyFns.push(() => el.removeEventListener(type, fn));
    };
    bind(this.resumeBtn, 'click', () => opts.onResume());
    bind(this.muteInput, 'change', () => opts.onMuteToggle(this.muteInput.checked));
    bind(this.reduceInput, 'change', () => opts.onReduceFlashToggle(this.reduceInput.checked));
    bind(this.hapticsInput, 'change', () => opts.onHapticsToggle(this.hapticsInput.checked));

    this.root.style.display = 'none';
  }

  /** 展示暂停菜单（PlayScene 状态转 PAUSED 时调用；可重复调用于开关状态刷新） */
  show(state: PauseState): void {
    this.muteInput.checked = state.muted;
    this.reduceInput.checked = state.reduceFlash;
    this.hapticsInput.checked = state.haptics;
    // 触觉开关仅在「减少闪烁」开启时可见（bible §6：随该入口可选开启）
    this.hapticsWrap.style.display = state.reduceFlash ? '' : 'none';
    this.root.style.display = 'flex';
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  destroy(): void {
    for (const off of this.destroyFns) off();
    this.root.remove();
  }

  /** CSS 注入一次（ADR-004；色板抄 art-bible / ux-spec §2/§4，与 levelup/results 协调） */
  private ensureStyles(host: HTMLElement): void {
    if (document.getElementById('bmv-pause-styles')) return;
    const style = document.createElement('style');
    style.id = 'bmv-pause-styles';
    style.textContent = `
      .bmv-pause {
        position: absolute; inset: 0;
        display: none;
        align-items: center; justify-content: center;
        pointer-events: auto;
        z-index: 55; /* HUD(40) < 升级(50) < 暂停(55) < 结算(60) */
        font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
        padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px)
                 env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
      }
      .bmv-pause-mask {
        position: absolute; inset: 0;
        background: rgba(0, 0, 0, 0.7);
      }
      .bmv-pause-panel {
        position: relative;
        width: 360px;
        max-width: calc(100vw - 32px);
        max-width: calc(100dvw - 32px);
        box-sizing: border-box;
        padding: 28px;
        background: #131722;
        border: 2px solid #2A3346;
        border-radius: 12px;
        display: flex; flex-direction: column;
        align-items: stretch;
        gap: 12px;
      }
      .bmv-pause-title {
        font-size: 28px; font-weight: 700;
        color: #F2F5F9;
        text-align: center;
        margin-bottom: 8px;
      }
      .bmv-pause-row {
        min-height: 44px; /* 热区 ≥44px（ux-spec §3） */
        display: flex; align-items: center; justify-content: space-between;
        padding: 0 12px;
        font-size: 18px; color: #F2F5F9;
        background: #0B0E14;
        border: 1px solid #2A3346; border-radius: 8px;
        cursor: pointer;
        user-select: none; -webkit-user-select: none;
      }
      .bmv-pause-row-label { font-size: 18px; }
      .bmv-pause-switch {
        width: 22px; height: 22px;
        accent-color: #54E6C9;
        cursor: pointer;
      }
      .bmv-pause-haptics-wrap { display: none; }
      .bmv-pause-resume {
        width: 100%; height: 56px;
        margin-top: 8px;
        font-size: 20px; font-weight: 700;
        color: #F2F5F9;
        background: #131722;
        border: 2px solid #54E6C9; border-radius: 8px;
        cursor: pointer;
      }
      .bmv-pause-resume:hover { transform: scale(1.03); }
      @media (max-width: 900px) {
        .bmv-pause-panel { width: 92vw; max-width: 100%; padding: 20px; }
        .bmv-pause-resume { height: 64px; }
      }
    `;
    host.appendChild(style);
  }
}

/** 便捷工厂：挂到默认 #ui-overlay（PlayScene 使用） */
export function createPauseOverlay(opts: PauseOverlayOptions): PauseOverlay {
  return new PauseOverlay(getOverlayHost(), opts);
}
