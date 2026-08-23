import { describe, it, expect, afterEach, vi } from 'vitest';
import { EnemySpawner } from '@/spawner/enemy-spawner';
import { DESKTOP_CONFIG, type RuntimeConfig } from '@/config/runtime-config';
import {
  SPAWNER,
  ENEMY_CONFIGS,
  ENEMY_BEHAVIORS,
  type MapId,
  type EnemyId,
  type EnemyConfig,
} from '@/config/balance';
import type { ArcadePoolLike } from '@/core/object-pools';
import type { Enemy } from '@/enemies/enemy';
import type { Player } from '@/player/player';
import {
  MAP_ENEMY_SLOTS,
  weightedWeightsForStage,
  pickEnemyIdForMap,
  rForSlot,
  type EnemySlot,
} from '@/spawner/map-spawner';
import { stageForTime } from '@/spawner/spawner';

/**
 * M2 收口（R-A + R-C3-RULING）：15 敌运行时接入 —— EnemySpawner 由硬编码 base zombie/wolf/tank 改为
 * Enemy.spawnByConfig（ENEMY_CONFIGS 唯一数据源）+ map-spawner.pickEnemyIdForMap（按地图槽位池抽取）。
 * R-C3-RULING：tank 槽只放 elite（墓地=守墓者 / 教堂=血肉畸体 / 狼穴=石甲狼），特殊行为敌归 wolf 槽。
 *
 * 断言面（gdd-maps §3.4 / gdd-enemies-v2 §3.1~3.3）：
 * 1. 三图槽位池 = 该图 ENEMY_CONFIGS 全集（墓地 6 / 教堂 5 / 狼穴 4），专属敌种全部可达
 * 2. 权重覆盖后任意 r/subR 采样恒属本图（无跨图泄漏）
 * 3. 保底厚血走该图 tank 槽（rForSlot 定槽）
 * 4. 三图构成差异（S3 wolf：墓地 0.33 / 教堂 0.38 / 狼穴 0.42，权重和 1.00）
 * 5. 全时段模拟（0→6:00）：只出本图敌种 + 该图专属敌种全部出现
 * 6. 5 类特殊行为敌（相位/光环/召唤/远程/冲锋）经 spawnByConfig 触发的敌种在该图出现
 * 7. 狼穴全敌移速 ×1.08 运行时生效（enemySpeedFor 在 spawnByConfig 后覆盖；其余图 ×1.0）
 */

const GAME_TICK = 0.05; // 50ms 模拟步长（clampDelta 上限）

/** 三图专属敌种（ENEMY_CONFIGS.map 全集；不重不漏） */
const MAP_ENEMY_SET: Record<MapId, readonly EnemyId[]> = {
  map_graveyard: ['enemy_g1_1', 'enemy_g1_2', 'enemy_g1_3', 'enemy_g1_4', 'enemy_g1_5', 'enemy_g1_6'],
  map_cathedral: ['enemy_g2_1', 'enemy_g2_2', 'enemy_g2_3', 'enemy_g2_4', 'enemy_g2_5'],
  map_den: ['enemy_g3_1', 'enemy_g3_2', 'enemy_g3_3', 'enemy_g3_4'],
};

/**
 * 确定性伪随机序列：覆盖三槽 + 槽内 subR（保证每图全部专属敌种都出现）。
 * R-C3-RULING 槽位调整后（wolf 槽 = 血犬/亡魂/尸巫 3 只），旧 5 值序列的 offset-3
 * 配对（kind r ↔ subR）永远到不了 wolf 槽第 3 只（尸巫需要 subR ≥ 0.67）。
 * 本 9 值序列按「offset-3 配对覆盖全部池桶」构造：wolf-kind(0.9) 分别配 subR
 * 0.1/0.5/0.8 → wolf idx 0/1/2；zombie-kind(0.1/0.5) 配 subR 0.6/0.2 → zombie idx 1/0。
 * 三图全时段模拟均全覆盖（墓地 6 / 教堂 5 / 狼穴 4）。
 */
const RAND_SEQ = [0.9, 0.9, 0.9, 0.1, 0.5, 0.8, 0.6, 0.2, 0.9];

interface SpawnRecord {
  id: EnemyId;
  frame: string;
  x: number;
  y: number;
  /** 落地速度（spawner 应用狼穴移速加权后写入） */
  speed: number;
}

interface FakeEnemyLike {
  active: boolean;
  speed: number;
  spawnByConfig(cfg: EnemyConfig, x: number, y: number): void;
}

