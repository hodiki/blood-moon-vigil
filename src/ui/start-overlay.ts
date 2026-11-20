/**
 * ui/start-overlay.ts —— 入口三屏：首页 → 选人 → 选图（ui-redesign-handoff v1.3 §1.4）
 *
 * Web 音频策略硬前提：AudioContext 需用户手势解锁。最终 CTA「走进夜色」是唯一解锁点——
 * 点击回调内调 AudioManager.unlock()，随后进入 PlayScene（ux-spec §1 屏幕流）。
 * 角色选择：全屏预选插画底（本批暗场占位）+ 底部 128 芯片；点芯片只预选，确认键才锁定。
 * 地图选择：三图卡（墓地默认 / 教堂 / 狼穴）；文案走叙事名，禁内部 id / 像素尺寸。
 * 功能行 `[守夜日志] [滤月余辉]` 留在首页（z-index 75 覆盖层）。
 * ADR-004：DOM 覆盖层；色板抄 art-bible（底 #0B0E14、文字 #F2F5F9、余辉金 #FFC93C）。
 */

import { getOverlayHost } from '@/ui/overlay-host';
import { preferFrameImg } from '@/ui/frame-img';
import { MAP_CONFIGS, HEROES, PALETTE, type MapId, type HeroId } from '@/config/balance';
import {
  getSelectedMap,
  setSelectedMap,
  canSelectMap,
  getSelectedHero,
  selectHeroSafely,
  canSelectHero,
  DEFAULT_HERO,
} from '@/config/session-selection';
import { saveKey, type SaveData } from '@/stats/save';
import { detectIsMobile } from '@/utils/device';
import { CodexOverlay, createCodexOverlay } from '@/ui/codex-overlay';
import { TreeOverlay, createTreeOverlay, unlockedCommonWeaponIds, preselectDisabledWeaponIds } from '@/ui/tree-overlay';
import { KeybindsOverlay, loadKeybindsShown } from '@/ui/keybinds-overlay';
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

export type StartStep = 'title' | 'hero' | 'map';

export const START_STEP_ORDER: readonly StartStep[] = ['title', 'hero', 'map'];

export function nextStartStep(step: StartStep): StartStep {
  if (step === 'title') return 'hero';
  return 'map';
}

export function prevStartStep(step: StartStep): StartStep {
  if (step === 'map') return 'hero';
  return 'title';
}

const MENU_BG: Record<StartStep, string> = {
  title: './ui-menu/ui-menu-bg.png',
  hero: './ui-menu/ui-sel-bg.png',
  map: './ui-menu/ui-map-bg.png',
};

/** 角色卡展示顺序（HEROES 配置序 = HEROES keyof 固定序，gdd-codex §3.5） */
export const HERO_CARD_ORDER: HeroId[] = ['hero_edmund', 'hero_cassandra', 'hero_violet', 'hero_galvan'];

export const HERO_PORTRAIT_FRAMES: Record<HeroId, string> = {
  hero_edmund: 'player',
  hero_cassandra: 'hero-cassandra',
  hero_violet: 'hero-violet',
  hero_galvan: 'hero-galvan',
};

/** 选人芯片沿用正式战斗待机帧（不另切图）。 */
export const HERO_CHIP_FRAMES: Record<HeroId, string> = HERO_PORTRAIT_FRAMES;

/** 战斗待机帧原生边长（px）。艾德蒙 64；卡珊德拉/薇奥莱 128；加尔文已换 160 画布。 */
export const HERO_CHIP_NATIVE_PX: Record<HeroId, number> = {
  hero_edmund: 64,
  hero_cassandra: 128,
  hero_violet: 128,
  hero_galvan: 160,
};

/** 选人芯片槽边长（px）。64 帧按 2× 整数放大到 128。 */
export const HERO_CHIP_DISPLAY_PX = 128;

export const DEFAULT_HERO_PRESELECT: HeroId = DEFAULT_HERO;

/** 落入 128 槽的最大整数倍；加尔文 160 无法整倍落入，展示时 1× contain。 */
export function heroChipIntegerScale(hero: HeroId): number {
  const native = HERO_CHIP_NATIVE_PX[hero];
  return Math.max(1, Math.floor(HERO_CHIP_DISPLAY_PX / native));
}

/** 锁定角色可预览，但不能确认开局。 */
export function canConfirmHeroPreselect(state: Pick<HeroCardState, 'locked'>): boolean {
  return !state.locked;
}

/** 正式 1920 选人插画约定路径（本批只留槽，不上图）。 */
export function heroSelectPlateSrc(id: HeroId): string {
  return `./ui-menu/hero-select-${id}.png`;
}

export const MAP_CARD_ORDER: MapId[] = ['map_graveyard', 'map_cathedral', 'map_den'];

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
  portraitFrame: string;
}

export interface MapCardState {
  id: MapId;
  name: string;
  node: string;
  threat: string;
  blurb: string;
  locked: boolean;
  unlockHint: string;
}

