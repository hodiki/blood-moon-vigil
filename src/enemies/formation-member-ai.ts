/**
 * enemies/formation-member-ai.ts —— 方阵个体 AI 运行时（P1-12，enemies-v3 §③-6 阵 5/6/8）
 *
 * 黑板（组级相位/事件）→ 个体运动语义。纯逻辑无 Phaser 依赖（test-framework §1.2）：
 * - 围猎（f_hunting_ambush）：两翼包抄环游（slot 奇偶分翼，180~220px 环带）→
 *   低伏 0.3s 冻结（ambush-crouch / phase='ritual'）→ 扑击（ambush-pounce：首帧锁向直线突进，可走位躲开）→ CD 回环
 * - 血旗（f_blood_banner）：斩旗（banner-broken）→ 组内全员溃散减速 50%/3s（applyBannerRout 纯函数）
 * - 骑士团（f_decayed_knights）：集团冲锋——警告 0.6s 蓄势驻停（方向跟踪 0.3s 后锁向）→
 *   全员 600px @500px/s 同向冲锋 → 落空硬直 1s → CD 回环
 *
 * 速度覆写当帧生效的调用契约：装配层（PlayScene）在 updateMovement 之后步进
 * （与精英技能 velocity 事件同模式，enemy.ts updateMovement 每帧重写 body.velocity）。
 */

import { applyStatus, type StatusState } from '@/combat/status/status-engine';
import type { CcProfile } from '@/combat/status/status-config';
import { BANNER_CONFIG, KNIGHTS_CONFIG } from '@/enemies/group-blackboard';

/** 个体成员最小形状（Enemy 满足；测试可注入 fake） */
export interface MemberEntityLike {
  x: number;
  y: number;
}

/** 副作用端口（velocity 覆写 / 溃散状态施加；装配层实现，测试可观测） */
export interface MemberAiPorts {
  setVelocity(entity: MemberEntityLike, vx: number, vy: number): void;
  rout(entity: MemberEntityLike): void;
}

/**
 * 工程锚（GDD 未定标参数，注释写死防漂移）：
 * - 环游带 180~220px（中值 = 审查基准 200px）、切向 160px/s、径向修正 2/s
 * - 扑击 320px/s × 0.6s（=192px 冲程，走位可躲）
 */
export const AMBUSH_MEMBER_AI = {
  orbitRadius: 200,
  orbitBand: [180, 220] as const,
  orbitSpeed: 160,
  radialGain: 2,
  pounceSpeed: 320,
  pounceSeconds: 0.6,
} as const;
/** 骑士团冲锋方向跟踪窗（GDD「跟踪 0.3」；此后锁向，直线冲锋可躲） */
export const KNIGHTS_TRACK_SECONDS = 0.3;

/** 血旗斩旗溃散：对单个成员施加 slow 50%/3s（纯函数；BANNER_CONFIG 锚） */
export function applyBannerRout(cc: StatusState, now: number, profile?: CcProfile): StatusState {
  return applyStatus(
    cc,
    { kind: 'slow', value: BANNER_CONFIG.routSlow, durationSeconds: BANNER_CONFIG.routDuration, source: 'banner-rout' },
    now,
    profile,
  ).state;
}

/** 逐帧步进的组输入（装配层从黑板 + 成员实体组装） */
export interface MemberAiGroupInput {
  groupId: string;
  behavior: string;
  phase: string;
  dissolved: boolean;
  members: Array<{ slotIndex: number; entity: MemberEntityLike | null }>;
  playerX: number;
  playerY: number;
}

interface PounceState {
  until: number;
  dirX: number;
  dirY: number;
}

interface KnightsWarnState {
  startedAt: number;
  dirX: number;
  dirY: number;
  locked: boolean;
}

interface KnightsChargeState {
  until: number;
  staggerUntil: number;
  dirX: number;
  dirY: number;
}

