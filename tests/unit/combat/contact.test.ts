import { describe, it, expect } from 'vitest';
import { playerEnemyContact, type ContactEnemy, type ContactPlayer } from '@/combat/contact';

class FakeEnemy implements ContactEnemy {
  active = true;
  attackTimer = 0;
  attackInterval = 1.0;
  damage = 10;
  /** M1b 主动技：眩晕截止（秒时间戳）；> nowSeconds 期间不造成接触伤害 */
  stunnedUntil = 0;
}

class FakePlayer implements ContactPlayer {
  hurtCalls: Array<{ amount: number; now: number }> = [];
  invulnerable = false;
  hurt(amount: number, nowSeconds: number): boolean {
    if (this.invulnerable) return false;
    this.hurtCalls.push({ amount, now: nowSeconds });
    return true;
  }
}

describe('playerEnemyContact 玩家-敌人接触伤害纯函数（TASK-37 B1 / enemies §⑥.3）', () => {
  it('敌人未激活：直接跳过，不重置计时、不扣血', () => {
    const enemy = new FakeEnemy();
    const player = new FakePlayer();
    enemy.active = false;
    expect(playerEnemyContact(enemy, 5, player)).toBe(false);
    expect(player.hurtCalls).toHaveLength(0);
    expect(enemy.attackTimer).toBe(0);
  });

  it('攻击计时 > 0（冷却中）：跳过本次接触', () => {
    const enemy = new FakeEnemy();
    enemy.attackTimer = 0.5;
    const player = new FakePlayer();
    expect(playerEnemyContact(enemy, 5, player)).toBe(false);
    expect(player.hurtCalls).toHaveLength(0);
    expect(enemy.attackTimer).toBe(0.5);
  });

  it('攻击计时 ≤ 0：造成一次伤害并重置为 attackInterval', () => {
    const enemy = new FakeEnemy();
    enemy.attackInterval = 1.5;
    const player = new FakePlayer();
    const ok = playerEnemyContact(enemy, 10, player);
    expect(ok).toBe(true);
    expect(player.hurtCalls).toEqual([{ amount: 10, now: 10 }]);
    expect(enemy.attackTimer).toBe(1.5);
  });

  it('同帧多敌重叠：各自独立调用，每个敌按自身 attackTimer 决定是否造成伤害', () => {
    const a = new FakeEnemy();
    const b = new FakeEnemy();
    b.attackTimer = 0.8; // 冷却中
    const player = new FakePlayer();
    expect(playerEnemyContact(a, 1, player)).toBe(true);
    expect(playerEnemyContact(b, 1, player)).toBe(false);
    expect(player.hurtCalls).toEqual([{ amount: 10, now: 1 }]);
    expect(a.attackTimer).toBe(1.0);
    expect(b.attackTimer).toBe(0.8);
  });

  it('玩家无敌帧：hurt 返回 false，contact 透传 false（多敌同帧只扣 1 血的纪律）', () => {
    const enemy = new FakeEnemy();
    const player = new FakePlayer();
    player.invulnerable = true;
    expect(playerEnemyContact(enemy, 2, player)).toBe(false);
    expect(player.hurtCalls).toHaveLength(0);
    // 注意：attackTimer 仍被重置为 interval（攻击计时与受击时机解耦；enemies §⑥.3）
    expect(enemy.attackTimer).toBe(1.0);
  });

  // —— M1b 主动技「提灯闪耀」眩晕：眩晕期内不造成接触伤害（content §2.2） ——
  it('眩晕中：不造成接触伤害，且不重置攻击计时（冻结攻击节奏）', () => {
    const enemy = new FakeEnemy();
    enemy.stunnedUntil = 5; // now=3 < 5 → 眩晕中
    enemy.attackTimer = 0.2;
    const player = new FakePlayer();
    expect(playerEnemyContact(enemy, 3, player)).toBe(false);
    expect(player.hurtCalls).toHaveLength(0);
    expect(enemy.attackTimer).toBe(0.2); // 攻击计时未被重置/递减
  });

  it('眩晕结束：恢复可造成接触伤害', () => {
    const enemy = new FakeEnemy();
    enemy.stunnedUntil = 5; // now=6 > 5 → 眩晕结束
    const player = new FakePlayer();
    expect(playerEnemyContact(enemy, 6, player)).toBe(true);
    expect(player.hurtCalls).toEqual([{ amount: 10, now: 6 }]);
  });
});
