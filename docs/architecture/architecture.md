# 《血月守夜》主架构文档（Architecture）

> 版本：v0.1 · Phase 3 技术搭建（并行线 A）· 作者：程基岩（工程主程）
> 上游依据：`design/concepts/concept.md`（支柱/双端/性能预算/验收）、`design/systems/system-map.md`（S1–S10 依赖链）、
> `design/gdd/weapons.md`、`enemies.md`、`upgrade-pool.md`、`spawner.md`（数值与规则）、`design/art-bible/art-bible.md`（素材规格）
> 关联决策：`adr-001.md` ~ `adr-004.md`；可行性校验见 `architecture-review.md`
> 读者对象：**有前端 JS/TS 经验、无游戏引擎经验的开发者**。本文给出可直接照搭的工程骨架与接口签名，不包含完整游戏实现代码。

---

## 0. 阅读导览（30 秒版）

| 你想知道什么 | 去哪看 |
|---|---|
| 怎么把工程搭起来 | §1 工程脚手架（命令 + 依赖清单） |
| 代码放哪、每个目录干嘛 | §2 目录结构 |
| 游戏怎么跑起来、怎么暂停 | §3.1 GameScene 与状态机、§3.5 更新循环 |
| 敌人/子弹/粒子怎么复用不卡 | §3.2 实体生命周期、§3.3 对象池 |
| 桌面和手机怎么共用一套逻辑 | §4 双端适配层 |
| 图集怎么加载、顺序怎么排 | §5 资源加载策略 |
| 性能预算怎么落地 | §6 性能预算落实表 |
| 遇到疑问看谁的拍板 | `adr-001.md` ~ `adr-004.md` |

> **总原则（一句话）**：战斗 / 生成 / 升级逻辑**完全共用**，双端差异只发生在"输入适配层"和"渲染/性能开关"两处（对应 concept §8 的统一方案）。

---

## 1. 工程脚手架

### 1.1 推荐创建方式：Vite + TypeScript 模板 + 手工引入 Phaser

> 不推荐 `npm create phaser` 官方模板：它捆绑了示例工程、Lint 全量规则与多场景样板，对"前端出身、想看清每一行"的开发者是黑盒。Vite vanilla-ts 模板干净透明，Phaser 只是普通 npm 依赖，符合"照着搭"的目标。

```bash
# 1. 在空目录创建 Vite + TS 工程（当前目录已是项目根）
npm create vite@latest . -- --template vanilla-ts

# 2. 安装 Phaser 运行时依赖
npm i phaser

# 3. 安装开发期工具（可选但推荐）
npm i -D vitest   # 纯逻辑单测（升级池/生成预算/伤害结算等可脱离引擎测试）
```

### 1.2 关键依赖清单与版本策略

| 依赖 | 版本策略 | 说明 |
|---|---|---|
| `phaser` | `^3.60` 起，安装时取最新 **3.x**，`package.json` 锁定 minor | API 基线见 1.3；3.6x 之后新增能力（Layer/FX 增强）不影响本架构使用面 |
| `vite` | 跟随模板（当前 5.x/6.x 均可） | 开发服务器 + 构建；`base: './'` 以便任意静态托管 |
| `typescript` | 跟随模板（~5.x） | 严格模式开启，见 1.4 |
| `vitest` | 跟随模板（^2.x，可选） | 跑纯逻辑单测；渲染相关不做单测（交给验收手测） |

**版本策略硬规则**：
1. `package-lock.json` 必须提交进版本库，保证 CI 与本地一致。
2. 升级 Phaser minor 版本走独立 PR，升级后必须跑一遍 §6 性能预算的基准（防止渲染层回退）。
3. 不要引入额外运行时依赖（本 Demo 无需状态库/物理库/DOM 框架）；任何新依赖进架构评审。

### 1.3 Phaser 版本基线（知识诚实声明）

本架构 API 基线为 **Phaser 3.60**（2023 年稳定版）：
- `Phaser.Game` 配置（`type: AUTO`、`scale: FIT`）
- `Phaser.Physics.Arcade`（`Group` / `Sprite` / `collider` / `overlap`）
- `Phaser.GameObjects.Particles.ParticleEmitter`
- `Phaser.GameObjects.Layer`（3.50+，用于渲染分组）
- `Phaser.FX.Outline`（Post FX，仅 WebGL，3.60+）

