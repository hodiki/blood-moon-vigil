/**
 * config/balance/boss-skills.ts —— Boss 五技能槽配置 ×4（W-D / W-15，gdd-enemies-v3 §③-7 MN-22/23）
 *
 * 模板：1 普攻（循环基底）+ 3 普技（CD 轮转）+ 1 高威胁技（低频大考）。
 * 四 Boss 定位差异化（MN-22 a）：召唤（血月尊者）/ 领域压制（尼禄）/ 突袭机动（芬里厄）/
 * 月相轮转（化身，稀有）——避免四个召唤系；仅 boss_1 定义战斗定位为召唤。
 *
 * 阶段 2 = HP<50% → 1s 转阶段霸体（不承伤）→ 解锁节点（W-2 义务纳入新循环不弃置）。
 * 召唤物 noXp 全量（MN-23）；场上召唤上限 6（P2 8）；清召唤时间占比 ≤40%（MD-4）。
 * 运行时消费：enemies/boss-skill-engine.ts（技能效果结算层简化为伤害+召唤桩；
 * telegraph 演出属内容批 W-13，本表 telegraph 字段 = 数据层锚）。
 */

import type { BossId, EnemyId } from './ids';

/** 五槽位（MN-22 模板） */
export type BossSlot = 'normal' | 'skill1' | 'skill2' | 'skill3' | 'ultimate';

/** 单槽技能配置 */
export interface BossSkillConfig {
  slot: BossSlot;
  name: string;
  /** CD s（普攻 = 循环间隔；普技轮转间隔；高威胁低频） */
  cd: number;
  /** 解锁阶段（P2 解锁节点：boss_1 骑士 / boss_2 血井；其余 P1 常驻） */
  unlockPhase: 1 | 2;
  /** 技能伤（独立于面板接触伤语义；普攻 = 面板伤） */
  damage: number;
  /** 施法硬直 s（召唤瞬间输出窗；boss_1 召唤 0.8s 锚） */
  castLock: number;
  /** 预警/蓄力 s（telegraph 数据层锚；演出 W-13） */
  telegraph: number;
  /** 召唤规格（noXp 全量；计数进 Boss 同源召唤池，受上限封顶） */
  summon?: { enemyId: EnemyId; count: number };
  /** 月影幻影（boss_4 skill1 专用：镜像移动 8s、接触伤 25、受 1 次伤即散——hp1 实体承载）；
   *  占 Boss 同源召唤计数（MN-23），到期/被击散释放 */
  phantom?: { duration: number; damage: number };
  /** 动作桩标识（运行时结算层简化为伤害+召唤；演出内容批） */
  action: string;
  /** 蓄力类技（P1-18：boss_3 短嗥冲锋/蓄力扑击）——预警（telegraph）期内 = 蓄力期，
   *  仅此窗口内吃芬里厄的减速 ×0.5 抗性（MN-9 口径：非蓄力期不折减） */
  charge?: boolean;
}

/** Boss 五技能表（逐 Boss 配置；面板数值见 BOSSES） */
export interface BossSkillTable {
  bossId: BossId;
  /** 战斗定位（MN-22 a；仅 boss_1 召唤系定义定位） */
  positioning: 'summoner' | 'domain' | 'assault' | 'moon-cycle';
  slots: readonly BossSkillConfig[];
  /** 阶段 2 解锁节点（W-2 义务：既有阶段 2 配置全部纳入） */
  phase2: {
    /** 普技/高威胁 CD 倍率（boss_1 −25% 锚 / boss_2 血池减半 / boss_3 扑击减半） */
    cdMultiplier: number;
    /** 转阶段召唤（尼禄 2 圣杯侍僧；既有配置纳入） */
    extraSummon?: { enemyId: EnemyId; count: number };
    /** boss_1 召唤上限 6→8（MN-23） */
    summonCap: number;
    /** 血月尊者高威胁技（骑士）解锁节点 = P2 */
    unlocksUltimate: boolean;
  };
  /** boss_4 无阶段（既有口径维持；其余 Boss true） */
  hasPhase2: boolean;
}

