/**
 * config/balance/enemies.ts —— 敌人面板（legacy 4 敌 + 15 敌配置 + Boss 4 + 特殊行为 + Boss 机制常量）
 *
 * balance.ts 域拆分（EG-1）纯搬移：数值与注释原样保留，不改任何行为。
 * legacy ENEMIES 与 ENEMY_CONFIGS 双源现状原样搬移（双源收敛属后续批次，B1 不动语义）。
 */

import type { PowerTag, EnemyId, BossId, MapId } from './ids';

/**
 * 敌人面板（enemies §③ 数值表，与 GDD 逐项一致 —— E2-S2 / enemy-panel.test 埋点断言）。
 * 字段含义：hp 生命 / speed 移速 px/s / damage 接触伤害 / attackInterval 攻击间隔 s /
 * radius 碰撞半径 px / xp 经验掉落。
 */
export interface EnemyPanel {
  hp: number;
  speed: number;
  damage: number;
  attackInterval: number;
  radius: number;
  xp: number;
}

/**
 * legacy ENEMIES 面板表已随 W-8 收档（gdd-spawner-v2 附录 A / difficulty-v3 硬依赖）：
 * 迁出至 `src/_archived/enemies-legacy-panel.ts`（EG-2 归档不删纪律），ENEMY_CONFIGS/BOSSES
 * 单源化——运行时面板链走 spawnByConfig/spawnByBossConfig + panel-scale（M3 仅 HP）。
 * ENEMY_PANELS（enemy-types）现从单源派生，历史 kind 路径仅池兼容保留。
 */
export type EnemyKindId = 'zombie' | 'wolf' | 'tank' | 'boss';

/** 敌人层级（gdd-enemies-v2 §3.1~3.3） */
export type EnemyTier = 'normal' | 'fast' | 'air' | 'elite' | 'special';

/** 敌人配置（gdd-enemies-v2 §3.1~3.3；powerTag 敌人表未单列，按阵营语义赋值，见 ENEMY_CONFIGS 注释） */
export interface EnemyConfig {
  id: EnemyId;
  name: string;
  map: MapId;
  tier: EnemyTier;
  hp: number;
  speed: number;
  damage: number;
  attackInterval: number;
  radius: number;
  xp: number;
  powerTag: PowerTag;
  frame: string;
  /** 特殊行为（§3.1~3.3 特殊行为列；无 = 普通） */
  special?: string;
  /** 反制（§3.1~3.3 反制列） */
  counter?: string;
  /** 远程怪投射伤害（g2_5 忏悔者烛火弹 8） */
  rangedDamage?: number;
  /**
   * W-12 召唤物 noXp（gdd-spawner-v2 §③-7 / MN-23）：静态标记 = 该敌种整档无经验
   * （生成来源 = 敌方技能的实体挂此处）；动态召唤实体默认 noXp=true（运行时，
   * 见 enemies/noxp.ts SKILL_SUMMON_SOURCES 判定口径）。方阵本体成员不挂此字段
   * （正常掉 XP，F-4）；祭品（decoy）为方阵本体成员 noXp=false 且 XP ×3。
   */
  noXp?: boolean;
  /**
   * 方阵专属（gdd-enemies-v3 §③-2 MN-16）：不进任何普通槽位池 / 生成池
   * （enemiesForMap 过滤），仅由方阵（腐朽骑士团）与 Boss 高威胁技生成。
   */
  formationOnly?: boolean;
  /**
   * W-8/c 案 HP 联动锚字段位（gdd-difficulty-v3 §5.1 SC-2）：c 档位敌 HP 联动
   * 系数挂点（×1.05~1.20 三档，难度域参数化）；缺省 = 未启用（1.0）。
   * 数值由 XP c 案模拟裁决后冻结（W-E 只出数据不回填）。
   */
  hpCaseLink?: number;
  /**
   * W-9 轨① 敌种分批解锁（gdd-difficulty-v3 §5.4 / gdd-spawner-v2 §③-3）：局时 s，
   * t < unlockAt 时该敌种被 pickEnemyIdForMap 过滤（过滤后池空回退该槽 unlockAt=0 基础敌）。
   * 缺省 = 0（炮灰档常驻）。
   */
  unlockAt?: number;
  /**
   * W-5/MN-9 CC 抗性画像（enemies-v3 §③-8）：tier 默认 + 逐敌覆写（名额 3 定稿：
   * 芬里厄蓄力减速 ×0.5 / 化身易伤免疫 / 石甲狼石甲期减速 ×0.5）；缺省 = 走 spawnByConfig
   * 的 tier 派生（精英 elite / Boss boss / 普通 normal）。
   */
  ccProfile?: import('@/combat/status/status-config').CcProfile;
  /**
   * MN-15 叙事化退役标记：保留配置与图鉴条目（补句「守夜会记录：近百年亡魂渐稀」），
   * 生成侧移出普通池（MAP_ENEMY_SLOTS 不含）、相位接线撤销（ENEMY_BEHAVIORS 无 phase 项）。
   */
  retiredNarrative?: boolean;
  /** MN-17 精英化标记（忏悔者 g2_5：普通忏悔者形态退役，精英化入 tank 槽） */
  eliteUpgraded?: boolean;
}

