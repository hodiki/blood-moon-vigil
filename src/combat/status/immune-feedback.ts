/**
 * combat/status/immune-feedback.ts —— Boss 硬控免疫玩家可读反馈（P2-7②）
 *
 * 状态层 applyStatus 为纯函数（reason='immune' 只随返回值走，§3.4 WD-6 Boss 硬控免疫）；
 * 本包装在**免疫拒绝且种类为硬控（stun）**时经全局事件总线广播 StatusImmune，
 * 表现层（FloatTextLayer）订阅后飘「免疫」短文本（节流在表现层，纯层零渲染依赖）。
 * 软控/易伤免疫不飘字（Boss 对软控/易伤本就生效，触发面极窄）。
 */

import { applyStatus, type ApplyStatusResult, type StatusApplication, type StatusState } from './status-engine';
import type { CcProfile } from './status-config';
import { GameEvents, GameEvent } from '@/core/events';

export function applyStatusWithImmuneFeedback(
  state: StatusState,
  app: StatusApplication,
  now: number,
  target: { x: number; y: number },
  profile: CcProfile = {},
): ApplyStatusResult {
  const result = applyStatus(state, app, now, profile);
  if (result.reason === 'immune' && app.kind === 'stun') {
    GameEvents.emit(GameEvent.StatusImmune, { x: target.x, y: target.y, now });
  }
  return result;
}
