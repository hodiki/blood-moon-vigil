import { describe, it, expect } from 'vitest';
import {
  ENEMY_BEHAVIORS,
  ENEMY_CONFIGS,
  type EnemyId,
  type MapId,
} from '@/config/balance';
import {
  specialBehaviorFor,
  passesObstacles,
  auraStacks,
  auraAttackSpeedMultiplier,
  auraAdjustedAttackInterval,
  isWithinAuraDistance,
  isUndead,
  summonShouldFire,
  rangedAttackDue,
  rangedProjectileSpeed,
  rangedDamageFor,
  chargePhaseFor,
  chargeSpeedFor,
  type ChargePhase,
} from '@/enemies/enemy-behaviors';

/**
 * E3-S2~S4 敌人特殊行为·运行时纯函数层（gdd-enemies-v2 §3.1~3.3 / §4.2）。
 * 5 类特殊行为全部数据驱动（balance.ENEMY_BEHAVIORS 为唯一数据源），每地图 ≤2 种且有明确反制。
 * 面板断言见 enemy-config.test（E1-S3）；本文件补「运行时行为」断言（M2-S3 验收门）。
 */

describe('E3-S1 特殊行为表（gdd-enemies-v2 §3.1~3.3 特殊行为列结构化）', () => {
  it('恰好 5 类行为，一类一只，内容 ID 闭合', () => {
    const ids = Object.keys(ENEMY_BEHAVIORS) as EnemyId[];
    expect(ids).toEqual(['enemy_g1_4', 'enemy_g1_5', 'enemy_g2_3', 'enemy_g2_5', 'enemy_g3_4']);
    const kinds = Object.values(ENEMY_BEHAVIORS).map((b) => b.kind).sort();
    expect(kinds).toEqual(['aura', 'charge', 'phase', 'ranged', 'summon']);
  });

  it('亡魂 phase / 尸巫 aura 120px +20% ×3 / 圣杯侍僧 summon 5s cap3 / 忏悔者 ranged 3s 180 / 狼裔猎手 charge 6s 0.5+0.15 500', () => {
    expect(specialBehaviorFor('enemy_g1_4')).toEqual({ kind: 'phase' });
    expect(specialBehaviorFor('enemy_g1_5')).toEqual({ kind: 'aura', radius: 120, attackSpeedBonus: 0.2, maxStacks: 3 });
    expect(specialBehaviorFor('enemy_g2_3')).toEqual({ kind: 'summon', interval: 5, summonedId: 'enemy_g2_1', summonCap: 3 });
    expect(specialBehaviorFor('enemy_g2_5')).toEqual({ kind: 'ranged', interval: 3, projectileSpeed: 180 });
    expect(specialBehaviorFor('enemy_g3_4')).toEqual({ kind: 'charge', interval: 6, windup: 0.5, warning: 0.15, dashSpeed: 500, dashDuration: 0.4 });
  });

  it('普通敌无特殊行为（null）', () => {
    expect(specialBehaviorFor('enemy_g1_1')).toBeNull();
    expect(specialBehaviorFor('enemy_g2_4')).toBeNull(); // 血肉畸体=厚血精英，非行为型
    expect(specialBehaviorFor('enemy_g3_3')).toBeNull(); // 石甲狼=厚血精英
  });

  it('特殊行为敌人每地图 ≤2 种（§①；血蝠 tier=air 不计，行为表同口径）', () => {
    const byMap = new Map<MapId, number>();
    for (const id of Object.keys(ENEMY_BEHAVIORS) as EnemyId[]) {
      const map = ENEMY_CONFIGS[id].map;
      byMap.set(map, (byMap.get(map) ?? 0) + 1);
    }
    expect(byMap.get('map_graveyard')).toBeLessThanOrEqual(2); // 亡魂 + 尸巫
    expect(byMap.get('map_cathedral')).toBeLessThanOrEqual(2); // 圣杯侍僧 + 忏悔者
    expect(byMap.get('map_den')).toBeLessThanOrEqual(2); // 狼裔猎手
  });

  it('特殊行为敌均有明确反制字段（集火/走位/打断，支柱 3 可检验含义③）', () => {
    for (const id of Object.keys(ENEMY_BEHAVIORS) as EnemyId[]) {
      expect(ENEMY_CONFIGS[id].counter && ENEMY_CONFIGS[id].counter.length).toBeGreaterThan(0);
    }
  });
});

