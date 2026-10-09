import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RelicDirector } from '@/relics/relic-runtime';
import { RELIC_RULES } from '@/config/balance';

/**
 * P0-1 口径 B（主理人裁决）：圣物保底渠道 =「血月化身优先 + 地图 Boss 兜底」。
 * 两渠道**共用同一 hasGuaranteedDrop 闸门**（先到先得），保住红线每局保底 1 枚；
 * 化身成为更早的更优渠道，地图 Boss 为兜底（no-op）。
 * RelicDirector 可脱离 Phaser 单测。
 */
describe('口径 B 圣物保底渠道：化身优先 + 地图 Boss 兜底（共用闸门）', () => {
  it('红线常量：GUARANTEED_PER_RUN = 1', () => {
    expect(RELIC_RULES.GUARANTEED_PER_RUN).toBe(1);
  });

  it('化身先发 → 地图 Boss 再发为 no-op（先到先得，每局至多 1 枚）', () => {
    const d = new RelicDirector(() => 0);
    const avatar = d.grantBossGuaranteed(); // 化身出场渠道
    expect(avatar).not.toBeNull();
    const boss = d.grantBossGuaranteed(); // 6:00 地图 Boss 渠道（同一闸门）
    expect(boss).toBeNull();
    expect(d.owned).toEqual([avatar]);
  });

  it('地图 Boss 先发 → 化身再发为 no-op（兜底语义对称）', () => {
    const d = new RelicDirector(() => 0);
    const boss = d.grantBossGuaranteed();
    expect(boss).not.toBeNull();
    expect(d.grantBossGuaranteed()).toBeNull();
    expect(d.owned).toHaveLength(1);
  });

  it('连续多次调用仅首枚生效（幂等闸门）', () => {
    const d = new RelicDirector(() => 0);
    expect(d.grantBossGuaranteed()).not.toBeNull();
    for (let i = 0; i < 5; i += 1) expect(d.grantBossGuaranteed()).toBeNull();
    expect(d.owned).toHaveLength(1);
  });
});

describe('口径 B 接线守卫：出场渠道三处调用在位（化身优先 + Boss 出场/击杀兜底）', () => {
  const s = readFileSync(
    fileURLToPath(new URL('../../../src/scenes/PlayScene.ts', import.meta.url)),
    'utf-8',
  );

  it('grantBossGuaranteed 调用 ≥3 处（化身出场 + 地图 Boss 出场 + 击杀兜底）', () => {
    expect((s.match(/grantBossGuaranteed\(\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it('化身入场块内接入圣物发牌 + HUD 同步', () => {
    const body = s.slice(s.indexOf('private spawnAvatar('));
    const end = body.indexOf('private spawnBoss(');
    const spawnAvatar = body.slice(0, end > 0 ? end : 1600);
    expect(spawnAvatar).toMatch(/grantBossGuaranteed\(\)[\s\S]{0,80}syncRelicHud\(now\)/);
  });
});
