/**
 * progression/tree-state.ts —— 滤月余辉天赋树状态层（B5-W2，gdd-talent-tree §3.1/§3.5~3.8）
 *
 * 纯逻辑（test-framework §1.2 可单测）：unlockNode / respec / computeTreeApplication。
 * 替代 merit.ts 加成层（A-2 改造方向；canEquipMerit/toggleMeritEquipped 退役走 EG-2 归档），
 * calculateMeritPoints + PURE_IN_GAME_MODE_KEY 管线沿用（GT-4：更名余辉止于文案）。
 *
 * 规则：防跳点门槛（父点亮 + 本层累计消耗达门槛）/ 洗点免费全返（GT-6）/ 图鉴轻联动 4 项（GT-12）/
 * 纯局内模式（GT-11）：属性段返回空、质变全开（EG-7）。
 */

import {
  TALENT_TREE,
  TALENT_LAYER_ENTRY,
  TALENT_BUCKET_EQUIV,
  TALENT_REDLINE,
  TALENT_TOTAL_COST_RANGE,
  talentNodeById,
  type TalentNodeConfig,
  type TalentNodeId,
  type TalentBucket,
} from '@/config/balance';

/** 树购买状态（存档 treeState.unlockedNodeIds 的运行时形态：id → 已购层数） */
export type TreePurchases = Record<string, number>;

/** 可用余辉点（save.meritPoints 1:1 沿用） */
export interface TreeLedger {
  points: number;
  purchases: TreePurchases;
}

export function createTreeLedger(points: number): TreeLedger {
  // 树根 Q-a 默认习得（gdd §④-1：所有角色默认已点亮、永不熄灭）
  return { points, purchases: { q_a: 1 } };
}

export function ledgerFromSaveData(save: { meritPoints: number; treeState: { purchases: Record<string, number>; pointsSpent: number } }): TreeLedger {
  const purchases = { ...save.treeState.purchases };
  if ((purchases['q_a'] ?? 0) < 1) purchases['q_a'] = 1; // 树根默认习得
  return {
    points: Math.max(0, save.meritPoints - save.treeState.pointsSpent),
    purchases,
  };
}

/** 已消耗点数（成本表求和） */
export function totalSpent(ledger: TreeLedger): number {
  let sum = 0;
  for (const [id, n] of Object.entries(ledger.purchases)) {
    const node = talentNodeById(id as TalentNodeId);
    if (node) sum += node.cost * n;
  }
  return sum;
}

/** 本层累计消耗（防跳点门槛判定用） */
export function layerSpent(ledger: TreeLedger, layer: 1 | 2 | 3 | 4): number {
  let sum = 0;
  for (const [id, n] of Object.entries(ledger.purchases)) {
    const node = talentNodeById(id as TalentNodeId);
    if (node && node.layer === layer) sum += node.cost * n;
  }
  return sum;
}

/** 图鉴前置回调（只读查询，不写 codex——A-4） */
export type CodexQuery = (prereq: NonNullable<TalentNodeConfig['codexPrerequisite']>) => boolean;

/** 默认图鉴查询（未接 codex 时视为达成——树 UI 期接入真实查询） */
export const alwaysTrueCodex: CodexQuery = () => true;

/** 节点可达判定：父点亮 + 层门槛 + 图鉴前置（§3.1 防跳点） */
export function canUnlockNode(ledger: TreeLedger, id: TalentNodeId, codex: CodexQuery = alwaysTrueCodex): boolean {
  const node = talentNodeById(id);
  if (!node) return false;
  const bought = ledger.purchases[id] ?? 0;
  if (bought >= node.maxPurchases) return false; // 满
  if (ledger.points < node.cost) return false; // 点数不足
  if (node.parent && (ledger.purchases[node.parent] ?? 0) < 1) return false; // 父未点亮
  // 防跳点门槛（进入语义）：层 3/4 需「更浅层累计消耗 ≥ 进入门槛」（30/120）；层 1/2 仅需父点亮。
  // GDD 锚 30/120/260 原样保留于 TALENT_LAYER_THRESHOLDS（防跳点意图 = 浅层未投入不得直达深层）。
  let shallowSpent = 0;
  for (let l = 1; l < node.layer; l += 1) shallowSpent += layerSpent(ledger, l as 1 | 2 | 3 | 4);
  if (shallowSpent < TALENT_LAYER_ENTRY[node.layer]) return false;
  if (node.codexPrerequisite && !codex(node.codexPrerequisite)) return false; // 图鉴轻联动
  return true;
}