describe('E3-S2 相位（亡魂 §3.1；血蝠 tier=air 同语义 §3.2）', () => {
  it('亡魂穿越障碍（passesObstacles=true）', () => {
    expect(passesObstacles('enemy_g1_4')).toBe(true);
  });

  it('血蝠 tier=air：空中=相位障碍无效（行为表无 phase 条目但穿越障碍）', () => {
    expect(specialBehaviorFor('enemy_g2_2')).toBeNull();
    expect(ENEMY_CONFIGS.enemy_g2_2.tier).toBe('air');
    expect(passesObstacles('enemy_g2_2')).toBe(true);
  });

  it('普通敌不穿障碍（玩家侧对称：玩家不可穿障碍，不对称规则 §⑥.6）', () => {
    expect(passesObstacles('enemy_g1_1')).toBe(false);
    expect(passesObstacles('enemy_g3_1')).toBe(false);
  });
});

describe('E3-S2 尸巫光环（120px 内亡者攻速 +20% 叠 3 层）', () => {
  it('叠层 clamp 0~3（auraStacks）', () => {
    expect(auraStacks(0)).toBe(0);
    expect(auraStacks(1)).toBe(1);
    expect(auraStacks(3)).toBe(3);
    expect(auraStacks(5)).toBe(3); // 超过 3 层封顶
  });

  it('攻速倍率：1 + 0.2×stacks（0/1/2/3 层 → 1.0/1.2/1.4/1.6）', () => {
    expect(auraAttackSpeedMultiplier(0)).toBeCloseTo(1.0, 6);
    expect(auraAttackSpeedMultiplier(1)).toBeCloseTo(1.2, 6);
    expect(auraAttackSpeedMultiplier(2)).toBeCloseTo(1.4, 6);
    expect(auraAttackSpeedMultiplier(3)).toBeCloseTo(1.6, 6);
  });

  it('攻速加成 → 攻击间隔缩短（interval/倍率；行尸 1.0s 3 层 → 0.625s）', () => {
    expect(auraAdjustedAttackInterval(1.0, 3)).toBeCloseTo(0.625, 6);
    expect(auraAdjustedAttackInterval(0.8, 2)).toBeCloseTo(0.8 / 1.4, 6);
  });

  it('半径 120px 内生效、外不生效（isWithinAuraDistance）', () => {
    expect(isWithinAuraDistance(0, 0, 100, 0, 120)).toBe(true);
    expect(isWithinAuraDistance(0, 0, 120, 0, 120)).toBe(true); // 边界含
    expect(isWithinAuraDistance(0, 0, 121, 0, 120)).toBe(false);
  });

  it('「亡者」判定 = BLOOD powerTag（墓地/教堂 11 只全为亡者，狼穴 4 只非亡者）', () => {
    for (const id of ['enemy_g1_1', 'enemy_g1_4', 'enemy_g1_6', 'enemy_g2_1', 'enemy_g2_4'] as const) {
      expect(isUndead(id)).toBe(true);
    }
    expect(isUndead('enemy_g3_1')).toBe(false);
    // 光环对象口径：全 BLOOD 敌可被光环加成（§3.1「亡者」）
    const undeadCount = (Object.keys(ENEMY_CONFIGS) as EnemyId[]).filter((id) => isUndead(id)).length;
    expect(undeadCount).toBe(11); // R-C3-RULING 守墓者 BLOOD → 墓地 6 + 教堂 5
  });
});

