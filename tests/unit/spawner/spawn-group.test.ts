import { describe, it, expect } from 'vitest';
import {
  FORMATIONS,
  FORMATION_RULES,
  TREASURE_PATH,
  formationBudgetCost,
  type FormationId,
} from '@/config/balance';
import { ENEMY_CONFIGS } from '@/config/balance';
import {
  createGroupSchedulerState,
  nextRollInterval,
  formationTriggerChance,
  isFormationEligible,
  eligibleFormationIds,
  pickFormationId,
  canStartGroup,
  withinBudgetShare,
  groupLandingPositions,
  treasurePathPoints,
  rollGroup,
  stepGroupScheduler,
  accompanyBoostActive,
  boostedWeights,
  reportGroupBudget,
  onBossTimeGroups,
  clearGroupQueues,
  type GroupSchedulerState,
} from '@/spawner/spawn-group';

/** 确定性 rng（mulberry32 同型；测试内独立小实现防跨层耦合） */
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

const CTX = {
  mapId: 'map_graveyard' as const,
  mapWidth: 3000,
  mapHeight: 3000,
  playerX: 1500,
  playerY: 1500,
  ringMin: 600,
  ringMax: 900,
};

describe('方阵 9 阵配置（gdd-enemies-v3 §③-6 / MN-18 a）', () => {
  it('恰好 9 阵；首版 7 启用 + 铁石/献祭 disabled 占位（二批）', () => {
    const ids = Object.keys(FORMATIONS) as FormationId[];
    expect(ids).toHaveLength(9);
    const disabled = ids.filter((id) => !FORMATIONS[id].enabled);
    expect(disabled.sort()).toEqual(['f_iron_stone', 'f_sacrifice']);
  });

  it('逐阵 unlockAt = 轨② 激进锚（追猎 100 教学首入 / 骑士团 240 旗舰）', () => {
    const anchors: Record<FormationId, number> = {
      f_hunt_pack: 100, f_hunting_ambush: 110, f_sacrifice: 120, f_revive_circle: 150,
      f_blood_banner: 160, f_iron_stone: 180, f_chain_ward: 180, f_treasure_guard: 180,
      f_decayed_knights: 240,
    };
    for (const [id, at] of Object.entries(anchors)) {
      expect(FORMATIONS[id as FormationId].unlockAt).toBe(at);
    }
  });

  it('威胁档（F-5）：低=追猎/献祭/围猎；中=苏生/宝藏/血旗/锁链/铁石；高=骑士团', () => {
    expect(FORMATIONS.f_hunt_pack.threat).toBe('low');
    expect(FORMATIONS.f_hunting_ambush.threat).toBe('low');
    expect(FORMATIONS.f_sacrifice.threat).toBe('low');
    expect(FORMATIONS.f_revive_circle.threat).toBe('mid');
    expect(FORMATIONS.f_treasure_guard.threat).toBe('mid');
    expect(FORMATIONS.f_blood_banner.threat).toBe('mid');
    expect(FORMATIONS.f_chain_ward.threat).toBe('mid');
    expect(FORMATIONS.f_iron_stone.threat).toBe('mid');
    expect(FORMATIONS.f_decayed_knights.threat).toBe('high');
  });

  it('成员引用全部存在于 ENEMY_CONFIGS（单一数据源）', () => {
    for (const f of Object.values(FORMATIONS)) {
      for (const m of f.members) expect(ENEMY_CONFIGS[m.enemyId]).toBeTruthy();
    }
  });

  it('骑士团成员 = 腐朽骑士 g1_7 ×3（方阵专属；宝马高威胁技同源）', () => {
    expect(FORMATIONS.f_decayed_knights.members).toEqual([{ enemyId: 'enemy_g1_7', role: 'body', count: 3 }]);
  });

  it('祭品（decoy）为献祭阵本体成员（noXp=false 语义；XP ×3 由 noxp 层结算）', () => {
    const decoy = FORMATIONS.f_sacrifice.members.find((m) => m.role === 'decoy');
    expect(decoy).toEqual({ enemyId: 'enemy_g2_1', role: 'decoy', count: 1 });
  });

  it('逐图适配（主場 1.0 / 副場 0.3 / 禁列 0；锁链狼穴禁列）', () => {
    expect(FORMATIONS.f_hunt_pack.mapWeights).toEqual({ map_graveyard: 1.0, map_cathedral: 0, map_den: 0.3 });
    expect(FORMATIONS.f_chain_ward.mapWeights.map_den).toBe(0); // 无遮蔽战术公平
    expect(FORMATIONS.f_blood_banner.mapWeights.map_cathedral).toBe(1.0);
    expect(FORMATIONS.f_decayed_knights.mapWeights.map_den).toBe(1.0);
  });

  it('阵型站位：骑士团三角 300px / 宝藏护卫横队列 / 默认散布 80~150', () => {
    expect(FORMATIONS.f_decayed_knights.placement).toEqual({ kind: 'wedge', spacing: 300 });
    expect(FORMATIONS.f_treasure_guard.placement).toEqual({ kind: 'line', spacing: 60 });
    expect(FORMATIONS.f_hunt_pack.placement).toEqual({ kind: 'scatter', radiusMin: 80, radiusMax: 150 });
  });

  it('解题奖励宝石簇锚（F-6：普通 5~10 / 骑士团完整击破 15~20）', () => {
    expect(FORMATIONS.f_hunt_pack.rewardGemCluster).toEqual([5, 10]);
    expect(FORMATIONS.f_decayed_knights.rewardGemCluster).toEqual([15, 20]);
  });

  it('成组预算预扣 = 成员面板 XP 等效点数之和（spawner-v2 §③-4）', () => {
    // 追猎阵：尸巫 3 + 血犬 2×2 = 7
    expect(formationBudgetCost(FORMATIONS.f_hunt_pack)).toBe(7);
    // 骑士团：腐朽骑士 10×3 = 30
    expect(formationBudgetCost(FORMATIONS.f_decayed_knights)).toBe(30);
  });
});

