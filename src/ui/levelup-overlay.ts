/**
 * ui/levelup-overlay.ts —— 升级三选一 DOM 覆盖层（ADR-004 / upgrade-pool §④ / ux-spec §3 / E3-S4）
 *
 * 规则（control-manifest §3 / ux-spec §3 防误触四件套）：
 * - 三卡全屏居中：桌面 320×180 / 移动 200×112（CSS 媒体查询，热区远超 44px 下限）
 * - 桌面鼠标点卡或数字键 1/2/3 直选（CM U6）；移动点按卡片
 * - 选中反馈：冷青 2px 描边 #54E6C9 + 缩放 1.03（0.1s，CSS transition）
 * - 防误触：非卡片区点击/拖拽/长按无响应（遮罩拦截 + 点按时长/位移判定）
 * - 30s 超时自动选第 1 张（upgrade-pool §6.1 / CM U3）
 * - 单向数据流（ARCH §2 / ADR-004）：本层只读选项数据、只 emit upgrade:chosen，
 *   不持有/修改任何游戏状态；动画为 CSS，不受 Phaser tweens.pauseAll() 影响。
 */

import { GameEvents, GameEvent } from '@/core/events';
import type { UpgradeV2Option } from '@/upgrade/upgrade-pool-v2';
import { preferFrameImg } from '@/ui/frame-img';

/** B6-W3 卡类徽记（gdd-talent-tree §⑧ / upgrade-pool-v3 §3.1）：按 id 前缀映射卡类名 */
export function cardCategoryBadge(upgradeId: string | undefined): string {
  if (!upgradeId) return '';
  if (upgradeId.startsWith('mc_')) return '专武强化';
  if (upgradeId.startsWith('key_')) return '共鸣钥';
  if (upgradeId.startsWith('up_d_')) return '衍生技强化';
  if (upgradeId.startsWith('up_w_g')) return '通武强化·通用';
  if (upgradeId.startsWith('up_w_')) return '通武强化';
  if (upgradeId.startsWith('up_g_')) return '全局';
  return '';
}

/**
 * NV-INTEG-FIX P1：升级卡内容 ID → upg-* 图标帧名（frame-registry upg_icons ×40；
 * content-id-frame-map §106 映射规则 up_g_1→upg-g-1 / up_w_a1→upg-w-a1 /
 * key_scope→upg-key-scope / up_a_cd→upg-a-cd）。无帧 id（mc_* 与 up_d_*）返回 null = 文字兜底。
 */
export function upgradeFrameForId(upgradeId: string | undefined): string | null {
  if (!upgradeId) return null;
  if (upgradeId.startsWith('up_d_')) return null;
  if (upgradeId.startsWith('up_')) return `upg-${upgradeId.slice(3).replace(/_/g, '-')}`;
  if (upgradeId.startsWith('key_')) return `upg-${upgradeId.replace(/_/g, '-')}`;
  return null;
}

const DEFAULT_TIMEOUT_SECONDS = 30;
const CLICK_MAX_DURATION_MS = 500;
const CLICK_MAX_DRAG_PX = 10;

interface LevelUpOverlayOptions {
  timeoutSeconds?: number;
}

export class LevelUpOverlay {
  private readonly root: HTMLElement;
  private readonly cards: HTMLElement[] = [];
  private readonly cardHandlers: Array<{ down: (e: PointerEvent) => void; up: (e: PointerEvent) => void }> = [];
  /** B6-W3：v3 池（内容 ID）选项；legacy 12 项池路径已清偿退役（EG-2） */
  private optionsV2: UpgradeV2Option[] | null = null;
  private timeoutId: number | null = null;
  /** QA-BUG-1：选卡确认（100ms）延迟句柄——同一轮只允许排程一次，hide/show 时撤销，杜绝跨局残留 choose */
  private chooseTimerId: number | null = null;
  /** 本次展示时间戳（纠结埋点 dwell 计算，E4-S1） */
  private shownAt = 0;
  private readonly timeoutSeconds: number;

