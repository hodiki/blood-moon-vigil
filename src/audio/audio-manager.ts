/**
 * audio/audio-manager.ts —— 程序合成音频引擎（audio-bible §4/§6 工程接入）
 *
 * 架构（ARCH §2 依赖方向：本模块被 scenes/、ui/ 依赖；不反向依赖玩法状态）：
 * - 单例 AudioManager；init() 从 Phaser `this.sound`（WebAudio 后端）取 AudioContext，
 *   不自行 new（bible §4）。总线末端挂 DynamicsCompressor（-12dB / 4:1 / attack 5ms /
 *   release 150ms）防爆（bible §3）。
 * - 全部发声为 WebAudio 振荡器/噪声节点 → masterGain → compressor → ctx.destination：
 *   零外部文件、零 npm 音频包。
 * - 手势解锁：BootScene「点击开始」回调调 unlock()（bible §4 / ux-spec §1）；
 *   未解锁前一切 play 为 no-op（不报错）。Phaser 3.90 自带 body 手势监听 +
 *   VISIBLE/`interrupted` resume，本层补心跳时钟再同步。
 * - BGM 两层（bible §1）：氛围垫层（低八度正弦 pad + 空气噪声，恒定低音量）+ 程序心跳层
 *   （单例振荡器 55~70Hz + 短 envelope；BPM 消费 spawner.elapsedSeconds 分段线性 60→140；
 *   濒死 HP<30% BPM+10/音量+2dB；暂停/选卡 -4dB；Boss 双拍 +3dB；死亡/胜利瞬间 0.3s 静默）。
 * - SFX：min-gap 限流 + 同发上限 6 路，超限弃新保旧（bible §4）。
 * - 静音：masterGain=0（≠ 关 AudioContext，保持 unlock 状态，恢复零延迟，bible §6）。
 * - 触觉：navigator.vibrate（受击 15ms / Boss 双震 [30,50,30]），默认关，随「减少闪烁」
 *   入口可选开启（bible §6）。
 */

import Phaser from 'phaser';
import { GamePhase } from '@/core/game-state';
import {
  HEARTBEAT,
  AUDIO_LIMITS,
  clamp01,
  dbToGain,
  heartbeatBpmAt,
  heartbeatBpmWithDanger,
  heartbeatFrequency,
  heartbeatGainDb,
  shouldFire,
  canStartVoice,
  readMuted,
  writeMuted,
  readReduceFlash,
  writeReduceFlash,
  readHaptics,
  writeHaptics,
  type AudioStorage,
} from '@/audio/audio-math';
import { SFX_PALETTE, KILL_VARIANTS, type SfxId, type KillVariant, type SfxSpec } from '@/audio/sfx-palette';

/** 单条 SFX 包络：瞬时攻击 + 指数衰减（短促不爆音） */
function applyEnvelope(gain: GainNode, t0: number, dur: number, peak: number): void {
  const g = gain.gain;
  const safePeak = Math.max(0.0001, peak);
  g.setValueAtTime(0.0001, t0);
  g.linearRampToValueAtTime(safePeak, t0 + 0.008);
  g.exponentialRampToValueAtTime(0.0001, t0 + dur);
}

/** 一次性白噪声 buffer（Boss 噪声/氛围空气层共用，缓存一次） */
function createNoiseBuffer(ctx: BaseAudioContext, seconds = 1): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

interface AudioManagerOptions {
  isMobile?: boolean;
  storage?: AudioStorage;
}

export class AudioManager {
  private static instance: AudioManager | null = null;

  static getInstance(): AudioManager {
    if (!AudioManager.instance) AudioManager.instance = new AudioManager();
    return AudioManager.instance;
  }

  // —— 引擎句柄 ——
  private sound: Phaser.Sound.BaseSoundManager | null = null;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private gameplayGain: GainNode | null = null; // 心跳+垫层（静默/启停控制）
  private sfxGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  // —— 状态 ——
  private unlocked = false;
  private muted = false;
  private reduceFlash = false;
  private haptics = false;
  private gameplayActive = false;
  private hpFraction = 1;
  private bossMode = false;
  private beatAcc = 0; // 距上一拍累计秒（BPM 驱动）
  private currentHeartbeatPeak = 0.0001;
  private silenceUntil = 0; // ctx.currentTime 时刻（死亡/胜利 0.3s 纯静默）
  private pendingStingTimeout: number | null = null;

