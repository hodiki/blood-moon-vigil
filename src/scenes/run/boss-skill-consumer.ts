/**
 * scenes/run/boss-skill-consumer.ts —— Boss 五槽运行时的场景端消费器
 * （NV-REVIEW-FIX-F W-F1：自 PlayScene 机械搬移，行为零变化）
 *
 * 职责（W-D/W-15/P0-6）：
 * - 持有 boss-skill-engine 的 BossSkillState 与 boss-skill-runtime 几何消费运行时：
 *   调度在 boss-skill-engine，zone 几何自结算在 boss-skill-runtime，本层只装配端口 + 步进。
 * - BossSkillPorts 端口装配（hurtPlayer 走守誓者转移路由 / 召唤与幻影走 spawner 出口 /
 *   Boss body 位移 / 转阶段霸体）。
 * - 月影幻影到期自散（释放 Boss 同源召唤计数）。
 * - Boss 同源召唤 tag（MN-23 死亡释放计数 / 死亡清场扫描键）与击杀收口。
 *
 * 依赖以 ports 注入（场景 create 装配完成后 attach；step 期才解引用）。
 */

import type { Player } from '@/player/player';
import type { Boss } from '@/enemies/boss';
import type { Enemy } from '@/enemies/enemy';
import {
  createBossSkillState,
  clearBossSummons,
  reportBossSummonKilled,
  bossChargingNow,
  type BossSkillState,
} from '@/enemies/boss-skill-engine';
import { BossSkillRuntime, type BossSkillPorts } from '@/enemies/boss-skill-runtime';
import type { EnemyId, BossId } from '@/config/balance';

/** 场景侧端口（箭头闭包捕获场景引用，调用期才解引用——沿袭原 bossPorts 纪律） */
export interface BossConsumerScenePorts {
  /** 技能伤独立字段（经守誓者转移路由） */
  hurtPlayer: (damage: number, now: number) => boolean;
  /** spawner 敌方技能召唤口（noXp 自动置位；tag 由消费器统一注入 BOSS_SUMMON_TAG） */
  spawnSummon: (enemyId: EnemyId, x: number, y: number, tag: string) => unknown;
  /** 幻影专用口（HP1 + noXp + 接触伤按表；不行尸面板） */
  spawnPhantom: (x: number, y: number, tag: string, contactDamage: number) => unknown;
  /** Boss body 速度端口（冲锋/拉拽位移） */
  bossBody: () => { setVelocity(x: number, y: number): void } | undefined;
  player: () => Player;
  maxEnemies: () => number;
  enemyActiveCount: () => number;
}

export class BossSkillConsumer {
  /** MN-23：Boss 同源召唤 tag（死亡释放计数/死亡清场扫描键） */
  static readonly BOSS_SUMMON_TAG = 'boss_skills';

  private p: BossConsumerScenePorts | null = null;
  /** W-D/W-15 Boss 五槽运行时状态（boss-skill-engine 调度） */
  private bossSkills: BossSkillState | null = null;
  /** P0-6：Boss 技能几何消费运行时（zone 自结算） */
  private readonly runtime = new BossSkillRuntime();
  /** 当前 Boss（6:00 出场；null = 未出场。化身 boss_4 不登记——原语义） */
  private bossRef: Boss | null = null;
  /** W-4 月影幻影到期表（hp1 实体；到期自散 → 释放 Boss 同源召唤计数） */
  private phantoms: Array<{ enemy: Enemy; until: number }> = [];
  /** P0-6：Boss 技能端口（attach 时装配） */
  private bossPorts: BossSkillPorts | null = null;

