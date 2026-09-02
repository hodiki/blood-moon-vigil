/**
 * ui/keybinds-overlay.ts —— 键位卡（守夜人的第一课）DOM 覆盖层（NV-PLAYER-UI W-B4）
 *
 * 背景（playtest 2026-09-02）：「键位几乎没人告诉我。WASD、空格、Q 都要自己猜。」
 * - 首次游玩（标记未写）进局前弹出一次：WASD 移动 / 空格 专属技能 / Q 圣物 / Esc 暂停；
 *   任意键/点击关闭，关闭时写标记（首次只在标记缺失时弹）。
 * - 「设置」（暂停菜单）内「新手教程」按钮可重看（重看同样写标记，幂等）。
 * - 存储口径：独立 localStorage 键 `bmv.keybindsShown.v1`（本层自有；src/stats/save.ts 属
 *   游戏侧禁区，后续对齐时由游戏侧并入 SaveData.keybindsShown——见交付报告）。
 * - 血月哥特风格卡片：墨夜底 + 猩红描边 + 月相符号；双端热区 ≥44px。
 * 单向数据流（ADR-004）：本层只读写自身标记，不持有/修改任何游戏状态。
 */

/** 键位卡行数据（纯数据供单测与渲染共用） */
export interface KeybindRow {
  keys: string;
  label: string;
}

/** 键位卡内容（WASD / 空格 / Q / Esc；桌面键位口径） */
export const KEYBIND_ROWS: readonly KeybindRow[] = [
  { keys: 'W A S D', label: '移动' },
  { keys: '空格', label: '专属技能' },
  { keys: 'Q', label: '圣物' },
  { keys: 'Esc', label: '暂停' },
];

export const KEYBINDS_TITLE = '守夜人的第一课';
export const KEYBINDS_FOOTER = '按任意键，走进夜色';
export const KEYBINDS_TUTORIAL_LABEL = '新手教程 · 键位';

/** localStorage 标记键（首次弹卡口径；独立键，避免触碰 src/stats/save.ts 游戏侧禁区） */
export const KEYBINDS_SEEN_STORAGE_KEY = 'bmv.keybindsShown.v1';

/** 首次标记读取（缺 key = 未展示过 → 应弹卡；纯函数可注入 storage 单测） */
export function loadKeybindsShown(storage: Pick<Storage, 'getItem'>): boolean {
  try {
    return storage.getItem(KEYBINDS_SEEN_STORAGE_KEY) === '1';
  } catch {
    return false; // localStorage 不可用（隐私模式等）→ 每局都弹不符合预期，按未展示处理但不阻塞
  }
}

/** 首次标记写入（关闭键位卡时调用；幂等） */
export function markKeybindsShown(storage: Pick<Storage, 'setItem'>): void {
  try {
    storage.setItem(KEYBINDS_SEEN_STORAGE_KEY, '1');
  } catch {
    /* 写失败静默：下次仍弹卡，可接受 */
  }
}

export interface KeybindsOverlayOptions {
  /** 关闭回调（首次流：写标记后放行进局；教程流：回到暂停面板） */
  onClose: () => void;
  /** 标记存储（缺省 window.localStorage；测试注入内存实现） */
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  /** 是否写标记（首次流 true；教程重看可 false 保持语义纯净，缺省 true 幂等无害） */
  markSeen?: boolean;
}

export class KeybindsOverlay {
  private readonly root: HTMLElement;
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'>;
  private readonly markSeen: boolean;
  private readonly onClose: () => void;
  private closed = false;

