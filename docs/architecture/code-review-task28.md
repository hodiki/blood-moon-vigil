# TASK-28 画面表现力专项 · 代码评审报告（Lean）

> 评审人：程基岩（工程主程）· 日期：TASK-30 · 评审对象：TASK-28 **未提交**改动（工作区 vs 86eafcd）
> 范围：提交就绪度 / 类型安全 / 对象池纪律 / 双端性能与降级 / 架构一致性。**不做玩法数值评审**。
> 方法：只读 —— git diff 逐文件审阅 + `npx tsc --noEmit` + `npx vitest run`；未改任何源码、未 commit。

---

## 0. 验证结果（先给结论）

| 项 | 结果 |
|---|---|
| `npx tsc --noEmit` | ✅ 通过（exit 0） |
| `npx vitest run`（全量） | ✅ 292 项 / 35 文件全绿（基线 283 + 新增 fx 9 项；bench perf-assert 12 项含 draw call===5 断言通过） |
| 调试残留 / TODO / console | ✅ 无（grep 变更文件零命中） |
| GDD 数值零改动 | ✅ balance.ts 仅新增 `FX` 常量块，未触碰 PLAYER/WEAPONS/ENEMIES/SPAWNER/BOSS 既有表 |
| 对既有行为破坏 | ✅ 全部为纯增量（详见 §3 核对表） |

**总体结论：无 P0（不阻塞提交）。** 发现 P1×2（提交范围与构建产物、纹理烘焙色值 token 纪律）+ P2×8（均为建议项）。提交建议见 §4，性能验证建议见 §5。

---

## 1. 评审范围

**修改（9）**：`design/art-bible/asset-audit.md`、`src/config/balance.ts`、`src/config/runtime-config.ts`、`src/fx/procedural-textures.ts`、`src/map/map.ts`、`src/scenes/PlayScene.ts`、`src/weapons/orbit-orb.ts`、`src/weapons/shockwave.ts`、`src/xp/xp-manager.ts` + `tests/bench/bench-sim.ts`、`tests/bench/perf-assert.test.ts`

**新增（4 源 + 2 测试）**：`src/fx/anim.ts`、`src/fx/fx-manager.ts`、`src/fx/fx-math.ts`、`src/fx/fx-spec.ts`、`tests/unit/fx/fx-math.test.ts`、`tests/unit/fx/fx-spec.test.ts`

**未跟踪但不在本次改动意图内**：`blood-moon-vigil-dist.zip`、`production/release/`（3 份发布文档）、`CHANGELOG.md`（见 P1-1）。

---

## 2. 问题清单（P0 / P1 / P2）

### P0（阻塞提交）
无。

### P1（应修）

**P1-1｜提交范围与构建产物入库风险（提交就绪度）**
- 位置：根目录 `git status` / `.gitignore`
- 现状：工作区未跟踪 `blood-moon-vigil-dist.zip`（369KB 构建产物）、`production/release/`（deploy-guide/release-checklist/versioning，TASK-26/29 发布文档）、`CHANGELOG.md`（记录到 0.1.0-Demo 基线，未含 TASK-28 条目）。`.gitignore` 仅覆盖 node_modules/dist/test-results/日志/编辑器，**未覆盖 `*.zip` 与 `production/`**。
- 风险：若按 `git add -A` 提交，369KB 二进制构建产物会随源码入库，每次构建产生无意义 churn；CHANGELOG/发布文档是独立交付物，混入本次会污染提交语义。
- 建议：a) `blood-moon-vigil-dist.zip` 加入 `.gitignore`（或删除，构建可再产出）；b) 本次提交**只 add TASK-28 相关文件**（清单见 §4）；c) CHANGELOG.md 与 production/release/ 单独成提交，并补 TASK-28 条目。

