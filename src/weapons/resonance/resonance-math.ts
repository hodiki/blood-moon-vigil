/**
 * weapons/resonance/resonance-math.ts —— 8 对共鸣结算数学层（B4-W2，gdd-resonance §④ 八字段模板）
 *
 * 纯函数（test-framework §1.2；tools/sim 沙盘同源复用——W4 对照采样）。
 * **未共鸣形态零变化**（验收判据 1）：本层函数仅在 ResonanceState 达成后被装配层调用；
 * 未达成路径不经过本层（回归断言：普通形态 DPS/行为断言不引本模块）。
 * CC 一律走 status-engine.applyStatus（R-1 眩晕带 10s ICD / R-3 易伤 / R-4 减速）；
 * R-7 拖拽为位移非状态（不走 ICD）。
 */

import type { ResonancePairConfig } from '@/config/balance';
import { damageTakenMultiplier, type StatusState } from '@/combat/status/status-engine';
import { applyStatusWithImmuneFeedback } from '@/combat/status/immune-feedback';
import { hitEnemy } from '@/combat/damage';
import type { ExclusiveTarget } from '@/weapons/exclusive/exclusive-math';
import { grantAmmo, type AmmoState } from '@/weapons/ammo';

/** 结算结果（遥测/DPS 对照采样） */
export interface ResonanceStepResult {
  damageDealt: number;
  kills: number;
  events: string[];
}

/** 无状态载荷目标的空载荷（遥测 dealt 口径；易伤乘区恒 1） */
const EMPTY_CC: StatusState = { stun: null, slow: null, vulnerable: null, stunIcdReadyAt: 0 };

function emptyResult(): ResonanceStepResult {
  return { damageDealt: 0, kills: 0, events: [] };
}

function dealDamage(target: ExclusiveTarget, amount: number, now: number, result: ResonanceStepResult): void {
  if (!target.active || target.hp <= 0) return;
  // P0-3：易伤乘区统一由 damage.hitEnemy 结算（本层不自乘，防倍增）
  const dealt = Math.min(target.hp, amount * damageTakenMultiplier(target.cc ?? EMPTY_CC, now));
  if (hitEnemy(target as unknown as { hp: number; kill(): void }, amount, now)) {
    result.kills += 1;
  }
  result.damageDealt += dealt;
}

function applyCc(target: ExclusiveTarget, kind: 'stun' | 'slow' | 'vulnerable', value: number, duration: number, now: number, source: string): void {
  if (!target.cc) return;
  // applyStatus 纯函数返回新状态——必须写回；P2-7②：Boss 硬控免疫 → StatusImmune 飘字
  target.cc = applyStatusWithImmuneFeedback(target.cc, { kind, value, durationSeconds: duration, source }, now, target, target.ccProfile).state;
}

function distSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

// ============================================================================
// R-1 守夜环灯（提灯 × 守夜之环）：环带沿灯环边缘巡行 + 6伤/0.4s/目标 + 0.5s 眩晕 10s ICD
// ============================================================================

export interface ResonanceLanternState {
  /** 环带角度（deg，240°/s 维持） */
  angle: number;
  /** 同目标触碰内置冷却（0.4s） */
  hitAt: Map<ExclusiveTarget, number>;
  totalDamage: number;
}

export function createResonanceLanternState(): ResonanceLanternState {
  return { angle: 0, hitAt: new Map(), totalDamage: 0 };
}

/**
 * R-1 环带帧步进。ringRadius = 灯环当前半径（exclusive-math machine.auraRadius 同源——
 * 质变卡 1 长明灯阵 135px 时环带同步外扩）。眩晕走状态层（10s ICD 由 StatusState 承载）。
 */
