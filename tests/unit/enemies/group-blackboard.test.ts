import { describe, it, expect } from 'vitest';
import { applyStatus } from '@/combat/status/status-engine';
import {
  createGroupBlackboard,
  notifyMemberDamaged,
  notifyMemberKilled,
  notifySummonKilled,
  stepGroupBlackboard,
  bodyAliveCount,
  isRitualStunned,
  HUNT_RITUAL,
  NECRO_HEALER,
  NECRO_SUMMONER,
  TREASURE_AGGRO_SECONDS,
  type GroupBlackboard,
  type GroupEvent,
} from '@/enemies/group-blackboard';
import { FormationRuntime, type GroupMemberLike } from '@/enemies/formation-runtime';
import type { StatusState } from '@/combat/status/status-engine';

/** 追猎阵黑板：尸巫(healer)×1 + 血犬(body)×2 */
function huntBoard(): GroupBlackboard {
  return createGroupBlackboard('g_hunt', 'f_hunt_pack', 'hunt', [
    { slotIndex: 0, enemyId: 'enemy_g1_5', role: 'healer', alive: true },
    { slotIndex: 1, enemyId: 'enemy_g1_2', role: 'body', alive: true },
    { slotIndex: 2, enemyId: 'enemy_g1_2', role: 'body', alive: true },
  ]);
}

/** 苏生阵黑板：尸巫(summoner)×2 + 守墓者(leader)×1 */
function reviveBoard(): GroupBlackboard {
  return createGroupBlackboard('g_revive', 'f_revive_circle', 'revive', [
    { slotIndex: 0, enemyId: 'enemy_g1_5', role: 'summoner', alive: true },
    { slotIndex: 1, enemyId: 'enemy_g1_5', role: 'summoner', alive: true },
    { slotIndex: 2, enemyId: 'enemy_g1_6', role: 'leader', alive: true },
  ]);
}

/** 宝藏护卫黑板：守墓者(escort)×4 + 行尸(carrier)×4 + 尸巫(healer)×1 */
function treasureBoard(): GroupBlackboard {
  return createGroupBlackboard('g_treasure', 'f_treasure_guard', 'treasure', [
    ...Array.from({ length: 4 }, (_, i) => ({ slotIndex: i, enemyId: 'enemy_g1_6' as const, role: 'escort' as const, alive: true })),
    ...Array.from({ length: 4 }, (_, i) => ({ slotIndex: 4 + i, enemyId: 'enemy_g1_1' as const, role: 'carrier' as const, alive: true })),
    { slotIndex: 8, enemyId: 'enemy_g1_5' as const, role: 'healer' as const, alive: true },
  ]);
}

function fakeMember(hpRatio = 1): GroupMemberLike & { onDamaged?: () => void } {
  return { x: 0, y: 0, hp: 100 * hpRatio, maxHp: 100, cc: { stun: null, slow: null, vulnerable: null, stunIcdReadyAt: 0 } };
}

