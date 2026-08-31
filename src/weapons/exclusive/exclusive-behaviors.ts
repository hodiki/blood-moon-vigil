/**
 * weapons/exclusive/exclusive-behaviors.ts —— 8 专武 WeaponBehavior 装配（B2-W1）
 *
 * 把 exclusive-math.ts 的纯结算层包成 WeaponBehavior 注册进 WeaponRegistry（默认 disabled，
 * 由 applyLoadout 门控开启）。零 Phaser 依赖（结算/命中全即时近似，弹体/精灵视觉 = B6 欠账，
 * 见 exclusive-math.ts 各函数注释）——同源供 tools/sim 沙盘复用（B2-W6 接真基础）。
 *
 * 质变卡：applyMutationCard(machine) 写入派生参数（B3 质变卡池接入后经 P1 保底驱动）。
 */

import { EXCLUSIVE_WEAPONS, type ExclusiveWeaponId } from '@/config/balance';
import { heavyCooldownMult } from '@/weapons/resonance/resonance-engine';
import type { Enemy } from '@/enemies/enemy';
import type { WeaponBehavior, WeaponUpdateContext } from '@/weapons/weapon-behavior';
import type { ExclusivePlayerLike, ExclusiveTarget, StepResult } from './exclusive-math';
import {
  createLanternState, stepLantern, type LanternState,
  createRevolverState, stepRevolver, revolverOnKill, type RevolverState,
  createTwinbladesState, stepTwinblades, type TwinbladesState,
  createLongbowState, stepLongbow, type LongbowState,
  createBellState, stepBell, type BellState,
  createCrossState, stepCross, type CrossState,
  createAxeState, stepAxe, type AxeState,
  createHornState, stepHorn, type HornState,
} from './exclusive-math';

/** 专武行为步进签名（各武 state/step 形状收敛，装配层泛型收敛用） */
interface ExclusiveWeaponHooks<S> {
  readonly id: ExclusiveWeaponId;
  createState: () => S;
  step: (state: S, ctx: StepArgs) => StepResult;
}

/** step 统一入参（player/enemies/multiplier 从 ctx 拆解 + 各武专属回调） */
interface StepArgs {
  /** R-6 落点爆炸回调（仅十字 hook 消费） */
  onExplode?: (x: number, y: number) => void;
  dt: number;
  now: number;
  player: ExclusivePlayerLike;
  enemies: readonly ExclusiveTarget[];
  damageMultiplier: number;
  machine: Readonly<Record<string, number>>;
  rng: () => number;
  healSink: (amount: number) => void;
  spendHp: (amount: number) => void;
  killHealSink: (amount: number) => void;
}

/**
 * 通用专武行为：math 状态机 + WeaponBehavior 接口适配。
 * 击杀回调挂点：state 暴露 onKilled(target) 时由装配层注入 target.onKilled（左轮处决装填）。
 */
export class ExclusiveWeaponBehavior<S> implements WeaponBehavior {
  readonly weaponId: string;
  readonly weaponClass = 'B' as const; // 手感归属仅遥测口径；门控/注册不区分（GDD §4 手感列）
  private enabled = false;
  protected readonly state: S;
  /** 质变卡 machine 参数（B3 池接入前为空 = 基础形态） */
  machine: Record<string, number> = {};
  /** 累计遥测（伤害占比/沙盘 DPS 采样数据源） */
  totalDamage = 0;
  /** 击杀回调（左轮补弹等；装配层按武注入） */
  onEnemyKilled?: (target: ExclusiveTarget) => void;
  /** B4 R-6 圣火十诫：十字落点爆炸回调（WeaponSystem 注入 → 余焰登记） */
  onExplode?: (x: number, y: number) => void;

