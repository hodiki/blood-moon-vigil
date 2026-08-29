/**
 * combat/status/status-engine.ts —— CC 状态效果层 · 纯函数引擎（gdd-status-effects §3.2~§3.4）
 *
 * 纯函数核心（test-framework §1.2：可脱离 Phaser 单测）：
 * - applyStatus  施加状态：抗性解析 → ICD 拦截 → 叠加规则（同类取最强、异类共存）
 * - queryStatus  查询生效状态（UI/移动/伤害消费入口）
 * - tickStatuses 过期清除（载体死亡同步移除走 clearStatuses / removeStatusesBySource）
 *
 * 叠加规则（§3.2，一句话可解释）：
 * - 同类不叠加取最强：眩晕取最长剩余；减速/易伤取最高值——后到强者替换并重置时长，
 *   弱者不改变现有状态（含时长）。
 * - 不同类可共存（一目标可同时 眩晕+减速+易伤）。
 * - 减速不与地图减速区（血池等）特殊互斥，同走「取最强」。
 *
 * ICD（§3.3，EG-5 裁决口径，注释写死防漂移）：
 * - 硬控（眩晕）通用内置冷却 10s / 单目标：同一目标 10s 内只能被眩晕命中 1 次（无论来源）。
 * - **ICD 起算时点 = 状态结束时刻**（非命中时刻）——防长眩晕自续（GDD 推荐口径，EG-5 已批）。
 *   实现：stunIcdReadyAt = 眩晕生效截止(until) + CC_ICD_SECONDS。
 * - 减速/易伤不设 ICD（靠时长与数值上限控制）。
 * - 同帧多来源眩晕：首个命中消耗 ICD 并生效；其余在 ICD 判定被拦截（不重复生效，§⑦-1）。
 *
 * 抗性（§3.4）：解析走 status-config.resolveCcResistance（Boss 硬控免疫 / 精英 ×0.5 /
 * 逐敌覆写字段位优先）；免疫只豁免控制部分，来源伤害段独立结算（§⑦-2，由调用方负责）。
 */

import type { ActiveStatus, StatusKind } from './status-types';
import { CC_ICD_SECONDS, resolveCcResistance, type CcProfile } from './status-config';

/** 单目标的全部状态载荷（Enemy 迁移收编前的独立组件；池复用/死亡走 clearStatuses） */
export interface StatusState {
  stun: ActiveStatus | null;
  slow: ActiveStatus | null;
  vulnerable: ActiveStatus | null;
  /**
   * 硬控 ICD 就绪时刻：≥ 此时刻才允许再次施加硬控（无论来源）。
   * 起算 = 眩晕状态结束时刻 + CC_ICD_SECONDS（EG-5，见文件头注释）。
   */
  stunIcdReadyAt: number;
}

/** 全空状态载荷（新建目标/池复用重置） */
export function emptyStatusState(): StatusState {
  return { stun: null, slow: null, vulnerable: null, stunIcdReadyAt: 0 };
}

/** 施加请求（登记表参数 + 来源；weapon-behavior ctx 通道的载荷形状） */
export interface StatusApplication {
  kind: StatusKind;
  /** 生效值：slow = 减速比例 / vulnerable = 易伤加成 / stun 恒 1 */
  value: number;
  /** 请求时长 s（折减前；抗性折减在引擎内完成） */
  durationSeconds: number;
  /** 来源标识（登记表 source / 载体清理用） */
  source?: string;
}

export type ApplyStatusReason = 'applied' | 'immune' | 'icd';

export interface ApplyStatusResult {
  /** 施加后的状态载荷（纯函数返回新对象，不改入参） */
  state: StatusState;
  /** applied = 被接受（可能未改变已有更强状态）；immune/icd = 被拒 */
  applied: boolean;
  reason: ApplyStatusReason;
  /** 抗性折减后的实际时长（免疫/ICD 拦截 = 0；供遥测「生效时长分布」⑧-5） */
  effectiveDuration: number;
}

/** 全部种类（引擎内遍历用；与 status-types.STATUS_KINDS 同源，防止双源漂移） */
const ALL_KINDS: readonly StatusKind[] = ['stun', 'slow', 'vulnerable'];

/**
 * 施加状态（纯函数）：抗性 → ICD → 叠加。
 *
 * @param state  目标当前状态载荷（不被修改）
 * @param app    施加请求
 * @param now    场景时间秒（scene.time.now / 1000）
 * @param profile 目标 CC 抗性画像（tier + 逐敌覆写；缺省 = 普通敌）
 */
