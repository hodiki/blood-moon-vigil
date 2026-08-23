/**
 * codex/codex.ts —— 图鉴数据层（E4-S6，gdd-codex §3.1/§3.2）
 *
 * 纯数据/纯逻辑（可脱离 Phaser 单测）：35+ 条目结构 + codex_unlock 五类幂等记录。
 * UI（守夜日志列表/档案卡）与叙事文本表 = M3 范围；本模块只做数据层与事件挂钩。
 *
 * 条目构成（gdd-codex §3.1）：角色 4 / 敌人 15 / Boss 4 / 武器 14 / 超武 7 / 事件 6。
 * 注：GDD 表头「合计 35」与分项和（4+15+4+14+7+6=50）不一致 —— 工程按分项全量落表
 * （50 条，R-C3-RULING 敌人 14→15 补守墓者），测试断言分项和并注明差异（M2 不改设计文档，仅数据层口径对齐分项）。
 *
 * 解锁记录（§3.2）：
 * - kill    ：首杀（enemy/boss）
 * - obtain  ：首次获得（weapon）
 * - evolve  ：首次进化（evo）
 * - progress：通关/解锁（hero/map/event）
 * - trigger ：首次触发（event：血月化身月坠 = 击杀）
 * 幂等：首杀/首获/首进化/首通不重复解锁；重开/换角色不重复。
 */

import {
  HEROES,
  ENEMY_CONFIGS,
  BOSSES,
  WEAPON_CONFIGS,
  EVOLUTIONS,
  type EnemyId,
  type WeaponId,
  type EvoId,
  type HeroId,
  type BossId,
} from '@/config/balance';

export type CodexCategory = 'hero' | 'enemy' | 'boss' | 'weapon' | 'evo' | 'event';
export type CodexUnlockType = 'kill' | 'obtain' | 'evolve' | 'progress' | 'trigger';

export interface CodexEntry {
  entryId: string; // codex_<category>_<id>
  category: CodexCategory;
  name: string;
  unlock: CodexUnlockType;
  /** 解锁条件描述（M3 档案卡「？？？」提示） */
  condition: string;
  /** 血月化身隐藏条目（gdd-codex §3.2：首杀后解锁隐藏条目） */
  hidden?: boolean;
}

/** 事件条目 6（静态设定档案，world-bible 精简版；随首通地图解锁，gdd-codex §3.1/§6.7） */
const EVENT_ENTRIES: readonly { entryId: string; name: string; condition: string }[] = [
  { entryId: 'codex_event_1', name: '血月起源', condition: '首通地图 1（月下墓地）' },
  { entryId: 'codex_event_2', name: '守夜会', condition: '首通地图 1（月下墓地）' },
  { entryId: 'codex_event_3', name: '血王·阿拉里克', condition: '首通地图 2（血教堂）' },
  { entryId: 'codex_event_4', name: '血廷', condition: '首通地图 2（血教堂）' },
  { entryId: 'codex_event_5', name: '兽群', condition: '首通地图 3（狼穴）' },
  { entryId: 'codex_event_6', name: '血月化身', condition: '任意地图击杀血月化身' },
];

/** 全量条目（由配置表派生；事件为静态表） */
export function allCodexEntries(): CodexEntry[] {
  const entries: CodexEntry[] = [];
  // 角色 4（gdd-codex §3.1：角色解锁即记录）
  for (const [id, hero] of Object.entries(HEROES) as Array<[HeroId, { name: string }]>) {
    entries.push({ entryId: `codex_hero_${id}`, category: 'hero', name: hero.name, unlock: 'progress', condition: '角色解锁' });
  }
  // 敌人 15（首杀）
  for (const [id, cfg] of Object.entries(ENEMY_CONFIGS) as Array<[EnemyId, { name: string }]>) {
    entries.push({ entryId: `codex_enemy_${id}`, category: 'enemy', name: cfg.name, unlock: 'kill', condition: '首次击杀' });
  }
  // Boss 4（首杀；血月化身 = 隐藏条目）
  for (const [id, cfg] of Object.entries(BOSSES) as Array<[BossId, { name: string }]>) {
    entries.push({
      entryId: `codex_boss_${id}`,
      category: 'boss',
      name: cfg.name,
      unlock: 'kill',
      condition: id === 'boss_4' ? '任意地图击杀（稀有月坠）' : '首次击杀',
      hidden: id === 'boss_4',
    });
  }
  // 武器 14（首次获得）
  for (const [id, cfg] of Object.entries(WEAPON_CONFIGS) as Array<[WeaponId, { name: string }]>) {
    entries.push({ entryId: `codex_wpn_${id}`, category: 'weapon', name: cfg.name, unlock: 'obtain', condition: '首次获得' });
  }
  // 超武 7（首次进化）
  for (const evo of EVOLUTIONS) {
    entries.push({ entryId: `codex_evo_${evo.evoId}`, category: 'evo', name: evo.name, unlock: 'evolve', condition: '首次进化' });
  }
  // 事件 6（首通/触发）
  for (const ev of EVENT_ENTRIES) {
    entries.push({ entryId: ev.entryId, category: 'event', name: ev.name, unlock: 'progress', condition: ev.condition });
  }
  return entries;
}

