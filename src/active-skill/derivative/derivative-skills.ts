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
}

export interface DerivativeCastResult {
  damageDealt: number;
  kills: number;
  /** 结算事件（遥测/表现层：stunned/slowed/vulnerable/dash/heal/charged） */
  events: string[];
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
  // 射速爆发（4s ×1.5）：落武器派生参数（行为层 fireRateUntil 消费；本批经 ammo/事件登记口径）
  result.events.push('fireRateBurst');
  if (ctx.ammo) {
    // 立即补满 + 5s 无限弹（setInfiniteWindow 内含补满）
    setInfiniteWindow(ctx.ammo, ctx.now + p['infiniteAmmoDuration']!);
    result.events.push('infiniteAmmo');
  }
  return result;
}

/** 血影突袭：突进 200px 沿途斩击 15 伤/段 + 血契印记易伤 15%/5s */
function castBloodDash(p: Readonly<Record<string, number>>, ctx: DerivativeCastContext): DerivativeCastResult {
  const result = emptyResult();
  // 即时近似：突进路径 = 玩家向敌群最密方向 200px；沿途目标 = 路径带内敌（本批按半径带近似）
  const targets = aliveByDistance(ctx.enemies, ctx.player.x, ctx.player.y).slice(0, 5);
  let hits = 0;
  for (const t of targets) {
    dealDamage(t, p['damage']!, ctx.now, result);
    hits += 1;
    if (t.cc) {
      t.cc = applyStatus(t.cc, { kind: 'vulnerable', value: p['vulnerable']!, durationSeconds: p['vulnerableDuration']!, source: 'dv_blood_dash' }, ctx.now).state;
      result.events.push('vulnerable');
    }
  }
  result.events.push('dash');
  // up_d_dash 血宴：突进终点血爆（25 伤/120px）+ 每命中 1 敌回 1 HP（P4 形态，锚）
  if ((p['burstDamage'] ?? 0) > 0) {
    const rSq = (p['burstRadius'] ?? 120) ** 2;
    for (const e of ctx.enemies) {
      if (!e.active || e.hp <= 0) continue;
      const dx = e.x - ctx.player.x;
      const dy = e.y - ctx.player.y;
      if (dx * dx + dy * dy > rSq) continue;
      dealDamage(e, p['burstDamage']!, ctx.now, result);
    }
    ctx.healSink?.((p['healPerHit'] ?? 1) * hits);
    result.events.push('bloodBurst');
  }
  return result;
}

/** 月痕狙击：1.2s 蓄力（控制器段）→ 60 伤全贯穿巨矢 + 首个命中眩晕 1s */
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
  ctx.healSink?.((p['healAuraPerSec'] ?? 3) * (p['healAuraDuration'] ?? 5) * 0.2); // 首帧口径：光环 tick 持续段归行为层
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
  result.events.push('rage');
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

/** EG-9 占比锚查询（遥测断言口径 12~18%） */
export function derivativeShareAnchor(id: DerivativeSkillId): readonly [number, number] {
  return DERIVATIVE_SKILLS[id].shareAnchor;
}
