import { describe, it, expect } from 'vitest';
import { HEAL } from '@/config/balance';
import { SPAWN_STAGES } from '@/spawner/spawner';
import { shouldDropHeal } from '@/xp/heal-manager';

/**
 * M3 治疗道具单局治疗总量平衡模拟（merit-ui-spec §11 红线：≤200 HP/局；预案 30→25 或掉率 100%→50%）。
 *
 * 模型口径（spec §11「治疗总量 = 精英保底（约 10/局）× 30 + Boss 1 ≈ 330 HP 上限」）：
 * - 精英保底数：S2（120–240s，30s 间隔 → 4）+ S3（240–360s，20s 间隔 → 6）= 10/局
 * - Boss：6:00 收束 1 只（保底掉 1）
 * - 单局治疗总量 = 精英保底数 × 精英掉率 × 治疗量 + Boss 1 × 治疗量
 *
 * 现状（100% 掉率 + 30HP）：10×1.0×30 + 30 = 330 > 200 → **超标**
 * 调整（精英掉率 100%→50%，Boss 保底，治疗量保持 30）：10×0.5×30 + 30 = 180 ≤ 200 ✔（余量 10%）
 * 备选（30→25 + 100% 掉率）：10×25 + 25 = 275 > 200 ✗ 单调整不足，故采用掉率预案。
 *
 * 修女被动 ×1.5（45HP）为英雄专属：10×0.5×45 + 45 = 270 > 200 —— 属角色定位收益，
 * 不纳入通用红线（与 merit 红线口径一致，见提交说明；若主理人要求纳入需再降掉率至 ~40%）。
 */
export function guaranteedElitesPerRun(): number {
  let total = 0;
  for (const stage of SPAWN_STAGES) {
    if (Number.isFinite(stage.tankGuaranteeEvery)) {
      total += Math.floor((stage.end - stage.start) / stage.tankGuaranteeEvery);
    }
  }
  return total;
}

/** 单局治疗总量（HP；口径 = merit-ui-spec §11 上限模型） */
export function healTotalPerRun(): number {
  const elites = guaranteedElitesPerRun();
  const eliteDrops = Math.round(elites * HEAL.ELITE_DROP_CHANCE);
  const bossDrops = 1; // Boss 保底
  return (eliteDrops + bossDrops) * HEAL.AMOUNT;
}

describe('M3 治疗道具单局治疗总量平衡模拟（merit-ui-spec §11 红线 ≤200 HP/局）', () => {
  it('精英保底数 = 10/局（S2 4 + S3 6；与 spec「约 10/局」口径一致）', () => {
    expect(guaranteedElitesPerRun()).toBe(10);
  });

  it('调整后单局治疗总量 ≤ 200 红线（精英掉率 50% + Boss 保底 + 30HP = 180）', () => {
    expect(HEAL.ELITE_DROP_CHANCE).toBe(0.5);
    expect(HEAL.AMOUNT).toBe(30);
    const total = healTotalPerRun();
    expect(total).toBeLessThanOrEqual(200);
    expect(total).toBe(180); // 10×0.5×30 + 30
  });

  it('调整前（100% 掉率）330 超标 —— 记录调整理由', () => {
    const before = (10 * 1.0 + 1) * HEAL.AMOUNT;
    expect(before).toBe(330);
    expect(before).toBeGreaterThan(200); // 超标依据
  });

  it('备选（30→25 + 100% 掉率）275 仍超标 —— 单调整不足，故采用掉率预案', () => {
    const alt = (10 * 1.0 + 1) * 25;
    expect(alt).toBe(275);
    expect(alt).toBeGreaterThan(200);
  });

  it('shouldDropHeal 与模型口径一致：精英按 50% 随机、Boss 恒掉', () => {
    // 精英：50% 抽样 → 期望 5 个掉落（10 保底精英）
    let drops = 0;
    for (let i = 0; i < 10; i += 1) if (shouldDropHeal('tank', () => 0.3)) drops += 1;
    expect(drops).toBe(10); // 0.3 < 0.5 → 全部掉
    let dropsHigh = 0;
    for (let i = 0; i < 10; i += 1) if (shouldDropHeal('tank', () => 0.7)) dropsHigh += 1;
    expect(dropsHigh).toBe(0); // 0.7 ≥ 0.5 → 全不掉
    expect(shouldDropHeal('boss', () => 0.99)).toBe(true); // Boss 保底
  });
});
