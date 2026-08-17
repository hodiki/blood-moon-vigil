/**
 * input/input-source.ts —— 统一移动向量接口（ARCH §4.1 / ADR-002）
 *
 * 本架构唯一输入出口：玩家模块只依赖本接口，完全不感知设备。
 * - getMove(): x∈[-1,1], y∈[-1,1]，归一化长度 ≤1（摇杆幅度即速度百分比）
 * - onPauseToggle / onTap / destroy：ADR-002 四方法
 * - setEnabled：CM §5 联动（LEVEL_UP/PAUSED 摇杆隐藏且输入冻结）所需，
 *   为对 ADR-002 接口的最小扩展，KeyboardInput 空实现、TouchInput 隐藏摇杆。
 */

import type { Vec2 } from '@/utils/math';

export interface InputSource {
  /** 当前移动向量（长度 ≤1） */
  getMove(): Vec2;
  /** 暂停/恢复事件（桌面 Esc/P；移动端由 E4 暂停键调用） */
  onPauseToggle(cb: () => void): void;
  /** 一次性点按事件（战斗内点按，E1 未用，接口预留） */
  onTap(cb: (x: number, y: number) => void): void;
  /** 输入使能开关：非 RUNNING 态冻结输入 / 隐藏摇杆（CM §5） */
  setEnabled(enabled: boolean): void;
  destroy(): void;
}
