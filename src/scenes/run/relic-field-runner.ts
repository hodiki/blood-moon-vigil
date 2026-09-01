/**
 * scenes/run/relic-field-runner.ts —— 圣物局内运行时 + 祭坛占位 + 持续伤害/治疗场
 * （NV-REVIEW-FIX-F W-F1：自 PlayScene 机械搬移，行为零变化）
 *
 * 职责（P0-1）：
 * - RelicDirector 释放入口（桌面 Q / 移动端第二技能钮；相位门禁在场景层）与效果上下文装配
 *   （敌集合 + 伤害/回血/减伤/银雨端口；走唯一伤害入口 hitEnemy）。
 * - 祭坛占位：局内 150s 落一次可交互点（最小实现；交互半径 60px，ALTAR_CHANCE 0.5 概率第 2 枚）。
 * - HUD 同步（CD 环 + 剩余次数 1~2；未持有圣物 = 隐藏）。
 * - 银潮汐落场银雨（8s 灼烧场）与十二灯誓约承伤减免窗口到期复位。
 *
 * 依赖以 ports 注入（场景 create 装配完成后 attach；step/释放期才解引用）。
 */

import { RELICS } from '@/config/balance';
import { GameEvents, GameEvent } from '@/core/events';
import { hitEnemy } from '@/combat/damage';
import type { RelicDirector } from '@/relics/relic-runtime';
import type { RelicEffectContext } from '@/relics/relic-engine';
import type { FxManager } from '@/fx/fx-manager';
import type { Hud } from '@/ui/hud';
import type { PlayerStats } from '@/player/player-stats';

/** 场景侧端口（闭包捕获场景引用，调用期解引用——沿袭原箭头端口纪律） */
export interface RelicFieldPorts {
  isRunning: () => boolean;
  nowSeconds: () => number;
  playerX: () => number;
  playerY: () => number;
  stats: () => PlayerStats;
  eachActiveEnemy: (fn: (e: { active: boolean; hp: number; x: number; y: number; kill(): void }) => void) => void;
  fx: () => FxManager;
  hud: () => Hud;
  elapsedSeconds: () => number;
  mapSize: () => { width: number; height: number };
  /** 祭坛标记生成（scene.add.circle + 描边 + depth 20） */
  addAltarMarker: (x: number, y: number) => { destroy(): void };
  recordRelicDamage: (amount: number) => void;
}

/** P0-1 祭坛占位常量（局内 150s 落一次可交互点；交互半径 60px） */
const ALTAR_SPAWN_SECONDS = 150;
const ALTAR_INTERACT_RADIUS = 60;
const ALTAR_OFFSET_PX = 260;

export class RelicFieldRunner {
  private p: RelicFieldPorts | null = null;
  /** P0-1 圣物局内运行时（Boss 渠道保底 1 + 祭坛概率第 2；CD 240s / 每枚 1 次） */
  readonly relics: RelicDirector;
  /** P0-1 祭坛占位（地图事件最小实现：单次交互点，走 ALTAR_CHANCE 概率第 2 枚） */
  private altar: { x: number; y: number; marker: { destroy(): void } | null; used: boolean } | null = null;
  /** P0-1 银潮汐落场银雨（8s 灼烧场；伤害段不进 DPS 预算主线） */
  private silverRain: { x: number; y: number; radius: number; dps: number; until: number } | null = null;
  /** P0-1 十二灯誓约：承伤 −20% 窗口（到期从 PlayerStats 减伤池扣回） */
  private relicDrUntil = 0;
  private relicDrAmount = 0;

  constructor(relics: RelicDirector) {
    this.relics = relics;
  }

  attach(ports: RelicFieldPorts): void {
    this.p = ports;
  }

  /** P0-1 圣物层 per-run 复位（scene.restart 复用实例；祭坛标记显式销毁防残留在场） */
  resetRun(): void {
    this.relics.reset();
    this.altar?.marker?.destroy();
    this.altar = null;
    this.silverRain = null;
  }

  /**
   * P0-1 圣物释放入口（桌面 Q / 移动端第二技能钮 → 同一入口；相位门禁在场景层）。
   * 取第一枚可用（未用过 + CD 就绪）→ useRelic（used 置位 + CD 240s + 效果结算）。
   */
  tryUseRelic(): void {
    const p = this.p;
    if (!p || !p.isRunning()) return;
    const now = p.nowSeconds();
    const id = this.relics.tryUse(now, this.buildRelicEffectContext(now));
    if (!id) return;
    this.syncRelicHud(now);
    // 演出（≥1.5s 全屏级；本批用现有特效层做 1.5s 级可见反馈，精致化归 B6 表现批）
    p.fx().lanternFlash(p.playerX(), p.playerY(), 260);
    if (RELICS[id].powerTag === 'BEAST') p.fx().rageBurst(p.playerX(), p.playerY());
  }

