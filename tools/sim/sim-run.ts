/**
 * tools/sim/sim-run.ts —— 整局模拟沙盘 · 单局引擎（B1 骨架，eng-impact-assessment §4.3）
 *
 * 无头整局模拟（vite-node 复用 src 真实模块，模式沿用 m2-feedback-data / tests/bench）：
 * - 敌潮预算走 `spawner.budget(t)`（真实生成器曲线）；
 * - 敌面板走 `ENEMY_CONFIGS`（15 敌配置，按地图敌池抽取）；
 * - 升级需求走 `needXp(level)`（真实 XP 曲线）；
 * - 玩家武器为初始飞弹简化 DPS 模型（骨架占位，B2 换 WeaponBehavior 驱动）。
 *
 * 骨架边界（本批只搭骨架 + 冒烟 N=10）：
 * - 武器行为是**简化命中模型**（单目标 + 命中率），非真实弹道/多武器；
 * - 升级 offer 为**占位序列**（三选一均填 FALLBACK_ID），不消费 UPGRADE_POOL 加权抽取；
 * - Boss 只算面板（BOSSES[map.boss]），不模拟阶段机制。
 * 指标校准与 5000-run 大批量留后续批次（对照 eng-impact-assessment §4.3 的 59 项锚点接入）。
 */

import { BOSSES, ENEMY_CONFIGS, MAP_CONFIGS, SPAWNER, WEAPONS, XP, type MapId } from '@/config/balance';
import { budget } from '@/spawner/spawner';
import { needXp } from '@/xp/xp-manager';
import { enemiesForMap } from '@/enemies/enemy-types';

/** 与 PlayScene 桌面同屏上限一致（runtime-config.maxEnemies 桌面档） */
const MAX_ACTIVE_ENEMIES = 400;

/** 单局结构化指标（占位指标集；锚点校准后扩展，eng-impact-assessment §4.3） */
export interface RunMetrics {
  seed: number;
  heroId: string;
  mapId: MapId;
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
}

export interface SimOptions {
  seed: number;
  mapId: MapId;
  /** 局时 s（默认 SPAWNER.BOSS_TIME = 360 收束 + Boss 战到死） */
  maxSeconds?: number;
  /** DPS 采样/受击分桶窗口 s */
  bucketSeconds?: number;
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

/** 简化敌实体（骨架：1D 径向模型——敌从生成环向玩家原点逼近） */
interface SimEnemy {
  kind: 'normal' | 'boss';
  configId: string;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  attackInterval: number;
  /** 距玩家距离 px */
  dist: number;
  radius: number;
  xp: number;
  /** 接触攻击计时 s */
  attackTimer: number;
}

/**
 * 单局模拟（骨架）。玩家固定原点，初始飞弹自动射击最近敌：
 * - 命中模型：每 COOLDOWN 发 1 弹，飞行命中延迟 = dist / SPEED，乘命中率（wpn_a_1 = 0.9）；
 * - 升级：击杀得 xp → needXp 升级 → 记录占位 offer（不消费效果——骨架不改 DPS）；
 * - 受击：敌进入接触距离按 attackInterval 造伤（玩家 HP 100，死亡即终局）。
 */
export function simulateRun(opts: SimOptions): RunMetrics {
  const map = MAP_CONFIGS[opts.mapId];
  const bucket = opts.bucketSeconds ?? 30;
  const maxSeconds = opts.maxSeconds ?? SPAWNER.BOSS_TIME + 120; // 收束 + Boss 战上限 120s
  const rng = mulberry32(opts.seed);

  const poolIds = enemiesForMap(opts.mapId);
  // 敌池按 XP 权重简化抽取：普通敌均匀，精英低频（骨架口径；真实走 SPAWN_STAGES 保底）
  const normalIds = poolIds.filter((id) => ENEMY_CONFIGS[id].tier !== 'elite');
  const eliteIds = poolIds.filter((id) => ENEMY_CONFIGS[id].tier === 'elite');
  const spawnEnemyId = (): string => {
    if (eliteIds.length > 0 && rng() < 0.02) return eliteIds[Math.floor(rng() * eliteIds.length)] ?? eliteIds[0]!;
    return normalIds[Math.floor(rng() * normalIds.length)] ?? normalIds[0]!;
  };

  const enemies: SimEnemy[] = [];
  const weapon = WEAPONS.MISSILE;
  const hp = 100;
  let playerHp = hp;
  let t = 0;
  let missileCd = 0;
  /** 在飞弹命中队列：{ tHit, damage, targetIndex }——骨架用 hp 扣减时间近似 */
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

  const dpsCurve: RunMetrics['dpsCurve'] = [];
  const levelUpOffers: RunMetrics['levelUpOffers'] = [];
  const damageTakenBuckets: RunMetrics['damageTakenBuckets'] = [];
  let nextBucketAt = bucket;
  let deathTime: number | null = null;

  const frames = Math.round(maxSeconds / DT);
  for (let f = 0; f < frames; f += 1) {
    t = f * DT;

    // ---- 敌潮生成（真实 budget 曲线）----
    if (t < SPAWNER.BOSS_TIME) {
      budgetAcc += budget(t) * DT;
      while (budgetAcc >= 1 && enemies.length < MAX_ACTIVE_ENEMIES) {
        budgetAcc -= 1;
        const id = spawnEnemyId();
        const cfg = ENEMY_CONFIGS[id as keyof typeof ENEMY_CONFIGS];
        enemies.push({
          kind: 'normal',
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
        });
      }
    } else if (!bossSpawned) {
      // Boss 收束：走 MAP_CONFIGS.boss → BOSSES 表面板（骨架不模拟阶段机制）
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
        dist: SPAWNER_BOSS_SPAWN_DISTANCE,
        radius: cfg.radius,
        xp: cfg.xp,
        attackTimer: 0,
      });
    }

