/**
 * active-skill/derivative/derivative-skills.ts —— 8 衍生技效果层（B2-W2，gdd-exclusive-weapons §3.3/§4.8）
 *
 * 衍生技 = 落选专武的技形态（R2-6 旧 4 技退役后替代）：效果**纯函数注册表**，
 * 施法输入复用现有按键/移动端技能按钮（ActiveSkill 控制器 CD/充能/100ms 防抖骨架保留可复用，
 * PlayScene 装配切换在 B5 开局重写收拢——本批提供系统层 + 测试 + 沙盘口径）。
 *
 * CC 一律走状态层 applyStatus（§4.8 对照表；Boss 免疫/精英 ×0.5 由 resolveCcResistance 天然生效）。
 * EG-9：DPS 占比口径从 ≤15% 硬线修订为 12~18% 锚（逐技 shareAnchor；遥测断言见测试）。
 */

import { DERIVATIVE_SKILLS, type DerivativeSkillId } from '@/config/balance';
import { applyStatus } from '@/combat/status/status-engine';
import { hitEnemy } from '@/combat/damage';
import { setInfiniteWindow, type AmmoState } from '@/weapons/ammo';
import type { ExclusiveTarget } from '@/weapons/exclusive/exclusive-math';

/** 衍生技施放入参（PlayScene/沙盘装配；目标集合由调用方按半径/路径筛出） */
export interface DerivativeCastContext {
  now: number;
  player: { x: number; y: number; hp: number; maxHp: number };
  /** 目标集合（CC/伤害结算候选；调用方完成空间筛选或全量传入由效果函数筛选） */
  enemies: readonly ExclusiveTarget[];
  /** 玩家回复落点（返回实际回复量） */
  healSink?: (amount: number) => void;
  /** 守誓者引用（dv_requiem：回满/墓碑复活充满；未带 = 跳过协同段） */
  companion?: { healFull(): void; fillReviveProgress(): void };
  /** 左轮弹巢引用（dv_lantern_flash：补满 + 5s 无限弹；未带 = 跳过弹药段） */
  ammo?: AmmoState;
  /** B6-W4 P4 形态挂点：贯月审判图腾落点（up_d_snipe；PlayScene 注入 → R-4 totem 持续段） */
  totemSink?: (x: number, y: number) => void;
  /** B6-W4 P4 形态挂点：终审庭余焰登记（up_d_judgment → R-6 residues 持续段） */
  residueSink?: (x: number, y: number) => void;
  /**
   * P1-14 审判光环：5s 治疗光环 3 HP/s（旧实现一次性结算 3 HP；GDD §4.5 为持续段）。
   * 由调用方按帧 tick，未注入时退化为一次性首帧结算（沙盘兼容）。
   */
  auraSink?: (healPerSec: number, duration: number) => void;
  /** P0-7e 射速爆发落点（dv_lantern_flash：4s ×1.5 → 左轮/提灯攻击间隔） */
  fireRateSink?: (mult: number, duration: number) => void;
}

export interface DerivativeCastResult {
  damageDealt: number;
  kills: number;
  /** 结算事件（遥测/表现层：stunned/slowed/vulnerable/dash/heal/charged/wolfFrenzy） */
  events: string[];
  /**
   * P1-14 突进落点（血影突袭）：最密方向 × 突进距离。调用方负责位移（走位合法性判定在场景层），
   * 未注入能力（沙盘）时可忽略——命中结算已在效果层完成。
   */
  dash?: { x: number; y: number; dirX: number; dirY: number; distance: number };
}

function emptyResult(): DerivativeCastResult {
  return { damageDealt: 0, kills: 0, events: [] };
}

/** 击杀计数包装 */
function dealDamage(target: ExclusiveTarget, amount: number, now: number, result: DerivativeCastResult): void {
  if (!target.active || target.hp <= 0) return;
  const before = target.hp;
  // P0-3：走 damage.hitEnemy 唯一入口（易伤乘区在内结算）
  const killed = hitEnemy(target as unknown as { hp: number; kill(): void }, amount, now);
  if (killed) result.kills += 1;
  result.damageDealt += before - target.hp;
}