/**
 * 敌人表 16（gdd-enemies-v3 §③-2 定稿口径：R2 基数 15 + 腐朽骑士 g1_7 方阵专属；
 * 掷骨者 g1_8 新增 / 忏悔者升格 / 亡魂退役属基线批 W-1~9 roster 收口，本批不动）。
 */
export const ENEMY_CONFIGS: Record<EnemyId, EnemyConfig> = {
  enemy_g1_1: { id: 'enemy_g1_1', name: '行尸', map: 'map_graveyard', tier: 'normal', hp: 12, speed: 55, damage: 10, attackInterval: 1.0, radius: 14, xp: 1, powerTag: 'BLOOD', frame: 'enemy-zombie', counter: '走位拉扯' },
  // 轨①（§5.4）：血犬 = 突袭型 60s（墓地基准）；甲虫 = 行尸变体并轨（MN-14：同参数）
  enemy_g1_2: { id: 'enemy_g1_2', name: '血犬', map: 'map_graveyard', tier: 'fast', hp: 10, speed: 150, damage: 8, attackInterval: 0.8, radius: 12, xp: 2, powerTag: 'BLOOD', frame: 'enemy-hound', counter: '优先处理/绕开', unlockAt: 60 },
  enemy_g1_3: { id: 'enemy_g1_3', name: '墓穴甲虫', map: 'map_graveyard', tier: 'normal', hp: 12, speed: 55, damage: 10, attackInterval: 1.0, radius: 14, xp: 1, powerTag: 'BLOOD', frame: 'enemy-beetle', counter: '范围清屏' }, // MN-14 变体化：与行尸共用面板/行为（同参数并轨），出场皮肤替换
  // MN-15 叙事化退役：配置保留（图鉴补句），生成池移除 + 相位接线撤销
  enemy_g1_4: { id: 'enemy_g1_4', name: '亡魂', map: 'map_graveyard', tier: 'special', hp: 12, speed: 95, damage: 10, attackInterval: 1.0, radius: 13, xp: 2, powerTag: 'BLOOD', frame: 'enemy-wraith', special: '（退役）曾可穿越障碍；守夜会记录：近百年亡魂渐稀，今夜尤为罕见', counter: '—', retiredNarrative: true },
  enemy_g1_5: { id: 'enemy_g1_5', name: '尸巫', map: 'map_graveyard', tier: 'special', hp: 16, speed: 45, damage: 6, attackInterval: 1.5, radius: 16, xp: 3, powerTag: 'BLOOD', frame: 'enemy-necro', special: '光环：120px 内亡者攻速 +20%（叠 3 层）', counter: '集火（优先击杀光环源）', unlockAt: 120 }, // 轨① 特殊行为 120s（墓地基准）
  // R-C3-RULING：墓地补 elite 守墓者（tank 槽只放 elite；无特殊行为，纯厚血精英）
  enemy_g1_6: { id: 'enemy_g1_6', name: '守墓者', map: 'map_graveyard', tier: 'elite', hp: 350, speed: 40, damage: 15, attackInterval: 1.8, radius: 22, xp: 10, powerTag: 'BLOOD', frame: 'enemy-gravekeeper', counter: '集火（高 XP 对价）' },
  // gdd-enemies-v3 §③-2 MN-16：腐朽骑士 g1_7 方阵专属（堕落的初代守夜骑士，powerTag MOON）。
  // 面板锚：HP 280 / 移速 90 / 伤 14 / 攻间隔 1.2s / XP 10；不进普通槽位池（formationOnly），
  // 仅由腐朽骑士团方阵与 boss_1 高威胁技生成；radius 为工程常量（GDD 未列）。
  enemy_g1_7: { id: 'enemy_g1_7', name: '腐朽骑士', map: 'map_graveyard', tier: 'normal', hp: 280, speed: 90, damage: 14, attackInterval: 1.2, radius: 20, xp: 10, powerTag: 'MOON', frame: 'enemy-decayedknight', counter: '横向躲冲锋线（保持移动 + 读缝隙）', formationOnly: true },
  enemy_g2_1: { id: 'enemy_g2_1', name: '血信徒', map: 'map_cathedral', tier: 'normal', hp: 14, speed: 60, damage: 12, attackInterval: 1.0, radius: 14, xp: 1, powerTag: 'BLOOD', frame: 'enemy-acolyte', counter: '走位拉扯' },
  enemy_g2_2: { id: 'enemy_g2_2', name: '血蝠', map: 'map_cathedral', tier: 'air', hp: 8, speed: 130, damage: 8, attackInterval: 0.8, radius: 10, xp: 2, powerTag: 'BLOOD', frame: 'enemy-bat', counter: '范围清屏/绕开', unlockAt: 75 }, // 轨① 突袭 60~90（教堂微调）
  enemy_g2_3: { id: 'enemy_g2_3', name: '圣杯侍僧', map: 'map_cathedral', tier: 'special', hp: 16, speed: 50, damage: 8, attackInterval: 1.2, radius: 15, xp: 3, powerTag: 'BLOOD', frame: 'enemy-cupbearer', special: '每 5s 召唤 1 血信徒（上限 3）', counter: '集火打断（召唤源优先）', unlockAt: 135 }, // 轨① 特殊行为 120~150（教堂微调）
  enemy_g2_4: { id: 'enemy_g2_4', name: '血肉畸体', map: 'map_cathedral', tier: 'elite', hp: 500, speed: 40, damage: 18, attackInterval: 1.8, radius: 24, xp: 12, powerTag: 'BLOOD', frame: 'enemy-fleshmass', counter: '集火（高 XP 对价）' },
  // MN-17 升格精英（§③-4-5）：340HP/55/10/XP 12；普通形态退役，入教堂 tank 槽；轨③ 180s（教堂提前）
  enemy_g2_5: { id: 'enemy_g2_5', name: '忏悔者', map: 'map_cathedral', tier: 'elite', hp: 340, speed: 55, damage: 10, attackInterval: 1.8, radius: 15, xp: 12, powerTag: 'BLOOD', frame: 'enemy-penitent', special: '弹幕与血渍：260~320px 轮射 3 连烛火弹 + 血渍减速 15%/2s', counter: '借位挡弹 + 读弹道横向走位 + 血渍区规划', rangedDamage: 8, eliteUpgraded: true, unlockAt: 180 },
  enemy_g3_1: { id: 'enemy_g3_1', name: '灰狼', map: 'map_den', tier: 'fast', hp: 12, speed: 85, damage: 10, attackInterval: 0.8, radius: 13, xp: 1, powerTag: 'BEAST', frame: 'enemy-greywolf', counter: '走位拉扯' },
  enemy_g3_2: { id: 'enemy_g3_2', name: '暗影狼', map: 'map_den', tier: 'fast', hp: 10, speed: 160, damage: 10, attackInterval: 0.7, radius: 11, xp: 2, powerTag: 'BEAST', frame: 'enemy-shadowwolf', counter: '优先处理/绕开', unlockAt: 90 }, // 轨① 突袭 60~90（狼穴稍后）
  // MN-9 覆写名额 ③：石甲狼石甲期减速 ×0.5（甲重难移；狂暴期解除由 W-16 行为运行时处理）
  enemy_g3_3: { id: 'enemy_g3_3', name: '石甲狼', map: 'map_den', tier: 'elite', hp: 400, speed: 45, damage: 15, attackInterval: 1.8, radius: 22, xp: 10, powerTag: 'BEAST', frame: 'enemy-stonewolf', counter: '集火（高 XP 对价）', ccProfile: { tier: 'elite', ccResistance: { slow: { durationMult: 0.5 } } } },
  enemy_g3_4: { id: 'enemy_g3_4', name: '狼裔猎手', map: 'map_den', tier: 'special', hp: 16, speed: 70, damage: 12, attackInterval: 1.2, radius: 14, xp: 3, powerTag: 'BEAST', frame: 'enemy-wolfhunter', special: '每 6s 蓄力冲锋（警告线后冲刺 500px/s）', counter: '横向走位（躲警告线方向）', unlockAt: 150 }, // 轨① 特殊行为 120~150（狼穴冲锋稍后）
};

