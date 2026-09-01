/**
 * scenes/run/exclusive-run-assembler.ts —— 专武开局装配链（选择 → applyLoadout → Q-b/Q-d → HUD 联动）
 * （NV-REVIEW-FIX-F W-F1：自 PlayScene 机械搬移，行为零变化）
 *
 * 职责（NV-INTEG-FIX P0-2 单一汇聚点）：
 * - 当前专武 id 持有（create 默认角色对第一把；2 选 1 插页 / smoke/bench 默认路径共用写入点）。
 * - applySelection：applyLoadout 开专武门控（⑦根因修复：原全仓无调用点，8 专武恒 disabled）
 *   + Q-b 伴灯共鸣通武 + 衍生技重建（EXCLUSIVE_TO_DERIVATIVE 键 = 选中者）+ HUD 技名联动
 *   + 守誓者（FQ-2 修女选圣铃）。
 * - preGrantOpeningWeapons：Q-b/Q-d 开局预发（树质变节点写回；与选择路径同名去重）。
 * - HUD 动态武器槽 / 共鸣徽记四态刷新（选择联动 + 解锁/取钥联动共用出口）。
 *
 * 依赖以 ports 注入（场景 create 装配完成后 attach；调用期才解引用）。
 */

import { HEROES, WEAPON_CONFIGS, HERO_EXCLUSIVE_PAIRS, EXCLUSIVE_TO_DERIVATIVE, DERIVATIVE_SKILLS, resonancePairByExclusive, type HeroId, type WeaponId, type ExclusiveWeaponId } from '@/config/balance';
import { computeLoadout } from '@/weapons/loadout';
import { resonanceBadgeState } from '@/weapons/resonance/resonance-engine';
import type { WeaponSystem } from '@/weapons/weapon-system';
import type { OathkeeperRuntime } from '@/weapons/companion/oathkeeper-runtime';
import { DerivativeSkillController } from '@/active-skill/derivative/derivative-controller';
import type { Hud } from '@/ui/hud';

export interface ExclusiveRunPorts {
  heroId: () => HeroId;
  /** 树应用快照（null = 未装配；Q-b/Q-d 读取 mutations 旗） */
  treeMutations: () => { companionWeapon?: boolean; preselectedWeapon?: boolean } | null;
  ownedWeaponIds: () => WeaponId[];
  /** 入册（push ownedWeaponIds + HUD 槽刷新由场景侧编排；本层只发解锁） */
  addOwnedWeapon: (w: WeaponId) => void;
  weaponSystem: () => WeaponSystem;
  hud: () => Hud;
  oathkeeper: () => OathkeeperRuntime;
  /** 衍生技控制器重建写回（PlayScene.derivativeController 字段持有） */
  setDerivativeController: (c: DerivativeSkillController) => void;
  /** 存档预选通武（Q-d；saveData.preselectedWeapon） */
  preselectedWeapon: () => WeaponId | null;
  /** 质变钥持有查询（共鸣徽记四态） */
  hasKey: (keyId: string) => boolean;
}

export class ExclusiveRunAssembler {
  private p: ExclusiveRunPorts | null = null;
  /** B3-W1 当前专武（2 选 1 选择演出 / smoke/bench 默认路径共用写入点） */
  private exclusiveId: ExclusiveWeaponId = 'xw_lantern';

  attach(ports: ExclusiveRunPorts): void {
    this.p = ports;
  }

  /** 当前专武 id（升级上下文 / 圣域重叠判定 / 质变卡 id 拼装消费） */
  get exclusive(): ExclusiveWeaponId {
    return this.exclusiveId;
  }

  /** create 期默认专武初始化（角色对第一把 + 守誓者默认路径即时生效；NV-INTEG-FIX ③） */
  initDefaultExclusive(): void {
    const p = this.p!;
    this.exclusiveId = HERO_EXCLUSIVE_PAIRS[p.heroId()][0];
    p.oathkeeper().setEnabled(p.heroId() === 'hero_violet' && this.exclusiveId === 'xw_bell');
  }

