/**
 * enemies/boss-skill-engine.ts —— Boss 五技能槽状态机（W-D / W-15，gdd-enemies-v3 §③-7）
 *
 * 槽位调度：普攻 = 循环基底（间隔恒定持续施压）；普技 = CD 轮转（节奏变化，轮转位推进）；
 * 高威胁技 = 低频大考（P2 解锁节点或 P1 常驻低频）。施法走「预警（telegraph）→ 释放 →
 * 施法硬直（castLock = 输出窗）」三段；预警期内不重复施法。
 *
 * MN-23 召唤纪律：召唤实体 noXp 全量（事件消费侧置位）；上限 6（P2 8）同源计数
 * （per-Boss，死亡释放）；达上限召唤跳过（不混算跨来源）。
 * 阶段 2：HP<50% → 1s 转阶段霸体（不承伤，消费方按 phaseGraceUntil 过滤）→ 解锁节点
 * （boss_1 骑士入轮转 + 普技 CD −25% + 上限 6→8；boss_2 召 2 侍僧 + 血井解锁；boss_3 扑击 CD 减半）。
 * Boss 死亡：clearSummons（召唤物一并清除不掉 XP，§③-7 E-0 ⑥）。
 *
 * 运行时消费：PlayScene（W-2 升级版）与 tools/sim（Boss 相位真实调度采样）。
 * telegraph 演出（W-13）消费 skillCasting 字段（当前预警中的槽）。
 */

import {
  BOSS_SKILL_TABLES,
  BOSS_SUMMON_CAP,
  type BossId,
  type BossSkillConfig,
  type BossSlot,
} from '@/config/balance';
import type { EnemyId } from '@/config/balance';

/** 轮转槽序（普技 1→2→3→高威胁；CD 未就绪/未解锁的槽跳过） */
const ROTATION: readonly BossSlot[] = ['skill1', 'skill2', 'skill3', 'ultimate'];

/** Boss 技能运行时状态（纯数据；Boss 实体/沙盘持有） */
export interface BossSkillState {
  bossId: BossId;
  phase: 1 | 2;
  /** 转阶段霸体截止（秒时间戳；期内不承伤，消费方过滤） */
  phaseGraceUntil: number;
  /** 普攻循环计时 */
  normalTimer: number;
  /** 各槽 CD 剩余 s（轮转判定输入） */
  slotCds: Record<BossSlot, number>;
  /** 普技轮转游标（ROTATION 序；防同一普技连发） */
  rotationCursor: number;
  /** 预警中的槽（telegraph → 释放；null = 无） */
  casting: { slot: BossSlot; fireAt: number } | null;
  /** 施法硬直截止（输出窗；期内不启动新技能） */
  castLockUntil: number;
  /** Boss 同源召唤在场计数（上限 6/P2 8；死亡释放由调用方 reportSummonKilled） */
  summonsAlive: number;
}

export function createBossSkillState(bossId: BossId): BossSkillState {
  return {
    bossId,
    phase: 1,
    phaseGraceUntil: 0,
    normalTimer: 0,
    slotCds: { normal: 0, skill1: 0, skill2: 0, skill3: 0, ultimate: 0 },
    rotationCursor: 0,
    casting: null,
    castLockUntil: 0,
    summonsAlive: 0,
  };
}

/** Boss 事件（消费方执行副作用：伤害结算/召唤生成/清场） */
export type BossSkillEvent =
  | { type: 'normal-attack'; damage: number }
  | { type: 'skill-damage'; slot: BossSlot; damage: number }
  | { type: 'summon'; enemyId: EnemyId; count: number; noXp: true }
  | { type: 'phase-changed'; phase: 2 }
  | { type: 'cast-start'; slot: BossSlot; telegraph: number };

export interface BossStepContext {
  dt: number;
  now: number;
  /** HP 比例（阶段 2 触发输入；HP<50% → 转阶段） */
  hpRatio: number;
  /** 场上敌数上限节流（召唤生成前检查；达上限跳过不丢计数） */
  canSpawnMore: boolean;
}

/** 阶段 2 触发（HP<50%；boss_4 无阶段） */
export function bossPhase2Due(state: BossSkillState, hpRatio: number): boolean {
  return BOSS_SKILL_TABLES[state.bossId].hasPhase2 && state.phase === 1 && hpRatio < 0.5;
}

/** 当前召唤上限（P1 6 / P2 8；MN-23） */
export function bossSummonCap(state: BossSkillState): number {
  return state.phase === 2 ? BOSS_SUMMON_CAP.P2 : BOSS_SUMMON_CAP.P1;
}

