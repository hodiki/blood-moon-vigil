import { describe, it, expect } from 'vitest';
import { needXp, cumulativeXpToReach, stepGem, XpManager, type GemLike, type GemPoolLike } from '@/xp/xp-manager';
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

describe('宝石磁吸/拾取 stepGem（E3-S1；TASK-39 R1 波次2 磁吸 80→140 + E-lite 漂移）', () => {
  const NO_DRIFT = { ageSeconds: 0, ageThreshold: 3, driftSpeed: 80 };

  it('距离 > 磁吸半径 140px 且未到漂移年龄 → idle（不吸附、不漂移）', () => {
    const gem: GemLike = { x: 0, y: 0 };
    expect(stepGem(gem, { x: 200, y: 0 }, 0.1, GEM.MAGNET_RADIUS, GEM.MAGNET_SPEED, GEM.PICKUP_RADIUS, NO_DRIFT)).toBe('idle');
    expect(gem.x).toBe(0);
  });

  it('距离 ≤ 拾取半径 16px → collected（拾取，位置不变）', () => {
    const gem: GemLike = { x: 0, y: 0 };
    expect(stepGem(gem, { x: 10, y: 0 }, 0.1, GEM.MAGNET_RADIUS, GEM.MAGNET_SPEED, GEM.PICKUP_RADIUS, NO_DRIFT)).toBe('collected');
    expect(gem.x).toBe(0);
  });

  it('磁吸内 → moving 且以 360px/s 向玩家靠近（140px 磁吸）', () => {
    const gem: GemLike = { x: 0, y: 0 };
    const r = stepGem(gem, { x: 50, y: 0 }, 0.1, GEM.MAGNET_RADIUS, GEM.MAGNET_SPEED, GEM.PICKUP_RADIUS, NO_DRIFT);
    expect(r).toBe('moving');
    expect(gem.x).toBeCloseTo(36, 6); // 360px/s × 0.1s
  });

  it('升级磁力 +100% 后磁吸半径 280px（upgrade-pool 第 9 项；140→280→420 不贬值）', () => {
    const gem: GemLike = { x: 0, y: 0 };
    expect(stepGem(gem, { x: 200, y: 0 }, 0.1, 280, GEM.MAGNET_SPEED, GEM.PICKUP_RADIUS, NO_DRIFT)).toBe('moving');
  });

  it('E-lite 滞留漂移：落地 ≥3s 且距玩家 >磁吸半径 → 以 80px/s 慢漂向玩家（drifting）', () => {
    const gem: GemLike = { x: 0, y: 0 };
    const r = stepGem(gem, { x: 300, y: 0 }, 1.0, GEM.MAGNET_RADIUS, GEM.MAGNET_SPEED, GEM.PICKUP_RADIUS, {
      ageSeconds: 5,
      ageThreshold: 3,
      driftSpeed: 80,
    });
    expect(r).toBe('drifting');
    expect(gem.x).toBeCloseTo(80, 6); // 80px/s × 1.0s（仍 > 磁吸半径 → 下帧继续漂/进磁吸）
  });

  it('E-lite 漂移不越界：单步 ≤ 剩余距离（距玩家 200 > 磁吸 140，1 步上限 min(200, 80×10)=200，停在玩家处不越过）', () => {
    const gem: GemLike = { x: 0, y: 0 };
    const r = stepGem(gem, { x: 200, y: 0 }, 10, 140, GEM.MAGNET_SPEED, GEM.PICKUP_RADIUS, {
      ageSeconds: 9,
      ageThreshold: 3,
      driftSpeed: 80,
    });
    expect(r).toBe('drifting');
    expect(gem.x).toBeCloseTo(200, 6); // step = min(200, 800) = 200，不越过玩家
  });

  it('E-lite 漂移关闭（未传 drift）或未到年龄 → 保持 idle（不免费全屏拾取）', () => {
    const gem: GemLike = { x: 0, y: 0 };
    // 未传 drift
    expect(stepGem(gem, { x: 300, y: 0 }, 1.0, GEM.MAGNET_RADIUS, GEM.MAGNET_SPEED, GEM.PICKUP_RADIUS)).toBe('idle');
    // 年龄未到
    expect(
      stepGem(gem, { x: 300, y: 0 }, 1.0, GEM.MAGNET_RADIUS, GEM.MAGNET_SPEED, GEM.PICKUP_RADIUS, {
        ageSeconds: 2,
        ageThreshold: 3,
        driftSpeed: 80,
      }),
    ).toBe('idle');
    expect(gem.x).toBe(0);
  });
});

describe('XpManager 经验累计与升级消费（E3-S1/S2）', () => {
  const makeManager = (): XpManager => {
    const pool = { eachActive: () => {}, acquire: () => null };
    return new XpManager(pool, { x: 0, y: 0 });
  };

  it('初始等级 1、经验 0、磁吸半径 140px', () => {
    const m = makeManager();
    expect(m.level).toBe(1);
    expect(m.xp).toBe(0);
    expect(m.magnetRadius).toBe(GEM.MAGNET_RADIUS);
  });

  it('磁力升级：×2 → 280px、×3 → 420px（upgrade-pool 第 9 项；140 基线）', () => {
    const m = makeManager();
    m.setMagnetMultiplier(2);
    expect(m.magnetRadius).toBe(280);
    m.setMagnetMultiplier(3);
    expect(m.magnetRadius).toBe(420);
  });

  it('E-lite 漂移集成：XpManager.update 累加 gem.age，远宝石落地 3s 后以 80px/s 慢漂向玩家', () => {
    // 假宝石（XpGem 最小形状：age/x/y/xpValue/deactivate）
    const gem = {
      age: 0,
      xpValue: 1,
      x: 400,
      y: 0,
      deactivateCalls: 0,
      deactivate() {
        this.deactivateCalls += 1;
      },
    };
    const pool = {
      eachActive: (fn: (g: typeof gem) => void) => fn(gem),
      acquire: () => null,
    } as unknown as GemPoolLike;
    const m = new XpManager(pool, { x: 0, y: 0 });
    // 前 2s（age<3）→ idle，x 不变
    m.update(1);
    m.update(1);
    expect(gem.age).toBe(2);
    expect(gem.x).toBe(400);
    // 第 3s 起 → 开始漂移（每 1s 80px/s）
    m.update(1); // age 3 → x=320
    m.update(1); // age 4 → x=240
    m.update(1); // age 5 → x=160（仍 > 磁吸 140 → 继续漂）
    expect(gem.age).toBe(5);
    expect(gem.x).toBeCloseTo(160, 6);
    expect(gem.deactivateCalls).toBe(0); // 尚未拾取
    // 第 6s → x=80 进入磁吸半径 → 磁吸 360px/s 拉入玩家处（moving，尚未拾取）
    m.update(1);
    expect(gem.x).toBeCloseTo(80, 6);
    // 磁吸内：dist=80 ≤ 140 → 磁吸 step=min(80,360)=80 → x=0（结果 moving，非 collected）
    m.update(1);
    expect(gem.x).toBe(0);
    expect(gem.deactivateCalls).toBe(0);
    // 下一帧 dist=0 ≤ 拾取半径 → collected → deactivate
    m.update(1);
    expect(gem.deactivateCalls).toBe(1);
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
