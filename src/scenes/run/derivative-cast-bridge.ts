/**
 * scenes/run/derivative-cast-bridge.ts —— 衍生技施放桥（入口/上下文/结算/狂化 buff/审判光环）
 * （NV-REVIEW-FIX-F W-F1：自 PlayScene 机械搬移，行为零变化）
 *
 * 职责（B5-W4 / B6-W4 / P1-14 / P0-7d~e）：
 * - tryCast：桌面 Space/Shift + 移动端技能按钮共用入口（门禁沿旧惯例：仅 RUNNING 可释放；
 *   CD / 100ms 防抖由 DerivativeSkillController 门控；施放不打断移动输入）。
 * - buildCastContext：瞬发与蓄力按下共用同一份上下文（player 为实时取值的 getter 形状；
 *   enemies 常驻实例蓄力期每帧刷新）。
 * - applyResult：遥测/表现/buff 统一收口（血月狂化 / 月啸攻速狂化 / 血影突袭 / 技能环）。
 * - updateRage：血月狂化 buff 生效/失效同步（伤害 +40% / 移速 +15% / 巨斧挥击不耗 HP）。
 * - stepJudgmentAura：审判光环持续段（5s × 3 HP/s）。
 * - s1 窗口乘区：Q-s1 银炉预热 30s 窗口伤害 ×1.2 / 间隔 ÷1.2。
 *
 * 依赖以 ports 注入（场景 create 装配完成后 attach；调用期才解引用）。
 */

import { FX, EXCLUSIVE_WEAPONS, type HeroId, type WeaponId } from '@/config/balance';
import { SKILL_RING_FRAMES } from '@/fx/fx-spec';

/**
 * P1-14 月啸冲锋「加尔文狂化 4s（攻速）」：GDD §4.7 未给攻速数值 → 工程锚 ×1.25（待模拟校准）。
 * 与血月狂化（§4.6：伤害 +40% / 移速 +15% / 挥击不耗 HP）必须分列，禁止串台。
 */
const WOLF_FRENZY_DURATION_SECONDS = 4;
const WOLF_FRENZY_ATTACK_SPEED_MULT = 1.25;
import { GameEvents, GameEvent } from '@/core/events';
import type { Player } from '@/player/player';
import type { PlayerStats } from '@/player/player-stats';
import type { RunStats } from '@/stats/run-stats';
import type { FxManager } from '@/fx/fx-manager';
import type { WeaponSystem } from '@/weapons/weapon-system';
import type { OathkeeperRuntime } from '@/weapons/companion/oathkeeper-runtime';
import type { ExclusiveWeaponBehavior } from '@/weapons/exclusive/exclusive-behaviors';
import type { RageBuff } from '@/active-skill/active-skill-effects';
import type { DerivativeSkillController } from '@/active-skill/derivative/derivative-controller';
import type { DerivativeCastContext, DerivativeCastResult } from '@/active-skill/derivative/derivative-skills';
import type { Enemy } from '@/enemies/enemy';

export interface DerivativeCastPorts {
  isRunning: () => boolean;
  nowSeconds: () => number;
  player: () => Player;
  stats: () => PlayerStats;
  runStats: () => RunStats;
  fx: () => FxManager;
  heroId: () => HeroId;
  mapSize: () => { width: number; height: number };
  weaponSystem: () => WeaponSystem;
  oathkeeper: () => OathkeeperRuntime;
  ownedWeaponIds: () => WeaponId[];
  eachActiveEnemy: (fn: (e: Enemy) => void) => void;
  derivativeControllerRef: () => DerivativeSkillController;
  /** 专武行为扩展型访问（原 PlayScene.exw） */
  exw: (id: import('@/config/balance').ExclusiveWeaponId) => ExclusiveWeaponBehavior<unknown>;
  rage: () => RageBuff;
  elapsed: () => number;
  /** B5-W3 Q-s1 开局窗口截止局时 s（-1 = 未点亮） */
  s1Until: () => number;
}

export class DerivativeCastBridge {
  private p: DerivativeCastPorts | null = null;
  /** P1-14 衍生技施放目标集（常驻实例：蓄力期每帧刷新，避免 1.2s 后打旧快照） */
  private derivativeCastEnemies: Enemy[] = [];
  /** P1-14 圣辉审判治疗光环持续段（5s × 3 HP/s；旧实现一次性结算） */
  private judgmentAura: { perSec: number; until: number } | null = null;
  /** P1-14 月啸冲锋「加尔文狂化 4s（攻速）」窗口（与血月狂化 6s 分列，不再串台） */
  private frenzyUntil = -Infinity;

  attach(ports: DerivativeCastPorts): void {
    this.p = ports;
  }

