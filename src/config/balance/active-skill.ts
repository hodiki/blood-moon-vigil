/**
 * config/balance/active-skill.ts —— 主动技（4 角色）配置与红线
 *
 * balance.ts 域拆分（EG-1）纯搬移：数值与注释原样保留，不改任何行为。
 */

import type { HeroId } from './ids';

/**
 * 主动技（M1b 主动技迷你验证原型 · 守夜人·艾德蒙「提灯闪耀」）。
 * 数据源：content-design-outline §2.2（DEFENSE：周围 240px 眩晕 2.5s + 自身无敌 1.5s，CD 20s）
 * + pillars-v1 §6（CD 12~25s、无资源条、不打断移动、状态机冻结、释放后 100ms 输入锁防抖）。
 * 类型标签进入数据配置（pillars §6.2）：type: 'DEFENSE' | 'BURST' | 'MOBILITY'。
 */
export const ACTIVE_SKILL = {
  /** 内容 ID（content-design-outline §1.3：角色 hero_<id>，主动技随角色） */
  ID: 'hero_edmund_lantern_flash',
  /** 定位三选一：防御型（眩晕/无敌/护盾） */
  TYPE: 'DEFENSE',
  /** CD 20s（pillars §6.4：CD 12~25s；防御型中长） */
  CD: 20,
  /** 周围 240px（content §2.2） */
  RADIUS: 240,
  /** 敌人眩晕 2.5s（content §2.2） */
  STUN_DURATION: 2.5,
  /** 自身无敌 1.5s（content §2.2） */
  INVULN_DURATION: 1.5,
  /** 释放后 100ms 输入锁定防抖（pillars §6.7-3） */
  INPUT_LOCK_SECONDS: 0.1,
} as const;

/** 主动技平衡红线（pillars §5/§6.5 可检验含义；active-skill 模拟断言用） */
export const ACTIVE_SKILL_RULES = {
  /** 单局输出占比 ≤15%（6 分钟模拟，埋点 activeSkillDpsShare） */
  DPS_SHARE_MAX: 0.15,
  /** 平均每局触发 ≤18 次（CD 20s 理论 ~18 次，pillars §5-②） */
  MAX_CASTS_PER_RUN: 18,
  /** 目标中位 ~12 次（约每 30s 一次，pillars §5-②） */
  TYPICAL_CASTS: 12,
  /** 中位触发间隔 s（pillars §1：约每 30s 一次） */
  CAST_INTERVAL_MEDIAN: 30,
  /**
   * BURST 型守则（AC-C2 / sprint-m2-plan R7）：**CD ≥18s 或单次价值 ≤120** → 占比 ≤15%。
   * 违例配置（CD<18 且单次>120）在 `simulateActiveSkillDpsShare` 强制断言 FAIL（≈15.8% 越线案例锁死）。
   */
  BURST_MIN_CD: 18,
  BURST_MAX_DAMAGE_PER_CAST: 120,
  /** 红线条目（E1-S5 / gdd-active-skill §3.2 口径 1）：狂化「伤害倍率 +40%」= 加法叠加 +0.40（非乘算 ×1.40） */
  RAGE_MULTIPLIER_ADD: 0.40,
  /** 红线条目（E1-S5 / gdd-active-skill §3.2 口径 3）：狂化接触光环 = 平摊 25 伤/s（不按敌数叠加） */
  CONTACT_AURA_FLAT_DPS: 25,
  /** 工程常量（E4-S2）：血影突袭冲刺时长 s（240px / 0.2s = 1200px/s；GDD 未列精确值，标记为工程参数） */
  DASH_DURATION_SECONDS: 0.2,
  /** 工程常量（E4-S2）：狂化接触光环半径 px（接触判定；GDD 未列精确值，标记为工程参数） */
  CONTACT_AURA_RADIUS: 60,
} as const;

/** 主动技类型（pillars §6.2 / gdd-active-skill §3.1） */
export type ActiveSkillType = 'DEFENSE' | 'BURST' | 'MOBILITY';

/** 主动技配置（gdd-active-skill §3.2 / content-design-outline §2） */
export interface ActiveSkillConfig {
  heroId: HeroId;
  name: string;
  type: ActiveSkillType;
  cd: number;
  /** 充能制（血猎手 2 段，充能间隔 s） */
  charges?: number;
  chargeInterval?: number;
  /** 伤害型主动技只吃 0.5× 总倍率（gdd-active-skill §3.1/§3.2） */
  damageMultFactor?: number;
  radius?: number;
  stunDuration?: number;
  invulnDuration?: number;
  dashDistance?: number;
  dashDamage?: number;
  /** 冲刺时长 s（工程常量，gdd-active-skill §3.2 未列精确值；balance ACTIVE_SKILL_RULES.DASH_DURATION_SECONDS） */
  dashDuration?: number;
  markDamageMult?: number;
  markDuration?: number;
  slowPct?: number;
  slowDuration?: number;
  healPct?: number;
  duration?: number;
  moveSpeedPct?: number;
  /** 狂化倍率加法叠加 +0.40（口径 1；常量见 ACTIVE_SKILL_RULES.RAGE_MULTIPLIER_ADD） */
  rageMultiplierAdd?: number;
  /** 接触光环平摊 25 伤/s（口径 3；常量见 ACTIVE_SKILL_RULES.CONTACT_AURA_FLAT_DPS） */
  contactAuraFlat?: number;
  lifestealOnKill?: number;
}

/** 主动技表 4（gdd-active-skill §3.2 与 content-design-outline §2 逐项一致） */
export const ACTIVE_SKILLS: Record<HeroId, ActiveSkillConfig> = {
  hero_edmund: { heroId: 'hero_edmund', name: '提灯闪耀', type: 'DEFENSE', cd: 20, radius: 240, stunDuration: 2.5, invulnDuration: 1.5 },
  hero_cassandra: { heroId: 'hero_cassandra', name: '血影突袭', type: 'MOBILITY', cd: 12, charges: 2, chargeInterval: 8, dashDistance: 240, dashDuration: ACTIVE_SKILL_RULES.DASH_DURATION_SECONDS, dashDamage: 40, markDamageMult: 1.2, markDuration: 4, damageMultFactor: 0.5 },
  hero_violet: { heroId: 'hero_violet', name: '安魂曲', type: 'DEFENSE', cd: 22, radius: 300, slowPct: 0.4, slowDuration: 4, healPct: 0.2 },
  hero_galvan: { heroId: 'hero_galvan', name: '血月狂化', type: 'BURST', cd: 24, duration: 8, moveSpeedPct: 0.3, rageMultiplierAdd: ACTIVE_SKILL_RULES.RAGE_MULTIPLIER_ADD, contactAuraFlat: ACTIVE_SKILL_RULES.CONTACT_AURA_FLAT_DPS, lifestealOnKill: 1, damageMultFactor: 0.5 },
};
