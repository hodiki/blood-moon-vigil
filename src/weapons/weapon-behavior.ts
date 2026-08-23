/**
 * weapons/weapon-behavior.ts —— 武器行为接口 + 注册表（E2-S1 / architecture §2）
 *
 * WeaponSystem 由「3 硬编码」重构为「WeaponId → WeaponBehavior 实例注册表」：
 * - 统一接口 `WeaponBehavior { update(dt, now, ctx) }`（gdd-weapons-v2 §3.0）；
 * - 既有血月猎手/守夜之环/月蚀脉冲迁移为注册行为，行为等价（DPS/冷却/上限断言不变）；
 * - 新武器行为（A2~A5 / B2~B3 / C2~C3 / D1~D3 + 超武）按类注册，update 统一遍历。
 *
 * 纯逻辑部分（冷却/命中/上限数学）在 weapon-runtime.ts / weapon-math.ts（可单测）；
 * 本层只做装配与帧转发（架构纪律：scenes/weapons 不写业务数学）。
 */

import type { WeaponId, WeaponClass } from '@/config/balance';
import type { Player } from '@/player/player';
import type { Enemy } from '@/enemies/enemy';
import type { ClassUpgradeStacks } from '@/weapons/class-upgrades';
import type { KeyPassiveState } from '@/upgrade/upgrade-apply-v2';

/** 武器每帧上下文（由 WeaponSystem.update 装配；enemies 已按霸体过滤） */
export interface WeaponUpdateContext {
  dt: number;
  now: number;
  player: Player;
  /** 可命中敌人（graceUntil 已过滤，E4-S2 Boss 霸体期内非目标） */
  enemies: readonly Enemy[];
  /** 总伤害倍率（player.stats.totalDamageMultiplier） */
  damageMultiplier: number;
}

/** 武器行为统一接口（gdd-weapons-v2 §3.0 / E2-S1） */
export interface WeaponBehavior {
  readonly weaponId: WeaponId;
  readonly weaponClass: WeaponClass;
  /** 每帧推进（冷却/发射/命中/召唤/领域） */
  update(ctx: WeaponUpdateContext): void;
  /** 玩家死亡：清除全部弹体/环绕球/召唤物/地面领域 + 冷却重置（gdd-weapons-v2 §⑥.7） */
  clearAll(): void;
  /** 门控：未拥有武器不运行（初始仅 1 把；其余由解锁流开启，E4-S5） */
  setEnabled(enabled: boolean): void;
  /** 类强化写回（E2-S8）：重算派生参数 */
  applyClassUpgrade(stacks: ClassUpgradeStacks): void;
  /** E4-S4 钥被动写回（key_* 数值效果；不支持的行为为 no-op） */
  applyKeyPassives?(keys: KeyPassiveState): void;
  /**
   * M3-DESIGN-1 up_g_2 专精疾射：独立冷却乘区写回（WeaponSystem 广播）。
   * multiplier = 目标武器 ×0.88^stack，非目标 ×1.0（乘区独立、乘法叠加，upgrade-experience-v2 §六-4）；
   * 无冷却/不支持的行为为 no-op。
   */
  applyFocusedCooldown?(multiplier: number): void;
}

/** 武器行为注册表（WeaponSystem 持有；新武器按 WeaponId 注册） */
export class WeaponRegistry {
  private readonly behaviors = new Map<WeaponId, WeaponBehavior>();

  register(behavior: WeaponBehavior): void {
    this.behaviors.set(behavior.weaponId, behavior);
  }

  get(weaponId: WeaponId): WeaponBehavior | undefined {
    return this.behaviors.get(weaponId);
  }

  has(weaponId: WeaponId): boolean {
    return this.behaviors.has(weaponId);
  }

  get size(): number {
    return this.behaviors.size;
  }

  /** 遍历全部注册行为（update/clearAll 统一入口） */
  each(fn: (behavior: WeaponBehavior) => void): void {
    for (const behavior of this.behaviors.values()) fn(behavior);
  }

  /** 类强化写回广播（E2-S8）：全部行为重算派生参数 */
  applyClassUpgrade(stacks: ClassUpgradeStacks): void {
    this.each((behavior) => behavior.applyClassUpgrade(stacks));
  }

  /** E4-S4 钥被动写回广播（key_* 数值效果；不支持的行为 no-op） */
  applyKeyPassives(keys: KeyPassiveState): void {
    this.each((behavior) => behavior.applyKeyPassives?.(keys));
  }

  /** M3-DESIGN-1 专精疾射广播：目标武器 ×mult / 非目标 ×1.0（无冷却行为 no-op） */
  applyFocusedCooldown(targetWeaponIds: readonly WeaponId[], multiplier: number): void {
    this.each((behavior) =>
      behavior.applyFocusedCooldown?.(targetWeaponIds.includes(behavior.weaponId) ? multiplier : 1),
    );
  }
}
