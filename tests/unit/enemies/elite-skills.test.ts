import { describe, it, expect } from 'vitest';
import { applyStatus } from '@/combat/status/status-engine';
import {
  ELITE_SKILLS,
  eliteInterruptible,
  interruptCd,
  stoneWolfArmorSplit,
  stoneWolfBroken,
  stoneWolfCostumeFrame,
  STONE_WOLF_FRAME,
  STONE_WOLF_BROKEN_FRAME,
  STONE_WOLF_STONE_PHASE,
  STONE_WOLF_BROKEN_PHASE,
} from '@/enemies/elite-skills';
import {
  EliteSkillDirector,
  type EliteEnemyLike,
} from '@/enemies/elite-skill-runtime';
import {
  AMBUSH_CONFIG,
  BANNER_CONFIG,
  KNIGHTS_CONFIG,
  createGroupBlackboard,
  notifyMemberDamaged,
  stepGroupBlackboard,
  type GroupEvent,
} from '@/enemies/group-blackboard';

function fakeElite(enemyId: 'enemy_g1_6' | 'enemy_g2_4' | 'enemy_g1_8' | 'enemy_g2_5' | 'enemy_g3_3', x = 0, y = 0): EliteEnemyLike {
  return {
    x, y, hp: 350, maxHp: 350, enemyId,
    cc: { stun: null, slow: null, vulnerable: null, stunIcdReadyAt: 0 },
    speed: 40, baseAttackInterval: 1.8, attackInterval: 1.8,
  };
}

const player = { x: 90, y: 0 }; // 守墓者触发距离 100 内

function step(dir: EliteSkillDirector, e: EliteEnemyLike, seconds: number, p = player): GroupEventLike[] {
  const out: GroupEventLike[] = [];
  const frames = Math.round(seconds * 60);
  for (let f = 0; f < frames; f += 1) out.push(...dir.update(1 / 60, f / 60, p, [e]));
  return out;
}
type GroupEventLike = ReturnType<EliteSkillDirector['update']>[number];

describe('W-16 五精英技能参数（gdd-enemies-v3 §③-4 锚）', () => {
  it('守墓者 180° 扫：100px 触发 / 0.9s 蓄力 / 130px / 22 伤 / 0.6s 硬直 / CD 4s', () => {
    expect(ELITE_SKILLS.enemy_g1_6).toMatchObject({
      triggerDist: 100, windup: 0.9, recover: 0.6, cd: 4, damage: 22, range: 130, shape: 'arc',
    });
  });

  it('血肉畸体锁定冲刺：150px / 0.5s / 0.67s 冲刺 / 1.2s 冲过头硬直 / 20 伤 / CD 4.5s', () => {
    expect(ELITE_SKILLS.enemy_g2_4).toMatchObject({
      triggerDist: 150, windup: 0.5, activeDur: 0.67, recover: 1.2, cd: 4.5, damage: 20, shape: 'dash-line',
    });
  });

  it('掷骨者读圈：驻停 1.0s + 预警圈 0.8s / 18 伤 / CD 4s；忏悔者：0.4s / 8 伤 / CD 3.5s', () => {
    expect(ELITE_SKILLS.enemy_g1_8).toMatchObject({ windup: 1.0, telegraph: 0.8, damage: 18, cd: 4, shape: 'warning-circle', range: 90 });
    expect(ELITE_SKILLS.enemy_g2_5).toMatchObject({ windup: 0.4, damage: 8, cd: 3.5, shape: 'volley-line' });
  });

  it('石甲狼双阶段：石甲分池 60%（400 → 240+160）；石甲期 ×0.8 速/×1.3 抬手；破甲 ×1.35 速/÷1.4 抬手', () => {
    expect(stoneWolfArmorSplit(400)).toEqual({ stone: 240, body: 160 });
    expect(STONE_WOLF_STONE_PHASE).toEqual({ speedMult: 0.8, intervalMult: 1.3 });
    expect(STONE_WOLF_BROKEN_PHASE.speedMult).toBeCloseTo(1.35, 6);
    expect(STONE_WOLF_BROKEN_PHASE.intervalDiv).toBeCloseTo(1.4, 6);
    expect(stoneWolfBroken(0)).toBe(true);
    expect(stoneWolfBroken(1)).toBe(false);
    expect(stoneWolfCostumeFrame(false)).toBe(STONE_WOLF_FRAME);
    expect(stoneWolfCostumeFrame(true)).toBe(STONE_WOLF_BROKEN_FRAME);
  });
});