**P1-2｜纹理烘焙色值违反「token 统一来源」纪律（类型安全 / Pure Data）**
- 位置：`src/fx/procedural-textures.ts`（TASK-28 新增 9 处硬编码 rgba 字面量）
  - `:585` decal-blood `rgba(140,47,47,0.5)` ＝ `PALETTE.enemyZombie #8C2F2F`
  - `:643-644` 血月光晕 `rgba(84,230,201,…)` ＝ `PALETTE.playerAccent #54E6C9`
  - `:652-654` 月面高光 `rgba(255,59,48,…)` ＝ `PALETTE.danger #FF3B30`
  - `:685-687` 渐晕 `rgba(11,14,20,…)` ＝ `PALETTE.base #0B0E14`
  - `:567` decal-rock `rgba(42,51,70,0.85)` ＝ `PALETTE.blocker #2A3346`；`:574` 高光 ＝ WHITE
- 与文件头及 asset-audit §8.4「色值一律取 PALETTE/BOSS/GEM token（禁止硬编码装饰色）」声明冲突。注：`:333/:352/:385/:406/:408/:411` 为 TASK-22 v2 既有的同类字面量（既有模式，非本次引入）；本次是在既有模式上延续。
- 影响：换色需手动同步字面量（token 机制失效）；但值精确等于 token、烘焙像素 0 运行时成本、无功能缺陷 → **不阻塞**。
- 建议：`utils/math.ts` 增加纯函数 `hexToRgba(hex, alpha)`（可单测），替换 TASK-28 新增 9 处；既有 v2 字面量可顺带清扫（P2）。

### P2（建议）

**P2-1｜粒子池未复用 core 对象池基建（对象池纪律）**
- `src/fx/fx-manager.ts:47,60-68`（自建数组池）、`:259-275`（spawnParticle 线性找空闲）、`:100-112`（update 全量扫描）
- 与 `core/object-pools.ts` 的 `Pool<T>`（reject 策略 / acquire/release/eachActive/activeCount）语义重复。
- 建议：复用 `new Pool<Particle>(particles, cfg.maxParticles, 'reject')`（acquire 后配置、回收时 release）；或保留自建但在文件头注明理由（粒子为纯 Image 非 Arcade.Sprite、需预配置字段——理由成立，但应记录为架构决策）。

**P2-2｜fx-math 纯函数运行期未接线，与 emitBurst/emitRing 数学重复（DRY）**
- `src/fx/fx-math.ts:17-35` burstVectors/ringParticles 仅被测试使用；`fx-manager.ts:203-246` emitBurst/emitRing 用 Math.random 复刻了相同几何（随机方向、环上等角）。
- `fx-math.ts:38-41` capBurstCount 仅被自身测试使用（运行期是 reject 语义，等价）。
- 建议：emitRing/emitBurst 消费 fx-math 纯函数（随机 seed 入参），或删除未接线函数，避免两套几何实现。

**P2-3｜O(n) 扫描（性能）**
- 每帧 update O(maxParticles)（200/100）＋ spawnParticle O(n) 找空闲；峰值 24 粒×O(200) ≈ 4800 次/帧，桌面可承受、移动减半。
- 建议：维持现状（E4-S5 已声明线性预算）；后续加特效再换 free-list O(1)。

**P2-4｜clearAll 未隐藏 orbitRing（收尾一致性）**
- `fx-manager.ts:193-198` 只清粒子；若已解锁护体球且 fxTrails=true，结算页残留轨道环（alpha 0.22 细环 + 结算遮罩，影响极小；scene.restart 重建）。
- 建议：clearAll 内同时 `this.orbitRing.setVisible(false)`。

**P2-5｜无头基准移动端口径偏保守（双端性能）**
- `tests/bench/bench-sim.ts:84-88` 桌面/移动统一计 ambient=1 + particlePasses=1 → drawCallEstimate 恒 5；移动端 fxTrails=false 实际粒子负载远低。
- 建议：注释说明为「上界口径」即可（无头无法精确模拟活跃粒子）。

