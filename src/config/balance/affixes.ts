/**
 * config/balance/affixes.ts —— 精英词缀（W-6 / MN-4 定稿 3 词缀 + 方阵互斥，gdd-enemies-v3 §③-5）
 *
 * 词缀 = 精英专属配置字段（词缀精英仍是 5 精英本体，非新敌种）；二级视觉编码
 * （幽紫精英编码 + 角饰/色相补位，演出属内容批）；首版单词缀；
 * 方阵成员不吃词缀（MN-4）；词缀不入图鉴（MN-11，词缀名仅作场上标识与掉落文案）；
 * unlockAt 180s（轨③，与技能化精英同期——180s 起生成的精英携带技能化行为 + 词缀）。
 */

/** 词缀 ID（3 定稿） */
export type AffixId = 'affix_tough' | 'affix_swift' | 'affix_corrupt';

/** 单词缀效果配置（锚；gdd-enemies-v3 §③-5 表） */
export interface AffixConfig {
  id: AffixId;
  name: string;
  /** HP 倍率（坚韧 ×1.5~1.8 锚，中值 1.65） */
  hpMult?: number;
  /** 移速倍率（迅捷 ×1.25） */
  speedMult?: number;
  /** 攻击间隔倍率（迅捷 −15% → ×0.85） */
  attackIntervalMult?: number;
  /** 治疗效能倍率（腐蚀光环内 ×0.7——道具/铃/回血同折） */
  healEffMult?: number;
  /** 光环半径（腐蚀 120px） */
  auraRadius?: number;
  /** 体型倍率（坚韧 +10%） */
  sizeMult: number;
  /** 反制（可读） */
  counter: string;
  /** 叙事词根 */
  narrative: string;
}

/** 三词缀配置（MN-4 定稿） */
export const AFFIXES: Record<AffixId, AffixConfig> = {
  affix_tough: {
    id: 'affix_tough', name: '血月印记·坚韧',
    hpMult: 1.65, sizeMult: 1.1,
    counter: '集火优先（击杀时间拉长不质变）',
    narrative: '血/月',
  },
  affix_swift: {
    id: 'affix_swift', name: '血月印记·迅捷',
    speedMult: 1.25, attackIntervalMult: 0.85, sizeMult: 1,
    counter: '距离拉扯、优先击杀',
    narrative: '月（血月狂化）',
  },
  affix_corrupt: {
    id: 'affix_corrupt', name: '血月印记·腐蚀',
    healEffMult: 0.7, auraRadius: 120, sizeMult: 1,
    counter: '光环源优先集火（尸巫反制语法）',
    narrative: '血（血术污染）',
  },
};

/** 词缀纪律（§③-5 红线） */
export const AFFIX_RULES = {
  /** 轨③ 解锁：180s 起生成的精英携带词缀 */
  unlockAt: 180,
  /** 单词缀/精英（❌ 词缀叠乘 >1） */
  singlePerElite: true,
  /** 方阵成员不吃词缀（F-8 / MN-4） */
  formationExcluded: true,
  /** 首版不叠词缀的远程技能化精英（掷骨者/忏悔者——远程 + 词缀 = 认知过载） */
  excludedEnemyIds: ['enemy_g1_8', 'enemy_g2_5'] as readonly string[],
  /** 词缀精英 XP ×1.2 锚（❌ 额外道具——宝箱渠道唯一性） */
  xpMult: 1.2,
  /** ❌ 词缀含硬控免疫（与精英 ×0.5 打架） */
  noHardCcImmunity: true,
} as const;

/**
 * 词缀掷取（180s 起的 tank 槽精英生成时三选一均匀；r ∈ [0,1)）。
 * 排除表（掷骨者/忏悔者）返回 null；t < unlockAt 返回 null。
 */
export function rollAffix(enemyId: string, t: number, r: number): AffixId | null {
  if (t < AFFIX_RULES.unlockAt) return null;
  if (AFFIX_RULES.excludedEnemyIds.includes(enemyId)) return null;
  const ids = Object.keys(AFFIXES) as AffixId[];
  const idx = Math.min(ids.length - 1, Math.max(0, Math.floor(r * ids.length)));
  return ids[idx]!;
}

/** 腐蚀光环可作用对象最小形状 */
export interface CorruptAuraSourceLike {
  x: number;
  y: number;
  affix?: string | null;
}

/**
 * 玩家当前治疗效能倍率（MN-4 腐蚀：任一腐蚀精英 120px 内 → ×0.7；多个不叠取单值）。
 * 消费口 = HealManager.healEfficiencyProvider（道具拾取路径；铃/回血路径由调用方同折）。
 */
export function corruptHealMultFor(
  sources: Iterable<CorruptAuraSourceLike>,
  player: { x: number; y: number },
): number {
  for (const s of sources) {
    if (s.affix !== 'affix_corrupt') continue;
    if (Math.hypot(s.x - player.x, s.y - player.y) <= (AFFIXES.affix_corrupt.auraRadius ?? 120)) {
      return AFFIXES.affix_corrupt.healEffMult ?? 1;
    }
  }
  return 1;
}
