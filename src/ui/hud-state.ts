/**
 * ui/hud-state.ts —— HUD 状态归约器（纯函数层，E4-S1）
 *
 * 依 ADR-004 / ARCH §2 单向数据流：DOM HUD 不持有游戏状态，只通过事件流推导自身显示状态。
 * 本模块是「事件 → HUD 显示状态」的纯归约器（可脱离 DOM/Phaser 单测，test-framework §1.2）。
 * 消费事件（任务指定触发场景）：
 *   xp:gem-collected → 经验条累计
 *   level:up        → 等级文本 + 经验条归零（xpNeeded 来自 payload）
 *   hp:changed      → HP 条填充 + 数值
 *   weapon:unlocked → 武器槽点亮（1=守夜之环 / 2=月蚀脉冲；飞弹初始可用）
 *   boss:spawned / boss:hp / boss:defeated / game:over → Boss 顶部血条显隐
 */

import { GameEvent } from '@/core/events';
import { PLAYER } from '@/config/balance';
import { needXp } from '@/xp/xp-manager';

export interface HudWeaponState {
  missile: boolean;
  orbit: boolean;
  shockwave: boolean;
}

export interface HudState {
  level: number;
  xp: number;
  xpNeeded: number;
  hp: number;
  maxHp: number;
  weapons: HudWeaponState;
  bossHp: number | null;
  bossMaxHp: number | null;
}

export function createInitialHudState(): HudState {
  return {
    level: 1,
    xp: 0,
    xpNeeded: needXp(1),
    hp: PLAYER.MAX_HP,
    maxHp: PLAYER.MAX_HP,
    weapons: { missile: true, orbit: false, shockwave: false },
    bossHp: null,
    bossMaxHp: null,
  };
}

interface GemCollectedPayload {
  amount: number;
}
interface LevelUpPayload {
  level: number;
  xpNeeded: number;
}
interface HpPayload {
  hp: number;
  maxHp: number;
}
interface WeaponUnlockedPayload {
  weaponId: number;
}
interface BossSpawnedPayload {
  bossHp: number;
}

/** 事件 → 新状态（不修改入参，返回新对象；未知事件原样返回） */
export function reduceHudState(state: HudState, event: string, payload: unknown): HudState {
  switch (event) {
    case GameEvent.GemCollected: {
      const p = payload as GemCollectedPayload;
      return { ...state, xp: state.xp + p.amount };
    }
    case GameEvent.LevelUp: {
      const p = payload as LevelUpPayload;
      return { ...state, level: p.level, xp: 0, xpNeeded: p.xpNeeded };
    }
    case GameEvent.HpChanged: {
      const p = payload as HpPayload;
      return { ...state, hp: p.hp, maxHp: p.maxHp };
    }
    case GameEvent.WeaponUnlocked: {
      const p = payload as WeaponUnlockedPayload;
      const weapons = { ...state.weapons };
      if (p.weaponId === 1) weapons.orbit = true;
      else if (p.weaponId === 2) weapons.shockwave = true;
      return { ...state, weapons };
    }
    case GameEvent.BossSpawned: {
      const p = payload as BossSpawnedPayload;
      return { ...state, bossHp: p.bossHp, bossMaxHp: p.bossHp };
    }
    case GameEvent.BossHpChanged: {
      const p = payload as HpPayload;
      return { ...state, bossHp: p.hp, bossMaxHp: p.maxHp };
    }
    case GameEvent.BossDefeated:
    case GameEvent.GameOver:
      return { ...state, bossHp: null, bossMaxHp: null };
    default:
      return state;
  }
}

/** 经验条填充比例（0~1）；need>0 兜底 */
export function xpFillFraction(state: HudState): number {
  if (state.xpNeeded <= 0) return 0;
  return Math.min(1, state.xp / state.xpNeeded);
}

/** HP 条填充比例（0~1） */
export function hpFillFraction(state: HudState): number {
  if (state.maxHp <= 0) return 0;
  return Math.min(1, Math.max(0, state.hp / state.maxHp));
}

/** Boss 血条填充比例（0~1；无 Boss 返回 0） */
export function bossFillFraction(state: HudState): number {
  if (state.bossMaxHp === null || state.bossMaxHp <= 0) return 0;
  return Math.min(1, Math.max(0, (state.bossHp ?? 0) / state.bossMaxHp));
}
