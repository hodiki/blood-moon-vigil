/**
 * enemies/panel-scale.ts —— 敌面板缩放·M3 混合模型（W-8，gdd-difficulty-v3 §5.1 MN-1/2）
 *
 * M3 = 局时主驱动 scale(t)（0~60s 豁免 1.0，60~120s 线性爬入，S2 缓 / S3 陡，
 * 360s 终值锚 2.2~3.2）+ 等级滞后宽容（玩家等级低于局时预期等级 ≥3 级时
 * 接触敌 HP ×(1 − 0.1×滞后级数)，下限 ×0.7——只救落后者、不削领先者，MN-1）。
 *
 * 仅 HP 缩放（MN-2）：伤害/移速/攻击间隔**不缩放**（承伤压力由生成密度 +
 * 突袭/远程/冲锋行为 + Boss 承担）；S3 段伤害 ×1.1~1.2 轻缩放为预案（修订流程）。
 *
 * 缩放链（spawn 时刻一次性结算）：基础面板 HP × scale(t) × c 案联动(可选) × 宽容(可选)。
 * 精英/Boss 独立曲线**不吃** scale(t)（enemies-v3 §③-1：精英 350~500 基座、
 * Boss 3000~4500 锚「双路线成型 DPS 下 65~85s」反推，MD-4）。
 */

/** M3 分段端点锚（均值；终值 2.2~3.2 中值 2.7，S-1 复测冻结项） */
export const SCALE_ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [0, 1.0], [60, 1.0], [120, 1.35], [240, 1.95], [360, 2.7],
] as const;

/** 等级滞后宽容参数（MN-1：≥3 级触发，每级 −10%，下限 ×0.7） */
export const MERCY = {
  /** 触发阈值（滞后级数） */
  LAG_TRIGGER: 3,
  /** 每滞后级 HP 折减 */
  PER_LEVEL: 0.1,
  /** 下限倍率 */
  MIN_MULT: 0.7,
} as const;

/** 局时预期等级曲线（滞后宽容分母锚；c 案 Lv14~20 @360s → ≈1 + t/24，S-3 联动复测项） */
export function expectedLevelFor(t: number): number {
  return 1 + t / 24;
}

/** M3 scale(t)：分段线性插值（t 越界 clamp；0~60s 豁免 = 1.0） */
export function scaleForTime(t: number): number {
  const first = SCALE_ANCHORS[0]!;
  const last = SCALE_ANCHORS[SCALE_ANCHORS.length - 1]!;
  if (t <= first[0]) return first[1];
  if (t >= last[0]) return last[1];
  for (let i = 1; i < SCALE_ANCHORS.length; i += 1) {
    const [t1, m1] = SCALE_ANCHORS[i]!;
    const [t0, m0] = SCALE_ANCHORS[i - 1]!;
    if (t <= t1) return m0 + ((m1 - m0) * (t - t0)) / (t1 - t0);
  }
  return last[1];
}

/** 等级滞后宽容倍率（未触发 = 1.0；只救落后者不削领先者） */
export function mercyMult(playerLevel: number, t: number): number {
  const lag = expectedLevelFor(t) - playerLevel;
  if (lag < MERCY.LAG_TRIGGER) return 1;
  const mult = 1 - MERCY.PER_LEVEL * lag;
  return Math.max(MERCY.MIN_MULT, mult);
}

/** 缩放入参（spawn 侧组装） */
export interface PanelScaleInput {
  /** 基础面板 HP（ENEMY_CONFIGS.hp） */
  baseHp: number;
  /** 局时秒（spawn 时刻） */
  t: number;
  /** 玩家当前等级（宽容判定；undefined = 不启用宽容，测试确定性路径） */
  playerLevel?: number;
  /** c 案 HP 联动系数（W-E 三档；undefined = 1.0） */
  caseLink?: number;
}

export interface PanelScaleResult {
  /** 缩放后 HP（HP × scale(t) × caseLink × mercy） */
  hp: number;
  /** scale(t) 原值（遥测） */
  scale: number;
  /** 宽容倍率（遥测；宽容触发率 MN-13 监控项） */
  mercy: number;
}

/**
 * 敌面板缩放链（唯一出口；仅 HP）：
 * HP = baseHp × scale(t) × caseLink(可选) × mercy(可选)。
 * 精英/Boss 不走本函数（独立曲线，调用方过滤）。
 */
export function applyPanelScale(input: PanelScaleInput): PanelScaleResult {
  const scale = scaleForTime(input.t);
  const caseLink = input.caseLink ?? 1;
  const mercy = input.playerLevel === undefined ? 1 : mercyMult(input.playerLevel, input.t);
  return {
    hp: Math.max(1, Math.round(input.baseHp * scale * caseLink * mercy)),
    scale,
    mercy,
  };
}
