/**
 * narratives/narrative-dispatcher.ts —— 轻叙事触发分发器（narrative-framework §5/§7 / narratives-spec §6/§7）
 *
 * 职责：局内事件（GameEvents）→ trigger → 文本表条目 → 按 form 路由到对应 DOM 覆盖层。
 * - 数据驱动：内容只读 `NARRATIVES` 表（或注入 entries），组件内零硬编码文案；
 * - 不打断节奏：自动消失/点击跳过由组件负责（spec §1.3）；
 * - 可跳过：`show()` 返回是否实际渲染（无条目 / once 已展示过 → false，调用方 no-op）；
 * - once 语义：`map-open` / `first-level-up` 每局仅展示一次（resetRunState 于局始调用）；
 * - 同 trigger 多条：随机取一；`map-open` 例外——按 payload.mapId 选择当前地图序章句
 *   （TRIGGER_SELECTORS，spec §3 开局横幅 = 地图序章句）；
 * - 双端适配（spec §1.3/§11）：移动端渲染前校验单行 ≤14 字，超长 dev 告警（设计侧保证，此处兜底）；
 *   移动字号 ≥16px 物理由 overlay CSS 消费 `--bmv-overlay-scale` 保证（narrative-overlays.ts）。
 *
 * 本模块为纯逻辑 + 事件订阅（组件注入可测；test-framework §1.2 纪律）。
 */

import type { EventEmitter } from '@/core/events';
import type {
  NarrativeText,
  NarrativeForm,
  NarrativeTrigger,
} from '@/narratives/narratives';
import {
  NARRATIVES,
  randomEntryForTrigger,
  mobileSingleLineFits,
  isSingleLineForm,
} from '@/narratives/narratives';
import { NarrativeOverlaySet, type NarrativeComponent } from '@/narratives/narrative-overlays';

/** 事件绑定：直接 trigger 或按 payload 解析 trigger（返回 null = 不展示） */
export type NarrativeEventBinding = NarrativeTrigger | ((payload: unknown) => NarrativeTrigger | null | undefined);

/** 每局仅展示一次的 trigger（spec §3/§6：开局 5s / 第 1 次升级） */
export const ONCE_TRIGGERS: ReadonlySet<NarrativeTrigger> = new Set<NarrativeTrigger>([
  'map-open',
  'first-level-up',
]);

/** 同 trigger 多条时的按 payload 选择器（缺省随机取一；map-open 按当前地图选序章句） */
export type NarrativeTriggerSelector = (entry: NarrativeText, payload: Record<string, unknown>) => boolean;

export const TRIGGER_SELECTORS: Partial<Record<NarrativeTrigger, NarrativeTriggerSelector>> = {
  // 开局横幅 = 当前地图序章句（key 格式 n_prologue_<mapId>，如 n_prologue_map_graveyard）
  'map-open': (entry, payload) => entry.key === `n_prologue_${String(payload.mapId ?? '')}`,
};

export interface NarrativeDispatcherOptions {
  /** 文本表（默认 NARRATIVES；spec 终稿表） */
  entries?: readonly NarrativeText[];
  /** 5 形式组件（默认空；真实装配用 NarrativeOverlaySet，测试注入 fake） */
  components?: Readonly<Record<NarrativeForm, NarrativeComponent>>;
  /** DOM 宿主（ADR-004 #ui-overlay；提供时自动构建全套真实组件；与 components 二选一） */
  host?: HTMLElement;
  /** 随机源（同 trigger 多条时取一；测试注入确定性） */
  random?: () => number;
  /** 移动端判定（PlayScene 传 cfg.isMobile；测试缺省 false） */
  isMobile?: () => boolean;
}

export class NarrativeDispatcher {
  private readonly entries: readonly NarrativeText[];
  private readonly components: Readonly<Partial<Record<NarrativeForm, NarrativeComponent>>>;
  private readonly random: () => number;
  private readonly isMobile: () => boolean;
  /** host 装配的真实组件集（提供时由本类销毁；注入 components 时为空） */
  private readonly overlaySet: NarrativeOverlaySet | null;
  /** 本局已展示的 once trigger（开局/首升；resetRunState 于局始清空） */
  private readonly shownOnce = new Set<NarrativeTrigger>();
  private readonly unsubscribes: Array<() => void> = [];