/** 场上召唤物上限（MN-23：6，P2 8；同源计数，死亡释放） */
export const BOSS_SUMMON_CAP = { P1: 6, P2: 8 } as const;

/** 施法硬直锚（boss_1 召唤瞬间 0.8s = 输出窗；其余按槽配置 castLock） */
export const BOSS_CAST_LOCK_DEFAULT = 0.8;

/** boss_1 血月尊者（墓地 · 召唤系） */
const BOSS_1_SLOTS: readonly BossSkillConfig[] = [
  { slot: 'normal', name: '范围攻击（扇形/环形交替）', cd: 2.0, unlockPhase: 1, damage: 30, castLock: 0, telegraph: 0.5, action: 'cleave-stomp-alternate' },
  { slot: 'skill1', name: '召唤血犬×2', cd: 6, unlockPhase: 1, damage: 0, castLock: 0.8, telegraph: 1.0, summon: { enemyId: 'enemy_g1_2', count: 2 }, action: 'summon-hounds' },
  { slot: 'skill2', name: '召唤行尸×3', cd: 6, unlockPhase: 1, damage: 0, castLock: 0.8, telegraph: 1.0, summon: { enemyId: 'enemy_g1_1', count: 3 }, action: 'summon-zombies' },
  { slot: 'skill3', name: '召唤守墓者×1（继承 180° 扫）', cd: 8, unlockPhase: 1, damage: 0, castLock: 0.8, telegraph: 1.0, summon: { enemyId: 'enemy_g1_6', count: 1 }, action: 'summon-gravekeeper' },
  { slot: 'ultimate', name: '召唤腐朽骑士×1（单人版 1 线冲锋）', cd: 12, unlockPhase: 2, damage: 0, castLock: 0.8, telegraph: 1.5, summon: { enemyId: 'enemy_g1_7', count: 1 }, action: 'summon-decayed-knight' },
];

/** boss_2 血主教·尼禄（教堂 · 血术领域压制系） */
const BOSS_2_SLOTS: readonly BossSkillConfig[] = [
  { slot: 'normal', name: '圣杯血浪（前方 100px 扇形）', cd: 2.2, unlockPhase: 1, damage: 32, castLock: 0, telegraph: 0.5, action: 'blood-wave' },
  { slot: 'skill1', name: '血池喷发（160px 减速 30% + 8/s）', cd: 8, unlockPhase: 1, damage: 8, castLock: 0.4, telegraph: 0.6, action: 'blood-pool' },
  { slot: 'skill2', name: '血珠连射（3 连直线 8 伤）', cd: 6, unlockPhase: 1, damage: 8, castLock: 0.3, telegraph: 0.4, action: 'blood-bolts' },
  { slot: 'skill3', name: '血雾领域（220px 减速 20% / 6s）', cd: 10, unlockPhase: 1, damage: 0, castLock: 0.5, telegraph: 1.0, action: 'blood-mist' },
  { slot: 'ultimate', name: '血井喷涌（3 段接力血池）', cd: 10, unlockPhase: 2, damage: 12, castLock: 0.5, telegraph: 1.0, action: 'blood-well' },
];

