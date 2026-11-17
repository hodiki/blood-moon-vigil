/**
 * NV-ENG-EXEC-30 —— 玩家走循环永不播放（`-walk-s` 自复燃死循环）回归锁。
 *
 * 缺陷：`playVisual` 原守卫 `cur === idle || !sprite.anims.isPlaying` 的第二项。
 * `start` 是**单帧 + repeat:0**，166.7ms 后必然 `isPlaying === false`，于是下一帧再次命中该条件
 * 重播 `start` → `move` 一次都播不到 → 玩家全走路帧都是同一张「侧向直立」离站图。
 *
 * 本测试用最小 mock 驱动 `playVisual`（不依赖真实 Phaser 渲染），核心断言：
 *   play 调用序列必须是 **`start` 恰好一次 → 之后全是 `move`**，`start` 绝不允许出现第二次。
 */
import { describe, it, expect } from 'vitest';
import { playVisual } from '@/fx/anim';

type Sprite = Parameters<typeof playVisual>[0];

/** 与真实 Phaser 60fps 采样间隔一致 */
const FRAME_MS = 16;
/** `anim.ts` 中 start 为单帧 `frameRate: 6, repeat: 0` → 1000/6 ≈ 166.7ms */
const START_MS = 1000 / 6;
const INF = Number.POSITIVE_INFINITY;

/** 最小 AnimationState 替身：只需 exists / currentAnim / isPlaying / play */
class MockAnimState {
  currentAnim: { key: string } | null = null;
  isPlaying = false;
  private remainingMs = INF;
  private timerOn = false;

  constructor(
    private readonly existsKeys: Set<string>,
    private readonly durations: Record<string, number>,
  ) {}

  exists(key: string): boolean {
    return this.existsKeys.has(key);
  }

  play(key: string): void {
    this.currentAnim = { key };
    this.isPlaying = true;
    this.remainingMs = this.durations[key] ?? INF;
    this.timerOn = Number.isFinite(this.remainingMs);
  }

  stop(): void {
    this.isPlaying = false;
    this.timerOn = false;
  }

  /** 模拟 Phaser 动画时钟：repeat:0 的单次动画走完即 isPlaying=false（currentAnim 保留，这正是缺陷触发点） */
  advance(dtMs: number): void {
    if (!this.isPlaying || !this.timerOn) return;
    this.remainingMs -= dtMs;
    if (this.remainingMs <= 0) {
      this.isPlaying = false;
      this.timerOn = false;
    }
  }
}

interface Harness {
  sprite: Sprite;
  anims: MockAnimState;
  /** 被测期间 `sprite.play(key)` 的调用序列（不含 startAt 的预置） */
  calls: string[];
  /** 每帧结束时的 `currentAnim.key` */
  keys: string[];
  /** 每帧结束时的 `isPlaying` */
  playing: boolean[];
  /** 把精灵预置到某个动画并清空调用记录 */
  startAt: (key: string) => void;
}

function makeHarness(base: string, walkS = true, startMs = START_MS): Harness {
  const existsKeys = new Set<string>([`${base}-idle`, `${base}-move`]);
  const durations: Record<string, number> = {
    [`${base}-idle`]: INF, // repeat:-1
    [`${base}-move`]: INF, // repeat:-1
  };
  if (walkS) {
    existsKeys.add(`${base}-walk-start`);
    durations[`${base}-walk-start`] = startMs;
  }

  const anims = new MockAnimState(existsKeys, durations);
  const calls: string[] = [];
  const record = (key: string): void => {
    calls.push(key);
    anims.play(key);
  };

  const sprite = {
    scene: { anims },
    anims: {
      get currentAnim() {
        return anims.currentAnim;
      },
      get isPlaying() {
        return anims.isPlaying;
      },
      play: record,
      stop: () => anims.stop(),
    },
    play: record,
    frame: { name: base },
    setTexture: () => undefined,
    setFlipX: () => undefined,
    flipX: false,
    body: null,
  };

  return {
    sprite: sprite as unknown as Sprite,
    anims,
    calls,
    keys: [],
    playing: [],
    startAt: (key: string) => {
      anims.play(key);
      calls.length = 0;
    },
  };
}

/** 跑 n 帧：先推进动画时钟（模拟 update 顺序中动画先结算），再调 playVisual */
function run(h: Harness, base: string, frames: number, moving: boolean): void {
  for (let i = 0; i < frames; i += 1) {
    h.anims.advance(FRAME_MS);
    playVisual(h.sprite, base, moving);
    h.keys.push(h.anims.currentAnim?.key ?? '(none)');
    h.playing.push(h.anims.isPlaying);
  }
}

const VIOLET = 'hero-violet';
const CASSANDRA = 'hero-cassandra';

