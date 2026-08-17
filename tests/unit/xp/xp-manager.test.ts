import { describe, it, expect } from 'vitest';
import { needXp, cumulativeXpToReach, stepGem, XpManager, type GemLike } from '@/xp/xp-manager';
import { GameEvents, GameEvent } from '@/core/events';
import { XP, GEM } from '@/config/balance';

describe('need(n) 升级曲线（upgrade-pool §③ / E3-S1）', () => {
  it('need(1)=5, need(2)=8, need(3)=11（序列 5,8,11…）', () => {
    expect(needXp(1)).toBe(5);
    expect(needXp(2)).toBe(8);
    expect(needXp(3)).toBe(11);
    expect(needXp(30)).toBe(92); // 5 + 3×29
  });

  it('Lv30 累计 1363 点（不含第 30 级）/ 含第 30 级 1455（口径与 epics/design-review 一致）', () => {
    expect(cumulativeXpToReach(30)).toBe(1363);
    expect(cumulativeXpToReach(31)).toBe(1455);
  });
});

describe('宝石磁吸/拾取 stepGem（E3-S1）', () => {
  it('距离 > 磁吸半径 80px → idle（不吸附）', () => {
    const gem: GemLike = { x: 0, y: 0 };
    expect(stepGem(gem, { x: 90, y: 0 }, 0.1, GEM.MAGNET_RADIUS, GEM.MAGNET_SPEED, GEM.PICKUP_RADIUS)).toBe('idle');
    expect(gem.x).toBe(0);
  });

  it('距离 ≤ 拾取半径 16px → collected（拾取，位置不变）', () => {
    const gem: GemLike = { x: 0, y: 0 };
    expect(stepGem(gem, { x: 10, y: 0 }, 0.1, GEM.MAGNET_RADIUS, GEM.MAGNET_SPEED, GEM.PICKUP_RADIUS)).toBe('collected');
    expect(gem.x).toBe(0);
  });

  it('磁吸内 → moving 且以 320px/s 向玩家靠近（80px 磁吸）', () => {
    const gem: GemLike = { x: 0, y: 0 };
    const r = stepGem(gem, { x: 50, y: 0 }, 0.1, GEM.MAGNET_RADIUS, GEM.MAGNET_SPEED, GEM.PICKUP_RADIUS);
    expect(r).toBe('moving');
    expect(gem.x).toBeCloseTo(32, 6); // 320px/s × 0.1s
  });

  it('升级磁力 +100% 后磁吸半径 160px（upgrade-pool 第 9 项）', () => {
    const gem: GemLike = { x: 0, y: 0 };
    expect(stepGem(gem, { x: 150, y: 0 }, 0.1, 160, GEM.MAGNET_SPEED, GEM.PICKUP_RADIUS)).toBe('moving');
  });
});

describe('XpManager 经验累计与升级消费（E3-S1/S2）', () => {
  const makeManager = (): XpManager => {
    const pool = { eachActive: () => {}, acquire: () => null };
    return new XpManager(pool, { x: 0, y: 0 });
  };

  it('初始等级 1、经验 0、磁吸半径 80px', () => {
    const m = makeManager();
    expect(m.level).toBe(1);
    expect(m.xp).toBe(0);
    expect(m.magnetRadius).toBe(GEM.MAGNET_RADIUS);
  });

  it('磁力升级：×2 → 160px、×3 → 240px（upgrade-pool 第 9 项）', () => {
    const m = makeManager();
    m.setMagnetMultiplier(2);
    expect(m.magnetRadius).toBe(160);
    m.setMagnetMultiplier(3);
    expect(m.magnetRadius).toBe(240);
  });

  it('addXp 跨阈值升级：5 点 → Lv2，need(2)=8', () => {
    const m = makeManager();
    const ups = m.addXp(5);
    expect(ups).toBe(1);
    expect(m.level).toBe(2);
    expect(m.xp).toBe(0);
  });

  it('大额宝石一次连升（1363 点 → Lv30）且挂起升级逐个消费', () => {
    const m = makeManager();
    const ups = m.addXp(1363);
    expect(ups).toBe(29);
    expect(m.level).toBe(30);

    let levelUpCount = 0;
    const listener = () => {
      levelUpCount += 1;
    };
    GameEvents.on(GameEvent.LevelUp, listener);
    try {
      let consumed = 0;
      while (m.consumePendingLevelUp()) consumed += 1;
      expect(consumed).toBe(29);
      expect(levelUpCount).toBe(29);
      expect(m.consumePendingLevelUp()).toBe(false); // 消费完
    } finally {
      GameEvents.off(GameEvent.LevelUp, listener);
    }
  });

  it('等级上限防死循环（XP.MAX_LEVEL）', () => {
    const m = makeManager();
    m.addXp(1_000_000);
    expect(m.level).toBeLessThanOrEqual(XP.MAX_LEVEL);
  });
});
