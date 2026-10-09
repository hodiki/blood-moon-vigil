import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { OathkeeperRuntime } from '@/weapons/companion/oathkeeper-runtime';
import {
  createOathkeeperState,
  syncOathkeeperMaxHp,
  transferDamage,
  OATHKEEPER_BASE_PLAYER_MAX_HP,
} from '@/weapons/companion/oathkeeper';
import { oathkeeperMaxHp } from '@/config/balance';

/**
 * EN-06 运行期接线回归（工程批 C · D8 / GDD §4.4 v1.4）：
 * 守誓者最大生命 = 玩家「**当局当前**」最大生命 ×150%——**动态跟随**，非入场快照、非固定 200。
 *
 * 断言分两层：
 * 1. 运行期机制层（OathkeeperRuntime 可脱离 Phaser 实例化）：入场初始化 + syncMaxHp 动态跟随；
 * 2. 场景接线守卫（PlayScene 源码断言）：构造传面板 + HpChanged 订阅 → syncMaxHp。
 *    （PlayScene 依赖 Phaser window，node 环境不可实例化 → 沿用 review-fix-f 源码断言纪律）
 */

describe('EN-06 守誓者上限 = 玩家当局当前最大生命 ×150%（运行期层）', () => {
  it('入场初始化：以传入玩家面板 maxHp 计算上限（×150%；非固定 200、非 172.5 兜底）', () => {
    const rt = new OathkeeperRuntime(0, 0, 200);
    expect(rt.state.maxHp).toBeCloseTo(300, 6); // 200 × 1.5
    expect(rt.state.hp).toBeCloseTo(300, 6); // 入场满血 = 上限
    // 反例守卫：明确不得是固定 200（旧口径）或兜底 172.5
    expect(rt.state.maxHp).not.toBe(200);
    expect(rt.state.maxHp).not.toBeCloseTo(172.5, 6);
  });

  it('×150% 随玩家面板任意值线性缩放（150→225 / 300→450 / 500→750 / 1000→1500）', () => {
    expect(new OathkeeperRuntime(0, 0, 150).state.maxHp).toBeCloseTo(225);
    expect(new OathkeeperRuntime(0, 0, 300).state.maxHp).toBeCloseTo(450);
    expect(new OathkeeperRuntime(0, 0, 500).state.maxHp).toBeCloseTo(750);
    expect(new OathkeeperRuntime(0, 0, 1000).state.maxHp).toBeCloseTo(1500);
  });

  it('【防回归核心】玩家最大生命成长 → 守誓者上限同步跟随（非入场快照）', () => {
    const rt = new OathkeeperRuntime(0, 0, 200); // 上限 300
    expect(rt.state.maxHp).toBeCloseTo(300, 6);
    // 玩家升级：maxHp 200 → 210（修女 hpPerLevel +10）→ 守誓者上限跟随 315
    rt.syncMaxHp(210);
    expect(rt.state.maxHp).toBeCloseTo(315, 6);
    // 连续成长：210 → 300 → 上限跟随 450
    rt.syncMaxHp(300);
    expect(rt.state.maxHp).toBeCloseTo(450, 6);
    // 明确失败面：若退化为「入场快照」，上限将恒为 300 → 本用例必红
    expect(rt.state.maxHp).not.toBeCloseTo(300, 6);
  });

  it('满血守誓者随上限抬升保持满血（无伤态自然成长；不构成「治疗」）', () => {
    const rt = new OathkeeperRuntime(0, 0, 200); // 上限 300，满血 300
    rt.syncMaxHp(300); // 玩家 maxHp 300 → 守誓者新上限 450
    expect(rt.state.maxHp).toBeCloseTo(450, 6);
    expect(rt.state.hp).toBeCloseTo(450, 6); // 满血 → 随上限抬升到顶
  });

  it('负伤守誓者同步后保留创伤（仅抬上限、当前 HP 不变；超上限则钳制）', () => {
    const rt = new OathkeeperRuntime(0, 0, 200); // 上限 300
    transferDamage(rt.state, 200, 0); // 50% → 承伤 100 → hp 200（未满血）
    expect(rt.state.hp).toBeCloseTo(200, 6);
    expect(rt.state.hp).toBeLessThan(rt.state.maxHp);
    rt.syncMaxHp(300); // 玩家 maxHp 300 → 新上限 450
    expect(rt.state.maxHp).toBeCloseTo(450, 6);
    expect(rt.state.hp).toBeCloseTo(200, 6); // 当前 HP 保持绝对值（不被「顺手治愈」）
    // 上限下调且低于当前 HP → 钳制（不溢出）
    rt.syncMaxHp(100); // 新上限 150 < 当前 200
    expect(rt.state.maxHp).toBeCloseTo(150, 6);
    expect(rt.state.hp).toBeCloseTo(150, 6); // 钳制到新上限
  });

  it('纯函数 syncOathkeeperMaxHp 与运行期 syncMaxHp 同源同果', () => {
    const a = createOathkeeperState(0, 0, 200);
    const b = new OathkeeperRuntime(0, 0, 200);
    transferDamage(a, 200, 0);
    transferDamage(b.state, 200, 0);
    syncOathkeeperMaxHp(a, 500);
    b.syncMaxHp(500);
    expect(a.maxHp).toBeCloseTo(b.state.maxHp, 6);
    expect(a.hp).toBeCloseTo(b.state.hp, 6);
    expect(a.maxHp).toBeCloseTo(750, 6);
  });

  it('兜底基数口径：无玩家面板时默认 = 薇奥莱 initialHp 115 ×150% = 172.5（仅单测/未接线场景）', () => {
    expect(OATHKEEPER_BASE_PLAYER_MAX_HP).toBe(115);
    expect(oathkeeperMaxHp(115)).toBeCloseTo(172.5, 6);
    expect(createOathkeeperState().maxHp).toBeCloseTo(172.5, 6);
    expect(new OathkeeperRuntime(0, 0).state.maxHp).toBeCloseTo(172.5, 6);
  });

  it('运行期上限与配置口径一致（oathkeeperMaxHp(pm) ≡ Runtime(pm).maxHp）', () => {
    for (const pm of [115, 200, 350, 1000]) {
      expect(new OathkeeperRuntime(0, 0, pm).state.maxHp).toBeCloseTo(oathkeeperMaxHp(pm), 6);
    }
  });
});

