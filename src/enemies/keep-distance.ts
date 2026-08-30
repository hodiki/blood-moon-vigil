/**
 * enemies/keep-distance.ts —— 远程精英保持距离·游走 + 缺口读法（W-4 补批，gdd-enemies-v3 §③-4-4/4-5）
 *
 * 掷骨者（200~260 游走）/ 忏悔者（260~320 距离带，边退边射）的距离带 AI 最小实现：
 * - 太近 → 远离；太远 → 接近；带内 → 切向游走（方向按周期翻转——可读的规律性游走，
 *   玩家可预判，符合「威胁可读」支柱 P2）
 * - 缺口读法（§③-4-4 3 连射「落点依次沿玩家位移方向修正锚 0.2」）：3 发落点沿玩家
 *   速度矢量线性外推——相邻落点间隙 = 玩家可穿行的「缺口」，读位移即可预判走位
 *
 * 纯函数（test-framework §1.2）；运行时消费 elite-skill-runtime（velocity 覆写事件）。
 */

/** 距离带（GDD 锚） */
export const BONETHROWER_BAND = { min: 200, max: 260 } as const;
export const PENITENT_BAND = { min: 260, max: 320 } as const;
/** 带内切向游走周期 s（方向翻转节拍；工程锚——可读规律游走） */
export const WANDER_PERIOD = 3;
/** 远离/接近速度倍率（×精英移速） */
export const KEEP_DIST_SPEED_MULT = { retreat: 1.0, approach: 0.8, wander: 0.6 } as const;
/** 3 连射落点位移修正锚（§③-4-4：0.2；落点 i = 玩家位置 + i × correction × 速度矢量） */
export const VOLLEY_CORRECTION = 0.2;

export interface Vec2Like {
  x: number;
  y: number;
}

/**
 * 保持距离游走速度（纯函数）：
 * - dist < min → 远离（retreat ×speed）
 * - dist > max → 接近（approach ×speed）
 * - 带内 → 切向游走（wander ×speed，方向 = sign(sin(2πt/period))，逆时针/顺时针交替）
 * 返回世界系速度矢量（调用方写 body.setVelocity）。
 */
export function wanderVelocity(
  elite: Vec2Like,
  player: Vec2Like,
  time: number,
  band: { readonly min: number; readonly max: number },
  speed: number,
  period: number = WANDER_PERIOD,
): { vx: number; vy: number } {
  const dx = elite.x - player.x;
  const dy = elite.y - player.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  if (dist < band.min) {
    return { vx: ux * speed * KEEP_DIST_SPEED_MULT.retreat, vy: uy * speed * KEEP_DIST_SPEED_MULT.retreat };
  }
  if (dist > band.max) {
    return { vx: -ux * speed * KEEP_DIST_SPEED_MULT.approach, vy: -uy * speed * KEEP_DIST_SPEED_MULT.approach };
  }
  // 带内切向游走：切向单位矢量 × 方向（周期翻转）
  const dir = Math.sin((2 * Math.PI * time) / period) >= 0 ? 1 : -1;
  return { vx: -uy * speed * KEEP_DIST_SPEED_MULT.wander * dir, vy: ux * speed * KEEP_DIST_SPEED_MULT.wander * dir };
}

/**
 * 3 连射落点（缺口读法纯函数）：
 * 落点 i = 玩家当前位置 + i × correction × 玩家速度矢量（沿位移方向线性外推）。
 * 相邻落点间隙即「缺口」——读玩家位移方向即可预判安全走位（§③-4-4 反制窗①）。
 * playerVel 为空/静止 → 3 发重合落点（站桩必中语义）。
 */
export function volleyAimPoints(
  _shooter: Vec2Like,
  player: Vec2Like,
  playerVel: Vec2Like | null,
  shots: number = 3,
  correction: number = VOLLEY_CORRECTION,
): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  const vx = playerVel ? playerVel.x * correction : 0;
  const vy = playerVel ? playerVel.y * correction : 0;
  for (let i = 0; i < shots; i += 1) {
    out.push({ x: player.x + vx * i, y: player.y + vy * i });
  }
  return out;
}

/** 相邻落点间隙 px（缺口宽度；读法判据——≥玩家半径即可穿行） */
export function volleyGapWidth(
  playerVel: Vec2Like | null,
  correction: number = VOLLEY_CORRECTION,
): number {
  if (!playerVel) return 0;
  return Math.hypot(playerVel.x, playerVel.y) * correction;
}
