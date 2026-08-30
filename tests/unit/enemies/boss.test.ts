import { describe, it, expect } from 'vitest';
import {
  BOSS,
  BOSSES,
  BOSS_FIGHT,
  MOON_AVATAR,
  ENEMY_CONFIGS,
  PALETTE,
  GAME,
} from '@/config/balance';
import { ENEMIES } from '@/../src/_archived/enemies-legacy-panel'; // W-8 收档：legacy 面板归档对照（禁止运行时消费）
import {
  bossGraceEndsAt,
  isBossInGrace,
  bossPhaseFor,
  bossPhaseGraceEndsAt,
  isBossPhaseGrace,
  bossPhase2Summon,
  moonAvatarTriggerDue,
  bossFightSeconds,
  neroEffectiveHp,
} from '@/enemies/boss-math';

/**
 * E4-S2 Boss「血月尊者」：面板 / 体型 / 猩红金 / 0.5s 霸体（纯逻辑层）。
 * Boss 实体类（extends Enemy，Phaser Sprite）不做 node 单测 —— 渲染行为由 L2 冒烟覆盖；
 * 可脱离 Phaser 的机制纯函数在本文件断言。
 */

describe('Boss 面板与 GDD 一致（E8-1 全表，实体接入后仍锚定；TASK-31 收尾 HP 6000→4000）', () => {
  it('血月尊者 4000HP/28px/s/30伤/2.0s/40px/100经验', () => {
    expect(ENEMIES.boss).toEqual({ hp: 4000, speed: 28, damage: 30, attackInterval: 2.0, radius: 40, xp: 100 });
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

describe('E3-S5 Boss 阶段机制（gdd-enemies-v2 §3.4 / §⑥.9）', () => {
  it('阶段 2 判定：HP<50% 进入阶段 2，≥50% 阶段 1（§3.4 严格小于）', () => {
    expect(bossPhaseFor(3000, 4500)).toBe(1); // 66.7%
    expect(bossPhaseFor(2250, 4500)).toBe(1); // 恰 50% 不触发（严格 < 50%）
    expect(bossPhaseFor(2249.99, 4500)).toBe(2);
    expect(bossPhaseFor(0, 4500)).toBe(2);
  });

  it('阶段切换 1s 霸体（§⑥.9 防卡阶段秒杀；bossPhaseGraceEndsAt = now + 1s）', () => {
    expect(BOSS_FIGHT.PHASE_SWITCH_GRACE_SECONDS).toBe(1);
    expect(bossPhaseGraceEndsAt(1000)).toBe(1001);
    expect(isBossPhaseGrace(1000.5, 1001)).toBe(true);
    expect(isBossPhaseGrace(1001, 1001)).toBe(false);
  });

  it('阶段 2 召唤：尼禄 → 2 圣杯侍僧；芬里厄 → 2 灰狼；基准/化身无召唤', () => {
    expect(bossPhase2Summon('boss_2')).toEqual({ summonedId: 'enemy_g2_3', count: 2 });
    expect(bossPhase2Summon('boss_3')).toEqual({ summonedId: 'enemy_g3_1', count: 2 });
    expect(bossPhase2Summon('boss_1')).toBeNull();
    expect(bossPhase2Summon('boss_4')).toBeNull();
    expect(ENEMY_CONFIGS.enemy_g2_3.name).toBe('圣杯侍僧');
  });

  it('血月化身月坠：4:30(270s) 后 5%/次判定；未到 4:30 不触发；已触发由调用方 once 保证（§⑥.10）', () => {
    expect(MOON_AVATAR.AFTER_SECONDS).toBe(270);
    expect(MOON_AVATAR.TRIGGER_CHANCE).toBe(0.05);
    expect(MOON_AVATAR.WARNING_SECONDS).toBe(2);
    expect(moonAvatarTriggerDue(270, 0.02)).toBe(true);
    expect(moonAvatarTriggerDue(270, 0.049)).toBe(true);
    expect(moonAvatarTriggerDue(270, 0.05)).toBe(false);
    expect(moonAvatarTriggerDue(360, 0.1)).toBe(false);
    expect(moonAvatarTriggerDue(269.9, 0.0)).toBe(false);
  });
});

describe('E3-S5/S10 Boss 战时长判据 60~90s（sim-verify §7 / gdd-enemies §3.4；埋点 bossFightSeconds）', () => {
  const MID_DPS = 76.1; // 守夜人 6 分钟成型（sim-verify §4，倍率 2.34）
  const CONSERVATIVE_DPS = 55; // 保守 build（低 roll，sim-verify §7）

  it('中位口径：三收束 Boss 战 61.8/69.6/64.9s，全部落 [60,90]（实战折减 ×0.85）', () => {
    const t1 = bossFightSeconds(BOSSES.boss_1.hp, MID_DPS);
    const t2 = bossFightSeconds(BOSSES.boss_2.hp, MID_DPS);
    const t3 = bossFightSeconds(BOSSES.boss_3.hp, MID_DPS);
    expect(t1).toBeCloseTo(61.8, 1);
    expect(t2).toBeCloseTo(69.6, 1);
    expect(t3).toBeCloseTo(64.9, 1);
    for (const t of [t1, t2, t3]) {
      expect(t).toBeGreaterThanOrEqual(GAME.BOSS_FIGHT_TARGET_MIN);
      expect(t).toBeLessThanOrEqual(GAME.BOSS_FIGHT_TARGET_MAX);
    }
  });

  it('血月化身 3000HP → 46.4s：稀有奖励 Boss 有意偏差（45~60s，非进度门，§3.4 注）', () => {
    const t = bossFightSeconds(BOSSES.boss_4.hp, MID_DPS);
    expect(t).toBeCloseTo(46.4, 1);
    expect(t).toBeLessThan(GAME.BOSS_FIGHT_TARGET_MIN); // 短战为有意设计
  });

  it('保守口径：尊者 ~85.6s / 芬里厄 ~89.8s 贴上限 ✔；尼禄 ~96.3s 超 90s（R2 风险）', () => {
    const t1 = bossFightSeconds(BOSSES.boss_1.hp, CONSERVATIVE_DPS);
    const t3 = bossFightSeconds(BOSSES.boss_3.hp, CONSERVATIVE_DPS);
    const t2 = bossFightSeconds(BOSSES.boss_2.hp, CONSERVATIVE_DPS);
    expect(t1).toBeGreaterThan(85);
    expect(t1).toBeLessThan(86);
    expect(t3).toBeGreaterThan(89.5);
    expect(t3).toBeLessThan(90);
    expect(t1).toBeLessThanOrEqual(GAME.BOSS_FIGHT_TARGET_MAX);
    expect(t3).toBeLessThanOrEqual(GAME.BOSS_FIGHT_TARGET_MAX);
    expect(t2).toBeGreaterThan(96);
    expect(t2).toBeGreaterThan(GAME.BOSS_FIGHT_TARGET_MAX); // 96.3s 超限 → R2 预案
  });

  it('R2 预案开关：默认按 GDD 4500 生效；开启后 HP 4500→4300 战时长下降（真机复测确认超限后主理人批准）', () => {
    expect(BOSS_FIGHT.NERO_HP_FALLBACK).toBe(4300);
    expect(BOSS_FIGHT.NERO_HP_FALLBACK_ENABLED).toBe(false); // 先按 4500 实现，留开关
    expect(neroEffectiveHp()).toBe(4500);
    const tDefault = bossFightSeconds(neroEffectiveHp(), CONSERVATIVE_DPS);
    // 模拟开关开启（测试内临时改常量不可行，直接验证 4300 数值路径）
    const tFallback = bossFightSeconds(BOSS_FIGHT.NERO_HP_FALLBACK, CONSERVATIVE_DPS);
    expect(tFallback).toBeLessThan(tDefault);
    expect(BOSSES.boss_2.hp).toBe(4500); // 表保持 GDD 值
  });

  it('实战折减常量 0.85（sim-verify §1 中位口径）', () => {
    expect(BOSS_FIGHT.PRACTICAL_FACTOR).toBe(0.85);
  });
});
