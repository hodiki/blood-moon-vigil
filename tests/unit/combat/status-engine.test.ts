import { describe, it, expect } from 'vitest';
import {
  STATUS_KINDS,
  HARD_CONTROL_KINDS,
  isStatusKind,
  STATUS_KIND_LABELS,
} from '@/combat/status/status-types';
import {
  CC_ICD_SECONDS,
  ELITE_CC_DURATION_MULT,
  CC_RESISTANCE_DEFAULTS,
  resolveCcResistance,
  CC_EFFECT_REGISTRY,
} from '@/combat/status/status-config';
import {
  emptyStatusState,
  applyStatus,
  queryStatus,
  isStunned,
  slowMultiplier,
  damageTakenMultiplier,
  tickStatuses,
  clearStatuses,
  removeStatusesBySource,
  type StatusState,
} from '@/combat/status/status-engine';

/** 快捷施加（普通敌默认画像） */
function apply(
  state: StatusState,
  kind: 'stun' | 'slow' | 'vulnerable',
  value: number,
  duration: number,
  now: number,
  source = 'test',
) {
  return applyStatus(state, { kind, value, durationSeconds: duration, source }, now);
}

describe('状态层 · 封闭枚举（gdd-status-effects §3.1）', () => {
  it('状态种类恰好三类（封闭集合，新增须走 GDD 修订——反例红线 §⑦-4）', () => {
    expect([...STATUS_KINDS]).toEqual(['stun', 'slow', 'vulnerable']);
  });

  it('类型守卫：合法种类通过 / 未知种类拒绝（配置侧私自扩类防线）', () => {
    expect(isStatusKind('stun')).toBe(true);
    expect(isStatusKind('slow')).toBe(true);
    expect(isStatusKind('vulnerable')).toBe(true);
    expect(isStatusKind('burn')).toBe(false);
    expect(isStatusKind('knockback')).toBe(false);
    expect(isStatusKind(42)).toBe(false);
    expect(isStatusKind(null)).toBe(false);
  });

  it('硬控类仅眩晕（ICD 与 Boss 免疫只作用于硬控，§3.3/§3.4）', () => {
    expect(HARD_CONTROL_KINDS).toEqual(['stun']);
  });

  it('三类均有中文标签（UI 色调编码/遥测口径统一，§⑧）', () => {
    expect(STATUS_KIND_LABELS.stun).toBe('眩晕');
    expect(STATUS_KIND_LABELS.slow).toBe('减速');
    expect(STATUS_KIND_LABELS.vulnerable).toBe('易伤');
  });
});

