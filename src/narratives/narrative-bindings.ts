/**
 * narratives/narrative-bindings.ts —— 局内事件 → 叙事 trigger 默认映射（narrative-framework §5/§7 / narratives-spec §6/§7）
 *
 * 与 core/events 事件表对齐；PlayScene 装配时把本映射交给 NarrativeDispatcher.bind()。
 * 内容文本表（NARRATIVES）与渲染管线（dispatcher/overlays）解耦，本文件只负责「事件 → trigger」。
 * 触发接全（spec §6/§7）：
 * - WeaponUnlocked：普通武器解锁 → 按 powerTag 分 SILVER/HALLOWED 侧边浮字（BLOOD/BEAST/MOON 不弹，
 *   spec §6 C-2 台词红线无余量）；超武（evo_*）走 UpgradeChosen 的 evolution，此处返回 null 防双发噪声。
 * - UpgradeChosen：v2 池选超武进化卡（optionId 以 evo_ 开头）→ 按主武器 powerTag 分句（spec §7 5 句）。
 * - LevelUp：第 1 次升级 → first-level-up（once 语义由 dispatcher 保证每局一次）。
 * - BossSpawned：Boss 登场 → 按 payload.bossId 分 4 句（spec §5/§6 bottom-banner）。
 * - TankSpawned：精英保底落地 → elite-spawn（同单位 1 次 + 5s 冷却由 spawner 侧保证）。
 * - CodexUpdated：局内首次解锁任一条目（同帧合并 1 条，PlayScene 侧聚合并 emit）。
 * 注意：真机/测试环境用 GameEvents（core/events 轻量 EventEmitter，API 与 Phaser 同面）。
 */

import { GameEvent } from '@/core/events';
import type { NarrativeEventBinding } from '@/narratives/narrative-dispatcher';
import {
  bossEnterTriggerFor,
  evolutionPowerTag,
  evolutionTriggerForPowerTag,
  newWeaponTriggerForPowerTag,
  weaponPowerTag,
  type NarrativeTrigger,
} from '@/narratives/narratives';
import type { WeaponId } from '@/config/balance';

/**
 * 事件 → trigger 映射（spec §6/§7 触发列）。
 * - WeaponUnlocked：普通武器解锁 → new-weapon:<tag>；超武（evo_*）由 UpgradeChosen 的 evolution 承接，
 *   此处返回 null 避免「侧边浮字 + 中央大字」双发噪声（spec §1.1 一次一屏）。
 * - UpgradeChosen：v2 池选超武进化卡（optionId 以 evo_ 开头）→ evolution:<tag>。
 * - LevelUp：第 1 次升级 → first-level-up（once 语义由 dispatcher 保证每局一次）。
 * - BossSpawned / TankSpawned：Boss 登场（按 bossId）/ 精英保底落地。
 * - CodexUpdated：图鉴新条目（局内首次解锁任一条目；同帧合并由 PlayScene 聚合并 emit）。
 */
export const DEFAULT_NARRATIVE_BINDINGS: Record<string, NarrativeEventBinding> = {
  [GameEvent.WeaponUnlocked]: (payload) => {
    const wid = (payload as { weaponId?: string | number })?.weaponId;
    if (typeof wid !== 'string' || wid.startsWith('evo_')) return null; // 超武走 evolution
    return newWeaponTriggerForPowerTag(weaponPowerTag(wid as WeaponId));
  },
  [GameEvent.UpgradeChosen]: (payload) => {
    const id = (payload as { optionId?: number | string })?.optionId;
    if (typeof id === 'string' && id.startsWith('evo_')) {
      return evolutionTriggerForPowerTag(evolutionPowerTag(id as Parameters<typeof evolutionPowerTag>[0]));
    }
    return null;
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
