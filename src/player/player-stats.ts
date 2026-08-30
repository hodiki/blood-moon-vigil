/**
 * player/player-stats.ts —— 玩家属性容器（ARCH §2 / upgrade-pool §③ / E4-S1 角色差异化）
 *
 * 初始属性来源：
 * - 默认（无角色）：upgrade-pool §③ + E1-S6 验收（移速 235px/s，TASK-39 已批 220→235）。
 * - E4-S1 角色：`new PlayerStats(hero)` 按 HEROES 配置初始化（初始 HP/移速/成长曲线）；
 *   守夜人运行时移速吸收 PLAYER.MOVE_SPEED=235（TASK-39，覆盖 HEROES 草图 220，见断言注明）。
 * 成长规则（纯逻辑可单测）：每级最大生命 +hpPerLevel、伤害倍率 +damagePctPerLevel、
 * 每 speedEveryNLevels 级移速 +speedPerStep（角色曲线见 content-design-outline §2.6）。
 *
 * 倍率语义（upgrade-pool v0.2 裁决 + design-review-e2 #2）：
 * 总倍率 = 1 + 0.04×(等级−1) + Σ升级池加成（加法叠加防指数膨胀）。
 * - damageMultiplier：等级成长部分（初始 1.0，每级 +0.04，等价上式）
 * - upgradeBonusMultiplier：升级池加成（E3-S5 写回累加，与等级成长分开）
 * - rageBonusMultiplier：主动技「血月狂化」倍率 buff（加法 +0.40，gdd-active-skill §3.2 口径 1）
 * - totalDamageMultiplier：三者之和（武器/伤害统一读此）
 * 避免「1+0.04×等级」在 Lv1 的 off-by-one：Lv1 = 1.0、Lv2 = 1.04。
 *
 * E4-S1 专属被动（content-design-outline §2.2~2.5）：
 * - 守夜人·提灯圣辉：经验磁力 +20px（magnetRadiusBonus）
 * - 血猎手·半裔之血：受击后 3s 内移速 +10%（hitSpeedBoost，Player.hurt 触发）
 * - 修女·执烛之心：拾取治疗道具效果 +50%（healBoostMultiplier，M3 治疗道具落地后生效）
 * - 狼裔·兽血愈合：击杀回复 0.5 HP（passiveLifestealPerKill，与吸血升级叠加）
 */

import { PLAYER, GROWTH, type HeroConfig, type HeroId } from '@/config/balance';
import type { Vec2 } from '@/utils/math';

/** 血猎手「半裔之血」：受击后移速加成窗口 s / 加成比例（content-design-outline §2.3） */
export const HIT_SPEED_BOOST = {
  DURATION_SECONDS: 3,
  PCT: 0.1,
} as const;

/** 守夜人「提灯圣辉」：经验磁力加成 px（content-design-outline §2.2） */
export const PASSIVE_MAGNET_RADIUS_BONUS = 20;

/** 修女「执烛之心」：治疗道具效果倍率（content-design-outline §2.4；M3 生效） */
export const PASSIVE_HEAL_BOOST_MULTIPLIER = 1.5;

/** 狼裔「兽血愈合」：击杀回复 HP（content-design-outline §2.5；与吸血升级叠加） */
export const PASSIVE_LIFESTEAL_PER_KILL = 0.5;

export class PlayerStats {
  level: number = 1;
  maxHp: number = PLAYER.MAX_HP;
  hp: number = PLAYER.MAX_HP;
  moveSpeed: number = PLAYER.MOVE_SPEED;
  /** 等级成长部分倍率：初始 1.0，每级 +0.04（= 1 + 0.04×(等级−1)） */
  damageMultiplier: number = PLAYER.DAMAGE_MULTIPLIER;
  /** 升级池加成（E3-S5 写回累加；加法叠加防指数膨胀，upgrade-pool §③） */
  upgradeBonusMultiplier = 0;
  /** E4-S2 主动技「血月狂化」：倍率 buff（加法 +0.40，gdd-active-skill §3.2 口径 1） */
  rageBonusMultiplier = 0;
  /** 吸血：每次击杀回复 HP（0 = 未解锁，upgrade-pool 第 8 项） */
  lifestealPerKill = 0;
  invulnerableTime: number = PLAYER.INVULNERABLE_TIME;

