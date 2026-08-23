/**
 * weapons/weapon-runtime.ts —— 武器行为纯逻辑运行时（E2-S2~S5 / E2-S7 / E2-S9 / E2-S10）
 *
 * 14 武器四类行为 + 7 超武质变的行为数学，全部抽为纯函数（可脱离 Phaser 单测，
 * test-framework §1.2 纪律）。Phaser 装配层（weapon-system / 各 behavior）只做
 * 「把运行时状态喂给本模块 + 渲染」。
 *
 * 覆盖（gdd-weapons-v2）：
 * - A 弹幕投射：冷却触发 / 无目标不发射 / 弹道上限跳过 / 穿透 / 分裂 / 扇形 / 往返 / 扫掠命中
 * - B 环绕护体：环绕数/半径/转速派生 / 同目标 0.4s 内置 CD / 减速 / 光环 tick / 承伤 -10%
 * - C 范围清屏：冷却触发 / 地面池独立 tick / 同目标同武器只计最高源一次 / 减速
 * - D 召唤定向：召唤数 / 攻击间隔 / 存在 / 重召唤间隔 / 索敌派生
 * - 超武 7：等效 DPS（gdd-weapons-v2 §5.2）+ 质变参数
 *
 * DPS 口径（sim-verify-v1 §2/§6）：单目标等效；C 类为 AoE 单目标口径；
 * 「满类强化 DPS」为设计校准口径（sim-verify §6 表），非精确物理模型（注释内逐行标注）。
 */

import {
  WEAPON_CONFIGS,
  EVOLUTIONS,
  type WeaponConfig,
  type WeaponId,
  type EvoId,
} from '@/config/balance';
import { weaponDamageOnTarget } from '@/active-skill/active-skill-effects';
import {
  classUpgradeTotal,
  type ClassUpgradeStacks,
} from '@/weapons/class-upgrades';
import type { KeyPassiveState } from '@/upgrade/upgrade-apply-v2';

// ============================================================================
// 派生参数（配置 + 类强化堆叠 → 运行时参数）
// ============================================================================

/** A 类派生参数 */
export interface ProjectileDerivedParams {
  damage: number;      // 单发伤害（未乘总倍率）
  cooldown: number;    // 冷却 s
  speed: number;       // 弹速 px/s
  returnSpeed: number; // 往返类回程速度 px/s
  lifetime: number;    // 存在 s
  maxActive: number;   // 同屏弹体上限
  pierce: number;      // 穿透次数（基础 + A2）
  split: number;       // 分裂次级弹数（A1）
  pellets: number;     // 扇形弹数
  spreadDeg: number;   // 扇形张角
  range: number;       // 射程 px
}

/** B 类派生参数 */
export interface OrbitDerivedParams {
  damage: number;
  count: number;        // 环绕数（基础 + B1，上限 maxCount）
  radius: number;       // 半径（×B3）
  angularSpeedDeg: number; // 转速（×B2）
  perTargetCooldown: number; // 同目标内置 CD
  slowPct?: number;
  slowDuration?: number;
  auraDps?: number;     // 壁垒光环 dps
  auraRadius?: number;
  damageReduction?: number; // 壁垒承伤 -10%
}

/** C 类派生参数 */
export interface GroundAreaDerivedParams {
  damagePerSec: number; // 每秒伤害（C2/C3 tick；C1 为单发伤害）
  cooldown: number;
  radius: number;       // 范围半径（×C1）
  duration: number;     // 持续（×C3）
  slowPct?: number;
  tickInterval: number; // 池 tick 间隔 0.5s（gdd-weapons-v2 §3.3 注）
  knockback?: number;   // C1 击退 80px（升级解锁）
  stunSeconds?: number; // 超武月全食 1s 眩晕
}