describe('E3-S3 圣杯侍僧召唤（每 5s 1 血信徒，上限 3）', () => {
  it('达上限（场上 3 只）暂停召唤（summonShouldFire=false）', () => {
    const b = specialBehaviorFor('enemy_g2_3');
    expect(b).not.toBeNull();
    if (!b || b.kind !== 'summon') throw new Error('unreachable');
    expect(summonShouldFire(b, 5.0, 2)).toBe(true);
    expect(summonShouldFire(b, 5.0, 3)).toBe(false); // 达上限暂停
    expect(summonShouldFire(b, 4.9, 0)).toBe(false); // 间隔未到
    expect(summonShouldFire(b, 0, 0)).toBe(false);
  });

  it('召唤目标 = 血信徒（enemy_g2_1），上限 3（数据驱动）', () => {
    const b = specialBehaviorFor('enemy_g2_3');
    if (!b || b.kind !== 'summon') throw new Error('unreachable');
    expect(b.summonedId).toBe('enemy_g2_1');
    expect(b.summonCap).toBe(3);
    expect(ENEMY_CONFIGS.enemy_g2_1.name).toBe('血信徒');
  });
});

describe('E3-S3 忏悔者远程（每 3s 烛火弹 180px/s 8 伤，慢速可躲）', () => {
  it('每 3s 触发一次（rangedAttackDue）', () => {
    const b = specialBehaviorFor('enemy_g2_5');
    if (!b || b.kind !== 'ranged') throw new Error('unreachable');
    expect(rangedAttackDue(b, 2.99)).toBe(false);
    expect(rangedAttackDue(b, 3.0)).toBe(true);
  });

  it('烛火弹慢速 180px/s（§⑥.8 可躲）+ 投射伤害 8（rangedDamage 单列）', () => {
    const b = specialBehaviorFor('enemy_g2_5');
    if (!b || b.kind !== 'ranged') throw new Error('unreachable');
    expect(rangedProjectileSpeed(b)).toBe(180);
    expect(rangedDamageFor('enemy_g2_5')).toBe(8);
  });
});

describe('E3-S4 狼裔猎手冲锋（每 6s：0.5s 蓄力 → 0.15s 警告线 → 500px/s 冲刺）', () => {
  const b = specialBehaviorFor('enemy_g3_4');
  if (!b || b.kind !== 'charge') throw new Error('unreachable');

  it('相位时序：idle(4.95s) → windup(0.5s) → warning(0.15s) → dash(0.4s)，周期 6s', () => {
    const expectPhase = (t: number, phase: ChargePhase): void => {
      expect(chargePhaseFor(b, t)).toBe(phase);
    };
    expectPhase(0, 'idle');
    expectPhase(4.0, 'idle');
    expectPhase(4.94, 'idle');
    expectPhase(4.96, 'windup'); // 4.95 ≤ t < 5.45
    expectPhase(5.0, 'windup');
    expectPhase(5.44, 'windup');
    expectPhase(5.46, 'warning'); // 5.45 ≤ t < 5.60
    expectPhase(5.5, 'warning');
    expectPhase(5.6, 'dash'); // 5.60 ≤ t < 6.00
    expectPhase(5.8, 'dash');
    expectPhase(5.99, 'dash');
  });

  it('冲锋期速度 500px/s，其余相位 0（chargeSpeedFor）', () => {
    expect(chargeSpeedFor(b, 'dash')).toBe(500);
    expect(chargeSpeedFor(b, 'windup')).toBe(0);
    expect(chargeSpeedFor(b, 'warning')).toBe(0);
    expect(chargeSpeedFor(b, 'idle')).toBe(0);
  });

  it('蓄力/警告/冲刺时长与 GDD 一致（0.5 / 0.15 / 500）', () => {
    expect(b.windup).toBe(0.5);
    expect(b.warning).toBe(0.15);
    expect(b.dashSpeed).toBe(500);
    expect(b.interval).toBe(6);
  });
});
