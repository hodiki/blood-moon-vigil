/**
 * combat/status/status-types.ts —— CC 状态效果层 · 类型与封闭枚举（gdd-status-effects §3.1）
 *
 * 状态枚举为**封闭集合**（GDD §3.1 红线 / §⑦-4 反例红线）：
 * 新增状态类型须走 GDD 修订，禁止配置侧私自扩类——本枚举是全项目状态层的唯一类型入口。
 *
 * 三类起步（GDD §3.1 表）：
 * - stun       眩晕（硬控）：目标停止移动与攻击
 * - slow       减速（软控）：目标移速 ×(1 − 减速值)
 * - vulnerable 易伤（减益）：目标受到的所有伤害 ×(1 + 易伤值)
 */

/** 状态种类封闭集合（新增须走 GDD 修订，gdd-status-effects §3.1） */
export const STATUS_KINDS = ['stun', 'slow', 'vulnerable'] as const;

export type StatusKind = (typeof STATUS_KINDS)[number];

/** 硬控类（受 ICD 与 Boss 免疫约束的唯一种类，gdd-status-effects §3.3/§3.4） */
export const HARD_CONTROL_KINDS: readonly StatusKind[] = ['stun'];

/** 类型守卫：封闭集合纪律的运行时防线（配置侧传入未知种类一律拒绝） */
export function isStatusKind(v: unknown): v is StatusKind {
  return typeof v === 'string' && (STATUS_KINDS as readonly string[]).includes(v);
}

/** 生效中的单个状态实例（同类至多 1 个——叠加规则「取最强」，gdd-status-effects §3.2） */
export interface ActiveStatus {
  /** 截止时刻（秒时间戳，> now 生效） */
  until: number;
  /** 生效值：slow = 减速比例 0~1 / vulnerable = 易伤加成 0~1 / stun 恒 1（占位语义） */
  value: number;
  /** 来源标识（登记表 source / 载体清理用，gdd-status-effects §⑦-3） */
  source: string;
}

/** 状态种类中文标签（UI/遥测口径统一，防散落字符串） */
export const STATUS_KIND_LABELS: Record<StatusKind, string> = {
  stun: '眩晕',
  slow: '减速',
  vulnerable: '易伤',
};
