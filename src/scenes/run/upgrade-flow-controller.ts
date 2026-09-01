/**
 * scenes/run/upgrade-flow-controller.ts —— 升级三选一 + 质变卡双节拍管线 + v3 写回目标装配
 * （NV-REVIEW-FIX-F W-F1：自 PlayScene 机械搬移，行为零变化）
 *
 * 职责（B3-W1~W4 / B5-W3/Q-f）：
 * - v3 升级池写回目标装配（37 项定义；v2 语义复用 + 质变卡/衍生技/通用强化扩展）。
 * - onLevelUp：抽取三选一 → LEVEL_UP 冻结（bench 模式自动选第 1 张）。
 * - onUpgradeChosen → consumeUpgradeChoice：v3 写回 + 共鸣达成检查 + 质变卡管线回调 +
 *   异常保活（任何写回异常强制回 RUNNING，防「暂停无 UI」隐形死锁）。
 * - triggerExtraOffer：Q-f 串联 / 宝藏 MN-21 三选一 offer 直发。
 * - takenMutationOrders / applyMutationCard2 / buildUpgradeContext。
 *
 * 依赖以 ports 注入（场景 create 装配完成后 attach；调用期才解引用）。
 */

import { EXCLUSIVE_TO_DERIVATIVE, DERIVATIVE_UPGRADE_MAP, type HeroId, type WeaponId, type UpgradeId, type ExclusiveWeaponId } from '@/config/balance';
import { GameEvents, GameEvent } from '@/core/events';
import { GamePhase } from '@/core/game-state';
import type { UpgradeState } from '@/upgrade/upgrade-pool';
import { rollThreeV3, poolItemByIdV3, type UpgradePoolV3Context } from '@/upgrade/upgrade-pool-v3';
import { applyUpgradeByIdV3, type UpgradeV3WriteTargets } from '@/upgrade/upgrade-apply-v3';
import {
  createMutationPipeline, defaultMutationChannels, takeCard1, takeCard2, onEliteKilled, onUpgradeChosenForPipeline,
  type MutationPipelineState, type MutationChannelConfig,
} from '@/upgrade/mutation-pipeline';
import type { LevelUpOverlay } from '@/ui/levelup-overlay';
import type { FxManager } from '@/fx/fx-manager';
import type { PlayerStats } from '@/player/player-stats';
import type { RunStats } from '@/stats/run-stats';
import type { XpManager } from '@/xp/xp-manager';
import type { WeaponSystem } from '@/weapons/weapon-system';
import type { OathkeeperRuntime } from '@/weapons/companion/oathkeeper-runtime';
import type { DerivativeSkillController } from '@/active-skill/derivative/derivative-controller';
import type { ExclusiveWeaponBehavior } from '@/weapons/exclusive/exclusive-behaviors';
import { resonancePairByExclusive } from '@/config/balance';
import { resonanceSanctuaryBonus } from '@/weapons/resonance/resonance-math';

/** E4-S4 升级选项负载（optionId 为 v3 内容 ID 字符串） */
export interface UpgradeChosenPayload {
  optionId: string;
  index: number;
  dwellSeconds?: number;
}

export interface UpgradeFlowPorts {
  heroId: () => HeroId;
  exclusiveId: () => ExclusiveWeaponId;
  ownedWeaponIds: () => WeaponId[];
  upgradeState: () => UpgradeState;
  stats: () => PlayerStats;
  runStats: () => RunStats;
  xp: () => XpManager;
  weaponSystem: () => WeaponSystem;
  oathkeeper: () => OathkeeperRuntime;
  derivativeController: () => DerivativeSkillController;
  fx: () => FxManager;
  overlay: () => LevelUpOverlay;
  elapsed: () => number;
  playerX: () => number;
  playerY: () => number;
  phase: () => GamePhase;
  setPhase: (p: GamePhase) => void;
  isBench: () => boolean;
  /** P1-11 Q-s4 双灯并祀：P4 卡前移旗（树应用写回） */
  treeS4Active: () => boolean;
  /** 共鸣徽记四态联动（NV-INTEG-FIX P1） */
  refreshResonanceBadge: () => void;
  /** 武器解锁出口（E4-S5/E4-S6：解锁 + 图鉴 + HUD 槽扩列） */
  onWeaponUnlocked: (weaponId: string) => void;
  /** P2-4 共鸣达成图鉴回写（ResonanceState 提交后解锁共鸣形态条目，幂等） */
  onResonanceAchieved: (commonWeaponId: string) => void;
  /** P1-5 R-5 圣域达成标记（场景字段，refreshSanctuaryOverlap 每帧消费） */
  setR5Sanctuary: (v: boolean) => void;
}

