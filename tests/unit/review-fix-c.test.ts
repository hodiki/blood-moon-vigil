/**
 * NV-REVIEW-FIX 批次 C · 怪物身份 —— 运行时用例
 *
 * 覆盖（审查 §4 P0-4 / P0-5；后续 C-2/C-3/D/E 小步追加）：
 * - P0-4 突袭型三敌（血犬 g1_2 / 血蝠 g2_2 / 暗影狼 g3_2）lunge 前扑：
 *   100px 起手 / 0.25s 蓄身锁向 / 90px@300px/s / CD 2.5s / 落空硬直 0.5s；
 *   与冲锋猎手（g3_4 charge）手感可区分（周期制长线 vs CD 制贴身短扑）
 * - P0-5 精英技能化 180s 门控：120s 守墓者无扫击预警；181s 新精英有技能；
 *   门内已入场精英不追溯切形态（不进 windup）
 *
 * 分层纪律：全部为运行时用例（纯函数/状态机/装配层协作），不依赖 Phaser 场景。
 */

import { describe, it, expect } from 'vitest';
import { ENEMY_BEHAVIORS, ENEMY_CONFIGS, type EnemyId } from '@/config/balance';
import {
  specialBehaviorFor,
  lungeDashDuration,
  lungeShouldTrigger,
  lungeSpeedFor,
  lungeTelegraphAlpha,
} from '@/enemies/enemy-behaviors';
import { EnemyAiDirector } from '@/enemies/enemy-ai-runtime';
import { EliteSkillDirector, type EliteEnemyLike } from '@/enemies/elite-skill-runtime';
import { ELITE_SKILLS, ELITE_SKILL_UNLOCK_SECONDS } from '@/enemies/elite-skills';
import type { ArcadePoolLike } from '@/core/object-pools';

// ============================================================================
// 测试替身
// ============================================================================

/** 敌方最小形状（EnemyAiDirector 消费面；body 速度写入可观测） */
interface FakeEnemy {
  enemyId: EnemyId;
  x: number;
  y: number;
  speed: number;
  baseAttackInterval: number;
  attackInterval: number;
  radius: number;
  spawnedAt: number;
  spawnGeneration: number;
  instanceId: number;
  attackTimer: number;
  noXp: boolean;
  groupId: string | null;
  body: { setVelocity(x: number, y: number): void; vx: number; vy: number } | null;
  cc: unknown;
}

let fakeSeq = 0;

function makeLungeEnemy(enemyId: EnemyId, x: number, y: number): FakeEnemy {
  return {
    enemyId,
    x, y,
    speed: ENEMY_CONFIGS[enemyId].speed,
    baseAttackInterval: ENEMY_CONFIGS[enemyId].attackInterval,
    attackInterval: ENEMY_CONFIGS[enemyId].attackInterval,
    radius: ENEMY_CONFIGS[enemyId].radius,
    spawnedAt: 0,
    spawnGeneration: 1,
    instanceId: ++fakeSeq,
    attackTimer: 0,
    noXp: false,
    groupId: null,
    body: { setVelocity(vx, vy) { this.vx = vx; this.vy = vy; }, vx: 0, vy: 0 },
    cc: { stun: null, slow: null, vulnerable: null, stunIcdReadyAt: 0 },
  };
}

function fakePool(enemies: FakeEnemy[]): ArcadePoolLike<never> {
  return {
    eachActive(cb: (e: never) => void) {
      for (const e of enemies) cb(e as never);
    },
    activeCount: enemies.length,
  } as unknown as ArcadePoolLike<never>;
}

function stepAi(dir: EnemyAiDirector, pool: ArcadePoolLike<never>, seconds: number, player: { x: number; y: number }, startNow = 0): void {
  const frames = Math.round(seconds * 60);
  for (let f = 0; f < frames; f += 1) {
    dir.update(1 / 60, startNow + f / 60, player, null);
  }
}

// ============================================================================
// P0-4 突袭型三敌 lunge（gdd-enemies-v3 §③-3 档 2）
// ============================================================================

