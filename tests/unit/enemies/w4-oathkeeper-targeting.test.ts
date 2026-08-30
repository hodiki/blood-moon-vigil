import { describe, it, expect } from 'vitest';
import { pickTarget, type FriendlyTargetLike } from '@/enemies/targeting';
import {
  wanderVelocity,
  volleyAimPoints,
  volleyGapWidth,
  BONETHROWER_BAND,
  PENITENT_BAND,
  WANDER_PERIOD,
  VOLLEY_CORRECTION,
} from '@/enemies/keep-distance';
import { OathkeeperRuntime, OATHKEEPER_LEASH, BITE_RANGE } from '@/weapons/companion/oathkeeper-runtime';
import { applyCompanionMachine } from '@/weapons/companion/oathkeeper';
import { ELITE_SKILLS } from '@/enemies/elite-skills';

/**
 * W-4 收官断言（gdd-exclusive-weapons §4.4 守誓者 + gdd-enemies-v3 接口约定）：
 * - 守誓者替身圈强制索敌（targeting.pickTarget 运行时消费——R-2/B2 遗留收口）
 * - 承伤转移 50%→65%（R-5 圣域叠加口径经 mc_bell_2 machine 参数化）
 * - 远程精英游走 + 缺口读法（§③-4-4/4-5 keep-distance 纯函数）
 */

describe('W-4 守誓者替身圈强制索敌（targeting.pickTarget 消费口径）', () => {
  const player = { x: 0, y: 0 };
  const enemy = { x: 100, y: 0 };
  const companion: FriendlyTargetLike = { targetable: true, x: 80, y: 0 }; // 距玩家 80 ≤ 150

  it('守誓者随行（替身圈内）→ 敌强制索敌 companion', () => {
    expect(pickTarget(enemy, player, companion, 150)).toBe('companion');
  });

  it('墓碑期 targetable=false → 回落玩家（不可被攻击语义）', () => {
    expect(pickTarget(enemy, player, { targetable: false, x: 80, y: 0 }, 150)).toBe('player');
  });

  it('守誓者远离玩家（>150px）→ 回落玩家（替身圈以「随行」定义）', () => {
    expect(pickTarget(enemy, player, { targetable: true, x: 200, y: 0 }, 150)).toBe('player');
  });

  it('无守誓者 → 恒玩家（全量回归口径）', () => {
    expect(pickTarget(enemy, player, null, 150)).toBe('player');
  });
});

describe('W-4 承伤转移 50%→65%（R-5 圣域叠加 = mc_bell_2 machine 参数化）', () => {
  const player = { x: 0, y: 0 };

  it('基础 50%：替身圈内受伤 → 50% 转移至守誓者，剩余回玩家', () => {
    const rt = new OathkeeperRuntime(80, 0);
    rt.setEnabled(true);
    expect(rt.routePlayerHurt(20, 10, player)).toBeCloseTo(10, 6); // 50% 转移
    expect(rt.state.hp).toBe(200 - 10); // 守誓者承伤 10
  });

  it('mc_bell_2（质变卡 2）→ 65% 转移（R-5 口径经 machine 覆写自动生效）', () => {
    const rt = new OathkeeperRuntime(80, 0);
    rt.setEnabled(true);
    applyCompanionMachine(rt.state, { transferPct: 0.65 });
    expect(rt.routePlayerHurt(20, 10, player)).toBeCloseTo(7, 6); // 65% 转移
    expect(rt.state.hp).toBe(200 - 13);
  });

  it('替身圈外 → 全额承受（不转移）', () => {
    const rt = new OathkeeperRuntime(300, 0); // >150px
    rt.setEnabled(true);
    expect(rt.routePlayerHurt(20, 10, player)).toBe(20);
  });

  it('转移致死 → 化墓碑（§6.1-1）+ 后续伤害全额回玩家', () => {
    const rt = new OathkeeperRuntime(80, 0);
    rt.setEnabled(true);
    rt.state.hp = 5;
    rt.routePlayerHurt(100, 10, player); // 转移 50 → hp 归零化墓碑
    expect(rt.state.phase).toBe('tombstone');
    expect(rt.routePlayerHurt(20, 11, player)).toBe(20); // 墓碑期不转移
  });

  it('未启用（非薇奥莱/非圣铃）→ 路由直通', () => {
    const rt = new OathkeeperRuntime(80, 0);
    expect(rt.routePlayerHurt(20, 10, player)).toBe(20);
    expect(rt.friendlyTarget()).toBeNull();
  });

  it('常量锚：替身圈 150 / 撕咬射程 120', () => {
    expect(OATHKEEPER_LEASH).toBe(150);
    expect(BITE_RANGE).toBe(120);
  });
});