  // ---- E4-S1 角色差异化 ----
  /** 所属角色（无角色 = null，Demo 默认守夜人口径） */
  heroId: HeroId | null = null;
  /** 成长曲线（默认 Demo 标准曲线；E4-S1 角色按 HEROES 覆盖） */
  hpPerLevel: number = GROWTH.HP_PER_LEVEL;
  damagePctPerLevel: number = GROWTH.DAMAGE_PCT_PER_LEVEL;
  speedEveryNLevels: number = GROWTH.SPEED_EVERY_N_LEVELS;
  speedPerStep: number = GROWTH.SPEED_PER_STEP;
  /** 专属被动（content-design-outline §2.2~2.5；默认 0/1 无加成） */
  passiveLifestealPerKill = 0;
  healBoostMultiplier = 1;
  /** B5 属性 A-10 拾取半径（XpManager 装配时读取；与磁力区分——拾取=接触判定） */
  pickupRadiusBonus = 0;
  magnetRadiusBonus = 0;
  /** 血猎手受击加速：截止（秒时间戳）+ 加成比例 */
  private hitSpeedBoostUntil = 0;
  private readonly hitSpeedBoostPct = HIT_SPEED_BOOST.PCT;

  constructor(hero?: HeroConfig) {
    if (hero) {
      this.heroId = hero.id;
      this.maxHp = hero.initialHp;
      this.hp = hero.initialHp;
      // 守夜人运行时移速吸收 PLAYER.MOVE_SPEED=235（TASK-39 已批，覆盖 HEROES 草图 220；
      // 其余角色无独立运行时常量，配置表即验收值，见 heroes-config.test 口径注明）
      this.moveSpeed = hero.id === 'hero_edmund' ? PLAYER.MOVE_SPEED : hero.initialSpeed;
      this.hpPerLevel = hero.hpPerLevel;
      this.damagePctPerLevel = hero.damagePctPerLevel;
      this.speedEveryNLevels = hero.speedEveryNLevels;
      this.speedPerStep = hero.speedPerStep;
      // 专属被动（E4-S1；修女治疗增强为数据层标记，M3 治疗道具落地后消费）
      if (hero.id === 'hero_galvan') this.passiveLifestealPerKill = PASSIVE_LIFESTEAL_PER_KILL;
      if (hero.id === 'hero_violet') this.healBoostMultiplier = PASSIVE_HEAL_BOOST_MULTIPLIER;
      if (hero.id === 'hero_edmund') this.magnetRadiusBonus = PASSIVE_MAGNET_RADIUS_BONUS;
    }
  }

  /** 总倍率 = 等级成长 + 升级池加成 + 狂化 buff（武器/伤害统一读此；狂化加法叠加 +0.40） */
  get totalDamageMultiplier(): number {
    return this.damageMultiplier + this.upgradeBonusMultiplier + this.rageBonusMultiplier;
  }

  /** 升级成长：每级 +hpPerLevel/+damagePct、每 speedEveryNLevels 级移速 +speedPerStep（角色曲线） */
  levelUp(): void {
    this.level += 1;
    this.maxHp += this.hpPerLevel;
    this.hp = Math.min(this.maxHp, this.hp + this.hpPerLevel);
    this.damageMultiplier += this.damagePctPerLevel;
    if (this.level % this.speedEveryNLevels === 0) {
      this.moveSpeed += this.speedPerStep;
    }
  }

  /** E3-S5 写回：伤害强化 +15%（upgrade-pool 第 10 项） */
  addDamageBonus(bonus: number): void {
    this.upgradeBonusMultiplier += bonus;
  }

  /** E3-S5 写回：最大生命 +20（第 12 项）；同时回复等量 HP（与 levelUp 同语义） */
  addMaxHpBonus(bonus: number): void {
    this.maxHp += bonus;
    this.hp = Math.min(this.maxHp, this.hp + bonus);
  }

  /** E3-S5 写回：吸血（第 8 项） */
  setLifesteal(perKill: number): void {
    this.lifestealPerKill = perKill;
  }

