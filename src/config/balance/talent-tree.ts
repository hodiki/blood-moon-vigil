/**
 * config/balance/talent-tree.ts —— 局外天赋树「滤月余辉」配置（B5-W1，gdd-talent-tree §③/§④）
 *
 * 树结构 T3 混合（GT-3）：全局主干 26（树根 1 + 质变 10 + 属性铺位 15）+ 角色支线 4×3~4（锚 14）≈ 40 节点。
 * 成本锚（§3.3，BUG-5 关闭前不定版——EG-8 只调配置）：质变 42 / 属性 12/层 / 支线 18（顶点 25）
 * → 总成本 990 ∈ [800, 1000] 区间断言（属性 10/层 · 支线 15/顶点 25）。
 * 属性三桶折算（GT-5 R3）：伤害 ≤8% / 生存 ≤6% / 合成 ≤10%（折算系数为锚，模拟批次校准）。
 * 深度 ≤4 层 / 每层宽 ≤3 / 防跳点门槛（层2=30 / 层3=120 / 层4=260 累计消耗）。
 */

import type { HeroId } from './ids';

/** 树节点 id（质变 Q-* + 属性 a-* + 支线 br_<hero>_*） */
export type TalentNodeId =
  | 'q_a' | 'q_b' | 'q_c' | 'q_d' | 'q_e' | 'q_f1' | 'q_f2' | 'q_f3' | 'q_s1' | 'q_s3' | 'q_s4'
  | 'a_attack' | 'a_attack_2' | 'a_damage' | 'a_damage_2' | 'a_attack_speed' | 'a_cooldown'
  | 'a_xp_gain' | 'a_xp_gain_2' | 'a_magnet' | 'a_magnet_2' | 'a_life' | 'a_life_2'
  | 'a_move_speed' | 'a_heal_efficiency' | 'a_pickup_radius'
  | 'br_edmund_1' | 'br_edmund_2' | 'br_edmund_top'
  | 'br_cassandra_1' | 'br_cassandra_2' | 'br_cassandra_top'
  | 'br_violet_1' | 'br_violet_2' | 'br_violet_top'
  | 'br_galvan_1' | 'br_galvan_2' | 'br_galvan_top';

export type TalentNodeKind = 'root' | 'mutation' | 'attribute' | 'branch';
/** 属性三桶（GT-5 R3：节奏类不折算不计入强度红线） */
export type TalentBucket = 'damage' | 'survival' | 'tempo' | 'none';

export interface TalentNodeConfig {
  id: TalentNodeId;
  kind: TalentNodeKind;
  name: string;
  /** 文案初稿（GDD §⑤-2，待用户终审） */
  desc: string;
  /** 点亮成本（余辉点；树根 0） */
  cost: number;
  /** 树层（1~4；深度 ≤4 §3.1） */
  layer: 1 | 2 | 3 | 4;
  /** 父节点（前置依赖；树根无） */
  parent?: TalentNodeId;
  /** 可购买次数（质变/支线 1；属性按点位层数） */
  maxPurchases: number;
  /** 图鉴轻联动前置（GT-12 定稿 4 项 L-1~L-4；其余节点零图鉴依赖） */
  codexPrerequisite?: 'codex_moon_avatar' | 'codex_heroes_all' | 'codex_entries_25' | 'codex_entries_40';
  /** 属性桶归属（质变/支线 = 'none'，支线效果计入所属桶见 node 内 effect 折算） */
  bucket?: TalentBucket;
  /** 机器参数（属性：每层效果 + 折算系数；质变：运行时消费键） */
  machine: Readonly<Record<string, number>>;
}

/**
 * 防跳点门槛（§3.1 锚 30/120/260）。工程语义（防首节点死锁）：**进入层 N 的门槛** = 该层首个节点仅
 * 需父点亮；同层后续节点需「更浅层累计消耗 ≥ 前一层门槛」（层3 需 30 / 层4 需 120）。
 * GDD 锚值原样保留于本表，语义映射见 tree-state.canUnlockNode 注释。
 */
