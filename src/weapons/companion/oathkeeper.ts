/**
 * weapons/companion/oathkeeper.ts —— 守誓者召唤物状态机（B2-W5，gdd-exclusive-weapons §4.4）
 *
 * 规格（R2 §D 收录；FQ-2 定稿：修女·薇奥莱选安魂圣铃时**开局自带**）：
 * - HP 固定 200（EG-4 裁决：固定 200，×150% 双值配置挂账模拟定一）；
 * - 承伤替身：150px 强制索敌（targeting.pickTarget）+ 接触伤害转移 50%（质变卡 2 → 65%）；
 * - 低频撕咬 8 伤/1.0s（质变卡 2 → 14）；
 * - HP 归零化墓碑（8~10s；120px 内修女回血 2 HP/s——质变卡 2 → 4；墓碑期不可被攻击）；
 * - 修女治疗命中墓碑按 50% 转化率折算复活进度（质变卡 2 → 70%），满则原地满血复活；
 * - 异常消散后重召唤 CD 20s。
 *
 * 纯函数状态机（可脱离 Phaser 单测；实体渲染/HUD HP 条 = B6 表现批）。
 * 质变卡 machine 参数（mc_bell_2）经 applyCompanionMachine 写入。
 */

import { EXCLUSIVE_WEAPONS } from '@/config/balance';

/** 守誓者阶段 */
export type OathkeeperPhase = 'companion' | 'tombstone' | 'gone';

export interface OathkeeperState {
  phase: OathkeeperPhase;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  /** 墓碑截止（s 时间戳） */
  tombstoneUntil: number;
  /** 墓碑期修女回血累计（120px 环内 2 HP/s） */
  tombHealAccum: number;
  /** 复活进度 0~100（治疗转化率折算累计） */
  reviveProgress: number;
  /** 重召唤就绪时刻（gone 阶段计时） */
  resummonReadyAt: number;
  /** 撕咬计时 */
  biteTimer: number;
  /** 质变卡 machine 覆写（mc_bell_2：transferPct/biteDamage/tombHealPerSec/reviveConvertRate） */
  machine: Record<string, number>;
  totalDamage: number;
}

/** 初始参数（EXCLUSIVE_WEAPONS.xw_bell.params.companion；EG-4：HP 固定 200） */
function baseParams(): NonNullable<(typeof EXCLUSIVE_WEAPONS.xw_bell.params)['companion']> {
  return EXCLUSIVE_WEAPONS.xw_bell.params.companion!;
}

export function createOathkeeperState(x = 0, y = 0): OathkeeperState {
  const p = baseParams();
  return {
    phase: 'companion',
    hp: p.hp,
    maxHp: p.hp,
    x,
    y,
    tombstoneUntil: 0,
    tombHealAccum: 0,
    reviveProgress: 0,
    resummonReadyAt: 0,
    biteTimer: 0,
    machine: {},
    totalDamage: 0,
  };
}

/** 质变卡参数写回（mc_bell_2 machine 键与 OathkeeperParams 字段名对齐） */
export function applyCompanionMachine(state: OathkeeperState, machine: Record<string, number>): void {
  state.machine = { ...state.machine, ...machine };
}

/** 运行时参数（machine 覆写优先） */
function param(state: OathkeeperState, key: string): number {
  const overridden = state.machine[key];
  if (overridden !== undefined) return overridden;
  const p = baseParams() as unknown as Record<string, number>;
  return p[key] ?? 0;
}

/** 是否可被索敌（墓碑/消散 = false；targeting.pickTarget 消费） */
export function oathkeeperTargetable(state: OathkeeperState): boolean {
  return state.phase === 'companion';
}

/**
 * 承伤转移（替身口径）：玩家在替身圈内受到的接触伤害 50% 转移至守誓者。
 * 返回转移量；守誓者 HP 归零 → 化墓碑（§6.1-1：转移致死同样触发）。
 */
export function transferDamage(state: OathkeeperState, incomingDamage: number, now: number): number {
  if (state.phase !== 'companion') return 0;
  const rate = param(state, 'transferPct');
  const transferred = incomingDamage * rate;
  state.hp = Math.max(0, state.hp - transferred);
  if (state.hp <= 0) becomeTombstone(state, now);
  return transferred;
}