/** boss_3 狼王·芬里厄（狼穴 · 突袭机动系） */
const BOSS_3_SLOTS: readonly BossSkillConfig[] = [
  { slot: 'normal', name: '双爪连击（2 段 100px 扇形）', cd: 2.0, unlockPhase: 1, damage: 30, castLock: 0, telegraph: 0.4, action: 'double-claw' },
  { slot: 'skill1', name: '短嗥冲锋（400px 直线）', cd: 7, unlockPhase: 1, damage: 18, castLock: 0.8, telegraph: 0.5, action: 'charge-howl', charge: true },
  { slot: 'skill2', name: '召唤灰狼×2（既有阶段 2 机制前移常驻）', cd: 10, unlockPhase: 1, damage: 0, castLock: 0.8, telegraph: 1.0, summon: { enemyId: 'enemy_g3_1', count: 2 }, action: 'summon-wolves' },
  { slot: 'skill3', name: '狼王嚎叫（狼类移速/攻速 +20% / 8s；吟唱 1.5s 免疫打断）', cd: 12, unlockPhase: 1, damage: 0, castLock: 0, telegraph: 1.5, action: 'pack-howl' },
  { slot: 'ultimate', name: '蓄力扑击（600px 锁定警告线 + 落地震荡；既有阶段 2 升格）', cd: 10, unlockPhase: 1, damage: 32, castLock: 1.2, telegraph: 0.8, action: 'pounce', charge: true },
];

/** boss_4 血月化身（任意图稀有 · 月相轮转系；无阶段，普技 CD 4~5s 短战压迫） */
const BOSS_4_SLOTS: readonly BossSkillConfig[] = [
  { slot: 'normal', name: '月光鞭笞（160px 弧形）', cd: 1.8, unlockPhase: 1, damage: 25, castLock: 0, telegraph: 0.4, action: 'moon-whip' },
  { slot: 'skill1', name: '月影分身（幻影 8s，受 1 次伤即散）', cd: 5, unlockPhase: 1, damage: 25, castLock: 0.3, telegraph: 0.3, action: 'mirror-image', phantom: { duration: 8, damage: 25 } },
  { slot: 'skill2', name: '引力潮汐（220px 内拉 100px）', cd: 5, unlockPhase: 1, damage: 0, castLock: 0.3, telegraph: 1.0, action: 'gravity-tide' },
  { slot: 'skill3', name: '月相脉冲（环形波 300px 随机留缝）', cd: 5, unlockPhase: 1, damage: 20, castLock: 0.3, telegraph: 0.8, action: 'moon-pulse' },
  { slot: 'ultimate', name: '月坠（120px 落点 2s 预警）', cd: 8, unlockPhase: 1, damage: 30, castLock: 0.5, telegraph: 2.0, action: 'moonfall' },
];

/** 四 Boss 五槽技能表（MN-22 定稿） */
export const BOSS_SKILL_TABLES: Record<BossId, BossSkillTable> = {
  boss_1: {
    bossId: 'boss_1',
    positioning: 'summoner',
    slots: BOSS_1_SLOTS,
    phase2: { cdMultiplier: 0.75, summonCap: 8, unlocksUltimate: true }, // 普技 CD −25% + 骑士解锁 + 上限 6→8
    hasPhase2: true,
  },
  boss_2: {
    bossId: 'boss_2',
    positioning: 'domain',
    slots: BOSS_2_SLOTS,
    phase2: { cdMultiplier: 0.75, extraSummon: { enemyId: 'enemy_g2_3', count: 2 }, summonCap: 8, unlocksUltimate: true }, // 血井解锁 + 召唤 2 侍僧
    hasPhase2: true,
  },
  boss_3: {
    bossId: 'boss_3',
    positioning: 'assault',
    slots: BOSS_3_SLOTS,
    phase2: { cdMultiplier: 0.5, summonCap: 8, unlocksUltimate: false }, // 扑击 CD 减半 + 连招解锁（快狼扑演出内容批）
    hasPhase2: true,
  },
  boss_4: {
    bossId: 'boss_4',
    positioning: 'moon-cycle',
    slots: BOSS_4_SLOTS,
    phase2: { cdMultiplier: 1, summonCap: 8, unlocksUltimate: false },
    hasPhase2: false, // 无阶段（既有口径维持）
  },
};

/** 按 slot 取技能配置（undefined 安全） */
export function bossSkillFor(bossId: BossId, slot: BossSlot): BossSkillConfig | undefined {
  return BOSS_SKILL_TABLES[bossId].slots.find((s) => s.slot === slot);
}
