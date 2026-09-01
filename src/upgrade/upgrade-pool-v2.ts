/**
 * upgrade/upgrade-pool-v2.ts —— 升级池 40 项抽取引擎（E4-S4，gdd-upgrade-pool-v2 §3.6）
 *
 * 纯函数（可脱离 Phaser 单测）：标签过滤 + 抽取规则 5 条 + 回退兜底。
 * 与 Demo 12 项引擎（upgrade-pool.ts）并存：本模块面向内容 ID 池（up_/key_/evo_），
 * PlayScene 升级流程切到 v2（E4-S4）；旧引擎保留供既有测试回归。
 *
 * 抽取规则（gdd-upgrade-pool-v2 §3.6，UPGRADE_POOL_RULES 参数化）：
 * 1. 标签过滤：全局 + 被动钥 → 所有人；武器类强化 → 持有类（含可解锁类）×2/×1；
 *    主动技强化 → 仅当前角色。单局可选池约 20~28 项。
 * 2. 未解锁武器引导：持有该类 ≥1 把 → 该类强化项权重 ×2（WEIGHT_OWNED_CLASS）；
 *    未持有该类但有未拥有武器可解锁 → ×1（WEIGHT_UNOWNED_CLASS，E4-S5 解锁变体）。
 * 3. 满级剔除 + 进化卡：已满级项剔除；超武进化卡（类满 3 + 持钥 + 未进化）入池权重 ×3。
 * 4. 防重复：上次选过项权重 ×0.5；全池满级回退 up_g_1（伤害强化可重复）。
 * 5. 超时 30s 自动第 1 张：由 LevelUpOverlay（已有 30s 超时）承担，本引擎不重复实现。
 *
 * 与 Demo 差异（v1.1 裁定）：Demo「未解锁 ×2」→「已拥有该类 ×2 + 未拥有 ×1」
 * （§3.6.2 注：v2 池武器解锁走类强化项解锁变体，不再需要为新类武器强制 ×2）。
 */

import {
  UPGRADE_POOL,
  UPGRADE_POOL_RULES,
  WEAPON_CONFIGS,
  EVOLUTIONS,
  type UpgradeId,
  type UpgradePoolItem,
  type UpgradeTag,
  type WeaponId,
  type WeaponClass,
  type HeroId,
  type EvoId,
} from '@/config/balance';
import { EVOLUTION_MIN_CLASS_STACKS } from '@/weapons/evolution-engine';
import type { UpgradeState } from '@/upgrade/upgrade-pool';
import { CLASS_BRANCH_UPGRADE_IDS } from '@/upgrade/upgrade-apply';
import type { ClassBranch } from '@/weapons/class-upgrades';

/** v2 抽取上下文（PlayScene 装配；测试注入确定性） */
export interface UpgradePoolV2Context {
  heroId: HeroId;
  /** 当前已拥有武器 id（初始武器 + 已解锁） */
  ownedWeaponIds: readonly WeaponId[];
  /** 已进化判定（EvolutionState.isEvolved） */
  isEvolved: (weaponId: WeaponId) => boolean;
  /**
   * M3-DESIGN-1 节奏：局时秒（驱动 STAGE_WEIGHT_MULT 阶段权重，upgrade-experience-v2 §2.2）。
   * 缺省（undefined）= 不应用阶段加权（既有测试/旧调用方语义不变）。
   */
  runTimeSeconds?: number;
}

/** 抽取候选 */
export interface UpgradeV2Candidate {
  kind: 'upgrade' | 'evolution';
  upgradeId?: UpgradeId;
  evoId?: EvoId;
  evoWeaponId?: WeaponId;
  item: UpgradePoolItem | null;
  weight: number;
  /** 该武器类强化项是否走「解锁变体」（未持有该类且类内还有未拥有武器） */
  unlockVariant?: boolean;
}

