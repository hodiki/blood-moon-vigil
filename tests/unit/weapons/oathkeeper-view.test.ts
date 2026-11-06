import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  resolveOathkeeperView,
  createOathkeeperViewOutput,
  MOVE_SPEED_THRESHOLD,
  ATTACK_HOLD_MS,
  OATHKEEPER_DEPTH,
  FACING_DEADZONE,
  Y_OFFSET_BODY_192,
  Y_OFFSET_TOMBSTONE_48,
  Y_OFFSET_TOMBSTONE_192,
  type OathkeeperViewInput,
} from '@/weapons/companion/oathkeeper-view';

/**
 * 批次 D · 守誓者可视化「纯决策器」单测。
 *
 * 纪律：
 * 1. **断言用独立真值** —— 期望值一律写字面量（-32 / 6.1667 / 150 / 5 …），
 *    **不调用被测函数生成期望值**（否则是自证式测试，函数写错测试也绿）。
 * 2. 边界值必须双向测（149 vs 150、5 vs 5.1、8 vs 8.1）——只测单侧等于没测边界。
 * 3. 每条用例的注释写「依据哪条规则 / 哪份文档」，便于后续批改动时知道能不能动。
 *
 * 规格来源：`production/official-v1/守誓者局内可视化补充方案-2026-11-06.md` §3.2 / §3.4；
 * 主程交付单 §3.3 / §5；主理人裁决 ②（depth = 30）。
 */

const base: OathkeeperViewInput = {
  phase: 'companion',
  speed: 0,
  sinceBiteMs: Infinity, // 从未撕咬
  playerX: 100,
  selfX: 100,
};

