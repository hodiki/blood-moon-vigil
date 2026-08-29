/**
 * config/balance/upgrade-v3.ts —— 升级池 v3 配置（B3-W1，gdd-upgrade-pool-v3 §3.1/§4）
 *
 * 池构成（定义 37 / 单局可见 ≤30，红线 32~40 NW-7）：
 * | 卡类           | 定义 | 单局可见 |
 * | 全局基础强化    | 9   | 9        | 全量继承 v2 §3.1（唯一来源防漂移，迁移不改值）
 * | 专武强化卡      | 2   | 2        | 仅当前专武（数据 8 武 × 2 = 16 条，定义按单局口径计 2）
 * | 共鸣钥          | 8   | 8        | 旧 7 重挂 + 葬仪铁钉新增；共鸣消费机制留 B4
 * | 通武强化卡      | 10  | ≤10      | 4 类 ×2 分支（v2 前两分支沿用）+ 2 通用
 * | 主动技强化      | 8   | 1        | 仅当前衍生技那张（NW-4 少量强卡）
 *
 * 边界（验收判据 ⑧ 反例红线）：圣物不进池；非当前专武卡不入池；进化卡废止（R2-3）；
 * 池定义 37 不随局内状态膨胀。
 */

import { UPGRADE_POOL, type UpgradePoolItem } from './upgrade';
import type { UpgradeId } from './ids';
import { MUTATION_CARDS } from './exclusive';
import type { DerivativeSkillId, ExclusiveWeaponId } from './exclusive';

// ============================================================================
// 池规模红线（§3.1 / 验收判据 3）
// ============================================================================

export const UPGRADE_POOL_V3_LIMITS = {
  /** 池定义总数（全局9 + 专武2 + 钥8 + 通武强化10 + 主动技8） */
  DEFINED: 37,
  /** 单局可选上限（专武过滤后 9+2+8+10+1） */
  PER_RUN_MAX: 30,
  /** 红线区间（NW-7 采纳 32~40；定义数须落区间） */
  DEFINED_REDLINE: [32, 40] as const,
} as const;

// ============================================================================
// 全局基础强化 ×9（§4.1：全量继承 v2 §3.1，迁移不改值）
// ============================================================================

/** 全局 9 直接引用 v2 池同对象（防双源漂移——GDD §4.1「清单以 v2 §3.1 为唯一来源」） */
export const UPGRADE_POOL_V3_GLOBAL: readonly UpgradePoolItem[] = UPGRADE_POOL.filter((u) => u.id.startsWith('up_g_'));

// ============================================================================
// 专武强化卡（§4.2：质变卡 1 走 P1 保底 / 卡 2 赠送制不进三选一）
// ============================================================================

/** 质变卡 → 池项形态（卡 1 进池；卡 2 仅数据登记，抽取引擎不产出——验收判据 4） */
function mutationPoolItem(exclusiveId: ExclusiveWeaponId, order: 1 | 2): UpgradePoolItem {
  const card = MUTATION_CARDS.find((c) => c.exclusiveId === exclusiveId && c.order === order)!;
  return {
    id: card.id as UpgradeId,
    name: card.name,
    type: 'mechanic',
    tags: ['global'], // 入池资格在引擎按「当前专武」过滤（tag 仅为池项结构占位）
    desc: card.desc,
    maxStack: 1,
    cardKind: 'blue-purple',
  };
}

/** 全部 8 专武 × 卡 1（数据条目；单局仅当前专武 1 条入池） */
const ALL_EXCLUSIVES: readonly ExclusiveWeaponId[] = [
  'xw_lantern', 'xw_revolver', 'xw_twinblades', 'xw_longbow', 'xw_bell', 'xw_cross', 'xw_axe', 'xw_horn',
];

export const UPGRADE_POOL_V3_MUTATION_1: readonly UpgradePoolItem[] = ALL_EXCLUSIVES.map((w) => mutationPoolItem(w, 1));

/** 卡 2 数据登记（赠送制，不进三选一；抽取引擎断言不产出） */
export const UPGRADE_POOL_V3_MUTATION_2: readonly UpgradePoolItem[] = ALL_EXCLUSIVES.map((w) => mutationPoolItem(w, 2));

