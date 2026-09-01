/**
 * ui/prologue-overlay.ts —— 序章屏 DOM 覆盖层（ADR-004 / narratives-spec §3）
 *
 * 规格来源：`design/official-v1/narratives-spec.md` §3（M3-DESIGN-2 终稿）
 * - 展示位置：点击「开始」后进入战斗前（序章期间不开始计时/生成器，PlayScene 以 PROLOGUE 态衔接）。
 * - 屏序列：通用序章（n_prologue_common，3 句）+ 地图序章（n_prologue_<mapId>，按 payload.mapId 选句）；
 *   每屏 ≤3 句（spec §3 P1-5 红线，逐行渲染，行源 = narratives.ts splitPrologueLines）。
 * - 时长：固定 3s 自动进入下一屏（spec §1.2 序章固定 3s；「2~3s 自动进入」）；点击任意处可跳过（立即进入下一屏）。
 * - 形式：全屏居中遮罩（复用 levelup 暂停式遮罩模式；z-index 45 叙事层——盖 HUD 之上、升级 50 之下，
 *   在 PROLOGUE 态独占屏幕，不与其他覆盖层同屏）。
 * - 数据驱动：文案只读 narratives.ts 表（PrologueOverlay 只渲染 screens 参数，不自行查表/硬编码）。
 * - 双端（spec §1.3/§11）：移动单行 ≤14 字（折行兜底）；移动字号 ≥16px 物理 ——
 *   overlay-scale 注入 `--bmv-overlay-scale` 后由 CSS `max(16px, calc(16px / var(--bmv-overlay-scale)))` 保证。
 *
 * 纯逻辑（indexForAdvance）可脱离 DOM 单测（test-framework §1.2）；组件本体需 DOM 环境。
 */

import type { NarrativeText } from '@/narratives/narratives';
import { splitPrologueLines } from '@/narratives/narratives';
import { getOverlayHost } from '@/ui/overlay-host';

/** 序章固定 3s（spec §1.2：序章/开局固定 3s，可点击跳过） */
export const PROLOGUE_DEFAULT_DURATION_MS = 3000;

/** 相位安全定时器句柄（Phaser.Time.TimerEvent 形状子集） */
export interface PrologueTimerHandle {
  remove(): void;
}

/**
 * 序章时钟端口（BUG-4 / P1-16 / NV-REVIEW-FIX-F）：
 * 自动推进 timer 从 window.setTimeout 改为 Phaser Scene clock（随场景生命周期销毁、
 * 场景暂停即冻结）——setTimeout 脱离相位系统，场景重启后仍会触发 advance。
 */
export interface PrologueClock {
  delay: (ms: number, cb: () => void) => PrologueTimerHandle;
}

export interface PrologueOverlayOptions {
  /** 每屏自动进入时长 ms（缺省 3000 = spec §3 固定 3s） */
  durationMs?: number;
  /** 相位安全时钟（PlayScene 传 Phaser scene.time；BUG-4 后必传） */
  clock?: PrologueClock;
  /** 移动端判定（缺省 false；仅供 CSS 类标记，字号红线由 overlay-scale 保证） */
  isMobile?: () => boolean;
}

/**
 * 纯逻辑：从当前屏推进的下一屏索引。
 * - 非末屏 → index+1（自动进入下一屏 / 点击跳过）；
 * - 末屏 → 返回 -1（调用方判定完成并回调 onComplete）。
 */
export function indexForAdvance(current: number, total: number): number {
  if (total <= 0) return -1;
  if (current + 1 >= total) return -1;
  return current + 1;
}

export class PrologueOverlay {
  private readonly root: HTMLElement;
  private readonly linesEl: HTMLElement;
  private readonly durationMs: number;
  private readonly clock?: PrologueClock;
  private screens: readonly NarrativeText[] = [];
  private index = 0;
  private timer: PrologueTimerHandle | null = null;
  private onComplete: (() => void) | null = null;
  private readonly clickHandler: () => void;
  private readonly keyHandler: (e: KeyboardEvent) => void;

