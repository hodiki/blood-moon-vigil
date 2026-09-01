/**
 * ui/tree-overlay.ts —— 滤月余辉天赋树界面（B6-W1，gdd-talent-tree §⑧ / EG-6）
 *
 * **列表化降级预案实现**（主理人认可）：纵向主干 + 支线分组折叠，滚动列表替代树图——
 * 移动端天然适配（44px 行高触区、原生滚动），桌面同构；树图布局 = 后续美术轮。
 * 节点三态（未可达/可点亮/已点亮）+ 成本 + 洗点入口（GT-6：免费全返，主菜单入口 → 战斗中天然禁用）
 * + 纯局内开关展示（GT-11 状态标注）+ 图鉴前置灰显（GT-12）。
 * 单向数据流（ADR-004）：写走 save（unlockNode/respec），emit 无游戏状态。
 */

import {
  TALENT_TREE,
  TALENT_TOTAL_COST_RANGE,
  WEAPON_CONFIGS,
  HERO_EXCLUSIVE_PAIRS,
  HEROES,
  type TalentNodeConfig,
  type TalentNodeId,
  type HeroId,
  type WeaponId,
} from '@/config/balance';
import { resonancePairByExclusive } from '@/config/balance';
import {
  unlockNode, canUnlockNode, respec, totalSpent, treeTotalCost,
  type TreeLedger, type CodexQuery,
} from '@/progression/tree-state';

// ============================================================================
// Q-d 预选通武（P1-10：gdd-talent-tree §④-1 Q-d / §⑦-1-2；纯函数供单测）
// ============================================================================

/** 已解锁通武 id 列表（解锁口径 = 图鉴首次获得：save.codexUnlocked 含 codex_wpn_<id>） */
export function unlockedCommonWeaponIds(codexUnlocked: readonly string[]): WeaponId[] {
  return (Object.keys(WEAPON_CONFIGS) as WeaponId[]).filter((id) => codexUnlocked.includes(`codex_wpn_${id}`));
}

/**
 * 预选槽禁选集（同名不重复发放，§⑦-1-2）：
 * - 角色初始通武（开局必得，恒禁选）；
 * - Q-b 已点亮时：该角色 2 把候选专武的配对共鸣通武（伴灯会带入，禁选防重复；
 *   2 选 1 在局内进行，树界面未知选择 → 两把候选一律禁选）。
 */
export function preselectDisabledWeaponIds(heroId: HeroId, companionLit: boolean): WeaponId[] {
  const disabled = new Set<WeaponId>([HEROES[heroId].initialWeapon]);
  if (companionLit) {
    for (const exclusiveId of HERO_EXCLUSIVE_PAIRS[heroId]) {
      const pair = resonancePairByExclusive(exclusiveId);
      if (pair) disabled.add(pair.commonWeaponId);
    }
  }
  return [...disabled];
}

/** Q-d 预选段 UI 数据（TreeOverlay 消费；写回走 onChange → save.preselectedWeapon） */
export interface PreselectOptions {
  /** 当前预选（save.preselectedWeapon） */
  current: string | null;
  /** 当前角色（禁选集按角色派生） */
  heroId: HeroId;
  /** 解锁通武列表（unlockedCommonWeaponIds 派生；空 = 提示尚无可选） */
  unlockedWeaponIds: readonly WeaponId[];
  /** 禁选集（preselectDisabledWeaponIds 派生；置灰 + 提示「开局同名不重复」） */
  disabledWeaponIds: readonly WeaponId[];
  /** 选择变更（选同一把 = 取消；null = 清空） */
  onChange: (weaponId: WeaponId | null) => void;
}

export interface TreeOverlayOptions {
  /** 余辉余额（save.meritPoints） */
  points: number;
  /** 已购层数（save.treeState.purchases） */
  purchases: Record<string, number>;
  /** 纯局内模式（GT-11：属性段空、质变全开；开关展示「待商榷」状态） */
  pureInGame: boolean;
  /** 图鉴前置查询（GT-12；未接 codex 时传恒真） */
  codexQuery?: CodexQuery;
  /** Q-d 预选通武段（P1-10；缺省 = 不渲染预选区） */
  preselect?: PreselectOptions;
  isMobile: boolean;
  /** 状态写回（PlayScene/StartOverlay 持久化 save.treeState/meritPoints） */
  onStateChange?: (purchases: Record<string, number>, pointsSpent: number, pointsRemaining: number) => void;
  onClose: () => void;
}