/** 点亮 1 层（扣点 + 叠层）；不可达 = 拒绝并返回 false（不抛错，UI 灰显口径） */
export function unlockNode(ledger: TreeLedger, id: TalentNodeId, codex: CodexQuery = alwaysTrueCodex): boolean {
  if (!canUnlockNode(ledger, id, codex)) return false;
  const node = talentNodeById(id)!;
  ledger.points -= node.cost;
  ledger.purchases[id] = (ledger.purchases[id] ?? 0) + 1;
  return true;
}

/** 洗点（GT-6）：免费全量返还、节点状态清空待重配（下局生效由调用方时序保证） */
export function respec(ledger: TreeLedger): void {
  ledger.points += totalSpent(ledger);
  ledger.purchases = {};
}

/** 全树总成本（配置断言 800~1000 用） */
export function treeTotalCost(): number {
  return TALENT_TREE.reduce((a, n) => a + n.cost * n.maxPurchases, 0);
}

// ============================================================================
// 开局应用（computeTreeApplication，A-2：替代 computeMeritApplication）
// ============================================================================

/** 属性加成汇总（PlayerStats 应用入参；全部为增量 delta） */
export interface TreeAttributeDelta {
  attackFlat: number;
  damagePct: number;
  attackSpeedPct: number;
  cooldownPct: number;
  xpGainPct: number;
  magnetRadius: number;
  maxHp: number;
  moveSpeedPct: number;
  healEfficiencyPct: number;
  pickupRadius: number;
}

export function emptyTreeAttributeDelta(): TreeAttributeDelta {
  return { attackFlat: 0, damagePct: 0, attackSpeedPct: 0, cooldownPct: 0, xpGainPct: 0, magnetRadius: 0, maxHp: 0, moveSpeedPct: 0, healEfficiencyPct: 0, pickupRadius: 0 };
}

/** 质变节点生效标记（PlayScene 开局/运行时消费） */
export interface TreeMutationFlags {
  /** Q-b：开局自带配对共鸣通武（GT-7 全额） */
  companionWeapon: boolean;
  /** Q-c/Q-e：复活次数（0/1/2） */
  reviveCharges: number;
  /** Q-d：预选通武进局（GT-8 共存） */
  preselectedWeapon: boolean;
  /** Q-f1/f2/f3：首精英额外 offer 次数（0~3，GT-10 串联） */
  eliteOffers: number;
  /** Q-s1：开局 30s 窗口（伤害/攻速 +20%） */
  openingWindow: boolean;
  /** Q-s3：遗言余烬 */
  emberOnDeath: boolean;
  /** Q-s4：衍生技强化卡 P4 前置（消耗 1 次升级，UI 消费 B6） */
  derivativeUpgradePrereq: boolean;
}

export interface TreeApplication {
  /** 质变段（纯局内模式仍全开——GT-11 基准规则） */
  mutations: TreeMutationFlags;
  /** 属性段（纯局内模式 = empty delta，§3.8） */
  attributes: TreeAttributeDelta;
  /** 纯局内模式标记（QA 兜底，GT-11 待商榷状态） */
  pureInGame: boolean;
}

