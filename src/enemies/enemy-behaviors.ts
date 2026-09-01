/**
 * enemies/enemy-behaviors.ts —— 敌人特殊行为·纯函数层（E3-S1~S4）
 *
 * 5 类特殊行为（gdd-enemies-v2 §3.1~3.3 / §4.2），每地图 ≤2 种且有明确反制：
 * - phase   相位：穿越障碍（亡魂 enemy_g1_4；血蝠 tier=air 同语义）
 * - aura    光环：120px 内亡者攻速 +20%（叠 3 层）（尸巫 enemy_g1_5）
 * - summon  召唤：每 5s 召唤 1 血信徒，场上 ≤3 达上限暂停（圣杯侍僧 enemy_g2_3）
 * - ranged  远程：每 3s 投掷烛火弹 180px/s 8 伤（忏悔者 enemy_g2_5）
 * - charge  冲锋：每 6s 蓄力 0.5s → 警告线 0.15s → 冲刺 500px/s（狼裔猎手 enemy_g3_4）
 *
 * 全部可脱离 Phaser 单测（test-framework §1.2 纯函数抽离纪律）；
 * 数值唯一数据源 = config/balance.ts（ENEMY_BEHAVIORS / ENEMY_CONFIGS）。
 */

import {
  ENEMY_BEHAVIORS,
  ENEMY_CONFIGS,
  type EnemyBehaviorConfig,
  type SummonBehaviorConfig,
  type RangedBehaviorConfig,
  type ChargeBehaviorConfig,
  type LungeBehaviorConfig,
  type EnemyId,
} from '@/config/balance';

export type {
  EnemyBehaviorConfig,
  PhaseBehaviorConfig,
  AuraBehaviorConfig,
  SummonBehaviorConfig,
  RangedBehaviorConfig,
  ChargeBehaviorConfig,
  LungeBehaviorConfig,
} from '@/config/balance';

/** 取特殊行为配置（无 = 普通敌） */
export function specialBehaviorFor(enemyId: EnemyId): EnemyBehaviorConfig | null {
  return ENEMY_BEHAVIORS[enemyId] ?? null;
}

/**
 * 该敌是否穿越障碍层（gdd-enemies §⑥.6 不对称规则：相位/空中忽略障碍，玩家不可）：
 * - 亡魂 phase 行为 → true
 * - 血蝠 tier=air（空中=相位障碍无效 §3.2）→ true
 */
export function passesObstacles(enemyId: EnemyId): boolean {
  const b = ENEMY_BEHAVIORS[enemyId];
  if (b?.kind === 'phase') return true;
  return ENEMY_CONFIGS[enemyId].tier === 'air';
}

// ---- aura（尸巫：120px 内亡者攻速 +20% 叠 3 层）----

/** 叠层数（0~3 封顶；多个尸巫光环叠加，§3.1） */
export function auraStacks(necroCount: number, maxStacks = 3): number {
  return Math.max(0, Math.min(necroCount, maxStacks));
}

/** 攻速倍率：1 + 0.2×stacks（0/1/2/3 层 → 1.0/1.2/1.4/1.6） */
export function auraAttackSpeedMultiplier(stacks: number, bonusPerStack = 0.2): number {
  return 1 + bonusPerStack * Math.max(0, stacks);
}

/** 攻速加成 → 攻击间隔缩短（interval ÷ 倍率） */
export function auraAdjustedAttackInterval(
  baseInterval: number,
  stacks: number,
  bonusPerStack = 0.2,
): number {
  return baseInterval / auraAttackSpeedMultiplier(stacks, bonusPerStack);
}

/** 目标是否处于光环半径内（含边界） */
export function isWithinAuraDistance(
  auraX: number,
  auraY: number,
  targetX: number,
  targetY: number,
  radius: number,
): boolean {
  return Math.hypot(auraX - targetX, auraY - targetY) <= radius;
}

/** 「亡者」判定 = BLOOD powerTag（world-bible §3：亡者=血月傀儡；光环对象口径 §3.1） */
export function isUndead(enemyId: EnemyId): boolean {
  return ENEMY_CONFIGS[enemyId].powerTag === 'BLOOD';
}

// ---- summon（圣杯侍僧：每 5s 召唤 1 血信徒，上限 3 达上限暂停）----

/** 召唤触发判定：间隔到 + 未达上限（§⑥.7 达上限暂停，不无限堆叠） */
export function summonShouldFire(
  b: SummonBehaviorConfig,
  elapsedSinceLastSummon: number,
  currentSummoned: number,
): boolean {
  return currentSummoned < b.summonCap && elapsedSinceLastSummon >= b.interval;
}

// ---- ranged（忏悔者：每 3s 烛火弹 180px/s 8 伤，慢速可躲）----