  /** P0-1 圣物效果上下文（敌集合 + 伤害/回血/减伤/银雨端口；走唯一伤害入口 hitEnemy） */
  private buildRelicEffectContext(now: number): RelicEffectContext {
    const p = this.p!;
    const enemies: Array<{ readonly active: boolean; hp: number }> = [];
    p.eachActiveEnemy((e) => enemies.push(e));
    return {
      player: { x: p.playerX(), y: p.playerY() },
      enemies: enemies as unknown as RelicEffectContext['enemies'],
      healSink: (amount: number) => {
        const applied = p.stats().heal(amount);
        if (applied > 0) GameEvents.emit(GameEvent.HpChanged, { hp: p.stats().hp, maxHp: p.stats().maxHp });
      },
      damageReductionSink: (pct, duration) => {
        p.stats().addDamageReduction(pct);
        this.relicDrUntil = now + duration;
        this.relicDrAmount = pct;
      },
      damageSink: (target, amount) => {
        const before = (target as { hp: number }).hp;
        hitEnemy(target as unknown as { hp: number; kill(): void }, amount, now);
        p.recordRelicDamage(Math.max(0, before - (target as { hp: number }).hp));
      },
      // P0-1 银潮汐落场银雨（GDD 尾章 #4；禁止空技能）
      silverRainSink: (radius, dps, duration) => {
        this.silverRain = { x: p.playerX(), y: p.playerY(), radius, dps, until: now + duration };
      },
    };
  }

  /** P0-1 HUD 同步（CD 环 + 剩余次数 1~2；未持有圣物 = 隐藏） */
  syncRelicHud(now: number): void {
    const p = this.p;
    if (!p) return;
    const slot = this.relics.nextUsableAt(now) ?? this.relics.slotsAt(now)[0] ?? null;
    p.hud().setRelic(slot ? { name: slot.name, cdRemaining: slot.cdRemaining, cdSeconds: slot.cdSeconds } : null, this.relics.usesLeft());
  }

  /** P0-1 祭坛占位：局内一次性可交互点（ALTAR_CHANCE 概率第 2 枚；不足 = 祭坛冷熄） */
  stepAltar(now: number): void {
    const p = this.p;
    if (!p) return;
    if (this.altar) {
      if (this.altar.used) return;
      const near = Math.hypot(p.playerX() - this.altar.x, p.playerY() - this.altar.y) <= ALTAR_INTERACT_RADIUS;
      if (!near) return;
      this.altar.used = true;
      this.altar.marker?.destroy();
      this.altar.marker = null;
      const rolled = this.relics.interactAltar();
      // 祭坛占位无文本表（叙事句归内容批）：命中 = 金光爆点 + HUD 出槽，未中 = 冷熄（无反馈）
      if (rolled.granted && rolled.relic) p.fx().levelUpBurst(this.altar.x, this.altar.y);
      this.syncRelicHud(now);
      return;
    }
    if (p.elapsedSeconds() < ALTAR_SPAWN_SECONDS) return;
    const cfg = p.mapSize();
    const angle = p.elapsedSeconds() % (Math.PI * 2);
    const x = Math.max(40, Math.min(cfg.width - 40, p.playerX() + Math.cos(angle) * ALTAR_OFFSET_PX));
    const y = Math.max(40, Math.min(cfg.height - 40, p.playerY() + Math.sin(angle) * ALTAR_OFFSET_PX));
    const marker = p.addAltarMarker(x, y);
    this.altar = { x, y, marker, used: false };
  }

  /**
   * P0-1 银潮汐落场银雨 + 十二灯誓约窗口复位（原 stepPersistentFields 尾两段；
   * 审判光环段为衍生技状态，由场景/DerivativeCastBridge 承接）。
   * （1s 结算节拍，工程锚）
   */
  stepFields(dt: number, now: number): void {
    const p = this.p;
    if (!p) return;
    // 银雨（银潮汐圣物：8s 灼烧场；伤害计入圣物占比遥测，红线 <5%）
    if (this.silverRain) {
      if (now >= this.silverRain.until) this.silverRain = null;
      else {
        const field = this.silverRain;
        const rSq = field.radius * field.radius;
        p.eachActiveEnemy((e) => {
          if (!e.active || e.hp <= 0) return;
          const dx = e.x - field.x;
          const dy = e.y - field.y;
          if (dx * dx + dy * dy > rSq) return;
          const before = e.hp;
          hitEnemy(e as unknown as { hp: number; kill(): void }, field.dps * dt, now);
          p.recordRelicDamage(Math.max(0, before - e.hp));
          p.fx().orbitHit(e.x, e.y, now); // 银光爆点（GDD 尾章「对血族类生成银光爆点」演出）
        });
      }
    }
    // 十二灯誓约承伤减免窗口到期复位（RELIC 效果由减伤池承载）
    if (this.relicDrUntil > 0 && now >= this.relicDrUntil) {
      this.relicDrUntil = 0;
      p.stats().addDamageReduction(-this.relicDrAmount);
      this.relicDrAmount = 0;
    }
  }
}
