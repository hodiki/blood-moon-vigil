import { describe, it, expect } from 'vitest';
import {
  WEAPON_CONFIGS,
  EVOLUTIONS,
  type WeaponId,
  type EvoId,
  type PowerTag,
} from '@/config/balance';

/**
 * E1-S2 武器表 14 + 超武表 7 面板断言（gdd-weapons-v2 §3.2~3.5 / §5.2；
 * content-design-outline §3.2 / content-id-frame-map §2）。
 * 纯数据层：逐项与 GDD 表一致；powerTag 全覆盖（wpn_a_5 归 BLOOD，consistency C1）。
 */
const POWER_TAGS: readonly PowerTag[] = ['SILVER', 'HALLOWED', 'BEAST', 'BLOOD', 'MOON'];

describe('武器表 14（gdd-weapons-v2 §3.2~3.5）', () => {
  it('恰好 14 把，内容 ID 全覆盖（wpn_<类>_<id>）', () => {
    const ids = Object.keys(WEAPON_CONFIGS) as WeaponId[];
    expect(ids).toHaveLength(14);
    expect(ids).toEqual([
      'wpn_a_1', 'wpn_a_2', 'wpn_a_3', 'wpn_a_4', 'wpn_a_5',
      'wpn_b_1', 'wpn_b_2', 'wpn_b_3',
      'wpn_c_1', 'wpn_c_2', 'wpn_c_3',
      'wpn_d_1', 'wpn_d_2', 'wpn_d_3',
    ]);
  });

  it('powerTag 全覆盖：每把均在五 tag 内；wpn_a_5 骨钉标枪归 BLOOD（BONE→BLOOD 裁定）', () => {
    for (const w of Object.values(WEAPON_CONFIGS)) {
      expect(POWER_TAGS).toContain(w.powerTag);
      expect(w.frame.length).toBeGreaterThan(0);
      expect(w.name.length).toBeGreaterThan(0);
    }
    expect(WEAPON_CONFIGS.wpn_a_5.powerTag).toBe('BLOOD');
  });

  it('A 类 5 把（弹幕）：血月猎手/银针连弩/圣银火铳/幽灵飞刃/骨钉标枪 面板与 GDD §3.2 一致', () => {
    expect(WEAPON_CONFIGS.wpn_a_1).toMatchObject({ name: '血月猎手', class: 'A', powerTag: 'MOON', damage: 12, cooldown: 1.2, speed: 400, lifetime: 3, maxActive: 8, baseDps: 9.0 });
    expect(WEAPON_CONFIGS.wpn_a_2).toMatchObject({ name: '银针连弩', class: 'A', powerTag: 'SILVER', damage: 8, cooldown: 0.45, speed: 520, lifetime: 1.2, maxActive: 6, range: 400, pierce: 1, baseDps: 10.7 });
    expect(WEAPON_CONFIGS.wpn_a_3).toMatchObject({ name: '圣银火铳', class: 'A', powerTag: 'SILVER', damage: 10, cooldown: 2.2, speed: 420, lifetime: 0.8, maxActive: 15, pellets: 5, spreadDeg: 45, baseDps: 15.9 });
    expect(WEAPON_CONFIGS.wpn_a_4).toMatchObject({ name: '幽灵飞刃', class: 'A', powerTag: 'MOON', damage: 18, cooldown: 1.6, speed: 380, returnSpeed: 500, maxActive: 4, baseDps: 13.3 });
    expect(WEAPON_CONFIGS.wpn_a_5).toMatchObject({ name: '骨钉标枪', class: 'A', powerTag: 'BLOOD', damage: 30, cooldown: 3.0, speed: 700, lifetime: 1.2, maxActive: 3, range: 560, pierce: 3, baseDps: 8.0 });
  });

  it('B 类 3 把（环绕）：守夜之环/荆棘圣环/圣光壁垒 面板与 GDD §3.3 一致', () => {
    expect(WEAPON_CONFIGS.wpn_b_1).toMatchObject({ name: '守夜之环', class: 'B', powerTag: 'HALLOWED', damage: 8, baseCount: 3, maxCount: 6, radius: 80, angularSpeedDeg: 240, perTargetCooldown: 0.4, baseDps: 16.0 });
    expect(WEAPON_CONFIGS.wpn_b_2).toMatchObject({ name: '荆棘圣环', class: 'B', powerTag: 'HALLOWED', damage: 8, baseCount: 4, radius: 72, angularSpeedDeg: 180, slowPct: 0.3, slowDuration: 1, baseDps: 12.8 });
    expect(WEAPON_CONFIGS.wpn_b_3).toMatchObject({ name: '圣光壁垒', class: 'B', powerTag: 'HALLOWED', auraDps: 6, auraRadius: 120, damageReduction: 0.1, baseDps: 4.8 });
  });

  it('C 类 3 把（范围）：月蚀脉冲/血池喷涌/审判圣火 面板与 GDD §3.4 一致', () => {
    expect(WEAPON_CONFIGS.wpn_c_1).toMatchObject({ name: '月蚀脉冲', class: 'C', powerTag: 'MOON', damage: 60, cooldown: 8, radius: 280, duration: 0.4, baseDps: 7.5 });
    expect(WEAPON_CONFIGS.wpn_c_2).toMatchObject({ name: '血池喷涌', class: 'C', powerTag: 'BLOOD', damage: 20, cooldown: 6, radius: 180, duration: 3, slowPct: 0.2, baseDps: 8.0 });
    expect(WEAPON_CONFIGS.wpn_c_3).toMatchObject({ name: '审判圣火', class: 'C', powerTag: 'HALLOWED', damage: 35, cooldown: 8, radius: 200, duration: 2.5, baseDps: 8.8 });
  });

  it('D 类 3 把（召唤）：血蝠群/狼影猎犬/断罪锁链 面板与 GDD §3.5 一致', () => {
    expect(WEAPON_CONFIGS.wpn_d_1).toMatchObject({ name: '血蝠群', class: 'D', powerTag: 'BLOOD', damage: 6, summonCount: 2, attackInterval: 0.5, lifetime: 12, respawnCd: 5, baseDps: 11.1 });
    expect(WEAPON_CONFIGS.wpn_d_2).toMatchObject({ name: '狼影猎犬', class: 'D', powerTag: 'BEAST', damage: 15, summonCount: 1, attackInterval: 1.0, lifetime: 15, respawnCd: 4, baseDps: 8.9 });
    expect(WEAPON_CONFIGS.wpn_d_3).toMatchObject({ name: '断罪锁链', class: 'D', powerTag: 'HALLOWED', damage: 25, cooldown: 3.5, range: 200, knockback: 100, baseDps: 7.4 });
  });

  it('基础 DPS 汇总与 GDD §3.6 一致（14 把单目标等效，倍率 1.0）', () => {
    const dpsTable: Record<WeaponId, number> = {
      wpn_a_1: 9.0, wpn_a_2: 10.7, wpn_a_3: 15.9, wpn_a_4: 13.3, wpn_a_5: 8.0,
      wpn_b_1: 16.0, wpn_b_2: 12.8, wpn_b_3: 4.8,
      wpn_c_1: 7.5, wpn_c_2: 8.0, wpn_c_3: 8.8,
      wpn_d_1: 11.1, wpn_d_2: 8.9, wpn_d_3: 7.4,
    };
    for (const [id, dps] of Object.entries(dpsTable) as [WeaponId, number][]) {
      expect(WEAPON_CONFIGS[id].baseDps).toBe(dps);
    }
  });
});