export function applyStatus(
  state: StatusState,
  app: StatusApplication,
  now: number,
  profile: CcProfile = {},
): ApplyStatusResult {
  const next = cloneState(state);
  const resistance = resolveCcResistance(app.kind, profile);
  if (resistance.immune) {
    // 免疫只豁免控制部分（§⑦-2）；来源伤害段由调用方独立结算
    return { state: next, applied: false, reason: 'immune', effectiveDuration: 0 };
  }
  const effectiveDuration = Math.max(0, app.durationSeconds * resistance.durationMult);

  if (app.kind === 'stun') {
    // ICD 判定先于叠加：10s 内（无论来源）第二发硬控被拦截，不刷新就绪时刻
    if (now < state.stunIcdReadyAt) {
      return { state: next, applied: false, reason: 'icd', effectiveDuration: 0 };
    }
    const newEnd = now + effectiveDuration;
    const current = next.stun;
    // 同类取最强（最长剩余）：弱者/平手不改变现有状态（含时长，§3.2）
    if (current && current.until >= newEnd) {
      return { state: next, applied: true, reason: 'applied', effectiveDuration };
    }
    next.stun = { until: newEnd, value: 1, source: app.source ?? '' };
    // EG-5：ICD 从状态结束起算（非命中时刻），防长眩晕自续
    next.stunIcdReadyAt = newEnd + CC_ICD_SECONDS;
    return { state: next, applied: true, reason: 'applied', effectiveDuration };
  }

  // 软控/减益：取最高值；后到强者替换并重置时长，弱者不改变现有状态（§3.2）
  const current = next[app.kind];
  if (current && current.value >= app.value) {
    return { state: next, applied: true, reason: 'applied', effectiveDuration };
  }
  next[app.kind] = { until: now + effectiveDuration, value: app.value, source: app.source ?? '' };
  return { state: next, applied: true, reason: 'applied', effectiveDuration };
}

/** 查询单类状态（now 内生效才有 active；UI ≤3 槽位图标的数据源，§⑧） */
export interface StatusQuery {
  active: boolean;
  /** 生效值（stun 恒 1；未生效 = 0） */
  value: number;
  /** 剩余秒（clamp ≥0） */
  remaining: number;
  /** 来源标识（未生效 = ''） */
  source: string;
}

export function queryStatus(state: StatusState, kind: StatusKind, now: number): StatusQuery {
  const s = state[kind];
  if (!s || now >= s.until) return { active: false, value: 0, remaining: 0, source: '' };
  return { active: true, value: s.value, remaining: s.until - now, source: s.source };
}

/** 目标是否被硬控（眩晕）：移动冻结 + 接触伤害阻止（enemy.updateMovement / contact 消费口径） */
export function isStunned(state: StatusState, now: number): boolean {
  return queryStatus(state, 'stun', now).active;
}

/** 移速乘区：减速期内 ×(1 − 减速值)；否则 1（enemy.updateMovement 消费口径，§3.1 减速定义） */
export function slowMultiplier(state: StatusState, now: number): number {
  const q = queryStatus(state, 'slow', now);
  return q.active ? 1 - q.value : 1;
}

/** 承伤乘区：易伤期内 ×(1 + 易伤值)；否则 1（damage.computeHitDamage 消费口径，§3.1 易伤定义） */
export function damageTakenMultiplier(state: StatusState, now: number): number {
  const q = queryStatus(state, 'vulnerable', now);
  return q.active ? 1 + q.value : 1;
}

/** 过期清除：until ≤ now 的状态置空（帧 tick 消费；返回被清除的种类列表，供遥测 ⑧-5） */
export function tickStatuses(state: StatusState, now: number): StatusKind[] {
  const expired: StatusKind[] = [];
  for (const kind of ALL_KINDS) {
    const s = state[kind];
    if (s && now >= s.until) {
      state[kind] = null;
      expired.push(kind);
    }
  }
  return expired;
}

/**
 * 全部清除（目标死亡 / 池复用重置）。
 * 目标死亡时 ICD 计数一并清除（§⑦-3：防复活类敌种永久免疫——规则前置防患）。
 */
export function clearStatuses(state: StatusState): void {
  state.stun = null;
  state.slow = null;
  state.vulnerable = null;
  state.stunIcdReadyAt = 0;
}

/**
 * 按来源移除（状态载体死亡：图腾/残焰/圣火销毁时其上的状态同步移除，§⑦-3）。
 * 返回被移除的种类列表；ICD 不重置（已生效过的硬控 ICD 照常计数）。
 */
export function removeStatusesBySource(state: StatusState, source: string): StatusKind[] {
  const removed: StatusKind[] = [];
  for (const kind of ALL_KINDS) {
    const s = state[kind];
    if (s && s.source === source) {
      state[kind] = null;
      removed.push(kind);
    }
  }
  return removed;
}

/** 深拷贝（纯函数边界；ActiveStatus 为平面结构，展开即可） */
function cloneState(state: StatusState): StatusState {
  return {
    stun: state.stun ? { ...state.stun } : null,
    slow: state.slow ? { ...state.slow } : null,
    vulnerable: state.vulnerable ? { ...state.vulnerable } : null,
    stunIcdReadyAt: state.stunIcdReadyAt,
  };
}
