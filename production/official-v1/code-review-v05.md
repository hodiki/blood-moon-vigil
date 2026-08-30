# 《血月守夜》V0.5.0 工程侧审阅报告

> 任务 ID：NV-REV-ENG · 作者：程基岩（engineering-lead）· 日期：2026-08-28
> 基线：tag `v0.5.0`（HEAD=967d1b5）· 只读审阅，未改动任何 src/tests 代码
> 参照：`production/official-v1/plan-v1.md`、`production/official-v1/m4-backlog.md`、`production/release/v0.5-summary.md`、`production/qa/r3-test-plan.md`

---

## 一、架构水位评估

### 1.1 结论：**有条件承载**——M4 全量素材替换「即绪」；难度根源重做「可承载但需先补 2 项工程前置」（数值沙盘 + balance 拆分）

### 1.2 支撑「能承载」的四条支柱（代码事实核对）

| 支柱 | 现状 | 证据 |
|---|---|---|
| 数据驱动内容管线 | 全量配置表齐备：武器 14 / 超武 7 / 敌 15 / Boss 4 / 角色 4 / 升级池 40 / 地图 3，全部为纯数据 `Record`/`readonly` 表，行为参数单列机器读表 | `src/config/balance.ts:526-1092`（WEAPON_CONFIGS / EVOLUTIONS / ENEMY_CONFIGS / BOSSES / HEROES / UPGRADE_POOL / MAP_CONFIGS）、`balance.ts:752-758`（ENEMY_BEHAVIORS 五类行为参数） |
| 行为注册表 | 武器走 `WeaponId → WeaponBehavior` 注册表（统一 update/写回接口），敌人走 `spawnByConfig` 唯一数据源注册，生成器走「槽位 → 地图槽位池 → 内容 ID」三级抽签 | `src/weapons/weapon-behavior.ts:41-60`（WeaponRegistry）、`src/enemies/enemy.ts:104-127`（spawnByConfig）、`src/spawner/enemy-spawner.ts:169-183`（spawnOneAt/spawnOneById） |
| 帧名契约注册表 | ≈190 个唯一帧名（文档口径 194）按 characters/effects/ui 三图集分区导出，保留帧名铁律，CI diff 单测锁死「注册表 ⊆ 交付集且无多余名」 | `src/config/frame-registry.ts:26-178`、`tests/unit/config/frame-registry.test.ts` |
| 双轨兜底 | 外部图集按帧矩形覆盖同名程序帧（缺帧 no-op、幂等 registry flag），实体侧 `resolveCharacterFrame` 缺帧回退程序剪影；tile 走独立 canvas 盖章 | `src/fx/external-atlas.ts:45-118`（applyExternal*/mergePackedFrames）、`external-atlas.ts:82-85`（resolveCharacterFrame）、`external-atlas.ts:150-157`（stampExternalTiles） |

批次 1~4 素材已实测走通该管线（v0.5-summary §三），**「帧名契约不变、实体代码零改动」的 M4 替换承诺成立**。

### 1.3 薄弱点（按风险排序）

