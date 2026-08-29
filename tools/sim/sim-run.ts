/**
 * tools/sim/sim-run.ts —— 整局模拟沙盘 · 单局引擎（B2-W6 接真）
 *
 * 无头整局模拟（vite-node 复用 src 真实模块，模式沿用 tests/bench）：
 * - 敌潮预算走 `spawner.budget(t)`（真实生成器曲线）；
 * - 敌面板走 `ENEMY_CONFIGS`（15 敌配置，按地图敌池抽取）；
 * - 升级需求走 `needXp(level)`（真实 XP 曲线）；
 * - **武器结算走真实层**（B2-W6 接真）：
 *   · 通武占位 = 初始飞弹简化模型（B1 遗留，回归参照）；
 *   · 专武 = exclusive-math 真实结算状态机（8 专武逐帧 step，CC/弹药/质变卡参数全生效）。
 *
 * 骨架边界：敌移动保持 1D 径向模型（弹体飞行即结算近似；精灵/演出 = B6）；
 * 升级 offer 仍为占位序列；Boss 只算面板。指标校准与 5000-run 留后续批次。
 */

import { BOSSES, ENEMY_CONFIGS, MAP_CONFIGS, SPAWNER, WEAPONS, XP, type MapId } from '@/config/balance';
import type { ExclusiveWeaponId } from '@/config/balance';
import { budget } from '@/spawner/spawner';
import { needXp } from '@/xp/xp-manager';
import { enemiesForMap } from '@/enemies/enemy-types';
import { emptyStatusState, type StatusState } from '@/combat/status/status-engine';
import type { CcProfile } from '@/combat/status/status-config';
import { fullAmmo, consumeAmmo, tickReload, type AmmoState } from '@/weapons/ammo';
import type { ExclusiveTarget } from '@/weapons/exclusive/exclusive-math';
import {
  createLanternState, stepLantern,
  createRevolverState, stepRevolver,
  createTwinbladesState, stepTwinblades,
  createLongbowState, stepLongbow,
  createBellState, stepBell,
  createCrossState, stepCross,
  createAxeState, stepAxe,
  createHornState, stepHorn,
} from '@/weapons/exclusive/exclusive-math';
import {
  createResonanceLanternState, stepResonanceLantern,
  createResonanceCrossState, onResonanceCrossExplode, stepResonanceResidues,
} from '@/weapons/resonance/resonance-math';
import { SIM_MOVEMENT_DEFAULTS, treeScenarioDps, type SimMovementParams, type TreeScenario } from './sim-config';

/** 与 PlayScene 桌面同屏上限一致（runtime-config.maxEnemies 桌面档） */
const MAX_ACTIVE_ENEMIES = 400;

/** 单局结构化指标（占位指标集；锚点校准后扩展，eng-impact-assessment §4.3） */
export interface RunMetrics {
  seed: number;
  heroId: string;
  mapId: MapId;
  /** 武器模型：'missile' = 通武占位；'xw_*' = 专武真实结算层 */
  weaponModel: string;
  /** 死亡时点 s；存活到收束（含 Boss）= null */
  deathTimeSeconds: number | null;
  /** 是否击杀 Boss（存活通局） */
  bossKilled: boolean;
  levelReached: number;
  kills: number;
  /** DPS 曲线采样：每 30s 窗口 { t, dps } */
  dpsCurve: Array<{ tSeconds: number; dps: number }>;
  /** 升级 offer 序列（占位：三选一均 FALLBACK_ID；后续批次接 UPGRADE_POOL 加权抽取） */
  levelUpOffers: Array<{ tSeconds: number; level: number; offerIds: string[] }>;
  /** 受击分桶：每 30s 窗口承伤合计 */
  damageTakenBuckets: Array<{ fromSeconds: number; toSeconds: number; damage: number }>;
  /** 首次承伤时点 s（MD-1 首死/首伤判据输入；null = 未被命中） */
  firstHitAtSeconds: number | null;
  /** 走位模型是否启用 */
  movementModel: boolean;
  /** 树工况 */
  treeScenario: TreeScenario;
}

