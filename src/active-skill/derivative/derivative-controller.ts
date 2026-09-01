/**
 * active-skill/derivative/derivative-controller.ts —— 衍生技施法控制器（B5-W4，B2 遗留收拢）
 *
 * 替代旧 4 技 ActiveSkill/ActiveSkillRuntimeConfig 运行时（EG-2：旧代码归档保留，运行时退出）：
 * - CD 门控（DERIVATIVE_SKILLS[id].cd 锚：轻技 12~15s / 复合技 ≥20s）+ 100ms 输入锁防抖沿旧惯例；
 * - P4 强化卡（up_d_*）参数覆写消费（B3 遗留：形态级参数可覆写项实装，纯形态变化登记欠账）；
 * - 效果结算 = castDerivative（CC 走状态层）；施法输入复用现有按键/移动端技能按钮。
 */

import { DERIVATIVE_SKILLS, type DerivativeSkillId, type UpgradeId } from '@/config/balance';
import { castDerivative, derivativeChargeTime, type DerivativeCastContext, type DerivativeCastResult } from './derivative-skills';

const INPUT_LOCK_SECONDS = 0.1; // 释放后 100ms 防抖（pillars §6.7-3 沿旧惯例）

/** 蓄力相位（P1-14：月痕狙击 1.2s 蓄力；HUD/演出消费） */
export type DerivativeChargePhase = 'idle' | 'charging';

/** P4 强化卡 → 参数覆写（up_d_*；参数级实装项，纯形态变化项登记 B6/欠账） */
export const DERIVATIVE_UPGRADE_PARAMS: Partial<Record<UpgradeId, Readonly<Record<string, number>>>> = {
  up_d_lantern: { infiniteAmmoDuration: 7, fireRateDuration: 7 }, // 月下无弹：无限弹 5→7s、射速爆发延至窗口全程
  up_d_requiem: { heal: 40 }, // 双声部：治疗量翻倍（20→40；守誓者狂化登记欠账）
  up_d_dash: { burstDamage: 25, burstRadius: 120, healPerHit: 1 }, // 血宴：终点血爆 + 每命中回 1 HP
  up_d_revolver: { infectRadius: 80, infectDuration: 3 }, // 圣痕传染：命中传染周围 80px（持续减半 3s）
  up_d_snipe: { totemRadius: 60, totemSlowPct: 0.15, totemDuration: 3 }, // 贯月审判：月痕图腾（60px 减速 15%/3s）
  up_d_judgment: { residueRadius: 100, residueDps: 8, residueDuration: 3 }, // 终审庭：余焰（100px 8伤/s/3s）
  up_d_charge: { packFocusMult: 1.5 }, // 群狼环猎：命中同一目标伤 ×1.5
  // up_d_rage 失控边缘（击杀延长 0.5s 上限 +3s）—— RageBuff.extend 运行时消费（PlayScene.onEnemyKilled）
};

export class DerivativeSkillController {
  private cdRemaining = 0;
  private lastCastAt = -Infinity;
  private readonly paramOverrides: Record<string, number> = {};
  /** 蓄力段（P1-14：非空 = 蓄力中，readyAt 到点后由 update 结算） */
  private charge: { readyAt: number; startedAt: number; ctx: Omit<DerivativeCastContext, 'now'> } | null = null;

  constructor(readonly skillId: DerivativeSkillId) {}

  /** 蓄力总时长 s（0 = 瞬发） */
  get chargeSeconds(): number {
    return derivativeChargeTime(this.skillId);
  }

  /** 蓄力相位（idle / charging） */
  get chargePhase(): DerivativeChargePhase {
    return this.charge ? 'charging' : 'idle';
  }

  /** 蓄力进度 0~1（非蓄力技恒 0；HUD/演出消费） */
  chargeProgress(now: number): number {
    if (!this.charge) return 0;
    const total = this.charge.readyAt - this.charge.startedAt;
    if (total <= 0) return 1;
    return Math.max(0, Math.min(1, (now - this.charge.startedAt) / total));
  }

  /** 蓄力中断（相位切换/暂停/局终；不触发结算、不退 CD） */
  cancelCharge(): void {
    this.charge = null;
  }

  /** CD 总长 s（锚） */
  get cdSeconds(): number {
    return DERIVATIVE_SKILLS[this.skillId].cd;
  }

  /** 当前剩余 CD s（HUD 消费） */
  get cooldown(): number {
    return this.cdRemaining;
  }

  /** 充能数口径（HUD setSkillCharges 兼容；衍生技无充能制） */
  get chargeCount(): number {
    return 1;
  }

  /** P4 强化卡写回（参数覆写合并） */
  applyDerivativeUpgrade(upId: UpgradeId): void {
    const params = DERIVATIVE_UPGRADE_PARAMS[upId];
    if (params) Object.assign(this.paramOverrides, params);
  }

  /**
   * 帧推进（CD 冷却 + 蓄力结算）。
   * 返回蓄力完成后的结算结果（非蓄力技恒 null；蓄力技结算发生在 update 而非 tryCast）。
   */
  update(dt: number, now: number): DerivativeCastResult | null {
    this.cdRemaining = Math.max(0, this.cdRemaining - dt);
    const pending = this.charge;
    if (!pending) return null;
    if (now < pending.readyAt) return null;
    this.charge = null;
    return castDerivative(this.skillId, { ...pending.ctx, now }, this.paramOverrides);
  }

  /**
   * 施放（CD / 100ms 防抖门控；效果 = castDerivative 参数合并版）。
   * 蓄力技（chargeSeconds > 0）按下即入蓄力段、CD 同步起算，蓄满由 update 结算 —— 返回 null。
   * 未就绪/蓄力中返回 null（调用方不播表现）。
   */
  tryCast(now: number, ctx: Omit<DerivativeCastContext, 'now'>): DerivativeCastResult | null {
    if (this.charge) return null;
    if (this.cdRemaining > 0) return null;
    if (now - this.lastCastAt < INPUT_LOCK_SECONDS) return null;
    this.lastCastAt = now;
    if (this.chargeSeconds > 0) {
      // P1-14：按下即占 CD（蓄力是技能时长的一部分），蓄满后 update 结算
      this.cdRemaining = this.cdSeconds;
      this.charge = { readyAt: now + this.chargeSeconds, startedAt: now, ctx };
      return null;
    }
    this.cdRemaining = this.cdSeconds;
    return castDerivative(this.skillId, { ...ctx, now }, this.paramOverrides);
  }
}
