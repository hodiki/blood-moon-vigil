/**
 * upgrade/upgrade-pool-v3.ts —— 升级池 v3 抽取引擎（B3-W2，gdd-upgrade-pool-v3 §3.2/§3.3）
 *
 * 纯函数（可脱离 Phaser 单测；PlayScene B3 起消费，v2 引擎保留为库供 B4 共鸣复用）。
 *
 * 保底序列 P1~P5（WD-13 定稿）+ 同帧席位冲突裁决（§⑧ 边缘 3：P1>P2>P3>P4>P5，必须实装）：
 * - P1 当前专武质变卡 1：S1 后段 30~60s 窗口（对冲 H2），全局限 1 次；
 * - P2 共鸣钥：持有可共鸣通武且未持该钥；多项取「通武强化累计最高」，平局取初始武器类
 *   （本批钥作为池项+解锁占位；共鸣条件 ×5 权重占位常量，达成判定 B4 接线）；
 * - P3 已拥有通武强化（未满层）；
 * - P4 当前衍生技强化卡：第 8~14 次升级窗口，单局 1 次，窗口外不出现（错过不补 §⑧-2）；
 * - P5 通武解锁变体（未拥有通武以解锁卡呈现，沿 v2 §3.7）。
 *
 * 权重修订（§3.3）：专武卡 ×2 且 S1 ×1.2；钥 ×1.2（S2 起）；数值卡 S1 ×0.5→S3 ×1.2 沿袭；
 * 进化卡 ×5 与 P1 进化保底**废止**（R2-3 超武退役）。
 */

import {
  UPGRADE_POOL_V3,
  UPGRADE_POOL_V3_RULES,
  DERIVATIVE_UPGRADE_MAP,
  type UpgradeId,
  type UpgradePoolItem,
} from '@/config/balance';
import type { ExclusiveWeaponId, DerivativeSkillId } from '@/config/balance';
import { stageOfRunTime, tagPasses, classOfItem, optionFromCandidate } from '@/upgrade/upgrade-pool-v2';
import { resonancePairByExclusive, RESONANCE_RULES } from '@/config/balance';
import type { UpgradeV2Candidate, UpgradeV2Option, UpgradePoolV2Context } from '@/upgrade/upgrade-pool-v2';
import { WEAPON_CONFIGS } from '@/config/balance';
import type { WeaponClass, WeaponId } from '@/config/balance';

/** v3 抽取上下文（PlayScene 装配；v2 ctx + 专武/衍生技/升级计数扩展） */
export interface UpgradePoolV3Context extends Omit<UpgradePoolV2Context, 'isEvolved'> {
  /** 当前专武（开局 2 选 1 结果；PlayScene B5 前默认 pair[0]） */
  exclusiveId: ExclusiveWeaponId;
  /** 当前衍生技（落选专武转化） */
  derivativeId: DerivativeSkillId;
  /** 已选择的质变卡（order 列表；P1 全局限 1 / 满层剔除用） */
  takenMutationOrders: readonly (1 | 2)[];
  /** P4 判定：本局升级次数（含本次；第 8~14 次窗口） */
  upgradeCount: number;
  /** P4 是否已取（单局 1 次） */
  derivativeUpgradeTaken: boolean;
  /** P1-11 Q-s4 双灯并祀：P4 卡前移（绕过 8~14 窗口直接进池；仍受「未取」约束） */
  derivativeUpgradePrereq?: boolean;
}

/** 质变卡 id（mc_<w>_<order>） */
function mutationId(exclusiveId: ExclusiveWeaponId, order: 1 | 2): UpgradeId {
  return `mc_${exclusiveId.slice(3)}_${order}` as UpgradeId;
}

/** 候选 → 阶段类目（v3 扩展：exclusive/key 类目） */
type V3StageCategory = 'unlock' | 'ownedClass' | 'key' | 'active' | 'numeric' | 'exclusive' | 'derivative' | 'other';

function v3CategoryOf(id: UpgradeId): V3StageCategory {
  if (id.startsWith('mc_')) return 'exclusive';
  if (id.startsWith('key_')) return 'key';
  if (id.startsWith('up_d_')) return 'derivative';
  if (id.startsWith('up_w_')) return 'ownedClass';
  if (id === 'up_g_1' || id === 'up_g_2' || id === 'up_g_3' || id === 'up_g_4') return 'numeric';
  return 'other';
}