export class FormationMemberAI {
  /** groupId → 扑击状态（全员各自首帧锁向） */
  private pounces = new Map<string, PounceState>();
  /** groupId → 冲锋警告状态（0.6s 蓄势 + 0.3s 跟踪窗） */
  private knightsWarns = new Map<string, KnightsWarnState>();
  /** groupId → 冲锋/硬直状态 */
  private knightsCharges = new Map<string, KnightsChargeState>();

  /** 组级事件入口（黑板事件转发；now = 事件时刻秒） */
  onGroupEvent(ev: { type: string; groupId: string }, now: number): void {
    switch (ev.type) {
      case 'ambush-pounce':
        this.pounces.set(ev.groupId, { until: now + AMBUSH_MEMBER_AI.pounceSeconds, dirX: 0, dirY: 0 });
        break;
      case 'knights-charge-warn':
        this.knightsWarns.set(ev.groupId, { startedAt: now, dirX: 0, dirY: 0, locked: false });
        break;
      case 'knights-charge': {
        const warn = this.knightsWarns.get(ev.groupId);
        this.knightsWarns.delete(ev.groupId);
        if (warn) {
          this.knightsCharges.set(ev.groupId, {
            until: now + KNIGHTS_CONFIG.chargeDist / KNIGHTS_CONFIG.chargeSpeed,
            staggerUntil: now + KNIGHTS_CONFIG.chargeDist / KNIGHTS_CONFIG.chargeSpeed + KNIGHTS_CONFIG.recover,
            dirX: warn.dirX,
            dirY: warn.dirY,
          });
        }
        break;
      }
      default:
        break; // ambush-crouch / banner-broken 等：低伏由相位驱动、溃散由装配层在消费口结算
    }
  }

  /** 逐帧步进（updateMovement 之后调用；仅覆写组内成员速度，其余敌不受影响） */
  step(_dt: number, now: number, groups: MemberAiGroupInput[], ports: MemberAiPorts): void {
    for (const g of groups) {
      if (g.dissolved) continue;
      if (g.behavior === 'ambush') {
        this.stepAmbushGroup(g, now, ports);
      } else if (g.behavior === 'knights') {
        this.stepKnightsGroup(g, now, ports);
      }
      // 血旗成员不覆写速度（默认追踪；斩旗溃散 = 状态减速，走 applyBannerRout）
    }
  }

  /** 测试/重开清理 */
  reset(): void {
    this.pounces.clear();
    this.knightsWarns.clear();
    this.knightsCharges.clear();
  }

  // —— 围猎：环游（两翼反向）/ 低伏冻结 / 扑击突进 ——

  private stepAmbushGroup(g: MemberAiGroupInput, now: number, ports: MemberAiPorts): void {
    const pounceState = this.pounces.get(g.groupId);
    if (pounceState && now > pounceState.until) {
      this.pounces.delete(g.groupId);
    }
    const pounce = pounceState && now <= pounceState.until ? pounceState : undefined;
    for (const m of g.members) {
      const e = m.entity;
      if (!e) continue;
      if (pounce) {
        // 扑击：首帧锁向（向当时玩家位置的直线，可走位躲开），窗口内恒速突进
        if (pounce.dirX === 0 && pounce.dirY === 0) {
          const dx = g.playerX - e.x;
          const dy = g.playerY - e.y;
          const len = Math.hypot(dx, dy) || 1;
          pounce.dirX = dx / len;
          pounce.dirY = dy / len;
        }
        ports.setVelocity(e, pounce.dirX * AMBUSH_MEMBER_AI.pounceSpeed, pounce.dirY * AMBUSH_MEMBER_AI.pounceSpeed);
        continue;
      }
      if (g.phase === 'ritual') {
        // 低伏预警（0.3s）：冻结（可读的收拢前摇，玩家据此走位）
        ports.setVelocity(e, 0, 0);
        continue;
      }
      // 环游包抄：slot 奇偶分翼（两翼反向绕玩家），径向修正保持环带
      const wing = m.slotIndex % 2 === 0 ? 1 : -1;
      const dx = e.x - g.playerX;
      const dy = e.y - g.playerY;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;
      const tx = -ny * wing;
      const ty = nx * wing;
      const radialErr =
        dist > AMBUSH_MEMBER_AI.orbitBand[1]
          ? -(dist - AMBUSH_MEMBER_AI.orbitBand[1]) * AMBUSH_MEMBER_AI.radialGain
          : dist < AMBUSH_MEMBER_AI.orbitBand[0]
            ? (AMBUSH_MEMBER_AI.orbitBand[0] - dist) * AMBUSH_MEMBER_AI.radialGain
            : 0;
      const vx = tx * AMBUSH_MEMBER_AI.orbitSpeed + nx * radialErr;
      const vy = ty * AMBUSH_MEMBER_AI.orbitSpeed + ny * radialErr;
      const len = Math.hypot(vx, vy);
      if (len < 0.0001) {
        ports.setVelocity(e, 0, 0);
      } else {
        ports.setVelocity(e, (vx / len) * AMBUSH_MEMBER_AI.orbitSpeed, (vy / len) * AMBUSH_MEMBER_AI.orbitSpeed);
      }
    }
  }

