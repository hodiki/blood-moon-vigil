/**
 * config/balance.ts —— 数值常量表（ARCH §2：唯一配置来源，禁止散落魔法数字）
 *
 * 与 GDD 一一对应（test-framework §4 balance.test.ts 做埋点断言基线）：
 * - 玩家初始属性 / 成长：upgrade-pool §③
 * - 世界/地图：S9 + art-bible §5（tile 64×64、基底 #0B0E14/#131722）
 * - 摇杆：ux-spec §2/§5（常驻底座 (180,1120)、死区 10%）
 * - 敌人面板：enemies §③（E2-S2 埋点断言基线）
 * - 武器数值：weapons §③（E2-S3 埋点断言基线）
 * - 生成器：spawner §③（E2-S4 埋点断言基线）
 *
 * 注意：玩家初始 HP=100 已由 upgrade-pool v0.2 裁决确认（TASK-11），
 * 不再属于工程假设（control-manifest §9 C-3 已同步更新）。
 */

export const WORLD = {
  WIDTH: 3000,
  HEIGHT: 3000,
} as const;

export const TILE = {
  SIZE: 64,
} as const;

/** art-bible §2/§5 色板（工程侧 token 统一来源，禁止硬编码） */
export const PALETTE = {
  base: '#0B0E14', // 墨夜蓝黑：地图主背景
  baseLight: '#131722', // 暗紫灰：地面/石板材质
  // 地形双材质（art-bible §5：石板/草地，均低饱和暗色，明度 12–18%，不与角色抢眼）
  grassBase: '#18201C', // 草地基底（明度 ~13%）
  grassBlade: '#2A3B2E', // 草地草叶（低饱和暗绿——刻意压暗，避免与「绿=治疗」语义混淆）
  player: '#E8F0FA', // 月银白：玩家剪影
  playerAccent: '#54E6C9', // 冷青：玩家描边/选中态
  uiPaper: '#F2F5F9', // 纸白：UI 文字/图标主体（art-bible §2；TASK-33 矢量图标 token）
  blocker: '#2A3346', // 灰蓝：障碍/墙（art-bible §5）
  danger: '#FF3B30', // 血橙红：危险/边界
  // 敌人编码（art-bible §4：暗红剪影/幽紫/猩红金；普通敌纯剪影无描边 → RV-C1）
  enemyZombie: '#8C2F2F', // 僵尸：暗红剪影·尖牙
  enemyWolf: '#A03A3A', // 疾行者：暗红·更小更快
  enemyTank: '#5A3A8C', // 厚血怪：幽紫（双角由 E4 美术落实）
  enemyBoss: '#FF3B3B', // Boss：猩红金主色（art-bible §2 猩红金 #FF3B3B+#FFC93C；E4-S2 使用）
  // E4-S4 程序剪影兜底（asset-spec v1.1 §4.2）：15 敌按 tier/阵营取色——
  // BLOOD 亡者沿用暗红系；BEAST 兽群用灰棕系（区别于血廷暗红，M4 外部素材按帧名无痛替换）
  enemyWraith: '#8C5A8C', // 亡魂：幽紫残影（相位·半透明）
  enemyNecro: '#7A3A4A', // 尸巫：暗红褐（骷髅法杖）
  enemyGravekeeper: '#6E3A8C', // 守墓者：幽紫（R-C3-RULING 墓地精英 · 断碑残冠 1.5x）
  beastGrey: '#7A6A5A', // 灰狼：暗灰棕（竖耳）
  beastShadow: '#4A4256', // 暗影狼：暗蓝灰（流线）
  beastStone: '#5A5E6E', // 石甲狼：冷灰（石甲纹·精英幽紫调）
  beastHunter: '#6E4A3A', // 狼裔猎手：暗褐（人形狼首）
  missile: '#E8F0FA', // 飞弹：月银白短条
  orb: '#54E6C9', // 环绕球：冷青（描边烘焙进贴图，不用 FX.Outline）
  shockwave: '#FF3B30', // 冲击波：血橙红扩散环
  /** 治疗（art-bible §2.4 14 token 青绿 #43D17C：绿=安全/治疗语义；拾取发光/治疗粒子 token 来源） */
  heal: '#43D17C',
} as const;

export const PLAYER = {
  SPAWN_X: WORLD.WIDTH / 2,
  SPAWN_Y: WORLD.HEIGHT / 2,
  MOVE_SPEED: 235, // px/s（TASK-39 R1 波次2：220→235 +6.8%，用户已批；E1-S6 验收基线同步）
  MAX_HP: 100, // upgrade-pool v0.2 裁决（TASK-11）已确认 HP=100（control-manifest §9 C-3）
  DAMAGE_MULTIPLIER: 1.0, // 初始倍率（upgrade-pool §③）
  INVULNERABLE_TIME: 0.5, // s（enemies §⑥.3 接触无敌帧）
  RADIUS: 14, // 碰撞半径 px（与僵尸同量级，enemies §③）
} as const;

/** 升级自动成长（upgrade-pool §③，纯逻辑可单测） */
export const GROWTH = {
  HP_PER_LEVEL: 8,
  DAMAGE_PCT_PER_LEVEL: 0.04, // +4%
  SPEED_EVERY_N_LEVELS: 5,
  SPEED_PER_STEP: 4, // px/s
} as const;

/** 虚拟摇杆（移动端，ux-spec §2/§5 混合方案：常驻底座 + 左半屏任意处起手） */
export const JOYSTICK = {
  DEFAULT_BASE_X: 180, // 720×1280 设计空间
  DEFAULT_BASE_Y: 1120,
  RADIUS: 48, // 底座视觉 96px 直径（CM §6）
  DEAD_ZONE_FRACTION: 0.1, // 中心 10% 不响应（CM M8）
} as const;

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

export const ENEMIES: Record<EnemyKindId, EnemyPanel> = {
  zombie: { hp: 12, speed: 55, damage: 10, attackInterval: 1.0, radius: 14, xp: 1 },
  wolf: { hp: 10, speed: 150, damage: 8, attackInterval: 0.8, radius: 12, xp: 2 },
  // TASK-39 R1 波次2：厚血经验 15→10（E3 预授权判据触发：R1 满局 Lv47 → 压后期经验通胀，目标 Lv42–45）
  tank: { hp: 600, speed: 35, damage: 20, attackInterval: 1.5, radius: 22, xp: 10 },
  // TASK-31 收尾节奏调整（rhythm-pace-adj §3）：Boss HP 6000→4000（-33%，匹配 6min 局成型强度；
  // 中位 DPS 60–75 → 战 53–67s、保守 45–55 → 73–89s ≤ 90s 上限；60~90s 判据保持）
  boss: { hp: 4000, speed: 28, damage: 30, attackInterval: 2.0, radius: 40, xp: 100 },
};

/** 敌人类型 id（面板 key；普通 3 敌共用一池，Boss 由 E4 接入） */
export type EnemyKindId = 'zombie' | 'wolf' | 'tank' | 'boss';

/**
 * 武器数值（weapons §③ 数值表，E2-S3 / weapons/*.test 埋点断言）。
 * 伤害流程：命中伤害 = 基础伤害 × 总倍率（weapons §③，初始倍率 1.0）。
 */
export const WEAPONS = {
  /** 自动飞弹「血月猎手」：12 伤 / 1.2s 冷却 / 400px/s 追踪 / 3s 飞行寿命 / 同屏 ≤8 */
  MISSILE: { DAMAGE: 12, COOLDOWN: 1.2, SPEED: 400, LIFETIME: 3, MAX_ACTIVE: 8, RADIUS: 6 },
  /** 护体环绕球「守夜之环」：3 颗基础 / 半径 80px / 240°/s（1.5s/圈）/ 8 伤 / 同目标 0.4s CD / 最多 6 颗 */
  ORBIT: {
    BASE_COUNT: 3,
    RADIUS: 80,
    ANGULAR_SPEED_DEG: 240,
    DAMAGE: 8,
    PER_TARGET_COOLDOWN: 0.4,
    MAX_COUNT: 6,
    ORB_RADIUS: 10,
  },
  /** 定时冲击波「月蚀脉冲」：60 伤 / 8s 冷却 / 半径 280px / 扩散 0.4s / 全方向穿透 */
  SHOCKWAVE: {
    DAMAGE: 60,
    COOLDOWN: 8,
    RADIUS: 280,
    EXPAND_SECONDS: 0.4,
    KNOCKBACK_DISTANCE: 80, // 击退 80px（upgrade-pool 第 7 项，E3-S5 写回）
  },
} as const;

/** 武器初始 DPS 参考（weapons §③：飞弹 10 · 环绕球 ~16（60% 命中率）· 冲击波 7.5 → 合计 ≈33.5）
 * 口径说明（design-review-e3 §3）：33.5 为「三武器齐备」FULL_KIT 参考值，非开局实际 DPS
 * （开局仅自动飞弹，实际 DPS=10，见 upgrade-pool §③ 初始武器门控）。不改数值，仅澄清口径。 */
export const INITIAL_DPS_REFERENCE = 33.5;

/**
 * 敌潮生成器（spawner §③，E2-S4 / spawner.test 埋点断言）。
 * budget(t) = 1.2 × (1 + 1.2×t/360) × (1 + 0.3×sin(2πt/60))。
 * TASK-39 R1 波次2：LINEAR_SCALE 2.5→3.0、WAVE_AMPLITUDE 0.4→0.3；
 * TASK-43 R2：LINEAR_SCALE 3.0→3.3（20min 均值 4.8→5.16 点/s，整体 +10% 密度，
 * 前期小怪/经验节奏提速）；WAVE_AMPLITUDE 0.3 不动（峰谷比 1.86 仍 ≥40%，S8-3）。
 * TASK-31 收尾节奏调整（rhythm-pace-adj §4）：6min 局压缩 3.3 倍 ——
 * LINEAR_TOTAL_SECONDS 1200→360（对齐 BOSS_TIME）、LINEAR_SCALE 3.3→1.2
 * （前期斜率放缓保「就爽」，360s 均值 2.64 点/s vs 旧 20min 5.16）、
 * WAVE_PERIOD_SECONDS 75→60（360s 局 6 个波峰波谷，30s 交替咬合升级间隔）。
 */
