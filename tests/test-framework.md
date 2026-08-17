# 《血月守夜》测试框架方案（Phase 4 · 并行线 C）

> 版本：v0.1 · 作者：程基岩（工程主程）
> 上游依据：`production/epics/epics.md`（Story 清单）、`docs/architecture/architecture.md` §1.1/§1.4/§6、
> 各 GDD §8 验收、`docs/architecture/control-manifest.md` §8、`docs/architecture/architecture-review.md` 放行条件 4
> 配套交付：`production/epics/epics.md`
> 原则：**验证驱动开发**——先写测试，再实现；测试是工程可执行文档，非事后补丁。

---

## 1. 测试分层与工具选型

### 1.1 三层测试模型

| 层 | 工具 | 测什么 | 运行时机 | Lean 优先级 |
|---|---|---|---|---|
| L1 单元测试 | **Vitest** | 纯逻辑：数值公式/升级池/生成预算/状态机/对象池/输入向量数学 | pre-commit（本地） | **P0 必须** |
| L2 冒烟测试 | **Phaser 内嵌自检**（主）+ Playwright（可选） | 引擎启动、帧推进、无 console error、场景装配 | build / dev 启动 / 本地 | **P0 必须（内嵌）**、Playwright P1 可选 |
| L3 性能基准 | **utils/perf.ts + 基准脚本** | 双端预算断言：实体 400/250、fps、draw call、GC | 里程碑级（E4-S5 / M2 闸门） | **P0 必须（E4-S5）** |

**选型结论**：
1. **L1 用 Vitest**——架构 §1.1 已推荐，与 Vite 同栈零配置，TS 原生；渲染相关不做单测（交给 L2/L3）。
2. **L2 以"Phaser 内嵌自检"为主**——成本最低、随构建/dev 常驻运行，符合 Lean。做法：dev 模式或 URL `?smoke=1` 时，游戏自身跑 N 帧后把断言结果写入 `window.__SMOKE_RESULT__`（或 console 标记），自动化脚本/人工即可判定。Playwright 冒烟作为**可选增强**（完整浏览器环境断言），Lean 阶段不进 pre-commit，仅本地/CI 手动触发。
3. **L3 性能基准脚本**为架构评审放行条件 4 的执行载体：`npm run bench` 60s 峰值压力，断言双端预算；不达标即 M2 里程碑不达成、不进入 P1。

### 1.2 可测性要求（测试驱动的模块划分）

为让 L1 成立，实现时**把纯函数从 Phaser 对象中抽离**（不写游戏实现，只定模块边界纪律）：
- 输入：`getMove()` 的"键组合 → 向量"数学（归一化/死区/clamp）抽为**纯函数**，`KeyboardInput`/`TouchInput` 只做 Phaser 事件接线。
- 生成器：`budget(t)`、阶段权重、同屏节流决策抽为**纯函数**（输入 t/存量，输出预算/构成）。
- 伤害：倍率聚合、无敌帧判定（时间戳比较）抽为**纯函数**。
- 升级池：抽取规则抽为**纯函数**（输入已解锁/上次选择/满级表，输出 3 项）。
- 状态机：`GameState` 转换矩阵抽为**纯函数**（`canTransition(from, to)`）。
- 对象池：池满策略抽为可注入策略的**纯逻辑类**（不依赖 Phaser Group 也能测）。

> 判定准则：**能脱离 Phaser 实例化并断言数值的模块，必须抽纯函数**；抽不出来 = 依赖缠绕，需重构。这保证"机械判定、数值断言优先"。

---

## 2. tests/ 目录结构（与 src/ 对应）