export const TALENT_LAYER_THRESHOLDS = { 1: 0, 2: 30, 3: 120, 4: 260 } as const;
/** 进入层 N 的实际门槛（浅层累计消耗；层 1/2 仅需父点亮） */
export const TALENT_LAYER_ENTRY = { 1: 0, 2: 0, 3: 30, 4: 120 } as const;

/** 三桶折算系数（每层 DPS/承伤等效 %——锚，模拟批次校准；合成断言 ≤10% 联动） */
export const TALENT_BUCKET_EQUIV = {
  /** 伤害桶每层 DPS 等效 % */
  damage: { a_attack: 0.4, a_damage: 1.2, a_attack_speed: 0.5, a_cooldown: 0.4 },
  /** 生存桶每层承伤等效 % */
  survival: { a_life: 0.7, a_move_speed: 0.5, a_heal_efficiency: 0.5 },
} as const;

/** 红线（§3.6）：伤害 ≤8% / 生存 ≤6% / 合成 ≤10% */
export const TALENT_REDLINE = { damage: 0.08, survival: 0.06, combined: 0.10 } as const;

/** 属性节点每层效果（锚，§4.2；应用进 PlayerStats） */
export const TALENT_ATTRIBUTE_EFFECTS = {
  a_attack: { attackFlat: 2 },           // +1~2 基础伤 → 锚 2
  a_damage: { damagePct: 0.02 },          // +2%
  a_attack_speed: { attackSpeedPct: 0.02 }, // +2%
  a_cooldown: { cooldownPct: 0.03 },      // −3%（全源折减下限 −40%，A-4）
  a_xp_gain: { xpGainPct: 0.05 },         // +5%
  a_magnet: { magnetRadius: 20 },         // +20px
  a_life: { maxHp: 15 },                  // +15 HP
  a_move_speed: { moveSpeedPct: 0.02 },   // +2%
  a_heal_efficiency: { healEfficiencyPct: 0.10 }, // +10%
  a_pickup_radius: { pickupRadius: 10 },  // +10px
} as const;

/** 全源冷却折减下限（A-4 备注：防与月相秘典 −10% 等叠加穿底） */
export const TALENT_COOLDOWN_FLOOR = 0.6;

/** 角色支线（§4.3 轻规格；各支线含顶点「同袍之诺」） */
const BRANCH_DESCS = {
  edmund: ['拾取半径 +10px ×2', '范围 +5% ×2（灯环/领域类）', '顶点·同袍之诺'],
  cassandra: ['受击后 1s 移速 +10% ×2', '吸血效 +25% ×2（血契双刃命中回复）', '顶点·同袍之诺'],
  violet: ['治疗效能 +10% ×2', '守誓者墓碑回血 +1 HP/s ×2', '顶点·同袍之诺'],
  galvan: ['击杀回血 +0.5 HP ×2', '狂化期移速 +5% ×2', '顶点·同袍之诺'],
} as const;

/**
 * 支线 machine 锚（P1-7 补齐：§4.3 轻规格数值；消费见 tree-state.attributeDeltaOf +
 * PlayScene.applyTreeToStats 接线——拾取半径/治疗效能走既有属性口，其余走专属消费点）。
 * 顶点「同袍之诺」= 图鉴轻联动节点（L-2，前置 codex_heroes_all），无数值效果，machine 保持空。
 */
const BRANCH_MACHINES: Record<'edmund' | 'cassandra' | 'violet' | 'galvan', [Record<string, number>, Record<string, number>]> = {
  edmund: [{ pickupRadius: 10 }, { areaPct: 0.05 }],        // ① 拾取半径 +10px ② 范围 +5%（灯环/领域类）
  cassandra: [{ hitMoveSpeedPct: 0.10 }, { lifestealHealPct: 0.25 }], // ① 受击移速 +10% ② 吸血效 +25%（双刃命中回复）
  violet: [{ healEfficiencyPct: 0.10 }, { tombHealFlat: 1 }], // ① 治疗效能 +10% ② 守誓者墓碑回血 +1 HP/s
  galvan: [{ killHealFlat: 0.5 }, { rageMoveSpeedPct: 0.05 }], // ① 击杀回血 +0.5 HP ② 狂化期移速 +5%
};

