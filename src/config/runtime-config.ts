/**
 * config/runtime-config.ts —— 双端运行时开关（ARCH §4.2/§4.3）
 *
 * 唯一差异源头：所有系统只读 RuntimeConfig，禁止散落 `isMobile ? ... : ...`。
 * 平台检测在 main.ts 最先执行，写入本模块；运行期只读（不修改）。
 *
 * 值来源：
 * - 实体上限 400/250、粒子 200/100、宝石 300/200（concept §8 / ARCH §3.2 池表）
 * - 分辨率 1920×1080 / 720×1280（art-bible §8 双分辨率定案 / RV-C2）
 * - 开关矩阵：描边/震动/边缘红光/出生环带（concept §8 / art-bible §7 / spawner §7）
 */

export interface RuntimeConfig {
  readonly isMobile: boolean;
  readonly maxEnemies: number; // 400 / 250
  readonly maxParticles: number; // 200 / 100
  readonly maxGems: number; // 300 / 200
  readonly outlineEnabled: boolean; // 描边：桌面 true / 移动 false
  readonly screenShake: boolean; // 震动：桌面 true / 移动 false
  readonly edgeWarning: boolean; // 边缘红光呼吸：桌面 true / 移动 false
  readonly spawnRing: readonly [number, number]; // 出生环带：桌面 [600,900] / 移动 [500,800]
  readonly particlePerDeath: number; // 死亡粒子：桌面 8–16 / 移动 8
  readonly designWidth: number; // 桌面 1920 / 移动 720
  readonly designHeight: number; // 桌面 1080 / 移动 1280
}

export const DESKTOP_CONFIG: RuntimeConfig = Object.freeze({
  isMobile: false,
  maxEnemies: 400,
  maxParticles: 200,
  maxGems: 300,
  outlineEnabled: true,
  screenShake: true,
  edgeWarning: true,
  spawnRing: Object.freeze([600, 900] as const),
  particlePerDeath: 12,
  designWidth: 1920,
  designHeight: 1080,
});

export const MOBILE_CONFIG: RuntimeConfig = Object.freeze({
  isMobile: true,
  maxEnemies: 250,
  maxParticles: 100,
  maxGems: 200,
  outlineEnabled: false,
  screenShake: false,
  edgeWarning: false,
  spawnRing: Object.freeze([500, 800] as const),
  particlePerDeath: 8,
  designWidth: 720,
  designHeight: 1280,
});

export function getRuntimeConfig(isMobile: boolean): RuntimeConfig {
  return isMobile ? MOBILE_CONFIG : DESKTOP_CONFIG;
}
