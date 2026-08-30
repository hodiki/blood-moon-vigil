/**
 * enemies/formation-runtime.ts —— 方阵组运行时·黑板注册与事件路由（W-B / W-11）
 *
 * 无 Phaser 依赖（可脱离场景单测/沙盘复用）：维护 groupId → 黑板 + 成员实体引用，
 * 把组内承伤/击杀路由到黑板状态机，产出可执行事件（召唤/治疗/宝藏落地/解散）。
 *
 * - 成员实体 = Enemy 最小形状（x/y/hp/maxHp/cc；测试可注入 fake）
 * - 生命周期：组落地沿 registerGroup（建板）→ 成员分帧落地 bindMember（实体绑定 +
 *   onDamaged 承伤路由）→ stepAll 逐帧推进 → 解散/离场自动注销
 * - 召唤物（重召血犬/唤尸）noXp=true：调用方按 GroupEvent.summon 生成置 noXp 后 bindSummon
 * - 成员索敌指向组内逻辑实体（尸巫治疗目标 = 血犬）经由 findHealTarget 注入（W-4 同批评估雏形）
 */

import type { FormationId } from '@/config/balance';
import type { StatusState } from '@/combat/status/status-engine';
import {
  createGroupBlackboard,
  notifyMemberDamaged,
  notifyMemberKilled,
  notifySummonKilled,
  stepGroupBlackboard,
  bodyAliveCount,
  NECRO_HEALER,
  type GroupBlackboard,
  type GroupEvent,
  type GroupMemberState,
} from '@/enemies/group-blackboard';

/** 成员实体最小形状（Enemy 满足；沙盘/测试可注入 fake） */
export interface GroupMemberLike {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  cc: StatusState;
}

interface GroupEntry {
  board: GroupBlackboard;
  members: Array<GroupMemberLike | null>;
}

export class FormationRuntime {
  private groups = new Map<string, GroupEntry>();

  /** 在场组数（遥测/测试） */
  get groupCount(): number {
    return this.groups.size;
  }

  boardFor(groupId: string): GroupBlackboard | undefined {
    return this.groups.get(groupId)?.board;
  }

  /** 组落地沿：建黑板（成员槽状态由 spawn 侧按组配置展平；实体随后 bindMember 绑定） */
  registerGroup(groupId: string, formationId: FormationId, memberStates: GroupMemberState[]): GroupBlackboard {
    const board = createGroupBlackboard(groupId, formationId, behaviorOf(formationId), memberStates);
    this.groups.set(groupId, { board, members: memberStates.map(() => null) });
    return board;
  }

  /** 成员分帧落地：绑定实体 + 承伤路由（onDamaged → 受击激活/仪式受击计数） */
  bindMember(groupId: string, slotIndex: number, entity: GroupMemberLike, onDamaged: () => void): void {
    const entry = this.groups.get(groupId);
    if (!entry) return;
    entry.members[slotIndex] = entity;
    (entity as { onDamaged?: () => void }).onDamaged = onDamaged;
  }

  /** 成员承伤路由（受击激活 / 仪式受击计数） */
  onMemberDamaged(groupId: string, slotIndex: number): GroupEvent[] {
    const entry = this.groups.get(groupId);
    if (!entry) return [];
    return notifyMemberDamaged(entry.board, slotIndex);
  }

  /** 成员击杀路由（成员槽置亡；全灭 → 解散 + 自动注销） */
  onMemberKilled(groupId: string, slotIndex: number): GroupEvent[] {
    const entry = this.groups.get(groupId);
    if (!entry) return [];
    const events = notifyMemberKilled(entry.board, slotIndex);
    entry.members[slotIndex] = null; // 实体回收，解除引用
    if (entry.board.dissolved) this.groups.delete(groupId);
    return events;
  }

  /** 召唤物击杀（重召犬/唤尸在场计数释放） */
  onSummonKilled(groupId: string): void {
    const entry = this.groups.get(groupId);
    if (entry) notifySummonKilled(entry.board);
  }

