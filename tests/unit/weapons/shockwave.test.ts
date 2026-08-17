import { describe, it, expect } from 'vitest';
import { WEAPONS } from '@/config/balance';
import { damageAllInRadius, knockbackEnemies, type DamageTargetLike } from '@/weapons/weapon-math';

function makeEnemy(hp: number, x: number, y: number, id: string): DamageTargetLike & { id: string } {
  return {
    id,
    active: true,
    x,
    y,
    hp,
    kill() {
      this.hp = 0;
      this.active = false;
    },
  };
}

describe('定时冲击波「月蚀脉冲」数值与范围（E2-S3 / weapons §③ / W8）', () => {
  it('面板：60 伤 / 8s 冷却 / 半径 280px / 扩散 0.4s', () => {
    expect(WEAPONS.SHOCKWAVE.DAMAGE).toBe(60);
    expect(WEAPONS.SHOCKWAVE.COOLDOWN).toBe(8);
    expect(WEAPONS.SHOCKWAVE.RADIUS).toBe(280);
    expect(WEAPONS.SHOCKWAVE.EXPAND_SECONDS).toBe(0.4);
  });

  it('半径内全部敌人受 60 伤（全方向穿透所有敌人，W8 §③）', () => {
    const center = { x: 0, y: 0 };
    const inside1 = makeEnemy(600, 100, 0, 'in1');
    const inside2 = makeEnemy(60, -250, 0, 'in2'); // 60 伤 → 恰好死亡
    const outside = makeEnemy(600, 300, 0, 'out'); // 300 > 280 不受伤
    const inactive = makeEnemy(600, 50, 0, 'off');
    inactive.active = false;

    const { hit, killed } = damageAllInRadius(
      [inside1, inside2, outside, inactive],
      center,
      WEAPONS.SHOCKWAVE.RADIUS,
      WEAPONS.SHOCKWAVE.DAMAGE,
    );
    expect(hit).toBe(2);
    expect(killed).toBe(1);
    expect(inside1.hp).toBe(540);
    expect(inside2.hp).toBe(0);
    expect(outside.hp).toBe(600);
    expect(outside.active).toBe(true);
  });

  it('纯函数对空敌人列表安全（hit=0 不报错；E3 空放决策已移到武器层：有目标才释放）', () => {
    // E3 决策（design-review-e2 C2 / TASK-15）：冲击波接入经验宝石后「有目标才释放」，
    // 空放 = 损失宝石产出；武器层在 ShockwaveWeapon.update 做半径内目标判定。
    // 本纯函数仍须对空列表安全（供测试/工具调用）。
    const { hit, killed } = damageAllInRadius([], { x: 0, y: 0 }, WEAPONS.SHOCKWAVE.RADIUS, 60);
    expect(hit).toBe(0);
    expect(killed).toBe(0);
  });

  it('击退：半径内敌人背离中心 80px（upgrade-pool 第 7 项，E3-S5 写回）', () => {
    const e = makeEnemy(600, 100, 0, 't');
    const n = knockbackEnemies([e], { x: 0, y: 0 }, WEAPONS.SHOCKWAVE.RADIUS, WEAPONS.SHOCKWAVE.KNOCKBACK_DISTANCE);
    expect(n).toBe(1);
    expect(e.x).toBeCloseTo(180, 6); // 100 + 80
    expect(e.y).toBeCloseTo(0, 6);
  });

  it('击退只作用于半径内 active 敌人', () => {
    const out = makeEnemy(600, 300, 0, 'out'); // 300 > 280
    const inactive = makeEnemy(600, 50, 0, 'off');
    inactive.active = false;
    const n = knockbackEnemies([out, inactive], { x: 0, y: 0 }, WEAPONS.SHOCKWAVE.RADIUS, WEAPONS.SHOCKWAVE.KNOCKBACK_DISTANCE);
    expect(n).toBe(0);
    expect(out.x).toBe(300);
  });
});