> 若安装时已到 3.7x/3.8x：以上 API 均兼容保留。**3.7x 之后若有 breaking change，以官方 changelog 为准——此为本项目已知知识缺口，安装后第一步先跑一次 `npm run build` + 启动 Demo 冒烟验证。**

### 1.4 TypeScript 严格度与最小工程约束

```jsonc
// tsconfig.json 关键项（前端开发者友好，但保证类型安全）
{
  "compilerOptions": {
    "strict": true,                    // 必开
    "noUncheckedIndexedAccess": true,  // 索引访问可能 undefined，逼你处理空
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["vite/client"]
  }
}
```

工程约束（写入根 `README.md` 或 `CLAUDE.md` 技术偏好）：
- 目录别名 `@/` → `src/`（`vite.config.ts` 配 `resolve.alias` + tsconfig `paths`）。
- 命令：`npm run dev`（开发）、`npm run typecheck`（`tsc --noEmit`）、`npm run lint`（可选）、`npm run test`（vitest run）、`npm run build`（产出到 `production/` 或默认 `dist/`）。
- 最小 CI（Lean 阶段可手动）：typecheck → test → build 三步绿。

---

## 2. 目录结构

```
src/
├── main.ts                  # 入口：平台检测 → RuntimeConfig 初始化 → 创建 Phaser.Game
├── config/
│   ├── game-config.ts       # Phaser.Game 配置（分辨率、缩放、物理、场景注册）
│   ├── runtime-config.ts    # 双端运行时开关：实体上限/粒子池/描边/FX（见 §4.2）
│   └── balance.ts           # 数值常量表：武器/敌人/升级池/生成预算（与 GDD 一一对应，埋点断言用）
├── core/
│   ├── events.ts            # 全局事件总线（Phaser.Events.EventEmitter 单例）
│   ├── game-state.ts        # 状态机：RUNNING / LEVEL_UP / PAUSED / GAMEOVER
│   ├── object-pools.ts      # 对象池封装（按 key 管理多个 Group，含 maxSize）
│   └── time.ts              # 时间工具：delta 归一化 / clamp 防跳怪 / 计时器
├── scenes/
│   ├── BootScene.ts         # 预加载最小资源 → 启动 PlayScene
│   └── PlayScene.ts         # 唯一的玩法场景（ADR-003：单场景）
├── input/
│   ├── input-source.ts      # 统一移动向量接口（ADR-002）
│   ├── keyboard-input.ts    # 桌面适配器：WASD + 方向键
│   └── touch-input.ts       # 移动适配器：左半屏虚拟摇杆
├── player/
│   ├── player.ts            # 守夜人实体（移动/接触伤害/无敌帧/死亡）
│   └── player-stats.ts      # 属性容器：HP/移速/伤害倍率/等级成长
├── weapons/
│   ├── weapon.ts            # 武器接口：update(dt)/冷却/触发
│   ├── homing-missile.ts    # 自动飞弹「血月猎手」
│   ├── orbit-orb.ts         # 护体环绕球「守夜之环」
│   └── shockwave.ts         # 定时冲击波「月蚀脉冲」
├── enemies/
│   ├── enemy.ts             # 敌人实体（面板驱动：HP/速度/伤害/经验）
│   ├── enemy-types.ts       # 四种面板数据（僵尸/疾行/厚血/Boss）
│   └── boss.ts              # Boss 专用（顶部血条、0.5s 霸体、清场入场）
├── spawner/
│   └── spawner.ts           # 敌潮生成器：budget(t) 公式 + 阶段权重 + 同屏上限
├── xp/
│   ├── xp-gem.ts            # 经验宝石（池化；磁吸拾取）
│   └── xp-manager.ts        # 经验累计 → need(n) 升级曲线 → 触发三选一
├── upgrade/
│   ├── upgrade-pool.ts      # 12 项卡池 + 抽取规则（权重/满级剔除/超时）
│   └── upgrade-apply.ts     # 选项效果 → 写回 player-stats / weapons
├── combat/
│   └── damage.ts            # 伤害结算：倍率汇总 / 命中 / 无敌帧 / 死亡分发
├── map/
│   └── map.ts               # 3000×3000 地图：边界、障碍物、出生环带辅助
├── ui/
│   ├── hud.ts               # HUD（DOM 覆盖层）：等级条/血条/武器槽
│   ├── levelup-overlay.ts   # 升级三选一（DOM 覆盖层，ADR-004）
│   └── results.ts           # 结算页（DOM 覆盖层）
├── fx/
│   └── fx-manager.ts        # 粒子/红闪/抖动/屏幕震动（统一入口，受 RuntimeConfig 裁减）
└── utils/
    ├── device.ts            # 平台检测：isMobile / touch 能力 / 视口
    ├── math.ts              # 向量工具、角度、环形随机点
    └── perf.ts              # 帧率统计、draw call 估算辅助（开发期）
```

