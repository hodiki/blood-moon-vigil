/**
 * config/balance/xp.ts —— 经验曲线 / 经验宝石 / 治疗道具
 *
 * balance.ts 域拆分（EG-1）纯搬移：数值与注释原样保留，不改任何行为。
 */

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