1. **`balance.ts` 单文件 1092 行承载 8+ 域数值**（world/palette/player/growth/spawner/boss/fx/skill/hero/upgrade/map）。难度重做会高频集中改这一个文件（评审冲突、误改、断言漂移三重风险）。→ 建议：难度重做动工前拆为 `config/` 按域文件 + `balance.ts` 纯 re-export 兼容层（调用方零改动，工作量 M）。
2. **ui 图集「注册未消费」**：frame-registry 注册了 `upg_icons` 等 65+ UI 帧（frame-registry.ts:80-104），`assets/atlas/ui.json` 已入仓，但 BootScene 只预载 `characters-ext`/`effects-ext`（`src/scenes/BootScene.ts:28-29`），且 `external-atlas.ts` 无 ui merge 分支——UI 图标实际仍由 `icons.ts` 内联 SVG 渲染。→ M4 批次 3（升级池图标/UI 帧）开工前必须补「ui-ext 预载 + merge」路径（工作量 S）。
3. **缺整局数值沙盘**：现有测试以静态断言（配置表值、公式边界）+ 零散模拟（c3-tank-simulation / heal-balance / active-skill-dps-share）为主，没有「整局 DPS 曲线 / 承伤曲线 / 等级-时间曲线」的 headless 模拟，而难度重做的每一步裁决都需要它（详见 §五）。
4. **fx-manager skillRings 池仅 2 实例**且满载时复用 active 环（`src/fx/fx-manager.ts:87-96`、`playSkillRing` 内 `?? this.skillRings[0]`）：多技能环 + Boss 环并发时小概率闪烁。M4 战斗特效升级时顺手扩池（S）。
5. **行为扩展点单一**：难度重做要新增怪物行为时，`ENEMY_BEHAVIORS` 是唯一机器读入口，需同步 `enemy-behaviors.ts` 状态机与 `status-markers.ts` 标记——扩展路径清晰但三处必须同改，缺一处即静默失效。

---

## 二、技术债清单

工作量档：S ≤1 人日 / M 2~5 人日 / L >5 人日。「阻塞下一版本」指 0.8/1.0 路线上的必经项。

| # | 位置 | 债务描述 | 影响 | 档 | 阻塞 |
|---|---|---|---|---|---|
| T1 | `src/scenes/PlayScene.ts`（1277 行） | God-file：装配、事件接线、4 技能结算、dash/狂化、结算、bench/smoke 全在一个类 | 难度重做改装配层必须通读全文件；回归面不可控 | L（拆 SkillController/BenchRunner/装配模块） | 不阻塞，但重做期间强烈建议先拆 |
| T2 | `src/config/balance.ts`（1092 行） | 8+ 域数值混一文件 | 重做高频冲突点；断言漂移放大器 | M | **阻塞难度重做**（先拆再改） |
| T3 | `src/fx/procedural-textures.ts`（1574 行，占 src 15%） | 程序剪影兜底持续膨胀；M4 全量替换后大半成死代码 | 维护面大；但双轨兜底依赖其保留 | M（M4 后评估裁剪/惰性化） | 不阻塞 |
| T4 | `src/upgrade/upgrade-pool.ts`+`upgrade-apply.ts`（legacy 12 项数字池）与 v2 并存；`PlayScene.ts:1054-1075` 保留 legacy else 分支 | 双池双维护，legacy 已无生产路径（注释自认「v2 流程不产生」） | 死代码风险、误改 legacy | M | 不阻塞；重做武器/成长时一并清 |
| T5 | `src/enemies/enemy.ts:104-127` 面板直拷自 `ENEMY_CONFIGS`，Boss 另走 `BOSSES` 表；legacy `ENEMIES`（balance.ts:98-106）与 `BOSSES.boss_1`（4000HP）双源并存 | 数值双源，重做时易改一漏一（当前恰一致） | 数值漂移 | S | **阻塞难度重做**（收敛单源） |
| T6 | `src/input/keyboard-input.ts:55-58` checkPause/checkSkill 刻意相位无关，门控散落 `togglePause`（PlayScene.ts:1124-1131）/`tryCastActiveSkill`（PlayScene.ts:147 区段）两处 | 新相位（PROLOGUE）漏门控的结构性温床 → BUG-4 类 | 相位-输入联动脆弱 | S | 建议随 BUG-4 修复一并收敛 |
| T7 | `src/ui/prologue-overlay.ts:143-146` 自动推进用 `window.setTimeout`，不随 `applyPhase` 冻结；`:77-83` keyHandler 全会话期存活、仅查 display | 序章/相位联动缺口（BUG-4 关联） | 双响应观感 | S | BUG-4 修复项 |
| T8 | `src/ui/results-overlay.ts:269-273` 面板 `max-height` 用 `100dvh/100dvw`（视口单位）落在 `transform:scale` 设计空间容器内；`:348-350` build 列表 `height:240px` 不可收缩 | 多视口适配缺陷（BUG-3 根因，见 §三） | 矮视口按钮不可达 | S | BUG-3 修复项 |
| T9 | `src/audio/audio-manager.ts:138-152` resume 仅 unlock 单点 + visibilitychange；无「手势内重试」钩子 | 手势 resume 缺失（BUG-6 根因，见 §三） | 移动端/竞态后全程静音 | S | BUG-6 修复项 |
| T10 | `src/ui/panel-a11y.ts:67-74` Esc capture 监听依赖调用方解绑；start-overlay 的 codex/merit 弹层若未随 destroy 解绑则监听器跨场景存活 | 跨场景按键监听残留风险 | BUG-4 类双响应温床 | S | 不阻塞 |
| T11 | XP 曲线 `need(n)=5+3(n−1)` 线性（balance.ts:341-345）+ 大量「锁现值」断言（xp-curve ≥3000/Lv≥30、weapon-dps、balance.test 等） | 曲线一改，~15 文件测试期望需同步 | 重做摩擦大 | M | 重做波及（§五策略缓解） |
| T12 | `src/ui/codex-overlay.ts`（591 行）DOM 模板 + 样式全内联字符串 | 可维护性一般，无运行时风险 | 低 | M | 不阻塞 |