  constructor(host: HTMLElement, opts: LevelUpOverlayOptions = {}) {
    this.timeoutSeconds = opts.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS;
    this.ensureStyles(host);

    this.root = document.createElement('div');
    this.root.className = 'bmv-levelup';
    this.root.innerHTML = `<div class="bmv-levelup-mask"></div><div class="bmv-levelup-cards"></div>`;
    host.appendChild(this.root);

    const cardsRow = this.root.querySelector('.bmv-levelup-cards') as HTMLElement;
    for (let i = 0; i < 3; i += 1) {
      const card = document.createElement('div');
      card.className = 'bmv-upgrade-card';
      card.dataset.index = String(i);
      const down = (e: PointerEvent) => this.onCardPointerDown(e, i);
      const up = (e: PointerEvent) => this.onCardPointerUp(e, i);
      card.addEventListener('pointerdown', down);
      card.addEventListener('pointerup', up);
      this.cardHandlers.push({ down, up });
      cardsRow.appendChild(card);
      this.cards.push(card);
    }

    window.addEventListener('keydown', this.onKeyDown);
  }

  /** 显示三张升级卡（进 LEVEL_UP 时由 PlayScene 调用；v3 池内容 ID + 席位角标/卡类徽记） */
  showV2(options: UpgradeV2Option[]): void {
    this.optionsV2 = options;
    this.shownAt = Date.now();
    this.renderV2();
    this.showRoot();
    this.clearTimeout();
    this.timeoutId = window.setTimeout(() => this.choose(0), this.timeoutSeconds * 1000);
  }

  /**
   * QA-BUG-1 显隐配对：唯一的「置可见」出口——强制 display:flex + opacity:1，
   * 与 hide() 一一配对；显示前先撤销遗留 choose 延迟句柄（防跨轮串卡）。
   */
  private showRoot(): void {
    this.clearChooseTimer();
    this.root.style.opacity = '1';
    this.root.style.display = 'flex';
  }

  /** 隐藏（选卡完成 / 场景关闭） */
  hide(): void {
    this.clearChooseTimer(); // 撤销未确认的选中（QA-BUG-1：防残留 choose 在下一轮误触发）
    this.root.style.display = 'none';
    this.clearTimeout();
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    this.cards.forEach((card, i) => {
      const h = this.cardHandlers[i];
      if (h) {
        card.removeEventListener('pointerdown', h.down);
        card.removeEventListener('pointerup', h.up);
      }
    });
    this.root.remove();
  }

  // —— 渲染（B6-W3：v3 卡 + 席位角标 + 卡类徽记）——
  private renderV2(): void {
    this.cards.forEach((card, i) => {
      card.classList.remove('bmv-selected');
      card.innerHTML = '';
      const option = this.optionsV2?.[i];
      if (!option) return;
      const star = option.unlockVariant ? '★' : '';
      // NV-INTEG-FIX P1：图标区优先贴 upg-* 帧（加载失败保留文字兜底，preferFrameImg 语义）
      const iconInner =
        `<div class="bmv-upgrade-icon bmv-v2-icon"><span class="bmv-v2-icon-text">${escapeHtml(option.effectText)}</span>${star ? '<div class="bmv-star">' + star + '</div>' : ''}</div>`;
      // 席位角标（P1~P5 保底席位命中 = related；gdd-talent-tree §⑧）+ 卡类徽记（id 前缀映射）
      // P2-2（NV-REVIEW-FIX-F）：按席位号明示「P1 保底」…「P5 保底」，替代泛「保底」
      const seatBadge = option.related
        ? `<div class="bmv-seat-badge">${option.seat ? `${option.seat} 保底` : '保底'}</div>`
        : '';
      const category = cardCategoryBadge(option.upgradeId);
      const catBadge = category ? `<div class="bmv-cat-badge">${escapeHtml(category)}</div>` : '';
      card.innerHTML = `
        ${seatBadge}${catBadge}
        ${iconInner}
        <div class="bmv-upgrade-title">${escapeHtml(option.name)}</div>
        <div class="bmv-upgrade-desc">${escapeHtml(option.desc)}</div>
        <div class="bmv-upgrade-effect">${escapeHtml(option.effectText)}</div>
      `;
      // 卡面底色分型（asset-spec §1.6：机制蓝紫 / 数值金）
      card.classList.add(option.cardKind === 'amber-gold' ? 'bmv-numeric-card' : 'bmv-mechanic-card');
      // NV-INTEG-FIX P1：upg-* 帧贴图（40 帧图标池；帧缺失/404 时 span 文字自动保留）
      const frame = upgradeFrameForId(option.upgradeId);
      if (frame) {
        const iconHost = card.querySelector('.bmv-v2-icon');
        if (iconHost) preferFrameImg(iconHost as HTMLElement, frame);
      }
    });
  }