  // —— 心跳节点（单例常驻，只改 frequency/gain 不重建，bible §4） ——
  private heartbeatOsc: OscillatorNode | null = null;
  private heartbeatGain: GainNode | null = null;
  private padGain: GainNode | null = null;

  // —— SFX 限流 ——
  private lastSfxAt = new Map<string, number>();
  private activeVoices = 0;

  // —— 生命周期监听 ——
  private onVisibilityChange: (() => void) | null = null;

  // —— BUG-6 手势 resume 重试（NV-REVIEW-FIX-F P1-17）——
  /** pointerdown/keydown 常驻监听（unlock 失败后任意手势重试 resume） */
  private gestureRetryHandlers: Array<() => void> = [];
  /** 上次手势 resume 时刻（节流；performance.now() ms） */
  private lastGestureResumeAt = 0;

  private storage: AudioStorage = {
    getItem: () => null,
    setItem: () => undefined,
  };

  private constructor() {}

  // —— 初始化 / 拆装 ——

  /** 用 Phaser 的 WebAudio 后端初始化（BootScene.create 调用；幂等）。HTML5Audio 兜底静默降级。 */
  init(sound: Phaser.Sound.BaseSoundManager, opts: AudioManagerOptions = {}): void {
    this.storage =
      opts.storage ?? (typeof window !== 'undefined' && window.localStorage ? window.localStorage : this.storage);
    this.muted = readMuted(this.storage);
    this.reduceFlash = readReduceFlash(this.storage);
    this.haptics = readHaptics(this.storage);
    const wa = sound as Phaser.Sound.WebAudioSoundManager;
    const ctx = wa.context;
    if (!ctx) return; // 非 WebAudio 后端：程序合成不可用，静默降级（不报错）
    if (this.ctx === ctx && this.masterGain) return; // 同一 context 幂等
    this.sound = sound;
    this.ctx = ctx;
    this.teardownGraph();
    this.buildGraph(ctx, opts.isMobile ?? false);
    this.installLifecycleListeners(ctx);
    this.installGestureRetry(ctx);
  }