describe('状态层 · 叠加规则（gdd-status-effects §3.2）', () => {
  it('同类（眩晕）存续期内再来者一律被 ICD 拦截（EG-5：ICD 起算=状态结束 → 存续期内 ICD 恒未就绪，取最长剩余由「首发即最长」保证）', () => {
    let s = emptyStatusState();
    s = apply(s, 'stun', 1, 2.5, 0, '提灯闪耀').state;
    // 0.5s 后再来一发 1s 短眩晕：原眩晕存续期内 → ICD 拦截（无论强弱，§3.3 无论来源）
    const r = apply(s, 'stun', 1, 1, 0.5, '月痕狙击');
    expect(r.reason).toBe('icd');
    expect(r.state.stun?.until).toBe(2.5); // 状态不变
    expect(r.state.stun?.source).toBe('提灯闪耀');
  });

  it('同类（眩晕）ICD 就绪后更强者生效：新状态重置时长与来源', () => {
    let s = emptyStatusState();
    s = apply(s, 'stun', 1, 1, 0, '月痕狙击').state; // 结束 t=1，ICD 至 t=11
    const r = apply(s, 'stun', 1, 2.5, 11.5, '提灯闪耀');
    expect(r.applied).toBe(true);
    expect(r.state.stun?.until).toBe(14); // 11.5 + 2.5
    expect(r.state.stun?.source).toBe('提灯闪耀');
  });

  it('同类（减速）取最高值：低值后来者不覆盖高值（含时长）', () => {
    let s = emptyStatusState();
    s = apply(s, 'slow', 0.4, 2, 0, '血海退潮').state; // 40% 强
    const r = apply(s, 'slow', 0.3, 6, 0.5, '安魂曲'); // 30% 弱但长
    expect(r.state.slow?.value).toBe(0.4);
    expect(r.state.slow?.until).toBe(2); // 强者的剩余时长保留，不被弱者刷新
  });

  it('同类（减速）后到更高值：替换值并重置时长', () => {
    let s = emptyStatusState();
    s = apply(s, 'slow', 0.3, 6, 0, '安魂曲').state;
    const r = apply(s, 'slow', 0.4, 2, 1, '血海退潮');
    expect(r.state.slow?.value).toBe(0.4);
    expect(r.state.slow?.until).toBe(3); // 1 + 2
  });

  it('异类共存：同一目标可同时 眩晕 + 减速 + 易伤（§3.2）', () => {
    let s = emptyStatusState();
    s = apply(s, 'stun', 1, 2, 0).state;
    s = apply(s, 'slow', 0.3, 3, 0).state;
    s = apply(s, 'vulnerable', 0.15, 5, 0).state;
    expect(isStunned(s, 1)).toBe(true);
    expect(slowMultiplier(s, 1)).toBeCloseTo(0.7);
    expect(damageTakenMultiplier(s, 1)).toBeCloseTo(1.15);
  });

  it('三来源眩晕同帧：首个生效消耗 ICD，其余被 ICD 拦截不重复生效（§⑦-1）', () => {
    let s = emptyStatusState();
    const r1 = apply(s, 'stun', 1, 2, 0, 'A');
    s = r1.state;
    expect(r1.applied).toBe(true);
    const r2 = apply(s, 'stun', 1, 3, 0, 'B');
    const r3 = apply(r2.state, 'stun', 1, 1, 0, 'C');
    expect(r2.reason).toBe('icd');
    expect(r3.reason).toBe('icd');
    expect(s.stun?.until).toBe(2);
    expect(s.stun?.source).toBe('A');
  });

  it('减速区（血池 40%）与武器减速 30% 同走取最强：结果 40% 非叠乘（§⑦-1）', () => {
    let s = emptyStatusState();
    s = apply(s, 'slow', 0.3, 1, 0, '荆棘圣环').state;
    s = apply(s, 'slow', 0.4, 2, 0.5, '血池').state;
    expect(slowMultiplier(s, 0.6)).toBeCloseTo(0.6); // ×(1−0.4)，非 0.7×0.6 叠乘
  });

  it('applyStatus 为纯函数：不修改入参 state', () => {
    const s = emptyStatusState();
    const r = apply(s, 'slow', 0.3, 2, 0);
    expect(s.slow).toBeNull();
    expect(r.state.slow?.value).toBe(0.3);
  });
});

describe('状态层 · 硬控 ICD（gdd-status-effects §3.3 · EG-5 起算=状态结束）', () => {
  it('命中后 9.9s 再施加硬控 → 被 ICD 拦截（10s/单目标）', () => {
    // 眩晕 2s：结束于 t=2 → ICD 至 t=12。t=11.9 < 12 → 拦截
    let s = emptyStatusState();
    s = apply(s, 'stun', 1, 2, 0).state;
    const r = apply(s, 'stun', 1, 1, 11.9);
    expect(r.reason).toBe('icd');
    expect(r.applied).toBe(false);
  });

  it('命中后 10.1s（且状态早已结束）再施加硬控 → 放行', () => {
    let s = emptyStatusState();
    s = apply(s, 'stun', 1, 2, 0).state; // 结束 t=2，ICD 至 t=12
    const r = apply(s, 'stun', 1, 1, 12.1);
    expect(r.reason).toBe('applied');
    expect(r.state.stun?.until).toBe(13.1);
  });

  it('ICD 起算 = 状态结束时刻（EG-5）：长眩晕不会在自身存续期内自续', () => {
    let s = emptyStatusState();
    // 眩晕 8s（0~8），ICD 至 18
    s = apply(s, 'stun', 1, 8, 0, '圣辉审判').state;
    expect(s.stunIcdReadyAt).toBe(8 + CC_ICD_SECONDS);
    // 状态仍存续（t=5）时的任何后续硬控都被拦截 → 长眩晕不可自续
    const r = apply(s, 'stun', 1, 8, 5);
    expect(r.reason).toBe('icd');
  });

  it('ICD 为单目标粒度：不同目标互不影响', () => {
    const a = emptyStatusState();
    const b = emptyStatusState();
    const ra = apply(a, 'stun', 1, 1, 0);
    expect(ra.reason).toBe('applied');
    // 全新目标 b：无 ICD 记录 → 同帧施加照常生效
    const rb = apply(b, 'stun', 1, 1, 0);
    expect(rb.reason).toBe('applied');
  });

  it('减速/易伤不设 ICD：ICD 期内仍可施加（靠时长与数值上限控制，§3.3）', () => {
    let s = emptyStatusState();
    s = apply(s, 'stun', 1, 2, 0).state; // 置 ICD
    const rSlow = apply(s, 'slow', 0.3, 2, 1);
    const rVuln = apply(s, 'vulnerable', 0.15, 3, 1);
    expect(rSlow.reason).toBe('applied');
    expect(rVuln.reason).toBe('applied');
  });

  it('ICD 拦截不刷新就绪时刻（拦截不重置计时）', () => {
    let s = emptyStatusState();
    s = apply(s, 'stun', 1, 2, 0).state; // ICD 至 12
    const blocked = apply(s, 'stun', 1, 5, 6); // 拦截
    expect(blocked.reason).toBe('icd');
    expect(blocked.state.stunIcdReadyAt).toBe(12); // 不变
  });
});

