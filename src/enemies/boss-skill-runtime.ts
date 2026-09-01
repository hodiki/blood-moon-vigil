/**
 * enemies/boss-skill-runtime.ts —— Boss 技能消费运行时（P0-6，审查结论 §P0-6）
 *
 * 审查结论：调度器（boss-skill-engine）在转 CD，结算是「dist ≤ 160/300 扣血」全图桩。
 * 本模块把 Boss 事件落成几何判定区（zone）：cast-start（普攻为直发事件）瞬间锁定形状，
 * 预警窗 = 走位窗口，fireAt 按形状结算；场景（PlayScene）只提供 hurt/spawn/fx/位移端口。
 *
 * zone 形状集（每 Boss ≥2 个可解形状：判定形状 + 预警 + 走位能躲）：
 * - arc      扇形（boss_1 普攻 120px 180°/boss_2 血浪 100px/boss_3 双爪 100px 2 段/boss_4 月鞭 160px）
 * - ring     环形带（boss_1 环形重踏 180px/boss_4 月相脉冲 300px 随机留缝——缺口内不命中）
 * - circle   落点圈（boss_2 血池 160px/boss_2 血井 3 段接力/boss_4 月坠 120px 2s 预警/扑击落地震荡）
 * - corridor 连射走廊（boss_2 血珠 3 连：260px 半宽 14，走廊内逐发、垂直走出可解）
 * - dash     冲锋线（boss_3 短嗥 400px@400px/s 走廊接触/蓄力扑击 600px@600px/s 无接触 + 落地 180px 震荡；
 *            dash 期每帧写 boss 位移覆盖，结束清覆盖回默认 AI）
 * - field    持续场（boss_2 血池 4s dps8 减速 30%/血雾 6s 减速 20%；dps 按整点经端口结算，
 *            减速由 externalSlowAt 供场景并入玩家 externalSlowMult 乘区）
 * - pull     引力圈（boss_4 引力潮汐：220px 内 fireAt 向 boss 拉 100px，圈外走位可解）
 *
 * 结算纪律：
 * - 引擎 skill-damage 事件在本模块被忽略（zone 自结算，防双倍扣血）；
 * - 幻影走 spawnPhantom 专用口（HP1 + noXp + 接触伤按表，不用行尸面板）；
 * - 禁止任何「全图 dist 桩」回归（伤害只由形状命中产生）。
 */

import { bossSkillFor, type BossId, type BossSlot, type EnemyId } from '@/config/balance';
import { stepBossSkills, type BossSkillState } from '@/enemies/boss-skill-engine';

type BossZoneShape = 'arc' | 'ring' | 'circle' | 'corridor' | 'dash' | 'field' | 'pull';

/** zone 判定区（cast-start 锁定；纯数据） */
interface BossZone {
  shape: BossZoneShape;
  slot: BossSlot;
  /** 锚点（boss 位置或玩家落点，cast-start 锁定） */
  x: number;
  y: number;
  /** 楔形/走廊/冲刺朝向（cast-start 锁定） */
  angle: number;
  /** 半径 / 走廊长度 / 环半径 / 引力半径 */
  range: number;
  /** 走廊半宽 / 环带半宽 */
  halfWidth: number;
  /** 楔形半角 */
  halfAngle: number;
  /** 环形缺口（月相脉冲） */
  gapAngle: number;
  gapHalf: number;
  /** 单次命中伤害（field/pull 恒 0） */
  damage: number;
  fireAt: number;
  /** 多段命中间隔（0 = 单段） */
  hitInterval: number;
  hitsLeft: number;
  /** 预警渐亮总时长（演出进度分母） */
  span: number;
  /** dash 专用 */
  dashSpeed: number;
  dashDistance: number;
  dashStarted: boolean;
  /** 落地震荡（扑击；dash 结束在落点 push circle） */
  landDamage: number;
  landRange: number;
  /** field 专用 */
  dps: number;
  slowPct: number;
  until: number;
  /** pull 专用 */
  pullDistance: number;
}

