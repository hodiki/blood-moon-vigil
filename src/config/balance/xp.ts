/**
 * config/balance/xp.ts —— 经验曲线 / 经验宝石 / 治疗道具
 *
 * balance.ts 域拆分（EG-1）纯搬移：数值与注释原样保留，不改任何行为。
 */

/**
 * 经验与升级需求（upgrade-pool §③ / E3-S1）：need(n) = 5 + 3×(n−1)。
 * ⚠ NV-BATCH-G（G3，2026-09-02）：本常量表被 XP_CASE（c 案两段式）取代——运行时
 * needXp() 改消费 XP_CASE，此表按 EG-2 归档原则保留（历史曲线对照 / 既有断言锚）。
 * 首级 5 点（约 30s 内达成）；6 分钟模拟累计 ≈1200 点 → Lv~27（rhythm-pace-adj §3，TASK-31 节奏调整）。
 *
 * @deprecated 运行时 needXp 已切换 XP_CASE 两段式（sim-freeze-recommendation §② SC-2 终裁）。
 */
export const XP = {
  BASE_NEED: 5, // need(1) = 5
  NEED_STEP: 3, // 每级增量
  MAX_LEVEL: 99, // 模拟防 while 死循环上限（6 分钟可达 Lv~27，远超）
} as const;

/**
 * XP c 案档位参数（NV-BATCH-G G3 冻结：SC-2 终裁 c-标准，模拟冻结 2026-09-02，
 * sim-freeze-recommendation §②，3720 局三档对照 + 5400 局合计）。
 * 两段式 needXp（X1 前段加速保首级时点 + X2 中后段加陡）× 敌 XP 下调 × 敌 HP 联动三联动：
 * - needFirst=4：need(1)；earlyStep=3：第 2~4 级增量；lateStep=6：第 5 级起增量
 * - enemyXpMult=0.55：敌 XP 产出 −45%（生成侧单源乘区，精英不吃独立曲线、Boss 另算）
 * - hpCaseLink=1.125：敌基础面板 HP ×1.125（仅 scale(t) 链内基础面板；精英/Boss 独立曲线不吃）
 * 冻结理由：三档中唯一全部 PASS 项均处带中央（offers 15 ∈ 12~18 带 / Lv16 ∈ 14~20 带中央），破带裕度最大。
 */
export const XP_CASE = {
  id: 'c-standard',
  label: 'c-标准（SC-2 终裁冻结）',
  needFirst: 4,
  earlyStep: 3,
  lateStep: 6,
  enemyXpMult: 0.55,
  hpCaseLink: 1.125,
} as const;

/**
 * 降档预案参数（S-3 单轮冻结纪律：真机回填后 c-标准破带时切档复测，禁止就地改参）。
 * 切换判据（sim-freeze-recommendation §②）：
 * - c-温和（offers 16.5 贴上沿 18，真机 XP 获取偏高风险大，不作首选）：
 *   c-标准 offers <12 或 Lv <14 破带 → 切 c-温和 复跑 batch-xp-cases 验带。
 * - c-陡峭（Lv14 贴下限，端点扰动即破带，已出局）：仅存档对照。
 * 启用方式：将 XP_CASE 字段替换为对应预案值并同步更新 G7 断言锚（单轮冻结，一次一档）。
 *
 * const XP_CASE_MILD = { id: 'c-mild', needFirst: 4, earlyStep: 3, lateStep: 5, enemyXpMult: 0.6, hpCaseLink: 1.075 } as const;
 * const XP_CASE_STEEP = { id: 'c-steep', needFirst: 5, earlyStep: 4, lateStep: 7, enemyXpMult: 0.5, hpCaseLink: 1.175 } as const;
 */

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
