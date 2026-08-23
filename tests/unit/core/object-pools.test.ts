import { describe, it, expect } from 'vitest';
import { Pool, maxSizeFor, type Poolable } from '@/core/object-pools';
import { DESKTOP_CONFIG, MOBILE_CONFIG } from '@/config/runtime-config';

interface Dummy extends Poolable {
  id: number;
}

function makeItems(n: number): Dummy[] {
  return Array.from({ length: n }, (_, i) => ({ id: i, active: false }));
}

describe('Pool 纯逻辑池（ARCH §3.2/§3.3 / ADR-001）', () => {
  it('acquire 返回 inactive 实例并激活', () => {
    const pool = new Pool(makeItems(3), 3);
    const a = pool.acquire();
    expect(a).not.toBeNull();
    expect(a?.active).toBe(true);
    expect(pool.activeCount).toBe(1);
  });

  it('reject 策略：池满时 acquire 返回 null（调用方节流）', () => {
    const pool = new Pool(makeItems(2), 2);
    expect(pool.acquire()).not.toBeNull();
    expect(pool.acquire()).not.toBeNull();
    expect(pool.acquire()).toBeNull();
    expect(pool.activeCount).toBe(2);
  });

  it('release 后实例复用，字段由调用方重置', () => {
    const pool = new Pool(makeItems(2), 2);
    const a = pool.acquire()!;
    pool.release(a);
    expect(a.active).toBe(false);
    const b = pool.acquire();
    expect(b).not.toBeNull();
    expect(b?.id).toBe(a.id); // 复用同一实例
  });

  it('eachActive 只遍历 active（避免 O(n) 全扫）', () => {
    const pool = new Pool(makeItems(4), 4);
    pool.acquire();
    pool.acquire();
    const seen: number[] = [];
    pool.eachActive((o) => seen.push(o.id));
    expect(seen).toHaveLength(2);
  });

  it('recycle-oldest 策略：池满回收最早激活者并复用', () => {
    const pool = new Pool(makeItems(2), 2, 'recycle-oldest');
    const first = pool.acquire()!;
    pool.acquire();
    const third = pool.acquire(); // 池满 → 回收最早者 first 并复用
    expect(third).not.toBeNull();
    expect(third).toBe(first); // 返回的正是被回收的最早者
    expect(third!.active).toBe(true); // 复用后重新激活
    expect(pool.activeCount).toBe(2); // 活跃数不超 maxSize
  });

  it('构造时实例数超过 maxSize 抛错（预算硬约束）', () => {
    expect(() => new Pool(makeItems(3), 2)).toThrow();
  });
});

describe('maxSizeFor：池上限从 RuntimeConfig 读取（唯一数据源）', () => {
  it('桌面：敌人 400 / 宝石 300 / 子弹 8 / 治疗道具 48', () => {
    expect(maxSizeFor(DESKTOP_CONFIG, 'enemies')).toBe(400);
    expect(maxSizeFor(DESKTOP_CONFIG, 'gems')).toBe(300);
    expect(maxSizeFor(DESKTOP_CONFIG, 'bullets')).toBe(8);
    expect(maxSizeFor(DESKTOP_CONFIG, 'heals')).toBe(48);
  });

  it('移动：敌人 250 / 宝石 200 / 子弹 8（双端一致）/ 治疗道具 32', () => {
    expect(maxSizeFor(MOBILE_CONFIG, 'enemies')).toBe(250);
    expect(maxSizeFor(MOBILE_CONFIG, 'gems')).toBe(200);
    expect(maxSizeFor(MOBILE_CONFIG, 'bullets')).toBe(8);
    expect(maxSizeFor(MOBILE_CONFIG, 'heals')).toBe(32);
  });
});