  constructor(host: HTMLElement, opts: KeybindsOverlayOptions) {
    this.onClose = opts.onClose;
    this.storage = opts.storage ?? window.localStorage;
    this.markSeen = opts.markSeen ?? true;
    this.ensureStyles(host);

    this.root = document.createElement('div');
    this.root.className = 'bmv-keybinds';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', KEYBINDS_TITLE);
    const rows = KEYBIND_ROWS.map(
      (r) => `<div class="bmv-keybinds-row"><span class="bmv-keybinds-keys">${r.keys}</span><span class="bmv-keybinds-label">${r.label}</span></div>`,
    ).join('');
    this.root.innerHTML = `
      <div class="bmv-keybinds-mask"></div>
      <div class="bmv-keybinds-panel">
        <div class="bmv-keybinds-moon">☾</div>
        <div class="bmv-keybinds-title">${KEYBINDS_TITLE}</div>
        <div class="bmv-keybinds-sub">血月之夜，记住这几件事</div>
        <div class="bmv-keybinds-rows">${rows}</div>
        <div class="bmv-keybinds-footer">${KEYBINDS_FOOTER}</div>
      </div>
    `;
    this.root.addEventListener('pointerdown', () => this.close());
    window.addEventListener('keydown', this.onKeyDown, { once: false });
    host.appendChild(this.root);
  }

  private onKeyDown = (): void => {
    this.close();
  };

  /** 关闭（任意键/点击；写标记 + 回调，仅生效一次） */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    if (this.markSeen) markKeybindsShown(this.storage);
    this.root.remove();
    this.onClose();
  }

  destroy(): void {
    this.closed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    this.root.remove();
  }

  /** CSS 注入一次（ADR-004；血月哥特：墨夜底/猩红描边/月相符号） */
  private ensureStyles(host: HTMLElement): void {
    if (document.getElementById('bmv-keybinds-styles')) return;
    const style = document.createElement('style');
    style.id = 'bmv-keybinds-styles';
    style.textContent = `
      .bmv-keybinds {
        position: absolute; inset: 0;
        display: flex; align-items: center; justify-content: center;
        pointer-events: auto;
        z-index: 78; /* 首屏覆盖：盖过 start(70)/tree(75)，低于 toast 类临时层 */
        font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
        padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px)
                 env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
      }
      .bmv-keybinds-mask { position: absolute; inset: 0; background: rgba(5,7,12,0.94); }
      .bmv-keybinds-panel {
        position: relative;
        width: 340px; max-width: calc(100vw - 32px);
        box-sizing: border-box;
        padding: 30px 28px;
        background: #131722;
        border: 2px solid #7A1F26;
        border-radius: 12px;
        box-shadow: 0 0 32px rgba(255,59,48,0.18), inset 0 0 24px rgba(122,31,38,0.22);
        display: flex; flex-direction: column; align-items: center;
        animation: bmv-keybinds-rise 0.25s ease-out;
      }
      .bmv-keybinds-moon {
        font-size: 30px; color: #FF3B30;
        text-shadow: 0 0 14px rgba(255,59,48,0.75);
        margin-bottom: 6px;
      }
      .bmv-keybinds-title {
        font-size: 24px; font-weight: 700; color: #F2F5F9;
        letter-spacing: 3px;
      }
      .bmv-keybinds-sub { font-size: 13px; color: #A9B4C4; margin: 6px 0 18px; letter-spacing: 1px; }
      .bmv-keybinds-rows { width: 100%; display: flex; flex-direction: column; gap: 8px; }
      .bmv-keybinds-row {
        min-height: 44px; box-sizing: border-box; /* 热区 ≥44（ux-spec §3） */
        display: flex; align-items: center; justify-content: space-between;
        padding: 8px 14px;
        background: #0B0E14;
        border: 1px solid #2A3346; border-radius: 8px;
      }
      .bmv-keybinds-keys {
        font-size: 15px; font-weight: 700; color: #54E6C9;
        letter-spacing: 2px;
      }
      .bmv-keybinds-label { font-size: 15px; color: #F2F5F9; }
      .bmv-keybinds-footer {
        margin-top: 18px;
        font-size: 13px; color: #6A7280;
        letter-spacing: 1px;
      }
      @keyframes bmv-keybinds-rise { from { transform: translateY(14px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      /* 移动端：面板收缩 + 提示语换成「点击任意处」（触屏无键盘） */
      @media (max-width: 900px) {
        .bmv-keybinds-panel { padding: 22px 18px; }
        .bmv-keybinds-title { font-size: 20px; }
        .bmv-keybinds-keys { font-size: 13px; }
        .bmv-keybinds-label { font-size: 13px; }
      }
    `;
    host.appendChild(style);
  }
}