describe('状态层 · 抗性规则（gdd-status-effects §3.4）', () => {
  const app = (kind: 'stun' | 'slow' | 'vulnerable', value: number, duration: number) => ({
    kind,
    value,
    durationSeconds: duration,
  });

  it('Boss 对硬控（眩晕）免疫：applied=false / reason=immune', () => {
    const s = emptyStatusState();
    const r = applyStatus(s, app('stun', 1, 2), 0, { tier: 'boss' });
    expect(r.reason).toBe('immune');
    expect(r.state.stun).toBeNull();
  });

  it('Boss 免疫只豁免控制：软控/易伤照常生效（§3.4 表）', () => {
    const s = emptyStatusState();
    const slow = applyStatus(s, app('slow', 0.4, 6), 0, { tier: 'boss' });
    const vuln = applyStatus(slow.state, app('vulnerable', 0.15, 6), 0, { tier: 'boss' });
    expect(slow.applied).toBe(true);
    expect(vuln.applied).toBe(true);
    expect(vuln.state.slow?.value).toBe(0.4);
    expect(vuln.state.vulnerable?.value).toBe(0.15);
  });

  it('精英：硬控/软控时长 ×0.5（守夜环灯 0.5s 等效 0.25s，R2 §C1）', () => {
    const s = emptyStatusState();
    const r = applyStatus(s, app('stun', 1, 0.5), 0, { tier: 'elite' });
    expect(r.effectiveDuration).toBeCloseTo(0.25);
    expect(r.state.stun?.until).toBeCloseTo(0.25);
    const slow = applyStatus(s, app('slow', 0.3, 4), 0, { tier: 'elite' });
    expect(slow.effectiveDuration).toBeCloseTo(2);
  });

  it('精英易伤不折减（数值减益锚点，§3.4）', () => {
    const s = emptyStatusState();
    const r = applyStatus(s, app('vulnerable', 0.15, 6), 0, { tier: 'elite' });
    expect(r.effectiveDuration).toBeCloseTo(6);
    expect(r.state.vulnerable?.value).toBeCloseTo(0.15);
  });

  it('普通敌全额生效（缺省画像 = normal）', () => {
    const s = emptyStatusState();
    const r = applyStatus(s, app('stun', 1, 2), 0);
    expect(r.applied).toBe(true);
    expect(r.effectiveDuration).toBeCloseTo(2);
  });

  it('逐敌覆写字段位优先于 tier 默认表（§⑥-1，怪物域接线预留）', () => {
    // 某 Boss 类精英额外减速抗性示例：覆写 slow durationMult
    const profile = {
      tier: 'elite' as const,
      ccResistance: { slow: { durationMult: 0.25 } },
    };
    expect(resolveCcResistance('slow', profile).durationMult).toBe(0.25);
    expect(resolveCcResistance('stun', profile).durationMult).toBe(ELITE_CC_DURATION_MULT); // 未覆写走 tier 默认
    // 免疫覆写
    expect(resolveCcResistance('slow', { ccResistance: { slow: { immune: true } } }).immune).toBe(true);
  });

  it('tier 默认表与 §3.4 表逐格一致', () => {
    expect(CC_RESISTANCE_DEFAULTS.boss.stun.immune).toBe(true);
    expect(CC_RESISTANCE_DEFAULTS.boss.slow.immune).toBe(false);
    expect(CC_RESISTANCE_DEFAULTS.boss.vulnerable.immune).toBe(false);
    expect(CC_RESISTANCE_DEFAULTS.elite.stun.durationMult).toBe(0.5);
    expect(CC_RESISTANCE_DEFAULTS.elite.slow.durationMult).toBe(0.5);
    expect(CC_RESISTANCE_DEFAULTS.elite.vulnerable.durationMult).toBe(1);
    expect(CC_RESISTANCE_DEFAULTS.normal.stun.durationMult).toBe(1);
    expect(CC_RESISTANCE_DEFAULTS.normal.slow.durationMult).toBe(1);
    expect(CC_RESISTANCE_DEFAULTS.normal.vulnerable.durationMult).toBe(1);
  });
});