/** D 类派生参数 */
export interface SummonDerivedParams {
  damage: number;
  count: number;           // 召唤数（基础 + D1，上限 6）
  attackInterval: number;
  lifetime: number;        // 存在（×D3）
  respawnCd: number;       // 重召唤间隔
  aggroMult: number;       // 索敌/追击距离（×D2）
  hitRate: number;
}

/** 派生参数统一入口：配置 + 类堆叠 → 各类运行时参数（字段按类可选） */
export interface DerivedWeaponParams {
  weaponId: WeaponId;
  class: WeaponConfig['class'];
  baseDps: number;
  projectile?: ProjectileDerivedParams;
  orbit?: OrbitDerivedParams;
  ground?: GroundAreaDerivedParams;
  summon?: SummonDerivedParams;
}

/** A 类派生（gdd-weapons-v2 §3.2 + upgrade-pool-v2 §3.3 A1/A2/A3） */
export function deriveProjectileParams(
  config: WeaponConfig,
  stacks: ClassUpgradeStacks,
): ProjectileDerivedParams {
  const a1 = stacks.a1;
  const a2 = stacks.a2;
  const a3 = stacks.a3;
  const damage = config.damage ?? 0;
  const cooldown = config.cooldown ?? 0;
  const speed = (config.speed ?? 0) * Math.pow(1.2, a3);
  const returnSpeed = config.returnSpeed ?? 0;
  const lifetime = config.lifetime ?? 0;
  const maxActive = config.maxActive ?? 0;
  const pierce = (config.pierce ?? 0) + a2;
  const split = a1;
  const pellets = config.pellets ?? 1;
  const spreadDeg = config.spreadDeg ?? 0;
  const range = config.range ?? Number.POSITIVE_INFINITY;
  return { damage, cooldown, speed, returnSpeed, lifetime, maxActive, pierce, split, pellets, spreadDeg, range };
}

/** B 类派生（gdd-weapons-v2 §3.3 + upgrade-pool-v2 §3.3 B1/B2/B3） */
export function deriveOrbitParams(
  config: WeaponConfig,
  stacks: ClassUpgradeStacks,
): OrbitDerivedParams {
  const b1 = stacks.b1;
  const b2 = stacks.b2;
  const b3 = stacks.b3;
  const count = Math.min((config.baseCount ?? 0) + b1, config.maxCount ?? config.baseCount ?? 0);
  const radius = (config.radius ?? 0) * Math.pow(1.15, b3);
  const angularSpeedDeg = (config.angularSpeedDeg ?? 0) * Math.pow(1.2, b2);
  return {
    damage: config.damage ?? 0,
    count,
    radius,
    angularSpeedDeg,
    perTargetCooldown: config.perTargetCooldown ?? 0.4,
    slowPct: config.slowPct,
    slowDuration: config.slowDuration,
    auraDps: config.auraDps,
    auraRadius: config.auraRadius,
    damageReduction: config.damageReduction,
  };
}

/** C 类派生（gdd-weapons-v2 §3.4 + upgrade-pool-v2 §3.3 C1/C2/C3） */
export function deriveGroundAreaParams(
  config: WeaponConfig,
  stacks: ClassUpgradeStacks,
): GroundAreaDerivedParams {
  const c1 = stacks.c1;
  const c2 = stacks.c2;
  const c3 = stacks.c3;
  const damageMult = Math.pow(1.2, c2);
  const durationMult = Math.pow(1.3, c3);
  const radiusMult = Math.pow(1.25, c1);
  const damagePerSec = (config.damage ?? 0) * damageMult;
  const radius = (config.radius ?? 0) * radiusMult;
  const duration = (config.duration ?? 0) * durationMult;
  return {
    damagePerSec,
    cooldown: config.cooldown ?? 0,
    radius,
    duration,
    slowPct: config.slowPct,
    tickInterval: 0.5,
  };
}

