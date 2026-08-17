/**
 * audio/audio-math.ts —— 音频纯函数层（test-framework §1.2：可脱离 Phaser/WebAudio 单测）
 *
 * 数值来源（audio-bible.md，设计数值不自行改动）：
 * - §1 心跳 BPM 分段线性：开局 60 → 5min 80 → 10min 100 → 15min 120 → 20min(Boss) 140（上限）
 * - §1 濒死（HP<30%）BPM +10 / 音量 +2dB；§3 程序心跳基线 -16dB（濒死 -14dB）
 * - §1 心跳基频 ≈55~70Hz；§3 暂停/选卡心跳层 -4dB；§1 Boss 战音量 +3dB、双拍
 * - §3 同发上限 8 路（移动 6，本 Demo 统一 6）；同一事件 min-gap 限流（宝石 80ms）
 * - §6 静音/减少闪烁/触觉开关 LocalStorage 持久化（静音 ≠ 关 AudioContext）
 *
 * 本模块不 import Phaser、不触碰 WebAudio 节点，全部为可断言纯函数。
 */

/** 心跳 BPM 曲线控制点（秒, BPM）；20:00=1200s 收束对应峰值 140 */
export const BPM_CURVE: ReadonlyArray<readonly [number, number]> = [
  [0, 60],
  [300, 80],
  [600, 100],
  [900, 120],
  [1200, 140],
];

export const HEARTBEAT = {
  BPM_MIN: 60,
  BPM_MAX: 140,
  FREQ_MIN_HZ: 55,
  FREQ_MAX_HZ: 70,
  DANGER_HP_FRACTION: 0.3, // 濒死判据：HP 严格 < 30%
  DANGER_BPM_BONUS: 10,
  DANGER_DB_BONUS: 2,
  BASE_GAIN_DB: -16, // 程序心跳基线（audio-bible §3）
  DUCK_DB: -4, // 暂停/选卡心跳层降 4dB（audio-bible §3）
  BOSS_DB_BONUS: 3, // Boss 战音量 +3dB（audio-bible §1）
  SILENCE_SECONDS: 0.3, // 死亡/胜利瞬间纯静默（audio-bible §3）
} as const;

export const AUDIO_LIMITS = {
  MAX_SFX_VOICES: 6, // 同发上限 6 路，超限弃新保旧（audio-bible §6 移动端 6 路）
} as const;

/** 设置持久化键（audio-bible §6，对齐 session-stats 'bmv.' 前缀约定） */
export const AUDIO_STORAGE_KEYS = {
  muted: 'bmv.audioMuted',
  reduceFlash: 'bmv.audioReduceFlash',
  haptics: 'bmv.audioHaptics',
} as const;

/** LocalStorage 最小读写接口（真实传 window.localStorage；单测传 fake） */
export interface AudioStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** 0..1 钳制（hpFraction 输入卫生） */
export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/**
 * 心跳 BPM = f(t) 分段线性映射，直接消费 spawner.elapsedSeconds（audio-bible §1）。
 * t 钳制到 [0, 1200]：负值回 60，超 20:00 恒 140（上限防噪）。
 */
export function heartbeatBpmAt(tSeconds: number): number {
  const pts = BPM_CURVE;
  const last = pts[pts.length - 1]!;
  const t = Math.min(Math.max(tSeconds, pts[0]![0]), last[0]);
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    if (t <= b[0]) {
      const f = (t - a[0]) / (b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * f;
    }
  }
  return last[1];
}

/** 心跳基频映射：60 BPM→55Hz … 140 BPM→70Hz（audio-bible §1 ≈55~70Hz） */
export function heartbeatFrequency(bpm: number): number {
  const f = (bpm - HEARTBEAT.BPM_MIN) / (HEARTBEAT.BPM_MAX - HEARTBEAT.BPM_MIN);
  return HEARTBEAT.FREQ_MIN_HZ + f * (HEARTBEAT.FREQ_MAX_HZ - HEARTBEAT.FREQ_MIN_HZ);
}

/** 濒死加成：HP<30% → BPM+10（audio-bible §1，严格小于） */
export function heartbeatBpmWithDanger(bpm: number, hpFraction: number): number {
  return clamp01(hpFraction) < HEARTBEAT.DANGER_HP_FRACTION ? bpm + HEARTBEAT.DANGER_BPM_BONUS : bpm;
}

/** 心跳音量 dB：基线 -16，濒死升到 -14（audio-bible §3） */
export function heartbeatGainDb(hpFraction: number): number {
  return clamp01(hpFraction) < HEARTBEAT.DANGER_HP_FRACTION
    ? HEARTBEAT.BASE_GAIN_DB + HEARTBEAT.DANGER_DB_BONUS
    : HEARTBEAT.BASE_GAIN_DB;
}

/** dBFS → 线性增益（WebAudio GainNode 用） */
export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * min-gap 限流判定：距上次同事件时间 ≥ minGapMs 才放行。
 * lastFiredMs=0（从未触发）时 now-0 ≥ gap 恒放行。
 */
export function shouldFire(lastFiredMs: number, nowMs: number, minGapMs: number): boolean {
  return nowMs - lastFiredMs >= minGapMs;
}

/** 同发上限判定：active < max 放行；≥ max 弃新保旧（audio-bible §4） */
export function canStartVoice(activeVoices: number, maxVoices: number): boolean {
  return activeVoices < maxVoices;
}

/** 读布尔设置（缺键/损坏/异常 → dflt，不抛错，隐私模式不阻断） */
export function readAudioFlag(storage: AudioStorage, key: string, dflt = false): boolean {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return dflt;
    return raw === '1' || raw === 'true';
  } catch {
    return dflt;
  }
}

/** 写布尔设置（写失败静默，不阻断流程） */
export function writeAudioFlag(storage: AudioStorage, key: string, value: boolean): void {
  try {
    storage.setItem(key, value ? '1' : '0');
  } catch {
    // 尽力而为
  }
}

export function readMuted(storage: AudioStorage): boolean {
  return readAudioFlag(storage, AUDIO_STORAGE_KEYS.muted);
}
export function writeMuted(storage: AudioStorage, muted: boolean): void {
  writeAudioFlag(storage, AUDIO_STORAGE_KEYS.muted, muted);
}
export function readReduceFlash(storage: AudioStorage): boolean {
  return readAudioFlag(storage, AUDIO_STORAGE_KEYS.reduceFlash);
}
export function writeReduceFlash(storage: AudioStorage, value: boolean): void {
  writeAudioFlag(storage, AUDIO_STORAGE_KEYS.reduceFlash, value);
}
export function readHaptics(storage: AudioStorage): boolean {
  return readAudioFlag(storage, AUDIO_STORAGE_KEYS.haptics);
}
export function writeHaptics(storage: AudioStorage, value: boolean): void {
  writeAudioFlag(storage, AUDIO_STORAGE_KEYS.haptics, value);
}
