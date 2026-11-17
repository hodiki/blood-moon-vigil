import { describe, it, expect } from 'vitest';
import {
  ATTACK_FRAME_A_MS,
  OATHKEEPER_FRAME_ATTACK_A,
  OATHKEEPER_FRAME_ATTACK_B,
  OATHKEEPER_FRAME_IDLE,
  OATHKEEPER_FRAME_TOMBSTONE,
  OATHKEEPER_TEXTURE_KEY,
  OATHKEEPER_WALK_FRAMES,
  OathkeeperViewSprite,
  TELEPORT_GUARD_PX,
  WALK_FRAME_MS,
  type OathkeeperViewSpriteScene,
} from '@/weapons/companion/oathkeeper-view-sprite';
import { OathkeeperRuntime } from '@/weapons/companion/oathkeeper-runtime';

/**
 * 批次 E · 守誓者可视化「Phaser 壳」单测。
 *
 * 为什么壳能单测：本文件 `import type Phaser`（**type-only，编译期擦除**）+ 精灵只走
 * `setVisible/setTexture/setFlipX/setPosition/setDepth/setScale/setRotation/destroy` 八个方法
 * → Node 环境（vitest `environment: 'node'`）用 FakeSprite 即可全量驱动，无需 jsdom/canvas。
 *
 * 纪律（同批 D）：
 * 1. **期望值写字面量**（180 / 75 / 400 / −32 / 37÷6 / 8÷3），不用被测常量自证；
 * 2. 边界双向测（179 vs 180、74 vs 75、400 vs 400.5）；
 * 3. 每条用例注释写依据（裁决编号 / 交付单小节 / 批 D 报告 §7）。
 *
 * ⚠ **walk 帧长改过一次（330 → 180）**，故本文件的"推进节奏"全部按 **180ms/帧** 重算：
 * - 依据：NV-ENG-EXEC-27 A/B（`production/official-v1/守誓者批F-AB对比报告-2026-11-09.md`）。
 *   滑步比 3.18 FAIL → 1.74 CONCERNS；每姿势位移 ÷ 内容宽 0.51 → 0.28；一圈 1320ms → 720ms。
 * - 取法：凡"推进 dt 若干帧后应到某帧"的用例，**dt 取 60ms**（3 帧 = 180ms = 恰好一个帧长）——
 *   保留"整周期边界"这一被断言的语义，而不是把期望帧名改成一个凑出来的名字。
 * - 帧长的**唯一权威**仍是 `WALK_FRAME_MS` 常量本身；本文件只有 §9 那一条 `toBe(180)` 钉它。
 */

// 帧宽 → 显示缩放（`combatDisplayScale`：>=128 → 1，否则 128/宽）
const FRAME_WIDTH: Record<string, number> = {
  [OATHKEEPER_FRAME_IDLE]: 192,
  [OATHKEEPER_FRAME_TOMBSTONE]: 48,
  [OATHKEEPER_FRAME_ATTACK_A]: 192,
  [OATHKEEPER_FRAME_ATTACK_B]: 192,
  'summon-oathkeeper-walk-a': 192,
  'summon-oathkeeper-walk-b': 192,
  'summon-oathkeeper-walk-c': 192,
  'summon-oathkeeper-walk-d': 192,
};

/** 只实现壳真正调用到的 Phaser API（多一个方法都不需要 → 壳的依赖面就此被测试钉住） */
class FakeSprite {
  frame: { name: string; width: number } = { name: OATHKEEPER_FRAME_IDLE, width: 192 };
  visible = true;
  flipX = false;
  depth = 0;
  x = 0;
  y = 0;
  scale = 1;
  rotation = -1;
  destroyed = false;
  textureKey = '';
  textureSets = 0;
  scaleSets = 0;

  setVisible(v: boolean): this {
    this.visible = v;
    return this;
  }
  setFlipX(v: boolean): this {
    this.flipX = v;
    return this;
  }
  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }
  setDepth(d: number): this {
    this.depth = d;
    return this;
  }
  setScale(s: number): this {
    this.scale = s;
    this.scaleSets += 1;
    return this;
  }
  setRotation(r: number): this {
    this.rotation = r;
    return this;
  }
  setTexture(key: string, frame: string): this {
    this.textureKey = key;
    this.textureSets += 1;
    this.frame = { name: frame, width: FRAME_WIDTH[frame] ?? 192 };
    return this;
  }
  destroy(): void {
    this.destroyed = true;
  }
}

