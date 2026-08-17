import { describe, it, expect } from 'vitest';
import { DEATH_BURST } from '@/fx/fx-spec';
import { FX, type EnemyKindId } from '@/config/balance';

const ALL_KINDS: readonly EnemyKindId[] = ['zombie', 'wolf', 'tank', 'boss'];

describe('fx-spec 击杀溅射规格（TASK-28 美术表现力专项）', () => {
  it('覆盖全部 4 种敌人类型（普通 3 + Boss）', () => {
    for (const kind of ALL_KINDS) {
      expect(DEATH_BURST[kind]).toBeDefined();
    }
  });

  it('每种规格：帧名/颜色/数量/寿命 有效', () => {
    for (const kind of ALL_KINDS) {
      const s = DEATH_BURST[kind];
      expect(s.frame).toMatch(/^p-/);
      expect(s.colors.length).toBeGreaterThan(0);
      expect(s.count).toBeGreaterThan(0);
      expect(s.speed).toBeGreaterThan(0);
      expect(s.size).toBeGreaterThan(0);
      expect(s.life).toBeGreaterThan(0);
    }
  });

  it('单次溅射粒子数 ≤ 桌面粒子池预算 200（FX.PARTICLE_BUDGET）', () => {
    for (const kind of ALL_KINDS) {
      expect(DEATH_BURST[kind].count).toBeLessThanOrEqual(FX.PARTICLE_BUDGET);
    }
  });

  it('敌型分化：数量/形状/速度 至少一项不同（形状优先于颜色，色盲可辨）', () => {
    for (const aKind of ALL_KINDS) {
      for (const bKind of ALL_KINDS) {
        if (aKind === bKind) continue;
        const a = DEATH_BURST[aKind];
        const b = DEATH_BURST[bKind];
        const differ =
          a.frame !== b.frame || a.count !== b.count || a.speed !== b.speed || a.size !== b.size;
        expect(differ).toBe(true);
      }
    }
  });
});