**目录一句话职责**：
- `config/` 唯一配置来源，禁止散落魔法数字
- `core/` 与玩法无关的基础设施（事件/状态/池/时间），**零热路径分配**
- `scenes/` 只做场景装配与转发，不写业务逻辑
- `input/` 把物理输入归一化成"移动向量"，**不持有任何游戏状态**
- `player/ weapons/ enemies/ spawner/ xp/ upgrade/ combat/ map/` 按 system-map S2–S9 一一对应
- `ui/` DOM 覆盖层，**只读游戏状态、不写回**（单向数据流，改状态走事件总线）
- `fx/` 表现层，受 RuntimeConfig 裁减（移动端减粒子/关震动）
- `utils/` 纯函数，可单测

> 依赖方向铁律：`ui/` → 事件总线 ← `core/` ← 玩法目录；**禁止 `ui/` 直接 import 玩法模块内部可变状态**；`config/balance.ts` 只被玩法与测试读取，被写回的唯一入口是 `upgrade/upgrade-apply.ts` 与 `player/player-stats.ts`。

---

## 3. 核心模块设计

### 3.1 GameScene 与状态管理

**单一 `PlayScene`（ADR-003）+ 四状态状态机**：

```
RUNNING ──(升级触发, 累计经验达 need)──▶ LEVEL_UP
   ▲                                        │
   │                                        │ (选择完成 / 超时 30s)
   │                                        ▼
   │◀────────────────────────────────── RUNNING
   │
   ├──(玩家主动暂停 Esc/P / 移动端暂停键)──▶ PAUSED ──(恢复)──▶ RUNNING
   │
   └──(玩家 HP ≤ 0)──▶ GAMEOVER ──(结算页)──▶ 重开 → 重建 RUNNING
```

```ts
// core/game-state.ts —— 接口签名示意
export enum GamePhase { RUNNING = 'RUNNING', LEVEL_UP = 'LEVEL_UP', PAUSED = 'PAUSED', GAMEOVER = 'GAMEOVER' }

export class GameState {
  private phase: GamePhase = GamePhase.RUNNING;
  set(p: GamePhase): void;      // 内部统一调 pause/resume 副作用，外部只声明意图
  get(): GamePhase;
  onChange(cb: (p: GamePhase) => void): void;
}
```

**暂停实现要点（Phase 语义）**：
- `LEVEL_UP` / `PAUSED` 时：`this.physics.pause()` + `this.tweens.pauseAll()` + 粒子暂停 + 战斗输入禁用。
- 恢复时：`this.physics.resume()` + `this.tweens.resumeAll()`。
- **DOM 覆盖层的动画不受 Phaser tween 暂停影响**（这正是 ADR-004 选 DOM 的原因之一），升级卡片动画在暂停态仍可播放。
- `GAMEOVER` 时清空子弹/环绕球（weapons.md §6.5），停止生成器（spawner.md §6.2），进入结算覆盖层。

**GameScene 装配职责（PlayScene）**：创建事件总线订阅、创建各系统实例（输入/玩家/武器/敌人池/生成器/经验/升级/UI/FX）、`create` 阶段注册好 → `update(time, delta)` 只做"按状态机转发"：

```ts
// scenes/PlayScene.ts —— 示意
update(time: number, delta: number): void {
  if (this.state.get() !== GamePhase.RUNNING) return; // 非 RUNNING 不做战斗逻辑
  const dt = coreTime.clampDelta(delta);              // 防跳怪（spawner §6.5）
  this.inputSource.update();                          // 读输入 → 移动向量
  this.player.update(dt);
  this.weapons.update(dt);                            // 冷却/触发（自动）
  this.spawner.update(dt);                            // 预算累加 + 生成
  this.enemies.update(dt);                            // 移动/接触伤害
  this.xp.update(dt);                                 // 磁吸
  this.fx.update(dt);
}
```

