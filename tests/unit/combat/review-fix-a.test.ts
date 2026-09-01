/**
 * NV-REVIEW-FIX 批次 A · 战斗正确性 —— 运行时/场景级用例
 *
 * 覆盖（审查 §4）：
 * - P0-2：眩晕（硬控）窗口内贴脸不掉血；接触路径不再依赖 `stunnedUntil`
 * - P0-3：易伤乘区收敛到 `combat/damage` 唯一入口；专武与通武增伤比例一致；boss_4 免疫易伤
 * - P1-18：芬里厄减速 ×0.5 仅蓄力期；石甲狼减速 ×0.5 仅石甲期（非相位不折减）
 *
 * 分层纪律（审查 §一.4）：配置断言不够——本文件全部为运行时用例
 * （纯函数/实体状态机协作），不依赖 Phaser 场景。
 */

import { describe, it, expect } from 'vitest';
import { playerEnemyContact, type ContactEnemy, type ContactPlayer } from '@/combat/contact';
import {
  applyDamage,
  computeHitDamage,
  hitEnemy,
  targetDamageTakenMult,
} from '@/combat/damage';
import {
  applyStatus,
  emptyStatusState,
  damageTakenMultiplier,
  type StatusState,
} from '@/combat/status/status-engine';
import { resolveCcResistance, type CcProfile } from '@/combat/status/status-config';
import { bossChargingNow, createBossSkillState } from '@/enemies/boss-skill-engine';
import { EliteSkillDirector, type EliteEnemyLike } from '@/enemies/elite-skill-runtime';
import { BOSSES } from '@/config/balance';

// ============================================================================
// P0-2 眩晕挡接触伤害
// ============================================================================

function makeContactEnemy(overrides: Partial<ContactEnemy> = {}): ContactEnemy {
  return {
    active: true,
    attackTimer: 0,
    attackInterval: 1,
    damage: 10,
    cc: emptyStatusState(),
    ...overrides,
  };
}

function makePlayer(): ContactPlayer & { hp: number; hits: number } {
  return {
    hp: 100,
    hits: 0,
    hurt(amount: number): boolean {
      this.hits += 1;
      this.hp -= amount;
      return true;
    },
  };
}

describe('P0-2 眩晕（硬控）阻止接触伤害（gdd-status-effects：硬控期间目标不造成接触伤害）', () => {
  it('眩晕窗口内 playerEnemyContact 返回 false 且不扣血', () => {
    const stunnedCc = applyStatus(emptyStatusState(), { kind: 'stun', value: 1, durationSeconds: 1 }, 0).state;
    const enemy = makeContactEnemy({ cc: stunnedCc });
    const player = makePlayer();

    expect(playerEnemyContact(enemy, 0.5, player)).toBe(false);
    expect(player.hits).toBe(0);
    expect(player.hp).toBe(100);
  });

  it('眩晕结束后（含边界）恢复造成接触伤害', () => {
    const stunnedCc = applyStatus(emptyStatusState(), { kind: 'stun', value: 1, durationSeconds: 1 }, 0).state;
    const enemy = makeContactEnemy({ cc: stunnedCc });
    const player = makePlayer();

    expect(playerEnemyContact(enemy, 1, player)).toBe(true); // until=1，now=1 已过期
    expect(player.hp).toBe(90);
    // 攻击计时已重置 → 间隔内二次接触不扣血（既有语义不回退）
    expect(playerEnemyContact(enemy, 1.2, player)).toBe(false);
    expect(player.hp).toBe(90);
  });

  it('ContactEnemy 不再持有 stunnedUntil：旧散落字段被移除（接触路径只查 cc.stun）', () => {
    const enemy = makeContactEnemy();
    // 类型层面已无该字段；运行时即便调用方塞入旧字段也不再被消费
    const legacy = { ...enemy, stunnedUntil: 999 } as ContactEnemy;
    const player = makePlayer();
    expect(playerEnemyContact(legacy, 1, player)).toBe(true); // 只看 cc：无眩晕 → 正常造成伤害
    expect(player.hp).toBe(90);
  });

  it('易伤/减速等非硬控状态不阻止接触伤害（只有 stun 挡）', () => {
    let cc = applyStatus(emptyStatusState(), { kind: 'vulnerable', value: 0.2, durationSeconds: 5 }, 0).state;
    cc = applyStatus(cc, { kind: 'slow', value: 0.4, durationSeconds: 5 }, 0).state;
    const enemy = makeContactEnemy({ cc });
    const player = makePlayer();
    expect(playerEnemyContact(enemy, 1, player)).toBe(true);
    expect(player.hp).toBe(90);
  });
});

