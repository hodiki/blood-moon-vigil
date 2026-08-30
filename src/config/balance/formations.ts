/**
 * config/balance/formations.ts —— 方阵 9 阵配置 + spawnGroup 生成规则常量
 * （gdd-enemies-v3 §③-6 F-1~9 激进锚 / gdd-spawner-v2 §③-4 / MN-18/19）
 *
 * 方阵 = 组生成单元（spawnGroup）：不进普通槽位池、成组预扣 budget、伴随生成、
 * 黑板协同（W-B 组黑板消费 behavior 字段）。成员引用 ENEMY_CONFIGS（单一数据源）；
 * 召唤物 noXp 走 enemies/noxp.ts 判定口径（W-12），方阵本体成员正常掉 XP。
 *
 * 入池口径（MN-18 a）：首版 7 阵启用（用户 4 阵 + 围猎/血旗/锁链）；
 * 铁石/献祭 disabled 占位（二批入池）。逐阵 unlockAt = 轨②（MN-19 b 激进锚）。
 */

import type { EnemyId, MapId } from './ids';
import { ENEMY_CONFIGS } from './enemies';

/** 方阵内容 ID（九阵全量；content-id-frame-map 方阵小类挂组名，帧属成员敌种） */
export type FormationId =
  | 'f_hunt_pack' // 追猎方阵（低 · 教学阵）
  | 'f_hunting_ambush' // 围猎方阵（低中）
  | 'f_sacrifice' // 献祭方阵（低 · 二批）
  | 'f_revive_circle' // 苏生方阵（中）
  | 'f_treasure_guard' // 宝藏护卫方阵（中 · 奖励特化 · 每局 ≤1）
  | 'f_blood_banner' // 血旗方阵（中）
  | 'f_chain_ward' // 锁链方阵（中 · 教堂限定权重最高）
  | 'f_iron_stone' // 铁石方阵（中 · 二批）
  | 'f_decayed_knights'; // 腐朽骑士团（高 · 次于 Boss）

/** 成员行为角色（组黑板 role 槽；enemies-v3 §③-6 各阵成员列） */
export type FormationRole =
  | 'leader' // 阵眼/核心（如追猎阵尸巫——仪式主体）
  | 'healer' // 治疗流尸巫（绿光束治疗循环）
  | 'summoner' // 召唤流尸巫（唤尸循环）
  | 'escort' // 护卫（血旗护卫）
  | 'carrier' // 驮运行尸（宝藏护卫特有）
  | 'banner' // 旗手（血旗特有）
  | 'decoy' // 祭品（献祭特有；XP ×3，noXp=false）
  | 'body'; // 普通本体成员

/** 威胁档（F-5）：低（追猎/献祭/围猎）→ 中（苏生/宝藏/血旗/锁链/铁石）→ 高（骑士团，次于 Boss） */
export type FormationThreat = 'low' | 'mid' | 'high';

/** 组级状态机标识（W-B 组黑板 stepGroupBlackboard 消费） */
export type FormationBehavior =
  | 'hunt'
  | 'ambush'
  | 'sacrifice'
  | 'revive'
  | 'treasure'
  | 'banner'
  | 'chain'
  | 'iron'
  | 'knights';

/** 阵型站位（落地分布，spawner-v2 §③-4「落地分布」行） */
export type FormationPlacement =
  | { kind: 'scatter'; radiusMin: number; radiusMax: number } // 预约点 80~150px 散布（默认）
  | { kind: 'wedge'; spacing: number } // 三角编队（骑士团 300px）
  | { kind: 'line'; spacing: number }; // 横队列（宝藏护卫）

/** 方阵成员（敌种 + 角色槽 + 数量；同敌种多角色复用 = 尸巫 role 变体） */
export interface FormationMemberConfig {
  enemyId: EnemyId;
  role: FormationRole;
  count: number;
}