/** 质变段汇总（从购买状态读） */
function mutationFlagsOf(ledger: TreeLedger): TreeMutationFlags {
  const lvl = (id: TalentNodeId) => ledger.purchases[id] ?? 0;
  return {
    companionWeapon: lvl('q_b') >= 1,
    reviveCharges: lvl('q_c') >= 1 ? (lvl('q_e') >= 1 ? 2 : 1) : 0,
    preselectedWeapon: lvl('q_d') >= 1,
    eliteOffers: (lvl('q_f1') >= 1 ? 1 : 0) + (lvl('q_f2') >= 1 ? 1 : 0) + (lvl('q_f3') >= 1 ? 1 : 0),
    openingWindow: lvl('q_s1') >= 1,
    emberOnDeath: lvl('q_s3') >= 1,
    derivativeUpgradePrereq: lvl('q_s4') >= 1,
  };
}

/** 属性段汇总（按节点 effect × 层数累加；每节点独立层数——双点位类型合计达标） */
function attributeDeltaOf(ledger: TreeLedger): TreeAttributeDelta {
  const delta = emptyTreeAttributeDelta();
  for (const node of TALENT_TREE) {
    if (node.kind !== 'attribute') continue;
    const bought = ledger.purchases[node.id] ?? 0;
    if (bought <= 0) continue;
    const m = node.machine as Record<string, number>;
    if (m.attackFlat) delta.attackFlat += m.attackFlat * bought;
    if (m.damagePct) delta.damagePct += m.damagePct * bought;
    if (m.attackSpeedPct) delta.attackSpeedPct += m.attackSpeedPct * bought;
    if (m.cooldownPct) delta.cooldownPct += m.cooldownPct * bought;
    if (m.xpGainPct) delta.xpGainPct += m.xpGainPct * bought;
    if (m.magnetRadius) delta.magnetRadius += m.magnetRadius * bought;
    if (m.maxHp) delta.maxHp += m.maxHp * bought;
    if (m.moveSpeedPct) delta.moveSpeedPct += m.moveSpeedPct * bought;
    if (m.healEfficiencyPct) delta.healEfficiencyPct += m.healEfficiencyPct * bought;
    if (m.pickupRadius) delta.pickupRadius += m.pickupRadius * bought;
  }
  return delta;
}

/**
 * 计算开局树应用（computeTreeApplication，A-2 替代 computeMeritApplication）。
 * 纯局内模式（GT-11/EG-7）：属性段空、质变全开。
 */
export function computeTreeApplication(ledger: TreeLedger, pureInGame: boolean): TreeApplication {
  return {
    mutations: mutationFlagsOf(ledger),
    attributes: pureInGame ? emptyTreeAttributeDelta() : attributeDeltaOf(ledger),
    pureInGame,
  };
}

// ============================================================================
// 三桶红线断言（tree 版 allMeritBonusesWithinRedline，§3.6/§⑩-2）
// ============================================================================

function bucketEquiv(bucket: TalentBucket): number {
  const table = TALENT_BUCKET_EQUIV[bucket as 'damage' | 'survival'];
  if (!table) return 0;
  let sum = 0;
  for (const node of TALENT_TREE) {
    if (node.bucket !== bucket) continue;
    const per = (table as Record<string, number>)[node.id];
    if (per) sum += per * node.maxPurchases;
  }
  return sum / 100; // 折算系数表按 % 记
}

/** 伤害桶全满 DPS 等效（红线 ≤8%） */
export function damageBucketEquiv(): number {
  return bucketEquiv('damage');
}

/** 生存桶全满承伤等效（红线 ≤6%） */
export function survivalBucketEquiv(): number {
  return bucketEquiv('survival');
}

/** tree 版红线断言（§⑩-2）：伤害 ≤8% / 生存 ≤6% / 合成 ≤10% */
export function allTreeBonusesWithinRedline(): boolean {
  const d = damageBucketEquiv();
  const s = survivalBucketEquiv();
  return d <= TALENT_REDLINE.damage && s <= TALENT_REDLINE.survival && d + s <= TALENT_REDLINE.combined;
}

/** 总成本区间断言（EG-8：800~1000） */
export function treeTotalCostWithinRange(): boolean {
  const [lo, hi] = TALENT_TOTAL_COST_RANGE;
  const total = treeTotalCost();
  return total >= lo && total <= hi;
}