export const SPAWNER = {
  BASE_BUDGET: 1.2, // 基数 点/s
  LINEAR_SCALE: 1.2, // 线性项系数（TASK-31 收尾：3.3→1.2，对齐 6min 局）
  LINEAR_TOTAL_SECONDS: 360, // 6 分钟线性项分母（对齐 BOSS_TIME）
  WAVE_AMPLITUDE: 0.3, // 正弦波幅 ±30%（R1 波次2；仍满足相邻周期差异 ≥40%）
  WAVE_PERIOD_SECONDS: 60, // 正弦周期（TASK-31 收尾：75→60，6 个波峰波谷）
  BOSS_TIME: 360, // 6:00 Boss 收束（TASK-31 收尾：1200→360）
  RETRY_PAUSE_SECONDS: 2, // 达上限暂停生成 2s 后重试（不丢弃预算）
  /**
   * 厚血保底按阶段（TASK-31 收尾，rhythm-pace-adj §2：由全局 30s → S2=30s / S3=20s）。
   * 本常量即 S2 阶段保底（spawner.ts SPAWN_STAGES 引用）；S3=20s 见 TANK_GUARANTEE_EVERY_SECONDS_S3。
   * 决策记录：E3 C3 首验 20s→40s（TASK-15）；E4 用户真机回调 40s→30s（TASK-18）；
   * TASK-43 R2 保持 30s 并靠 0–3min 随机 0.5% 提前首见（8/8 种子 ≤3.2min）。
   * TASK-31 后：S1 无保底（随机 0.5% 保留惊喜首见）、S2=30s（2:00/2:30/3:00 各 1 只 → 3min 前必见 ≥2 保底精英）、
   * S3=20s（Boss 前峰值爬升）。
   */
  TANK_GUARANTEE_EVERY_SECONDS: 30, // S2（120–240s）保底间隔
  /** TASK-31 收尾：S3（240–360s）保底间隔（Boss 前峰值段加密） */
  TANK_GUARANTEE_EVERY_SECONDS_S3: 20,
  /** TASK-39 E2 屠夫预警：保底厚血出生前 N 秒在出生点显示血月印记（红圈精灵 + 低音） */
  TANK_WARNING_SECONDS: 2.5,
} as const;

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

/**
 * 画面特效（TASK-28 美术表现力专项升级 · Phase 6 穿插）。
 * 所有特效常量收敛于此（ARCH §2 唯一配置来源）；色值一律取 PALETTE/BOSS/GEM token（token 统一来源纪律）。
 * 粒子池上限由 runtime-config.maxParticles 驱动（桌面 200 / 移动 100）；拖尾类（fxTrails=false）移动端关闭后池负载大幅下降。
 * 纯时长/数量为视觉参数，不触碰任何 GDD 数值（GDD 数值表在 §敌面板/武器/生成器/升级池）。
 */
export const FX = {
  /** 粒子池双端预算硬上限（桌面 200 / 移动 100 由 runtime-config 覆盖；此为口径值，用于单测/审计断言） */
  PARTICLE_BUDGET: 200,
  /** 通用粒子寿命 s */
  PARTICLE_LIFE: 0.45,
  /** 飞弹拖尾（TASK-36：点→彗尾 p-streak）：发射间隔 ms / 粒子寿命 s / 每枚每拍粒子数 / 帧 */
  TRAIL_INTERVAL_MS: 70,
  TRAIL_LIFE: 0.32,
  TRAIL_COUNT_PER_MISSILE: 1,
  TRAIL_FRAME: 'p-streak',
  /** TASK-36 飞弹发射喷涌：喷点数（开火小 puff，呼应提灯冷青） */
  MISSILE_LAUNCH_PUFF_COUNT: 3,
  /** TASK-36 飞弹命中反馈：冷青冲击环（粒子数/半径）+ 火花（粒子数） */
  MISSILE_IMPACT_RING_COUNT: 6,
  MISSILE_IMPACT_RING_RADIUS: 12,
  MISSILE_IMPACT_SPARK_COUNT: 4,
  /** 环绕球轨道残影（环）：外环透明度 / 转速 deg/s；TASK-36 双层环（内环反向慢旋） */
  ORBIT_RING_ALPHA: 0.26,
  ORBIT_RING_SPIN_DEG: 24,
  ORBIT_RING_SECONDARY_ALPHA: 0.12,
  ORBIT_RING_SECONDARY_OFFSET: 12,
  ORBIT_RING_SECONDARY_SPIN_DEG: -12,
  /** TASK-36 环绕球尾迹：节流 ms / 寿命 s / 粒子尺寸（原地淡出渐隐光点） */
  ORBIT_TRAIL_INTERVAL_MS: 140,
  ORBIT_TRAIL_LIFE: 0.25,
  ORBIT_TRAIL_SIZE: 2.2,
  /** TASK-36 环绕球命中火花：粒子数 / 全局节流 ms（防高频刷屏） */
  ORBIT_HIT_SPARK_COUNT: 3,
  ORBIT_HIT_THROTTLE_MS: 200,
  /** 宝石磁吸拖尾：发射间隔 ms / 粒子寿命 s */
  GEM_TRAIL_INTERVAL_MS: 150,
  GEM_TRAIL_LIFE: 0.2,
  /** 冲击波涟漪（TASK-36 加密提速）：环上粒子数（桌面 36 / 移动 24 降档）/ 外扩速度 / 粒子尺寸 */
  RIPPLE_COUNT: 36,
  RIPPLE_COUNT_MOBILE: 24,
  RIPPLE_SPEED: 90,
  RIPPLE_SIZE: 4,
  /** TASK-36 冲击波最大半径白闪环：粒子数 / 寿命 s（月蚀亮边） */
  SHOCKWAVE_EDGE_FLASH_COUNT: 12,
  SHOCKWAVE_EDGE_FLASH_LIFE: 0.18,
  /** TASK-36 蓄力脉冲提示（随 fxTrails 开关）：alpha / 半径 px / 提前提示秒 */
  SHOCKWAVE_CHARGE_PULSE_ALPHA: 0.15,
  SHOCKWAVE_CHARGE_PULSE_RADIUS: 60,
  SHOCKWAVE_CHARGE_PULSE_LEAD_SECONDS: 2,
  /** Boss 出场：冲击环粒子数 / 半径 px */
  BOSS_RING_COUNT: 22,
  BOSS_RING_RADIUS: 90,
  /** 升级粒子：数量（金 + 冷青双色） */
  LEVELUP_COUNT: 16,
  /** 宝石拾取爆点：数量 */
  GEM_PICKUP_COUNT: 6,
} as const;

/** 纠结时刻埋点（upgrade-pool §⑧.3 / design-review-e3 交接项 2）：停留 >3s 记为纠结 */
export const HESITATION = {
  DWELL_SECONDS: 3,
} as const;

/** 局终判据（enemies §⑤ / design-review-e3 交接项 4）：Boss 战 60~90s 为最终判据 */
export const GAME = {
  BOSS_FIGHT_TARGET_MIN: 60,
  BOSS_FIGHT_TARGET_MAX: 90,
} as const;

/**
 * 主动技（M1b 主动技迷你验证原型 · 守夜人·艾德蒙「提灯闪耀」）。
 * 数据源：content-design-outline §2.2（DEFENSE：周围 240px 眩晕 2.5s + 自身无敌 1.5s，CD 20s）
 * + pillars-v1 §6（CD 12~25s、无资源条、不打断移动、状态机冻结、释放后 100ms 输入锁防抖）。
 * 类型标签进入数据配置（pillars §6.2）：type: 'DEFENSE' | 'BURST' | 'MOBILITY'。
 */
export const ACTIVE_SKILL = {
  /** 内容 ID（content-design-outline §1.3：角色 hero_<id>，主动技随角色） */
  ID: 'hero_edmund_lantern_flash',
  /** 定位三选一：防御型（眩晕/无敌/护盾） */
  TYPE: 'DEFENSE',
  /** CD 20s（pillars §6.4：CD 12~25s；防御型中长） */
  CD: 20,
  /** 周围 240px（content §2.2） */
  RADIUS: 240,
  /** 敌人眩晕 2.5s（content §2.2） */
  STUN_DURATION: 2.5,
  /** 自身无敌 1.5s（content §2.2） */
  INVULN_DURATION: 1.5,
  /** 释放后 100ms 输入锁定防抖（pillars §6.7-3） */
  INPUT_LOCK_SECONDS: 0.1,
} as const;