/** Boss 配置（gdd-enemies-v2 §3.4；map='any' 表示任意地图稀有 Boss） */
export interface BossConfig {
  id: BossId;
  name: string;
  map: MapId | 'any';
  hp: number;
  speed: number;
  damage: number;
  attackInterval: number;
  radius: number;
  xp: number;
  powerTag: PowerTag;
  frame: string;
  /** 阶段/机制（§3.4 阶段/机制列） */
  phase2?: string;
  /** 视觉编码（§3.4 视觉编码列） */
  visual: string;
  /** MN-9 覆写（enemies-v3 §③-8）：缺省 = Boss 默认（硬控免疫）；逐敌覆写走此处 */
  ccProfile?: import('@/combat/status/status-config').CcProfile;
}

/** Boss 表 4（gdd-enemies-v2 §3.4 / content-design-outline §4.3） */
export const BOSSES: Record<BossId, BossConfig> = {
  boss_1: { id: 'boss_1', name: '血月尊者', map: 'map_graveyard', hp: 4000, speed: 28, damage: 30, attackInterval: 2.0, radius: 40, xp: 100, powerTag: 'MOON', frame: 'enemy-boss', visual: '≥3x·猩红金 4px·残破守夜袍·手持锈蚀初代提灯（灯内血色光）' },
  boss_2: { id: 'boss_2', name: '血主教·尼禄', map: 'map_cathedral', hp: 4500, speed: 30, damage: 32, attackInterval: 2.2, radius: 42, xp: 120, powerTag: 'BLOOD', frame: 'boss-cardinal', phase2: '阶段 2（HP<50%）：召唤 2 圣杯侍僧；脚下周期性血池（减速 30% + 持续伤）', visual: '≥3x·猩红金·主教冠冕+圣杯' },
  // MN-9 覆写名额 ①：芬里厄蓄力期减速 ×0.5（迟滞不锁死；蓄力期条件由 Boss 技能运行时判定）
  boss_3: { id: 'boss_3', name: '狼王·芬里厄', map: 'map_den', hp: 4200, speed: 32, damage: 30, attackInterval: 2.0, radius: 42, xp: 120, powerTag: 'BEAST', frame: 'boss-fenrir', phase2: '阶段 2（HP<50%）：蓄力冲锋扑击（警告线，逼走位）；召唤 2 灰狼', visual: '≥3x·猩红金·狼鬃王冠', ccProfile: { tier: 'boss', ccResistance: { slow: { durationMult: 0.5 } } } },
  // MN-9 覆写名额 ②：化身易伤免疫（防猎物标记把短战打穿下限）
  boss_4: { id: 'boss_4', name: '血月化身', map: 'any', hp: 3000, speed: 40, damage: 25, attackInterval: 1.8, radius: 40, xp: 150, powerTag: 'MOON', frame: 'boss-moonavatar', phase2: '4:30 后 5% 触发「月坠」（预警后降临）；不掉通关进度，掉稀有图鉴', visual: '半透明猩红金·月光人形·无角饰·边缘月白描边', ccProfile: { tier: 'boss', ccResistance: { vulnerable: { immune: true } } } },
};

