/**
 * utils/math.ts —— 向量工具（纯函数，可单测）
 */

export interface Vec2 {
  x: number;
  y: number;
}

/** 向量长度（2D） */
export function vecLength(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

/** 归一化到长度 ≤1（斜向防超速，CM M5） */
export function clampMagnitude(v: Vec2, max = 1): Vec2 {
  const len = vecLength(v);
  if (len === 0 || len <= max) return { x: v.x, y: v.y };
  const scale = max / len;
  return { x: v.x * scale, y: v.y * scale };
}

/** 坐标 clamp 到世界边界 [0, worldW]×[0, worldH]（S9 边界，E1-S6） */
export function clampToWorld(pos: Vec2, worldW: number, worldH: number): Vec2 {
  return {
    x: Math.min(Math.max(pos.x, 0), worldW),
    y: Math.min(Math.max(pos.y, 0), worldH),
  };
}

/** 确定性 PRNG（mulberry32），用于程序化地图/障碍布局可复现（S9） */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * '#RRGGBB' → 0xRRGGBB 整数（Phaser 颜色 API 需要的格式）。
 * 纯函数（不依赖 Phaser 运行时），保证 config 模块可在 Node 单测中加载。
 */
export function hexToRgbInt(hex: string): number {
  const h = hex.replace('#', '');
  return parseInt(h, 16);
}
