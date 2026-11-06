/**
 * audio/sfx-palette.ts —— 程序合成 SFX 规格表（audio-bible §2）
 *
 * 全部为 WebAudio 振荡器/噪声合成参数，零外部文件、零 npm 音频包。
 * 首版必落 6 项（bible §7 红线）：武器发射 / 击杀闷响(4 变体) / 宝石叮声 / 玩家受击 /
 * 选卡确认 / Boss 出场重音；另附胜利/失败 sting（bible §7 建议随结算页落地，成本极低）。
 * 批 A-3（2026-10-16）补齐 bible §2 待补 3 项：#4 拾取·稀有金铃 / #7 升级·卡滑入气声 /
 * #10 结算数字滚动 tick（主理人裁决 Q3=a 全补）。
 *
 * 合成约定：
 * - parts 每项独立振荡器/噪声源，delay 制造多音序（宝石上行 2 音、选卡双音、Boss 低频+噪声）
 * - gain 为相对该 SFX 音量比例 0..1；gainDb 为该事件基线 dB（bible §2 音量基线）
 * - minGapMs 为同事件限流窗口（bible §3：宝石密集时每 80ms 最多 1 声）
 * - priority 为同发让位优先级（bible §3 优先级表，低优先让位；见 SFX_PRIORITY）
 */

export type SfxId =
  | 'weapon'
  | 'gem'
  | 'hurt'
  | 'confirm'
  | 'boss'
  | 'victory'
  | 'defeat'
  | 'rare'
  | 'cardSlide'
  | 'tick';

/** 击杀变体（bible §2 #2：行尸/血犬/屠夫更重/Boss 最重） */
export type KillVariant = 'zombie' | 'wolf' | 'tank' | 'boss';

/**
 * SFX 优先级层级（audio-bible §3：同发冲突时，低优先让位）：
 * 受击/选卡确认/Boss 出场 > 击杀 > 拾取 > 武器发射 > BGM > 装饰（卡滑入/数字滚动）。
 * BGM 不进 SFX 发声池（独立总线 + 压缩器），此处只覆盖一次性 SFX。
 */
export const SFX_PRIORITY = {
  /** 装饰：卡滑入 / 结算 tick（最低，任何同发冲突都让位） */
  DECORATION: 0,
  /** 武器发射 */
  WEAPON: 1,
  /** 拾取：宝石叮声 / 稀有金铃 */
  PICKUP: 2,
  /** 击杀闷响 */
  KILL: 3,
  /** 受击 / 选卡确认 / Boss 出场 / 胜利失败 sting（最高） */
  CRITICAL: 4,
} as const;

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
  /** 滤波截止/中心 Hz（闷轰质感用低通；气声用高通/带通） */
  filterFreq: number;
  /** 滤波型（缺省 lowpass＝闷轰；气声「嘶」用 highpass/bandpass） */
  filterType?: BiquadFilterType;
  /** 滤波 Q（可选；带通塑形气声用） */
  filterQ?: number;
  delay?: number;
}

export type SfxPart = TonePart | NoisePart;

