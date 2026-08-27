import { describe, it, expect } from 'vitest';
import { UPGRADE_POOL, UPGRADE_POOL_RULES } from '@/config/balance';
import { UpgradeState } from '@/upgrade/upgrade-pool';
import {
  tagPasses,
  buildV2Candidates,
  rollThreeV2,
  fallbackV2Candidate,
  optionFromCandidate,
  classUpgradeWeight,
  pickGuaranteeCandidate,
  pickPathKeyCandidate,
  stageOfRunTime,
  stageMultForCandidate,
  stageCategoryOfCandidate,
  isRelatedCandidate,
  type UpgradePoolV2Context,
} from '@/upgrade/upgrade-pool-v2';

/** 守夜人开局：仅 A 类（wpn_a_1） */
function ctx(overrides: Partial<UpgradePoolV2Context> = {}): UpgradePoolV2Context {
  return {
    heroId: 'hero_edmund',
    ownedWeaponIds: ['wpn_a_1'],
    isEvolved: () => false,
    ...overrides,
  };
}

describe('E4-S4 v2 池标签过滤（gdd-upgrade-pool-v2 §3.6.1）', () => {
  it('全局 + 被动钥 → 所有人；武器类 → 持有类；主动技强化 → 仅当前角色', () => {
    const ownedClasses = new Set(['A'] as const);
    const hasUnowned = () => true;
    expect(tagPasses(['global'], 'hero_edmund', ownedClasses, hasUnowned)).toBe(true);
    expect(tagPasses(['key'], 'hero_edmund', ownedClasses, hasUnowned)).toBe(true);
    expect(tagPasses(['weapon_class_a'], 'hero_edmund', ownedClasses, hasUnowned)).toBe(true);
    expect(tagPasses(['weapon_class_b'], 'hero_edmund', ownedClasses, hasUnowned)).toBe(true); // 未持有但可解锁 → 出现（E4-S5）
    expect(tagPasses(['hero_edmund'], 'hero_edmund', ownedClasses, hasUnowned)).toBe(true);
    expect(tagPasses(['hero_cassandra'], 'hero_edmund', ownedClasses, hasUnowned)).toBe(false); // 非当前角色
    // 未持有且类内无未拥有武器 → 过滤
    expect(tagPasses(['weapon_class_d'], 'hero_edmund', ownedClasses, () => false)).toBe(false);
  });

  it('候选池 = 标签命中 + 满级剔除；主动技强化仅当前角色（守夜人 3 项）', () => {
    const state = new UpgradeState();
    const pool = buildV2Candidates(state, ctx());
    const activeIds = pool.filter((c) => c.kind === 'upgrade' && c.upgradeId?.startsWith('up_a_'));
    expect(activeIds.length).toBe(3); // up_a_*_edmund ×3
    for (const c of activeIds) {
      expect(c.upgradeId).toMatch(/edmund$/);
    }
    // 非守夜人角色主动技强化不出现
    const violetPool = buildV2Candidates(state, ctx({ heroId: 'hero_violet', ownedWeaponIds: ['wpn_a_3'] }));
    const violetActive = violetPool.filter((c) => c.kind === 'upgrade' && c.upgradeId?.startsWith('up_a_'));
    expect(violetActive.length).toBe(3);
    for (const c of violetActive) expect(c.upgradeId).toMatch(/violet$/);
  });

  it('满级剔除：up_g_1 叠满（可重复）仍入池；up_g_3 maxStack 3（M3-DESIGN-1 鲜血契约 ×3）叠满后剔除', () => {
    const state = new UpgradeState();
    for (let i = 0; i < 3; i += 1) state.addStack('up_g_3', 3); // 3 层 → 满级（原 ×5 → ×3）
    const pool = buildV2Candidates(state, ctx());
    expect(pool.some((c) => c.upgradeId === 'up_g_1')).toBe(true); // 可重复恒在池
    expect(pool.some((c) => c.upgradeId === 'up_g_3')).toBe(false); // 满级剔除
  });
});

