import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ACTIVE_SKILLS } from '@/config/balance';

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