const BASE_ZONE: BossZone = {
  shape: 'circle',
  slot: 'normal',
  x: 0,
  y: 0,
  angle: 0,
  range: 0,
  halfWidth: 0,
  halfAngle: 0,
  gapAngle: 0,
  gapHalf: 0,
  damage: 0,
  fireAt: 0,
  hitInterval: 0,
  hitsLeft: 1,
  span: 0,
  dashSpeed: 0,
  dashDistance: 0,
  dashStarted: false,
  landDamage: 0,
  landRange: 0,
  dps: 0,
  slowPct: 0,
  until: 0,
  pullDistance: 0,
};

/** telegraph 演出视图（fx/telegraph-layer 消费；形状 = 危险范围） */
export interface BossZoneView {
  shape: 'arc' | 'ring' | 'circle' | 'corridor' | 'field';
  x: number;
  y: number;
  angle: number;
  range: number;
  halfWidth: number;
  halfAngle: number;
  gapAngle: number;
  gapHalf: number;
  /** 渐亮进度 0~1 */
  progress: number;
}

/** 场景端口（PlayScene 装配；测试用替身） */
export interface BossSkillPorts {
  /** 技能伤结算（独立字段语义；经守誓者转移路由由场景侧封装） */
  hurtPlayer(damage: number, now: number): void;
  /** 敌方技能召唤（noXp 由 spawnRuntimeSummon 统一置位） */
  spawnSummon(enemyId: EnemyId, x: number, y: number): unknown;
  /** 月影幻影专用口（P0-6：HP1 + noXp + 接触伤按表，不用行尸面板） */
  spawnPhantom(x: number, y: number, contactDamage: number, duration: number, now: number): unknown;
  /** 引力潮汐：把玩家拉向目标点 distance px */
  pullPlayerTo(x: number, y: number, distance: number): void;
  /** dash 期 boss 位移覆盖（每帧写入） */
  setBossVelocity(vx: number, vy: number): void;
  /** dash 结束清覆盖（下一帧默认 AI 重新驱动） */
  clearBossVelocity(): void;
  /** 转阶段霸体（1s 不承伤，可选） */
  onPhaseChanged?(now: number): void;
}

export interface BossStepContext {
  dt: number;
  now: number;
  /** HP 比例（引擎阶段 2 触发输入） */
  hpRatio: number;
  /** 场上敌数上限节流（引擎召唤前检查） */
  canSpawnMore: boolean;
  /** 随机源（月相脉冲缺口角度；缺省 Math.random，测试注入确定性） */
  rng?: () => number;
}

/** 夹角差（0~π） */
function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

export class BossSkillRuntime {
  private zones: BossZone[] = [];
  /** boss_1 普攻扇形/环形交替游标（gdd-enemies-v3 §③-7） */
  private normalAlternate = false;
  /** 持续场 dps 累计（≥1 结算整点，帧率无关） */
  private fractional = 0;

  /** 换 Boss/清场时重置（spawnBoss / spawnAvatar / onBossDefeated 调用） */
  reset(): void {
    this.zones = [];
    this.normalAlternate = false;
    this.fractional = 0;
  }