/**
 * 施放衍生技（纯函数总入口；按 id 分派到各技结算）。
 * CD 计时/充能/占比遥测由 DerivativeSkillController 承载（DERIVATIVE_SKILLS[id].cd）。
 * paramsOverride = P4 强化卡参数覆写（B5-W4 衍生技控制器消费；未传 = 基准参数）。
 */
export function castDerivative(id: DerivativeSkillId, ctx: DerivativeCastContext, paramsOverride: Readonly<Record<string, number>> = {}): DerivativeCastResult {
  const cfg = DERIVATIVE_SKILLS[id];
  const P = { ...cfg.params, ...paramsOverride } as Readonly<Record<string, number>>;
  switch (id) {
    case 'dv_revolver_burst':
      return castRevolverBurst(P, ctx);
    case 'dv_lantern_flash':
      return castLanternFlash(P, ctx);
    case 'dv_blood_dash':
      return castBloodDash(P, ctx);
    case 'dv_moon_snipe':
      return castMoonSnipe(P, ctx);
    case 'dv_requiem':
      return castRequiem(P, ctx);
    case 'dv_holy_judgment':
      return castHolyJudgment(P, ctx);
    case 'dv_blood_rage':
      return castBloodRage(P, ctx);
    case 'dv_wolf_charge':
      return castWolfCharge(P, ctx);
  }
}

/** 圣徒左轮技：6 连射 12 伤/发（调用方按 shotInterval 分帧或一次性结算）+ 末段圣痕易伤 15%/6s */
function castRevolverBurst(p: Readonly<Record<string, number>>, ctx: DerivativeCastContext): DerivativeCastResult {
  const result = emptyResult();
  // 即时近似：6 发全按路径首目标结算（分帧逐发 = PlayScene 演出段，B6）
  const targets = aliveByDistance(ctx.enemies, ctx.player.x, ctx.player.y);
  for (let i = 0; i < p['shots']!; i += 1) {
    const target = targets[i % Math.max(1, targets.length)];
    if (!target) break;
    dealDamage(target, p['damage']!, ctx.now, result);
  }
  // 末段命中挂圣痕（+15%/6s，易伤走状态层）
  const last = targets[0];
  if (last?.cc) {
    last.cc = applyStatus(last.cc, { kind: 'vulnerable', value: p['vulnerable']!, durationSeconds: p['vulnerableDuration']!, source: 'dv_revolver_burst' }, ctx.now).state;
    result.events.push('vulnerable');
    // B6-W4 up_d_revolver 圣痕传染：命中传染周围 80px 敌人（持续减半 3s）
    if ((p['infectRadius'] ?? 0) > 0) {
      const rSq = (p['infectRadius'] ?? 80) ** 2;
      for (const e of ctx.enemies) {
        if (!e.active || e.hp <= 0 || !e.cc || e === last) continue;
        const dx = e.x - last.x;
        const dy = e.y - last.y;
        if (dx * dx + dy * dy > rSq) continue;
        e.cc = applyStatus(e.cc, { kind: 'vulnerable', value: p['vulnerable']!, durationSeconds: p['infectDuration'] ?? 3, source: 'dv_revolver_burst_infect' }, ctx.now).state;
        result.events.push('infect');
      }
    }
  }
  return result;
}

/** 破旧提灯技：周身眩晕（Boss 免疫/精英×0.5 走状态层）+ 射速爆发 + 补满弹巢 + 5s 无限弹 */
function castLanternFlash(p: Readonly<Record<string, number>>, ctx: DerivativeCastContext): DerivativeCastResult {
  const result = emptyResult();
  for (const e of ctx.enemies) {
    if (!e.active || e.hp <= 0) continue;
    if (e.cc) e.cc = applyStatus(e.cc, { kind: 'stun', value: 1, durationSeconds: p['stunDuration']!, source: 'dv_lantern_flash' }, ctx.now, e.ccProfile).state;
    if (e.cc) {
      // Boss 免疫 → applied=false；遥测 immune 计数可后接（§⑧-5）
      result.events.push('stunApplied');
    }
  }
  // P0-7e 射速爆发（4s ×1.5）：落到专武行为的攻击间隔乘区（旧实现只 push 事件，无消费者）
  ctx.fireRateSink?.(p['fireRateMult']!, p['fireRateDuration']!);
  result.events.push('fireRateBurst');
  if (ctx.ammo) {
    // 立即补满 + 5s 无限弹（setInfiniteWindow 内含补满）
    setInfiniteWindow(ctx.ammo, ctx.now + p['infiniteAmmoDuration']!);
    result.events.push('infiniteAmmo');
  }
  return result;
}

