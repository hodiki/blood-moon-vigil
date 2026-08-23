/**
 * narratives/narrative-overlays.ts —— 轻叙事 DOM 覆盖层组件（ADR-004 / narrative-framework §1/§5 / narratives-spec §1.4）
 *
 * 五形态（spec §1.4），全部为 DOM 覆盖层（0 draw call）：
 * - top-banner    顶部横幅渐隐：序章/开局 —— 顶部居中，淡入→停留→淡出
 * - bottom-banner 底部横幅渐隐：Boss 登场 —— 底部居中（spec §1.4 横幅 top/bottom 位置变体）
 * - side-toast    侧边浮字：升级/新武器/精英/图鉴 —— 右侧边，轻量提示
 * - center-gold   中央大字 + 金描边：超武合成（进化播报）—— 屏幕中央，金边 #FFC93C
 * - result-title  结算标题：Boss 击杀/死亡 —— 居中大字（结算页既有标题复用；本组件供框架完整）
 *
 * 轻叙事纪律（spec §1.3 不打断节奏）：全部 pointer-events:none 放行给 canvas；文本节点可点
 * 跳过（可跳过/自动消失）。双端适配（spec §1.3/§11）：
 * - 移动单行 nowrap、超长省略号（设计侧保证 ≤14 字，此处兜底）；
 * - 移动字号 ≥16px 物理：overlay-scale 注入 `--bmv-overlay-scale`（设计字号 = 16/scale 向上取整，
 *   CSS `max(16px, calc(16px / var(--bmv-overlay-scale)))` 保证设计字号 × scale ≥ 16）。
 *
 * 本层只做渲染，不做路由/内容查询（路由在 narrative-dispatcher.ts / 内容在 narratives.ts）。
 */

import type { NarrativeForm } from '@/narratives/narratives';

/** 分发器依赖的组件接口（真实组件与测试 fake 共用；只暴露渲染面，不暴露 DOM 细节） */
export interface NarrativeComponent {
  readonly form: NarrativeForm;
  show(text: string, durationMs: number): void;
  /** 立即隐藏（跳过 / 自动消失 / 场景切换） */
  hide(): void;
}

const FADE_IN_MS = 250;
const FADE_OUT_MS = 300;

/** 单一形式的组件实现（5 形式共用一套结构，CSS 分型） */
class NarrativeElement implements NarrativeComponent {
  readonly form: NarrativeForm;
  private readonly el: HTMLElement;
  private timer = 0;
  private fadingOut = false;
  private readonly textEl: HTMLElement;

  constructor(host: HTMLElement, form: NarrativeForm, formCss: string) {
    this.form = form;
    this.el = document.createElement('div');
    this.el.className = `bmv-narrative bmv-narrative-${form}`;
    this.el.style.display = 'none';
    this.el.innerHTML = `<div class="bmv-narrative-text"></div>`;
    this.textEl = this.el.firstElementChild as HTMLElement;
    this.textEl.textContent = '';
    // 点击文本 → 跳过（spec §1.3 可跳过；仅文本节点可点，其余区域 pointer-events:none 放行 canvas）
    this.el.addEventListener('click', () => this.hide());
    host.appendChild(this.el);
    this.ensureStyles(host, formCss);
  }

  show(text: string, durationMs: number): void {
    this.clearTimer();
    this.textEl.textContent = text;
    this.el.style.display = 'block';
    this.el.classList.remove('bmv-narrative-out');
    // 强制重排后淡入（连续 show 时保证动画重启）
    void this.el.offsetWidth;
    this.el.classList.add('bmv-narrative-in');
    this.timer = window.setTimeout(() => this.fadeOut(), Math.max(FADE_IN_MS + 80, durationMs));
  }

  hide(): void {
    this.clearTimer();
    this.fadeOut();
  }

  private fadeOut(): void {
    if (this.fadingOut || this.el.style.display === 'none') return;
    this.fadingOut = true;
    this.el.classList.remove('bmv-narrative-in');
    this.el.classList.add('bmv-narrative-out');
    // 淡出结束后隐藏（避免残留透明层）
    this.timer = window.setTimeout(() => {
      this.el.style.display = 'none';
      this.fadingOut = false;
      this.el.classList.remove('bmv-narrative-out');
      this.textEl.textContent = '';
    }, FADE_OUT_MS + 40);
  }

