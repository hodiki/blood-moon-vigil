import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { KillLootConsumer, type KillLootPorts } from '@/scenes/run/kill-loot-consumer';
import { RunStats } from '@/stats/run-stats';
import { MOON_AVATAR_ENTRY_ID } from '@/codex/codex';

/**
 * P0-1 口径 B：血月化身（boss_4）击杀分支 —— 产出链点亮 + 三处副作用守卫。
 *
 * 断言分两层：
 * 1. 消费端机制层（KillLootConsumer 可脱离 Phaser 实例化）：按内容 ID（bossId ?? enemyId）分流；
 *    化身分支可达（图鉴隐藏条目 / 事件条目 / avatarKills +5 / 稀有宝箱）；
 *    地图 Boss 走「首杀 Boss/精英 +2」；化身**不计入** firstBossKills（避免重复计功）。
 * 2. 场景接线守卫（PlayScene 源码断言，Phaser 场景 node 不可实例化 → 沿用 review-fix-f 纪律）：
 *    endFight 清场 / boss4OnField 复位 / 终局分流 / 二次 EnemyKilled 订阅。
 */

interface CodexRecorder {
  calls: string[];
  recordKill(id: string): boolean;
  recordTrigger(id: string): void;
  recordProgress(id: string): boolean;
}

function makeCodex(): CodexRecorder {
  const calls: string[] = [];
  return {
    calls,
    recordKill: (id: string) => {
      calls.push(`kill:${id}`);
      return true; // 首杀恒真（幂等性由 CodexTracker 承担，此处只验证分流）
    },
    recordTrigger: (id: string) => {
      calls.push(`trigger:${id}`);
    },
    recordProgress: (id: string) => {
      calls.push(`progress:${id}`);
      return true;
    },
  };
}

function makeConsumer() {
  const codex = makeCodex();
  const chests: Array<{ x: number; y: number }> = [];
  const gems: Array<{ xp: number }> = [];
  const runStats = new RunStats();
  const ports = {
    runStats: () => runStats,
    notifyGroupMemberKilled: () => {},
    onBossSummonKilled: () => {},
    codex: () => codex,
    setCodexToastPending: () => {},
    treeEliteOffers: () => 0,
    consumeTreeEliteOffer: () => {},
    notifyEliteKilled: () => {},
    notifyEliteOffers: () => {},
    fx: () => ({ deathBurst: () => {} }),
    dropGem: (xp: number) => {
      gems.push({ xp });
    },
    dropHeal: () => {},
    stats: () => ({ applyLifesteal: () => false, hp: 100, maxHp: 100, triggerKillSpeedBuff: () => {} }),
    rage: () => ({ active: () => false }),
    hasRageUpgrade: () => false,
    extendRageKill: () => {},
    nowSeconds: () => 0,
    spawnTankMark: () => ({ destroy: () => {} }),
    eachActiveEnemy: () => {},
    playerX: () => 0,
    playerY: () => 0,
    hasChestFrame: () => true,
    addChestImage: (x: number, y: number) => {
      chests.push({ x, y });
      return { x, y, active: true, destroy: () => {} };
    },
  } as unknown as KillLootPorts;
  const consumer = new KillLootConsumer();
  consumer.attach(ports);
  return { consumer, codex, chests, gems, runStats };
}

describe('P0-1 化身击杀产出链（KillLootConsumer 按内容 ID 分流）', () => {
  it('boss_4 击杀：图鉴隐藏条目 + codex_event_6 + avatarKills +1 + 稀有宝箱', () => {
    const { consumer, codex, chests } = makeConsumer();
    consumer.onEnemyKilled({
      enemyType: 'boss',
      enemyId: null,
      bossId: 'boss_4',
      xp: 150,
      x: 123,
      y: 456,
    });
    // 权威解锁路径 = recordKill(boss_4)（= codex_boss_boss_4 = MOON_AVATAR_ENTRY_ID，unlock 'kill'）
    expect(codex.calls).toContain('kill:boss_4');
    // 事件条目（首杀化身解锁）
    expect(codex.calls).toContain('progress:codex_event_6');
    // 旧的 recordTrigger(MOON_AVATAR_ENTRY_ID) 为同 entryId 幂等 no-op（保留显式 trigger 语义，非第二权威源）
    expect(codex.calls).toContain(`trigger:${MOON_AVATAR_ENTRY_ID}`);
    // 功绩 +5 的计数源 +1
    expect(consumer.avatarKillCount).toBe(1);
    // 化身产出 = +5（不计入「首杀 Boss/精英 +2」）
    expect(consumer.firstBossKillCount).toBe(0);
    // 稀有宝箱落地
    expect(chests).toEqual([{ x: 123, y: 456 }]);
  });

  it('地图 Boss boss_1 击杀：走「首杀 Boss +2」；avatarKills 不计', () => {
    const { consumer, codex } = makeConsumer();
    consumer.onEnemyKilled({
      enemyType: 'boss',
      enemyId: null,
      bossId: 'boss_1',
      xp: 100,
      x: 10,
      y: 20,
    });
    expect(codex.calls).toContain('kill:boss_1');
    expect(codex.calls).not.toContain('progress:codex_event_6');
    expect(consumer.firstBossKillCount).toBe(1);
    expect(consumer.avatarKillCount).toBe(0);
  });

  it('旧路径兼容：无 bossId 的普通内容敌仍按 enemyId 记录（15 敌图鉴不回归）', () => {
    const { consumer, codex } = makeConsumer();
    consumer.onEnemyKilled({
      enemyType: 'zombie',
      enemyId: 'enemy_g1_1',
      xp: 1,
      x: 0,
      y: 0,
    });
    expect(codex.calls).toContain('kill:enemy_g1_1');
    expect(consumer.firstBossKillCount).toBe(0);
    expect(consumer.avatarKillCount).toBe(0);
  });
});

describe('P0-1 化身击杀场景接线守卫（PlayScene 源码断言）', () => {
  const s = readFileSync(
    fileURLToPath(new URL('../../../src/scenes/PlayScene.ts', import.meta.url)),
    'utf-8',
  );

  it('二次 EnemyKilled 订阅 → onAvatarKilled（按 bossId 分流，非进度门）', () => {
    expect(s).toContain('GameEvents.on(GameEvent.EnemyKilled, (args: unknown) => this.onAvatarKilled(args), this)');
    expect(s).toContain('private onAvatarKilled(');
  });

  it('副作用①：化身击杀路径调用 bossConsumer.endFight 清化身技能召唤物', () => {
    // onAvatarKilled 体内含 endFight
    expect(s).toMatch(/onAvatarKilled[\s\S]{0,400}this\.bossConsumer\.endFight\(/);
  });

  it('副作用②：化身击杀路径复位 spawner.boss4OnField = false（方阵恢复掷点）', () => {
    expect(s).toMatch(/onAvatarKilled[\s\S]{0,600}this\.spawner\.boss4OnField = false/);
  });

  it('副作用③：终局分流 — onBossDefeated 对 bossId==="boss_4" 早退；不 finishGame', () => {
    expect(s).toMatch(/private onBossDefeated\(args\?: unknown\): void \{[\s\S]{0,300}if \(bossId === 'boss_4'\) return;/);
    // onAvatarKilled 体内不得出现 finishGame / recordMapCleared
    const body = s.slice(s.indexOf('private onAvatarKilled('));
    const end = body.indexOf('private finishGame(');
    const onAvatar = body.slice(0, end > 0 ? end : 1200);
    expect(onAvatar).not.toContain('finishGame');
    expect(onAvatar).not.toContain('recordMapCleared');
  });
});