### 3.2 实体生命周期（spawn → active → 回收）

所有可池化实体遵循统一生命周期，避免 `new/destroy` 抖动（GC 停顿是 Web 幸存者 like 卡顿主因）：

```
spawn()   ：从池 get()，重置字段（HP/位置/速度/可见/激活），挂上 active
update()  ：只在 active 时被遍历；逻辑（移动/冷却/碰撞）
death()   ：从碰撞列表移除 → 掉落/统计 → 播放消散粒子 → killAndHide() → 归还池
```

统一接口：

```ts
// core/object-pools.ts —— 对象池接口签名
interface Poolable {
  readonly id: number;
  active: boolean;
  spawn(x: number, y: number, ...args: unknown[]): void;  // 重置 + 激活
  deactivate(): void;                                      // 回收（不销毁）
}

class ObjectPools {
  acquire<T extends Poolable>(key: string): T;   // 池空且达 maxSize → 返回 null 或回收最早（策略见 §3.3）
  release(key: string, obj: Poolable): void;
  eachActive(key: string, fn: (o: Poolable) => void): void; // 只遍历 active，避免 O(n) 全扫
}
```

**每类实体的池上限（对应双端预算，来源 concept §8 + weapons/enemies GDD）**：

| 池 | 桌面 | 移动 | 依据 |
|---|---|---|---|
| 敌人（普通 3 类共用一池，面板区分） | 400 | 250 | spawner §6.4 同屏上限 |
| 子弹（飞弹，同屏 ≤8 发） | 8 | 8 | weapons §③ 数量上限 |
| 环绕球（常驻，非频繁生成） | 6 | 6 | 升级上限 6 颗 |
| 经验宝石 | 300 | 200 | 经验闭环 + 磁吸，按预算上浮 |
| 粒子（单 ParticleEmitter） | 200 | 100 | art-bible §7 粒子池上限 200（移动端减半） |
| 冲击波/拖尾特效 | 复用 2–4 个 Sprite 动画 | 同左 | 特效 draw call ≤8 约束 |

> 冲击波不做频繁生成销毁：单 Sprite + 0.4s 扩散缩放动画复用（art-bible §7 冲击波 1 个圆环），不占池。

### 3.3 对象池策略

**实现载体**：`Phaser.Physics.Arcade.Group`（`classType` 指向自定义实体类，`maxSize` 设上限）。

```ts
// 示意：创建敌人池
this.enemyPool = this.physics.add.group({
  classType: Enemy,          // 自定义类，继承 Arcade.Sprite
  maxSize: cfg.maxEnemies,   // 桌面 400 / 移动 250（RuntimeConfig）
  runChildUpdate: false,     // 我们统一在 PlayScene.update 遍历，避免每个对象单独回调
});
const e = this.enemyPool.get(x, y, 'characters', 'zombie') as Enemy;
```

**池满策略（不报错、不叠加，对齐 enemies §6.1/spawner §6.1）**：
- 敌人池满：生成器暂停 2s 后重试（spawner 自带节流），不丢弃预算。
- 子弹池满：跳过本冷却，不积压（weapons §6.3）。
- 粒子池满：`ParticleEmitter` 用 `maxAliveParticles` 自动回收最早粒子（art-bible §7）。

**为什么不是重 ECS**：见 ADR-001。本 Demo 实体类型少（4 敌 3 武 1 玩家），组件式对象 + 类型化池的复杂度远低于 ECS 基建成本；等出现"状态组合爆炸"（超武/饰品/异常状态）再评估迁移。

### 3.4 事件总线（升级三选一 / 拾取 / 击杀的通信）

用 `Phaser.Events.EventEmitter` 做全局单例 `GameEvents`。**所有跨系统通信走事件，不互相 import 可变状态**（这是 UI 单向数据流的实现基础）。