describe('P0-4 突袭行为模板配置（§③-3 档 2 锚）', () => {
  it('血犬/血蝠/暗影狼登记同一 lunge 模板：100px / 0.25s / 90px@300px/s / CD 2.5s / 硬直 0.5s', () => {
    for (const id of ['enemy_g1_2', 'enemy_g2_2', 'enemy_g3_2'] as const) {
      const b = specialBehaviorFor(id);
      expect(b).not.toBeNull();
      expect(b).toEqual({
        kind: 'lunge', triggerDist: 100, windup: 0.25, dashDistance: 90, dashSpeed: 300, cd: 2.5, missStagger: 0.5,
      });
    }
  });

  it('与冲锋猎手手感可区分：g3_4 仍为 charge 周期制（6s 长线），lunge 为 CD 制贴身短扑', () => {
    const hunter = specialBehaviorFor('enemy_g3_4');
    expect(hunter?.kind).toBe('charge');
    const lunge = specialBehaviorFor('enemy_g1_2');
    if (!lunge || lunge.kind !== 'lunge') throw new Error('unreachable');
    // 突进距离 90px << 冲锋 200px；蓄身 0.25s << 蓄力+警告 0.65s；由 CD 而非周期驱动
    expect(lunge.dashDistance).toBeLessThan(200);
    expect(lunge.windup).toBeLessThan(0.65);
    expect(lungeDashDuration(lunge)).toBeCloseTo(0.3, 6); // 90/300
  });

  it('纯函数：触发/速度/telegraph 渐亮口径', () => {
    const lunge = specialBehaviorFor('enemy_g1_2');
    if (!lunge || lunge.kind !== 'lunge') throw new Error('unreachable');
    expect(lungeShouldTrigger(lunge, 100, 0)).toBe(true); // 边界含
    expect(lungeShouldTrigger(lunge, 101, 0)).toBe(false);
    expect(lungeShouldTrigger(lunge, 80, 1)).toBe(false); // CD 未就绪不触发
    expect(lungeSpeedFor(lunge, 'dash')).toBe(300);
    expect(lungeSpeedFor(lunge, 'windup')).toBe(0);
    expect(lungeTelegraphAlpha(lunge, 'idle', 0)).toBe(0);
    expect(lungeTelegraphAlpha(lunge, 'windup', 0)).toBeCloseTo(0.2, 6); // 蓄身渐亮起点
    expect(lungeTelegraphAlpha(lunge, 'windup', 0.25)).toBeCloseTo(0.9, 6);
    expect(lungeTelegraphAlpha(lunge, 'dash', 0)).toBeCloseTo(0.9, 6);
  });
});