  constructor(host: HTMLElement, opts: PrologueOverlayOptions = {}) {
    this.durationMs = opts.durationMs ?? PROLOGUE_DEFAULT_DURATION_MS;
    this.clock = opts.clock;
    // 注：opts.isMobile 为 API 预留（双端字号红线由 CSS 媒体查询 + overlay-scale 注入处理，
    // 组件内不再重复判定；见 ensureStyles 移动端分型）。
    this.ensureStyles(host);

    this.root = document.createElement('div');
    this.root.className = 'bmv-prologue';
    this.root.setAttribute('aria-label', '序章');
    this.root.innerHTML = `
      <div class="bmv-prologue-mask"></div>
      <div class="bmv-prologue-panel">
        <div class="bmv-prologue-lines"></div>
        <div class="bmv-prologue-hint">点击继续</div>
      </div>
    `;
    host.appendChild(this.root);

    this.linesEl = this.root.querySelector('.bmv-prologue-lines') as HTMLElement;
    // 点击任意处跳过（立即进入下一屏 / 末屏完成）
    this.clickHandler = () => this.advance();
    this.root.addEventListener('click', this.clickHandler);
    // 键盘 Space/Enter 同样可跳过（桌面便捷；与点击同语义）
    // BUG-4（P1-16）：Esc 也由序章消费（PROLOGUE 相位内 Esc = 推进/跳过当前屏），
    // 防止 Esc 落到场景暂停切换（checkPause 相位无关 → togglePause 在 PROLOGUE 是 no-op，
    // 键会被吞但无反馈；此处显式消费给出推进反馈，与点击同语义）。
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        this.advance();
      }
    };
    if (typeof window !== 'undefined') window.addEventListener('keydown', this.keyHandler);
  }

  /**
   * 展示序章屏序列（PlayScene 调用；屏 = NarrativeText，逐屏自动进入 / 点击跳过）。
   * 空序列直接 onComplete（调用方立即进 RUNNING）；完成后自动隐藏。
   */
  show(screens: readonly NarrativeText[], onComplete: () => void): void {
    this.screens = screens;
    this.onComplete = onComplete;
    this.index = 0;
    if (this.screens.length === 0) {
      this.finish();
      return;
    }
    this.root.style.display = 'flex';
    this.renderScreen(0);
    this.armTimer();
  }

  /** 立即隐藏（场景关闭 / 直接进入战斗），不触发 onComplete */
  hide(): void {
    this.clearTimer();
    this.root.style.display = 'none';
  }

  destroy(): void {
    this.clearTimer();
    this.onComplete = null;
    this.root.removeEventListener('click', this.clickHandler);
    if (typeof window !== 'undefined') window.removeEventListener('keydown', this.keyHandler);
    this.root.remove();
  }

  /** 下一屏推进（自动计时 / 点击跳过共用；末屏 → 完成回调） */
  private advance(): void {
    if (this.root.style.display !== 'flex') return;
    const next = indexForAdvance(this.index, this.screens.length);
    if (next < 0) {
      this.finish();
      return;
    }
    this.index = next;
    this.renderScreen(next);
    this.armTimer();
  }

  private renderScreen(i: number): void {
    const screen = this.screens[i];
    if (!screen) return;
    this.linesEl.innerHTML = '';
    const lines = splitPrologueLines(screen.text);
    for (const line of lines) {
      const div = document.createElement('div');
      div.className = 'bmv-prologue-line';
      div.textContent = line;
      this.linesEl.appendChild(div);
    }
  }

  private armTimer(): void {
    this.clearTimer();
    if (this.clock) {
      this.timer = this.clock.delay(this.durationMs, () => this.advance());
    } else if (typeof window !== 'undefined') {
      // 兜底（无 Phaser 时钟的独立使用；运行时 PlayScene 始终传入）
      const id = window.setTimeout(() => this.advance(), this.durationMs);
      this.timer = { remove: () => window.clearTimeout(id) };
    }
  }

  private finish(): void {
    this.hide();
    const cb = this.onComplete;
    this.onComplete = null;
    cb?.();
  }

  private clearTimer(): void {
    this.timer?.remove();
    this.timer = null;
  }

  /** CSS 注入一次（ADR-004；全屏居中遮罩复用 levelup 暂停式遮罩；色板 token 来源 art-bible §2.4） */
  private ensureStyles(host: HTMLElement): void {
    if (document.getElementById('bmv-prologue-styles')) return;
    const style = document.createElement('style');
    style.id = 'bmv-prologue-styles';
    style.textContent = `
      .bmv-prologue {
        position: absolute; inset: 0;
        display: none;
        align-items: center; justify-content: center;
        pointer-events: auto;
        z-index: 45; /* 叙事层（spec §1.5）：HUD 40 之上、升级 50 之下；PROLOGUE 态独占屏幕 */
        font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
        /* TASK-21 Bug2：刘海屏安全区（横屏凹口） */
        padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px)
                 env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
      }
      .bmv-prologue-mask {
        position: absolute; inset: 0;
        background: rgba(11,14,20,0.92); /* 墨夜蓝黑全屏遮罩（levelup 暂停式） */
        animation: bmv-prologue-fade 0.25s ease-out;
      }
      .bmv-prologue-panel {
        position: relative;
        display: flex; flex-direction: column; align-items: center;
        gap: 28px;
        max-width: calc(100vw - 64px);
        max-width: calc(100dvw - 64px);
        box-sizing: border-box;
        padding: 48px 56px;
        background: #131722;
        border: 2px solid #2A3346; border-radius: 12px;
        box-shadow: 0 0 0 1px rgba(84,230,201,0.18), 0 12px 40px rgba(0,0,0,0.6);
        cursor: pointer;
        animation: bmv-prologue-rise 0.25s ease-out;
        user-select: none; -webkit-user-select: none;
      }
      .bmv-prologue-lines {
        display: flex; flex-direction: column; align-items: center; gap: 16px;
      }
      .bmv-prologue-line {
        font-size: clamp(20px, 2.6vw, 28px);
        font-weight: 600;
        color: #F2F5F9; /* 纸白（art-bible token） */
        letter-spacing: 2px;
        line-height: 1.6;
        text-align: center;
        text-shadow: 0 2px 10px rgba(0,0,0,0.85);
        white-space: nowrap; /* 桌面单行；移动端折行由媒体查询覆盖 */
      }
      .bmv-prologue-hint {
        font-size: 14px;
        color: #6A7280;
        letter-spacing: 2px;
      }
      @keyframes bmv-prologue-fade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes bmv-prologue-rise { from { transform: translateY(14px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      /* 移动端（spec §1.3/§11）：单行 ≤14 字折行、字号 ≥16px 物理（设计字号 × scale ≥ 16）、热区 ≥44 */
      @media (max-width: 900px) {
        .bmv-prologue-panel { padding: 32px 24px; gap: 20px; max-width: calc(100vw - 32px); max-width: calc(100dvw - 32px); }
        .bmv-prologue-line {
          font-size: max(16px, calc(16px / var(--bmv-overlay-scale, 1)));
          white-space: normal; /* 折行兜底（设计侧 ≤14 字/行） */
          min-height: 44px;
          display: flex; align-items: center;
        }
        .bmv-prologue-hint { min-height: 44px; display: flex; align-items: center; }
      }
    `;
    host.appendChild(style);
  }
}

/** 便捷工厂：挂到默认 #ui-overlay（PlayScene 使用） */
export function createPrologueOverlay(opts?: PrologueOverlayOptions): PrologueOverlay {
  return new PrologueOverlay(getOverlayHost(), opts);
}