/** 方阵配置（九阵全量） */
export interface FormationConfig {
  id: FormationId;
  name: string;
  threat: FormationThreat;
  /** 轨② 解锁（MN-19 b 激进锚）：追猎 100 / 围猎 110 / 献祭(二批) 120 / 苏生 150 /
   *  血旗 160 / 铁石(二批) 180 / 锁链 180 / 宝藏护卫 180 / 骑士团 240 */
  unlockAt: number;
  /** 入池开关：首版 7 启用；铁石/献祭 disabled 占位（二批，MN-18 a） */
  enabled: boolean;
  /** 成员构成（成员面板 XP 等效点数 = 成组预算预扣基数） */
  members: readonly FormationMemberConfig[];
  /** 逐图权重：主場 ×1.0 / 副場 ×0.3 / 禁列 0（enemies-v3 §③-6 适配表） */
  mapWeights: Record<MapId, number>;
  placement: FormationPlacement;
  /** 组级状态机（W-B） */
  behavior: FormationBehavior;
  /** 解题奖励宝石簇锚 XP 区间（F-6：5~10；完整击破高档 15~20） */
  rewardGemCluster: readonly [number, number];
  notes: string;
}

/** 方阵 × 3 图适配（enemies-v3 §③-6 定稿表；高权重 ×1.0 / 低权重 ×0.3 / 禁列 0） */
export const FORMATIONS: Record<FormationId, FormationConfig> = {
  // 1. 追猎方阵（低 · 教学阵 · 墓地主場）：尸巫(治疗)×1 + 血犬×2；S1 末首入（100s）
  f_hunt_pack: {
    id: 'f_hunt_pack',
    name: '追猎方阵',
    threat: 'low',
    unlockAt: 100,
    enabled: true,
    members: [
      { enemyId: 'enemy_g1_5', role: 'healer', count: 1 },
      { enemyId: 'enemy_g1_2', role: 'body', count: 2 },
    ],
    mapWeights: { map_graveyard: 1.0, map_cathedral: 0, map_den: 0.3 },
    placement: { kind: 'scatter', radiusMin: 80, radiusMax: 150 },
    behavior: 'hunt',
    rewardGemCluster: [5, 10],
    notes: '血犬全灭→召唤仪式（3s 可打断）→重召血犬×2（noXp）；解题=直捣黄龙/转火打断仪式',
  },
  // 2. 围猎方阵（低中）：暗影狼×3 + 血犬×2；狼穴主場
  f_hunting_ambush: {
    id: 'f_hunting_ambush',
    name: '围猎方阵',
    threat: 'low',
    unlockAt: 110,
    enabled: true,
    members: [
      { enemyId: 'enemy_g3_2', role: 'body', count: 3 },
      { enemyId: 'enemy_g1_2', role: 'body', count: 2 },
    ],
    mapWeights: { map_graveyard: 0.3, map_cathedral: 0, map_den: 1.0 },
    placement: { kind: 'scatter', radiusMin: 100, radiusMax: 160 },
    behavior: 'ambush',
    rewardGemCluster: [5, 10],
    notes: '两翼包抄→环上 60° 缺口→同相位收拢；解题=读游走找缺口/收拢前击破造破口（行为接线属内容批）',
  },
  // 3. 献祭方阵（低 · 二批占位）：尸巫(治疗)×1 + 行尸×4 + 血信徒祭品×1（decoy XP ×3）
  f_sacrifice: {
    id: 'f_sacrifice',
    name: '献祭方阵',
    threat: 'low',
    unlockAt: 120,
    enabled: false, // 二批（MN-18 a）
    members: [
      { enemyId: 'enemy_g1_5', role: 'healer', count: 1 },
      { enemyId: 'enemy_g1_1', role: 'body', count: 4 },
      { enemyId: 'enemy_g2_1', role: 'decoy', count: 1 },
    ],
    mapWeights: { map_graveyard: 1.0, map_cathedral: 0, map_den: 0 },
    placement: { kind: 'scatter', radiusMin: 80, radiusMax: 150 },
    behavior: 'sacrifice',
    rewardGemCluster: [5, 10],
    notes: '祭品金光诱饵→狂化光环→光环内杀祭品复活狂化体（noXp）；光环外 300px 击杀豁免',
  },
  // 4. 苏生方阵（中）：尸巫(召唤)×2 + 守墓者×1；墓地主場
  f_revive_circle: {
    id: 'f_revive_circle',
    name: '苏生方阵',
    threat: 'mid',
    unlockAt: 150,
    enabled: true,
    members: [
      { enemyId: 'enemy_g1_5', role: 'summoner', count: 2 },
      { enemyId: 'enemy_g1_6', role: 'leader', count: 1 },
    ],
    mapWeights: { map_graveyard: 1.0, map_cathedral: 0.3, map_den: 0 },
    placement: { kind: 'scatter', radiusMin: 80, radiusMax: 150 },
    behavior: 'revive',
    rewardGemCluster: [5, 10],
    notes: '唤尸每 4s 上限 6（noXp）；受击激活→守墓者解除护卫姿态 180° 扫随行',
  },
  // 5. 宝藏护卫方阵（中 · 奖励特化 · 每局 ≤1）：守墓者×4 + 驮运行尸×4 + 尸巫(治疗)×1
  f_treasure_guard: {
    id: 'f_treasure_guard',
    name: '宝藏护卫方阵',
    threat: 'mid',
    unlockAt: 180,
    enabled: true,
    members: [
      { enemyId: 'enemy_g1_6', role: 'escort', count: 4 },
      { enemyId: 'enemy_g1_1', role: 'carrier', count: 4 },
      { enemyId: 'enemy_g1_5', role: 'healer', count: 1 },
    ],
    mapWeights: { map_graveyard: 1.0, map_cathedral: 1.0, map_den: 0 },
    placement: { kind: 'line', spacing: 60 },
    behavior: 'treasure',
    rewardGemCluster: [5, 10],
    notes: '横穿（速 40，非主动攻击）；驮尸全灭=宝藏落地（offer 直发 MN-21，每局 ≤1）→攻击状态 10s；到点离场',
  },
  // 6. 血旗方阵（中）：血信徒旗手×1 + 血信徒护卫×2；教堂主場
  f_blood_banner: {
    id: 'f_blood_banner',
    name: '血旗方阵',
    threat: 'mid',
    unlockAt: 160,
    enabled: true,
    members: [
      { enemyId: 'enemy_g2_1', role: 'banner', count: 1 },
      { enemyId: 'enemy_g2_1', role: 'escort', count: 2 },
    ],
    mapWeights: { map_graveyard: 0, map_cathedral: 1.0, map_den: 0 },
    placement: { kind: 'scatter', radiusMin: 80, radiusMax: 150 },
    behavior: 'banner',
    rewardGemCluster: [5, 10],
    notes: '插旗→增援每 6s 上限 4（noXp）；斩旗→旗熄+增援溃散（减速 50%/3s）→解散（行为接线属内容批）',
  },
  // 7. 锁链方阵（中 · 教堂限定）：忏悔者×2 + 血肉畸体×1（狼穴禁列——无遮蔽战术公平）
  f_chain_ward: {
    id: 'f_chain_ward',
    name: '锁链方阵',
    threat: 'mid',
    unlockAt: 180,
    enabled: true,
    members: [
      { enemyId: 'enemy_g2_5', role: 'body', count: 2 },
      { enemyId: 'enemy_g2_4', role: 'leader', count: 1 },
    ],
    mapWeights: { map_graveyard: 0, map_cathedral: 1.0, map_den: 0 },
    placement: { kind: 'scatter', radiusMin: 120, radiusMax: 200 },
    behavior: 'chain',
    rewardGemCluster: [5, 10],
    notes: '十字火力网（弹幕封横向+冲刺封纵向）；解题=借立柱挡弹（行为接线属内容批）',
  },
  // 8. 铁石方阵（中 · 二批占位）：石甲狼×1 + 狼裔猎手×2
  f_iron_stone: {
    id: 'f_iron_stone',
    name: '铁石方阵',
    threat: 'mid',
    unlockAt: 180,
    enabled: false, // 二批（MN-18 a）
    members: [
      { enemyId: 'enemy_g3_3', role: 'leader', count: 1 },
      { enemyId: 'enemy_g3_4', role: 'body', count: 2 },
    ],
    mapWeights: { map_graveyard: 0, map_cathedral: 0, map_den: 1.0 },
    placement: { kind: 'scatter', radiusMin: 80, radiusMax: 150 },
    behavior: 'iron',
    rewardGemCluster: [5, 10],
    notes: '队友阻挡规则（借位语法考题）；石甲狼破甲后壁垒失效',
  },
  // 9. 腐朽骑士团（高 · 次于 Boss）：腐朽骑士×3（g1_7 方阵专属）；狼穴主場
  f_decayed_knights: {
    id: 'f_decayed_knights',
    name: '腐朽骑士团',
    threat: 'high',
    unlockAt: 240,
    enabled: true,
    members: [{ enemyId: 'enemy_g1_7', role: 'body', count: 3 }],
    mapWeights: { map_graveyard: 0.3, map_cathedral: 0, map_den: 1.0 },
    placement: { kind: 'wedge', spacing: 300 },
    behavior: 'knights',
    rewardGemCluster: [15, 20],
    notes: '编队三角 300px→集团冲锋（600px @500px/s，警告线 0.6s，跟踪 0.3）→落空硬直 1s→每 8s 再冲锋；完整击破宝石簇 15~20',
  },
};

