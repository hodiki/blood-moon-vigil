/**
 * ui/start-overlay.ts —— 启动页「点击开始」+ 地图选择（ux-spec §1 / audio-bible §4 / E4-S9 / M3 功能行）
 *
 * Web 音频策略硬前提：AudioContext 需用户手势解锁。本层是唯一解锁点——
 * 点击回调内调 AudioManager.unlock()，随后进入 PlayScene（ux-spec §1 屏幕流）。
 * E4-S9 地图选择最小实现：三图卡（墓地默认 / 教堂 / 狼穴），未解锁显示 🔒 + 解锁条件；
 * 选中即 setSelectedMap（session-selection），PlayScene 开局消费。
 * M3 功能行（codex-ui-spec §1 / merit-ui-spec §1）：地图行与开始按钮之间插入
 * `[守夜日志] [守夜功绩]` 两个入口（z-index 75 覆盖层，盖本层 70 之上；返回回主菜单不进入战斗）。
 * ADR-004：DOM 覆盖层；色板抄 art-bible（底 #131722、文字 #F2F5F9、冷青 #54E6C9）。
 * 按钮热区 240×56 ≥ 44px（ux-spec §3 触控热区硬标准；地图卡 ≥ 44×44）。
 */

import { getOverlayHost } from '@/ui/overlay-host';
import { MAP_CONFIGS, type MapId } from '@/config/balance';
import { getSelectedMap, setSelectedMap, canSelectMap } from '@/config/session-selection';
import type { SaveData } from '@/stats/save';
import { detectIsMobile } from '@/utils/device';
import { CodexOverlay, createCodexOverlay } from '@/ui/codex-overlay';
import { MeritOverlay, createMeritOverlay } from '@/ui/merit-overlay';

export interface StartOverlay {
  destroy(): void;
}

export interface StartOverlayOptions {
  /** 解锁状态（save.ts；地图卡门禁） */
  unlock: { clearedGraveyard: boolean; clearedCathedral: boolean; clearedDen: boolean };
  /** 局外存档（M3 图鉴/功绩入口数据源；缺省时功能行禁用不渲染） */
  save?: SaveData;
}