// ============================================================================
// 共鸣钥 ×8（§4.3：旧 7 重挂 + 葬仪铁钉新增；共鸣消费机制留 B4）
// ============================================================================

/** 葬仪铁钉（新增）：重击类冷却 −8%（锚点；重击类判定 = 攻击间隔 ≥2.0s 武器，消费留 B4） */
export const KEY_NAIL_HEAVY_COOLDOWN_MULT = 0.92;
/** 重击类判定阈值（攻击间隔 ≥ 此值；锚点） */
export const KEY_NAIL_HEAVY_THRESHOLD_SECONDS = 2.0;

/** 钥 8 = v2 钥 7 + 葬仪铁钉（前 7 引用 v2 池同对象防漂移） */
export const UPGRADE_POOL_V3_KEYS: readonly UpgradePoolItem[] = [
  ...UPGRADE_POOL.filter((u) => u.id.startsWith('key_')),
  {
    id: 'key_nail',
    name: '葬仪铁钉',
    type: 'mechanic',
    tags: ['key'],
    desc: '重击类武器冷却 −8%（锚点；共鸣前置，消费机制见共鸣批次）',
    maxStack: 1,
    cardKind: 'blue-purple',
  },
] as readonly UpgradePoolItem[];

// ============================================================================
// 通武强化卡 ×10（§4.4 NW-7：4 类 ×2 分支 + 2 通用；v2 前两分支沿用，第 3 分支淘汰）
// ============================================================================

/** v2 沿用的 8 项（4 类 × 前两分支；对象同源） */
export const UPGRADE_POOL_V3_WEAPON: readonly UpgradePoolItem[] = UPGRADE_POOL.filter((u) =>
  ['up_w_a1', 'up_w_a2', 'up_w_b1', 'up_w_b2', 'up_w_c1', 'up_w_c2', 'up_w_d1', 'up_w_d2'].includes(u.id),
);

/** 通用 2 张（新增；覆盖 6 把未配对通武数值诉求；机制型归口保 ≥85% 占比锚） */
export const UPGRADE_POOL_V3_WEAPON_COMMON: readonly UpgradePoolItem[] = [
  {
    id: 'up_w_g1',
    name: '猎风羽饰',
    type: 'mechanic',
    tags: ['global'],
    desc: '武器射程/弹速 +10%（通用；×2）',
    maxStack: 2,
    cardKind: 'blue-purple',
  },
  {
    id: 'up_w_g2',
    name: '守夜残章',
    type: 'mechanic',
    tags: ['global'],
    desc: '范围/持续 +10%（通用；×2）',
    maxStack: 2,
    cardKind: 'blue-purple',
  },
] as const;

// ============================================================================
// 主动技强化 ×8（§4.5 NW-4 少量强卡：单局仅当前衍生技 1 张进池，P4）
// ============================================================================

/** 衍生技 → 强化卡 id 映射（up_d_*） */
export const DERIVATIVE_UPGRADE_MAP: Record<DerivativeSkillId, UpgradeId> = {
  dv_revolver_burst: 'up_d_revolver',
  dv_lantern_flash: 'up_d_lantern',
  dv_blood_dash: 'up_d_dash',
  dv_moon_snipe: 'up_d_snipe',
  dv_requiem: 'up_d_requiem',
  dv_holy_judgment: 'up_d_judgment',
  dv_blood_rage: 'up_d_rage',
  dv_wolf_charge: 'up_d_charge',
};

