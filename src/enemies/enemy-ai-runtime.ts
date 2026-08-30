/**
 * enemies/enemy-ai-runtime.ts —— 特殊行为 AI 运行时驱动（W-1，gdd-enemies-v3 §③-3）
 *
 * 每帧驱动三类特殊行为（ENEMY_BEHAVIORS 消费端；纯函数判定在 enemy-behaviors.ts）：
 * - aura（尸巫 g1_5）：120px 内亡者（BLOOD tag）攻速 +20%/层 ×3 层——
 *   每帧重算 attackInterval = baseAttackInterval / (1 + 0.2×stacks)（接触伤害管线零改动）
 * - summon（圣杯侍僧 g2_3）：每 5s 召唤 1 血信徒（noXp，W-12 判定口径），上限 3
 *   同源计数（ownerTag = sk_<instanceId>，召唤物死亡由击杀链释放语义：计数按在场扫描）
 * - charge（狼裔猎手 g3_4）：6s 周期 蓄力 0.5s（锁向冻结）→ 警告线 0.15s → 冲刺 500px/s
 *   （冲刺方向 = 蓄力开始瞬间锁定向玩家；落空无二连由周期保证）
 *
 * 相位（g1_4 亡魂）与普通远程（g2_5）随 MN-15/MN-17 退役，不再接线。
 * 性能：尸巫/侍僧/猎手每图 ≤2 种，O(n×m) m=尸巫数（小）；召唤计数仅触发帧扫描。
 */

import { ENEMY_BEHAVIORS, type EnemyId } from '@/config/balance';
import { auraAdjustedAttackInterval, isUndead, chargePhaseFor, chargeCycleElapsed, specialBehaviorFor } from '@/enemies/enemy-behaviors';
import type { Enemy } from '@/enemies/enemy';
import type { ArcadePoolLike } from '@/core/object-pools';

/** 侍僧召唤 ownerTag 前缀（同源计数键） */
export const SUMMON_TAG_PREFIX = 'sk_';

/** 每敌 AI 运行时状态（WeakMap：池回收不阻塞 GC） */
interface PerEnemyAiState {
  summonTimer: number;
  chargeDir: { x: number; y: number } | null;
}

export class EnemyAiDirector {
  private states = new WeakMap<Enemy, PerEnemyAiState>();

  constructor(
    private readonly pool: ArcadePoolLike<Enemy>,
    /** 召唤出口（PlayScene → spawner.spawnRuntimeSummon；noXp 语义在 spawner 侧统一） */
    private readonly spawnSummon: (id: EnemyId, x: number, y: number, ownerTag: string) => Enemy | null,
  ) {}

  update(dt: number, now: number, player: { x: number; y: number }): void {
    // —— 收集尸巫位置（aura 源；每帧一次）——
    const necros: Array<{ x: number; y: number }> = [];
    this.pool.eachActive((e) => {
      if (e.enemyId === 'enemy_g1_5') necros.push({ x: e.x, y: e.y });
    });

    this.pool.eachActive((e) => {
      if (!e.enemyId) return;
      const behavior = specialBehaviorFor(e.enemyId);
      const state = this.stateFor(e);

      // —— aura（尸巫光环 → 亡者攻速；光环源自身不受自身加成外，其他 BLOOD 敌受叠层）——
      this.applyAura(e, necros);

      if (!behavior) return;
      if (behavior.kind === 'summon') {
        this.stepSummon(e, behavior, dt, state);
      } else if (behavior.kind === 'charge') {
        this.stepCharge(e, behavior, dt, now, player, state);
      }
    });
  }

  /** 光环攻速重算（每帧；stacks = 射程内尸巫数，cap 3） */
  private applyAura(e: Enemy, necros: Array<{ x: number; y: number }>): void {
    if (!isUndead(e.enemyId!) || necros.length === 0) {
      e.attackInterval = e.baseAttackInterval;
      return;
    }
    let stacks = 0;
    for (const n of necros) {
      if (Math.hypot(n.x - e.x, n.y - e.y) <= 120) stacks += 1;
    }
    stacks = Math.min(3, stacks);
    e.attackInterval = stacks > 0 ? auraAdjustedAttackInterval(e.baseAttackInterval, stacks) : e.baseAttackInterval;
  }

  /** summon（侍僧：每 5s 1 血信徒 noXp，同源在场 <3 才召） */
  private stepSummon(
    e: Enemy,
    behavior: { kind: 'summon'; interval: number; summonedId: EnemyId; summonCap: number },
    dt: number,
    state: PerEnemyAiState,
  ): void {
    state.summonTimer += dt;
    if (state.summonTimer < behavior.interval) return;
    state.summonTimer = 0;
    const tag = `${SUMMON_TAG_PREFIX}${e.instanceId}`;
    let alive = 0;
    this.pool.eachActive((o) => {
      if (o.groupId === tag) alive += 1;
    });
    if (alive >= behavior.summonCap) return; // 达上限暂停（§⑥-7）
    this.spawnSummon(behavior.summonedId, e.x + (Math.random() - 0.5) * 40, e.y + (Math.random() - 0.5) * 40, tag);
  }

  /** charge（狼裔猎手：蓄力锁向冻结 → 警告 → 冲刺；速度覆盖在 updateMovement 之后执行） */
  private stepCharge(
    e: Enemy,
    behavior: { kind: 'charge'; interval: number; windup: number; warning: number; dashSpeed: number; dashDuration: number },
    dt: number,
    now: number,
    player: { x: number; y: number },
    state: PerEnemyAiState,
  ): void {
    void dt;
    const cycle = chargeCycleElapsed(now, e.spawnedAt, behavior.interval);
    const phase = chargePhaseFor(behavior, cycle);
    const body = e.body as import('phaser').Physics.Arcade.Body;
    const chargeStart = behavior.interval - behavior.windup - behavior.warning - behavior.dashDuration;
    if (phase === 'windup') {
      // 蓄力开始瞬间锁定冲刺方向（固定方向固定语义；警告线已由 status-markers 绘制）
      if (cycle < chargeStart + behavior.windup * 0.5 || !state.chargeDir) {
        const dx = player.x - e.x;
        const dy = player.y - e.y;
        const len = Math.hypot(dx, dy) || 1;
        state.chargeDir = { x: dx / len, y: dy / len };
      }
      body.setVelocity(0, 0);
    } else if (phase === 'warning') {
      body.setVelocity(0, 0);
    } else if (phase === 'dash' && state.chargeDir) {
      body.setVelocity(state.chargeDir.x * behavior.dashSpeed, state.chargeDir.y * behavior.dashSpeed);
    } else {
      state.chargeDir = null; // 周期复位
    }
  }

  private stateFor(e: Enemy): PerEnemyAiState {
    let s = this.states.get(e);
    if (!s) {
      s = { summonTimer: 0, chargeDir: null };
      this.states.set(e, s);
    }
    return s;
  }
}

/** 行为种类守卫（导出供测试） */
export function behaviorKindsFor(enemyId: EnemyId): string[] {
  const b = ENEMY_BEHAVIORS[enemyId];
  return b ? [b.kind] : [];
}
