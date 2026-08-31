/**
 * ui/exclusive-select-overlay.ts —— 专武 2 选 1 DOM 覆盖层（NV-INTEG-FIX P0-2）
 *
 * gdd-exclusive-weapons §1.1：角色选定后、进图前 2 选 1，本局不可反悔；
 * 落选专武转化为衍生技（EXCLUSIVE_TO_DERIVATIVE，键 = 选中者）。
 *
 * 规则（对齐 levelup-overlay 防误触四件套 / ADR-004）：
 * - 双卡全屏居中：桌面 260×360 / 移动 150×220（媒体查询，热区远超 44px）
 * - 桌面鼠标点卡或数字键 1/2 直选；移动点按卡片
 * - 卡面 = exw-card-* 立绘帧（preferFrameImg，加载失败保留文字名兜底）
 * - 防误触：非卡片区点击无响应；未展示时不响应键盘
 * - 单向数据流：本层只读 HERO_EXCLUSIVE_PAIRS/EXCLUSIVE_WEAPONS 配置、只回调 onChoose，
 *   不持有/修改任何游戏状态。
 */

import { EXCLUSIVE_WEAPONS, HERO_EXCLUSIVE_PAIRS, type ExclusiveWeaponId, type HeroId } from '@/config/balance';
import { preferFrameImg } from '@/ui/frame-img';

/** 专武 id → 卡面立绘帧名（frame-registry xw_cards；twinblades/longbow 帧名单数截断） */
const EXW_CARD_FRAMES: Record<ExclusiveWeaponId, string> = {
  xw_lantern: 'exw-card-lantern',
  xw_revolver: 'exw-card-revolver',
  xw_twinblades: 'exw-card-twinblade',
  xw_longbow: 'exw-card-longbow',
  xw_bell: 'exw-card-bell',
  xw_cross: 'exw-card-cross',
  xw_axe: 'exw-card-axe',
  xw_horn: 'exw-card-horn',
};

const CLICK_MAX_DURATION_MS = 500;
const CLICK_MAX_DRAG_PX = 10;

export interface ExclusiveSelectOverlayOptions {
  onChoose: (chosen: ExclusiveWeaponId) => void;
}

export class ExclusiveSelectOverlay {
  private readonly root: HTMLElement;
  private readonly cards: HTMLElement[] = [];
  private readonly cardHandlers: Array<{ down: (e: PointerEvent) => void; up: (e: PointerEvent) => void }> = [];
  private pair: readonly ExclusiveWeaponId[] = [];
  private readonly onChoose: (chosen: ExclusiveWeaponId) => void;