  /** 单帧推进：引擎调度 → 事件落 zone → zone 结算 */
  step(
    state: BossSkillState,
    ctx: BossStepContext,
    boss: { x: number; y: number },
    player: { x: number; y: number },
    ports: BossSkillPorts,
  ): void {
    const rng = ctx.rng ?? Math.random;
    const events = stepBossSkills(state, {
      dt: ctx.dt,
      now: ctx.now,
      hpRatio: ctx.hpRatio,
      canSpawnMore: ctx.canSpawnMore,
    });
    for (const ev of events) {
      if (ev.type === 'cast-start') {
        this.lockZones(state.bossId, ev.slot, ctx.now, boss, player, rng);
      } else if (ev.type === 'normal-attack') {
        // 普攻不走 casting（引擎直发）——仍给一个渐亮预警窗（config.telegraph）
        this.lockZones(state.bossId, 'normal', ctx.now, boss, player, rng);
      } else if (ev.type === 'skill-damage') {
        // 引擎伤害事件忽略：zone 在 fireAt 自结算（防双倍扣血）
      } else if (ev.type === 'summon') {
        for (let i = 0; i < ev.count; i += 1) {
          ports.spawnSummon(ev.enemyId, boss.x + (rng() - 0.5) * 120, boss.y + (rng() - 0.5) * 120);
        }
      } else if (ev.type === 'summon-phantom') {
        // P0-6：幻影专用口（HP1 + noXp + 接触伤按表；不用行尸面板）
        ports.spawnPhantom(
          player.x + (rng() - 0.5) * 100,
          player.y + (rng() - 0.5) * 100,
          ev.damage,
          ev.duration,
          ctx.now,
        );
      } else if (ev.type === 'phase-changed') {
        ports.onPhaseChanged?.(ctx.now);
      }
    }
    this.resolveZones(ctx.dt, ctx.now, boss, player, ports);
  }

  /** telegraph 演出视图（每帧全量重绘输入） */
  zoneViews(now: number): BossZoneView[] {
    const views: BossZoneView[] = [];
    const view = (shape: BossZoneView['shape'], z: BossZone): BossZoneView => {
      const progress =
        z.shape === 'field'
          ? 0.4
          : now >= z.fireAt
            ? 1
            : Math.max(0, 1 - (z.fireAt - now) / Math.max(z.span, 1e-6));
      return {
        shape,
        x: z.x,
        y: z.y,
        angle: z.angle,
        range: z.range,
        halfWidth: z.halfWidth,
        halfAngle: z.halfAngle,
        gapAngle: z.gapAngle,
        gapHalf: z.gapHalf,
        progress,
      };
    };
    for (const z of this.zones) {
      if (z.shape === 'pull') views.push(view('circle', z)); // 引力圈按落点圈语义预警
      else if (z.shape === 'dash') views.push(view('corridor', z)); // 冲锋线 = 走廊视图
      else views.push(view(z.shape, z));
    }
    return views;
  }

  /** 玩家所在点的持续场减速乘区（1 = 无减速；场景与血渍区合并取 min） */
  externalSlowAt(x: number, y: number): number {
    let mult = 1;
    for (const z of this.zones) {
      if (z.shape !== 'field' || z.slowPct <= 0) continue;
      if (Math.hypot(x - z.x, y - z.y) <= z.range) mult = Math.min(mult, 1 - z.slowPct);
    }
    return mult;
  }

