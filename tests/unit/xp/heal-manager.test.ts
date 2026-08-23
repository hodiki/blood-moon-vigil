import { describe, it, expect, vi } from 'vitest';
import { HEAL, HEROES } from '@/config/balance';
import { PlayerStats } from '@/player/player-stats';
import { GameEvents, GameEvent } from '@/core/events';
import {
  isHealDropSource,
  shouldDropHeal,
  healAmountForPickup,
  HealManager,
  type HealPoolLike,
  type HealPlayerLike,
  type HealTargetLike,
} from '@/xp/heal-manager';
import type { HealPickup } from '@/xp/heal-pickup';

/** 测试用假治疗目标（PlayerStats 结构性满足：hp/maxHp/boostedHealAmount） */
function makeTarget(hp: number, maxHp: number, boost = 1): HealTargetLike {
  return {
    hp,
    maxHp,
    boostedHealAmount: (base) => base * boost,
  };
}

function makePlayer(x = 0, y = 0): HealPlayerLike {
  return { x, y };
}

/** 测试用假治疗道具池（记录活跃拾取物；HealPickup 类型仅结构使用） */
function makePool(activePickups: Array<Partial<HealPickup> & { x: number; y: number; active: boolean; deactivate(): void; spawn(x: number, y: number): void }>): HealPoolLike {
  return {
    eachActive: (fn) => {
      for (const p of activePickups) if (p.active) fn(p as HealPickup);
    },
    acquire: () => null, // 掉落由 dropHeal 测试单独覆盖
  };
}

describe('治疗道具常量（merit-ui-spec §11 规格确认；占位预案改 HEAL 常量即可）', () => {
  it('HEAL 块：+30HP / 治疗绿 #43D17C / 掉落来源 elite-boss / 拾取半径 16px', () => {
    expect(HEAL.AMOUNT).toBe(30);
    expect(HEAL.COLOR).toBe('#43D17C'); // art-bible §2.4 青绿 token（绿=治疗语义）
    expect(HEAL.DROP_SOURCE).toBe('elite-boss'); // §11：精英/Boss 保底；普通怪不掉
    expect(HEAL.PICKUP_RADIUS).toBe(16);
  });
});

describe('isHealDropSource 掉落来源（merit-ui-spec §11：精英/Boss 保底，普通怪不掉）', () => {
  it('精英（tank）/Boss → 掉；普通 zombie/wolf → 不掉', () => {
    expect(isHealDropSource('tank')).toBe(true);  // 守墓者/血肉畸体/石甲狼（elite → runtime tank）
    expect(isHealDropSource('boss')).toBe(true);
    expect(isHealDropSource('zombie')).toBe(false);
    expect(isHealDropSource('wolf')).toBe(false);
    expect(isHealDropSource('')).toBe(false);
  });
});

describe('shouldDropHeal 掉率（M3 平衡模拟调整：精英 50% / Boss 保底 100%；merit-ui-spec §11 预案）', () => {
  it('Boss → 恒 true（保底 100%）；普通怪 → false', () => {
    expect(shouldDropHeal('boss', () => 0.99)).toBe(true);
    expect(shouldDropHeal('boss', () => 0)).toBe(true);
    expect(shouldDropHeal('zombie', () => 0)).toBe(false);
    expect(shouldDropHeal('wolf', () => 0)).toBe(false);
  });

  it('精英（tank）→ 按 HEAL.ELITE_DROP_CHANCE=0.5 随机判定（随机源注入确定性）', () => {
    expect(HEAL.ELITE_DROP_CHANCE).toBe(0.5);
    expect(shouldDropHeal('tank', () => 0.0)).toBe(true);  // 0 < 0.5 → 掉
    expect(shouldDropHeal('tank', () => 0.49)).toBe(true); // 0.49 < 0.5 → 掉
    expect(shouldDropHeal('tank', () => 0.5)).toBe(false); // 0.5 ≥ 0.5 → 不掉
    expect(shouldDropHeal('tank', () => 0.99)).toBe(false);
  });
});

