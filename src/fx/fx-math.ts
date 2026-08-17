/**
 * fx/fx-math.ts —— 粒子数学（纯函数，可单测；TASK-28 美术表现力专项）
 *
 * 与 gameplay 数学分离：本模块只产出「方向/环上坐标/预算裁剪」等视觉几何，
 * 不触碰任何数值/玩法逻辑（GDD 数值在 balance.ts，见 ARCH §2 纪律）。
 * 运行期 FxManager 用 Math.random 制造多样性；本模块确定性函数供测试/工具复用。
 */

import { mulberry32 } from '@/utils/math';

export interface FxVec {
  x: number;
  y: number;
}

/** 以 seed 确定性生成 count 个单位方向向量（溅射方向集，同 seed 可复现） */
export function burstVectors(count: number, seed: number): FxVec[] {
  const rng = mulberry32(seed);
  const out: FxVec[] = [];
  for (let i = 0; i < count; i += 1) {
    const a = rng() * Math.PI * 2;
    out.push({ x: Math.cos(a), y: Math.sin(a) });
  }
  return out;
}

/** 均匀分布在半径 radius 圆周上的 count 个点（冲击波涟漪/Boss 出场环；等角均匀，无需 seed） */
export function ringParticles(count: number, radius: number): FxVec[] {
  const out: FxVec[] = [];
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    out.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius });
  }
  return out;
}

/** 预算裁剪：溅射/爆发粒子数不超池空闲数（池满 reject，soft-cap 保证 ≤maxParticles） */
export function capBurstCount(desired: number, free: number): number {
  if (desired <= 0 || free <= 0) return 0;
  return Math.min(desired, free);
}