describe('超武表 7（gdd-weapons-v2 §5.2 / content-design-outline §3.3）', () => {
  it('恰好 7 条，含合成映射 weapon_evolution { wpnId, keyId, evoId }', () => {
    expect(EVOLUTIONS).toHaveLength(7);
    const evoIds = EVOLUTIONS.map((e) => e.evoId) as EvoId[];
    expect(evoIds).toEqual([
      'evo_moonwrath', 'evo_silverblast', 'evo_seraphring', 'evo_totaleclipse',
      'evo_bloodsea', 'evo_batstorm', 'evo_packleader',
    ]);
  });

  it('合成映射与 GDD §5.2 一致：主武器 + 被动钥 → 超武', () => {
    const map: Record<string, { wpnId: WeaponId; keyId: string; name: string }> = {
      evo_moonwrath: { wpnId: 'wpn_a_1', keyId: 'key_scope', name: '血月天罚' },
      evo_silverblast: { wpnId: 'wpn_a_3', keyId: 'key_silver', name: '血银霰弹' },
      evo_seraphring: { wpnId: 'wpn_b_1', keyId: 'key_holy', name: '炽天使之环' },
      evo_totaleclipse: { wpnId: 'wpn_c_1', keyId: 'key_tome', name: '月全食' },
      evo_bloodsea: { wpnId: 'wpn_c_2', keyId: 'key_grail', name: '血海' },
      evo_batstorm: { wpnId: 'wpn_d_1', keyId: 'key_pact', name: '血蝠风暴' },
      evo_packleader: { wpnId: 'wpn_d_2', keyId: 'key_bone', name: '狼群领袖' },
    };
    for (const evo of EVOLUTIONS) {
      expect(map[evo.evoId]).toMatchObject({ wpnId: evo.wpnId, keyId: evo.keyId, name: evo.name });
      expect(evo.frame.length).toBeGreaterThan(0);
      expect(evo.effect.length).toBeGreaterThan(0);
    }
  });

  it('等效 DPS 与 GDD §5.2 数值对齐一致', () => {
    const dpsTable: Record<EvoId, number> = {
      evo_moonwrath: 27.0, evo_silverblast: 27.2, evo_seraphring: 28.8, evo_totaleclipse: 15.0,
      evo_bloodsea: 15.4, evo_batstorm: 33.3, evo_packleader: 26.7,
    };
    for (const evo of EVOLUTIONS) {
      expect(evo.baseDps).toBe(dpsTable[evo.evoId]);
    }
  });
});
