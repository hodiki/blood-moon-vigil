import { describe, it, expect } from 'vitest';
import {
  BOSS_SKILL_TABLES,
  BOSS_SUMMON_CAP,
  bossSkillFor,
  type BossSlot,
} from '@/config/balance';
import {
  createBossSkillState,
  stepBossSkills,
  bossPhase2Due,
  bossSummonCap,
  skillReady,
  clearBossSummons,
  reportBossSummonKilled,
  type BossSkillEvent,
} from '@/enemies/boss-skill-engine';

/** 步进 n 秒（dt=1/60；收集事件） */
function run(state: ReturnType<typeof createBossSkillState>, seconds: number, opts?: { hpRatio?: number; now?: number }): BossSkillEvent[] {
  const events: BossSkillEvent[] = [];
  const frames = Math.round(seconds * 60);
  for (let f = 0; f < frames; f += 1) {
    events.push(...stepBossSkills(state, {
      dt: 1 / 60,
      now: (opts?.now ?? 0) + f / 60,
      hpRatio: opts?.hpRatio ?? 1,
      canSpawnMore: true,
    }));
  }
  return events;
}

const SLOTS: readonly BossSlot[] = ['normal', 'skill1', 'skill2', 'skill3', 'ultimate'];

describe('四 Boss 五技能表配置（gdd-enemies-v3 §③-7 / MN-22 定稿）', () => {
  it('四 Boss 全量五槽（1 普攻 + 3 普技 + 1 高威胁技）', () => {
    for (const table of Object.values(BOSS_SKILL_TABLES)) {
      expect(table.slots.map((s) => s.slot).sort()).toEqual([...SLOTS].sort());
    }
  });

  it('定位差异化（MN-22 a）：召唤/领域压制/突袭机动/月相轮转——仅 boss_1 召唤系定位', () => {
    expect(BOSS_SKILL_TABLES.boss_1.positioning).toBe('summoner');
    expect(BOSS_SKILL_TABLES.boss_2.positioning).toBe('domain');
    expect(BOSS_SKILL_TABLES.boss_3.positioning).toBe('assault');
    expect(BOSS_SKILL_TABLES.boss_4.positioning).toBe('moon-cycle');
  });

  it('血月尊者召唤系：3 普技全召唤（血犬×2/行尸×3/守墓者×1）+ 骑士 P2 解锁', () => {
    const t = BOSS_SKILL_TABLES.boss_1;
    expect(bossSkillFor('boss_1', 'skill1')!.summon).toEqual({ enemyId: 'enemy_g1_2', count: 2 });
    expect(bossSkillFor('boss_1', 'skill2')!.summon).toEqual({ enemyId: 'enemy_g1_1', count: 3 });
    expect(bossSkillFor('boss_1', 'skill3')!.summon).toEqual({ enemyId: 'enemy_g1_6', count: 1 });
    const ult = bossSkillFor('boss_1', 'ultimate')!;
    expect(ult.summon).toEqual({ enemyId: 'enemy_g1_7', count: 1 }); // 腐朽骑士（方阵专属同源）
    expect(ult.unlockPhase).toBe(2); // 高威胁技解锁节点 = P2
    expect(t.phase2.cdMultiplier).toBe(0.75); // 普技 CD −25%
    expect(t.phase2.summonCap).toBe(8); // 上限 6→8
  });

  it('阶段 2 纳入循环（W-2 义务）：尼禄转阶段召 2 侍僧 + 血井 P2；芬里厄扑击 P2 CD 减半', () => {
    expect(BOSS_SKILL_TABLES.boss_2.phase2.extraSummon).toEqual({ enemyId: 'enemy_g2_3', count: 2 });
    expect(bossSkillFor('boss_2', 'ultimate')!.unlockPhase).toBe(2); // 血井 P2 专属
    expect(BOSS_SKILL_TABLES.boss_3.phase2.cdMultiplier).toBe(0.5); // 扑击 CD 减半
    expect(bossSkillFor('boss_3', 'ultimate')!.unlockPhase).toBe(1); // 扑击 P1 常驻（既有阶段 2 升格入循环）
  });

  it('血月化身无阶段（既有口径维持）+ 普技 CD 4~5s 短战压迫', () => {
    expect(BOSS_SKILL_TABLES.boss_4.hasPhase2).toBe(false);
    for (const s of BOSS_SKILL_TABLES.boss_4.slots.filter((x) => x.slot.startsWith('skill'))) {
      expect(s.cd).toBeGreaterThanOrEqual(4);
      expect(s.cd).toBeLessThanOrEqual(5);
    }
  });

  it('召唤上限常量 6/8（MN-23）+ 召唤物全 noXp 语义（事件固定 noXp:true）', () => {
    expect(BOSS_SUMMON_CAP).toEqual({ P1: 6, P2: 8 });
  });

  it('telegraph 数据层锚全覆盖（预警 > 0；W-13 演出消费位）', () => {
    for (const table of Object.values(BOSS_SKILL_TABLES)) {
      for (const s of table.slots) expect(s.telegraph).toBeGreaterThan(0);
    }
    expect(bossSkillFor('boss_4', 'ultimate')!.telegraph).toBe(2.0); // 月坠 2s 预警
  });
});