```
tests/
├── unit/                        # L1 Vitest 单测（镜像 src/ 子目录）
│   ├── core/
│   │   ├── game-state.test.ts   # 四态转换/非法转换拒绝/onChange
│   │   ├── time.test.ts         # clampDelta 上限/极端保护/秒制换算
│   │   ├── object-pools.test.ts # acquire/release/eachActive/池满策略/maxSize
│   │   └── events.test.ts       # emit/on/off/removeAllListeners
│   ├── config/
│   │   ├── runtime-config.test.ts  # 桌面/移动配置快照断言
│   │   └── balance.test.ts         # 数值常量表与 GDD 一致（埋点断言基线）
│   ├── input/
│   │   ├── move-vector.test.ts     # 键组合→向量（归一化/斜向防超速）纯函数
│   │   └── joystick-math.test.ts   # 摇杆位移→向量（死区 10%/clamp≤1）纯函数
│   ├── player/
│   │   └── player-stats.test.ts    # 每级 +8HP/+4%、每 5 级 +4px/s、总倍率公式
│   ├── weapons/
│   │   ├── homing-missile.test.ts  # 冷却/追踪数学/寿命/8 发上限/分裂×0.6
│   │   ├── orbit-orb.test.ts       # 3 颗/转速/0.4s 同目标冷却/+1 至 6
│   │   └── shockwave.test.ts       # 冷却 8s/半径 280→420→560/穿透
│   ├── enemies/
│   │   └── enemy-panel.test.ts     # 4 面板数值表一致（含 Boss，E4 补）
│   ├── spawner/
│   │   └── spawner.test.ts         # budget(t) 曲线表/阶段权重/上限节流/秒制累加
│   ├── xp/
│   │   └── xp-manager.test.ts      # need(n) 曲线/累计/触发 level:up
│   ├── upgrade/
│   │   ├── upgrade-pool.test.ts    # 12 项/75% 机制型/抽取规则/满级剔除/超时
│   │   └── upgrade-apply.test.ts   # 12 项效果写回断言
│   └── combat/
│       └── damage.test.ts          # 倍率聚合/无敌帧合并/死亡分发
├── smoke/                       # L2 冒烟
│   ├── smoke-embed.ts           # 内嵌自检断言清单（配合 src 内 ?smoke=1 钩子）
│   └── smoke.e2e.spec.ts        # Playwright 冒烟（可选，本地/CI 手动触发）
└── bench/                       # L3 性能基准
    ├── perf-assert.ts           # 预算断言：实体峰值/子弹数/fps/draw call
    └── bench-run.ts             # `npm run bench` 入口（60s 峰值压力）
```

> 说明：`?smoke=1` 内嵌自检钩子放在 `src/`（如 `src/utils/smoke.ts`，仅 dev/参数启用，不污染生产包）；`tests/smoke/smoke-embed.ts` 只声明断言清单与判定规则。

---

## 3. 测试代码示意（骨架，非完整实现）

### 3.1 Vitest 单测骨架

```ts
// tests/unit/core/game-state.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GameState, GamePhase } from '@/core/game-state';

describe('GameState 状态机', () => {
  let state: GameState;
  beforeEach(() => { state = new GameState(); });

  it('初始为 RUNNING', () => {
    expect(state.get()).toBe(GamePhase.RUNNING);
  });

  it('RUNNING → LEVEL_UP 合法转换', () => {
    state.set(GamePhase.LEVEL_UP);
    expect(state.get()).toBe(GamePhase.LEVEL_UP);
  });

  it('非法转换被拒绝（LEVEL_UP → GAMEOVER 不可达）', () => {
    state.set(GamePhase.LEVEL_UP);
    state.set(GamePhase.GAMEOVER);
    expect(state.get()).toBe(GamePhase.LEVEL_UP); // 依据 CM-§5 联动表
  });

  it('onChange 回调在状态变更时触发', () => {
    const calls: GamePhase[] = [];
    state.onChange((p) => calls.push(p));
    state.set(GamePhase.PAUSED);
    expect(calls).toEqual([GamePhase.PAUSED]);
  });
});
```