  /** 场景装配完成后注入依赖并构建 BossSkillPorts */
  attach(p: BossConsumerScenePorts): void {
    this.p = p;
    this.bossPorts = {
      hurtPlayer: (damage, now) => p.hurtPlayer(damage, now), // 技能伤独立字段（经守誓者转移路由）
      spawnSummon: (enemyId, x, y) => p.spawnSummon(enemyId, x, y, BossSkillConsumer.BOSS_SUMMON_TAG),
      spawnPhantom: (x, y, contactDamage, duration, now) => {
        // P0-6：幻影专用口（HP1 + noXp + 接触伤按表；不行尸面板）；到期自散在 stepPhantoms
        const ph = p.spawnPhantom(x, y, BossSkillConsumer.BOSS_SUMMON_TAG, contactDamage) as Enemy | null;
        if (ph) this.phantoms.push({ enemy: ph, until: now + duration });
        return ph;
      },
      pullPlayerTo: (x, y, distance) => {
        const player = p.player();
        const dx = x - player.x;
        const dy = y - player.y;
        const len = Math.hypot(dx, dy) || 1;
        player.setPosition(player.x + (dx / len) * distance, player.y + (dy / len) * distance);
      },
      setBossVelocity: (vx, vy) => p.bossBody()?.setVelocity(vx, vy),
      clearBossVelocity: () => p.bossBody()?.setVelocity(0, 0),
      onPhaseChanged: (now) => {
        if (this.bossRef?.active) this.bossRef.graceUntil = now + 1; // 转阶段霸体 1s（不承伤）
      },
    };
  }

  /** 当前 Boss（Boss 血条 / 技能区视图判定消费） */
  get boss(): Boss | null {
    return this.bossRef;
  }

  /**
   * 换 Boss/化身：登记五槽调度状态机 + 清残留技能区（P0-6）。
   * 原语义：常规 Boss 登记 bossRef；化身 boss_4 不改写 bossRef（传 null）。
   */
  beginSkills(bossId: BossId, boss: Boss | null): void {
    this.bossSkills = createBossSkillState(bossId);
    this.runtime.reset();
    if (boss) this.bossRef = boss;
  }

  /** Boss 击杀收口：召唤物静默清场（不掉 XP）+ 清残留技能区 + 状态机复位 */
  endFight(killTagged: (tag: string) => void): void {
    if (!this.bossSkills) return;
    clearBossSummons(this.bossSkills);
    killTagged(BossSkillConsumer.BOSS_SUMMON_TAG);
    this.bossSkills = null;
    this.runtime.reset();
  }

  /** MN-23：Boss 同源召唤死亡释放计数（上限 6/8 口径；非同源 tag no-op） */
  onSummonKilled(groupId: string | null | undefined): void {
    if (groupId === BossSkillConsumer.BOSS_SUMMON_TAG && this.bossSkills) {
      reportBossSummonKilled(this.bossSkills);
    }
  }

  /** P0-6：Boss 技能区视图（zone 形状 = 危险范围；boss 在场才有） */
  zoneViews(now: number): ReturnType<BossSkillRuntime['zoneViews']> {
    return this.bossRef?.active ? this.runtime.zoneViews(now) : [];
  }

  /** P0-6：Boss 持续场（血池/血雾）减速乘区（stepCompanion 消费，取最强并入 externalSlowMult） */
  externalSlowAt(x: number, y: number): number {
    return this.runtime.externalSlowAt(x, y);
  }

  /** 月影幻影到期自散（原 stepCompanion 尾段原样搬移；释放同源计数） */
  stepPhantoms(now: number): void {
    for (let i = this.phantoms.length - 1; i >= 0; i -= 1) {
      const ph = this.phantoms[i]!;
      if (now >= ph.until || !ph.enemy.active) {
        if (ph.enemy.active) ph.enemy.kill();
        this.phantoms.splice(i, 1);
      }
    }
  }

  /** 原 PlayScene.stepBossSkillRuntime：调度在 boss-skill-engine，几何结算在 boss-skill-runtime；场景仅端口 */
  step(dt: number, now: number): void {
    const boss = this.bossRef;
    const p = this.p;
    if (!boss?.active || !this.bossSkills || !p || !this.bossPorts) return;
    // P1-18：芬里厄减速 ×0.5 仅在蓄力期（冲锋/扑击预警窗口）生效，离开窗口即清除
    boss.setPhaseCcResistance(bossChargingNow(this.bossSkills) ? { slow: { durationMult: 0.5 } } : undefined);
    this.runtime.step(
      this.bossSkills,
      {
        dt,
        now,
        hpRatio: boss.hp / boss.maxHp,
        canSpawnMore: p.enemyActiveCount() < p.maxEnemies(),
      },
      boss,
      p.player(),
      this.bossPorts,
    );
  }
}