/**
 * 敌人特殊行为（gdd-enemies-v2 §3.1~3.3 特殊行为列结构化；每地图 ≤2 种 + 明确反制）。
 * GDD 文本列保留在 ENEMY_CONFIGS.special（人读）；本表为机器读行为参数（唯一数据源）。
 * 反制（counter）见 ENEMY_CONFIGS 各条目：集火/走位/打断（支柱 3 可检验含义③）。
 */
export interface PhaseBehaviorConfig {
  kind: 'phase';
}
export interface AuraBehaviorConfig {
  kind: 'aura';
  /** 光环半径 px（尸巫 120，§3.1） */
  radius: number;
  /** 每层攻速加成（+20% = 0.2，§3.1） */
  attackSpeedBonus: number;
  /** 叠层上限（3 层，§3.1） */
  maxStacks: number;
}
export interface SummonBehaviorConfig {
  kind: 'summon';
  /** 召唤间隔 s（圣杯侍僧每 5s，§3.2） */
  interval: number;
  /** 召唤目标（圣杯侍僧 → 血信徒） */
  summonedId: EnemyId;
  /** 场上召唤物上限（3，§⑥.7 达上限暂停） */
  summonCap: number;
}
export interface RangedBehaviorConfig {
  kind: 'ranged';
  /** 投掷间隔 s（忏悔者每 3s，§3.2） */
  interval: number;
  /** 投射弹速 px/s（烛火弹 180 慢速可躲，§⑥.8） */
  projectileSpeed: number;
}
export interface ChargeBehaviorConfig {
  kind: 'charge';
  /** 冲锋周期 s（狼裔猎手每 6s，§3.3） */
  interval: number;
  /** 蓄力时长 s（0.5，§3.3） */
  windup: number;
  /** 警告线亮起时长 s（0.15，§3.3） */
  warning: number;
  /** 冲刺速度 px/s（500，§3.3） */
  dashSpeed: number;
  /** 冲刺持续 s（工程常量：0.4s ≈ 200px 突进；GDD 未列，标记为工程参数） */
  dashDuration: number;
}
export type EnemyBehaviorConfig =
  | PhaseBehaviorConfig
  | AuraBehaviorConfig
  | SummonBehaviorConfig
  | RangedBehaviorConfig
  | ChargeBehaviorConfig;