describe('E4-S4 抽取权重（gdd §3.6.2/§3.6.4）', () => {
  it('持有类强化 ×2（WEIGHT_OWNED_CLASS=2）；未持有可解锁类 ×1（WEIGHT_UNOWNED_CLASS=1）', () => {
    const ownedClasses = new Set(['A'] as const);
    const itemA = UPGRADE_POOL.find((u) => u.id === 'up_w_a1')!;
    const itemB = UPGRADE_POOL.find((u) => u.id === 'up_w_b1')!;
    expect(classUpgradeWeight(itemA, ownedClasses, () => true)).toBe(UPGRADE_POOL_RULES.WEIGHT_OWNED_CLASS);
    expect(classUpgradeWeight(itemB, ownedClasses, () => true)).toBe(UPGRADE_POOL_RULES.WEIGHT_UNOWNED_CLASS);
  });

  it('上次选过项权重 ×0.5（WEIGHT_LAST_PICK=0.5）', () => {
    const state = new UpgradeState();
    state.lastPickId = 'up_g_1';
    const pool = buildV2Candidates(state, ctx());
    const g1 = pool.find((c) => c.upgradeId === 'up_g_1');
    expect(g1?.weight).toBeCloseTo(0.5, 6);
  });
});

describe('E4-S4 超武进化卡（gdd §3.6.3 / weapons-v2 §5.1）', () => {
  it('条件：类成型 2（M3-DESIGN-1 3→2）+ 持钥 + 未进化 + 持有主武器 → 入池权重 ×5', () => {
    const state = new UpgradeState();
    // 守夜人开局 A 类：补足类成型 2 次（a1×2）+ 持 key_scope（血月天罚）
    state.addStack('up_w_a1', 2);
    state.addStack('up_w_a1', 2); // 每层 +1 → 2 层
    state.addStack('key_scope', 1);
    const pool = buildV2Candidates(state, ctx());
    const evo = pool.find((c) => c.kind === 'evolution' && c.evoId === 'evo_moonwrath');
    expect(evo).toBeDefined();
    expect(evo?.weight).toBe(UPGRADE_POOL_RULES.WEIGHT_EVOLUTION); // ×5
  });

  it('不满足条件不出现：类不足 / 无钥 / 未持有主武器 / 已进化', () => {
    // 类不足（0 次）
    const s1 = new UpgradeState();
    s1.addStack('key_scope', 1);
    expect(buildV2Candidates(s1, ctx()).some((c) => c.kind === 'evolution')).toBe(false);
    // 类不足（1 次 <2）
    const s1b = new UpgradeState();
    s1b.addStack('up_w_a1', 1);
    s1b.addStack('key_scope', 1);
    expect(buildV2Candidates(s1b, ctx()).some((c) => c.kind === 'evolution')).toBe(false);
    // 类成型但无钥
    const s2 = new UpgradeState();
    s2.addStack('up_w_a1', 2);
    s2.addStack('up_w_a1', 2);
    expect(buildV2Candidates(s2, ctx()).some((c) => c.kind === 'evolution')).toBe(false);
    // 已进化
    const s3 = new UpgradeState();
    s3.addStack('up_w_a1', 2);
    s3.addStack('up_w_a1', 2);
    s3.addStack('key_scope', 1);
    const evolvedCtx = ctx({ isEvolved: (w) => w === 'wpn_a_1' });
    expect(buildV2Candidates(s3, evolvedCtx).some((c) => c.kind === 'evolution')).toBe(false);
  });
});