/** CD 生效值（阶段 2 CD 倍率：boss_1 −25% / boss_3 扑击减半 / boss_2 血井后减半） */
function effectiveCd(state: BossSkillState, skill: BossSkillConfig): number {
  const mult = state.phase === 2 ? BOSS_SKILL_TABLES[state.bossId].phase2.cdMultiplier : 1;
  return skill.cd * mult;
}

/** 槽位是否可施（解锁阶段 + CD 就绪；施法硬直/预警占用在调度层判断） */
export function skillReady(state: BossSkillState, skill: BossSkillConfig): boolean {
  return skill.unlockPhase <= state.phase && state.slotCds[skill.slot] <= 0;
}

/**
 * 单步推进（帧驱动；事件返回给消费方执行）。
 * 调度序：转阶段检查 → 预警释放 → 施法硬直 → 普攻基底 → 普技轮转。
 */
export function stepBossSkills(state: BossSkillState, ctx: BossStepContext): BossSkillEvent[] {
  const table = BOSS_SKILL_TABLES[state.bossId];
  const events: BossSkillEvent[] = [];

  // —— CD 计时推进 ——
  for (const s of table.slots) {
    if (state.slotCds[s.slot] > 0) state.slotCds[s.slot] = Math.max(0, state.slotCds[s.slot] - ctx.dt);
  }

  // —— 阶段 2 触发（HP<50% → 1s 霸体 → 解锁节点）——
  if (bossPhase2Due(state, ctx.hpRatio)) {
    state.phase = 2;
    state.phaseGraceUntil = ctx.now + 1; // 转阶段霸体 1s（不承伤）
    events.push({ type: 'phase-changed', phase: 2 });
    const p2 = table.phase2;
    if (p2.extraSummon) {
      // 转阶段召唤（尼禄 2 圣杯侍僧；既有配置纳入 W-2 义务）
      events.push({ type: 'summon', enemyId: p2.extraSummon.enemyId, count: p2.extraSummon.count, noXp: true });
    }
  }

  // —— 预警释放（telegraph 到点 → 执行伤害/召唤 + 进 CD + 施法硬直）——
  if (state.casting && ctx.now >= state.casting.fireAt) {
    const skill = table.slots.find((s) => s.slot === state.casting!.slot)!;
    state.casting = null;
    state.castLockUntil = ctx.now + skill.castLock;
    if (skill.slot !== 'normal' && skill.damage > 0) {
      events.push({ type: 'skill-damage', slot: skill.slot, damage: skill.damage });
    }
    if (skill.summon) {
      const cap = bossSummonCap(state);
      if (state.summonsAlive + skill.summon.count <= cap && ctx.canSpawnMore) {
        state.summonsAlive += skill.summon.count;
        events.push({ type: 'summon', enemyId: skill.summon.enemyId, count: skill.summon.count, noXp: true });
      }
      // 上限封顶/同屏节流：召唤跳过（同源计数不混算，MN-23）
    }
    state.slotCds[skill.slot] = effectiveCd(state, skill);
  }

  // —— 普攻基底（间隔恒定循环；不受施法硬直影响 = 持续施压）——
  const normal = table.slots.find((s) => s.slot === 'normal')!;
  state.normalTimer += ctx.dt;
  if (state.normalTimer >= normal.cd) {
    state.normalTimer = 0;
    events.push({ type: 'normal-attack', damage: normal.damage });
  }

  // —— 普技轮转（预警中/施法硬直期不启动新技能；转阶段霸体期不启动）——
  if (
    state.casting === null &&
    ctx.now >= state.castLockUntil &&
    ctx.now >= state.phaseGraceUntil
  ) {
    for (let i = 0; i < ROTATION.length; i += 1) {
      const slot = ROTATION[(state.rotationCursor + i) % ROTATION.length]!;
      const skill = table.slots.find((s) => s.slot === slot)!;
      if (skillReady(state, skill)) {
        state.rotationCursor = (state.rotationCursor + i + 1) % ROTATION.length;
        state.casting = { slot, fireAt: ctx.now + skill.telegraph };
        events.push({ type: 'cast-start', slot, telegraph: skill.telegraph });
        break;
      }
    }
  }

  return events;
}

/** Boss 死亡清场（召唤物一并清除，不掉 XP；§③-7 E-0 ⑥ / MN-23） */
export function clearBossSummons(state: BossSkillState): number {
  const cleared = state.summonsAlive;
  state.summonsAlive = 0;
  return cleared;
}

/** 召唤物死亡释放计数（召唤物死亡释放计数 §⑥-4） */
export function reportBossSummonKilled(state: BossSkillState, count = 1): void {
  state.summonsAlive = Math.max(0, state.summonsAlive - count);
}