/** 主动技平衡红线（pillars §5/§6.5 可检验含义；active-skill 模拟断言用） */
export const ACTIVE_SKILL_RULES = {
  /** 单局输出占比 ≤15%（6 分钟模拟，埋点 activeSkillDpsShare） */
  DPS_SHARE_MAX: 0.15,
  /** 平均每局触发 ≤18 次（CD 20s 理论 ~18 次，pillars §5-②） */
  MAX_CASTS_PER_RUN: 18,
  /** 目标中位 ~12 次（约每 30s 一次，pillars §5-②） */
  TYPICAL_CASTS: 12,
  /** 中位触发间隔 s（pillars §1：约每 30s 一次） */
  CAST_INTERVAL_MEDIAN: 30,
  /**
   * BURST 型守则（AC-C2 / sprint-m2-plan R7）：**CD ≥18s 或单次价值 ≤120** → 占比 ≤15%。
   * 违例配置（CD<18 且单次>120）在 `simulateActiveSkillDpsShare` 强制断言 FAIL（≈15.8% 越线案例锁死）。
   */
  BURST_MIN_CD: 18,
  BURST_MAX_DAMAGE_PER_CAST: 120,
  /** 红线条目（E1-S5 / gdd-active-skill §3.2 口径 1）：狂化「伤害倍率 +40%」= 加法叠加 +0.40（非乘算 ×1.40） */
  RAGE_MULTIPLIER_ADD: 0.40,
  /** 红线条目（E1-S5 / gdd-active-skill §3.2 口径 3）：狂化接触光环 = 平摊 25 伤/s（不按敌数叠加） */
  CONTACT_AURA_FLAT_DPS: 25,
  /** 工程常量（E4-S2）：血影突袭冲刺时长 s（240px / 0.2s = 1200px/s；GDD 未列精确值，标记为工程参数） */
  DASH_DURATION_SECONDS: 0.2,
  /** 工程常量（E4-S2）：狂化接触光环半径 px（接触判定；GDD 未列精确值，标记为工程参数） */
  CONTACT_AURA_RADIUS: 60,
} as const;

/**
 * 经验与升级需求（upgrade-pool §③ / E3-S1）：need(n) = 5 + 3×(n−1)。
 * 首级 5 点（约 30s 内达成）；6 分钟模拟累计 ≈1200 点 → Lv~27（rhythm-pace-adj §3，TASK-31 节奏调整）。
 */
export const XP = {
  BASE_NEED: 5, // need(1) = 5
  NEED_STEP: 3, // 每级增量
  MAX_LEVEL: 99, // 模拟防 while 死循环上限（6 分钟可达 Lv~27，远超）
} as const;

/**
 * 经验宝石（E3-S1 / ARCH §3.2 池表）：蓝菱 #4FC3F7。
 * 本体 12px 视觉 / 拾取识别区 16px / 磁吸 140px（TASK-39 R1 波次2：80→140，覆盖近距离击杀+走位偏差）。
 * 磁吸速度 320→360px/s（140px 内 0.39s 吸入，手感干脆；升级第 9 项 +100% → 280→420）。
 * E-lite 滞留慢漂（TASK-39 E1 辅）：落地 >3s 且距玩家 >磁吸半径时以 80px/s 向玩家漂移
 * （低于玩家移速 235，不会变"免费全屏拾取"；进入磁吸半径后切换 360px/s 吸入）。
 */
export const GEM = {
  COLOR: '#4FC3F7',
  BODY_SIZE: 12,
  PICKUP_RADIUS: 16,
  MAGNET_RADIUS: 140,
  MAGNET_SPEED: 360,
  /** E-lite 漂移：落地年龄阈值 s */
  DRIFT_AGE_THRESHOLD: 3,
  /** E-lite 漂移速度 px/s */
  DRIFT_SPEED: 80,
} as const;

/**
 * 治疗道具（content-design-outline §7 注随修女落地；asset-spec §1.5 `heal` 帧 16×16；
 * 规格终稿 = merit-ui-spec §11「治疗道具规格确认」+ M3 平衡模拟调整）。
 * - 视觉：治疗绿 #43D17C + 白十字（art-bible 治疗 = 绿 + 十字双编码）；呼吸发光 1s
 * - 效果：+30HP（固定值；上限钳制到 maxHp；修女「执烛之心」×1.5 → 45，PlayerStats 消费）
 * - 掉落（merit-ui-spec §11 + M3 模拟调整）：精英（tank 槽）掉率 50%（100%→50% 预案），
 *   Boss/血月化身**保底掉 1 个**；普通怪不掉（防掉落稀释）。
 *   M3 治疗总量模拟（heal-balance.test.ts）：精英保底 ~10/局 × 掉率 × 30 + Boss 30
 *   = 调整后 180 HP/局 ≤ 200 红线（调整前 330 超标）——详见提交说明与测试。
 * - 满血拾取：道具保留地面不消失（回血后再捡有效）
 */
export const HEAL = {
  COLOR: '#43D17C',
  /** 治疗道具视觉尺寸（asset-spec §2.2 拾取 12~24px 档；heal 帧 16×16） */
  BODY_SIZE: 16,
  /** 基础治疗量（固定值 30；M3 模拟预案备选 25，本版保留 30 + 掉率调整） */
  AMOUNT: 30,
  /**
   * 精英（tank 槽）治疗道具掉率（merit-ui-spec §11 预案：100%→50%）——
   * M3 模拟调整：精英保底 ~10/局 × 0.5 × 30 + Boss 30 = 180 ≤ 200 红线；
   * 若 100% 则 330 超标。Boss/化身不受影响（保底 100%）。
   */
  ELITE_DROP_CHANCE: 0.5,
  /** 掉落来源语义（merit-ui-spec §11：elite/boss 保底；普通怪不掉）——供 isHealDropSource 断言 */
  DROP_SOURCE: 'elite-boss',
  /** 拾取识别半径 px（与经验宝石同档） */
  PICKUP_RADIUS: 16,
} as const;

/** 升级项类型：mechanic=机制改变型 / numeric=纯数值型（upgrade-pool §③） */
export type UpgradeType = 'mechanic' | 'numeric';

export interface UpgradeItemData {
  id: number;
  name: string;
  type: UpgradeType;
  desc: string;
  /** UI 数值变化文案（如「+15%」「-8%」） */
  effectText: string;
  /** 叠加上限：可重复 = Infinity；第 4 项上限 3 = 6 颗 − 基础 3 颗 */
  maxStack: number;
}

/**
 * 升级池 12 项（upgrade-pool §③ 表，与 GDD 逐项一致 —— E3-S3 / upgrade-pool.test 埋点断言）。
 * 机制改变型 9/12 = 75% ≥ 50% ✔；初始武器为自动飞弹，1/2 号项为「新武器解锁」。
 */
export const UPGRADES: readonly UpgradeItemData[] = [
  { id: 1, name: '解锁「守夜之环」', type: 'mechanic', desc: '获得护体环绕球（3 颗）', effectText: '解锁新武器', maxStack: 1 },
  { id: 2, name: '解锁「月蚀脉冲」', type: 'mechanic', desc: '获得定时冲击波（280px）', effectText: '解锁新武器', maxStack: 1 },
  { id: 3, name: '飞弹分裂', type: 'mechanic', desc: '命中时额外生成 1 枚次级弹（×0.6 伤害）', effectText: '+1 次级弹', maxStack: 2 },
  { id: 4, name: '护体球 +1', type: 'mechanic', desc: '环绕球数量 +1（最多 6 颗）', effectText: '+1 颗', maxStack: 3 },
  { id: 5, name: '冲击波范围 +50%', type: 'mechanic', desc: '半径 280→420→560px', effectText: '+50%', maxStack: 2 },
  { id: 6, name: '飞弹穿透', type: 'mechanic', desc: '命中后继续飞行，穿透 1 个敌人', effectText: '穿透 1', maxStack: 1 },
  { id: 7, name: '冲击波击退', type: 'mechanic', desc: '命中附加 80px 击退', effectText: '击退 80px', maxStack: 1 },
  { id: 8, name: '吸血', type: 'mechanic', desc: '每次击杀回复 1 HP', effectText: '+1 HP/击杀', maxStack: 1 },
  { id: 9, name: '经验磁力 +100%', type: 'mechanic', desc: '拾取范围 80→160→240px', effectText: '+100%', maxStack: 2 },
  { id: 10, name: '伤害强化 +15%', type: 'numeric', desc: '总伤害倍率 +0.15', effectText: '+15%', maxStack: Number.POSITIVE_INFINITY },
  { id: 11, name: '冷却缩减 -8%', type: 'numeric', desc: '全部武器冷却 ×0.92（飞弹 1.2→1.10s）', effectText: '-8%', maxStack: 3 },
  { id: 12, name: '最大生命 +20', type: 'numeric', desc: '最大生命 +20', effectText: '+20', maxStack: 5 },
] as const;

// ============================================================================
// M2-S1a 内容表骨架（content-design-outline v1.1 / 各 GDD 数据驱动）
// 说明：本段为**纯数据层骨架**，不接任何行为逻辑；既有 WEAPONS/ENEMIES/UPGRADES/
//       ACTIVE_SKILL 等 Demo 常量保持原样（运行时代码依赖其形状），新表以内容 ID
//       为主键并行存在。行为接入见 E2~E4 各 Epic。
// ============================================================================

/** powerTag 五 tag（content-design-outline §1.3 / world-bible §4） */
export type PowerTag = 'SILVER' | 'HALLOWED' | 'BEAST' | 'BLOOD' | 'MOON';

/** 武器类：A 弹幕 / B 环绕 / C 范围 / D 召唤（content-design-outline §3.1） */
export type WeaponClass = 'A' | 'B' | 'C' | 'D';

/** 内容 ID 联合类型（content-design-outline §1.3 / content-id-frame-map §1~6） */
export type WeaponId =
  | 'wpn_a_1' | 'wpn_a_2' | 'wpn_a_3' | 'wpn_a_4' | 'wpn_a_5'
  | 'wpn_b_1' | 'wpn_b_2' | 'wpn_b_3'
  | 'wpn_c_1' | 'wpn_c_2' | 'wpn_c_3'
  | 'wpn_d_1' | 'wpn_d_2' | 'wpn_d_3';

export type EvoId =
  | 'evo_moonwrath' | 'evo_silverblast' | 'evo_seraphring' | 'evo_totaleclipse'
  | 'evo_bloodsea' | 'evo_batstorm' | 'evo_packleader';