/** 特殊行为表（gdd-enemies-v2 §3.1~3.3；无条目 = 普通敌） */
export const ENEMY_BEHAVIORS: Partial<Record<EnemyId, EnemyBehaviorConfig>> = {
  // MN-15：亡魂相位接线撤销（退役不入池，条目删除）；MN-17：忏悔者普通远程退役（行为升格 W-16 精英技能）
  enemy_g1_5: { kind: 'aura', radius: 120, attackSpeedBonus: 0.2, maxStacks: 3 }, // 尸巫：光环
  enemy_g2_3: { kind: 'summon', interval: 5, summonedId: 'enemy_g2_1', summonCap: 3 }, // 圣杯侍僧
  enemy_g3_4: { kind: 'charge', interval: 6, windup: 0.5, warning: 0.15, dashSpeed: 500, dashDuration: 0.4 }, // 狼裔猎手
};

/**
 * Boss「血月尊者」机制与视觉（enemies §③/§⑥.5 / art-bible §4 / E4-S2）。
 * 面板数值（4000HP/28px/s/30伤/2.0s/40px/100经验）见 ENEMIES.boss；本组为机制/视觉常量。
 */
export const BOSS = {
  /** 出场 0.5s 霸体闪红：期内不承伤（enemies §⑥.5 / art-bible §4「出场 0.5s 霸体闪红」） */
  GRACE_SECONDS: 0.5,
  /** 体型：≥3x 玩家（玩家 32px 基准 → 120px），且 ≤ 屏高 1/4（桌面 270 / 移动 320） */
  TEXTURE_SIZE: 120,
  /** 出场位置距玩家距离 px（清场后登场，避免与玩家重叠，enemies §⑥.5） */
  SPAWN_DISTANCE: 320,
  /** 猩红金（art-bible §2/§4：主体 #FF3B3B + 金饰 #FFC93C） */
  COLOR_MAIN: '#FF3B3B',
  COLOR_GOLD: '#FFC93C',
  /** 顶部 UI 血条宽度（屏宽比例）：桌面 60% / 移动 50%（E8 §⑦ / enemies §⑦） */
  HP_BAR_WIDTH_DESKTOP: 0.6,
  HP_BAR_WIDTH_MOBILE: 0.5,
} as const;

