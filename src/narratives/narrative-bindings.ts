/**
 * narratives/narrative-bindings.ts —— 局内事件 → 叙事 trigger 默认映射（narrative-framework §5/§7 / narratives-spec §6/§7）
 *
 * 与 core/events 事件表对齐；PlayScene 装配时把本映射交给 NarrativeDispatcher.bind()。
 * 内容文本表（NARRATIVES）与渲染管线（dispatcher/overlays）解耦，本文件只负责「事件 → trigger」。
 * 触发接全（spec §6/§7）：
 * - WeaponUnlocked：普通武器解锁 → 按 powerTag 分 SILVER/HALLOWED 侧边浮字（BLOOD/BEAST/MOON/BONE 不弹，
 *   spec §6 C-2 台词红线无余量）；超武（evo_*）无对应局内播报，返回 null。
 * - LevelUp：第 1 次升级 → first-level-up（once 语义由 dispatcher 保证每局一次）。
 * - BossSpawned：Boss 登场 → 按 payload.bossId 分 4 句（spec §5/§6 bottom-banner）。
 * - TankSpawned：精英保底落地 → elite-spawn（同单位 1 次 + 5s 冷却由 spawner 侧保证）。
 * - CodexUpdated：局内首次解锁任一条目（同帧合并 1 条，PlayScene 侧聚合并 emit）。
 * v1.2（SC-04）：移除 `UpgradeChosen → evolution:*` 映射（超武/进化机制退役，spec §7「整体废止」）；
 *   圣物释放 / 共鸣寻获（`relic:released` / `resonance:get`）由对应系统事件直接派发，本表暂不预置。
 * 注意：真机/测试环境用 GameEvents（core/events 轻量 EventEmitter，API 与 Phaser 同面）。
 */

import { GameEvent } from '@/core/events';
import type { NarrativeEventBinding } from '@/narratives/narrative-dispatcher';
import {
  bossEnterTriggerFor,
  newWeaponTriggerForPowerTag,
  weaponPowerTag,
  type NarrativeTrigger,
} from '@/narratives/narratives';
import type { WeaponId } from '@/config/balance';

/**
 * 事件 → trigger 映射（spec §6/§7 触发列）。
 * - WeaponUnlocked：普通武器解锁 → new-weapon:<tag>；超武（evo_*）无播报，返回 null。
 * - LevelUp：第 1 次升级 → first-level-up（once 语义由 dispatcher 保证每局一次）。
 * - BossSpawned / TankSpawned：Boss 登场（按 bossId）/ 精英保底落地。
 * - CodexUpdated：图鉴新条目（局内首次解锁任一条目；同帧合并由 PlayScene 聚合并 emit）。
 * - v1.2 已移除 UpgradeChosen → evolution:*（超武退役，触发基础不复存在）。
 */
export const DEFAULT_NARRATIVE_BINDINGS: Record<string, NarrativeEventBinding> = {
  [GameEvent.WeaponUnlocked]: (payload) => {
    const wid = (payload as { weaponId?: string | number })?.weaponId;
    if (typeof wid !== 'string' || wid.startsWith('evo_')) return null; // 超武（evo_*）无局内播报
    return newWeaponTriggerForPowerTag(weaponPowerTag(wid as WeaponId));
  },
  [GameEvent.LevelUp]: () => 'first-level-up',
  [GameEvent.BossSpawned]: (payload) => {
    const bossId = (payload as { bossId?: string })?.bossId;
    const trigger: NarrativeTrigger | null = typeof bossId === 'string' ? bossEnterTriggerFor(bossId) : null;
    // 旧 payload 无 bossId（兜底）：按地图 Boss 1 语义展示（PlayScene 已补齐 bossId）
    return trigger ?? 'boss:spawned(boss_1)';
  },
  [GameEvent.TankSpawned]: () => 'elite-spawn',
  [GameEvent.CodexUpdated]: () => 'codex-updated',
} as const;