export type EnemyId =
  | 'enemy_g1_1' | 'enemy_g1_2' | 'enemy_g1_3' | 'enemy_g1_4' | 'enemy_g1_5' | 'enemy_g1_6'
  | 'enemy_g2_1' | 'enemy_g2_2' | 'enemy_g2_3' | 'enemy_g2_4' | 'enemy_g2_5'
  | 'enemy_g3_1' | 'enemy_g3_2' | 'enemy_g3_3' | 'enemy_g3_4';

export type BossId = 'boss_1' | 'boss_2' | 'boss_3' | 'boss_4';

export type HeroId = 'hero_edmund' | 'hero_cassandra' | 'hero_violet' | 'hero_galvan';

export type MapId = 'map_graveyard' | 'map_cathedral' | 'map_den';

/**
 * 升级项内容 ID（gdd-upgrade-pool-v2 §3.2~3.5）。
 * 主动技强化按角色展开为 12 项（content-design-outline §6.5「4 角色 ×3 分支」），
 * GDD §3.5 以 3 分支紧凑表呈现；此处以 `up_a_<分支>_<hero>` 唯一化，保证池恰好 40 项。
 */
export type UpgradeId =
  | 'up_g_1' | 'up_g_2' | 'up_g_3' | 'up_g_4' | 'up_g_5' | 'up_g_6' | 'up_g_7' | 'up_g_8' | 'up_g_9'
  | 'up_w_a1' | 'up_w_a2' | 'up_w_a3'
  | 'up_w_b1' | 'up_w_b2' | 'up_w_b3'
  | 'up_w_c1' | 'up_w_c2' | 'up_w_c3'
  | 'up_w_d1' | 'up_w_d2' | 'up_w_d3'
  | 'key_scope' | 'key_holy' | 'key_tome' | 'key_silver' | 'key_pact' | 'key_bone' | 'key_grail'
  | 'up_a_cd_edmund' | 'up_a_charge_edmund' | 'up_a_effect_edmund'
  | 'up_a_cd_cassandra' | 'up_a_charge_cassandra' | 'up_a_effect_cassandra'
  | 'up_a_cd_violet' | 'up_a_charge_violet' | 'up_a_effect_violet'
  | 'up_a_cd_galvan' | 'up_a_charge_galvan' | 'up_a_effect_galvan';

/**
 * 武器配置（gdd-weapons-v2 §3.2~3.5，逐项继承 content-design-outline §3.2）。
 * 字段按类可选：骨架阶段全量落表；伤害列口径见 damageDesc（C2/C3 为每秒 tick）。
 */
export interface WeaponConfig {
  id: WeaponId;
  name: string;
  class: WeaponClass;
  powerTag: PowerTag;
  /** 帧名（content-id-frame-map §2；M4 替换基准，须在 frame-registry 中） */
  frame: string;
  /** 基础单目标等效 DPS（gdd-weapons-v2 §3.6，倍率 1.0） */
  baseDps: number;
  /** 手感/定位（GDD §3.2~3.5 手感列） */
  feel: string;
  /** GDD 伤害列原文（如 10×5 发 / 20/s） */
  damageDesc?: string;
  damage?: number;
  cooldown?: number;
  speed?: number;
  returnSpeed?: number;
  lifetime?: number;
  maxActive?: number;
  range?: number;
  pierce?: number;
  hitRate?: number;
  pellets?: number;
  spreadDeg?: number;
  baseCount?: number;
  maxCount?: number;
  radius?: number;
  angularSpeedDeg?: number;
  perTargetCooldown?: number;
  slowPct?: number;
  slowDuration?: number;
  auraDps?: number;
  auraRadius?: number;
  damageReduction?: number;
  duration?: number;
  summonCount?: number;
  attackInterval?: number;
  respawnCd?: number;
  knockback?: number;
}

/** 武器表 14（gdd-weapons-v2 §3.2~3.5；wpn_a_5 骨钉标枪 powerTag 归 BLOOD，consistency C1） */
export const WEAPON_CONFIGS: Record<WeaponId, WeaponConfig> = {
  wpn_a_1: {
    id: 'wpn_a_1', name: '血月猎手', class: 'A', powerTag: 'MOON', frame: 'missile', baseDps: 9.0,
    feel: '高频单体·银制月光箭（银质材质共存，主 tag MOON，无数值影响）',
    damage: 12, cooldown: 1.2, speed: 400, lifetime: 3, maxActive: 8, pierce: 0, hitRate: 0.9, damageDesc: '12',
  },
  wpn_a_2: {
    id: 'wpn_a_2', name: '银针连弩', class: 'A', powerTag: 'SILVER', frame: 'proj-crossbow', baseDps: 10.7,
    feel: '高速直射·穿群',
    damage: 8, cooldown: 0.45, speed: 520, lifetime: 1.2, maxActive: 6, range: 400, pierce: 1, hitRate: 0.75, damageDesc: '8',
  },
  wpn_a_3: {
    id: 'wpn_a_3', name: '圣银火铳', class: 'A', powerTag: 'SILVER', frame: 'proj-blunderbuss', baseDps: 15.9,
    feel: '霰弹爆发·近距',
    damage: 10, cooldown: 2.2, speed: 420, lifetime: 0.8, maxActive: 15, range: 220, pellets: 5, spreadDeg: 45, hitRate: 0.6, damageDesc: '10×5 发（扇形 45°）',
  },
  wpn_a_4: {
    id: 'wpn_a_4', name: '幽灵飞刃', class: 'A', powerTag: 'MOON', frame: 'proj-boomerang', baseDps: 13.3,
    feel: '往返双段·穿怪',
    damage: 18, cooldown: 1.6, speed: 380, returnSpeed: 500, maxActive: 4, hitRate: 0.75, damageDesc: '18+18（去/回）',
  },
  wpn_a_5: {
    id: 'wpn_a_5', name: '骨钉标枪', class: 'A', powerTag: 'BLOOD', frame: 'proj-javelin', baseDps: 8.0,
    feel: '低频贯穿·重型（穿群 22+）',
    damage: 30, cooldown: 3.0, speed: 700, lifetime: 1.2, maxActive: 3, range: 560, pierce: 3, hitRate: 0.75, damageDesc: '30（贯穿 3，射程 560）',
  },
  wpn_b_1: {
    id: 'wpn_b_1', name: '守夜之环', class: 'B', powerTag: 'HALLOWED', frame: 'orb', baseDps: 16.0,
    feel: '防御环绕·均衡',
    damage: 8, baseCount: 3, maxCount: 6, radius: 80, angularSpeedDeg: 240, perTargetCooldown: 0.4, hitRate: 0.6, damageDesc: '8',
  },
  wpn_b_2: {
    id: 'wpn_b_2', name: '荆棘圣环', class: 'B', powerTag: 'HALLOWED', frame: 'orb-thorn', baseDps: 12.8,
    feel: '控制环绕·减速',
    damage: 8, baseCount: 4, maxCount: 6, radius: 72, angularSpeedDeg: 180, perTargetCooldown: 0.4, slowPct: 0.3, slowDuration: 1, hitRate: 0.6, damageDesc: '8 + 减速 30%（1s）',
  },
  wpn_b_3: {
    id: 'wpn_b_3', name: '圣光壁垒', class: 'B', powerTag: 'HALLOWED', frame: 'aura-barrier', baseDps: 4.8,
    feel: '防御领域·减伤',
    auraDps: 6, auraRadius: 120, damageReduction: 0.1, damageDesc: '6/s（光环 120px）+ 承伤 -10%',
  },
  wpn_c_1: {
    id: 'wpn_c_1', name: '月蚀脉冲', class: 'C', powerTag: 'MOON', frame: 'shockwave', baseDps: 7.5,
    feel: '低频清屏·冲击波',
    damage: 60, cooldown: 8, radius: 280, duration: 0.4, hitRate: 1.0, damageDesc: '60（全向穿透）',
  },
  wpn_c_2: {
    id: 'wpn_c_2', name: '血池喷涌', class: 'C', powerTag: 'BLOOD', frame: 'ring-bloodpool', baseDps: 8.0,
    feel: '持续区域·血池',
    damage: 20, cooldown: 6, radius: 180, duration: 3, slowPct: 0.2, hitRate: 1.0, damageDesc: '20/s（池内多敌 ×4~6）',
  },
  wpn_c_3: {
    id: 'wpn_c_3', name: '审判圣火', class: 'C', powerTag: 'HALLOWED', frame: 'ring-holyfire', baseDps: 8.8,
    feel: '爆发灼烧·圣火',
    damage: 35, cooldown: 8, radius: 200, duration: 2.5, hitRate: 1.0, damageDesc: '35/s（火内多敌 ×4~6）',
  },
  wpn_d_1: {
    id: 'wpn_d_1', name: '血蝠群', class: 'D', powerTag: 'BLOOD', frame: 'summon-bat', baseDps: 11.1,
    feel: '自动增援·吸血流',
    damage: 6, summonCount: 2, attackInterval: 0.5, lifetime: 12, respawnCd: 5, hitRate: 0.75, damageDesc: '2 只 × 6/0.5s',
  },
  wpn_d_2: {
    id: 'wpn_d_2', name: '狼影猎犬', class: 'D', powerTag: 'BEAST', frame: 'summon-hound', baseDps: 8.9,
    feel: '召唤肉盾·撕咬',
    damage: 15, summonCount: 1, attackInterval: 1.0, lifetime: 15, respawnCd: 4, hitRate: 0.75, damageDesc: '1 只 × 15/1s',
  },
  wpn_d_3: {
    id: 'wpn_d_3', name: '断罪锁链', class: 'D', powerTag: 'HALLOWED', frame: 'beam-chain', baseDps: 7.4,
    feel: '定向击退·打断',
    damage: 25, cooldown: 3.5, range: 200, knockback: 100, hitRate: 0.75, damageDesc: '25 + 击退 100（直线 200px）',
  },
};