/** D 类派生（gdd-weapons-v2 §3.5 + upgrade-pool-v2 §3.3 D1/D2/D3） */
export function deriveSummonParams(
  config: WeaponConfig,
  stacks: ClassUpgradeStacks,
): SummonDerivedParams {
  const d1 = stacks.d1;
  const d3 = stacks.d3;
  const d2 = stacks.d2;
  const count = Math.min((config.summonCount ?? 0) + d1, 6);
  const lifetime = (config.lifetime ?? 0) * Math.pow(1.3, d3);
  return {
    damage: config.damage ?? 0,
    count,
    attackInterval: config.attackInterval ?? 0,
    lifetime,
    respawnCd: config.respawnCd ?? 0,
    aggroMult: Math.pow(1.3, d2),
    hitRate: config.hitRate ?? 0.75,
  };
}

/** 派生参数统一入口（按类路由） */
export function deriveWeaponParams(config: WeaponConfig, stacks: ClassUpgradeStacks): DerivedWeaponParams {
  const base: DerivedWeaponParams = { weaponId: config.id, class: config.class, baseDps: config.baseDps };
  switch (config.class) {
    case 'A':
      return { ...base, projectile: deriveProjectileParams(config, stacks) };
    case 'B':
      return { ...base, orbit: deriveOrbitParams(config, stacks) };
    case 'C':
      return { ...base, ground: deriveGroundAreaParams(config, stacks) };
    case 'D':
      return { ...base, summon: deriveSummonParams(config, stacks) };
    default:
      return base;
  }
}

// ============================================================================
// 被动钥数值效果派生（key_* 7，gdd-upgrade-pool-v2 §3.4；E4-S4 遗留 A/B/C 补全）
// ============================================================================
// 语义（content-design-outline §6.4）：key_scope 射程 +15% / key_holy 范围 +15% /
// key_tome 冷却 -10%（与专精疾射独立乘区，乘法叠加）/ key_silver 伤害 +12% /
// key_pact 召唤数 +1 / key_bone 召唤存在 +20% / key_grail 范围持续 +25%。
// 应用方式：在「类强化派生」之上再乘钥乘区（乘法叠加，不覆盖类强化）；空钥 = 恒等。

/** A 类钥被动派生：射程（lifetime+range）×1.15 / 冷却 ×0.9 / 伤害 ×1.12 */
export function applyKeyPassivesToProjectile(
  base: ProjectileDerivedParams,
  keys: KeyPassiveState,
): ProjectileDerivedParams {
  return {
    ...base,
    damage: base.damage * keys.damageMult,
    cooldown: base.cooldown * keys.cooldownMult,
    lifetime: base.lifetime * keys.rangeMult,
    range: base.range * keys.rangeMult,
  };
}

/** B 类钥被动派生：范围（radius/auraRadius）×1.15 / 伤害 ×1.12（环绕无冷却） */
export function applyKeyPassivesToOrbit(
  base: OrbitDerivedParams,
  keys: KeyPassiveState,
): OrbitDerivedParams {
  return {
    ...base,
    damage: base.damage * keys.damageMult,
    radius: base.radius * keys.areaRadiusMult,
    auraRadius: base.auraRadius === undefined ? undefined : base.auraRadius * keys.areaRadiusMult,
    auraDps: base.auraDps === undefined ? undefined : base.auraDps * keys.damageMult,
  };
}

/** C 类钥被动派生：范围 ×1.15 / 持续 ×1.25 / 冷却 ×0.9 / 伤害 ×1.12 */
export function applyKeyPassivesToGround(
  base: GroundAreaDerivedParams,
  keys: KeyPassiveState,
): GroundAreaDerivedParams {
  return {
    ...base,
    damagePerSec: base.damagePerSec * keys.damageMult,
    cooldown: base.cooldown * keys.cooldownMult,
    radius: base.radius * keys.areaRadiusMult,
    duration: base.duration * keys.areaDurationMult,
  };
}