describe('掷点节奏与触发概率（F-2 / MN-19 b 激进锚）', () => {
  it('掷点间隔 60~90s（r=0 → 60 / r=1 → 90 端点）', () => {
    expect(FORMATION_RULES.ROLL_INTERVAL).toEqual([60, 90]);
    expect(nextRollInterval(0)).toBeCloseTo(60, 6);
    expect(nextRollInterval(0.9999)).toBeCloseTo(90, 2);
  });

  it('触发概率分段：S1 前段 0 / S1 末段(100~120) 0.3 / S2 0.6 / S3 0.9 / BOSS_TIME 后 0', () => {
    expect(formationTriggerChance(50)).toBe(0);
    expect(formationTriggerChance(100)).toBeCloseTo(0.3, 6);
    expect(formationTriggerChance(119)).toBeCloseTo(0.3, 6);
    expect(formationTriggerChance(150)).toBeCloseTo(0.6, 6);
    expect(formationTriggerChance(300)).toBeCloseTo(0.9, 6);
    expect(formationTriggerChance(360)).toBe(0);
  });

  it('轨② 过滤：unlockAt 前不入池；过滤后池空 → pickFormationId null（§⑥-3 回退语义）', () => {
    expect(eligibleFormationIds(50, 'map_graveyard')).toEqual([]);
    expect(pickFormationId(50, 'map_graveyard', 0.5)).toBeNull();
    expect(isFormationEligible('f_hunt_pack', 99, 'map_graveyard')).toBe(false);
    expect(isFormationEligible('f_hunt_pack', 100, 'map_graveyard')).toBe(true);
  });

  it('禁列表：狼穴不掷锁链/血旗/苏生（战术公平 + 适配表）', () => {
    const pool = eligibleFormationIds(300, 'map_den');
    expect(pool).not.toContain('f_chain_ward');
    expect(pool).not.toContain('f_blood_banner');
    expect(pool).not.toContain('f_revive_circle');
    expect(pool).toContain('f_hunting_ambush');
  });

  it('disabled 阵永不入池（铁石/献祭二批占位）', () => {
    for (const t of [100, 150, 200, 300]) {
      expect(eligibleFormationIds(t, 'map_graveyard')).not.toContain('f_sacrifice');
      expect(eligibleFormationIds(t, 'map_den')).not.toContain('f_iron_stone');
    }
  });
});