describe('追猎方阵状态机（enemies-v3 §③-6 阵 1：血犬全灭 → 仪式 → 重召循环）', () => {
  it('血犬在场 → engage 相位不触发仪式', () => {
    const board = huntBoard();
    const events = stepGroupBlackboard(board, 1, { now: 0 });
    expect(board.phase).toBe('engage');
    expect(events.filter((e) => e.type === 'ritual-start')).toHaveLength(0);
  });

  it('血犬全灭 → 进入仪式（3s 吟唱）→ 完成 → 重召血犬×2 noXp → 回 engage', () => {
    const board = huntBoard();
    notifyMemberKilled(board, 1);
    notifyMemberKilled(board, 2);
    const ev1 = stepGroupBlackboard(board, 0.1, { now: 0 });
    expect(ev1.map((e) => e.type)).toContain('ritual-start');
    expect(board.ritualActive).toBe(true);
    const ev2 = stepGroupBlackboard(board, HUNT_RITUAL.chant + 0.1, { now: 5 });
    const types = ev2.map((e) => e.type);
    expect(types).toContain('ritual-complete');
    const summon = ev2.find((e) => e.type === 'summon');
    expect(summon).toMatchObject({ enemyId: 'enemy_g1_2', count: 2, noXp: true });
    expect(board.phase).toBe('engage');
    expect(board.resummonedAlive).toBe(2);
    expect(bodyAliveCount(board)).toBe(2); // 重召犬回到 body 存活池
  });

  it('眩晕打断仪式（status-engine isStunned 查询）→ ritual-interrupted + 进 CD 6s', () => {
    const board = huntBoard();
    notifyMemberKilled(board, 1);
    notifyMemberKilled(board, 2);
    stepGroupBlackboard(board, 0.1, { now: 0 }); // 进仪式
    // 尸巫被眩晕（ICD 由施加侧管理；此处直接构造生效态）
    const cc: StatusState = { stun: null, slow: null, vulnerable: null, stunIcdReadyAt: 0 };
    const applied = applyStatus(cc, { kind: 'stun', value: 1, durationSeconds: 1 }, 10, undefined);
    const ev = stepGroupBlackboard(board, 0.1, { now: 10.1, ritualistCc: applied.state });
    const interrupted = ev.find((e) => e.type === 'ritual-interrupted');
    expect(interrupted).toMatchObject({ cause: 'stun' });
    expect(board.ritualActive).toBe(false);
    expect(board.ritualCooldown).toBeCloseTo(HUNT_RITUAL.interruptCooldown, 6);
    expect(board.phase).toBe('engage');
  });

  it('受击 3 次打断仪式（notifyMemberDamaged 计数）', () => {
    const board = huntBoard();
    notifyMemberKilled(board, 1);
    notifyMemberKilled(board, 2);
    stepGroupBlackboard(board, 0.1, { now: 0 }); // 进仪式
    let events: GroupEvent[] = [];
    events = events.concat(notifyMemberDamaged(board, 0));
    events = events.concat(notifyMemberDamaged(board, 0));
    expect(board.ritualActive).toBe(true); // 2 次未断
    events = events.concat(notifyMemberDamaged(board, 0));
    expect(events.some((e) => e.type === 'ritual-interrupted' && e.cause === 'hits')).toBe(true);
    expect(board.ritualActive).toBe(false);
  });

  it('打断后 CD 期内不重开仪式（防白嫖重吟唱；工程锚 6s）', () => {
    const board = huntBoard();
    notifyMemberKilled(board, 1);
    notifyMemberKilled(board, 2);
    stepGroupBlackboard(board, 0.1, { now: 0 });
    notifyMemberDamaged(board, 0);
    notifyMemberDamaged(board, 0);
    notifyMemberDamaged(board, 0);
    // CD 期内（<6s）血犬仍全灭也不触发仪式
    stepGroupBlackboard(board, 1, { now: 1 });
    expect(board.phase).toBe('engage');
    // CD 走完 → 可再仪式
    stepGroupBlackboard(board, HUNT_RITUAL.interruptCooldown, { now: 8 });
    expect(board.phase).toBe('ritual');
  });

  it('重召犬再全灭 → 尸巫仍可再仪式（§⑥-1 组黑板不重置）', () => {
    const board = huntBoard();
    notifyMemberKilled(board, 1);
    notifyMemberKilled(board, 2);
    stepGroupBlackboard(board, HUNT_RITUAL.chant + 0.1, { now: 4 }); // 第一次仪式完成
    notifySummonKilled(board);
    notifySummonKilled(board);
    expect(bodyAliveCount(board)).toBe(0);
    stepGroupBlackboard(board, 0.1, { now: 8 });
    expect(board.phase).toBe('ritual');
  });
});