  /** cast-start / 普攻直发 → 锁定几何（bossId × slot 逐表；GDD gdd-enemies-v3 §③-7） */
  private lockZones(
    bossId: BossId,
    slot: BossSlot,
    now: number,
    boss: { x: number; y: number },
    player: { x: number; y: number },
    rng: () => number,
  ): void {
    const skill = bossSkillFor(bossId, slot);
    if (!skill) return;
    const tele = Math.max(skill.telegraph, 0.3);
    const fireAt = now + tele;
    const px = player.x;
    const py = player.y;
    const angle = Math.atan2(py - boss.y, px - boss.x);
    const add = (z: Partial<BossZone>): void => {
      const base: BossZone = {
        ...BASE_ZONE,
        shape: 'circle',
        slot,
        x: boss.x,
        y: boss.y,
        angle,
        damage: skill.damage,
        fireAt,
        span: tele,
      };
      this.zones.push(Object.assign(base, z));
    };

    if (bossId === 'boss_1') {
      if (slot !== 'normal') return; // 普技 = 纯召唤槽（事件侧 spawn，无几何区）
      this.normalAlternate = !this.normalAlternate;
      if (this.normalAlternate) add({ shape: 'arc', range: 120, halfAngle: Math.PI / 2 }); // 扇形 180°
      else add({ shape: 'ring', range: 180, halfWidth: 24 }); // 环形重踏
      return;
    }
    if (bossId === 'boss_2') {
      if (slot === 'normal') add({ shape: 'arc', range: 100, halfAngle: Math.PI / 2 }); // 圣杯血浪
      else if (slot === 'skill1') {
        // 血池喷发：落点圈（cast-start 锁定）+ 4s 持续池（dps 8 + 减速 30%）
        add({ shape: 'circle', x: px, y: py, range: 160 });
        add({ shape: 'field', x: px, y: py, range: 160, dps: 8, slowPct: 0.3, until: fireAt + 4, damage: 0 });
      } else if (slot === 'skill2') {
        // 血珠连射：260px 走廊 3 连（垂直走出走廊可解）
        add({ shape: 'corridor', range: 260, halfWidth: 14, hitsLeft: 3, hitInterval: 0.25 });
      } else if (slot === 'skill3') {
        // 血雾领域：boss 锚定 220px 6s 持续场（减速 20%）
        add({ shape: 'field', range: 220, slowPct: 0.2, until: fireAt + 6, damage: 0 });
      } else if (slot === 'ultimate') {
        // 血井喷涌：3 段接力血池（向玩家方向逐段推进，逐段可解）
        for (let i = 0; i < 3; i += 1) {
          add({ shape: 'circle', x: px + Math.cos(angle) * 90 * i, y: py + Math.sin(angle) * 90 * i, range: 120, fireAt: fireAt + i * 0.8 });
        }
      }
      return;
    }
    if (bossId === 'boss_3') {
      if (slot === 'normal') {
        // 双爪连击：100px 扇形 2 段（总伤 = 面板 30）
        add({ shape: 'arc', range: 100, halfAngle: Math.PI / 2, damage: skill.damage / 2, hitsLeft: 2, hitInterval: 0.25 });
      } else if (slot === 'skill1') {
        // 短嗥冲锋：400px@400px/s，走廊半宽 24 接触一次
        add({ shape: 'dash', dashDistance: 400, dashSpeed: 400, halfWidth: 24 });
      } else if (slot === 'ultimate') {
        // 蓄力扑击：600px@600px/s（无接触）+ 落地 180px 震荡圈
        add({ shape: 'dash', dashDistance: 600, dashSpeed: 600, halfWidth: 0, damage: 0, landDamage: skill.damage, landRange: 180 });
      }
      return; // skill2 召唤 / skill3 狼嚎增益（演出内容批，无几何区）
    }
    if (bossId === 'boss_4') {
      if (slot === 'normal') add({ shape: 'arc', range: 160, halfAngle: Math.PI / 3 }); // 月鞭 160px 弧形
      else if (slot === 'skill2') add({ shape: 'pull', range: 220, pullDistance: 100, damage: 0 }); // 引力潮汐
      else if (slot === 'skill3') {
        // 月相脉冲：300px 环带随机留缝（≈90px 弧长缝，站缝可解）
        add({ shape: 'ring', range: 300, halfWidth: 30, gapAngle: rng() * Math.PI * 2, gapHalf: 0.15 });
      } else if (slot === 'ultimate') add({ shape: 'circle', x: px, y: py, range: 120 }); // 月坠：2s 预警落点圈
      return; // skill1 = 月影幻影（事件侧专用口）
    }
  }