describe('同屏与预算约束（F-2 / §③-1 方阵预算预扣）', () => {
  function withActive(state: GroupSchedulerState, threat: 'low' | 'mid' | 'high'): GroupSchedulerState {
    state.active.push({
      groupId: `g${state.nextGroupId++}`,
      formationId: 'f_hunt_pack',
      threat,
      landedAt: 0,
      formation: FORMATIONS.f_hunt_pack,
    });
    return state;
  }

  it('同屏 ≤2：在场+预约计满 2 后拒绝新组', () => {
    const state = withActive(withActive(createGroupSchedulerState(), 'low'), 'mid');
    expect(canStartGroup(state, 'low')).toBe(false);
  });

  it('高档不叠高档：1 高档在场 → 第二高档拒绝；低/中档放行', () => {
    const state = withActive(createGroupSchedulerState(), 'high');
    expect(canStartGroup(state, 'high')).toBe(false);
    expect(canStartGroup(state, 'mid')).toBe(true);
    expect(canStartGroup(state, 'low')).toBe(true);
  });

  it('预扣占比 ≤25%：超限拒绝（budget-share）', () => {
    const state = createGroupSchedulerState();
    reportGroupBudget(state, 100); // 总盘 100 点
    state.budgetSpent = 24;
    expect(withinBudgetShare(state, 1)).toBe(true); // 25/100 = 25% 边界
    expect(withinBudgetShare(state, 2)).toBe(false); // 26 > 25%
  });

  it('rollGroup 预扣：rolled=true 时 cost>0 且 budgetSpent 累加（调用方实扣 budgetAcc）', () => {
    const state = createGroupSchedulerState();
    state.time = 110; // S1 末段窗口
    reportGroupBudget(state, 500);
    const rng = mulberry32(7);
    // 直接调 rollGroup（lastRollAt null = 立即到期）；强制命中：置 chance 检查可见
    let rolled = false;
    for (let i = 0; i < 50 && !rolled; i += 1) {
      const r = rollGroup(state, CTX, rng);
      rolled = r.rolled;
      if (r.rolled) {
        expect(r.cost).toBeGreaterThan(0);
        expect(state.budgetSpent).toBe(r.cost);
        expect(state.runsThisGame).toBe(1);
        expect(r.pending!.remaining).toBeCloseTo(FORMATION_RULES.WARNING_SECONDS, 6);
      }
    }
    expect(rolled).toBe(true);
  });

  it('gate：bossTimeTriggered / boss4OnField → 拒掷（F-2）', () => {
    const s1 = createGroupSchedulerState();
    s1.bossTimeTriggered = true;
    expect(rollGroup(s1, CTX, mulberry32(1)).reason).toBe('gate');
    const s2 = createGroupSchedulerState();
    s2.boss4OnField = true;
    expect(rollGroup(s2, CTX, mulberry32(1)).reason).toBe('gate');
  });

  it('掷点节奏推进：未到期不掷（gate）', () => {
    const state = createGroupSchedulerState();
    state.lastRollAt = 100;
    state.nextInterval = 90;
    state.time = 150; // 未到 190
    expect(rollGroup(state, CTX, mulberry32(1)).rolled).toBe(false);
  });

  it('NV-INTEG-FIX ⑤：首掷对齐 S1 末窗口（<100s 未到期 = gate；不浪费掷点在 chance=0 区间）', () => {
    const state = createGroupSchedulerState();
    state.time = 60; // S1 前段：概率恒 0，不应消费节奏位
    expect(rollGroup(state, CTX, mulberry32(1)).reason).toBe('gate');
    expect(state.lastRollAt).toBeNull();
    state.time = FORMATION_RULES.S1_END_WINDOW_START; // 100s 到期
    const r = rollGroup(state, CTX, mulberry32(1));
    expect(r.reason).not.toBe('gate'); // 到期后必然进入掷点（chance/pool-empty 等为有效掷）
    expect(state.lastRollAt).toBe(FORMATION_RULES.S1_END_WINDOW_START);
  });
});