/** 远程触发判定：间隔到（§3.2 每 3s 投掷） */
export function rangedAttackDue(b: RangedBehaviorConfig, elapsedSinceLastRanged: number): boolean {
  return elapsedSinceLastRanged >= b.interval;
}

/** 烛火弹弹速（180px/s，§⑥.8 慢速可躲） */
export function rangedProjectileSpeed(b: RangedBehaviorConfig): number {
  return b.projectileSpeed;
}

/** 烛火弹伤害（8；与 ENEMY_CONFIGS.rangedDamage 单列一致） */
export function rangedDamageFor(enemyId: EnemyId): number {
  return ENEMY_CONFIGS[enemyId].rangedDamage ?? 0;
}

// ---- charge（狼裔猎手：每 6s 蓄力 0.5s → 警告线 0.15s → 冲刺 500px/s）----

/** 冲锋相位（§3.3：蓄力 → 警告线亮 → 冲刺 → 复位） */
export type ChargePhase = 'idle' | 'windup' | 'warning' | 'dash';

/**
 * 冲锋周期内相位（cycleElapsed ∈ [0, interval)）：
 * 周期末段触发冲锋（idle 覆盖大部分周期向玩家直线移动）：
 *   [0, interval−windup−warning−dashDuration)      → idle（直线移动）
 *   [interval−windup−warning−dash, +windup)          → windup（蓄力）
 *   [+warning)                                       → warning（警告线亮起 0.15s）
 *   剩余                                              → dash（冲刺 500px/s）
 */
export function chargePhaseFor(b: ChargeBehaviorConfig, cycleElapsed: number): ChargePhase {
  const chargeStart = b.interval - b.windup - b.warning - b.dashDuration;
  if (cycleElapsed < chargeStart) return 'idle';
  if (cycleElapsed < chargeStart + b.windup) return 'windup';
  if (cycleElapsed < chargeStart + b.windup + b.warning) return 'warning';
  return 'dash';
}

/** 冲锋周期内已过秒数（对 interval 取模；供警告线与相位对齐） */
export function chargeCycleElapsed(now: number, spawnedAt: number, interval: number): number {
  if (interval <= 0) return 0;
  const elapsed = now - spawnedAt;
  if (elapsed < 0) return 0;
  return elapsed % interval;
}

/**
 * 警告线透明度（asset-spec §2.6）：蓄力 0.5s 由淡到亮（0.2→0.9），亮起 0.15s 后冲刺。
 * 非 windup/warning 返回 0。
 */
export function warningLineAlpha(b: ChargeBehaviorConfig, cycleElapsed: number): number {
  const phase = chargePhaseFor(b, cycleElapsed);
  if (phase === 'warning') return 0.9;
  if (phase !== 'windup') return 0;
  const chargeStart = b.interval - b.windup - b.warning - b.dashDuration;
  const t = b.windup > 0 ? (cycleElapsed - chargeStart) / b.windup : 1;
  return 0.2 + 0.7 * Math.max(0, Math.min(1, t));
}

/** 冲锋期速度（dash 500px/s，其余 0） */
export function chargeSpeedFor(b: ChargeBehaviorConfig, phase: ChargePhase): number {
  return phase === 'dash' ? b.dashSpeed : 0;
}

// ---- lunge（P0-4 突袭三敌：血犬/血蝠/暗影狼，gdd-enemies-v3 §③-3 档 2）----

/** 突袭相位（事件驱动 CD 制，与 charge 周期制区分） */
export type LungePhase = 'idle' | 'windup' | 'dash' | 'stagger';

/** 触发判定：CD 就绪 + 进入触发距离（§③-3 档 2「进入 100px 内 → 突进」） */
export function lungeShouldTrigger(b: LungeBehaviorConfig, dist: number, cdRemaining: number): boolean {
  return cdRemaining <= 0 && dist <= b.triggerDist;
}

/** 突进时长 s（90px @300px/s = 0.3s；由距离/速度派生，不单列字段） */
export function lungeDashDuration(b: LungeBehaviorConfig): number {
  return b.dashDistance / b.dashSpeed;
}

/** 突袭期速度：dash = dashSpeed / 其余相位 0（windup 蓄身冻结、stagger 硬直） */
export function lungeSpeedFor(b: LungeBehaviorConfig, phase: LungePhase): number {
  return phase === 'dash' ? b.dashSpeed : 0;
}

/** 蓄身预警透明度（telegraph 演出消费：0.25s 由淡到亮 0.2→0.9；非 windup/dash 返回 0） */
export function lungeTelegraphAlpha(b: LungeBehaviorConfig, phase: LungePhase, phaseElapsed: number): number {
  if (phase === 'dash') return 0.9;
  if (phase !== 'windup') return 0;
  const t = b.windup > 0 ? phaseElapsed / b.windup : 1;
  return 0.2 + 0.7 * Math.max(0, Math.min(1, t));
}
