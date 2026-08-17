import { describe, it, expect } from 'vitest';
import { GameEvent } from '@/core/events';
import {
  createInitialHudState,
  reduceHudState,
  xpFillFraction,
  hpFillFraction,
  bossFillFraction,
} from '@/ui/hud-state';
import { needXp } from '@/xp/xp-manager';
import { formatSeconds } from '@/ui/results-overlay';

/**
 * E4-S1 HUD 事件流（ARCH §3.4 / ADR-004 单向数据流）：
 * 纯归约器单测 —— 事件 → HUD 显示状态，机械可判定。
 */

describe('HUD 状态归约器（E4-S1 事件流）', () => {
  it('初始：LV1 / 0xp / needXp(1)=5 / HP 100/100 / 仅飞弹可用 / 无 Boss', () => {
    const s = createInitialHudState();
    expect(s.level).toBe(1);
    expect(s.xp).toBe(0);
    expect(s.xpNeeded).toBe(needXp(1));
    expect(s.hp).toBe(100);
    expect(s.maxHp).toBe(100);
    expect(s.weapons).toEqual({ missile: true, orbit: false, shockwave: false });
    expect(s.bossHp).toBeNull();
  });

  it('xp:gem-collected 累计经验 → 经验条填充上升', () => {
    let s = createInitialHudState();
    s = reduceHudState(s, GameEvent.GemCollected, { amount: 3 });
    expect(s.xp).toBe(3);
    expect(xpFillFraction(s)).toBeCloseTo(3 / 5, 6);
    s = reduceHudState(s, GameEvent.GemCollected, { amount: 2 });
    expect(xpFillFraction(s)).toBe(1); // 满条（升级由 level:up 归零）
  });

  it('level:up 更新等级并归零经验条（xpNeeded 取 payload）', () => {
    let s = createInitialHudState();
    s = reduceHudState(s, GameEvent.GemCollected, { amount: 7 });
    s = reduceHudState(s, GameEvent.LevelUp, { level: 2, xpNeeded: needXp(2) });
    expect(s.level).toBe(2);
    expect(s.xp).toBe(0);
    expect(s.xpNeeded).toBe(needXp(2));
  });

  it('hp:changed 更新 HP 条与数值（含 maxHp 变化）', () => {
    let s = createInitialHudState();
    s = reduceHudState(s, GameEvent.HpChanged, { hp: 60, maxHp: 120 });
    expect(s.hp).toBe(60);
    expect(s.maxHp).toBe(120);
    expect(hpFillFraction(s)).toBeCloseTo(0.5, 6);
  });

  it('weapon:unlocked 点亮对应武器槽（1=环 / 2=波；其他 id 忽略）', () => {
    let s = createInitialHudState();
    s = reduceHudState(s, GameEvent.WeaponUnlocked, { weaponId: 1 });
    expect(s.weapons.orbit).toBe(true);
    s = reduceHudState(s, GameEvent.WeaponUnlocked, { weaponId: 2 });
    expect(s.weapons.shockwave).toBe(true);
    s = reduceHudState(s, GameEvent.WeaponUnlocked, { weaponId: 99 });
    expect(s.weapons).toEqual({ missile: true, orbit: true, shockwave: true });
  });

  it('boss:spawned 显示 Boss 血条；boss:hp 更新填充；boss:defeated/game:over 隐藏', () => {
    let s = createInitialHudState();
    s = reduceHudState(s, GameEvent.BossSpawned, { bossHp: 6000 });
    expect(s.bossHp).toBe(6000);
    expect(s.bossMaxHp).toBe(6000);
    expect(bossFillFraction(s)).toBe(1);
    s = reduceHudState(s, GameEvent.BossHpChanged, { hp: 3000, maxHp: 6000 });
    expect(bossFillFraction(s)).toBeCloseTo(0.5, 6);
    s = reduceHudState(s, GameEvent.BossDefeated, { bossHp: 0 });
    expect(s.bossHp).toBeNull();
    s = reduceHudState(s, GameEvent.BossSpawned, { bossHp: 6000 });
    s = reduceHudState(s, GameEvent.GameOver, { stats: {} });
    expect(s.bossHp).toBeNull();
  });

  it('未知事件原样返回（幂等，不破坏状态）', () => {
    const s = createInitialHudState();
    expect(reduceHudState(s, 'unknown:event', {})).toBe(s);
  });
});

describe('结算页时长格式化（E4-S4 / ux-spec §4「存活时间」）', () => {
  it('秒 → M:SS（20:00 收束 = "20:00"；超 1 分钟补零）', () => {
    expect(formatSeconds(0)).toBe('0:00');
    expect(formatSeconds(59.4)).toBe('0:59');
    expect(formatSeconds(59.6)).toBe('1:00'); // 四舍五入到秒
    expect(formatSeconds(1200)).toBe('20:00');
    expect(formatSeconds(65)).toBe('1:05');
  });
});