describe('状态层 · 查询与生命周期', () => {
  it('queryStatus：生效期内 active + 剩余秒；过期后 inactive', () => {
    let s = emptyStatusState();
    s = apply(s, 'slow', 0.3, 2, 0).state;
    expect(queryStatus(s, 'slow', 1).active).toBe(true);
    expect(queryStatus(s, 'slow', 1).remaining).toBeCloseTo(1);
    expect(queryStatus(s, 'slow', 2).active).toBe(false);
    expect(queryStatus(s, 'slow', 2).value).toBe(0);
  });

  it('tickStatuses：过期清除并返回被清除种类；未到期保留', () => {
    let s = emptyStatusState();
    s = apply(s, 'stun', 1, 1, 0).state;
    s = apply(s, 'slow', 0.3, 5, 0).state;
    s = apply(s, 'vulnerable', 0.15, 5, 0).state;
    const expired = tickStatuses(s, 2);
    expect(expired).toEqual(['stun']);
    expect(s.stun).toBeNull();
    expect(s.slow).not.toBeNull();
    expect(s.vulnerable).not.toBeNull();
  });

  it('目标死亡 clearStatuses：状态与 ICD 计数一并清除（§⑦-3 防复活永久免疫）', () => {
    let s = emptyStatusState();
    s = apply(s, 'stun', 1, 5, 0).state;
    expect(s.stunIcdReadyAt).toBeGreaterThan(0);
    clearStatuses(s);
    expect(s.stun).toBeNull();
    expect(s.slow).toBeNull();
    expect(s.vulnerable).toBeNull();
    expect(s.stunIcdReadyAt).toBe(0);
  });

  it('载体死亡 removeStatusesBySource：仅移除该来源的状态（§⑦-3），ICD 照常计数', () => {
    let s = emptyStatusState();
    s = apply(s, 'slow', 0.15, 2, 0, '猎月贯钉').state;
    s = apply(s, 'slow', 0.3, 5, 0, '安魂曲').state; // 取最强留下安魂曲
    s = apply(s, 'vulnerable', 0.15, 5, 0, '圣痕').state;
    const removed = removeStatusesBySource(s, '安魂曲');
    expect(removed).toEqual(['slow']);
    expect(s.slow).toBeNull(); // 减速唯一来源被移除
    expect(s.vulnerable).not.toBeNull(); // 易伤（圣痕）保留
    expect(s.stunIcdReadyAt).toBe(0); // 未发生过硬控
  });

  it('消耗式 ICD 边界：恰好 10s（ICD 到点）放行', () => {
    let s = emptyStatusState();
    s = apply(s, 'stun', 1, 2, 0).state; // 结束 t=2 → ICD 至 12
    const r = apply(s, 'stun', 1, 1, 12); // now >= readyAt → 放行
    expect(r.reason).toBe('applied');
  });
});

