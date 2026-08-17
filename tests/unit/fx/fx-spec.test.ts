import { describe, it, expect } from 'vitest';
import { DEATH_BURST, FX_COLORS } from '@/fx/fx-spec';
import { FX, PALETTE, type EnemyKindId } from '@/config/balance';

const ALL_KINDS: readonly EnemyKindId[] = ['zombie', 'wolf', 'tank', 'boss'];

describe('fx-spec 击杀溅射规格（TASK-28 美术表现力专项）', () => {
  it('覆盖全部 4 种敌人类型（普通 3 + Boss）', () => {
    for (const kind of ALL_KINDS) {
      expect(DEATH_BURST[kind]).toBeDefined();
    }
  });

  it('每种规格：帧名/颜色/数量/寿命 有效', () => {
    for (const kind of ALL_KINDS) {
      const s = DEATH_BURST[kind];
      expect(s.frame).toMatch(/^p-/);
      expect(s.colors.length).toBeGreaterThan(0);
      expect(s.count).toBeGreaterThan(0);
      expect(s.speed).toBeGreaterThan(0);
      expect(s.size).toBeGreaterThan(0);
      expect(s.life).toBeGreaterThan(0);
    }
  });

  it('单次溅射粒子数 ≤ 桌面粒子池预算 200（FX.PARTICLE_BUDGET）', () => {
    for (const kind of ALL_KINDS) {
      expect(DEATH_BURST[kind].count).toBeLessThanOrEqual(FX.PARTICLE_BUDGET);
    }
  });

  it('敌型分化：数量/形状/速度 至少一项不同（形状优先于颜色，色盲可辨）', () => {
    for (const aKind of ALL_KINDS) {
      for (const bKind of ALL_KINDS) {
        if (aKind === bKind) continue;
        const a = DEATH_BURST[aKind];
        const b = DEATH_BURST[bKind];
        const differ =
          a.frame !== b.frame || a.count !== b.count || a.speed !== b.speed || a.size !== b.size;
        expect(differ).toBe(true);
      }
    }
  });
});

describe('fx-spec 武器特效 P0 常量（TASK-36，参数全收敛位）', () => {
  it('FX_COLORS.paper 为 token 别名（白闪环用，无新色相）', () => {
    expect(FX_COLORS.paper).toBe(PALETTE.uiPaper);
  });

  it('飞弹拖尾帧为合法粒子帧（点→彗尾 p-streak）', () => {
    expect(FX.TRAIL_FRAME).toBe('p-streak');
  });

  it('飞弹命中反馈 ≤10 粒软上限（环 6 + 火花 4，8 发同帧命中 ≤80 池内兜底）', () => {
    expect(FX.MISSILE_IMPACT_RING_COUNT + FX.MISSILE_IMPACT_SPARK_COUNT).toBeLessThanOrEqual(10);
    expect(FX.MISSILE_IMPACT_RING_COUNT).toBe(6);
    expect(FX.MISSILE_IMPACT_SPARK_COUNT).toBe(4);
    expect(FX.MISSILE_LAUNCH_PUFF_COUNT).toBe(3);
  });

  it('冲击波涟漪桌面 ≤40（36 加密）/ 移动降档 ≤池余量（24）', () => {
    expect(FX.RIPPLE_COUNT).toBe(36);
    expect(FX.RIPPLE_COUNT).toBeLessThanOrEqual(40);
    expect(FX.RIPPLE_COUNT_MOBILE).toBe(24);
    expect(FX.RIPPLE_COUNT_MOBILE).toBeLessThan(FX.RIPPLE_COUNT);
    expect(FX.RIPPLE_SPEED).toBe(90);
    expect(FX.RIPPLE_SIZE).toBe(4);
  });

  it('冲击波白闪环 12 粒短命 0.18s；蓄力脉冲参数有效', () => {
    expect(FX.SHOCKWAVE_EDGE_FLASH_COUNT).toBe(12);
    expect(FX.SHOCKWAVE_EDGE_FLASH_LIFE).toBe(0.18);
    expect(FX.SHOCKWAVE_CHARGE_PULSE_LEAD_SECONDS).toBe(2);
    expect(FX.SHOCKWAVE_CHARGE_PULSE_RADIUS).toBeGreaterThan(0);
  });

  it('环绕球双层环/尾迹/命中火花常量有效（内外环半径差=OFFSET）', () => {
    expect(FX.ORBIT_RING_ALPHA).toBe(0.26);
    expect(FX.ORBIT_RING_SECONDARY_ALPHA).toBeLessThan(FX.ORBIT_RING_ALPHA);
    expect(FX.ORBIT_RING_SECONDARY_SPIN_DEG).toBeLessThan(0); // 反向
    expect(FX.ORBIT_TRAIL_INTERVAL_MS).toBeGreaterThan(0);
    expect(FX.ORBIT_HIT_THROTTLE_MS).toBeGreaterThan(0);
    expect(FX.ORBIT_HIT_SPARK_COUNT).toBeGreaterThan(0);
  });
});
