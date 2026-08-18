import { describe, it, expect } from 'vitest';

/**
 * TASK-41 v3.5 剪影边界校验（TASK-28 C-1 纪律复验 · silhouette-v35-spec §5 边界总表）。
 * 程序贴图帧绘制坐标不允许超帧：内容坐标 × 描边放大层 ≤ 帧半（+0.01 浮点容差）。
 * 本测试把 v3.5 各特征的最危险坐标固化为数据，防止后续加宽/上探时越界裁切回归。
 */

/** 玩家帧 32×32，中心 (0,0)，烘焙描边放大 1.12 → 内容坐标上限 ±14.29，帧半 16 */
const PLAYER_FRAME_HALF = 16;
const PLAYER_OUTLINE = 1.12;

/** 屠夫帧 48×48，纯剪影无描边层 → 帧半 24 */
const TANK_FRAME_HALF = 24;

interface BoundCheck {
  feature: string;
  coords: readonly number[]; // 危险坐标（最极端处）
  scale: number;
  frameHalf: number;
  /** 预期最大放大后绝对值（可选，文档留档） */
  expectedMax?: number;
}

const BOUNDS: readonly BoundCheck[] = [
  // —— 玩家（×1.12 描边层）——
  { feature: '帽冠锥形尖顶 y=-14', coords: [-14, 14], scale: PLAYER_OUTLINE, frameHalf: PLAYER_FRAME_HALF, expectedMax: 15.68 },
  { feature: '帽檐 x=±13 / y=-8', coords: [-13, 13, -8, 8], scale: PLAYER_OUTLINE, frameHalf: PLAYER_FRAME_HALF, expectedMax: 14.56 },
  { feature: '披风 pose0 下摆 x=±13.5 / y=13', coords: [-13.5, 13.5, -13, 13], scale: PLAYER_OUTLINE, frameHalf: PLAYER_FRAME_HALF, expectedMax: 15.12 },
  { feature: '披风 pose1 下摆 x=±14 / y=14（最紧，保持不动）', coords: [-14, 14, -14, 14], scale: PLAYER_OUTLINE, frameHalf: PLAYER_FRAME_HALF, expectedMax: 15.68 },
  { feature: '帽冠肩 x=±8', coords: [-8, 8], scale: PLAYER_OUTLINE, frameHalf: PLAYER_FRAME_HALF },
  { feature: '开衩 x=±8.5（INK 镂空，不改变外轮廓）', coords: [-8.5, 8.5], scale: PLAYER_OUTLINE, frameHalf: PLAYER_FRAME_HALF },
  // —— 玩家提灯（描边后正常比例，不参与 1.12）——
  { feature: '提灯光晕最右 x=15.7（r5.2@10.5；安全上限勿加 r≥5.5）', coords: [15.7, -15.7], scale: 1, frameHalf: PLAYER_FRAME_HALF, expectedMax: 15.7 },
  { feature: '提灯灯杆 y=-6', coords: [-6], scale: 1, frameHalf: PLAYER_FRAME_HALF },
  // —— 屠夫（48px 帧，无放大层）——
  { feature: '屠刀刃光 x=23.5（22.5..23.5）', coords: [23.5, -23.5], scale: 1, frameHalf: TANK_FRAME_HALF, expectedMax: 23.5 },
  { feature: '屠刀刀身最右 x=23', coords: [23], scale: 1, frameHalf: TANK_FRAME_HALF },
];

describe('TASK-41 v3.5 剪影边界（C-1 纪律：内容坐标 × 放大层 ≤ 帧半）', () => {
  it.each(BOUNDS.map((b) => [b.feature, b] as const))('%s', (_name, b) => {
    for (const c of b.coords) {
      const scaled = Math.abs(c) * b.scale;
      expect(scaled, `${b.feature} 坐标 ${c} × ${b.scale} 应 ≤ ${b.frameHalf}`).toBeLessThanOrEqual(
        b.frameHalf + 0.01,
      );
    }
  });

  it('关键边界值与方案文档一致（silhouette-v35-spec §5）', () => {
    // 帽冠尖顶 y=-14 ×1.12 = -15.68（margin 0.32，最紧，勿再上探）
    expect(Math.abs(-14) * PLAYER_OUTLINE).toBeCloseTo(15.68, 5);
    // 帽檐 x=±13 ×1.12 = ±14.56（margin 1.44）
    expect(Math.abs(13) * PLAYER_OUTLINE).toBeCloseTo(14.56, 5);
    // 披风 pose0 x=±13.5 ×1.12 = ±15.12（margin 0.88）
    expect(Math.abs(13.5) * PLAYER_OUTLINE).toBeCloseTo(15.12, 5);
    // 提灯光晕最右 x=15.7（margin 0.3）
    expect(15.7).toBeLessThan(16);
  });
});