/** 全节点表（§④；主干 26 + 支线 12+4 顶点 = 全部 38 条目 ≈40 锚） */
export const TALENT_TREE: readonly TalentNodeConfig[] = [
  // ---- 树根（1）----
  { id: 'q_a', kind: 'root', name: '认灯', desc: '第一盏灯认领了你——落选的那盏化为剑技随行。', cost: 0, layer: 1, maxPurchases: 1, machine: {} },
  // ---- 质变节点（10）----
  { id: 'q_b', kind: 'mutation', name: '伴灯', desc: '你尚未开口，与你成对的灯已先一步点亮。（开局自带配对共鸣通武·全额）', cost: 42, layer: 2, parent: 'q_a', maxPurchases: 1, machine: {} },
  { id: 'q_c', kind: 'mutation', name: '残焰托誓', desc: '同伴的灯在你熄灭处多亮了一瞬。（HP 归 0 复活一次：50% HP + 1.5s 无敌 + 击退 100px）', cost: 42, layer: 2, parent: 'q_a', maxPurchases: 1, machine: { reviveHpPct: 0.5, invulnSeconds: 1.5, knockbackPx: 100 } },
  { id: 'q_d', kind: 'mutation', name: '携行旧兵', desc: '旧夜里用惯的那件兵器，今夜不等召唤便已在手。（预选 1 把已解锁通武进局即得；GT-8 共存）', cost: 42, layer: 2, parent: 'q_a', maxPurchases: 1, machine: {} },
  { id: 'q_s1', kind: 'mutation', name: '银炉预热', desc: '开战前，银炉替你把今夜的第一炉银烧到白热。（开局 30s 内伤害 +20%、攻速 +20%）', cost: 42, layer: 2, parent: 'q_a', maxPurchases: 1, machine: { windowSeconds: 30, damagePct: 0.2, attackSpeedPct: 0.2 } },
  { id: 'q_f1', kind: 'mutation', name: '首猎之赏', desc: '第一个倒下的强者，把它的份例让给了你。（每局首个精英击杀 +1 次 offer）', cost: 42, layer: 2, parent: 'q_a', maxPurchases: 1, machine: {} },
  { id: 'q_e', kind: 'mutation', name: '再燃', desc: '余辉记得每一盏该燃未燃的灯。（复活次数 1→2；第二次 30% 递减）', cost: 42, layer: 3, parent: 'q_c', maxPurchases: 1, machine: { reviveHpPct2: 0.3 } },
  { id: 'q_f2', kind: 'mutation', name: '二赏', desc: '第二份赏格无人认领——守夜会替你收下了。', cost: 42, layer: 3, parent: 'q_f1', maxPurchases: 1, machine: {} },
  { id: 'q_s3', kind: 'mutation', name: '遗言余烬', desc: '倒下的那一刻，灯芯里溅出一粒不肯熄的火。（首次 HP 归零掉 30 XP 余烬；无复活终局 +2 余辉）', cost: 42, layer: 3, parent: 'q_s1', maxPurchases: 1, machine: { emberXp: 30, emberMerit: 2 }, codexPrerequisite: 'codex_moon_avatar' },
  { id: 'q_f3', kind: 'mutation', name: '三钟', desc: '第三次钟声为猎手而鸣。', cost: 42, layer: 3, parent: 'q_f2', maxPurchases: 1, machine: {} },
  { id: 'q_s4', kind: 'mutation', name: '双灯并祀', desc: '落选的灯不必等深夜——今夜它与你同坛受祀。（消耗 1 次升级换衍生技强化卡 P4 前置）', cost: 42, layer: 3, parent: 'q_d', maxPurchases: 1, machine: {} },
  // ---- 属性铺位 15（10 类型，5 双点位；层数合计 23）----
  { id: 'a_attack', kind: 'attribute', name: '攻击', desc: '手比昨日更稳一分。', cost: 10, layer: 2, parent: 'q_a', maxPurchases: 2, bucket: 'damage', machine: TALENT_ATTRIBUTE_EFFECTS.a_attack },
  { id: 'a_attack_2', kind: 'attribute', name: '攻击·Ⅱ', desc: '手比昨日更稳一分。', cost: 10, layer: 3, parent: 'a_attack', maxPurchases: 1, bucket: 'damage', machine: TALENT_ATTRIBUTE_EFFECTS.a_attack },
  { id: 'a_damage', kind: 'attribute', name: '伤害', desc: '灯焰烧得更透。', cost: 10, layer: 2, parent: 'q_a', maxPurchases: 2, bucket: 'damage', machine: TALENT_ATTRIBUTE_EFFECTS.a_damage },
  { id: 'a_damage_2', kind: 'attribute', name: '伤害·Ⅱ', desc: '灯焰烧得更透。', cost: 10, layer: 3, parent: 'a_damage', maxPurchases: 1, bucket: 'damage', machine: TALENT_ATTRIBUTE_EFFECTS.a_damage },
  { id: 'a_attack_speed', kind: 'attribute', name: '攻速', desc: '心跳追上了弹巢。', cost: 10, layer: 2, parent: 'q_a', maxPurchases: 2, bucket: 'damage', machine: TALENT_ATTRIBUTE_EFFECTS.a_attack_speed },
  { id: 'a_cooldown', kind: 'attribute', name: '冷却', desc: '祷言短了，落得更密。', cost: 10, layer: 3, parent: 'a_attack_speed', maxPurchases: 2, bucket: 'damage', machine: TALENT_ATTRIBUTE_EFFECTS.a_cooldown },
  { id: 'a_xp_gain', kind: 'attribute', name: '经验获取', desc: '你开始看得懂夜的语法。', cost: 10, layer: 2, parent: 'q_a', maxPurchases: 1, bucket: 'tempo', machine: TALENT_ATTRIBUTE_EFFECTS.a_xp_gain },
  { id: 'a_xp_gain_2', kind: 'attribute', name: '经验获取·Ⅱ', desc: '你开始看得懂夜的语法。', cost: 10, layer: 3, parent: 'a_xp_gain', maxPurchases: 1, bucket: 'tempo', machine: TALENT_ATTRIBUTE_EFFECTS.a_xp_gain, codexPrerequisite: 'codex_entries_25' },
  { id: 'a_magnet', kind: 'attribute', name: '磁力', desc: '散落的余辉认得回家的路。', cost: 10, layer: 2, parent: 'q_a', maxPurchases: 1, bucket: 'tempo', machine: TALENT_ATTRIBUTE_EFFECTS.a_magnet },
  { id: 'a_magnet_2', kind: 'attribute', name: '磁力·Ⅱ', desc: '散落的余辉认得回家的路。', cost: 10, layer: 3, parent: 'a_magnet', maxPurchases: 1, bucket: 'tempo', machine: TALENT_ATTRIBUTE_EFFECTS.a_magnet, codexPrerequisite: 'codex_entries_40' },
  { id: 'a_life', kind: 'attribute', name: '生命', desc: '血里多了一层灯油的韧。', cost: 10, layer: 2, parent: 'q_a', maxPurchases: 2, bucket: 'survival', machine: TALENT_ATTRIBUTE_EFFECTS.a_life },
  { id: 'a_life_2', kind: 'attribute', name: '生命·Ⅱ', desc: '血里多了一层灯油的韧。', cost: 10, layer: 3, parent: 'a_life', maxPurchases: 1, bucket: 'survival', machine: TALENT_ATTRIBUTE_EFFECTS.a_life },
  { id: 'a_move_speed', kind: 'attribute', name: '移速', desc: '影子跟不上你。', cost: 10, layer: 3, parent: 'a_life', maxPurchases: 2, bucket: 'survival', machine: TALENT_ATTRIBUTE_EFFECTS.a_move_speed },
  { id: 'a_heal_efficiency', kind: 'attribute', name: '治疗效能', desc: '伤口在圣辉里合拢得更快。', cost: 10, layer: 3, parent: 'a_life_2', maxPurchases: 2, bucket: 'survival', machine: TALENT_ATTRIBUTE_EFFECTS.a_heal_efficiency },
  { id: 'a_pickup_radius', kind: 'attribute', name: '拾取半径', desc: '伸手即是所得。', cost: 10, layer: 2, parent: 'q_a', maxPurchases: 2, bucket: 'tempo', machine: TALENT_ATTRIBUTE_EFFECTS.a_pickup_radius },
  // ---- 角色支线（4×3 + 顶点 4 = 14~16 锚；轻规格 §4.3；machine 锚见 BRANCH_MACHINES）----
  ...(['edmund', 'cassandra', 'violet', 'galvan'] as const).flatMap((hero): TalentNodeConfig[] => {
    const descs = BRANCH_DESCS[hero];
    const [m1, m2] = BRANCH_MACHINES[hero];
    return [
      { id: `br_${hero}_1` as TalentNodeId, kind: 'branch', name: `${hero} 支线 ①`, desc: descs[0], cost: 15, layer: 2, parent: 'q_a', maxPurchases: 2, machine: m1 },
      { id: `br_${hero}_2` as TalentNodeId, kind: 'branch', name: `${hero} 支线 ②`, desc: descs[1], cost: 15, layer: 3, parent: `br_${hero}_1`, maxPurchases: 2, machine: m2 },
      { id: `br_${hero}_top` as TalentNodeId, kind: 'branch', name: '同袍之诺', desc: descs[2], cost: 25, layer: 4, parent: `br_${hero}_2`, maxPurchases: 1, machine: {}, codexPrerequisite: 'codex_heroes_all' },
    ];
  }),
] as const;