/** 三选一选项（LevelUpOverlay 渲染 + PlayScene 消费） */
export interface UpgradeV2Option {
  kind: 'upgrade' | 'evolution';
  upgradeId?: UpgradeId;
  evoId?: EvoId;
  name: string;
  desc: string;
  effectText: string;
  cardKind: 'blue-purple' | 'amber-gold' | 'evolution';
  /** 解锁变体：卡面 ★ 新武器徽记（E4-S5） */
  unlockVariant?: boolean;
  /**
   * M3 真机埋点：该卡是否为「build 相关卡」（upgrade-experience-v2 §2.1 related 定义：
   * 已拥有类强化 + 主动技 + 进化 + 对应钥；P5 解锁卡与全局数值卡不算）。
   * rollThreeV2 按保底席位判定写回；RunStats.recordUpgradeOffered 统计 relatedCardShare。
   */
  related?: boolean;
  /**
   * P2-2（NV-REVIEW-FIX-F）：保底席位号（P1~P5，gdd-upgrade-pool-v3 §⑧-3 裁决序）。
   * rollThreeV3 保底命中时写回（v3）；v2 旧轨不写。升级卡席位角标按此明示，替代泛「保底」。
   */
  seat?: 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
  /**
   * P2-3（NV-P2-ZERO）：共鸣预告徽记四态（值集镜像 resonance-engine.ResonanceBadgeState /
   * hud.HudResonanceBadgeState；池引擎不 import 引擎，沿 hud.ts 同款解耦惯例）。
   * undefined / 'none' = 非共鸣钥卡不渲染；升级流装配层按 resonanceBadgeState 透传。
   */
  resonanceBadge?: 'none' | 'ready-highlight' | 'awaiting-key' | 'achieved';
}

/** 标签 → 是否通过（仅当前角色 / 持有类 / 所有人） */
export function tagPasses(
  tags: readonly UpgradeTag[],
  heroId: HeroId,
  ownedClasses: ReadonlySet<WeaponClass>,
  hasUnownedWeaponInClass: (cls: WeaponClass) => boolean,
): boolean {
  for (const tag of tags) {
    if (tag === 'global' || tag === 'key') return true; // 所有人
    if (tag.startsWith('weapon_class_')) {
      const cls = tag.replace('weapon_class_', '').toUpperCase() as WeaponClass;
      // 持有类 → 出现；未持有但有可解锁武器 → 出现（E4-S5 解锁变体）；否则过滤
      return ownedClasses.has(cls) || hasUnownedWeaponInClass(cls);
    }
    if (tag.startsWith('hero_')) return tag === heroId; // 仅当前角色
  }
  return false;
}

/** 类强化项权重：持有该类 ×2；未持有但可解锁 ×1（gdd §3.6.2 v1.1 裁定） */
export function classUpgradeWeight(
  item: UpgradePoolItem,
  ownedClasses: ReadonlySet<WeaponClass>,
  hasUnownedWeaponInClass: (cls: WeaponClass) => boolean,
): number {
  const cls = classOfItem(item);
  if (ownedClasses.has(cls)) return UPGRADE_POOL_RULES.WEIGHT_OWNED_CLASS;
  if (hasUnownedWeaponInClass(cls)) return UPGRADE_POOL_RULES.WEIGHT_UNOWNED_CLASS;
  return 1;
}

/** 从武器类强化项取所属类（up_w_a1 → A） */
export function classOfItem(item: UpgradePoolItem): WeaponClass {
  const id = item.id;
  const branch = (id as string).replace('up_w_', '') as ClassBranch;
  return branch[0]!.toUpperCase() as WeaponClass;
}

// ============================================================================
// M3-DESIGN-1 阶段节奏（upgrade-experience-v2 §2.2 / §4.2）
// ============================================================================

/** 升级阶段（按局时秒；0–120 S1 / 120–240 S2 / 240–360 S3 / 360+ BOSS） */
export type UpgradeStage = 'S1' | 'S2' | 'S3' | 'BOSS';

/** 局时秒 → 阶段（§2.2 阶段划分；Boss 战 360s+ 与 S3 同为进化兑现期） */
export function stageOfRunTime(runTimeSeconds: number): UpgradeStage {
  if (runTimeSeconds < 120) return 'S1';
  if (runTimeSeconds < 240) return 'S2';
  if (runTimeSeconds < 360) return 'S3';
  return 'BOSS';
}

/** 阶段权重类目（STAGE_WEIGHT_MULT 键；evolution 不乘阶段，由 P1 保底 + ×5 处理） */
export type StageWeightCategory = 'unlock' | 'ownedClass' | 'key' | 'active' | 'numeric';

/** 候选 → 阶段权重类目（数值方向卡 = up_g_1~4 按 ID，不受 type 改造影响） */
export function stageCategoryOfCandidate(c: UpgradeV2Candidate): StageWeightCategory | 'evolution' | 'other' {
  if (c.kind === 'evolution') return 'evolution';
  const id = c.upgradeId!;
  if (id.startsWith('up_w_')) return c.unlockVariant ? 'unlock' : 'ownedClass';
  if (id.startsWith('key_')) return 'key';
  if (id.startsWith('up_a_')) return 'active';
  if (id === 'up_g_1' || id === 'up_g_2' || id === 'up_g_3' || id === 'up_g_4') return 'numeric';
  return 'other'; // up_g_5~9 全局机制项恒 ×1.0
}

