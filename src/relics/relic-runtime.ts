/**
 * relics/relic-runtime.ts —— 圣物局内运行时（NV-REVIEW-FIX 批次 B / P0-1，gdd-exclusive-weapons §3.4 + 尾章）
 *
 * 存在的理由：圣物层此前**整层不在局里**——`relic-engine` 的 grantRelic/useRelic 只被单测调用，
 * PlayScene 无 RelicRuntimeState、无掉落、无按键、无 HUD。本文件是「引擎 → 对局」的唯一适配层：
 * - 获取：Boss 渠道保底 1 枚（本图 Boss 池）+ 祭坛渠道概率第 2 枚（ALTAR_CHANCE 0.5）；上限 2；
 * - 使用：专用键（桌面 Q / 移动端第二技能钮）→ 取第一枚可用（未用过 + CD 就绪）→ useRelic；
 * - HUD：CD 环 + 剩余次数（1~2）只读快照。
 *
 * 纪律（§3.2）：判定与状态机留在 relics/，PlayScene 只调用 director.xxx() 并提供端口（敌集合/伤害/回血）。
 * 零 Phaser 依赖 → 可脱离场景单测（本批的 P0 运行时用例落在这里）。
 */

import { RELICS, RELIC_RULES, type RelicId } from '@/config/balance';
import {
  createRelicRuntime,
  grantRelic,
  hasGuaranteedDrop,
  canUseRelic,
  rollAltarRelic,
  rollBossRelic,
  useRelic,
  type RelicEffectContext,
  type RelicRuntimeState,
} from '@/relics/relic-engine';

/** HUD 只读快照（CD 环 + 剩余次数；GDD §7） */
export interface RelicHudSlot {
  id: RelicId;
  name: string;
  /** 已使用（每局每枚 1 次） */
  used: boolean;
  /** 剩余 CD s（0 = 就绪） */
  cdRemaining: number;
  /** CD 总长 s（240） */
  cdSeconds: number;
}

export class RelicDirector {
  state: RelicRuntimeState = createRelicRuntime();

  constructor(private readonly rng: () => number = Math.random) {}

  /** 已持有 id 列表（抽取去重口径） */
  get owned(): RelicId[] {
    return this.state.slots.map((s) => s.id);
  }

  /**
   * Boss 渠道保底 1 枚（GDD §3.4「Boss 必掉」）。
   * ⚠ 工程偏离（挂主理人裁决）：本作 Boss 击杀即胜利终局，`onBossDefeated` 才发牌则圣物永远不可释放。
   * 故保底改为「Boss 渠道首次触发即发」——出场（进 Boss 战可释放，GDD §186「圣物在 Boss 战中触发（允许）」）
   * 与击败（字面「击杀必掉」补齐）共用同一 `hasGuaranteedDrop` 闸门，每局至多 1 枚。
   * 返回授予的圣物 id（已保底/池空 = null）。
   */
  grantBossGuaranteed(): RelicId | null {
    if (hasGuaranteedDrop(this.state)) return null;
    const id = rollBossRelic(this.owned, this.rng);
    if (!id) return null;
    return grantRelic(this.state, id) ? id : null;
  }

  /**
   * 祭坛渠道（地图事件占位）：概率第 2 枚。
   * granted=false = 概率未中（ALTAR_CHANCE）或已达上限/池空——均为「祭坛冷熄」，不静默砍内容。
   */
  interactAltar(): { granted: boolean; relic: RelicId | null } {
    const rolled = rollAltarRelic(this.owned, this.rng);
    if (!rolled.granted || !rolled.relic) return { granted: false, relic: null };
    if (!grantRelic(this.state, rolled.relic)) return { granted: false, relic: null };
    return { granted: true, relic: rolled.relic };
  }

  /** 可用判定（已持有 + 未使用 + CD 就绪） */
  canUse(id: RelicId, now: number): boolean {
    return canUseRelic(this.state, id, now);
  }

  /**
   * 释放（专用键入口）：取第一枚可用圣物 → useRelic（used 置位 + CD 240s + 效果结算）。
   * 返回实际释放的 id；无可释放 = null（无圣物 / 全部已用 / 全部 CD 中）。
   */
  tryUse(now: number, ctx: RelicEffectContext): RelicId | null {
    for (const slot of this.state.slots) {
      if (!canUseRelic(this.state, slot.id, now)) continue;
      useRelic(this.state, slot.id, now, ctx);
      return slot.id;
    }
    return null;
  }

  /** HUD 快照（CD 环 + 剩余次数；未持有圣物时为空数组 = HUD 隐藏） */
  slotsAt(now: number): RelicHudSlot[] {
    return this.state.slots.map((s) => ({
      id: s.id,
      name: RELICS[s.id].name,
      used: s.used,
      cdRemaining: Math.max(0, s.cdReadyAt - now),
      cdSeconds: RELIC_RULES.CD_SECONDS,
    }));
  }

  /** 下一枚可释放圣物（HUD 主槽；全部不可用 = null） */
  nextUsableAt(now: number): RelicHudSlot | null {
    return this.slotsAt(now).find((s) => !s.used && s.cdRemaining <= 0) ?? null;
  }

  /** 局内剩余可释放次数（GDD §7 HUD 次数指示 1~2） */
  usesLeft(): number {
    return this.state.slots.filter((s) => !s.used).length;
  }

  /** 重开/新局重置 */
  reset(): void {
    this.state = createRelicRuntime();
  }
}
