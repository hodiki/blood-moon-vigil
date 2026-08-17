/**
 * ui/results-overlay.ts —— 结算页 DOM 覆盖层（ADR-004 / ux-spec §4 / CM §4 / E4-S4）
 *
 * 进入：GameState 转 GAMEOVER 后 PlayScene emit game:over { stats } → 本层订阅渲染。
 * 内容（ux-spec §4 / CM R3）：
 * - 标题「守夜失败」或「血月退散·守夜完成」；统计行：存活时间 / 击杀数 / 等级
 * - Build 回顾：所选升级清单（RunResult.build，滚动区，超 12 项滚动）
 * - 「再来一局」→ emit game:restart（PlayScene → scene.restart()，CM R1/R2）
 *   「返回启动」→ emit game:to-menu（PlayScene → scene.start('Boot')）
 * - 数字滚动 0→目标 0.8s 缓出递增（ux-spec §6 微交互）
 * 单向数据流（ARCH §2 / ADR-004）：本层只读 stats、只发事件；遮罩拦截非面板区点击（CM R4）。
 */

import { GameEvents, GameEvent } from '@/core/events';
import { getOverlayHost } from '@/ui/overlay-host';
import { incrementRestartCount } from '@/stats/session-stats';
import type { RunResult } from '@/stats/run-stats';

const ROLL_DURATION_MS = 800;

/** game:over 事件 payload（PlayScene.finishGame 构造；TASK-21 P1 增补 sessionRestartCount） */
export interface GameOverPayload {
  stats: RunResult;
  /** session 级累计「再来一局」次数（concept §9 重开率数据源） */
  sessionRestartCount?: number;
}

export class ResultsOverlay {
  private readonly root: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly timeEl: HTMLElement;
  private readonly killsEl: HTMLElement;
  private readonly levelEl: HTMLElement;
  private readonly buildEl: HTMLElement;
  private readonly handlers: Array<{ event: string; fn: (...args: unknown[]) => void }> = [];
  private rollRaf = 0;

  constructor(host: HTMLElement) {
    this.ensureStyles(host);

    this.root = document.createElement('div');
    this.root.className = 'bmv-results';
    this.root.innerHTML = `
      <div class="bmv-results-mask"></div>
      <div class="bmv-results-panel">
        <div class="bmv-results-title">守夜失败</div>
        <div class="bmv-results-stats">
          <div class="bmv-results-row"><span class="bmv-results-label">存活时间</span><span class="bmv-results-value" data-roll="time">0:00</span></div>
          <div class="bmv-results-row"><span class="bmv-results-label">击杀数</span><span class="bmv-results-value" data-roll="kills">0</span></div>
          <div class="bmv-results-row"><span class="bmv-results-label">等级</span><span class="bmv-results-value" data-roll="level">1</span></div>
        </div>
        <div class="bmv-results-build">
          <div class="bmv-results-build-title">Build 回顾</div>
          <div class="bmv-results-build-list"></div>
        </div>
        <div class="bmv-results-actions">
          <button class="bmv-results-restart" type="button">再来一局</button>
          <button class="bmv-results-menu" type="button">返回启动</button>
        </div>
      </div>
    `;
    host.appendChild(this.root);

    this.titleEl = this.root.querySelector('.bmv-results-title') as HTMLElement;
    this.timeEl = this.root.querySelector('[data-roll="time"]') as HTMLElement;
    this.killsEl = this.root.querySelector('[data-roll="kills"]') as HTMLElement;
    this.levelEl = this.root.querySelector('[data-roll="level"]') as HTMLElement;
    this.buildEl = this.root.querySelector('.bmv-results-build-list') as HTMLElement;

    const restartBtn = this.root.querySelector('.bmv-results-restart') as HTMLElement;
    const menuBtn = this.root.querySelector('.bmv-results-menu') as HTMLElement;
    restartBtn.addEventListener('click', () => {
      // TASK-21 P1：重开率埋点 —— session 级「再来一局」点击累计（LocalStorage）
      incrementRestartCount(window.localStorage);
      GameEvents.emit(GameEvent.RestartRequested);
    });
    menuBtn.addEventListener('click', () => GameEvents.emit(GameEvent.ToMenuRequested));

    const onGameOver = (payload: unknown): void => {
      // 修正（E4-S4 遗留）：payload 实为 { stats, sessionRestartCount }，解构 stats 再渲染
      const p = payload as GameOverPayload;
      this.show(p.stats);
    };
    GameEvents.on(GameEvent.GameOver, onGameOver);
    this.handlers.push({ event: GameEvent.GameOver, fn: onGameOver });
  }

  /** 展示结算（game:over 自动触发；也可由 PlayScene 直接调用） */
  show(stats: RunResult): void {
    this.root.style.display = 'flex';
    this.titleEl.textContent = stats.victory ? '血月退散·守夜完成' : '守夜失败';
    this.renderBuild(stats.build);
    this.rollNumbers(stats);
  }

  destroy(): void {
    cancelAnimationFrame(this.rollRaf);
    for (const h of this.handlers) GameEvents.off(h.event, h.fn);
    this.root.remove();
  }

  private renderBuild(build: string[]): void {
    this.buildEl.innerHTML = '';
    if (build.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'bmv-results-build-item empty';
      empty.textContent = '（未选择升级）';
      this.buildEl.appendChild(empty);
      return;
    }
    for (const name of build) {
      const item = document.createElement('div');
      item.className = 'bmv-results-build-item';
      item.textContent = name;
      this.buildEl.appendChild(item);
    }
  }

