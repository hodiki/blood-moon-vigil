import { describe, it, expect, beforeEach } from 'vitest';
import { GameState, GamePhase, canTransition } from '@/core/game-state';

describe('GameState 状态机（ARCH §3.1 / ADR-003 / CM §5）', () => {
  let state: GameState;

  beforeEach(() => {
    state = new GameState();
  });

  it('初始为 RUNNING', () => {
    expect(state.get()).toBe(GamePhase.RUNNING);
  });

  it('RUNNING → LEVEL_UP 合法转换', () => {
    expect(state.set(GamePhase.LEVEL_UP)).toBe(true);
    expect(state.get()).toBe(GamePhase.LEVEL_UP);
  });

  it('RUNNING → PAUSED → RUNNING 往返合法', () => {
    expect(state.set(GamePhase.PAUSED)).toBe(true);
    expect(state.set(GamePhase.RUNNING)).toBe(true);
    expect(state.get()).toBe(GamePhase.RUNNING);
  });

  it('非法转换被拒绝：LEVEL_UP → GAMEOVER 不可达，phase 不变', () => {
    state.set(GamePhase.LEVEL_UP);
    expect(state.set(GamePhase.GAMEOVER)).toBe(false);
    expect(state.get()).toBe(GamePhase.LEVEL_UP);
  });

  it('非法转换被拒绝：GAMEOVER → RUNNING（重开须 scene.restart() 重建，ADR-003）', () => {
    state.set(GamePhase.GAMEOVER);
    expect(state.set(GamePhase.RUNNING)).toBe(false);
    expect(state.get()).toBe(GamePhase.GAMEOVER);
  });

  it('onChange 回调在状态变更时触发，非法转换不触发', () => {
    const calls: GamePhase[] = [];
    state.onChange((p) => calls.push(p));
    state.set(GamePhase.PAUSED);
    state.set(GamePhase.GAMEOVER); // 非法：PAUSED → GAMEOVER
    expect(calls).toEqual([GamePhase.PAUSED]);
  });

  it('canTransition 纯函数矩阵与 CM §5 联动表一致', () => {
    expect(canTransition(GamePhase.RUNNING, GamePhase.LEVEL_UP)).toBe(true);
    expect(canTransition(GamePhase.RUNNING, GamePhase.PAUSED)).toBe(true);
    expect(canTransition(GamePhase.RUNNING, GamePhase.GAMEOVER)).toBe(true);
    expect(canTransition(GamePhase.LEVEL_UP, GamePhase.RUNNING)).toBe(true);
    expect(canTransition(GamePhase.PAUSED, GamePhase.RUNNING)).toBe(true);
    // 非法路径
    expect(canTransition(GamePhase.LEVEL_UP, GamePhase.GAMEOVER)).toBe(false);
    expect(canTransition(GamePhase.PAUSED, GamePhase.LEVEL_UP)).toBe(false);
    expect(canTransition(GamePhase.GAMEOVER, GamePhase.RUNNING)).toBe(false);
  });
});