/**
 * 血影突袭（P1-14 语义修正：旧实现 = 最近 5 敌即时结算，与「向敌群最密方向突进」不符）：
 * 1) 方向 = 走廊内敌密度最高的方向（近者权重高）；2) 命中 = 突进走廊内全部敌；
 * 3) 落点 = 玩家坐标 + 方向 × 距离（由调用方执行位移）；4) 血契印记易伤 15%/5s。
 */
function castBloodDash(p: Readonly<Record<string, number>>, ctx: DerivativeCastContext): DerivativeCastResult {
  const result = emptyResult();
  const distance = p['dashDistance']!;
  const dir = densestDashDirection(ctx.enemies, ctx.player.x, ctx.player.y, DASH_SCAN_RANGE, DASH_CORRIDOR_HALF_WIDTH);
  const path = dashPathTargets(ctx.enemies, ctx.player.x, ctx.player.y, dir, distance, DASH_CORRIDOR_HALF_WIDTH);
  let hits = 0;
  for (const t of path) {
    dealDamage(t, p['damage']!, ctx.now, result);
    hits += 1;
    if (t.cc) {
      t.cc = applyStatus(t.cc, { kind: 'vulnerable', value: p['vulnerable']!, durationSeconds: p['vulnerableDuration']!, source: 'dv_blood_dash' }, ctx.now).state;
      result.events.push('vulnerable');
    }
  }
  result.events.push('dash');
  const endX = ctx.player.x + dir.x * distance;
  const endY = ctx.player.y + dir.y * distance;
  result.dash = { x: endX, y: endY, dirX: dir.x, dirY: dir.y, distance };
  // up_d_dash 血宴：突进**终点**血爆（25 伤/120px）+ 每命中 1 敌回 1 HP（P4 形态，锚）
  if ((p['burstDamage'] ?? 0) > 0) {
    const rSq = (p['burstRadius'] ?? 120) ** 2;
    for (const e of ctx.enemies) {
      if (!e.active || e.hp <= 0) continue;
      const dx = e.x - endX;
      const dy = e.y - endY;
      if (dx * dx + dy * dy > rSq) continue;
      dealDamage(e, p['burstDamage']!, ctx.now, result);
    }
    ctx.healSink?.((p['healPerHit'] ?? 1) * hits);
    result.events.push('bloodBurst');
  }
  return result;
}

/** 突进扫描射程（> dashDistance：允许跨越 200px 走廊外的敌参与密度投票） */
export const DASH_SCAN_RANGE = 260;
/** 突进走廊半宽（工程锚 60px：与近战专武 120~160px 手感区分） */
export const DASH_CORRIDOR_HALF_WIDTH = 60;

/**
 * 敌群最密方向（16 向均匀采样）：走廊（半宽 halfWidth）+ 射程内敌按「近者权重高」计分，
 * 取最高分方向；全空返回 +X（保持确定性，便于单测）。
 */
export function densestDashDirection(
  enemies: readonly { readonly active: boolean; readonly hp: number; readonly x: number; readonly y: number }[],
  x: number,
  y: number,
  range = DASH_SCAN_RANGE,
  halfWidth = DASH_CORRIDOR_HALF_WIDTH,
): { x: number; y: number } {
  const samples = 16;
  let bestScore = 0;
  let bestX = 1;
  let bestY = 0;
  for (let i = 0; i < samples; i += 1) {
    const angle = (i / samples) * Math.PI * 2;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let score = 0;
    for (const e of enemies) {
      if (!e.active || e.hp <= 0) continue;
      const ex = e.x - x;
      const ey = e.y - y;
      const along = ex * dx + ey * dy;
      if (along <= 0 || along > range) continue; // 背向 / 超程不计入
      if (Math.abs(ex * -dy + ey * dx) > halfWidth) continue; // 走廊外不计入
      score += 1 + (1 - along / range);
    }
    if (score > bestScore) {
      bestScore = score;
      bestX = dx;
      bestY = dy;
    }
  }
  return { x: bestX, y: bestY };
}