| 事件名 | payload | 生产方 → 消费方 |
|---|---|---|
| `enemy:killed` | `{ enemyType, xp, x, y }` | 伤害结算 → 生成器/经验/FX/吸血 |
| `xp:gem-collected` | `{ amount }` | 宝石 → xp-manager |
| `level:up` | `{ level, xpNeeded }` | xp-manager → GameState（转 LEVEL_UP）+ HUD |
| `upgrade:offered` | `{ options: UpgradeOption[3] }` | upgrade-pool → levelup-overlay |
| `upgrade:chosen` | `{ optionId }` | levelup-overlay → upgrade-apply → weapons/player-stats |
| `player:hurt` | `{ hp, maxHp }` | combat → HUD/FX |
| `player:died` | `{}` | combat → GameState（GAMEOVER）|
| `boss:spawned` / `boss:defeated` | `{ bossHp }` | spawner/boss → HUD/FX/结算 |
| `game:over` | `{ stats }` | GameState → results |

```ts
// core/events.ts —— 示意
export const GameEvents = new Phaser.Events.EventEmitter();

// 用法约定：
// 生产者：GameEvents.emit('enemy:killed', { enemyType, xp, x, y });
// 消费者：GameEvents.on('enemy:killed', handler);  // 在 PlayScene.create 注册，destroy 时 off
```

**约定**：消费方在 `PlayScene.create` 统一订阅、场景关闭统一 `removeAllListeners`（防泄漏）；事件名集中为常量（禁止字符串魔法值）。

### 3.5 场景更新循环（fixed timestep 建议）

**结论：逻辑层用"delta 累加、秒为单位"的类固定步，渲染层交给 Phaser 主循环；Arcade 物理保持默认 fixedStep 60Hz。**

- Phaser 默认 `update(time, delta)` 是可变步长（每渲染帧回调一次）。直接拿 delta 驱动冷却/生成预算会导致"掉帧加速"（帧率低→一帧跑更多逻辑→表现跳变）。
- **做法**：`core/time.ts` 提供 `clampDelta(delta)`（上限 ~50ms）与秒制累加器；所有冷却、生成预算、磁吸、无敌帧都用"秒"为单位累加，**与帧率解耦**（spawner §6.5 明确"预算按秒计算，掉帧不跳怪"）。
- **Arcade 物理**：保持默认 `fixedStep: true`（内部 60Hz 子步进，每帧最多 4 次迭代），移动/碰撞物理自带稳定步长。
- **极端掉帧保护**：`clampDelta` 防"补帧"导致实体瞬移穿墙；若帧间隔 >250ms 直接按 250ms 处理（宁可短暂卡顿不错乱逻辑）。

```ts
// core/time.ts —— 示意
export function clampDelta(deltaMs: number, maxMs = 50): number {
  return Math.min(deltaMs, maxMs) / 1000; // 返回秒
}
```

---

## 4. 双端适配层设计

### 4.1 输入抽象：统一移动向量（ADR-002）

```
                    ┌────────────────────────────┐
 键盘 WASD/方向键 ──▶│ KeyboardInput (桌面适配器)  │
                    │                            │
                    │   InputSource.getMove()    │──▶ (x, y) 单位向量，供 player 移动
 虚拟摇杆/触控 ────▶│ TouchInput (移动适配器)     │
                    └────────────────────────────┘
```

```ts
// input/input-source.ts —— 统一接口（本架构唯一输入出口）
export interface InputSource {
  /** 当前移动向量：x∈[-1,1], y∈[-1,1]，归一化到长度 ≤1（摇杆幅度即速度百分比） */
  getMove(): { x: number; y: number };
  /** 暂停/恢复事件（桌面 Esc/P，移动端暂停键） */
  onPauseToggle(cb: () => void): void;
  /** 一次性点按事件（升级选卡/结算按钮由 DOM 层处理，这里仅战斗相关） */
  onTap(cb: (x: number, y: number) => void): void;
  destroy(): void;
}
```

- **桌面 `KeyboardInput`**：`this.input.keyboard` 监听 WASD + 方向键，8 向合并后归一化（斜向不超速）；`addKeys` 用 `Phaser.Input.Keyboard.JustDown` 触发暂停。
- **移动 `TouchInput`**：**左半屏浮动摇杆**——`pointerdown`（x < 屏宽/2）时在按下点生成底座（圆环 96px 视觉 / **热区 ≥44px**，art-bible §6），拖动计算向量 clamp 到半径，`pointerup` 归零并隐藏；**升级选卡暂停期摇杆隐藏**（upgrade-pool §7）。
- 摇杆贴图放 `effects` 图集（非 DOM），保证与游戏坐标系一致、draw call 可控（1 个 sprite + 1 个 thumb）。

