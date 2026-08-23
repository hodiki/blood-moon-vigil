import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnemySpawner } from '@/spawner/enemy-spawner';
import { DESKTOP_CONFIG, type RuntimeConfig } from '@/config/runtime-config';
import { SPAWNER } from '@/config/balance';
import { GameEvents, GameEvent } from '@/core/events';
import type { ArcadePoolLike } from '@/core/object-pools';
import type { Enemy } from '@/enemies/enemy';
import type { Player } from '@/player/player';

/**
 * TASK-39 E2 屠夫预警：保底厚血出生前 2.5s 血月印记（红圈 + 低音）。
 * 本测试验证 enemy-spawner 的预约落地时序（纯逻辑层，不依赖 Phaser 渲染）：
 * 1. S2 阶段（120–240s）保底达标时先发 tank:warning（此时不落池）
 * 2. 再经 SPAWNER.TANK_WARNING_SECONDS（2.5s）后 tank:spawned + 真正 acquire 厚血
 * M2 收口（R-A + R-C3-RULING）：spawner 改走 Enemy.spawnByConfig + pickEnemyIdForMap —— 本测试以
 * map_graveyard 装配（tank 槽 = 守墓者 enemy_g1_6，R-C3-RULING tank 只放 elite），断言保底厚血落池记录为该敌种。
 * 注：mock Math.random=0.5 → 三段权重（S1 0.90 / S2 0.80 / S3 0.62 僵尸）均恒定抽到僵尸槽
 * （0.5<0.62），避免随机厚血重置保底累计导致的时序不确定性。
 * TASK-31 收尾：阶段表 4 段→3 段，S2 保底 120s 起 → 首只保底 ~150s（旧 180s 起 ~210s）。
 */

const GAME_TICK = 0.05; // 50ms 模拟步长（clampDelta 上限）
const GRAVEYARD_TANK_ID = 'enemy_g1_6'; // 墓地 tank 槽唯一敌（守墓者 elite；R-C3-RULING 保底厚血敌种）

interface FakeSpawnRecord {
  /** 内容 ID（spawnByConfig cfg.id；M2 收口后不再用 enemy-<kind> 帧名当类型） */
  id: string;
  frame: string;
  x: number;
  y: number;
  /** 局时秒（由测试 clock 注入，用于断言预警→落池时序） */
  t: number;
  /** 落地速度（spawner 应用狼穴移速加权后写入；本测试为墓地 ×1.0） */
  speed: number;
}

interface FakeEnemyLike {
  active: boolean;
  speed: number;
  spawnByConfig(cfg: { id: string; frame: string; speed: number }, x: number, y: number): void;
}

function makeFakes() {
  const clock = { t: 0 };
  const spawned: FakeSpawnRecord[] = [];
  const fakeEnemy: FakeEnemyLike = {
    active: true,
    speed: 0,
    spawnByConfig(cfg, x, y) {
      spawned.push({ id: cfg.id, frame: cfg.frame, x, y, t: clock.t, speed: cfg.speed });
    },
  };
  const pool = {
    get activeCount() {
      return 0; // 永不达上限，避免 retry 节流
    },
    acquire: () => fakeEnemy as unknown as Enemy,
    eachActive: () => {},
  } as unknown as ArcadePoolLike<Enemy>;
  const player = { x: 1500, y: 1500 } as Player;
  const cfg = DESKTOP_CONFIG as RuntimeConfig;
  const spawner = new EnemySpawner(cfg, pool, player, 'map_graveyard');
  return { spawner, spawned, clock };
}

describe('TASK-39 E2 屠夫预警（保底厚血血月印记预约落地时序）', () => {
  let warningCount: number;
  let spawnedCount: number;
  let onWarning: () => void;
  let onSpawned: () => void;

  beforeEach(() => {
    warningCount = 0;
    spawnedCount = 0;
    onWarning = () => {
      warningCount += 1;
    };
    onSpawned = () => {
      spawnedCount += 1;
    };
    GameEvents.on(GameEvent.TankWarning, onWarning);
    GameEvents.on(GameEvent.TankSpawned, onSpawned);
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // 恒定抽僵尸（权重 0.78 内），保底累计确定性
  });

  afterEach(() => {
    GameEvents.off(GameEvent.TankWarning, onWarning);
    GameEvents.off(GameEvent.TankSpawned, onSpawned);
    vi.restoreAllMocks();
  });

  it('S2 保底达标 → 先 tank:warning（不立即落池），再 ~2.5s 后保底厚血落地 + tank:spawned', () => {
    const { spawner, spawned, clock } = makeFakes();
    // 快速推进到 S2 阶段（120s 起）并越过保底 30s 累计（≥150s）
    let t = 0;
    let warningAt: number | null = null;
    while (t < 260) {
      t += GAME_TICK;
      clock.t = t;
      spawner.update(GAME_TICK);
      if (warningCount > 0 && warningAt === null) warningAt = t;
    }
    // 预警必然发生（保底 30s + 预算连续，260s 内覆盖 120~240 窗口）
    expect(warningCount).toBeGreaterThan(0);
    expect(warningAt).not.toBeNull();
    // 保底厚血在预警后 ~2.5s（TANK_WARNING_SECONDS）落地：存在一个厚血落池时间落在该窗口
    const warningTime = warningAt as number;
    const guaranteedLanding = spawned.some((s) => {
      if (s.id !== GRAVEYARD_TANK_ID) return false; // M2 收口：墓地保底厚血 = 守墓者 enemy_g1_6
      const delta = s.t - warningTime;
      return delta >= SPAWNER.TANK_WARNING_SECONDS - 0.3 && delta <= SPAWNER.TANK_WARNING_SECONDS + 0.5;
    });
    expect(guaranteedLanding, '保底厚血应在预警后 ~2.5s 落地（血月印记→落地时序）').toBe(true);
    // 落池的厚血位置在出生环带内（桌面 [600,900]，相对玩家 (1500,1500)）
    const tank = spawned.find((s) => s.id === GRAVEYARD_TANK_ID);
    expect(tank).toBeDefined();
    if (tank) {
      const d = Math.hypot(tank.x - 1500, tank.y - 1500);
      expect(d).toBeGreaterThanOrEqual(600 - 1e-6);
      expect(d).toBeLessThanOrEqual(900 + 1e-6);
    }
    // tank:spawned 事件在落池时触发
    expect(spawnedCount).toBeGreaterThan(0);
  });

  it('玩家死亡（stop）后：预约厚血不落地（无残留刷怪）', () => {
    const { spawner, spawned } = makeFakes();
    // 推进到首只保底「已预约未落地」：S2 保底 30s（120s 起）→ ~150s 发 tank:warning，2.5s 后才落池
    let t = 0;
    let warningAt: number | null = null;
    while (t < 200 && warningAt === null) {
      t += GAME_TICK;
      spawner.update(GAME_TICK);
      if (warningCount > 0) warningAt = t;
    }
    expect(warningAt).not.toBeNull(); // 预警已预约
    expect(spawnedCount).toBe(0); // 预约阶段尚未 tank:spawned
    // 玩家死亡 → stop() 清空 pendingTank：再推进 10s 不得新增落池
    spawner.stop();
    const spawnedBeforeStop = spawned.length;
    for (let i = 0; i < 200; i += 1) spawner.update(GAME_TICK);
    expect(spawned.length).toBe(spawnedBeforeStop);
    expect(spawnedCount).toBe(0); // stop 后不再 tank:spawned
  });
});
