/**
 * core/game-state.ts —— 五状态状态机（ARCH §3.1 / ADR-003 / CM §5）
 *
 * 纯逻辑类，不 import Phaser；PlayScene 通过 onChange 挂接副作用
 * （physics/tweens/粒子/输入冻结），单测可直接断言状态矩阵。
 *
 * 状态矩阵（CM §5 联动表 + ADR-003 + M3 序章）：
 *   PROLOGUE → RUNNING              （序章屏完成/跳过；M3 序章期间不开始计时/生成器）
 *   RUNNING  → LEVEL_UP | PAUSED | GAMEOVER
 *   LEVEL_UP → RUNNING              （选卡完成 / 30s 超时）
 *   PAUSED   → RUNNING              （恢复）
 *   GAMEOVER → （无）                （重开 = scene.restart() 重建新实例，ADR-003）
 */

export enum GamePhase {
  /** M3 序章屏（点击「开始」后进入战斗前；世界冻结、不开始计时/生成器） */
  PROLOGUE = 'PROLOGUE',
  RUNNING = 'RUNNING',
  LEVEL_UP = 'LEVEL_UP',
  PAUSED = 'PAUSED',
  GAMEOVER = 'GAMEOVER',
}

const TRANSITIONS: Record<GamePhase, readonly GamePhase[]> = {
  [GamePhase.PROLOGUE]: [GamePhase.RUNNING],
  [GamePhase.RUNNING]: [GamePhase.LEVEL_UP, GamePhase.PAUSED, GamePhase.GAMEOVER],
  [GamePhase.LEVEL_UP]: [GamePhase.RUNNING],
  [GamePhase.PAUSED]: [GamePhase.RUNNING],
  [GamePhase.GAMEOVER]: [],
};

/** 纯函数：转换是否合法（可脱离实例单测，test-framework §1.2） */
export function canTransition(from: GamePhase, to: GamePhase): boolean {
  return TRANSITIONS[from].includes(to);
}

export class GameState {
  private phase: GamePhase;
  private listeners: Array<(p: GamePhase) => void> = [];

  /** 初始相位缺省 RUNNING（序章屏场景传 GamePhase.PROLOGUE；无参调用保持既有语义） */
  constructor(initial: GamePhase = GamePhase.RUNNING) {
    this.phase = initial;
  }

  /** 请求状态切换；非法转换被拒绝并返回 false，phase 不变 */
  set(next: GamePhase): boolean {
    if (next === this.phase) return true;
    if (!canTransition(this.phase, next)) return false;
    this.phase = next;
    for (const cb of [...this.listeners]) cb(next);
    return true;
  }

  get(): GamePhase {
    return this.phase;
  }

  /** 状态变更回调（副作用唯一入口，ADR-003） */
  onChange(cb: (p: GamePhase) => void): void {
    this.listeners.push(cb);
  }

  removeChangeListener(cb: (p: GamePhase) => void): void {
    this.listeners = this.listeners.filter((l) => l !== cb);
  }
}
