/**
 * enemies/elite-skill-runtime.ts —— 精英技能化·运行时驱动（W-16，gdd-enemies-v3 §③-4 / MN-20）
 *
 * 无 Phaser 依赖（PlayScene / 沙盘共用）：每敌状态机（WeakMap）逐帧推进，
 * 产出伤害/位移/打断事件；telegraph 形状查询供 fx/telegraph-layer 演出（W-13）。
 *
 * - 位移类事件（冲刺/后撤步）返回 velocity 覆盖，由调用方写 body（引擎层零 Phaser）
 * - 石甲狼：无主动技能；石甲分池（hp 阈值判定破甲）+ 双阶段面板 + 石甲期减速 ×0.5（ccProfile）
 * - 伤害结算：调用方消费 skill-damage 事件走 player.hurt（技能伤独立字段语义）
 * - MN-20：windup 期命中眩晕 → 打断（末段 0.3s 锁定窗内不打断但消耗 ICD——ICD 在施加侧），
 *   打断 = 取消攻击 + CD ×50%
 */

import {
  ELITE_SKILLS,
  eliteInterruptible,
  interruptCd,
  stoneWolfBroken,
  STONE_WOLF_STONE_PHASE,
  STONE_WOLF_BROKEN_PHASE,
  type EliteSkillParams,
  type EliteSkillPhase,
} from '@/enemies/elite-skills';
import { isStunned, type StatusState } from '@/combat/status/status-engine';
import type { EnemyId } from '@/config/balance';

/** 精英实体最小形状（Enemy 满足；body = Arcade Body 最小形状供位移覆盖） */
export interface EliteEnemyLike {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  enemyId: EnemyId | null;
  cc: StatusState;
  speed: number;
  baseAttackInterval: number;
  attackInterval: number;
  /** 位移覆盖写入口（Arcade Body；setVelocity） */
  body?: { setVelocity(x: number, y: number): void };
}

/** 单帧位移覆盖（调用方写 body.setVelocity；null = 不覆盖） */
export interface EliteVelocityOverride {
  enemy: EliteEnemyLike;
  vx: number;
  vy: number;
}

export type EliteSkillEvent =
  | { type: 'skill-damage'; eliteId: EnemyId; damage: number; x: number; y: number }
  | { type: 'interrupted'; eliteId: EnemyId }
  | { type: 'bloodstain'; x: number; y: number }
  | { type: 'armor-broken'; x: number; y: number }
  | { type: 'velocity'; override: EliteVelocityOverride };

/** telegraph 演出查询（W-13 消费；null = 无预警） */
export interface EliteTelegraph {
  elite: EliteEnemyLike;
  shape: 'arc' | 'dash-line' | 'warning-circle' | 'volley-line';
  /** 渐亮进度 0~1 */
  alpha: number;
  /** 朝向（玩家方向 rad） */
  angle: number;
  range: number;
}

interface EliteState {
  phase: EliteSkillPhase;
  phaseElapsed: number;
  cdRemaining: number;
  lockedDir: { x: number; y: number } | null;
  shotsFired: number;
  armorBroken: boolean;
  /** 石甲/破甲面板已应用的相位（防重复应用） */
  armorPhaseApplied: 'stone' | 'broken' | null;
}

export class EliteSkillDirector {
  private states = new WeakMap<EliteEnemyLike, EliteState>();

  update(dt: number, now: number, player: { x: number; y: number }, elites: EliteEnemyLike[]): EliteSkillEvent[] {
    const events: EliteSkillEvent[] = [];
    for (const elite of elites) {
      if (!elite.enemyId) continue;
      const params = ELITE_SKILLS[elite.enemyId as keyof typeof ELITE_SKILLS];
      const state = this.stateFor(elite);
      if (params) this.stepSkill(elite, params, state, dt, now, player, events);
      else if (elite.enemyId === 'enemy_g3_3') this.stepStoneWolf(elite, state, dt, events);
    }
    return events;
  }

  /** W-13 telegraph 查询（逐帧绘制用） */
  telegraphOf(elite: EliteEnemyLike, player: { x: number; y: number }): EliteTelegraph | null {
    if (!elite.enemyId) return null;
    const params = ELITE_SKILLS[elite.enemyId as keyof typeof ELITE_SKILLS];
    const state = this.states.get(elite);
    if (!params || !state) return null;
    const angle = Math.atan2(player.y - elite.y, player.x - elite.x);
    if (state.phase === 'windup') {
      return { elite, shape: params.shape, alpha: Math.min(1, state.phaseElapsed / params.windup), angle, range: params.range };
    }
    if (state.phase === 'warning') {
      return { elite, shape: params.shape, alpha: 0.9, angle, range: params.range };
    }
    return null;
  }

