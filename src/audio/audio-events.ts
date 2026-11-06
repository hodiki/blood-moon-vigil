/**
 * audio/audio-events.ts —— 事件总线 → AudioManager 接线（ARCH §3.4）
 *
 * PlayScene.create 调用 bindAudioEvents()，shutdown 调用返回的 unbind()；
 * 与 resetGameEvents() 纪律配合（消费方统一注册/清空，防泄漏）。
 * 触发点对齐 audio-bible §2 与 ux-spec §7：
 * - weapon:fired → 武器发射（WeaponSystem 发射成功后 emit）
 * - enemy:killed → 击杀闷响（4 变体）
 * - xp:gem-collected → 宝石叮声
 * - player:hurt → 受击音 + 触觉 15ms
 * - upgrade:chosen → 选卡确认
 * - boss:spawned → Boss 出场重音 + 心跳 Boss 模式 + 触觉双震
 * - boss:defeated → 退出 Boss 模式
 * - game:over → 死亡/胜利 0.3s 静默 + sting
 * - enemy:treasure-collected → #4 稀有拾取金铃（ux-spec §7 稀有拾取提示；批 A-3）
 * - level:up → #7 升级卡滑入气声（ux-spec §7 升级卡滑入；批 A-3）
 * - game:over +0.2s → #10 结算数字滚动 tick（ux-spec §7 结算数字滚动；批 A-3）
 */

import { GameEvents, GameEvent } from '@/core/events';
import { AudioManager } from '@/audio/audio-manager';
import type { KillVariant } from '@/audio/sfx-palette';

/** #10 结算 tick 延迟 ms（ux-spec §7：进 GAMEOVER 后延迟 0.2s） */
const SETTLE_TICK_DELAY_MS = 200;

export function bindAudioEvents(): () => void {
  const audio = AudioManager.getInstance();
  const handlers: Array<{ event: string; fn: (...args: unknown[]) => void }> = [];
  /** #10 结算 tick 定时器（unbind/重绑时清空，防跨局残留） */
  let settleTickTimeout: number | null = null;

  const on = (event: string, fn: (...args: unknown[]) => void): void => {
    GameEvents.on(event, fn);
    handlers.push({ event, fn });
  };

  on(GameEvent.WeaponFired, () => audio.playSfx('weapon'));
  on(GameEvent.EnemyKilled, (payload: unknown) => {
    const p = payload as { enemyType?: string };
    audio.playKill((p.enemyType as KillVariant) ?? 'zombie');
  });
  on(GameEvent.GemCollected, () => audio.playSfx('gem'));
  // #4 稀有拾取：独特金铃「叮——咚」（bible §2；W-14 宝藏拾取 = 稀有掉落，ux-spec §7）
  on(GameEvent.TreasureCollected, () => audio.playSfx('rare'));
  on(GameEvent.PlayerHurt, () => {
    audio.playSfx('hurt');
    audio.vibrate(15); // 受击短震（bible §6）
  });
  on(GameEvent.UpgradeChosen, () => audio.playSfx('confirm'));
  // #7 升级·卡滑入：极轻气声「嘶」（bible §2；进 LEVEL_UP 时刻，ux-spec §7 升级卡滑入）
  on(GameEvent.LevelUp, () => audio.playSfx('cardSlide'));
  // TASK-39 E2 屠夫预警：精英登场低音提前（复用 boss 低频重音；bible §2，比出生时更早给玩家听觉预兆）
  on(GameEvent.TankWarning, () => audio.playSfx('boss'));
  on(GameEvent.BossSpawned, () => {
    audio.playSfx('boss');
    audio.setBossMode(true); // 心跳双拍 +3dB（bible §1）
    audio.vibrate([30, 50, 30]); // Boss 双震 30/50ms（bible §6）
  });
  on(GameEvent.BossDefeated, () => audio.setBossMode(false));
  on(GameEvent.GameOver, (payload: unknown) => {
    const p = payload as { stats?: { victory?: boolean } };
    audio.handleGameOver(p.stats?.victory ?? false);
    // #10 结算数字滚动 tick：进 GAMEOVER 后 0.2s（ux-spec §7）。
    // duringSilence=true：装饰层例外，0.3s 死亡静默窗口内仍发声（-18dB 极轻）——
    // 取舍见报告 NV-AUDIO-EXEC-01：§2 触发点与 §3 静默设计有 0.1s 重叠，取 §2 字面
    // 时点并以「极轻装饰音」保住静默的听感分量；若主理人要求纯静默可改 0.3s 后触发。
    if (settleTickTimeout !== null) window.clearTimeout(settleTickTimeout);
    settleTickTimeout = window.setTimeout(() => {
      settleTickTimeout = null;
      audio.playSfx('tick', { duringSilence: true });
    }, SETTLE_TICK_DELAY_MS);
  });

  return () => {
    if (settleTickTimeout !== null) {
      window.clearTimeout(settleTickTimeout);
      settleTickTimeout = null;
    }
    for (const h of handlers) GameEvents.off(h.event, h.fn);
  };
}
