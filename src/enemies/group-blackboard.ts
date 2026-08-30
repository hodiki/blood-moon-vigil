/**
 * enemies/group-blackboard.ts —— 组共享黑板·方阵协同 AI 骨架（W-B / W-11，F-3 / P4）
 *
 * 组黑板 = 组内成员共享状态（仪式/旗帜/收拢相位/宝藏/激活状态）——「怪物配合」的实现根基。
 * 本层为纯状态机（test-framework §1.2，可脱离 Phaser 单测）：
 * - 追猎 hunt：血犬全灭 → 召唤仪式（3s 吟唱，受击 3 次或眩晕打断）→ 重召血犬×2（noXp）→ 循环
 * - 苏生 revive：唤尸每 4s 上限 6（noXp）→ 任一成员首承伤 → 守墓者激活（护卫→敌对切换）
 * - 宝藏护卫 treasure：驮运 → 驮尸全灭 = 宝藏落地 → 攻击状态（追击 10s）→ 离场
 * - 尸巫 role 变体：healer 治疗流（6 HP/2s，射程 250px）/ summoner 召唤流（行为参数挂方阵配置）
 * - 仪式打断接 status-engine 硬控：isStunned 查询（眩晕可打断；ICD 由 applyStatus 施加侧管理）
 *
 * 其余方阵（围猎/血旗/锁链/骑士团/铁石/献祭）配置占位（FORMATIONS.behavior 已登记），
 * 行为接线属内容批。成员索敌指向组内逻辑实体（W-4 守誓者友方索敌同批评估）属基线批接线。
 */

import type { EnemyId, FormationBehavior, FormationId, FormationRole } from '@/config/balance';
import { isStunned, type StatusState } from '@/combat/status/status-engine';

/** 组内成员槽（成员实体引用由 FormationRuntime 维护；黑板只存逻辑状态） */
export interface GroupMemberState {
  slotIndex: number;
  enemyId: EnemyId;
  role: FormationRole;
  alive: boolean;
}

/** 组黑板（F-3 组共享状态） */
export interface GroupBlackboard {
  groupId: string;
  formationId: FormationId;
  behavior: FormationBehavior;
  /** 组级相位（逐阵语义 token：hunt=engage/ritual · revive=guard/activated · treasure=escort/aggro/depart） */
  phase: string;
  phaseElapsed: number;
  members: GroupMemberState[];
  // —— 追猎（仪式）——
  ritualActive: boolean;
  ritualElapsed: number;
  /** 仪式吟唱期受击次数（≥3 打断） */
  ritualHitsTaken: number;
  /** 仪式打断后冷却剩余 s（工程锚：打断 = 仪式进 CD） */
  ritualCooldown: number;
  /** 重召血犬在场数（noXp；死亡经 notifySummonKilled 释放） */
  resummonedAlive: number;
  // —— 苏生（唤尸）——
  summonElapsed: number;
  /** 唤尸在场数（同源计数；上限 6） */
  summonsAlive: number;
  /** 守墓者激活（任一成员首承伤） */
  activated: boolean;
  // —— 宝藏护卫 ——
  treasureDropped: boolean;
  aggroElapsed: number;
  /** healer 治疗节拍计时（2s 周期） */
  healElapsed: number;
  /** 组解散（成员全灭 / 到点离场；清黑板语义） */
  dissolved: boolean;
}

/** 尸巫 healer 治疗流锚（enemies-v3 §③-6 阵 1：6 HP/2s，射程 250px，绿光束） */
export const NECRO_HEALER = {
  healAmount: 6,
  interval: 2,
  range: 250,
} as const;

/** 尸巫 summoner 唤尸流锚（enemies-v3 §③-6 阵 2：每 4s 共召 1 行尸 noXp，上限 6） */
export const NECRO_SUMMONER = {
  interval: 4,
  cap: 6,
  summonedId: 'enemy_g1_1' as EnemyId,
  noXp: true,
} as const;

/** 追猎阵仪式锚（enemies-v3 §③-6 阵 1：3s 吟唱，受击 3 次或眩晕打断；CD 为工程锚） */
export const HUNT_RITUAL = {
  chant: 3,
  hitsToInterrupt: 3,
  interruptCooldown: 6,
  /** 重召血犬 ×2（noXp） */
  resummonId: 'enemy_g1_2' as EnemyId,
  resummonCount: 2,
  noXp: true,
} as const;

/** 宝藏护卫攻击状态锚（enemies-v3 §③-6 阵 3：切换攻击状态追击 10s） */
export const TREASURE_AGGRO_SECONDS = 10;