  /**
   * B5-W4 Q-b/Q-d 开局预发（create 期，专武选择前）：
   * - Q-b 伴灯：开局自带配对共鸣通武（GT-7 全额；未配对普通形态入场，P2 取钥后升格共鸣）
   * - Q-d 携行旧兵：预选已解锁通武进局即得（GT-8 共存；同名不重复发放——与 Q-b 同名去重）
   */
  preGrantOpeningWeapons(): void {
    const p = this.p!;
    const mutations = p.treeMutations();
    if (!mutations) return;
    // Q-b 伴灯
    const treePair = resonancePairByExclusive(this.exclusiveId);
    if (mutations.companionWeapon && treePair && !p.ownedWeaponIds().includes(treePair.commonWeaponId)) {
      p.addOwnedWeapon(treePair.commonWeaponId);
      p.weaponSystem().unlockWeapon(treePair.commonWeaponId);
    }
    // Q-d 携行旧兵
    const preselected = p.preselectedWeapon();
    if (mutations.preselectedWeapon && preselected && WEAPON_CONFIGS[preselected] && !p.ownedWeaponIds().includes(preselected)) {
      p.addOwnedWeapon(preselected);
      p.weaponSystem().unlockWeapon(preselected);
    }
  }

  /**
   * NV-INTEG-FIX P0-2：专武选择装配（单一汇聚点）。
   * 选择回调与 smoke/bench 默认路径共用：applyLoadout 开专武门控 + Q-b 伴灯共鸣通武
   * + 衍生技重建（EXCLUSIVE_TO_DERIVATIVE 键 = 选中者）+ HUD 技名联动 + 守誓者（FQ-2 修女选圣铃）。
   */
  applySelection(chosen: ExclusiveWeaponId): void {
    const p = this.p!;
    this.exclusiveId = chosen;
    const loadout = computeLoadout(p.heroId(), chosen, HEROES[p.heroId()].initialWeapon);
    if (loadout) p.weaponSystem().applyLoadout(loadout);
    // B5-W4 Q-b 伴灯：选择路径再联动（同名不重复发放——与 Q-d 同名去重）
    const treePair = resonancePairByExclusive(chosen);
    if (p.treeMutations()?.companionWeapon && treePair && !p.ownedWeaponIds().includes(treePair.commonWeaponId)) {
      p.addOwnedWeapon(treePair.commonWeaponId);
      p.weaponSystem().unlockWeapon(treePair.commonWeaponId);
    }
    // B5-W4 衍生技装配（落选专武转化技）：重建控制器 + HUD 技名/图标联动
    p.setDerivativeController(new DerivativeSkillController(EXCLUSIVE_TO_DERIVATIVE[chosen]));
    p.hud().setSkillName(DERIVATIVE_SKILLS[EXCLUSIVE_TO_DERIVATIVE[chosen]].name);
    // W-4 守誓者：修女选圣铃开局自带（FQ-2）
    p.oathkeeper().setEnabled(p.heroId() === 'hero_violet' && chosen === 'xw_bell');
    // NV-INTEG-FIX P1：HUD 动态槽 + 共鸣徽记随选择联动
    this.refreshHudWeaponSlots();
    this.refreshResonanceBadge();
  }

  /** NV-INTEG-FIX P1：HUD 动态武器槽刷新（拥有集合 + 当前专武去重合成） */
  refreshHudWeaponSlots(): void {
    const p = this.p!;
    const ids = [...p.ownedWeaponIds()];
    if (!ids.includes(this.exclusiveId as unknown as WeaponId)) {
      ids.push(this.exclusiveId as unknown as WeaponId);
    }
    p.hud().setWeaponSlots(ids);
  }

  /** NV-INTEG-FIX P1：共鸣徽记四态刷新（专武 ∧ 钥 ∧ 达成 → HUD 徽记） */
  refreshResonanceBadge(): void {
    const p = this.p!;
    const badge = resonanceBadgeState(
      this.exclusiveId,
      (keyId) => p.hasKey(keyId),
      p.weaponSystem().resonance.isAchievedForExclusive(this.exclusiveId),
    );
    p.hud().setResonanceBadge(badge);
  }
}
