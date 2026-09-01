/**
 * codex/codex-icon-frame.ts —— 图鉴卡图标帧（asset-spec §1.6）
 *
 * 事件用 `codex-event-<n>`；其余复用注册表第一帧（角色/敌/Boss/武器/超武）。
 * 共鸣形态无独立立绘帧（frame-map v1.3；P2-4）→ 返回 null，UI 走程序化占位图 + 专武徽记角标。
 * 缺映射返回 null，UI 走 SVG 剪影兜底。
 */

import type { CodexCategory, CodexEntry } from '@/codex/codex';
import { FRAME_BY_CONTENT_ID } from '@/config/frame-registry';

const CONTENT_PREFIX: Record<Exclude<CodexCategory, 'event' | 'resonance'>, string> = {
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
  // P2-4：共鸣形态占位图（无独立帧；徽记角标由 codex-overlay 渲染）
  if (entry.category === 'resonance') return null;
  const prefix = CONTENT_PREFIX[entry.category];
  if (!entry.entryId.startsWith(prefix)) return null;
  const contentId = entry.entryId.slice(prefix.length);
  return FRAME_BY_CONTENT_ID[contentId]?.[0] ?? null;
}