未发现 TODO/FIXME/HACK 遗留标记（src 全库 grep 为 0）；编码纪律（token 来源、池契约、纯函数分层）执行良好。

---

## 三、已知 BUG 定位与修复方案草案

### BUG-3 结算页 656 视口溢出（High）

- **现象**（qa T-F53）：1280×656 视口下 Build 回顾与按钮重叠、需滚动才能点到主按钮。
- **根因定位**：
  - `src/ui/results-overlay.ts:270-273`：`.bmv-results-panel { max-height: 760px; max-height: calc(100dvh - 32px); overflow-y: auto }`——面板位于 `#ui-overlay` 的**设计空间坐标系**（1920×1080，被 `overlay-scale.ts:79` 整体 `transform: scale(s)`，1280×656 下 s≈0.607），而 `100dvh` 是**未缩放的视口单位**：624px（=656−32）被当作设计空间上限，实际屏上高度仅 624×0.607≈379px，远小于画布可用高度，面板被过度压扁；
  - `src/ui/results-overlay.ts:348-350`：`.bmv-results-build-list { height: 240px }` 硬编码高度不可收缩（外层 `flex:1; min-height:0` 失效），压缩时内容溢出、与 `.bmv-results-actions` 视觉重叠，按钮被推出面板可视区。
- **修复方案草案**：
  1. 面板 `max-height` 改为容器相对：`max-height: calc(100% - 32px)`（宿主 `#ui-overlay` 即画布渲染矩形，`overlay-scale.ts:74-80` 已保证），或用已注入的 `--bmv-overlay-scale` 换算 `calc((100dvh - 32px) / var(--bmv-overlay-scale))`；
  2. build 列表 `height: 240px` → `max-height: 240px; min-height: 0; flex: 1 1 auto`；
  3. 回归：`tests/unit/ui/overlay-scale.test.ts` 增加 1280×656 结算页断言 + Playwright 三视口（1280×656 / 1366×768 / 1920×1080）死亡流程截图对照。
- **预估工作量**：S（0.5 人日）。

### BUG-4 序章 Esc 双响应（Medium）