  /** E4-S2 写回：狂化倍率 buff（加法 +0.40；无则 0） */
  setRageBonus(bonus: number): void {
    this.rageBonusMultiplier = bonus;
  }

  /** E4-S2 写回：狂化移速 buff 比例（gdd-active-skill §3.2：+30%，效果结束归 0） */
  rageSpeedPct = 0;
  /** E4-S4 升级池：移速百分比加成（up_g_4 移速 +8% ×3；与角色成长叠加） */
  moveSpeedBonusPct = 0;
  /** E4-S4 升级池：承伤减免（up_g_7 减伤 +10% ×3；与圣光壁垒 -10% 加法叠加，上限 -30%） */
  damageReduction = 0;
  /** E4-S4 升级池：濒死护盾剩余量（up_g_8；HP<25% 时一次性获得 60 护盾） */
  shield = 0;
  private deathShieldUsed = false;

  // ---- M3-DESIGN-1 数值方向化（upgrade-experience-v2 §2.3 / §4.3） ----
  /** up_g_3 鲜血契约：受击回血配置（amount/window/cd；未持有 = null） */
  private hitHeal: { amount: number; window: number; cd: number } | null = null;
  /** 受击回血：上次触发时刻（秒时间戳；用于内置 CD 判定） */
  private hitHealLastTrigger = -Infinity;
  /** 受击回血：当前回复窗口截止（秒时间戳；窗口内受击回复） */
  private hitHealWindowUntil = -Infinity;
  /** up_g_4 踏月而行：击杀移速 buff 配置（pct/duration；未持有 = null） */
  private killSpeedBuff: { pct: number; duration: number } | null = null;
  /** 踏月而行：击杀移速 buff 截止（秒时间戳） */
  private killSpeedBuffUntil = -Infinity;

