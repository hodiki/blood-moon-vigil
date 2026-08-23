/**
 * ui/codex-overlay.ts —— 图鉴「守夜日志」DOM 覆盖层（ADR-004 / codex-ui-spec v1.0）
 *
 * 规格来源：`design/official-v1/codex-ui-spec.md`（M3-DESIGN-2 终稿）
 * - 主菜单入口（start-overlay 功能行）→ 打开本层（z-index 75，盖在主菜单 70 之上）；返回回主菜单。
 * - 6 页签（角色 4 / 敌人 15 / Boss 4 / 武器 14 / 超武 7 / 事件 6 = 50）+ 计数徽章。
 * - 三态卡片：解锁（图标+名称+标签）/ 锁定（剪影降饱和 α0.4 + 中央「？」+ 解锁条件）/
 *   血月化身隐藏（「？？？」占位 + 解锁条件；不放剪影保密，首杀后转完整档案）。
 * - 详情抽屉：桌面右侧 480px / 移动底部 60% 高；字段来自 narratives-spec 档案 + balance 配置。
 * - 双端布局（spec §8）：桌面 8 列网格 / 移动 4 列 96×96；热区 ≥44；安全区 env()。
 * - 数据流（spec §9）：只读 save.codexUnlocked（快照）；不写任何解锁状态；只发「返回」事件。
 *
 * 纯函数（codexCardState / 页签 / 计数）可脱离 DOM 单测（test-framework §1.2）；
 * 图标为每类程序剪影占位（M4 外部图集按帧名无痛替换，asset-spec §1.6）。
 */

import { getOverlayHost } from '@/ui/overlay-host';
import {
  CODEX_ENTRIES,
  codexCategoryCounts,
  type CodexCategory,
  type CodexEntry,
} from '@/codex/codex';
import {
  HERO_ARCHIVES,
  BOSS_ARCHIVES,
  EVENT_ARCHIVES,
  NP,
} from '@/narratives/narratives';
import {
  ENEMY_CONFIGS,
  WEAPON_CONFIGS,
  EVOLUTIONS,
  HEROES,
  BOSSES,
  type HeroId,
  type BossId,
  type EnemyId,
  type WeaponId,
  type EvoId,
} from '@/config/balance';
import type { SaveData } from '@/stats/save';

// —— 纯函数（可单测）——

/** 卡片三态（spec §4）：隐藏（血月化身未解锁，保密「？？？」）/ 解锁 / 锁定 */
export type CodexCardState = 'unlocked' | 'locked' | 'hidden';

export function codexCardState(entry: CodexEntry, unlocked: ReadonlySet<string>): CodexCardState {
  if (entry.hidden && !unlocked.has(entry.entryId)) return 'hidden';
  return unlocked.has(entry.entryId) ? 'unlocked' : 'locked';
}

/** 6 页签（spec §3） */
export const CODEX_TABS: readonly { category: CodexCategory; label: string }[] = [
  { category: 'hero', label: '角色' },
  { category: 'enemy', label: '敌人' },
  { category: 'boss', label: 'Boss' },
  { category: 'weapon', label: '武器' },
  { category: 'evo', label: '超武' },
  { category: 'event', label: '事件' },
] as const;

/** 分项总数（角色 4/敌人 15/Boss 4/武器 14/超武 7/事件 6 = 50；codex.ts 数据层口径） */
export function codexTabCounts(): Record<CodexCategory, number> {
  return codexCategoryCounts();
}

/** 该类已解锁数（save.codexUnlocked ∩ 该类条目；spec §3 计数徽章「已解锁/总数」） */
export function codexUnlockedCount(unlocked: ReadonlySet<string>, category: CodexCategory): number {
  return CODEX_ENTRIES.filter((e) => e.category === category && unlocked.has(e.entryId)).length;
}

/** 全量已解锁数（收集进度 X/50；spec §2 底部进度） */
export function codexTotalUnlocked(unlocked: ReadonlySet<string>): number {
  return CODEX_ENTRIES.filter((e) => unlocked.has(e.entryId)).length;
}

/** 解锁集构造（存档快照；损坏存档空集 → 全锁定，不崩溃，spec §10.1） */
export function codexUnlockedSet(save: SaveData): ReadonlySet<string> {
  return new Set(Array.isArray(save.codexUnlocked) ? save.codexUnlocked : []);
}