### 4.2 渲染 / 性能开关：RuntimeConfig

平台检测（`utils/device.ts`：`navigator.maxTouchPoints > 0 && 'ontouchstart' in window`，或宽度 < 768px）在 `main.ts` 最先执行，写入 `runtime-config.ts`，**全局唯一、只读（运行中不修改）**：

```ts
// config/runtime-config.ts —— 示意
export interface RuntimeConfig {
  isMobile: boolean;
  maxEnemies: number;        // 400 / 250（concept §8）
  maxParticles: number;      // 200 / 100（art-bible §7 减半）
  maxGems: number;           // 300 / 200
  outlineEnabled: boolean;   // 描边开关：桌面 true / 移动 false（concept §8）
  screenShake: boolean;      // 震动：桌面 true / 移动 false（art-bible §7）
  edgeWarning: boolean;      // 边缘红光呼吸：桌面 true / 移动 false（spawner §7）
  spawnRing: [number, number]; // 出生环带：桌面 [600,900] / 移动 [500,800]（spawner §7）
  particlePerDeath: number;  // 死亡粒子：桌面 8–16 / 移动 8（weapons §7）
  designWidth: number;       // 桌面 1920 / 移动 720（见 §4.3 分辨率）
  designHeight: number;      // 桌面 1080 / 移动 1280
}
```

**用法**：所有系统只读 `RuntimeConfig`，不自己探测设备；`fx-manager` 依据开关裁剪表现；`spawner` 依据 `maxEnemies` 设上限。**逻辑分支全部数据驱动，禁止散落 `isMobile ? ... : ...`**。

### 4.3 分辨率与缩放（关键：双端设计分辨率）

> **此处与 art-bible §8"设计分辨率统一 1920×1080"存在冲突，已在此给出工程决策并列入评审 CONCERNS**：

- **桌面**：设计分辨率 1920×1080，`Scale.FIT` + `CENTER_BOTH`。
- **移动**：设计分辨率 **720×1280 竖屏**，`Scale.FIT`。理由：1920 宽等比缩到 390px 宽屏幕时实体 32px 会缩到 ~6.5px，**低于 art-bible §4"最小实体 ≥16px"硬标准**；720 宽缩到 390 时 32px → ~17px ✔。
- **世界坐标与数值常量完全共用**（3000×3000 世界、伤害/速度/半径等全部不变），仅"设计分辨率"不同导致可视范围与实体感知大小不同；移动端可视宽度 720 vs 桌面 1920，观感等价于桌面缩放到 ~37.5% 视口——敌潮密度感知一致（concept §8"移动端 HUD 上移让出拇指区"在 720×1280 竖屏天然成立）。
- Phaser 配置示例（`config/game-config.ts`，值从 RuntimeConfig 读）：

```ts
new Phaser.Game({
  type: Phaser.AUTO,                       // WebGL 优先、Canvas 兜底（art-bible §8）
  parent: 'game-root',
  width: cfg.designWidth,
  height: cfg.designHeight,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  backgroundColor: '#0B0E14',              // 墨夜蓝黑，禁纯黑（art-bible §2）
  physics: { default: 'arcade', arcade: { fixedStep: true, debug: false } },
  render: { antialias: false, pixelArt: true }, // 2D 剪影风格关抗锯齿更锐利
  scene: [BootScene, PlayScene],
});
```

> `premultipliedAlpha`：Phaser 3 加载纹理**默认即为 false**（art-bible §8 要求统一 false），无需额外配置；**不要在加载时手动开启 premultiply**，避免 WebGL 半透明边缘发黑。

### 4.4 UI 双端差异总览

| 项 | 桌面 | 移动 |
|---|---|---|
| HUD 布局 | 贴边（左上等级/左下血条/右上武器槽，art-bible §6） | 上移让出拇指区，摇杆常驻 |
| 升级三选一 | 全屏居中卡片，鼠标点击（热区 ≥32×32） | 同布局，点按（热区 ≥44×44），无 hover |
| 暂停 | Esc / P | 右上暂停键（热区 ≥44×44） |
| 结算页 | 鼠标点击 | 点按（热区 ≥44×44） |