  /** 击杀回复：吸血升级 + 狼裔专属被动（加法叠加，content §2.5）；未解锁且无被动则无操作 */
  applyLifesteal(): boolean {
    const perKill = this.lifestealPerKill + this.passiveLifestealPerKill;
    if (perKill <= 0) return false;
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + perKill);
    return this.hp > before;
  }

  /** 当前生效移速（受击加速 + 狂化移速 buff + 升级移速 % + 踏月击杀 buff 叠加；now 秒时间戳） */
  effectiveMoveSpeed(now: number): number {
    let mult = 1;
    if (now < this.hitSpeedBoostUntil) mult += this.hitSpeedBoostPct;
    mult += this.rageSpeedPct;
    mult += this.moveSpeedBonusPct;
    if (now < this.killSpeedBuffUntil && this.killSpeedBuff) mult += this.killSpeedBuff.pct;
    // W-4 外部减速乘区（血渍区/领域类地面效应；0.85 = 减速 15%）
    mult *= this.externalSlowMult;
    return this.moveSpeed * mult;
  }

  /** W-4 外部减速乘区（地面效应写入口；1 = 无减速） */
  externalSlowMult = 1;
  setExternalSlowMult(mult: number): void {
    this.externalSlowMult = Math.max(0, mult);
  }

  /** E4-S4 写回：移速 +8%（up_g_4；与角色成长叠加） */
  addMoveSpeedPctBonus(pct: number): void {
    this.moveSpeedBonusPct += pct;
  }

  /** M3-DESIGN-1 up_g_3 鲜血契约：写入受击回血配置（amount/window/cd；×3 覆盖式，数值同源） */
  setHitHeal(config: { amount: number; window: number; cd: number }): void {
    this.hitHeal = config;
  }

  /**
   * M3-DESIGN-1 up_g_3 鲜血契约：受击触发判定（Player.hurt 调用）。
   * 已配置且距上次触发 ≥ cd → 开启 5s 回复窗口，返回 true（调用方回复 amount）；
   * 窗口内再次受击不刷新窗口（一次受击一次判定）。
   */
  maybeTriggerHitHeal(nowSeconds: number): boolean {
    if (!this.hitHeal) return false;
    if (nowSeconds - this.hitHealLastTrigger < this.hitHeal.cd) return false;
    this.hitHealLastTrigger = nowSeconds;
    this.hitHealWindowUntil = nowSeconds + this.hitHeal.window;
    return true;
  }

  /** M3-DESIGN-1 up_g_3 鲜血契约：受击回复量（窗口内 10 HP；Player.hurt 消费后回血） */
  applyHitHeal(): number {
    if (!this.hitHeal) return 0;
    const heal = Math.min(this.hitHeal.amount, this.maxHp - this.hp);
    this.hp += heal;
    return heal;
  }

  /**
   * B2-W1 通用回复落点（clamp 到 maxHp，返回实际回复量）：
   * 专武吸血/血爆回复/圣铃铃响/衍生技治疗统一走此口（HUD hp:changed 由调用方 emit）。
   */
  heal(amount: number): number {
    const applied = Math.max(0, Math.min(amount, this.maxHp - this.hp));
    this.hp += applied;
    return applied;
  }

  /** M3-DESIGN-1 up_g_3 鲜血契约：当前是否处于回复窗口（测试/表现层查询） */
  isHitHealWindowActive(nowSeconds: number): boolean {
    return !!this.hitHeal && nowSeconds <= this.hitHealWindowUntil;
  }

  /** M3-DESIGN-1 up_g_4 踏月而行：写入击杀移速 buff 配置（pct/duration；×3 覆盖式） */
  setKillSpeedBuff(config: { pct: number; duration: number }): void {
    this.killSpeedBuff = config;
  }

  /** M3-DESIGN-1 up_g_4 踏月而行：击杀触发（PlayScene.onEnemyKilled 调用；2s 移速 +15%） */
  triggerKillSpeedBuff(nowSeconds: number): void {
    if (!this.killSpeedBuff) return;
    this.killSpeedBuffUntil = nowSeconds + this.killSpeedBuff.duration;
  }

  /** M3-DESIGN-1 up_g_4 踏月而行：当前是否处于击杀移速 buff（测试/表现层查询） */
  isKillSpeedBuffActive(nowSeconds: number): boolean {
    return !!this.killSpeedBuff && nowSeconds <= this.killSpeedBuffUntil;
  }

  /** E4-S4 写回：承伤减免 +10%（up_g_7；与圣光壁垒加法叠加，上限 30%） */
  addDamageReduction(pct: number): void {
    this.damageReduction = Math.min(0.3, this.damageReduction + pct);
  }

  /** E4-S4 写回：濒死护盾阈值判定（HP<25% 且未使用 → 获得 60 护盾，每局 1 次） */
  maybeTriggerDeathShield(thresholdPct: number, shieldAmount: number): boolean {
    if (this.deathShieldUsed) return false;
    if (this.maxHp <= 0 || this.hp / this.maxHp >= thresholdPct) return false;
    this.deathShieldUsed = true;
    this.shield = shieldAmount;
    return true;
  }

  /** 伤害经护盾吸收 + 承伤减免后进入 HP（Player.hurt 消费）；返回实际扣血 */
  absorbDamage(amount: number): number {
    const reduced = amount * (1 - this.damageReduction);
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, reduced);
      this.shield -= absorbed;
      return reduced - absorbed; // 护盾吸收后剩余进入 HP
    }
    return reduced;
  }

  /** 血猎手「半裔之血」：受击触发（Player.hurt 调用；3s 内移速 +10%） */
  triggerHitSpeedBoost(now: number): void {
    this.hitSpeedBoostUntil = now + HIT_SPEED_BOOST.DURATION_SECONDS;
  }

  /** 血猎手受击加速是否生效（测试/表现层查询） */
  isHitSpeedBoostActive(now: number): boolean {
    return now < this.hitSpeedBoostUntil;
  }

  /** 修女「执烛之心」：治疗量放大（M3 治疗道具消费；纯数据层口径常量） */
  boostedHealAmount(baseHeal: number): number {
    return baseHeal * this.healBoostMultiplier;
  }
}

/** 位移纯函数：移动向量 × 移速 × 秒（E1-S6 验收：getMove × 235px/s 位移） */
export function moveDisplacement(move: Vec2, speed: number, dtSeconds: number): Vec2 {
  return {
    x: move.x * speed * dtSeconds,
    y: move.y * speed * dtSeconds,
  };
}