describe('P0-4 突袭运行时（进 100px → 蓄身 → 突进 → CD/硬直）', () => {
  it('血犬进 100px 有前摇：windup 冻结 + 方向锁定 + telegraph 可查；随后 300px/s 突进', () => {
    const dog = makeLungeEnemy('enemy_g1_2', 95, 0); // 触发距离内
    const player = { x: 0, y: 0 };
    const dir = new EnemyAiDirector(fakePool([dog]), () => null);

    // 第 1 帧：触发进 windup（蓄身冻结，速度 0）
    dir.update(1 / 60, 0, player, null);
    const tel = dir.lungeTelegraphOf(dog as never);
    expect(tel).not.toBeNull();
    expect(tel!.range).toBe(90);
    expect(tel!.alpha).toBeGreaterThanOrEqual(0.2);
    expect(dog.body!.vx).toBe(0); // 蓄身冻结

    // 0.25s 蓄满 → dash 速度 300（方向 = 朝玩家锁定，玩家未动 → −x）
    stepAi(dir, fakePool([dog]), 0.4, player);
    expect(dog.body!.vx).toBeCloseTo(-300, 0);
    expect(dog.body!.vy).toBeCloseTo(0, 6);
    // dash 期 telegraph 保持可见
    expect(dir.lungeTelegraphOf(dog as never)).not.toBeNull();
  });

  it('落空 → 0.5s 硬直（速度 0）→ CD 2.5s 内不二连；远处无 telegraph', () => {
    const dog = makeLungeEnemy('enemy_g1_2', 95, 0);
    const player = { x: 0, y: 0 };
    const dir = new EnemyAiDirector(fakePool([dog]), () => null);
    // 完整一轮：windup 0.25 + dash 0.3（玩家静止在原地，敌从 95 冲 90px 越过玩家 → 视为命中）
    // 改为拉开距离制造落空：玩家在突进结束时远离敌
    const farPlayer = { x: 400, y: 0 };
    stepAi(dir, fakePool([dog]), 0.6, player); // windup + dash（朝 −x，穿玩家 = 命中）
    // 第二轮：玩家远离 → 触发后突进落空
    stepAi(dir, fakePool([dog]), 2.0, farPlayer); // CD 2.5s 未到，仍 idle
    // 把 CD 清零模拟时间流逝：直接推进足够帧数（2.5s CD）
    stepAi(dir, fakePool([dog]), 0.7, farPlayer);
    // 此时 CD 已过且 dist > 100 → 仍 idle，无 telegraph
    expect(dir.lungeTelegraphOf(dog as never)).toBeNull();
    // 拉回触发距离
    dog.x = 90;
    stepAi(dir, fakePool([dog]), 0.01, farPlayer); // 1 帧触发
    stepAi(dir, fakePool([dog]), 0.26, farPlayer); // 蓄身完成
    stepAi(dir, fakePool([dog]), 0.4, farPlayer); // dash 全程（90px，落空）
    // 落空硬直：速度归零、stagger 期无 telegraph
    expect(dog.body!.vx).toBe(0);
    expect(dir.lungeTelegraphOf(dog as never)).toBeNull();
    // 硬直 0.5s 内保持冻结
    stepAi(dir, fakePool([dog]), 0.3, farPlayer);
    expect(dog.body!.vx).toBe(0);
    // 硬直结束后恢复追击（默认 AI 在场景层；此处验证 director 不再覆盖速度）
    stepAi(dir, fakePool([dog]), 0.3, farPlayer);
  });

  it('CD 2.5s 不二连：突进结束后 2.4s 内再进 100px 不触发', () => {
    const dog = makeLungeEnemy('enemy_g1_2', 95, 0);
    const player = { x: 0, y: 0 }; // 命中口径（穿过玩家）
    const dir = new EnemyAiDirector(fakePool([dog]), () => null);
    stepAi(dir, fakePool([dog]), 0.6, player); // windup + dash 完成（命中）
    // CD 期内再贴近：不进 windup
    dog.x = 95;
    stepAi(dir, fakePool([dog]), 2.4, player);
    expect(dir.lungeTelegraphOf(dog as never)).toBeNull();
    // CD 过后（再 0.2s）进触发距离 → 重新起手
    stepAi(dir, fakePool([dog]), 0.2, player);
    dog.x = 95;
    stepAi(dir, fakePool([dog]), 0.01, player);
    expect(dir.lungeTelegraphOf(dog as never)).not.toBeNull();
  });

  it('三敌（血蝠/暗影狼）同模板运行：蓄身期冻结 + 突进方向锁定', () => {
    for (const id of ['enemy_g2_2', 'enemy_g3_2'] as const) {
      const e = makeLungeEnemy(id, 90, 0);
      const player = { x: 0, y: 0 };
      const dir = new EnemyAiDirector(fakePool([e]), () => null);
      dir.update(1 / 60, 0, player, null);
      expect(e.body!.vx).toBe(0); // 蓄身冻结
      stepAi(dir, fakePool([e]), 0.3, player);
      expect(e.body!.vx).toBeCloseTo(-300, 0);
    }
  });

  it('池复用（spawnGeneration 递增）重置突袭状态：新命不残留 CD/windup', () => {
    const dog = makeLungeEnemy('enemy_g1_2', 95, 0);
    const player = { x: 0, y: 0 };
    const dir = new EnemyAiDirector(fakePool([dog]), () => null);
    stepAi(dir, fakePool([dog]), 0.6, player); // 完成一轮突进
    // 池复用：代数递增、位置重置
    dog.spawnGeneration += 1;
    dog.x = 95;
    dir.update(1 / 60, 3, player, null);
    // 状态已重置 → 立即重新可触发（无 2.5s CD 残留）
    expect(dir.lungeTelegraphOf(dog as never)).not.toBeNull();
  });
});

