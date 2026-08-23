/**
 * active-skill/active-skill-runtime.ts —— 主动技运行时配置（E4-S3，升级分支 12 项生效）
 *
 * 纯逻辑类（可脱离 Phaser 单测）：以 ACTIVE_SKILLS 基础配置为底，applyUpgrade 逐分支改写。
 * 数据源：gdd-active-skill §3.3 主动技强化分支表 + UPGRADE_POOL 中 up_a_<分支>_<hero> 12 项。
 *
 * 分支语义（每角色 3 分支、各 1 次；CD 型角色「二次充能」槽位替换为同强度效果增强）：
 * - up_a_cd_<hero>：CD -25%（守夜人 20→15 / 血猎手 12→9 / 修女 22→16.5 / 狼裔 24→18）
 * - up_a_charge_<hero>：二次充能
 *   · 血猎手（充能型）：充能间隔 8s→4s/段（等效总 CD 12s）
 *   · 守夜人（CD 型替换）：眩晕 +1s
 *   · 修女（CD 型替换）：回复 +10%
 *   · 狼裔（CD 型替换）：狂化中吸血 +1 HP
 * - up_a_effect_<hero>：效果增强
 *   · 守夜人：眩晕 +1s / 无敌 +0.5s
 *   · 血猎手：冲刺距离 +25%（240→300px）/ 标记伤害 +10%（1.2→1.3）
 *   · 修女：减速 +20%（0.4→0.6）/ 回复 +10%（0.2→0.3）
 *   · 狼裔：狂化 +2s（8→10）/ 吸血 +1 HP（击杀回 2 HP）
 */

import { ACTIVE_SKILLS, type ActiveSkillConfig, type HeroId, type UpgradeId } from '@/config/balance';

/** 主动技运行时参数（基础配置副本 + 升级改写；PlayScene 效果结算统一读本类） */
export class ActiveSkillRuntimeConfig {
  readonly heroId: HeroId;
  readonly name: string;
  cd: number;
  charges?: number;
  chargeInterval?: number;
  radius?: number;
  stunDuration?: number;
  invulnDuration?: number;
  dashDistance?: number;
  dashDamage?: number;
  markDamageMult?: number;
  markDuration?: number;
  slowPct?: number;
  slowDuration?: number;
  healPct?: number;
  duration?: number;
  moveSpeedPct?: number;
  lifestealOnKill?: number;
  damageMultFactor?: number;

  constructor(base: ActiveSkillConfig) {
    this.heroId = base.heroId;
    this.name = base.name;
    this.cd = base.cd;
    this.charges = base.charges;
    this.chargeInterval = base.chargeInterval;
    this.radius = base.radius;
    this.stunDuration = base.stunDuration;
    this.invulnDuration = base.invulnDuration;
    this.dashDistance = base.dashDistance;
    this.dashDamage = base.dashDamage;
    this.markDamageMult = base.markDamageMult;
    this.markDuration = base.markDuration;
    this.slowPct = base.slowPct;
    this.slowDuration = base.slowDuration;
    this.healPct = base.healPct;
    this.duration = base.duration;
    this.moveSpeedPct = base.moveSpeedPct;
    this.lifestealOnKill = base.lifestealOnKill;
    this.damageMultFactor = base.damageMultFactor;
  }

  /** 是否为充能型（血猎手） */
  get isCharged(): boolean {
    return (this.charges ?? 1) > 1;
  }

  /**
   * 应用主动技强化分支（up_a_*，gdd-active-skill §3.3 / upgrade-pool-v2 §3.5）。
   * 返回是否识别该分支（非 up_a_* → false）。
   */
  applyUpgrade(upgradeId: UpgradeId): boolean {
    if (!upgradeId.startsWith('up_a_')) return false;
    // 解析：up_a_<分支>_<hero-short>（split('_') → ['up','a',分支,hero]）
    const parts = upgradeId.split('_');
    const branch = parts[2] as 'cd' | 'charge' | 'effect';
    const heroShort = this.heroId.replace('hero_', '');
    if (parts[3] !== heroShort) return false; // 非本角色分支（标签过滤已保证，防越权）
    switch (branch) {
      case 'cd':
        this.cd = this.cd * 0.75; // CD -25%
        break;
      case 'charge':
        this.applyChargeBranch();
        break;
      case 'effect':
        this.applyEffectBranch();
        break;
      default:
        return false;
    }
    return true;
  }

  private applyChargeBranch(): void {
    if (this.isCharged) {
      // 血猎手充能型：充能 8s→4s/段（等效总 CD 12s，gdd-active-skill §3.3）
      this.chargeInterval = (this.chargeInterval ?? 8) / 2;
      return;
    }
    // CD 型角色「二次充能」槽位替换为同强度效果增强（§3.3）
    switch (this.heroId) {
      case 'hero_edmund':
        this.stunDuration = (this.stunDuration ?? 2.5) + 1; // 眩晕 +1s
        break;
      case 'hero_violet':
        this.healPct = (this.healPct ?? 0.2) + 0.1; // 回复 +10%
        break;
      case 'hero_galvan':
        this.lifestealOnKill = (this.lifestealOnKill ?? 1) + 1; // 狂化中吸血 +1 HP
        break;
      default:
        break;
    }
  }

  private applyEffectBranch(): void {
    switch (this.heroId) {
      case 'hero_edmund':
        this.stunDuration = (this.stunDuration ?? 2.5) + 1; // 眩晕 +1s
        this.invulnDuration = (this.invulnDuration ?? 1.5) + 0.5; // 无敌 +0.5s
        break;
      case 'hero_cassandra':
        this.dashDistance = (this.dashDistance ?? 240) * 1.25; // 冲刺距离 +25%
        this.markDamageMult = (this.markDamageMult ?? 1.2) + 0.1; // 标记伤害 +10%（1.2→1.3）
        break;
      case 'hero_violet':
        this.slowPct = (this.slowPct ?? 0.4) + 0.2; // 减速 +20%（0.4→0.6）
        this.healPct = (this.healPct ?? 0.2) + 0.1; // 回复 +10%（0.2→0.3）
        break;
      case 'hero_galvan':
        this.duration = (this.duration ?? 8) + 2; // 狂化 +2s（8→10）
        this.lifestealOnKill = (this.lifestealOnKill ?? 1) + 1; // 吸血 +1 HP（击杀回 2 HP）
        break;
      default:
        break;
    }
  }
}

/** 按角色构造运行时配置（PlayScene 开局装配；测试可断言基础值） */
export function createActiveSkillRuntime(heroId: HeroId): ActiveSkillRuntimeConfig {
  return new ActiveSkillRuntimeConfig(ACTIVE_SKILLS[heroId]);
}
