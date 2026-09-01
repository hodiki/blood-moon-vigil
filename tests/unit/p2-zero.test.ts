/**
 * tests/unit/p2-zero.test.ts —— NV-P2-ZERO 清零批用例
 *
 * 覆盖：
 * - P2-3a 共鸣预告徽记四态透传（decorateResonanceBadges 纯函数 + onLevelUp roll 结果透传）
 * - P2-3b 共鸣达成 0.8s 定格演出触发（consumeUpgradeChoice → showResonanceFreeze 端口）
 * - R-8 latch 锁存释放（stepHorn 槽位释放立即重召，不等 12s 节拍）
 * - merit-overlay 退役归档 grep 守卫（src/_archived 快照原则 EG-2）
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

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
import { stepHorn, createHornState, hornWolfCount, type HornState } from '@/weapons/exclusive/exclusive-math';

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

// ============================================================================
// R-8 · latch 锁存释放（满员丢狼 → 槽位释放立即重召，不等 12s 节拍）
// ============================================================================

// 简易目标/玩家桩（stepHorn 只读 x/y/active/hp）
function makeTarget(x: number, y: number) {
  return { x, y, active: true, hp: 1000, radius: 12, kill: () => {} };
}
function makePlayer() {
  return { x: 0, y: 0, hp: 100, maxHp: 100 };
}

describe('NV-P2-ZERO · R-8 latch 锁存释放（gdd-resonance §⑦-2 猎犬消失瞬间释放）', () => {
  const MACHINE = { maxWolves: 2 }; // 卡 1 前基础场上限 2

  it('满员（猎犬占位）吹号 → 请求锁存（latchedRequest = true），狼数不变', () => {
    const state = createHornState();
    stepHorn(state, 0.01, 0, makePlayer(), [], 1, MACHINE, 1); // 0 狼 + 1 占位 < 2 → 正常召 1 头
    state.summonTimer = 0;
    stepHorn(state, 0.01, 0.01, makePlayer(), [], 1, MACHINE, 1); // 1+1 = 2 满且被外部顶掉 → 锁存
    expect(state.wolves).toHaveLength(1);
    expect(state.latchedRequest).toBe(true);
  });

  it('槽位释放（猎犬消失 externalOccupants 1→0）→ 锁存请求立即生效，不等 summonInterval 12s', () => {
    const state = createHornState();
    stepHorn(state, 0.01, 0, makePlayer(), [], 1, MACHINE, 1); // 召 1 头
    state.summonTimer = 0;
    stepHorn(state, 0.01, 0.01, makePlayer(), [], 1, MACHINE, 1); // 满 → 锁存
    expect(state.latchedRequest).toBe(true);
    // 猎犬消失（外部占位 0）：仅推进 0.01s（远小于 12s 节拍）→ 立即补狼
    stepHorn(state, 0.01, 0.02, makePlayer(), [makeTarget(50, 0)], 1, MACHINE, 0);
    expect(state.wolves).toHaveLength(2);
    expect(state.latchedRequest).toBe(false);
  });

  it('防连刷语义：自身满员再吹不锁存（静默丢弃 §6.1-2 原语义不变）', () => {
    const state = createHornState();
    stepHorn(state, 0.01, 0, makePlayer(), [], 1, MACHINE, 0);
    state.summonTimer = 0;
    stepHorn(state, 0.01, 0.01, makePlayer(), [], 1, MACHINE, 0);
    expect(state.wolves).toHaveLength(2);
    state.summonTimer = 0;
    stepHorn(state, 0.01, 0.02, makePlayer(), [], 1, MACHINE, 0);
    expect(state.wolves).toHaveLength(2);
    expect(state.latchedRequest).toBe(false);
  });

  it('锁存跨多个失败节拍保持；槽位释放后一次性消费', () => {
    const state = createHornState();
    stepHorn(state, 0.01, 0, makePlayer(), [], 1, MACHINE, 0); // 第 1 头正常召出
    state.summonTimer = 0;
    stepHorn(state, 0.01, 0.01, makePlayer(), [], 1, MACHINE, 1); // 1+1 满 → 锁存
    expect(state.latchedRequest).toBe(true);
    // 连续多个节拍猎犬仍在 → 保持锁存、狼数不变
    state.summonTimer = 0;
    stepHorn(state, 0.01, 0.02, makePlayer(), [], 1, MACHINE, 1);
    state.summonTimer = 0;
    stepHorn(state, 0.01, 0.03, makePlayer(), [], 1, MACHINE, 1);
    expect(state.wolves).toHaveLength(1);
    expect(state.latchedRequest).toBe(true);
    // 猎犬消失 → 立即补到 2 头（锁存一次消费）
    stepHorn(state, 0.01, 0.04, makePlayer(), [], 1, MACHINE, 0);
    expect(state.wolves).toHaveLength(2);
    expect(hornWolfCount(state, 0.05)).toBe(2);
  });

  it('HornState 契约：latchedRequest 初始 false', () => {
    const state: HornState = createHornState();
    expect(state.latchedRequest).toBe(false);
  });
});

// ============================================================================
// merit-overlay 模块退役归档 grep 守卫（src/_archived 快照原则 EG-2；W-F2 收尾）
// ============================================================================

const SRC_ROOT = join(import.meta.dirname ?? '.', '..', '..', 'src');

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === '_archived') continue; // 归档快照不参与运行时守卫
      out.push(...listTsFiles(p));
    } else if (name.endsWith('.ts')) {
      out.push(p);
    }
  }
  return out;
}

describe('NV-P2-ZERO · merit-overlay 模块退役收尾', () => {
  it('src/ui/merit-overlay.ts 已移入 src/_archived/（运行时路径不存在）', () => {
    expect(() => statSync(join(SRC_ROOT, 'ui', 'merit-overlay.ts'))).toThrow();
    expect(statSync(join(SRC_ROOT, '_archived', 'merit-overlay.ts')).isFile()).toBe(true);
  });

  it('grep 守卫：运行时（src/**，_archived 除外）零 import merit-overlay / MeritOverlay', () => {
    const offenders: string[] = [];
    for (const f of listTsFiles(SRC_ROOT)) {
      const src = readFileSync(f, 'utf8');
      if (src.includes('ui/merit-overlay') || src.includes('MeritOverlay')) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });

  it('单测同步归档：tests/unit/ui/merit-overlay.test.ts → tests/archived/（vitest include 不含 archived）', () => {
    expect(() => statSync(join(SRC_ROOT, '..', 'tests', 'unit', 'ui', 'merit-overlay.test.ts'))).toThrow();
    expect(statSync(join(SRC_ROOT, '..', 'tests', 'archived', 'merit-overlay.test.ts')).isFile()).toBe(true);
  });

  it('存档迁移链不动：save.ts meritPoints / meritEquipped 管线字段保留', () => {
    const save = readFileSync(join(SRC_ROOT, 'stats', 'save.ts'), 'utf8');
    expect(save).toContain('meritPoints');
    expect(save).toContain('meritEquipped');
  });
});