**P2-6｜渐晕/血月 LINEAR 过滤 × 全局 pixelArt 需真机复核（双端渲染）**
- `procedural-textures.ts:626` fx-ambient 显式 `setFilter(LINEAR)`，而 game-config `render.pixelArt=true`（NEAREST 全局）。预期每纹理覆盖生效，但需真机确认：a) 渐晕/光晕平滑无带状；b) 8px 粒子 LINEAR 放大不糊到影响剪影；c) 低端机两张屏幕空间精灵（月盘近全屏 + 渐晕全屏）叠加开销。
- 另：渐晕 depth 800 会压暗左下摇杆区（移动端 joystick 默认 depth 0，角落 alpha ~0.5）——真机复核摇杆可辨识度，必要时摇杆 depth 提至 801。

**P2-7｜升级爆发粒子冻结（体验细节）**
- `PlayScene.ts:433` levelUpBurst 在 `:440` `state.set(LEVEL_UP)` 前发射 → 粒子冻结在 spawn 满 alpha 态，选卡期间静止、恢复后同时老化。符合 ADR-003「世界静止」语义，视觉可接受；可选：恢复 RUNNING 时再触发。

**P2-8｜CHANGELOG 计数口径（文档一致性）**
- `CHANGELOG.md` 记「292 单测（35 文件）」＝ 已含本次 9 项 fx 测试；基线提交（86eafcd）实际 33 文件 / 283 测试。
- 建议：CHANGELOG 随本提交入库时补 TASK-28 条目（Added: fx 粒子/动画/氛围；Performance: draw call 口径 3→5）并把单测数更新为 292/35。

---

## 3. 与 asset-audit §8 规格逐项核对

| §8 项 | 规格 | 核对结果 |
|---|---|---|
| ① 环境氛围 | fx-ambient moon/vignette 同图集 1 批、贴花随 effects 组 | ✅ FxManager 常驻 moon+vignette（同 `fx-ambient` 图集）；MapSystem 贴花用 `effects` 帧（depth -98） |
| ② 角色动画 | 5 实体 `*-v` 变体、characters 256²→512×256、idle 1.4fps / move 9fps、Boss 恒 idle、随 applyPhase 暂停/恢复 | ✅ anim.ts 全符合；PlayScene `applyPhase` 增 `anims.pauseAll/resumeAll`（ADR-003 对齐）；幂等（`exists('player-idle')` 守卫，restart 兼容） |
| ③ 特效强化 | 拖尾/残影/涟漪/溅射/出场；预算峰值约 31/≤80/≤24 粒 | ✅ fx-manager 实现；拖尾 90ms 节流、磁吸 150ms 节流；稀有触发涟漪 18 粒 / 出场 22+8 粒 |
| ④ 粒子池 | 池 ≤200 桌面 / ≤100 移动；`fxTrails=false` 移动端关拖尾/残影；fxAmbient/fxBursts 保留 | ✅ runtime-config：fxTrails 桌面 true/移动 false；fxAmbient/fxBursts 双端 true；池容量=cfg.maxParticles，池满 reject（soft-cap，activeCount 恒 ≤maxParticles） |
| ⑤ draw call 口径 | 3→5 且 ≤8（ambient 1 + 粒子 extra 1） | ✅ bench-sim/perf-assert 同步为 `===5 ≤8`；PlayScene.finishBench 计入 ambientActive=1 + particlePasses=activeCount>0?1:0 |
| ⑥ 测试/兼容 | 新增 tests/unit/fx（5+4 项）；typecheck + 单测全绿；GDD 数值零改动 | ✅ 9 项全绿；typecheck 通过；balance 仅增 FX 常量块；GemCollected 增 x/y 为纯增量（hud-state/audio 只读 amount，兼容） |

**接入为纯增量确认**：orbit-orb 增 `unlocked` getter、shockwave 增 `radiusPx` getter、xp-manager 增 payload 字段、MapSystem 构造参数带默认值 —— 均不改既有接口语义、不触碰 GDD 数值。

---

## 4. 提交建议