export class UpgradeFlowController {
  private p: UpgradeFlowPorts | null = null;
  /** B3-W3 质变卡双节拍管线（卡 1 P1 席位 / 卡 2 三渠道 + 待发队列） */
  private mutationPipeline: MutationPipelineState = createMutationPipeline();
  private mutationChannels: MutationChannelConfig = defaultMutationChannels();
  /** B3-W2 P4 窗口判定：本局升级次数（含本次） */
  private upgradeChoiceCount = 0;
  /** E4-S4 最近一次 v2 三选一选项（纠结埋点） */
  private lastOptionsV2: import('@/upgrade/upgrade-pool-v2').UpgradeV2Option[] = [];
  /** B5-W3 Q-f 串联待发队列 */
  private eliteOfferQueue = 0;
  /** B3-W4 v3 升级池写回目标（buildTargets 装配） */
  private upgradeV3Targets!: UpgradeV3WriteTargets;

  attach(ports: UpgradeFlowPorts): void {
    this.p = ports;
  }

  /** B3-W4：v3 升级池写回目标装配（37 项定义；v2 语义复用 + 质变卡/衍生技/通用强化扩展） */
  buildTargets(): void {
    const p = this.p!;
    const weaponSystem = p.weaponSystem();
    this.upgradeV3Targets = {
      stats: p.stats(),
      weapons: {
        setMissileSplit: (n) => weaponSystem.setMissileSplit(n),
        setMissilePierce: (n) => weaponSystem.setMissilePierce(n),
        setCooldownMultiplier: (m) => weaponSystem.setCooldownMultiplier(m),
        setClassUpgrade: (s) => weaponSystem.applyClassUpgrade(s),
        setKeyPassives: (k) => weaponSystem.setKeyPassives(k),
        unlockWeapon: (w) => p.onWeaponUnlocked(w),
        // M3-DESIGN-1 up_g_2 专精疾射：目标武器独立冷却乘区广播
        setFocusedCooldown: (weaponIds, mult) => weaponSystem.setFocusedCooldown(weaponIds, mult),
      },
      xp: {
        setMagnetMultiplier: (m) => p.xp().setMagnetMultiplier(m),
        setMagnetRadiusBonus: (b) => p.xp().setMagnetRadiusBonus(b),
        addPickupRadiusBonus: (b) => p.xp().addPickupRadiusBonus(b),
      },
      activeSkill: {
        applyActiveSkillUpgrade: (upId) => p.derivativeController().applyDerivativeUpgrade(upId),
      },
      // B3 v3 扩展：质变卡 → 行为 machine 写回（B2 预留接口）
      exclusive: {
        applyMutationCard: (machine) => {
          const behavior = weaponSystem.exclusiveBehaviors[p.exclusiveId()] as
            ExclusiveWeaponBehavior<unknown>;
          behavior.applyMutationCard(machine);
        },
      },
      // P0-7a：质变卡 machine 同步写守誓者状态机（mc_bell_2 伴生参数；非修女路线运行时丢弃）
      companion: {
        applyCompanionMachine: (machine) => p.oathkeeper().applyCompanionMachine(machine),
      },
      // B3 v3 扩展：衍生技强化（up_d_* 质变级效果）
      derivative: {
        applyDerivativeUpgrade: (upId) => p.derivativeController().applyDerivativeUpgrade(upId),
      },
      // B3 v3 扩展：通用通武强化独立乘区（与钥被动相乘写回）
      weapons_extra: {
        setCommonEnhancement: (e) => {
          const keys = weaponSystem.keyPassiveState;
          weaponSystem.setKeyPassives({
            ...keys,
            rangeMult: keys.rangeMult * e.rangeMult,
            areaRadiusMult: keys.areaRadiusMult * e.areaMult,
          });
        },
      },
    };
  }

