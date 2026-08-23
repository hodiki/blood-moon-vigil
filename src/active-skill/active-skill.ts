/**
 * active-skill/active-skill.ts —— 主动技控制器（M1b 主动技迷你验证原型 / E4-S2 充能制扩展）
 *
 * 纯逻辑类（不 import Phaser，可脱离引擎单测；test-framework §1.2）：
 * - 统一 CD 制（pillars §6.4）：CD 归零后按键即释放，不积压、无存储。
 * - 充能制（E4-S2，血猎手「血影突袭」2 段 8s/段）：maxCharges>1 时每段独立回复，
 *   充能间隔 chargeIntervalSeconds；释放消耗 1 段，段未满则按间隔回复（gdd-active-skill §3.2）。
 * - 释放后 inputLockSeconds（100ms）输入锁定防抖（pillars §6.7-3）。
 * - casts 计数 = 埋点 activeSkillCasts（每局次数）。
 * - 效果结算（眩晕/无敌/冲刺/减速/狂化/FX）由 PlayScene 在 tryCast 返回 true 后应用 ——
 *   本类只负责「能否释放」的时序与计数，职责对齐 ShockwaveWeapon 的分层（冷却与效果分离）。
 */
export class ActiveSkill {
  /** 冷却剩余秒（≤0 就绪）：单充能 = 技能 CD；多充能 = 下一段充能回复剩余 */
  private cooldownRemaining = 0;
  /** 输入锁截止（秒时间戳）：now < inputLockUntil 期间拒绝再次释放 */
  private inputLockUntil = 0;
  /** 埋点 activeSkillCasts：本局累计释放次数 */
  casts = 0;
  /** 当前可用充能数（多充能制；单充能 = 1） */
  private charges: number;
  /** 多充能回复累计秒（段满后清零） */
  private chargeRefillAcc = 0;

  constructor(
    private cdSeconds: number,
    private readonly inputLockSeconds: number,
    private readonly maxCharges = 1,
    private chargeIntervalSeconds = 0,
  ) {
    this.charges = maxCharges;
  }

  /** 冷却是否就绪（供 HUD/测试查询）：多充能 = 有剩余充能；单充能 = 冷却归零 */
  get ready(): boolean {
    if (this.maxCharges > 1) return this.charges > 0;
    return this.cooldownRemaining <= 0;
  }

  /** 当前可用充能数（多充能 HUD 显示；单充能恒 1） */
  get chargeCount(): number {
    if (this.maxCharges > 1) return this.charges;
    return 1;
  }

  /** 冷却剩余秒（HUD 冷却转圈用）：有充能/就绪 = 0；多充能段空 = 距下段回复秒 */
  get cooldown(): number {
    if (this.maxCharges > 1 && this.charges > 0) return 0;
    return this.cooldownRemaining;
  }

  /** 每帧冷却/充能回复递减（秒制，clamp ≥0；与帧率解耦 ARCH §3.5） */
  update(dt: number): void {
    if (this.maxCharges > 1) {
      if (this.charges < this.maxCharges) {
        this.chargeRefillAcc += dt;
        this.cooldownRemaining = Math.max(0, this.chargeIntervalSeconds - this.chargeRefillAcc);
        while (this.charges < this.maxCharges && this.chargeRefillAcc >= this.chargeIntervalSeconds) {
          this.chargeRefillAcc -= this.chargeIntervalSeconds;
          this.charges += 1;
        }
        if (this.charges === this.maxCharges) {
          this.chargeRefillAcc = 0;
          this.cooldownRemaining = 0;
        }
      }
      return;
    }
    this.cooldownRemaining = Math.max(0, this.cooldownRemaining - dt);
  }

  /**
   * 尝试释放：输入锁期内 / 未就绪（单充能冷却未归零 / 多充能无剩余段）→ false（不消耗）；
   * 成功 → 消耗 1 段（多充能）/ 重置冷却（单充能）+ 计数 +1。
   * 调用方（PlayScene）在 true 时应用效果；释放瞬间即结算（无蓄力，pillars §6.3）。
   */
  tryCast(now: number): boolean {
    if (now < this.inputLockUntil) return false; // 100ms 防抖（Space+Shift 同帧 / 连点）
    if (this.maxCharges > 1) {
      if (this.charges <= 0) return false; // 无剩余充能段
      this.inputLockUntil = now + this.inputLockSeconds;
      this.charges -= 1;
      if (this.charges === 0) {
        // 最后一段消耗：开始充能回复倒计时（HUD 冷却转圈 = 距下段回复）
        this.cooldownRemaining = this.chargeIntervalSeconds;
        this.chargeRefillAcc = 0;
      }
      this.casts += 1;
      return true;
    }
    if (this.cooldownRemaining > 0) return false; // CD 未就绪
    this.inputLockUntil = now + this.inputLockSeconds;
    this.cooldownRemaining = this.cdSeconds;
    this.casts += 1;
    return true;
  }

  /** 局终/重开：冷却、充能与计数重置（pillars §6.7-4：重开 scene.restart 后 CD 重置） */
  reset(): void {
    this.cooldownRemaining = 0;
    this.inputLockUntil = 0;
    this.casts = 0;
    this.charges = this.maxCharges;
    this.chargeRefillAcc = 0;
  }

  /** E4-S3 主动技强化：CD -25%（up_a_cd_<hero>；单充能生效） */
  setCooldown(cdSeconds: number): void {
    this.cdSeconds = cdSeconds;
  }

  /** E4-S3 主动技强化：充能间隔缩短（血猎手 8s→4s/段） */
  setChargeInterval(intervalSeconds: number): void {
    this.chargeIntervalSeconds = intervalSeconds;
  }
}