    // ---- 敌移动 + 接触伤害（1D 径向）----
    for (const e of enemies) {
      e.dist = Math.max(0, e.dist - e.speed * DT);
      e.attackTimer -= DT;
      if (e.dist <= e.radius + 14 && e.attackTimer <= 0) {
        e.attackTimer = e.attackInterval;
        playerHp -= e.damage;
        damageTakenWindow += e.damage;
      }
    }

    // ---- 武器（简化飞弹模型）----
    missileCd -= DT;
    if (missileCd <= 0) {
      missileCd = weapon.COOLDOWN;
      const target = enemies.reduce<SimEnemy | null>((best, e) => (!best || e.dist < best.dist ? e : best), null);
      if (target) {
        const hitRate = 0.9; // wpn_a_1.hitRate
        if (rng() < hitRate) {
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
            // 清理同目标在飞弹（骨架简化：目标死亡后其余在飞弹落空）
            const deadTarget = shot.target;
            for (let j = incoming.length - 1; j >= 0; j -= 1) {
              const other = incoming[j];
              if (other?.target === deadTarget) incoming.splice(j, 1);
            }
          }
        }
      }
    }

    // ---- 升级（真实 XP 曲线；offer 占位）----
    while (xpAcc >= nextNeed && level < XP.MAX_LEVEL) {
      xpAcc -= nextNeed;
      level += 1;
      nextNeed = needXp(level);
      levelUpOffers.push({ tSeconds: round2(t), level, offerIds: Array(OFFER_SIZE).fill(PLACEHOLDER_OFFER_ID) });
    }

    // ---- 敌死亡回收 + Boss 击杀判定 ----
    for (let i = enemies.length - 1; i >= 0; i -= 1) {
      const e = enemies[i];
      if (e && e.hp <= 0) {
        if (e.kind === 'boss') bossKilled = true;
        enemies.splice(i, 1);
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
    deathTimeSeconds: deathTime,
    bossKilled,
    levelReached: level,
    kills,
    dpsCurve,
    levelUpOffers,
    damageTakenBuckets,
  };
}

// ============================================================================
// 聚合（N 局汇总；5000-run 批量的输出层占位）
// ============================================================================

export interface SimSummary {
  runs: number;
  seeds: number[];
  maps: MapId[];
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

const SPAWNER_BOSS_SPAWN_DISTANCE = 320; // 对齐 BOSS.SPAWN_DISTANCE（骨架内联，避免拉入 Boss 场景依赖）

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