  constructor(host: HTMLElement, opts: ExclusiveSelectOverlayOptions) {
    this.onChoose = opts.onChoose;
    this.ensureStyles(host);

    this.root = document.createElement('div');
    this.root.className = 'bmv-exclusive-select';
    this.root.innerHTML = `
      <div class="bmv-exclusive-mask"></div>
      <div class="bmv-exclusive-body">
        <div class="bmv-exclusive-title">专武抉择 · 2 选 1</div>
        <div class="bmv-exclusive-sub">落选者将转化为你的主动技，本局不可反悔</div>
        <div class="bmv-exclusive-cards"></div>
      </div>
    `;
    host.appendChild(this.root);
    this.root.style.display = 'none';

    const cardsRow = this.root.querySelector('.bmv-exclusive-cards') as HTMLElement;
    for (let i = 0; i < 2; i += 1) {
      const card = document.createElement('div');
      card.className = 'bmv-exclusive-card';
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

  /** 显示当前角色的专武双卡（PROLOGUE 完成后由 PlayScene 调用；非法角色不展示） */
  show(heroId: HeroId): void {
    const pair = HERO_EXCLUSIVE_PAIRS[heroId as keyof typeof HERO_EXCLUSIVE_PAIRS];
    if (!pair) return;
    this.pair = pair;
    this.render();
    this.root.style.display = 'flex';
  }

  hide(): void {
    this.root.style.display = 'none';
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

  private render(): void {
    this.cards.forEach((card, i) => {
      card.classList.remove('bmv-selected');
      card.innerHTML = '';
      const id = this.pair[i];
      if (!id) return;
      const cfg = EXCLUSIVE_WEAPONS[id];
      card.innerHTML = `
        <div class="bmv-exclusive-art">${cfg.name}</div>
        <div class="bmv-exclusive-name">${cfg.name}</div>
        <div class="bmv-exclusive-tag">${cfg.powerTag} · ${cfg.feel}</div>
        <div class="bmv-exclusive-desc">${cfg.effect}</div>
        <div class="bmv-exclusive-key">${i === 0 ? '按 1 或点击' : '按 2 或点击'}</div>
      `;
      preferFrameImg(card.querySelector('.bmv-exclusive-art') as HTMLElement, EXW_CARD_FRAMES[id]);
    });
  }

  private onCardPointerDown(e: PointerEvent, index: number): void {
    if (e.button !== undefined && e.button !== 0) return;
    const card = this.cards[index];
    if (card) {
      card.dataset.pressT = String(Date.now());
      card.dataset.pressX = String(e.clientX);
      card.dataset.pressY = String(e.clientY);
    }
  }

  private onCardPointerUp(e: PointerEvent, index: number): void {
    if (this.root.style.display === 'none') return;
    const card = this.cards[index];
    if (!card) return;
    const pressT = Number(card.dataset.pressT ?? 0);
    const pressX = Number(card.dataset.pressX ?? e.clientX);
    const pressY = Number(card.dataset.pressY ?? e.clientY);
    const duration = Date.now() - pressT;
    const drag = Math.hypot(e.clientX - pressX, e.clientY - pressY);
    if (duration > CLICK_MAX_DURATION_MS || drag > CLICK_MAX_DRAG_PX) return; // 长按/拖拽不响应
    this.choose(index);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.root.style.display === 'none') return;
    if (e.key === '1') this.choose(0);
    else if (e.key === '2') this.choose(1);
  };

  private choose(index: number): void {
    const id = this.pair[index];
    if (!id) return;
    this.hide();
    this.onChoose(id);
  }

  /** CSS 注入一次（ADR-004；色板抄 art-bible，不自动同步） */
  private ensureStyles(host: HTMLElement): void {
    if (document.getElementById('bmv-exclusive-select-styles')) return;
    const style = document.createElement('style');
    style.id = 'bmv-exclusive-select-styles';
    style.textContent = `
      .bmv-exclusive-select {
        position: absolute; inset: 0;
        display: flex;
        align-items: center; justify-content: center;
        pointer-events: auto;
        z-index: 60;
        padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px)
                 env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
      }
      .bmv-exclusive-mask { position: absolute; inset: 0; background: rgba(0,0,0,0.85); }
      .bmv-exclusive-body {
        position: relative;
        display: flex; flex-direction: column; align-items: center;
        animation: bmv-exclusive-rise 0.2s ease-out;
      }
      .bmv-exclusive-title {
        font-size: 30px; font-weight: 800; color: #FFC93C;
        text-shadow: 0 0 10px rgba(255,201,60,0.5);
      }
      .bmv-exclusive-sub { font-size: 15px; color: #A9B4C4; margin: 8px 0 20px; }
      .bmv-exclusive-cards { display: flex; gap: 32px; }
      .bmv-exclusive-card {
        width: 260px; height: 360px; box-sizing: border-box;
        background: #131722; border: 2px solid #2A3346; border-radius: 12px;
        padding: 14px;
        display: flex; flex-direction: column; align-items: center;
        cursor: pointer; position: relative;
        transition: transform 0.1s ease-out, border-color 0.1s ease-out;
        user-select: none; -webkit-user-select: none;
      }
      .bmv-exclusive-card:hover { border-color: #54E6C9; }
      .bmv-exclusive-card.bmv-selected {
        transform: scale(1.03);
        border-color: #54E6C9;
        box-shadow: 0 0 0 2px #54E6C9;
      }
      .bmv-exclusive-art {
        width: 200px; height: 200px;
        display: flex; align-items: center; justify-content: center;
        font-size: 22px; font-weight: 700; color: #F2F5F9;
        background: #0B0E14; border: 2px solid #2A3346; border-radius: 10px;
        overflow: hidden; flex: 0 0 auto;
      }
      .bmv-exclusive-art img.bmv-frame-img { display: block; width: 100%; height: 100%; object-fit: cover; }
      .bmv-exclusive-name { font-size: 22px; font-weight: 700; color: #F2F5F9; margin-top: 10px; }
      .bmv-exclusive-tag { font-size: 13px; color: #54E6C9; margin-top: 2px; }
      .bmv-exclusive-desc {
        font-size: 13px; color: #A9B4C4; line-height: 1.5;
        margin-top: 8px; text-align: center;
        overflow: hidden;
      }
      .bmv-exclusive-key { font-size: 12px; color: #6A7280; margin-top: auto; }
      @keyframes bmv-exclusive-rise { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      @media (max-width: 900px) {
        .bmv-exclusive-title { font-size: 22px; }
        .bmv-exclusive-sub { font-size: 12px; margin: 4px 0 12px; }
        .bmv-exclusive-cards { gap: 16px; }
        .bmv-exclusive-card { width: 150px; height: 220px; padding: 8px; }
        .bmv-exclusive-art { width: 110px; height: 110px; font-size: 15px; }
        .bmv-exclusive-name { font-size: 15px; margin-top: 6px; }
        .bmv-exclusive-tag { font-size: 11px; }
        .bmv-exclusive-desc { font-size: 11px; }
        .bmv-exclusive-key { display: none; }
      }
    `;
    host.appendChild(style);
  }
}
