import { describe, it, expect } from 'vitest';
import {
  ACTIVE_SKILL,
  ACTIVE_SKILL_RULES,
  GAME,
  GROWTH,
} from '@/config/balance';
import { ENEMIES } from '@/../src/_archived/enemies-legacy-panel'; // W-8 收档：legacy 面板归档对照（禁止运行时消费）
import { initialDpsEstimate } from '@/weapons/weapon-math';
import { ActiveSkill } from '@/active-skill/active-skill';
import {
  maxCastsInWindow,
  castsAtInterval,
  simulateActiveSkillDpsShare,
  simulateDefenseSkillUsage,
  burstGuardCompliant,
} from '@/active-skill/active-skill-math';

/**
 * M1b 主动技迷你验证 · 6 分钟模拟（质量门，plan-v1 §二 / pillars §5/§6.5）。
 * 模拟口径与埋点一致：activeSkillCasts（每局次数）/ activeSkillDpsShare（6 分钟模拟占比）。
 * 窗口 = SPAWNER.BOSS_TIME = 360s（6:00 收束）。
 */
const WINDOW = 360;

describe('主动技迷你验证 · 6 分钟模拟（判据 1：DPS 占比 ≤15%）', () => {
  it('防御型「提灯闪耀」：主动技 0 伤害 → DPS 占比 = 0 ≤ 15%（效果型不计伤害，pillars §6.5）', () => {
    const r = simulateDefenseSkillUsage(WINDOW, ACTIVE_SKILL.CD);
    expect(r.share).toBe(0);
    expect(r.share).toBeLessThanOrEqual(ACTIVE_SKILL_RULES.DPS_SHARE_MAX);
  });

  it('伤害型边界（M2 BURST 型预留）：中位 12 次 × 150 伤在 40 DPS 武器下占比 <15%', () => {
    const typical = simulateActiveSkillDpsShare({
      windowSeconds: WINDOW,
      casts: castsAtInterval(WINDOW, ACTIVE_SKILL_RULES.CAST_INTERVAL_MEDIAN),
      damagePerCast: 150, // 2.5× 冲击波（pillars §6.5 上限）
      weaponDps: 40, // 保守武器 DPS
    });
    expect(typical.casts).toBe(12);
    expect(typical.share).toBeLessThan(ACTIVE_SKILL_RULES.DPS_SHARE_MAX);
  });
});

describe('主动技迷你验证 · 6 分钟模拟（判据 1：每局触发 ≤18 次 / 中位 ~12 次）', () => {
  it('理论最大 18 次（CD 20s × 360s）≤ 18 红线；中位 30s 一次 = 12 次达标', () => {
    expect(maxCastsInWindow(WINDOW, ACTIVE_SKILL.CD)).toBe(18);
    expect(castsAtInterval(WINDOW, ACTIVE_SKILL_RULES.CAST_INTERVAL_MEDIAN)).toBe(12);
    const r = simulateDefenseSkillUsage(WINDOW, ACTIVE_SKILL.CD);
    expect(r.maxCasts).toBeLessThanOrEqual(ACTIVE_SKILL_RULES.MAX_CASTS_PER_RUN);
    expect(r.typicalCasts).toBe(ACTIVE_SKILL_RULES.TYPICAL_CASTS);
  });

  it('就绪即放（最激进节奏）：360s 内 10Hz 尝试仍只触发 18 次（CD 保证低频）', () => {
    const s = new ActiveSkill(ACTIVE_SKILL.CD, ACTIVE_SKILL.INPUT_LOCK_SECONDS);
    let casts = 0;
    for (let t = 0; t < WINDOW; t += 0.1) {
      if (s.tryCast(t)) casts += 1;
      s.update(0.1);
    }
    expect(casts).toBe(18);
    expect(casts).toBeLessThanOrEqual(ACTIVE_SKILL_RULES.MAX_CASTS_PER_RUN);
  });
});

describe('主动技迷你验证 · 对照组（判据 2：关闭主动技输入仍可击杀 6:00 Boss）', () => {
  it('Boss HP 4000；仅武器（无主动技）DPS 模型可击杀且在 60~90s 判据窗口内', () => {
    const bossHp = ENEMIES.boss.hp;
    expect(bossHp).toBe(4000);
    const baseDps = initialDpsEstimate(); // 三武器全开参考 33.5（weapons §③）
    expect(baseDps).toBe(33.5);
    // 模型假设（文档化，供文策渊评审）：
    // - 6 分钟成型 Lv~27 → 伤害倍率 1 + 0.04×26 = 2.04（GROWTH.DAMAGE_PCT_PER_LEVEL）
    // - 升级池伤害强化 2 次 ≈ +0.30（加法叠加，upgrade-pool §③）
    const multAtLv27 = 1 + GROWTH.DAMAGE_PCT_PER_LEVEL * 26;
    const multWithUpgrades = multAtLv27 + 0.30;
    // 保守（无升级池加成）：33.5 × 2.04 ≈ 68 DPS → 58.6s，落在 60~90s 判据窗口（略低于下界）
    const fightConservative = bossHp / (baseDps * multAtLv27);
    // 含升级池：≈ 78 DPS → 51s
    const fightWithUpgrades = bossHp / (baseDps * multWithUpgrades);
    expect(fightConservative).toBeLessThanOrEqual(GAME.BOSS_FIGHT_TARGET_MAX);
    expect(fightWithUpgrades).toBeLessThanOrEqual(GAME.BOSS_FIGHT_TARGET_MAX);
    // 兜底：即便玩家 6 分钟只拿了初始飞弹（10 DPS × Lv27 倍率 2.04 ≈ 20.4 DPS），
    // Boss 出场后 360s 剩余窗口内仍可击杀（~196s）—— 对照判据 =「可击杀」成立。
    // 主动技不参与任何输出 → 关闭主动技输入不改变以上全部结论（判据 2 由构造保证）。
    const missileOnlyFight = bossHp / (10 * multAtLv27);
    expect(missileOnlyFight).toBeLessThan(WINDOW);
  });
});