/** 突进走廊内目标（沿方向 0~distance 的带状区域；距玩家升序） */
export function dashPathTargets<T extends { readonly active: boolean; readonly hp: number; readonly x: number; readonly y: number }>(
  enemies: readonly T[],
  x: number,
  y: number,
  dir: { x: number; y: number },
  distance: number,
  halfWidth = DASH_CORRIDOR_HALF_WIDTH,
): T[] {
  const hits: Array<{ e: T; along: number }> = [];
  for (const e of enemies) {
    if (!e.active || e.hp <= 0) continue;
    const ex = e.x - x;
    const ey = e.y - y;
    const along = ex * dir.x + ey * dir.y;
    if (along < 0 || along > distance) continue;
    if (Math.abs(ex * -dir.y + ey * dir.x) > halfWidth) continue;
    hits.push({ e, along });
  }
  return hits.sort((a, b) => a.along - b.along).map((h) => h.e);
}

/**
 * 月痕狙击：1.2s 蓄力（P1-14：蓄力段由 DerivativeSkillController 承载，蓄满后才进本函数结算）
 * → 60 伤全贯穿巨矢 + 首个命中眩晕 1s（Boss 免疫 / 精英 ×0.5）。
 */
function castMoonSnipe(p: Readonly<Record<string, number>>, ctx: DerivativeCastContext): DerivativeCastResult {
  const result = emptyResult();
  // 全贯穿：路径全量敌结算（即时近似按距离序）
  const targets = aliveByDistance(ctx.enemies, ctx.player.x, ctx.player.y);
  let first = true;
  for (const t of targets) {
    dealDamage(t, p['damage']!, ctx.now, result);
    if (first) {
      first = false;
      if (t.cc) {
        t.cc = applyStatus(t.cc, { kind: 'stun', value: 1, durationSeconds: p['stunDuration']!, source: 'dv_moon_snipe' }, ctx.now, t.ccProfile).state;
        result.events.push('stunApplied');
      }
    }
  }
  // B6-W4 up_d_snipe 贯月审判：巨矢命中处残留月痕图腾（60px 减速 15%/3s——减速段走 R-4 图腾持续层）
  if (ctx.totemSink && (p['totemRadius'] ?? 0) > 0 && targets[0]) {
    ctx.totemSink(targets[0].x, targets[0].y);
    result.events.push('totem');
  }
  result.events.push('charged');
  return result;
}

/** 安魂曲：周身减速 30%/3s + 回复 20 HP + 守誓者回满/墓碑复活充满 */
function castRequiem(p: Readonly<Record<string, number>>, ctx: DerivativeCastContext): DerivativeCastResult {
  const result = emptyResult();
  for (const e of ctx.enemies) {
    if (!e.active || e.hp <= 0) continue;
    if (e.cc) e.cc = applyStatus(e.cc, { kind: 'slow', value: p['slowPct']!, durationSeconds: p['slowDuration']!, source: 'dv_requiem' }, ctx.now, e.ccProfile).state;
    result.events.push('slowed');
  }
  ctx.healSink?.(p['heal']!);
  result.events.push('heal');
  if (ctx.companion) {
    ctx.companion.healFull();
    ctx.companion.fillReviveProgress();
    result.events.push('companionRestored');
  }
  return result;
}

