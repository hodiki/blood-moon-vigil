import { describe, it, expect } from 'vitest';
import {
  HEARTBEAT,
  AUDIO_LIMITS,
  AUDIO_STORAGE_KEYS,
  heartbeatBpmAt,
  heartbeatFrequency,
  heartbeatBpmWithDanger,
  heartbeatGainDb,
  dbToGain,
  shouldFire,
  canStartVoice,
  resolveVoiceAdmission,
  readMuted,
  writeMuted,
  readReduceFlash,
  writeReduceFlash,
  readHaptics,
  writeHaptics,
  type AudioStorage,
} from '@/audio/audio-math';

/** 内存版 LocalStorage fake（对齐 session-stats.test 的注入方式） */
function makeStorage(init: Record<string, string> = {}): AudioStorage {
  const m = new Map<string, string>(Object.entries(init));
  return {
    getItem: (key) => (m.has(key) ? m.get(key)! : null),
    setItem: (key, value) => {
      m.set(key, value);
    },
  };
}

describe('心跳 BPM 分段线性映射（audio-bible §1 · TASK-31 收尾：开局 60 → 2min 80 → 4min 100 → 6min 140）', () => {
  it.each([
    [0, 60],
    [60, 70],
    [120, 80],
    [180, 90],
    [240, 100],
    [300, 120],
    [360, 140],
  ])('t=%d s → BPM=%d', (t, bpm) => {
    expect(heartbeatBpmAt(t)).toBeCloseTo(bpm, 6);
  });

  it('超 6:00 钳制 140（上限防噪），负值钳制 60', () => {
    expect(heartbeatBpmAt(1500)).toBe(HEARTBEAT.BPM_MAX);
    expect(heartbeatBpmAt(-5)).toBe(HEARTBEAT.BPM_MIN);
  });

  it('0..360 单调不降（心跳随局时只加速不停滞）', () => {
    let prev = -Infinity;
    for (let t = 0; t <= 360; t += 30) {
      const bpm = heartbeatBpmAt(t);
      expect(bpm).toBeGreaterThanOrEqual(prev);
      prev = bpm;
    }
  });

  it('5 分钟节点与开局差异可感知（≥20 BPM，bible §8 验收 #2）', () => {
    expect(heartbeatBpmAt(300) - heartbeatBpmAt(0)).toBeGreaterThanOrEqual(20);
  });
});

describe('濒死加成（audio-bible §1：HP<30% → BPM+10 / 音量+2dB）', () => {
  it('HP ≥ 30% 不触发（严格小于）', () => {
    expect(heartbeatBpmWithDanger(100, 0.3)).toBe(100);
    expect(heartbeatBpmWithDanger(100, 0.5)).toBe(100);
    expect(heartbeatBpmWithDanger(100, 1)).toBe(100);
  });

  it('HP < 30% 触发 BPM+10', () => {
    expect(heartbeatBpmWithDanger(100, 0.29)).toBe(110);
    expect(heartbeatBpmWithDanger(140, 0)).toBe(150);
  });

  it('音量 dB：基线 -16，濒死 -14（bible §3）', () => {
    expect(heartbeatGainDb(0.5)).toBe(HEARTBEAT.BASE_GAIN_DB);
    expect(heartbeatGainDb(0.2)).toBe(HEARTBEAT.BASE_GAIN_DB + HEARTBEAT.DANGER_DB_BONUS);
  });

  it('dbToGain 单调且 <1：dB 越高增益越大', () => {
    expect(dbToGain(-16)).toBeCloseTo(0.1585, 3);
    expect(dbToGain(-14)).toBeGreaterThan(dbToGain(-16));
    expect(dbToGain(-14)).toBeLessThan(1);
  });
});

describe('心跳基频映射（bible §1：≈55~70Hz）', () => {
  it('60 BPM → 55Hz，140 BPM → 70Hz', () => {
    expect(heartbeatFrequency(HEARTBEAT.BPM_MIN)).toBeCloseTo(55, 6);
    expect(heartbeatFrequency(HEARTBEAT.BPM_MAX)).toBeCloseTo(70, 6);
    expect(heartbeatFrequency(100)).toBeCloseTo(62.5, 6);
  });
});