/** D 类钥被动派生：召唤数 +1（上限 6）/ 存在 ×1.2 / 伤害 ×1.12 / 攻击节拍 ×0.9 */
export function applyKeyPassivesToSummon(
  base: SummonDerivedParams,
  keys: KeyPassiveState,
): SummonDerivedParams {
  return {
    ...base,
    count: Math.min(base.count + keys.summonCountBonus, 6),
    lifetime: base.lifetime * keys.summonLifetimeMult,
    damage: base.damage * keys.damageMult,
    attackInterval: base.attackInterval * keys.cooldownMult,
  };
}

// ============================================================================
// A 类 · 弹幕投射运行时（冷却触发 / 无目标不发射 / 弹道上限跳过）
// ============================================================================

export interface ProjectileFireContext {
  /** 场上是否有敌人（无目标 A 类不发射，gdd-weapons-v2 §⑥.1） */
  hasTarget: boolean;
}

export interface ProjectileFireResult {
  /** 本帧是否触发开火（发射 1 组 = 1 冷却 × pellets 弹体） */
  fired: boolean;
  /** 达上限跳过本冷却（不积压、不报错，gdd-weapons-v2 §⑥.3） */
  skippedDueToCap: boolean;
  /** 无目标跳过（gdd-weapons-v2 §⑥.1） */
  skippedNoTarget: boolean;
}

export interface ProjectileState {
  cooldown: number;
  active: number;
}

export function createProjectileState(): ProjectileState {
  return { cooldown: 0, active: 0 };
}

/**
 * A 类每帧推进：
 * 1. 冷却递减（秒制 clamp ≥0）
 * 2. 就绪 → 无目标则跳过（重置冷却，不发射）；有目标但 active ≥ maxActive 则跳过本冷却（不积压）
 * 3. 正常开火：active += pellets（扇形多发按弹体数占上限），冷却重置
 * 4. active 按寿命匀速消散（近似模型，与 bench-sim 同构）
 */
export function tickProjectileWeapon(
  state: ProjectileState,
  params: ProjectileDerivedParams,
  dt: number,
  ctx: ProjectileFireContext,
): ProjectileFireResult {
  state.cooldown = Math.max(0, state.cooldown - dt);
  if (state.cooldown > 0) return { fired: false, skippedDueToCap: false, skippedNoTarget: false };

  // 就绪 → 冷却重置（无论是否开火，语义 = 「跳过本冷却」）
  state.cooldown = params.cooldown;
  if (!ctx.hasTarget) {
    return { fired: false, skippedDueToCap: false, skippedNoTarget: true };
  }
  if (state.active >= params.maxActive) {
    return { fired: false, skippedDueToCap: true, skippedNoTarget: false };
  }
  state.active = Math.min(state.active + (params.pellets || 1), params.maxActive);
  return { fired: true, skippedDueToCap: false, skippedNoTarget: false };
}

/** active 弹体随时间消散（寿命模型；调用方每帧喂 dt） */
export function decayActiveProjectiles(state: ProjectileState, params: ProjectileDerivedParams, dt: number): void {
  if (params.lifetime <= 0 || state.active <= 0) return;
  state.active = Math.max(0, state.active - (state.active / params.lifetime) * dt);
}

// ============================================================================
// 扫掠碰撞（高速直线弹防穿透漏判，gdd-weapons-v2 §⑥.9）
// ============================================================================