const MAP_FLAVOR: Record<MapId, { node: string; threat: string; blurb: string }> = {
  map_graveyard: { node: '封王石冢', threat: NP.BOSS_1, blurb: '乱葬岗。血月第一缕光最先照到的地方。' },
  map_cathedral: { node: '地下血井', threat: NP.BOSS_2, blurb: '彩窗映着血月，圣水早已干涸成锈。' },
  map_den: { node: '山脊祭坛', threat: NP.BOSS_3, blurb: '岩壁上的爪痕，是狼群的血月契约。' },
};

const MAP_THUMBS: Record<MapId, string> = {
  map_graveyard: 'tile-grave-soil',
  map_cathedral: 'tile-church-stone',
  map_den: 'tile-den-earth',
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

/** powerTag 标签色（全部取自 balance.ts PALETTE token，禁止散落字面量——icons.ts 同规） */
const POWER_TAG_COLORS: Record<string, string> = {
  HALLOWED: PALETTE.amber, // 圣辉 → 余辉金（灯下哥特；入口不再用冷青）
  SILVER: PALETTE.player, // 银器 → 月银白
  BEAST: PALETTE.beastGrey, // 兽血 → 暗灰棕
  BLOOD: PALETTE.enemyZombie, // 血术 → 暗红
  MOON: PALETTE.enemyBoss, // 月光 → 猩红
};

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
      portraitFrame: HERO_PORTRAIT_FRAMES[id],
    };
  });
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

export function buildMapCardStates(unlock: StartOverlayOptions['unlock']): MapCardState[] {
  return MAP_CARD_ORDER.map((id) => {
    const cfg = MAP_CONFIGS[id];
    const flavor = MAP_FLAVOR[id];
    const locked = !canSelectMap(id, unlock);
    return {
      id,
      name: cfg.name,
      node: flavor.node,
      threat: flavor.threat,
      blurb: flavor.blurb,
      locked,
      unlockHint: locked ? unlockHint(id) : '',
    };
  });
}

/**
 * NV-INTEG-FIX P2：codexPrerequisite 语义键 → 真实图鉴状态解析
 * （talent-tree codexPrerequisite 4 值：血月化身 / 四角色 / 条目数 25 / 40；
 *  entryId 规则 = codex.ts `codex_hero_${id}` / `codex_event_6`，save.codexUnlocked 单一数据源）
 */
function resolveCodexPrerequisite(
  prereq: NonNullable<import('@/config/balance/talent-tree').TalentNodeConfig['codexPrerequisite']>,
  save: SaveData,
): boolean {
  switch (prereq) {
    case 'codex_moon_avatar':
      return save.codexUnlocked.includes('codex_event_6');
    case 'codex_heroes_all':
      return ['edmund', 'cassandra', 'violet', 'galvan'].every((h) =>
        save.codexUnlocked.includes(`codex_hero_${h}`),
      );
    case 'codex_entries_25':
      return save.codexUnlocked.length >= 25;
    case 'codex_entries_40':
      return save.codexUnlocked.length >= 40;
    default:
      return false;
  }
}