- **现象**（qa T-F10 / BUG 表）：序章阶段一次 Esc 既跳序章又开暂停。
- **根因定位与静态复核结论**：
  - 全库唯一 Esc 消费者是 `src/input/keyboard-input.ts:50,77-82`（Phaser JustDown，相位无关）→ `PlayScene.togglePause`（`PlayScene.ts:1124-1131`）：`PROLOGUE` 相位两个分支都不命中 → no-op；且状态机 `game-state.ts:24-25` 根本不允许 PROLOGUE→PAUSED。**静态分析无法在 v0.5.0 代码中复现「一次 Esc 双响应」，需按 T-F10 真机复测裁决**；
  - 但存在两个确凿结构缺口，可解释「双响应」观感（末屏计时与按键赛跑）：
    - `src/ui/prologue-overlay.ts:143-146`：自动推进 timer 是 `window.setTimeout`，**不随 `applyPhase` 冻结**——Esc 按下瞬间若 timer 恰好 finish()（→RUNNING），同一物理按键在下一 Phaser 帧被 `checkPause` 的 JustDown 捕获 → RUNNING→PAUSED，呈现「跳序章 + 开暂停」；
    - `src/ui/prologue-overlay.ts:77-83`：keyHandler 挂 window 且全会话期存活（destroy 才解绑），仅靠 `display==='flex'` 守卫，相位盲。
- **修复方案草案**：
  1. 序章推进统一走状态机：keyHandler/clickHandler 仅在 `PROLOGUE` 相位响应（注入相位查询或由 PlayScene 转发）；
  2. 自动推进 timer 改 Phaser `time.addEvent`（随 `physics.pause`/状态机自动冻结）或 `finish()` 后立即 `clearTimer` + 100ms 内吞掉后续 keydown/JustDown；
  3. `togglePause` 对 PROLOGUE 显式吞掉本次 JustDown（消费而非穿透），并借机把 checkPause 门控收敛到状态机一处（技术债 T6）。
- **预估工作量**：S~M（0.5~1 人日，含双端回归）。

### BUG-5 功绩账本 +1/局（待裁决——只列验证步骤）

1. 单浏览器单标签，`localStorage.clear()` 清档（清两个污染源的残留数据）；
2. 连续 5 局（固定角色 + 固定地图），每局结算页抄录「守夜功绩 +N」（或控制台读 `window.__BMV_LAST_RUN` 的 meritEarned）；
3. 判定：5 局合计落入设计 28~32 区间 → 关闭 BUG-5；若仍 ≈+1/局 → 以 `src/stats/merit.ts` calculateMeritPoints 逐项核对，重点复查两处已修污染点的回归：跨局串号（RunStats per-run reset，`PlayScene.ts:223-225` 一带）与 Boss 首杀累加虚报（firstBossKillsThisRun）；
4. 结果（截图 + 5 局数值）回写 `production/release/v0.5-summary.md` §五并更新 qa 计划状态。

### BUG-6 音频 AudioContext 手势 resume 未接（High，移动端体验）

- **根因定位**：
  - resume 仅有两条路径：`src/audio/audio-manager.ts:138-152`（unlock，仅 BootScene「点击开始」回调调用，`BootScene.ts:48-53`）与 `:256-263`（visibilitychange 回前台——**不在用户手势内**，对 autoplay-policy 挂起的 context 无效）；
  - 若 unlock 时 `ctx.resume()` 竞态失败（unlock 早于图操作完成 / iOS interrupted 态 / Phaser `wa.unlock()` 内部异常被 `:144-146` catch 静默吞掉），之后**没有任何「手势内重试 resume」钩子** → context 永久 suspended，全程静音且无降级提示。
- **修复方案草案**：
  1. `init()`/`unlock()` 时注册常驻手势监听（window `pointerdown`/`touchend`/`keydown`，内部节流）：`if (this.unlocked && this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(...)`；
  2. `ctx.onstatechange` 中对 `suspended/interrupted` 打遥测点（结算页或 console.info），便于真机取证；
  3. 单测：mock ctx.state 序列断言「suspended + 手势 → resume 被调用」。
- **预估工作量**：S（0.5 人日 + 双端真机手动验证）。

**三 BUG 修复总工作量预估：1.5~2 人日**（BUG-5 不含，仅重采半日 QA）。

