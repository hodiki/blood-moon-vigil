import { describe, it, expect } from 'vitest';
import { DEATH_BURST, FX_COLORS, SPECIAL_MARKERS } from '@/fx/fx-spec';
import { FX, PALETTE, type EnemyKindId } from '@/config/balance';
import { FRAME_BY_CONTENT_ID } from '@/config/frame-registry';

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

describe('E3-S9 特殊行为标记 5 类规格（gdd-enemies §4.2 / asset-spec §2.6；预算 1 Image/怪）', () => {
  it('5 类标记齐全：幽紫光环/相位残影/蓄力红警告线/头顶符文/投射红色预警', () => {
    expect(SPECIAL_MARKERS.aura).toBeDefined();
    expect(SPECIAL_MARKERS.phase).toBeDefined();
    expect(SPECIAL_MARKERS.warningline).toBeDefined();
    expect(SPECIAL_MARKERS.rune).toBeDefined();
    expect(SPECIAL_MARKERS.ranged).toBeDefined();
  });

  it('幽紫光环：脚下 40~48px 幽紫 #B06AF0 α0.30 呼吸 1s（GDD §4.2）', () => {
    expect(SPECIAL_MARKERS.aura.color).toBe('#B06AF0');
    expect(SPECIAL_MARKERS.aura.alpha).toBe(0.3);
    expect(SPECIAL_MARKERS.aura.radius).toBeGreaterThanOrEqual(40);
    expect(SPECIAL_MARKERS.aura.radius).toBeLessThanOrEqual(48);
    expect(SPECIAL_MARKERS.aura.breatheSeconds).toBe(1);
  });

  it('相位残影：本体 α0.5 + ghost α0.25 间隔 60ms（GDD §4.2）', () => {
    expect(SPECIAL_MARKERS.phase.bodyAlpha).toBe(0.5);
    expect(SPECIAL_MARKERS.phase.ghostAlpha).toBe(0.25);
    expect(SPECIAL_MARKERS.phase.ghostIntervalMs).toBe(60);
  });

  it('蓄力红警告线：桌面 1px / 移动加粗 2px（§⑦ 反制依赖移动端全保留）', () => {
    expect(SPECIAL_MARKERS.warningline.color).toBe(PALETTE.danger);
    expect(SPECIAL_MARKERS.warningline.widthDesktop).toBe(1);
    expect(SPECIAL_MARKERS.warningline.widthMobile).toBe(2);
    expect(SPECIAL_MARKERS.warningline.widthMobile).toBeGreaterThan(SPECIAL_MARKERS.warningline.widthDesktop);
  });

  it('头顶符文：16×16 纸白 + 幽紫微光呼吸 1s（GDD §4.2）', () => {
    expect(SPECIAL_MARKERS.rune.size).toBe(16);
    expect(SPECIAL_MARKERS.rune.color).toBe(PALETTE.uiPaper);
  });

  it('投射红色预警：烛火弹 1.5px 红描边 + 外圈红晕 r12 α0.25（GDD §4.2）', () => {
    expect(SPECIAL_MARKERS.ranged.outline).toBe(1.5);
    expect(SPECIAL_MARKERS.ranged.haloRadius).toBe(12);
    expect(SPECIAL_MARKERS.ranged.haloAlpha).toBe(0.25);
  });

  it('标记帧 ⊆ 帧名注册表 markers 交付集（content-id-frame-map §6）', () => {
    const markerFrames = new Set<string>(FRAME_BY_CONTENT_ID.markers ?? []);
    expect(markerFrames.has(SPECIAL_MARKERS.aura.frame)).toBe(true);
    expect(markerFrames.has(SPECIAL_MARKERS.warningline.frame)).toBe(true);
    expect(markerFrames.has(SPECIAL_MARKERS.rune.frame)).toBe(true);
    expect(markerFrames.has('marker-stun')).toBe(true); // AC-C3 眩晕纸白星同组
    expect(markerFrames.has('marker-slow')).toBe(true);
    expect(markerFrames.has('marker-mark')).toBe(true);
  });

  it('预算纪律：标记 = 静态 Image 随敌人组批次，无粒子池消费（SPECIAL_MARKERS 无粒子数量字段）', () => {
    const specJson = JSON.stringify(SPECIAL_MARKERS);
    expect(specJson.includes('particleCount')).toBe(false);
    expect(specJson.includes('"count"')).toBe(false);
  });
});