export function stepResonanceLantern(
  state: ResonanceLanternState,
  dt: number,
  now: number,
  player: { x: number; y: number },
  enemies: readonly ExclusiveTarget[],
  damageMultiplier: number,
  machine: Readonly<Record<string, number>>,
  ringRadius: number,
): ResonanceStepResult {
  const result = emptyResult();
  state.angle = (state.angle + (machine['angularSpeedDeg'] ?? 240) * dt) % 360;
  const touchDamage = (machine['touchDamage'] ?? 6) * damageMultiplier;
  const interval = machine['touchInterval'] ?? 0.4;
  // 3 颗球均布环带（守夜之环 baseCount 3 语义延续）
  for (let i = 0; i < 3; i += 1) {
    const a = ((state.angle + (360 / 3) * i) * Math.PI) / 180;
    const fx = player.x + Math.cos(a) * ringRadius;
    const fy = player.y + Math.sin(a) * ringRadius;
    for (const e of enemies) {
      if (!e.active || e.hp <= 0) continue;
      const last = state.hitAt.get(e) ?? -Infinity;
      if (now - last < interval) continue;
      if (distSq(e.x, e.y, fx, fy) > (e.radius + 8) * (e.radius + 8)) continue;
      state.hitAt.set(e, now);
      dealDamage(e, touchDamage, now, result);
      // 0.5s 眩晕（10s ICD 由状态层承载；Boss 免疫 / 精英 0.5s→0.25s 由抗性解析）
      applyCc(e, 'stun', 1, machine['stunDuration'] ?? 0.5, now, 'resonance_R1');
      result.events.push('bandTouch');
    }
  }
  state.totalDamage += result.damageDealt;
  return result;
}

// ============================================================================
// R-2 银潮轮舞（左轮 × 银针连弩）：连弩每命中 3 次 → 左轮回充 1 弹
// ============================================================================

export interface ResonanceRevolverFeedState {
  /** 连弩命中累计（恒 3 次/弹，不受通武强化影响——§④ 强化正交行） */
  hitCounter: number;
  totalGrants: number;
}

export function createResonanceRevolverFeedState(): ResonanceRevolverFeedState {
  return { hitCounter: 0, totalGrants: 0 };
}

/** 连弩命中回调（装配层每次连弩命中调用；hitsPerReload 恒 3） */
export function onResonanceCrossbowHit(
  state: ResonanceRevolverFeedState,
  revolverAmmo: AmmoState,
  machine: Readonly<Record<string, number>>,
): boolean {
  state.hitCounter += 1;
  const need = machine['hitsPerReload'] ?? 3;
  if (state.hitCounter >= need) {
    state.hitCounter = 0;
    grantAmmo(revolverAmmo, 1);
    state.totalGrants += 1;
    return true; // 回充事件（遥测/联动脉冲指示）
  }
  return false;
}

// ============================================================================
// R-3 血月回旋（双刃 × 幽灵飞刃）：飞刃挂血契印记 + 双刃对印记 ×1.2
// ============================================================================

export interface ResonanceTwinbladesMarkState {
  totalMarks: number;
}

export function createResonanceTwinbladesMarkState(): ResonanceTwinbladesMarkState {
  return { totalMarks: 0 };
}

/** 飞刃命中回调：挂血契印记（易伤 +15%/5s，无 ICD；独立加成段） */
export function onResonanceBoomerangHit(
  state: ResonanceTwinbladesMarkState,
  target: ExclusiveTarget,
  now: number,
  machine: Readonly<Record<string, number>>,
): void {
  applyCc(target, 'vulnerable', machine['markVulnerable'] ?? 0.15, machine['markDuration'] ?? 5, now, 'resonance_R3');
  state.totalMarks += 1;
}

/** 双刃斩击伤害加成：持 R-3 印记（source=resonance_R3）×1.2（固定值不随强化变化）；否则 ×1 */
export function resonanceTwinbladesDamageMult(target: ExclusiveTarget, now: number, machine: Readonly<Record<string, number>>): number {
  const v = target.cc?.vulnerable;
  return v && now < v.until && v.source === 'resonance_R3' ? machine['twinbladesMarkMult'] ?? 1.2 : 1;
}

// ============================================================================
// R-4 猎月贯钉（长弓 × 骨钉标枪）：满蓄同步 → 标枪贯穿 6 + 终点月痕图腾
// ============================================================================