/** 该条目解锁条件文案（锁定/隐藏卡下方小字；spec §4） */
export function codexConditionText(entry: CodexEntry): string {
  if (entry.hidden) return '任意地图击杀（稀有月坠）'; // 血月化身隐藏条目（保密占位）
  return entry.condition;
}

// —— 图标（每类程序剪影占位；M4 外部图集按帧名无痛替换）——

const GLYPH_COLORS: Record<CodexCategory, string> = {
  hero: '#E8F0FA', // 月银白（玩家侧）
  enemy: '#8C2F2F', // 暗红（亡者剪影）
  boss: '#FF3B3B', // 猩红金
  weapon: '#54E6C9', // 冷青
  evo: '#FFC93C', // 金（稀有/超武）
  event: '#A9B4C4', // 灰蓝（档案）
};

const GLYPH_SHAPES: Record<CodexCategory, string> = {
  hero: '<circle cx="32" cy="26" r="10"/><path d="M32 40 L32 58 M20 46 L44 46 M26 58 L32 50 L38 58" stroke-width="4" fill="none"/>',
  enemy: '<circle cx="32" cy="24" r="12"/><path d="M32 38 L32 56 M20 44 L44 44 M24 62 L32 50 L40 62" stroke-width="4" fill="none"/>',
  boss: '<circle cx="32" cy="26" r="12"/><path d="M20 42 L32 58 L44 42 M26 62 L32 52 L38 62" stroke-width="4" fill="none"/>',
  weapon: '<path d="M22 52 L40 20 M40 20 L52 32 M40 20 L34 14 M40 20 L46 26" stroke-width="4" fill="none"/>',
  evo: '<path d="M32 14 L38 28 L52 30 L41 40 L44 54 L32 46 L20 54 L23 40 L12 30 L26 28 Z" />',
  event: '<rect x="18" y="16" width="28" height="36" rx="4"/><path d="M24 28 L40 28 M24 36 L40 36 M24 44 L34 44" stroke-width="3" fill="none"/>',
};

