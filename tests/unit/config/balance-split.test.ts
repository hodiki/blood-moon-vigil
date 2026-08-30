import { describe, it, expect } from 'vitest';
import * as shim from '@/config/balance';
import * as ids from '@/config/balance/ids';
import * as world from '@/config/balance/world';
import * as player from '@/config/balance/player';
import * as weapons from '@/config/balance/weapons';
import * as enemies from '@/config/balance/enemies';
import * as spawner from '@/config/balance/spawner';
import * as fx from '@/config/balance/fx';
import * as ui from '@/config/balance/ui';
import * as activeSkill from '@/config/balance/active-skill';
import * as xp from '@/config/balance/xp';
import * as upgrade from '@/config/balance/upgrade';
import * as heroes from '@/config/balance/heroes';
import * as maps from '@/config/balance/maps';
import * as exclusive from '@/config/balance/exclusive';
import * as upgradeV3 from '@/config/balance/upgrade-v3';
import * as resonance from '@/config/balance/resonance';
import * as talentTree from '@/config/balance/talent-tree';
import * as formations from '@/config/balance/formations';
import * as bossSkills from '@/config/balance/boss-skills';

/**
 * EG-1 balance.ts 域拆分守卫：shim（@/config/balance）必须与各域文件 re-export 等价——
 * 防后续有人绕过 shim 直接改值或漏挂域文件。
 */

/** 域文件全部命名导出 key 集合 */
function keysOf(m: Record<string, unknown>): string[] {
  return Object.keys(m).sort();
}

describe('EG-1 balance 域拆分 · re-export 等价守卫', () => {
  const domains = {
    ids, world, player, weapons, enemies, spawner, fx, ui, activeSkill, xp, upgrade, heroes, maps, exclusive, upgradeV3, resonance, talentTree, formations, bossSkills,
  } as const;

  it('shim 导出集合 = 各域文件导出集合的并集（无遗漏、无多余）', () => {
    const expected = new Set<string>();
    for (const d of Object.values(domains)) for (const k of keysOf(d)) expected.add(k);
    expect(keysOf(shim as unknown as Record<string, unknown>)).toEqual([...expected].sort());
  });

  it('shim 每个导出与域文件同一引用（含类型外的运行时值）', () => {
    for (const d of Object.values(domains)) {
      for (const k of keysOf(d)) {
        expect((shim as unknown as Record<string, unknown>)[k]).toBe((d as Record<string, unknown>)[k]);
      }
    }
  });

  it('拆分后关键表引用不变（抽查：消费方零改动保证）', () => {
    expect(shim.WORLD).toEqual({ WIDTH: 3000, HEIGHT: 3000 });
    expect(shim.PLAYER.MOVE_SPEED).toBe(235);
    expect(Object.keys(shim.ENEMIES)).toEqual(['zombie', 'wolf', 'tank', 'boss']);
    expect(Object.keys(shim.WEAPON_CONFIGS)).toHaveLength(14);
    expect(shim.ENEMY_CONFIGS ? Object.keys(shim.ENEMY_CONFIGS) : []).toHaveLength(16);
    expect(Object.keys(shim.BOSSES)).toHaveLength(4);
    expect(shim.EVOLUTIONS).toHaveLength(7);
    expect(shim.UPGRADES).toHaveLength(12);
    expect(shim.UPGRADE_POOL).toHaveLength(40);
    expect(shim.MAP_CONFIGS ? Object.keys(shim.MAP_CONFIGS) : []).toHaveLength(3);
    expect(Object.keys(shim.HEROES)).toHaveLength(4);
    expect(Object.keys(shim.ACTIVE_SKILLS)).toHaveLength(4);
    expect(shim.SPAWNER.BOSS_TIME).toBe(360);
    expect(shim.XP.BASE_NEED).toBe(5);
    expect(shim.INITIAL_DPS_REFERENCE).toBe(33.5);
  });
});