/**
 * spawnGroup 生成规则常量（gdd-spawner-v2 §③-4 / F-2 MN-19 b 激进锚）。
 */
export const FORMATION_RULES = {
  /** 掷点间隔 s（60~90 锚；随机均匀） */
  ROLL_INTERVAL: [60, 90] as const,
  /** 触发概率（S1 末段 0.3 / S2 0.6 / S3 0.9；S1 前段无方阵） */
  TRIGGER_CHANCE_S1_END: 0.3,
  TRIGGER_CHANCE_S2: 0.6,
  TRIGGER_CHANCE_S3: 0.9,
  /** S1 末段窗口起点（轨② 最早 unlockAt = 教学阵 100s） */
  S1_END_WINDOW_START: 100,
  /** 同屏上限（双阵时至少 1 低/中档；高档不叠高档） */
  MAX_ON_SCREEN: 2,
  /** 方阵 budget 占比上限（预扣会计，MN-19 b；预扣计入总盘不另开预算） */
  BUDGET_SHARE_MAX: 0.25,
  /** 落地前阵纹预警 s */
  WARNING_SECONDS: 2.5,
  /** 成组落地分帧（≤5 只/帧；受 maxEnemies 节流不丢组） */
  LAND_PER_FRAME: 5,
  /** 伴随生成：落地时周围普通生成权重瞬时 +20%（持续 10s 锚） */
  ACCOMPANY_WEIGHT_BOOST: 0.2,
  ACCOMPANY_DURATION_SECONDS: 10,
  /** 每局次数锚（观察项 S-8；不作硬上限） */
  RUNS_PER_GAME_ANCHOR: [4, 7] as const,
  /** 高威胁阵（骑士团）伴随精英预约：落地时同屏无精英 → 预约 1 只（词缀互斥不适用本体） */
  KNIGHT_ESCORT_ELITE: true,
} as const;