describe('E4-S4 rollThreeV2 + 回退（gdd §3.6.4/§⑥.3）', () => {
  it('三选一不重复；含候选池项；返回渲染结构', () => {
    const state = new UpgradeState();
    const opts = rollThreeV2(state, ctx(), () => 0.5);
    expect(opts).toHaveLength(3);
    const keys = opts.map((o) => o.upgradeId ?? o.evoId);
    expect(new Set(keys).size).toBe(3);
    for (const o of opts) {
      expect(typeof o.name).toBe('string');
      expect(typeof o.desc).toBe('string');
      expect(o.cardKind === 'blue-purple' || o.cardKind === 'amber-gold' || o.cardKind === 'evolution').toBe(true);
    }
  });

  it('单局可选池 20~40（E4-S4 收敛口径；含 E4-S5 解锁变体未拥有类卡）', () => {
    const state = new UpgradeState();
    const pool = buildV2Candidates(state, ctx());
    expect(pool.length).toBeGreaterThanOrEqual(20);
    // GDD §3.1 口径「约 20~28」按纯持有类（开局 22）；本实现含 E4-S5 解锁变体
    // （未拥有类卡 ×1 出现以解锁新武器，gdd §3.7）→ 开局 31，仍远小于池 40。
    expect(pool.length).toBeLessThanOrEqual(40);
  });

  it('全池满级（当前标签）→ 回退 up_g_1（可重复）', () => {
    // 全局可重复项 up_g_1 不可满级；直接断言回退候选函数返回 up_g_1
    const fb = fallbackV2Candidate();
    expect(fb.upgradeId).toBe(UPGRADE_POOL_RULES.FALLBACK_ID);
    expect(fb.upgradeId).toBe('up_g_1');
  });

  it('optionFromCandidate：进化卡渲染（★★ 进化 / 幽紫底）', () => {
    const state = new UpgradeState();
    state.addStack('up_w_a1', 2);
    state.addStack('up_w_a1', 2);
    state.addStack('up_w_a2', 1);
    state.addStack('key_scope', 1);
    const pool = buildV2Candidates(state, ctx());
    const evo = pool.find((c) => c.kind === 'evolution');
    expect(evo).toBeDefined();
    const opt = optionFromCandidate(evo!);
    expect(opt.kind).toBe('evolution');
    expect(opt.cardKind).toBe('evolution');
    expect(opt.name).toContain('进化');
  });

  it('解锁变体标记：未持有类强化项 unlockVariant=true（E4-S5）', () => {
    const state = new UpgradeState();
    const pool = buildV2Candidates(state, ctx());
    const bCard = pool.find((c) => c.upgradeId === 'up_w_b1');
    // 守夜人开局未持有 B 类但有未拥有 B 武器 → 解锁变体
    expect(bCard?.unlockVariant).toBe(true);
    const aCard = pool.find((c) => c.upgradeId === 'up_w_a1');
    expect(aCard?.unlockVariant).toBe(false); // 持有 A 类 → 纯强化
  });
});

describe('M3-DESIGN-1 阶段节奏（upgrade-experience-v2 §2.2）', () => {
  it('局时秒 → 阶段：0–120 S1 / 120–240 S2 / 240–360 S3 / 360+ BOSS', () => {
    expect(stageOfRunTime(0)).toBe('S1');
    expect(stageOfRunTime(60)).toBe('S1');
    expect(stageOfRunTime(120)).toBe('S2');
    expect(stageOfRunTime(180)).toBe('S2');
    expect(stageOfRunTime(240)).toBe('S3');
    expect(stageOfRunTime(300)).toBe('S3');
    expect(stageOfRunTime(360)).toBe('BOSS');
    expect(stageOfRunTime(400)).toBe('BOSS');
  });

  it('候选阶段类目：数值方向卡 up_g_1~4 / 已拥有类强化 / 解锁变体 / 钥 / 主动技 / 进化', () => {
    const state = new UpgradeState();
    const pool = buildV2Candidates(state, ctx());
    const g1 = pool.find((c) => c.upgradeId === 'up_g_1')!;
    const a1 = pool.find((c) => c.upgradeId === 'up_w_a1')!;
    const b1 = pool.find((c) => c.upgradeId === 'up_w_b1')!; // 解锁变体
    const key = pool.find((c) => c.upgradeId === 'key_scope')!;
    const act = pool.find((c) => c.upgradeId === 'up_a_cd_edmund')!;
    expect(stageCategoryOfCandidate(g1)).toBe('numeric');
    expect(stageCategoryOfCandidate(a1)).toBe('ownedClass');
    expect(stageCategoryOfCandidate(b1)).toBe('unlock');
    expect(stageCategoryOfCandidate(key)).toBe('key');
    expect(stageCategoryOfCandidate(act)).toBe('active');
  });

  it('阶段权重乘算（基础 × 阶段 × 防重复）：S1 数值卡 ×0.5；S2 已拥有类强化 2×1.5=3.0、钥 ×1.2；S3 数值卡 ×1.2', () => {
    const state = new UpgradeState();
    // S1：数值方向卡 ×0.5
    const s1 = buildV2Candidates(state, ctx({ runTimeSeconds: 60 }));
    expect(s1.find((c) => c.upgradeId === 'up_g_1')?.weight).toBeCloseTo(0.5, 6);
    // S2：已拥有类强化 ×2(基础) ×1.5 = 3.0；钥 ×1.2
    const s2 = buildV2Candidates(state, ctx({ runTimeSeconds: 180 }));
    expect(s2.find((c) => c.upgradeId === 'up_w_a1')?.weight).toBeCloseTo(2 * 1.5, 6);
    expect(s2.find((c) => c.upgradeId === 'key_scope')?.weight).toBeCloseTo(1.2, 6);
    // S3：数值卡 ×1.2
    const s3 = buildV2Candidates(state, ctx({ runTimeSeconds: 300 }));
    expect(s3.find((c) => c.upgradeId === 'up_g_1')?.weight).toBeCloseTo(1.2, 6);
    // 无 runTimeSeconds（旧调用方/既有测试语义）= 无阶段加权
    const none = buildV2Candidates(state, ctx());
    expect(none.find((c) => c.upgradeId === 'up_g_1')?.weight).toBe(1);
    expect(stageMultForCandidate(s1.find((c) => c.upgradeId === 'up_g_1')!, 60)).toBeCloseTo(0.5, 6);
  });

  it('阶段权重 × 防重复顺序：S1 中 up_g_1 为上次选过 → 1×0.5(阶段)×0.5(防重复) = 0.25', () => {
    const state = new UpgradeState();
    state.lastPickId = 'up_g_1';
    const s1 = buildV2Candidates(state, ctx({ runTimeSeconds: 60 }));
    expect(s1.find((c) => c.upgradeId === 'up_g_1')?.weight).toBeCloseTo(0.25, 6);
  });
});

