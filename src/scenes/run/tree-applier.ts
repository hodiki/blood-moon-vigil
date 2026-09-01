/**
 * scenes/run/tree-applier.ts —— 天赋树写回与复活判定（NV-REVIEW-FIX-F W-F1：自 PlayScene 机械搬移，行为零变化）
 *
 * 职责（B5-W3 / B5-W4 / Q-c / Q-s3 / A-2）：
 * - applyToStats：树应用写回（A-2：属性段进 PlayerStats；调用时序 = XpManager 装配前，QA-FIX-3 纪律沿袭）
 * - judgePlayerRevive：复活判定序挂钩（护盾→圣物预留→天赋复活→死亡；s3 遗言余烬随死亡事件结算）
 *
 * 依赖以 ports 注入（场景 create 装配完成后 attach；调用期才解引用）。
 */

import { TALENT_S3_EMBER, type ExclusiveWeaponId } from '@/config/balance';
import { judgeRevive, talentReviveHpPct, talentReviveInvulnSeconds, talentReviveKnockbackPx } from '@/progression/revive';
import type { TreeApplication } from '@/progression/tree-state';
import type { Player } from '@/player/player';
import type { RunStats } from '@/stats/run-stats';
import type { WeaponSystem } from '@/weapons/weapon-system';
import type { ExclusiveWeaponBehavior } from '@/weapons/exclusive/exclusive-behaviors';

export interface TreeApplierPorts {
  player: () => Player;
  runStats: () => RunStats;
  weaponSystem: () => WeaponSystem;
  /** 专武行为的扩展型访问（WeaponBehavior 基接口只有 setEnabled/update） */
  exw: (id: ExclusiveWeaponId) => ExclusiveWeaponBehavior<unknown>;
  /** Q-c/Q-e：天赋复活剩余次数（场景字段，树应用写回后读取；判定消费时经 spendReviveCharge 扣减） */
  reviveCharges: () => number;
  spendReviveCharge: () => void;
  /** Q-s3：遗言余烬旗（树应用写回） */
  s3Active: () => boolean;
  /** Q-s3：余烬宝石掉落（XpManager.dropGem） */
  dropGem: (xp: number, x: number, y: number) => void;
}

export class TreeApplier {
  private p: TreeApplierPorts | null = null;
  /** Q-c：本局已用复活次数 */
  private treeRevivesUsed = 0;
  /** Q-s3：遗言余烬是否已触发（首次 HP 归零事件 + 终局折算共用） */
  private treeS3EmberUsed = false;
  /** Q-s3：终局折算余辉（无复活来源死亡 → +2） */
  private treeS3MeritBonus = 0;
  /** P1-8：滤月余辉经验获取乘区（1 + 天赋 xpGainPct；applyToStats 写入、XpManager 装配后应用） */
  private treeXpGainMult = 1;
  /** P1-7 支线墓碑回血加值暂存（applyToStats 写入；oathkeeper 装配在后，create 末尾写入 machine） */
  private treeTombHealBonus = 0;

  attach(ports: TreeApplierPorts): void {
    this.p = ports;
  }

  /** B5-W2 结算页「余辉行」数据接口（B6 渲染）：s3 终局折算 +2 余辉 */
  get meritBonus(): number {
    return this.treeS3MeritBonus;
  }

  /** P1-8：XpManager 装配后应用的经验乘区 */
  get xpGainMult(): number {
    return this.treeXpGainMult;
  }

  /** P1-7：守誓者墓碑回血加值（create 末尾写入 oathkeeper machine） */
  get tombHealBonus(): number {
    return this.treeTombHealBonus;
  }