```ts
// tests/unit/spawner/spawner.test.ts
import { describe, it, expect } from 'vitest';
import { budget } from '@/spawner/spawner'; // 纯函数

describe('敌潮生成预算 budget(t)', () => {
  // 压力曲线表（spawner §③）：[0s,60s,180s,300s,480s,720s,900s,1080s,1200s]
  const table: [number, number][] = [
    [0, 1.2], [60, 1.35], [180, 1.65], [300, 1.95],
    [480, 2.4], [720, 3.0], [900, 3.45], [1080, 3.9], [1200, 4.2],
  ];

  it.each(table)('t=%d s 时预算 ≈ %d 点/s（±1e-6）', (t, expected) => {
    expect(budget(t)).toBeCloseTo(expected, 6);
  });

  it('相邻 75s 周期生成速率差异 ≥40%（波峰波谷，S8-3）', () => {
    // 取 t=0..1200 每 75s 采样，验证 (max-min)/min >= 0.4
    const samples = Array.from({ length: 17 }, (_, i) => budget(i * 75));
    const peak = Math.max(...samples), trough = Math.min(...samples);
    expect((peak - trough) / trough).toBeGreaterThanOrEqual(0.4);
  });
});
```

```ts
// tests/unit/upgrade/upgrade-pool.test.ts
import { describe, it, expect } from 'vitest';
import { UPGRADE_POOL, rollThree, isMechanicType } from '@/upgrade/upgrade-pool';

describe('升级池', () => {
  it('恰好 12 项（U8-1）', () => {
    expect(UPGRADE_POOL).toHaveLength(12);
  });

  it('机制改变型占比 ≥50%（实测 75%，U8-1）', () => {
    const mechanic = UPGRADE_POOL.filter((u) => isMechanicType(u)).length;
    expect(mechanic / UPGRADE_POOL.length).toBeGreaterThanOrEqual(0.5);
  });

  it('三选一不重复、已满级项剔除（U8-4）', () => {
    const opts = rollThree({ maxedIds: new Set([1, 2]), lastPickId: 3 });
    expect(new Set(opts.map((o) => o.id)).size).toBe(3);
    expect(opts.some((o) => o.id === 1 || o.id === 2)).toBe(false);
  });

  it('全满级时回退到可重复数值项 10（U8-§③）', () => {
    // 构造全部满级 → 结果必须包含 id=10
  });
});
```

### 3.2 Phaser 内嵌自检骨架（L2 主方案）

```ts
// src/utils/smoke.ts（仅 ?smoke=1 启用；tests/smoke/smoke-embed.ts 为断言清单）
// 思路：游戏主循环在 N 帧后写入自检结果，供自动化/人工判定
export interface SmokeResult {
  framesAdvanced: boolean;   // 帧号递增
  sceneReady: boolean;       // PlayScene 装配完成（关键系统存在）
  consoleErrors: string[];   // 收集到的 console.error
}
// 判定规则（与 smoke-embed.ts 一致）：
//   framesAdvanced === true && sceneReady === true && consoleErrors.length === 0
```

### 3.3 Playwright 冒烟骨架（L2 可选增强）

```ts
// tests/smoke/smoke.e2e.spec.ts
import { test, expect } from '@playwright/test';

test('游戏启动：canvas 存在、帧推进、无 console error', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 });

  const frames = await page.evaluate(() => new Promise<number>((resolve) => {
    let n = 0;
    const tick = () => (++n >= 30 ? resolve(n) : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
  }));
  expect(frames).toBeGreaterThanOrEqual(30);
  expect(errors).toEqual([]);
});
```

### 3.4 性能基准骨架（L3）

```ts
// tests/bench/perf-assert.ts —— 预算断言（E4-S5 验收）
export interface BenchAssert {
  desktop: { avgFpsMin: 58; minFpsMin: 50; maxEnemies: 400; maxBullets: 8; maxDrawCalls: 8 };
  mobile:  { avgFpsMin: 30; maxEnemies: 250; maxBullets: 8; maxDrawCalls: 8 };
}
// 运行方式：`npm run bench` → 60s 峰值压力（生成器拉满 + 三武器全开）
// 埋点：active 敌人数峰值 / 同屏子弹数 / perf.ts 帧率统计与 draw call 估算
// 判定：任一断言不满足 → 退出码非 0 → M2 里程碑不达成
```

