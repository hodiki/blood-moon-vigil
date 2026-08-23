import { describe, it, expect } from 'vitest';
import { ACTIVE_SKILL, ACTIVE_SKILLS } from '@/config/balance';
import { ActiveSkill } from '@/active-skill/active-skill';

describe('ActiveSkill 控制器（M1b 迷你验证 / pillars §6.4/§6.7）', () => {
  function makeSkill(): ActiveSkill {
    return new ActiveSkill(ACTIVE_SKILL.CD, ACTIVE_SKILL.INPUT_LOCK_SECONDS);
  }

  it('初始就绪、冷却 0、次数 0', () => {
    const s = makeSkill();
    expect(s.ready).toBe(true);
    expect(s.cooldown).toBe(0);
    expect(s.casts).toBe(0);
  });

  it('tryCast 成功：冷却置 20s、次数 +1、进入冷却', () => {
    const s = makeSkill();
    expect(s.tryCast(10)).toBe(true);
    expect(s.casts).toBe(1);
    expect(s.cooldown).toBeCloseTo(20, 6);
    expect(s.ready).toBe(false);
  });

  it('冷却未就绪：连续 tryCast 拒绝（CD 制不积压、无存储，pillars §6.4）', () => {
    const s = makeSkill();
    expect(s.tryCast(10)).toBe(true);
    expect(s.tryCast(10.5)).toBe(false); // 冷却中
    expect(s.casts).toBe(1);
  });

  it('释放后 100ms 输入锁定防抖：即使冷却就绪也拒绝（pillars §6.7-3）', () => {
    // 构造：冷却已到 0（update 推进），但输入锁仍在 100ms 内
    const s = makeSkill();
    s.tryCast(10); // 锁到 10.1
    s.update(20); // 冷却 0（就绪）
    expect(s.ready).toBe(true);
    expect(s.tryCast(10.05)).toBe(false); // now=10.05 < 10.1 → 防抖拒绝
    expect(s.casts).toBe(1);
    expect(s.tryCast(10.2)).toBe(true); // 锁已过 → 可再次释放
    expect(s.casts).toBe(2);
  });

  it('update 冷却递减：20s 后自然就绪（秒制、clamp ≥0）', () => {
    const s = makeSkill();
    s.tryCast(0);
    expect(s.cooldown).toBeCloseTo(20, 6);
    s.update(10);
    expect(s.cooldown).toBeCloseTo(10, 6);
    s.update(30); // 超时溢出 clamp
    expect(s.cooldown).toBe(0);
    expect(s.ready).toBe(true);
  });

  it('update 不把负数带入（clamp ≥0）', () => {
    const s = makeSkill();
    s.tryCast(0);
    s.update(999);
    expect(s.cooldown).toBe(0);
  });

  it('reset：冷却/防抖/次数全部归零（重开 scene.restart 后 CD 重置，pillars §6.7-4）', () => {
    const s = makeSkill();
    s.tryCast(0);
    s.casts = 5;
    s.reset();
    expect(s.cooldown).toBe(0);
    expect(s.casts).toBe(0);
    expect(s.tryCast(1)).toBe(true);
  });

  it('ACTIVE_SKILL 配置与控制器一致（CD 20s / 防抖 0.1s）', () => {
    expect(ACTIVE_SKILL.CD).toBe(20);
    expect(ACTIVE_SKILL.INPUT_LOCK_SECONDS).toBe(0.1);
  });
});

describe('E4-S2 充能制（血猎手「血影突袭」2 段 8s/段，gdd-active-skill §3.2）', () => {
  const cassandra = ACTIVE_SKILLS.hero_cassandra;

  it('配置：CD 12s、2 段充能、充能间隔 8s（总 CD 等效 ~16s）', () => {
    expect(cassandra.charges).toBe(2);
    expect(cassandra.chargeInterval).toBe(8);
    expect(cassandra.cd).toBe(12);
  });

  it('初始 2 段可用：ready / chargeCount=2 / cooldown=0', () => {
    const s = new ActiveSkill(cassandra.cd, 0.1, cassandra.charges, cassandra.chargeInterval);
    expect(s.ready).toBe(true);
    expect(s.chargeCount).toBe(2);
    expect(s.cooldown).toBe(0);
  });

  it('释放消耗 1 段：连续 2 次可放，第 3 次无段拒绝', () => {
    const s = new ActiveSkill(cassandra.cd, 0.1, 2, 8);
    expect(s.tryCast(0)).toBe(true);
    expect(s.chargeCount).toBe(1);
    expect(s.tryCast(1.5)).toBe(true);
    expect(s.chargeCount).toBe(0);
    expect(s.tryCast(1.6)).toBe(false); // 无剩余段
    expect(s.casts).toBe(2);
  });

  it('充能回复：段空后每 8s 回复 1 段；回复满后 cooldown=0', () => {
    const s = new ActiveSkill(cassandra.cd, 0.1, 2, 8);
    s.tryCast(0); // 2→1
    s.tryCast(1); // 1→0
    expect(s.cooldown).toBeCloseTo(8, 6); // 距下段回复 8s
    s.update(4);
    expect(s.cooldown).toBeCloseTo(4, 6);
    expect(s.chargeCount).toBe(0);
    s.update(4); // 累计 8s → 回复 1 段
    expect(s.chargeCount).toBe(1);
    expect(s.cooldown).toBe(0); // 有段 → ready
    s.update(8); // 再 8s → 回复满 2 段
    expect(s.chargeCount).toBe(2);
    expect(s.cooldown).toBe(0);
  });

  it('释放后 100ms 防抖同样生效（充能制）', () => {
    const s = new ActiveSkill(cassandra.cd, 0.1, 2, 8);
    s.tryCast(0);
    expect(s.tryCast(0.05)).toBe(false); // 防抖
    expect(s.tryCast(0.2)).toBe(true); // 第二段可用
  });

  it('reset：充能/防抖/次数全部归零（重开 scene.restart 后重置）', () => {
    const s = new ActiveSkill(cassandra.cd, 0.1, 2, 8);
    s.tryCast(0);
    s.tryCast(1);
    s.reset();
    expect(s.chargeCount).toBe(2);
    expect(s.casts).toBe(0);
    expect(s.cooldown).toBe(0);
  });
});