describe('状态层 · §④ 登记表（验收判据 ⑧-2：来源-状态-参数断言）', () => {
  it('登记表恰好 15 项（定稿口径，不私自增删）', () => {
    expect(CC_EFFECT_REGISTRY).toHaveLength(15);
  });

  it('三类状态行参数与 GDD §④ 表逐条一致（锚点值）', () => {
    const bySource = new Map(CC_EFFECT_REGISTRY.map((e) => [e.source, e]));
    // 减速行
    expect(bySource.get('破旧提灯（基础）')).toMatchObject({ kind: 'slow', value: 0.1, durationSeconds: null });
    expect(bySource.get('亡者灯引残焰')).toMatchObject({ kind: 'slow', value: 0.1, durationSeconds: 3 });
    expect(bySource.get('安魂圣铃衍生技（安魂曲）')).toMatchObject({ kind: 'slow', value: 0.3, durationSeconds: 3 });
    expect(bySource.get('安魂钟鸣（质变 1）')).toMatchObject({ kind: 'slow', value: 0.2, durationSeconds: 2 });
    expect(bySource.get('猎月贯钉（共鸣 R-4）')).toMatchObject({ kind: 'slow', value: 0.15, durationSeconds: 2 });
    expect(bySource.get('圣物·血海退潮')).toMatchObject({ kind: 'slow', value: 0.4, durationSeconds: 6 });
    // 易伤行
    expect(bySource.get('圣徒左轮衍生技')).toMatchObject({ kind: 'vulnerable', value: 0.15, durationSeconds: 6 });
    expect(bySource.get('血契双刃衍生技（血影突袭）')).toMatchObject({ kind: 'vulnerable', value: 0.15, durationSeconds: 5 });
    expect(bySource.get('月痕长弓质变卡 2（猎首之约）')).toMatchObject({ kind: 'vulnerable', value: 0.2, durationSeconds: 8 });
    // 眩晕行（stun value 占位 1）
    expect(bySource.get('月痕长弓衍生技（月痕狙击）')).toMatchObject({ kind: 'stun', durationSeconds: 1 });
    expect(bySource.get('圣辉十字衍生技（圣辉审判）')).toMatchObject({ kind: 'stun', durationSeconds: 2 });
    expect(bySource.get('守夜环灯（共鸣 R-1）')).toMatchObject({ kind: 'stun', durationSeconds: 0.5 });
    expect(bySource.get('圣物·月蚀之陨')).toMatchObject({ kind: 'stun', durationSeconds: 2 });
    // 非状态行
    expect(bySource.get('葬仪断罪（共鸣 R-7）')).toMatchObject({ kind: 'none' });
    expect(bySource.get('旧武器收编（提灯闪耀/荆棘圣环/血池等）')).toMatchObject({ kind: 'none' });
  });

  it('全部状态行 kind ∈ 封闭枚举 ∪ {none}（配置侧扩类防线）', () => {
    for (const e of CC_EFFECT_REGISTRY) {
      expect(e.kind === 'none' || isStatusKind(e.kind)).toBe(true);
    }
  });

  it('减速/易伤值域 0~1（取最强语义合法值域）', () => {
    for (const e of CC_EFFECT_REGISTRY) {
      if (e.kind === 'slow' || e.kind === 'vulnerable') {
        expect(e.value).toBeGreaterThan(0);
        expect(e.value).toBeLessThanOrEqual(1);
      }
    }
  });

  it('硬控 ICD 常量 = 10s（锚，守夜环灯案例）', () => {
    expect(CC_ICD_SECONDS).toBe(10);
  });

  it('登记表驱动引擎：模拟「安魂曲 30% 后接血海退潮 40%」取最强', () => {
    let s = emptyStatusState();
    const requiem = CC_EFFECT_REGISTRY.find((e) => e.source === '安魂圣铃衍生技（安魂曲）')!;
    const bloodsea = CC_EFFECT_REGISTRY.find((e) => e.source === '圣物·血海退潮')!;
    s = applyStatus(s, { kind: requiem.kind as 'slow', value: requiem.value, durationSeconds: requiem.durationSeconds!, source: requiem.source }, 0).state;
    s = applyStatus(s, { kind: bloodsea.kind as 'slow', value: bloodsea.value, durationSeconds: bloodsea.durationSeconds!, source: bloodsea.source }, 1).state;
    expect(s.slow?.value).toBeCloseTo(0.4);
    expect(s.slow?.source).toBe('圣物·血海退潮');
  });

  it('登记表驱动引擎：月痕狙击眩晕 Boss 免疫 / 精英 ×0.5（验收判据 ⑧-3）', () => {
    const entry = CC_EFFECT_REGISTRY.find((e) => e.source === '月痕长弓衍生技（月痕狙击）')!;
    const app = { kind: entry.kind as 'stun', value: entry.value, durationSeconds: entry.durationSeconds!, source: entry.source };
    const boss = applyStatus(emptyStatusState(), app, 0, { tier: 'boss' });
    expect(boss.reason).toBe('immune');
    const elite = applyStatus(emptyStatusState(), app, 0, { tier: 'elite' });
    expect(elite.effectiveDuration).toBeCloseTo(0.5);
  });
});
