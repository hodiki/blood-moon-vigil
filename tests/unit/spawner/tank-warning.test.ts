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
 * 1. 3–8min 保底达标时先发 tank:warning（此时不落池）
 * 2. 再经 SPAWNER.TANK_WARNING_SECONDS（2.5s）后 tank:spawned + 真正 acquire 厚血
 * 注：mock Math.random=0.5 → 3–8min 权重 {0.78/0.2/0.02} 恒定抽到僵尸（0.5<0.78），
 * 避免随机厚血重置保底累计导致的时序不确定性。
 */

const GAME_TICK = 0.05; // 50ms 模拟步长（clampDelta 上限）

interface FakeSpawnRecord {
  kind: string;
  x: number;
  y: number;
  /** 局时秒（由测试 clock 注入，用于断言预警→落池时序） */
  t: number;
}

function makeFakes() {
  const clock = { t: 0 };
  const spawned: FakeSpawnRecord[] = [];
  const fakeEnemy: { active: boolean; spawn(kind: string, x: number, y: number): void } = {
    active: true,
    spawn(kind: string, x: number, y: number) {
      spawned.push({ kind, x, y, t: clock.t });
    },
  };
  const pool = {
    get activeCount() {
      return 0; // 永不达上限，避免 retry 节流
    },
    acquire: (_x: number, _y: number, _texture?: string, frame?: string | number) => {
      fakeEnemy.spawn(String(frame ?? ''), _x, _y);
      return fakeEnemy as unknown as Enemy;
    },
    eachActive: () => {},
  } as unknown as ArcadePoolLike<Enemy>;
  const player = { x: 1500, y: 1500 } as Player;
  const cfg = DESKTOP_CONFIG as RuntimeConfig;
  const spawner = new EnemySpawner(cfg, pool, player);
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

  it('3–8min 保底达标 → 先 tank:warning（不立即落池），再 ~2.5s 后保底厚血落地 + tank:spawned', () => {
    const { spawner, spawned, clock } = makeFakes();
    // 快速推进到 3–8min 阶段（≥180s）并越过保底 30s 累计（≥210s）
    let t = 0;
    let warningAt: number | null = null;
    while (t < 260) {
      t += GAME_TICK;
      clock.t = t;
      spawner.update(GAME_TICK);
      if (warningCount > 0 && warningAt === null) warningAt = t;
    }
    // 预警必然发生（保底 30s + 预算连续，260s 内覆盖 180~240 窗口）
    expect(warningCount).toBeGreaterThan(0);
    expect(warningAt).not.toBeNull();
    // 保底厚血在预警后 ~2.5s（TANK_WARNING_SECONDS）落地：存在一个厚血落池时间落在该窗口
    const warningTime = warningAt as number;
    const guaranteedLanding = spawned.some((s) => {
      if (s.kind !== 'enemy-tank') return false;
      const delta = s.t - warningTime;
      return delta >= SPAWNER.TANK_WARNING_SECONDS - 0.3 && delta <= SPAWNER.TANK_WARNING_SECONDS + 0.5;
    });
    expect(guaranteedLanding, '保底厚血应在预警后 ~2.5s 落地（血月印记→落地时序）').toBe(true);
    // 落池的厚血位置在出生环带内（桌面 [600,900]，相对玩家 (1500,1500)）
    const tank = spawned.find((s) => s.kind === 'enemy-tank');
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
    let t = 0;
    while (t < 210) {
      t += GAME_TICK;
      spawner.update(GAME_TICK);
    }
    // 停在预警预约发生前/后边缘：若已预约，stop 应清空 pendingTank
    spawner.stop();
    const spawnedBeforeStop = spawned.length;
    // 再推进 10s：不得新增落池
    for (let i = 0; i < 200; i += 1) spawner.update(GAME_TICK);
    expect(spawned.length).toBe(spawnedBeforeStop);
    expect(spawnedCount).toBe(0); // stop 后不再 tank:spawned
  });
});