export function createStartOverlay(
  onStart: () => void,
  opts: StartOverlayOptions = {
    unlock: { clearedGraveyard: false, clearedCathedral: false, clearedDen: false },
  },
): StartOverlay {
  const host = getOverlayHost();
  ensureStyles(host);
  const isMobile = detectIsMobile();

  const lamps = Array.from({ length: 12 }, (_, i) => `<span class="bmv-lamp" style="--i:${i}"></span>`).join('');
  const root = document.createElement('div');
  root.className = isMobile ? 'bmv-start is-mobile' : 'bmv-start';
  root.setAttribute('aria-label', '血月守夜');
  root.dataset.step = 'title';
  root.innerHTML = `
    <div class="bmv-start-sky" aria-hidden="true"></div>
    <img class="bmv-start-bg" alt="" draggable="false" />
    <div class="bmv-start-vignette" aria-hidden="true"></div>
    <div class="bmv-start-mask"></div>
    <section class="bmv-start-stage is-active" data-stage="title">
      <div class="bmv-start-brand">
        <div class="bmv-start-title">血月守夜</div>
        <div class="bmv-start-sub">Blood Moon Vigil</div>
        <div class="bmv-start-tagline">举灯持银，撑过这一夜</div>
      </div>
      <div class="bmv-lamps" aria-hidden="true">${lamps}</div>
      <div class="bmv-start-actions">
        <button class="bmv-cta" data-nav="to-hero" type="button">开始守夜</button>
        <div class="bmv-feature-row">
          <button class="bmv-feature-btn" data-feature="codex" type="button">守夜日志</button>
          <button class="bmv-feature-btn" data-feature="merit" type="button">滤月余辉</button>
        </div>
      </div>
    </section>
    <section class="bmv-start-stage" data-stage="hero">
      <div class="bmv-hero-illust" data-hero-plate="${DEFAULT_HERO_PRESELECT}" aria-hidden="true">
        <img class="bmv-hero-plate" alt="" draggable="false" />
        <div class="bmv-hero-plate-ph"></div>
      </div>
      <div class="bmv-hero-detail">
        <div class="bmv-stage-kicker">守夜会</div>
        <div class="bmv-stage-title">今夜，谁来守</div>
        <div class="bmv-hero-name" data-hero-name></div>
        <div class="bmv-hero-tag" data-hero-tag></div>
        <div class="bmv-hero-skill" data-hero-skill></div>
        <div class="bmv-hero-passive" data-hero-passive></div>
        <div class="bmv-hero-lock-hint" data-hero-lock hidden></div>
      </div>
      <div class="bmv-hero-row" role="listbox" aria-label="可选角色"></div>
      <div class="bmv-nav-row">
        <button class="bmv-ghost" data-nav="back" type="button">返回</button>
        <button class="bmv-cta" data-nav="to-map" type="button">选定此人</button>
      </div>
    </section>
    <section class="bmv-start-stage" data-stage="map">
      <div class="bmv-stage-kicker">三处封印同时告急</div>
      <div class="bmv-stage-title">今夜守何处</div>
      <div class="bmv-map-row"></div>
      <div class="bmv-nav-row">
        <button class="bmv-ghost" data-nav="back" type="button">返回</button>
        <button class="bmv-cta" data-nav="begin" type="button">走进夜色</button>
      </div>
    </section>
  `;
  host.appendChild(root);

  const bgImg = root.querySelector('.bmv-start-bg') as HTMLImageElement;
  bgImg.addEventListener('error', () => {
    bgImg.style.display = 'none';
  });
  const stages = {
    title: root.querySelector('[data-stage="title"]') as HTMLElement,
    hero: root.querySelector('[data-stage="hero"]') as HTMLElement,
    map: root.querySelector('[data-stage="map"]') as HTMLElement,
  };

  let step: StartStep = 'title';
  let applyHeroPreselect: (id: HeroId) => void = () => {};
  const setStep = (next: StartStep): void => {
    step = next;
    root.dataset.step = next;
    bgImg.style.display = '';
    bgImg.src = MENU_BG[next];
    (Object.keys(stages) as StartStep[]).forEach((key) => {
      const el = stages[key];
      const on = key === next;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
    if (next === 'hero') {
      applyHeroPreselect(getSelectedHero() || DEFAULT_HERO_PRESELECT);
    }
    const focusTarget = next === 'title'
      ? root.querySelector('[data-nav="to-hero"]')
      : next === 'hero'
        ? root.querySelector('[data-stage="hero"] [data-nav="to-map"]')
        : root.querySelector('[data-nav="begin"]');
    (focusTarget as HTMLElement | null)?.focus();
  };
  setStep('title');

  let codexOverlay: CodexOverlay | null = null;
  let treeOverlay: TreeOverlay | null = null;
  const startMask = root.querySelector('.bmv-start-mask') as HTMLElement;
  let lastFeatureBtn: HTMLElement | null = null;
  const holdStartUiForPanel = (): void => {
    startMask.style.pointerEvents = 'none';
  };
  const releaseStartUiFromPanel = (): void => {
    startMask.style.pointerEvents = '';
    (lastFeatureBtn ?? (root.querySelector('[data-nav="to-hero"]') as HTMLElement)).focus();
  };
  const openCodex = (): void => {
    if (!opts.save || codexOverlay || treeOverlay) return;
    holdStartUiForPanel();
    codexOverlay = createCodexOverlay({
      save: opts.save,
      isMobile,
      onClose: () => {
        codexOverlay = null;
        releaseStartUiFromPanel();
      },
    });
  };
  const openTree = (): void => {
    if (!opts.save || treeOverlay || codexOverlay) return;
    holdStartUiForPanel();
    const save = opts.save;
    treeOverlay = createTreeOverlay(getOverlayHost(), {
      points: save.meritPoints,
      purchases: save.treeState.purchases,
      pureInGame: save.pureInGame,
      codexQuery: (prereq) => resolveCodexPrerequisite(prereq, save),
      preselect: {
        current: save.preselectedWeapon,
        heroId: getSelectedHero(),
        unlockedWeaponIds: unlockedCommonWeaponIds(save.codexUnlocked),
        disabledWeaponIds: preselectDisabledWeaponIds(getSelectedHero(), (save.treeState.purchases['q_b'] ?? 0) >= 1),
        onChange: (weaponId) => {
          save.preselectedWeapon = weaponId;
          const platform = isMobile ? 'mobile' : 'desktop';
          window.localStorage.setItem(saveKey(platform), JSON.stringify(save));
        },
      },
      isMobile,
      onStateChange: (purchases, pointsSpent, pointsRemaining) => {
        save.treeState = { unlockedNodeIds: Object.keys(purchases), purchases, pointsSpent };
        save.meritPoints = pointsRemaining + pointsSpent;
        const platform = isMobile ? 'mobile' : 'desktop';
        window.localStorage.setItem(saveKey(platform), JSON.stringify(save));
      },
      onClose: () => {
        treeOverlay = null;
        releaseStartUiFromPanel();
      },
    });
  };

  const mapRow = root.querySelector('.bmv-map-row') as HTMLElement;
  const mapCards: HTMLElement[] = [];
  const mapHandlers: Array<{ onClick: () => void }> = [];
  for (const state of buildMapCardStates(opts.unlock)) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'bmv-map-card';
    card.setAttribute('aria-label', `选择地图：${state.name}`);
    card.dataset.map = state.id;
    card.dataset.locked = String(state.locked);
    const thumb = MAP_THUMBS[state.id];
    card.style.backgroundImage = `linear-gradient(to top, rgba(11,14,20,0.94) 0%, rgba(11,14,20,0.78) 36%, rgba(11,14,20,0.12) 100%), url(./frames/${thumb}.png)`;
    card.style.backgroundSize = 'cover';
    card.style.backgroundPosition = 'center';
    card.innerHTML = `
      <div class="bmv-map-name">${state.locked ? '未启封 · ' : ''}${state.name}</div>
      <div class="bmv-map-node">封印 · ${state.node}</div>
      <div class="bmv-map-threat">${state.locked ? state.unlockHint : `今夜之敌 · ${state.threat}`}</div>
      <div class="bmv-map-blurb">${state.locked ? '' : state.blurb}</div>
    `;
    const onClick = () => {
      if (state.locked) return;
      setSelectedMap(state.id);
      for (const c of mapCards) c.classList.remove('selected');
      card.classList.add('selected');
    };
    card.addEventListener('click', onClick);
    mapHandlers.push({ onClick });
    mapRow.appendChild(card);
    mapCards.push(card);
  }
  const selected = getSelectedMap();
  const selCard = mapCards.find((c) => c.dataset.map === selected);
  if (selCard) selCard.classList.add('selected');

  const heroRow = root.querySelector('.bmv-hero-row') as HTMLElement;
  const heroIllust = root.querySelector('.bmv-hero-illust') as HTMLElement;
  const heroNameEl = root.querySelector('[data-hero-name]') as HTMLElement;
  const heroTagEl = root.querySelector('[data-hero-tag]') as HTMLElement;
  const heroSkillEl = root.querySelector('[data-hero-skill]') as HTMLElement;
  const heroPassiveEl = root.querySelector('[data-hero-passive]') as HTMLElement;
  const heroLockEl = root.querySelector('[data-hero-lock]') as HTMLElement;
  const confirmHeroBtn = root.querySelector('[data-stage="hero"] [data-nav="to-map"]') as HTMLButtonElement;
  const heroStates = buildHeroCardStates(opts.unlock);
  const heroChips: HTMLElement[] = [];
  const heroHandlers: Array<{ el: HTMLElement; onClick: () => void }> = [];
  let preselectedHero: HeroId = getSelectedHero() || DEFAULT_HERO_PRESELECT;

  applyHeroPreselect = (id: HeroId): void => {
    const state = heroStates.find((s) => s.id === id);
    if (!state) return;
    preselectedHero = id;
    heroIllust.dataset.heroPlate = id;
    heroNameEl.textContent = state.locked ? `未入队 · ${state.name}` : state.name;
    heroTagEl.textContent = state.powerTagLabel;
    heroTagEl.style.color = state.powerTagColor;
    const cfg = HEROES[id];
    heroSkillEl.textContent = `主动 · ${cfg.activeSkillName}`;
    heroPassiveEl.textContent = `被动 · ${cfg.passive}`;
    if (state.locked) {
      heroLockEl.hidden = false;
      heroLockEl.textContent = state.desc;
    } else {
      heroLockEl.hidden = true;
      heroLockEl.textContent = '';
    }
    const confirmable = canConfirmHeroPreselect(state);
    confirmHeroBtn.disabled = !confirmable;
    confirmHeroBtn.setAttribute('aria-disabled', String(!confirmable));
    for (const chip of heroChips) {
      const on = chip.dataset.hero === id;
      chip.classList.toggle('is-preselected', on);
      chip.setAttribute('aria-pressed', String(on));
    }
  };

  for (const state of heroStates) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'bmv-hero-chip';
    chip.setAttribute('role', 'option');
    chip.setAttribute('aria-label', `预选角色：${state.name}`);
    chip.dataset.hero = state.id;
    chip.dataset.locked = String(state.locked);
    chip.dataset.native = String(HERO_CHIP_NATIVE_PX[state.id]);
    const face = document.createElement('div');
    face.className = 'bmv-hero-chip-portrait';
    chip.appendChild(face);
    preferFrameImg(face, HERO_CHIP_FRAMES[state.id], { className: 'bmv-hero-chip-face' });
    const onClick = () => {
      // 只改预选与背景/详情，不写入会话、不跳过确认
      applyHeroPreselect(state.id);
    };
    chip.addEventListener('click', onClick);
    heroHandlers.push({ el: chip, onClick });
    heroRow.appendChild(chip);
    heroChips.push(chip);
  }
  applyHeroPreselect(preselectedHero);

  const featureRow = root.querySelector('.bmv-feature-row') as HTMLElement;
  if (!opts.save) featureRow.style.display = 'none';
  const codexBtn = root.querySelector('[data-feature="codex"]') as HTMLElement;
  const meritBtn = root.querySelector('[data-feature="merit"]') as HTMLElement;
  const featureHandlers: Array<{ el: HTMLElement; onClick: () => void }> = [];
  if (opts.save) {
    const codexOnClick = (): void => {
      lastFeatureBtn = codexBtn;
      openCodex();
    };
    const meritOnClick = (): void => {
      lastFeatureBtn = meritBtn;
      openTree();
    };
    codexBtn.addEventListener('click', codexOnClick);
    meritBtn.addEventListener('click', meritOnClick);
    featureHandlers.push({ el: codexBtn, onClick: codexOnClick }, { el: meritBtn, onClick: meritOnClick });
  }

  let keybindsOverlay: KeybindsOverlay | null = null;
  const beginRun = (): void => {
    // 先收起启动页，避免键位教学叠在还没收起的选图界面上
    root.style.display = 'none';
    root.setAttribute('aria-hidden', 'true');
    if (opts.save && !loadKeybindsShown(window.localStorage) && !keybindsOverlay) {
      keybindsOverlay = new KeybindsOverlay(getOverlayHost(), {
        isMobile,
        onClose: () => {
          keybindsOverlay = null;
          onStart();
        },
      });
      return;
    }
    onStart();
  };

  const navHandlers: Array<{ el: HTMLElement; onClick: () => void }> = [];
  const bindNav = (selector: string, onClick: () => void): void => {
    const el = root.querySelector(selector) as HTMLElement | null;
    if (!el) return;
    el.addEventListener('click', onClick);
    navHandlers.push({ el, onClick });
  };
  bindNav('[data-nav="to-hero"]', () => setStep('hero'));
  bindNav('[data-stage="hero"] [data-nav="back"]', () => setStep('title'));
  bindNav('[data-stage="hero"] [data-nav="to-map"]', () => {
    const state = heroStates.find((s) => s.id === preselectedHero);
    if (!state || !canConfirmHeroPreselect(state)) return;
    selectHeroSafely(preselectedHero, opts.unlock);
    setStep('map');
  });
  bindNav('[data-stage="map"] [data-nav="back"]', () => setStep('hero'));
  bindNav('[data-nav="begin"]', beginRun);

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return;
    if (codexOverlay || treeOverlay || keybindsOverlay) return;
    if (step === 'title') return;
    e.preventDefault();
    setStep(prevStartStep(step));
  };
  window.addEventListener('keydown', onKeyDown);

  return {
    destroy(): void {
      codexOverlay?.destroy();
      treeOverlay = null;
      keybindsOverlay?.destroy();
      window.removeEventListener('keydown', onKeyDown);
      for (const h of navHandlers) h.el.removeEventListener('click', h.onClick);
      for (const h of featureHandlers) h.el.removeEventListener('click', h.onClick);
      for (const h of heroHandlers) h.el.removeEventListener('click', h.onClick);
      for (let i = 0; i < mapHandlers.length; i += 1) {
        const card = mapCards[i];
        if (card) card.removeEventListener('click', mapHandlers[i]!.onClick);
      }
      root.remove();
    },
  };
}