/** 阶段倍率（§3.3 修订）：专武卡 S1 ×1.2；钥 S2 起 ×1.2；数值卡沿袭 S1 ×0.5→S3 ×1.2；P4 权重在席位处理 */
function v3StageMult(id: UpgradeId, runTimeSeconds: number | undefined): number {
  if (runTimeSeconds === undefined) return 1;
  const stage = stageOfRunTime(runTimeSeconds);
  const cat = v3CategoryOf(id);
  if (cat === 'exclusive' && stage === 'S1') return UPGRADE_POOL_V3_RULES.EXCLUSIVE_S1_BONUS;
  if (cat === 'key' && (stage === 'S2' || stage === 'S3' || stage === 'BOSS')) return UPGRADE_POOL_V3_RULES.KEY_S2_BONUS;
  if (cat === 'numeric') {
    if (stage === 'S1') return 0.5;
    if (stage === 'S3' || stage === 'BOSS') return 1.2;
  }
  return 1;
}

/** 构造 v3 候选池（标签过滤 + 满层剔除 + 专武/衍生技过滤 + 权重修订） */
export function buildV3Candidates(
  state: { stackOf(id: string): number; lastPickId: string | number | null; hasKey(keyId: string): boolean },
  ctx: UpgradePoolV3Context,
): UpgradeV2Candidate[] {
  const ownedClasses = new Set<WeaponClass>();
  for (const w of ctx.ownedWeaponIds) {
    const cfg = WEAPON_CONFIGS[w];
    if (cfg) ownedClasses.add(cfg.class);
  }
  const hasUnownedWeaponInClass = (cls: WeaponClass): boolean =>
    (Object.keys(WEAPON_CONFIGS) as WeaponId[]).some(
      (w) => WEAPON_CONFIGS[w].class === cls && !ctx.ownedWeaponIds.includes(w),
    );

  const pool: UpgradeV2Candidate[] = [];
  for (const item of UPGRADE_POOL_V3) {
    const id = item.id;
    // 满层剔除（§3.3 修订点 5 沿用）
    if (state.stackOf(id) >= item.maxStack) continue;
    // 专武卡：仅当前专武（验收判据/反例红线「非当前专武质变卡入池 ❌」）
    if (id.startsWith('mc_')) {
      const order = id.endsWith('_1') ? 1 : 2;
      if (!ctx.takenMutationOrders.includes(order)) {
        // 仅当前专武（反例红线：非当前专武质变卡入池 ❌）；卡 2 赠送制不进三选一（验收判据 4）
        if (order === 1 && id === mutationId(ctx.exclusiveId, 1)) {
          // §3.3 修订点 1：权重 ×2，S1 额外 ×1.2
          pool.push({
            kind: 'upgrade',
            upgradeId: id,
            item,
            weight: UPGRADE_POOL_V3_RULES.WEIGHT_EXCLUSIVE * v3StageMult(id, ctx.runTimeSeconds),
          });
        }
      }
      continue;
    }
    // 主动技强化：仅当前衍生技那张（NW-4）；P0-8 修复：窗口外（P4_WINDOW 8~14）直接不进池——
    // 不只靠 P4 席位兜底，否则错过窗口后卡仍可随机进三选一，违反 GDD「错过本局不再出现」。
    // P1-11 Q-s4 双灯并祀：旗激活时 P4 卡前移（绕过窗口；「已取」约束不变）
    if (id.startsWith('up_d_')) {
      const [p4Lo, p4Hi] = UPGRADE_POOL_V3_RULES.P4_WINDOW;
      const bypassWindow = ctx.derivativeUpgradePrereq === true;
      const inP4Window = ctx.upgradeCount >= p4Lo && ctx.upgradeCount <= p4Hi;
      if (DERIVATIVE_UPGRADE_MAP[ctx.derivativeId] === id && !ctx.derivativeUpgradeTaken && (bypassWindow || inP4Window)) {
        pool.push({ kind: 'upgrade', upgradeId: id, item, weight: 1 });
      }
      continue;
    }
    // 其余走 v2 标签过滤
    if (!tagPasses(item.tags, ctx.heroId, ownedClasses, hasUnownedWeaponInClass)) continue;
    let weight = 1;
    let unlockVariant = false;
    // B4-W1：共鸣条件达成（持配对专武未持钥）→ 该钥权重 ×5（§3.1 前置锚，替换 B3 类占位）
    if (item.id.startsWith('key_')) {
      const pair = resonancePairByExclusive(ctx.exclusiveId);
      if (pair && pair.keyId === item.id && !state.hasKey(pair.keyId)) {
        weight *= RESONANCE_RULES.WEIGHT_READY;
      }
    }
    if (item.tags.some((t) => t.startsWith('weapon_class_'))) {
      weight = classUpgradeWeightV3(item, ownedClasses, hasUnownedWeaponInClass);
      const cls = classOfItem(item);
      unlockVariant = !ownedClasses.has(cls) && hasUnownedWeaponInClass(cls);
    }
    if (state.lastPickId === id) weight *= 0.5; // 防重复沿袭
    weight *= v3StageMult(id, ctx.runTimeSeconds);
    pool.push({ kind: 'upgrade', upgradeId: id, item, weight, unlockVariant });
  }
  return pool;
}