/** 阶段倍率（无 runTimeSeconds → 1.0；evolution/other 恒 1.0） */
export function stageMultForCandidate(c: UpgradeV2Candidate, runTimeSeconds: number | undefined): number {
  if (runTimeSeconds === undefined) return 1;
  const cat = stageCategoryOfCandidate(c);
  if (cat === 'evolution' || cat === 'other') return 1;
  return UPGRADE_POOL_RULES.STAGE_WEIGHT_MULT[stageOfRunTime(runTimeSeconds)][cat];
}

/** 构造候选池（标签过滤 + 满级剔除 + 权重；进化卡满足条件时入池；阶段权重可选） */
export function buildV2Candidates(state: UpgradeState, ctx: UpgradePoolV2Context): UpgradeV2Candidate[] {
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
  for (const item of UPGRADE_POOL) {
    if (state.stackOf(item.id) >= item.maxStack) continue; // 规则 3：满级剔除
    if (!tagPasses(item.tags, ctx.heroId, ownedClasses, hasUnownedWeaponInClass)) continue;
    let weight = 1;
    let unlockVariant = false;
    if (item.tags.some((t) => t.startsWith('weapon_class_'))) {
      weight = classUpgradeWeight(item, ownedClasses, hasUnownedWeaponInClass);
      const cls = classOfItem(item);
      // E4-S5：未持有该类武器 → 该次选择 = 解锁 1 把随机该类未拥有武器（卡面 ★）
      unlockVariant = !ownedClasses.has(cls) && hasUnownedWeaponInClass(cls);
    }
    // 规则 4：防重复 —— 上次选过项权重 ×0.5
    if (state.lastPickId === item.id) weight *= UPGRADE_POOL_RULES.WEIGHT_LAST_PICK;
    // M3-DESIGN-1 阶段权重（§2.2）：基础权重 × 阶段倍率 × 防重复倍率（§4.2-4 固定顺序）
    const candidate: UpgradeV2Candidate = { kind: 'upgrade', upgradeId: item.id, item, weight, unlockVariant };
    candidate.weight *= stageMultForCandidate(candidate, ctx.runTimeSeconds);
    pool.push(candidate);
  }

  // 规则 3：超武进化卡（类成型 2 + 持钥 + 未进化 + 持有主武器 → 权重 ×5；满足后 P1 必占一席）
  for (const evo of EVOLUTIONS) {
    const wpn = evo.wpnId;
    if (ctx.isEvolved(wpn)) continue;
    if (!ctx.ownedWeaponIds.includes(wpn)) continue; // 需持有主武器
    const wpnCfg = WEAPON_CONFIGS[wpn];
    const classStacks = state.classUpgradeTotalFor(wpnCfg.class);
    if (classStacks < EVOLUTION_MIN_CLASS_STACKS) continue;
    if (!state.hasKey(evo.keyId)) continue;
    pool.push({
      kind: 'evolution',
      evoId: evo.evoId,
      evoWeaponId: wpn,
      item: null,
      weight: UPGRADE_POOL_RULES.WEIGHT_EVOLUTION,
    });
  }
  return pool;
}

/** 全池（当前标签）候选为空时回退：up_g_1 伤害强化（可重复，§3.6.4/§⑥.3） */
export function fallbackV2Candidate(): UpgradeV2Candidate {
  const item = UPGRADE_POOL.find((u) => u.id === UPGRADE_POOL_RULES.FALLBACK_ID) ?? UPGRADE_POOL[0]!;
  return { kind: 'upgrade', upgradeId: item.id, item, weight: 1 };
}

// ============================================================================
// M3-DESIGN-1 向心性保底席位（upgrade-experience-v2 §2.1）
// 每轮三选一按优先级保证 1 张「build 相关卡」；保底与权重独立，不额外加权。
// ============================================================================

/** 候选是否为「已拥有类强化」项（非解锁变体）—— 保底 P3 */
function isOwnedClassCandidate(c: UpgradeV2Candidate): boolean {
  return c.kind === 'upgrade' && c.upgradeId!.startsWith('up_w_') && !c.unlockVariant;
}

/** 候选是否为「主动技强化」项 —— 保底 P4 */
function isActiveCandidate(c: UpgradeV2Candidate): boolean {
  return c.kind === 'upgrade' && c.upgradeId!.startsWith('up_a_');
}

/** 候选是否为「未拥有类解锁卡」（解锁变体）—— 保底 P5 兜底 */
function isUnlockCandidate(c: UpgradeV2Candidate): boolean {
  return c.kind === 'upgrade' && !!c.unlockVariant;
}

