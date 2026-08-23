/**
 * enemies/boss-math.ts —— Boss 机制纯函数层（E4-S2 / E3-S5，可脱离 Phaser 单测）
 *
 * 霸体逻辑（enemies §⑥.5 / art-bible §4）：出场 0.5s 霸体闪红，期内不承伤。
 * WeaponSystem.refreshEnemies 用 `isBossInGrace(now, e.graceUntil)` 过滤目标。
 *
 * E3-S5 扩展（gdd-enemies-v2 §3.4 / §⑥.9 / sim-verify §7）：
 * - 阶段 2（HP<50%）触发 + 阶段切换 1s 霸体（防卡阶段秒杀）
 * - 阶段 2 召唤（尼禄 2 圣杯侍僧 / 芬里厄 2 灰狼）
 * - 血月化身 4:30 后 5% 月坠（稀有奖励，非进度门）
 * - Boss 战 60~90s 判据（HP ÷ (DPS × 0.85)）
 */

import { BOSS, BOSSES, BOSS_FIGHT, BOSS_PHASE2_SUMMON, MOON_AVATAR, type BossId, type EnemyId } from '@/config/balance';

/** 霸体截止 = 出场时刻 + 0.5s（enemies §⑥.5） */
export function bossGraceEndsAt(nowSeconds: number): number {
  return nowSeconds + BOSS.GRACE_SECONDS;
}

/** 是否处于霸体（now < graceUntil → 期内不承伤） */
export function isBossInGrace(nowSeconds: number, graceUntil: number): boolean {
  return nowSeconds < graceUntil;
}

/** Boss 阶段：HP<50% 进入阶段 2（gdd-enemies §3.4） */
export function bossPhaseFor(hp: number, maxHp: number): 1 | 2 {
  return hp / maxHp < 0.5 ? 2 : 1;
}

/** 阶段切换霸体截止 = 切换时刻 + 1s（gdd-enemies §⑥.9：转阶段不承伤，防卡阶段秒杀） */
export function bossPhaseGraceEndsAt(nowSeconds: number): number {
  return nowSeconds + BOSS_FIGHT.PHASE_SWITCH_GRACE_SECONDS;
}

/** 是否处于阶段切换霸体（期内不承伤） */
export function isBossPhaseGrace(nowSeconds: number, phaseGraceUntil: number): boolean {
  return nowSeconds < phaseGraceUntil;
}

/** 阶段 2 召唤（boss_2 → 2 圣杯侍僧；boss_3 → 2 灰狼；基准 Boss 无；§3.4） */
export function bossPhase2Summon(bossId: BossId): { summonedId: EnemyId; count: number } | null {
  return BOSS_PHASE2_SUMMON[bossId] ?? null;
}

/** 血月化身月坠（§⑥.10：4:30 后 5%/次判定；「已触发本局不再触发」由调用方 once 保证） */
export function moonAvatarTriggerDue(elapsedSeconds: number, roll: number): boolean {
  return elapsedSeconds >= MOON_AVATAR.AFTER_SECONDS && roll < MOON_AVATAR.TRIGGER_CHANCE;
}

/** Boss 战时长（sim-verify §7：HP ÷ (DPS × 实战折减)；埋点 bossFightSeconds） */
export function bossFightSeconds(
  hp: number,
  dps: number,
  practicalFactor: number = BOSS_FIGHT.PRACTICAL_FACTOR,
): number {
  return hp / (dps * practicalFactor);
}

/**
 * R2 预案（sprint-m2-plan 风险表 R2）：尼禄实际生效 HP。
 * 默认 GDD 值 4500；真机复测（bossFightSeconds >90）确认后主理人批准开启 fallback（4300）。
 */
export function neroEffectiveHp(): number {
  return BOSS_FIGHT.NERO_HP_FALLBACK_ENABLED ? BOSS_FIGHT.NERO_HP_FALLBACK : BOSSES.boss_2.hp;
}