describe('宝藏护卫特例（spawner-v2 §③-5 / 每局 ≤1）', () => {
  it('宝藏每局 ≤1：首次掷出后 treasureUsed 置位（后续常规掷点不再出宝藏）', () => {
    const state = createGroupSchedulerState();
    state.time = 200; // S2：宝藏 180s 起可掷
    reportGroupBudget(state, 5000);
    const rng = mulberry32(42);
    let treasureRolled = false;
    for (let i = 0; i < 200 && !treasureRolled; i += 1) {
      const r = rollGroup(state, CTX, rng);
      if (r.rolled && r.pending?.formationId === 'f_treasure_guard') {
        treasureRolled = true;
        expect(r.pending.path).not.toBeNull();
        expect(r.pending.path!.speed).toBe(TREASURE_PATH.SPEED);
      }
    }
    expect(treasureRolled).toBe(true);
    expect(state.treasureUsed).toBe(true);
  });

  it('横穿路径：入口/出口对边（直线横穿）；默认入口距玩家 ≥600px', () => {
    const { entry, exit } = treasurePathPoints(3000, 3000, 1500, 1500, mulberry32(3));
    expect(entry.x !== exit.x).toBe(true); // 左右对边
    // 玩家居中 → 入口取更远端且距离 ≥600
    const d = Math.hypot(entry.x - 1500, entry.y - 1500);
    expect(d).toBeGreaterThanOrEqual(TREASURE_PATH.MIN_PLAYER_DISTANCE);
  });
});

describe('分帧落地与组生命周期（§③-4 生成方式 / §⑥-1 容错）', () => {
  function rollPendingGroup(seed = 7): { state: GroupSchedulerState; groupId: string } {
    const state = createGroupSchedulerState();
    state.time = 110;
    reportGroupBudget(state, 10000);
    const rng = mulberry32(seed);
    for (let i = 0; i < 100; i += 1) {
      const r = rollGroup(state, CTX, rng);
      if (r.rolled && r.pending) return { state, groupId: r.pending.groupId };
    }
    throw new Error('测试前置失败：无法掷出组');
  }

  it('2.5s 阵纹预警期内不落地（预警 = 反制依赖不可删）', () => {
    const { state, groupId } = rollPendingGroup();
    const events = stepGroupScheduler(state, 1.0, true);
    expect(events.lands).toEqual([]);
    expect(state.pending.find((g) => g.groupId === groupId)).toBeTruthy();
  });

  it('分帧 ≤5 只/帧（骑士团 3 体 1 帧落完；追猎 3 体同帧；大阵跨帧）', () => {
    // 苏生阵 3 体：预警过后 1 帧全落地
    const seedState = createGroupSchedulerState();
    seedState.time = 160; // 苏生 unlockAt 150
    reportGroupBudget(seedState, 10000);
    const rng = mulberry32(11);
    for (let i = 0; i < 300; i += 1) {
      const r = rollGroup(seedState, CTX, rng);
      if (r.rolled && r.pending?.formationId === 'f_revive_circle') break;
    }
    stepGroupScheduler(seedState, 1.0, true); // 预警期内（不落地）
    const events = stepGroupScheduler(seedState, 1.6, true); // 过预警 → 3 体 1 帧落完
    expect(events.lands.length).toBe(3); // 3 体 ≤5/帧
    expect(seedState.pending).toHaveLength(0);
    expect(seedState.active).toHaveLength(1);
  });

  it('isGroupStart 每组恰一次（组落地沿 = 伴随窗口/黑板创建挂点）', () => {
    const seedState = createGroupSchedulerState();
    seedState.time = 110;
    reportGroupBudget(seedState, 10000);
    const rng = mulberry32(13);
    for (let i = 0; i < 300; i += 1) {
      rollGroup(seedState, CTX, rng);
      stepGroupScheduler(seedState, 0.01, true);
      if (seedState.active.length > 0) break;
    }
    stepGroupScheduler(seedState, 0.01, true); // 后续帧不再产生组落地沿
    const starts = stepGroupScheduler(seedState, 0.01, true).lands.filter((l) => l.isGroupStart);
    expect(starts).toHaveLength(0);
  });

  it('maxEnemies 节流：canSpawn=false 帧不落地且组不丢（预算已预扣）', () => {
    const { state, groupId } = rollPendingGroup();
    stepGroupScheduler(state, 3.0, false); // 过预警但节流
    const g = state.pending.find((p) => p.groupId === groupId);
    expect(g).toBeTruthy(); // 组保留
    expect(g!.members.every((m) => !m.landed)).toBe(true);
    // 恢复后照常落地
    const events = stepGroupScheduler(state, 1 / 60, true);
    expect(events.lands.length).toBeGreaterThan(0);
  });

  it('BOSS_TIME 清预约（§⑥-4）：pending 全丢、active 清空；玩家死亡清队列（§⑥-2）', () => {
    const a = rollPendingGroup();
    onBossTimeGroups(a.state);
    expect(a.state.pending).toHaveLength(0);
    expect(a.state.bossTimeTriggered).toBe(true);
    const b = rollPendingGroup();
    clearGroupQueues(b.state);
    expect(b.state.pending).toHaveLength(0);
    expect(b.state.bossTimeTriggered).toBe(false);
  });
});

