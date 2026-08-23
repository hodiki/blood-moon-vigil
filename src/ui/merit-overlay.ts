/**
 * ui/merit-overlay.ts —— 守夜功绩 DOM 覆盖层（ADR-004 / merit-ui-spec v1.0）
 *
 * 规格来源：`design/official-v1/merit-ui-spec.md`（M3-DESIGN-2 终稿）
 * - 主菜单入口（start-overlay 功能行）→ 打开本层（z-index 75）；返回回主菜单。
 * - 置顶开关：纯局内模式（关闭全部功绩加成，gdd-codex §3.4/§④；切换即时持久化，下次开局生效）。
 * - 当前功绩点数（大数字 ≥28px）+ 进度条（距下个未解锁加成）。
 * - 4 加成卡（桌面 4 列一行 / 移动 2×2）：未解锁灰显 α0.5 + 锁 + 成本 / 已解锁未装备 /
 *   已装备冷青描边 + 勾选；红线达标 ✔ 标识（allMeritBonusesWithinRedline）。
 * - 装备 ≤2：第 3 个 → 替换确认弹窗（gdd-codex §6.4）；变更即时 writeSave，下次开局生效。
 * - 数据流（spec §9）：读 save.meritPoints/meritEquipped/pureInGame；写 toggleMeritEquipped +
 *   pureInGame toggle → writeSave；不直接改游戏状态（单向数据流）。
 *
 * 纯函数（meritCardState / 下个解锁 / 进度）可脱离 DOM 单测（test-framework §1.2）。
 */

import { getOverlayHost } from '@/ui/overlay-host';
import {
  MERIT_BONUSES,
  MERIT_MAX_EQUIPPED,
  MERIT_TOTAL_COST,
  PURE_IN_GAME_MODE_KEY,
  isMeritUnlocked,
  toggleMeritEquipped,
  type MeritId,
} from '@/stats/merit';
import { loadSave, writeSave, type SaveData, type SaveStorage } from '@/stats/save';

// —— 纯函数（可单测）——

/** 卡片三态（merit-ui-spec §4）：locked 未解锁 / ready 已解锁未装备 / equipped 已装备 */
export type MeritCardState = 'locked' | 'ready' | 'equipped';

export function meritCardState(points: number, equipped: readonly MeritId[], id: MeritId): MeritCardState {
  if (equipped.includes(id)) return 'equipped';
  if (!isMeritUnlocked(points, id)) return 'locked';
  return 'ready';
}

/** 距下个未解锁加成（按成本升序第一个未解锁；全部解锁 → null） */
export function meritNextUnlock(points: number): { id: MeritId; cost: number } | null {
  const sorted = [...MERIT_BONUSES].sort((a, b) => a.cost - b.cost);
  const next = sorted.find((m) => !isMeritUnlocked(points, m.id));
  return next ? { id: next.id, cost: next.cost } : null;
}

/** 进度文案（spec §2 进度条）：距下个未解锁加成还差 X 点 / 已全部解锁 */
export function meritProgressText(points: number): string {
  const next = meritNextUnlock(points);
  if (!next) return '全部加成已解锁';
  return `距下个未解锁加成还差 ${next.cost - points} 点`;
}

/** 进度比例（0..1）：已投入点数 / 总成本 120（clamp；spec §2 进度条） */
export function meritProgressRatio(points: number): number {
  return Math.min(1, Math.max(0, points / MERIT_TOTAL_COST));
}

/** 当前装备数（≤2；spec §5） */
export function meritEquippedCount(equipped: readonly MeritId[]): number {
  return equipped.length;
}

// —— 覆盖层 ——

export interface MeritOverlayOptions {
  save: SaveData;
  isMobile?: boolean;
  /** storage 抽象（测试注入 fake；缺省 window.localStorage） */
  storage?: SaveStorage;
  onClose?: () => void;
}

export class MeritOverlay {
  private readonly root: HTMLElement;
  private readonly pointsEl: HTMLElement;
  private readonly progressFill: HTMLElement;
  private readonly progressTextEl: HTMLElement;
  private readonly cardsEl: HTMLElement;
  private readonly pureToggle: HTMLInputElement;
  private readonly save: SaveData;
  private readonly platform: 'desktop' | 'mobile';
  private readonly storage: SaveStorage | null;
  private readonly onCloseCb: (() => void) | null;
  private readonly handlers: Array<{ el: HTMLElement; onClick: () => void }> = [];
  private readonly pureChangeHandler: () => void;

