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
  missile: '#E8F0FA', // 飞弹：月银白短条
  orb: '#54E6C9', // 环绕球：冷青（描边烘焙进贴图，不用 FX.Outline）
  shockwave: '#FF3B30', // 冲击波：血橙红扩散环
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
  boss: { hp: 6000, speed: 28, damage: 30, attackInterval: 2.0, radius: 40, xp: 100 },
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
 * budget(t) = 1.2 × (1 + 3.0×t/1200) × (1 + 0.3×sin(2πt/75))。
 * TASK-39 R1 波次2：LINEAR_SCALE 2.5→3.0（20min 均值 4.2→4.8 点/s，中后段密度提升）、
 * WAVE_AMPLITUDE 0.4→0.3（波谷变浅 ×0.6→×0.7，前期不空场；峰谷比 2.33→1.86 仍 ≥40%）。
 */
export const SPAWNER = {
  BASE_BUDGET: 1.2, // 基数 点/s
  LINEAR_SCALE: 3.0, // 线性项系数（R1 波次2）
  LINEAR_TOTAL_SECONDS: 1200, // 20 分钟线性项分母
  WAVE_AMPLITUDE: 0.3, // 正弦波幅 ±30%（R1 波次2；仍满足相邻周期差异 ≥40%）
  WAVE_PERIOD_SECONDS: 75, // 正弦周期
  BOSS_TIME: 1200, // 20:00 Boss 收束
  RETRY_PAUSE_SECONDS: 2, // 达上限暂停生成 2s 后重试（不丢弃预算）
  /**
   * 3–8min 每 N 秒保底 1 厚血。
   * E3 C3 首验调整：20s → 40s（design-review-e2 C3，TASK-15 预授权）；
   * E4 Sprint 4 用户真机回调（TASK-18 授权）：40s → 30s；
   * TASK-39 R1 波次2：保持 30s 不动（C-7 决策记录：再降会退回"厚血未发现"，
   * 本次用「血月印记预警 + 随机 3%→2% 减少叠加」解决"突兀"，而非减数量）。
   */
  TANK_GUARANTEE_EVERY_SECONDS: 30,
  /** TASK-39 E2 屠夫预警：保底厚血出生前 N 秒在出生点显示血月印记（红圈精灵 + 低音） */
  TANK_WARNING_SECONDS: 2.5,
} as const;

/**
 * Boss「血月尊者」机制与视觉（enemies §③/§⑥.5 / art-bible §4 / E4-S2）。
 * 面板数值（6000HP/28px/s/30伤/2.0s/40px/100经验）见 ENEMIES.boss；本组为机制/视觉常量。
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
 * 经验与升级需求（upgrade-pool §③ / E3-S1）：need(n) = 5 + 3×(n−1)。
 * 首级 5 点（约 30s 内达成）；20 分钟模拟累计 ≥3000 点 → Lv30+。
 */
export const XP = {
  BASE_NEED: 5, // need(1) = 5
  NEED_STEP: 3, // 每级增量
  MAX_LEVEL: 99, // 模拟防 while 死循环上限（20 分钟实际可达 Lv40+，远超）
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