/** 按树 id 查节点 */
export function talentNodeById(id: TalentNodeId): TalentNodeConfig | undefined {
  return TALENT_TREE.find((n) => n.id === id);
}

/** 节点计数口径（§3.2：主干 26 = 1+10+15） */
export const TALENT_TREE_COUNTS = {
  ROOT: 1,
  MUTATION: 10,
  ATTRIBUTE_SLOTS: 15, // 10 类型 + 5 双点位
  TRUNK: 26,
  BRANCH_TOTAL: 14, // 12 普通 + 4 顶点 − 2（3~4 弹性锚 14）
  TOTAL_ANCHOR: 40,
  /** 属性层数合计（§4.2 全表） */
  ATTRIBUTE_LAYERS: 23,
} as const;

/** 树总成本区间（EG-8：BUG-5 关闭前不定版，只调配置） */
export const TALENT_TOTAL_COST_RANGE = [800, 1000] as const;

/** 前 10 局节奏（§⑩-3：累计 ≥ 树根 + 层 2 质变大部 ≥3 质变节点；锚 ~280 点/前 10 局） */
export const TALENT_PACE = {
  FIRST_10_RUNS_POINTS: 280,
  FIRST_10_RUNS_MUTATIONS: 3,
  POINTS_PER_RUN_TYPICAL: [28, 32] as const,
} as const;