> 升级/结算/暂停面板全部为 **DOM 覆盖层**（ADR-004），天然满足触控热区、字号下限、系统字体缩放（art-bible §9 可访问性）；HUD 数值也用 DOM（避免 Phaser Text 逐对象 draw call）。

---

## 5. 资源加载策略

### 5.1 图集拆分与加载顺序

art-bible §8 约束：单图集 ≤2048×2048、JSON 数组格式、PNG（精灵/图标）/ WebP（纯色块/UI）、按品类拆包、`premultipliedAlpha: false`。

**三个图集**（`public/assets/` 下）：

| 图集 key | 内容 | 格式 |
|---|---|---|
| `characters` | 玩家/4 敌人/子弹/环绕球/冲击波帧 | PNG atlas（带 alpha 精灵） |
| `effects` | 粒子圆点/拖尾/冲击波扩散环/摇杆底座与拇指/红光呼吸 | PNG atlas |
| `ui` | 升级卡图标/武器槽图标 | WebP（纯色/扁平）或 PNG |

**加载顺序（BootScene → PlayScene）**：

```
BootScene.preload：
  1. ui 图集（Loading 进度条本身要用）     —— 极小，秒载
  2. characters 图集                       —— 战斗必需
  3. effects 图集                          —— 特效必需
  4. 音频（BGM/SFX，可选，可用 WebAudio 程序生成兜底）
BootScene.create：进度事件显示 → 加载完 → scene.start('Play')
```

```ts
// scenes/BootScene.ts —— 加载示意
preload(): void {
  this.load.setPath('assets');
  this.load.atlas('characters', 'characters.png', 'characters.json'); // JSON 数组格式
  this.load.atlas('effects', 'effects.png', 'effects.json');
  this.load.atlas('ui', 'ui.webp', 'ui.json');
  this.load.on('progress', (v: number) => { /* 进度条 */ });
}
```

### 5.2 分包与懒加载策略

- **Demo 单局全量预载**三个图集（每个 ≤2048²，总量可控制在几 MB 内），不做运行时懒加载——首屏一次 Loading，局内零加载停顿（幸存者 like 对局中卡顿不可接受）。
- **后期若加内容**：按"战斗必需（characters/effects）先载，UI 后载"的顺序，可把 ui 图集放到 PlayScene 的 `preload`（局内预载）而非 Boot。
- **音频策略**：BGM 一首循环 + SFX 少量；用 `this.load.audio`；若需压缩体积，BGM 用 OGG/MP3，SFX 用 WebAudio 程序生成（心跳低音）。Lean 阶段音频不是 P0，可后补。

### 5.3 纹理与合批约束（对齐特效 draw call ≤8）

- 所有特效素材进 `effects` 单一图集 → WebGL 下同纹理自动合批。
- 冲击波 = 1 个 Sprite 的 0.4s 缩放动画（非粒子），拖尾 = 1 条（移动端），粒子 = 1 个 ParticleEmitter（1 纹理）。
- **HUD/升级卡/结算用 DOM，不占 WebGL draw call**。
- 敌人/玩家/子弹共用 `characters` 图集 → 基础场景 draw call ≈ 2–3（背景 1 + 角色 1 + 特效 1），特效叠加后仍 ≤6–8 ✔（验证见 architecture-review §4）。

---

## 6. 性能预算落实表

> 把 concept §8 与 art-bible §7/§8 的预算映射到**具体实现手段**。预算不达标时按此表逐项排查。