describe('MN-20 打断原则（§③-4-0 四条）', () => {
  const gk = ELITE_SKILLS.enemy_g1_6;

  it('蓄力期可打断（末段 0.3s 锁定窗之前）', () => {
    expect(eliteInterruptible(gk, 'windup', 0.0)).toBe(true);
    expect(eliteInterruptible(gk, 'windup', 0.59)).toBe(true); // 0.9 − 0.3 = 0.6 边界前
  });

  it('蓄力末段 0.3s 锁定窗：不可打断（霸体，防 ICD 连环锁死）', () => {
    expect(eliteInterruptible(gk, 'windup', 0.6)).toBe(false);
    expect(eliteInterruptible(gk, 'windup', 0.89)).toBe(false);
    expect(eliteInterruptible(gk, 'active', 0)).toBe(false);
  });

  it('打断代价 = CD ×50%（防白嫖）', () => {
    expect(interruptCd(gk)).toBeCloseTo(2, 6);
    expect(interruptCd(ELITE_SKILLS.enemy_g2_4)).toBeCloseTo(2.25, 6);
  });
});

describe('精英技能运行时（触发→蓄力→释放→硬直；位移覆盖事件）', () => {
  it('守墓者：进入 100px → windup → active 扫击命中（dist≤130）→ recover → CD 4s', () => {
    const dir = new EliteSkillDirector();
    const e = fakeElite('enemy_g1_6', 0, 0);
    const events = step(dir, e, 1.2);
    const damages = events.filter((ev) => ev.type === 'skill-damage');
    expect(damages).toHaveLength(1);
    expect(damages[0]).toMatchObject({ eliteId: 'enemy_g1_6', damage: 22 });
  });

  it('畸体冲刺：位移覆盖事件（450px/s 锁定方向）+ 冲过头硬直', () => {
    const dir = new EliteSkillDirector();
    const e = fakeElite('enemy_g2_4', 0, 0);
    const p2 = { x: 140, y: 0 };
    const events = step(dir, e, 2.5, p2);
    const vels = events.filter((ev) => ev.type === 'velocity');
    expect(vels.length).toBeGreaterThan(0);
    const first = vels.find((v) => v.type === 'velocity') as { override: { vx: number } };
    expect(Math.abs(first.override.vx)).toBeCloseTo(450, 0);
  });

  it('MN-20 运行时：眩晕打断 → interrupted 事件 + CD 减半', () => {
    const dir = new EliteSkillDirector();
    const e = fakeElite('enemy_g1_6', 0, 0);
    // 进入触发距离 → windup 期施加眩晕
    const applied = applyStatus(e.cc, { kind: 'stun', value: 1, durationSeconds: 1 }, 0.2, { tier: 'elite' });
    e.cc = applied.state;
    const events = step(dir, e, 1.0);
    expect(events.some((ev) => ev.type === 'interrupted')).toBe(true);
    // 伤害未结算（攻击被取消）
    expect(events.some((ev) => ev.type === 'skill-damage')).toBe(false);
  });

  it('掷骨者连射：3 发 18 伤（activeDur/3 间隔）', () => {
    const dir = new EliteSkillDirector();
    const e = fakeElite('enemy_g1_8', 0, 0);
    const p2 = { x: 220, y: 0 };
    const events = step(dir, e, 4.0, p2);
    const damages = events.filter((ev) => ev.type === 'skill-damage');
    expect(damages).toHaveLength(3);
    for (const d of damages) expect(d).toMatchObject({ damage: 18 });
  });

  it('石甲狼：破甲阈值切换面板（速度 45×0.8=36 石甲期 / ×1.35 破甲期）', () => {
    const dir = new EliteSkillDirector();
    const e = fakeElite('enemy_g3_3', 0, 0);
    e.maxHp = 400;
    e.hp = 300; // 石甲期（>160 阈值）
    e.visualFrame = STONE_WOLF_FRAME;
    step(dir, e, 0.2);
    expect(e.speed).toBeCloseTo(36, 6);
    expect(e.visualFrame).toBe(STONE_WOLF_FRAME);
    e.hp = 100; // 破甲
    const events = step(dir, e, 0.2);
    expect(e.speed).toBeCloseTo(45 * 1.35, 6);
    expect(e.visualFrame).toBe(STONE_WOLF_BROKEN_FRAME);
    expect(events.some((ev) => ev.type === 'armor-broken')).toBe(true);
  });

  it('石甲狼：池复用 spawnGeneration 重置破甲态与外观', () => {
    const dir = new EliteSkillDirector();
    const e = fakeElite('enemy_g3_3', 0, 0);
    e.maxHp = 400;
    e.hp = 100;
    e.visualFrame = STONE_WOLF_FRAME;
    e.spawnGeneration = 1;
    const brokenEvents = step(dir, e, 0.2);
    expect(e.visualFrame).toBe(STONE_WOLF_BROKEN_FRAME);
    expect(brokenEvents.some((ev) => ev.type === 'armor-broken')).toBe(true);

    e.spawnGeneration = 2;
    e.hp = 400;
    e.speed = 45;
    e.attackInterval = 1.8;
    e.visualFrame = STONE_WOLF_FRAME;
    const reused = step(dir, e, 0.2);
    expect(e.speed).toBeCloseTo(36, 6);
    expect(e.visualFrame).toBe(STONE_WOLF_FRAME);
    expect(reused.some((ev) => ev.type === 'armor-broken')).toBe(false);

    e.hp = 100;
    const again = step(dir, e, 0.2);
    expect(e.visualFrame).toBe(STONE_WOLF_BROKEN_FRAME);
    expect(again.some((ev) => ev.type === 'armor-broken')).toBe(true);
  });
});