/**
 * M3 真机埋点：候选是否为「build 相关卡」（upgrade-experience-v2 §2.1 related 定义）。
 * - 进化卡（P1）→ related
 * - 已拥有类强化项（P3，非解锁变体）→ related
 * - 主动技强化（P4）→ related
 * - 对应钥（P2）：EVOLUTIONS 路径中该类已投入（类强化 ≥1）→ related；泛用钥不算
 * - P5 未拥有类解锁卡（「有新东西」兜底）→ 非 related
 * - 全局数值卡（up_g_*，含回退 up_g_1）→ 非 related
 */
export function isRelatedCandidate(c: UpgradeV2Candidate, state: UpgradeState): boolean {
  if (c.kind === 'evolution') return true;
  const id = c.upgradeId!;
  if (id.startsWith('up_w_')) return !c.unlockVariant;
  if (id.startsWith('up_a_')) return true;
  if (id.startsWith('key_')) {
    return EVOLUTIONS.some((e) => {
      if (e.keyId !== id) return false;
      const cls = WEAPON_CONFIGS[e.wpnId]?.class;
      return cls !== undefined && state.classUpgradeTotalFor(cls) >= 1;
    });
  }
  return false;
}

/** 级内加权抽样（集合内多项按各自权重加权；random 注入） */
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

/**
 * 保底 P2：进化路径钥（upgrade-experience-v2 §2.1 / §2.4 规则 2）。
 * 可进化类（有 EVOLUTIONS 映射且已持有该类武器）中，取「该类类强化 ≥1 且未持对应钥」者；
 * 多项时取类强化累计最高者，平局取初始武器类。返回该钥候选（无则 null）。
 */
export function pickPathKeyCandidate(state: UpgradeState, ctx: UpgradePoolV2Context, pool: UpgradeV2Candidate[]): UpgradeV2Candidate | null {
  const ownedClasses = new Set<WeaponClass>();
  for (const w of ctx.ownedWeaponIds) {
    const cfg = WEAPON_CONFIGS[w];
    if (cfg) ownedClasses.add(cfg.class);
  }
  // 初始武器类（ctx.ownedWeaponIds[0] 即初始武器；平局取它）
  const initialClass = ctx.ownedWeaponIds[0] ? WEAPON_CONFIGS[ctx.ownedWeaponIds[0]]?.class : undefined;

  let best: { cls: WeaponClass; total: number } | null = null;
  for (const cls of ownedClasses) {
    // 该类是否有已持有的可进化武器（EVOLUTIONS 映射）
    const hasEvolvableOwned = ctx.ownedWeaponIds.some((w) => WEAPON_CONFIGS[w].class === cls && EVOLUTIONS.some((e) => e.wpnId === w));
    if (!hasEvolvableOwned) continue;
    const total = state.classUpgradeTotalFor(cls);
    if (total < 1) continue; // P2 条件：该类类强化 ≥1（§2.4 规则 2）
    const evo = EVOLUTIONS.find((e) => WEAPON_CONFIGS[e.wpnId].class === cls && ctx.ownedWeaponIds.includes(e.wpnId));
    if (!evo) continue;
    if (state.hasKey(evo.keyId)) continue; // 已持钥 → P2 跳过，P3 引导补第 2 次
    if (!pool.some((c) => c.upgradeId === evo.keyId)) continue; // 钥不在池（满级/过滤）
    if (!best || total > best.total) best = { cls, total };
    else if (total === best.total && cls === initialClass) best = { cls, total }; // 平局取初始武器类
  }
  if (!best) return null;
  const evo = EVOLUTIONS.find((e) => WEAPON_CONFIGS[e.wpnId].class === best!.cls && ctx.ownedWeaponIds.includes(e.wpnId))!;
  return pool.find((c) => c.upgradeId === evo.keyId) ?? null;
}

/**
 * 保底席位抽样（GUARANTEE_PRIORITY 五级，upgrade-experience-v2 §2.1）：
 * P1 进化卡（多项取权重最高者）→ P2 领先类钥 → P3 已拥有类强化 → P4 主动技 → P5 解锁卡兜底。
 * P1~P5 全空（理论仅全池满级）→ null（调用方回退 up_g_1）。
 */