  /** 召唤实体登记（事件生成的 noXp 实体；治疗目标候选） */
  bindSummon(groupId: string, summon: GroupMemberLike): void {
    const entry = this.groups.get(groupId);
    if (!entry) return;
    entry.members.push(summon);
  }

  /** 治疗结算（heal 事件消费：成员/召唤 hp 回升，clamp maxHp） */
  healMember(groupId: string, slotIndex: number, amount: number): void {
    const entry = this.groups.get(groupId);
    if (!entry) return;
    const m = entry.members[slotIndex];
    if (!m) return;
    m.hp = Math.min(m.maxHp, m.hp + amount);
  }

  /** 单步推进全部组（dt 秒；返回事件流供调用方执行副作用） */
  stepAll(dt: number, now: number): GroupEvent[] {
    const events: GroupEvent[] = [];
    for (const [groupId, entry] of [...this.groups]) {
      const ctx = {
        now,
        ritualistCc: this.ritualistCc(entry),
        findHealTarget: (board: GroupBlackboard): number | null => findInjuredAlly(entry, board),
      };
      events.push(...stepGroupBlackboard(entry.board, dt, ctx));
      // 到点离场 → 注销（宝藏护卫 depart；横穿 AI 属内容批 W-14）
      if (entry.board.phase === 'depart') {
        events.push({ type: 'dissolved', groupId });
        this.groups.delete(groupId);
      }
    }
    return events;
  }

  /** 组解散（外部触发：清场/逐阵解散条件；黑板清理 = 成员转普通个体 AI） */
  dissolve(groupId: string): GroupEvent[] {
    const entry = this.groups.get(groupId);
    if (!entry) return [];
    entry.board.dissolved = true;
    this.groups.delete(groupId);
    return [{ type: 'dissolved', groupId }];
  }

  /** 组内本体存活 body 数（追猎仪式触发判据；测试/遥测） */
  bodyAlive(groupId: string): number {
    const entry = this.groups.get(groupId);
    return entry ? bodyAliveCount(entry.board) : 0;
  }

  /** 仪式主体 CC 载荷（healer/leader 槽；眩晕打断查询） */
  private ritualistCc(entry: GroupEntry): StatusState | undefined {
    const idx = entry.board.members.findIndex((s) => s.role === 'healer' || s.role === 'leader');
    return idx >= 0 ? entry.members[idx]?.cc : undefined;
  }
}

/** healer 治疗目标 = 射程内最低血量伤员（250px，NECRO_HEALER.range；无伤员 → null） */
function findInjuredAlly(entry: GroupEntry, board: GroupBlackboard): number | null {
  const healerIdx = board.members.findIndex((s) => s.role === 'healer' || s.role === 'summoner');
  const healer = healerIdx >= 0 ? entry.members[healerIdx] : null;
  if (!healer) return null;
  let bestSlot: number | null = null;
  let bestRatio = 1;
  for (const s of board.members) {
    const m = entry.members[s.slotIndex];
    if (!m || !s.alive || m.hp >= m.maxHp) continue;
    const dist = Math.hypot(m.x - healer.x, m.y - healer.y);
    if (dist > NECRO_HEALER.range) continue;
    const ratio = m.hp / m.maxHp;
    if (bestSlot === null || ratio < bestRatio) {
      bestSlot = s.slotIndex;
      bestRatio = ratio;
    }
  }
  return bestSlot;
}

/** behavior 由组配置映射（在此收敛避免 balance → enemies 循环依赖） */
function behaviorOf(formationId: FormationId):
  | 'hunt' | 'ambush' | 'sacrifice' | 'revive' | 'treasure'
  | 'banner' | 'chain' | 'iron' | 'knights' {
  const table = {
    f_hunt_pack: 'hunt',
    f_hunting_ambush: 'ambush',
    f_sacrifice: 'sacrifice',
    f_revive_circle: 'revive',
    f_treasure_guard: 'treasure',
    f_blood_banner: 'banner',
    f_chain_ward: 'chain',
    f_iron_stone: 'iron',
    f_decayed_knights: 'knights',
  } as const;
  return table[formationId];
}