describe('playVisual 走循环（NV-ENG-EXEC-30：-walk-s 只播一次，move 必须循环）', () => {
  it('idle → 持续移动：play 序列为 start 一次 → move，且 start 绝不出现第二次', () => {
    const h = makeHarness(VIOLET, true);
    h.startAt(`${VIOLET}-idle`);
    run(h, VIOLET, 90, true); // 1.44s，远超 start 的 166.7ms

    expect(h.calls).toEqual([`${VIOLET}-walk-start`, `${VIOLET}-move`]);
    expect(h.calls.filter((k) => k === `${VIOLET}-walk-start`)).toHaveLength(1);
    // move 只 play 一次即稳定循环（不每帧重播）
    expect(h.calls.filter((k) => k === `${VIOLET}-move`)).toHaveLength(1);
  });

  it('核心断言：第一段是 start，之后**全部**是 move（不是清一色 start）', () => {
    const h = makeHarness(VIOLET, true);
    h.startAt(`${VIOLET}-idle`);
    run(h, VIOLET, 90, true);

    const firstMove = h.keys.indexOf(`${VIOLET}-move`);
    expect(firstMove).toBeGreaterThan(0); // 确实先播过 start
    expect(h.keys[0]).toBe(`${VIOLET}-walk-start`);
    // 从切到 move 起，之后每一帧都必须是 move（缺陷下这里会是 start）
    expect(h.keys.slice(firstMove).every((k) => k === `${VIOLET}-move`)).toBe(true);
    expect(h.keys.filter((k) => k === `${VIOLET}-move`).length).toBeGreaterThan(60);
  });

  it('start 播完后（isPlaying=false 但 cur 仍是 start）不得自复燃', () => {
    const h = makeHarness(VIOLET, true);
    h.startAt(`${VIOLET}-walk-start`); // 直接停在「start 刚播完」的现场
    h.anims.stop();
    expect(h.anims.currentAnim?.key).toBe(`${VIOLET}-walk-start`);
    expect(h.anims.isPlaying).toBe(false);

    run(h, VIOLET, 30, true);

    expect(h.calls).toEqual([`${VIOLET}-move`]);
    expect(h.keys.every((k) => k === `${VIOLET}-move`)).toBe(true);
  });

  it('start 正在播时不被重播、不被 move 打断', () => {
    const h = makeHarness(VIOLET, true);
    h.startAt(`${VIOLET}-walk-start`);
    run(h, VIOLET, 5, true); // 5×16=80ms < 166.7ms，仍在 start 内
    expect(h.calls).toEqual([]);
    expect(h.keys.every((k) => k === `${VIOLET}-walk-start`)).toBe(true);
    expect(h.playing.every((p) => p)).toBe(true);
  });

  it('移动 → 停止 → 再移动：start 重播一次再落回 move（离开 idle 才重播）', () => {
    const h = makeHarness(VIOLET, true);
    h.startAt(`${VIOLET}-idle`);
    run(h, VIOLET, 40, true);
    run(h, VIOLET, 20, false); // 停下
    run(h, VIOLET, 40, true); // 再走

    expect(h.calls).toEqual([
      `${VIOLET}-walk-start`,
      `${VIOLET}-move`,
      `${VIOLET}-idle`,
      `${VIOLET}-walk-start`,
      `${VIOLET}-move`,
    ]);
    expect(h.keys[h.keys.length - 1]).toBe(`${VIOLET}-move`);
  });

  it('无 -walk-s 的角色（cassandra）直接 move，序列里没有 start（不回归）', () => {
    const h = makeHarness(CASSANDRA, false);
    h.startAt(`${CASSANDRA}-idle`);
    run(h, CASSANDRA, 60, true);

    expect(h.keys.some((k) => k.includes('walk-start'))).toBe(false);
    expect(h.calls).toEqual([`${CASSANDRA}-move`]);
    expect(h.keys.every((k) => k === `${CASSANDRA}-move`)).toBe(true);
  });

  it('停止时回 idle（有 start 的角色同路径）', () => {
    const h = makeHarness(VIOLET, true);
    h.startAt(`${VIOLET}-move`);
    run(h, VIOLET, 3, false);
    expect(h.calls).toEqual([`${VIOLET}-idle`]);
    expect(h.keys.every((k) => k === `${VIOLET}-idle`)).toBe(true);
  });

  it('Boss 不走 start 离站帧', () => {
    const h = makeHarness('boss-fenrir', true);
    h.startAt('boss-fenrir-idle');
    for (let i = 0; i < 40; i += 1) {
      h.anims.advance(FRAME_MS);
      playVisual(h.sprite, 'boss-fenrir', true, true);
    }
    expect(h.keys.every((k) => k === 'boss-fenrir-idle')).toBe(true);
  });

  it('无 move 动画（投射物等）不抛错', () => {
    const existsKeys = new Set<string>(['bolt-idle']);
    const anims = new MockAnimState(existsKeys, { 'bolt-idle': INF });
    const sprite = {
      scene: { anims },
      anims: {
        get currentAnim() {
          return anims.currentAnim;
        },
        get isPlaying() {
          return anims.isPlaying;
        },
        play: (k: string) => anims.play(k),
        stop: () => anims.stop(),
      },
      play: (k: string) => anims.play(k),
      frame: { name: 'bolt' },
      setTexture: () => undefined,
      body: null,
    } as unknown as Sprite;
    expect(() => playVisual(sprite, 'bolt', true)).not.toThrow();
    expect(anims.currentAnim?.key).toBe('bolt-idle');
  });

  it('start 时长实测：单帧 6fps 停留约 166.7ms（约 10 帧 60fps）', () => {
    const h = makeHarness(VIOLET, true);
    h.startAt(`${VIOLET}-idle`);
    run(h, VIOLET, 90, true);
    const startFrames = h.keys.indexOf(`${VIOLET}-move`);
    // 记录当前实现的离站停留帧数，作为「是否像一次卡顿」的量化依据
    expect(startFrames).toBeGreaterThanOrEqual(10);
    expect(startFrames * FRAME_MS).toBeGreaterThan(160);
    expect(startFrames * FRAME_MS).toBeLessThan(200);
  });
});