export interface ResonanceTotem {
  x: number;
  y: number;
  until: number;
}

export interface ResonanceJavelinState {
  totems: ResonanceTotem[];
  totalDamage: number;
}

export function createResonanceJavelinState(): ResonanceJavelinState {
  return { totems: [], totalDamage: 0 };
}

/** 长弓满蓄窗口同步：返回本发标枪贯穿数（满蓄 6 / 普通 3——§④ 贯穿走廊） */
export function resonanceJavelinPierce(longbowCharged: boolean, machine: Readonly<Record<string, number>>): number {
  return longbowCharged ? machine['chargedPierce'] ?? 6 : 3;
}

/** 标枪落点插钉成月痕图腾（60px 减速 15%/2s；无伤害） */
export function placeResonanceTotem(
  state: ResonanceJavelinState,
  x: number,
  y: number,
  now: number,
  machine: Readonly<Record<string, number>>,
): void {
  state.totems.push({ x, y, until: now + (machine['totemDuration'] ?? 2) });
}

/** 图腾帧步进：域内减速 15%（软控无 ICD）；到期移除 */
export function stepResonanceTotems(
  state: ResonanceJavelinState,
  dt: number,
  now: number,
  enemies: readonly ExclusiveTarget[],
  machine: Readonly<Record<string, number>>,
): void {
  void dt;
  for (let i = state.totems.length - 1; i >= 0; i -= 1) {
    const t = state.totems[i]!;
    if (now >= t.until) {
      state.totems.splice(i, 1);
      continue;
    }
    const r = machine['totemRadius'] ?? 60;
    for (const e of enemies) {
      if (!e.active || e.hp <= 0) continue;
      if (distSq(e.x, e.y, t.x, t.y) > r * r) continue;
      applyCc(e, 'slow', machine['totemSlowPct'] ?? 0.15, 0.5, now, 'resonance_R4');
    }
  }
}

// ============================================================================
// R-5 圣域壁垒（圣铃 × 圣光壁垒）：圣域参数（−18% 减伤 + 墓碑转化率 +20pp）
// ============================================================================

/** 圣域参数（共鸣固定值，§④ 强化正交行；装配层经 PlayerStats/oathkeeper machine 消费） */
export function resonanceSanctuaryBonus(machine: Readonly<Record<string, number>>): { damageReductionPct: number; reviveConvertBonusPp: number } {
  return {
    damageReductionPct: machine['damageReductionPct'] ?? 0.18,
    reviveConvertBonusPp: machine['reviveConvertBonusPp'] ?? 20,
  };
}

// ============================================================================
// R-6 圣火十诫（十字 × 审判圣火）：十字落点余焰（100px 8伤/s 3s）
// ============================================================================

export interface ResonanceResidue {
  x: number;
  y: number;
  until: number;
}

export interface ResonanceCrossState {
  residues: ResonanceResidue[];
  totalDamage: number;
}

export function createResonanceCrossState(): ResonanceCrossState {
  return { residues: [], totalDamage: 0 };
}

/** 十字落点残留余焰（每次落点回调）。
 *  P2-5（GDD R-6 FQ-3）：durationMult = key_bone 兽骨图腾「地面火时长 +20%」乘区（持钥 ×1.2，空钥恒等）。 */
export function onResonanceCrossExplode(
  state: ResonanceCrossState,
  x: number,
  y: number,
  now: number,
  machine: Readonly<Record<string, number>>,
  durationMult = 1,
): void {
  state.residues.push({ x, y, until: now + (machine['residueDuration'] ?? 3) * durationMult });
}

