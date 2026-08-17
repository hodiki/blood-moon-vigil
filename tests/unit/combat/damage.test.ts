import { describe, it, expect } from 'vitest';
import {
  totalMultiplier,
  computeHitDamage,
  isInvulnerable,
  applyDamage,
  hitEnemy,
  type Damageable,
  type Killable,
} from '@/combat/damage';
import { WEAPONS, PLAYER } from '@/config/balance';

describe('伤害结算纯函数（E2-S1 / S8）', () => {
  it('总倍率 = 基础倍率 + 升级池加成（加法叠加防指数膨胀，upgrade-pool §③）', () => {
    expect(totalMultiplier(1.0, 0)).toBe(1.0);
    expect(totalMultiplier(1.04, 0.15)).toBeCloseTo(1.19, 6); // 等级成长 1.04 + 一次伤害强化
  });

  it('命中伤害 = 基础伤害 × 总倍率（初始倍率 1.0，weapons §③）', () => {
    expect(computeHitDamage(WEAPONS.MISSILE.DAMAGE, 1.0)).toBe(12);
    expect(computeHitDamage(WEAPONS.MISSILE.DAMAGE, 1.04)).toBeCloseTo(12.48, 6);
  });

  it('无敌帧：now < until 免疫（时间戳比较，enemies §⑥.3 / RV-C7）', () => {
    expect(isInvulnerable(1.0, 1.5)).toBe(true); // 仍在无敌窗内
    expect(isInvulnerable(1.5, 1.5)).toBe(false); // 临界点不再免疫
    expect(isInvulnerable(2.0, 1.5)).toBe(false);
  });

  it('applyDamage：扣血 clamp 到 0，返回是否死亡', () => {
    const target: Damageable = { hp: 12 };
    expect(applyDamage(target, 5)).toBe(false);
    expect(target.hp).toBe(7);
    expect(applyDamage(target, 7)).toBe(true);
    expect(target.hp).toBe(0);
    expect(applyDamage(target, 999)).toBe(true); // 已死再扣不反弹
    expect(target.hp).toBe(0);
  });

  it('hitEnemy：未死不触发 kill，死亡触发 kill 一次', () => {
    let kills = 0;
    const target: Killable = {
      hp: 12,
      kill: () => {
        kills += 1;
      },
    };
    expect(hitEnemy(target, 5)).toBe(false);
    expect(kills).toBe(0);
    expect(hitEnemy(target, 7)).toBe(true);
    expect(kills).toBe(1);
  });

  it('飞弹 1 发秒杀僵尸：12 伤 × 倍率 1.0 ≥ 12HP（W8-2）', () => {
    const zombie: Killable = {
      hp: 12,
      kill: () => {
        zombie.hp = 0;
      },
    };
    const dmg = computeHitDamage(WEAPONS.MISSILE.DAMAGE, PLAYER.DAMAGE_MULTIPLIER);
    expect(dmg).toBe(12);
    expect(hitEnemy(zombie, dmg)).toBe(true);
    expect(zombie.hp).toBe(0);
  });
});
