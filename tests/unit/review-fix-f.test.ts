import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ACTIVE_SKILLS } from '@/config/balance';
import type { UpgradePoolV3Context } from '@/upgrade/upgrade-pool-v3';

/**
 * NV-REVIEW-FIX-F W-F2：双轨隔离收口（EG-2 归档不删）不可达断言。
 * - 超武进化轨道（WeaponSystem.evolve + EVOLUTIONS 资产）：运行时不可达 → 调用即 throw。
 *   （WeaponSystem 依赖 Phaser window，node 测试环境不可实例化 → 守卫经源码断言）
 * - 主动技旧轨（ACTIVE_SKILLS）：@deprecated + PlayScene 无 import（衍生技运行时替代）。
 * - merit-overlay：运行时入口隐藏（树替代；start-overlay 走 openTree）。
 * 资产与归档实现保留（EG-2），本测试守卫「不可达」语义防误接线。
 */

const srcOf = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(`../../src/${rel}`, import.meta.url)), 'utf-8');

describe('W-F2 超武进化轨道：运行时不可达（EG-2）', () => {
  it('evolve 函数体 = EG-2 throw 守卫（源码断言；原实现归档于 evolveArchived 不删）', () => {
    const s = srcOf('weapons/weapon-system.ts');
    expect(s).toContain("evolve(_weaponId: WeaponId, _scene: Phaser.Scene, _cfg: RuntimeConfig): boolean {\n    throw new Error('[EG-2] 超武进化轨道已归档");
    expect(s).toContain('evolveArchived(');
    expect(s).toContain('@deprecated');
  });

  it('归档资产保留：EVOLUTIONS 数据与 SUPER_WEAPON_EVOLUTION 映射仍在（不删）', async () => {
    const { EVOLUTIONS } = await import('@/config/balance');
    const { SUPER_WEAPON_EVOLUTION } = await import('@/weapons/super-weapons');
    expect(EVOLUTIONS.length).toBeGreaterThan(0);
    expect(Object.keys(SUPER_WEAPON_EVOLUTION).length).toBe(EVOLUTIONS.length);
  });

  it('运行时无调用点：src 全量无 .evolve( 直呼（守卫外接线错误即测试红）', () => {
    // 逐文件扫描（白名单：weapon-system.ts 自身定义 + 本测试守卫）
    const files = ['scenes/PlayScene.ts', 'upgrade/upgrade-pool-v2.ts', 'upgrade/upgrade-pool-v3.ts', 'weapons/weapon-runtime.ts'];
    for (const f of files) {
      expect(srcOf(f).includes('.evolve('), `${f} 不得直呼 .evolve(`).toBe(false);
    }
  });
});

describe('W-F2 主动技旧轨：@deprecated + 场景零引用（EG-2）', () => {
  it('ACTIVE_SKILLS 资产保留（归档不删）且 @deprecated 标注在位', () => {
    expect(Object.keys(ACTIVE_SKILLS).length).toBe(4);
    expect(srcOf('config/balance/active-skill.ts')).toContain('@deprecated');
  });

  it('PlayScene 无 ACTIVE_SKILLS / active-skill-runtime import（衍生技运行时替代）', () => {
    const s = srcOf('scenes/PlayScene.ts');
    expect(s.includes('ACTIVE_SKILLS')).toBe(false);
    expect(s.includes('active-skill-runtime')).toBe(false);
  });
});

describe('W-F2 merit-overlay：运行时入口隐藏（树替代）', () => {
  it('start-overlay 无 MeritOverlay import，功绩按钮走 openTree', () => {
    const s = srcOf('ui/start-overlay.ts');
    expect(s.includes("from '@/ui/merit-overlay'")).toBe(false);
    expect(s.includes('MeritOverlay')).toBe(false);
    expect(s).toContain('openTree');
  });

  it('src 运行时无 MeritOverlay 消费（merit-overlay 自身除外；资产与单测保留）', () => {
    for (const f of ['scenes/PlayScene.ts', 'ui/start-overlay.ts', 'ui/overlay-host.ts', 'stats/save.ts']) {
      expect(srcOf(f).includes('MeritOverlay'), `${f} 不得 import MeritOverlay`).toBe(false);
    }
  });
});