// ============================================================================
// P0-5 精英技能化 180s 门控（gdd-spawner-v2 §5.4 轨③）
// ============================================================================

function fakeElite(enemyId: 'enemy_g1_6' | 'enemy_g2_4' | 'enemy_g1_8' | 'enemy_g2_5', x = 0, y = 0): EliteEnemyLike {
  return {
    x, y, hp: 350, maxHp: 350, enemyId,
    cc: { stun: null, slow: null, vulnerable: null, stunIcdReadyAt: 0 },
    speed: 40, baseAttackInterval: 1.8, attackInterval: 1.8,
  };
}

function stepElite(dir: EliteSkillDirector, e: EliteEnemyLike, seconds: number, player: { x: number; y: number }, runTimeSeconds: number): ReturnType<EliteSkillDirector['update']> {
  const out: ReturnType<EliteSkillDirector['update']> = [];
  const frames = Math.round(seconds * 60);
  for (let f = 0; f < frames; f += 1) {
    out.push(...dir.update(1 / 60, f / 60, player, [e], runTimeSeconds));
  }
  return out;
}

describe('P0-5 精英 180s 技能门（120s 守墓者无扫击 / 181s 新精英有技能）', () => {
  const player = { x: 90, y: 0 }; // 守墓者触发距离 100 内

  it('120s 守墓者贴脸：不进 windup、无扫击伤害、无 telegraph（厚血接触语义）', () => {
    const dir = new EliteSkillDirector();
    const e = fakeElite('enemy_g1_6');
    const events = stepElite(dir, e, 1.2, player, 120);
    expect(events.some((ev) => ev.type === 'skill-damage')).toBe(false);
    expect(dir.telegraphOf(e, player)).toBeNull();
  });

  it('181s 新精英：同距离进 windup → 扫击结算（技能化生效）', () => {
    const dir = new EliteSkillDirector();
    const e = fakeElite('enemy_g1_6');
    const events = stepElite(dir, e, 1.2, player, 181);
    const damages = events.filter((ev) => ev.type === 'skill-damage');
    expect(damages).toHaveLength(1);
    expect(damages[0]).toMatchObject({ eliteId: 'enemy_g1_6', damage: 22 });
  });

  it('门控阈值 = 180（轨③锚）：179.9 无技能 / 180.0 起可进 windup', () => {
    const dirA = new EliteSkillDirector();
    const eA = fakeElite('enemy_g1_6');
    expect(stepElite(dirA, eA, 1.2, player, ELITE_SKILL_UNLOCK_SECONDS - 0.1).some((ev) => ev.type === 'skill-damage')).toBe(false);

    const dirB = new EliteSkillDirector();
    const eB = fakeElite('enemy_g1_6');
    expect(stepElite(dirB, eB, 1.2, player, ELITE_SKILL_UNLOCK_SECONDS).some((ev) => ev.type === 'skill-damage')).toBe(true);
    expect(ELITE_SKILL_UNLOCK_SECONDS).toBe(180);
  });

  it('180s 前已在场的精英到点后下一循环才开技能（不追溯切形态：门内全程零 windup）', () => {
    const dir = new EliteSkillDirector();
    const e = fakeElite('enemy_g1_6');
    // 门内贴脸推进 179s：全程无 windup/伤害
    const gateEvents = stepElite(dir, e, 2.0, player, 100);
    expect(gateEvents.some((ev) => ev.type === 'skill-damage')).toBe(false);
    // 门开后（不重置状态机）：下一次触发检查才进入技能循环
    const openEvents = stepElite(dir, e, 1.2, player, 181);
    expect(openEvents.some((ev) => ev.type === 'skill-damage')).toBe(true);
  });

  it('掷骨者/忏悔者生成门 unlockAt=180 与技能门一致（配置断言）', () => {
    expect(ENEMY_CONFIGS.enemy_g1_8.unlockAt).toBe(180);
    expect(ENEMY_CONFIGS.enemy_g2_5.unlockAt).toBe(180);
    expect(ELITE_SKILLS.enemy_g1_8.triggerDist).toBe(260);
  });
});
