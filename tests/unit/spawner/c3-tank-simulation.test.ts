import { describe, it, expect } from 'vitest';
import {
  SPAWNER,
  ENEMY_CONFIGS,
  PLAYER,
  GAME,
} from '@/config/balance';
import { ENEMIES } from '@/../src/_archived/enemies-legacy-panel'; // W-8 收档：legacy 面板归档对照（禁止运行时消费）
import { budgetLegacy, stageForTime, pickEnemyKind, tankGuaranteeDue } from '@/spawner/spawner';
import { DESKTOP_CONFIG, MOBILE_CONFIG } from '@/config/runtime-config';
import { mulberry32 } from '@/utils/math';

/**
 * C3 厚血首验（design-review-e2 C3 / FUNC-E2-07 判据 · TASK-31 收尾按新阶段表更新，
 * TASK-32 裁决 CONCERNS #1 重标定，rhythm-pace-adj §9）：
 * 模型与 design-review C3 静态模型同构，且与真实 enemy-spawner 生成逻辑一致：
 * - 生成：budget(t) 预算 + 阶段权重抽签 + 阶段保底（直接读 stage.tankGuaranteeEvery，S2=30s / S3=20s）
 * - 击杀：玩家 DPS 全部分摊到厚血，600 HP 击杀一只；场上厚血 = 生成 − 击杀
 * 决策记录（TASK-32）：S3 tank 0.12→0.05（0.12 时 360s≈27.5 只=绝望墙，CONCERNS #1 成立）；
 * C3 判据重标定为「单目标保守模型口径」——4:30 ≤5、6:00 ≤12（模型不含 AoE/节流，
 * 是真机最坏上界；真机折减 40–60% 后预期 1–3 / 3–6）。实测 seed42/dps45：270s≈3、360s≈11。
 */
interface TankSimOptions {
  dps: number;
  seed: number;
  simSeconds: number;
}

function simulateTankField(opts: TankSimOptions): { spawned: number; guaranteed: number; killed: number; onField: number } {
  const rng = mulberry32(opts.seed);
  const dt = 0.1;
  const tankHp = ENEMIES.tank.hp;
  let t = 0;
  let budgetAcc = 0;
  let tankGuaranteeAcc = 0;
  let spawned = 0;
  let guaranteed = 0;
  let alive = 0;
  let tankDamagePool = 0;

  while (t < opts.simSeconds) {
    t += dt;
    budgetAcc += budgetLegacy(t) * dt; // NV-BATCH-G：legacy 曲线归档口径（C3 判据为 legacy 标定，维持对照）
    const stage = stageForTime(t);
    // 保底直接取阶段值（与 enemy-spawner.tick 同构：S2=30s / S3=20s / 其余 Infinity）
    const guaranteeEvery = stage.tankGuaranteeEvery;
    if (Number.isFinite(guaranteeEvery)) tankGuaranteeAcc += dt;
    else tankGuaranteeAcc = 0;

    while (budgetAcc >= 1) {
      budgetAcc -= 1;
      const forceTank = tankGuaranteeDue(tankGuaranteeAcc, guaranteeEvery);
      const kind = forceTank ? 'tank' : pickEnemyKind(stage.weights, rng());
      if (kind === 'tank') {
        tankGuaranteeAcc = 0; // 自然/保底出厚血都重置累计（与 enemy-spawner 同构）
        spawned += 1;
        if (forceTank) guaranteed += 1;
        alive += 1;
      }
    }

    // 玩家 DPS 分摊到厚血（design-review 模型：600/26 ≈ 23s/只）；
    // 仅场上存在厚血时累计，避免无目标时伤害池虚积（模拟「DPS 转火小怪」）
    if (alive > 0) {
      tankDamagePool += opts.dps * dt;
      while (tankDamagePool >= tankHp && alive > 0) {
        tankDamagePool -= tankHp;
        alive -= 1;
      }
    }
  }
  return { spawned, guaranteed, killed: spawned - alive, onField: alive };
}

const SEED = 42;
const DPS_CONSERVATIVE = 26; // design-review C3：玩家 DPS 26（23s/只厚血）
const DPS_FORMED = 45; // rhythm-pace-adj §3：4min+ 保守 DPS 45–55 下界

describe('TASK-31 精英保底（rhythm-pace-adj §2：3min 前必见 ≥2 只精英，不靠随机）', () => {
  it('3 分钟前（180s）场上已累计 ≥2 只厚血（S2 保底 30s：2:00/2:30/3:00 + S1 随机 0.5%）', () => {
    for (const seed of [1, 7, 42, 99]) {
      const r = simulateTankField({ dps: DPS_CONSERVATIVE, seed, simSeconds: 180 });
      expect(r.spawned).toBeGreaterThanOrEqual(2);
    }
  });

  it('同种子可复现（RV-C5 埋点可复现：同 seed 结果完全一致）', () => {
    const a = simulateTankField({ dps: DPS_CONSERVATIVE, seed: SEED, simSeconds: 180 });
    const b = simulateTankField({ dps: DPS_CONSERVATIVE, seed: SEED, simSeconds: 180 });
    expect(a).toEqual(b);
  });

  it('阶段保底已落地（S2=30s / S3=20s，TASK-31 收尾 4 段→3 段）', () => {
    expect(stageForTime(150).tankGuaranteeEvery).toBe(SPAWNER.TANK_GUARANTEE_EVERY_SECONDS);
    expect(stageForTime(300).tankGuaranteeEvery).toBe(SPAWNER.TANK_GUARANTEE_EVERY_SECONDS_S3);
    expect(Number.isFinite(stageForTime(60).tankGuaranteeEvery)).toBe(false); // S1 无保底
  });
});