  /** zone 逐帧结算（形状命中才扣血；禁止全图 dist 桩） */
  private resolveZones(dt: number, now: number, boss: { x: number; y: number }, player: { x: number; y: number }, ports: BossSkillPorts): void {
    for (let i = this.zones.length - 1; i >= 0; i -= 1) {
      const z = this.zones[i]!;
      if (z.shape === 'field') {
        if (now >= z.until) {
          this.zones.splice(i, 1);
          continue;
        }
        if (z.dps > 0 && Math.hypot(player.x - z.x, player.y - z.y) <= z.range) {
          this.fractional += z.dps * dt;
          if (this.fractional >= 1) {
            const whole = Math.floor(this.fractional);
            ports.hurtPlayer(whole, now);
            this.fractional -= whole;
          }
        }
        continue;
      }
      if (z.shape === 'dash') {
        const dur = z.dashDistance / z.dashSpeed;
        if (now < z.fireAt) continue;
        if (now < z.fireAt + dur) {
          if (!z.dashStarted) {
            // 起跳点 = 释放瞬间实际位置（方向/距离已在 cast-start 锁定）
            z.dashStarted = true;
            z.x = boss.x;
            z.y = boss.y;
          }
          ports.setBossVelocity(Math.cos(z.angle) * z.dashSpeed, Math.sin(z.angle) * z.dashSpeed);
          if (z.halfWidth > 0 && z.hitsLeft > 0 && this.inDashCorridor(z, player)) {
            z.hitsLeft -= 1;
            ports.hurtPlayer(z.damage, now);
          }
        } else {
          ports.clearBossVelocity();
          if (z.landRange > 0) {
            const endX = z.x + Math.cos(z.angle) * z.dashDistance;
            const endY = z.y + Math.sin(z.angle) * z.dashDistance;
            this.zones.push({
              ...BASE_ZONE,
              shape: 'circle',
              slot: z.slot,
              x: endX,
              y: endY,
              range: z.landRange,
              damage: z.landDamage,
              fireAt: now,
              span: 0,
            });
          }
          this.zones.splice(i, 1);
        }
        continue;
      }
      // arc / circle / ring / corridor / pull：fireAt 命中判定
      if (now < z.fireAt) continue;
      if (this.zoneHits(z, player)) {
        if (z.shape === 'pull') ports.pullPlayerTo(z.x, z.y, z.pullDistance);
        else ports.hurtPlayer(z.damage, now);
      }
      z.hitsLeft -= 1;
      if (z.hitsLeft <= 0) this.zones.splice(i, 1);
      else z.fireAt = now + Math.max(z.hitInterval, 1 / 60);
    }
  }

  /** 形状命中判定（1D/2D 几何；全图 dist 桩的否定面） */
  private zoneHits(z: BossZone, player: { x: number; y: number }): boolean {
    const dx = player.x - z.x;
    const dy = player.y - z.y;
    const dist = Math.hypot(dx, dy);
    switch (z.shape) {
      case 'circle':
      case 'pull':
        return dist <= z.range;
      case 'arc':
        return dist <= z.range && angleDiff(Math.atan2(dy, dx), z.angle) <= z.halfAngle;
      case 'ring':
        // 环带内且不在缺口（缺口内走位可解）
        return Math.abs(dist - z.range) <= z.halfWidth && angleDiff(Math.atan2(dy, dx), z.gapAngle) > z.gapHalf;
      case 'corridor': {
        const t = Math.max(0, Math.min(z.range, dx * Math.cos(z.angle) + dy * Math.sin(z.angle)));
        return Math.hypot(dx - Math.cos(z.angle) * t, dy - Math.sin(z.angle) * t) <= z.halfWidth;
      }
      default:
        return false;
    }
  }

  /** dash 走廊接触判定（沿已突进路径的线段半宽） */
  private inDashCorridor(z: BossZone, player: { x: number; y: number }): boolean {
    const dx = player.x - z.x;
    const dy = player.y - z.y;
    const dirX = Math.cos(z.angle);
    const dirY = Math.sin(z.angle);
    const traveled = Math.max(0, Math.min(z.dashDistance, dx * dirX + dy * dirY));
    return Math.hypot(dx - dirX * traveled, dy - dirY * traveled) <= z.halfWidth;
  }
}