/** 伪敌：记录 spawnByConfig 内容；speed setter 捕获 spawner 移速加权后的最终值 */
function makeRuntimeSpawner(mapId: MapId) {
  const spawned: SpawnRecord[] = [];
  const enemy: FakeEnemyLike & { _speed: number } = {
    active: true,
    _speed: 0,
    get speed() {
      return enemy._speed;
    },
    set speed(v: number) {
      enemy._speed = v;
      if (spawned.length > 0) spawned[spawned.length - 1]!.speed = v;
    },
    spawnByConfig(cfg, x, y) {
      spawned.push({ id: cfg.id, frame: cfg.frame, x, y, speed: cfg.speed });
    },
  };
  const pool = {
    get activeCount() {
      return 0; // 永不达上限，避免 retry 节流（全时段模拟真实生成量）
    },
    acquire: () => enemy as unknown as Enemy,
    eachActive: () => {},
  } as unknown as ArcadePoolLike<Enemy>;
  const player = { x: 1500, y: 1500 } as Player;
  const cfg = DESKTOP_CONFIG as RuntimeConfig;
  const spawner = new EnemySpawner(cfg, pool, player, mapId);
  return { spawner, spawned };
}

/** 全时段模拟（0 → 6:00 收束） */
function runToBoss(spawner: EnemySpawner): void {
  let t = 0;
  while (t < SPAWNER.BOSS_TIME) {
    t += GAME_TICK;
    spawner.update(GAME_TICK);
  }
}