export function createGroupBlackboard(
  groupId: string,
  formationId: FormationId,
  behavior: FormationBehavior,
  members: GroupMemberState[],
): GroupBlackboard {
  return {
    groupId,
    formationId,
    behavior,
    phase: behavior === 'hunt' ? 'engage' : behavior === 'revive' ? 'guard' : behavior === 'treasure' ? 'escort' : 'idle',
    phaseElapsed: 0,
    members,
    ritualActive: false,
    ritualElapsed: 0,
    ritualHitsTaken: 0,
    ritualCooldown: 0,
    resummonedAlive: 0,
    summonElapsed: 0,
    summonsAlive: 0,
    activated: false,
    treasureDropped: false,
    aggroElapsed: 0,
    healElapsed: 0,
    dissolved: false,
  };
}

/** 组事件（调用方消费：召唤生成/治疗结算/宝藏落地/黑板清理） */
export type GroupEvent =
  | { type: 'ritual-start'; groupId: string }
  | { type: 'ritual-interrupted'; groupId: string; cause: 'stun' | 'hits' }
  | { type: 'ritual-complete'; groupId: string }
  | { type: 'summon'; groupId: string; enemyId: EnemyId; count: number; noXp: boolean }
  | { type: 'heal'; groupId: string; targetSlotIndex: number; amount: number }
  | { type: 'activated'; groupId: string }
  | { type: 'treasure-dropped'; groupId: string }
  | { type: 'aggro'; groupId: string }
  | { type: 'depart'; groupId: string }
  | { type: 'dissolved'; groupId: string };

/** 本体「body」角色存活数（追猎 = 原生血犬存活 + 重召在场） */
export function bodyAliveCount(board: GroupBlackboard): number {
  const native = board.members.filter((m) => m.role === 'body' && m.alive).length;
  return native + board.resummonedAlive;
}

/** 成员承伤通知（追猎：吟唱期受击计数；苏生：任一成员首承伤 → 守墓者激活） */
export function notifyMemberDamaged(board: GroupBlackboard, slotIndex: number): GroupEvent[] {
  const events: GroupEvent[] = [];
  if (board.behavior === 'hunt' && board.ritualActive) {
    board.ritualHitsTaken += 1;
    if (board.ritualHitsTaken >= HUNT_RITUAL.hitsToInterrupt) {
      board.ritualActive = false;
      board.ritualCooldown = HUNT_RITUAL.interruptCooldown;
      board.phase = 'engage';
      events.push({ type: 'ritual-interrupted', groupId: board.groupId, cause: 'hits' });
    }
  }
  if (board.behavior === 'revive' && !board.activated) {
    // 受击激活：任一成员首承伤 → 守墓者解除护卫姿态（护卫→敌对状态可读切换）
    board.activated = true;
    board.phase = 'activated';
    board.phaseElapsed = 0;
    events.push({ type: 'activated', groupId: board.groupId });
  }
  void slotIndex;
  return events;
}

/**
 * 仪式打断判定（眩晕路径）：仪式主体（尸巫 leader/healer）处于眩晕 → 打断。
 * ICD（10s/单目标，状态结束起算）由 applyStatus 施加侧管理；本层只读生效态。
 */
export function isRitualStunned(ritualistCc: StatusState | undefined, now: number): boolean {
  if (!ritualistCc) return false;
  return isStunned(ritualistCc, now);
}

export interface BoardStepContext {
  now: number;
  /** 仪式主体（追猎 = 尸巫 healer；role 槽查询）当前 CC 载荷（眩晕打断查询） */
  ritualistCc?: StatusState;
  /** 治疗目标选择（healer；返回伤员槽位或 null） */
  findHealTarget?: (board: GroupBlackboard) => number | null;
}

/** 单步推进（dt 秒；纯状态机，事件返回给调用方执行副作用） */
export function stepGroupBlackboard(
  board: GroupBlackboard,
  dt: number,
  ctx: BoardStepContext,
): GroupEvent[] {
  if (board.dissolved) return [];
  board.phaseElapsed += dt;
  const events: GroupEvent[] = [];
  switch (board.behavior) {
    case 'hunt':
      stepHunt(board, dt, ctx, events);
      break;
    case 'revive':
      stepRevive(board, dt, events);
      break;
    case 'treasure':
      stepTreasure(board, dt, events);
      break;
    default:
      break; // 其余阵行为接线属内容批（配置占位）
  }
  return events;
}