  /** 数字滚动 0→目标 0.8s 缓出递增（ux-spec §6；rAF 不受 Phaser tween 暂停影响，ADR-004） */
  private rollNumbers(stats: RunResult): void {
    cancelAnimationFrame(this.rollRaf);
    const targets = {
      time: stats.survivalSeconds,
      kills: stats.kills,
      level: stats.level,
    };
    const start = performance.now();
    const tick = (): void => {
      const p = Math.min(1, (performance.now() - start) / ROLL_DURATION_MS);
      const eased = 1 - Math.pow(1 - p, 3); // cubic ease-out
      this.timeEl.textContent = formatSeconds(targets.time * eased);
      this.killsEl.textContent = String(Math.round(targets.kills * eased));
      this.levelEl.textContent = String(Math.round(targets.level * eased));
      if (p < 1) this.rollRaf = requestAnimationFrame(tick);
    };
    this.rollRaf = requestAnimationFrame(tick);
  }

  /** CSS 注入一次（ADR-004；色板抄 art-bible / ux-spec §4） */
  private ensureStyles(host: HTMLElement): void {
    if (document.getElementById('bmv-results-styles')) return;
    const style = document.createElement('style');
    style.id = 'bmv-results-styles';
    style.textContent = `
      .bmv-results {
        position: absolute; inset: 0;
        display: none;
        align-items: center; justify-content: center;
        pointer-events: auto;
        z-index: 60;
        font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
        /* TASK-21 Bug2：刘海屏安全区（横屏凹口） */
        padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px)
                 env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
      }
      .bmv-results-mask {
        position: absolute; inset: 0;
        background: rgba(0,0,0,0.8);
      }
      .bmv-results-panel {
        position: relative;
        width: 640px;
        max-width: calc(100vw - 32px);
        max-width: calc(100dvw - 32px);
        max-height: 760px;
        max-height: calc(100dvh - 32px);
        overflow-y: auto; /* TASK-21 Bug2：横屏矮视口内容可滚动不裁剪 */
        box-sizing: border-box;
        padding: 32px;
        background: #131722;
        border: 2px solid #2A3346;
        border-radius: 12px;
        display: flex; flex-direction: column;
        align-items: center;
        animation: bmv-results-rise 0.25s ease-out;
      }
      .bmv-results-title {
        font-size: 32px; font-weight: 700;
        color: #F2F5F9; margin-bottom: 20px;
      }
      .bmv-results-stats {
        width: 100%;
        margin-bottom: 20px;
      }
      .bmv-results-row {
        display: flex; justify-content: space-between;
        font-size: 28px; color: #F2F5F9;
        padding: 6px 0;
      }
      .bmv-results-label { color: #A9B4C4; }
      .bmv-results-value { font-weight: 700; font-variant-numeric: tabular-nums; }
      .bmv-results-build {
        width: 100%; flex: 1; min-height: 0;
        margin-bottom: 20px;
      }
      .bmv-results-build-title {
        font-size: 20px; font-weight: 700;
        color: #54E6C9; margin-bottom: 8px;
      }
      .bmv-results-build-list {
        height: 240px; overflow-y: auto;
        background: #0B0E14; border-radius: 8px;
        padding: 8px;
        box-sizing: border-box;
      }
      .bmv-results-build-item {
        font-size: 16px; color: #F2F5F9;
        padding: 3px 4px;
      }
      .bmv-results-build-item.empty { color: #6A7280; }
      .bmv-results-actions {
        display: flex; flex-direction: column; gap: 12px;
        align-items: center;
        width: 100%;
      }
      .bmv-results-restart {
        width: 320px; height: 56px;
        font-size: 22px; font-weight: 700;
        color: #F2F5F9;
        background: #131722;
        border: 2px solid #54E6C9; border-radius: 8px;
        cursor: pointer;
      }
      .bmv-results-restart:hover { transform: scale(1.03); }
      .bmv-results-menu {
        width: 160px; height: 44px;
        font-size: 16px;
        color: #A9B4C4;
        background: transparent;
        border: 1px solid #2A3346; border-radius: 8px;
        cursor: pointer;
      }
      .bmv-results-menu:hover { color: #F2F5F9; }
      @keyframes bmv-results-rise { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      /* 移动端（ux-spec §4：面板 92vw、统计竖排、Build max-height 220、按钮全宽竖排） */
      @media (max-width: 900px) {
        .bmv-results-panel { width: 92vw; max-width: 100%; max-height: 88vh; max-height: 88dvh; padding: 20px; }
        .bmv-results-title { font-size: 26px; }
        .bmv-results-row { font-size: 22px; }
        .bmv-results-build-list { max-height: 220px; height: auto; }
        .bmv-results-restart { width: 100%; height: 64px; }
        .bmv-results-menu { width: 100%; height: 48px; }
      }
    `;
    host.appendChild(style);
  }
}

/** 秒 → "M:SS"（如 20:00）；含小数时四舍五入到秒 */
export function formatSeconds(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** 便捷工厂：挂到默认 #ui-overlay（PlayScene 使用） */
export function createResultsOverlay(): ResultsOverlay {
  return new ResultsOverlay(getOverlayHost());
}