  private stepSkill(
    elite: EliteEnemyLike,
    params: EliteSkillParams,
    state: EliteState,
    dt: number,
    now: number,
    player: { x: number; y: number },
    events: EliteSkillEvent[],
  ): void {
    // CD 计时
    if (state.cdRemaining > 0) {
      state.cdRemaining = Math.max(0, state.cdRemaining - dt);
      return;
    }
    const dist = Math.hypot(player.x - elite.x, player.y - elite.y);
    const stunned = isStunned(elite.cc, now);

    switch (state.phase) {
      case 'idle': {
        if (params.eliteId === 'enemy_g1_8') this.stepBonethrowerKeepDist(elite, dist, params, state, player, events);
        else if (params.eliteId === 'enemy_g2_5') this.stepPenitentKeepDist(elite, dist, params, state, player, events);
        else if (dist <= params.triggerDist) this.enterWindup(elite, params, state, player);
        return;
      }
      case 'windup': {
        // MN-20：眩晕打断（末段锁定窗内不打断——霸体；ICD 已在施加侧消耗）
        if (stunned && eliteInterruptible(params, 'windup', state.phaseElapsed)) {
          state.phase = 'idle';
          state.phaseElapsed = 0;
          state.cdRemaining = interruptCd(params);
          events.push({ type: 'interrupted', eliteId: params.eliteId });
          return;
        }
        state.phaseElapsed += dt;
        if (state.phaseElapsed >= params.windup) {
          state.phase = 'warning';
          state.phaseElapsed = 0;
        }
        return;
      }
      case 'warning': {
        state.phaseElapsed += dt;
        if (state.phaseElapsed >= Math.max(params.telegraph, 0.0001)) {
          state.phase = 'active';
          state.phaseElapsed = 0;
          state.shotsFired = 0;
        }
        return;
      }
      case 'active': {
        state.phaseElapsed += dt;
        if (params.shape === 'dash-line') {
          // 锁定冲刺：固定方向固定距离（300px @450px/s）；命中判定 = 线半宽 30px
          const vx = (state.lockedDir?.x ?? 0) * 450;
          const vy = (state.lockedDir?.y ?? 0) * 450;
          events.push({ type: 'velocity', override: { enemy: elite, vx, vy } });
          if (dist <= params.range && state.shotsFired === 0) {
            state.shotsFired = 1;
            events.push({ type: 'skill-damage', eliteId: params.eliteId, damage: params.damage, x: elite.x, y: elite.y });
          }
        } else if (params.shape === 'warning-circle' || params.shape === 'volley-line') {
          // 连射（掷骨者 3×18 / 忏悔者 3×8）：间隔 activeDur/3 逐发；落点 = 玩家当前位置（跟踪系数 0.2 桩）
          const interval = params.activeDur / 3;
          if (state.shotsFired < 3 && state.phaseElapsed >= interval * (state.shotsFired + 1)) {
            state.shotsFired += 1;
            events.push({ type: 'skill-damage', eliteId: params.eliteId, damage: params.damage, x: elite.x, y: elite.y });
            if (params.eliteId === 'enemy_g2_5') events.push({ type: 'bloodstain', x: player.x, y: player.y });
          }
        } else if (state.shotsFired === 0) {
          // arc 扫：130px 内命中（180° 扇形 1D 近似：正面半平面 + 半径）
          state.shotsFired = 1;
          if (dist <= params.range) {
            events.push({ type: 'skill-damage', eliteId: params.eliteId, damage: params.damage, x: elite.x, y: elite.y });
          }
        }
        if (state.phaseElapsed >= params.activeDur) {
          state.phase = 'recover';
          state.phaseElapsed = 0;
          if (params.shape === 'dash-line') events.push({ type: 'velocity', override: { enemy: elite, vx: 0, vy: 0 } });
        }
        return;
      }
      case 'recover': {
        // 硬直 = 反制输出窗（移动继续由默认 AI 驱动）
        state.phaseElapsed += dt;
        if (state.phaseElapsed >= params.recover) {
          state.phase = 'idle';
          state.phaseElapsed = 0;
          state.cdRemaining = params.cd;
        }
        return;
      }
    }
  }