export interface SimOptions {
  seed: number;
  mapId: MapId;
  /** 专武模式（B2-W6 接真）：设置后武器结算走 exclusive-math 真实层；缺省 = 飞弹占位 */
  exclusiveId?: ExclusiveWeaponId;
  /** 局时 s（默认 SPAWNER.BOSS_TIME = 360 收束 + Boss 战到死） */
  maxSeconds?: number;
  /** DPS 采样/受击分桶窗口 s */
  bucketSeconds?: number;
  /** 无敌模式（DPS 平台带口径：隔离承伤/走位变量，专测武器输出效率；dps-baseline 消费） */
  invincible?: boolean;
  /** B4-W4 共鸣形态对照（R-1 环带 / R-6 余焰叠加采样；仅 lantern/cross 支持完整对照） */
  resonance?: boolean;
  /** SIM-W1 生存/走位模型（默认开；false = B1 站桩对照口径） */
  movement?: boolean;
  /** 树工况（GT-7/8 知情矩阵：none/b/bd/bds1；flatDps 锚近似 + s1 窗口乘区） */
  tree?: TreeScenario;
  /** 移动模型参数覆盖（校准批次调参入口；缺省 = SIM_MOVEMENT_DEFAULTS） */
  movementParams?: Partial<SimMovementParams>;
}

const DT = 1 / 60;
const OFFER_SIZE = 3;
/** 升级 offer 占位 ID（UPGRADE_POOL_RULES.FALLBACK_ID 语义；骨架不消费加权抽取） */
const PLACEHOLDER_OFFER_ID = 'up_g_1';

/** mulberry32 种子化 RNG（确定性复跑；5000-run 批量时的种子矩阵基础） */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 简化敌实体（1D 径向模型；携带状态层载荷满足 ExclusiveTarget） */
interface SimEnemy extends ExclusiveTarget {
  kind: string;
  /** 内容 ID（面板追踪/遥测） */
  configId: string;
  /** 接触伤害 */
  damage: number;
  /** 最大生命（ExclusiveTarget.hp 的满值参照） */
  maxHp: number;
  speed: number;
  attackInterval: number;
  /** 距玩家距离 px */
  dist: number;
  xp: number;
  /** 接触攻击计时 s */
  attackTimer: number;
  cc: StatusState;
  ccProfile?: CcProfile;
}

function enemyToTarget(e: SimEnemy): ExclusiveTarget {
  return e;
}

/**
 * 单局模拟。玩家固定原点：
 * - 通武模式：初始飞弹简化射击最近敌（B1 口径，回归参照）；
 * - 专武模式：exclusive-math 真实结算状态机逐帧 step（伤害/击杀/CC/弹药全走真实层）。
 */