export class TreeOverlay {
  private readonly root: HTMLElement;
  private readonly listEl: HTMLElement;
  private readonly pointsEl: HTMLElement;
  private readonly spentEl: HTMLElement;
  private ledger: TreeLedger;
  /** Q-d 预选本地镜像（onChange 写回后同步；重渲染数据源） */
  private preselectCurrent: WeaponId | null = null;
  private readonly opts: TreeOverlayOptions;

  constructor(host: HTMLElement, opts: TreeOverlayOptions) {
    this.opts = opts;
    // save.preselectedWeapon 为宽松 string（§6.1），此处收窄为 WeaponId 视图（非法值不影响 UI，仅不匹配任何项）
    this.preselectCurrent = (opts.preselect?.current as WeaponId | null) ?? null;
    this.ledger = {
      points: opts.points,
      purchases: { ...opts.purchases, q_a: 1 }, // 树根默认习得
    };
    this.ensureStyles(host);
    this.root = document.createElement('div');
    this.root.className = 'bmv-tree';
    this.root.innerHTML = `
      <div class="bmv-tree-mask"></div>
      <div class="bmv-tree-panel">
        <div class="bmv-tree-header">
          <div class="bmv-tree-title">滤月余辉</div>
          <div class="bmv-tree-points"><span class="bmv-tree-points-num"></span><span class="bmv-tree-points-unit">余辉</span></div>
          <div class="bmv-tree-meta"></div>
          <div class="bmv-tree-actions">
            <button class="bmv-tree-respec" type="button">洗点（免费·下局生效）</button>
            <button class="bmv-tree-close" type="button">返回</button>
          </div>
        </div>
        <div class="bmv-tree-pure">纯局内模式：属性层关闭、质变全开（基准规则；模式去留待商榷）</div>
        <div class="bmv-tree-list"></div>
      </div>
    `;
    host.appendChild(this.root);
    this.listEl = this.root.querySelector('.bmv-tree-list') as HTMLElement;
    this.pointsEl = this.root.querySelector('.bmv-tree-points-num') as HTMLElement;
    this.spentEl = this.root.querySelector('.bmv-tree-meta') as HTMLElement;

    (this.root.querySelector('.bmv-tree-close') as HTMLElement).addEventListener('click', () => {
      this.root.remove();
      opts.onClose();
    });
    (this.root.querySelector('.bmv-tree-respec') as HTMLElement).addEventListener('click', () => {
      respec(this.ledger);
      this.persist();
      this.renderList();
    });

    this.renderList();
  }

  private persist(): void {
    this.opts.onStateChange?.({ ...this.ledger.purchases }, totalSpent(this.ledger), this.ledger.points);
  }