  constructor(options: NarrativeDispatcherOptions = {}) {
    this.entries = options.entries ?? NARRATIVES;
    if (options.host) {
      this.overlaySet = new NarrativeOverlaySet(options.host);
      this.components = {
        'top-banner': this.overlaySet.get('top-banner')!,
        'bottom-banner': this.overlaySet.get('bottom-banner')!,
        'side-toast': this.overlaySet.get('side-toast')!,
        'center-gold': this.overlaySet.get('center-gold')!,
        'result-title': this.overlaySet.get('result-title')!,
      };
    } else {
      this.overlaySet = null;
      this.components = options.components ?? {};
    }
    this.random = options.random ?? Math.random;
    this.isMobile = options.isMobile ?? (() => false);
  }

  /** 局始调用：清空 once 展示记录（新一局 map-open / first-level-up 可再次出现） */
  resetRunState(): void {
    this.shownOnce.clear();
  }

  /**
   * 按 trigger 解析并渲染（无匹配 / once 已展示 → false；不抛错，调用方 no-op）。
   * payload 供 TRIGGER_SELECTORS 使用（如 map-open 需 mapId 选当前地图序章句）。
   */
  show(trigger: NarrativeTrigger, payload?: Record<string, unknown>): boolean {
    if (ONCE_TRIGGERS.has(trigger) && this.shownOnce.has(trigger)) return false;
    const selector = TRIGGER_SELECTORS[trigger];
    let entry: NarrativeText | null;
    if (selector) {
      const p = payload ?? {};
      entry = this.entries.find((e) => e.trigger === trigger && selector(e, p)) ?? null;
    } else {
      entry = randomEntryForTrigger(this.entries, trigger, this.random);
    }
    if (!entry) return false;
    return this.showEntry(entry);
  }

  /** 直接渲染指定条目（含 once 标记与移动端校验；返回是否实际渲染） */
  showEntry(entry: NarrativeText): boolean {
    const component = this.components[entry.form];
    if (!component) return false; // 该形式未装配（框架允许缺省）
    if (this.isMobile() && isSingleLineForm(entry.form) && !mobileSingleLineFits(entry.text, entry.mobile.maxLineChars)) {
      // dev 告警：设计侧保证 ≤14 字，此处兜底（生产不拦截，CSS ellipsis 截断）
      console.warn(`[narratives] 移动端单行超 ${entry.mobile.maxLineChars} 字：${entry.key}「${entry.text}」`);
    }
    if (ONCE_TRIGGERS.has(entry.trigger as NarrativeTrigger)) this.shownOnce.add(entry.trigger as NarrativeTrigger);
    component.show(entry.text, Math.round(entry.durationSec * 1000));
    return true;
  }

  /**
   * 订阅局内事件（GameEvents，ARCH §3.4 事件表）。返回解绑函数（PlayScene.shutdown 调用）。
   * bindings: 事件名 → trigger 或按 payload 解析函数（evo_ 进化 / bossId / weapon tag 等需看负载的场景）。
   */
  bind(emitter: EventEmitter, bindings: Record<string, NarrativeEventBinding>): () => void {
    for (const [eventName, binding] of Object.entries(bindings)) {
      const fn = (payload: unknown): void => {
        const trigger = typeof binding === 'function' ? binding(payload) : binding;
        if (trigger) this.show(trigger);
      };
      emitter.on(eventName, fn);
      this.unsubscribes.push(() => emitter.off(eventName, fn));
    }
    return () => this.unbindAll();
  }

  /** 解绑全部事件订阅（PlayScene.shutdown 防泄漏，配合 resetGameEvents 纪律） */
  unbindAll(): void {
    for (const unsub of this.unsubscribes.splice(0)) unsub();
  }

  destroy(): void {
    this.unbindAll();
    this.shownOnce.clear();
    this.overlaySet?.destroy();
  }
}