/** 超武合成映射（content-design-outline §3.3 / gdd-weapons-v2 §5.2：weapon_evolution { wpnId, keyId, evoId }） */
export interface EvolutionConfig {
  evoId: EvoId;
  name: string;
  wpnId: WeaponId;
  keyId: UpgradeId;
  /** 等效 DPS（gdd-weapons-v2 §5.2 数值对齐） */
  baseDps: number;
  frame: string;
  effect: string;
}

/** 超武表 7（gdd-weapons-v2 §5.2 / content-id-frame-map §2） */
export const EVOLUTIONS: readonly EvolutionConfig[] = [
  { evoId: 'evo_moonwrath', name: '血月天罚', wpnId: 'wpn_a_1', keyId: 'key_scope', baseDps: 27.0, frame: 'super-moonwrath', effect: '3 连追踪弹幕，每发命中分裂 1 次级弹（×0.6）' },
  { evoId: 'evo_silverblast', name: '血银霰弹', wpnId: 'wpn_a_3', keyId: 'key_silver', baseDps: 27.2, frame: 'super-silverblast', effect: '8 发扇形，命中爆炸（60px 溅射）' },
  { evoId: 'evo_seraphring', name: '炽天使之环', wpnId: 'wpn_b_1', keyId: 'key_holy', baseDps: 28.8, frame: 'super-seraphring', effect: '6 颗大球，命中击退 60px，球体碰撞后 0.5s 小爆' },
  { evoId: 'evo_totaleclipse', name: '月全食', wpnId: 'wpn_c_1', keyId: 'key_tome', baseDps: 15.0, frame: 'super-totaleclipse', effect: '双脉冲（0.4s 间隔），半径 420，附加 1s 眩晕' },
  { evoId: 'evo_bloodsea', name: '血海', wpnId: 'wpn_c_2', keyId: 'key_grail', baseDps: 15.4, frame: 'super-bloodsea', effect: '地面池 300px，持续 5s，减速 40%' },
  { evoId: 'evo_batstorm', name: '血蝠风暴', wpnId: 'wpn_d_1', keyId: 'key_pact', baseDps: 33.3, frame: 'super-batstorm', effect: '6 只蝙蝠，击杀吸血 0.5 HP/只' },
  { evoId: 'evo_packleader', name: '狼群领袖', wpnId: 'wpn_d_2', keyId: 'key_bone', baseDps: 26.7, frame: 'super-packleader', effect: '3 只猎犬，撕咬附带 30% 减速 1s' },
];

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
}

/**
 * 敌人表 15（gdd-enemies-v2 §3.1~3.3；R-C3-RULING 14→15 补墓地 elite 守墓者）。
 * powerTag 说明：GDD 敌人表未单列 powerTag 列，按 world-bible §3 阵营语义赋值——
 * 墓地/教堂亡者与血廷 = BLOOD（血月傀儡），狼穴兽群 = BEAST；仅 Boss 表由 GDD 明确。
 */
export const ENEMY_CONFIGS: Record<EnemyId, EnemyConfig> = {
  enemy_g1_1: { id: 'enemy_g1_1', name: '行尸', map: 'map_graveyard', tier: 'normal', hp: 12, speed: 55, damage: 10, attackInterval: 1.0, radius: 14, xp: 1, powerTag: 'BLOOD', frame: 'enemy-zombie', counter: '走位拉扯' },
  enemy_g1_2: { id: 'enemy_g1_2', name: '血犬', map: 'map_graveyard', tier: 'fast', hp: 10, speed: 150, damage: 8, attackInterval: 0.8, radius: 12, xp: 2, powerTag: 'BLOOD', frame: 'enemy-hound', counter: '优先处理/绕开' },
  enemy_g1_3: { id: 'enemy_g1_3', name: '墓穴甲虫', map: 'map_graveyard', tier: 'normal', hp: 8, speed: 70, damage: 6, attackInterval: 0.8, radius: 10, xp: 1, powerTag: 'BLOOD', frame: 'enemy-beetle', counter: '范围清屏' },
  enemy_g1_4: { id: 'enemy_g1_4', name: '亡魂', map: 'map_graveyard', tier: 'special', hp: 12, speed: 95, damage: 10, attackInterval: 1.0, radius: 13, xp: 2, powerTag: 'BLOOD', frame: 'enemy-wraith', special: '可穿越障碍（相位）', counter: '走位拉扯（障碍无效化，改靠移速/范围）' },
  enemy_g1_5: { id: 'enemy_g1_5', name: '尸巫', map: 'map_graveyard', tier: 'special', hp: 16, speed: 45, damage: 6, attackInterval: 1.5, radius: 16, xp: 3, powerTag: 'BLOOD', frame: 'enemy-necro', special: '光环：120px 内亡者攻速 +20%（叠 3 层）', counter: '集火（优先击杀光环源）' },
  // R-C3-RULING：墓地补 elite 守墓者（tank 槽只放 elite；无特殊行为，纯厚血精英）
  enemy_g1_6: { id: 'enemy_g1_6', name: '守墓者', map: 'map_graveyard', tier: 'elite', hp: 350, speed: 40, damage: 15, attackInterval: 1.8, radius: 22, xp: 10, powerTag: 'BLOOD', frame: 'enemy-gravekeeper', counter: '集火（高 XP 对价）' },
  enemy_g2_1: { id: 'enemy_g2_1', name: '血信徒', map: 'map_cathedral', tier: 'normal', hp: 14, speed: 60, damage: 12, attackInterval: 1.0, radius: 14, xp: 1, powerTag: 'BLOOD', frame: 'enemy-acolyte', counter: '走位拉扯' },
  enemy_g2_2: { id: 'enemy_g2_2', name: '血蝠', map: 'map_cathedral', tier: 'air', hp: 8, speed: 130, damage: 8, attackInterval: 0.8, radius: 10, xp: 2, powerTag: 'BLOOD', frame: 'enemy-bat', counter: '范围清屏/绕开' },
  enemy_g2_3: { id: 'enemy_g2_3', name: '圣杯侍僧', map: 'map_cathedral', tier: 'special', hp: 16, speed: 50, damage: 8, attackInterval: 1.2, radius: 15, xp: 3, powerTag: 'BLOOD', frame: 'enemy-cupbearer', special: '每 5s 召唤 1 血信徒（上限 3）', counter: '集火打断（召唤源优先）' },
  enemy_g2_4: { id: 'enemy_g2_4', name: '血肉畸体', map: 'map_cathedral', tier: 'elite', hp: 500, speed: 40, damage: 18, attackInterval: 1.8, radius: 24, xp: 12, powerTag: 'BLOOD', frame: 'enemy-fleshmass', counter: '集火（高 XP 对价）' },
  enemy_g2_5: { id: 'enemy_g2_5', name: '忏悔者', map: 'map_cathedral', tier: 'special', hp: 14, speed: 55, damage: 10, attackInterval: 1.2, radius: 13, xp: 3, powerTag: 'BLOOD', frame: 'enemy-penitent', special: '每 3s 投掷烛火弹（慢速可躲）', counter: '走位（横向闪避投射）', rangedDamage: 8 },
  enemy_g3_1: { id: 'enemy_g3_1', name: '灰狼', map: 'map_den', tier: 'fast', hp: 12, speed: 85, damage: 10, attackInterval: 0.8, radius: 13, xp: 1, powerTag: 'BEAST', frame: 'enemy-greywolf', counter: '走位拉扯' },
  enemy_g3_2: { id: 'enemy_g3_2', name: '暗影狼', map: 'map_den', tier: 'fast', hp: 10, speed: 160, damage: 10, attackInterval: 0.7, radius: 11, xp: 2, powerTag: 'BEAST', frame: 'enemy-shadowwolf', counter: '优先处理/绕开' },
  enemy_g3_3: { id: 'enemy_g3_3', name: '石甲狼', map: 'map_den', tier: 'elite', hp: 400, speed: 45, damage: 15, attackInterval: 1.8, radius: 22, xp: 10, powerTag: 'BEAST', frame: 'enemy-stonewolf', counter: '集火（高 XP 对价）' },
  enemy_g3_4: { id: 'enemy_g3_4', name: '狼裔猎手', map: 'map_den', tier: 'special', hp: 16, speed: 70, damage: 12, attackInterval: 1.2, radius: 14, xp: 3, powerTag: 'BEAST', frame: 'enemy-wolfhunter', special: '每 6s 蓄力冲锋（警告线后冲刺 500px/s）', counter: '横向走位（躲警告线方向）' },
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
}