1. **可提交**（无 P0）。先处理 P1-1（提交动作层面）：
   - `blood-moon-vigil-dist.zip` 不入库（加 .gitignore 或删除）；
   - 本次提交只 add TASK-28 文件：
     ```
     git add src/config/balance.ts src/config/runtime-config.ts \
       src/fx/procedural-textures.ts src/fx/anim.ts src/fx/fx-manager.ts \
       src/fx/fx-math.ts src/fx/fx-spec.ts \
       src/map/map.ts src/scenes/PlayScene.ts \
       src/weapons/orbit-orb.ts src/weapons/shockwave.ts src/xp/xp-manager.ts \
       tests/unit/fx/ tests/bench/bench-sim.ts tests/bench/perf-assert.test.ts \
       design/art-bible/asset-audit.md
     ```
   - CHANGELOG.md、production/release/ 单独成提交（CHANGELOG 需补 TASK-28 条目，见 P2-8）。
2. **建议随本提交或紧接修复**：P1-2（加 `hexToRgba` 替换 9 处字面量，低成本、保纪律）。
3. **可留后续迭代**：P2-1 ~ P2-8 全部。
4. 提交前建议本地再跑一次 `npm run dev` + Playwright 冒烟（本次只读评审未起 dev server；确认渲染无黑屏/缺帧/动画正常）。

---

## 5. 性能验证建议

**已执行（无头/静态）**
- typecheck ✅；全量 292 单测 ✅（含 fx 9 项、bench perf-assert 12 项：断言 drawCallEstimate===5、桌面峰值 400 / 移动 250、子弹 ≤8）。

**无头基准**
- `npm run bench`（bench-run，20 分钟峰值模拟）复跑确认无回归；
- `npm run bench:browser`（`?bench=1`，60s 峰值）→ `window.__BENCH_RESULT__`：桌面 avgFps≥60 / 移动 30fps+（目标 60）；drawCallEstimate ≤8。

**真机专项（移动中端：小米 11 级 / iPhone 12）**
1. **降级生效**：fxTrails=false 下飞弹拖尾/环绕残影/宝石磁吸拖尾关闭；临时在 fx-manager 打点 `activeCount` 峰值，核对 ≤100（桌面 ≤200）。
2. **显存**：三图集 512×256 + 512×256 + 256×256 ≈ 1.31MB（RGBA @1x），无 DPR 放大问题；DevTools GPU 内存核对。
3. **渲染叠加**：血月（近全屏）+ 渐晕（全屏）两张屏幕空间精灵在低端机帧率影响；pixelArt × LINEAR 过滤的真机观感（P2-6）。
4. **可读性**：左下摇杆在渐晕角落的可辨识度（P2-6）。
5. **暂停一致性**：升级选卡/暂停时粒子与角色动画冻结、恢复后继续（ADR-003）。
6. **峰值事件**：Boss 出场（冲击环 22+8 粒 + 震屏，screenShake 桌面 true/移动 false）、击杀潮（敌型溅射 10/8/16/24 粒）粒子池负载不超上限。
7. **draw call 实测**：Chrome WebGL 调试 / SpectorJS 核对实际批次数 ≤8（口径 5：背景 1 + characters 1 + effects 1 + ambient 1 + 粒子 1）。

---

## 6. 知识缺口 / 风险交接

- Phaser 3.90 `Texture.setFilter` 与全局 `pixelArt` 的相互作用未在浏览器渲染层验证（本评审只读，未起渲染）——以真机/浏览器基准为准（P2-6）。
- 渐晕强度 / 月盘大小 / 粒子密度为观感参数，已收敛在 `fx-spec.ts` 与 `balance.FX` 一处，主理人快照复核后可快速调参（asset-audit §8.4）。
- `tests/bench/bench-sim.ts` 与 `PlayScene.finishBench` 的 draw call 模型已同步为「5」，但二者口径独立维护，后续改特效组别时需同步更新（bench 测试已锁 ===5 防漂移）。
