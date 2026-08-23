import { describe, it, expect } from 'vitest';
import { DESKTOP_CONFIG, MOBILE_CONFIG, getRuntimeConfig } from '@/config/runtime-config';

describe('RuntimeConfig 桌面配置快照（ARCH §4.2 / RV-C2）', () => {
  it('实体上限 400/200/300（含 M3 治疗道具池 48）', () => {
    expect(DESKTOP_CONFIG.maxEnemies).toBe(400);
    expect(DESKTOP_CONFIG.maxParticles).toBe(200);
    expect(DESKTOP_CONFIG.maxGems).toBe(300);
    expect(DESKTOP_CONFIG.maxHeals).toBe(48);
  });

  it('分辨率 1920×1080', () => {
    expect(DESKTOP_CONFIG.designWidth).toBe(1920);
    expect(DESKTOP_CONFIG.designHeight).toBe(1080);
  });

  it('开关矩阵：描边/震动/边缘红光全开', () => {
    expect(DESKTOP_CONFIG.outlineEnabled).toBe(true);
    expect(DESKTOP_CONFIG.screenShake).toBe(true);
    expect(DESKTOP_CONFIG.edgeWarning).toBe(true);
  });

  it('出生环带 [600,900]、死亡粒子在 8–16 范围内', () => {
    expect(DESKTOP_CONFIG.spawnRing).toEqual([600, 900]);
    expect(DESKTOP_CONFIG.particlePerDeath).toBeGreaterThanOrEqual(8);
    expect(DESKTOP_CONFIG.particlePerDeath).toBeLessThanOrEqual(16);
  });
});

describe('RuntimeConfig 移动配置快照（ARCH §4.2 / RV-C2 720×1280）', () => {
  it('实体上限 250/100/200（移动端削减；治疗道具池 32）', () => {
    expect(MOBILE_CONFIG.maxEnemies).toBe(250);
    expect(MOBILE_CONFIG.maxParticles).toBe(100);
    expect(MOBILE_CONFIG.maxGems).toBe(200);
    expect(MOBILE_CONFIG.maxHeals).toBe(32);
  });

  it('分辨率 720×1280（竖屏，最小实体 ≥16px 硬标准）', () => {
    expect(MOBILE_CONFIG.designWidth).toBe(720);
    expect(MOBILE_CONFIG.designHeight).toBe(1280);
  });

  it('开关矩阵：描边/震动/边缘红光全关（性能削减表）', () => {
    expect(MOBILE_CONFIG.outlineEnabled).toBe(false);
    expect(MOBILE_CONFIG.screenShake).toBe(false);
    expect(MOBILE_CONFIG.edgeWarning).toBe(false);
  });

  it('出生环带 [500,800]、死亡粒子 8', () => {
    expect(MOBILE_CONFIG.spawnRing).toEqual([500, 800]);
    expect(MOBILE_CONFIG.particlePerDeath).toBe(8);
  });
});

describe('getRuntimeConfig 选择与只读性', () => {
  it('按 isMobile 返回对应配置', () => {
    expect(getRuntimeConfig(true)).toBe(MOBILE_CONFIG);
    expect(getRuntimeConfig(false)).toBe(DESKTOP_CONFIG);
  });

  it('运行期只读（Object.freeze 硬约束，ARCH §4.2）', () => {
    expect(Object.isFrozen(DESKTOP_CONFIG)).toBe(true);
    expect(Object.isFrozen(MOBILE_CONFIG)).toBe(true);
    expect(Object.isFrozen(DESKTOP_CONFIG.spawnRing)).toBe(true);
  });
});