  constructor(host: HTMLElement, opts: MeritOverlayOptions) {
    this.save = opts.save;
    this.platform = opts.isMobile ? 'mobile' : 'desktop';
    this.storage = opts.storage ?? null;
    this.onCloseCb = opts.onClose ?? null;
    this.ensureStyles(host);

    this.root = document.createElement('div');
    this.root.className = 'bmv-merit';
    this.root.setAttribute('aria-label', '守夜功绩');
    this.root.innerHTML = `
      <div class="bmv-merit-mask"></div>
      <div class="bmv-merit-panel">
        <div class="bmv-merit-header">
          <div class="bmv-merit-title">守夜功绩</div>
          <button class="bmv-merit-close" type="button" aria-label="返回">返回</button>
        </div>
        <label class="bmv-merit-pure">
          <input type="checkbox" class="bmv-merit-pure-input" ${this.save.pureInGame ? 'checked' : ''} />
          <span class="bmv-merit-pure-label">纯局内模式</span>
          <span class="bmv-merit-pure-hint">关闭全部功绩加成（纯净局 / 自证 / 平衡测试）</span>
        </label>
        <div class="bmv-merit-points">
          <span class="bmv-merit-points-num">${this.save.meritPoints}</span>
          <span class="bmv-merit-points-label">当前功绩</span>
        </div>
        <div class="bmv-merit-progress">
          <div class="bmv-merit-progress-track"><div class="bmv-merit-progress-fill"></div></div>
          <div class="bmv-merit-progress-text"></div>
        </div>
        <div class="bmv-merit-cards"></div>
      </div>
      <div class="bmv-merit-replace">
        <div class="bmv-merit-replace-panel">
          <div class="bmv-merit-replace-title">替换加成（最多同时 2 个）</div>
          <div class="bmv-merit-replace-list"></div>
          <button class="bmv-merit-replace-cancel" type="button">取消</button>
        </div>
      </div>
    `;
    host.appendChild(this.root);

    this.pointsEl = this.root.querySelector('.bmv-merit-points-num') as HTMLElement;
    this.progressFill = this.root.querySelector('.bmv-merit-progress-fill') as HTMLElement;
    this.progressTextEl = this.root.querySelector('.bmv-merit-progress-text') as HTMLElement;
    this.cardsEl = this.root.querySelector('.bmv-merit-cards') as HTMLElement;
    this.pureToggle = this.root.querySelector('.bmv-merit-pure-input') as HTMLInputElement;

    const close = this.root.querySelector('.bmv-merit-close') as HTMLElement;
    this.bindClick(close, () => this.close());
    const mask = this.root.querySelector('.bmv-merit-mask') as HTMLElement;
    this.bindClick(mask, () => this.close());
    const cancel = this.root.querySelector('.bmv-merit-replace-cancel') as HTMLElement;
    this.bindClick(cancel, () => this.hideReplace());

    this.pureChangeHandler = () => {
      this.save.pureInGame = this.pureToggle.checked;
      this.persist();
      this.renderCards(); // 纯局内开启 → 4 卡全部置灰 + 提示
    };
    this.pureToggle.addEventListener('change', this.pureChangeHandler);

    this.renderCards();
  }

  private bindClick(el: HTMLElement, onClick: () => void): void {
    el.addEventListener('click', onClick);
    this.handlers.push({ el, onClick });
  }

  private persist(): void {
    const storage = this.storage ?? window.localStorage;
    writeSave(storage, this.save, this.platform);
  }

  private close(): void {
    this.destroy();
    this.onCloseCb?.();
  }