  /** B5-W3 复活判定序挂钩（护盾→圣物预留→天赋复活→死亡；s3 遗言余烬随死亡事件结算） */
  judgePlayerRevive(_now: number): { revived: boolean; hpPct: number; invulnSeconds: number; knockback: number } | null {
    const p = this.p!;
    const verdict = judgeRevive({
      shieldAvailable: false, // up_g_8 护盾在 absorbDamage 上游消费（未死路径），此处为死局判定
      relicFreeDeathAvailable: false, // 圣物级免死接口预留（当前圣物池无）
      talentChargesRemaining: p.reviveCharges(),
      talentRevivesUsed: this.treeRevivesUsed,
    });
    if (verdict === 'talent') {
      const hpPct = talentReviveHpPct(this.treeRevivesUsed);
      this.treeRevivesUsed += 1;
      p.spendReviveCharge();
      p.runStats().recordTalentRevive(); // B6-W5 复活触发遥测（HUD 复活次数同源）
      // Q-s3：被复活来源救回 → 原地掉落余烬宝石（首次 HP 归零事件）
      if (p.s3Active() && !this.treeS3EmberUsed) {
        this.treeS3EmberUsed = true;
        p.dropGem(TALENT_S3_EMBER.XP, p.player().x, p.player().y);
      }
      return { revived: true, hpPct, invulnSeconds: talentReviveInvulnSeconds(), knockback: talentReviveKnockbackPx() };
    }
    if (verdict === 'death' && p.s3Active() && !this.treeS3EmberUsed) {
      // Q-s3：无复活来源终局 → 宝石折算 +2 余辉（遗言化作传承；结算页数据接口）
      this.treeS3EmberUsed = true;
      this.treeS3MeritBonus = TALENT_S3_EMBER.MERIT_NO_REVIVE;
    }
    return null;
  }

  /** B5-W4 树应用写回（A-2：属性段进 PlayerStats；调用时序 = XpManager 装配前，QA-FIX-3 纪律沿袭） */
  applyToStats(app: TreeApplication): void {
    const p = this.p!;
    const a = app.attributes;
    const stats = p.player().stats;
    if (a.maxHp > 0) {
      stats.maxHp += a.maxHp;
      stats.hp += a.maxHp;
    }
    // 伤害桶：伤害 % + 攻击 flat 折算（+2 基础伤 ≈ +2% 等效锚；逐武器斜率差异待模拟 GDD §4.2 A-1）
    const damagePct = a.damagePct + a.attackFlat * 0.01;
    if (damagePct > 0) stats.addDamageBonus(damagePct);
    if (a.moveSpeedPct > 0) stats.addMoveSpeedPctBonus(a.moveSpeedPct);
    if (a.magnetRadius > 0) stats.magnetRadiusBonus += a.magnetRadius;
    if (a.pickupRadius > 0) stats.pickupRadiusBonus += a.pickupRadius;
    if (a.healEfficiencyPct > 0) stats.healBoostMultiplier += a.healEfficiencyPct;
    // P1-8：攻速/冷却 → WeaponSystem 区间乘区（冷却下限 TALENT_COOLDOWN_FLOOR）；XP → 延迟乘区（XpManager 装配在后）
    if (a.attackSpeedPct > 0 || a.cooldownPct > 0) p.weaponSystem().applyTalentIntervals(a.attackSpeedPct, a.cooldownPct);
    this.treeXpGainMult = 1 + a.xpGainPct;
    // P1-7 角色支线接线（§4.3 轻规格；machine 锚消费）：
    // - 受击移速/击杀回血/狂化移速 → PlayerStats 专属字段（窗口语义由消费点保证）
    if (a.hitMoveSpeedPct > 0) stats.hitSpeedBoostBonusPct += a.hitMoveSpeedPct;
    if (a.killHealFlat > 0) stats.killHealBonus += a.killHealFlat;
    if (a.rageMoveSpeedPct > 0) stats.rageSpeedBonusPct += a.rageMoveSpeedPct;
    // - 范围 +5%（灯环/领域类）→ 提灯/圣铃 machine['areaPct']（stepLantern/stepBell 半径乘区）
    if (a.areaPct > 0) {
      for (const id of ['xw_lantern', 'xw_bell'] as const) {
        const b = p.exw(id);
        b.machine['areaPct'] = (b.machine['areaPct'] ?? 0) + a.areaPct;
      }
    }
    // - 吸血效 +25% → 血契双刃 machine['healPerHitPct']（stepTwinblades 命中回复乘区）
    if (a.lifestealHealPct > 0) {
      const tb = p.exw('xw_twinblades');
      tb.machine['healPerHitPct'] = (tb.machine['healPerHitPct'] ?? 0) + a.lifestealHealPct;
    }
    // - 墓碑回血 +1 HP/s → 守誓者 machine（oathkeeper 装配在 applyToStats 之后 → 暂存字段，create 末尾写入）
    if (a.tombHealFlat > 0) this.treeTombHealBonus += a.tombHealFlat;
  }
}