export function pickGuaranteeCandidate(
  state: UpgradeState,
  ctx: UpgradePoolV2Context,
  pool: UpgradeV2Candidate[],
  random: () => number = Math.random,
): UpgradeV2Candidate | null {
  if (!UPGRADE_POOL_RULES.GUARANTEE_RELATED) return null;
  // P1 进化卡：多项取权重最高者（×5 后即第二张优先级上升，§2.4 规则 3）
  const evos = pool.filter((c) => c.kind === 'evolution');
  if (evos.length > 0) {
    let best = evos[0]!;
    for (const e of evos) if (e.weight > best.weight) best = e;
    return best;
  }
  // P2 进化路径钥：领先类（类强化 ≥1 且未持钥）对应钥
  const p2 = pickPathKeyCandidate(state, ctx, pool);
  if (p2) return p2;
  // P3 已拥有类强化（未满级分支；初始武器类必然已拥有，P3 永不空除非满级剔除）
  const p3 = weightedPick(pool.filter(isOwnedClassCandidate), random);
  if (p3) return p3;
  // P4 主动技强化（未满）
  const p4 = weightedPick(pool.filter(isActiveCandidate), random);
  if (p4) return p4;
  // P5 未拥有类解锁卡（兜底「有新东西」）
  const p5 = weightedPick(pool.filter(isUnlockCandidate), random);
  if (p5) return p5;
  return null; // P1~P5 全空 → 回退 up_g_1
}

/** 加权不放回抽样取 n 项（random 可注入；候选不足时用回退补齐） */
export function rollThreeV2(
  state: UpgradeState,
  ctx: UpgradePoolV2Context,
  random: () => number = Math.random,
  count = 3,
): UpgradeV2Option[] {
  const pool = buildV2Candidates(state, ctx);
  if (pool.length === 0) {
    const fb = fallbackV2Candidate();
    const opt = { ...optionFromCandidate(fb), related: false }; // 回退 up_g_1 非 build 相关卡
    return Array.from({ length: count }, () => ({ ...opt }));
  }
  const picks: UpgradeV2Option[] = [];
  const remaining = [...pool];
  // M3 真机埋点：候选 → 选项并附 related 标记（供 RunStats.recordUpgradeOffered 统计 relatedCardShare）
  const optionWithRelated = (c: UpgradeV2Candidate): UpgradeV2Option => ({
    ...optionFromCandidate(c),
    related: isRelatedCandidate(c, state),
  });

  // M3-DESIGN-1 向心性保底席位：先按优先级保底 1 张 build 相关卡（占 1 席），并从全池剔除防重复
  const guarantee = pickGuaranteeCandidate(state, ctx, pool, random);
  if (guarantee) {
    picks.push(optionWithRelated(guarantee));
    const gi = remaining.findIndex((c) => candidateSameId(c, guarantee));
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
    picks.push(optionWithRelated(picked));
  }
  // 候选不足 3（理论仅全满级回退场景）用回退补齐
  while (picks.length < count) {
    const fb = optionFromCandidate(fallbackV2Candidate());
    if (!picks.some((p) => p.upgradeId === fb.upgradeId)) picks.push({ ...fb, related: false });
    else picks.push({ ...fb, related: false });
  }
  return picks;
}

/** 候选同 id 判定（upgrade 按 upgradeId；evolution 按 evoId；兜底 equal by ref） */
function candidateSameId(a: UpgradeV2Candidate, b: UpgradeV2Candidate): boolean {
  if (a.kind === 'evolution' && b.kind === 'evolution') return a.evoId === b.evoId;
  if (a.kind === 'upgrade' && b.kind === 'upgrade') return a.upgradeId === b.upgradeId;
  return a === b;
}

/** 候选 → 渲染选项 */
export function optionFromCandidate(c: UpgradeV2Candidate): UpgradeV2Option {
  if (c.kind === 'evolution' && c.item === null) {
    const evo = EVOLUTIONS.find((e) => e.evoId === c.evoId);
    return {
      kind: 'evolution',
      evoId: c.evoId,
      name: `进化：${evo?.name ?? ''}`,
      desc: evo?.effect ?? '',
      effectText: '进化（不可逆）',
      cardKind: 'evolution',
    };
  }
  const item = c.item!;
  return {
    kind: 'upgrade',
    upgradeId: item.id,
    name: item.name,
    desc: item.desc,
    effectText: item.type === 'mechanic' ? '机制改变' : '数值提升',
    cardKind: item.cardKind,
    unlockVariant: c.unlockVariant,
  };
}

/** 便捷：按内容 ID 查池项（PlayScene 回退/断言用） */
export function poolItemById(upgradeId: UpgradeId): UpgradePoolItem | undefined {
  return UPGRADE_POOL.find((u) => u.id === upgradeId);
}

export { CLASS_BRANCH_UPGRADE_IDS };