/** Boss 表 4（gdd-enemies-v2 §3.4 / content-design-outline §4.3） */
export const BOSSES: Record<BossId, BossConfig> = {
  boss_1: { id: 'boss_1', name: '血月尊者', map: 'map_graveyard', hp: 4000, speed: 28, damage: 30, attackInterval: 2.0, radius: 40, xp: 100, powerTag: 'MOON', frame: 'enemy-boss', visual: '≥3x·猩红金 4px·残破守夜袍·手持锈蚀初代提灯（灯内血色光）' },
  boss_2: { id: 'boss_2', name: '血主教·尼禄', map: 'map_cathedral', hp: 4500, speed: 30, damage: 32, attackInterval: 2.2, radius: 42, xp: 120, powerTag: 'BLOOD', frame: 'boss-cardinal', phase2: '阶段 2（HP<50%）：召唤 2 圣杯侍僧；脚下周期性血池（减速 30% + 持续伤）', visual: '≥3x·猩红金·主教冠冕+圣杯' },
  boss_3: { id: 'boss_3', name: '狼王·芬里厄', map: 'map_den', hp: 4200, speed: 32, damage: 30, attackInterval: 2.0, radius: 42, xp: 120, powerTag: 'BEAST', frame: 'boss-fenrir', phase2: '阶段 2（HP<50%）：蓄力冲锋扑击（警告线，逼走位）；召唤 2 灰狼', visual: '≥3x·猩红金·狼鬃王冠' },
  boss_4: { id: 'boss_4', name: '血月化身', map: 'any', hp: 3000, speed: 40, damage: 25, attackInterval: 1.8, radius: 40, xp: 150, powerTag: 'MOON', frame: 'boss-moonavatar', phase2: '4:30 后 5% 触发「月坠」（预警后降临）；不掉通关进度，掉稀有图鉴', visual: '半透明猩红金·月光人形·无角饰·边缘月白描边' },
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
  enemy_g1_4: { kind: 'phase' }, // 亡魂：相位穿障碍
  enemy_g1_5: { kind: 'aura', radius: 120, attackSpeedBonus: 0.2, maxStacks: 3 }, // 尸巫：光环
  enemy_g2_3: { kind: 'summon', interval: 5, summonedId: 'enemy_g2_1', summonCap: 3 }, // 圣杯侍僧
  enemy_g2_5: { kind: 'ranged', interval: 3, projectileSpeed: 180 }, // 忏悔者（投射伤害 8 见 ENEMY_CONFIGS.rangedDamage）
  enemy_g3_4: { kind: 'charge', interval: 6, windup: 0.5, warning: 0.15, dashSpeed: 500, dashDuration: 0.4 }, // 狼裔猎手
};

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

/** 角色配置（content-design-outline §2.6 成长曲线草图；初始武器见 §2.2~2.5） */
export interface HeroConfig {
  id: HeroId;
  name: string;
  powerTag: PowerTag;
  initialHp: number;
  hpPerLevel: number;
  initialSpeed: number;
  speedEveryNLevels: number;
  speedPerStep: number;
  damagePctPerLevel: number;
  initialWeapon: WeaponId;
  passive: string;
  activeSkillName: string;
}

/**
 * 角色表 4（content-design-outline §2.2~2.6）。
 * 注：§2.6 为草图值（守夜人 220 未吸收 TASK-39 R1 波次2 的 220→235 用户批准调整），
 * E4-S1 角色选择落地时以运行时 PLAYER.MOVE_SPEED 与评审裁决为准，本表保持设计稿口径。
 */
export const HEROES: Record<HeroId, HeroConfig> = {
  hero_edmund: { id: 'hero_edmund', name: '守夜人·艾德蒙', powerTag: 'HALLOWED', initialHp: 100, hpPerLevel: 8, initialSpeed: 220, speedEveryNLevels: 5, speedPerStep: 4, damagePctPerLevel: 0.04, initialWeapon: 'wpn_a_1', passive: '提灯圣辉：经验磁力 +20px', activeSkillName: '提灯闪耀' },
  hero_cassandra: { id: 'hero_cassandra', name: '血猎手·卡珊德拉', powerTag: 'SILVER', initialHp: 85, hpPerLevel: 6, initialSpeed: 245, speedEveryNLevels: 4, speedPerStep: 4, damagePctPerLevel: 0.04, initialWeapon: 'wpn_a_2', passive: '半裔之血：受击后 3s 内移速 +10%', activeSkillName: '血影突袭' },
  hero_violet: { id: 'hero_violet', name: '夜祷修女·薇奥莱', powerTag: 'HALLOWED', initialHp: 115, hpPerLevel: 10, initialSpeed: 205, speedEveryNLevels: 6, speedPerStep: 4, damagePctPerLevel: 0.04, initialWeapon: 'wpn_a_3', passive: '执烛之心：拾取治疗道具效果 +50%', activeSkillName: '安魂曲' },
  hero_galvan: { id: 'hero_galvan', name: '狼裔·加尔文', powerTag: 'BEAST', initialHp: 125, hpPerLevel: 12, initialSpeed: 215, speedEveryNLevels: 5, speedPerStep: 4, damagePctPerLevel: 0.04, initialWeapon: 'wpn_d_2', passive: '兽血愈合：击杀回复 0.5 HP（与吸血升级叠加）', activeSkillName: '血月狂化' },
};

/** 主动技类型（pillars §6.2 / gdd-active-skill §3.1） */
export type ActiveSkillType = 'DEFENSE' | 'BURST' | 'MOBILITY';

/** 主动技配置（gdd-active-skill §3.2 / content-design-outline §2） */
export interface ActiveSkillConfig {
  heroId: HeroId;
  name: string;
  type: ActiveSkillType;
  cd: number;
  /** 充能制（血猎手 2 段，充能间隔 s） */
  charges?: number;
  chargeInterval?: number;
  /** 伤害型主动技只吃 0.5× 总倍率（gdd-active-skill §3.1/§3.2） */
  damageMultFactor?: number;
  radius?: number;
  stunDuration?: number;
  invulnDuration?: number;
  dashDistance?: number;
  dashDamage?: number;
  /** 冲刺时长 s（工程常量，gdd-active-skill §3.2 未列精确值；balance ACTIVE_SKILL_RULES.DASH_DURATION_SECONDS） */
  dashDuration?: number;
  markDamageMult?: number;
  markDuration?: number;
  slowPct?: number;
  slowDuration?: number;
  healPct?: number;
  duration?: number;
  moveSpeedPct?: number;
  /** 狂化倍率加法叠加 +0.40（口径 1；常量见 ACTIVE_SKILL_RULES.RAGE_MULTIPLIER_ADD） */
  rageMultiplierAdd?: number;
  /** 接触光环平摊 25 伤/s（口径 3；常量见 ACTIVE_SKILL_RULES.CONTACT_AURA_FLAT_DPS） */
  contactAuraFlat?: number;
  lifestealOnKill?: number;
}

/** 主动技表 4（gdd-active-skill §3.2 与 content-design-outline §2 逐项一致） */
export const ACTIVE_SKILLS: Record<HeroId, ActiveSkillConfig> = {
  hero_edmund: { heroId: 'hero_edmund', name: '提灯闪耀', type: 'DEFENSE', cd: 20, radius: 240, stunDuration: 2.5, invulnDuration: 1.5 },
  hero_cassandra: { heroId: 'hero_cassandra', name: '血影突袭', type: 'MOBILITY', cd: 12, charges: 2, chargeInterval: 8, dashDistance: 240, dashDuration: ACTIVE_SKILL_RULES.DASH_DURATION_SECONDS, dashDamage: 40, markDamageMult: 1.2, markDuration: 4, damageMultFactor: 0.5 },
  hero_violet: { heroId: 'hero_violet', name: '安魂曲', type: 'DEFENSE', cd: 22, radius: 300, slowPct: 0.4, slowDuration: 4, healPct: 0.2 },
  hero_galvan: { heroId: 'hero_galvan', name: '血月狂化', type: 'BURST', cd: 24, duration: 8, moveSpeedPct: 0.3, rageMultiplierAdd: ACTIVE_SKILL_RULES.RAGE_MULTIPLIER_ADD, contactAuraFlat: ACTIVE_SKILL_RULES.CONTACT_AURA_FLAT_DPS, lifestealOnKill: 1, damageMultFactor: 0.5 },
};

/** 地图生成器阶段权重覆盖（gdd-maps §3.4；wolf 增量，zombie/tank 相应减，权重和保持 1.00） */
export interface StageWeightOverride {
  stage: 'S1' | 'S2' | 'S3';
  /** wolf 权重增量（教堂 S2/S3 +0.05；狼穴按 §3.3 具体值） */
  wolfDelta: number;
}

/** 地图配置（gdd-maps §3.1~3.4；生成器参数覆盖总表） */
export interface MapConfig {
  id: MapId;
  name: string;
  width: number;
  height: number;
  /** 地面 tile 帧（content-id-frame-map §4） */
  tiles: readonly string[];
  /** 障碍帧 */
  obstacles: readonly string[];
  /** 装饰帧 */
  decor: readonly string[];
  /** 障碍密度（座/1000²，§3.0） */
  obstacleDensityPer1000: number;
  boss: BossId;
  /** 解锁条件：null = 默认解锁 */
  unlock: MapId | null;
  spawnRingDesktop: readonly [number, number];
  spawnRingMobile: readonly [number, number];
  /** 阶段权重覆盖（§3.4；无覆盖 = 基准） */
  stageWeightOverride: readonly StageWeightOverride[];
  /** 敌潮移速加权（不含 Boss；狼穴 ×1.08，其余 1.0） */
  enemySpeedMultiplier: number;
  /** 环境危险（仅教堂血池） */
  danger?: string;
}