  /** B5-W4 v3 抽取上下文装配（onLevelUp / 精英 offer 共用；Q-s4 前置经 takenMutation/derivative 标记） */
  buildUpgradeContext(): UpgradePoolV3Context {
    const p = this.p!;
    const exclusiveId = p.exclusiveId();
    return {
      heroId: p.heroId(),
      ownedWeaponIds: [...p.ownedWeaponIds()],
      runTimeSeconds: p.elapsed(),
      exclusiveId,
      derivativeId: EXCLUSIVE_TO_DERIVATIVE[exclusiveId],
      takenMutationOrders: this.takenMutationOrders(),
      upgradeCount: this.upgradeChoiceCount,
      // P0-8 修复：栈里存的是升级 id（up_d_*），不是技能 id（dv_*）——经 DERIVATIVE_UPGRADE_MAP 换算后查询
      derivativeUpgradeTaken: p.upgradeState().stackOf(DERIVATIVE_UPGRADE_MAP[EXCLUSIVE_TO_DERIVATIVE[exclusiveId]]) >= 1,
      // P1-11 Q-s4 双灯并祀：P4 卡前移旗（树应用写回）
      derivativeUpgradePrereq: p.treeS4Active(),
    };
  }

  /** B5-W3 Q-f1/f2/f3：首精英击杀额外 offer（不消耗 XP；立即结算非暂存，GT-10 串联） */
  triggerExtraOffer(): void {
    const p = this.p!;
    const options = rollThreeV3(p.upgradeState(), this.buildUpgradeContext());
    if (options.length === 0) return;
    this.lastOptionsV2 = options;
    p.runStats().recordUpgradeOffered(options);
    p.runStats().recordEliteOffer(); // B6-W5 精英抽卡遥测（Q-f 串联每次）
    GameEvents.emit(GameEvent.UpgradeOffered, { options });
    p.fx().levelUpBurst(p.playerX(), p.playerY());
    if (p.isBench()) {
      const first = options[0];
      this.onUpgradeChosen({ optionId: first?.upgradeId ?? first?.evoId ?? 'up_g_1', index: 0, dwellSeconds: 0 });
      return;
    }
    p.overlay().showV2(options);
    p.setPhase(GamePhase.LEVEL_UP);
  }

  /** 经验达标 → 升级：属性成长 + 抽三选一 + LEVEL_UP 状态（CM §3.3） */
  onLevelUp(payload: { level: number; xpNeeded: number }): void {
    const p = this.p!;
    p.stats().levelUp(); // E3-S2 自动成长（+8HP/+4%/每5级+4px/s）
    // E4-S1 HUD：升级回血（+8）后 HP 变化
    GameEvents.emit(GameEvent.HpChanged, { hp: p.stats().hp, maxHp: p.stats().maxHp });
    // B3-W2：v3 池抽取（37 定义 / 单局 ≤30 + P1~P5 保底 + 席位冲突裁决 + 阶段权重修订）
    this.upgradeChoiceCount += 1;
    const options = rollThreeV3(p.upgradeState(), this.buildUpgradeContext());
    this.lastOptionsV2 = options;
    // QA-BUG-1 兜底：无可选选项不进入 LEVEL_UP（rollThreeV2 回退机制下理论不可达，
    // 防御「暂停无 UI」死锁）——照常 RUNNING（升级回血 HpChanged 已在上方 emit）
    if (options.length === 0) {
      console.warn('[upgrade] 三选一为空：跳过 LEVEL_UP（保持 RUNNING，不死锁）');
      return;
    }
    // M3 真机埋点：一次三选一出现（offersPerRun + related 卡统计，upgrade-experience-v2 §4.4）
    p.runStats().recordUpgradeOffered(options);
    // E4-S1 升级时间戳埋点（后期升级间隔 / Lv47 预警数据源，供文策渊评审）
    p.runStats().recordLevelUp(payload.level, p.elapsed());
    GameEvents.emit(GameEvent.UpgradeOffered, { options });
    // TASK-28：升级三选一出现 —— 玩家位置金+冷青爆发（进入 LEVEL_UP 前）
    p.fx().levelUpBurst(p.playerX(), p.playerY());
    if (p.isBench()) {
      // 基准模式：自动选第 1 张，跳过 LEVEL_UP 暂停（保持 20× 时缩放连续）
      const first = options[0];
      this.onUpgradeChosen({ optionId: first?.upgradeId ?? first?.evoId ?? 'up_g_1', index: 0, dwellSeconds: 0 });
      return;
    }
    p.overlay().showV2(options);
    p.setPhase(GamePhase.LEVEL_UP); // 世界冻结（applyPhase）
  }