/** 点-线段距离（无端点投影则取最近端点） */
export function pointSegmentDistance(
  px: number, py: number,
  x0: number, y0: number, x1: number, y1: number,
): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 0.0001) return Math.hypot(px - x0, py - y0);
  let t = ((px - x0) * dx + (py - y0) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = x0 + t * dx;
  const cy = y0 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/**
 * 线段-圆扫掠命中（弹体上一帧位置→本帧位置扫掠成线段，防 700px/s 高速穿透漏判；
 * gdd-weapons-v2 §⑥.9「命中判定用移动扫掠 swept collider」）。
 */
export function segmentCircleOverlap(
  x0: number, y0: number, x1: number, y1: number,
  cx: number, cy: number, r: number,
): boolean {
  return pointSegmentDistance(cx, cy, x0, y0, x1, y1) <= r;
}

// ============================================================================
// B 类 · 环绕护体运行时（同目标内置 CD / 减速 / 光环）
// ============================================================================

export interface OrbDamageTargetLike {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  hp: number;
  kill(): void;
  /** 同目标 0.4s 内置冷却截止（Boss 也适用，gdd-weapons-v2 §⑥.4） */
  orbitHitCooldownUntil: number;
}

/**
 * 环绕球命中：同目标内置 CD 判定（now < cooldownUntil 跳过）。
 * 返回是否命中（调用方负责扣血/减速；返回 true 表示已消费一次命中）。
 */
export function orbitCanHit(target: OrbDamageTargetLike, now: number): boolean {
  return target.active && now >= target.orbitHitCooldownUntil;
}

/** 命中后写回内置 CD 截止（调用方在真正扣血后调用） */
export function markOrbitHit(target: OrbDamageTargetLike, now: number, cooldown: number): void {
  target.orbitHitCooldownUntil = now + cooldown;
}

// ============================================================================
// C 类 · 地面池运行时（每池独立 tick / 同目标同武器只计最高源一次）
// ============================================================================

export interface GroundPoolInstance {
  x: number;
  y: number;
  radius: number;
  remaining: number;
  /** 单 tick 伤害（damagePerSec × tickInterval；已乘总倍率由调用方注入） */
  damagePerTick: number;
  slowPct: number;
  /** 上次 tick 时间戳（0.5s 间隔） */
  lastTick: number;
}

export interface GroundTargetLike {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  hp: number;
  kill(): void;
  /** E4-S2 血影突袭标记（可选） */
  markUntil?: number;
  markDamageMult?: number;
}

/**
 * 同武器多池重叠：每池独立 tick（不合并），但**同目标同一武器只计最高伤害源一次**（防刷伤，
 * gdd-weapons-v2 §⑥.6）。实现：对每个目标取覆盖它的池中 damagePerTick 最大者，仅扣一次。
 * E4-S2：per-target 标记倍率（now 缺省 +∞ → 无标记效果，向后兼容既有调用方）。
 * 返回 { hit, killed }。
 */
export function applyGroundPoolTick(
  pools: readonly GroundPoolInstance[],
  enemies: readonly GroundTargetLike[],
  now: number = Number.POSITIVE_INFINITY,
): { hit: number; killed: number } {
  let hit = 0;
  let killed = 0;
  for (const e of enemies) {
    if (!e.active) continue;
    let bestDamage = 0;
    let covered = false;
    for (const p of pools) {
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const rr = p.radius + e.radius;
      if (dx * dx + dy * dy > rr * rr) continue;
      covered = true;
      if (p.damagePerTick > bestDamage) bestDamage = p.damagePerTick;
    }
    if (!covered || bestDamage <= 0) continue;
    hit += 1;
    const perTarget = weaponDamageOnTarget(bestDamage, e, now);
    e.hp = Math.max(0, e.hp - perTarget);
    if (e.hp <= 0) {
      killed += 1;
      e.kill();
    }
  }
  return { hit, killed };
}

/** 池寿命推进：返回仍活跃的池（remaining ≤0 移除） */
export function tickGroundPools(pools: GroundPoolInstance[], dt: number): GroundPoolInstance[] {
  const out: GroundPoolInstance[] = [];
  for (const p of pools) {
    p.remaining -= dt;
    if (p.remaining > 0) out.push(p);
  }
  return out;
}

// ============================================================================
// D 类 · 召唤运行时（召唤数 / 攻击间隔 / 存在 / 重召唤）
// ============================================================================

export interface SummonState {
  activeCount: number;
  /** 下一只召唤物的重召唤剩余 s（死亡/到期后） */
  respawnTimer: number;
  /** 下一轮撕咬/攻击剩余 s */
  attackTimer: number;
}

export function createSummonState(params: SummonDerivedParams): SummonState {
  return { activeCount: params.count, respawnTimer: 0, attackTimer: 0 };
}

export interface SummonTickResult {
  /** 本帧是否有召唤物发动攻击 */
  attacked: boolean;
  /** 当前活跃召唤数（重召后恢复） */
  activeCount: number;
}

/**
 * 召唤物每帧推进：
 * - attackTimer 递减，就绪则本轮攻击（damage × hitRate 命中率建模在 DPS 计算，这里只记节拍）
 * - 召唤物死亡/到期后按 respawnCd 重召（重召唤间隔，gdd-weapons-v2 §3.1/§3.5）
 */
export function tickSummons(
  state: SummonState,
  params: SummonDerivedParams,
  dt: number,
): SummonTickResult {
  let attacked = false;
  if (state.activeCount > 0) {
    state.attackTimer -= dt;
    if (state.attackTimer <= 0) {
      state.attackTimer = params.attackInterval;
      attacked = true;
    }
  }
  if (state.activeCount < params.count) {
    state.respawnTimer -= dt;
    if (state.respawnTimer <= 0) {
      state.activeCount = Math.min(state.activeCount + 1, params.count);
      state.respawnTimer = params.respawnCd;
    }
  }
  return { attacked, activeCount: state.activeCount };
}

/** 召唤物到期/死亡：活跃数 -1（最多降到 0），启动重召倒计时 */
export function removeSummon(state: SummonState, params: SummonDerivedParams): void {
  if (state.activeCount <= 0) return;
  state.activeCount -= 1;
  state.respawnTimer = params.respawnCd;
}

// ============================================================================
// DPS 模型（sim-verify-v1 §2/§6 口径；单目标等效，倍率 1.0）
// ============================================================================

/** 基础 DPS = GDD §3.6 表（config.baseDps 即权威值） */
export function weaponBaseDps(config: WeaponConfig): number {
  return config.baseDps;
}

/**
 * 满类强化 DPS（sim-verify-v1 §6 表，7 把无超武武器「A/B/C 分支各 2 次满叠」）。
 * 设计校准口径：满叠 DPS 由 sim-verify 表直接给定（非精确物理模型），
 * 中间档按「类总堆叠 / 满叠 6」线性内插（运行时模拟口径，非 GDD 数值）。
 */
const FULL_UPGRADE_DPS_TARGETS: Readonly<Record<WeaponId, number>> = {
  // —— 7 把无超武武器（sim-verify-v1 §6 表，满类强化）——
  wpn_a_2: 22.6, // 银针连弩（A1×2+A2×2+A3×2）↔ 血月天罚 27.0 → 16.3%
  wpn_a_4: 25.3, // 幽灵飞刃（A 满）↔ 血月天罚 27.0 → 6.3%
  wpn_a_5: 23.2, // 骨钉标枪（A 满）↔ 血月天罚 27.0 → 14.1%
  wpn_b_2: 24.3, // 荆棘圣环（B 满）↔ 炽天使之环 28.8 → 15.6%（+减速控制补偿）
  wpn_b_3: 9.6,  // 圣光壁垒（B 满）↔ 炽天使之环 28.8 —— 定位补偿（承伤 -10%）
  wpn_c_3: 21.4, // 审判圣火（C 满）↔ 月全食 15.0 —— 超武反而低（面覆盖补偿）
  wpn_d_3: 16.3, // 断罪锁链（D 满）↔ 血蝠风暴 33.3 —— 定位补偿（击退/打断）
  // —— 7 把有超武武器（不入差距校验；按同族满叠倍率取中位口径，注释仅建模参考）——
  wpn_a_1: 9.0 * 2.11, // 血月猎手 A 满（参照 A2 满叠倍率 2.11）
  wpn_a_3: 15.9 * 2.11, // 圣银火铳 A 满
  wpn_b_1: 16.0 * 1.90, // 守夜之环 B 满（参照 B2 满叠倍率 1.90）
  wpn_c_1: 7.5 * 2.43,  // 月蚀脉冲 C 满（参照 C3 满叠倍率 2.43）
  wpn_c_2: 8.0 * 2.43,  // 血池喷涌 C 满
  wpn_d_1: 11.1 * 2.20, // 血蝠群 D 满（参照 D3 满叠倍率 2.20）
  wpn_d_2: 8.9 * 2.20,  // 狼影猎犬 D 满
};

/** 类全满叠次数（3 分支 × 2 层） */
export const FULL_CLASS_STACKS = 6;

/** 满类强化 DPS（设计校准口径，sim-verify-v1 §6） */
export function fullUpgradeDps(weaponId: WeaponId): number {
  return FULL_UPGRADE_DPS_TARGETS[weaponId];
}

/**
 * 给定类堆叠的强化 DPS：满叠 = FULL_UPGRADE_DPS_TARGETS；
 * 中间档按 totalStacks/6 线性内插（设计校准模拟口径）。
 */
export function computeUpgradedDps(config: WeaponConfig, stacks: ClassUpgradeStacks): number {
  const total = classUpgradeTotal(stacks, config.class);
  const target = fullUpgradeDps(config.id);
  if (total >= FULL_CLASS_STACKS) return target;
  return config.baseDps + (target - config.baseDps) * (total / FULL_CLASS_STACKS);
}

/** 超武等效 DPS（gdd-weapons-v2 §5.2 数值对齐表） */
export function evolutionDps(evoId: EvoId): number {
  const evo = EVOLUTIONS.find((e) => e.evoId === evoId);
  return evo?.baseDps ?? 0;
}

/** 无超武武器 vs 对照超武差距（百分比，正 = 超武高；sim-verify-v1 §6 判据 ≤20%） */
export function noSuperWeaponGap(weaponId: WeaponId, evoId: EvoId): number {
  const mine = fullUpgradeDps(weaponId);
  const theirs = evolutionDps(evoId);
  if (theirs <= 0) return 0;
  return ((theirs - mine) / theirs) * 100;
}

/**
 * 7 把无超武武器 → 对照超武映射（sim-verify-v1 §6 表）。
 * 壁垒/锁链为定位补偿（control/defense），不入 ≤20% 严格判据，标记 positionCompensated。
 */
export interface NoSuperComparison {
  weaponId: WeaponId;
  evoId: EvoId;
  /** 定位补偿：非纯伤害定位（承伤-10% / 击退打断），gap 判据豁免 */
  positionCompensated: boolean;
}

export const NO_SUPER_COMPARISONS: readonly NoSuperComparison[] = [
  { weaponId: 'wpn_a_2', evoId: 'evo_moonwrath', positionCompensated: false },
  { weaponId: 'wpn_a_4', evoId: 'evo_moonwrath', positionCompensated: false },
  { weaponId: 'wpn_a_5', evoId: 'evo_moonwrath', positionCompensated: false },
  { weaponId: 'wpn_b_2', evoId: 'evo_seraphring', positionCompensated: false },
  { weaponId: 'wpn_b_3', evoId: 'evo_seraphring', positionCompensated: true }, // 承伤 -10% 生存向
  { weaponId: 'wpn_c_3', evoId: 'evo_totaleclipse', positionCompensated: true }, // 面覆盖+持续，超武反而低
  { weaponId: 'wpn_d_3', evoId: 'evo_batstorm', positionCompensated: true }, // 击退/打断向
];

/** 辅助：按 WeaponId 取配置（表断言/测试用） */
export function weaponConfigById(id: WeaponId): WeaponConfig {
  return WEAPON_CONFIGS[id];
}