  // —— 骑士团：蓄势驻停（跟踪 0.3s 后锁向）→ 同向冲锋 → 落空硬直 ——

  private stepKnightsGroup(g: MemberAiGroupInput, now: number, ports: MemberAiPorts): void {
    const warnState = this.knightsWarns.get(g.groupId);
    if (warnState && now > warnState.startedAt + KNIGHTS_CONFIG.chargeWindup) {
      this.knightsWarns.delete(g.groupId);
    }
    const warn = warnState && now <= warnState.startedAt + KNIGHTS_CONFIG.chargeWindup ? warnState : undefined;
    const chargeState = this.knightsCharges.get(g.groupId);
    if (chargeState && now > chargeState.staggerUntil) {
      this.knightsCharges.delete(g.groupId);
    }
    const charge = chargeState && now <= chargeState.staggerUntil ? chargeState : undefined;

    if (warn && !warn.locked && now - warn.startedAt < KNIGHTS_TRACK_SECONDS) {
      // 跟踪窗：组质心 → 玩家方向逐帧更新（0.3s 后锁向 = 直线冲锋，走位可躲）
      const dir = centroidDir(g);
      if (dir) {
        warn.dirX = dir.x;
        warn.dirY = dir.y;
      }
    } else if (warn && !warn.locked) {
      const dir = centroidDir(g);
      if (dir && (warn.dirX === 0 && warn.dirY === 0)) {
        warn.dirX = dir.x;
        warn.dirY = dir.y;
      }
      warn.locked = true;
    }

    for (const m of g.members) {
      const e = m.entity;
      if (!e) continue;
      if (charge) {
        if (now <= charge.until) {
          ports.setVelocity(e, charge.dirX * KNIGHTS_CONFIG.chargeSpeed, charge.dirY * KNIGHTS_CONFIG.chargeSpeed);
        } else {
          ports.setVelocity(e, 0, 0); // 落空硬直 1s
        }
        continue;
      }
      if (warn) {
        ports.setVelocity(e, 0, 0); // 蓄势驻停（警告 0.6s，可读冲锋前摇）
        continue;
      }
      // 默认追踪：不覆写（updateMovement 语义）
    }
  }
}

/** 组内存活成员质心 → 玩家方向（骑士团集团冲锋同向；无成员 → null） */
function centroidDir(g: MemberAiGroupInput): { x: number; y: number } | null {
  let cx = 0;
  let cy = 0;
  let n = 0;
  for (const m of g.members) {
    if (!m.entity) continue;
    cx += m.entity.x;
    cy += m.entity.y;
    n += 1;
  }
  if (n === 0) return null;
  const dx = g.playerX - cx / n;
  const dy = g.playerY - cy / n;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}