/** 最小场景替身：壳只碰 `textures.exists/get().has` 与 `add.sprite` */
function fakeScene(sprite: FakeSprite, frameReady = true): OathkeeperViewSpriteScene {
  return {
    textures: {
      exists: () => true,
      get: () => ({ has: () => frameReady }),
    },
    add: {
      sprite: () => sprite,
    },
  } as unknown as OathkeeperViewSpriteScene;
}

interface Harness {
  rt: OathkeeperRuntime;
  sprite: FakeSprite;
  view: OathkeeperViewSprite;
  player: { x: number; y: number };
}

/** 构造一个已启用 + 纹理就绪的壳（守誓者 + 玩家都在 (100,100)） */
function make(opts: { enabled?: boolean; frameReady?: boolean } = {}): Harness {
  const rt = new OathkeeperRuntime(100, 100);
  rt.setEnabled(opts.enabled ?? true);
  const sprite = new FakeSprite();
  const player = { x: 100, y: 100 };
  const view = new OathkeeperViewSprite(
    fakeScene(sprite, opts.frameReady ?? true),
    rt,
    player,
  );
  return { rt, sprite, view, player };
}

/** 推进 n 帧；每帧先把守誓者横移 dx（模拟跟随位移），再 update(dtSeconds) */
function pump(h: Harness, frames: number, dtSeconds: number, dx = 0): void {
  for (let i = 0; i < frames; i += 1) {
    h.rt.state.x += dx;
    h.view.update(dtSeconds);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. 构造与首帧
// ─────────────────────────────────────────────────────────────────────────────
describe('构造：精灵落地（交付单 §3.1 / 方案 §3.4）', () => {
  it('用 characters/summon-oathkeeper 建精灵，rotation 钉 0（斜 30° 已画进帧）', () => {
    const h = make();
    expect(h.sprite.frame.name).toBe('summon-oathkeeper');
    expect(h.sprite.rotation).toBe(0);
  });

  it('构造即 depth=30（裁决②/③）且 192 帧 scale=1', () => {
    const h = make();
    expect(h.sprite.depth).toBe(30);
    expect(h.sprite.scale).toBe(1);
  });

  it('构造后到首帧 update 之前不可见（避免 (state.x, state.y) 未修正的闪帧）', () => {
    const h = make();
    expect(h.sprite.visible).toBe(false);
  });

  it('纹理/缺帧 → 不建精灵、update 静默 no-op（缺资产不崩）', () => {
    const h = make({ frameReady: false });
    expect(h.sprite.destroyed).toBe(false); // 根本没被创建
    expect(h.sprite.textureSets).toBe(0);
    expect(() => h.view.update(0.016)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. idle
// ─────────────────────────────────────────────────────────────────────────────
describe('idle：只用基帧，不切 -v（裁决①）', () => {
  it('静止 → 可见、帧 = summon-oathkeeper、y = state.y − 32（脚底对齐）', () => {
    const h = make();
    h.view.update(0.016);
    expect(h.sprite.visible).toBe(true);
    expect(h.sprite.frame.name).toBe('summon-oathkeeper');
    expect(h.sprite.y).toBe(68); // 100 + (−32)
    expect(h.sprite.x).toBe(100);
  });

  it('连播 120 帧不出现 summon-oathkeeper-v（本版不做呼吸）', () => {
    const h = make();
    pump(h, 120, 0.016);
    expect(h.sprite.frame.name).toBe('summon-oathkeeper');
    expect(h.sprite.textureSets).toBe(0); // 帧从未变过 → 一次 setTexture 都不该发生
  });

  it('depth 恒 30、玩家在正右方 → 不翻转', () => {
    const h = make();
    h.player.x = 140;
    h.view.update(0.016);
    expect(h.sprite.depth).toBe(30);
    expect(h.sprite.flipX).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. move：180ms/帧，a→b→c→d
// ─────────────────────────────────────────────────────────────────────────────
describe('move：4 帧 180ms 步进（NV-ENG-EXEC-27 A/B 裁定值；取代交付单 §3.3 的 330）', () => {
  it('起步第一帧 = walk-a；移动态帧序 a→b→c→d→a（每 180ms 进一档）', () => {
    const h = make();
    // 每帧 6px / 0.06s = 100px/s（> 5px/s 阈值）；**3 帧 = 180ms = 恰好一个帧长**
    // （dt 必须整除帧长，否则"3 帧后应是下一帧"就不再成立 —— 这是本用例的时序前提）
    pump(h, 1, 0.06, 6);
    expect(h.view.viewState).toBe('move');
    expect(h.sprite.frame.name).toBe('summon-oathkeeper-walk-a');

    // 首帧不累加（进入 move 的边沿把累加器归零），故计时从第 2 帧起算
    pump(h, 3, 0.06, 6); // 180ms → 恰好 1 个帧长 → 进 b
    expect(h.sprite.frame.name).toBe('summon-oathkeeper-walk-b');

    pump(h, 3, 0.06, 6); // 360ms → 2 个帧长 → c
    expect(h.sprite.frame.name).toBe('summon-oathkeeper-walk-c');

    pump(h, 3, 0.06, 6); // 540ms → 3 个帧长 → d
    expect(h.sprite.frame.name).toBe('summon-oathkeeper-walk-d');

    pump(h, 3, 0.06, 6); // 720ms = 4 × 180 = 一整圈 → 回到 a
    expect(h.sprite.frame.name).toBe('summon-oathkeeper-walk-a');
  });

  // 帧长一旦再调（180 → 别的值），上面那条"3 帧 = 一个帧长"的用例会整体失效；
  // 本条不依赖帧长具体数值，只要求 **dt < 帧长**，把"帧序"这一语义单独钉住：
  // 单调前进（不回头）、单帧最多推进一档（不跳帧）、且 4 档循环回 a。
  it('帧序语义（帧长无关）：连续 update 期间 a→b→c→d 单调前进，不回头、不跳档', () => {
    const h = make();
    const index = (name: string): number => OATHKEEPER_WALK_FRAMES.indexOf(name as never);
    const seen: number[] = [];
    for (let i = 0; i < 24; i += 1) {
      pump(h, 1, 0.11, 6); // 110ms < 180ms 帧长 → 单帧最多推进一档
      expect(h.view.viewState).toBe('move');
      seen.push(index(h.sprite.frame.name));
    }
    expect(seen.every((v) => v >= 0)).toBe(true); // 全程都在 walk 四帧内（没掉回 idle）
    for (let i = 1; i < seen.length; i += 1) {
      const step = (seen[i]! - seen[i - 1]! + OATHKEEPER_WALK_FRAMES.length) % OATHKEEPER_WALK_FRAMES.length;
      expect(step === 0 || step === 1).toBe(true); // 0 = 本帧未换帧（正常），1 = 前进一档；2/3 = 跳档/倒退
    }
    // 24 帧 × 110ms = 2640ms ≥ 720ms 一圈 → 必须完整走过 4 档
    expect(new Set(seen).size).toBe(OATHKEEPER_WALK_FRAMES.length);
  });

  it('180ms 边界双向：179ms 仍是 a，180ms 进 b', () => {
    const h = make();
    pump(h, 1, 0.01, 1); // 首帧：归零 + 定 a
    expect(h.sprite.frame.name).toBe('summon-oathkeeper-walk-a');

    pump(h, 1, 0.179, 6); // 179ms（6px/0.179s ≈ 34px/s，仍是 move）
    expect(h.sprite.frame.name).toBe('summon-oathkeeper-walk-a');

    pump(h, 1, 0.001, 1); // 180ms（恰好一个帧长 → 进下一档）
    expect(h.sprite.frame.name).toBe('summon-oathkeeper-walk-b');
  });

  it('停下再加帧算器归零：再起步必从 a 帧（防"崴脚"，方案 §3.2）', () => {
    const h = make();
    // setup（非被测行为）：先把累加器推到循环中段 —— 60ms/帧 × 7 = 360ms = 第 3 档
    pump(h, 7, 0.06, 6); // 走到 c
    expect(h.sprite.frame.name).toBe('summon-oathkeeper-walk-c');

    pump(h, 1, 0.06, 0); // 原地 → idle
    expect(h.view.viewState).toBe('idle');
    expect(h.sprite.frame.name).toBe('summon-oathkeeper');

    pump(h, 1, 0.06, 6); // 再起步：必须回到 a（若累加器残留，这里会从 c/d 起步 = 崴脚）
    expect(h.sprite.frame.name).toBe('summon-oathkeeper-walk-a');
  });

  it('每帧只 setTexture 一次（换帧才重设，不每帧刷）', () => {
    const h = make();
    pump(h, 3, 0.06, 6); // 3 × 60ms = 120ms < 180ms → 同一个 a 帧，未换过帧
    expect(h.sprite.textureSets).toBe(1); // 仅 首帧 idle→walk-a
    pump(h, 1, 0.06, 6); // 累计 180ms → 换到 b
    expect(h.sprite.textureSets).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. attack：a→b 双帧，各 75ms（均分决策器的 150ms 窗口）
// ─────────────────────────────────────────────────────────────────────────────
describe('attack：a→b 双帧 75/75（决策器 ATTACK_HOLD_MS=150 均分）', () => {
  it('notifyBite → 起手帧 attack-a', () => {
    const h = make();
    h.view.notifyBite();
    h.view.update(0.05);
    expect(h.view.viewState).toBe('attack');
    expect(h.sprite.frame.name).toBe('summon-oathkeeper-attack-a');
  });

  it('75ms 边界：74ms 仍是 a，75ms 进 b', () => {
    const h = make();
    h.view.notifyBite();
    h.view.update(0.074);
    expect(h.sprite.frame.name).toBe('summon-oathkeeper-attack-a');
    h.view.update(0.001); // 75ms
    expect(h.sprite.frame.name).toBe('summon-oathkeeper-attack-b');
  });

  it('150ms 后回落（b 恰在窗口最后一帧）：50/50/50 三帧 = a,b,idle', () => {
    const h = make();
    h.view.notifyBite();
    h.view.update(0.05); // 50ms → a
    expect(h.sprite.frame.name).toBe('summon-oathkeeper-attack-a');
    h.view.update(0.05); // 100ms → b
    expect(h.sprite.frame.name).toBe('summon-oathkeeper-attack-b');
    h.view.update(0.05); // 150ms → 窗口关闭，回落 idle
    expect(h.view.viewState).toBe('idle');
    expect(h.sprite.frame.name).toBe('summon-oathkeeper');
  });

  it('attack 压过 move（撕咬瞬间 → attack，而不是继续播踏步）', () => {
    const h = make();
    pump(h, 2, 0.11, 6);
    expect(h.view.viewState).toBe('move');
    h.view.notifyBite();
    h.view.update(0.05); // 50ms < 75ms → 起手帧
    expect(h.view.viewState).toBe('attack');
    expect(h.sprite.frame.name).toBe('summon-oathkeeper-attack-a');
  });

  it('attack 结束后回 move 仍是 a 帧起（累加器在 attack 期间归零）', () => {
    const h = make();
    pump(h, 7, 0.11, 6); // 先走进 move 循环中段（7 × 110ms = 660ms，已在第 4 档 d 附近）
    h.view.notifyBite();
    pump(h, 1, 0.11, 6); // attack a
    pump(h, 2, 0.11, 6); // attack b → 窗口关闭 → 回 move
    expect(h.view.viewState).toBe('move');
    expect(h.sprite.frame.name).toBe('summon-oathkeeper-walk-a');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. 瞬移护栏
// ─────────────────────────────────────────────────────────────────────────────
describe('瞬移护栏：单帧位移 > 400px 不作 move（批 D 报告 §7 / 方案 §3.2）', () => {
  it('单帧跳 500px → idle（不是 move），不抽一帧抖动', () => {
    const h = make();
    h.view.update(0.05);
    expect(h.view.viewState).toBe('idle');
    h.rt.state.x += 500;
    h.view.update(0.05);
    expect(h.view.viewState).toBe('idle');
    expect(h.sprite.frame.name).toBe('summon-oathkeeper');
  });

  it('400px 边界双向：400 仍按速度（8 万 px/s → move），400.5 判瞬移 → idle', () => {
    const a = make();
    a.rt.state.x += 400;
    a.view.update(0.05);
    expect(a.view.viewState).toBe('move');

    const b = make();
    b.rt.state.x += 400.5;
    b.view.update(0.05);
    expect(b.view.viewState).toBe('idle');
  });

  it('护栏常量 = 400（方案 §3.2 原值）', () => {
    expect(TELEPORT_GUARD_PX).toBe(400);
  });

  it('瞬移帧不推进 walk 帧（复位后从 a 起）', () => {
    const h = make();
    pump(h, 7, 0.11, 6); // 先走进 move 循环中段（7 × 110ms = 660ms）
    h.rt.state.x += 900; // 瞬移
    h.view.update(0.11);
    expect(h.view.viewState).toBe('idle');
    pump(h, 1, 0.11, 6); // 正常跟随恢复
    expect(h.sprite.frame.name).toBe('summon-oathkeeper-walk-a');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. dt 异常
// ─────────────────────────────────────────────────────────────────────────────
describe('dt 异常防御（dt=0 / NaN / 负数 / Infinity）', () => {
  it.each([0, -0.016, Number.NaN, Number.POSITIVE_INFINITY])('dt=%s → 不崩、speed 按 0（idle）', (dt) => {
    const h = make();
    h.view.update(0.016);
    h.rt.state.x += 30;
    expect(() => h.view.update(dt as number)).not.toThrow();
    expect(h.view.viewState).toBe('idle');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. 墓碑 / 隐藏 / 未启用
// ─────────────────────────────────────────────────────────────────────────────
describe('墓碑与隐藏（裁决② legacy48）', () => {
  it('phase=tombstone → 48 图 + scale 8/3 + yOffset +37/6（决策器给值，壳不硬编码）', () => {
    const h = make();
    h.rt.state.phase = 'tombstone';
    h.view.update(0.016);
    expect(h.sprite.visible).toBe(true);
    expect(h.sprite.frame.name).toBe('summon-oathkeeper-tombstone');
    expect(h.sprite.scale).toBeCloseTo(8 / 3, 6); // 128 / 48
    expect(h.sprite.y).toBeCloseTo(100 + 37 / 6, 5);
  });

  it('墓碑 → 复活回 companion：帧回 idle 且缩放回 1（换帧必重算 scale）', () => {
    const h = make();
    h.rt.state.phase = 'tombstone';
    h.view.update(0.016);
    h.rt.state.phase = 'companion';
    h.view.update(0.016);
    expect(h.sprite.frame.name).toBe('summon-oathkeeper');
    expect(h.sprite.scale).toBe(1);
    expect(h.sprite.y).toBe(68);
  });

  it('phase=gone → 不可见（hidden，不换帧不渲染）', () => {
    const h = make();
    h.rt.state.phase = 'gone';
    h.view.update(0.016);
    expect(h.sprite.visible).toBe(false);
    expect(h.view.viewState).toBe('hidden');
  });
});

describe('闸门：未启用不渲染（决策器契约无 enabled）', () => {
  it('rt 未 setEnabled → 即使 phase=companion 也不可见', () => {
    const h = make({ enabled: false });
    h.view.update(0.016);
    expect(h.sprite.visible).toBe(false);
    expect(h.view.viewState).toBe('hidden');
  });

  it('启用后当帧变可见（不因禁用期的位移残留算出一个巨大 speed）', () => {
    const h = make({ enabled: false });
    h.view.update(0.016);
    h.rt.state.x += 200; // 禁用期位移（不可能发生，仅验证基准同步）
    h.view.update(0.016);
    h.rt.setEnabled(true);
    h.view.update(0.016);
    expect(h.sprite.visible).toBe(true);
    expect(h.view.viewState).toBe('idle');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. 朝向死区（跨帧回传 prevFlipX）
// ─────────────────────────────────────────────────────────────────────────────
describe('朝向：8px 死区跨帧保持（方案 §3.2）', () => {
  it('玩家在右 → 不翻转；在左 → 翻转', () => {
    const h = make();
    h.player.x = 120;
    h.view.update(0.016);
    expect(h.sprite.flipX).toBe(false);

    h.player.x = 80;
    h.view.update(0.016);
    expect(h.sprite.flipX).toBe(true);
  });

  it('死区内（±3px）保持上一帧朝向 —— 站在正上方也不逐帧翻面', () => {
    const h = make();
    h.player.x = 80; // 左 → flipX=true
    h.view.update(0.016);
    expect(h.sprite.flipX).toBe(true);

    h.player.x = 103; // dx=+3，死区内 → 保持 true（若死区失效会变 false）
    h.view.update(0.016);
    expect(h.sprite.flipX).toBe(true);

    h.player.x = 109; // dx=+9，出死区 → false
    h.view.update(0.016);
    expect(h.sprite.flipX).toBe(false);
  });

  it('死区 ±8 边界双向：+8 保持，+8.1 翻面', () => {
    const h = make();
    h.player.x = 80;
    h.view.update(0.016); // true
    h.player.x = 108; // dx=+8 → 保持
    h.view.update(0.016);
    expect(h.sprite.flipX).toBe(true);
    h.player.x = 108.1; // dx=+8.1 → false
    h.view.update(0.016);
    expect(h.sprite.flipX).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. 销毁与常量钉死
// ─────────────────────────────────────────────────────────────────────────────
describe('销毁与常量', () => {
  it('destroy() 销毁精灵，之后 update/notifyBite 均无副作用', () => {
    const h = make();
    h.view.update(0.016);
    h.view.destroy();
    expect(h.sprite.destroyed).toBe(true);
    const before = h.sprite.textureSets;
    h.view.notifyBite();
    h.view.update(0.5);
    expect(h.sprite.textureSets).toBe(before);
  });

  it('destroy() 幂等（scene shutdown + 重建不会二次销毁报错）', () => {
    const h = make();
    h.view.destroy();
    expect(() => h.view.destroy()).not.toThrow();
  });

  it('常量钉死：180ms/帧、attack a=75ms（=150/2）、纹理 key = characters', () => {
    // 180 是**裁定值**，不是实验值（NV-ENG-EXEC-27 A/B，取证见
    // `production/official-v1/守誓者批F-AB对比报告-2026-11-09.md` §0/§2）：
    // - 滑步比 = 120px/s × 帧长 ÷ 美术每帧位移 12.44px → 330ms = 3.18（>1.8 FAIL）／180ms = 1.74（CONCERNS 上界内）；
    // - 每姿势位移 ÷ 内容宽 78px：0.51（330ms）→ 0.28（180ms）；
    // - 一圈 1320ms → 720ms，对成人步行循环 0.8~1.0s 由"偏慢"变为"偏快 10~28%"。
    // 本条是 walk 帧长的**唯一钉死点**（其余用例只断言帧序/边界，不依赖具体数值）。
    expect(WALK_FRAME_MS).toBe(180);
    expect(ATTACK_FRAME_A_MS).toBe(75);
    expect(OATHKEEPER_TEXTURE_KEY).toBe('characters');
    expect([...OATHKEEPER_WALK_FRAMES]).toEqual([
      'summon-oathkeeper-walk-a',
      'summon-oathkeeper-walk-b',
      'summon-oathkeeper-walk-c',
      'summon-oathkeeper-walk-d',
    ]);
  });

  it('壳不碰 scene.anims（严禁走 anim.ts 的 6fps 自动动画）', () => {
    const rt = new OathkeeperRuntime(100, 100);
    rt.setEnabled(true);
    const sprite = new FakeSprite();
    // 故意不提供 anims：壳一旦访问就抛错 → 本用例即为「不起 anim」的证据
    const scene = fakeScene(sprite);
    const view = new OathkeeperViewSprite(scene, rt, { x: 100, y: 100 });
    expect(() => view.update(0.016)).not.toThrow();
  });
});