/** HP 归零 → 墓碑（持续 8~10s 随机由调用方注入 rng；转化瞬间清残 HP 记忆） */
export function becomeTombstone(state: OathkeeperState, now: number, rng: () => number = Math.random): void {
  const min = param(state, 'tombDurationMin');
  const max = param(state, 'tombDurationMax');
  state.phase = 'tombstone';
  state.tombstoneUntil = now + min + rng() * (max - min);
  state.tombHealAccum = 0;
}

/**
 * 墓碑期帧步进：
 * - 120px 内修女回血 2 HP/s（machine 覆写 4）；healSink = 修女回复落点（返回实际量）；
 * - 墓碑不可被攻击（targetable=false 由 targeting 层保证）；
 * - 到期未复活 → gone + 重召唤 CD 20s。
 */
export function tickTombstone(
  state: OathkeeperState,
  dt: number,
  now: number,
  player: { x: number; y: number },
  healSink: (amount: number) => number,
): void {
  if (state.phase !== 'tombstone') return;
  const radius = 120;
  const inRange = Math.hypot(player.x - state.x, player.y - state.y) <= radius;
  if (inRange) {
    const heal = param(state, 'tombHealPerSec') * dt;
    const applied = healSink(heal);
    // 修女治疗命中墓碑 → 复活进度按转化率折算（治疗量 × rate 累计；满 100 复活）
    const rate = param(state, 'reviveConvertRate');
    state.reviveProgress = Math.min(100, state.reviveProgress + applied * rate * 100 / 20);
    state.tombHealAccum += applied;
    if (state.reviveProgress >= 100) {
      revive(state);
      return;
    }
  }
  if (now >= state.tombstoneUntil) {
    // 墓碑到期未复活 → 异常消散，重召唤 CD 20s
    state.phase = 'gone';
    state.resummonReadyAt = now + param(state, 'resummonCd');
  }
}

/** 复活（进度满）：原地满血回到 companion；进度清零 */
export function revive(state: OathkeeperState): void {
  state.phase = 'companion';
  state.hp = state.maxHp;
  state.reviveProgress = 0;
  state.tombstoneUntil = 0;
}

/** 重召唤计时（gone 阶段帧步进；就绪 → 原地满血重召唤） */
export function tickResummon(state: OathkeeperState, dt: number, now: number): void {
  if (state.phase !== 'gone') return;
  void dt;
  if (now >= state.resummonReadyAt) {
    state.phase = 'companion';
    state.hp = state.maxHp;
  }
}

/** 守誓者撕咬帧步进（1.0s 间隔 8 伤；目标由调用方传入——聚拢玩家附近最近敌） */
export function tickBite(
  state: OathkeeperState,
  dt: number,
  _now: number,
  target: { hp: number; kill(): void } | null,
): number {
  if (state.phase !== 'companion') return 0;
  state.biteTimer -= dt;
  if (state.biteTimer > 0 || !target || target.hp <= 0) return 0;
  state.biteTimer = param(state, 'biteInterval');
  const dmg = param(state, 'biteDamage');
  const before = target.hp;
  target.hp = Math.max(0, target.hp - dmg);
  if (target.hp <= 0) target.kill();
  const dealt = Math.min(before, dmg);
  state.totalDamage += dealt;
  return dealt;
}

/** 协同治疗（安魂曲/铃响落点：立即回满；墓碑则复活进度直接充满——dv_requiem 消费） */
export function oathkeeperHealFull(state: OathkeeperState): void {
  if (state.phase === 'companion') {
    state.hp = state.maxHp;
    return;
  }
  if (state.phase === 'tombstone') {
    state.reviveProgress = 100;
    revive(state);
  }
  // gone 阶段：无实体，忽略（重召唤计时照走）
}

/** 复活进度直接充满（dv_requiem 墓碑分支语义；companion 阶段 no-op） */
export function fillReviveProgress(state: OathkeeperState): void {
  if (state.phase !== 'tombstone') return;
  state.reviveProgress = 100;
  revive(state);
}