// ============================================================================
// P0-3 易伤唯一入口
// ============================================================================

function killable(hp: number, cc?: StatusState) {
  return {
    active: true,
    hp,
    cc,
    killed: false,
    kill() {
      this.killed = true;
    },
  };
}

describe('P0-3 易伤乘区走 combat/damage 唯一入口', () => {
  it('hitEnemy：易伤目标 ×(1+值)；无 cc / 无 now = 不并线（×1）', () => {
    const cc = applyStatus(emptyStatusState(), { kind: 'vulnerable', value: 0.2, durationSeconds: 5 }, 0).state;
    const vuln = killable(1000, cc);
    hitEnemy(vuln, 100, 1);
    expect(vuln.hp).toBe(880); // 100 × 1.2

    const plain = killable(1000, emptyStatusState());
    hitEnemy(plain, 100, 1);
    expect(plain.hp).toBe(900);

    const noNow = killable(1000, cc);
    hitEnemy(noNow, 100); // 未传 now = 旧调用方兼容，不并线
    expect(noNow.hp).toBe(900);
  });

  it('computeHitDamage：同签名乘易伤；targetDamageTakenMult 对缺载荷目标恒 1', () => {
    const cc = applyStatus(emptyStatusState(), { kind: 'vulnerable', value: 0.15, durationSeconds: 5 }, 0).state;
    expect(computeHitDamage(100, 1, { cc }, 1)).toBeCloseTo(115, 6);
    expect(computeHitDamage(100, 1, undefined, 1)).toBe(100);
    expect(targetDamageTakenMult(undefined, 1)).toBe(1);
    expect(targetDamageTakenMult({}, 1)).toBe(1);
    expect(targetDamageTakenMult({ cc }, undefined)).toBe(1);
  });

  it('易伤过期后不再增伤（时长由抗性折减，不是永久 buff）', () => {
    const cc = applyStatus(emptyStatusState(), { kind: 'vulnerable', value: 0.2, durationSeconds: 2 }, 0).state;
    const t = killable(1000, cc);
    hitEnemy(t, 100, 1);
    expect(t.hp).toBe(880);
    hitEnemy(t, 100, 5); // until=2 已过期
    expect(t.hp).toBe(780);
  });

  it('验收：同一易伤目标 —— 专武结算与通武（wpn_a_1 口径）增伤比例一致', () => {
    const cc = applyStatus(emptyStatusState(), { kind: 'vulnerable', value: 0.2, durationSeconds: 5 }, 0).state;
    // 通武路径：computeHitDamage(基础 × 倍率) → hitEnemy
    const normal = killable(1000, cc);
    hitEnemy(normal, computeHitDamage(50, 2), 1);
    // 专武路径：exclusive-math 直接把 amount 交给 hitEnemy（不再自乘 vuln）
    const exclusive = killable(1000, cc);
    hitEnemy(exclusive, 100, 1);
    // 两者均为 100 基础 → 都掉 120
    expect(normal.hp).toBe(880);
    expect(exclusive.hp).toBe(880);
    // 未易伤对照：都掉 100
    const n2 = killable(1000, emptyStatusState());
    hitEnemy(n2, computeHitDamage(50, 2), 1);
    const e2 = killable(1000, emptyStatusState());
    hitEnemy(e2, 100, 1);
    expect(n2.hp).toBe(900);
    expect(e2.hp).toBe(900);
  });

  it('验收：boss_4 免疫易伤（ccProfile 覆写 vulnerable.immune；GDD 抗性表）→ 增伤为 0', () => {
    // 抗性画像来源：BOSSES.boss_4.ccProfile（spawnByBossConfig 写入实体）
    const profile: CcProfile = BOSSES.boss_4.ccProfile ?? { tier: 'boss' };
    expect(profile.ccResistance?.vulnerable?.immune).toBe(true);
    expect(resolveCcResistance('vulnerable', profile).immune).toBe(true);

    // 免疫 = 状态挂不上 → 承伤乘区恒 1
    let cc = emptyStatusState();
    const r = applyStatus(cc, { kind: 'vulnerable', value: 0.2, durationSeconds: 8 }, 0, profile);
    cc = r.state;
    expect(r.applied).toBe(false);
    expect(r.reason).toBe('immune');
    expect(damageTakenMultiplier(cc, 1)).toBe(1);

    const boss = killable(1000, cc);
    hitEnemy(boss, 100, 1);
    expect(boss.hp).toBe(900); // 无增伤
  });

  it('击杀分发仍生效（易伤并入后 hitEnemy 的 kill/返回值语义不回退）', () => {
    const cc = applyStatus(emptyStatusState(), { kind: 'vulnerable', value: 0.5, durationSeconds: 5 }, 0).state;
    const t = killable(100, cc);
    expect(hitEnemy(t, 100, 1)).toBe(true); // 100×1.5 ≥ 100
    expect(t.killed).toBe(true);
    expect(t.hp).toBe(0);
  });

  it('applyDamage 为纯扣血（不乘易伤）—— 玩家侧伤害不受目标状态影响', () => {
    const stats = { hp: 100 };
    expect(applyDamage(stats, 30)).toBe(false);
    expect(stats.hp).toBe(70);
  });
});

