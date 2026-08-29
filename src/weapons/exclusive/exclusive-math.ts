/**
 * weapons/exclusive/exclusive-math.ts —— 8 专武结算数学层（gdd-exclusive-weapons §4 锚点）
 *
 * 纯函数（test-framework §1.2：可脱离 Phaser 单测；tools/sim 沙盘同源复用——B2-W6 接真基础）。
 * 命中模型：**即时结算近似**（发射即按命中路径结算，弹体飞行/精灵表现 = B6 视觉批欠账，
 * 在各函数注释登记）。CC 一律走状态层 applyStatus（含 resolveCcResistance 抗性），不绕层。
 *
 * 装配：exclusive-behaviors.ts 把本层包成 WeaponBehavior 注册进 WeaponRegistry；
 * 质变卡参数经 MUTATION_CARDS.machine 写入 state（applyMutationCard）。
 */

import {
  EXCLUSIVE_WEAPONS,
} from '@/config/balance';
import { applyStatus, damageTakenMultiplier, type StatusState } from '@/combat/status/status-engine';
import type { CcProfile } from '@/combat/status/status-config';
import { hitEnemy } from '@/combat/damage';
import { fullAmmo, consumeAmmo, tickReload, grantAmmo, type AmmoState } from '@/weapons/ammo';

// ============================================================================
// 通用目标/玩家接口（Enemy 结构性满足；Oathkeeper/月狼等友方实体不在此列）
// ============================================================================

/** 专武可结算目标（Enemy 结构性满足：active/x/y/radius/hp/kill + cc 载荷 + tier/阵营） */
export interface ExclusiveTarget {
  readonly active: boolean;
  x: number;
  y: number;
  radius: number;
  hp: number;
  kill(): void;
  /** CC 状态载荷（B2 起 Enemy 恒有；纯测试桩可省 = 跳过 CC 施加） */
  cc?: StatusState;
  /** CC 抗性画像（tier/逐敌覆写；缺省 = 普通敌） */
  ccProfile?: CcProfile;
  /** 阵营/类别（圣铃钟鸣「亡者类」判定用；Enemy.kind 为 EnemyKindId） */
  kind?: string;
  /** 击杀回调挂点（左轮处决装填补弹 / 巨斧击杀回血 / 双刃血爆计数用；缺省无） */
  onKilled?: (target: ExclusiveTarget) => void;
}