/** 余焰帧步进（8 伤/s；独立伤害段；随审判圣火通武强化放大——damageMultiplier 传入） */
export function stepResonanceResidues(
  state: ResonanceCrossState,
  dt: number,
  now: number,
  enemies: readonly ExclusiveTarget[],
  damageMultiplier: number,
  machine: Readonly<Record<string, number>>,
): ResonanceStepResult {
  const result = emptyResult();
  for (let i = state.residues.length - 1; i >= 0; i -= 1) {
    const r = state.residues[i]!;
    if (now >= r.until) {
      state.residues.splice(i, 1);
      continue;
    }
    const radius = machine['residueRadius'] ?? 100;
    for (const e of enemies) {
      if (!e.active || e.hp <= 0) continue;
      if (distSq(e.x, e.y, r.x, r.y) > radius * radius) continue;
      dealDamage(e, (machine['residueDps'] ?? 8) * damageMultiplier * dt, now, result);
    }
  }
  state.totalDamage += result.damageDealt;
  return result;
}

// ============================================================================
// R-7 葬仪断罪（巨斧 × 断罪锁链）：击退改拖拽 + 被拖拽者斧伤 ×1.5
// ============================================================================

export interface ResonanceDragState {
  /** 被拖拽者（至下次巨斧挥击结算或死亡/超窗失效） */
  dragged: ExclusiveTarget | null;
  totalDrags: number;
}

export function createResonanceDragState(): ResonanceDragState {
  return { dragged: null, totalDrags: 0 };
}

/**
 * 锁链命中回调：击退改拖拽——200px 内命中敌人拉至巨斧弧心（位移非状态，不走 ICD）。
 * 返回拖拽落点（弧心 = 玩家位置 + 面向弧半径；1D 模型简化为玩家位置近旁）。
 * 拖拽目标已死亡 → 拖拽无效化（§⑦-3），伤害段不落空（后续斩击正常结算其他目标）。
 */
export function onResonanceChainHit(
  state: ResonanceDragState,
  target: ExclusiveTarget,
  player: { x: number; y: number },
  machine: Readonly<Record<string, number>>,
): { x: number; y: number } | null {
  const range = machine['dragRange'] ?? 200;
  if (!target.active || target.hp <= 0 || distSq(target.x, target.y, player.x, player.y) > range * range) return null;
  state.dragged = target;
  state.totalDrags += 1;
  return { x: player.x, y: player.y }; // 拉至弧心（1D 径向模型：玩家位）
}

/** 巨斧斩击伤害加成：目标为被拖拽者 ×1.5；否则 ×1 */
export function resonanceAxeDamageMult(target: ExclusiveTarget, drag: ResonanceDragState, machine: Readonly<Record<string, number>>): number {
  return drag.dragged === target ? machine['draggedAxeDamageMult'] ?? 1.5 : 1;
}

/** 挥击结算后清拖拽标记（一次性喂食） */
export function consumeResonanceDrag(drag: ResonanceDragState): void {
  drag.dragged = null;
}

// ============================================================================
// R-8 狼群誓约（号角 × 狼影猎犬）：猎犬入编狼群（上限共享 + 集火 + 狂化加成）
// ============================================================================

/**
 * 共享召唤上限计数（§⑦-2 上限冲突）：月狼 + 猎犬合计 ≤ maxWolves。
 * 猎犬在场时月狼召唤请求在上限满时静默丢弃；猎犬消失瞬间释放锁存请求（1 次防连刷）。
 */
export function sharedSummonCount(wolves: number, hound: boolean, maxWolves: number): { canSummonWolf: boolean; latchedRequest: boolean } {
  const total = wolves + (hound ? 1 : 0);
  const canSummonWolf = total < maxWolves;
  return { canSummonWolf, latchedRequest: !canSummonWolf };
}

/** 猎犬狂化加成（长夜月啸期 ×2 伤同样生效） */
export function resonanceHoundDamageMult(hornRageActive: boolean, machine: Readonly<Record<string, number>>): number {
  return hornRageActive ? machine['rageDamageMult'] ?? 2 : 1;
}

// ============================================================================
// 装配辅助
// ============================================================================

/** 配对结算机器参数（pair.machine 便捷取用） */
export function pairMachine(pair: ResonancePairConfig | undefined): Readonly<Record<string, number>> {
  return pair?.machine ?? {};
}

