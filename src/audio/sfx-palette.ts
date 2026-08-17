/**
 * audio/sfx-palette.ts —— 程序合成 SFX 规格表（audio-bible §2）
 *
 * 全部为 WebAudio 振荡器/噪声合成参数，零外部文件、零 npm 音频包。
 * 首版必落 6 项（bible §7 红线）：武器发射 / 击杀闷响(4 变体) / 宝石叮声 / 玩家受击 /
 * 选卡确认 / Boss 出场重音；另附胜利/失败 sting（bible §7 建议随结算页落地，成本极低）。
 *
 * 合成约定：
 * - parts 每项独立振荡器/噪声源，delay 制造多音序（宝石上行 2 音、选卡双音、Boss 低频+噪声）
 * - gain 为相对该 SFX 音量比例 0..1；gainDb 为该事件基线 dB（bible §2 音量基线）
 * - minGapMs 为同事件限流窗口（bible §3：宝石密集时每 80ms 最多 1 声）
 */

export type SfxId = 'weapon' | 'gem' | 'hurt' | 'confirm' | 'boss' | 'victory' | 'defeat';

/** 击杀变体（bible §2 #2：行尸/血犬/屠夫更重/Boss 最重） */
export type KillVariant = 'zombie' | 'wolf' | 'tank' | 'boss';

export interface TonePart {
  kind: 'tone';
  type: OscillatorType;
  freq: number;
  /** 扫频终点（可选，如闷响 140→60Hz） */
  freqEnd?: number;
  dur: number;
  /** 相对该 SFX 音量比例 0..1 */
  gain: number;
  /** 延迟秒（多音序用） */
  delay?: number;
}

export interface NoisePart {
  kind: 'noise';
  dur: number;
  gain: number;
  /** 低通滤波截止 Hz（闷轰质感） */
  filterFreq: number;
  delay?: number;
}

export type SfxPart = TonePart | NoisePart;

export interface SfxSpec {
  id: SfxId | KillVariant;
  /** 同事件最小间隔 ms（min-gap 限流，bible §3） */
  minGapMs: number;
  /** 基线音量 dBFS（bible §2 音量基线） */
  gainDb: number;
  parts: SfxPart[];
}

/** 事件类 SFX（非击杀） */
export const SFX_PALETTE: Record<SfxId, SfxSpec> = {
  // #1 武器发射：短高频 blip（飞弹尖锐，bible §2）
  weapon: {
    id: 'weapon',
    minGapMs: 50,
    gainDb: -12,
    parts: [{ kind: 'tone', type: 'square', freq: 880, freqEnd: 1320, dur: 0.08, gain: 0.3 }],
  },
  // #3 拾取·宝石叮声：高音上行 2 音（蓝宝石电光蓝高亮感，bible §2）
  gem: {
    id: 'gem',
    minGapMs: 80,
    gainDb: -6,
    parts: [
      { kind: 'tone', type: 'sine', freq: 880, dur: 0.06, gain: 0.35 },
      { kind: 'tone', type: 'sine', freq: 1318.5, dur: 0.14, gain: 0.3, delay: 0.06 },
    ],
  },
  // #5 受击·玩家：短促低音「啪」，闷不尖锐（bible §2，避免惊吓）
  hurt: {
    id: 'hurt',
    minGapMs: 100,
    gainDb: -4,
    parts: [{ kind: 'tone', type: 'sine', freq: 200, freqEnd: 90, dur: 0.12, gain: 0.4 }],
  },
  // #6 升级·选卡确认：短促上行「叮」（0.15s，干净高辨识，bible §2）
  confirm: {
    id: 'confirm',
    minGapMs: 200,
    gainDb: -6,
    parts: [
      { kind: 'tone', type: 'sine', freq: 660, dur: 0.07, gain: 0.3 },
      { kind: 'tone', type: 'sine', freq: 990, dur: 0.15, gain: 0.3, delay: 0.07 },
    ],
  },
  // #8 Boss 出场：低频重音 + 噪声闷轰（bible §2 / enemies §④ 终局压迫）
  boss: {
    id: 'boss',
    minGapMs: 1000,
    gainDb: -3,
    parts: [
      { kind: 'tone', type: 'sine', freq: 80, freqEnd: 40, dur: 0.5, gain: 0.7 },
      { kind: 'noise', dur: 0.25, gain: 0.35, filterFreq: 300 },
    ],
  },
  // #9 胜利 sting：短促上行琶音（bible §2，结算页情绪定调）
  victory: {
    id: 'victory',
    minGapMs: 500,
    gainDb: -4,
    parts: [
      { kind: 'tone', type: 'triangle', freq: 523.25, dur: 0.18, gain: 0.3 },
      { kind: 'tone', type: 'triangle', freq: 659.25, dur: 0.18, gain: 0.3, delay: 0.09 },
      { kind: 'tone', type: 'triangle', freq: 783.99, dur: 0.18, gain: 0.3, delay: 0.18 },
      { kind: 'tone', type: 'triangle', freq: 1046.5, dur: 0.3, gain: 0.32, delay: 0.27 },
    ],
  },
  // #9 失败 sting：下行两音 + 静默（bible §3 沉默设计衔接）
  defeat: {
    id: 'defeat',
    minGapMs: 500,
    gainDb: -4,
    parts: [
      { kind: 'tone', type: 'triangle', freq: 392, dur: 0.3, gain: 0.3 },
      { kind: 'tone', type: 'triangle', freq: 311.13, dur: 0.5, gain: 0.3, delay: 0.24 },
    ],
  },
};

/** 击杀闷响 4 变体（bible §2 #2：行尸/血犬/屠夫更重/Boss 最重，均为低频短音） */
export const KILL_VARIANTS: Record<KillVariant, SfxSpec> = {
  zombie: {
    id: 'zombie',
    minGapMs: 60,
    gainDb: -8,
    parts: [{ kind: 'tone', type: 'sine', freq: 140, freqEnd: 60, dur: 0.16, gain: 0.5 }],
  },
  wolf: {
    id: 'wolf',
    minGapMs: 60,
    gainDb: -8,
    parts: [{ kind: 'tone', type: 'sine', freq: 120, freqEnd: 55, dur: 0.14, gain: 0.45 }],
  },
  tank: {
    id: 'tank',
    minGapMs: 60,
    gainDb: -8,
    parts: [{ kind: 'tone', type: 'sine', freq: 100, freqEnd: 45, dur: 0.22, gain: 0.6 }],
  },
  boss: {
    id: 'boss',
    minGapMs: 60,
    gainDb: -6,
    parts: [
      { kind: 'tone', type: 'sine', freq: 70, freqEnd: 35, dur: 0.4, gain: 0.7 },
      { kind: 'noise', dur: 0.25, gain: 0.3, filterFreq: 300 },
    ],
  },
};