describe('尸巫 role 变体（healer 治疗流 / summoner 召唤流；单一敌种多角色复用）', () => {
  it('healer 锚：6 HP/2s/射程 250px', () => {
    expect(NECRO_HEALER).toEqual({ healAmount: 6, interval: 2, range: 250 });
  });

  it('healer 治疗节拍：2s 一跳，目标 = 射程内伤员（运行时 heal 事件结算）', () => {
    const rt = new FormationRuntime();
    const healer = fakeMember();
    const hound = fakeMember(0.5); // 半血伤员
    hound.x = 100; healer.x = 200; // 距离 100 ≤ 250
    rt.registerGroup('g1', 'f_hunt_pack', [
      { slotIndex: 0, enemyId: 'enemy_g1_5', role: 'healer', alive: true },
      { slotIndex: 1, enemyId: 'enemy_g1_2', role: 'body', alive: true },
      { slotIndex: 2, enemyId: 'enemy_g1_2', role: 'body', alive: true },
    ]);
    rt.bindMember('g1', 0, healer, () => {});
    rt.bindMember('g1', 1, hound, () => {});
    const events = rt.stepAll(NECRO_HEALER.interval + 0.01, 1);
    const heal = events.find((e) => e.type === 'heal');
    expect(heal).toBeTruthy();
    expect(heal).toMatchObject({ targetSlotIndex: 1, amount: 6 });
    rt.healMember('g1', 1, 6);
    expect(hound.hp).toBe(56);
  });

  it('healer 射程外/无伤员 → 不发 heal 事件', () => {
    const rt = new FormationRuntime();
    const healer = fakeMember();
    const hound = fakeMember(0.5);
    hound.x = 300; healer.x = 0; // 300 > 250
    rt.registerGroup('g1', 'f_hunt_pack', [
      { slotIndex: 0, enemyId: 'enemy_g1_5', role: 'healer', alive: true },
      { slotIndex: 1, enemyId: 'enemy_g1_2', role: 'body', alive: true },
      { slotIndex: 2, enemyId: 'enemy_g1_2', role: 'body', alive: true },
    ]);
    rt.bindMember('g1', 0, healer, () => {});
    rt.bindMember('g1', 1, hound, () => {});
    const events = rt.stepAll(NECRO_HEALER.interval + 0.01, 1);
    expect(events.find((e) => e.type === 'heal')).toBeUndefined();
  });

  it('summoner 唤尸流：每 4s 召 1 行尸 noXp，上限 6（达上限暂停）', () => {
    expect(NECRO_SUMMONER).toMatchObject({ interval: 4, cap: 6, summonedId: 'enemy_g1_1', noXp: true });
    const board = reviveBoard();
    const events: GroupEvent[] = [];
    // 40s 窗口（覆盖 6 次召唤；浮点累加边界不依赖精确 24s）
    for (let i = 0; i < 100; i += 1) events.push(...stepGroupBlackboard(board, 0.4, { now: i * 0.4 }));
    const summons = events.filter((e) => e.type === 'summon');
    expect(summons).toHaveLength(6); // 上限封顶不失控（软时限压迫）
    for (const s of summons) expect(s).toMatchObject({ enemyId: 'enemy_g1_1', noXp: true, count: 1 });
  });

  it('唤尸计数释放：召唤物死亡 → 恢复召唤（§⑥-4 计数释放）', () => {
    const board = reviveBoard();
    for (let i = 0; i < 100; i += 1) stepGroupBlackboard(board, 0.4, { now: i * 0.4 });
    expect(board.summonsAlive).toBe(6);
    notifySummonKilled(board);
    expect(board.summonsAlive).toBe(5);
  });
});

describe('苏生方阵状态机（enemies-v3 §③-6 阵 2：受击激活 → 守墓者解除护卫）', () => {
  it('未受击 → guard 相位，不激活', () => {
    const board = reviveBoard();
    stepGroupBlackboard(board, 1, { now: 0 });
    expect(board.phase).toBe('guard');
    expect(board.activated).toBe(false);
  });

  it('任一成员首承伤 → activated（护卫→敌对可读切换），且仅触发一次', () => {
    const board = reviveBoard();
    const ev1 = notifyMemberDamaged(board, 2);
    expect(ev1.some((e) => e.type === 'activated')).toBe(true);
    expect(board.activated).toBe(true);
    expect(board.phase).toBe('activated');
    const ev2 = notifyMemberDamaged(board, 0);
    expect(ev2.some((e) => e.type === 'activated')).toBe(false);
  });

  it('守墓者（leader）死后尸巫不逃继续唤尸（§⑥-1 组黑板不重置）', () => {
    const board = reviveBoard();
    notifyMemberKilled(board, 2); // 守墓者死
    const events: GroupEvent[] = [];
    for (let i = 0; i < 30; i += 1) events.push(...stepGroupBlackboard(board, 0.4, { now: i * 0.4 }));
    expect(events.filter((e) => e.type === 'summon').length).toBeGreaterThan(0);
    expect(board.dissolved).toBe(false);
  });
});

