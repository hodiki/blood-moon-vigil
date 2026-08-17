import { describe, it, expect } from 'vitest';
import { EventEmitter, GameEvents, GameEvent, resetGameEvents } from '@/core/events';

describe('EventEmitter（ARCH §3.4 事件总线）', () => {
  it('on/emit：订阅后触发并携带 payload', () => {
    const bus = new EventEmitter();
    const received: unknown[] = [];
    bus.on('e:test', (...args) => received.push(...args));
    bus.emit('e:test', 1, 'a');
    expect(received).toEqual([1, 'a']);
  });

  it('off：取消订阅后不再触发', () => {
    const bus = new EventEmitter();
    let calls = 0;
    const handler = () => {
      calls += 1;
    };
    bus.on('e:test', handler);
    bus.emit('e:test');
    bus.off('e:test', handler);
    bus.emit('e:test');
    expect(calls).toBe(1);
  });

  it('once：只触发一次', () => {
    const bus = new EventEmitter();
    let calls = 0;
    bus.once('e:once', () => {
      calls += 1;
    });
    bus.emit('e:once');
    bus.emit('e:once');
    expect(calls).toBe(1);
  });

  it('removeAllListeners 防泄漏：清空全部订阅', () => {
    const bus = new EventEmitter();
    bus.on('e:a', () => undefined);
    bus.on('e:b', () => undefined);
    expect(bus.eventNames()).toHaveLength(2);
    bus.removeAllListeners();
    expect(bus.eventNames()).toHaveLength(0);
    expect(bus.listenerCount('e:a')).toBe(0);
  });

  it('回调内 on/off 不破坏迭代（快照遍历）', () => {
    const bus = new EventEmitter();
    const calls: string[] = [];
    const a = () => {
      calls.push('a');
      bus.off('e:x', a);
    };
    const b = () => calls.push('b');
    bus.on('e:x', a);
    bus.on('e:x', b);
    bus.emit('e:x');
    expect(calls).toEqual(['a', 'b']);
  });
});

describe('GameEvents 全局单例', () => {
  it('事件名集中常量，无字符串魔法值（ARCH §3.4 约定）', () => {
    expect(GameEvent.EnemyKilled).toBe('enemy:killed');
    expect(GameEvent.LevelUp).toBe('level:up');
    expect(GameEvent.GameOver).toBe('game:over');
    // 全量事件表存在（ARCH §3.4 事件表）
    expect(Object.keys(GameEvent).length).toBeGreaterThanOrEqual(10);
  });

  it('resetGameEvents 清空全局订阅（场景 shutdown 防泄漏）', () => {
    GameEvents.on(GameEvent.LevelUp, () => undefined);
    expect(GameEvents.listenerCount(GameEvent.LevelUp)).toBe(1);
    resetGameEvents();
    expect(GameEvents.listenerCount(GameEvent.LevelUp)).toBe(0);
  });
});
