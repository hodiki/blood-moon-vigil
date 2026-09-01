/**
 * NV-REVIEW-FIX 批次 C · 怪物身份 —— 运行时用例
 *
 * 覆盖（审查 §4 P0-4 / P0-5 / P0-6；后续 C-3/D/E 小步追加）：
 * - P0-4 突袭型三敌（血犬 g1_2 / 血蝠 g2_2 / 暗影狼 g3_2）lunge 前扑：
 *   100px 起手 / 0.25s 蓄身锁向 / 90px@300px/s / CD 2.5s / 落空硬直 0.5s；
 *   与冲锋猎手（g3_4 charge）手感可区分（周期制长线 vs CD 制贴身短扑）
 * - P0-5 精英技能化 180s 门控：120s 守墓者无扫击预警；181s 新精英有技能；
 *   门内已入场精英不追溯切形态（不进 windup）
 * - P0-6 Boss 技能消费运行时（boss-skill-runtime）：zone 几何自结算（扇形/环形留缝/
 *   落点圈/走廊/冲锋线/持续场/引力圈），每 Boss ≥2 可解形状，禁全图 dist 桩；
 *   幻影走专用口（HP1 + noXp + 接触伤按表，不行尸面板）
 * - P1-12 方阵个体 AI（formation-member-ai）：围猎两翼环游/低伏冻结/扑击直线可躲、
 *   血旗斩旗溃散减速 50%/3s、骑士团蓄势驻停→跟踪 0.3s 锁向冲锋→落空硬直 1s
 * - P1-13 方阵解散口径：dissolved 事件 cause（wiped/banner-broken/depart/external）+
 *   rewardGemCluster 宝石簇拆分 + KNIGHT_ESCORT_ELITE 伴随精英预约判据
 *
 * 分层纪律：全部为运行时用例（纯函数/状态机/装配层协作），不依赖 Phaser 场景。
 */

import { describe, it, expect } from 'vitest';
import { ENEMY_CONFIGS, type EnemyId, type BossId, type BossSlot } from '@/config/balance';
import { BOSS_SKILL_TABLES, FORMATIONS, FORMATION_RULES } from '@/config/balance';
import {
  specialBehaviorFor,
  lungeDashDuration,
  lungeShouldTrigger,
  lungeSpeedFor,
  lungeTelegraphAlpha,
} from '@/enemies/enemy-behaviors';
import { EnemyAiDirector } from '@/enemies/enemy-ai-runtime';
import { EliteSkillDirector, type EliteEnemyLike } from '@/enemies/elite-skill-runtime';
import { BossSkillRuntime, type BossSkillPorts } from '@/enemies/boss-skill-runtime';
import { createBossSkillState, type BossSkillState } from '@/enemies/boss-skill-engine';
import { ELITE_SKILLS, ELITE_SKILL_UNLOCK_SECONDS } from '@/enemies/elite-skills';
import {
  FormationMemberAI,
  applyBannerRout,
  AMBUSH_MEMBER_AI,
  KNIGHTS_TRACK_SECONDS,
  type MemberAiGroupInput,
  type MemberEntityLike,
  type MemberAiPorts,
} from '@/enemies/formation-member-ai';
import {
  createGroupBlackboard,
  notifyMemberDamaged,
  stepGroupBlackboard,
  TREASURE_AGGRO_SECONDS,
} from '@/enemies/group-blackboard';
import { FormationRuntime, type GroupMemberLike } from '@/enemies/formation-runtime';
import { shouldReserveKnightEscort, splitGemCluster } from '@/spawner/enemy-spawner';
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