/** 类强化权重（沿用 v2 语义；本文件内联避免 v2 引擎退役耦合） */
function classUpgradeWeightV3(
  item: UpgradePoolItem,
  ownedClasses: ReadonlySet<WeaponClass>,
  hasUnowned: (cls: WeaponClass) => boolean,
): number {
  const cls = classOfItem(item);
  if (ownedClasses.has(cls)) return 2;
  if (hasUnowned(cls)) return 1;
  return 1;
}


// ============================================================================
// P1~P5 保底席位（§3.2 + §⑧-3 同帧冲突裁决）
// ============================================================================

/** P1 条件：质变卡 1 未取 且 局时在 30~60s 窗口（S1 后段） */
function p1Candidate(ctx: UpgradePoolV3Context, pool: UpgradeV2Candidate[]): UpgradeV2Candidate | null {
  const [lo, hi] = UPGRADE_POOL_V3_RULES.P1_WINDOW;
  if (ctx.runTimeSeconds === undefined) return null;
  if (ctx.runTimeSeconds < lo || ctx.runTimeSeconds > hi) return null;
  if (ctx.takenMutationOrders.includes(1)) return null; // 全局限 1
  const id = mutationId(ctx.exclusiveId, 1);
  return pool.find((c) => c.upgradeId === id) ?? null;
}

/** P2 条件：持有可共鸣通武且未持该钥；多项取通武强化累计最高，平局取初始武器类 */
export function pickP2KeyCandidate(
  state: { hasKey(keyId: string): boolean; classUpgradeTotalFor(cls: WeaponClass): number },
  ctx: UpgradePoolV3Context,
  pool: UpgradeV2Candidate[],
): UpgradeV2Candidate | null {
  // B4-W1 正式映射：每专武恰 1 对（WD-4）→ 单局单候选；条件 = 持配对专武（ctx.exclusiveId 即是）且未持钥
  const pair = resonancePairByExclusive(ctx.exclusiveId);
  if (!pair) return null;
  if (state.hasKey(pair.keyId)) return null; // 已持钥 → P2 跳过
  return pool.find((c) => c.upgradeId === pair.keyId) ?? null;
}

// B4-W1：类→钥占位映射退役——P2 走 RESONANCE_PAIRS 正式 8 对映射（见 pickP2KeyCandidate）

/** P4 条件：当前衍生技强化卡未取 且 升级次数在第 8~14 次窗口（错过不补） */
function p4Candidate(ctx: UpgradePoolV3Context, pool: UpgradeV2Candidate[]): UpgradeV2Candidate | null {
  const [lo, hi] = UPGRADE_POOL_V3_RULES.P4_WINDOW;
  if (ctx.derivativeUpgradeTaken) return null;
  // P1-11 Q-s4：P4 卡前移——绕过 8~14 窗口（「已取」约束不变）
  if (!ctx.derivativeUpgradePrereq && (ctx.upgradeCount < lo || ctx.upgradeCount > hi)) return null; // 窗口外不出现
  const id = DERIVATIVE_UPGRADE_MAP[ctx.derivativeId];
  return pool.find((c) => c.upgradeId === id) ?? null;
}

/**
 * 保底席位（同帧冲突裁决 P1>P2>P3>P4>P5，§⑧-3 必须实装）：
 * 每轮三选一保证 1 张保底卡占 1 席；多项同席加权抽样（random 注入）。
 * P1~P5 全空 → null（调用方回退 up_g_1）。
 */
export function matchGuaranteeSeatV3(
  state: { hasKey(keyId: string): boolean; classUpgradeTotalFor(cls: WeaponClass): number },
  ctx: UpgradePoolV3Context,
  pool: UpgradeV2Candidate[],
  random: () => number = Math.random,
): { candidate: UpgradeV2Candidate; seat: 'P1' | 'P2' | 'P3' | 'P4' | 'P5' } | null {
  const p1 = p1Candidate(ctx, pool);
  if (p1) return { candidate: p1, seat: 'P1' };
  const p2 = pickP2KeyCandidate(state, ctx, pool);
  if (p2) return { candidate: p2, seat: 'P2' };
  // P3 已拥有通武强化（非解锁变体、未满层；通用卡 up_w_g* 为全局类目不占 P3——§4.4 通用行口径）
  const p3 = weightedPick(pool.filter((c) => c.upgradeId!.startsWith('up_w_') && !c.upgradeId!.startsWith('up_w_g') && !c.unlockVariant), random);
  if (p3) return { candidate: p3, seat: 'P3' };
  const p4 = p4Candidate(ctx, pool);
  if (p4) return { candidate: p4, seat: 'P4' };
  const p5 = weightedPick(pool.filter((c) => !!c.unlockVariant), random);
  if (p5) return { candidate: p5, seat: 'P5' };
  return null;
}