export function simulateRun(opts: SimOptions): RunMetrics {
  const map = MAP_CONFIGS[opts.mapId];
  const bucket = opts.bucketSeconds ?? 30;
  const maxSeconds = opts.maxSeconds ?? SPAWNER.BOSS_TIME + 120; // 收束 + Boss 战上限 120s
  const rng = mulberry32(opts.seed);
  const exclusive = opts.exclusiveId ?? null;

  const poolIds = enemiesForMap(opts.mapId);
  const normalIds = poolIds.filter((id) => ENEMY_CONFIGS[id].tier !== 'elite');
  const eliteIds = poolIds.filter((id) => ENEMY_CONFIGS[id].tier === 'elite');
  const spawnEnemyId = (): string => {
    if (eliteIds.length > 0 && rng() < 0.02) return eliteIds[Math.floor(rng() * eliteIds.length)] ?? eliteIds[0]!;
    return normalIds[Math.floor(rng() * normalIds.length)] ?? normalIds[0]!;
  };

  const enemies: SimEnemy[] = [];
  const weapon = WEAPONS.MISSILE;
  let playerHp = 100;
  let t = 0;
  let missileCd = 0;
  const incoming: Array<{ tHit: number; damage: number; target: SimEnemy }> = [];
  let budgetAcc = 0;
  let xpAcc = 0;
  let level = 1;
  let nextNeed = needXp(level);
  let kills = 0;
  let damageDealtWindow = 0;
  let damageTakenWindow = 0;
  let bossSpawned = false;
  let bossKilled = false;

  // —— SIM-W1 生存/走位模型（1D 径向等效：玩家移动 = 敌相对速度修正 drift）——
  const movement = opts.movement !== false; // 默认开
  const mv: SimMovementParams = { ...SIM_MOVEMENT_DEFAULTS, ...opts.movementParams };
  const band = mv.kitingBands[exclusive ?? 'fallback'] ?? mv.kitingBands.fallback!;
  let playerOffset = 0; // 玩家径向位移（后撤累计；0 = 出生位）
  const retreatCap = map.width / 2; // 后撤边界 = 半图（玩家可跑全图半径；1D 最坏情形没有绕回）
  const tree = opts.tree ?? 'none';
  const treeDps = treeScenarioDps(tree, exclusive ?? 'fallback');
  let firstHitAt: number | null = null;

  // —— 专武真实结算状态机（按 id 建状态；rng 注入保证种子确定性）——
  const playerLike = { x: 0, y: 0, hp: playerHp, maxHp: 100 };
  const lantern = createLanternState();
  const revolver = createRevolverState();
  const twinblades = createTwinbladesState();
  const longbow = createLongbowState();
  const bell = createBellState();
  const cross = createCrossState();
  const axe = createAxeState();
  const horn = createHornState();
  const emptyMachine: Readonly<Record<string, number>> = {};
  // B4-W4 共鸣对照状态（R-1 环带 / R-6 余焰）
  const resLantern = createResonanceLanternState();
  const resCross = createResonanceCrossState();
  const R = opts.resonance === true;
  const RES_PAIRS = {
    R1: { touchDamage: 6, touchInterval: 0.4, stunDuration: 0.5, stunIcd: 10, angularSpeedDeg: 240 },
    R6: { residueRadius: 100, residueDps: 8, residueDuration: 3 },
  };

  const dpsCurve: RunMetrics['dpsCurve'] = [];
  const levelUpOffers: RunMetrics['levelUpOffers'] = [];
  const damageTakenBuckets: RunMetrics['damageTakenBuckets'] = [];
  let nextBucketAt = bucket;
  let deathTime: number | null = null;

  const frames = Math.round(maxSeconds / DT);
  for (let f = 0; f < frames; f += 1) {
    t = f * DT;
    playerLike.hp = playerHp;

    // ---- 敌潮生成（真实 budget 曲线）----
    if (t < SPAWNER.BOSS_TIME) {
      budgetAcc += budget(t) * DT;
      while (budgetAcc >= 1 && enemies.length < MAX_ACTIVE_ENEMIES) {
        budgetAcc -= 1;
        const id = spawnEnemyId();
        const cfg = ENEMY_CONFIGS[id as keyof typeof ENEMY_CONFIGS];
        enemies.push({
          kind: cfg.tier === 'elite' ? 'elite' : 'zombie',
          configId: id,
          hp: cfg.hp,
          maxHp: cfg.hp,
          speed: cfg.speed,
          damage: cfg.damage,
          attackInterval: cfg.attackInterval,
          dist: map.spawnRingDesktop[0] + rng() * (map.spawnRingDesktop[1] - map.spawnRingDesktop[0]),
          radius: cfg.radius,
          xp: cfg.xp,
          attackTimer: 0,
          active: true,
          x: 0,
          y: 0,
          cc: emptyStatusState(),
          kill: () => {
            // sim 移除由 hp<=0 扫描完成；math 层 hitEnemy 调用此处保语义闭环
          },
        });
      }
    } else if (!bossSpawned) {
      bossSpawned = true;
      const cfg = BOSSES[map.boss];
      enemies.push({
        kind: 'boss',
        configId: map.boss,
        hp: cfg.hp,
        maxHp: cfg.hp,
        speed: cfg.speed,
        damage: cfg.damage,
        attackInterval: cfg.attackInterval,
        dist: 320,
        radius: cfg.radius,
        xp: cfg.xp,
        attackTimer: 0,
        active: true,
        x: 0,
        y: 0,
        cc: emptyStatusState(),
        ccProfile: { tier: 'boss' }, // Boss 硬控免疫（CC 层 §3.4）
        kill: () => {},
      });
    }

    // ---- 敌移动（1D 径向）+ 位置/CC tick + 接触伤害 ----
    for (const e of enemies) {
      // 状态层 tick（过期清除——B2 起真实 CC 生效于移动/接触）
      if (e.cc.stun || e.cc.slow || e.cc.vulnerable) {
        const expired: string[] = [];
        if (e.cc.stun && t >= e.cc.stun.until) { e.cc.stun = null; expired.push('stun'); }
        if (e.cc.slow && t >= e.cc.slow.until) { e.cc.slow = null; expired.push('slow'); }
        if (e.cc.vulnerable && t >= e.cc.vulnerable.until) { e.cc.vulnerable = null; expired.push('vulnerable'); }
        void expired;
      }
      const stunned = e.cc.stun !== null && t < e.cc.stun.until;
      // SIM-W1 走位 AI（纯确定性规则）：
      // 1) 威胁回避：最近敌 < band.min → 后撤（drift = +playerSpeed）
      // 2) 风筝带维持：最近敌 > band.max → 逼近（drift = -advanceMult×speed，攻击窗口近似）
      // 3) 带内 → 原地环走（drift = 0）
      let drift = 0;
      if (movement && !opts.invincible) {
        const minDist = enemies.reduce((m, x) => (x.dist < m ? x.dist : m), Number.POSITIVE_INFINITY);
        if (minDist < band.min) drift = mv.playerSpeed * mv.retreatSpeedMult; // 绕行等效拉开
        else if (minDist > band.max) drift = -mv.playerSpeed * mv.advanceSpeedMult;
        // 后撤边界：达半图后仍有沿边绕行的残余径向分量（capEdgeDriftMult；1D 无绕回的最坏情形缓解）
        if (drift > 0 && playerOffset >= retreatCap) drift = mv.playerSpeed * mv.capEdgeDriftMult;
        playerOffset = Math.max(0, Math.min(retreatCap, playerOffset + drift * DT));
      } else if (movement && opts.invincible) {
        drift = 0; // DPS 平台带口径：无敌模式隔离走位变量（保持站桩）
      }
      if (!stunned) {
        const slowMult = e.cc.slow !== null && t < e.cc.slow.until ? 1 - e.cc.slow.value : 1;
        // 敌相对接近速度 = 敌速 − 玩家后撤速度（1D 径向等效；逼近时 drift<0 加快接近）
        e.dist = Math.max(0, e.dist - (e.speed * slowMult - drift) * DT);
      }
      e.x = e.dist; // 1D 径向：x = 距离（玩家在原点）
      e.y = 0;
      e.attackTimer -= DT;
      if (e.dist <= e.radius + mv.playerRadius && e.attackTimer <= 0 && !stunned) {
        e.attackTimer = e.attackInterval;
        if (firstHitAt === null) firstHitAt = round2(t);
        if (!opts.invincible) playerHp -= e.damage; // 无敌模式：隔离承伤（输出效率口径）
        damageTakenWindow += e.damage;
      }
    }

    // ---- 武器结算 ----
    const targets = enemies.map(enemyToTarget);
    if (exclusive === null) {
      // 通武占位：飞弹简化模型（B1 口径）
      missileCd -= DT;
      if (missileCd <= 0) {
        missileCd = weapon.COOLDOWN;
        const target = enemies.reduce<SimEnemy | null>((best, e) => (!best || e.dist < best.dist ? e : best), null);
        if (target) {
          if (rng() < 0.9) {
            incoming.push({ tHit: t + target.dist / weapon.SPEED, damage: weapon.DAMAGE, target });
          }
        }
      }
      for (let i = incoming.length - 1; i >= 0; i -= 1) {
        const shot = incoming[i];
        if (!shot) continue;
        if (t >= shot.tHit) {
          incoming.splice(i, 1);
          if (shot.target.hp > 0) {
            const dealt = Math.min(shot.target.hp, shot.damage);
            shot.target.hp -= shot.damage;
            damageDealtWindow += dealt;
            if (shot.target.hp <= 0) {
              kills += 1;
              xpAcc += shot.target.xp;
              const deadTarget = shot.target;
              for (let j = incoming.length - 1; j >= 0; j -= 1) {
                const other = incoming[j];
                if (other?.target === deadTarget) incoming.splice(j, 1);
              }
            }
          }
        }
      }
    } else {
      // 专武真实结算层（B2-W6 接真）：exclusive-math 逐帧 step
      // 击杀 → 经验（onKilled 挂点）
      for (const e of enemies) {
        e.onKilled = (target) => {
          xpAcc += (target as SimEnemy).xp;
        };
      }
      let stepDamage = 0;
      const s1Active = tree === 'bds1' && t <= 30;
      const mul = 1 * (s1Active ? treeDps.s1Mult : 1); // Q-s1 银炉预热窗口（×1.2 独立结算口径）
      const mulberry = rng;
      switch (exclusive) {
        case 'xw_lantern':
          stepDamage = stepLantern(lantern, DT, t, playerLike, targets, mul, emptyMachine).damageDealt;
          if (R) {
            // R-1 环带叠加（沿灯环边缘 90px 巡行；眩晕走状态层 10s ICD）
            stepDamage += stepResonanceLantern(resLantern, DT, t, playerLike, targets, mul, RES_PAIRS.R1!, 90).damageDealt;
          }
          break;
        case 'xw_revolver': {
          const r = stepRevolver(revolver, DT, t, playerLike, targets, mul, emptyMachine, mulberry);
          stepDamage = r.damageDealt;
          break;
        }
        case 'xw_twinblades':
          stepDamage = stepTwinblades(twinblades, DT, t, playerLike, targets, mul, emptyMachine, (h) => { playerHp = Math.min(100, playerHp + h); }).damageDealt;
          break;
        case 'xw_longbow':
          stepDamage = stepLongbow(longbow, DT, t, playerLike, targets, mul, emptyMachine).damageDealt;
          break;
        case 'xw_bell':
          stepDamage = stepBell(bell, DT, t, playerLike, targets, mul, emptyMachine, (h) => { playerHp = Math.min(100, playerHp + h); }).damageDealt;
          break;
        case 'xw_cross':
          stepDamage = stepCross(cross, DT, t, playerLike, targets, mul, emptyMachine, R ? (x, y) => onResonanceCrossExplode(resCross, x, y, t, RES_PAIRS.R6!) : undefined).damageDealt;
          if (R) {
            stepDamage += stepResonanceResidues(resCross, DT, t, targets, mul, RES_PAIRS.R6!).damageDealt;
          }
          break;
        case 'xw_axe':
          stepDamage = stepAxe(axe, DT, t, playerLike, targets, mul, emptyMachine, (c) => { playerHp = Math.max(1, playerHp - c); }, (h) => { playerHp = Math.min(100, playerHp + h); }).damageDealt;
          break;
        case 'xw_horn':
          stepDamage = stepHorn(horn, DT, t, playerLike, targets, mul, emptyMachine).damageDealt;
          break;
      }
      // 树工况通武贡献（b/d：配对通武 + 预选通武锚 DPS——GDD §6.2 锚近似，非结算层）
      damageDealtWindow += stepDamage + treeDps.flatDps * DT * (s1Active ? treeDps.s1Mult : 1);
      // 弹药装弹推进（左轮）
      if (exclusive === 'xw_revolver') tickReload(revolver.ammo as AmmoState, DT);
      // 击杀/经验结算（专武 math 的 kills 由 hp<=0 扫描捕获）
      for (let i = enemies.length - 1; i >= 0; i -= 1) {
        const e = enemies[i]!;
        if (e.hp <= 0) {
          kills += 1;
          xpAcc += e.xp;
          if (e.kind === 'boss') bossKilled = true;
          enemies.splice(i, 1);
        }
      }
      // 左轮无限弹/补弹等 ammo 演进：consumeAmmo 由 stepRevolver 内部消费（这里仅 tickReload）
      void consumeAmmo;
      void fullAmmo;
    }

    // ---- 升级（真实 XP 曲线；offer 占位）----
    while (xpAcc >= nextNeed && level < XP.MAX_LEVEL) {
      xpAcc -= nextNeed;
      level += 1;
      nextNeed = needXp(level);
      levelUpOffers.push({ tSeconds: round2(t), level, offerIds: Array(OFFER_SIZE).fill(PLACEHOLDER_OFFER_ID) });
    }

    // ---- Boss 击杀判定（通武模式路径）----
    if (exclusive === null) {
      for (let i = enemies.length - 1; i >= 0; i -= 1) {
        const e = enemies[i]!;
        if (e.hp <= 0) {
          if (e.kind === 'boss') bossKilled = true;
          enemies.splice(i, 1);
        }
      }
    }

    // ---- 采样/分桶（30s 窗口）----
    if (t >= nextBucketAt) {
      dpsCurve.push({ tSeconds: round2(nextBucketAt), dps: round2(damageDealtWindow / bucket) });
      damageTakenBuckets.push({
        fromSeconds: round2(nextBucketAt - bucket),
        toSeconds: round2(nextBucketAt),
        damage: round2(damageTakenWindow),
      });
      damageDealtWindow = 0;
      damageTakenWindow = 0;
      nextBucketAt += bucket;
    }

    if (playerHp <= 0) {
      deathTime = round2(t);
      break;
    }
    if (bossKilled) break;
  }

  // 收尾未满窗口
  if (damageDealtWindow > 0 || damageTakenWindow > 0) {
    dpsCurve.push({ tSeconds: round2(Math.min(t, nextBucketAt)), dps: round2(damageDealtWindow / bucket) });
    damageTakenBuckets.push({
      fromSeconds: round2(nextBucketAt - bucket),
      toSeconds: round2(t),
      damage: round2(damageTakenWindow),
    });
  }

  return {
    seed: opts.seed,
    heroId: 'hero_edmund',
    mapId: opts.mapId,
    weaponModel: exclusive ?? 'missile',
    deathTimeSeconds: deathTime,
    bossKilled,
    levelReached: level,
    kills,
    dpsCurve,
    levelUpOffers,
    damageTakenBuckets,
    firstHitAtSeconds: firstHitAt,
    movementModel: movement,
    treeScenario: tree,
  };
}

