/**
 * config/balance/player.ts —— 玩家初始属性/成长/虚拟摇杆
 *
 * balance.ts 域拆分（EG-1）纯搬移：数值与注释原样保留，不改任何行为。
 */

import { WORLD } from './world';

export const PLAYER = {
  SPAWN_X: WORLD.WIDTH / 2,
  SPAWN_Y: WORLD.HEIGHT / 2,
  MOVE_SPEED: 235, // px/s（TASK-39 R1 波次2：220→235 +6.8%，用户已批；E1-S6 验收基线同步）
  MAX_HP: 100, // upgrade-pool v0.2 裁决（TASK-11）已确认 HP=100（control-manifest §9 C-3）
  DAMAGE_MULTIPLIER: 1.0, // 初始倍率（upgrade-pool §③）
  INVULNERABLE_TIME: 0.5, // s（enemies §⑥.3 接触无敌帧）
  RADIUS: 14, // 碰撞半径 px（与僵尸同量级，enemies §③）
} as const;

/** 升级自动成长（upgrade-pool §③，纯逻辑可单测） */
export const GROWTH = {
  HP_PER_LEVEL: 8,
  DAMAGE_PCT_PER_LEVEL: 0.04, // +4%
  SPEED_EVERY_N_LEVELS: 5,
  SPEED_PER_STEP: 4, // px/s
} as const;

/** 虚拟摇杆（移动端，ux-spec §2/§5 混合方案：常驻底座 + 左半屏任意处起手） */
export const JOYSTICK = {
  DEFAULT_BASE_X: 180, // 720×1280 设计空间
  DEFAULT_BASE_Y: 1120,
  RADIUS: 48, // 底座视觉 96px 直径（CM §6）
  DEAD_ZONE_FRACTION: 0.1, // 中心 10% 不响应（CM M8）
} as const;