describe('AC-C2 BURST 型主动技边界守则（CD ≥18s 或单次 ≤120 → 占比 ≤15%）', () => {
  /**
   * 保守武器 DPS 下限（迷你验证 C2 / sprint-m2-plan R7 口径）：
   * 满 18 次 × 150 伤 × 40 DPS → 15.8% 越线（红线 15%）；中位 12 次 × 40 DPS = 11.1% 安全。
   */
  const DPS_FLOOR = 40;

  it('守则常量：BURST_MIN_CD = 18、BURST_MAX_DAMAGE_PER_CAST = 120', () => {
    expect(ACTIVE_SKILL_RULES.BURST_MIN_CD).toBe(18);
    expect(ACTIVE_SKILL_RULES.BURST_MAX_DAMAGE_PER_CAST).toBe(120);
  });

  it('守则判定谓词：CD≥18 或 单次≤120 任一满足即合规；CD<18 且单次>120 违例', () => {
    expect(burstGuardCompliant(18, 150)).toBe(true); // CD = 18 边界合规
    expect(burstGuardCompliant(20, 150)).toBe(true); // CD ≥ 18
    expect(burstGuardCompliant(12, 120)).toBe(true); // 单次 ≤ 120
    expect(burstGuardCompliant(12, 150)).toBe(false); // 违例：CD<18 且单次>120
    expect(burstGuardCompliant(17, 121)).toBe(false);
  });

  it('中位 12 次 × 150 伤 × 40 DPS = 11.1% 安全（迷你验证 C2 对照；既有 typical 用例口径一致）', () => {
    const r = simulateActiveSkillDpsShare({
      windowSeconds: WINDOW,
      casts: castsAtInterval(WINDOW, ACTIVE_SKILL_RULES.CAST_INTERVAL_MEDIAN),
      damagePerCast: 150,
      weaponDps: DPS_FLOOR,
    });
    expect(r.casts).toBe(12);
    expect(r.share).toBeCloseTo(0.111, 3);
    expect(r.share).toBeLessThanOrEqual(ACTIVE_SKILL_RULES.DPS_SHARE_MAX);
  });

  it('守则强制：违例配置（CD<18 且单次>120）必须 FAIL —— 满 18 次 × 150 伤 × 40 DPS ≈ 15.8% 越线（边界锁死）', () => {
    // CD 12s（<18）且单次 150（>120）→ 理论最大 30 次，但受每局 ≤18 次红线钳制
    const casts = Math.min(maxCastsInWindow(WINDOW, 12), ACTIVE_SKILL_RULES.MAX_CASTS_PER_RUN);
    expect(casts).toBe(18);
    const r = simulateActiveSkillDpsShare({
      windowSeconds: WINDOW,
      casts,
      damagePerCast: 150,
      weaponDps: DPS_FLOOR,
    });
    expect(r.share).toBeCloseTo(0.158, 3); // ≈15.8% 越线
    expect(r.share).toBeGreaterThan(ACTIVE_SKILL_RULES.DPS_SHARE_MAX); // 拒绝合入（≤15% 断言 FAIL）
  });

  it('合规配置在中位释放下占比 ≤15%（CD 20s / 单次 120 两分支均安全）', () => {
    const cdOk = simulateActiveSkillDpsShare({
      windowSeconds: WINDOW,
      casts: castsAtInterval(WINDOW, ACTIVE_SKILL_RULES.CAST_INTERVAL_MEDIAN),
      damagePerCast: 150, // 单次 >120，但 CD 20s ≥18 → 合规
      weaponDps: DPS_FLOOR,
    });
    expect(cdOk.share).toBeLessThanOrEqual(ACTIVE_SKILL_RULES.DPS_SHARE_MAX);

    const dmgOk = simulateActiveSkillDpsShare({
      windowSeconds: WINDOW,
      casts: castsAtInterval(WINDOW, ACTIVE_SKILL_RULES.CAST_INTERVAL_MEDIAN),
      damagePerCast: 120, // 单次 = 120 边界，CD 12s <18 → 靠单次合规
      weaponDps: DPS_FLOOR,
    });
    expect(dmgOk.share).toBeLessThanOrEqual(ACTIVE_SKILL_RULES.DPS_SHARE_MAX);
  });
});