describe('内容批六阵黑板（围猎/血旗/骑士团节拍；锁链/铁石/献祭骨架）', () => {
  function boardFor(behavior: 'ambush' | 'banner' | 'knights', members: Array<{ role: 'body' | 'escort' | 'banner'; count: number }>): ReturnType<typeof createGroupBlackboard> {
    let slot = 0;
    const ms = members.flatMap((m) =>
      Array.from({ length: m.count }, () => ({ slotIndex: slot++, enemyId: 'enemy_g1_2' as const, role: m.role, alive: true })),
    );
    const id = behavior === 'ambush' ? 'f_hunting_ambush' : behavior === 'banner' ? 'f_blood_banner' : 'f_decayed_knights';
    return createGroupBlackboard(`g_${behavior}`, id, behavior, ms);
  }

  it('围猎：环游（~4s）→ 收拢预警 0.3s（ambush-crouch）→ 扑击（ambush-pounce）→ CD 8s', () => {
    const b = boardFor('ambush', [{ role: 'body', count: 5 }]);
    const events: GroupEvent[] = [];
    for (let i = 0; i < 130; i += 1) events.push(...stepGroupBlackboard(b, 0.1, { now: i * 0.1 }));
    expect(events.some((e) => e.type === 'ambush-crouch')).toBe(true);
    expect(events.some((e) => e.type === 'ambush-pounce')).toBe(true);
    expect(AMBUSH_CONFIG.crouch).toBeCloseTo(0.3, 6);
    expect(AMBUSH_CONFIG.pounceCd).toBe(8);
  });

  it('血旗：插旗 2s（banner-planted）→ 增援每 6s 上限 4（noXp 血信徒）', () => {
    const b = boardFor('banner', [{ role: 'banner', count: 1 }, { role: 'escort', count: 2 }]);
    const events: GroupEvent[] = [];
    for (let i = 0; i < 300; i += 1) events.push(...stepGroupBlackboard(b, 0.1, { now: i * 0.1 }));
    expect(events.some((e) => e.type === 'banner-planted')).toBe(true);
    const summons = events.filter((e) => e.type === 'summon');
    expect(summons.length).toBe(BANNER_CONFIG.reinforceCap);
    expect(summons[0]).toMatchObject({ enemyId: 'enemy_g2_1', noXp: true });
  });

  it('血旗：插旗期受击 1 次 → 旗报废解散（banner-broken）', () => {
    const b = boardFor('banner', [{ role: 'banner', count: 1 }, { role: 'escort', count: 2 }]);
    notifyMemberDamaged(b, 0); // 插旗期受击计数（≥1 报废由 stepBanner 消费）
    const ev = stepGroupBlackboard(b, 0.1, { now: 0 });
    expect(ev.some((e) => e.type === 'banner-broken')).toBe(true);
    expect(b.dissolved).toBe(true);
  });

  it('骑士团：每 8s 集团冲锋（警告 0.6s → knights-charge）+ 落空硬直 1s', () => {
    const b = boardFor('knights', [{ role: 'body', count: 3 }]);
    const events: GroupEvent[] = [];
    for (let i = 0; i < 100; i += 1) events.push(...stepGroupBlackboard(b, 0.1, { now: i * 0.1 }));
    expect(events.some((e) => e.type === 'knights-charge-warn')).toBe(true);
    expect(events.some((e) => e.type === 'knights-charge')).toBe(true);
    expect(KNIGHTS_CONFIG.chargeWindup).toBeCloseTo(0.6, 6);
    expect(KNIGHTS_CONFIG.interval).toBe(8);
  });
});
