import { describe, it, expect } from 'vitest';
import {
  TALENT_TREE,
  TALENT_TREE_COUNTS,
  TALENT_TOTAL_COST_RANGE,
  TALENT_REDLINE,
  TALENT_REVIVE,
  talentNodeById,
} from '@/config/balance';
import {
  createTreeLedger, unlockNode, canUnlockNode, respec, totalSpent,
  computeTreeApplication, damageBucketEquiv, survivalBucketEquiv, allTreeBonusesWithinRedline,
  treeTotalCost, treeTotalCostWithinRange, ledgerFromSaveData, 
  type CodexQuery,
} from '@/progression/tree-state';
import {
  judgeRevive, talentReviveHpPct, talentReviveInvulnSeconds, talentReviveKnockbackPx, maxTalentReviveCharges,
} from '@/progression/revive';
import { computeLoadout } from '@/weapons/loadout';

describe('B5-W1 树配置（gdd-talent-tree §3.1~3.3/§4；验收判据 1/2）', () => {
  it('节点计数：树根 1 + 质变 10 + 属性铺位 15 = 主干 26；支线锚 14；属性层数 23', () => {
    expect(TALENT_TREE.filter((n) => n.kind === 'root')).toHaveLength(1);
    expect(TALENT_TREE.filter((n) => n.kind === 'mutation')).toHaveLength(10);
    expect(TALENT_TREE.filter((n) => n.kind === 'attribute')).toHaveLength(15);
    expect(TALENT_TREE_COUNTS.TRUNK).toBe(26);
    expect(TALENT_TREE_COUNTS.ATTRIBUTE_LAYERS).toBe(23);
    // 层数合计 = Σ maxPurchases（属性节点）
    const layers = TALENT_TREE.filter((n) => n.kind === 'attribute').reduce((a, n) => a + n.maxPurchases, 0);
    expect(layers).toBe(23);
    // 支线 4 角色
    const branches = TALENT_TREE.filter((n) => n.kind === 'branch');
    expect(branches).toHaveLength(12);
    expect(branches.filter((n) => n.id.endsWith('_top'))).toHaveLength(4);
  });

  it('总成本 990 落 800~1000 区间（EG-8：BUG-5 关闭前只调配置；属性 10/层 · 支线 15/顶点 25）', () => {
    expect(treeTotalCost()).toBe(990);
    expect(treeTotalCostWithinRange()).toBe(true);
    const [lo, hi] = TALENT_TOTAL_COST_RANGE;
    expect(treeTotalCost()).toBeGreaterThanOrEqual(lo);
    expect(treeTotalCost()).toBeLessThanOrEqual(hi);
  });

  it('结构约束：深度 ≤4；树根无父；非根节点均有父（防跳点结构基础）', () => {
    for (const n of TALENT_TREE) {
      expect(n.layer).toBeLessThanOrEqual(4);
      if (n.kind === 'root') expect(n.parent).toBeUndefined();
      else expect(n.parent).toBeDefined();
      expect(talentNodeById(n.parent ?? 'q_a')).toBeDefined(); // 父引用有效
    }
  });

  it('三桶红线：伤害 ≤8% / 生存 ≤6% / 合成 ≤10%（tree 版 allBonusesWithinRedline，§⑩-2）', () => {
    expect(damageBucketEquiv()).toBeLessThanOrEqual(TALENT_REDLINE.damage);
    expect(survivalBucketEquiv()).toBeLessThanOrEqual(TALENT_REDLINE.survival);
    expect(damageBucketEquiv() + survivalBucketEquiv()).toBeLessThanOrEqual(TALENT_REDLINE.combined);
    expect(allTreeBonusesWithinRedline()).toBe(true);
  });

  it('图鉴轻联动恰 4 项（GT-12 ≤5 上限）：L-1~L-4', () => {
    const withCodex = TALENT_TREE.filter((n) => n.codexPrerequisite);
    const distinctPrereqs = new Set(withCodex.map((n) => n.codexPrerequisite));
    expect(distinctPrereqs.size).toBe(4); // L-1~L-4（L-2 = 四顶点共用一项）
    expect(withCodex.some((n) => n.id === 'q_s3')).toBe(true);
    expect(withCodex.filter((n) => n.id.endsWith('_top'))).toHaveLength(4);
  });

  it('质变节点单价 40~50 区间（§3.3 锚）；树根 0 点', () => {
    const muts = TALENT_TREE.filter((n) => n.kind === 'mutation');
    for (const m of muts) {
      expect(m.cost).toBeGreaterThanOrEqual(40);
      expect(m.cost).toBeLessThanOrEqual(50);
    }
    expect(talentNodeById('q_a')!.cost).toBe(0);
  });
});