  /** 列表化渲染：主干按层分组 + 支线按角色分组（降级预案 §⑧；44px 行高触区） */
  private renderList(): void {
    this.pointsEl.textContent = String(this.ledger.points);
    this.spentEl.textContent = `已投入 ${totalSpent(this.ledger)} / 全树 ${treeTotalCost()} 点（${TALENT_TOTAL_COST_RANGE[0]}~${TALENT_TOTAL_COST_RANGE[1]}）`;
    const codex = this.opts.codexQuery ?? (() => true);
    const groups: Array<{ title: string; nodes: TalentNodeConfig[] }> = [
      { title: '质变铭刻（改变这一夜怎么开始）', nodes: TALENT_TREE.filter((n) => n.kind === 'mutation') },
      { title: '属性浸染（克制的小颗粒微调）', nodes: TALENT_TREE.filter((n) => n.kind === 'attribute') },
    ];
    for (const hero of ['edmund', 'cassandra', 'violet', 'galvan']) {
      groups.push({
        title: `支线 · ${hero}`,
        nodes: TALENT_TREE.filter((n) => n.id.startsWith(`br_${hero}`)),
      });
    }
    let html = '';
    for (const g of groups) {
      html += `<div class="bmv-tree-group-title">${g.title}</div>`;
      for (const n of g.nodes) {
        const bought = this.ledger.purchases[n.id] ?? 0;
        const state = this.nodeState(n, bought, codex);
        const stateClass = state === 'lit' ? 'lit' : state === 'available' ? 'available' : 'locked';
        const levelText = n.maxPurchases > 1 ? `${bought}/${n.maxPurchases}` : bought >= 1 ? '已点亮' : '';
        html += `
          <button class="bmv-tree-node ${stateClass}" type="button" data-node="${n.id}" ${state === 'available' ? '' : 'disabled'}>
            <span class="bmv-tree-node-name">${n.name}</span>
            <span class="bmv-tree-node-desc">${n.desc}</span>
            <span class="bmv-tree-node-cost">${bought >= n.maxPurchases ? levelText : `${n.cost} 点 ${levelText ? `· ${levelText}` : ''}`}</span>
          </button>`;
      }
    }
    html += this.renderPreselect();
    this.listEl.innerHTML = html;
    this.pointsEl.textContent = String(this.ledger.points);
    for (const btn of Array.from(this.listEl.querySelectorAll('.bmv-tree-node.available'))) {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.node as TalentNodeId;
        if (unlockNode(this.ledger, id, codex)) {
          this.persist();
          this.renderList();
        }
      });
    }
    this.bindPreselectEvents();
  }

  /** Q-d 预选通武段（点亮 Q-d 后出现；未点亮提示预览，§④-1 Q-d / §⑦-1-2） */
  private renderPreselect(): string {
    const pre = this.opts.preselect;
    if (!pre) return '';
    const lit = (this.ledger.purchases['q_d'] ?? 0) >= 1;
    if (!lit) {
      return `<div class="bmv-tree-group-title">预选通武 · 携行旧兵（未点亮 Q-d）</div>
        <div class="bmv-tree-preselect-hint">点亮「携行旧兵」后可预选 1 把已解锁通武进局即得。</div>`;
    }
    if (pre.unlockedWeaponIds.length === 0) {
      return `<div class="bmv-tree-group-title">预选通武 · 携行旧兵</div>
        <div class="bmv-tree-preselect-hint">尚无已解锁通武——图鉴「首次获得」任意武器后可预选。</div>`;
    }
    let html = `<div class="bmv-tree-group-title">预选通武 · 携行旧兵（进局即得 · 点击选中/再点取消）</div>`;
    for (const id of pre.unlockedWeaponIds) {
      const cfg = WEAPON_CONFIGS[id];
      const disabled = pre.disabledWeaponIds.includes(id);
      const selected = this.preselectCurrent === id;
      const cls = disabled ? 'disabled' : selected ? 'selected' : '';
      const note = disabled ? '开局同名不重复' : selected ? '已预选' : '';
      html += `
        <button class="bmv-tree-preselect-item ${cls}" type="button" data-weapon="${id}" ${disabled ? 'disabled' : ''}>
          <span class="bmv-tree-preselect-name">${cfg.name}</span>
          <span class="bmv-tree-preselect-note">${note}</span>
        </button>`;
    }
    return html;
  }

  /** 预选项事件绑定（禁选 = 灰显不响应；选中再点 = 取消） */
  private bindPreselectEvents(): void {
    const pre = this.opts.preselect;
    if (!pre) return;
    for (const btn of Array.from(this.listEl.querySelectorAll('.bmv-tree-preselect-item:not(.disabled)'))) {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.weapon as WeaponId;
        this.preselectCurrent = this.preselectCurrent === id ? null : id;
        pre.onChange(this.preselectCurrent);
        this.renderList();
      });
    }
  }

  destroy(): void {
    this.root.remove();
  }

  private nodeState(n: TalentNodeConfig, bought: number, codex: CodexQuery): 'lit' | 'available' | 'locked' {
    if (bought >= n.maxPurchases) return 'lit';
    return canUnlockNode(this.ledger, n.id, codex) ? 'available' : 'locked';
  }

  private ensureStyles(host: HTMLElement): void {
    if (document.getElementById('bmv-tree-styles')) return;
    const style = document.createElement('style');
    style.id = 'bmv-tree-styles';
    style.textContent = `
      .bmv-tree { position: absolute; inset: 0; z-index: 75; display: flex; align-items: center; justify-content: center; pointer-events: auto; }
      .bmv-tree-mask { position: absolute; inset: 0; background: rgba(0,0,0,0.85); }
      .bmv-tree-panel {
        position: relative; width: 640px; max-width: calc(100vw - 16px); max-width: calc(100dvw - 16px);
        max-height: calc(100dvh - 24px);
        display: flex; flex-direction: column;
        background: #131722; border: 2px solid #2A3346; border-radius: 12px;
        padding: 16px; box-sizing: border-box;
        color: #F2F5F9;
      }
      .bmv-tree-header { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      .bmv-tree-title { font-size: 22px; font-weight: 700; color: #FFC93C; }
      .bmv-tree-points-num { font-size: 30px; font-weight: 800; color: #FFC93C; } /* ≥28px 大数字 §⑧ */
      .bmv-tree-points-unit { font-size: 14px; color: #A9B4C4; margin-left: 4px; }
      .bmv-tree-meta { font-size: 13px; color: #6A7280; flex: 1; }
      .bmv-tree-actions { display: flex; gap: 8px; }
      .bmv-tree-actions button {
        min-height: 44px; padding: 8px 14px; font-size: 14px; /* 热区 ≥44px §⑧ */
        background: #0B0E14; color: #F2F5F9; border: 1px solid #2A3346; border-radius: 8px; cursor: pointer;
      }
      .bmv-tree-pure { font-size: 12px; color: #6A7280; margin: 8px 0; }
      .bmv-tree-list { flex: 1; min-height: 0; overflow-y: auto; margin-top: 8px; }
      .bmv-tree-group-title { font-size: 15px; font-weight: 700; color: #54E6C9; margin: 12px 0 6px; }
      .bmv-tree-node {
        display: flex; align-items: center; gap: 10px;
        width: 100%; min-height: 52px; box-sizing: border-box; /* ≥44px 触区 */
        background: #0B0E14; border: 1px solid #2A3346; border-radius: 8px;
        padding: 8px 10px; margin-bottom: 6px; text-align: left; cursor: pointer; color: #F2F5F9;
      }
      .bmv-tree-node.available { border-color: #54E6C9; }
      .bmv-tree-node.lit { border-color: #FFC93C; opacity: 0.9; }
      .bmv-tree-node.locked { opacity: 0.5; cursor: default; }
      .bmv-tree-node:disabled { cursor: default; }
      .bmv-tree-node-name { font-size: 15px; font-weight: 700; min-width: 96px; }
      .bmv-tree-node-desc { font-size: 12px; color: #A9B4C4; flex: 1; }
      .bmv-tree-node-cost { font-size: 13px; color: #FFC93C; }
      .bmv-tree-preselect-hint { font-size: 12px; color: #6A7280; margin: 4px 0 8px; }
      .bmv-tree-preselect-item {
        display: flex; align-items: center; gap: 10px;
        width: 100%; min-height: 44px; box-sizing: border-box;
        background: #0B0E14; border: 1px solid #2A3346; border-radius: 8px;
        padding: 6px 10px; margin-bottom: 4px; text-align: left; cursor: pointer; color: #F2F5F9;
      }
      .bmv-tree-preselect-item.selected { border-color: #FFC93C; }
      .bmv-tree-preselect-item.disabled { opacity: 0.4; cursor: default; }
      .bmv-tree-preselect-item:disabled { cursor: default; }
      .bmv-tree-preselect-name { font-size: 14px; font-weight: 700; }
      .bmv-tree-preselect-note { font-size: 12px; color: #A9B4C4; margin-left: auto; }
    `;
    host.appendChild(style);
  }
}

export function createTreeOverlay(host: HTMLElement, opts: TreeOverlayOptions): TreeOverlay {
  return new TreeOverlay(host, opts);
}
