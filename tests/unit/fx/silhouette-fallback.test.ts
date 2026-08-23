import { describe, it, expect } from 'vitest';
import { ENEMY_CONFIGS, MAP_CONFIGS, type EnemyId, type MapId } from '@/config/balance';
import { hasEnemySilhouetteFallback, missingSilhouetteFrames } from '@/fx/silhouette-fallback';
import { FRAME_BY_CONTENT_ID } from '@/config/frame-registry';

/**
 * E4-S4 程序剪影兜底覆盖（asset-spec v1.1 §4.2）：
 * 15 敌（R-C3-RULING 补守墓者）+ 教堂/狼穴 tile + 障碍帧全部有兜底实现 → 真机无 __MISSING。
 * 若某帧缺兜底模板（规格缺失），本测试 FAIL → 列清单报美术侧补（sprint-m2-plan §5.8）。
 */

describe('E4-S4 15 敌程序剪影兜底（asset-spec §4.2）', () => {
  it('15 敌 base + -v 变体帧全部有兜底 shape（无 __MISSING）', () => {
    const frames = (Object.keys(ENEMY_CONFIGS) as EnemyId[]).map((id) => ENEMY_CONFIGS[id].frame);
    expect(missingSilhouetteFrames(frames)).toEqual([]);
    // 既有 4 帧（zombie/wolf/tank/boss）也在兜底集
    expect(hasEnemySilhouetteFallback('enemy-zombie')).toBe(true);
    expect(hasEnemySilhouetteFallback('enemy-tank')).toBe(true);
    // R-C3-RULING 守墓者帧在兜底集
    expect(hasEnemySilhouetteFallback('enemy-gravekeeper')).toBe(true);
  });

  it('15 敌帧名 ⊆ 帧名注册表（frame-registry 闭合，M4 替换基准）', () => {
    const registry = FRAME_BY_CONTENT_ID;
    for (const enemyId of Object.keys(ENEMY_CONFIGS) as EnemyId[]) {
      const frame = ENEMY_CONFIGS[enemyId].frame;
      const registered = Object.values(registry).flat().includes(frame);
      expect(registered, `帧 ${frame} 应在注册表`).toBe(true);
    }
  });

  it('各帧在 characters 图集注册表内（procedural-textures 已 tex.add）', () => {
    const chars = FRAME_BY_CONTENT_ID;
    // frame-registry 的 characters 分区包含全部敌帧（注册表导出一致性由既有 frame-registry.test 覆盖）
    for (const enemyId of Object.keys(ENEMY_CONFIGS) as EnemyId[]) {
      const frame = ENEMY_CONFIGS[enemyId].frame;
      expect(chars[enemyId]).toContain(frame);
    }
  });
});

describe('E4-S4 教堂/狼穴 tile + 障碍帧兜底（gdd-maps §3.2/§3.3）', () => {
  it('3 图 tiles[0]/tiles[1]（MapSystem 实际渲染的地面/覆盖层）帧在注册表内', () => {
    for (const mapId of Object.keys(MAP_CONFIGS) as MapId[]) {
      const cfg = MAP_CONFIGS[mapId];
      const registry = FRAME_BY_CONTENT_ID[mapId];
      expect(registry).toContain(cfg.tiles[0]); // 地面
      expect(registry).toContain(cfg.tiles[1]); // 覆盖层（草地/地毯/草）
    }
  });

  it('教堂/狼穴障碍帧（MapSystem 圆形碰撞体消费）在注册表内', () => {
    for (const mapId of ['map_cathedral', 'map_den'] as const) {
      const registry = FRAME_BY_CONTENT_ID[mapId];
      for (const obs of MAP_CONFIGS[mapId].obstacles) {
        expect(registry).toContain(obs);
      }
    }
    // 教堂血池贴花（decal-bloodpool）在注册表内
    expect(FRAME_BY_CONTENT_ID.map_cathedral).toContain('decal-bloodpool');
  });
});