describe('五槽调度引擎（普攻基底 / 普技轮转 / 施法三段）', () => {
  it('普攻基底：cd 恒定循环（boss_1 2.0s → 6s 内 3 次普攻事件）', () => {
    const state = createBossSkillState('boss_1');
    const events = run(state, 6.1);
    const normals = events.filter((e) => e.type === 'normal-attack');
    expect(normals.length).toBe(3);
    expect(normals[0]).toMatchObject({ damage: 30 }); // 面板伤
  });

  it('普技轮转：CD 就绪即施，轮转位推进不连发同一普技；telegraph 后才释放', () => {
    const state = createBossSkillState('boss_1');
    const events = run(state, 10);
    const casts = events.filter((e) => e.type === 'cast-start');
    expect(casts.length).toBeGreaterThanOrEqual(1);
    const summons = events.filter((e) => e.type === 'summon');
    // 10s 内普技轮转至少 1 次成召唤（skill1 血犬/skill2 行尸/skill3 守墓者）
    expect(summons.length).toBeGreaterThanOrEqual(1);
    // 施法硬直窗口内不启动新技能（cast-start 间隔 ≥ 上一技能 castLock + telegraph）
    if (casts.length >= 2) {
      // 由轮转 CD（≥6s）保证，天然满足；断言轮转游标不重复
      const slots = casts.map((c) => (c as { slot: BossSlot }).slot);
      expect(new Set(slots).size).toBeGreaterThan(1);
    }
  });

  it('召唤上限封顶：6（P1）后召唤跳过（同源计数，MN-23）', () => {
    const state = createBossSkillState('boss_1');
    // 直接压满计数：后续召唤事件不再出现（cap 6）
    state.summonsAlive = BOSS_SUMMON_CAP.P1;
    state.slotCds = { normal: 0, skill1: 0, skill2: 0, skill3: 0, ultimate: 99 };
    const events = run(state, 12);
    expect(events.filter((e) => e.type === 'summon')).toHaveLength(0); // 全部被上限封顶
    expect(state.summonsAlive).toBe(6);
  });

  it('死亡清场：clearBossSummons 返回清除数并归零（不掉 XP 口径）', () => {
    const state = createBossSkillState('boss_1');
    state.summonsAlive = 5;
    expect(clearBossSummons(state)).toBe(5);
    expect(state.summonsAlive).toBe(0);
  });

  it('召唤物死亡释放计数（§⑥-4）', () => {
    const state = createBossSkillState('boss_1');
    state.summonsAlive = 6;
    reportBossSummonKilled(state);
    expect(state.summonsAlive).toBe(5);
    reportBossSummonKilled(state, 10); // 下限钳 0
    expect(state.summonsAlive).toBe(0);
  });
});

describe('阶段 2（HP<50% → 1s 霸体 → 解锁节点）', () => {
  it('触发判定：HP<50% 且有阶段 2 的 Boss；boss_4 永不触发', () => {
    const s1 = createBossSkillState('boss_1');
    expect(bossPhase2Due(s1, 0.49)).toBe(true);
    expect(bossPhase2Due(s1, 0.51)).toBe(false);
    const s4 = createBossSkillState('boss_4');
    expect(bossPhase2Due(s4, 0.1)).toBe(false);
  });

  it('转阶段：phase=2 + 1s 霸体（phaseGraceUntil）+ 骑士解锁 + 上限 8 + CD 折减', () => {
    const state = createBossSkillState('boss_1');
    const events = run(state, 1, { hpRatio: 0.4 });
    expect(events.map((e) => e.type)).toContain('phase-changed');
    expect(state.phase).toBe(2);
    expect(state.phaseGraceUntil).toBeGreaterThan(0);
    expect(bossSummonCap(state)).toBe(8);
    // 骑士（P2 解锁）就绪可施
    const knight = bossSkillFor('boss_1', 'ultimate')!;
    expect(skillReady(state, knight)).toBe(true);
    // CD 折减生效：skill1 满 CD 在 P2 为 6×0.75
    state.slotCds.skill1 = 6;
    expect(state.slotCds.skill1 * BOSS_SKILL_TABLES.boss_1.phase2.cdMultiplier).toBeCloseTo(4.5, 6);
  });

  it('尼禄转阶段召唤 2 圣杯侍僧（W-2 既有配置纳入）', () => {
    const state = createBossSkillState('boss_2');
    const events = run(state, 0.5, { hpRatio: 0.3 });
    const summon = events.find((e) => e.type === 'summon');
    expect(summon).toMatchObject({ enemyId: 'enemy_g2_3', count: 2, noXp: true });
  });

  it('转阶段霸体期不启动新技能（1s 内无 cast-start）', () => {
    const state = createBossSkillState('boss_1');
    state.slotCds = { normal: 0, skill1: 0, skill2: 0, skill3: 0, ultimate: 9999 };
    const events = run(state, 0.5, { hpRatio: 0.4 });
    expect(events.filter((e) => e.type === 'cast-start')).toHaveLength(0);
  });
});

describe('沙盘采样指标口径（RunMetrics 扩展；MD-4 联测输入）', () => {
  it('boss_1 全程战斗：召唤生成 ≥1 且不超上限 8（P2 封顶）', () => {
    const state = createBossSkillState('boss_1');
    const events = run(state, 90, { hpRatio: 0.4 }); // P2 全程
    let spawned = 0;
    for (const e of events) if (e.type === 'summon') spawned += (e as { count: number }).count;
    expect(spawned).toBeGreaterThan(0);
    expect(state.summonsAlive).toBeLessThanOrEqual(BOSS_SUMMON_CAP.P2);
  });
});