| # | 预算项 | 目标值 | 落实手段（实现层） | 排查/验证方式 |
|---|---|---|---|---|
| 1 | 同屏实体上限 | 桌面 400 / 移动 250 | `Arcade.Group maxSize` 硬上限（§3.3）；生成器达上限暂停 2s（spawner §6.1） | 埋点断言 active 敌人数峰值 ≤ 上限（GDD 验收 §8-5） |
| 2 | 弹道上限 | 同屏 ≤8 发 | 子弹池 maxSize=8；达上限跳过冷却（weapons §6.3） | 埋点断言同屏子弹 ≤8（weapons 验收 §8-4） |
| 3 | 粒子池 | 200（移动 100） | `ParticleEmitter.maxAliveParticles`；死亡粒子桌面 8–16/移动 8 | 帧率 + ParticleEmitter 活跃数埋点 |
| 4 | 特效 draw call ≤8 | ≤8 | 单 effects 图集合批 + 单 emitter + DOM HUD（§5.3）；禁用运行时模糊/全屏 shader（art-bible §7） | 开发期 `perf.ts` 打印 draw call 估算；WebGL 调试面板核实 |
| 5 | 移动端 30fps+（目标 60） | 中端机 | 同屏 250、粒子 100、**描边关**（§4.2 outlineEnabled=false）、震动关、边缘红光关、出生环带缩窄 | 真机性能基准（见 §6.1） |
| 6 | 距离裁剪 | 只更新视口附近 | 自定义 `DistanceCuller`：每 10 帧扫描，以相机视口 + margin 200px 为界，视口外 `setVisible(false)` 且 **update 短路**；敌人 AI/碰撞不处理视口外对象 | 帧率对比开关测试；`isCulled` 计数埋点 |
| 7 | 对象复用 | 零频繁 new/destroy | 全实体池化（§3.2）；`killAndHide` 不销毁 | DevTools Performance 看 GC 停顿 |
| 8 | 物理开销 | 400 体稳定 | Arcade fixedStep；敌-敌**不设** collider（enemies §6.2 允许重叠）；玩家-敌、子弹-敌用 overlap + processCallback 过滤 inactive | 基准帧率 |
| 9 | 内存/显存 | 图集 ≤2048² | 三图集分离；移动端 1x 贴图、桌面 2x（art-bible §8） | 构建体积 + 显存监控 |
| 10 | 逻辑与帧率解耦 | 掉帧不跳怪 | `clampDelta`（§3.5）；预算/冷却秒制累加（spawner §6.5） | 人为限帧 30fps 对比逻辑结果一致 |

### 6.1 性能基准（Lean 阶段最小化）

- 建立 `npm run bench` 脚本：无头/开发模式跑 60s 峰值压力（生成器拉到最大预算 + 玩家全武器），记录平均/最低帧率。
- **验收门槛（concept §9）**：桌面 60fps 不掉帧；移动端中端机 30fps+（目标 60）。
- 基准机示例：桌面 Chrome 最新 + 集显；移动端 iPhone 12 / 小米 11 级别（中端 Android 最严格）。

---

## 7. 关键实现顺序建议（对齐 system-map P0 闭环）

```
第 1 步：脚手架 + 空场景跑起来（Vite + Phaser 白屏冒烟）          —— 确认引擎版本可用
第 2 步：core/（事件/状态/时间/池）+ RuntimeConfig 平台检测       —— 地基
第 3 步：S1 输入 + S2 角色移动 + S9 地图边界碰撞                  —— 能走
第 4 步：S3 武器（飞弹先做）+ S8 伤害结算                        —— 能打
第 5 步：S4 敌人 + S5 生成器                                     —— 能刷
第 6 步：S6 经验 + S7 升级池三选一（DOM 覆盖层）                 —— 闭环成立
第 7 步：S10 结算页 + Boss                                      —— 收束
第 8 步：性能基准 + 双端真机验证（§6.1）
```

> P1 表现层（磁吸动画/击杀粒子/波峰预告/Boss 演出/震动）穿插在闭环跑通后做，时间紧可直接裁剪（system-map §5）。

---

## 8. 附录：与设计文档的可追溯索引

| 本架构章节 | 对应设计文档 |
|---|---|
| §3.1 状态机 | concept §5 升级暂停选卡；upgrade-pool §6.2 暂停状态 |
| §3.2/3.3 实体与池 | concept §8 对象池；enemies §6；weapons §6；art-bible §7 粒子池 200 |
| §3.4 事件总线 | system-map S6→S7、S8→S10 依赖链 |
| §3.5 更新循环 | spawner §6.5 帧率无关；weapons 验收 §5 |
| §4.1 输入抽象 | concept §8 统一移动向量；upgrade-pool §6.4/§7 触控热区 |
| §4.2 RuntimeConfig | concept §8 性能差异；art-bible §7 移动端削减 |
| §4.3 分辨率 | art-bible §4/§8 最小实体 16px、设计分辨率（评审 CONCERNS-2） |
| §5 资源加载 | art-bible §8 图集 ≤2048²、JSON 数组、PNG/WebP、premultipliedAlpha false |
| §6 性能预算 | concept §8/§9；art-bible §7 特效 draw call ≤8 |