/** 便捷构造：以 base 覆盖字段后求解 */
function view(over: Partial<OathkeeperViewInput> = {}) {
  return resolveOathkeeperView({ ...base, ...over });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. 三相位 × 三态矩阵
// ───────────────────────────────��─────────────────────────────────────────────
describe('三相位 × 三态矩阵（方案 §3.2）', () => {
  it('companion + 静止（speed=0）→ idle，可见', () => {
    const o = view({ phase: 'companion', speed: 0 });
    expect(o.state).toBe('idle');
    expect(o.visible).toBe(true);
  });

  it('companion + 移动（speed=180 = FOLLOW_SPEED）→ move，可见', () => {
    const o = view({ phase: 'companion', speed: 180 });
    expect(o.state).toBe('move');
    expect(o.visible).toBe(true);
  });

  it('companion + 撕咬中（sinceBiteMs=0）→ attack，可见', () => {
    const o = view({ phase: 'companion', speed: 0, sinceBiteMs: 0 });
    expect(o.state).toBe('attack');
    expect(o.visible).toBe(true);
  });

  it('tombstone → tombstone（默认 legacy48 策略下可见），yOffset 走 48 分支', () => {
    const o = view({ phase: 'tombstone', speed: 0, sinceBiteMs: Infinity });
    expect(o.state).toBe('tombstone');
    expect(o.visible).toBe(true);
  });

  it('gone → hidden，不可见（重召唤计时内无实体）', () => {
    const o = view({ phase: 'gone', speed: 0 });
    expect(o.state).toBe('hidden');
    expect(o.visible).toBe(false);
  });

  it('gone 即使仍在撕咬窗口内也是 hidden（相位优先于瞬时动作）', () => {
    const o = view({ phase: 'gone', sinceBiteMs: 0, speed: 180 });
    expect(o.state).toBe('hidden');
    expect(o.visible).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. 优先级铁律：相位 > attack > move > idle
// ─────────────────────────────────────────────────────────────────────────────
describe('判定优先级铁律（相位 > attack > move > idle）', () => {
  it('【核心】attack 压过 idle：sinceBiteMs=0 + speed=0 → attack（不是 idle）', () => {
    const o = view({ phase: 'companion', speed: 0, sinceBiteMs: 0 });
    expect(o.state).toBe('attack');
    expect(o.state).not.toBe('idle');
  });

  it('attack 压过 move：sinceBiteMs=0 + speed=180 → attack（不是 move）', () => {
    const o = view({ phase: 'companion', speed: 180, sinceBiteMs: 0 });
    expect(o.state).toBe('attack');
    expect(o.state).not.toBe('move');
  });

  it('tombstone 压过 attack：撕咬进行中变墓碑 → 立刻 tombstone', () => {
    const o = view({ phase: 'tombstone', sinceBiteMs: 0, speed: 180 });
    expect(o.state).toBe('tombstone');
    expect(o.state).not.toBe('attack');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. attack 保持窗口边界（交付单 §3.3「~150ms 后回 idle」）
// ─────────────────────────────────────────────────────────────────────────────
describe('attack 保持窗口 150ms 边界', () => {
  it('常量为 150ms（交付单 §3.3 口径）', () => {
    expect(ATTACK_HOLD_MS).toBe(150);
  });

  it('sinceBiteMs=0 → attack', () => {
    expect(view({ sinceBiteMs: 0 }).state).toBe('attack');
  });

  it('【边界】sinceBiteMs=149 → 仍是 attack（严格小于 150）', () => {
    expect(view({ sinceBiteMs: 149 }).state).toBe('attack');
  });

  it('【边界】sinceBiteMs=149.999 → 仍是 attack', () => {
    expect(view({ sinceBiteMs: 149.999 }).state).toBe('attack');
  });

  it('【边界】sinceBiteMs=150 → 回落 idle（静止时）', () => {
    const o = view({ sinceBiteMs: 150, speed: 0 });
    expect(o.state).toBe('idle');
    expect(o.state).not.toBe('attack');
  });

  it('【边界】sinceBiteMs=150 + 移动 → 回落 move（不是 attack）', () => {
    const o = view({ sinceBiteMs: 150, speed: 180 });
    expect(o.state).toBe('move');
  });

  it('sinceBiteMs=Infinity（从未撕咬）→ 不触发 attack', () => {
    expect(view({ sinceBiteMs: Infinity, speed: 0 }).state).toBe('idle');
  });

  it('sinceBiteMs=NaN → 不触发 attack（不污染状态判定）', () => {
    expect(view({ sinceBiteMs: NaN, speed: 0 }).state).toBe('idle');
  });

  it('attack 窗口内 yOffset 仍按 192 躯干（不因姿态而变）', () => {
    expect(view({ sinceBiteMs: 0 }).yOffset).toBe(Y_OFFSET_BODY_192);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. 速度阈值边界（与 anim.ts:169 isMoving 的 5px/s 同口径）
// ─────────────────────────────────────────────────────────────────────────────
describe('速度阈值 5px/s 边界', () => {
  it('常量为 5（与 anim.ts isMoving 同口径）', () => {
    expect(MOVE_SPEED_THRESHOLD).toBe(5);
  });

  it('【边界】speed=5 → idle（等于阈值不算移动）', () => {
    expect(view({ speed: 5 }).state).toBe('idle');
  });

  it('【边界】speed=5.1 → move', () => {
    expect(view({ speed: 5.1 }).state).toBe('move');
  });

  it('速度梯度：0 / 0.1 / 4.9 → idle；5.0001 / 6 / 180 → move', () => {
    for (const s of [0, 0.1, 4.9]) expect(view({ speed: s }).state).toBe('idle');
    for (const s of [5.0001, 6, 180]) expect(view({ speed: s }).state).toBe('move');
  });

  it('speed=NaN → idle（防「NaN>5 与 NaN<=5 同为 false」漏进 move）', () => {
    const o = view({ speed: NaN });
    expect(o.state).toBe('idle');
    expect(o.state).not.toBe('move');
  });

  it('speed=Infinity → idle（上层瞬移护栏失效时的兜底，不得抽 move 帧）', () => {
    expect(view({ speed: Infinity }).state).toBe('idle');
  });

  it('speed=-180（负值 = 数据异常）→ idle（不当作移动）', () => {
    expect(view({ speed: -180 }).state).toBe('idle');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. 朝向（交付单 §5：斜向右下 30° 已画进帧，只翻转不旋转）
// ─────────────────────────────────────────────────────────────────────────────
describe('朝向 flipX（原图朝右）', () => {
  it('玩家在右（selfX 100 < playerX 120）→ flipX=false（不翻转）', () => {
    expect(view({ selfX: 100, playerX: 120 }).flipX).toBe(false);
  });

  it('玩家在左（selfX 100 > playerX 80）→ flipX=true（翻转）', () => {
    expect(view({ selfX: 100, playerX: 80 }).flipX).toBe(true);
  });

  it('【边界】坐标相等 → flipX=false（有意取「原图朝右」，不抖动）', () => {
    expect(view({ selfX: 100, playerX: 100 }).flipX).toBe(false);
  });

  it('【边界】0.001px 偏移即已定向（未提供 prevFlipX 时死区为 0）', () => {
    expect(view({ selfX: 100, playerX: 100.001 }).flipX).toBe(false);
    expect(view({ selfX: 100, playerX: 99.999 }).flipX).toBe(true);
  });

  it('tombstone / gone 也给出确定性 flipX（墓碑剪影同样要朝玩家）', () => {
    expect(view({ phase: 'tombstone', selfX: 100, playerX: 80 }).flipX).toBe(true);
    expect(view({ phase: 'gone', selfX: 100, playerX: 120 }).flipX).toBe(false);
  });

  it('attack 态同样应用朝向（撕咬时不能反向砍）', () => {
    expect(view({ sinceBiteMs: 0, selfX: 100, playerX: 80 }).flipX).toBe(true);
  });
});

describe('朝向死区 8px（方案 §3.2；提供 prevFlipX 时启用）', () => {
  it('常量为 8（复用 anim.ts:17 FACING_DEADZONE 口径）', () => {
    expect(FACING_DEADZONE).toBe(8);
  });

  it('死区内保持上一帧朝向：dx=+5 且上一帧朝左 → 仍朝左', () => {
    expect(view({ selfX: 100, playerX: 105, prevFlipX: true }).flipX).toBe(true);
  });

  it('死区内保持上一帧朝向：dx=-5 且上一帧朝右 → 仍朝右', () => {
    expect(view({ selfX: 100, playerX: 95, prevFlipX: false }).flipX).toBe(false);
  });

  it('【边界】dx=+8（死区边缘内侧）→ 保持上一帧', () => {
    expect(view({ selfX: 100, playerX: 108, prevFlipX: true }).flipX).toBe(true);
  });

  it('【边界】dx=+8.1（越出死区）→ 朝右（false），忽略上一帧', () => {
    expect(view({ selfX: 100, playerX: 108.1, prevFlipX: true }).flipX).toBe(false);
  });

  it('【边界】dx=-8（死区边缘内侧）→ 保持上一帧', () => {
    expect(view({ selfX: 100, playerX: 92, prevFlipX: false }).flipX).toBe(false);
  });

  it('【边界】dx=-8.1（越出死区）→ 朝左（true），忽略上一帧', () => {
    expect(view({ selfX: 100, playerX: 91.9, prevFlipX: false }).flipX).toBe(true);
  });

  it('防抖对照：同一 dx=+3 序列，未传 prevFlipX 时逐帧翻转、传了则稳定', () => {
    // 未提供 prevFlipX → 死区 0 → 严格按符号判定（正右 → false）
    expect(view({ selfX: 100, playerX: 103 }).flipX).toBe(false);
    // 提供 prevFlipX=true → 死区内保持 true（正上方来回微抖不会再翻面）
    expect(view({ selfX: 100, playerX: 103, prevFlipX: true }).flipX).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. 脚底线 yOffset（方案 §3.4；**独立真值**，推导见 src 文件头注释）
//    玩家 hero-violet.png 128 画布 / 最低不透明行 127 / scale 1 → 脚在锚点下 63.5
//    守誓者 192 画布 / 最低行 191 / scale 1 → 脚在锚点下 95.5  → yOffset = 63.5 − 95.5 = −32
//    旧 48 墓碑 / 最低行 45 / scale 8/3 → 脚在锚点下 57.3333     → yOffset = 63.5 − 57.3333 = +6.1667
// ─────────────────────────────────────────────────────────────────────────────
describe('脚底线 yOffset（独立真值断言，禁止自证）', () => {
  it('【核心】192 躯干 idle → yOffset = −32（照字面 y=state.y 会沉地 32px）', () => {
    expect(view({ speed: 0 }).yOffset).toBe(-32);
  });

  it('192 躯干 move → yOffset = −32（位移不改变脚底线）', () => {
    expect(view({ speed: 180 }).yOffset).toBe(-32);
  });

  it('192 躯干 attack → yOffset = −32', () => {
    expect(view({ sinceBiteMs: 30 }).yOffset).toBe(-32);
  });

  it('导出常量与运行时取值一致：Y_OFFSET_BODY_192 = −32', () => {
    expect(Y_OFFSET_BODY_192).toBe(-32);
  });

  it('旧 48 墓碑 → yOffset = +6.1667（放大 2.667× 后脚偏浅，需下移补偿；**不得沿用 −32**）', () => {
    const o = view({ phase: 'tombstone', hasTombstoneFrame192: false });
    expect(o.yOffset).toBeCloseTo(6.1667, 3);
    // 反例守卫：若沿用躯干常量，48 图会**浮起约 6.17px**
    expect(o.yOffset).not.toBe(-32);
    expect(o.yOffset).toBeGreaterThan(0);
  });

  it('导出常量 Y_OFFSET_TOMBSTONE_48 = 37/6 ≈ 6.1667', () => {
    expect(Y_OFFSET_TOMBSTONE_48).toBeCloseTo(6.1667, 3);
    expect(Y_OFFSET_TOMBSTONE_48).toBeCloseTo(37 / 6, 6);
  });

  it('未传 hasTombstoneFrame192（默认 undefined）→ 与 false 同分支（本批现状）', () => {
    expect(view({ phase: 'tombstone' }).yOffset).toBeCloseTo(6.1667, 3);
  });

  it('未来 192 墓碑帧就位（hasTombstoneFrame192=true）→ 回到 −32（同基准入盒、脚底 191）', () => {
    const o = view({ phase: 'tombstone', hasTombstoneFrame192: true });
    expect(o.yOffset).toBe(-32);
    expect(Y_OFFSET_TOMBSTONE_192).toBe(-32);
  });

  it('hidden → yOffset = 0（不绘制，偏移无意义但必须确定性）', () => {
    expect(view({ phase: 'gone' }).yOffset).toBe(0);
  });

  it('躯干偏移符号守卫：必须为负（向上抬脚）；若为正说明推导反了', () => {
    expect(view({ speed: 0 }).yOffset).toBeLessThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. depth（主理人裁决 ②：30）
// ─────────────────────────────────────────────────────────────────────────────
describe('depth（主理人裁决 ② = 30）', () => {
  it('常量为 30', () => {
    expect(OATHKEEPER_DEPTH).toBe(30);
  });

  it('所有态（含 hidden 与 tombstone）均返回 30 —— 常量，不做分态偏移', () => {
    for (const phase of ['companion', 'tombstone', 'gone'] as const) {
      expect(view({ phase }).depth).toBe(30);
    }
  });

  it('层序守卫：敌人(0) < 守誓者(30) < 状态光环(40) < 玩家(100)', () => {
    expect(view({ speed: 0 }).depth).toBeGreaterThan(0);
    expect(view({ speed: 0 }).depth).toBeLessThan(40);
    expect(view({ speed: 0 }).depth).toBeLessThan(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. 墓碑策略（方案 §3.5 A 案 vs 任务书建议的隐藏分支）
// ─────────────────────────────────────────────────────────────────────────────
describe('墓碑策略 tombstonePolicy', () => {
  it('默认（不传）= legacy48：可见（方案 §3.5 A 案，可读性 > 精致度）', () => {
    expect(view({ phase: 'tombstone' }).visible).toBe(true);
  });

  it("显式 'legacy48' → 可见", () => {
    expect(view({ phase: 'tombstone', tombstonePolicy: 'legacy48' }).visible).toBe(true);
  });

  it("'hidden' → 不绘制，但 state 仍报 'tombstone'（上层据此知道「该显示墓碑」)", () => {
    const o = view({ phase: 'tombstone', tombstonePolicy: 'hidden' });
    expect(o.state).toBe('tombstone');
    expect(o.visible).toBe(false);
  });

  it('策略只影响墓碑：companion 永不受影响', () => {
    expect(view({ speed: 0, tombstonePolicy: 'hidden' }).visible).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. 输出对象复用（热路径零分配）
// ─────────────────────────────────────────────────────────────────────────────
describe('输出对象复用（热路径零分配）', () => {
  it('createOathkeeperViewOutput 初值为安全的 hidden', () => {
    const o = createOathkeeperViewOutput();
    expect(o.state).toBe('hidden');
    expect(o.visible).toBe(false);
    expect(o.flipX).toBe(false);
    expect(o.yOffset).toBe(0);
    expect(o.depth).toBe(OATHKEEPER_DEPTH);
  });

  it('传入 out → 返回同一引用并被就地覆盖（不新建对象）', () => {
    const out = createOathkeeperViewOutput();
    const r1 = resolveOathkeeperView({ ...base, phase: 'gone' }, out);
    expect(r1).toBe(out);
    expect(out.state).toBe('hidden');

    const r2 = resolveOathkeeperView({ ...base, speed: 180, playerX: 80 }, out);
    expect(r2).toBe(out);
    expect(out.state).toBe('move');
    expect(out.visible).toBe(true);
    expect(out.flipX).toBe(true);
    expect(out.yOffset).toBe(-32);

    const r3 = resolveOathkeeperView({ ...base, phase: 'tombstone' }, out);
    expect(r3).toBe(out);
    expect(out.state).toBe('tombstone');
    expect(out.yOffset).toBeCloseTo(6.1667, 3);
  });

  it('不传 out → 每次新建（单测/调试路径）', () => {
    const a = resolveOathkeeperView({ ...base });
    const b = resolveOathkeeperView({ ...base });
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('输入对象不被修改（纯函数无副作用）', () => {
    const input: OathkeeperViewInput = { ...base, speed: 180, playerX: 80 };
    const snapshot = { ...input };
    resolveOathkeeperView(input);
    expect(input).toEqual(snapshot);
  });

  it('连续 5 帧复用同一 out：结果与逐帧新建完全一致（无残留状态）', () => {
    const out = createOathkeeperViewOutput();
    const seq: Partial<OathkeeperViewInput>[] = [
      { phase: 'gone' },
      { phase: 'tombstone' },
      { speed: 180, playerX: 80 },
      { sinceBiteMs: 0 },
      { speed: 0 },
    ];
    for (const over of seq) {
      const a = resolveOathkeeperView({ ...base, ...over }, out);
      const b = resolveOathkeeperView({ ...base, ...over });
      expect(a).toEqual(b);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. 纯模块守卫（本批的全部意义：决策逻辑必须能在 node 下单测）
// ─────────────────────────────────────────────────────────────────────────────
describe('纯模块守卫（零 Phaser / 零 anim 依赖）', () => {
  const src = readFileSync(
    fileURLToPath(new URL('../../../src/weapons/companion/oathkeeper-view.ts', import.meta.url)),
    'utf-8',
  );

  it("不 import phaser（否则本测试文件无法在 node 下运行）", () => {
    // 只匹配「真 import 语句」：源文件注释里引用了 `grep "from 'phaser'"` 这条命令，不能被误判
    expect(src).not.toMatch(/^\s*import\s[^\n]*from\s+'phaser'/m);
    expect(src).not.toMatch(/^\s*import\s+'phaser'/m);
    expect(src).not.toMatch(/require\(\s*['"]phaser['"]\s*\)/);
  });

  it("不 import '@/fx/anim'（该模块顶部 import Phaser，会把引擎拖进本模块）", () => {
    expect(src).not.toMatch(/from\s+'@\/fx\/anim'/);
  });

  it('声明了 out 复用参数（热路径零分配口径不得被退回）', () => {
    expect(src).toMatch(/out:\s*OathkeeperViewOutput\s*=/);
  });
});