---

## 4. 首冲刺（E1）测试清单（具体到 Story）

> 规则：**每个 Story 实现前先写对应测试（红），实现后转绿（绿）**；验收断言以 epics.md 为准。

| Story | 测试文件 | 关键断言（机械判定） |
|---|---|---|
| E1-S1 脚手架冒烟 | （L2 冒烟，非单测） | `npm run typecheck` 退出码 0；`npm run build` 成功；canvas 出现且 30 帧推进；无 console error |
| E1-S2 core | `tests/unit/core/game-state.test.ts` | 初始 RUNNING；合法/非法转换矩阵（CM-§5）；onChange 触发 |
| | `tests/unit/core/time.test.ts` | `clampDelta(80ms)=0.05s`；>250ms 按 0.25s；秒制换算 |
| | `tests/unit/core/object-pools.test.ts` | acquire/release 复用；池满按既定策略（null 或回收最早）；eachActive 只遍历 active |
| | `tests/unit/core/events.test.ts` | emit/on/off；removeAllListeners 防泄漏 |
| E1-S3 RuntimeConfig | `tests/unit/config/runtime-config.test.ts` | 桌面/移动配置快照：400/250、200/100、300/200、1920×1080、720×1280、开关矩阵（RV-C2） |
| | `tests/unit/config/balance.test.ts` | 数值常量表与 GDD 一致（埋点断言基线） |
| E1-S4 键盘输入 | `tests/unit/input/move-vector.test.ts` | 单键 (0,±1)/(±1,0)；斜向归一化 `|v|≤1` 且斜向速度不超单方向（CM-M5）；全松 (0,0) |
| E1-S5 移动摇杆 | `tests/unit/input/joystick-math.test.ts` | 死区 10% 内 (0,0)；位移/半径 clamp ≤1；幅度=速度百分比（ADR-002） |
| E1-S6 玩家移动+地图 | `tests/unit/player/player-stats.test.ts` | 初始属性；边界 clamp [0,3000]²；`getMove × 220px/s` 位移 |

**E1 冲刺出口标准**：上表全部绿 + `npm run typecheck` 绿 + dev 启动无 console error（双端 UA 各确认一次）。

---

## 5. CI 建议（Lean 优先级说明）

Lean 阶段**不做完整 CI 流水线**，按优先级只保"本地可执行、可机械判定"：

| 优先级 | 动作 | 命令 | 触发 |
|---|---|---|---|
| **P0** | 单元测试 | `npm run test`（vitest run） | 本地 pre-commit（husky + lint-staged） |
| **P0** | 类型检查 | `npm run typecheck` | 本地 pre-commit |
| **P1** | 构建 + 内嵌冒烟 | `npm run build` + `?smoke=1` 自检 | 本地提交前手动 / 简单 CI job |
| **P2** | Playwright 冒烟 | `npx playwright test tests/smoke` | 本地手动 / 里程碑评审 |
| **P0（里程碑）** | 性能基准 | `npm run bench` | **E4-S5 / M2 闸门**，未达标不进入 P1 表现层（RV 放行 4） |

> 若后续引入 CI（如 GitHub Actions）：最小三步绿 = `typecheck → test → build`（ARCH-§1.4 最小 CI）；性能基准为发布级 job，不进每 PR。

---

## 6. 与 Story 验收的衔接

- epics.md 中每条"验收断言"都是**测试用例来源**；严守真按 `production/epics/epics.md` §6 追溯索引 + 本文件 §4 清单出正式用例。
- L1/L2 自动化判定以**数值断言**为准（`toBeCloseTo` / 快照 / 计数埋点）；L3 以预算表为准。
- 冒烟层不测玩法正确性，只测"引擎活着"；玩法正确性全部下沉到 L1 纯逻辑层（这就是纯函数抽离纪律的价值）。
