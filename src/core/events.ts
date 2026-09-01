/**
 * core/events.ts —— 全局事件总线（ARCH §3.4）
 *
 * 设计说明：
 * - 架构文档指定用 `Phaser.Events.EventEmitter` 做全局单例。为满足 L1 纯逻辑单测
 *   （tests/unit/core/events.test.ts 在 Node 环境运行，不 import Phaser 运行时），
 *   这里实现一个与 Phaser.Events.EventEmitter 同 API 面（on/once/off/emit/
 *   removeAllListeners）的轻量 EventEmitter。API 兼容，后续如需替换为 Phaser 版本
 *   只需改本文件一处。
 * - 事件名集中为常量（禁止字符串魔法值，ARCH §3.4 约定），本文件是唯一来源。
 * - 防泄漏约定：消费方在 PlayScene.create 统一订阅；场景 shutdown 时调用
 *   `resetGameEvents()`（内部 removeAllListeners）。
 */

export type EventHandler = (...args: unknown[]) => void;

type HandlerEntry = { fn: EventHandler; context?: unknown; once: boolean };

export class EventEmitter {
  private listeners = new Map<string, HandlerEntry[]>();

  on(event: string, fn: EventHandler, context?: unknown): this {
    const list = this.listeners.get(event) ?? [];
    list.push({ fn, context, once: false });
    this.listeners.set(event, list);
    return this;
  }

  once(event: string, fn: EventHandler, context?: unknown): this {
    const list = this.listeners.get(event) ?? [];
    list.push({ fn, context, once: true });
    this.listeners.set(event, list);
    return this;
  }

  off(event: string, fn?: EventHandler): this {
    if (!fn) {
      this.listeners.delete(event);
      return this;
    }
    const list = this.listeners.get(event);
    if (!list) return this;
    const next = list.filter((e) => e.fn !== fn);
    if (next.length === 0) this.listeners.delete(event);
    else this.listeners.set(event, next);
    return this;
  }

  emit(event: string, ...args: unknown[]): boolean {
    const list = this.listeners.get(event);
    if (!list || list.length === 0) return false;
    // 拷贝后再遍历，允许回调内 on/off（防迭代器失效）
    const snapshot = [...list];
    for (const entry of snapshot) {
      if (entry.once) this.off(event, entry.fn);
      entry.fn.apply(entry.context, args);
    }
    return true;
  }

  removeAllListeners(event?: string): this {
    if (event === undefined) {
      this.listeners.clear();
    } else {
      this.listeners.delete(event);
    }
    return this;
  }

  /** 调试/测试用：当前已注册事件名 */
  eventNames(): string[] {
    return [...this.listeners.keys()];
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.length ?? 0;
  }
}

/** 全局单例（架构 §3.4：所有跨系统通信走事件，不互相 import 可变状态） */
export const GameEvents = new EventEmitter();

/** 场景关闭时清空所有订阅，防泄漏（PlayScene.shutdown 调用） */
export function resetGameEvents(): void {
  GameEvents.removeAllListeners();
}

/** 事件名常量表（ARCH §3.4 事件表；E1 仅使用其中与 core/玩家相关部分；E4 补齐 HUD/结算/Boss 事件） */
export const GameEvent = {
  EnemyKilled: 'enemy:killed',
  GemCollected: 'xp:gem-collected',
  LevelUp: 'level:up',
  UpgradeOffered: 'upgrade:offered',
  UpgradeChosen: 'upgrade:chosen',
  PlayerHurt: 'player:hurt',
  PlayerDied: 'player:died',
  PlayerRevived: 'player:revived',
  BossSpawned: 'boss:spawned',
  BossDefeated: 'boss:defeated',
  GameOver: 'game:over',
  /** E4-S1 HUD：HP 变化（受击/升级回血/吸血/生命上限提升，payload { hp, maxHp }） */
  HpChanged: 'hp:changed',
  /** E4-S1 HUD：武器解锁（升级 1/2 号项，payload { weaponId, name }） */
  WeaponUnlocked: 'weapon:unlocked',
  /** Phase 6 音频：飞弹发射成功（audio-bible §2 SFX#1 触发点，payload { x, y }） */
  WeaponFired: 'weapon:fired',
  /** E4-S2 HUD：Boss 血条（每帧/受击刷新，payload { hp, maxHp }） */
  BossHpChanged: 'boss:hp',
  /** E4-S4 结算：再来一局（ResultsOverlay → PlayScene.scene.restart） */
  RestartRequested: 'game:restart',
  /** E4-S4 结算：返回启动（ResultsOverlay → PlayScene.scene.start('Boot')） */
  ToMenuRequested: 'game:to-menu',
  /** TASK-39 E2 屠夫预警：保底厚血出生前血月印记开始（payload { x, y }，PlayScene 生成红圈 + 音频低音） */
  TankWarning: 'enemy:tank-warning',
  /** TASK-39 E2 屠夫预警：预约厚血落地（payload { x, y }，PlayScene 销毁印记） */
  TankSpawned: 'enemy:tank-spawned',
  /** M3 治疗道具：拾取完成（payload { amount, x, y }，HealManager emit；PlayScene 接 fx 治疗绿发光 + HpChanged） */
  HealCollected: 'xp:heal-collected',
  /** M3 轻叙事：图鉴新条目（payload 无；PlayScene 聚合同帧解锁合并 emit 1 条，narratives-spec §6 n_toast_codex） */
  CodexUpdated: 'codex:updated',
  /** W-A/W-10 方阵预约：阵纹预警开始（payload { formationId, x, y }；2.5s 阵纹演出挂点 W-13） */
  FormationWarning: 'enemy:formation-warning',
  /** W-A/W-10 方阵组落地沿（payload { groupId, formationId, x, y }；伴随生成窗口/黑板创建挂点） */
  FormationLanded: 'enemy:formation-landed',
  /** W-14 宝藏落地（payload { x, y }；驮尸全灭 → 宝藏实体生成挂点，MN-21 offer 直发） */
  TreasureDropped: 'enemy:treasure-dropped',
  /** W-14 宝藏拾取（payload { x, y }；三选一 offer 直发 1 次，与卡 2 渠道解耦） */
  TreasureCollected: 'enemy:treasure-collected',
  /** P2-7② Boss 硬控免疫反馈（payload { x, y, now }；applyStatus reason='immune' ∧ kind='stun' 时 emit，FloatTextLayer 消费飘「免疫」） */
  StatusImmune: 'status:immune',
} as const;

export type GameEventName = (typeof GameEvent)[keyof typeof GameEvent];
