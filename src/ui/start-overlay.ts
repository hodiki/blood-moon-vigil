/**
 * ui/start-overlay.ts —— 启动页「点击开始」+ 角色选择 + 地图选择（ux-spec §1 / audio-bible §4 / E4-S1/S9 / M3 功能行）
 *
 * Web 音频策略硬前提：AudioContext 需用户手势解锁。本层是唯一解锁点——
 * 点击回调内调 AudioManager.unlock()，随后进入 PlayScene（ux-spec §1 屏幕流）。
 * E4-S1 角色选择（QA-FIX-2 补齐遗漏 UI）：四角色卡（守夜人/血猎手/夜祷修女/狼裔）。
 * QA-FIX-3 追加①：0.2.x 当前阵容全开放——canSelectHero/canSelectMap 对四角色三图一律 true，
 * 锁定渲染分支（灰剪影/🔒/「通关地图 N 解锁」）随之休眠不再出现；门禁渲染机制保留给
 * 未来新增内容（unlock 记录照常传入）。选中 2px 冷青描边（art-bible §2 选中态规范，
 * 与地图卡同款）；点击走 selectHeroSafely（非法 id 防御回退默认）。
 * E4-S9 地图选择最小实现：三图卡（墓地默认 / 教堂 / 狼穴），全开放；
 * 选中即 setSelectedMap（session-selection），PlayScene 开局消费。
 * M3 功能行（codex-ui-spec §1 / merit-ui-spec §1）：地图行与开始按钮之间插入
 * `[守夜日志] [守夜功绩]` 两个入口（z-index 75 覆盖层，盖本层 70 之上；返回回主菜单不进入战斗）。
 * ADR-004：DOM 覆盖层；色板抄 art-bible（底 #131722、文字 #F2F5F9、冷青 #54E6C9）。
 * 按钮热区 240×56 ≥ 44px（ux-spec §3 触控热区硬标准；地图卡/角色卡 ≥ 44×44）。
 */

import { getOverlayHost } from '@/ui/overlay-host';
import { MAP_CONFIGS, HEROES, PALETTE, type MapId, type HeroId } from '@/config/balance';
import {
  getSelectedMap,
  setSelectedMap,
  canSelectMap,
  getSelectedHero,
  selectHeroSafely,
  canSelectHero,
} from '@/config/session-selection';
import { saveKey, type SaveData } from '@/stats/save';
import { detectIsMobile } from '@/utils/device';
import { CodexOverlay, createCodexOverlay } from '@/ui/codex-overlay';
import { TreeOverlay, createTreeOverlay } from '@/ui/tree-overlay';
import { NP } from '@/narratives/narratives';

export interface StartOverlay {
  destroy(): void;
}

export interface StartOverlayOptions {
  /** 解锁状态（save.ts；地图卡/角色卡门禁） */
  unlock: { clearedGraveyard: boolean; clearedCathedral: boolean; clearedDen: boolean };
  /** 局外存档（M3 图鉴/功绩入口数据源；缺省时功能行禁用不渲染） */
  save?: SaveData;
}

/** 角色卡展示顺序（HEROES 配置序 = HEROES keyof 固定序，gdd-codex §3.5） */
export const HERO_CARD_ORDER: HeroId[] = ['hero_edmund', 'hero_cassandra', 'hero_violet', 'hero_galvan'];

/** 角色卡逻辑态（纯数据，可脱离 DOM 单测：QA-FIX-2 A-2） */
export interface HeroCardState {
  id: HeroId;
  /** 配置名（HEROES[id].name） */
  name: string;
  /** powerTag 标识（五 tag 中文拼写表 NP + 色板内 token 色） */
  powerTagLabel: string;
  powerTagColor: string;
  locked: boolean;
  /** 锁定文案：按 canSelectHero 门禁匹配「通关地图 N 解锁」；未锁定为配置副标题位（主动技能名） */
  desc: string;
}

/** powerTag 标签色（全部取自 balance.ts PALETTE token，禁止散落字面量——icons.ts 同规） */
const POWER_TAG_COLORS: Record<string, string> = {
  HALLOWED: PALETTE.playerAccent, // 圣辉 → 冷青
  SILVER: PALETTE.player, // 银器 → 月银白
  BEAST: PALETTE.beastGrey, // 兽血 → 暗灰棕
  BLOOD: PALETTE.enemyZombie, // 血术 → 暗红
  MOON: PALETTE.enemyBoss, // 月光 → 猩红
};

/** 角色卡锁定门禁提示（canSelectHero 对应解锁条件；gdd-codex §3.5） */
function heroUnlockHint(hero: HeroId): string {
  switch (hero) {
    case 'hero_cassandra':
      return '通关地图 1 解锁';
    case 'hero_violet':
      return '通关地图 2 解锁';
    case 'hero_galvan':
      return '通关地图 3 解锁';
    default:
      return '';
  }
}