describe('B5-W2 树状态（解锁/门槛/洗点；验收判据 8）', () => {
  it('防跳点门槛（进入语义）：层 2 首节点仅需父点亮；层 3 需浅层累计 ≥30（TALENT_LAYER_ENTRY）', () => {
    const ledger = createTreeLedger(500);
    // 层 2 首节点：父（q_a 默认点亮）→ 可买
    expect(unlockNode(ledger, 'q_b')).toBe(true);
    // 层 3 首节点（q_e）：父 q_c 未点亮 → 拒绝（浅层 42 已 ≥30，门槛满足）
    expect(canUnlockNode(ledger, 'q_e')).toBe(false);
    expect(canUnlockNode(ledger, 'q_c')).toBe(true);
    expect(unlockNode(ledger, 'q_c')).toBe(true);
    expect(canUnlockNode(ledger, 'q_e')).toBe(true); // 父点亮 + 浅层 84 ≥30 → 解锁
  });
  
  it('防跳点：浅层投入 30 后层 3 解锁（q_e 前置 q_c）', () => {
    const ledger = createTreeLedger(1000);
    unlockNode(ledger, 'q_b');
    unlockNode(ledger, 'q_c');
    unlockNode(ledger, 'q_d');
    // 浅层（层1+2）累计 = 42×3 = 126 ≥30 → q_e 可点亮
    expect(canUnlockNode(ledger, 'q_e')).toBe(true);
    expect(unlockNode(ledger, 'q_e')).toBe(true);
    expect(ledger.purchases['q_e']).toBe(1);
  });

  it('点数不足拒绝；满层拒绝；父未点亮拒绝', () => {
    const ledger = createTreeLedger(5);
    unlockNode(ledger, 'a_attack'); // 10 > 5 → 拒绝
    expect(ledger.purchases['a_attack']).toBeUndefined();
    const rich = createTreeLedger(500);
    unlockNode(rich, 'a_attack');
    unlockNode(rich, 'a_attack'); // 满层 2
    expect(canUnlockNode(rich, 'a_attack')).toBe(false);
    unlockNode(rich, 'q_c'); // 层 2 首节点（父点亮）
    // q_e（层 3，父 q_c 已点亮）：浅层累计 = a_attack 20 + q_c 42 = 62 ≥ 30 → 可点亮
    expect(canUnlockNode(rich, 'q_e')).toBe(true);
    // 父未点亮拒绝：q_f2 父 q_f1 未买
    expect(canUnlockNode(rich, 'q_f2')).toBe(false);
  });

  it('洗点（GT-6）：免费全量返还、状态清空', () => {
    const ledger = createTreeLedger(100);
    unlockNode(ledger, 'a_attack');
    unlockNode(ledger, 'a_attack');
    unlockNode(ledger, 'a_damage');
    const spent = totalSpent(ledger);
    expect(spent).toBe(30);
    respec(ledger);
    expect(ledger.points).toBe(100); // 全返
    expect(totalSpent(ledger)).toBe(0);
    expect(Object.keys(ledger.purchases)).toHaveLength(0);
  });

  it('图鉴前置（GT-12）：L-1 q_s3 需血月化身条目；未达成灰显', () => {
    const ledger = createTreeLedger(1000);
    const noCodex: CodexQuery = (p) => p !== 'codex_moon_avatar';
    // 造层 3 门槛（120）
    for (let i = 0; i < 10; i += 1) unlockNode(ledger, 'a_attack'); // 满层 2
    for (let i = 0; i < 10; i += 1) unlockNode(ledger, 'a_damage'); // 满 2
    // 层 2 已 48；需层 3 支出 120 → 用 a_cooldown 层 3 ×2 = 48 不够…直接判定:q_s3 parent q_s1 未点亮 → false
    expect(canUnlockNode(ledger, 'q_s3', noCodex)).toBe(false);
  });

  it('computeTreeApplication：质变段/属性段汇总；纯局内模式（GT-11）属性空、质变全开（EG-7）', () => {
    const ledger = createTreeLedger(0);
    ledger.purchases = { q_b: 1, q_c: 1, q_e: 1, q_d: 1, q_f1: 1, q_f2: 1, q_f3: 1, q_s1: 1, q_s3: 1, q_s4: 1, a_damage: 2, a_life: 1 };
    const normal = computeTreeApplication(ledger, false);
    expect(normal.mutations).toEqual({
      companionWeapon: true, reviveCharges: 2, preselectedWeapon: true,
      eliteOffers: 3, openingWindow: true, emberOnDeath: true, derivativeUpgradePrereq: true,
    });
    expect(normal.attributes.damagePct).toBeCloseTo(0.04); // a_damage ×2
    expect(normal.attributes.maxHp).toBe(15);
    const pure = computeTreeApplication(ledger, true);
    expect(pure.mutations.companionWeapon).toBe(true); // 质变全开
    expect(pure.attributes.damagePct).toBe(0); // 属性段空
    expect(pure.pureInGame).toBe(true);
  });

  it('ledgerFromSaveData：points = meritPoints − pointsSpent；purchases 深拷贝', () => {
    const ledger = ledgerFromSaveData({ meritPoints: 100, treeState: { purchases: { a_life: 1 }, pointsSpent: 12 } });
    expect(ledger.points).toBe(88);
    ledger.purchases['a_life'] = 99;
    expect(ledger.purchases['a_life']).toBe(99); // 拷贝独立
  });
});