/** Boss 战时长判据与阶段机制（gdd-enemies-v2 §3.4 / §⑥.9；sim-verify §7） */
export const BOSS_FIGHT = {
  /** 实战折减：理论 DPS ×0.85（命中率/走位/阶段霸体，sim-verify §1 中位口径） */
  PRACTICAL_FACTOR: 0.85,
  /**
   * R2 预案（sprint-m2-plan 风险表 R2）：保守口径尼禄 96.2s 超 90s → HP 4500→4300（单点）。
   * 默认关闭 = GDD 值 4500 生效；真机复测（bossFightSeconds 埋点 >90）确认后由主理人批准开启。
   */
  NERO_HP_FALLBACK: 4300,
  NERO_HP_FALLBACK_ENABLED: false,
  /** 阶段切换霸体 1s（§⑥.9：转阶段不承伤，防「卡阶段秒杀」） */
  PHASE_SWITCH_GRACE_SECONDS: 1,
} as const;

/** Boss 阶段 2 召唤（gdd-enemies-v2 §3.4：尼禄 2 圣杯侍僧 / 芬里厄 2 灰狼；基准 Boss 无） */
export const BOSS_PHASE2_SUMMON: Partial<Record<BossId, { summonedId: EnemyId; count: number }>> = {
  boss_2: { summonedId: 'enemy_g2_3', count: 2 },
  boss_3: { summonedId: 'enemy_g3_1', count: 2 },
};

/** 血池危险（gdd-maps §3.2：教堂血池减速 30% + 持续伤 8/s；boss_2 阶段 2 脚下周期性血池 §3.4） */
export const BLOOD_POOL = {
  SLOW_PCT: 0.3,
  DPS: 8,
  /** 尼禄阶段 2 血池周期/持续 s（工程常量：每 3s 脚下生成 1 池，持续 3s；GDD 未列精确值） */
  INTERVAL_SECONDS: 3,
  DURATION_SECONDS: 3,
} as const;

/** 血月化身月坠（gdd-enemies-v2 §3.4 / §⑥.10：4:30 后 5%/次判定，已触发本局不再触发；稀有奖励非进度门） */
export const MOON_AVATAR = {
  /** 4:30（270s）后可判定 */
  AFTER_SECONDS: 270,
  /** 每次判定 5% 触发 */
  TRIGGER_CHANCE: 0.05,
  /** 月坠预警 2s（玩家可走位避开降临点，§⑥.10） */
  WARNING_SECONDS: 2,
} as const;