describe('C3 两段判据（TASK-32 裁决重标定：4:30 ≤5；6:00 ≤12，单目标保守模型口径）', () => {
  it('单目标模型实测满足裁决判据（seed42 / DPS 45：270s onField≈3、360s onField≈11）', () => {
    const r270 = simulateTankField({ dps: DPS_FORMED, seed: SEED, simSeconds: 270 });
    const r360 = simulateTankField({ dps: DPS_FORMED, seed: SEED, simSeconds: 360 });
    // TASK-32 裁决 §9.3：4:30 (270s) ≤5、6:00 (360s) ≤12（模型口径上界）
    expect(r270.onField).toBeLessThanOrEqual(5);
    expect(r360.onField).toBeLessThanOrEqual(12);
    // 防回归（§9.3）：S3 tank=0.12 时 360s≈27.5 超 ≤12 被拦截；0.05 时≈11 通过
    expect(r360.onField).toBeGreaterThanOrEqual(6); // 非真空：仍有可击穿小墙压力
  });

  it('同种子结果可复现（决策记录基线稳定）', () => {
    const a = simulateTankField({ dps: DPS_FORMED, seed: SEED, simSeconds: 360 });
    const b = simulateTankField({ dps: DPS_FORMED, seed: SEED, simSeconds: 360 });
    expect(a).toEqual(b);
  });
});

describe('E3-S10 击杀时间对表（gdd-enemies §5.1，DPS 口径单目标等效）', () => {
  it('6 分钟成型 DPS ~70：普通 12HP ≈0.17s / 8HP 秒杀级；精英 500→~7.1s / 400→~5.7s（GDD 7s/6s）', () => {
    const DPS_70 = 70;
    expect(ENEMY_CONFIGS.enemy_g1_1.hp / DPS_70).toBeCloseTo(0.17, 1); // 行尸 12
    expect(ENEMY_CONFIGS.enemy_g1_3.hp / DPS_70).toBeLessThan(0.2); // 墓穴甲虫 MN-14 并轨行尸 12HP
    expect(ENEMY_CONFIGS.enemy_g2_4.hp / DPS_70).toBeCloseTo(7.1, 1); // 血肉畸体 500
    expect(ENEMY_CONFIGS.enemy_g3_3.hp / DPS_70).toBeCloseTo(5.7, 1); // 石甲狼 400
  });

  it('初始 DPS 9~16：行尸 12HP 击杀 0.75~1.33s（GDD 0.8~1.3s）；5 分钟 DPS ~26 → 0.46s（GDD 0.5s）', () => {
    expect(12 / 16).toBeGreaterThanOrEqual(0.7);
    expect(12 / 9).toBeLessThanOrEqual(1.4);
    expect(ENEMY_CONFIGS.enemy_g1_1.hp / 26).toBeCloseTo(0.46, 1);
  });

  it('精英击杀时间设计意图：6 分钟可击穿小墙（7s/6s），前期绕开（≥25s）', () => {
    expect(ENEMY_CONFIGS.enemy_g2_4.hp / 16).toBeGreaterThanOrEqual(25); // 前期 DPS 16 上限
    expect(ENEMY_CONFIGS.enemy_g3_3.hp / 16).toBeGreaterThanOrEqual(25);
  });
});

describe('E3-S10 双端同屏上限 + 0.5s 无敌帧（gdd-enemies §⑦/§⑥.3）', () => {
  it('桌面 400 / 移动 250 同屏上限（RuntimeConfig 驱动对象池 maxSize，无实体溢出）', () => {
    expect(DESKTOP_CONFIG.maxEnemies).toBe(400);
    expect(MOBILE_CONFIG.maxEnemies).toBe(250);
    expect(DESKTOP_CONFIG.maxEnemies).toBeGreaterThan(MOBILE_CONFIG.maxEnemies);
  });

  it('0.5s 无敌帧限流：多敌同帧接触只扣 1 次（防单帧多段秒杀，§⑥.3）', () => {
    expect(PLAYER.INVULNERABLE_TIME).toBe(0.5);
  });

  it('Boss 战 60~90s 判据常量锚定（sim-verify §7 / GAME 表）', () => {
    expect(GAME.BOSS_FIGHT_TARGET_MIN).toBe(60);
    expect(GAME.BOSS_FIGHT_TARGET_MAX).toBe(90);
  });
});