describe('M3-DESIGN-1 向心性保底席位（upgrade-experience-v2 §2.1）', () => {
  it('P1 进化卡：条件满足（类成型 2 + 持钥）后保底取进化卡，rollThreeV2 必占一席', () => {
    const state = new UpgradeState();
    state.addStack('up_w_a1', 2);
    state.addStack('up_w_a1', 2);
    state.addStack('key_scope', 1);
    const pool = buildV2Candidates(state, ctx());
    const g = pickGuaranteeCandidate(state, ctx(), pool);
    expect(g?.kind).toBe('evolution');
    expect(g?.evoId).toBe('evo_moonwrath');
    const opts = rollThreeV2(state, ctx());
    expect(opts.some((o) => o.kind === 'evolution')).toBe(true);
  });

  it('P2 进化路径钥：该类类强化 ≥1 且未持钥 → 保底对应钥（领先类）', () => {
    const state = new UpgradeState();
    state.addStack('up_w_a1', 1); // A 类 1 次，未持 key_scope
    const pool = buildV2Candidates(state, ctx());
    const g = pickGuaranteeCandidate(state, ctx(), pool);
    expect(g?.upgradeId).toBe('key_scope');
    // 纯函数直测：pickPathKeyCandidate 返回同一候选
    const direct = pickPathKeyCandidate(state, ctx(), pool);
    expect(direct?.upgradeId).toBe('key_scope');
  });

  it('P2 领先类：多项时取类强化累计最高者；平局取初始武器类', () => {
    // B 领先（2 > 1）→ key_holy
    const s1 = new UpgradeState();
    s1.addStack('up_w_a1', 2); // A 类 1 次
    s1.addStack('up_w_b1', 2);
    s1.addStack('up_w_b1', 2); // B 类 2 次（领先）
    const pool1 = buildV2Candidates(s1, ctx({ ownedWeaponIds: ['wpn_a_1', 'wpn_b_1'] }));
    expect(pickGuaranteeCandidate(s1, ctx({ ownedWeaponIds: ['wpn_a_1', 'wpn_b_1'] }), pool1)?.upgradeId).toBe('key_holy');
    // 平局（1 = 1）→ 初始武器类 A → key_scope
    const s2 = new UpgradeState();
    s2.addStack('up_w_a1', 2);
    s2.addStack('up_w_b1', 2);
    const pool2 = buildV2Candidates(s2, ctx({ ownedWeaponIds: ['wpn_a_1', 'wpn_b_1'] }));
    expect(pickGuaranteeCandidate(s2, ctx({ ownedWeaponIds: ['wpn_a_1', 'wpn_b_1'] }), pool2)?.upgradeId).toBe('key_scope');
  });

  it('P3 已拥有类强化：无进化/无钥候选时保底已拥有类强化项（初始类永不空）', () => {
    const state = new UpgradeState(); // 无类强化、无钥
    const pool = buildV2Candidates(state, ctx());
    const g = pickGuaranteeCandidate(state, ctx(), pool);
    expect(g?.kind).toBe('upgrade');
    expect(g?.upgradeId?.startsWith('up_w_a')).toBe(true);
    expect(g?.unlockVariant).toBe(false);
  });

  it('P4 主动技强化：已拥有类强化全满级 + 无钥候选时保底主动技（用无进化主武器的血猎手）', () => {
    const state = new UpgradeState();
    state.addStack('up_w_a1', 2);
    state.addStack('up_w_a1', 2);
    state.addStack('up_w_a2', 2);
    state.addStack('up_w_a2', 2);
    state.addStack('up_w_a3', 2);
    state.addStack('up_w_a3', 2);
    // 血猎手初始 wpn_a_2（无进化映射）→ P2 空；A 类满级 → P3 空
    const cassCtx = ctx({ heroId: 'hero_cassandra', ownedWeaponIds: ['wpn_a_2'] });
    const pool = buildV2Candidates(state, cassCtx);
    const g = pickGuaranteeCandidate(state, cassCtx, pool);
    expect(g?.upgradeId?.startsWith('up_a_')).toBe(true);
  });

  it('P5 未拥有类解锁卡：前 4 级全空时兜底解锁卡（有新东西）', () => {
    const state = new UpgradeState();
    state.addStack('up_w_a1', 2);
    state.addStack('up_w_a1', 2);
    state.addStack('up_w_a2', 2);
    state.addStack('up_w_a2', 2);
    state.addStack('up_w_a3', 2);
    state.addStack('up_w_a3', 2);
    const cassCtx = ctx({ heroId: 'hero_cassandra', ownedWeaponIds: ['wpn_a_2'] });
    // 血猎手 3 个主动技强化各叠满（maxStack 1）→ P4 空
    for (const id of ['up_a_cd_cassandra', 'up_a_charge_cassandra', 'up_a_effect_cassandra']) {
      state.addStack(id, 1);
    }
    const pool = buildV2Candidates(state, cassCtx);
    const g = pickGuaranteeCandidate(state, cassCtx, pool);
    expect(g?.unlockVariant).toBe(true); // P5 解锁卡兜底
  });

  it('P1~P5 全空 → null（调用方回退 up_g_1，理论仅全池满级）', () => {
    const g = pickGuaranteeCandidate(new UpgradeState(), ctx(), []);
    expect(g).toBeNull();
  });

  it('rollThreeV2：每轮至少 1 张 build 相关卡（向心性保底席位），且三选一不重复', () => {
    const state = new UpgradeState();
    for (let i = 0; i < 20; i += 1) {
      const opts = rollThreeV2(state, ctx());
      expect(opts).toHaveLength(3);
      const keys = opts.map((o) => o.upgradeId ?? o.evoId);
      expect(new Set(keys).size).toBe(3); // 保底项已剔除，不重复
      const hasRelated = opts.some((o) =>
        o.kind === 'evolution'
        || (o.upgradeId?.startsWith('up_w_') && !o.unlockVariant)
        || o.upgradeId?.startsWith('up_a_')
        || o.unlockVariant === true,
      );
      expect(hasRelated).toBe(true);
    }
  });

  it('GUARANTEE_RELATED 开关 + 优先级常量落表（§2.1 / §4.1）', () => {
    expect(UPGRADE_POOL_RULES.GUARANTEE_RELATED).toBe(true);
    expect(UPGRADE_POOL_RULES.GUARANTEE_PRIORITY).toEqual(['evolution', 'pathKey', 'ownedClass', 'active', 'unlock']);
    // STAGE_WEIGHT_MULT 结构（§2.2 表）
    expect(UPGRADE_POOL_RULES.STAGE_WEIGHT_MULT.S1.numeric).toBe(0.5);
    expect(UPGRADE_POOL_RULES.STAGE_WEIGHT_MULT.S2.ownedClass).toBe(1.5);
    expect(UPGRADE_POOL_RULES.STAGE_WEIGHT_MULT.S2.key).toBe(1.2);
    expect(UPGRADE_POOL_RULES.STAGE_WEIGHT_MULT.S3.numeric).toBe(1.2);
    expect(UPGRADE_POOL_RULES.STAGE_WEIGHT_MULT.S3.unlock).toBe(0.6);
    expect(UPGRADE_POOL_RULES.STAGE_WEIGHT_MULT.BOSS.unlock).toBe(0.5);
  });
});