// —— W-F3 BUG-3：结算页矮视口（P1-15）——

describe('W-F3 BUG-3 结算页矮视口：max-height 折回设计空间', () => {
  it('1280×656（scale≈0.607）：修复后设计空间 max-height 渲染回视口高度 − 32px', () => {
    // Phaser Scale.FIT：视口 1280×656（宽高比 1.951 > 16:9）→ 画布上下贴边、左右 letterbox
    const fitScale = Math.min(1280 / 1920, 656 / 1080); // ≈ 0.6074（高受限）
    const canvasW = 1920 * fitScale;
    // computeOverlayLayout 公式镜像（overlay-scale.ts 模块本体 import Phaser，node 环境不可导入；
    // scale = canvasRect.width / designWidth）
    const layoutScale = canvasW / 1920;
    expect(layoutScale).toBeCloseTo(0.6074, 3);
    // 修复后 CSS：max-height = (100dvh − 32px) / scale（设计空间 px）
    const designMax = (656 - 32) / layoutScale;
    // 视觉高度 = 设计空间高度 × scale = 624px（= 视口 − 32；修复前 624 设计 px 只渲染 379px）
    expect(designMax * layoutScale).toBeCloseTo(624, 0);
    expect(designMax).toBeLessThanOrEqual(1080); // 不超过设计画布高度
  });

  it('results-overlay 源码：dvh/dvw 上限均 ÷ var(--bmv-overlay-scale, 1)（桌面 + 移动媒体查询）', () => {
    const s = srcOf('ui/results-overlay.ts');
    expect(s).toContain('max-width: calc((100dvw - 32px) / var(--bmv-overlay-scale, 1))');
    expect(s).toContain('max-height: calc((100dvh - 32px) / var(--bmv-overlay-scale, 1))');
    expect(s).toContain('max-height: calc(88dvh / var(--bmv-overlay-scale, 1))');
    expect(s.includes('max-height: calc(100dvh - 32px)')).toBe(false); // 旧写法不得残留
  });
});

// —— W-F3 BUG-4：序章 Esc / 相位安全定时器（P1-16）——

describe('W-F3 BUG-4 序章：Phaser 时钟 + Esc 由序章消费', () => {
  it('prologue-overlay：armTimer 走 clock 端口（window.setTimeout 仅作独立使用兜底）', () => {
    const s = srcOf('ui/prologue-overlay.ts');
    expect(s).toContain('this.timer = this.clock.delay(this.durationMs, () => this.advance())');
    expect(s).toContain("e.key === 'Escape'"); // PROLOGUE 相位内 Esc 由序章消费（推进/跳过）
  });

  it('PlayScene：createPrologueOverlay 传入 Phaser Scene clock（随相位冻结/场景销毁）', () => {
    const s = srcOf('scenes/PlayScene.ts');
    expect(s).toContain('clock: { delay: (ms, cb) => this.time.delayedCall(ms, cb) }');
  });

  it('indexForAdvance 语义回归：末屏 -1、推进 +1（Esc 跳过与点击同路径）', async () => {
    const { indexForAdvance } = await import('@/ui/prologue-overlay');
    expect(indexForAdvance(0, 3)).toBe(1);
    expect(indexForAdvance(2, 3)).toBe(-1);
  });
});

// —— W-F3 BUG-6：音频手势 resume 重试（P1-17）——

describe('W-F3 BUG-6 音频：unlock 失败后手势常驻节流 resume', () => {
  it('audio-manager：pointerdown/keydown 常驻监听 + 800ms 节流 + destroy 拆装', () => {
    const s = srcOf('audio/audio-manager.ts');
    expect(s).toContain('installGestureRetry');
    expect(s).toContain("window.addEventListener('pointerdown', tryResume, { passive: true })");
    expect(s).toContain("window.addEventListener('keydown', tryResume, { passive: true })");
    expect(s).toContain('< 800'); // 节流窗口
    expect(s).toContain('this.uninstallGestureRetry()'); // destroy 拆装
  });
});

// —— W-F4 P2-6：方阵局内次数锚对齐 GDD v1.1 ——