/** 质变节点集合（运行时消费查询） */
export const MUTATION_NODE_IDS: readonly TalentNodeId[] = [
  'q_b', 'q_c', 'q_d', 'q_e', 'q_f1', 'q_f2', 'q_f3', 'q_s1', 'q_s3', 'q_s4',
];

/** 复活规格（Q-c/Q-e，GT-9 判定序锚） */
export const TALENT_REVIVE = {
  FIRST_HP_PCT: 0.5,
  SECOND_HP_PCT: 0.3, // GT-9 递减
  INVULN_SECONDS: 1.5,
  KNOCKBACK_PX: 100,
  /** 判定序优先级：护盾（up_g_8，未死）→ 圣物免死（预留）→ 天赋复活（最低） */
  RELIC_FREE_DEATH_RESERVED: true,
} as const;

/** s3 遗言余烬（§④-1） */
export const TALENT_S3_EMBER = { XP: 30, MERIT_NO_REVIVE: 2 } as const;

/** s1 银炉预热窗口（§④-1） */
export const TALENT_S1_WINDOW = { SECONDS: 30, DAMAGE_PCT: 0.2, ATTACK_SPEED_PCT: 0.2 } as const;

/** 角色支线所属 hero（消费查询） */
export function branchNodesForHero(heroId: HeroId): TalentNodeConfig[] {
  const hero = heroId.replace('hero_', '');
  return TALENT_TREE.filter((n) => n.id.startsWith(`br_${hero}`));
}