export function codexGlyphSvg(category: CodexCategory, size = 64): string {
  const color = GLYPH_COLORS[category];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="12" fill="#131722"/>
    <g stroke="${color}" stroke-linejoin="round" stroke-linecap="round">${GLYPH_SHAPES[category]}</g>
  </svg>`;
}

// —— 覆盖层 ——

export interface CodexOverlayOptions {
  /** 局外存档（只读 codexUnlocked 快照；spec §9 单向数据流） */
  save: SaveData;
  isMobile?: boolean;
  onClose?: () => void;
}

export class CodexOverlay {
  private readonly root: HTMLElement;
  private readonly tabRow: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly progressEl: HTMLElement;
  private readonly drawer: HTMLElement;
  private readonly drawerBody: HTMLElement;
  private readonly unlocked: ReadonlySet<string>;
  private readonly onCloseCb: (() => void) | null;
  private readonly handlers: Array<{ el: HTMLElement; onClick: () => void }> = [];
  private currentCategory: CodexCategory = 'hero';

  constructor(host: HTMLElement, opts: CodexOverlayOptions) {
    this.unlocked = codexUnlockedSet(opts.save);
    this.onCloseCb = opts.onClose ?? null;
    this.ensureStyles(host);

    this.root = document.createElement('div');
    this.root.className = 'bmv-codex';
    this.root.setAttribute('aria-label', '守夜日志 图鉴');
    this.root.innerHTML = `
      <div class="bmv-codex-mask"></div>
      <div class="bmv-codex-panel">
        <div class="bmv-codex-header">
          <div class="bmv-codex-title">守夜日志</div>
          <button class="bmv-codex-close" type="button" aria-label="返回">返回</button>
        </div>
        <div class="bmv-codex-tabs"></div>
        <div class="bmv-codex-grid"></div>
        <div class="bmv-codex-footer"></div>
      </div>
      <div class="bmv-codex-drawer">
        <div class="bmv-codex-drawer-head">
          <div class="bmv-codex-drawer-title"></div>
          <button class="bmv-codex-drawer-close" type="button" aria-label="关闭">返回</button>
        </div>
        <div class="bmv-codex-drawer-body"></div>
      </div>
    `;
    host.appendChild(this.root);

    this.tabRow = this.root.querySelector('.bmv-codex-tabs') as HTMLElement;
    this.grid = this.root.querySelector('.bmv-codex-grid') as HTMLElement;
    this.progressEl = this.root.querySelector('.bmv-codex-footer') as HTMLElement;
    this.drawer = this.root.querySelector('.bmv-codex-drawer') as HTMLElement;
    this.drawerBody = this.root.querySelector('.bmv-codex-drawer-body') as HTMLElement;

    const close = this.root.querySelector('.bmv-codex-close') as HTMLElement;
    this.bindClick(close, () => this.close());
    const drawerClose = this.root.querySelector('.bmv-codex-drawer-close') as HTMLElement;
    this.bindClick(drawerClose, () => this.hideDrawer());
    // 遮罩点击关闭（spec §5；面板区不关闭）
    const mask = this.root.querySelector('.bmv-codex-mask') as HTMLElement;
    this.bindClick(mask, () => {
      if (this.drawer.classList.contains('open')) this.hideDrawer();
      else this.close();
    });

    this.renderTabs();
    this.renderCategory(this.currentCategory);
  }

  private bindClick(el: HTMLElement, onClick: () => void): void {
    el.addEventListener('click', onClick);
    this.handlers.push({ el, onClick });
  }

  private close(): void {
    for (const h of this.handlers) h.el.removeEventListener('click', h.onClick);
    this.root.remove();
    this.onCloseCb?.();
  }

  private renderTabs(): void {
    this.tabRow.innerHTML = '';
    const counts = codexTabCounts();
    for (const tab of CODEX_TABS) {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'bmv-codex-tab';
      if (tab.category === this.currentCategory) pill.classList.add('active');
      const unlocked = codexUnlockedCount(this.unlocked, tab.category);
      pill.innerHTML = `<span class="bmv-codex-tab-label">${tab.label}</span><span class="bmv-codex-tab-count">${unlocked}/${counts[tab.category]}</span>`;
      pill.setAttribute('aria-label', `${tab.label} ${unlocked}/${counts[tab.category]}`);
      this.bindClick(pill, () => {
        this.currentCategory = tab.category;
        this.hideDrawer();
        this.renderTabs();
        this.renderCategory(tab.category);
      });
      this.tabRow.appendChild(pill);
    }
  }

  private renderCategory(category: CodexCategory): void {
    this.grid.innerHTML = '';
    const entries = CODEX_ENTRIES.filter((e) => e.category === category);
    for (const entry of entries) {
      const card = document.createElement('div');
      card.className = 'bmv-codex-card';
      const state = codexCardState(entry, this.unlocked);
      card.dataset.state = state;
      card.setAttribute('aria-label', `${entry.name} ${state === 'unlocked' ? '已解锁' : state === 'hidden' ? '隐藏' : '未解锁'}`);
      if (state === 'hidden') {
        card.innerHTML = `<div class="bmv-codex-card-glyph bmv-codex-hidden">？？？</div><div class="bmv-codex-card-name">？？？</div><div class="bmv-codex-card-condition">${codexConditionText(entry)}</div>`;
      } else if (state === 'locked') {
        card.innerHTML = `<div class="bmv-codex-card-glyph">${codexGlyphSvg(category)}<div class="bmv-codex-q">？</div></div><div class="bmv-codex-card-name">？？？</div><div class="bmv-codex-card-condition">${codexConditionText(entry)}</div>`;
      } else {
        card.innerHTML = `<div class="bmv-codex-card-glyph">${codexGlyphSvg(category)}</div><div class="bmv-codex-card-name">${entry.name}</div><div class="bmv-codex-card-tag">${this.tagText(entry)}</div>`;
      }
      if (state === 'unlocked') {
        this.bindClick(card, () => this.showDetail(entry));
      } else {
        // 锁定/隐藏：点击提示解锁条件（卡片抖动 + 条件已在卡面显示）
        this.bindClick(card, () => this.shakeCard(card));
      }
      this.grid.appendChild(card);
    }
    this.progressEl.textContent = `收集进度：${codexTotalUnlocked(this.unlocked)} / ${CODEX_ENTRIES.length}`;
  }

  private shakeCard(card: HTMLElement): void {
    card.classList.remove('shake');
    void card.offsetWidth;
    card.classList.add('shake');
  }

  private tagText(entry: CodexEntry): string {
    const tag = this.powerTagFor(entry);
    return tag ? NP[tag] : '';
  }

  private powerTagFor(entry: CodexEntry): keyof typeof NP | null {
    switch (entry.category) {
      case 'hero': {
        const id = entry.entryId.replace('codex_hero_', '') as HeroId;
        return HEROES[id]?.powerTag ?? null;
      }
      case 'boss': {
        const id = entry.entryId.replace('codex_boss_', '') as BossId;
        return BOSSES[id]?.powerTag ?? null;
      }
      case 'enemy': {
        const id = entry.entryId.replace('codex_enemy_', '') as EnemyId;
        return ENEMY_CONFIGS[id]?.powerTag ?? null;
      }
      case 'weapon': {
        const id = entry.entryId.replace('codex_wpn_', '') as WeaponId;
        return WEAPON_CONFIGS[id]?.powerTag ?? null;
      }
      default:
        return null;
    }
  }

  private showDetail(entry: CodexEntry): void {
    const title = this.drawer.querySelector('.bmv-codex-drawer-title') as HTMLElement;
    title.textContent = entry.name;
    this.drawerBody.innerHTML = '';
    const fields = detailFor(entry);
    for (const f of fields) {
      const row = document.createElement('div');
      row.className = 'bmv-codex-detail-row';
      const label = document.createElement('div');
      label.className = 'bmv-codex-detail-label';
      label.textContent = f.label;
      const value = document.createElement('div');
      value.className = 'bmv-codex-detail-value';
      value.textContent = f.value;
      row.appendChild(label);
      row.appendChild(value);
      this.drawerBody.appendChild(row);
    }
    if (fields.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'bmv-codex-detail-value';
      empty.textContent = '（档案待 M4 图集接入）';
      this.drawerBody.appendChild(empty);
    }
    this.drawer.classList.add('open');
  }

  private hideDrawer(): void {
    this.drawer.classList.remove('open');
  }

  destroy(): void {
    for (const h of this.handlers) h.el.removeEventListener('click', h.onClick);
    this.root.remove();
  }

  /** CSS 注入一次（ADR-004；色板 token 来源 art-bible §2.4；z-index 75 盖主菜单 70） */
  private ensureStyles(host: HTMLElement): void {
    if (document.getElementById('bmv-codex-styles')) return;
    const style = document.createElement('style');
    style.id = 'bmv-codex-styles';
    style.textContent = `
      .bmv-codex {
        position: absolute; inset: 0;
        z-index: 75;
        font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
        padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px)
                 env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
      }
      .bmv-codex-mask { position: absolute; inset: 0; background: rgba(11,14,20,0.85); }
      .bmv-codex-panel {
        position: absolute; inset: 24px;
        display: flex; flex-direction: column;
        box-sizing: border-box;
        padding: 24px;
        background: #131722;
        border: 2px solid #2A3346; border-radius: 12px;
      }
      .bmv-codex-header {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 16px;
      }
      .bmv-codex-title { font-size: 28px; font-weight: 700; color: #F2F5F9; letter-spacing: 2px; }
      .bmv-codex-close, .bmv-codex-drawer-close {
        min-width: 88px; height: 44px;
        font-size: 16px; color: #A9B4C4;
        background: transparent; border: 1px solid #2A3346; border-radius: 8px;
        cursor: pointer;
      }
      .bmv-codex-close:hover, .bmv-codex-drawer-close:hover { color: #F2F5F9; border-color: #54E6C9; }
      .bmv-codex-tabs { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
      .bmv-codex-tab {
        display: inline-flex; align-items: center; gap: 8px;
        min-height: 44px; padding: 0 16px;
        font-size: 16px; color: #A9B4C4;
        background: #0B0E14; border: 1px solid #2A3346; border-radius: 999px;
        cursor: pointer;
      }
      .bmv-codex-tab.active { color: #F2F5F9; border-color: #54E6C9; box-shadow: 0 0 0 2px #54E6C9; }
      .bmv-codex-tab-count { font-size: 13px; color: #54E6C9; font-variant-numeric: tabular-nums; }
      .bmv-codex-grid {
        flex: 1; min-height: 0;
        display: grid;
        grid-template-columns: repeat(8, 1fr);
        gap: 10px;
        overflow-y: auto;
        align-content: start;
      }
      .bmv-codex-card {
        display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
        min-height: 120px;
        padding: 8px 4px;
        box-sizing: border-box;
        background: #0B0E14; border: 1px solid #2A3346; border-radius: 8px;
        color: #F2F5F9;
        cursor: pointer;
        user-select: none; -webkit-user-select: none;
      }
      .bmv-codex-card[data-state="locked"] { opacity: 0.75; }
      .bmv-codex-card[data-state="hidden"] { opacity: 0.85; border-style: dashed; }
      .bmv-codex-card-glyph { position: relative; width: 64px; height: 64px; }
      .bmv-codex-card-glyph svg { width: 64px; height: 64px; display: block; }
      .bmv-codex-card[data-state="locked"] .bmv-codex-card-glyph svg {
        filter: grayscale(1) brightness(0.55);
        opacity: 0.4;
      }
      .bmv-codex-q {
        position: absolute; inset: 0;
        display: flex; align-items: center; justify-content: center;
        font-size: 32px; font-weight: 800; color: #F2F5F9;
      }
      .bmv-codex-hidden {
        display: flex; align-items: center; justify-content: center;
        font-size: 24px; font-weight: 800; color: #6A7280;
        letter-spacing: 2px;
      }
      .bmv-codex-card-name {
        margin-top: 6px; font-size: 14px; font-weight: 600;
        max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .bmv-codex-card-tag { margin-top: 2px; font-size: 11px; color: #54E6C9; }
      .bmv-codex-card-condition {
        margin-top: 6px; font-size: 11px; color: #6A7280; text-align: center;
        line-height: 1.3;
      }
      .bmv-codex-footer {
        margin-top: 12px; text-align: center;
        font-size: 16px; color: #A9B4C4; font-variant-numeric: tabular-nums;
      }
      .bmv-codex-card.shake { animation: bmv-codex-shake 0.25s; }
      @keyframes bmv-codex-shake {
        0%,100% { transform: translateX(0); }
        25% { transform: translateX(-4px); }
        75% { transform: translateX(4px); }
      }
      .bmv-codex-drawer {
        position: absolute;
        top: 0; right: 0; bottom: 0;
        width: 480px;
        box-sizing: border-box;
        padding: 24px;
        background: #131722;
        border-left: 2px solid #2A3346;
        transform: translateX(100%);
        transition: transform 0.2s ease-out;
        overflow-y: auto;
      }
      .bmv-codex-drawer.open { transform: translateX(0); }
      .bmv-codex-drawer-head {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 16px;
      }
      .bmv-codex-drawer-title { font-size: 24px; font-weight: 700; color: #F2F5F9; }
      .bmv-codex-detail-row { margin-bottom: 12px; }
      .bmv-codex-detail-label { font-size: 13px; color: #54E6C9; margin-bottom: 2px; font-weight: 700; }
      .bmv-codex-detail-value { font-size: 15px; color: #F2F5F9; line-height: 1.55; white-space: pre-wrap; }
      /* 移动端（spec §8）：4 列 96×96、底部抽屉 60% 高、页签横向滚动、热区 ≥44、字号 ≥16px 物理 */
      @media (max-width: 900px) {
        .bmv-codex-panel { inset: 12px; padding: 16px; }
        .bmv-codex-title { font-size: 24px; }
        .bmv-codex-tabs { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 4px; }
        .bmv-codex-grid { grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .bmv-codex-card { min-height: 96px; }
        .bmv-codex-card-glyph, .bmv-codex-card-glyph svg { width: 48px; height: 48px; }
        .bmv-codex-card-name { font-size: 13px; }
        .bmv-codex-card-condition { font-size: 10px; }
        .bmv-codex-footer { font-size: 16px; }
        .bmv-codex-drawer {
          left: 0; right: 0; bottom: 0; top: auto;
          width: 100%; height: 60%;
          border-left: none; border-top: 2px solid #2A3346;
          transform: translateY(100%);
          padding: 16px;
        }
        .bmv-codex-drawer.open { transform: translateY(0); }
        .bmv-codex-detail-value { font-size: 14px; }
      }
    `;
    host.appendChild(style);
  }
}

// —— 详情字段（spec §5；来源 narratives-spec 档案 + balance 配置）——

export function detailFor(entry: CodexEntry): { label: string; value: string }[] {
  switch (entry.category) {
    case 'hero': {
      const id = entry.entryId.replace('codex_hero_', '') as HeroId;
      const arch = HERO_ARCHIVES.find((h) => h.key === id);
      if (!arch) return [];
      return [
        { label: '名讳', value: `${arch.name}（${arch.enName}）` },
        { label: '阵营', value: arch.faction },
        { label: '力量', value: NP[arch.powerTag] },
        { label: '身份', value: arch.identity },
        { label: '背景', value: arch.background },
        { label: '主动技', value: `${arch.activeSkill.name} —— ${arch.activeSkill.desc}` },
        { label: '初始武器', value: `${arch.initialWeapon.name} —— ${arch.initialWeapon.desc}` },
        { label: '台词', value: `入场「${arch.lines.enter}」／濒死「${arch.lines.dying}」／死亡「${arch.lines.death}」` },
        { label: '解锁条件', value: arch.unlock },
      ];
    }
    case 'boss': {
      const id = entry.entryId.replace('codex_boss_', '') as BossId;
      const arch = BOSS_ARCHIVES.find((b) => b.key === id);
      if (!arch) return [];
      return [
        { label: '名讳', value: arch.name },
        { label: '阵营', value: arch.faction },
        { label: '力量', value: NP[arch.powerTag] },
        { label: '身份', value: arch.identity },
        { label: '背景', value: arch.background },
        { label: '登场台词', value: arch.enterLine },
        { label: '击败台词', value: arch.defeatLine },
        { label: '所属地图', value: arch.map },
        { label: '掉落', value: arch.drop },
      ];
    }
    case 'event': {
      const arch = EVENT_ARCHIVES.find((e) => e.key === entry.entryId);
      if (!arch) return [];
      return [
        { label: '档案', value: arch.text },
        { label: '解锁', value: arch.unlock },
      ];
    }
    case 'enemy': {
      const id = entry.entryId.replace('codex_enemy_', '') as EnemyId;
      const cfg = ENEMY_CONFIGS[id];
      if (!cfg) return [];
      return [
        { label: '名称', value: cfg.name },
        { label: '阵营', value: NP[cfg.powerTag] },
        { label: '层级', value: cfg.tier },
        { label: '面板', value: `HP ${cfg.hp} · 移速 ${cfg.speed} · 伤 ${cfg.damage} · XP ${cfg.xp}` },
        { label: '特殊行为', value: cfg.special ?? '—' },
        { label: '反制', value: cfg.counter ?? '—' },
      ];
    }
    case 'weapon': {
      const id = entry.entryId.replace('codex_wpn_', '') as WeaponId;
      const cfg = WEAPON_CONFIGS[id];
      if (!cfg) return [];
      return [
        { label: '名称', value: cfg.name },
        { label: '类', value: cfg.class },
        { label: '力量', value: NP[cfg.powerTag] },
        { label: '基础 DPS', value: String(cfg.baseDps) },
        { label: '手感', value: cfg.feel },
        { label: '超武合成', value: evolutionForWeapon(id) ?? '—' },
      ];
    }
    case 'evo': {
      const evo = EVOLUTIONS.find((e) => e.evoId === (entry.entryId.replace('codex_evo_', '') as EvoId));
      if (!evo) return [];
      return [
        { label: '名称', value: evo.name },
        { label: '合成', value: `${WEAPON_CONFIGS[evo.wpnId]?.name ?? evo.wpnId} + ${evo.keyId}` },
        { label: '等效 DPS', value: String(evo.baseDps) },
        { label: '行为质变', value: evo.effect },
      ];
    }
    default:
      return [];
  }
}

function evolutionForWeapon(wid: WeaponId): string | null {
  const evo = EVOLUTIONS.find((e) => e.wpnId === wid);
  return evo ? `${evo.name}（${evo.evoId}）` : null;
}

/** 便捷工厂：挂到默认 #ui-overlay（BootScene 主菜单使用） */
export function createCodexOverlay(opts: CodexOverlayOptions): CodexOverlay {
  return new CodexOverlay(getOverlayHost(), opts);
}