/** 地图表 3（gdd-maps §3.1~3.4） */
export const MAP_CONFIGS: Record<MapId, MapConfig> = {
  map_graveyard: {
    id: 'map_graveyard', name: '月下墓地', width: 3000, height: 3000,
    tiles: ['tile-ground', 'tile-grass', 'tile-grave-soil'],
    obstacles: ['obst-grave-tomb', 'obst-grave-fence'],
    decor: ['decor-grave-tree', 'decor-grave-candle', 'decor-grave-bone'],
    obstacleDensityPer1000: 12, boss: 'boss_1', unlock: null,
    spawnRingDesktop: [600, 900], spawnRingMobile: [500, 800],
    stageWeightOverride: [], enemySpeedMultiplier: 1.0,
  },
  map_cathedral: {
    id: 'map_cathedral', name: '血教堂', width: 2800, height: 2800,
    tiles: ['tile-church-stone', 'tile-church-carpet'],
    obstacles: ['obst-church-pillar', 'obst-church-bench', 'obst-church-altar'],
    decor: ['decor-church-glasslight'],
    obstacleDensityPer1000: 22, boss: 'boss_2', unlock: 'map_graveyard',
    spawnRingDesktop: [500, 800], spawnRingMobile: [420, 680],
    stageWeightOverride: [{ stage: 'S2', wolfDelta: 0.05 }, { stage: 'S3', wolfDelta: 0.05 }],
    enemySpeedMultiplier: 1.0,
    danger: '血池 ×8~10（r120~180）：减速 30% + 持续伤 8/s',
  },
  map_den: {
    id: 'map_den', name: '狼穴', width: 3200, height: 3200,
    tiles: ['tile-den-earth', 'tile-den-grass'],
    obstacles: ['obst-den-rock', 'obst-den-log'],
    decor: ['decor-den-bone', 'decor-den-fire', 'decor-den-spike'],
    obstacleDensityPer1000: 14, boss: 'boss_3', unlock: 'map_cathedral',
    spawnRingDesktop: [600, 900], spawnRingMobile: [500, 800],
    stageWeightOverride: [
      { stage: 'S1', wolfDelta: 0.055 },
      { stage: 'S2', wolfDelta: 0.07 },
      { stage: 'S3', wolfDelta: 0.09 },
    ],
    enemySpeedMultiplier: 1.08,
  },
};

/** 升级项抽取标签（gdd-upgrade-pool-v2 §3.1/§3.6：global / weapon_class_* / key / hero_<id>） */
export type UpgradeTag = 'global' | 'weapon_class_a' | 'weapon_class_b' | 'weapon_class_c' | 'weapon_class_d' | 'key' | HeroId;

/** 升级池项（gdd-upgrade-pool-v2 §3.2~3.5；cardKind 卡面底色分型 asset-spec §1.6） */
export interface UpgradePoolItem {
  id: UpgradeId;
  name: string;
  type: UpgradeType;
  tags: readonly UpgradeTag[];
  desc: string;
  maxStack: number;
  cardKind: 'blue-purple' | 'amber-gold';
  /** 超武钥：对应进化目标（key_* 项） */
  evolutionTarget?: EvoId;
}

/**
 * 升级池 40 项（gdd-upgrade-pool-v2 §3.2~3.5 逐项；主动技强化按角色展开 12 项）。
 * 类型口径：按 GDD v1.2 裁定 R-M1b-RULING-1 + M3-DESIGN-1 数值方向化（36/40 = 90%）——
 * 全局 6/9 机制（up_g_3 鲜血契约、up_g_4 踏月而行转机制型 + up_g_7 减伤、up_g_9 拾取范围按行为影响归机制）、
 * 钥 5/7 机制（key_scope 鹰眼镜片、key_holy 圣辉坠饰同口径归机制）、武器 12/12、主动技 12/12
 * → 合计 36/40 = 90% ≥ 50%（支柱 2）。机制型卡面一律蓝紫底（asset-spec §1.6）。
 */
export const UPGRADE_POOL: readonly UpgradePoolItem[] = [
  // ---- 全局基础 9（§3.2，tag=global；M3-DESIGN-1 数值方向化改造 up_g_1~4）----
  { id: 'up_g_1', name: '武器共鸣', type: 'numeric', tags: ['global'], desc: '总伤害倍率 +0.15（数值不变；卡面动态展示当前 build 受益武器图标）', maxStack: Number.POSITIVE_INFINITY, cardKind: 'amber-gold' },
  { id: 'up_g_2', name: '专精疾射', type: 'numeric', tags: ['global'], desc: '你持有类中冷却最短的 2 把武器冷却 ×0.88（×2）', maxStack: 2, cardKind: 'amber-gold' },
  { id: 'up_g_3', name: '鲜血契约', type: 'mechanic', tags: ['global'], desc: '最大生命 +20；受击后 5s 回复 10 HP（内置 12s CD）（×3）', maxStack: 3, cardKind: 'blue-purple' },
  { id: 'up_g_4', name: '踏月而行', type: 'mechanic', tags: ['global'], desc: '移速 +8%；击杀后 2s 移速额外 +15%（×3）', maxStack: 3, cardKind: 'blue-purple' },
  { id: 'up_g_5', name: '吸血 1HP', type: 'mechanic', tags: ['global'], desc: '每次击杀回复 1 HP', maxStack: 1, cardKind: 'blue-purple' },
  { id: 'up_g_6', name: '经验磁力 +100%', type: 'mechanic', tags: ['global'], desc: '拾取范围 ×2（140→280→420px）', maxStack: 2, cardKind: 'blue-purple' },
  { id: 'up_g_7', name: '减伤 +10%', type: 'mechanic', tags: ['global'], desc: '承伤 -10%（与圣光壁垒 -10% 加法叠加，上限 -30%）', maxStack: 3, cardKind: 'blue-purple' },
  { id: 'up_g_8', name: '濒死护盾', type: 'mechanic', tags: ['global'], desc: 'HP<25% 时获得 60 护盾，每局 1 次', maxStack: 1, cardKind: 'blue-purple' },
  { id: 'up_g_9', name: '拾取范围 +40px', type: 'mechanic', tags: ['global'], desc: '拾取范围 +40px（与磁力叠加）', maxStack: 2, cardKind: 'blue-purple' },
  // ---- 武器类强化 12（§3.3，各分支可叠 2 次）----
  { id: 'up_w_a1', name: 'A1 弹幕分裂 +1', type: 'mechanic', tags: ['weapon_class_a'], desc: '命中时额外生成 1 枚次级弹（×0.6 伤害，自动追踪）', maxStack: 2, cardKind: 'blue-purple' },
  { id: 'up_w_a2', name: 'A2 弹幕穿透 +1', type: 'mechanic', tags: ['weapon_class_a'], desc: '弹体额外穿透 1 个敌人', maxStack: 2, cardKind: 'blue-purple' },
  { id: 'up_w_a3', name: 'A3 弹幕弹速 +20%', type: 'mechanic', tags: ['weapon_class_a'], desc: '弹速 ×1.20（满层 ×1.44）', maxStack: 2, cardKind: 'blue-purple' },
  { id: 'up_w_b1', name: 'B1 环绕数量 +1', type: 'mechanic', tags: ['weapon_class_b'], desc: '环绕球/尖刺 +1', maxStack: 2, cardKind: 'blue-purple' },
  { id: 'up_w_b2', name: 'B2 环绕转速 +20%', type: 'mechanic', tags: ['weapon_class_b'], desc: '转速 ×1.20（满层 ×1.44）', maxStack: 2, cardKind: 'blue-purple' },
  { id: 'up_w_b3', name: 'B3 环绕半径 +15%', type: 'mechanic', tags: ['weapon_class_b'], desc: '半径 ×1.15（满层 ×1.32）', maxStack: 2, cardKind: 'blue-purple' },
  { id: 'up_w_c1', name: 'C1 范围半径 +25%', type: 'mechanic', tags: ['weapon_class_c'], desc: '半径 ×1.25（满层 ×1.56）', maxStack: 2, cardKind: 'blue-purple' },
  { id: 'up_w_c2', name: 'C2 范围伤害 +20%', type: 'mechanic', tags: ['weapon_class_c'], desc: '伤害 ×1.20（满层 ×1.44）', maxStack: 2, cardKind: 'blue-purple' },
  { id: 'up_w_c3', name: 'C3 范围持续 +30%', type: 'mechanic', tags: ['weapon_class_c'], desc: '持续 ×1.30（满层 ×1.69）', maxStack: 2, cardKind: 'blue-purple' },
  { id: 'up_w_d1', name: 'D1 召唤数 +1', type: 'mechanic', tags: ['weapon_class_d'], desc: '召唤物 +1', maxStack: 2, cardKind: 'blue-purple' },
  { id: 'up_w_d2', name: 'D2 召唤索敌 +30%', type: 'mechanic', tags: ['weapon_class_d'], desc: '索敌半径/追击距离 ×1.30', maxStack: 2, cardKind: 'blue-purple' },
  { id: 'up_w_d3', name: 'D3 召唤存在 +30%', type: 'mechanic', tags: ['weapon_class_d'], desc: '存在时间 ×1.30', maxStack: 2, cardKind: 'blue-purple' },
  // ---- 被动·超武钥 7（§3.4，兼进化钥）----
  { id: 'key_scope', name: '鹰眼镜片', type: 'mechanic', tags: ['key'], desc: '武器射程 +15%', maxStack: 1, cardKind: 'blue-purple', evolutionTarget: 'evo_moonwrath' },
  { id: 'key_holy', name: '圣辉坠饰', type: 'mechanic', tags: ['key'], desc: '范围 +15%', maxStack: 1, cardKind: 'blue-purple', evolutionTarget: 'evo_seraphring' },
  { id: 'key_tome', name: '月相秘典', type: 'numeric', tags: ['key'], desc: '冷却 -10%', maxStack: 1, cardKind: 'amber-gold', evolutionTarget: 'evo_totaleclipse' },
  { id: 'key_silver', name: '圣银弹丸', type: 'numeric', tags: ['key'], desc: '伤害 +12%', maxStack: 1, cardKind: 'amber-gold', evolutionTarget: 'evo_silverblast' },
  { id: 'key_pact', name: '血契印', type: 'mechanic', tags: ['key'], desc: '召唤数 +1', maxStack: 1, cardKind: 'blue-purple', evolutionTarget: 'evo_batstorm' },
  { id: 'key_bone', name: '兽骨图腾', type: 'mechanic', tags: ['key'], desc: '召唤存在 +20%', maxStack: 1, cardKind: 'blue-purple', evolutionTarget: 'evo_packleader' },
  { id: 'key_grail', name: '血祭圣杯', type: 'mechanic', tags: ['key'], desc: '范围持续 +25%', maxStack: 1, cardKind: 'blue-purple', evolutionTarget: 'evo_bloodsea' },
  // ---- 主动技强化 12（§3.5，按角色展开；各分支 1 次）----
  { id: 'up_a_cd_edmund', name: 'CD -25%（守夜人）', type: 'mechanic', tags: ['hero_edmund'], desc: '提灯闪耀 CD 20s→15s', maxStack: 1, cardKind: 'blue-purple' },
  { id: 'up_a_charge_edmund', name: '二次充能（守夜人·替换）', type: 'mechanic', tags: ['hero_edmund'], desc: '眩晕 +1s（CD 型不适用，替换槽）', maxStack: 1, cardKind: 'blue-purple' },
  { id: 'up_a_effect_edmund', name: '效果增强（守夜人）', type: 'mechanic', tags: ['hero_edmund'], desc: '眩晕 +1s / 无敌 +0.5s', maxStack: 1, cardKind: 'blue-purple' },
  { id: 'up_a_cd_cassandra', name: 'CD -25%（血猎手）', type: 'mechanic', tags: ['hero_cassandra'], desc: '血影突袭 CD 12s→9s', maxStack: 1, cardKind: 'blue-purple' },
  { id: 'up_a_charge_cassandra', name: '二次充能（血猎手）', type: 'mechanic', tags: ['hero_cassandra'], desc: '充能 8s→4s/段（等效总 CD 12s）', maxStack: 1, cardKind: 'blue-purple' },
  { id: 'up_a_effect_cassandra', name: '效果增强（血猎手）', type: 'mechanic', tags: ['hero_cassandra'], desc: '冲刺距离 +25%（240→300px）/ 标记伤害 +10%（+20%→+30%）', maxStack: 1, cardKind: 'blue-purple' },
  { id: 'up_a_cd_violet', name: 'CD -25%（修女）', type: 'mechanic', tags: ['hero_violet'], desc: '安魂曲 CD 22s→16.5s', maxStack: 1, cardKind: 'blue-purple' },
  { id: 'up_a_charge_violet', name: '二次充能（修女·替换）', type: 'mechanic', tags: ['hero_violet'], desc: '回复 +10%（CD 型不适用，替换槽）', maxStack: 1, cardKind: 'blue-purple' },
  { id: 'up_a_effect_violet', name: '效果增强（修女）', type: 'mechanic', tags: ['hero_violet'], desc: '减速 +20%（40%→60%）/ 回复 +10%（20%→30% 最大生命）', maxStack: 1, cardKind: 'blue-purple' },
  { id: 'up_a_cd_galvan', name: 'CD -25%（狼裔）', type: 'mechanic', tags: ['hero_galvan'], desc: '血月狂化 CD 24s→18s', maxStack: 1, cardKind: 'blue-purple' },
  { id: 'up_a_charge_galvan', name: '二次充能（狼裔·替换）', type: 'mechanic', tags: ['hero_galvan'], desc: '狂化中吸血 +1 HP（CD 型不适用，替换槽）', maxStack: 1, cardKind: 'blue-purple' },
  { id: 'up_a_effect_galvan', name: '效果增强（狼裔）', type: 'mechanic', tags: ['hero_galvan'], desc: '狂化 +2s（8s→10s）/ 吸血 +1 HP（击杀回 2 HP）', maxStack: 1, cardKind: 'blue-purple' },
];