  /** 掷骨者保持距离（200~260 游走；近身 80 → 后撤步 150px，CD 3） */
  private stepBonethrowerKeepDist(
    elite: EliteEnemyLike,
    dist: number,
    params: EliteSkillParams,
    state: EliteState,
    player: { x: number; y: number },
    events: EliteSkillEvent[],
  ): void {
    if (dist < 80) {
      // 后撤步：方向固定 = 背向玩家（可预判绕截），CD 3s（与主 CD 分离走 cdRemaining 复用）
      const dx = elite.x - player.x;
      const dy = elite.y - player.y;
      const len = Math.hypot(dx, dy) || 1;
      state.cdRemaining = 3;
      state.phaseElapsed = 0;
      events.push({ type: 'velocity', override: { enemy: elite, vx: (dx / len) * 300, vy: (dy / len) * 300 } });
      return;
    }
    state.cdRemaining = Math.max(0, state.cdRemaining - 1 / 60);
    if (dist <= params.triggerDist && state.cdRemaining <= 0) {
      this.enterWindup(elite, params, state, player);
    }
  }

  /** 忏悔者保持距离（260~320；边退边射；近身 80 后撤步 120px CD 3） */
  private stepPenitentKeepDist(
    elite: EliteEnemyLike,
    dist: number,
    params: EliteSkillParams,
    state: EliteState,
    player: { x: number; y: number },
    events: EliteSkillEvent[],
  ): void {
    if (dist < 80) {
      const dx = elite.x - player.x;
      const dy = elite.y - player.y;
      const len = Math.hypot(dx, dy) || 1;
      state.cdRemaining = 3;
      events.push({ type: 'velocity', override: { enemy: elite, vx: (dx / len) * 300, vy: (dy / len) * 300 } });
      return;
    }
    if (dist <= params.triggerDist && state.cdRemaining <= 0) {
      this.enterWindup(elite, params, state, player);
    }
  }

  /** 石甲狼双阶段（§③-4-3）：无技能 CD；石甲池 = hp 阈值（>body 池 = 石甲期） */
  private stepStoneWolf(
    elite: EliteEnemyLike,
    state: EliteState,
    dt: number,
    events: EliteSkillEvent[],
  ): void {
    void dt;
    const split = elite.maxHp; // 面板 400 = 石甲 240 + 本体 160（阈值 40% 处破碎）
    const bodyThreshold = split - Math.round(split * 0.6);
    const broken = elite.hp <= bodyThreshold || state.armorBroken;
    if (broken && !state.armorBroken) {
      state.armorBroken = true;
      events.push({ type: 'armor-broken', x: elite.x, y: elite.y });
    }
    const phase = broken ? 'broken' : 'stone';
    if (state.armorPhaseApplied !== phase) {
      state.armorPhaseApplied = phase;
      const stats = broken ? STONE_WOLF_BROKEN_PHASE : STONE_WOLF_STONE_PHASE;
      // 面板重写：speed 基准 45（石甲期 36 / 破甲 48.6≈×1.35）；interval 抬手 ×1.3 / 攻速 ÷1.4
      const baseSpeed = 45;
      elite.speed = baseSpeed * (broken ? STONE_WOLF_BROKEN_PHASE.speedMult : STONE_WOLF_STONE_PHASE.speedMult);
      elite.attackInterval = elite.baseAttackInterval * (broken ? 1 / STONE_WOLF_BROKEN_PHASE.intervalDiv : STONE_WOLF_STONE_PHASE.intervalMult);
      void stats;
    }
    if (stoneWolfBroken(state.armorBroken ? 0 : elite.hp - bodyThreshold)) {
      state.armorBroken = true;
    }
  }

  private enterWindup(elite: EliteEnemyLike, params: EliteSkillParams, state: EliteState, player: { x: number; y: number }): void {
    state.phase = 'windup';
    state.phaseElapsed = 0;
    // 蓄力开始瞬间锁定方向与距离（畸体：固定方向固定距离；其余朝玩家）
    const dx = player.x - elite.x;
    const dy = player.y - elite.y;
    const len = Math.hypot(dx, dy) || 1;
    state.lockedDir = { x: dx / len, y: dy / len };
    void params;
  }

  private stateFor(e: EliteEnemyLike): EliteState {
    let s = this.states.get(e);
    if (!s) {
      s = { phase: 'idle', phaseElapsed: 0, cdRemaining: 0, lockedDir: null, shotsFired: 0, armorBroken: false, armorPhaseApplied: null };
      this.states.set(e, s);
    }
    return s;
  }
}