export interface SfxSpec {
  id: SfxId | KillVariant;
  /** 同发让位优先级（bible §3，SFX_PRIORITY 层级） */
  priority: number;
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
    priority: SFX_PRIORITY.WEAPON,
    minGapMs: 50,
    gainDb: -12,
    parts: [{ kind: 'tone', type: 'square', freq: 880, freqEnd: 1320, dur: 0.08, gain: 0.3 }],
  },
  // #3 拾取·宝石叮声：高音上行 2 音（蓝宝石电光蓝高亮感，bible §2）
  gem: {
    id: 'gem',
    priority: SFX_PRIORITY.PICKUP,
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
    priority: SFX_PRIORITY.CRITICAL,
    minGapMs: 100,
    gainDb: -4,
    parts: [{ kind: 'tone', type: 'sine', freq: 200, freqEnd: 90, dur: 0.12, gain: 0.4 }],
  },
  // #6 升级·选卡确认：短促上行「叮」（0.15s，干净高辨识，bible §2）
  confirm: {
    id: 'confirm',
    priority: SFX_PRIORITY.CRITICAL,
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
    priority: SFX_PRIORITY.CRITICAL,
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
    priority: SFX_PRIORITY.CRITICAL,
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
    priority: SFX_PRIORITY.CRITICAL,
    minGapMs: 500,
    gainDb: -4,
    parts: [
      { kind: 'tone', type: 'triangle', freq: 392, dur: 0.3, gain: 0.3 },
      { kind: 'tone', type: 'triangle', freq: 311.13, dur: 0.5, gain: 0.3, delay: 0.24 },
    ],
  },
  // #4 拾取·稀有：独特金铃「叮——咚」（bible §2，锚点 3 琥珀金稀有度）
  // ⚠ 与 #3 普通宝石叮声的区分手段（四重，确保「明显可区分」）：
  //   ① 音高轮廓反转：#3 上行（880→1318.5 A5→E6），#4 下行（1318.5→659.25 E6→E5 八度下行）
  //   ② 节奏拉开：#3 两音紧接 60ms 干脆；#4 「叮——」后延留 220ms 才「咚」
  //   ③ 音色型不同：#3 纯 sine 电光清脆；#4 triangle 铃体 + E7 高频泛音（金属铃亮色）
  //   ④ 音区/时长：#4 第二音落中音区且总长 0.7s 带余韵（#3 全程高音区、0.2s 即收）
  rare: {
    id: 'rare',
    priority: SFX_PRIORITY.PICKUP,
    minGapMs: 150,
    gainDb: -6,
    parts: [
      // 「叮」：铃击 E6（triangle 铃体感）
      { kind: 'tone', type: 'triangle', freq: 1318.51, dur: 0.3, gain: 0.36 },
      // 铃亮色泛音 E7（极短，金属"铃"质）
      { kind: 'tone', type: 'sine', freq: 2637.02, dur: 0.1, gain: 0.13 },
      // 「咚」：下行 E5 金铃回荡（延留 0.22s）
      { kind: 'tone', type: 'triangle', freq: 659.25, dur: 0.42, gain: 0.32, delay: 0.22 },
      // 低支撑 E3（金铃余韵厚度，与 #3 的纯高音区拉开）
      { kind: 'tone', type: 'sine', freq: 329.63, dur: 0.48, gain: 0.15, delay: 0.22 },
    ],
  },
  // #7 升级·卡滑入：极轻「嘶」气声（bible §2，-20dB 不得喧宾夺主）
  cardSlide: {
    id: 'cardSlide',
    priority: SFX_PRIORITY.DECORATION,
    minGapMs: 100,
    gainDb: -20,
    parts: [
      // 气声 = 高通白噪（2kHz 以上空气感）；带 Q 的带通会更"人声嘶"，这里取更干净的高通
      { kind: 'noise', dur: 0.22, gain: 0.5, filterFreq: 2000, filterType: 'highpass' },
    ],
  },
  // #10 结算数字滚动：极轻 tick（bible §2，0.02s / -18dB，装饰层）
  tick: {
    id: 'tick',
    priority: SFX_PRIORITY.DECORATION,
    minGapMs: 80,
    gainDb: -18,
    parts: [
      // 2.2kHz 短点（0.02s），数字滚动起始微反馈；无余韵、无拖尾
      { kind: 'tone', type: 'sine', freq: 2200, dur: 0.02, gain: 0.55 },
    ],
  },
};

/** 击杀闷响 4 变体（bible §2 #2：行尸/血犬/屠夫更重/Boss 最重，均为低频短音） */
export const KILL_VARIANTS: Record<KillVariant, SfxSpec> = {
  zombie: {
    id: 'zombie',
    priority: SFX_PRIORITY.KILL,
    minGapMs: 60,
    gainDb: -8,
    parts: [{ kind: 'tone', type: 'sine', freq: 140, freqEnd: 60, dur: 0.16, gain: 0.5 }],
  },
  wolf: {
    id: 'wolf',
    priority: SFX_PRIORITY.KILL,
    minGapMs: 60,
    gainDb: -8,
    parts: [{ kind: 'tone', type: 'sine', freq: 120, freqEnd: 55, dur: 0.14, gain: 0.45 }],
  },
  tank: {
    id: 'tank',
    priority: SFX_PRIORITY.KILL,
    minGapMs: 60,
    gainDb: -8,
    parts: [{ kind: 'tone', type: 'sine', freq: 100, freqEnd: 45, dur: 0.22, gain: 0.6 }],
  },
  boss: {
    id: 'boss',
    priority: SFX_PRIORITY.KILL,
    minGapMs: 60,
    gainDb: -6,
    parts: [
      { kind: 'tone', type: 'sine', freq: 70, freqEnd: 35, dur: 0.4, gain: 0.7 },
      { kind: 'noise', dur: 0.25, gain: 0.3, filterFreq: 300 },
    ],
  },
};
