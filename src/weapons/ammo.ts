/**
 * weapons/ammo.ts —— 声明式弹药组件（gdd-exclusive-weapons §4.9 / R2-10）
 *
 * 四字段标准组件（弹量上限/当前/装弹时长/装弹状态）+ 纯函数操作层（可脱离 Phaser 单测）。
 * **仅声明 usesAmmo 的武器消费**（当前仅圣徒左轮及其衍生技）；其余 13 通武 + 7 专武
 * 零声明零改动（验收判据 ⑧-7 回归断言）。
 *
 * 边界（GDD 定稿口径）：
 * - 无手动装弹键（自动装填）；无独立资源条（HUD = 武器图标侧 6 点弹巢点阵，B6 渲染）；
 * - 弹药不参与掉落/商店经济（首版）；
 * - 强化钩子预留：击杀补弹（质变卡 2 处决装填）/ 装弹时长 −30% / 无限弹期（衍生技）——
 *   均为纯函数参数，质变卡（B3 接入）经 machine 参数驱动。
 */

/** 弹药状态（武器持有；四字段标准组件 §4.9） */
export interface AmmoState {
  /** 弹量上限（弹巢 6） */
  readonly max: number;
  /** 当前弹量 */
  current: number;
  /** 装弹时长 s（处决装填后 ×0.7，applyReloadMult 写入） */
  reloadSeconds: number;
  /** 装弹中 */
  reloading: boolean;
  /** 装弹已进行 s */
  reloadElapsed: number;
  /** 无限弹期截止（秒时间戳；衍生技 5s 无限弹，HUD 金光常亮） */
  infiniteUntil: number;
}

export interface AmmoConfig {
  max: number;
  reloadSeconds: number;
}

/** 全满弹药态（新弹巢/装弹完成） */
export function fullAmmo(config: AmmoConfig): AmmoState {
  return { max: config.max, current: config.max, reloadSeconds: config.reloadSeconds, reloading: false, reloadElapsed: 0, infiniteUntil: 0 };
}

/**
 * 消耗 1 发（默认）。current 0 → 触发 reloading。
 * 无限弹期内不消耗（infiniteUntil > now）。
 * 返回是否实际射出（弹尽/装弹中 = false）。
 */
export function consumeAmmo(state: AmmoState, now: number, n = 1): boolean {
  if (now < state.infiniteUntil) return true; // 无限弹期：不消耗照常射
  if (state.reloading || state.current <= 0) return false;
  state.current = Math.max(0, state.current - n);
  if (state.current <= 0) {
    state.reloading = true;
    state.reloadElapsed = 0;
  }
  return true;
}

/** 装弹推进（dt 帧步进；装弹完成 → current = max）。无限弹期不打断既有装填。 */
export function tickReload(state: AmmoState, dt: number): void {
  if (!state.reloading) return;
  state.reloadElapsed += dt;
  if (state.reloadElapsed >= state.reloadSeconds) {
    state.reloading = false;
    state.reloadElapsed = 0;
    state.current = state.max;
  }
}

/** 补弹（处决装填击杀 +1 / 共鸣回充预留；上限弹巢，超出丢弃静默） */
export function grantAmmo(state: AmmoState, n = 1): void {
  if (state.reloading) {
    // 装弹中击杀补弹：立即完成装填再补（处决装填口径：击杀缓解装弹真空）
    state.reloading = false;
    state.reloadElapsed = 0;
    state.current = state.max;
  }
  state.current = Math.min(state.max, state.current + n);
}

/** 无限弹窗口（衍生技 dv_lantern_flash：立即补满 + 5s 无限弹） */
export function setInfiniteWindow(state: AmmoState, until: number): void {
  state.infiniteUntil = Math.max(state.infiniteUntil, until);
  // 衍生技口径：开启即补满（gdd §4.1「立即补满弹巢」）
  state.reloading = false;
  state.reloadElapsed = 0;
  state.current = state.max;
}

/** 装弹时长乘区（质变卡 2 处决装填 ×0.7；返回新装弹时长，clamp ≥0.1 防零除） */
export function applyReloadMult(state: AmmoState, mult: number): void {
  state.reloadSeconds = Math.max(0.1, state.reloadSeconds * mult);
}

/** HUD 弹巢点阵数据（6 点：i < current 点亮；装弹中呼吸闪烁由 B6 渲染层消费 reloading） */
export function chamberDots(state: AmmoState): boolean[] {
  return Array.from({ length: state.max }, (_, i) => i < state.current);
}