  private renderCards(): void {
    this.cardsEl.innerHTML = '';
    const points = this.save.meritPoints;
    const equipped = this.save.meritEquipped;
    const pure = this.save.pureInGame;
    this.pointsEl.textContent = String(points);
    this.progressFill.style.width = `${Math.round(meritProgressRatio(points) * 100)}%`;
    this.progressTextEl.textContent = meritProgressText(points);

    for (const bonus of MERIT_BONUSES) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'bmv-merit-card';
      const state = pure ? 'locked' : meritCardState(points, equipped, bonus.id);
      card.dataset.state = state;
      card.setAttribute('aria-label', `${bonus.name}（${state === 'equipped' ? '已装备' : state === 'locked' ? '未解锁' : '未装备'}）`);
      const costText = isMeritUnlocked(points, bonus.id) ? '已解锁' : `需 ${bonus.cost} 功绩`;
      const check = state === 'equipped' ? '<span class="bmv-merit-check">✔</span>' : '';
      const redline = '<span class="bmv-merit-redline" title="对 6 分钟成型强度影响 ≤10%（红线达标）">✔ 红线达标</span>';
      card.innerHTML = `
        ${check}
        <div class="bmv-merit-card-name">${bonus.name}</div>
        <div class="bmv-merit-card-desc">${bonus.desc}</div>
        <div class="bmv-merit-card-foot">${costText}${redline}</div>
      `;
      this.bindClick(card, () => this.onCardClick(bonus.id));
      this.cardsEl.appendChild(card);
    }
    if (pure) {
      const hint = document.createElement('div');
      hint.className = 'bmv-merit-pure-hint-banner';
      hint.textContent = '纯净局：加成不生效（下次开局生效）';
      this.cardsEl.appendChild(hint);
    }
  }

  private onCardClick(id: MeritId): void {
    const equipped = this.save.meritEquipped;
    // 纯局内模式：4 卡全部置灰不可点
    if (this.save.pureInGame) return;
    if (equipped.includes(id)) {
      // 已装备 → 卸下
      this.save.meritEquipped = toggleMeritEquipped(equipped, id);
      this.persist();
      this.renderCards();
      return;
    }
    if (!isMeritUnlocked(this.save.meritPoints, id)) return; // 未解锁不可点
    if (equipped.length < MERIT_MAX_EQUIPPED) {
      this.save.meritEquipped = toggleMeritEquipped(equipped, id);
      this.persist();
      this.renderCards();
      return;
    }
    // 已 2 个 → 替换确认（gdd-codex §6.4）
    this.showReplace(id);
  }

  private showReplace(target: MeritId): void {
    const list = this.root.querySelector('.bmv-merit-replace-list') as HTMLElement;
    list.innerHTML = '';
    for (const equippedId of this.save.meritEquipped) {
      const bonus = MERIT_BONUSES.find((b) => b.id === equippedId);
      if (!bonus) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bmv-merit-replace-option';
      btn.textContent = `替换「${bonus.name}」`;
      this.bindClick(btn, () => {
        this.save.meritEquipped = this.save.meritEquipped.filter((e) => e !== equippedId);
        this.save.meritEquipped = [...this.save.meritEquipped, target];
        this.persist();
        this.hideReplace();
        this.renderCards();
      });
      list.appendChild(btn);
    }
    (this.root.querySelector('.bmv-merit-replace') as HTMLElement).classList.add('open');
  }

  private hideReplace(): void {
    (this.root.querySelector('.bmv-merit-replace') as HTMLElement).classList.remove('open');
  }

  destroy(): void {
    for (const h of this.handlers) h.el.removeEventListener('click', h.onClick);
    this.pureToggle.removeEventListener('change', this.pureChangeHandler);
    this.root.remove();
  }

  /** CSS 注入一次（ADR-004；色板 token 来源 art-bible §2.4；z-index 75 盖主菜单 70） */
  private ensureStyles(host: HTMLElement): void {
    if (document.getElementById('bmv-merit-styles')) return;
    const style = document.createElement('style');
    style.id = 'bmv-merit-styles';
    style.textContent = `
      .bmv-merit {
        position: absolute; inset: 0;
        z-index: 75;
        font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
        padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px)
                 env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
      }
      .bmv-merit-mask { position: absolute; inset: 0; background: rgba(11,14,20,0.85); }
      .bmv-merit-panel {
        position: absolute; inset: 24px;
        display: flex; flex-direction: column;
        box-sizing: border-box;
        padding: 24px;
        background: #131722;
        border: 2px solid #2A3346; border-radius: 12px;
      }
      .bmv-merit-header {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 16px;
      }
      .bmv-merit-title { font-size: 28px; font-weight: 700; color: #F2F5F9; letter-spacing: 2px; }
      .bmv-merit-close {
        min-width: 88px; height: 44px;
        font-size: 16px; color: #A9B4C4;
        background: transparent; border: 1px solid #2A3346; border-radius: 8px;
        cursor: pointer;
      }
      .bmv-merit-close:hover { color: #F2F5F9; border-color: #54E6C9; }
      .bmv-merit-pure {
        display: flex; align-items: center; gap: 10px;
        min-height: 44px;
        padding: 0 14px;
        background: #0B0E14; border: 1px solid #2A3346; border-radius: 8px;
        cursor: pointer;
        margin-bottom: 16px;
      }
      .bmv-merit-pure-input { width: 20px; height: 20px; accent-color: #54E6C9; }
      .bmv-merit-pure-label { font-size: 16px; font-weight: 700; color: #F2F5F9; }
      .bmv-merit-pure-hint { font-size: 13px; color: #6A7280; }
      .bmv-merit-points {
        display: flex; align-items: baseline; gap: 10px;
        margin-bottom: 8px;
      }
      .bmv-merit-points-num { font-size: 40px; font-weight: 800; color: #54E6C9; font-variant-numeric: tabular-nums; }
      .bmv-merit-points-label { font-size: 16px; color: #A9B4C4; }
      .bmv-merit-progress { margin-bottom: 20px; }
      .bmv-merit-progress-track {
        height: 10px; border-radius: 999px;
        background: #0B0E14; border: 1px solid #2A3346;
        overflow: hidden;
      }
      .bmv-merit-progress-fill {
        height: 100%; border-radius: 999px;
        background: #54E6C9;
        transition: width 0.3s ease-out;
      }
      .bmv-merit-progress-text { margin-top: 4px; font-size: 14px; color: #A9B4C4; }
      .bmv-merit-cards {
        flex: 1; min-height: 0;
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        align-content: start;
        overflow-y: auto;
      }
      .bmv-merit-card {
        position: relative;
        min-height: 160px;
        box-sizing: border-box;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        padding: 14px;
        background: #0B0E14; border: 2px solid #2A3346; border-radius: 10px;
        color: #F2F5F9;
        cursor: pointer;
        user-select: none; -webkit-user-select: none;
        transition: border-color 0.1s ease-out;
      }
      .bmv-merit-card[data-state="equipped"] { border-color: #54E6C9; box-shadow: 0 0 0 2px #54E6C9; }
      .bmv-merit-card[data-state="locked"] { opacity: 0.5; cursor: not-allowed; }
      .bmv-merit-card[data-state="ready"]:hover { border-color: #54E6C9; }
      .bmv-merit-check {
        position: absolute; top: 8px; right: 10px;
        font-size: 20px; color: #54E6C9; font-weight: 800;
      }
      .bmv-merit-card-name { font-size: 20px; font-weight: 700; text-align: center; }
      .bmv-merit-card-desc { margin-top: 6px; font-size: 14px; color: #A9B4C4; text-align: center; }
      .bmv-merit-card-foot {
        margin-top: 10px;
        display: flex; flex-direction: column; align-items: center; gap: 4px;
        font-size: 13px; color: #F2F5F9;
      }
      .bmv-merit-redline { font-size: 11px; color: #43D17C; }
      .bmv-merit-pure-hint-banner {
        grid-column: 1 / -1;
        padding: 10px; text-align: center;
        font-size: 14px; color: #A9B4C4;
        background: #0B0E14; border: 1px dashed #2A3346; border-radius: 8px;
      }
      .bmv-merit-replace {
        position: absolute; inset: 0;
        display: none; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.5);
      }
      .bmv-merit-replace.open { display: flex; }
      .bmv-merit-replace-panel {
        width: 420px; max-width: calc(100vw - 48px);
        box-sizing: border-box;
        padding: 24px;
        background: #131722; border: 2px solid #2A3346; border-radius: 12px;
        display: flex; flex-direction: column; gap: 12px;
      }
      .bmv-merit-replace-title { font-size: 20px; font-weight: 700; color: #F2F5F9; }
      .bmv-merit-replace-list { display: flex; flex-direction: column; gap: 8px; }
      .bmv-merit-replace-option, .bmv-merit-replace-cancel {
        min-height: 48px;
        font-size: 16px; color: #F2F5F9;
        background: #0B0E14; border: 1px solid #54E6C9; border-radius: 8px;
        cursor: pointer;
      }
      .bmv-merit-replace-cancel { color: #A9B4C4; border-color: #2A3346; }
      /* 移动端（spec §8）：2×2 网格、关键数值 ≥16px 物理、热区 ≥44、安全区 */
      @media (max-width: 900px) {
        .bmv-merit-panel { inset: 12px; padding: 16px; }
        .bmv-merit-title { font-size: 24px; }
        .bmv-merit-points-num { font-size: 32px; }
        .bmv-merit-cards { grid-template-columns: repeat(2, 1fr); gap: 10px; }
        .bmv-merit-card { min-height: 140px; }
        .bmv-merit-card-name { font-size: 16px; }
        .bmv-merit-card-desc { font-size: 14px; }
        .bmv-merit-points-num, .bmv-merit-progress-text, .bmv-merit-card-foot { font-size: 16px; }
      }
    `;
    host.appendChild(style);
  }
}

/** 便捷工厂：挂到默认 #ui-overlay（BootScene 主菜单使用） */
export function createMeritOverlay(opts: MeritOverlayOptions): MeritOverlay {
  return new MeritOverlay(getOverlayHost(), opts);
}

/** 便捷：从 storage 读当前存档（打开功绩页时快照；损坏回退空存档不崩溃） */
export function loadMeritSave(storage: SaveStorage, platform: 'desktop' | 'mobile'): SaveData {
  return loadSave(storage, platform);
}

/** 便捷：纯局内模式键（供外部/测试断言持久化键名） */
export function pureInGameKey(): string {
  return PURE_IN_GAME_MODE_KEY;
}