  /**
   * BUG-6（P1-17）：手势解锁失败后的常驻重试。
   * 背景：浏览器自动播放策略下 unlock 可能失败（ctx 仍 suspended），此后无手势重试路径
   * → 移动端整局静音。修复：pointerdown / keydown 常驻监听（passive），节流 800ms 调
   * ctx.resume()（幂等、失败静默）。ctx 已 running 时零开销直接返回。
   */
  private installGestureRetry(ctx: AudioContext): void {
    if (typeof window === 'undefined') return;
    const tryResume = (): void => {
      if (this.ctx !== ctx || ctx.state !== 'suspended') return;
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now - this.lastGestureResumeAt < 800) return; // 节流：高频手势不刷 resume
      this.lastGestureResumeAt = now;
      ctx.resume().catch(() => undefined);
    };
    window.addEventListener('pointerdown', tryResume, { passive: true });
    window.addEventListener('keydown', tryResume, { passive: true });
    this.gestureRetryHandlers = [tryResume, tryResume];
  }

  /** 手势重试监听拆装（destroy 调用） */
  private uninstallGestureRetry(): void {
    if (typeof window === 'undefined') return;
    for (const h of this.gestureRetryHandlers) {
      window.removeEventListener('pointerdown', h);
      window.removeEventListener('keydown', h);
    }
    this.gestureRetryHandlers = [];
  }

  /** 手势解锁（BootScene「点击开始」回调；幂等，移动端必须） */
  unlock(): void {
    this.unlocked = true;
    const wa = this.sound as Phaser.Sound.WebAudioSoundManager | null;
    if (wa && typeof wa.unlock === 'function') {
      try {
        wa.unlock(); // Phaser 内部 body 手势监听 + resume AudioContext
      } catch {
        // 忽略：unlock 是尽力而为
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => undefined);
    }
    this.beatAcc = 0; // 解锁后从整拍开始
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  /** 场景销毁时完整拆装（Demo 生命周期内不调用，留作完整性） */
  destroy(): void {
    if (this.onVisibilityChange && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
      this.onVisibilityChange = null;
    }
    if (this.ctx) this.ctx.onstatechange = null;
    this.uninstallGestureRetry();
    this.teardownGraph();
    this.sound = null;
    this.ctx = null;
  }

  private buildGraph(ctx: AudioContext, isMobile: boolean): void {
    // 总线末端压缩器（bible §3：threshold -12dB / ratio 4:1 / attack 5ms / release 150ms）
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 1;
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -12;
    this.compressor.knee.value = 0;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.005;
    this.compressor.release.value = 0.15;
    this.masterGain.connect(this.compressor);
    this.compressor.connect(ctx.destination);

    // 分组：游戏音乐（心跳+垫层）与 SFX 分开，静默只影响音乐层
    this.gameplayGain = ctx.createGain();
    this.gameplayGain.gain.value = 0; // 未开始对局前不可闻
    this.gameplayGain.connect(this.masterGain);
    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = 1;
    this.sfxGain.connect(this.masterGain);

    // 氛围垫层（bible §1：低八度 pad + 空气噪声；移动端只用单层 pad 省内存，bible §6）
    this.padGain = ctx.createGain();
    this.padGain.gain.value = dbToGain(-18); // 底垫 -18dB（bible §3：BGM 底垫 -18~-14）
    this.padGain.connect(this.gameplayGain);
    const o1 = ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.value = 55; // A1 低八度暗调地基
    o1.connect(this.padGain);
    o1.start();
    if (!isMobile) {
      const o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = 82.5; // E2 五度叠置
      o2.connect(this.padGain);
      o2.start();
      const noise = ctx.createBufferSource();
      noise.buffer = this.ensureNoiseBuffer(ctx);
      noise.loop = true;
      const nf = ctx.createBiquadFilter();
      nf.type = 'lowpass';
      nf.frequency.value = 400;
      const ng = ctx.createGain();
      ng.gain.value = 0.22;
      noise.connect(nf);
      nf.connect(ng);
      ng.connect(this.padGain);
      noise.start();
    }

    // 心跳层：单例振荡器 + 短 envelope（bible §1：低频正弦脉冲 55~70Hz）
    this.heartbeatOsc = ctx.createOscillator();
    this.heartbeatOsc.type = 'sine';
    this.heartbeatOsc.frequency.value = heartbeatFrequency(HEARTBEAT.BPM_MIN);
    this.heartbeatGain = ctx.createGain();
    this.heartbeatGain.gain.value = 0.0001;
    this.heartbeatOsc.connect(this.heartbeatGain);
    this.heartbeatGain.connect(this.gameplayGain);
    this.heartbeatOsc.start();
  }

  private teardownGraph(): void {
    try {
      this.heartbeatOsc?.stop();
      this.heartbeatOsc?.disconnect();
      this.heartbeatGain?.disconnect();
      this.padGain?.disconnect();
      this.gameplayGain?.disconnect();
      this.sfxGain?.disconnect();
      this.compressor?.disconnect();
      this.masterGain?.disconnect();
    } catch {
      // 已断开/未启动则忽略
    }
    this.heartbeatOsc = null;
    this.heartbeatGain = null;
    this.padGain = null;
    this.gameplayGain = null;
    this.sfxGain = null;
    this.compressor = null;
    this.masterGain = null;
  }

  private installLifecycleListeners(ctx: AudioContext): void {
    // 切后台挂起、回前台恢复（bible §6；Phaser 3.88+ 已处理 VISIBLE resume，此处补拍点同步）
    if (typeof document !== 'undefined') {
      this.onVisibilityChange = () => {
        if (document.hidden) {
          ctx.suspend().catch(() => undefined);
        } else {
          ctx.resume().catch(() => undefined);
          this.beatAcc = 0; // 防切后台期间累计多拍
        }
      };
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
    // iOS 电话打断 / interrupted：context 回到 running 时重置拍点（bible §6）
    ctx.onstatechange = () => {
      if (ctx.state === 'running') this.beatAcc = 0;
    };
  }

  private ensureNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuffer) this.noiseBuffer = createNoiseBuffer(ctx);
    return this.noiseBuffer;
  }

  // —— 对局生命周期（PlayScene.create / update / shutdown 调用） ——

  /** 新一局开始：BPM 重置回 60、恢复音乐层（bible §4 scene.restart 语义） */
  startGameplay(): void {
    this.gameplayActive = true;
    this.hpFraction = 1;
    this.bossMode = false;
    this.beatAcc = 0;
    this.silenceUntil = 0;
    if (this.pendingStingTimeout !== null) {
      window.clearTimeout(this.pendingStingTimeout);
      this.pendingStingTimeout = null;
    }
    if (this.ctx && this.gameplayGain) {
      this.gameplayGain.gain.setTargetAtTime(1, this.ctx.currentTime, 0.02);
    }
  }

  /** 场景关闭：停止音乐层（重开 scene.restart 由 startGameplay 恢复） */
  stopGameplay(): void {
    this.gameplayActive = false;
    if (this.pendingStingTimeout !== null) {
      window.clearTimeout(this.pendingStingTimeout);
      this.pendingStingTimeout = null;
    }
    if (this.ctx && this.gameplayGain) {
      this.gameplayGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
    }
  }

  /**
   * 每帧驱动（PlayScene.update 调用，早于 RUNNING 短路）：
   * BPM 消费 spawner.elapsedSeconds；暂停/选卡心跳层 -4dB；GAMEOVER 由 handleGameOver 接管。
   */
  update(elapsedSeconds: number, hpFraction: number, phase: GamePhase, dtSeconds: number): void {
    this.hpFraction = clamp01(hpFraction);
    if (!this.gameplayActive || !this.unlocked || !this.ctx || !this.heartbeatGain || !this.heartbeatOsc) return;
    const now = this.ctx.currentTime;
    if (now < this.silenceUntil) return; // 0.3s 纯静默窗口
    const bpm = heartbeatBpmWithDanger(heartbeatBpmAt(elapsedSeconds), this.hpFraction);
    const ducked = phase === GamePhase.LEVEL_UP || phase === GamePhase.PAUSED;
    const gainDb =
      heartbeatGainDb(this.hpFraction) +
      (ducked ? HEARTBEAT.DUCK_DB : 0) +
      (this.bossMode ? HEARTBEAT.BOSS_DB_BONUS : 0);
    this.currentHeartbeatPeak = dbToGain(gainDb);
    // 基频平滑跟随 BPM（55~70Hz）
    this.heartbeatOsc.frequency.setTargetAtTime(heartbeatFrequency(bpm), now, 0.1);
    // 拍点累计（dt 上限 0.25s 防切后台多拍连发）
    this.beatAcc += Math.min(Math.max(dtSeconds, 0), 0.25);
    const interval = 60 / Math.max(1, bpm);
    while (this.beatAcc >= interval) {
      this.beatAcc -= interval;
      this.triggerBeat(now);
    }
  }

  /** Boss 战模式：心跳双拍 + 音量 +3dB（BossSpawned/BossDefeated 事件驱动） */
  setBossMode(on: boolean): void {
    this.bossMode = on;
  }

  // —— 死亡/胜利：瞬间静默 → 0.3s 纯静默 → sting（bible §3 沉默设计） ——

  handleGameOver(victory: boolean): void {
    this.gameplayActive = false;
    if (this.pendingStingTimeout !== null) {
      window.clearTimeout(this.pendingStingTimeout);
      this.pendingStingTimeout = null;
    }
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.silenceUntil = now + HEARTBEAT.SILENCE_SECONDS;
    if (this.gameplayGain) {
      // 瞬间静音（0ms 淡出）：世界突然静止
      this.gameplayGain.gain.cancelScheduledValues(now);
      this.gameplayGain.gain.setValueAtTime(0, now);
    }
    // 0.3s 纯静默后接 sting（victory 上行琶音 / defeat 下行两音）
    this.pendingStingTimeout = window.setTimeout(() => {
      this.pendingStingTimeout = null;
      this.playSfx(victory ? 'victory' : 'defeat');
    }, HEARTBEAT.SILENCE_SECONDS * 1000);
  }

  // —— SFX ——

  /** 事件类 SFX（限流 + 同发上限，弃新保旧） */
  playSfx(id: SfxId): void {
    if (!this.ctx || !this.unlocked || this.muted) return;
    if (this.ctx.currentTime < this.silenceUntil) return;
    const spec = SFX_PALETTE[id];
    if (!spec) return;
    if (!shouldFire(this.lastSfxAt.get(id) ?? 0, performance.now(), spec.minGapMs)) return;
    if (!canStartVoice(this.activeVoices, AUDIO_LIMITS.MAX_SFX_VOICES)) return;
    this.lastSfxAt.set(id, performance.now());
    this.activeVoices += 1;
    this.scheduleSpec(spec);
  }

  /** 击杀闷响（4 变体：行尸/血犬/屠夫/Boss 递重，bible §2 #2） */
  playKill(variant: KillVariant): void {
    if (!this.ctx || !this.unlocked || this.muted) return;
    if (this.ctx.currentTime < this.silenceUntil) return;
    const spec = KILL_VARIANTS[variant] ?? KILL_VARIANTS.zombie;
    if (!shouldFire(this.lastSfxAt.get('kill') ?? 0, performance.now(), spec.minGapMs)) return;
    if (!canStartVoice(this.activeVoices, AUDIO_LIMITS.MAX_SFX_VOICES)) return;
    this.lastSfxAt.set('kill', performance.now());
    this.activeVoices += 1;
    this.scheduleSpec(spec);
  }

  /** 合成并调度一条 SFX：每 part 独立振荡器/噪声源，onended 统一回收节点与并发计数 */
  private scheduleSpec(spec: SfxSpec): void {
    const ctx = this.ctx;
    const master = this.masterGain;
    const sfxBus = this.sfxGain;
    if (!ctx || !master || !sfxBus) return;
    const t0 = ctx.currentTime;
    const baseGain = dbToGain(spec.gainDb) * 0.9; // 预留 headroom（压缩器限幅前）
    let remaining = spec.parts.length;
    const onPartEnd = (): void => {
      remaining -= 1;
      if (remaining <= 0) this.activeVoices = Math.max(0, this.activeVoices - 1);
    };
    for (const part of spec.parts) {
      const start = t0 + (part.delay ?? 0);
      const voiceGain = ctx.createGain();
      voiceGain.connect(sfxBus);
      applyEnvelope(voiceGain, start, part.dur, baseGain * part.gain);
      if (part.kind === 'tone') {
        const osc = ctx.createOscillator();
        osc.type = part.type;
        osc.frequency.setValueAtTime(part.freq, start);
        if (part.freqEnd !== undefined && part.freqEnd !== part.freq) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(1, part.freqEnd), start + part.dur);
        }
        osc.connect(voiceGain);
        osc.start(start);
        osc.stop(start + part.dur + 0.02);
        osc.onended = () => {
          osc.disconnect();
          voiceGain.disconnect();
          onPartEnd();
        };
      } else {
        const src = ctx.createBufferSource();
        src.buffer = this.ensureNoiseBuffer(ctx);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(part.filterFreq, start);
        src.connect(filter);
        filter.connect(voiceGain);
        src.start(start);
        src.stop(start + part.dur + 0.02);
        src.onended = () => {
          src.disconnect();
          filter.disconnect();
          voiceGain.disconnect();
          onPartEnd();
        };
      }
    }
  }

  /** 心跳拍 envelope（主拍；Boss 模式 0.3s 后补一击轻拍） */
  private triggerBeat(t: number): void {
    const g = this.heartbeatGain;
    if (!g) return;
    const peak = this.currentHeartbeatPeak;
    const gv = g.gain;
    gv.cancelScheduledValues(t);
    gv.setValueAtTime(0.0001, t);
    gv.linearRampToValueAtTime(Math.max(0.0001, peak), t + 0.012);
    gv.exponentialRampToValueAtTime(0.0001, t + 0.16);
    if (this.bossMode) {
      const t2 = t + 0.3;
      gv.setValueAtTime(0.0001, t2);
      gv.linearRampToValueAtTime(Math.max(0.0001, peak * 0.7), t2 + 0.012);
      gv.exponentialRampToValueAtTime(0.0001, t2 + 0.16);
    }
  }

  // —— 设置（LocalStorage 持久化，静音 ≠ 关 AudioContext） ——

  setMuted(muted: boolean): void {
    this.muted = muted;
    writeMuted(this.storage, muted);
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.01);
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  setReduceFlash(value: boolean): void {
    this.reduceFlash = value;
    writeReduceFlash(this.storage, value);
  }

  isReduceFlash(): boolean {
    return this.reduceFlash;
  }

  setHaptics(value: boolean): void {
    this.haptics = value;
    writeHaptics(this.storage, value);
  }

  isHaptics(): boolean {
    return this.haptics;
  }

  /** 触觉反馈：默认关，随「减少闪烁」入口可选开启（bible §6） */
  vibrate(pattern: number | number[]): void {
    if (!this.haptics || !this.reduceFlash) return;
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    try {
      navigator.vibrate(pattern);
    } catch {
      // 不支持/被拒不报错
    }
  }
}