// ============================================================================
// 聚合（N 局汇总；5000-run 批量的输出层占位）
// ============================================================================

export interface SimSummary {
  runs: number;
  seeds: number[];
  maps: MapId[];
  weaponModel: string;
  medianDeathTime: number | null;
  survivalRate: number;
  bossKillRate: number;
  medianLevel: number;
  medianKills: number;
  /** 各 30s 窗口的中位 DPS（跨局聚合；开局 DPS 平台带的雏形） */
  medianDpsByBucket: Array<{ tSeconds: number; medianDps: number }>;
}

/** N 局冒烟/批量入口（run-sim.ts CLI 消费；也可被 vitest 引用做指标断言） */
export function summarizeRuns(runs: readonly RunMetrics[]): SimSummary {
  const median = (arr: number[]): number => {
    if (arr.length === 0) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    const a = s[mid - 1];
    const b = s[mid];
    return s.length % 2 === 1 || a === undefined || b === undefined ? (b ?? a ?? 0) : (a + b) / 2;
  };
  const deaths = runs.map((r) => r.deathTimeSeconds).filter((d): d is number => d !== null);
  const maxBucket = Math.max(0, ...runs.map((r) => r.dpsCurve.length));
  const medianDpsByBucket: SimSummary['medianDpsByBucket'] = [];
  for (let i = 0; i < maxBucket; i += 1) {
    const values = runs.map((r) => r.dpsCurve[i]?.dps).filter((v): v is number => typeof v === 'number');
    const firstRun = runs[0];
    medianDpsByBucket.push({
      tSeconds: firstRun?.dpsCurve[i]?.tSeconds ?? (i + 1) * 30,
      medianDps: round2(median(values)),
    });
  }
  return {
    runs: runs.length,
    seeds: runs.map((r) => r.seed),
    maps: [...new Set(runs.map((r) => r.mapId))],
    weaponModel: runs[0]?.weaponModel ?? 'missile',
    medianDeathTime: deaths.length > 0 ? median(deaths) : null,
    survivalRate: round2(runs.filter((r) => r.deathTimeSeconds === null).length / runs.length),
    bossKillRate: round2(runs.filter((r) => r.bossKilled).length / runs.length),
    medianLevel: median(runs.map((r) => r.levelReached)),
    medianKills: median(runs.map((r) => r.kills)),
    medianDpsByBucket,
  };
}

// ============================================================================
// 内部工具
// ============================================================================

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
