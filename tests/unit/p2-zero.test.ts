/**
 * tests/unit/p2-zero.test.ts —— NV-P2-ZERO 清零批用例
 *
 * 覆盖：
 * - P2-3a 共鸣预告徽记四态透传（decorateResonanceBadges 纯函数 + onLevelUp roll 结果透传）
 * - P2-3b 共鸣达成 0.8s 定格演出触发（consumeUpgradeChoice → showResonanceFreeze 端口）
 */

import { describe, it, expect } from 'vitest';

import { UpgradeState } from '@/upgrade/upgrade-pool';
import { PlayerStats } from '@/player/player-stats';
import {
  UpgradeFlowController,
  decorateResonanceBadges,
  type UpgradeFlowPorts,
} from '@/scenes/run/upgrade-flow-controller';
import { resonanceBadgeVisual } from '@/ui/levelup-overlay';
import { RESONANCE_FREEZE_MS } from '@/ui/resonance-freeze';
import { ResonanceState, commitResonance } from '@/weapons/resonance/resonance-engine';
import type { UpgradeV2Option } from '@/upgrade/upgrade-pool-v2';
import type { WeaponSystem } from '@/weapons/weapon-system';
import type { RunStats } from '@/stats/run-stats';
import type { ExclusiveWeaponId, UpgradeId } from '@/config/balance';

// ============================================================================
// P2-3a · 共鸣预告徽记四态透传
// ============================================================================

function keyOption(): UpgradeV2Option {
  return { kind: 'upgrade', upgradeId: 'key_pact' as UpgradeId, name: '兽契', desc: '', effectText: '', cardKind: 'blue-purple' };
}
function plainOption(id = 'up_g_1'): UpgradeV2Option {
  return { kind: 'upgrade', upgradeId: id as UpgradeId, name: '伤害强化', desc: '', effectText: '', cardKind: 'amber-gold' };
}

describe('NV-P2-ZERO · P2-3a 共鸣徽记四态透传（gdd-resonance §⑧ 卡面预告）', () => {
  it('awaiting-key：持专武未持钥 → 钥卡灰态徽记；非钥卡不渲染', () => {
    const options = [keyOption(), plainOption()];
    decorateResonanceBadges(options, 'xw_horn', () => false, false);
    expect(options[0]!.resonanceBadge).toBe('awaiting-key');
    expect(options[1]!.resonanceBadge).toBeUndefined();
  });

  it('ready-highlight：持专武且持钥（achieved 前）→ 钥卡高亮徽记', () => {
    const options = [keyOption(), plainOption()];
    decorateResonanceBadges(options, 'xw_horn', () => true, false);
    expect(options[0]!.resonanceBadge).toBe('ready-highlight');
  });

  it('achieved：共鸣已达成 → 钥卡共鸣徽记（幂等复选不回灰）', () => {
    const options = [keyOption()];
    decorateResonanceBadges(options, 'xw_horn', () => true, true);
    expect(options[0]!.resonanceBadge).toBe('achieved');
  });

  it('非配对专武（无 pair）→ 全部不写徽记', () => {
    const options = [keyOption()];
    decorateResonanceBadges(options, 'xw_lantern' as ExclusiveWeaponId, () => false, false);
    // xw_lantern 配对为 key_tome（有 pair）——钥卡不是 key_pact，不写
    expect(options[0]!.resonanceBadge).toBeUndefined();
  });

  it('卡面视觉映射与 hud 四态同源（label + reso-* 帧）', () => {
    expect(resonanceBadgeVisual('ready-highlight')).toEqual({ label: '可共鸣', frame: 'reso-ready' });
    expect(resonanceBadgeVisual('awaiting-key')).toEqual({ label: '待取钥', frame: 'reso-awaiting' });
    expect(resonanceBadgeVisual('achieved')).toEqual({ label: '共鸣', frame: 'reso-achieved' });
    expect(resonanceBadgeVisual('none')).toBeNull();
  });

  it('onLevelUp roll 结果透传：P2 席位钥卡携带 awaiting-key 徽记进入 showV2', () => {
    const shown: UpgradeV2Option[][] = [];
    // 局时 0（P1 质变卡 30~60s 窗口外）→ P2 钥席位必命中，抽取确定性
    const { controller } = makeController({ onShowV2: (o) => shown.push(o), elapsed: 0 });
    controller.onLevelUp({ level: 2, xpNeeded: 8 });
    expect(shown).toHaveLength(1);
    const keyCard = shown[0]!.find((o) => o.upgradeId === 'key_pact');
    expect(keyCard).toBeDefined(); // P2 保底席位：持专武未持钥 → 钥必入三选一
    expect(keyCard!.resonanceBadge).toBe('awaiting-key');
  });
});

