import { describe, it, expect } from 'vitest';
import {
  FRAME_BY_CONTENT_ID,
  FRAME_REGISTRY,
  RESERVED_FRAMES,
  ALL_FRAMES,
} from '@/config/frame-registry';
import { FRAME_DELIVERY_SET } from '../../../scripts/frame-delivery-set';
import {
  WEAPON_CONFIGS,
  EVOLUTIONS,
  ENEMY_CONFIGS,
  BOSSES,
  MAP_CONFIGS,
} from '@/config/balance';

/**
 * E1-S7 帧名注册表 diff（content-id-frame-map §8 验收 1）。
 * 注册表 ⊆ content-id-frame-map 交付集且无多余名；保留帧名未改名。
 * 交付集 = `scripts/frame-delivery-set.ts`（content-id-frame-map.md §1~6 逐帧转写，
 * 含规则推导的 upg-* / wslot-* 名；与 CI 脚本 `npm run frame-registry:ci` 共用同一数据源）。
 * 注：`heal`（M3 预留 ⏸）不在注册表，属有意排除（doc §5 标注预留）。
 */

const delivery = new Set<string>(FRAME_DELIVERY_SET);

describe('帧名注册表 diff（content-id-frame-map §8 验收 1）', () => {
  it('注册表 ⊆ 交付集且无多余名（ALL_FRAMES 每个帧名都在 content-id-frame-map 交付集内）', () => {
    const extra = ALL_FRAMES.filter((f) => !delivery.has(f));
    expect(extra).toEqual([]);
  });

  it('注册表非空且覆盖各内容域（角色/武器/超武/敌人/Boss/地图/图标）', () => {
    expect(ALL_FRAMES.length).toBeGreaterThan(100);
    expect(FRAME_BY_CONTENT_ID.hero_edmund).toContain('player');
    expect(FRAME_BY_CONTENT_ID.wpn_c_2).toContain('decal-bloodpool');
    expect(FRAME_BY_CONTENT_ID.boss_3).toContain('boss-fenrir-entrance');
    expect(FRAME_BY_CONTENT_ID.upg_icons).toHaveLength(40);
    expect(FRAME_BY_CONTENT_ID.wslot_icons).toHaveLength(21);
    expect(FRAME_BY_CONTENT_ID.codex_events).toHaveLength(6);
    expect(FRAME_BY_CONTENT_ID.markers).toHaveLength(6);
  });

  it('保留帧名未改名：RESERVED_FRAMES 全部在注册表内，且逐名与 §7.3 一致', () => {
    const reserved = new Set<string>(RESERVED_FRAMES);
    expect(RESERVED_FRAMES).toHaveLength(23);
    expect(RESERVED_FRAMES.filter((f) => !ALL_FRAMES.includes(f))).toEqual([]);
    // 保留帧名逐一核对（§7.3 清单）
    for (const f of [
      'player', 'player-v', 'missile', 'orb', 'shockwave',
      'enemy-zombie', 'enemy-zombie-v', 'enemy-hound', 'enemy-hound-v', 'enemy-boss', 'enemy-boss-v',
      'gem', 'tile-ground', 'tile-grass', 'tile-obstacle',
      'p-circle', 'p-ring', 'p-streak', 'moon', 'vignette',
      'decal-rock', 'decal-grass', 'decal-blood',
    ]) {
      expect(reserved.has(f)).toBe(true);
    }
  });

  it('三图集注册表导出（characters/effects/ui）帧名不重不漏，并集 = ALL_FRAMES', () => {
    const atlasNames = FRAME_REGISTRY.flatMap((g) => g.frames);
    expect(new Set(atlasNames).size).toBe(ALL_FRAMES.length);
    expect(atlasNames.length).toBe(ALL_FRAMES.length);
    expect(new Set(FRAME_REGISTRY.map((g) => g.atlas))).toEqual(new Set(['characters', 'effects', 'ui']));
  });

  it('配置表帧名全部在注册表内（balance 类表 ↔ 帧名注册表闭合）', () => {
    const missing: string[] = [];
    const check = (f: string): void => {
      if (!ALL_FRAMES.includes(f)) missing.push(f);
    };
    for (const w of Object.values(WEAPON_CONFIGS)) check(w.frame);
    for (const e of EVOLUTIONS) check(e.frame);
    for (const e of Object.values(ENEMY_CONFIGS)) check(e.frame);
    for (const b of Object.values(BOSSES)) check(b.frame);
    for (const m of Object.values(MAP_CONFIGS)) {
      for (const f of m.tiles) check(f);
      for (const f of m.obstacles) check(f);
      for (const f of m.decor) check(f);
    }
    expect(missing).toEqual([]);
  });
});