/** 主动技强化 8 定义（§4.5 质变级效果锚点；单局 1 张、窗口错过不补） */
export const UPGRADE_POOL_V3_ACTIVE: readonly UpgradePoolItem[] = [
  { id: 'up_d_revolver', name: '圣痕传染', type: 'mechanic', tags: ['global'], desc: '圣痕易伤改为命中传染周围 80px 敌人（持续减半 3s）', maxStack: 1, cardKind: 'blue-purple' },
  { id: 'up_d_lantern', name: '月下无弹', type: 'mechanic', tags: ['global'], desc: '无限弹窗口 5→7s，射速爆发延长至窗口全程', maxStack: 1, cardKind: 'blue-purple' },
  { id: 'up_d_dash', name: '血宴', type: 'mechanic', tags: ['global'], desc: '突进终点血爆（25 伤 / 120px）+ 每命中 1 敌回 1 HP', maxStack: 1, cardKind: 'blue-purple' },
  { id: 'up_d_snipe', name: '贯月审判', type: 'mechanic', tags: ['global'], desc: '巨矢命中处残留月痕图腾（60px 减速 15% / 3s）', maxStack: 1, cardKind: 'blue-purple' },
  { id: 'up_d_requiem', name: '双声部', type: 'mechanic', tags: ['global'], desc: '治疗量翻倍；守誓者复活后获 4s 狂化（伤 ×1.5）', maxStack: 1, cardKind: 'blue-purple' },
  { id: 'up_d_judgment', name: '终审庭', type: 'mechanic', tags: ['global'], desc: '眩晕结束后追加余焰（100px，8 伤/s / 3s）', maxStack: 1, cardKind: 'blue-purple' },
  { id: 'up_d_rage', name: '失控边缘', type: 'mechanic', tags: ['global'], desc: '狂化期击杀延长 0.5s（上限 +3s）', maxStack: 1, cardKind: 'blue-purple' },
  { id: 'up_d_charge', name: '群狼环猎', type: 'mechanic', tags: ['global'], desc: '冲锋狼改环形包抄，命中同一目标伤 ×1.5', maxStack: 1, cardKind: 'blue-purple' },
] as const;

// ============================================================================
// v3 全量定义表（数据条目 51；定义口径 37——专武按单局当前 2 / 主动技按 8 套定义）
// ============================================================================

export const UPGRADE_POOL_V3: readonly UpgradePoolItem[] = [
  ...UPGRADE_POOL_V3_GLOBAL,
  ...UPGRADE_POOL_V3_MUTATION_1,
  ...UPGRADE_POOL_V3_MUTATION_2,
  ...UPGRADE_POOL_V3_KEYS,
  ...UPGRADE_POOL_V3_WEAPON,
  ...UPGRADE_POOL_V3_WEAPON_COMMON,
  ...UPGRADE_POOL_V3_ACTIVE,
] as const;

// ============================================================================
// P1~P5 保底序列参数（§3.2 WD-13）
// ============================================================================

export const UPGRADE_POOL_V3_RULES = {
  /** P1：质变卡 1 窗口（S1 后段 30~60s，对冲 H2；全局限 1 次） */
  P1_WINDOW: [30, 60] as const,
  /** P4：衍生技强化卡窗口（第 8~14 次升级锚；单局 1 次，错过不补） */
  P4_WINDOW: [8, 14] as const,
  /** 专武强化卡权重：对齐已拥有类 ×2，S1 额外 ×1.2（修订点 1） */
  WEIGHT_EXCLUSIVE: 2,
  EXCLUSIVE_S1_BONUS: 1.2,
  /** 共鸣钥 ×1.2（S2 起，修订点 2）；共鸣条件达成 ×5（B4 接线占位） */
  WEIGHT_KEY: 1.2,
  KEY_S2_BONUS: 1.2,
  WEIGHT_KEY_RESONANCE_READY: 5,
  /** P4 窗口内权重对齐 P3（×2 基准，修订点 3） */
  WEIGHT_P4_WINDOW: 2,
  /** 卡 2 兜底：距卡 1 后 N=8 次升级（EG-3） */
  CARD2_FALLBACK_N: 8,
  /** 双节拍时点锚（模拟口径）：卡 1 30~60s / 卡 2 90~150s */
  CARD1_BEAT: [30, 60] as const,
  CARD2_BEAT: [90, 150] as const,
} as const;

// ============================================================================
// 质变卡双节拍管线渠道开关（§3.4 / EG-3 双渠道配置开关）
// ============================================================================

export const MUTATION_PIPELINE_DEFAULTS = {
  /** 渠道 1（默认开）：首精英击杀必掉卡 2 */
  FIRST_ELITE_DROP: true,
  /** 渠道 2（默认开）：兜底——距卡 1 后 N=8 次升级直发 */
  FALLBACK_N_GRANT: true,
  /** 渠道 3（默认关）：精英宝箱（NW-2 挂账，怪物域批次回填后开启） */
  ELITE_CHEST: false,
} as const;