describe('EN-06 场景接线守卫（PlayScene 源码断言；Phaser 场景 node 不可实例化）', () => {
  const s = readFileSync(
    fileURLToPath(new URL('../../../src/scenes/PlayScene.ts', import.meta.url)),
    'utf-8',
  );

  it('守誓者构造传入玩家「当局当前」最大生命（非裸构造取兜底）', () => {
    expect(s).toMatch(/new OathkeeperRuntime\(\s*this\.player\.x \+ 40,\s*this\.player\.y,\s*this\.player\.stats\.maxHp\s*\)/);
    // 反例守卫：不得退回不传玩家面板的旧接线（否则运行期恒取兜底 172.5）
    expect(s).not.toMatch(/new OathkeeperRuntime\(this\.player\.x \+ 40, this\.player\.y\)/);
  });

  it('订阅 HpChanged → oathkeeper.syncMaxHp（玩家最大生命变更时动态跟随）', () => {
    // HpChanged 订阅块内直接调用 syncMaxHp（单点接线，防接线被摘除）
    expect(s).toMatch(/GameEvents\.on\(\s*GameEvent\.HpChanged,[\s\S]{0,240}this\.oathkeeper\.syncMaxHp\(/);
  });

  it('语义锚在位：注释显式标注「当局当前」×150% 且「动态跟随」（防退回快照写法）', () => {
    expect(s).toContain('当局当前');
    expect(s).toContain('动态跟随');
    expect(s).toContain('非入场快照');
  });
});
