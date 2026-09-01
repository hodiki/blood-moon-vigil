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

/** 围猎阵锚（§③-6 阵 5）：环游 3~5s → 低伏 0.3s 预警 → 收拢扑击 → 扑空 CD 8s */
export const AMBUSH_CONFIG = { circleMin: 3, circleMax: 5, crouch: 0.3, pounceCd: 8 } as const;
/** 血旗阵锚（§③-6 阵 6）：插旗 2s（可打断报废）→ 增援每 6s 上限 4（noXp）→ 斩旗溃散 */
export const BANNER_CONFIG = { plant: 2, reinforceInterval: 6, reinforceCap: 4, reinforceId: 'enemy_g2_1' as EnemyId, noXp: true, routSlow: 0.5, routDuration: 3 } as const;
/** 锁链阵锚（§③-6 阵 7）：忏悔者轮射封横向 + 畸体冲刺封纵向；畸体 CD 期忏悔者前压 20px */
export const CHAIN_CONFIG = { advanceStep: 20 } as const;
/** 骑士团锚（§③-6 阵 8）：集团冲锋（600px @500px/s 警告线 0.6s 跟踪 0.3）→ 落空硬直 1s → 每 8s */
export const KNIGHTS_CONFIG = { chargeWindup: 0.6, chargeSpeed: 500, chargeDist: 600, recover: 1, interval: 8 } as const;
/** 铁石阵锚（§③-6 阵 9 二批）：猎手冲锋路径被石甲狼阻挡 → 取消 + 硬直 0.8s */
export const IRON_CONFIG = { blockStun: 0.8 } as const;
/** 献祭阵锚（§③-6 阵 10 二批）：狂化光环（移速 +50%/攻速 +30%）；光环内杀祭品 → 尸巫复活狂化体（noXp HP×1.5）；光环外 300px 豁免 */
export const SACRIFICE_CONFIG = { auraRadius: 180, speedBuff: 0.5, attackSpeedBuff: 0.3, reviveDelay: 2, exemptionDist: 300, reviveId: 'enemy_g1_5' as EnemyId, noXp: true } as const;

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
    // 初始相位：revive=guard（护卫姿态）/ treasure=escort（驮运横穿）/ 其余=engage（推进）
    phase: behavior === 'revive' ? 'guard' : behavior === 'treasure' ? 'escort' : 'engage',
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

/** 组解散原因（P1-13：宝石簇结算口径——wiped/banner-broken = 完整击破 → 掉簇；depart/external = 离场/清场 → 不掉） */
export type DissolveCause = 'wiped' | 'depart' | 'banner-broken' | 'external';

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
  | {
      type: 'dissolved';
      groupId: string;
      /** 阵配置 ID（解散后黑板即注销，奖励结算按事件载荷查 FORMATIONS） */
      formationId: FormationId;
      cause: DissolveCause;
      /** 解散结算锚（最后阵亡成员/离场位置；纯黑板层无位置 → 由运行时增补） */
      x?: number;
      y?: number;
    }
  // —— 内容批六阵事件（W-B 遗留补全；演出/个体结算消费）——
  | { type: 'ambush-crouch'; groupId: string }
  | { type: 'ambush-pounce'; groupId: string }
  | { type: 'banner-planted'; groupId: string }
  | { type: 'banner-broken'; groupId: string }
  | { type: 'knights-charge-warn'; groupId: string }
  | { type: 'knights-charge'; groupId: string };

/** 本体「body」角色存活数（追猎 = 原生血犬存活 + 重召在场） */
export function bodyAliveCount(board: GroupBlackboard): number {
  const native = board.members.filter((m) => m.role === 'body' && m.alive).length;
  return native + board.resummonedAlive;
}

/** 成员承伤通知（追猎：吟唱期受击计数；苏生：任一成员首承伤 → 守墓者激活） */
export function notifyMemberDamaged(board: GroupBlackboard, slotIndex: number): GroupEvent[] {
  const events: GroupEvent[] = [];
  if (board.behavior === 'banner' && board.phase === 'engage') {
    board.ritualHitsTaken += 1; // 插旗期受击（≥1 报废，stepBanner 消费）
  }
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
    case 'ambush':
      stepAmbush(board, dt, events);
      break;
    case 'banner':
      stepBanner(board, dt, events);
      break;
    case 'knights':
      stepKnights(board, dt, events);
      break;
    case 'chain':
    case 'iron':
    case 'sacrifice':
      // 十字火力/队友阻挡/狂化光环的组级节拍：相位推进由本层登记，个体行为结算
      // （弹道/碰撞/光环数值）随运行时消费——铁石/献祭二批入池（MN-18 a），锁链/骑士/
      // 围猎/血旗事件已在册；本批交付组级状态机骨架 + 节拍
      board.phaseElapsed += 0; // 相位由通用 phaseElapsed 驱动（无独立节拍锚，占位不丢帧）
      break;
  }
  return events;
}

