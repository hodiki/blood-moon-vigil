import { describe, it, expect } from 'vitest';
import { SPAWNER, GAME } from '@/config/balance';
import { bossTriggerDue, stageForTime, SPAWN_STAGES } from '@/spawner/spawner';
import {
  RunStats,
  bossFightSeconds,
  bossInTargetWindow,
} from '@/stats/run-stats';

/**
 * E4-S3 6:00 收束（S8-4 / E8-4 / RV-C8；TASK-31 收尾 BOSS_TIME 1200→360）：
 * - 触发判定纯函数（bossTriggerDue）+ 秒制累加精度（±0.1s）
 * - 终局判定纯函数（RunStats.finish victory=true/false；Boss 战时长 60~90s 判据）
 * EnemySpawner.update 本体依赖 Phaser（node 无法 import），触发逻辑已抽纯函数在此锚定。
 */

const DT_MAX_MS = 50; // clampDelta 上限（ARCH §3.5）

describe('6:00 Boss 收束触发（RV-C8 ±0.1s）', () => {
  it('BOSS_TIME = 360s（6:00）', () => {
    expect(SPAWNER.BOSS_TIME).toBe(360);
  });

  it('bossTriggerDue：局时秒 ≥ 360 触发（边界含等号）', () => {
    expect(bossTriggerDue(359.9, SPAWNER.BOSS_TIME)).toBe(false);
    expect(bossTriggerDue(360, SPAWNER.BOSS_TIME)).toBe(true);
    expect(bossTriggerDue(360.05, SPAWNER.BOSS_TIME)).toBe(true);
  });

  it('秒制累加触发误差 ≤ 0.1s（任意 dt ≤ 50ms 下触发时刻 ∈ [360, 360.1)）', () => {
    for (const dtMs of [16.7, 33.3, 50]) {
      const dt = dtMs / 1000;
      let t = 0;
      while (!bossTriggerDue(t, SPAWNER.BOSS_TIME)) t += dt;
      expect(t).toBeGreaterThanOrEqual(SPAWNER.BOSS_TIME);
      expect(t - SPAWNER.BOSS_TIME).toBeLessThanOrEqual(0.1);
      expect(dt).toBeLessThanOrEqual(DT_MAX_MS / 1000);
    }
  });

  it('阶段表覆盖 0→360（末阶段收于 BOSS_TIME，收束后预算恒 0 由 stopped 保证）', () => {
    expect(SPAWN_STAGES[0]!.start).toBe(0);
    expect(SPAWN_STAGES[SPAWN_STAGES.length - 1]!.end).toBe(SPAWNER.BOSS_TIME);
    // 收束判定独立于阶段：任何时刻 t≥360 都触发
    expect(stageForTime(360).weights).toBe(SPAWN_STAGES[SPAWN_STAGES.length - 1]!.weights);
  });
});

describe('终局判定（E4-S3：Boss 击杀→胜利 / 玩家死亡→失败）', () => {
  it('击杀 Boss → victory=true；玩家死亡 → victory=false（finish 聚合）', () => {
    const win = new RunStats();
    win.recordBossSpawn(360, 4000);
    win.recordBossDefeated(425);
    const rWin = win.finish(true, 425);
    expect(rWin.victory).toBe(true);
    expect(bossFightSeconds(win.boss)).toBe(65);
    expect(bossInTargetWindow(win.boss)).toBe(true);

    const lose = new RunStats();
    const rLose = lose.finish(false, 300.5);
    expect(rLose.victory).toBe(false);
    expect(rLose.bossFightSeconds).toBeNull();
  });

  it('Boss 战时长 60~90s 判据常量（enemies §⑤ / design-review-e3 交接项 4）', () => {
    expect(GAME.BOSS_FIGHT_TARGET_MIN).toBe(60);
    expect(GAME.BOSS_FIGHT_TARGET_MAX).toBe(90);
  });
});