function mockRandomSeq(seq: number[]): void {
  let i = 0;
  vi.spyOn(Math, 'random').mockImplementation(() => {
    const v = seq[i % seq.length]!;
    i += 1;
    return v;
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('M2 收口：三图槽位池构成（E3-S7 / gdd-maps §3.4）', () => {
  it('三图槽位池 = 该图 ENEMY_CONFIGS 全集（墓地 6 / 教堂 5 / 狼穴 4，不重不漏）', () => {
    for (const mapId of Object.keys(MAP_ENEMY_SET) as MapId[]) {
      const poolIds = new Set<string>();
      for (const slot of ['zombie', 'wolf', 'tank'] as EnemySlot[]) {
        for (const id of MAP_ENEMY_SLOTS[mapId][slot]) {
          expect(ENEMY_CONFIGS[id].map, `${id} 应属 ${mapId}`).toBe(mapId);
          poolIds.add(id);
        }
      }
      expect(poolIds.size).toBe(MAP_ENEMY_SET[mapId].length);
      for (const id of MAP_ENEMY_SET[mapId]) {
        expect(poolIds.has(id), `${mapId} 槽位池缺专属敌 ${id}`).toBe(true);
      }
    }
  });

  it('pickEnemyIdForMap 任意 r/subR 采样：抽到的敌恒属该图（无跨图泄漏）', () => {
    for (const mapId of ['map_graveyard', 'map_cathedral', 'map_den'] as const) {
      for (const t of [60, 150, 300]) {
        const w = weightedWeightsForStage(mapId, stageForTime(t));
        for (let i = 0; i < 64; i += 1) {
          const r = ((i * 7 + 3) % 100) / 100; // 确定性伪随机 < 1
          const subR = ((i * 11 + 5) % 100) / 100;
          expect(ENEMY_CONFIGS[pickEnemyIdForMap(mapId, w, r, subR)].map).toBe(mapId);
        }
      }
    }
  });

  it('rForSlot 强制槽位：tank 槽恒抽 tank 池（保底厚血走该图 tank 敌种）', () => {
    for (const mapId of ['map_graveyard', 'map_cathedral', 'map_den'] as const) {
      for (const t of [60, 150, 300]) {
        const w = weightedWeightsForStage(mapId, stageForTime(t));
        const id = pickEnemyIdForMap(mapId, w, rForSlot('tank', w), 0.5);
        expect(MAP_ENEMY_SLOTS[mapId].tank).toContain(id);
      }
    }
  });

  it('三图构成差异总表（S3 wolf：墓地 0.33 / 教堂 0.38 / 狼穴 0.42；权重和 1.00）', () => {
    const s3 = stageForTime(300);
    const g = weightedWeightsForStage('map_graveyard', s3);
    const c = weightedWeightsForStage('map_cathedral', s3);
    const d = weightedWeightsForStage('map_den', s3);
    expect(g.wolf).toBeCloseTo(0.33, 6);
    expect(c.wolf).toBeCloseTo(0.38, 6);
    expect(d.wolf).toBeCloseTo(0.42, 6);
    for (const w of [g, c, d]) {
      expect(w.zombie + w.wolf + w.tank).toBeCloseTo(1.0, 6);
    }
  });
});

describe('M2 收口：EnemySpawner 运行时 15 敌接入（spawnByConfig + pickEnemyIdForMap）', () => {
  it('三图全时段模拟（0→6:00）：只出本图敌种，且该图专属敌种全部出现', () => {
    for (const mapId of ['map_graveyard', 'map_cathedral', 'map_den'] as const) {
      mockRandomSeq(RAND_SEQ);
      const { spawner, spawned } = makeRuntimeSpawner(mapId);
      runToBoss(spawner);
      expect(spawned.length, `${mapId} 应真实大量生成（预算曲线下 ~690 只）`).toBeGreaterThan(100);
      const ids = new Set(spawned.map((s) => s.id));
      for (const id of ids) expect(ENEMY_CONFIGS[id].map, `${id} 应属 ${mapId}`).toBe(mapId);
      for (const id of MAP_ENEMY_SET[mapId]) {
        expect(ids.has(id), `${mapId} 应出现专属敌 ${id}`).toBe(true);
      }
    }
  });

  it('spawnByConfig 触发：5 类特殊行为敌（相位/光环/召唤/远程/冲锋）在该图全时段内出现', () => {
    for (const mapId of ['map_graveyard', 'map_cathedral', 'map_den'] as const) {
      mockRandomSeq(RAND_SEQ);
      const { spawner, spawned } = makeRuntimeSpawner(mapId);
      runToBoss(spawner);
      const seen = new Set(spawned.map((s) => s.id));
      for (const [id, b] of Object.entries(ENEMY_BEHAVIORS) as [EnemyId, { kind: string }][]) {
        if (ENEMY_CONFIGS[id].map === mapId) {
          expect(seen.has(id), `${mapId} 应经 spawnByConfig 出现行为敌 ${id}（${b.kind}）`).toBe(true);
        }
      }
    }
  });

  it('狼穴全敌移速 ×1.08 运行时生效（enemySpeedFor 在 spawnByConfig 后覆盖）；其余图 ×1.0', () => {
    for (const mapId of ['map_graveyard', 'map_cathedral', 'map_den'] as const) {
      mockRandomSeq(RAND_SEQ);
      const { spawner, spawned } = makeRuntimeSpawner(mapId);
      runToBoss(spawner);
      const mult = mapId === 'map_den' ? 1.08 : 1.0;
      for (const rec of spawned) {
        expect(rec.speed, `${mapId}/${rec.id} 移速应 ×${mult}`).toBeCloseTo(
          ENEMY_CONFIGS[rec.id].speed * mult,
          6,
        );
      }
    }
  });

  it('保底厚血预约落地走该图 tank 槽敌种（R-C3-RULING tank 只放 elite：墓地=守墓者 / 教堂=血肉畸体 / 狼穴=石甲狼）', () => {
    for (const mapId of ['map_graveyard', 'map_cathedral', 'map_den'] as const) {
      mockRandomSeq(RAND_SEQ);
      const { spawner, spawned } = makeRuntimeSpawner(mapId);
      // 推进到 S2 保底（120s 起 30s 累计 → ~150s 首次预约落地 ~152.5s）
      let t = 0;
      while (t < 200) {
        t += GAME_TICK;
        spawner.update(GAME_TICK);
      }
      const tankIds = spawned
        .filter((s) => (MAP_ENEMY_SLOTS[mapId].tank as EnemyId[]).includes(s.id))
        .map((s) => s.id);
      expect(tankIds.length, `${mapId} 应出现保底 tank 槽敌`).toBeGreaterThan(0);
      for (const id of tankIds) {
        expect(MAP_ENEMY_SLOTS[mapId].tank).toContain(id);
      }
    }
  });

  it('出生环带运行时按地图覆盖：教堂桌面 [500,800]（其余图基准 [600,900]）', () => {
    const cases: [MapId, number, number][] = [
      ['map_graveyard', 600, 900],
      ['map_cathedral', 500, 800],
      ['map_den', 600, 900],
    ];
    for (const [mapId, lo, hi] of cases) {
      mockRandomSeq(RAND_SEQ);
      const { spawner, spawned } = makeRuntimeSpawner(mapId);
      let t = 0;
      while (t < 60) {
        // S1 阶段（无保底）纯普通生成，随机环带位置全采样
        t += GAME_TICK;
        spawner.update(GAME_TICK);
      }
      expect(spawned.length).toBeGreaterThan(10);
      for (const rec of spawned) {
        const d = Math.hypot(rec.x - 1500, rec.y - 1500); // 玩家固定 (1500,1500)
        expect(d, `${mapId} 出生距离应在 [${lo},${hi}]`).toBeGreaterThanOrEqual(lo - 1e-6);
        expect(d, `${mapId} 出生距离应在 [${lo},${hi}]`).toBeLessThanOrEqual(hi + 1e-6);
      }
    }
  });
});