describe('M3 真机埋点 related 标记（upgrade-experience-v2 §2.1 / §4.4）', () => {
  it('isRelatedCandidate：进化卡 / 已拥有类强化 / 主动技 → related；全局数值卡 → 非 related', () => {
    const state = new UpgradeState();
    const pool = buildV2Candidates(state, ctx());
    const evo = pool.find((c) => c.kind === 'evolution'); // 无进化条件 → undefined，单独构造
    expect(evo).toBeUndefined();
    // 构造进化候选直测
    const evoCandidate = { kind: 'evolution' as const, evoId: 'evo_moonwrath' as const, item: null, weight: 5 };
    expect(isRelatedCandidate(evoCandidate, state)).toBe(true);
    expect(isRelatedCandidate(pool.find((c) => c.upgradeId === 'up_w_a1')!, state)).toBe(true); // 已拥有 A 类强化
    expect(isRelatedCandidate(pool.find((c) => c.upgradeId === 'up_a_cd_edmund')!, state)).toBe(true); // 主动技
    expect(isRelatedCandidate(pool.find((c) => c.upgradeId === 'up_g_1')!, state)).toBe(false); // 全局数值
  });

  it('isRelatedCandidate：P5 未拥有类解锁卡 → 非 related（「有新东西」兜底不算 build 相关）', () => {
    const state = new UpgradeState();
    const pool = buildV2Candidates(state, ctx());
    const bCard = pool.find((c) => c.upgradeId === 'up_w_b1')!;
    expect(bCard.unlockVariant).toBe(true);
    expect(isRelatedCandidate(bCard, state)).toBe(false);
  });

  it('isRelatedCandidate：对应钥仅在「该类类强化 ≥1」时 related（P2 定向语义）', () => {
    // 无类强化 → key_scope 非 related
    const s0 = new UpgradeState();
    const pool0 = buildV2Candidates(s0, ctx());
    expect(isRelatedCandidate(pool0.find((c) => c.upgradeId === 'key_scope')!, s0)).toBe(false);
    // A 类强化 1 次 → key_scope related（P2 领先类钥）
    const s1 = new UpgradeState();
    s1.addStack('up_w_a1', 1);
    const pool1 = buildV2Candidates(s1, ctx());
    expect(isRelatedCandidate(pool1.find((c) => c.upgradeId === 'key_scope')!, s1)).toBe(true);
  });

  it('rollThreeV2：每张卡带 related 标记；每轮至少 1 张 related（保底席位构造性保证）', () => {
    const state = new UpgradeState();
    for (let i = 0; i < 20; i += 1) {
      const opts = rollThreeV2(state, ctx());
      expect(opts).toHaveLength(3);
      for (const o of opts) expect(typeof o.related).toBe('boolean');
      expect(opts.some((o) => o.related === true)).toBe(true);
    }
  });

  it('rollThreeV2：全池回退路径 related=false（up_g_1 非 build 相关卡）', () => {
    // 直接构造空候选回退路径：rollThreeV2 在全池空时返回 fallback ×3
    // 用「全部满级」状态逼近不可行（up_g_1 可重复恒在池）→ 直测 optionFromCandidate 回退语义
    const fb = fallbackV2Candidate();
    expect(fb.upgradeId).toBe('up_g_1');
    const opt = optionFromCandidate(fb);
    expect(opt.related).toBeUndefined(); // 单测直调 optionFromCandidate 不写 related；rollThreeV2 才标记
  });
});