describe('伴随生成（F-1：普通权重瞬时 +20%，持续 10s 锚）', () => {
  it('伴随窗口：组落地 10s 内 active、超窗关闭', () => {
    const state = createGroupSchedulerState();
    state.active.push({
      groupId: 'g1', formationId: 'f_hunt_pack', threat: 'low',
      landedAt: 100, formation: FORMATIONS.f_hunt_pack,
    });
    state.time = 105;
    expect(accompanyBoostActive(state)).toBe(true);
    state.time = 110.5;
    expect(accompanyBoostActive(state)).toBe(false);
  });

  it('伴随权重：zombie +0.2、wolf/tank 等比削减、权重和保持 1.00', () => {
    const base = { zombie: 0.9, wolf: 0.095, tank: 0.005 };
    const boosted = boostedWeights(base, true);
    expect(boosted.zombie).toBeCloseTo(1.1, 6);
    expect(boosted.wolf + boosted.tank).toBeCloseTo(0.095 + 0.005 - 0.2 + 0.2 - 0.2, 4);
    // 精确口径：wolf/tank 按 (rest - 0.2)/rest 等比缩
    const rest = base.wolf + base.tank;
    const scale = (rest - 0.2) / rest;
    expect(boosted.wolf).toBeCloseTo(base.wolf * scale, 6);
    expect(boosted.tank).toBeCloseTo(base.tank * scale, 6);
    expect(boosted.zombie + boosted.wolf + boosted.tank).toBeCloseTo(1, 4);
  });

  it('无伴随 → 权重原样返回', () => {
    const base = { zombie: 0.8, wolf: 0.17, tank: 0.03 };
    expect(boostedWeights(base, false)).toEqual(base);
  });
});

describe('阵型站位落点（§③-4 落地分布）', () => {
  it('散布：落点全部落在 [radiusMin, radiusMax] 半径环带内', () => {
    const positions = groupLandingPositions(FORMATIONS.f_hunt_pack, 1000, 1000, 0, mulberry32(5));
    expect(positions).toHaveLength(3);
    for (const p of positions) {
      const d = Math.hypot(p.x - 1000, p.y - 1000);
      expect(d).toBeGreaterThanOrEqual(80);
      expect(d).toBeLessThanOrEqual(150);
    }
  });

  it('三角编队：3 骑士 = 顶点 + 两翼（间距 300px）', () => {
    const positions = groupLandingPositions(FORMATIONS.f_decayed_knights, 0, 0, 0, mulberry32(6));
    expect(positions).toHaveLength(3);
    // 顶点 @ (150,0)，两翼 @ (0,±150)
    expect(positions[0]!.x).toBeCloseTo(150, 6);
    const wing1 = positions[1]!;
    const wing2 = positions[2]!;
    expect(Math.hypot(wing1.x, wing1.y)).toBeCloseTo(150, 6);
    expect(Math.hypot(wing2.x, wing2.y)).toBeCloseTo(150, 6);
    expect(wing1.y).toBeCloseTo(-wing2.y, 6);
  });

  it('横队列：9 体沿行进方向法线排开，间距 60px（宝藏护卫）', () => {
    const positions = groupLandingPositions(FORMATIONS.f_treasure_guard, 0, 0, 0, mulberry32(8));
    expect(positions).toHaveLength(9);
    // 行进方向 = +x → 队列沿 y 轴排开，x 恒 0
    for (const p of positions) expect(p.x).toBeCloseTo(0, 6);
    const ys = positions.map((p) => p.y).sort((a, b) => a - b);
    expect(ys[1]! - ys[0]!).toBeCloseTo(60, 6); // 相邻间距
  });
});
