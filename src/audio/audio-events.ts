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
 */

import { GameEvents, GameEvent } from '@/core/events';
import { AudioManager } from '@/audio/audio-manager';
import type { KillVariant } from '@/audio/sfx-palette';

export function bindAudioEvents(): () => void {
  const audio = AudioManager.getInstance();
  const handlers: Array<{ event: string; fn: (...args: unknown[]) => void }> = [];

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
  on(GameEvent.PlayerHurt, () => {
    audio.playSfx('hurt');
    audio.vibrate(15); // 受击短震（bible §6）
  });
  on(GameEvent.UpgradeChosen, () => audio.playSfx('confirm'));
  on(GameEvent.BossSpawned, () => {
    audio.playSfx('boss');
    audio.setBossMode(true); // 心跳双拍 +3dB（bible §1）
    audio.vibrate([30, 50, 30]); // Boss 双震 30/50ms（bible §6）
  });
  on(GameEvent.BossDefeated, () => audio.setBossMode(false));
  on(GameEvent.GameOver, (payload: unknown) => {
    const p = payload as { stats?: { victory?: boolean } };
    audio.handleGameOver(p.stats?.victory ?? false);
  });

  return () => {
    for (const h of handlers) GameEvents.off(h.event, h.fn);
  };
}