/** 专武宿主玩家接口（Player 结构性满足） */
export interface ExclusivePlayerLike {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

/** 结算结果（遥测口径：totalDamage 累计供占比/沙盘 DPS 采样） */
export interface StepResult {
  damageDealt: number;
  kills: number;
  /** 本帧事件（遥测/表现层消费：fired/burst/summon/ember/heal） */
  events: string[];
}

function emptyStep(): StepResult {
  return { damageDealt: 0, kills: 0, events: [] };
}

/** 对目标结算伤害（易伤乘区并入；击杀回调 + kill 计数） */
function dealDamage(
  target: ExclusiveTarget,
  amount: number,
  now: number,
  result: StepResult,
): void {
  if (!target.active || target.hp <= 0) return;
  const vuln = target.cc ? damageTakenMultiplier(target.cc, now) : 1;
  const dealt = Math.min(target.hp, amount * vuln);
  if (hitEnemy(target as unknown as { hp: number; kill(): void }, amount * vuln)) {
    result.kills += 1;
    target.onKilled?.(target);
  }
  result.damageDealt += dealt;
}

/** 对目标施加 CC（未接载荷目标静默跳过；reason 遥测可后接） */
function applyCc(
  target: ExclusiveTarget,
  kind: 'stun' | 'slow' | 'vulnerable',
  value: number,
  duration: number,
  now: number,
  source: string,
): void {
  if (!target.cc) return;
  // applyStatus 为纯函数（返回新状态）——必须写回目标载荷
  target.cc = applyStatus(target.cc, { kind, value, durationSeconds: duration, source }, now, target.ccProfile).state;
}

/** 距离平方（圆检测用） */
function distSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

// ============================================================================
// 1. 破旧提灯（B 环绕/领域：常驻灯环 tick + 减速；卡1 巡游灯焰；卡2 击杀残焰）
// ============================================================================

export interface LanternEmber {
  x: number;
  y: number;
  until: number;
}

export interface LanternState {
  tickTimer: number;
  /** 卡 1 巡游灯焰角度（deg） */
  orbitFlameAngle: number;
  orbitFlameHitAt: Map<ExclusiveTarget, number>;
  /** 卡 2 在场残焰（上限 5） */
  embers: LanternEmber[];
  totalDamage: number;
}

export function createLanternState(): LanternState {
  return { tickTimer: 0, orbitFlameAngle: 0, orbitFlameHitAt: new Map(), embers: [], totalDamage: 0 };
}

/** 提灯帧步进。machine（质变卡覆写键）缺省 = 基础形态。 */
export function stepLantern(
  state: LanternState,
  dt: number,
  now: number,
  player: ExclusivePlayerLike,
  enemies: readonly ExclusiveTarget[],
  damageMultiplier: number,
  machine: Readonly<Record<string, number>> = {},
): StepResult {
  const result = emptyStep();
  const base = EXCLUSIVE_WEAPONS.xw_lantern.params;
  const radius = machine['auraRadius'] ?? base.radius!;
  const tickDamage = base.damage!;
  const tickInterval = base.interval!;
  const slowPct = machine['slowPct'] ?? base.slowPct!;
  const orbitFlames = machine['orbitFlameCount'] ?? 0;
  const emberEnabled = (machine['emberMax'] ?? 0) > 0;

  state.tickTimer -= dt;
  const rSq = radius * radius;
  if (state.tickTimer <= 0) {
    state.tickTimer = tickInterval;
    for (const e of enemies) {
      if (!e.active || e.hp <= 0) continue;
      if (distSq(e.x, e.y, player.x, player.y) > rSq) continue;
      const dmg = tickDamage * damageMultiplier * (1 + state.embers.length * (machine['emberBodyBonusPct'] ?? 0));
      dealDamage(e, dmg, now, result);
      applyCc(e, 'slow', slowPct, 0.5, now, 'xw_lantern'); // 常驻随在场刷新（§④）
      if (emberEnabled && e.hp <= 0 && state.embers.length < (machine['emberMax'] ?? 5)) {
        state.embers.push({ x: e.x, y: e.y, until: now + (machine['emberDuration'] ?? 3) });
        result.events.push('ember');
      }
    }
  }

  // 卡 1 巡游灯焰：4 盏绕玩家 180°/s，触碰 6 伤/0.4s/目标（同目标内置 CD）
  if (orbitFlames > 0) {
    state.orbitFlameAngle = (state.orbitFlameAngle + 180 * dt) % 360;
    const flameRadius = radius;
    const flameDamage = (machine['orbitFlameDamage'] ?? 6) * damageMultiplier;
    for (let i = 0; i < orbitFlames; i += 1) {
      const angle = ((state.orbitFlameAngle + (360 / orbitFlames) * i) * Math.PI) / 180;
      const fx = player.x + Math.cos(angle) * flameRadius;
      const fy = player.y + Math.sin(angle) * flameRadius;
      for (const e of enemies) {
        if (!e.active || e.hp <= 0) continue;
        const last = state.orbitFlameHitAt.get(e) ?? -Infinity;
        if (now - last < (machine['orbitFlameInterval'] ?? 0.4)) continue;
        if (distSq(e.x, e.y, fx, fy) > (e.radius + 8) * (e.radius + 8)) continue;
        state.orbitFlameHitAt.set(e, now);
        dealDamage(e, flameDamage, now, result);
      }
    }
  }

  // 卡 2 残焰 tick：60px 内 8 伤/s + 减速 10%；过期移除
  for (let i = state.embers.length - 1; i >= 0; i -= 1) {
    const ember = state.embers[i]!;
    if (now >= ember.until) {
      state.embers.splice(i, 1);
      continue;
    }
    const emberR = machine['emberRadius'] ?? 60;
    for (const e of enemies) {
      if (!e.active || e.hp <= 0) continue;
      if (distSq(e.x, e.y, ember.x, ember.y) > emberR * emberR) continue;
      dealDamage(e, (machine['emberDps'] ?? 8) * damageMultiplier * dt, now, result);
      applyCc(e, 'slow', machine['emberSlowPct'] ?? 0.1, 0.5, now, 'xw_lantern_ember');
    }
  }

  state.totalDamage += result.damageDealt;
  return result;
}

// ============================================================================
// 2. 圣徒左轮（A 投射 + 弹药；卡1 圣痕连锁弹射；卡2 处决装填）
// ============================================================================

export interface RevolverState {
  ammo: AmmoState;
  fireTimer: number;
  totalDamage: number;
}

export function createRevolverState(machine: Readonly<Record<string, number>> = {}): RevolverState {
  const base = EXCLUSIVE_WEAPONS.xw_revolver.params;
  const ammo = fullAmmo({ max: base.ammoMax!, reloadSeconds: base.reloadSeconds! });
  const reloadMult = machine['reloadMult'];
  if (reloadMult !== undefined) ammo.reloadSeconds *= reloadMult;
  return { ammo, fireTimer: 0, totalDamage: 0 };
}

/** 左轮帧步进（即时命中近似：发射即对最近敌按命中率结算，弹体飞行 B6 视觉欠账）。 */
export function stepRevolver(
  state: RevolverState,
  dt: number,
  now: number,
  player: ExclusivePlayerLike,
  enemies: readonly ExclusiveTarget[],
  damageMultiplier: number,
  machine: Readonly<Record<string, number>> = {},
  rng: () => number = Math.random,
): StepResult {
  const result = emptyStep();
  const base = EXCLUSIVE_WEAPONS.xw_revolver.params;
  tickReload(state.ammo, dt);
  state.fireTimer -= dt;
  if (state.fireTimer <= 0) {
    state.fireTimer = base.interval!;
    const target = nearestAlive(enemies, player.x, player.y);
    if (target && consumeAmmo(state.ammo, now)) {
      result.events.push('fired');
      let hitTarget: ExclusiveTarget | null = target;
      let damage = base.damage! * damageMultiplier;
      // 卡 1 圣痕连锁：命中后弹射 ×0.7 / 1 次跳弹 / 附带穿透 1（即时近似：直接结算次目标）
      for (let hop = 0; hop <= (machine['chainCount'] ?? 0); hop += 1) {
        if (!hitTarget) break;
        const roll = rng();
        if (roll < 0.85) {
          // wpn 弹命中率口径（沙盘/测试可注入确定性 rng）
          dealDamage(hitTarget, damage, now, result);
          if (hop === (machine['chainCount'] ?? 0) && (machine['vulnerable'] ?? 0) > 0) {
            // 末段圣痕（衍生技挂点预留：专武基础不挂）
          }
        } else {
          result.events.push('miss');
        }
        damage *= machine['chainDamageMult'] ?? 1;
        // 跳弹目标 = 最近的其他敌
        hitTarget = nearestAlive(enemies, hitTarget.x, hitTarget.y, hitTarget);
      }
    }
  }
  state.totalDamage += result.damageDealt;
  return result;
}

/** 击杀补弹钩子（处决装填；装配层把 target.onKilled 指到这里） */
export function revolverOnKill(state: RevolverState, machine: Readonly<Record<string, number>>): void {
  const grant = machine['killGrantAmmo'];
  if (grant !== undefined && grant > 0) grantAmmo(state.ammo, grant);
}

/** 最近活跃敌（排除 exclude；无 = null） */
function nearestAlive(
  enemies: readonly ExclusiveTarget[],
  x: number,
  y: number,
  exclude?: ExclusiveTarget,
): ExclusiveTarget | null {
  let best: ExclusiveTarget | null = null;
  let bestD = Infinity;
  for (const e of enemies) {
    if (!e.active || e.hp <= 0 || e === exclude) continue;
    const d = distSq(e.x, e.y, x, y);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

// ============================================================================
// 3. 血契双刃（B 贴身近战；卡1 血之回响血爆；卡2 猩红新月）
// ============================================================================

export interface TwinbladesState {
  attackTimer: number;
  /** 血契层数（上限 10，命中积累不消耗；满层触发血爆后清空） */
  bloodPact: number;
  /** 每秒回血窗口累计 */
  healWindowUsed: number;
  healWindowStart: number;
  totalDamage: number;
}

export function createTwinbladesState(): TwinbladesState {
  return { attackTimer: 0, bloodPact: 0, healWindowUsed: 0, healWindowStart: 0, totalDamage: 0 };
}

/** 双刃帧步进。healSink = 玩家回血落点（返回实际回复量）。 */
export function stepTwinblades(
  state: TwinbladesState,
  dt: number,
  now: number,
  player: ExclusivePlayerLike,
  enemies: readonly ExclusiveTarget[],
  damageMultiplier: number,
  machine: Readonly<Record<string, number>> = {},
  healSink: (amount: number) => void = () => {},
): StepResult {
  const result = emptyStep();
  const base = EXCLUSIVE_WEAPONS.xw_twinblades.params;
  const range = machine['range'] ?? base.radius!;
  state.attackTimer -= dt;

  // 每秒回血上限窗口
  if (now - state.healWindowStart >= 1) {
    state.healWindowStart = now;
    state.healWindowUsed = 0;
  }

  if (state.attackTimer <= 0) {
    state.attackTimer = base.interval!;
    const target = nearestAlive(enemies, player.x, player.y);
    if (target && distSq(target.x, target.y, player.x, player.y) <= range * range) {
      dealDamage(target, base.damage! * damageMultiplier, now, result);
      state.bloodPact = Math.min(10, state.bloodPact + 1);
      const heal = Math.min(base.healPerHit!, Math.max(0, base.healCapPerSecond! - state.healWindowUsed));
      state.healWindowUsed += heal;
      if (heal > 0) healSink(heal);
      result.events.push('slash');
      // 卡 1 血之回响：满层血爆
      if ((machine['burstDamage'] ?? 0) > 0 && state.bloodPact >= 10) {
        state.bloodPact = 0;
        const burstR = machine['burstRadius'] ?? 120;
        for (const e of enemies) {
          if (!e.active || e.hp <= 0) continue;
          if (distSq(e.x, e.y, player.x, player.y) > burstR * burstR) continue;
          dealDamage(e, machine['burstDamage']! * damageMultiplier, now, result);
        }
        healSink(machine['burstHeal'] ?? 3);
        result.events.push('bloodBurst');
        // 卡 2 猩红新月：血爆附带新月波（直线 200px 穿透 20 伤——即时近似：突进方向最近群）
        if ((machine['crescentDamage'] ?? 0) > 0) {
          for (const e of enemies) {
            if (!e.active || e.hp <= 0) continue;
            if (distSq(e.x, e.y, player.x, player.y) > (machine['crescentRange'] ?? 200) ** 2) continue;
            dealDamage(e, machine['crescentDamage']! * damageMultiplier, now, result);
          }
          result.events.push('crescent');
        }
      }
    }
  }
  state.totalDamage += result.damageDealt;
  return result;
}

// ============================================================================
// 4. 月痕长弓（A 重型狙击；卡1 月相贯矢每3矢×2.2全贯穿；卡2 猎首之约）
// ============================================================================

export interface LongbowState {
  shotTimer: number;
  /** 已射矢计数（每第 N 矢满蓄，卡 1） */
  shotCounter: number;
  totalDamage: number;
}

export function createLongbowState(): LongbowState {
  return { shotTimer: 0, shotCounter: 0, totalDamage: 0 };
}

/** 长弓帧步进（直线贯穿：路径上按距离排序贯穿 N 个；即时结算近似）。 */
export function stepLongbow(
  state: LongbowState,
  dt: number,
  now: number,
  player: ExclusivePlayerLike,
  enemies: readonly ExclusiveTarget[],
  damageMultiplier: number,
  machine: Readonly<Record<string, number>> = {},
): StepResult {
  const result = emptyStep();
  const base = EXCLUSIVE_WEAPONS.xw_longbow.params;
  state.shotTimer -= dt;
  if (state.shotTimer <= 0) {
    state.shotTimer = base.interval!;
    state.shotCounter += 1;
    const chargedEvery = machine['chargeEveryN'] ?? 0;
    const charged = chargedEvery > 0 && state.shotCounter % chargedEvery === 0;
    const damage = base.damage! * (charged ? machine['chargedDamageMult'] ?? 1 : 1) * damageMultiplier;
    const pierce = charged ? Number.POSITIVE_INFINITY : base.pierce!;
    // 贯穿：按距玩家距离升序命中前 N 个（直线近似）
    const line = enemies
      .filter((e) => e.active && e.hp > 0)
      .sort((a, b) => distSq(a.x, a.y, player.x, player.y) - distSq(b.x, b.y, player.x, player.y));
    let pierced = 0;
    for (const e of line) {
      if (pierced >= pierce) break;
      let dmg = damage;
      // 卡 2 猎首之约：对猎物普通矢 ×1.3
      if (!charged && e.cc && (machine['preyDamageMult'] ?? 0) > 0) {
        const q = e.cc ? queryVulnerable(e, now, 'xw_longbow_prey') : false;
        if (q) dmg *= machine['preyDamageMult']!;
      }
      dealDamage(e, dmg, now, result);
      // 卡 2：满蓄矢命中标记猎物（易伤 +20%/8s 单目标）
      if (charged && (machine['preyVulnerable'] ?? 0) > 0) {
        applyCc(e, 'vulnerable', machine['preyVulnerable']!, machine['preyDuration'] ?? 8, now, 'xw_longbow_prey');
      }
      pierced += 1;
    }
    result.events.push(charged ? 'chargedShot' : 'shot');
  }
  state.totalDamage += result.damageDealt;
  return result;
}

/** 查询目标是否带某来源易伤（猎物标记等单查场景） */
function queryVulnerable(target: ExclusiveTarget, now: number, source: string): boolean {
  if (!target.cc) return false;
  const v = target.cc.vulnerable;
  return !!v && now < v.until && v.source === source;
}

// ============================================================================
// 5. 安魂圣铃（B 领域辅助；卡1 安魂钟鸣；守誓者协同另见 companion/oathkeeper.ts）
// ============================================================================

export interface BellState {
  tickTimer: number;
  healTimer: number;
  totalDamage: number;
}

export function createBellState(): BellState {
  return { tickTimer: 0, healTimer: 0, totalDamage: 0 };
}

/** 圣铃帧步进。healSink = 治疗落点（自身与守誓者；卡1 ×2.5）。 */
export function stepBell(
  state: BellState,
  dt: number,
  now: number,
  player: ExclusivePlayerLike,
  enemies: readonly ExclusiveTarget[],
  damageMultiplier: number,
  machine: Readonly<Record<string, number>> = {},
  healSink: (amount: number) => void = () => {},
): StepResult {
  const result = emptyStep();
  const base = EXCLUSIVE_WEAPONS.xw_bell.params;
  const radius = base.radius!;
  state.tickTimer -= dt;
  state.healTimer -= dt;

  if (state.tickTimer <= 0) {
    state.tickTimer = base.interval!;
    for (const e of enemies) {
      if (!e.active || e.hp <= 0) continue;
      if (distSq(e.x, e.y, player.x, player.y) > radius * radius) continue;
      dealDamage(e, base.damage! * damageMultiplier, now, result);
      // 卡 1 安魂钟鸣：亡者类额外 12 伤 + 减速 20%/2s
      if ((machine['undeadBonusDamage'] ?? 0) > 0 && e.kind === 'zombie') {
        dealDamage(e, machine['undeadBonusDamage']! * damageMultiplier, now, result);
        applyCc(e, 'slow', machine['undeadSlowPct'] ?? 0.2, machine['undeadSlowDuration'] ?? 2, now, 'xw_bell_chime');
      }
    }
  }
  if (state.healTimer <= 0) {
    state.healTimer = base.healInterval!;
    const amount = base.healAmount! * (machine['healMult'] ?? 1);
    healSink(amount); // 自身 + 守誓者（装配层分发；卡1 ×2.5）
    result.events.push('bellHeal');
  }
  state.totalDamage += result.damageDealt;
  return result;
}

// ============================================================================
// 6. 圣辉十字（C 定点爆发；卡1 审判降临悬停灼烧；卡2 三重颂歌）
// ============================================================================

export interface PendingCross {
  x: number;
  y: number;
  explodeAt: number;
  /** 相邻加成（三重颂歌：同目标去重单次 +30%） */
  adjacentBonus: boolean;
}

export interface CrossState {
  throwTimer: number;
  /** 悬停中十字（卡 1） */
  pending: PendingCross[];
  totalDamage: number;
}

export function createCrossState(): CrossState {
  return { throwTimer: 0, pending: [], totalDamage: 0 };
}

/** 十字帧步进（投掷飞行即时近似：落点 = 最近敌当前位置；抛物线视觉 B6 欠账）。 */
export function stepCross(
  state: CrossState,
  dt: number,
  now: number,
  player: ExclusivePlayerLike,
  enemies: readonly ExclusiveTarget[],
  damageMultiplier: number,
  machine: Readonly<Record<string, number>> = {},
): StepResult {
  const result = emptyStep();
  const base = EXCLUSIVE_WEAPONS.xw_cross.params;
  const explodeRadius = base.radius!;
  state.throwTimer -= dt;

  // 悬停灼烧（卡 1）+ 到点爆炸
  for (let i = state.pending.length - 1; i >= 0; i -= 1) {
    const cross = state.pending[i]!;
    if (now < cross.explodeAt) {
      const hoverDps = machine['hoverDps'] ?? 0;
      if (hoverDps > 0) {
        for (const e of enemies) {
          if (!e.active || e.hp <= 0) continue;
          if (distSq(e.x, e.y, cross.x, cross.y) > explodeRadius * explodeRadius) continue;
          dealDamage(e, hoverDps * damageMultiplier * dt, now, result);
        }
      }
      continue;
    }
    state.pending.splice(i, 1);
    explodeCross(state, cross, now, enemies, base.damage!, explodeRadius, damageMultiplier, machine, result);
  }

  if (state.throwTimer <= 0) {
    state.throwTimer = base.interval!;
    const target = nearestAlive(enemies, player.x, player.y);
    if (target) {
      const count = Math.max(1, machine['crossCount'] ?? 1);
      for (let i = 0; i < count; i += 1) {
        // 品字近似：主目标 ±40px 偏移（三重颂歌）；单枚 = 主目标位置
        const offset = count > 1 ? (i === 0 ? 0 : 40) : 0;
        const cross: PendingCross = {
          x: target.x + offset,
          y: target.y - offset,
          explodeAt: now + (machine['hoverDuration'] ?? 0),
          adjacentBonus: count > 1 && i > 0,
        };
        if (cross.explodeAt <= now) {
          explodeCross(state, cross, now, enemies, base.damage!, explodeRadius, damageMultiplier, machine, result);
        } else {
          state.pending.push(cross);
        }
      }
      result.events.push('throwCross');
    }
  }
  state.totalDamage += result.damageDealt;
  return result;
}

function explodeCross(
  _state: CrossState,
  cross: PendingCross,
  now: number,
  enemies: readonly ExclusiveTarget[],
  damage: number,
  radius: number,
  damageMultiplier: number,
  machine: Readonly<Record<string, number>>,
  result: StepResult,
): void {
  const rSq = radius * radius;
  for (const e of enemies) {
    if (!e.active || e.hp <= 0) continue;
    if (distSq(e.x, e.y, cross.x, cross.y) > rSq) continue;
    // 三重颂歌：相邻爆炸 +30%（同目标去重单次加成，不叠乘——按枚独立判定取单次）
    const bonus = cross.adjacentBonus ? 1 + (machine['adjacentBonusPct'] ?? 0) : 1;
    dealDamage(e, damage * bonus * damageMultiplier, now, result);
  }
}

// ============================================================================
// 7. 葬仪巨斧（近战重斩自损；卡1 血债血偿；卡2 葬仪狂欢）
// ============================================================================

export interface AxeState {
  swingTimer: number;
  totalDamage: number;
}

export function createAxeState(): AxeState {
  return { swingTimer: 0, totalDamage: 0 };
}

/** 巨斧帧步进。spendHp = 自损落点（HP ≤20% 停止消耗）；killHealSink = 击杀回血落点。 */
export function stepAxe(
  state: AxeState,
  dt: number,
  now: number,
  player: ExclusivePlayerLike,
  enemies: readonly ExclusiveTarget[],
  damageMultiplier: number,
  machine: Readonly<Record<string, number>> = {},
  spendHp: (amount: number) => void = () => {},
  killHealSink: (amount: number) => void = () => {},
): StepResult {
  const result = emptyStep();
  const base = EXCLUSIVE_WEAPONS.xw_axe.params;
  const range = base.radius!;
  const interval = machine['cooldown'] ?? base.interval!;
  state.swingTimer -= dt;
  if (state.swingTimer <= 0) {
    state.swingTimer = interval;
    const target = nearestAlive(enemies, player.x, player.y);
    if (target && distSq(target.x, target.y, player.x, player.y) <= range * range) {
      // 卡 2 葬仪狂欢：当前 HP 每低 10% 伤害 +6%（上限 +30%）
      const lowHpBonus = Math.min(
        machine['lowHpBonusCap'] ?? 0,
        Math.floor(Math.max(0, 1 - player.hp / player.maxHp) / (machine['lowHpStepPer'] ?? 1)) * (machine['lowHpStepPct'] ?? 0),
      );
      const dmg = base.damage! * (machine['damageMult'] ?? 1) * (1 + lowHpBonus) * damageMultiplier;
      dealDamage(target, dmg, now, result);
      // 自损 2 HP（HP ≤20% 停止消耗——保命边缘 §6.1-1；狂化免耗走衍生技 machine 覆写 selfHpCost=0）
      const selfCost = machine['selfHpCost'] ?? base.selfHpCost!;
      if (player.hp / player.maxHp > base.selfHpStopPct! && selfCost > 0) spendHp(selfCost);
      // 击杀回血（基础 1 / 卡1 3）
      const killHeal = machine['killHeal'] ?? base.killHeal!;
      if (target.hp <= 0 && killHeal > 0) killHealSink(killHeal);
      result.events.push('swing');
    }
  }
  state.totalDamage += result.damageDealt;
  return result;
}

// ============================================================================
// 8. 月啸号角（D 召唤；卡1 群狼协议；卡2 长夜月啸）
// ============================================================================

export interface MoonWolf {
  /** 存在截止 s */
  until: number;
  attackTimer: number;
  /** 狂化截止 s（卡 2） */
  rageUntil: number;
}

export interface HornState {
  summonTimer: number;
  wolves: MoonWolf[];
  totalDamage: number;
}

export function createHornState(): HornState {
  return { summonTimer: 0, wolves: [], totalDamage: 0 };
}

/** 号角帧步进（月狼贴身玩家自动索敌；狼位置 = 玩家附近虚拟——视觉实体 B6 欠账）。 */
export function stepHorn(
  state: HornState,
  dt: number,
  now: number,
  player: ExclusivePlayerLike,
  enemies: readonly ExclusiveTarget[],
  damageMultiplier: number,
  machine: Readonly<Record<string, number>> = {},
): StepResult {
  const result = emptyStep();
  const base = EXCLUSIVE_WEAPONS.xw_horn.params;
  const maxWolves = machine['maxWolves'] ?? base.summonMax!;

  state.summonTimer -= dt;
  if (state.summonTimer <= 0) {
    state.summonTimer = base.summonInterval!;
    if (state.wolves.length < maxWolves) {
      // 召唤请求：场上限静默丢弃（§6.1-2 满员不排队）
      state.wolves.push({
        until: now + base.summonDuration!,
        attackTimer: 0,
        rageUntil: (machine['rageDuration'] ?? 0) > 0 ? now + machine['rageDuration']! : 0,
      });
      result.events.push('howl');
      // 卡 2：吹号长啸全体狂化 6s
      if ((machine['rageDamageMult'] ?? 0) > 0) {
        for (const w of state.wolves) w.rageUntil = Math.max(w.rageUntil, now + (machine['rageDuration'] ?? 6));
      }
    }
  }

  for (let i = state.wolves.length - 1; i >= 0; i -= 1) {
    const wolf = state.wolves[i]!;
    if (now >= wolf.until) {
      state.wolves.splice(i, 1);
      continue;
    }
    wolf.attackTimer -= dt;
    if (wolf.attackTimer <= 0) {
      wolf.attackTimer = base.interval!;
      const target = nearestAlive(enemies, player.x, player.y);
      if (target) {
        const raging = now < wolf.rageUntil;
        const dmg = base.damage! * (raging ? machine['rageDamageMult'] ?? 1 : 1) * damageMultiplier;
        dealDamage(target, dmg, now, result);
        // 卡 2：狂化期击杀刷新存在时间
        if (raging && target.hp <= 0) wolf.until = now + base.summonDuration!;
      }
    }
  }
  state.totalDamage += result.damageDealt;
  return result;
}

/** 场上月狼数（召唤上限/R-8 共享预留查询口） */
export function hornWolfCount(state: HornState, now: number): number {
  return state.wolves.filter((w) => now < w.until).length;
}