describe('限流与同发上限（audio-bible §3/§4：min-gap + 弃新保旧）', () => {
  it('min-gap：间隔 ≥ gap 放行，< gap 拦截', () => {
    expect(shouldFire(0, 1000, 80)).toBe(true); // 从未触发
    expect(shouldFire(1000, 1040, 80)).toBe(false);
    expect(shouldFire(1000, 1080, 80)).toBe(true);
    expect(shouldFire(1000, 1081, 80)).toBe(true);
  });

  it('同发上限 6 路：active=6 弃新，active<6 放行（弃新保旧）', () => {
    expect(canStartVoice(0, AUDIO_LIMITS.MAX_SFX_VOICES)).toBe(true);
    expect(canStartVoice(5, AUDIO_LIMITS.MAX_SFX_VOICES)).toBe(true);
    expect(canStartVoice(6, AUDIO_LIMITS.MAX_SFX_VOICES)).toBe(false);
    expect(canStartVoice(10, AUDIO_LIMITS.MAX_SFX_VOICES)).toBe(false);
  });
});

describe('同发优先级让位（audio-bible §3：受击/确认/Boss > 击杀 > 拾取 > 武器 > 装饰）', () => {
  // 层级对齐 SFX_PRIORITY（sfx-palette）：装饰 0 / 武器 1 / 拾取 2 / 击杀 3 / 关键 4
  const DECORATION = 0;
  const WEAPON = 1;
  const PICKUP = 2;
  const KILL = 3;
  const CRITICAL = 4;

  it('未满员一律 start（让位只在同发冲突时介入）', () => {
    expect(resolveVoiceAdmission([], CRITICAL, 6)).toEqual({ action: 'start' });
    expect(resolveVoiceAdmission([WEAPON, PICKUP], DECORATION, 6)).toEqual({ action: 'start' });
  });

  it('满员且新来 ≤ 在场最低 → drop（弃新保旧兜底）', () => {
    const active = [KILL, PICKUP, WEAPON, KILL, PICKUP, WEAPON];
    expect(resolveVoiceAdmission(active, WEAPON, 6)).toEqual({ action: 'drop' });
    expect(resolveVoiceAdmission(active, DECORATION, 6)).toEqual({ action: 'drop' });
  });

  it('满员且新来 > 在场最低 → preempt 最低者', () => {
    const active = [CRITICAL, KILL, PICKUP, WEAPON, KILL, DECORATION];
    // 受击（CRITICAL）来 → 抢占装饰（index 5）
    expect(resolveVoiceAdmission(active, CRITICAL, 6)).toEqual({ action: 'preempt', index: 5 });
    // 击杀（KILL）来 → 仍抢占装饰（最低）
    expect(resolveVoiceAdmission(active, KILL, 6)).toEqual({ action: 'preempt', index: 5 });
    // 拾取（PICKUP）来 → 抢占装饰
    expect(resolveVoiceAdmission(active, PICKUP, 6)).toEqual({ action: 'preempt', index: 5 });
  });

  it('同优先不抢占（严格大于才让位，防同级互相踩）', () => {
    const active = [WEAPON, WEAPON, WEAPON, WEAPON, WEAPON, WEAPON];
    expect(resolveVoiceAdmission(active, WEAPON, 6)).toEqual({ action: 'drop' });
  });

  it('多个同最低优先时取最早开声者（index 最小）', () => {
    const active = [DECORATION, KILL, DECORATION, PICKUP, CRITICAL, KILL];
    expect(resolveVoiceAdmission(active, CRITICAL, 6)).toEqual({ action: 'preempt', index: 0 });
  });

  it('maxVoices ≤ 0 防御性 drop（不越界）', () => {
    expect(resolveVoiceAdmission([], CRITICAL, 0)).toEqual({ action: 'drop' });
  });
});

describe('设置持久化（audio-bible §6：LocalStorage，静音默认关/损坏回退）', () => {
  it('缺键默认关（触觉/静音/减少闪烁）', () => {
    expect(readMuted(makeStorage())).toBe(false);
    expect(readReduceFlash(makeStorage())).toBe(false);
    expect(readHaptics(makeStorage())).toBe(false);
  });

  it('写后读回一致', () => {
    const s = makeStorage();
    writeMuted(s, true);
    expect(readMuted(s)).toBe(true);
    writeReduceFlash(s, true);
    expect(readReduceFlash(s)).toBe(true);
    writeHaptics(s, true);
    expect(readHaptics(s)).toBe(true);
    writeMuted(s, false);
    expect(readMuted(s)).toBe(false);
  });

  it('损坏数据回退默认且不抛错（隐私模式不阻断）', () => {
    const s = makeStorage({ [AUDIO_STORAGE_KEYS.muted]: 'not-a-bool' });
    expect(readMuted(s)).toBe(false);
  });
});