describe('W-4 远程精英游走 + 缺口读法（keep-distance 纯函数）', () => {
  const elite = { x: 230, y: 0 };
  const player = { x: 0, y: 0 };

  it('距离带锚：掷骨者 200~260 / 忏悔者 260~320；游走周期 3s / 修正 0.2', () => {
    expect(BONETHROWER_BAND).toEqual({ min: 200, max: 260 });
    expect(PENITENT_BAND).toEqual({ min: 260, max: 320 });
    expect(WANDER_PERIOD).toBe(3);
    expect(VOLLEY_CORRECTION).toBeCloseTo(0.2, 6);
  });

  it('太近 → 远离；太远 → 接近；带内 → 切向游走（可读周期翻转）', () => {
    const near = wanderVelocity({ x: 150, y: 0 }, player, 0, BONETHROWER_BAND, 55);
    expect(near.vx).toBeGreaterThan(0); // 背向玩家（+x）
    const far = wanderVelocity({ x: 300, y: 0 }, player, 0, BONETHROWER_BAND, 55);
    expect(far.vx).toBeLessThan(0); // 朝玩家（−x）
    const inBand = wanderVelocity(elite, player, 0, BONETHROWER_BAND, 55);
    expect(inBand.vy).not.toBe(0); // 切向（y 分量主导）
    expect(inBand.vx).toBeCloseTo(0, 6);
  });

  it('游走方向周期翻转（t=0 顺时针 / t=1.5s 逆时针——可读规律）', () => {
    // sin(2πt/3)：t=0.75 → sin(π/2)=1（dir=1）；t=2.25 → sin(3π/2)=−1（dir=−1）
    const a = wanderVelocity(elite, player, 0.75, BONETHROWER_BAND, 55);
    const b = wanderVelocity(elite, player, 2.25, BONETHROWER_BAND, 55);
    expect(a.vy * b.vy).toBeLessThan(0); // 反向
  });

  it('缺口读法：3 连射落点沿玩家位移外推（修正 0.2），间隙 = 可穿行缺口', () => {
    const points = volleyAimPoints({ x: 230, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 }, 3);
    expect(points).toHaveLength(3);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points[1]!.x).toBeCloseTo(20, 6); // 100 × 0.2 × 1
    expect(points[2]!.x).toBeCloseTo(40, 6);
    expect(volleyGapWidth({ x: 100, y: 0 })).toBeCloseTo(20, 6);
  });

  it('站桩（无位移）→ 3 发重合落点（缺口 0 = 必中语义）', () => {
    const points = volleyAimPoints({ x: 230, y: 0 }, { x: 0, y: 0 }, null, 3);
    expect(points.every((p) => p.x === 0 && p.y === 0)).toBe(true);
    expect(volleyGapWidth(null)).toBe(0);
  });

  it('两精英技能表消费游走（§③-4-4/4-5 触发距离不变）', () => {
    expect(ELITE_SKILLS.enemy_g1_8.triggerDist).toBe(260);
    expect(ELITE_SKILLS.enemy_g2_5.triggerDist).toBe(320);
  });
});