// ============================================================================
// P2-3b · 共鸣达成 0.8s 定格演出触发
// ============================================================================

describe('NV-P2-ZERO · P2-3b 共鸣达成 0.8s 定格演出', () => {
  it('常量锚：RESONANCE_FREEZE_MS = 800（gdd-resonance §⑧ 定格时长）', () => {
    expect(RESONANCE_FREEZE_MS).toBe(800);
  });

  it('共鸣达成（tryResonance commit 成功）→ showResonanceFreeze 恰触发 1 次（词=对名）', () => {
    const { controller, freezeCalls, resonance } = makeController({});
    const state = controllerState(controller);
    state.addStack('key_pact', 1); // 持钥（生产口径 hasKey = stackOf ≥ 1）
    controller.onUpgradeChosen({ optionId: 'key_pact', index: 0, dwellSeconds: 0 });
    expect(freezeCalls).toEqual(['狼群誓约']); // R8 对名（RESONANCE_PAIRS.xw_horn）
    expect(resonance.isAchieved('R8')).toBe(true);
  });

  it('半满足不触发：未持钥时选非钥卡（不进入共鸣分支）→ 无定格', () => {
    const { controller, freezeCalls } = makeController({});
    controller.onUpgradeChosen({ optionId: 'up_g_1', index: 0, dwellSeconds: 0 });
    expect(freezeCalls).toEqual([]);
  });
});

// —— 控制器装配辅助（stub 端口 + 真实 ResonanceState/UpgradeState）——

function controllerState(c: UpgradeFlowController): UpgradeState {
  // attach 时 upgradeState 闭包捕获的同一实例（见 makeController）
  return (c as unknown as { p: UpgradeFlowPorts }).p.upgradeState();
}

interface ControllerHarness {
  controller: UpgradeFlowController;
  freezeCalls: string[];
  resonance: ResonanceState;
}

function makeController(opts: { onShowV2?: (o: UpgradeV2Option[]) => void; elapsed?: number }): ControllerHarness {
  const state = new UpgradeState();
  const resonance = new ResonanceState();
  const freezeCalls: string[] = [];
  const weaponSystem = {
    resonance,
    tryResonance: (exclusiveId: ExclusiveWeaponId, hasKey: (k: string) => boolean) =>
      commitResonance(resonance, { exclusiveId, hasKey }),
    setMissileSplit: () => {},
    setMissilePierce: () => {},
    setCooldownMultiplier: () => {},
    applyClassUpgrade: () => {},
    setKeyPassives: () => {},
    setFocusedCooldown: () => {},
  } as unknown as WeaponSystem;
  const runStats = {
    recordUpgradeOffered: () => {},
    recordLevelUp: () => {},
    recordUpgradeChosen: () => {},
    recordHesitationV2: () => {},
    recordResonance: () => {},
    recordMutationTaken: () => {},
  } as unknown as RunStats;

  const controller = new UpgradeFlowController();
  controller.attach({
    heroId: () => 'hero_galvan',
    exclusiveId: () => 'xw_horn',
    ownedWeaponIds: () => ['wpn_a_1', 'wpn_d_2'],
    upgradeState: () => state,
    stats: () => new PlayerStats(),
    runStats: () => runStats,
    xp: () => ({}) as never,
    weaponSystem: () => weaponSystem,
    oathkeeper: () => null as never,
    derivativeController: () => ({}) as never,
    fx: () => ({ levelUpBurst: () => {} }) as never,
    overlay: () => ({ showV2: (o: UpgradeV2Option[]) => opts.onShowV2?.(o) }) as never,
    elapsed: () => opts.elapsed ?? 30,
    playerX: () => 0,
    playerY: () => 0,
    phase: () => 0 as never,
    setPhase: () => {},
    isBench: () => false,
    treeS4Active: () => false,
    refreshResonanceBadge: () => {},
    showResonanceFreeze: (pairName: string) => freezeCalls.push(pairName),
    onWeaponUnlocked: () => {},
    onResonanceAchieved: () => {},
    setR5Sanctuary: () => {},
  } as unknown as UpgradeFlowPorts);
  controller.buildTargets();
  return { controller, freezeCalls, resonance };
}