  private onCardPointerDown(e: PointerEvent, index: number): void {
    // 只接受鼠标左键/触摸主触点；记录按下时间与位置（长按/拖拽判定，CM U5）
    if (e.button !== undefined && e.button !== 0) return;
    const card = this.cards[index];
    if (card) {
      card.dataset.pressT = String(Date.now());
      card.dataset.pressX = String(e.clientX);
      card.dataset.pressY = String(e.clientY);
    }
  }

  private onCardPointerUp(e: PointerEvent, index: number): void {
    const card = this.cards[index];
    if (!card) return;
    const pressT = Number(card.dataset.pressT ?? 0);
    const pressX = Number(card.dataset.pressX ?? e.clientX);
    const pressY = Number(card.dataset.pressY ?? e.clientY);
    const duration = Date.now() - pressT;
    const drag = Math.hypot(e.clientX - pressX, e.clientY - pressY);
    if (duration > CLICK_MAX_DURATION_MS || drag > CLICK_MAX_DRAG_PX) return; // 长按/拖拽不响应
    this.select(index);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.root.style.display === 'none') return;
    if (e.key === '1') this.select(0);
    else if (e.key === '2') this.select(1);
    else if (e.key === '3') this.select(2);
  };

  /** 选中反馈（冷青描边 + 缩放 1.03，0.1s）后 emit upgrade:chosen */
  private select(index: number): void {
    if (this.root.style.display === 'none') return; // 未展示不响应（QA-BUG-1 键盘/连点保底）
    if (this.chooseTimerId !== null) return; // 已有待确认选中：忽略本次（连点 / 键盘重复不再叠加 choose）
    const card = this.cards[index];
    if (!card) return;
    card.classList.add('bmv-selected');
    this.clearTimeout();
    this.chooseTimerId = window.setTimeout(() => {
      this.chooseTimerId = null;
      this.choose(index);
    }, 100);
  }

  private choose(index: number): void {
    if (this.root.style.display === 'none') return;
    const optionV2 = this.optionsV2?.[index];
    const dwellSeconds = this.shownAt > 0 ? (Date.now() - this.shownAt) / 1000 : 0;
    this.hide();
    const optionId: number | string = optionV2 ? (optionV2.upgradeId ?? optionV2.evoId ?? 'up_g_1') : 'up_g_1';
    // 单向数据流：只发事件，不写游戏状态（ADR-004）；dwellSeconds 供纠结时刻埋点（E4-S1）
    GameEvents.emit(GameEvent.UpgradeChosen, { optionId, index, dwellSeconds });
  }

  private clearTimeout(): void {
    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  private clearChooseTimer(): void {
    if (this.chooseTimerId !== null) {
      window.clearTimeout(this.chooseTimerId);
      this.chooseTimerId = null;
    }
  }

  /** CSS 注入一次（ADR-004：布局/动画走 CSS；色板抄 art-bible，不自动同步） */
  private ensureStyles(host: HTMLElement): void {
    if (document.getElementById('bmv-levelup-styles')) return;
    const style = document.createElement('style');
    style.id = 'bmv-levelup-styles';
    style.textContent = `
      .bmv-levelup {
        position: absolute; inset: 0;
        display: none;
        align-items: center; justify-content: center;
        pointer-events: auto;
        z-index: 50;
        /* TASK-21 Bug2：刘海屏安全区，横屏时卡片不被凹口遮挡（viewport-fit=cover） */
        padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px)
                 env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
      }
      .bmv-levelup-mask {
        position: absolute; inset: 0;
        background: rgba(0,0,0,0.8);
        animation: bmv-fade-in 0.2s ease-out;
      }
      .bmv-levelup-cards {
        position: relative;
        display: flex;
        gap: 24px;
        align-items: stretch;
        justify-content: center;
        /* TASK-21 Bug2：整行 ≤ 视口宽 − 2×边距（桌面 40），防窄视口溢出；dvw 兜底兼容 */
        max-width: calc(100vw - 80px);
        max-width: calc(100dvw - 80px);
        width: 100%;
        animation: bmv-rise 0.2s ease-out;
      }
      .bmv-upgrade-card {
        /* 基准 320px；窄视口收缩到 (视口 − 2×40 − 2×24)/3（与 ui/overlay-layout.ts 公式镜像） */
        width: 320px;
        max-width: calc((100vw - 80px - 48px) / 3);
        max-width: calc((100dvw - 80px - 48px) / 3);
        flex: 0 1 auto;
        min-width: 0;
        height: 180px;
        box-sizing: border-box;
        background: #131722;
        border: 2px solid #2A3346;
        border-radius: 8px;
        padding: 12px;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        cursor: pointer;
        transition: transform 0.1s ease-out, border-color 0.1s ease-out;
        user-select: none;
        -webkit-user-select: none;
      }
      .bmv-upgrade-card.bmv-selected {
        transform: scale(1.03);
        border-color: #54E6C9;
        box-shadow: 0 0 0 2px #54E6C9;
      }
      .bmv-upgrade-icon {
        width: 128px; height: 128px;
        margin-bottom: 8px;
      }
      /* TASK-33：内联矢量图标（icons.ts），SVG 自带底色分型（机制蓝紫/数值金），铺满容器缩放 */
      .bmv-upgrade-icon svg {
        display: block;
        width: 100%; height: 100%;
      }
      /* E4-S4 v2 卡：底色分型（asset-spec §1.6 机制蓝紫 / 数值金 / 进化幽紫）；图标区用色块 + 文字占位 */
      .bmv-mechanic-card { background: #131722; border-color: #4FC3F7; }
      .bmv-numeric-card { background: #2A2A1C; border-color: #FFC93C; }
      .bmv-evo-card { background: #241A33; border-color: #B06AF0; }
      .bmv-v2-icon {
        display: flex; align-items: center; justify-content: center;
        font-size: 20px; font-weight: 700; color: #F2F5F9;
        background: #0B0E14; border: 2px solid #2A3346; border-radius: 10px;
        position: relative;
      }
      /* NV-INTEG-FIX P1：upg-* 帧贴图（铺满图标区；404 时 span 文字兜底可见） */
      .bmv-v2-icon img.bmv-frame-img {
        display: block; width: 100%; height: 100%;
        object-fit: contain; image-rendering: pixelated;
        border-radius: 8px;
      }
      .bmv-evo-icon {
        display: flex; align-items: center; justify-content: center;
        font-size: 26px; font-weight: 700; color: #B06AF0;
        background: #0B0E14; border: 3px solid #54E6C9; border-radius: 10px;
        text-shadow: 0 0 8px rgba(176,106,240,0.8);
      }
      /* B6-W3：席位角标（余辉金）+ 卡类徽记（冷青）——gdd-talent-tree §⑧ */
      .bmv-seat-badge {
        position: absolute; top: -10px; left: -10px;
        font-size: 14px; font-weight: 700; color: #131722;
        background: #FFC93C; border-radius: 6px;
        padding: 2px 8px;
        box-shadow: 0 0 6px rgba(255,201,60,0.8);
      }
      .bmv-cat-badge {
        position: absolute; top: -10px; right: -10px;
        font-size: 13px; font-weight: 600; color: #54E6C9;
        background: #0B0E14; border: 1px solid #54E6C9; border-radius: 6px;
        padding: 1px 6px;
      }
      .bmv-upgrade-card { position: relative; }
      .bmv-star {
        position: absolute; top: -8px; right: -8px;
        font-size: 22px; color: #FFC93C;
        text-shadow: 0 0 6px rgba(255,201,60,0.9);
      }
      .bmv-upgrade-title {
        font-size: 22px; font-weight: 700;
        color: #F2F5F9;
        text-align: center;
      }
      .bmv-upgrade-desc {
        font-size: 16px;
        color: #A9B4C4;
        text-align: center;
        margin-top: 4px;
      }
      .bmv-upgrade-effect {
        font-size: 16px; font-weight: 600;
        color: #54E6C9;
        margin-top: 6px;
      }
      @keyframes bmv-fade-in { from { opacity: 0; } to { opacity: 1; } }
      @keyframes bmv-rise { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      /* 移动端（ux-spec §3：200×112、间距 16、图标 72、字号物理 ≥14px；TASK-21 Bug2 视口收缩） */
      @media (max-width: 900px) {
        .bmv-levelup-cards { gap: 16px; max-width: calc(100vw - 24px); max-width: calc(100dvw - 24px); }
        .bmv-upgrade-card {
          width: 200px;
          max-width: calc((100vw - 24px - 32px) / 3);
          max-width: calc((100dvw - 24px - 32px) / 3);
          height: 112px; padding: 8px;
        }
        .bmv-upgrade-icon { width: 72px; height: 72px; margin-bottom: 4px; }
        .bmv-upgrade-title { font-size: 16px; }
        .bmv-upgrade-desc { font-size: 12px; }
        .bmv-upgrade-effect { font-size: 13px; margin-top: 4px; }
      }
    `;
    host.appendChild(style);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
