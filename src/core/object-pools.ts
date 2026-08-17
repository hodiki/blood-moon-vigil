/**
 * core/object-pools.ts —— 对象池（ARCH §3.2/§3.3 / ADR-001）
 *
 * 两层结构：
 * 1. `Pool<T>`：纯逻辑池（可脱离 Phaser 单测）。持有固定容量实例列表，
 *    acquire/release 复用实例，eachActive 只遍历 active（避免 O(n) 全扫）。
 *    池满策略（ADR-001 验收 / ARCH §3.3）：'reject'（返回 null，由调用方节流）
 *    或 'recycle-oldest'（回收最早激活者）。
 * 2. `createArcadePool`：Phaser 适配器，用 `Phaser.Physics.Arcade.Group`
 *    （classType + maxSize，maxSize 从 RuntimeConfig 读取）承载池化实体，
 *    供 E2+ 敌人/子弹/宝石使用。E1 暂无池化实体，本适配器作为接口就绪。
 */

import type Phaser from 'phaser';
import type { RuntimeConfig } from '@/config/runtime-config';

export interface Poolable {
  active: boolean;
}

export type PoolFullStrategy = 'reject' | 'recycle-oldest';

export class Pool<T extends Poolable> {
  private readonly items: T[];
  private readonly acquisitionOrder: T[] = [];

  constructor(
    items: T[],
    readonly maxSize: number,
    private readonly strategy: PoolFullStrategy = 'reject',
  ) {
    this.items = items;
    if (items.length > maxSize) {
      throw new Error(`Pool maxSize=${maxSize} 小于初始实例数 ${items.length}`);
    }
  }

  /**
   * 取一个 inactive 实例并激活；池满按策略处理：
   * - reject：返回 null（调用方节流重试）；
   * - recycle-oldest：回收最早激活者后复用（不会超 maxSize 的活跃数）。
   */
  acquire(): T | null {
    if (this.strategy === 'recycle-oldest' && this.activeCount >= this.maxSize) {
      const oldest = this.acquisitionOrder.shift();
      if (oldest) oldest.active = false;
    }
    const item = this.items.find((i) => !i.active) ?? null;
    if (!item) return null;
    item.active = true;
    this.acquisitionOrder.push(item);
    return item;
  }

  /** 归还实例（不销毁，复用） */
  release(item: T): void {
    if (item.active) {
      item.active = false;
      const idx = this.acquisitionOrder.indexOf(item);
      if (idx >= 0) this.acquisitionOrder.splice(idx, 1);
    }
  }

  /** 只遍历 active 实例（避免 O(n) 全扫，ARCH §3.2） */
  eachActive(fn: (item: T) => void): void {
    for (const item of this.items) {
      if (item.active) fn(item);
    }
  }

  get activeCount(): number {
    let n = 0;
    for (const item of this.items) if (item.active) n += 1;
    return n;
  }
}

/** 池种类（对应 ARCH §3.2 池表 / 双端预算） */
export type PoolKind = 'enemies' | 'bullets' | 'gems';

/** 从 RuntimeConfig 读取对应池上限（唯一数据源，避免散落魔法数字） */
export function maxSizeFor(cfg: RuntimeConfig, kind: PoolKind): number {
  switch (kind) {
    case 'enemies':
      return cfg.maxEnemies;
    case 'bullets':
      return 8; // 子弹池双端一致（ARCH §3.2）
    case 'gems':
      return cfg.maxGems;
  }
}

/** Phaser Arcade 池适配器返回类型（E2+ 使用） */
export interface ArcadePoolLike<T extends Phaser.Physics.Arcade.Sprite> {
  readonly group: Phaser.Physics.Arcade.Group;
  readonly maxSize: number;
  acquire(x: number, y: number, texture?: string, frame?: string | number): T | null;
  release(obj: T): void;
  eachActive(fn: (obj: T) => void): void;
  readonly activeCount: number;
}

/**
 * 创建 Arcade.Group 对象池：maxSize 来自 RuntimeConfig（ARCH §3.3 / 性能预算 #1）。
 * 池满策略固定为 'reject'（生成器/武器层自带节流，对齐 ARCH §3.3 池满策略）。
 * E1 阶段无池化实体，此函数由 E2+ 调用。
 */
export function createArcadePool<T extends Phaser.Physics.Arcade.Sprite>(
  scene: Phaser.Scene,
  cfg: RuntimeConfig,
  kind: PoolKind,
  classType: new (scene: Phaser.Scene, x: number, y: number, texture?: string) => T,
): ArcadePoolLike<T> {
  const maxSize = maxSizeFor(cfg, kind);
  const group = scene.physics.add.group({
    classType,
    maxSize,
    runChildUpdate: false, // 统一在 PlayScene.update 遍历（ARCH §3.3）
  });

  const acquire = (x: number, y: number, texture?: string, frame?: string | number): T | null => {
    if (group.countActive(true) >= maxSize) return null; // reject 策略
    const sprite = group.get(x, y, texture, frame) as T | null;
    return sprite;
  };

  return {
    group,
    maxSize,
    acquire,
    release: (obj) => {
      // killAndHide 是 Group 方法；Sprite 上等价于 setActive(false)+setVisible(false)
      obj.setActive(false).setVisible(false);
      const body = obj.body as Phaser.Physics.Arcade.Body | null;
      body?.reset(obj.x, obj.y);
    },
    eachActive: (fn) => {
      group.getChildren().forEach((child) => {
        if (child.active) fn(child as T);
      });
    },
    get activeCount() {
      return group.countActive(true);
    },
  };
}
