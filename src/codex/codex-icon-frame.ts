/**
 * codex/codex-icon-frame.ts —— 图鉴卡图标帧（asset-spec §1.6）
 *
 * 事件用 `codex-event-<n>`；其余复用注册表第一帧（角色/敌/Boss/武器/超武）。
 * 缺映射返回 null，UI 走 SVG 剪影兜底。
 */

import type { CodexCategory, CodexEntry } from '@/codex/codex';
import { FRAME_BY_CONTENT_ID } from '@/config/frame-registry';

const CONTENT_PREFIX: Record<Exclude<CodexCategory, 'event'>, string> = {
  hero: 'codex_hero_',
  enemy: 'codex_enemy_',
  boss: 'codex_boss_',
  weapon: 'codex_wpn_',
  evo: 'codex_evo_',
};

export function codexIconFrame(entry: CodexEntry): string | null {
  if (entry.category === 'event') {
    const n = entry.entryId.replace(/^codex_event_/, '');
    return /^\d+$/.test(n) ? `codex-event-${n}` : null;
  }
  const prefix = CONTENT_PREFIX[entry.category];
  if (!entry.entryId.startsWith(prefix)) return null;
  const contentId = entry.entryId.slice(prefix.length);
  return FRAME_BY_CONTENT_ID[contentId]?.[0] ?? null;
}
