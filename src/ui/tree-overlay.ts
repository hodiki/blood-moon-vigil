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
  type TalentNodeConfig,
  type TalentNodeId,
} from '@/config/balance';
import {
  unlockNode, canUnlockNode, respec, totalSpent, treeTotalCost,
  type TreeLedger, type CodexQuery,
} from '@/progression/tree-state';

export interface TreeOverlayOptions {
  /** 余辉余额（save.meritPoints） */
  points: number;
  /** 已购层数（save.treeState.purchases） */
  purchases: Record<string, number>;
  /** 纯局内模式（GT-11：属性段空、质变全开；开关展示「待商榷」状态） */
  pureInGame: boolean;
  /** 图鉴前置查询（GT-12；未接 codex 时传恒真） */
  codexQuery?: CodexQuery;
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
  private readonly opts: TreeOverlayOptions;

  constructor(host: HTMLElement, opts: TreeOverlayOptions) {
    this.opts = opts;
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
      .bmv-tree { position: absolute; inset: 0; z-index: 75; display: flex; align-items: center; justify-content: center; }
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
    `;
    host.appendChild(style);
  }
}

export function createTreeOverlay(host: HTMLElement, opts: TreeOverlayOptions): TreeOverlay {
  return new TreeOverlay(host, opts);
}