/** 构建四角色卡逻辑态（locked 按 canSelectHero 判定；纯函数供单测与 DOM 渲染共用） */
export function buildHeroCardStates(unlock: StartOverlayOptions['unlock']): HeroCardState[] {
  return HERO_CARD_ORDER.map((id) => {
    const cfg = HEROES[id];
    const locked = !canSelectHero(id, unlock);
    return {
      id,
      name: cfg.name,
      powerTagLabel: NP[cfg.powerTag],
      powerTagColor: POWER_TAG_COLORS[cfg.powerTag] ?? PALETTE.uiPaper,
      locked,
      desc: locked ? heroUnlockHint(id) : cfg.activeSkillName,
    };
  });
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
      <div class="bmv-hero-row"></div>
      <div class="bmv-map-row"></div>
      <div class="bmv-feature-row">
        <button class="bmv-feature-btn" data-feature="codex" type="button">守夜日志</button>
        <button class="bmv-feature-btn" data-feature="merit" type="button">滤月余辉</button>
      </div>
      <button class="bmv-start-btn" type="button">点击开始</button>
    </div>
  `;
  host.appendChild(root);

  // M3 图鉴/功绩入口：从当前存档打开覆盖层（返回回主菜单；本层保持可见被盖在下方）
  // QA-BUG-2 ①③：面板打开期间 .bmv-start-mask 让位（pointer-events:none，关闭恢复），
  // 关闭后焦点还给「点击开始」；两面板互斥打开（蒙层归属管理保持简单）
  let codexOverlay: CodexOverlay | null = null;
  let treeOverlay: TreeOverlay | null = null;
  const startMask = root.querySelector('.bmv-start-mask') as HTMLElement;
  const holdStartUiForPanel = (): void => {
    startMask.style.pointerEvents = 'none';
  };
  const releaseStartUiFromPanel = (): void => {
    startMask.style.pointerEvents = '';
    btn.focus(); // QA-BUG-2 ③：焦点归还「点击开始」，Tab 不再盲开局
  };
  const openCodex = (): void => {
    if (!opts.save || codexOverlay || treeOverlay) return;
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
  // B6-W1：滤月余辉树界面（merit-overlay 退役，gdd-talent-tree A-1；写入 save + onStateChange 持久化）
  const openTree = (): void => {
    if (!opts.save || treeOverlay || codexOverlay) return;
    holdStartUiForPanel();
    const save = opts.save;
    treeOverlay = createTreeOverlay(getOverlayHost(), {
      points: save.meritPoints,
      purchases: save.treeState.purchases,
      pureInGame: save.pureInGame,
      isMobile: detectIsMobile(),
      onStateChange: (purchases, pointsSpent, pointsRemaining) => {
        save.treeState = { unlockedNodeIds: Object.keys(purchases), purchases, pointsSpent };
        save.meritPoints = pointsRemaining + pointsSpent; // 余额 = 总累计 − 已投入；总累计不变口径
        // 主菜单层无 storage 注入 → 直接 localStorage（Boot/PlayScene 同键 v3）
        const platform = detectIsMobile() ? 'mobile' : 'desktop';
        window.localStorage.setItem(saveKey(platform), JSON.stringify(save));
      },
      onClose: () => {
        treeOverlay = null;
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

  // QA-FIX-2 A：角色选择行（E4-S1 遗漏 UI 补齐）。四角色卡逻辑态由 buildHeroCardStates
  // （canSelectHero 门禁）生成；点击走 selectHeroSafely——锁定卡点击回退默认并保持锁定观感；
  // 已选中态 = 2px 冷青描边（.selected，与地图卡同款 art-bible §2 规范）
  const heroRow = root.querySelector('.bmv-hero-row') as HTMLElement;
  const heroStates = buildHeroCardStates(opts.unlock);
  const heroCards: HTMLElement[] = [];
  const heroHandlers: Array<{ el: HTMLElement; onClick: () => void }> = [];
  for (const state of heroStates) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'bmv-hero-card';
    card.setAttribute('aria-label', `选择角色：${state.name}`);
    card.dataset.hero = state.id;
    card.dataset.locked = String(state.locked);
    card.innerHTML = `
      <div class="bmv-hero-name"><span class="bmv-hero-tag" style="color:${state.powerTagColor}">${state.powerTagLabel}</span>${state.locked ? '🔒 ' : ''}${state.name}</div>
      <div class="bmv-hero-desc">${state.desc}</div>
    `;
    const el = card;
    const onClick = () => {
      // selectHeroSafely：非法（未解锁）选择回退默认守夜人——锁定卡自身不进入选中态观感
      const target = selectHeroSafely(state.id, opts.unlock);
      for (const c of heroCards) c.classList.remove('selected');
      const targetCard = heroCards.find((c) => c.dataset.hero === target);
      if (targetCard) targetCard.classList.add('selected');
    };
    el.addEventListener('click', onClick);
    heroHandlers.push({ el, onClick });
    heroRow.appendChild(el);
    heroCards.push(el);
  }
  // 初始高亮当前选中角色（默认守夜人；session-selection 模块级状态，restart 语义不变）
  const curHeroCard = heroCards.find((c) => c.dataset.hero === getSelectedHero());
  if (curHeroCard) curHeroCard.classList.add('selected');

  // M3 功能行：守夜日志 / 守夜功绩（codex-ui-spec §1 / merit-ui-spec §1；save 缺省时禁用隐藏）
  const featureRow = root.querySelector('.bmv-feature-row') as HTMLElement;
  if (!opts.save) featureRow.style.display = 'none';
  const codexBtn = root.querySelector('[data-feature="codex"]') as HTMLElement;
  const meritBtn = root.querySelector('[data-feature="merit"]') as HTMLElement;
  const featureHandlers: Array<{ el: HTMLElement; onClick: () => void }> = [];
  if (opts.save) {
    const codexOnClick = (): void => openCodex();
    const meritOnClick = (): void => openTree();
    codexBtn.addEventListener('click', codexOnClick);
    meritBtn.addEventListener('click', meritOnClick);
    featureHandlers.push({ el: codexBtn, onClick: codexOnClick }, { el: meritBtn, onClick: meritOnClick });
  }

  const btn = root.querySelector('.bmv-start-btn') as HTMLButtonElement;
  btn.addEventListener('click', onStart);

  return {
    destroy(): void {
      codexOverlay?.destroy();
      treeOverlay = null;
      btn.removeEventListener('click', onStart);
      for (const h of featureHandlers) h.el.removeEventListener('click', h.onClick);
      for (const h of heroHandlers) h.el.removeEventListener('click', h.onClick);
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
    .bmv-hero-row {
      display: flex; gap: 12px;
      margin-bottom: 16px;
    }
    .bmv-hero-card {
      width: 148px; height: 64px;
      box-sizing: border-box;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: #131722;
      border: 2px solid #2A3346; border-radius: 8px;
      color: #F2F5F9;
      cursor: pointer;
      user-select: none; -webkit-user-select: none;
      transition: transform 0.1s ease-out, border-color 0.1s ease-out, box-shadow 0.1s ease-out;
    }
    /* 已选中态：2px 冷青描边 + 外圈 shadow（art-bible §2 选中态规范；地图卡同款） */
    .bmv-hero-card.selected {
      border-color: #54E6C9;
      box-shadow: 0 0 0 2px #54E6C9;
    }
    /* 锁定态：剪影灰（降饱和半透明，与地图卡锁定观感一致） */
    .bmv-hero-card[data-locked="true"] {
      opacity: 0.55;
      cursor: not-allowed;
      filter: saturate(0.3);
    }
    .bmv-hero-name {
      font-size: 15px; font-weight: 700;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      max-width: 100%; padding: 0 6px; box-sizing: border-box;
      text-shadow: 0 1px 3px rgba(11,14,20,0.95);
    }
    /* powerTag 标识 token（色值由 JS 注入 PALETTE 派生 token；描边不散落字面量） */
    .bmv-hero-tag {
      display: inline-block;
      font-size: 10px; font-weight: 700;
      letter-spacing: 1px;
      margin-right: 6px;
      padding: 1px 5px;
      border: 1px solid currentColor;
      border-radius: 4px;
      transform: translateY(-1px);
      vertical-align: middle;
    }
    .bmv-hero-desc {
      font-size: 11px; color: #A9B4C4;
      margin-top: 4px;
      max-width: 100%; padding: 0 6px; box-sizing: border-box;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
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
    /* 移动端：面板随视口收缩，按钮保持全宽热区 ≥44px（ux-spec §3）；角色卡 4 列 / 地图卡 3 列收缩 */
    @media (max-width: 900px) {
      .bmv-start-panel { padding: 28px 20px; max-width: calc(100vw - 32px); box-sizing: border-box; }
      .bmv-start-title { font-size: 30px; }
      .bmv-start-btn { width: 100%; height: 56px; min-width: 200px; }
      .bmv-hero-row { gap: 8px; width: 100%; }
      .bmv-hero-card { width: 0; flex: 1 1 0; height: 56px; min-width: 0; }
      .bmv-hero-name { font-size: 12px; padding: 0 4px; }
      .bmv-hero-tag { font-size: 9px; margin-right: 3px; padding: 0 3px; letter-spacing: 0.5px; }
      .bmv-hero-desc { font-size: 10px; padding: 0 4px; }
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
