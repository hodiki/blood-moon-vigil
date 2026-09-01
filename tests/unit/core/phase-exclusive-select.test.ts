import { describe, it, expect } from 'vitest';
import { GameState, GamePhase, canTransition } from '@/core/game-state';

/**
 * NV-REVIEW-FIX-F W-F4：EXCLUSIVE_SELECT 相位矩阵补全（原 game-state.test.ts 未覆盖专武选择相位）。
 * 依据 game-state.ts 状态矩阵（NV-INTEG-FIX P0-2 + ADR-003 + CM §5）：
 *   PROLOGUE → EXCLUSIVE_SELECT → RUNNING；EXCLUSIVE_SELECT 期间世界冻结、
 *   Esc 不产生暂停（togglePause 只认 RUNNING/PAUSED）、选择完成即进战斗。
 */

describe('EXCLUSIVE_SELECT 相位矩阵（NV-INTEG-FIX P0-2 / W-F4 补全）', () => {
  it('PROLOGUE → EXCLUSIVE_SELECT 合法（序章完成后插页）', () => {
    const s = new GameState(GamePhase.PROLOGUE);
    expect(canTransition(GamePhase.PROLOGUE, GamePhase.EXCLUSIVE_SELECT)).toBe(true);
    expect(s.set(GamePhase.EXCLUSIVE_SELECT)).toBe(true);
    expect(s.get()).toBe(GamePhase.EXCLUSIVE_SELECT);
  });

  it('EXCLUSIVE_SELECT → RUNNING 合法（专武选择完成 → applyLoadout → 进战斗）', () => {
    const s = new GameState(GamePhase.EXCLUSIVE_SELECT);
    expect(s.set(GamePhase.RUNNING)).toBe(true);
    expect(s.get()).toBe(GamePhase.RUNNING);
  });

  it('EXCLUSIVE_SELECT 非法转换全矩阵：不可暂停/不可跳升级/不可直接终局/不可回退', () => {
    // 世界冻结相位：Esc（PAUSED）与升级（LEVEL_UP）在 EXCLUSIVE_SELECT 内均不可达
    expect(canTransition(GamePhase.EXCLUSIVE_SELECT, GamePhase.PAUSED)).toBe(false);
    expect(canTransition(GamePhase.EXCLUSIVE_SELECT, GamePhase.LEVEL_UP)).toBe(false);
    expect(canTransition(GamePhase.EXCLUSIVE_SELECT, GamePhase.GAMEOVER)).toBe(false);
    expect(canTransition(GamePhase.EXCLUSIVE_SELECT, GamePhase.PROLOGUE)).toBe(false);
    // 实例语义：拒绝后 phase 不变
    const s = new GameState(GamePhase.EXCLUSIVE_SELECT);
    expect(s.set(GamePhase.PAUSED)).toBe(false);
    expect(s.set(GamePhase.GAMEOVER)).toBe(false);
    expect(s.get()).toBe(GamePhase.EXCLUSIVE_SELECT);
  });

  it('RUNNING 不可回退 EXCLUSIVE_SELECT（专武选择单局一次）', () => {
    expect(canTransition(GamePhase.RUNNING, GamePhase.EXCLUSIVE_SELECT)).toBe(false);
  });

  it('完整开局长链：PROLOGUE → EXCLUSIVE_SELECT → RUNNING → LEVEL_UP → RUNNING → PAUSED → RUNNING → GAMEOVER（终态）', () => {
    const s = new GameState(GamePhase.PROLOGUE);
    expect(s.set(GamePhase.EXCLUSIVE_SELECT)).toBe(true);
    expect(s.set(GamePhase.RUNNING)).toBe(true);
    expect(s.set(GamePhase.LEVEL_UP)).toBe(true);
    expect(s.set(GamePhase.RUNNING)).toBe(true);
    expect(s.set(GamePhase.PAUSED)).toBe(true);
    expect(s.set(GamePhase.RUNNING)).toBe(true);
    expect(s.set(GamePhase.GAMEOVER)).toBe(true);
    expect(s.set(GamePhase.RUNNING)).toBe(false); // 重开 = scene.restart() 重建（ADR-003）
    expect(s.get()).toBe(GamePhase.GAMEOVER);
  });

  it('smoke/bench 直通分支：PROLOGUE → RUNNING 仍合法（不插专武选择页）', () => {
    const s = new GameState(GamePhase.PROLOGUE);
    expect(s.set(GamePhase.RUNNING)).toBe(true);
    expect(s.get()).toBe(GamePhase.RUNNING);
  });
});