export function createStartOverlay(
  onStart: () => void,
  opts: StartOverlayOptions = {
    unlock: { clearedGraveyard: false, clearedCathedral: false, clearedDen: false },
  },
): StartOverlay {
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
      <div class="bmv-map-row"></div>
      <div class="bmv-feature-row">
        <button class="bmv-feature-btn" data-feature="codex" type="button">守夜日志</button>
        <button class="bmv-feature-btn" data-feature="merit" type="button">守夜功绩</button>
      </div>
      <button class="bmv-start-btn" type="button">点击开始</button>
    </div>
  `;
  host.appendChild(root);

  // M3 图鉴/功绩入口：从当前存档打开覆盖层（返回回主菜单；本层保持可见被盖在下方）
  // QA-BUG-2 ①③：面板打开期间 .bmv-start-mask 让位（pointer-events:none，关闭恢复），
  // 关闭后焦点还给「点击开始」；两面板互斥打开（蒙层归属管理保持简单）
  let codexOverlay: CodexOverlay | null = null;
  let meritOverlay: MeritOverlay | null = null;
  const startMask = root.querySelector('.bmv-start-mask') as HTMLElement;
  const holdStartUiForPanel = (): void => {
    startMask.style.pointerEvents = 'none';
  };
  const releaseStartUiFromPanel = (): void => {
    startMask.style.pointerEvents = '';
    btn.focus(); // QA-BUG-2 ③：焦点归还「点击开始」，Tab 不再盲开局
  };
  const openCodex = (): void => {
    if (!opts.save || codexOverlay || meritOverlay) return;
    holdStartUiForPanel();
    codexOverlay = createCodexOverlay({
      save: opts.save,
      isMobile: detectIsMobile(),
      onClose: () => {
        codexOverlay = null;
        releaseStartUiFromPanel();
      },
    });
  };
  const openMerit = (): void => {
    if (!opts.save || meritOverlay || codexOverlay) return;
    holdStartUiForPanel();
    meritOverlay = createMeritOverlay({
      save: opts.save,
      isMobile: detectIsMobile(),
      onClose: () => {
        meritOverlay = null;
        releaseStartUiFromPanel();
      },
    });
  };

  const mapRow = root.querySelector('.bmv-map-row') as HTMLElement;
  const mapOrder: MapId[] = ['map_graveyard', 'map_cathedral', 'map_den'];
  const mapCards: HTMLElement[] = [];
  const handlers: Array<{ onClick: () => void }> = [];

  for (const mapId of mapOrder) {
    const cfg = MAP_CONFIGS[mapId];
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'bmv-map-card';
    card.setAttribute('aria-label', `选择地图：${cfg.name}`);
    const locked = !canSelectMap(mapId, opts.unlock);
    card.dataset.map = mapId;
    card.dataset.locked = String(locked);
    const thumb =
      mapId === 'map_graveyard' ? 'tile-grave-soil'
        : mapId === 'map_cathedral' ? 'tile-church-stone'
          : 'tile-den-earth';
    card.style.backgroundImage = `linear-gradient(rgba(11,14,20,0.45), rgba(11,14,20,0.72)), url(./frames/${thumb}.png)`;
    card.style.backgroundSize = 'cover';
    card.innerHTML = `
      <div class="bmv-map-name">${locked ? '🔒 ' : ''}${cfg.name}</div>
      <div class="bmv-map-desc">${locked ? unlockHint(mapId) : `${cfg.width}×${cfg.height} · Boss: ${cfg.boss}`}</div>
    `;
    const onClick = () => {
      if (locked) return; // 未解锁不可选（提示见 desc）
      setSelectedMap(mapId);
      for (const c of mapCards) c.classList.remove('selected');
      card.classList.add('selected');
    };
    card.addEventListener('click', onClick);
    handlers.push({ onClick });
    mapRow.appendChild(card);
    mapCards.push(card);
  }

  // 初始高亮当前选中（默认墓地）
  const selected = getSelectedMap();
  const selCard = mapCards.find((c) => c.dataset.map === selected);
  if (selCard) selCard.classList.add('selected');

  // M3 功能行：守夜日志 / 守夜功绩（codex-ui-spec §1 / merit-ui-spec §1；save 缺省时禁用隐藏）
  const featureRow = root.querySelector('.bmv-feature-row') as HTMLElement;
  if (!opts.save) featureRow.style.display = 'none';
  const codexBtn = root.querySelector('[data-feature="codex"]') as HTMLElement;
  const meritBtn = root.querySelector('[data-feature="merit"]') as HTMLElement;
  const featureHandlers: Array<{ el: HTMLElement; onClick: () => void }> = [];
  if (opts.save) {
    const codexOnClick = (): void => openCodex();
    const meritOnClick = (): void => openMerit();
    codexBtn.addEventListener('click', codexOnClick);
    meritBtn.addEventListener('click', meritOnClick);
    featureHandlers.push({ el: codexBtn, onClick: codexOnClick }, { el: meritBtn, onClick: meritOnClick });
  }

  const btn = root.querySelector('.bmv-start-btn') as HTMLButtonElement;
  btn.addEventListener('click', onStart);

  return {
    destroy(): void {
      codexOverlay?.destroy();
      meritOverlay?.destroy();
      btn.removeEventListener('click', onStart);
      for (const h of featureHandlers) h.el.removeEventListener('click', h.onClick);
      for (let i = 0; i < handlers.length; i += 1) {
        const card = mapCards[i];
        if (card) card.removeEventListener('click', handlers[i]!.onClick);
      }
      root.remove();
    },
  };
}

/** 未解锁地图提示（gdd-codex §3.5 解锁流） */
function unlockHint(mapId: MapId): string {
  switch (mapId) {
    case 'map_cathedral':
      return '通关「月下墓地」解锁';
    case 'map_den':
      return '通关「血教堂」解锁';
    default:
      return '';
  }
}

/** 便捷：从 SaveData 构造解锁状态（BootScene 消费） */
export function unlockFromSave(data: SaveData): { clearedGraveyard: boolean; clearedCathedral: boolean; clearedDen: boolean } {
  return {
    clearedGraveyard: data.clearedMaps.includes('map_graveyard'),
    clearedCathedral: data.clearedMaps.includes('map_cathedral'),
    clearedDen: data.clearedMaps.includes('map_den'),
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
      margin-top: 8px; margin-bottom: 20px;
      letter-spacing: 2px;
    }
    .bmv-map-row {
      display: flex; gap: 12px;
      margin-bottom: 24px;
    }
    .bmv-feature-row {
      display: flex; gap: 12px;
      margin-bottom: 24px;
    }
    .bmv-feature-btn {
      width: 200px; height: 44px;
      box-sizing: border-box;
      font-size: 16px; font-weight: 700;
      color: #F2F5F9;
      background: #131722;
      border: 2px solid #2A3346; border-radius: 8px;
      cursor: pointer;
      transition: transform 0.1s ease-out, border-color 0.1s ease-out, box-shadow 0.1s ease-out;
    }
    .bmv-feature-btn:hover {
      border-color: #54E6C9;
      box-shadow: 0 0 0 2px #54E6C9;
      transform: scale(1.02);
    }
    .bmv-map-card {
      width: 140px; height: 64px;
      box-sizing: border-box;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: #131722;
      border: 2px solid #2A3346; border-radius: 8px;
      color: #F2F5F9;
      cursor: pointer;
      user-select: none; -webkit-user-select: none;
      transition: transform 0.1s ease-out, border-color 0.1s ease-out;
    }
    .bmv-map-card.selected {
      border-color: #54E6C9;
      box-shadow: 0 0 0 2px #54E6C9;
    }
    .bmv-map-card[data-locked="true"] {
      opacity: 0.55;
      cursor: not-allowed;
      filter: saturate(0.3);
    }
    .bmv-map-name {
      font-size: 16px; font-weight: 700;
      text-shadow: 0 1px 3px rgba(11,14,20,0.95);
    }
    .bmv-map-desc {
      font-size: 11px; color: #A9B4C4;
      margin-top: 4px;
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
    /* 移动端：面板随视口收缩，按钮保持全宽热区 ≥44px（ux-spec §3）；地图卡 3 列收缩 */
    @media (max-width: 900px) {
      .bmv-start-panel { padding: 28px 20px; max-width: calc(100vw - 32px); box-sizing: border-box; }
      .bmv-start-title { font-size: 30px; }
      .bmv-start-btn { width: 100%; height: 56px; min-width: 200px; }
      .bmv-map-row { gap: 8px; width: 100%; }
      .bmv-map-card { width: 0; flex: 1 1 0; height: 56px; min-width: 0; }
      .bmv-map-name { font-size: 13px; }
      .bmv-map-desc { font-size: 10px; }
      .bmv-feature-row { gap: 8px; width: 100%; }
      .bmv-feature-btn { width: 0; flex: 1 1 0; height: 48px; min-width: 0; }
    }
  `;
  host.appendChild(style);
}