export function pickGuaranteeCandidateV3(
  state: { hasKey(keyId: string): boolean; classUpgradeTotalFor(cls: WeaponClass): number },
  ctx: UpgradePoolV3Context,
  pool: UpgradeV2Candidate[],
  random: () => number = Math.random,
): UpgradeV2Candidate | null {
  return matchGuaranteeSeatV3(state, ctx, pool, random)?.candidate ?? null;
}

function weightedPick(candidates: UpgradeV2Candidate[], random: () => number): UpgradeV2Candidate | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0]!;
  const total = candidates.reduce((a, c) => a + c.weight, 0);
  let r = random() * total;
  for (const c of candidates) {
    r -= c.weight;
    if (r < 0) return c;
  }
  return candidates[candidates.length - 1]!;
}

/** P4 窗口内权重对齐 P3（×2 基准，§3.3 修订点 3）——席位命中时应用 */
function applyP4WindowWeight(pool: UpgradeV2Candidate[], ctx: UpgradePoolV3Context): void {
  const [lo, hi] = UPGRADE_POOL_V3_RULES.P4_WINDOW;
  if (ctx.upgradeCount < lo || ctx.upgradeCount > hi) return;
  const id = DERIVATIVE_UPGRADE_MAP[ctx.derivativeId];
  for (const c of pool) if (c.upgradeId === id) c.weight = UPGRADE_POOL_V3_RULES.WEIGHT_P4_WINDOW;
}

/** 三选一（不放回 + 保底席位占 1 席；候选不足回退 up_g_1） */
export function rollThreeV3(
  state: { stackOf(id: string): number; lastPickId: string | number | null; hasKey(keyId: string): boolean; classUpgradeTotalFor(cls: WeaponClass): number },
  ctx: UpgradePoolV3Context,
  random: () => number = Math.random,
  count = 3,
): UpgradeV2Option[] {
  const pool = buildV3Candidates(state, ctx);
  if (pool.length === 0) {
    const fb = fallbackCandidate();
    return Array.from({ length: count }, () => ({ ...optionFromCandidate(fb), related: false }));
  }
  applyP4WindowWeight(pool, ctx);
  const picks: UpgradeV2Option[] = [];
  const remaining = [...pool];

  const guarantee = matchGuaranteeSeatV3(state, ctx, pool, random);
  if (guarantee) {
    // 保底卡恒 build 相关；P2-2：席位号透传（升级卡角标 P1~P5 明示）
    picks.push({ ...optionFromCandidate(guarantee.candidate), related: true, seat: guarantee.seat });
    const gi = remaining.findIndex((c) => c === guarantee.candidate);
    if (gi >= 0) remaining.splice(gi, 1);
  }

  while (picks.length < count && remaining.length > 0) {
    const total = remaining.reduce((a, c) => a + c.weight, 0);
    let r = random() * total;
    let idx = remaining.length - 1;
    for (let i = 0; i < remaining.length; i += 1) {
      r -= remaining[i]!.weight;
      if (r < 0) {
        idx = i;
        break;
      }
    }
    const picked = remaining.splice(idx, 1)[0]!;
    picks.push({ ...optionFromCandidate(picked), related: picked.upgradeId!.startsWith('up_w_') || picked.upgradeId!.startsWith('key_') });
  }
  while (picks.length < count) {
    const fb = optionFromCandidate(fallbackCandidate());
    picks.push({ ...fb, related: false });
  }
  return picks;
}

/** 回退：up_g_1（可重复数值卡，§⑧-4 S3 收敛兜底） */
function fallbackCandidate(): UpgradeV2Candidate {
  const item = UPGRADE_POOL_V3.find((u) => u.id === 'up_g_1')!;
  return { kind: 'upgrade', upgradeId: item.id, item, weight: 1 };
}

/** 池项查询（PlayScene 断言/埋点用） */
export function poolItemByIdV3(upgradeId: UpgradeId): UpgradePoolItem | undefined {
  return UPGRADE_POOL_V3.find((u) => u.id === upgradeId);
}