// ============================================================================
// P1-18 相位抗性（MN-9 口径修正）
// ============================================================================

describe('P1-18 相位 CC 抗性：芬里厄仅蓄力期 / 石甲狼仅石甲期（非常驻）', () => {
  it('boss_3：非蓄力期（casting=null）不折减减速；蓄力技预警期内才 ×0.5', () => {
    const st = createBossSkillState('boss_3');
    expect(bossChargingNow(st)).toBe(false);

    // 蓄力类技能（skill1 短嗥冲锋 / ultimate 蓄力扑击）预警中 = 蓄力期
    st.casting = { slot: 'skill1', fireAt: 10 };
    expect(bossChargingNow(st)).toBe(true);
    st.casting = { slot: 'ultimate', fireAt: 10 };
    expect(bossChargingNow(st)).toBe(true);

    // 非蓄力技（skill2 召唤灰狼 / skill3 狼王嚎叫）不算蓄力期
    st.casting = { slot: 'skill2', fireAt: 10 };
    expect(bossChargingNow(st)).toBe(false);
    st.casting = { slot: 'skill3', fireAt: 10 };
    expect(bossChargingNow(st)).toBe(false);
  });

  it('boss_1（非蓄力 Boss）恒不在蓄力期 —— charge 标记逐槽，不全局生效', () => {
    const st = createBossSkillState('boss_1');
    st.casting = { slot: 'ultimate', fireAt: 10 };
    expect(bossChargingNow(st)).toBe(false);
  });

  it('芬里厄实体：蓄力期 slow durationMult 0.5；离开蓄力期回到 boss 默认 1', () => {
    const base: CcProfile = { tier: 'boss' };
    // 模拟 PlayScene 的相位覆写开关
    const charging: CcProfile = { ...base, ccResistance: { slow: { durationMult: 0.5 } } };
    expect(resolveCcResistance('slow', charging).durationMult).toBe(0.5);
    expect(resolveCcResistance('slow', base).durationMult).toBe(1);
  });

  it('石甲狼：石甲期减速 ×0.5；破甲期恢复 1（EliteSkillDirector 按相位覆写）', () => {
    const director = new EliteSkillDirector();
    const wolf: EliteEnemyLike & {
      phaseCc?: Partial<Record<'stun' | 'slow' | 'vulnerable', { durationMult: number }>>;
    } = {
      x: 0,
      y: 0,
      hp: 400,
      maxHp: 400,
      enemyId: 'enemy_g3_3',
      cc: emptyStatusState(),
      speed: 45,
      baseAttackInterval: 1.8,
      attackInterval: 1.8,
      spawnGeneration: 1,
      setPhaseCcResistance(ov) {
        this.phaseCc = ov;
      },
    };
    const player = { x: 0, y: 0 };

    // 石甲期（HP 满）→ 减速折减 ×0.5
    director.update(1 / 60, 0, player, [wolf]);
    expect(wolf.phaseCc?.slow?.durationMult).toBe(0.5);

    // 破甲（HP 降到本体阈值以下）→ 恢复全时长 1（原实现恒 0.5，属范围错误）
    wolf.hp = 100;
    director.update(1 / 60, 0, player, [wolf]);
    expect(wolf.phaseCc?.slow?.durationMult).toBe(1);
  });
});