---

## 四、M4 集成就绪度（对照 m4-backlog §1.1/§1.2/§2 逐项核对）

| 项 | 代码现状 | 判定 |
|---|---|---|
| §1.1 pivot 接入 | 引擎**仍不消费** pivots.json：src 全库无 `pivots`/`framePivots`/`customPivot` 引用，唯一 `setOrigin` 在 `summon-weapons.ts:115`（`setOrigin(0.5,0)` 召唤物头顶锚点，与脚底无关）；`external-atlas.ts` merge 只按 cutX/cutY/cutW/cutH（:114） | 未做（**符合计划**：m4-backlog 明确「M4 一并接」，当前 origin 0.5=碰撞圆心无双轨不一致问题） |
| §1.2 全量 flipX | `defaultFacesRight` 仍仅登记 `'player'`（`src/fx/anim.ts:44-48`），hero-*/enemy-* 返回 null 不翻转；死区 `FACING_DEADZONE=8` 与竖移保持（:34-38）已实现 | 未做（**被美术「默认朝右」重绘阻塞**，代码侧仅扩表，S） |
| §2 walk 帧 | `walkCycleFrames` 自动识别 `-walk-a/b` 建 6fps move（`anim.ts:26-31,63-71`），缺帧回落 idle | **就绪**（到货即用） |
| §2 行为标记 6 帧 | `status-markers.ts` 全部经 `fxSlot(preferred marker-*, fallback p-ring/p-circle)`（:136,148,192），marker-* 到货自动换 | **就绪** |
| §2 技能环 4 帧 | `playSkillRing` 按 `skill-ring-*` 帧名模板、缺帧 no-op（`fx-manager.ts:309-326`）；skillRings 池仅 2 实例（见 §一.3.4，建议 M4 顺手扩） | **就绪**（带小尾巴） |
| §2 Demo 武器换图 | missile/orb/shockwave 帧名保留，external-atlas merge 直接覆盖（`external-atlas.ts:110-117`） | **就绪** |
| （新增缺口）ui 图集 | 65+ UI 帧已注册（frame-registry.ts:80-104）+ `assets/atlas/ui.json` 在仓，但无预载、无 merge 分支，图标仍走 icons.ts 内联 SVG | **未接线**——M4 批次 3 前必须补（S） |

**结论：「需先做 X」——X = ① 新建 `src/fx/pivot.ts` 按 m4-backlog §1.1 三步接入（body offset 先于 setOrigin + ±1px 断言，M）；② 朝向表扩全（等美术交付，S）；③ ui-ext 预载 + merge 分支（S）。**除这三项外，实体零改动的替换通道（§1.2 支柱核对）已验证可用，M4 主体可开工。

---

## 五、难度重做工程影响面

### 5.1 耦合触点图（改动力 → 波及层）

```
配置层  balance.ts（全域表）────────────┐
纯逻辑层 spawner.ts(budget/阶段)         │
        map-spawner.ts(槽位/移速加权)    ├──→ 装配层 weapon-system.ts(注册表装配)
        weapon-runtime.ts(616行冷却/命中)│      enemy-spawner.ts(抽签/保底/预警)
        weapon-math.ts / active-skill-math.ts   enemy-behaviors.ts / boss.ts
        xp-manager.ts(need曲线/磁吸)     │      upgrade-apply-v2.ts(40项写回)
        player-stats.ts(levelUp写回) ────┘
断言层  config 130 it / weapons 135 it / spawner 53 it / upgrade 80 it / xp 36 it
        ——大量「锁现值」断言（balance.test、enemy-panel、weapon-dps、
          xp-curve ≥3000/Lv≥30、c3-tank-simulation、heal-balance、active-skill 红线）
```

### 5.2 波及面估算