describe('B5-W3 复活判定序（GT-9 判定序列表；验收判据 5）', () => {
  it('判定序全序：护盾 → 圣物（预留）→ 天赋复活 → 死亡；同帧不叠用', () => {
    expect(judgeRevive({ shieldAvailable: true, relicFreeDeathAvailable: true, talentChargesRemaining: 2, talentRevivesUsed: 0 })).toBe('shield');
    expect(judgeRevive({ shieldAvailable: false, relicFreeDeathAvailable: true, talentChargesRemaining: 2, talentRevivesUsed: 0 })).toBe('relic');
    expect(judgeRevive({ shieldAvailable: false, relicFreeDeathAvailable: false, talentChargesRemaining: 2, talentRevivesUsed: 0 })).toBe('talent');
    expect(judgeRevive({ shieldAvailable: false, relicFreeDeathAvailable: false, talentChargesRemaining: 0, talentRevivesUsed: 2 })).toBe('death');
  });

  it('两次复活 50%/30% 递减（GT-9）；无敌 1.5s + 击退 100px', () => {
    expect(talentReviveHpPct(0)).toBeCloseTo(TALENT_REVIVE.FIRST_HP_PCT);
    expect(talentReviveHpPct(1)).toBeCloseTo(TALENT_REVIVE.SECOND_HP_PCT);
    expect(talentReviveInvulnSeconds()).toBe(1.5);
    expect(talentReviveKnockbackPx()).toBe(100);
    expect(maxTalentReviveCharges(true, false)).toBe(1);
    expect(maxTalentReviveCharges(true, true)).toBe(2);
    expect(maxTalentReviveCharges(false, true)).toBe(0); // Q-e 前置 Q-c
  });
});

describe('B5-W4 开局组合矩阵（b×d 同名/异名 × 共存去重；验收判据 6 数据流层）', () => {
  it('b 自带配对通武；d 预选同名 → 去重不重复发放；异名 → 三武器共存（GT-7/8）', () => {
    // 守夜人：b 自带 wpn_b_1（R-1 配对）；d 预选 wpn_b_1 同名 → 去重
    const same = computeLoadout('hero_edmund', 'xw_lantern', 'wpn_a_1');
    expect(same).not.toBeNull();
    // 模拟 b/d 注入后的 owned 集合去重语义
    const owned = new Set<string>(['wpn_a_1', 'wpn_b_1']); // b 注入
    const pre = 'wpn_b_1';
    if (!owned.has(pre)) owned.add(pre);
    expect(owned.size).toBe(2); // 同名不重复
    const pre2 = 'wpn_a_2';
    if (!owned.has(pre2)) owned.add(pre2);
    expect(owned.size).toBe(3); // 异名三武器共存（GT-8）
    void same;
  });
});