  /** 蓄力状态透出（场景 update 编排：charging 时刷新目标集 + HUD 冷却转圈） */
  get controller(): DerivativeSkillController {
    return this.p!.derivativeControllerRef();
  }

  /** P1-14 审判光环置位（buildCastContext auraSink） */
  get aura(): { perSec: number; until: number } | null {
    return this.judgmentAura;
  }

  /**
   * B5-W4 衍生技施放入口（门禁沿旧惯例：仅 RUNNING 可释放；CD / 100ms 防抖由控制器门控）。
   */
  tryCast(): void {
    const p = this.p!;
    if (!p.isRunning()) return;
    const now = p.nowSeconds();
    const result = p.derivativeControllerRef().tryCast(now, this.buildCastContext());
    if (result) this.applyResult(result, now);
  }

  /**
   * 衍生技施放上下文（瞬发与蓄力按下共用同一份）。
   * player 为**实时取值的 getter 形状**：月痕狙击 1.2s 蓄力（P1-14）在蓄满时才结算，
   * 按下瞬间的坐标快照会让巨矢从旧位置飞出；enemies 数组为常驻实例，蓄力期间每帧刷新。
   */
  buildCastContext(): Omit<DerivativeCastContext, 'now'> {
    const p = this.p!;
    const scenePlayer = p.player();
    this.refreshEnemies();
    // Q-b/Q-d 场景下左轮可能已在手（弹巢引用给破旧提灯技补满+无限弹）
    let ammo: import('@/weapons/ammo').AmmoState | undefined;
    if (p.ownedWeaponIds().includes('xw_revolver' as unknown as WeaponId)) {
      const revolver = p.weaponSystem().exclusiveBehaviors.xw_revolver as unknown as { getState(): { ammo: import('@/weapons/ammo').AmmoState } };
      ammo = revolver.getState().ammo;
    }
    return {
      player: {
        get x() { return scenePlayer.x; },
        get y() { return scenePlayer.y; },
        get hp() { return scenePlayer.stats.hp; },
        get maxHp() { return scenePlayer.stats.maxHp; },
      },
      enemies: this.derivativeCastEnemies as unknown as import('@/weapons/exclusive/exclusive-math').ExclusiveTarget[],
      healSink: (h) => {
        const applied = p.stats().heal(h);
        if (applied > 0) GameEvents.emit(GameEvent.HpChanged, { hp: p.stats().hp, maxHp: p.stats().maxHp });
      },
      // P0-7b 安魂曲协同：守誓者回满 / 墓碑复活进度充满（旧实现不传 companion → 协同段从不执行）
      companion: {
        healFull: () => p.oathkeeper().healFull(),
        fillReviveProgress: () => p.oathkeeper().fillReviveProgress(),
      },
      ammo,
      // B6-W4 P4 形态挂点：贯月审判图腾 / 终审庭余焰 → R-4/R-6 持续段（WeaponSystem 桥接）
      totemSink: (x, y) => p.weaponSystem().placeResonanceTotemAt(x, y),
      residueSink: (x, y) => p.weaponSystem().placeResonanceResidueAt(x, y),
      // P1-14 审判光环：5s × 3 HP/s 改成持续段（旧实现一次性结算 3 HP）
      auraSink: (perSec, duration) => {
        this.judgmentAura = { perSec, until: p.nowSeconds() + duration };
      },
      // P0-7e 射速爆发：4s ×1.5 落到当前在手的专武攻击间隔（旧实现只 push 事件）
      fireRateSink: (mult, duration) => {
        const until = p.nowSeconds() + duration;
        // 仅提灯/左轮（同源圣徒组）消费射速爆发；其余专武无「射速」语义
        for (const id of ['xw_lantern', 'xw_revolver'] as const) {
          const behavior = p.exw(id);
          if (behavior.isEnabled) behavior.applyFireRateBurst(mult, until);
        }
      },
    };
  }

  /** 蓄力期目标集刷新（月痕狙击 1.2s 窗口内敌会移动/死亡/新生） */
  refreshEnemies(): void {
    const p = this.p!;
    this.derivativeCastEnemies.length = 0;
    p.eachActiveEnemy((e) => this.derivativeCastEnemies.push(e));
  }

