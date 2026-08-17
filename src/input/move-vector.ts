/**
 * input/move-vector.ts —— 键位组合 → 移动向量（纯函数，可脱离 Phaser 单测）
 *
 * 规则（CM §1.1 M1–M6）：
 * - 单键：W/↑=(0,-1) S/↓=(0,1) A/←=(-1,0) D/→=(1,0)
 * - 斜向组合：归一化到长度 1（斜向速度 = 单方向速度，防超速 M5）
 * - 全部松开：(0,0)（M6）
 */

import { clampMagnitude, type Vec2 } from '@/utils/math';

export interface KeyState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export function computeMoveVector(keys: KeyState): Vec2 {
  const raw: Vec2 = {
    x: (keys.right ? 1 : 0) - (keys.left ? 1 : 0),
    y: (keys.down ? 1 : 0) - (keys.up ? 1 : 0),
  };
  return clampMagnitude(raw, 1);
}
