/**
 * combat/damage.ts —— 伤害结算模块（ARCH §2 / S8 / E2-S1）
 *
 * 纯函数（test-framework §1.2：倍率聚合 / 命中伤害 / 无敌帧 / 死亡分发抽为纯函数，
 * 可脱离 Phaser 单测）。跨系统使用规则（ADR-001 §3）：
 * - 倍率与伤害计算统一走本模块，实体不各自实现伤害逻辑；
 * - 死亡分发：调用方在 `hitEnemy` 返回 true 时收到「已击杀」，再走实体 kill 流程
 *   （enemy.kill() 内部 emit `enemy:killed`，供 E3 经验宝石 / E4 统计接入）。
 *
 * 倍率语义（upgrade-pool v0.2 裁决）：
 * 总倍率 = 1 + 0.04×(等级−1) + Σ升级池加成（加法叠加防指数膨胀）。
 * 等级成长由 player-stats 维护（damageMultiplier 字段），升级池加成由 E3 写回累加。
 *
 * **易伤唯一入口（NV-REVIEW-FIX P0-3）**：易伤承伤乘区 ×(1+值) 只在本模块乘一次
 * （`computeHitDamage` / `hitEnemy`），投射/环绕/召唤/冲击波/衍生技/专武/共鸣一律走本入口，
 * 禁止各武器自乘一遍（否则倍增且抗性表失效）。Boss 易伤免疫由 `ccProfile` 抗性表承接
 * （`boss_4` 覆写 `vulnerable.immune`），本模块不特判。
 */

import { damageTakenMultiplier, type StatusState } from '@/combat/status/status-engine';

/** 可被扣血的目标（hp 可变） */
export interface Damageable {
  hp: number;
}

/**
 * 可吃易伤承伤乘区的目标（Enemy 结构性提供 `cc` 状态载荷）。
 * 无 `cc`（纯测试桩/非状态实体）= 不吃易伤，乘区恒 1（不并线不报错）。
 */
export interface VulnerableLike {
  cc?: StatusState;
}

/**
 * 目标承伤乘区：易伤期内 ×(1 + 易伤值)；否则 1。
 * 缺 `cc` 或缺 `now`（旧调用方未并线）= 1 —— 兼容层，新代码一律传全。
 */
export function targetDamageTakenMult(target: unknown, now?: number): number {
  const cc = (target as Partial<VulnerableLike> | null | undefined)?.cc;
  if (!cc || now === undefined) return 1;
  return damageTakenMultiplier(cc, now);
}

/** 可被击杀的目标：扣血至 0 后调用 kill() 回收/分发（enemy.kill 满足此接口） */
export interface Killable extends Damageable {
  kill(): void;
}

/**
 * 总倍率聚合：基础倍率（含等级成长）+ 升级池加成（E3 写回入口预留）。
 * 加法叠加（防指数膨胀，upgrade-pool §③）。
 */
export function totalMultiplier(baseMultiplier: number, upgradeBonus: number): number {
  return baseMultiplier + upgradeBonus;
}

/**
 * 命中伤害 = 武器基础伤害 × 总倍率 × 目标承伤乘区（易伤）。
 * `target`/`now` 缺省 = 无易伤并线（旧调用方兼容）；新代码传全以吃易伤。
 */
export function computeHitDamage(
  baseDamage: number,
  multiplier: number,
  target?: unknown,
  now?: number,
): number {
  return baseDamage * multiplier * targetDamageTakenMult(target, now);
}

/** 无敌帧判定：now < invulnerableUntil 期间免疫（时间戳比较，enemies §⑥.3 / RV-C7） */
export function isInvulnerable(nowSeconds: number, invulnerableUntil: number): boolean {
  return nowSeconds < invulnerableUntil;
}

/**
 * 延长无敌截止：取「现截止」与「now + duration」的较晚者（不缩短已有更长无敌）。
 * 主动技「提灯闪耀」无敌 1.5s 与受击 0.5s 无敌帧共用同一截止字段（player.invulnerableUntil）。
 */
export function extendInvulnerabilityUntil(
  currentUntil: number,
  nowSeconds: number,
  durationSeconds: number,
): number {
  return Math.max(currentUntil, nowSeconds + durationSeconds);
}

/**
 * 对目标扣血（clamp 到 0），返回是否死亡（HP ≤ 0）。
 * 不触发副作用 —— 死亡分发由调用方通过 hitEnemy / kill 完成。
 */
export function applyDamage(target: Damageable, amount: number): boolean {
  target.hp = Math.max(0, target.hp - amount);
  return target.hp <= 0;
}

/**
 * 统一「打中敌人」入口：易伤乘区 → 扣血 → 死亡则 kill()（回收 + emit enemy:killed）。
 * 返回是否击杀；调用方据此决定子弹是否消散/穿透。
 * W-B：可选 onDamaged 承伤回调（方阵成员受击 → FormationRuntime 路由）在扣血后触发。
 *
 * P0-3：`now` 传入即按目标 `cc` 乘易伤承伤乘区（唯一入口）。调用方**禁止**自乘易伤。
 */
export function hitEnemy<T extends Killable>(
  target: T & { onDamaged?: (t: T) => void },
  amount: number,
  now?: number,
): boolean {
  const killed = applyDamage(target, amount * targetDamageTakenMult(target, now));
  target.onDamaged?.(target);
  if (killed) target.kill();
  return killed;
}