  constructor(readonly exclusiveId: ExclusiveWeaponId, private readonly hooks: ExclusiveWeaponHooks<S>) {
    this.weaponId = exclusiveId;
    this.state = hooks.createState();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** NV-INTEG-FIX P0-5：门控只读（PlayScene 灯环可见性等视觉层判定用） */
  get isEnabled(): boolean {
    return this.enabled;
  }

  /** NV-INTEG-FIX P0-5：结算事件视觉钩子（fired/burst/... → FxManager 弹体/粒子；B6 欠账的可见化补口） */
  onEvents?: (events: string[], ctx: WeaponUpdateContext) => void;

  /** 质变卡参数写回（顺序解锁校验在升级池层；此处只收 machine） */
  applyMutationCard(machine: Record<string, number>): void {
    this.machine = { ...this.machine, ...machine };
  }

  /** 开局重置（重开不残留：state 重建 + machine 保留由调用方决定） */
  resetState(): void {
    const fresh = this.hooks.createState();
    Object.assign(this.state as object, fresh);
    this.totalDamage = 0;
  }

  /** B4-W2：内部结算状态读取（WeaponSystem R-2 回充读取左轮 AmmoState 等装配消费） */
  getState(): S {
    return this.state;
  }

  clearAll(): void {
    this.resetState();
  }

  applyClassUpgrade(): void {
    // 专武不吃通武类强化（全质变卡体系替代，R2-12）；no-op
  }

  update(ctx: WeaponUpdateContext): void {
    if (!this.enabled) return;
    // B4-W3 铁钉消费：重击类专武（巨斧 2.2s / 十字 3.0s ≥2.0s 阈值）冷却 ×0.92（keys.heavyCooldownMult）
    let effectiveMachine = this.machine;
    const baseInterval = EXCLUSIVE_WEAPONS[this.exclusiveId].params.interval ?? 0;
    const heavy = heavyCooldownMult(baseInterval, ctx.keyPassives);
    if (heavy !== 1) {
      effectiveMachine = {
        ...this.machine,
        cooldown: (this.machine['cooldown'] ?? baseInterval) * heavy,
      };
    }
    const player = ctx.player as unknown as ExclusivePlayerLike;
    // 击杀回调挂点注入（本次 ctx.enemies 的目标；onKilled 幂等覆盖）
    for (const e of ctx.enemies) {
      if (this.onEnemyKilled) e.onKilled = this.onEnemyKilled as unknown as (target: Enemy) => void;
    }
    const result = this.hooks.step(this.state, {
      onExplode: this.onExplode,
      dt: ctx.dt,
      now: ctx.now,
      player,
      enemies: ctx.enemies as readonly ExclusiveTarget[],
      damageMultiplier: ctx.damageMultiplier,
      machine: effectiveMachine,
      rng: Math.random,
      healSink: (amount) => {
        ctx.player.stats.heal(amount);
      },
      spendHp: (amount) => {
        ctx.player.stats.hp = Math.max(1, ctx.player.stats.hp - amount);
      },
      killHealSink: (amount) => {
        ctx.player.stats.heal(amount);
      },
    });
    this.totalDamage += result.damageDealt;
    // NV-INTEG-FIX P0-5：本帧事件上抛视觉层（左轮 tracer 等；即时结算近似的表现补口）
    if (result.events.length > 0 && this.onEvents) this.onEvents(result.events, ctx);
  }
}

/** 各武 hooks（step 适配：签名收敛到 StepArgs） */
function lanternHooks(): ExclusiveWeaponHooks<LanternState> {
  return {
    id: 'xw_lantern',
    createState: createLanternState,
    step: (s, a) => stepLantern(s, a.dt, a.now, a.player, a.enemies, a.damageMultiplier, a.machine),
  };
}
function revolverHooks(): ExclusiveWeaponHooks<RevolverState> {
  const stateRef: { current?: RevolverState } = {};
  return {
    id: 'xw_revolver',
    createState: () => {
      stateRef.current = createRevolverState({});
      return stateRef.current;
    },
    step: (s, a) => stepRevolver(s as RevolverState, a.dt, a.now, a.player, a.enemies, a.damageMultiplier, a.machine, a.rng),
  };
}
function twinbladesHooks(): ExclusiveWeaponHooks<TwinbladesState> {
  return {
    id: 'xw_twinblades',
    createState: createTwinbladesState,
    step: (s, a) => stepTwinblades(s, a.dt, a.now, a.player, a.enemies, a.damageMultiplier, a.machine, a.healSink),
  };
}
function longbowHooks(): ExclusiveWeaponHooks<LongbowState> {
  return {
    id: 'xw_longbow',
    createState: createLongbowState,
    step: (s, a) => stepLongbow(s, a.dt, a.now, a.player, a.enemies, a.damageMultiplier, a.machine),
  };
}
function bellHooks(): ExclusiveWeaponHooks<BellState> {
  return {
    id: 'xw_bell',
    createState: createBellState,
    step: (s, a) => stepBell(s, a.dt, a.now, a.player, a.enemies, a.damageMultiplier, a.machine, a.healSink),
  };
}
function crossHooks(): ExclusiveWeaponHooks<CrossState> {
  return {
    id: 'xw_cross',
    createState: createCrossState,
    step: (s, a) => stepCross(s, a.dt, a.now, a.player, a.enemies, a.damageMultiplier, a.machine, a.onExplode),
  };
}
function axeHooks(): ExclusiveWeaponHooks<AxeState> {
  return {
    id: 'xw_axe',
    createState: createAxeState,
    step: (s, a) => stepAxe(s, a.dt, a.now, a.player, a.enemies, a.damageMultiplier, a.machine, a.spendHp, a.killHealSink),
  };
}
function hornHooks(): ExclusiveWeaponHooks<HornState> {
  return {
    id: 'xw_horn',
    createState: createHornState,
    step: (s, a) => stepHorn(s, a.dt, a.now, a.player, a.enemies, a.damageMultiplier, a.machine),
  };
}

/** 8 专武行为工厂（WeaponSystem 构造时注册、默认 disabled；沙盘直接实例化复用） */
export function createExclusiveBehaviors(): Record<ExclusiveWeaponId, ExclusiveWeaponBehavior<unknown>> {
  const make = <S>(hooks: ExclusiveWeaponHooks<S>) => new ExclusiveWeaponBehavior<S>(hooks.id, hooks);
  const behaviors = {
    xw_lantern: make(lanternHooks()),
    xw_revolver: make(revolverHooks()),
    xw_twinblades: make(twinbladesHooks()),
    xw_longbow: make(longbowHooks()),
    xw_bell: make(bellHooks()),
    xw_cross: make(crossHooks()),
    xw_axe: make(axeHooks()),
    xw_horn: make(hornHooks()),
  };
  // 处决装填补弹：左轮行为击杀回调挂 ammo 补弹（machine 键 killGrantAmmo 驱动，B3 卡 2 接入）
  behaviors.xw_revolver.onEnemyKilled = () => {
    const behavior = behaviors.xw_revolver;
    const grant = behavior.machine['killGrantAmmo'];
    if (grant !== undefined && grant > 0) {
      // 经 math 层钩子（revolverOnKill）操作行为内 ammo state
      const state = (behavior as unknown as { state: RevolverState }).state;
      revolverOnKill(state, behavior.machine);
    }
  };
  return behaviors as Record<ExclusiveWeaponId, ExclusiveWeaponBehavior<unknown>>;
}