  /** 三选一完成 → 写回 → 回 RUNNING（CM §3.3）；有挂起升级则链式再升。
   *  QA-BUG-1 兜底：写回阶段任何异常都必须回 RUNNING——选卡层在 emit 前已隐藏，
   *  若此处中断，世界将永久停在 LEVEL_UP（玩家视角整局隐形卡死、进度丢失）。 */
  onUpgradeChosen(payload: UpgradeChosenPayload): void {
    const p = this.p!;
    try {
      this.consumeUpgradeChoice(payload);
    } catch (err) {
      console.error('[upgrade] 选卡写回异常（已强制回 RUNNING 保活）', err);
    } finally {
      // E4-S1 HUD：升级写回后 HP 变化（如 maxHp+20 同时回 20）
      GameEvents.emit(GameEvent.HpChanged, { hp: p.stats().hp, maxHp: p.stats().maxHp });
      // NV-INTEG-FIX P1：取钥/共鸣达成 → 徽记四态联动
      p.refreshResonanceBadge();
      p.setPhase(GamePhase.RUNNING); // 恢复世界（applyPhase + 输入向量归零）
      // B5-W3 Q-f 串联：elite offer 队列未清空 → 下一发（同帧连发语义经链式结算）
      if (this.eliteOfferQueue > 0) {
        this.eliteOfferQueue -= 1;
        this.triggerExtraOffer();
      }
    }
  }

  /** 首精英击杀 → 质变卡 2 渠道 1（默认开）+ Q-f 串联入队（onEnemyKilled 消费端调用） */
  notifyEliteKilled(): void {
    const p = this.p!;
    const r = onEliteKilled(this.mutationPipeline, this.mutationChannels, p.elapsed(), true);
    if (r.granted) this.applyMutationCard2();
  }

  /** B5-W3 Q-f 首猎之赏：每局首个精英击杀 → 连得 N 次额外 offer 入队并立即发第 1 发（GT-10 串联） */
  notifyEliteOffers(count: number): void {
    this.eliteOfferQueue = count;
    this.eliteOfferQueue -= 1;
    this.triggerExtraOffer();
  }