/** 宝藏护卫路径特例（spawner-v2 §③-5：每局 ≤1 / ≥600px / 速 40 / 避 Boss 区 320px） */
export const TREASURE_PATH = {
  /** 每局 ≤1（MN-21：与卡 2 精英宝箱渠道解耦） */
  PER_GAME_MAX: 1,
  /** 生成点距玩家下限 px（地图一端边缘） */
  MIN_PLAYER_DISTANCE: 600,
  /** 横穿速度 px/s（全程 ≈60~75s） */
  SPEED: 40,
  /** Boss 战舞台净空半径 px（路径避开） */
  BOSS_CLEAR_RADIUS: 320,
  /** 障碍规避偏移锚 px（§⑥-6） */
  OBSTACLE_OFFSET: 80,
  /** 宝藏落地未拾取消失 s（enemies-v3 §⑥-5） */
  GROUND_TTL_SECONDS: 30,
} as const;

/** 组成员运行时记录（生成调度 ↔ 组黑板共用形状） */
export interface FormationMemberSlot {
  enemyId: EnemyId;
  role: FormationRole;
}

/** 成组预算预扣（按成员面板 XP 等效点数；spawner-v2 §③-4 生成方式行） */
export function formationBudgetCost(formation: FormationConfig): number {
  return formation.members.reduce((sum, m) => sum + ENEMY_CONFIGS[m.enemyId].xp * m.count, 0);
}