/**
 * 升级池抽取规则参数（gdd-upgrade-pool-v2 §3.6 五条，v1.1 裁定后数据化）。
 * 说明：v2 抽取引擎在 E2/E3 落地；本组常量先固化为配置（禁止硬编码），
 * E1-S4 断言对齐 GDD 数值。与 Demo 差异：未解锁 ×2 → 「已拥有该类 ×2 + 未拥有 ×1」
 * （§3.6.2 注：v2 池武器解锁走类强化项解锁变体，不再需要为新类武器强制 ×2）。
 */
export const UPGRADE_POOL_RULES = {
  /** 超时自动选：三选一 30s 未选择自动取第 1 张（§3.6.5 / §⑥.1） */
  TIMEOUT_SECONDS: 30,
  /** 自动取的卡位（第 1 张 = index 0） */
  AUTO_PICK_INDEX: 0,
  /** 已拥有某类武器 ≥1 把时，该类强化项权重 ×2（§3.6.2 引导成型） */
  WEIGHT_OWNED_CLASS: 2,
  /** 未拥有该类武器时权重 ×1（§3.6.2 不强行引导冷门类） */
  WEIGHT_UNOWNED_CLASS: 1,
  /** 超武进化卡权重 ×5（§3.6.3；M3-DESIGN-1 进化前置：×3→×5，供第二张/多进化进剩下 2 席） */
  WEIGHT_EVOLUTION: 5,
  /** 上次选过项权重 ×0.5（§3.6.4 防重复） */
  WEIGHT_LAST_PICK: 0.5,
  /** 全满级回退项：up_g_1 伤害强化（可重复，§3.6.4 / §⑥.3） */
  FALLBACK_ID: 'up_g_1',
  /**
   * 向心性保底席位（M3-DESIGN-1，upgrade-experience-v2 §2.1）：
   * 每轮三选一按优先级保证 1 张「build 相关卡」；优先级与权重独立，保底不额外加权。
   * P1~P5 全空（理论仅全池满级）→ 回退 up_g_1。
   */
  GUARANTEE_RELATED: true,
  /** 保底优先级（P1 进化 → P2 领先类钥 → P3 已拥有类强化 → P4 主动技 → P5 解锁卡兜底） */
  GUARANTEE_PRIORITY: ['evolution', 'pathKey', 'ownedClass', 'active', 'unlock'] as const,
  /**
   * 阶段节奏权重表（M3-DESIGN-1，upgrade-experience-v2 §2.2）：
   * 阶段由 ctx.runTimeSeconds 推导（0–120 S1 / 120–240 S2 / 240–360 S3 / 360+ BOSS）。
   * 乘算顺序 = 基础权重 × 阶段倍率 × 防重复倍率（§4.2-4）；保底项不乘防重复（已剔除）。
   * 类目：unlock 未拥有类解锁卡 / ownedClass 已拥有类强化 / key 被动钥 / active 主动技强化 /
   *       numeric 数值方向卡 up_g_1~4 / evolution 进化卡（不乘阶段，由 P1 保底 + ×5 权重处理）。
   */
  STAGE_WEIGHT_MULT: {
    S1: { unlock: 1.0, ownedClass: 1.0, key: 1.0, active: 1.0, numeric: 0.5 },
    S2: { unlock: 0.8, ownedClass: 1.5, key: 1.2, active: 1.0, numeric: 1.0 },
    S3: { unlock: 0.6, ownedClass: 1.0, key: 1.0, active: 1.0, numeric: 1.2 },
    BOSS: { unlock: 0.5, ownedClass: 1.0, key: 1.0, active: 1.0, numeric: 1.2 },
  } as const,
} as const;

/** 濒死护盾（up_g_8：HP<25% 时获得 60 护盾，每局 1 次，gdd-upgrade-pool-v2 §3.2） */
export const DEATH_SHIELD = {
  HP_FRACTION_THRESHOLD: 0.25,
  SHIELD_AMOUNT: 60,
} as const;

/** 全局基础升级效果参数（gdd-upgrade-pool-v2 §3.2；E4-S4 写回数值源；M3-DESIGN-1 数值方向化） */
export const GLOBAL_UPGRADE_EFFECTS = {
  /** up_g_1 武器共鸣（伤害强化）单次 +0.15（数值锚点保留） */
  DAMAGE_BONUS_PER_STACK: 0.15,
  /** up_g_2 专精疾射：目标武器数（冷却最短 2 把） */
  FOCUSED_COOLDOWN_TARGET: 2,
  /** up_g_2 专精疾射：目标武器冷却 ×0.88（每层独立乘区，乘法叠加；×2 满层 0.7744） */
  FOCUSED_COOLDOWN_MULT: 0.88,
  /** up_g_3 鲜血契约：最大生命 +20（与 up_g_3 同参数名保留，数值不变） */
  MAX_HP_BONUS_PER_STACK: 20,
  /** up_g_3 鲜血契约：受击后 5s 内回复 HP（每次受击窗口内回 10） */
  HIT_HEAL: 10,
  /** up_g_3 鲜血契约：受击回血内置 CD s */
  HIT_HEAL_CD: 12,
  /** up_g_3 鲜血契约：受击回血窗口 s（受击后 5s 内回复） */
  HIT_HEAL_WINDOW: 5,
  /** up_g_4 踏月而行：移速 +8%（与 up_g_4 同参数名保留） */
  MOVE_SPEED_PCT_PER_STACK: 0.08,
  /** up_g_4 踏月而行：击杀后移速额外 +15% */
  KILL_SPEED_PCT: 0.15,
  /** up_g_4 踏月而行：击杀后额外移速持续 s */
  KILL_SPEED_DURATION: 2,
  /** up_g_5 吸血 1 HP */
  LIFESTEAL_PER_KILL: 1,
  /** up_g_6 经验磁力单次 ×2（×2→×3） */
  MAGNET_MULT_PER_STACK: 2,
  /** up_g_7 减伤单次 +10%（上限 30%，与圣光壁垒叠加） */
  DAMAGE_REDUCTION_PER_STACK: 0.1,
  /** up_g_9 拾取范围单次 +40px */
  PICKUP_RADIUS_BONUS_PER_STACK: 40,
} as const;