export const CODEX_ENTRIES: readonly CodexEntry[] = allCodexEntries();

/** 按 entryId 查条目（缺省 null） */
export function codexEntryById(entryId: string): CodexEntry | null {
  return CODEX_ENTRIES.find((e) => e.entryId === entryId) ?? null;
}

/** 分项统计（gdd-codex §3.1；测试断言分项和 = 49，GDD 表头 35 为笔误口径） */
export function codexCategoryCounts(): Record<CodexCategory, number> {
  const counts: Record<CodexCategory, number> = { hero: 0, enemy: 0, boss: 0, weapon: 0, evo: 0, event: 0 };
  for (const e of CODEX_ENTRIES) counts[e.category] += 1;
  return counts;
}

/** 图鉴解锁追踪器（单会话内存态；持久化走 save.ts） */
export class CodexTracker {
  private readonly unlocked = new Set<string>();

  constructor(initialUnlocked: readonly string[] = []) {
    for (const id of initialUnlocked) this.unlocked.add(id);
  }

  isUnlocked(entryId: string): boolean {
    return this.unlocked.has(entryId);
  }

  unlockCount(): number {
    return this.unlocked.size;
  }

  /** 幂等解锁：首次返回 true；已解锁返回 false（不重复，gdd-codex §6.5） */
  record(entryId: string): boolean {
    if (!codexEntryById(entryId)) return false; // 未知条目不记录
    if (this.unlocked.has(entryId)) return false;
    this.unlocked.add(entryId);
    return true;
  }

  /** 首杀（enemy/boss；血月化身额外触发 trigger 语义由调用方处理） */
  recordKill(id: EnemyId | BossId): boolean {
    const prefix = (id as string).startsWith('boss_') ? 'codex_boss_' : 'codex_enemy_';
    return this.record(`${prefix}${id}`);
  }

  /** 首次获得（weapon） */
  recordObtain(weaponId: WeaponId): boolean {
    return this.record(`codex_wpn_${weaponId}`);
  }

  /** 首次进化（evo） */
  recordEvolve(evoId: EvoId): boolean {
    return this.record(`codex_evo_${evoId}`);
  }

  /** 首通/解锁（progress：hero/map/event） */
  recordProgress(entryId: string): boolean {
    return this.record(entryId);
  }

  /** 首次触发（event：血月化身月坠 = 击杀） */
  recordTrigger(entryId: string): boolean {
    return this.record(entryId);
  }

  /** 已解锁 id 快照（存档） */
  snapshot(): string[] {
    return [...this.unlocked];
  }
}

/** 血月化身隐藏条目：首杀解锁（gdd-codex §3.2 稀有掉落 chest；掉 1 次） */
export const MOON_AVATAR_ENTRY_ID = 'codex_boss_boss_4';

/** 事件条目按首通地图解锁（gdd-codex §6.7）：墓地→1/2、教堂→3/4、狼穴→5、化身→6 */
export function eventEntriesForMapCleared(clearedMap: 'map_graveyard' | 'map_cathedral' | 'map_den'): string[] {
  switch (clearedMap) {
    case 'map_graveyard':
      return ['codex_event_1', 'codex_event_2'];
    case 'map_cathedral':
      return ['codex_event_3', 'codex_event_4'];
    case 'map_den':
      return ['codex_event_5'];
    default:
      return [];
  }
}
