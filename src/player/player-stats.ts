/**
 * player/player-stats.ts —— 守夜人属性容器（ARCH §2 / upgrade-pool §③）
 *
 * 初始属性来源：upgrade-pool §③ + E1-S6 验收（移速 220px/s）。
 * 成长规则（纯逻辑可单测）：每级最大生命 +8、伤害倍率 +4%、每 5 级移速 +4px/s。
 *
 * 倍率语义（upgrade-pool v0.2 裁决 + design-review-e2 #2）：
 * 总倍率 = 1 + 0.04×(等级−1) + Σ升级池加成（加法叠加防指数膨胀）。
 * - damageMultiplier：等级成长部分（初始 1.0，每级 +0.04，等价上式）
 * - upgradeBonusMultiplier：升级池加成（E3-S5 写回累加，与等级成长分开）
 * - totalDamageMultiplier：两者之和（武器/伤害统一读此）
 * 避免「1+0.04×等级」在 Lv1 的 off-by-one：Lv1 = 1.0、Lv2 = 1.04。
 */

import { PLAYER, GROWTH } from '@/config/balance';
import type { Vec2 } from '@/utils/math';

export class PlayerStats {
  level: number = 1;
  maxHp: number = PLAYER.MAX_HP;
  hp: number = PLAYER.MAX_HP;
  moveSpeed: number = PLAYER.MOVE_SPEED;
  /** 等级成长部分倍率：初始 1.0，每级 +0.04（= 1 + 0.04×(等级−1)） */
  damageMultiplier: number = PLAYER.DAMAGE_MULTIPLIER;
  /** 升级池加成（E3-S5 写回累加；加法叠加防指数膨胀，upgrade-pool §③） */
  upgradeBonusMultiplier = 0;
  /** 吸血：每次击杀回复 HP（0 = 未解锁，upgrade-pool 第 8 项） */
  lifestealPerKill = 0;
  invulnerableTime: number = PLAYER.INVULNERABLE_TIME;

  /** 总倍率 = 等级成长 + 升级池加成（武器/伤害统一读此） */
  get totalDamageMultiplier(): number {
    return this.damageMultiplier + this.upgradeBonusMultiplier;
  }

  /** 升级成长：每级 +8HP/+4%、每 5 级 +4px/s（upgrade-pool §③） */
  levelUp(): void {
    this.level += 1;
    this.maxHp += GROWTH.HP_PER_LEVEL;
    this.hp = Math.min(this.maxHp, this.hp + GROWTH.HP_PER_LEVEL);
    this.damageMultiplier += GROWTH.DAMAGE_PCT_PER_LEVEL;
    if (this.level % GROWTH.SPEED_EVERY_N_LEVELS === 0) {
      this.moveSpeed += GROWTH.SPEED_PER_STEP;
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

  /** 击杀回复：PlayScene 在 enemy:killed 时调用（未解锁则无操作）；返回是否实际回血 */
  applyLifesteal(): boolean {
    if (this.lifestealPerKill <= 0) return false;
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + this.lifestealPerKill);
    return this.hp > before;
  }
}

/** 位移纯函数：移动向量 × 移速 × 秒（E1-S6 验收：getMove × 220px/s 位移） */
export function moveDisplacement(move: Vec2, speed: number, dtSeconds: number): Vec2 {
  return {
    x: move.x * speed * dtSeconds,
    y: move.y * speed * dtSeconds,
  };
}