/** 便捷：从 SaveData 构造解锁状态（BootScene 消费） */
export function unlockFromSave(data: SaveData): { clearedGraveyard: boolean; clearedCathedral: boolean; clearedDen: boolean } {
  return {
    clearedGraveyard: data.clearedMaps.includes('map_graveyard'),
    clearedCathedral: data.clearedMaps.includes('map_cathedral'),
    clearedDen: data.clearedMaps.includes('map_den'),
  };
}

/** CSS 注入一次（ADR-004：布局/动画走 CSS；灯下哥特：铁石框 + 余辉金点亮） */
function ensureStyles(host: HTMLElement): void {
  let style = document.getElementById('bmv-start-styles') as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = 'bmv-start-styles';
    host.appendChild(style);
  }
  style.textContent = `
    .bmv-start {
      position: absolute; inset: 0;
      display: flex;
      pointer-events: auto;
      z-index: 70;
      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      color: #F2F5F9;
      padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px)
               env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
      overflow: hidden;
    }
    .bmv-start-sky {
      position: absolute; inset: 0;
      background:
        radial-gradient(ellipse 42% 36% at 50% 22%, rgba(126,30,30,0.55) 0%, rgba(11,14,20,0) 70%),
        #0B0E14;
    }
    .bmv-start-bg {
      position: absolute; inset: 0;
      width: 100%; height: 100%;
      object-fit: cover;
      object-position: center 28%;
      pointer-events: none;
    }
    .bmv-start[data-step="hero"] .bmv-start-bg { display: none; }
    .bmv-start[data-step="map"] .bmv-start-bg { object-position: center 62%; }
    .bmv-start-vignette {
      position: absolute; inset: 0; pointer-events: none;
      background:
        linear-gradient(180deg, rgba(11,14,20,0.18) 0%, rgba(11,14,20,0.08) 38%, rgba(11,14,20,0.78) 100%),
        radial-gradient(ellipse 80% 70% at 50% 40%, transparent 40%, rgba(11,14,20,0.72) 100%);
    }
    .bmv-start[data-step="hero"] .bmv-start-vignette,
    .bmv-start[data-step="map"] .bmv-start-vignette {
      background:
        linear-gradient(180deg, rgba(11,14,20,0.42) 0%, rgba(11,14,20,0.28) 40%, rgba(11,14,20,0.78) 100%);
    }
    .bmv-start-mask {
      position: absolute; inset: 0;
      pointer-events: none;
    }
    .bmv-start-stage {
      position: relative;
      z-index: 2;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      display: none;
      flex-direction: column;
      align-items: center;
      padding: 36px 48px 40px;
    }
    .bmv-start-stage.is-active { display: flex; }
    .bmv-start-stage[data-stage="title"] {
      justify-content: flex-end;
    }
    .bmv-start-brand {
      margin-bottom: 20px;
      text-align: center;
    }
    .bmv-start-title {
      font-family: 'STSong', 'SimSun', 'Songti SC', 'Noto Serif SC', serif;
      font-size: 64px;
      font-weight: 700;
      letter-spacing: 0.34em;
      margin-right: -0.34em;
      color: #F2F5F9;
      text-shadow:
        0 0 28px rgba(255,59,59,0.38),
        0 0 64px rgba(126,30,30,0.55),
        0 2px 0 #3a1010;
    }
    .bmv-start-sub {
      font-size: 15px;
      letter-spacing: 0.42em;
      margin-right: -0.42em;
      margin-top: 10px;
      color: #C9B48A;
      font-family: 'Palatino Linotype', Palatino, 'Times New Roman', serif;
      text-transform: uppercase;
    }
    .bmv-start-tagline {
      font-size: 16px;
      margin-top: 14px;
      letter-spacing: 0.28em;
      margin-right: -0.28em;
      color: #D8C4A0;
    }
    .bmv-lamps {
      display: flex;
      gap: 14px;
      margin-bottom: 22px;
    }
    .bmv-lamp {
      width: 7px; height: 11px;
      background: #FFC93C;
      opacity: 0.55;
      clip-path: polygon(30% 0, 70% 0, 100% 38%, 70% 100%, 30% 100%, 0 38%);
      box-shadow: 0 0 8px rgba(255,201,60,0.45);
    }
    .bmv-lamp:nth-child(odd) { opacity: 0.78; transform: scale(1.08); }
    .bmv-start-actions {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    .bmv-cta, .bmv-ghost, .bmv-feature-btn, .bmv-hero-chip, .bmv-map-card {
      font-family: inherit;
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
      border-radius: 2px;
      transition: border-color 0.12s ease-out, box-shadow 0.12s ease-out, transform 0.12s ease-out, background 0.12s ease-out;
    }
    .bmv-cta {
      font-family: 'STSong', 'SimSun', 'Songti SC', 'Noto Serif SC', serif;
      min-width: 280px; height: 56px;
      padding: 0 28px;
      font-size: 22px; font-weight: 700;
      letter-spacing: 0.22em;
      color: #FFC93C;
      background: rgba(19,23,34,0.72);
      border: 1px solid #FFC93C;
      box-shadow: 0 0 18px rgba(255,201,60,0.18), inset 0 0 16px rgba(255,201,60,0.06);
    }
    .bmv-cta:hover, .bmv-cta:focus-visible {
      transform: translateY(-1px);
      box-shadow: 0 0 0 1px #FFC93C, 0 0 22px rgba(255,201,60,0.32);
    }
    .bmv-cta:disabled, .bmv-cta[aria-disabled="true"] {
      opacity: 0.45;
      cursor: not-allowed;
      color: #C9B48A;
      border-color: #3A2A22;
      box-shadow: none;
      transform: none;
    }
    .bmv-ghost {
      min-width: 120px; height: 48px;
      padding: 0 18px;
      font-size: 16px; font-weight: 700;
      letter-spacing: 0.16em;
      color: #D8C4A0;
      background: rgba(11,14,20,0.55);
      border: 1px solid #3A2A22;
    }
    .bmv-ghost:hover, .bmv-ghost:focus-visible {
      border-color: #C9B48A;
      color: #F2F5F9;
    }
    .bmv-feature-row {
      display: flex; gap: 12px;
    }
    .bmv-feature-btn {
      width: 168px; height: 44px;
      font-size: 16px; font-weight: 700;
      letter-spacing: 0.12em;
      color: #F2F5F9;
      background: rgba(11,14,20,0.55);
      border: 1px solid #3A2A22;
    }
    .bmv-feature-btn:hover, .bmv-feature-btn:focus-visible {
      border-color: #FFC93C;
      color: #FFC93C;
    }
    .bmv-stage-kicker {
      font-size: 16px;
      letter-spacing: 0.36em;
      margin-right: -0.36em;
      color: #C9B48A;
      margin-top: 8px;
    }
    .bmv-stage-title {
      font-family: 'STSong', 'SimSun', 'Songti SC', 'Noto Serif SC', serif;
      font-size: 36px;
      font-weight: 700;
      letter-spacing: 0.22em;
      margin-right: -0.22em;
      margin: 8px 0 28px;
      text-shadow: 0 0 22px rgba(126,30,30,0.45);
    }
    .bmv-start-stage[data-stage="hero"] {
      align-items: stretch;
      padding: 36px 48px 28px;
    }
    .bmv-hero-illust {
      position: absolute;
      inset: 0;
      z-index: 1;
      pointer-events: none;
    }
    .bmv-hero-plate {
      display: none;
      position: absolute; inset: 0;
      width: 100%; height: 100%;
      object-fit: cover;
      object-position: right center;
    }
    .bmv-hero-illust.has-plate .bmv-hero-plate { display: block; }
    .bmv-hero-illust.has-plate .bmv-hero-plate-ph { opacity: 0; }
    .bmv-hero-plate-ph {
      position: absolute; inset: 0;
      background:
        radial-gradient(ellipse 44% 72% at 78% 46%, var(--hero-glow, rgba(255,201,60,0.18)) 0%, transparent 72%),
        radial-gradient(ellipse 55% 90% at 100% 50%, rgba(19,23,34,0.35) 0%, transparent 70%),
        linear-gradient(90deg, #0B0E14 0%, #10141C 52%, #171C28 100%);
    }
    .bmv-hero-illust[data-hero-plate="hero_edmund"] { --hero-glow: rgba(255,201,60,0.24); }
    .bmv-hero-illust[data-hero-plate="hero_cassandra"] { --hero-glow: rgba(232,240,250,0.16); }
    .bmv-hero-illust[data-hero-plate="hero_violet"] { --hero-glow: rgba(212,176,122,0.22); }
    .bmv-hero-illust[data-hero-plate="hero_galvan"] { --hero-glow: rgba(110,130,70,0.20); }
    .bmv-hero-detail {
      position: relative;
      z-index: 2;
      width: min(560px, 52%);
      margin-right: auto;
      box-sizing: border-box;
      padding: 12px 36px 16px 8px;
      background: linear-gradient(90deg, rgba(11,14,20,0.92) 0%, rgba(11,14,20,0.78) 72%, rgba(11,14,20,0) 100%);
    }
    .bmv-hero-detail .bmv-stage-title { margin-bottom: 18px; }
    .bmv-hero-name {
      font-size: 28px; font-weight: 700;
      letter-spacing: 0.08em;
      color: #F2F5F9;
      text-shadow: 0 1px 8px rgba(11,14,20,0.95);
    }
    .bmv-hero-tag {
      display: inline-block;
      margin-top: 12px;
      font-size: 16px; font-weight: 700;
      letter-spacing: 0.18em;
      padding: 2px 10px;
      border: 1px solid currentColor;
    }
    .bmv-hero-skill, .bmv-hero-passive, .bmv-hero-lock-hint {
      font-size: 16px;
      line-height: 1.55;
      color: #D8C4A0;
      margin-top: 12px;
      max-width: 36em;
    }
    .bmv-hero-lock-hint { color: #C9B48A; }
    .bmv-hero-row {
      position: relative;
      z-index: 3;
      display: flex; gap: 16px;
      width: 100%;
      justify-content: center;
      align-items: center;
      margin-top: auto;
      margin-bottom: 0;
    }
    .bmv-hero-chip {
      width: 128px; height: 128px;
      box-sizing: border-box;
      padding: 0;
      display: flex; align-items: center; justify-content: center;
      overflow: hidden;
      background: rgba(11,14,20,0.78);
      border: 1px solid #3A2A22;
      color: #F2F5F9;
      box-shadow: inset 0 0 16px rgba(0,0,0,0.35);
    }
    .bmv-hero-chip.is-preselected {
      border-color: #FFC93C;
      box-shadow: 0 0 0 1px #FFC93C, 0 0 18px rgba(255,201,60,0.22), inset 0 0 12px rgba(255,201,60,0.08);
    }
    .bmv-hero-chip[data-locked="true"] {
      opacity: 0.45;
      filter: saturate(0.35);
    }
    .bmv-hero-chip-portrait {
      width: 128px; height: 128px;
      display: flex; align-items: center; justify-content: center;
    }
    .bmv-hero-chip-face {
      width: 128px; height: 128px;
      object-fit: contain;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
    }
    .bmv-map-row {
      display: flex; gap: 16px;
      width: 100%;
      max-width: 1080px;
      justify-content: center;
      margin-bottom: auto;
    }
    .bmv-map-card {
      width: 280px; min-height: 180px;
      box-sizing: border-box;
      display: flex; flex-direction: column;
      align-items: flex-start;
      justify-content: flex-end;
      padding: 18px 16px;
      background-color: #131722;
      background-repeat: no-repeat;
      border: 1px solid #3A2A22;
      color: #F2F5F9;
      text-align: left;
    }
    .bmv-map-card.selected {
      border-color: #FFC93C;
      box-shadow: 0 0 0 1px #FFC93C, 0 0 22px rgba(255,201,60,0.22);
    }
    .bmv-map-card[data-locked="true"] {
      opacity: 0.55;
      cursor: not-allowed;
      filter: saturate(0.3);
    }
    .bmv-map-name {
      font-size: 22px; font-weight: 700;
      letter-spacing: 0.12em;
      text-shadow: 0 1px 4px rgba(11,14,20,0.95);
    }
    .bmv-map-node, .bmv-map-threat {
      font-size: 16px; color: #D8C4A0;
      margin-top: 6px;
      letter-spacing: 0.06em;
    }
    .bmv-map-blurb {
      font-size: 16px; color: #D8C4A0;
      margin-top: 10px;
      line-height: 1.45;
      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    }
    .bmv-nav-row {
      position: relative;
      z-index: 3;
      display: flex; gap: 16px;
      align-items: center;
      justify-content: center;
      margin-top: 20px;
    }
    .bmv-start.is-mobile .bmv-start-stage { padding: 24px 16px 28px; }
    .bmv-start.is-mobile .bmv-start-title { font-size: 36px; letter-spacing: 0.18em; margin-right: -0.18em; }
    .bmv-start.is-mobile .bmv-start-sub { font-size: 12px; letter-spacing: 0.22em; }
    .bmv-start.is-mobile .bmv-start-tagline { font-size: 13px; letter-spacing: 0.12em; }
    .bmv-start.is-mobile .bmv-cta { width: 100%; min-width: 0; letter-spacing: 0.12em; }
    .bmv-start.is-mobile .bmv-feature-row { width: 100%; }
    .bmv-start.is-mobile .bmv-feature-btn {
      width: auto; flex: 1 1 0; min-width: min-content;
      white-space: nowrap; padding: 0 10px; letter-spacing: 0.08em;
    }
    .bmv-start.is-mobile .bmv-stage-title { font-size: 24px; margin-bottom: 16px; }
    .bmv-start.is-mobile .bmv-stage-kicker,
    .bmv-start.is-mobile .bmv-hero-skill,
    .bmv-start.is-mobile .bmv-hero-passive,
    .bmv-start.is-mobile .bmv-hero-lock-hint,
    .bmv-start.is-mobile .bmv-hero-tag,
    .bmv-start.is-mobile .bmv-map-node,
    .bmv-start.is-mobile .bmv-map-threat,
    .bmv-start.is-mobile .bmv-map-blurb {
      font-size: max(16px, calc(14px / var(--bmv-overlay-scale, 1)));
    }
    .bmv-start.is-mobile .bmv-start-stage[data-stage="hero"] {
      padding: 16px 16px 20px;
    }
    .bmv-start.is-mobile .bmv-hero-illust {
      position: relative;
      order: 1;
      flex: 1 1 240px;
      min-height: 240px;
      width: 100%;
    }
    .bmv-start.is-mobile .bmv-hero-plate-ph {
      background:
        radial-gradient(ellipse 70% 80% at 50% 40%, var(--hero-glow, rgba(255,201,60,0.18)) 0%, transparent 70%),
        linear-gradient(180deg, #171C28 0%, #0B0E14 100%);
    }
    .bmv-start.is-mobile .bmv-hero-plate { object-position: center 30%; }
    .bmv-start.is-mobile .bmv-hero-row {
      order: 2;
      display: flex;
      flex-wrap: nowrap;
      justify-content: center;
      gap: 10px;
      width: 100%;
      margin-top: 10px;
      margin-bottom: 0;
    }
    .bmv-start.is-mobile .bmv-hero-chip { width: 128px; height: 128px; flex: 0 0 128px; }
    .bmv-start.is-mobile .bmv-hero-detail {
      order: 3;
      width: 100%;
      margin: 0;
      padding: 10px 4px 0;
      background: linear-gradient(180deg, rgba(11,14,20,0.2) 0%, rgba(11,14,20,0.88) 24%, rgba(11,14,20,0.92) 100%);
    }
    .bmv-start.is-mobile .bmv-hero-detail .bmv-stage-title { margin: 4px 0 10px; }
    .bmv-start.is-mobile .bmv-hero-name { font-size: 22px; }
    .bmv-start.is-mobile .bmv-nav-row { order: 4; }
    .bmv-start.is-mobile .bmv-map-row { flex-direction: column; width: 100%; }
    .bmv-start.is-mobile .bmv-map-card { width: 100%; min-height: 120px; }
    .bmv-start.is-mobile .bmv-nav-row { width: 100%; }
    .bmv-start.is-mobile .bmv-ghost { flex: 0 0 auto; }
    @media (max-width: 900px) {
      .bmv-start-stage { padding: 24px 16px 28px; }
      .bmv-start-title { font-size: 36px; letter-spacing: 0.18em; margin-right: -0.18em; }
      .bmv-cta { width: min(100%, 320px); }
    }
  `;
}