  private clearTimer(): void {
    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = 0;
    }
  }

  destroy(): void {
    this.clearTimer();
    this.el.remove();
  }

  /** CSS 注入一次（ADR-004；色板 token 来源 art-bible §2.4，禁止新色相；z-index 见 spec §1.5） */
  private ensureStyles(host: HTMLElement, formCss: string): void {
    const styleId = `bmv-narrative-${this.form}-styles`;
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .bmv-narrative {
        position: absolute;
        z-index: 45; /* spec §1.5：叙事层（横幅/浮字）45 = HUD 40 之上、升级 50 之下 */
        pointer-events: none; /* 覆盖层不挡 canvas（spec §1.3 不打断节奏） */
        font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
        opacity: 0;
      }
      .bmv-narrative-text {
        pointer-events: auto; /* 仅文本可点（跳过） */
        cursor: pointer;
        color: #F2F5F9; /* 纸白（art-bible token） */
        font-weight: 600;
        white-space: nowrap;
        max-width: calc(100vw - 48px);
        overflow: hidden;
        text-overflow: ellipsis;
        text-shadow: 0 2px 8px rgba(0,0,0,0.85);
      }
      .bmv-narrative-in { animation: bmv-narrative-fade-in ${FADE_IN_MS}ms ease-out forwards; }
      .bmv-narrative-out { animation: bmv-narrative-fade-out ${FADE_OUT_MS}ms ease-in forwards; }
      @keyframes bmv-narrative-fade-in { from { opacity: 0; } to { opacity: 1; } }
      @keyframes bmv-narrative-fade-out { from { opacity: 1; } to { opacity: 0; } }

      /* —— 顶部横幅渐隐（序章/开局） —— */
      .bmv-narrative-top-banner {
        top: max(env(safe-area-inset-top, 0px), 14px);
        left: 50%;
        transform: translateX(-50%);
      }
      .bmv-narrative-top-banner .bmv-narrative-text {
        font-size: clamp(18px, 2.4vw, 26px);
        letter-spacing: 2px;
        padding: 10px 24px;
        background: rgba(11,14,20,0.62); /* 墨夜蓝黑半透明底（可读性） */
        border: 1px solid rgba(42,51,70,0.8);
        border-radius: 8px;
      }

      /* —— 底部横幅渐隐（Boss 登场；spec §1.4 横幅 bottom 变体） —— */
      .bmv-narrative-bottom-banner {
        bottom: max(env(safe-area-inset-bottom, 0px), 24px);
        left: 50%;
        transform: translateX(-50%);
      }
      .bmv-narrative-bottom-banner .bmv-narrative-text {
        font-size: clamp(18px, 2.4vw, 26px);
        letter-spacing: 2px;
        padding: 10px 24px;
        background: rgba(11,14,20,0.62);
        border: 1px solid rgba(255,59,59,0.55); /* 猩红描边（Boss 登场语义，art-bible §4） */
        border-radius: 8px;
      }

      /* —— 侧边浮字（升级/新武器/精英/图鉴） —— */
      .bmv-narrative-side-toast {
        right: max(env(safe-area-inset-right, 0px), 12px);
        top: 22%;
      }
      .bmv-narrative-side-toast .bmv-narrative-text {
        font-size: clamp(16px, 1.8vw, 20px);
        padding: 8px 14px;
        background: rgba(11,14,20,0.55);
        border-left: 3px solid #54E6C9; /* 冷青（玩家侧信息 accent） */
        border-radius: 4px;
      }

      /* —— 中央大字 + 金描边（超武合成/进化播报；金=稀有奖励语义，art-bible §2） —— */
      .bmv-narrative-center-gold {
        top: 42%;
        left: 50%;
        transform: translateX(-50%);
        z-index: 50; /* spec §1.5：进化播报 = 50（升级卡关闭后 0.2s 播放） */
      }
      .bmv-narrative-center-gold .bmv-narrative-text {
        font-size: clamp(24px, 4.4vw, 46px);
        letter-spacing: 4px;
        -webkit-text-stroke: 1px #FFC93C; /* 金描边 */
        text-shadow:
          0 0 14px rgba(255,201,60,0.55),
          0 0 40px rgba(255,201,60,0.35),
          0 2px 10px rgba(0,0,0,0.9);
        padding: 12px 32px;
      }

      /* —— 结算标题（Boss 击杀/死亡；结果页既有标题复用，本形式供框架完整） —— */
      .bmv-narrative-result-title {
        top: 36%;
        left: 50%;
        transform: translateX(-50%);
        z-index: 60; /* 结算页内（results 60） */
      }
      .bmv-narrative-result-title .bmv-narrative-text {
        font-size: clamp(28px, 5vw, 52px);
        font-weight: 800;
        letter-spacing: 6px;
        color: #E8F0FA; /* 月银白（终局语义） */
        text-shadow: 0 2px 12px rgba(0,0,0,0.9);
      }

      /* 移动端：字号 ≥16px 物理（spec §1.3/§11）——overlay-scale 注入 --bmv-overlay-scale，
         设计字号 = 16/scale 向上取整（designFontSizeForPhysical），保证设计字号 × scale ≥ 16；
         触控热区 ≥44（spec §11 移动热区） */
      @media (max-width: 900px) {
        .bmv-narrative-text {
          min-height: 44px;
          display: flex;
          align-items: center;
          font-size: max(16px, calc(16px / var(--bmv-overlay-scale, 1))) !important;
        }
      }
    `;
    host.appendChild(style);
    void formCss;
  }
}

/** 全套 5 形式组件（分发器持有；destroy 统一清理） */
export class NarrativeOverlaySet {
  private readonly components = new Map<NarrativeForm, NarrativeComponent>();
  private readonly elements: NarrativeElement[] = [];

  constructor(host: HTMLElement) {
    const topBanner = new NarrativeElement(host, 'top-banner', '');
    const bottomBanner = new NarrativeElement(host, 'bottom-banner', '');
    const toast = new NarrativeElement(host, 'side-toast', '');
    const center = new NarrativeElement(host, 'center-gold', '');
    const title = new NarrativeElement(host, 'result-title', '');
    this.elements.push(topBanner, bottomBanner, toast, center, title);
    this.components.set('top-banner', topBanner);
    this.components.set('bottom-banner', bottomBanner);
    this.components.set('side-toast', toast);
    this.components.set('center-gold', center);
    this.components.set('result-title', title);
  }

  get(form: NarrativeForm): NarrativeComponent | undefined {
    return this.components.get(form);
  }

  destroy(): void {
    for (const el of this.elements) el.destroy();
    this.components.clear();
    this.elements.length = 0;
  }
}