function stepAmbush(board: GroupBlackboard, dt: number, events: GroupEvent[]): void {
  // 围猎：环游（3~5s 取中值 4）→ 收拢预警 0.3s → 扑击（伤害结算运行时）→ CD 8s 循环
  board.phaseElapsed += dt;
  const cycle = AMBUSH_CONFIG.circleMin + (AMBUSH_CONFIG.circleMax - AMBUSH_CONFIG.circleMin) / 2;
  if (board.phase === 'engage') {
    if (board.phaseElapsed >= cycle - AMBUSH_CONFIG.crouch) {
      board.phase = 'ritual'; // 复用相位槽 = 收拢预警（0.3s 低伏）
      board.phaseElapsed = 0;
      events.push({ type: 'ambush-crouch', groupId: board.groupId });
    }
    return;
  }
  if (board.phase === 'ritual') {
    if (board.phaseElapsed >= AMBUSH_CONFIG.crouch) {
      board.phase = 'engage';
      board.phaseElapsed = 0;
      board.ritualCooldown = AMBUSH_CONFIG.pounceCd; // 复用冷却槽 = 扑空 CD 8s
      events.push({ type: 'ambush-pounce', groupId: board.groupId });
    }
  }
}

function stepBanner(board: GroupBlackboard, dt: number, events: GroupEvent[]): void {
  // 血旗：插旗 2s（受击 1 次报废——打断走 damaged 计数复用 ritualHitsTaken ≥1）→ 增援每 6s cap4
  board.phaseElapsed += dt;
  if (board.phase === 'engage') {
    if (board.ritualHitsTaken >= 1) {
      // 插旗被打断 → 旗报废：阵解散（斩旗前置失败态；§⑥-1 各阵解散条件逐阵定义）
      board.dissolved = true;
      events.push({ type: 'banner-broken', groupId: board.groupId });
      events.push({ type: 'dissolved', groupId: board.groupId, formationId: board.formationId, cause: 'banner-broken' });
      return;
    }
    if (board.phaseElapsed >= BANNER_CONFIG.plant) {
      board.phase = 'activated'; // 旗已立（复用激活槽）
      board.phaseElapsed = 0;
      events.push({ type: 'banner-planted', groupId: board.groupId });
    }
    return;
  }
  // 增援循环
  board.summonElapsed += dt;
  if (board.summonElapsed >= BANNER_CONFIG.reinforceInterval && board.summonsAlive < BANNER_CONFIG.reinforceCap) {
    board.summonElapsed = 0;
    board.summonsAlive += 1;
    events.push({ type: 'summon', groupId: board.groupId, enemyId: BANNER_CONFIG.reinforceId, count: 1, noXp: BANNER_CONFIG.noXp });
  }
}

function stepKnights(board: GroupBlackboard, dt: number, events: GroupEvent[]): void {
  // 骑士团：编队推进 → 每 8s 集团冲锋（警告 0.6s → 冲刺运行时）→ 落空硬直 1s
  board.phaseElapsed += dt;
  if (board.phase === 'engage') {
    if (board.phaseElapsed >= KNIGHTS_CONFIG.interval - KNIGHTS_CONFIG.chargeWindup) {
      board.phase = 'ritual'; // 复用 = 集团冲锋警告（0.6s 三线）
      board.phaseElapsed = 0;
      events.push({ type: 'knights-charge-warn', groupId: board.groupId });
    }
    return;
  }
  if (board.phase === 'ritual' && board.phaseElapsed >= KNIGHTS_CONFIG.chargeWindup) {
    board.phase = 'engage';
    board.phaseElapsed = 0;
    board.ritualCooldown = KNIGHTS_CONFIG.recover; // 复用 = 落空硬直 1s
    events.push({ type: 'knights-charge', groupId: board.groupId });
  }
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
    events.push({ type: 'dissolved', groupId: board.groupId, formationId: board.formationId, cause: 'wiped' });
  }
  return events;
}

/** 召唤物击杀通知（重召血犬/唤尸在场计数释放；召唤物死亡释放计数 §⑥-4） */
export function notifySummonKilled(board: GroupBlackboard): void {
  if (board.resummonedAlive > 0) board.resummonedAlive -= 1;
  else if (board.summonsAlive > 0) board.summonsAlive -= 1;
  // 追猎阵特例：重召犬全灭后尸体巫仍可再仪式（enemies-v3 §⑥-1：组黑板不重置）
}