- **直接改动**：约 25~30 个 src 文件（配置 1 + 纯逻辑 7 + 装配 6 + UI 数值卡文案/遥测 3 + 新增系统 6~10）；`PlayScene.ts` 装配段与 `upgrade-apply-v2.ts` 是改动密度最高点。
- **测试失效**：约 15~20 个测试文件（config/weapons/spawner/upgrade/xp 为主）的锁现值期望需改写——TASK-43 已示范「以模型实测值为新基线」的纪律，应沿用。
- **工程量级**：≈ 一次 M2 级里程碑（纯工程 3~4 周，不含设计迭代与数值验证轮次）。

### 5.3 测试补写策略（重做前先行，否则每一步数值改动都是盲改）

1. **不变量先行**：把「锁现值」断言升级为「区间/不变量」断言（如：开局武器 DPS 带宽、S1 内 TTK 上限、精英出现窗口 3~5min、Boss 战 60~90s），重做期间设计意图不被测试细节绑架；
2. **整局模拟沙盘**：以 `tests/unit/spawner/c3-tank-simulation.test.ts` 模式扩展为 headless 整局模拟（20 种子 × 4 角色 × 3 图），输出「难度曲线指纹」（每 30s 的 DPS/承伤/等级/场上威胁点数），作为重做前后唯一对比基线——这是当前架构最大的缺口（§一.3.3）；
3. **单源纪律**：先收敛 T5（敌人面板双源）与 T2（balance 拆分），再动数值。

---

## 六、测试水位

### 6.1 覆盖分布（按模块 it() 计数；总计 874≈873，84 单测文件 + smoke/bench）

| 模块 | it 数 | 模块 | it 数 |
|---|---|---|---|
| weapons | 135 | fx | 48 |
| config | 130 | core | 37 |
| upgrade | 80 | xp | 36 |
| ui | 63 | narratives | 32 |
| active-skill | 57 | map | 20 |
| stats | 54 | audio / input | 18 / 18 |
| spawner | 53 | combat | 14 |
| enemies | 52 | player | 13 |
| codex / utils | 8 / 6 | | |

### 6.2 判读

- **优势**：配置断言（config 130）与武器数学（weapons 135）极厚——M4 帧名替换与武器扩容有强护栏；
- **薄弱（重做主战场恰是低谷）**：**player（13）** 成长核心断言最少；**combat（14）** 接触/伤害链薄（前期 35~42s 首死体验的承伤端无护栏）；xp（36）缺「等级-时间」曲线模拟；ui 63 但集中在纯函数，**结算页多视口回归缺失**（BUG-3 漏网原因）；
- **重做期间会失效**：§五.2 所列 15~20 文件的锁现值断言；
- **重做期间需补**：player-stats 成长矩阵、combat TTK 区间、整局模拟沙盘（新建）、results-overlay 多视口、audio resume 状态机。

---

## 七、总结

| 问题 | 结论 |
|---|---|
| 架构能否承载难度重做 | **有条件承载**：四支柱（配置表/行为注册表/帧名契约/双轨兜底）稳固；前置 = balance 拆分（T2）+ 面板单源（T5）+ 整局模拟沙盘（§五.3-2） |
| 架构能否承载 M4 全量替换 | **能**（帧替换零实体改动已实测）；前置 = pivot 接入 + 朝向表 + ui 图集接线 |
| 三 BUG 修复总工作量 | **1.5~2 人日**（BUG-3 S / BUG-4 S~M / BUG-6 S） |
| 技术债 Top | T1 PlayScene god-file（L）> T2 balance 单文件（M）> T3 procedural-textures（M，M4 后裁剪）> T4 升级双轨（M）> T5 面板双源（S，阻塞重做） |
| 0.8 vs 1.0 工程视角 | 难度重做（全数值链 + 1/4 测试改写）与 M4 全量素材是两条高风险线，**建议 0.8 = 难度重做落地（含三 BUG + 前置债），1.0 = M4 全量 + 打磨发布**，不挤同一版本 |