  /** 衍生技结算统一收口（瞬发返回 + 蓄力完成返回共用；遥测/表现/buff 全在此） */
  applyResult(result: DerivativeCastResult, now: number): void {
    const p = this.p!;
    p.runStats().recordActiveSkillCast();
    // B6-W5 遥测：衍生技伤害累计 + 占比分母
    p.runStats().recordDerivativeDamage(result.damageDealt);
    p.runStats().recordTotalDamage(result.damageDealt);
    p.player().beginSkillPose();
    // 血月狂化衍生技（dv_blood_rage）：6s 伤害 +40% / 移速 +15% / 挥击不耗 HP（GDD §4.6）
    if (result.events.includes('rage')) {
      p.rage().apply(now, 6);
      p.stats().setRageBonus(0.4);
      p.stats().rageSpeedPct = 0.15;
      p.fx().rageBurst(p.player().x, p.player().y);
      p.player().setScale(FX.SKILL_RAGE_SCALE);
    }
    // P1-14 月啸冲锋「加尔文狂化 4s（攻速）」：与血月狂化分两个 buff id，不吃伤害/移速加成
    if (result.events.includes('wolfFrenzy')) {
      this.frenzyUntil = now + WOLF_FRENZY_DURATION_SECONDS;
      for (const id of ['xw_axe', 'xw_horn'] as const) {
        const behavior = p.exw(id);
        if (behavior.isEnabled) behavior.applyFireRateBurst(WOLF_FRENZY_ATTACK_SPEED_MULT, this.frenzyUntil);
      }
      p.fx().rageBurst(p.player().x, p.player().y);
    }
    // P1-14 血影突袭：落到「最密方向」终点（旧实现不位移，语义缺失）
    if (result.dash) {
      const cfg = p.mapSize();
      p.player().setPosition(
        Math.max(0, Math.min(cfg.width, result.dash.x)),
        Math.max(0, Math.min(cfg.height, result.dash.y)),
      );
      p.fx().bloodDash(p.player().x, p.player().y, result.dash.dirX, result.dash.dirY, result.dash.distance);
    }
    // 通用施法表现：技能环（B6 逐技演出细化）
    const frames = SKILL_RING_FRAMES[p.heroId() as keyof typeof SKILL_RING_FRAMES];
    if (frames) p.fx().playSkillRing(p.player().x, p.player().y, 200, frames);
    if (result.events.includes('heal')) {
      p.fx().requiemHeal(p.player().x, p.player().y);
    }
  }

  /** 血月狂化衍生技：buff 生效/失效同步（伤害 +40% / 移速 +15%；旧接触光环随旧技退役移除） */
  updateRage(now: number): void {
    const p = this.p!;
    const active = p.rage().active(now);
    const stats = p.stats();
    if (active && stats.rageBonusMultiplier === 0) {
      stats.setRageBonus(0.4);
      stats.rageSpeedPct = 0.15;
      p.player().setScale(FX.SKILL_RAGE_SCALE);
      // P0-7d：狂化窗口内巨斧挥击不耗 HP（GDD §4.6）——写到 behavior machine 的
      // selfHpCost=0（stepAxe 读 machine 覆写），窗口结束由下方失效分支复位。
      p.exw('xw_axe').applyMutationCard({ selfHpCost: 0 });
    } else if (!active && stats.rageBonusMultiplier !== 0) {
      stats.setRageBonus(0);
      stats.rageSpeedPct = 0;
      p.player().setScale(1);
      // 复位到基础自损（EXCLUSIVE_WEAPONS.xw_axe.params.selfHpCost = 2）
      p.exw('xw_axe').applyMutationCard({
        selfHpCost: EXCLUSIVE_WEAPONS.xw_axe.params.selfHpCost ?? 2,
      });
    }
  }

  /** P1-14 审判光环持续段（圣辉审判衍生技：5s × 3 HP/s，跟随玩家） */
  stepJudgmentAura(dt: number, now: number): void {
    const p = this.p;
    if (!p || !this.judgmentAura) return;
    if (now >= this.judgmentAura.until) {
      this.judgmentAura = null;
      return;
    }
    const applied = p.stats().heal(this.judgmentAura.perSec * dt);
    if (applied > 0) GameEvents.emit(GameEvent.HpChanged, { hp: p.stats().hp, maxHp: p.stats().maxHp });
  }

  /** B5-W3 Q-s1 银炉预热：开局 30s 窗口伤害 ×1.2（攻速 +20% 经全局冷却乘区登记，模拟批次校准） */
  s1WindowDamageMult(): number {
    const until = this.p!.s1Until();
    if (until < 0) return 1;
    return this.p!.elapsed() <= until ? 1.2 : 1;
  }

  /** P1-9 Q-s1 银炉预热：窗口内发射间隔 ÷1.2（攻速 +20%），与天赋区间乘区在 ctx 内合成 */
  s1WindowIntervalMult(): number {
    const until = this.p!.s1Until();
    if (until < 0) return 1;
    return this.p!.elapsed() <= until ? 1 / 1.2 : 1;
  }
}