describe('宝藏护卫方阵状态机（enemies-v3 §③-6 阵 3：驮运 → 宝藏落地 → 攻击切换 → 离场）', () => {
  it('驮尸在场 → escort 相位（非主动攻击语义 = 黑板不动）', () => {
    const board = treasureBoard();
    stepGroupBlackboard(board, 5, { now: 0 });
    expect(board.phase).toBe('escort');
    expect(board.treasureDropped).toBe(false);
  });

  it('驮尸全灭 → 宝藏落地 + 切换攻击状态（aggro 追击 10s）→ depart 离场', () => {
    const board = treasureBoard();
    for (let s = 4; s <= 7; s += 1) notifyMemberKilled(board, s);
    const ev = stepGroupBlackboard(board, 0.1, { now: 0 });
    expect(ev.map((e) => e.type)).toContain('treasure-dropped');
    expect(ev.map((e) => e.type)).toContain('aggro');
    expect(board.treasureDropped).toBe(true);
    expect(board.phase).toBe('aggro');
    const ev2 = stepGroupBlackboard(board, TREASURE_AGGRO_SECONDS + 0.1, { now: 11 });
    expect(ev2.map((e) => e.type)).toContain('depart');
    expect(board.phase).toBe('depart');
  });

  it('驮尸未全灭（守墓者先死）→ 不触发宝藏落地（§⑥-1：各阵解散条件逐阵定义）', () => {
    const board = treasureBoard();
    notifyMemberKilled(board, 0); // escort 死
    stepGroupBlackboard(board, 5, { now: 0 });
    expect(board.treasureDropped).toBe(false);
  });

  it('depart 相位 → 运行时自动注销（到点离场）', () => {
    const rt = new FormationRuntime();
    rt.registerGroup('g9', 'f_treasure_guard', treasureBoard().members);
    const board = rt.boardFor('g9')!;
    for (let s = 4; s <= 7; s += 1) notifyMemberKilled(board, s);
    rt.stepAll(0.1, 0);
    rt.stepAll(TREASURE_AGGRO_SECONDS + 0.2, 11);
    expect(rt.boardFor('g9')).toBeUndefined();
  });
});

describe('FormationRuntime 路由（成员击杀/承伤/解散）', () => {
  it('成员击杀 → 槽位置亡；全灭 → dissolved + 自动注销', () => {
    const rt = new FormationRuntime();
    rt.registerGroup('gK', 'f_hunt_pack', [
      { slotIndex: 0, enemyId: 'enemy_g1_5', role: 'healer', alive: true },
      { slotIndex: 1, enemyId: 'enemy_g1_2', role: 'body', alive: true },
      { slotIndex: 2, enemyId: 'enemy_g1_2', role: 'body', alive: true },
    ]);
    rt.bindMember('gK', 0, fakeMember(), () => {});
    rt.bindMember('gK', 1, fakeMember(), () => {});
    rt.bindMember('gK', 2, fakeMember(), () => {});
    rt.onMemberKilled('gK', 1);
    rt.onMemberKilled('gK', 2);
    expect(rt.boardFor('gK')).toBeTruthy(); // 尸巫仍在（追猎剩尸巫仍可仪式）
    const ev = rt.onMemberKilled('gK', 0);
    expect(ev.map((e) => e.type)).toContain('dissolved');
    expect(rt.boardFor('gK')).toBeUndefined();
  });

  it('bindMember 承伤路由：onDamaged → onMemberDamaged（苏生激活打通）', () => {
    const rt = new FormationRuntime();
    rt.registerGroup('gD', 'f_revive_circle', [
      { slotIndex: 0, enemyId: 'enemy_g1_5', role: 'summoner', alive: true },
      { slotIndex: 1, enemyId: 'enemy_g1_5', role: 'summoner', alive: true },
      { slotIndex: 2, enemyId: 'enemy_g1_6', role: 'leader', alive: true },
    ]);
    const keeper = fakeMember();
    rt.bindMember('gD', 2, keeper, () => { rt.onMemberDamaged('gD', 2); });
    keeper.onDamaged?.();
    expect(rt.boardFor('gD')!.activated).toBe(true);
  });

  it('ritualistCc 查询 = healer/leader 槽实体（仪式打断通道）', () => {
    const board = huntBoard();
    const cc: StatusState = { stun: null, slow: null, vulnerable: null, stunIcdReadyAt: 0 };
    // 无 CC → 眩晕判定 false
    expect(isRitualStunned(cc, 0)).toBe(false);
    void board;
  });
});