function stepHunt(board: GroupBlackboard, dt: number, ctx: BoardStepContext, events: GroupEvent[]): void {
  // 仪式冷却（打断后进 CD，防白嫖重吟唱）
  if (board.ritualCooldown > 0) {
    board.ritualCooldown = Math.max(0, board.ritualCooldown - dt);
  }
  // healer 治疗循环（6 HP/2s，射程 250px——目标选择由运行时提供；成员存活期持续）
  if (board.members.some((m) => m.role === 'healer' && m.alive)) {
    board.healElapsed += dt;
    if (board.healElapsed >= NECRO_HEALER.interval) {
      const target = ctx.findHealTarget?.(board) ?? null;
      if (target !== null) {
        board.healElapsed = 0;
        events.push({ type: 'heal', groupId: board.groupId, targetSlotIndex: target, amount: NECRO_HEALER.healAmount });
      }
    }
  } else {
    board.healElapsed = 0;
  }
  if (board.phase === 'engage') {
    // 血犬全灭（原生 + 重召）→ 进入召唤仪式
    if (bodyAliveCount(board) === 0 && board.ritualCooldown <= 0) {
      board.phase = 'ritual';
      board.phaseElapsed = 0;
      board.ritualActive = true;
      board.ritualElapsed = 0;
      board.ritualHitsTaken = 0;
      events.push({ type: 'ritual-start', groupId: board.groupId });
    }
    return;
  }
  // ritual 相位：3s 吟唱，眩晕/受击 3 次打断
  if (isRitualStunned(ctx.ritualistCc, ctx.now)) {
    board.ritualActive = false;
    board.ritualCooldown = HUNT_RITUAL.interruptCooldown;
    board.phase = 'engage';
    events.push({ type: 'ritual-interrupted', groupId: board.groupId, cause: 'stun' });
    return;
  }
  board.ritualElapsed += dt;
  if (board.ritualElapsed >= HUNT_RITUAL.chant) {
    board.ritualActive = false;
    board.phase = 'engage';
    board.phaseElapsed = 0;
    board.resummonedAlive = HUNT_RITUAL.resummonCount;
    events.push({ type: 'ritual-complete', groupId: board.groupId });
    events.push({
      type: 'summon',
      groupId: board.groupId,
      enemyId: HUNT_RITUAL.resummonId,
      count: HUNT_RITUAL.resummonCount,
      noXp: HUNT_RITUAL.noXp,
    });
  }
}

function stepRevive(board: GroupBlackboard, dt: number, events: GroupEvent[]): void {
  // 唤尸循环：每 4s 共召 1 行尸（noXp），上限 6（达上限暂停，§⑥-7 语义）
  board.summonElapsed += dt;
  if (board.summonElapsed >= NECRO_SUMMONER.interval && board.summonsAlive < NECRO_SUMMONER.cap) {
    board.summonElapsed = 0;
    board.summonsAlive += 1;
    events.push({
      type: 'summon',
      groupId: board.groupId,
      enemyId: NECRO_SUMMONER.summonedId,
      count: 1,
      noXp: NECRO_SUMMONER.noXp,
    });
  }
}

function stepTreasure(board: GroupBlackboard, dt: number, events: GroupEvent[]): void {
  const carriersAlive = board.members.filter((m) => m.role === 'carrier' && m.alive).length;
  if (board.phase === 'escort') {
    // 驮尸全灭 = 宝藏落地 → 切换攻击状态（追击 10s）
    if (carriersAlive === 0) {
      board.treasureDropped = true;
      board.phase = 'aggro';
      board.phaseElapsed = 0;
      board.aggroElapsed = 0;
      events.push({ type: 'treasure-dropped', groupId: board.groupId });
      events.push({ type: 'aggro', groupId: board.groupId });
    }
    return;
  }
  if (board.phase === 'aggro') {
    board.aggroElapsed += dt;
    if (board.aggroElapsed >= TREASURE_AGGRO_SECONDS) {
      board.phase = 'depart';
      board.phaseElapsed = 0;
      events.push({ type: 'depart', groupId: board.groupId });
    }
  }
  // depart：到点离场（横穿 AI 移动属内容批 W-14；黑板侧 dissolved 由运行时置位）
}

/** 成员击杀通知（成员 alive 置 false；重召/唤尸在场数释放走 notifySummonKilled） */
export function notifyMemberKilled(board: GroupBlackboard, slotIndex: number): GroupEvent[] {
  const m = board.members.find((x) => x.slotIndex === slotIndex);
  if (m) m.alive = false;
  // 全员本体灭亡 → 解散（清黑板；成员转普通个体 AI 语义由运行时执行）
  const events: GroupEvent[] = [];
  if (board.members.every((x) => !x.alive) && board.resummonedAlive === 0) {
    board.dissolved = true;
    events.push({ type: 'dissolved', groupId: board.groupId });
  }
  return events;
}

/** 召唤物击杀通知（重召血犬/唤尸在场计数释放；召唤物死亡释放计数 §⑥-4） */
export function notifySummonKilled(board: GroupBlackboard): void {
  if (board.resummonedAlive > 0) board.resummonedAlive -= 1;
  else if (board.summonsAlive > 0) board.summonsAlive -= 1;
  // 追猎阵特例：重召犬全灭后尸体巫仍可再仪式（enemies-v3 §⑥-1：组黑板不重置）
}