  /** QA-BUG-1 拆分：选卡消费主体（异常由 onUpgradeChosen 捕获保活）。
   *  B3-W4 legacy 双池清偿：evo_ 进化分支随超武退役（R2-3）移除；legacy 数字 id 分支退役（v1 引擎归档 EG-2）。 */
  private consumeUpgradeChoice(payload: UpgradeChosenPayload): void {
    const p = this.p!;
    const exclusiveId = p.exclusiveId();
    const upId = payload.optionId as UpgradeId;
    const result = applyUpgradeByIdV3(p.upgradeState(), this.upgradeV3Targets, upId, {
      ownedWeaponIds: [...p.ownedWeaponIds()],
      random: Math.random,
    });
    p.upgradeState().lastPickId = upId; // 防重复 ×0.5（沿袭）
    // B4-W1 共鸣达成检查：取钥后双条件判定（持配对专武 ∧ 持钥）→ 原子形态切换
    if (upId.startsWith('key_')) {
      const pair = p.weaponSystem().tryResonance(exclusiveId, (k) => p.upgradeState().hasKey(k));
      if (pair) {
        // 共鸣达成遥测（达成率/各对选取分布，GDD §⑧-6）
        p.runStats().recordResonance(pair.id, p.elapsed());
        // P2-4：共鸣形态图鉴条目解锁（codex_reso_<commonWeaponId>，幂等）
        p.onResonanceAchieved(pair.commonWeaponId);
        GameEvents.emit(GameEvent.WeaponUnlocked, { weaponId: pair.commonWeaponId, name: `共鸣·${pair.name}` });
        // P1-5 R-5 圣域重叠区收拢：弃全局 DR +8pp，改帧级重叠判定（壁垒光环与铃域均玩家居中
        // → 几何重叠 ≡ 双武启用；dynamicDamageReductionPct 由 refreshSanctuaryOverlap 每帧写）
        if (pair.id === 'R5') {
          p.setR5Sanctuary(true);
          // 墓碑转化 +20pp（reviveConvertBonusPp 独立 machine 键，与 mc_bell_2 rate 覆写叠加；锚值走共鸣配置）
          if (p.oathkeeper()) {
            const sanctuary = resonanceSanctuaryBonus(resonancePairByExclusive('xw_bell')!.machine);
            p.oathkeeper().applyCompanionMachine({ reviveConvertBonusPp: sanctuary.reviveConvertBonusPp });
          }
        }
      }
    }
    // B3-W3 质变卡管线回调：卡 1 = P1 席位承载（含待发队列立即补发）；其余升级计入兜底 N
    if (upId === `mc_${exclusiveId.slice(3)}_1`) {
      const { card2Granted } = takeCard1(this.mutationPipeline, p.elapsed());
      if (card2Granted) this.applyMutationCard2();
      p.runStats().recordMutationTaken(1, p.elapsed()); // B6-W5 双节拍遥测
    } else if (upId === `mc_${exclusiveId.slice(3)}_2`) {
      takeCard2(this.mutationPipeline, p.elapsed());
      p.runStats().recordMutationTaken(2, p.elapsed());
    } else {
      // P1-2 修复：兜底 N 渠道的 granted 此前被丢弃——卡 2 就绪即发放（首精英渠道同款消费）
      const pipelineResult = onUpgradeChosenForPipeline(this.mutationPipeline, this.mutationChannels, p.elapsed());
      if (pipelineResult.granted) this.applyMutationCard2();
    }
    const item = poolItemByIdV3(upId);
    if (item) p.runStats().recordUpgradeChosen(0, item.name, p.elapsed());
    p.runStats().recordHesitationV2(payload.dwellSeconds ?? 0, this.lastOptionsV2);
    // E4-S5 解锁变体：onWeaponUnlocked 已由 unlockWeapon 目标处理（unlockVariant 仅返回）
    void result;
  }

  /** B3-W3：卡 2 写回（管线 granted 后调用；顺序解锁已由管线保证） */
  private applyMutationCard2(): void {
    const p = this.p!;
    const card2Id = `mc_${p.exclusiveId().slice(3)}_2` as UpgradeId;
    applyUpgradeByIdV3(p.upgradeState(), this.upgradeV3Targets, card2Id, {
      ownedWeaponIds: [...p.ownedWeaponIds()],
      random: Math.random,
    });
  }

  /** B3 v3：当前已取质变卡 order 列表（P1 全局限 1 / 满层剔除上下文） */
  private takenMutationOrders(): (1 | 2)[] {
    const p = this.p!;
    const exclusiveId = p.exclusiveId();
    const orders: (1 | 2)[] = [];
    if (p.upgradeState().stackOf(`mc_${exclusiveId.slice(3)}_1`) >= 1) orders.push(1);
    if (p.upgradeState().stackOf(`mc_${exclusiveId.slice(3)}_2`) >= 1) orders.push(2);
    return orders;
  }
}
