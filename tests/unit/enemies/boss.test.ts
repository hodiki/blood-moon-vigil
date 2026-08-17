import { describe, it, expect } from 'vitest';
import { BOSS, ENEMIES, PALETTE } from '@/config/balance';
import { bossGraceEndsAt, isBossInGrace } from '@/enemies/boss-math';

/**
 * E4-S2 Boss「血月尊者」：面板 / 体型 / 猩红金 / 0.5s 霸体（纯逻辑层）。
 * Boss 实体类（extends Enemy，Phaser Sprite）不做 node 单测 —— 渲染行为由 L2 冒烟覆盖；
 * 可脱离 Phaser 的机制纯函数在本文件断言。
 */

describe('Boss 面板与 GDD 一致（E8-1 全表，实体接入后仍锚定）', () => {
  it('血月尊者 6000HP/28px/s/30伤/2.0s/40px/100经验', () => {
    expect(ENEMIES.boss).toEqual({ hp: 6000, speed: 28, damage: 30, attackInterval: 2.0, radius: 40, xp: 100 });
  });

  it('Boss 死亡掉落 100 经验（E8-3）', () => {
    expect(ENEMIES.boss.xp).toBe(100);
  });
});

describe('Boss 视觉规格（art-bible §4：≥3x 体型 + 猩红金）', () => {
  it('体型 ≥3x 玩家（玩家 32px → Boss ≥96px）且 ≤ 屏高 1/4（桌面 270 / 移动 320）', () => {
    expect(BOSS.TEXTURE_SIZE).toBeGreaterThanOrEqual(3 * 32);
    expect(BOSS.TEXTURE_SIZE).toBeLessThanOrEqual(1080 / 4); // 桌面 1920×1080
    expect(BOSS.TEXTURE_SIZE).toBeLessThanOrEqual(1280 / 4); // 移动 720×1280
    expect(BOSS.TEXTURE_SIZE).toBe(120);
  });

  it('猩红金 #FF3B3B + #FFC93C（art-bible §2/§4），与色板 token 一致', () => {
    expect(BOSS.COLOR_MAIN).toBe('#FF3B3B');
    expect(BOSS.COLOR_GOLD).toBe('#FFC93C');
    expect(PALETTE.enemyBoss).toBe(BOSS.COLOR_MAIN);
  });

  it('顶部 UI 血条宽度：桌面 60% / 移动 50%（E8 §⑦）', () => {
    expect(BOSS.HP_BAR_WIDTH_DESKTOP).toBe(0.6);
    expect(BOSS.HP_BAR_WIDTH_MOBILE).toBe(0.5);
  });
});

describe('Boss 0.5s 霸体（enemies §⑥.5 / art-bible §4：出场 0.5s 霸体闪红，期内不承伤）', () => {
  it('GRACE_SECONDS = 0.5s', () => {
    expect(BOSS.GRACE_SECONDS).toBe(0.5);
  });

  it('bossGraceEndsAt = now + 0.5', () => {
    expect(bossGraceEndsAt(1000)).toBe(1000.5);
  });

  it('isBossInGrace：期内 true，期满 false', () => {
    expect(isBossInGrace(1000.0, 1000.5)).toBe(true);
    expect(isBossInGrace(1000.49, 1000.5)).toBe(true);
    expect(isBossInGrace(1000.5, 1000.5)).toBe(false);
    expect(isBossInGrace(1000.51, 1000.5)).toBe(false);
  });
});