/** 圣辉审判：160px 半径 50 伤 + 眩晕 2s + 5s 治疗光环 3 HP/s（光环 tick 由行为层持续段处理） */
function castHolyJudgment(p: Readonly<Record<string, number>>, ctx: DerivativeCastContext): DerivativeCastResult {
  const result = emptyResult();
  const rSq = p['radius']! * p['radius']!;
  for (const e of ctx.enemies) {
    if (!e.active || e.hp <= 0) continue;
    const dx = e.x - ctx.player.x;
    const dy = e.y - ctx.player.y;
    if (dx * dx + dy * dy > rSq) continue;
    dealDamage(e, p['damage']!, ctx.now, result);
    if (e.cc) {
      e.cc = applyStatus(e.cc, { kind: 'stun', value: 1, durationSeconds: p['stunDuration']!, source: 'dv_holy_judgment' }, ctx.now, e.ccProfile).state;
      result.events.push('stunApplied');
    }
  }
  // B6-W4 up_d_judgment 终审庭：眩晕命中处追加余焰（100px 8伤/s/3s——持续段走 R-6 residues 层）
  if (ctx.residueSink) {
    for (const e of ctx.enemies) {
      if (!e.active || e.hp <= 0) continue;
      ctx.residueSink(e.x, e.y);
    }
    result.events.push('residue');
  }
  // P1-14：5s 治疗光环 3 HP/s = 持续段（调用方按帧 tick；未注入 auraSink 时退化为首帧一次性结算）
  const perSec = p['healAuraPerSec'] ?? 3;
  const duration = p['healAuraDuration'] ?? 5;
  if (ctx.auraSink) ctx.auraSink(perSec, duration);
  else ctx.healSink?.(perSec * duration * 0.2);
  result.events.push('healAura');
  return result;
}

/** 血月狂化：6s 自增益（伤害 +40%/挥击不耗 HP/移速 +15%）——无 CC（§4.8） */
function castBloodRage(p: Readonly<Record<string, number>>, ctx: DerivativeCastContext): DerivativeCastResult {
  const result = emptyResult();
  // 自增益窗口由行为层 rageUntil 消费（巨斧 stepAxe 经 machine.selfHpCost=0 + 伤害加成并入）
  result.events.push('rage');
  void p;
  void ctx;
  return result;
}

/** 月啸冲锋：3 狼影全屏直线 30 伤 + 击退 100px（位移非状态）+ 加尔文狂化 4s */
function castWolfCharge(p: Readonly<Record<string, number>>, ctx: DerivativeCastContext): DerivativeCastResult {
  const result = emptyResult();
  const wolves = p['wolves']!;
  const targets = aliveByDistance(ctx.enemies, ctx.player.x, ctx.player.y);
  const hitCount = new Map<ExclusiveTarget, number>();
  for (let w = 0; w < wolves; w += 1) {
    const target = targets[w % Math.max(1, targets.length)];
    if (!target) break;
    // B6-W4 up_d_charge 群狼环猎：环形包抄命中同一目标伤 ×1.5（第 2 发起）
    const hits = (hitCount.get(target) ?? 0) + 1;
    hitCount.set(target, hits);
    const mult = hits >= 2 ? p['packFocusMult'] ?? 1.5 : 1;
    dealDamage(target, p['damage']! * mult, ctx.now, result);
    // 击退 100px（位移，非状态层枚举——运行时由碰撞体执行）
    result.events.push('knockback');
  }
  // P1-14：月啸冲锋的「加尔文狂化 4s（攻速）」与血月狂化 6s 是两个 buff，不再共用 'rage'
  result.events.push('wolfFrenzy');
  return result;
}

/** 距玩家距离升序的活跃目标 */
function aliveByDistance(enemies: readonly ExclusiveTarget[], x: number, y: number): ExclusiveTarget[] {
  return enemies
    .filter((e) => e.active && e.hp > 0)
    .sort((a, b) => distSq(a.x, a.y, x, y) - distSq(b.x, b.y, x, y));
}

function distSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** 衍生技 CD 查询（控制器装配数据源） */
export function derivativeCd(id: DerivativeSkillId): number {
  return DERIVATIVE_SKILLS[id].cd;
}

/** P1-14 蓄力时长查询（秒；0 = 瞬发。月痕狙击 1.2s，GDD §4.3） */
export function derivativeChargeTime(id: DerivativeSkillId): number {
  return DERIVATIVE_SKILLS[id].params['chargeTime'] ?? 0;
}

/** EG-9 占比锚查询（遥测断言口径 12~18%） */
export function derivativeShareAnchor(id: DerivativeSkillId): readonly [number, number] {
  return DERIVATIVE_SKILLS[id].shareAnchor;
}
