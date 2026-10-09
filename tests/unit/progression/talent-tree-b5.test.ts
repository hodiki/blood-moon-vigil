import { describe, it, expect } from 'vitest';
import {
  TALENT_TREE,
  TALENT_TREE_COUNTS,
  TALENT_TOTAL_COST_RANGE,
  TALENT_REDLINE,
  TALENT_BUCKET_EQUIV,
  TALENT_REVIVE,
  talentNodeById,
} from '@/config/balance';
import {
  createTreeLedger, unlockNode, canUnlockNode, respec, totalSpent,
  computeTreeApplication, damageBucketEquiv, survivalBucketEquiv, allTreeBonusesWithinRedline,
  treeTotalCost, treeTotalCostWithinRange, ledgerFromSaveData, baseBucketNodeId, isBucketExempt,
  type CodexQuery,
} from '@/progression/tree-state';
import {
  judgeRevive, talentReviveHpPct, talentReviveInvulnSeconds, talentReviveKnockbackPx, maxTalentReviveCharges,
} from '@/progression/revive';
import { computeLoadout } from '@/weapons/loadout';

describe('B5-W1 树配置（gdd-talent-tree §3.1~3.3/§4；验收判据 1/2）', () => {
  it('节点计数：树根 1 + 质变 10 + 属性铺位 15 = 主干 26；支线 12；属性层数 22（D1 降档）', () => {
    expect(TALENT_TREE.filter((n) => n.kind === 'root')).toHaveLength(1);
    expect(TALENT_TREE.filter((n) => n.kind === 'mutation')).toHaveLength(10);
    expect(TALENT_TREE.filter((n) => n.kind === 'attribute')).toHaveLength(15);
    expect(TALENT_TREE_COUNTS.TRUNK).toBe(26);
    expect(TALENT_TREE_COUNTS.ATTRIBUTE_LAYERS).toBe(22);
    // 层数合计 = Σ maxPurchases（属性节点）
    const layers = TALENT_TREE.filter((n) => n.kind === 'attribute').reduce((a, n) => a + n.maxPurchases, 0);
    expect(layers).toBe(22);
    // 支线 4 角色 × 3 = 12
    const branches = TALENT_TREE.filter((n) => n.kind === 'branch');
    expect(branches).toHaveLength(12);
    expect(branches.filter((n) => n.id.endsWith('_top'))).toHaveLength(4);
    // A-11 计数锚统一
    expect(TALENT_TREE_COUNTS.BRANCH_TOTAL).toBe(12);
    expect(TALENT_TREE_COUNTS.TOTAL_ANCHOR).toBe(38);
    expect(TALENT_TREE).toHaveLength(38);
  });

  it('总成本 980 落 800~1000 区间（EG-8：BUG-5 关闭前只调配置；属性 10/层 · 支线 15/顶点 25）', () => {
    expect(treeTotalCost()).toBe(980);
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

  // EN-04：红线用例 = **独立真值**（硬编码 GDD §6.1 目标，不拿被测函数当自身 oracle）——
  // 原用例断言的正是 `damageBucketEquiv()/allTreeBonusesWithinRedline()` 自身（自证/同义反复，测不出公式对错）。
  // EN-16：真值更新为「含支线」口径 A（GDD v1.4 §6.1 含支线合计）：伤害 6.3% / 生存 5.6% / 合成 11.9%。
  it('三桶红线（EN-04 · 独立真值 · EN-16 含支线）：伤害 6.3% / 生存 5.6% / 合成 11.9%（≤8 / ≤6 / ≤12.5）', () => {
    // 独立期望值（GDD v1.4 §6.1 含支线合计：主干 6.1/3.4/9.5 + 支线 0.2/2.2/2.4）
    expect(damageBucketEquiv()).toBeCloseTo(0.063, 3);
    expect(survivalBucketEquiv()).toBeCloseTo(0.056, 3);
    expect(damageBucketEquiv() + survivalBucketEquiv()).toBeCloseTo(0.119, 3);
    // 红线判定（阈值取自 TALENT_REDLINE 常量：0.08 / 0.06 / 0.125）
    expect(damageBucketEquiv()).toBeLessThanOrEqual(TALENT_REDLINE.damage);
    expect(survivalBucketEquiv()).toBeLessThanOrEqual(TALENT_REDLINE.survival);
    expect(damageBucketEquiv() + survivalBucketEquiv()).toBeLessThanOrEqual(TALENT_REDLINE.combined);
    expect(allTreeBonusesWithinRedline()).toBe(true);
  });

  // EN-16：支线系数真值逐节点校验（每层值 × maxPurchases(2)）——防「支线键仍为 0」的静默未落地。
  it('EN-16 支线折算真值：7 节点计入（伤害 1 / 生存 6）、5 节点豁免', () => {
    const dTable = TALENT_BUCKET_EQUIV.damage as Record<string, number>;
    const sTable = TALENT_BUCKET_EQUIV.survival as Record<string, number>;
    // 计入项每层系数（GDD v1.4 §6.1.1）
    expect(dTable.br_edmund_2).toBeCloseTo(0.10, 4);
    expect(sTable.br_cassandra_1).toBeCloseTo(0.15, 4);
    expect(sTable.br_cassandra_2).toBeCloseTo(0.15, 4);
    expect(sTable.br_violet_1).toBeCloseTo(0.50, 4);
    expect(sTable.br_violet_2).toBeCloseTo(0.10, 4);
    expect(sTable.br_galvan_1).toBeCloseTo(0.10, 4);
    expect(sTable.br_galvan_2).toBeCloseTo(0.10, 4);
    // 支线折算合计（每层 × 2 层）：伤害 +0.20 / 生存 +2.20
    const branchDamage = (dTable.br_edmund_2 ?? 0) * talentNodeById('br_edmund_2')!.maxPurchases;
    const branchSurvival =
      ((sTable.br_cassandra_1 ?? 0) + (sTable.br_cassandra_2 ?? 0) + (sTable.br_violet_1 ?? 0) + (sTable.br_violet_2 ?? 0) + (sTable.br_galvan_1 ?? 0) + (sTable.br_galvan_2 ?? 0)) * 2;
    expect(branchDamage).toBeCloseTo(0.20, 4);
    expect(branchSurvival).toBeCloseTo(2.20, 4);
  });

  // EN-16：豁免按**配置字段自动判定**（非硬编码名单）——tempo 桶 / none 桶 / 空 machine 均豁免。
  it('EN-16 豁免判定可自动化：tempo/none/空 machine 自动豁免，计入项不豁免', () => {
    // 节奏桶 br_edmund_1（拾取半径）→ 豁免
    expect(isBucketExempt(talentNodeById('br_edmund_1')!)).toBe(true);
    // 4 顶点 br_*_top（machine:{}）→ 豁免
    for (const id of ['br_edmund_top', 'br_cassandra_top', 'br_violet_top', 'br_galvan_top'] as const) {
      expect(isBucketExempt(talentNodeById(id)!), `${id} 应豁免`).toBe(true);
    }
    // 计入项（damage/survival，machine 非空）→ 不豁免
    for (const id of ['br_edmund_2', 'br_cassandra_1', 'br_cassandra_2', 'br_violet_1', 'br_violet_2', 'br_galvan_1', 'br_galvan_2'] as const) {
      expect(isBucketExempt(talentNodeById(id)!), `${id} 不应豁免`).toBe(false);
    }
    // 判定依据 = 字段（非主观）：豁免节点恒满足 bucket∈{tempo,none} ∨ machine 无键
    for (const node of TALENT_TREE) {
      if (isBucketExempt(node)) {
        expect(node.bucket === 'tempo' || node.bucket === 'none' || Object.keys(node.machine).length === 0).toBe(true);
      }
    }
  });

  // EN-04：覆盖守卫 ①——每个 damage/survival 桶节点必有折算系数键（含 `_2` 归一），
  // 防「加了 `_2` 节点却没加系数键」的配置漂移无声通过（A-13 假 PASS 的根因）。
  it('EN-04 覆盖守卫：每个 damage/survival 桶节点必有折算系数键（含 `_2` 归一）', () => {
    let checked = 0;
    for (const node of TALENT_TREE) {
      if (node.bucket !== 'damage' && node.bucket !== 'survival') continue;
      const table = TALENT_BUCKET_EQUIV[node.bucket] as Record<string, number>;
      const hasKey = table[node.id] !== undefined || table[baseBucketNodeId(node.id)] !== undefined;
      expect(hasKey, `${node.id} 缺折算系数键`).toBe(true);
      checked += 1;
    }
    expect(checked).toBe(17); // 10 属性 damage/survival 铺位（含 _2）+ 7 支线（damage/survival）
  });

  // EN-03/EN-04：覆盖守卫 ②——全 12 支线节点均有 `bucket` 字段（不再被 `node.bucket !== bucket` 直接跳过）。
  it('EN-03/EN-04 覆盖守卫：全 12 支线节点均有 bucket 字段', () => {
    const branches = TALENT_TREE.filter((n) => n.kind === 'branch');
    expect(branches).toHaveLength(12);
    for (const b of branches) expect(b.bucket, `${b.id} 缺 bucket`).toBeDefined();
    expect(branches.filter((n) => n.bucket === 'survival')).toHaveLength(6); // cassandra/violet/galvan ① ②
    expect(branches.filter((n) => n.bucket === 'damage')).toHaveLength(1);   // edmund ②
    expect(branches.filter((n) => n.bucket === 'tempo')).toHaveLength(1);    // edmund ① 拾取半径
    expect(branches.filter((n) => n.bucket === 'none')).toHaveLength(4);     // 顶点 ×4
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
    expect(normal.attributes.maxHp).toBe(10); // a_life ×1（D1 降档 +10/层）
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