// ============================================================================
// QA-BUG-1 回归（2026-08-27 外测报告）：进化幂等
// 「已消费进化卡 → 同名进化卡不得再次入池」；多把武器各满足条件可分别出现。
// ============================================================================

describe('QA-BUG-1 进化幂等（已进化武器不再出同名进化卡）', () => {
  /** 守夜人 A 类成型 2 + 持鹰眼镜片（进化条件满足的最小 state） */
  function evoEligibleState(): UpgradeState {
    const s = new UpgradeState();
    s.addStack('up_w_a1', 2);
    s.addStack('up_w_a1', 2); // A 类累计 2（EVOLUTION_MIN_CLASS_STACKS）
    s.addStack('key_scope', 1);
    return s;
  }

  it('未进化：条件满足 → evo_moonwrath 入池且 P1 保底必占一席（复现基线语义）', () => {
    const state = evoEligibleState();
    const pool = buildV2Candidates(state, ctx());
    expect(pool.some((c) => c.kind === 'evolution' && c.evoId === 'evo_moonwrath')).toBe(true);
    const g = pickGuaranteeCandidate(state, ctx(), pool, () => 0.99);
    expect(g?.kind).toBe('evolution');
    expect(g?.evoId).toBe('evo_moonwrath');
    const opts = rollThreeV2(state, ctx(), () => 0.5);
    expect(opts.some((o) => o.kind === 'evolution' && o.evoId === 'evo_moonwrath')).toBe(true);
  });

  it('已进化 wpn_a_1：同名「进化：血月天罚」不再入池，P1 保底不再返回它，rollThreeV2 不再出现', () => {
    const state = evoEligibleState();
    const evolvedCtx = ctx({ isEvolved: (w) => w === 'wpn_a_1' });
    const pool = buildV2Candidates(state, evolvedCtx);
    // 幂等排除：候选池无该武器进化卡（即便类强化 ≥2 且仍持钥——钥/类强化不可逆持有）
    expect(pool.some((c) => c.kind === 'evolution' && c.evoId === 'evo_moonwrath')).toBe(false);
    expect(pool.some((c) => c.kind === 'evolution')).toBe(false);
    // P1 保底退位：guarantee 不再是任何进化卡
    const g = pickGuaranteeCandidate(state, evolvedCtx, pool, () => 0.99);
    expect(g?.kind).not.toBe('evolution');
    // 渲染层三选一不出现「进化：血月天罚」（QA 复现主路径断言）
    for (let i = 0; i < 20; i += 1) {
      const opts = rollThreeV2(state, evolvedCtx);
      expect(opts.some((o) => o.name.includes('血月天罚'))).toBe(false);
      expect(opts.some((o) => o.kind === 'evolution')).toBe(false);
    }
  });

  it('多把武器各满足条件：各自的进化卡分别出现；仅进化其一只排除其同名卡', () => {
    const twoWeapons = ctx({
      ownedWeaponIds: ['wpn_a_1', 'wpn_b_1'],
      isEvolved: () => false,
    });
    const s = new UpgradeState();
    s.addStack('up_w_a1', 2);
    s.addStack('up_w_a1', 2); // A 类 2
    s.addStack('key_scope', 1);
    s.addStack('up_w_b1', 2);
    s.addStack('up_w_b1', 2); // B 类 2
    s.addStack('key_holy', 1);

    let pool = buildV2Candidates(s, twoWeapons);
    const evoIds = pool.filter((c) => c.kind === 'evolution').map((c) => c.evoId).sort();
    expect(evoIds).toEqual(['evo_moonwrath', 'evo_seraphring']); // 两把各自出现

    // 仅进化 A1（wpn_a_1）：只排除血月天罚，炽天使之环仍在
    const aOnly = ctx({
      ownedWeaponIds: ['wpn_a_1', 'wpn_b_1'],
      isEvolved: (w) => w === 'wpn_a_1',
    });
    pool = buildV2Candidates(s, aOnly);
    const afterIds = pool.filter((c) => c.kind === 'evolution').map((c) => c.evoId);
    expect(afterIds).toEqual(['evo_seraphring']);
  });
});