describe('healAmountForPickup 治疗量（+30 上限钳制；修女被动 ×1.5 由 boostedHealAmount 承载）', () => {
  it('正常：70/100 HP 拾取 +30 → 治愈 30，不溢出', () => {
    expect(healAmountForPickup(30, 70, 100)).toBe(30);
  });

  it('上限钳制：85/100 HP 拾取 +30 → 只治愈 15（到 maxHp 为止）', () => {
    expect(healAmountForPickup(30, 85, 100)).toBe(15);
  });

  it('满血：100/100 → 0（无效拾取不产生治疗）', () => {
    expect(healAmountForPickup(30, 100, 100)).toBe(0);
    expect(healAmountForPickup(30, 100, 90)).toBe(0); // 异常 maxHp < hp 兜底
  });

  it('修女被动 ×1.5：30 → 45（boostedHealAmount 消费；PlayerStats.healBoostMultiplier）', () => {
    const violet = new PlayerStats(HEROES.hero_violet);
    expect(violet.boostedHealAmount(30)).toBe(45);
    const edmund = new PlayerStats(HEROES.hero_edmund);
    expect(edmund.boostedHealAmount(30)).toBe(30); // 无被动 ×1
  });
});

describe('HealManager 拾取流程（拾取 → 治疗应用 → emit HealCollected）', () => {
  it('拾取区内 → 应用治疗（含修女被动 ×1.5 钳制）并 emit；拾取后回收', () => {
    const target = makeTarget(40, 100, 1.5); // 修女：40 HP，拾取 45 → 85
    const p = { x: 5, y: 0, active: true, deactivate: vi.fn(), spawn: vi.fn() };
    const pool = makePool([p]);
    const manager = new HealManager(pool, makePlayer(0, 0), target);
    const onHeal = vi.fn();
    GameEvents.on(GameEvent.HealCollected, onHeal);
    manager.update(0.1);
    expect(target.hp).toBe(85); // 40 + 45（30×1.5 钳制到 100）
    expect(p.deactivate).toHaveBeenCalledTimes(1);
    expect(onHeal).toHaveBeenCalledTimes(1);
    const payload = onHeal.mock.calls[0]![0] as { amount: number; x: number; y: number };
    expect(payload.amount).toBe(45);
    GameEvents.off(GameEvent.HealCollected, onHeal);
  });

  it('拾取区内但满血 → 治疗 0，道具**保留地面不消失**（回血后再捡有效，§11）', () => {
    const target = makeTarget(100, 100, 1.5);
    const p = { x: 3, y: 0, active: true, deactivate: vi.fn(), spawn: vi.fn() };
    const pool = makePool([p]);
    const manager = new HealManager(pool, makePlayer(0, 0), target);
    const onHeal = vi.fn();
    GameEvents.on(GameEvent.HealCollected, onHeal);
    manager.update(0.1);
    expect(target.hp).toBe(100);
    expect(onHeal).not.toHaveBeenCalled(); // 满血不 emit（无治疗效果）
    expect(p.deactivate).not.toHaveBeenCalled(); // 保留地面
    GameEvents.off(GameEvent.HealCollected, onHeal);
  });

  it('拾取区外（>16px）→ 不治疗、不回收、不 emit（无磁吸，走位主动拾取）', () => {
    const target = makeTarget(50, 100);
    const p = { x: 50, y: 0, active: true, deactivate: vi.fn(), spawn: vi.fn() };
    const pool = makePool([p]);
    const manager = new HealManager(pool, makePlayer(0, 0), target);
    const onHeal = vi.fn();
    GameEvents.on(GameEvent.HealCollected, onHeal);
    manager.update(0.1);
    expect(target.hp).toBe(50);
    expect(p.deactivate).not.toHaveBeenCalled();
    expect(onHeal).not.toHaveBeenCalled();
    GameEvents.off(GameEvent.HealCollected, onHeal);
  });
});