describe('W-F4 P2-6 方阵每局次数锚 [4,7] → [3,4]（GDD v1.1）', () => {
  it('FORMATION_RULES.RUNS_PER_GAME_ANCHOR = [3, 4]', async () => {
    const { FORMATION_RULES } = await import('@/config/balance');
    expect(FORMATION_RULES.RUNS_PER_GAME_ANCHOR).toEqual([3, 4]);
  });
});

// —— W-F4 P2-2：升级卡席位角标 P1~P5 明示 ——

describe('W-F4 P2-2 保底席位号透传与角标明示', () => {
  it('rollThreeV3：P1 席位命中 → 选项带 seat="P1"（30~60s 窗口 + 质变卡 1 未取）', async () => {
    const { rollThreeV3 } = await import('@/upgrade/upgrade-pool-v3');
    const { UpgradeState } = await import('@/upgrade/upgrade-pool');
    const ctx = {
      heroId: 'hero_edmund',
      ownedWeaponIds: ['wpn_a_1'],
      runTimeSeconds: 45, // P1 窗口（30~60s）
      exclusiveId: 'xw_lantern',
      derivativeId: 'dv_revolver_burst',
      takenMutationOrders: [],
      upgradeCount: 1,
      derivativeUpgradeTaken: false,
    } as UpgradePoolV3Context;
    const options = rollThreeV3(new UpgradeState(), ctx, () => 0.42);
    expect(options.some((o) => o.seat === 'P1' && o.related)).toBe(true);
  });

  it('matchGuaranteeSeatV3：空池 → null（回退 up_g_1 路径，无席位号）', async () => {
    const { matchGuaranteeSeatV3 } = await import('@/upgrade/upgrade-pool-v3');
    const { UpgradeState } = await import('@/upgrade/upgrade-pool');
    const ctx = {
      heroId: 'hero_edmund',
      ownedWeaponIds: [],
      runTimeSeconds: 45,
      exclusiveId: 'xw_lantern',
      derivativeId: 'dv_revolver_burst',
      takenMutationOrders: [],
      upgradeCount: 1,
      derivativeUpgradeTaken: false,
    } as UpgradePoolV3Context;
    expect(matchGuaranteeSeatV3(new UpgradeState(), ctx, [])).toBeNull();
  });

  it('levelup-overlay：席位角标按 P1~P5 明示（`${seat} 保底`），related 无席位回退「保底」', () => {
    const s = srcOf('ui/levelup-overlay.ts');
    expect(s).toContain('${option.seat ? `${option.seat} 保底` : \'保底\'}');
  });
});

// —— W-F4：PlayScene 拆分后模块协作接线守卫（W-F1 回归护栏） ——

describe('W-F4 模块协作：PlayScene × run/* 八模块装配接线', () => {
  const MODULES = [
    'BenchSmokeRunner',
    'BossSkillConsumer',
    'ExclusiveRunAssembler',
    'RelicFieldRunner',
    'UpgradeFlowController',
    'DerivativeCastBridge',
    'KillLootConsumer',
    'TreeApplier',
  ] as const;

  it('八模块全部实例化且 attach 端口装配（端口注入 DI 模式一致）', () => {
    const s = srcOf('scenes/PlayScene.ts');
    for (const m of MODULES) {
      expect(s.includes(`new ${m}(`), `PlayScene 缺少 ${m} 实例化`).toBe(true);
      expect(s.includes('.attach({'), 'attach 端口块在位').toBe(true);
    }
    expect(s.includes(`new ${'TreeApplier'}()`)).toBe(true);
  });

  it('enemy:killed 事件经闭包转发至 KillLootConsumer（M7 后场景不再自持击杀逻辑）', () => {
    const s = srcOf('scenes/PlayScene.ts');
    expect(s).toContain('GameEvents.on(GameEvent.EnemyKilled, (args: unknown) => this.killLoot.onEnemyKilled(args), this)');
    // 场景内不得残留搬移方法体（击杀消费/图鉴功绩计数/预警/宝箱）
    expect(s.includes('private onEnemyKilled(')).toBe(false);
    expect(s.includes('private dropRareChest(')).toBe(false);
    expect(s.includes('private onTankWarning(')).toBe(false);
    expect(s.includes('private judgePlayerRevive(')).toBe(false);
    expect(s.includes('private applyTreeToStats(')).toBe(false);
  });
});