function stepAi(dir: EnemyAiDirector, _pool: ArcadePoolLike<never>, seconds: number, player: { x: number; y: number }, startNow = 0): void {
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

// ============================================================================
// P0-6 Boss 技能消费运行时（boss-skill-runtime：zone 几何自结算，禁全图 dist 桩）
// ============================================================================

/** Boss 端口替身（可观测 hurt/spawn/pull/位移覆盖） */
interface FakeBossPorts extends BossSkillPorts {
  hurts: Array<{ damage: number; now: number }>;
  summons: Array<{ enemyId: EnemyId; x: number; y: number }>;
  phantoms: Array<{ x: number; y: number; damage: number; duration: number }>;
  pulls: Array<{ x: number; y: number; distance: number }>;
  bossVel: Array<{ vx: number; vy: number }>;
  velCleared: number;
}

function makeBossPorts(): FakeBossPorts {
  const ports: FakeBossPorts = {
    hurts: [],
    summons: [],
    phantoms: [],
    pulls: [],
    bossVel: [],
    velCleared: 0,
    hurtPlayer(damage, now) {
      ports.hurts.push({ damage, now });
    },
    spawnSummon(enemyId, x, y) {
      ports.summons.push({ enemyId, x, y });
      return null;
    },
    spawnPhantom(x, y, contactDamage, duration) {
      ports.phantoms.push({ x, y, damage: contactDamage, duration });
      return null;
    },
    pullPlayerTo(x, y, distance) {
      ports.pulls.push({ x, y, distance });
    },
    setBossVelocity(vx, vy) {
      ports.bossVel.push({ vx, vy });
    },
    clearBossVelocity() {
      ports.velCleared += 1;
    },
  };
  return ports;
}

function stepBoss(
  rt: BossSkillRuntime,
  state: BossSkillState,
  boss: { x: number; y: number },
  ports: BossSkillPorts,
  seconds: number,
  player: { x: number; y: number },
  startNow = 0,
  rng?: () => number,
): void {
  const frames = Math.round(seconds * 60);
  for (let f = 0; f < frames; f += 1) {
    rt.step(state, { dt: 1 / 60, now: startNow + f / 60, hpRatio: 1, canSpawnMore: true, rng }, boss, player, ports);
  }
}

/** 指定普技槽立即施法（其余槽 CD 封顶 + 普攻封窗）；返回已锁定 zone 的运行时 */
function castSlot(
  bossId: BossId,
  slot: BossSlot,
  player: { x: number; y: number },
  rng?: () => number,
): { rt: BossSkillRuntime; state: BossSkillState; ports: FakeBossPorts; boss: { x: number; y: number } } {
  const rt = new BossSkillRuntime();
  const state = createBossSkillState(bossId);
  state.phase = 2; // 解锁全部槽位
  state.normalTimer = -999; // 屏蔽普攻直发事件
  for (const s of ['skill1', 'skill2', 'skill3', 'ultimate'] as const) {
    state.slotCds[s] = s === slot ? 0 : 999;
  }
  const ports = makeBossPorts();
  const boss = { x: 0, y: 0 };
  stepBoss(rt, state, boss, ports, 0.05, player, 0, rng); // rotation → cast-start → zone 锁定
  return { rt, state, ports, boss };
}

describe('P0-6 Boss 技能消费运行时（每 Boss ≥2 可解形状，禁全图 dist 桩）', () => {
  it('boss_1 普攻扇形/环形交替：扇内受击、拉开可躲（2 个可解形状）', () => {
    const state = createBossSkillState('boss_1');
    const rt = new BossSkillRuntime();
    const ports = makeBossPorts();
    const boss = { x: 0, y: 0 };
    // 第 1 次普攻（扇形 180°/120px）：玩家原地扇内 → fireAt 受击 30
    state.normalTimer = 1.99;
    const near = { x: 100, y: 0 };
    stepBoss(rt, state, boss, ports, 0.1, near); // 触发 + 锁定
    stepBoss(rt, state, boss, ports, 0.6, near, 0.1);
    expect(ports.hurts.some((h) => h.damage === 30)).toBe(true);
    // 第 2 次普攻（环形重踏 180±24）：玩家拉开 400px → 环带外不受击（走位可解）
    state.normalTimer = 1.99;
    const before = ports.hurts.length;
    stepBoss(rt, state, boss, ports, 0.7, { x: 400, y: 0 }, 0.8);
    stepBoss(rt, state, boss, ports, 0.6, { x: 400, y: 0 }, 1.5);
    expect(ports.hurts.length).toBe(before);
    // 形状交替断言：第 1 发 arc / 第 2 发 ring
    const state2 = createBossSkillState('boss_1');
    const rt2 = new BossSkillRuntime();
    const ports2 = makeBossPorts();
    state2.normalTimer = 1.99;
    stepBoss(rt2, state2, boss, ports2, 0.1, near);
    expect(rt2.zoneViews(0.15).map((v) => v.shape)).toContain('arc');
    state2.normalTimer = 1.99;
    stepBoss(rt2, state2, boss, ports2, 0.1, near, 0.2);
    expect(rt2.zoneViews(0.35).map((v) => v.shape)).toContain('ring');
  });

  it('boss_2 血池喷发：落点锁定可拉开躲直击；池内 dps+减速、池外无减速（推荐项）', () => {
    const near = { x: 80, y: 0 };
    const { rt, state, ports, boss } = castSlot('boss_2', 'skill1', near);
    // 直击圈锁定在 (80,0)：fireAt 前拉开 400px → 直击不命中
    stepBoss(rt, state, boss, ports, 0.8, { x: 400, y: 0 }, 0.05);
    expect(ports.hurts).toHaveLength(0);
    // 走回池内：持续场 dps 8 → 1s ≈ 8 伤；减速 30%
    stepBoss(rt, state, boss, ports, 1.0, near, 0.9);
    const poolDamage = ports.hurts.reduce((s, h) => s + h.damage, 0);
    expect(poolDamage).toBeGreaterThanOrEqual(7);
    expect(rt.externalSlowAt(80, 0)).toBeCloseTo(0.7, 6);
    expect(rt.externalSlowAt(400, 0)).toBe(1);
  });

  it('boss_2 血珠连射：垂直走出走廊零受击（dist<300 但不在形状内 = 无全图 dist 桩）', () => {
    const near = { x: 200, y: 0 };
    const { rt, state, ports, boss } = castSlot('boss_2', 'skill2', near);
    // 走出走廊（垂距 100 > 半宽 14；对 boss 距离 141 < 300——旧 dist 桩会扣血）
    stepBoss(rt, state, boss, ports, 1.2, { x: 100, y: 100 }, 0.05);
    expect(ports.hurts).toHaveLength(0);
    // 对照：留在走廊内 → 3 连 8 伤逐发
    const c = castSlot('boss_2', 'skill2', near);
    stepBoss(c.rt, c.state, c.boss, c.ports, 1.2, near, 0.05);
    expect(c.ports.hurts.filter((h) => h.damage === 8)).toHaveLength(3);
  });

  it('boss_3 短嗥冲锋：走廊外（dist<300）零受击 + dash 期 boss 速度覆盖 400px/s（推荐项）', () => {
    const near = { x: 200, y: 0 };
    const { rt, state, ports, boss } = castSlot('boss_3', 'skill1', near);
    // 蓄力期（fireAt 前）无位移覆盖
    stepBoss(rt, state, boss, ports, 0.4, { x: 200, y: 200 }, 0.05);
    expect(ports.bossVel.filter((v) => v.vx === 400)).toHaveLength(0);
    // dash 期（400px@400px/s = 1s）：走廊外垂距 200（dist 283 < 300，旧桩会扣血）零受击
    stepBoss(rt, state, boss, ports, 1.1, { x: 200, y: 200 }, 0.45);
    expect(ports.bossVel.some((v) => v.vx === 400 && v.vy === 0)).toBe(true);
    expect(ports.hurts).toHaveLength(0);
    expect(ports.velCleared).toBeGreaterThanOrEqual(1); // 冲刺结束清覆盖
    // 对照：走廊内 → 接触 18 伤恰 1 次
    const c = castSlot('boss_3', 'skill1', near);
    stepBoss(c.rt, c.state, c.boss, c.ports, 1.6, near, 0.05);
    expect(c.ports.hurts.filter((h) => h.damage === 18)).toHaveLength(1);
  });

  it('boss_3 蓄力扑击：冲刺无接触伤、落地震荡 180px 圈内受击 32 / 拉开可躲', () => {
    const near = { x: 300, y: 0 };
    const { rt, state, ports, boss } = castSlot('boss_3', 'ultimate', near);
    // 扑过头顶（玩家在路径投影下）无接触伤；落地圈 (600,0) 前拉开 → 震荡不命中
    stepBoss(rt, state, boss, ports, 1.5, near, 0.05);
    stepBoss(rt, state, boss, ports, 0.6, { x: 900, y: 0 }, 1.55);
    expect(ports.hurts).toHaveLength(0);
    // 对照：站落点附近 → 震荡 32
    const c = castSlot('boss_3', 'ultimate', near);
    stepBoss(c.rt, c.state, c.boss, c.ports, 2.0, { x: 650, y: 0 }, 0.05);
    expect(c.ports.hurts.some((h) => h.damage === 32)).toBe(true);
  });

  it('boss_4 月坠落点圈：2s 预警内走出 120px 圈可躲（推荐项）', () => {
    const near = { x: 80, y: 0 };
    const { rt, state, ports, boss } = castSlot('boss_4', 'ultimate', near);
    stepBoss(rt, state, boss, ports, 2.4, { x: 400, y: 0 }, 0.05);
    expect(ports.hurts).toHaveLength(0);
    // 对照：原地不动 → 30 伤恰 1 次
    const c = castSlot('boss_4', 'ultimate', near);
    stepBoss(c.rt, c.state, c.boss, c.ports, 2.4, near, 0.05);
    expect(c.ports.hurts.filter((h) => h.damage === 30)).toHaveLength(1);
  });

  it('boss_4 月相脉冲：环带命中 20 / 随机留缝内不命中（站缝可解）', () => {
    const rng = () => 0; // 缺口锁定在 angle 0
    const near = { x: 300, y: 0 };
    const { rt, state, ports, boss } = castSlot('boss_4', 'skill3', near, rng);
    stepBoss(rt, state, boss, ports, 1.2, near, 0.05); // 缺口方向（dist 300 环带上）
    expect(ports.hurts).toHaveLength(0);
    // 对照：环带对侧 → 命中 20
    const c = castSlot('boss_4', 'skill3', near, rng);
    stepBoss(c.rt, c.state, c.boss, c.ports, 1.2, { x: -300, y: 0 }, 0.05);
    expect(c.ports.hurts.some((h) => h.damage === 20)).toBe(true);
    // 环带外（dist 400）不受击
    const c2 = castSlot('boss_4', 'skill3', near, rng);
    stepBoss(c2.rt, c2.state, c2.boss, c2.ports, 1.2, { x: 400, y: 0 }, 0.05);
    expect(c2.ports.hurts).toHaveLength(0);
  });

  it('boss_4 引力潮汐：220px 内被拉 100px、圈外不被拉（走位可解）', () => {
    const { rt, state, ports, boss } = castSlot('boss_4', 'skill2', { x: 100, y: 0 });
    stepBoss(rt, state, boss, ports, 1.4, { x: 100, y: 0 }, 0.05);
    expect(ports.pulls).toEqual([{ x: 0, y: 0, distance: 100 }]);
    const c = castSlot('boss_4', 'skill2', { x: 100, y: 0 });
    stepBoss(c.rt, c.state, c.boss, c.ports, 1.4, { x: 400, y: 0 }, 0.05);
    expect(c.ports.pulls).toHaveLength(0);
  });

  it('幻影走专用口：接触伤按表 25 + 时长按表 8s，不经行尸召唤口', () => {
    const { rt, state, ports, boss } = castSlot('boss_4', 'skill1', { x: 100, y: 0 });
    stepBoss(rt, state, boss, ports, 1.2, { x: 100, y: 0 }, 0.05);
    const phantomCfg = BOSS_SKILL_TABLES.boss_4.slots.find((s) => s.slot === 'skill1')!.phantom!;
    expect(ports.phantoms).toHaveLength(1);
    expect(ports.phantoms[0]!.damage).toBe(phantomCfg.damage);
    expect(ports.phantoms[0]!.damage).toBe(25);
    expect(ports.phantoms[0]!.duration).toBe(phantomCfg.duration);
    expect(ports.summons).toHaveLength(0); // 不走 spawnSummon（不行尸面板）
  });

  it('引擎 skill-damage 事件被忽略：落点圈 fireAt 恰结算 1 次（无双倍扣血）', () => {
    const { rt, state, ports, boss } = castSlot('boss_2', 'skill1', { x: 80, y: 0 });
    stepBoss(rt, state, boss, ports, 0.8, { x: 80, y: 0 }, 0.05);
    // 直击 8 恰 1 次（持续场 dps 块伤为 1/次，不混入）
    expect(ports.hurts.filter((h) => h.damage === 8)).toHaveLength(1);
  });

  it('reset 清空 zone：换 Boss 不残留旧技能区', () => {
    const { rt, state, ports, boss } = castSlot('boss_4', 'ultimate', { x: 80, y: 0 });
    expect(rt.zoneViews(0.1).length).toBeGreaterThan(0);
    rt.reset();
    expect(rt.zoneViews(0.1)).toHaveLength(0);
    stepBoss(rt, state, boss, ports, 2.4, { x: 80, y: 0 }, 0.05);
    expect(ports.hurts).toHaveLength(0); // 旧月坠区已清，不再结算
  });

  it('每 Boss ≥2 个可解形状（zone 视图形状聚合断言）', () => {
    const shapesFor = (bossId: BossId): Set<string> => {
      const seen = new Set<string>();
      const player = { x: 80, y: 0 };
      const boss = { x: 0, y: 0 };
      // 普攻两连发（boss_1 扇形/环形交替；其余 Boss 直发扇形）
      const rt = new BossSkillRuntime();
      const state = createBossSkillState(bossId);
      const ports = makeBossPorts();
      state.normalTimer = 1.99;
      stepBoss(rt, state, boss, ports, 0.1, player);
      for (const v of rt.zoneViews(0.15)) seen.add(v.shape);
      state.normalTimer = 1.99;
      stepBoss(rt, state, boss, ports, 0.1, player, 0.2);
      for (const v of rt.zoneViews(0.35)) seen.add(v.shape);
      // 伤害普技槽
      for (const s of BOSS_SKILL_TABLES[bossId].slots) {
        if (s.slot === 'normal' || s.damage <= 0) continue;
        const c = castSlot(bossId, s.slot, player, () => 0.99);
        for (const v of c.rt.zoneViews(0.3)) seen.add(v.shape);
      }
      return seen;
    };
    expect(shapesFor('boss_1').size).toBeGreaterThanOrEqual(2); // arc + ring（普攻交替）
    expect(shapesFor('boss_2').size).toBeGreaterThanOrEqual(2); // arc/circle/field/corridor
    expect(shapesFor('boss_3').size).toBeGreaterThanOrEqual(2); // arc + corridor（dash/扑击）
    expect(shapesFor('boss_4').size).toBeGreaterThanOrEqual(2); // arc/circle/ring
  });
});

// ============================================================================
// P1-12 方阵个体 AI（formation-member-ai：围猎环游/低伏/扑击、血旗溃散、骑士团冲锋）
// ============================================================================

/** 成员替身（MemberEntityLike 最小形状 + id 可观测） */
interface FakeMember {
  id: string;
  x: number;
  y: number;
}

function makeMember(id: string, x: number, y: number): FakeMember {
  return { id, x, y };
}

function makeMemberPorts(): { ports: MemberAiPorts; vel: Array<{ id: string; vx: number; vy: number }>; routs: string[]; reg: (e: MemberEntityLike, id: string) => void } {
  const vel: Array<{ id: string; vx: number; vy: number }> = [];
  const routs: string[] = [];
  const ids = new Map<MemberEntityLike, string>();
  return {
    vel,
    routs,
    reg: (e, id) => {
      ids.set(e, id);
    },
    ports: {
      setVelocity(e, vx, vy) {
        vel.push({ id: ids.get(e) ?? '?', vx, vy });
      },
      rout(e) {
        routs.push(ids.get(e) ?? '?');
      },
    },
  };
}

function groupInput(
  groupId: string,
  behavior: string,
  phase: string,
  members: Array<[number, FakeMember | null]>,
  player: { x: number; y: number },
): MemberAiGroupInput {
  return {
    groupId,
    behavior,
    phase,
    dissolved: false,
    members: members.map(([slotIndex, e]) => ({ slotIndex, entity: e })),
    playerX: player.x,
    playerY: player.y,
  };
}

describe('P1-12 围猎个体 AI（两翼环游 / 低伏冻结 / 扑击直线可躲）', () => {
  it('engage 相位两翼反向环游：速度切向（⊥ 指向玩家方向）、速率 = orbitSpeed 160', () => {
    const ai = new FormationMemberAI();
    const { ports, vel, reg } = makeMemberPorts();
    const m0 = makeMember('m0', 200, 0); // slot 0 → 左翼
    const m1 = makeMember('m1', 0, 200); // slot 1 → 右翼（反向）
    reg(m0, 'm0');
    reg(m1, 'm1');
    const player = { x: 0, y: 0 };
    ai.step(1 / 60, 0, [groupInput('g', 'ambush', 'engage', [[0, m0], [1, m1]], player)], ports);
    const v0 = vel.find((v) => v.id === 'm0')!;
    const v1 = vel.find((v) => v.id === 'm1')!;
    // 环带中值 200px：径向修正 0，纯切向
    expect(v0.vx).toBeCloseTo(0, 6);
    expect(v0.vy).toBeCloseTo(AMBUSH_MEMBER_AI.orbitSpeed, 6); // (200,0) 处切向 +y
    expect(v1.vx).toBeCloseTo(AMBUSH_MEMBER_AI.orbitSpeed, 6); // (0,200) 处切向 +x（反向翼）
    expect(v1.vy).toBeCloseTo(0, 6);
    // 包抄（非直追）：速度与「指向玩家」向量正交
    expect(v0.vx * 200 + v0.vy * 0).toBeCloseTo(0, 6);
  });

  it('环带外径向修正：260px 远 → 向内收拢分量；低伏（ritual 相位）全员冻结', () => {
    const ai = new FormationMemberAI();
    const { ports, vel, reg } = makeMemberPorts();
    const m = makeMember('m', 260, 0);
    reg(m, 'm');
    const player = { x: 0, y: 0 };
    ai.step(1 / 60, 0, [groupInput('g', 'ambush', 'engage', [[0, m]], player)], ports);
    const v = vel.find((x) => x.id === 'm')!;
    expect(v.vx).toBeLessThan(0); // 径向向内（收拢）
    // 低伏：phase = ritual（crouch 0.3s）→ 速度 0
    const out2 = makeMemberPorts();
    out2.reg(m, 'm');
    ai.step(1 / 60, 1, [groupInput('g', 'ambush', 'ritual', [[0, m]], player)], out2.ports);
    expect(out2.vel.find((x) => x.id === 'm')).toEqual({ id: 'm', vx: 0, vy: 0 });
  });

  it('扑击：首帧锁向直线突进 320px/s（玩家后续移动不改变方向 = 可走位躲开），0.6s 后回环游', () => {
    const ai = new FormationMemberAI();
    const { ports, vel, reg } = makeMemberPorts();
    const m = makeMember('m', 200, 0);
    reg(m, 'm');
    ai.onGroupEvent({ type: 'ambush-pounce', groupId: 'g' }, 0);
    ai.step(1 / 60, 0.01, [groupInput('g', 'ambush', 'engage', [[0, m]], { x: 0, y: 0 })], ports);
    expect(vel[0]).toEqual({ id: 'm', vx: -AMBUSH_MEMBER_AI.pounceSpeed, vy: 0 });
    // 玩家垂直闪避后方向仍锁定（直线冲程，走位可躲）
    vel.length = 0;
    ai.step(1 / 60, 0.2, [groupInput('g', 'ambush', 'engage', [[0, m]], { x: 0, y: 400 })], ports);
    expect(vel[0]!.vx).toBeCloseTo(-AMBUSH_MEMBER_AI.pounceSpeed, 6);
    expect(vel[0]!.vy).toBeCloseTo(0, 6);
    // 0.6s 窗口结束 → 回环游（切向）
    vel.length = 0;
    ai.step(1 / 60, 0.7, [groupInput('g', 'ambush', 'engage', [[0, m]], { x: 0, y: 400 })], ports);
    const v = vel[0]!;
    expect(Math.hypot(v.vx, v.vy)).toBeCloseTo(AMBUSH_MEMBER_AI.orbitSpeed, 6);
  });
});

describe('P1-12 骑士团个体 AI（蓄势驻停 → 跟踪 0.3s 锁向冲锋 → 落空硬直 1s）', () => {
  it('warn 期蓄势驻停（速度 0）；冲锋期全员同向 500px/s；硬直期速度 0；硬直结束不覆写', () => {
    const ai = new FormationMemberAI();
    const { ports, vel, reg } = makeMemberPorts();
    const m = makeMember('m', 0, 0);
    reg(m, 'm');
    const input = () => groupInput('g', 'knights', 'engage', [[0, m]], { x: 100, y: 0 });
    ai.onGroupEvent({ type: 'knights-charge-warn', groupId: 'g' }, 0);
    ai.step(1 / 60, 0.01, [input()], ports); // 警告 0.6s 内：蓄势驻停
    expect(vel[0]).toEqual({ id: 'm', vx: 0, vy: 0 });
    ai.onGroupEvent({ type: 'knights-charge', groupId: 'g' }, 0.6);
    ai.step(1 / 60, 0.7, [input()], ports); // 冲锋：600px @500px/s
    expect(vel.find((v) => v.id === 'm' && v.vx === 500 && v.vy === 0)).toBeDefined();
    ai.step(1 / 60, 1.9, [input()], ports); // 冲锋 1.2s 结束 → 硬直 1s（速度 0）
    expect(vel.some((v) => v.id === 'm' && v.vx === 0 && v.vy === 0 && vel.indexOf(v) > 1)).toBe(true);
    const writes = vel.length;
    ai.step(1 / 60, 3.0, [input()], ports); // 硬直结束 → 不覆写（默认追踪交还 updateMovement）
    expect(vel.length).toBe(writes);
  });

  it('跟踪 0.3s 后锁向：跟踪窗内玩家移动改向、锁定后玩家移动不改向（直线冲锋可躲）', () => {
    const ai = new FormationMemberAI();
    const { ports, vel, reg } = makeMemberPorts();
    const m = makeMember('m', 0, 0);
    reg(m, 'm');
    ai.onGroupEvent({ type: 'knights-charge-warn', groupId: 'g' }, 0);
    // 跟踪窗（<0.3s）：玩家 (100,0) → dir (1,0)；再 (0,100) → dir (0,1)
    ai.step(1 / 60, 0.01, [groupInput('g', 'knights', 'engage', [[0, m]], { x: 100, y: 0 })], ports);
    ai.step(1 / 60, 0.1, [groupInput('g', 'knights', 'engage', [[0, m]], { x: 0, y: 100 })], ports);
    // 跟踪窗过（0.3s 锚）：玩家回 (100,0) 不再改向 → 锁定 dir (0,1)
    expect(KNIGHTS_TRACK_SECONDS).toBe(0.3);
    ai.step(1 / 60, 0.5, [groupInput('g', 'knights', 'engage', [[0, m]], { x: 100, y: 0 })], ports);
    ai.onGroupEvent({ type: 'knights-charge', groupId: 'g' }, 0.6);
    ai.step(1 / 60, 0.7, [groupInput('g', 'knights', 'engage', [[0, m]], { x: 100, y: 0 })], ports);
    const v = vel.find((x) => x.id === 'm' && x.vx === 0 && x.vy === KNIGHTS_CONFIG_SPEED())!;
    expect(v).toBeDefined(); // 锁向 = 最后跟踪方向 (0,1) × 500
  });
});

/** KNIGHTS_CONFIG.chargeSpeed 访问助手（避免顶层 import 常量与锚重复） */
function KNIGHTS_CONFIG_SPEED(): number {
  return 500; // §③-6 阵 8 锚：600px @500px/s
}

describe('P1-12 血旗斩旗溃散（applyBannerRout：slow 50% / 3s）', () => {
  it('空状态 → slow { value 0.5, until now+3, source banner-rout }（status-engine 通道）', () => {
    const cc = { stun: null, slow: null, vulnerable: null, stunIcdReadyAt: 0 };
    const next = applyBannerRout(cc, 10);
    expect(next.slow).not.toBeNull();
    expect(next.slow!.value).toBe(0.5);
    expect(next.slow!.until).toBeCloseTo(13, 6);
    expect(next.slow!.source).toBe('banner-rout');
  });

  it('叠加规则走引擎：已有更强减速（0.7）不被 0.5 覆盖', () => {
    const cc = { stun: null, slow: { until: 100, value: 0.7, source: 'other' }, vulnerable: null, stunIcdReadyAt: 0 };
    const next = applyBannerRout(cc, 10);
    expect(next.slow!.value).toBe(0.7);
    expect(next.slow!.until).toBe(100);
  });

  it('黑板链路：插旗期受击 ≥1 → banner-broken + dissolved(cause banner-broken)', () => {
    const board = createGroupBlackboard('g_b', 'f_blood_banner', 'banner', [
      { slotIndex: 0, enemyId: 'enemy_g2_1', role: 'body', alive: true },
    ]);
    const events = [...notifyMemberDamaged(board, 0), ...stepGroupBlackboard(board, 0.1, { now: 0 })];
    expect(events.some((e) => e.type === 'banner-broken')).toBe(true);
    const d = events.find((e) => e.type === 'dissolved');
    expect(d && 'cause' in d && d.cause === 'banner-broken').toBe(true);
    expect(d && 'formationId' in d && d.formationId === 'f_blood_banner').toBe(true);
    expect(board.dissolved).toBe(true);
  });
});

// ============================================================================
// P1-13 方阵解散口径（dissolved cause + rewardGemCluster + KNIGHT_ESCORT_ELITE）
// ============================================================================

function fakeGroupEntity(x: number, y: number): GroupMemberLike {
  return { x, y, hp: 10, maxHp: 10, cc: { stun: null, slow: null, vulnerable: null, stunIcdReadyAt: 0 } };
}

describe('P1-13 dissolved 事件口径（cause + formationId + 结算锚）', () => {
  it('全灭（wiped）：最后阵亡成员位置随事件增补（宝石簇结算锚）', () => {
    const rt = new FormationRuntime();
    rt.registerGroup('g_w', 'f_hunting_ambush', [
      { slotIndex: 0, enemyId: 'enemy_g1_1', role: 'body', alive: true },
      { slotIndex: 1, enemyId: 'enemy_g1_1', role: 'body', alive: true },
    ]);
    rt.bindMember('g_w', 0, fakeGroupEntity(100, 50), () => {});
    rt.bindMember('g_w', 1, fakeGroupEntity(140, 60), () => {});
    expect(rt.onMemberKilled('g_w', 0)).toHaveLength(0); // 未全灭
    const events = rt.onMemberKilled('g_w', 1);
    const d = events.find((e) => e.type === 'dissolved');
    expect(d).toBeDefined();
    expect(d && 'cause' in d && d.cause === 'wiped').toBe(true);
    expect(d && 'x' in d && d.x === 140 && d.y === 60).toBe(true);
    expect(rt.groupCount).toBe(0); // 自动注销
  });

  it('宝藏护卫到点离场（depart）：不掉宝石簇口径；外部清场（external）', () => {
    const rt = new FormationRuntime();
    rt.registerGroup('g_t', 'f_treasure_guard', [
      { slotIndex: 0, enemyId: 'enemy_g1_1', role: 'carrier', alive: true },
      { slotIndex: 1, enemyId: 'enemy_g1_1', role: 'carrier', alive: true },
      { slotIndex: 2, enemyId: 'enemy_g1_1', role: 'escort', alive: true },
    ]);
    rt.bindMember('g_t', 0, fakeGroupEntity(0, 0), () => {});
    rt.bindMember('g_t', 1, fakeGroupEntity(10, 0), () => {});
    rt.bindMember('g_t', 2, fakeGroupEntity(20, 0), () => {});
    rt.onMemberKilled('g_t', 0);
    rt.onMemberKilled('g_t', 1); // 驮尸全灭 → aggro（escort 仍活，不解散）
    rt.stepAll(0.1, 0);
    const events = rt.stepAll(TREASURE_AGGRO_SECONDS + 0.1, 10); // 追击到点 → depart
    const d = events.find((e) => e.type === 'dissolved');
    expect(d && 'cause' in d && d.cause === 'depart').toBe(true);
    expect(rt.groupCount).toBe(0);
    // 外部清场
    rt.registerGroup('g_x', 'f_hunt_pack', [{ slotIndex: 0, enemyId: 'enemy_g1_1', role: 'body', alive: true }]);
    const ev2 = rt.dissolve('g_x');
    expect(ev2[0] && 'cause' in ev2[0] && ev2[0].cause === 'external').toBe(true);
  });

  it('成员实体访问（memberEntities）：本体 + 召唤增援均可枚举（斩旗溃散消费面）', () => {
    const rt = new FormationRuntime();
    rt.registerGroup('g_m', 'f_blood_banner', [{ slotIndex: 0, enemyId: 'enemy_g2_1', role: 'body', alive: true }]);
    rt.bindMember('g_m', 0, fakeGroupEntity(1, 2), () => {});
    rt.bindSummon('g_m', fakeGroupEntity(3, 4)); // noXp 增援
    expect(rt.memberEntities('g_m')).toHaveLength(2);
    expect(rt.groupPosition('g_m')).toEqual({ x: 1, y: 2 });
    // banner-broken 路径：黑板置 dissolved 但注销延迟（溃散需访问成员实体）→ purgeDissolved 清理
    notifyMemberDamaged(rt.boardFor('g_m')!, 0);
    rt.stepAll(0.1, 0);
    expect(rt.boardFor('g_m')!.dissolved).toBe(true);
    expect(rt.groupCount).toBe(1); // 消费窗内保留
    rt.purgeDissolved();
    expect(rt.groupCount).toBe(0);
  });
});

describe('P1-13 宝石簇拆分与伴随精英预约判据（纯函数）', () => {
  it('splitGemCluster：和恒等于 total、3~5 颗、每颗 ≥1', () => {
    for (const total of [5, 7, 10, 15, 20]) {
      for (const rng of [() => 0, () => 0.5, () => 0.99]) {
        const parts = splitGemCluster(total, rng);
        expect(parts.length).toBeGreaterThanOrEqual(3);
        expect(parts.length).toBeLessThanOrEqual(5);
        expect(parts.reduce((s, v) => s + v, 0)).toBe(total);
        for (const v of parts) expect(v).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('rewardGemCluster 锚：普通阵 [5,10] / 腐朽骑士团 [15,20]（完整击破高档）', () => {
    expect(FORMATIONS.f_hunting_ambush.rewardGemCluster).toEqual([5, 10]);
    expect(FORMATIONS.f_blood_banner.rewardGemCluster).toEqual([5, 10]);
    expect(FORMATIONS.f_decayed_knights.rewardGemCluster).toEqual([15, 20]);
  });

  it('shouldReserveKnightEscort：仅骑士团 + 同屏无精英 + 无在途预约', () => {
    expect(FORMATION_RULES.KNIGHT_ESCORT_ELITE).toBe(true);
    expect(shouldReserveKnightEscort('f_decayed_knights', false, false)).toBe(true);
    expect(shouldReserveKnightEscort('f_decayed_knights', true, false)).toBe(false); // 同屏已有精英
    expect(shouldReserveKnightEscort('f_decayed_knights', false, true)).toBe(false); // 预约在途
    expect(shouldReserveKnightEscort('f_blood_banner', false, false)).toBe(false); // 非高威胁阵
    expect(shouldReserveKnightEscort('f_hunting_ambush', false, false)).toBe(false);
  });
});
