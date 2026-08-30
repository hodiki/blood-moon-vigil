# 《血月守夜》V0.5.0 设计侧文档审阅报告（docs-review-v05）

> 任务 ID：NV-REV-DES（P0）· 作者：文策渊（设计策略师）· 日期：2026-08-28
> 审阅基线：tag `v0.5.0`（commit `967d1b5`，873/873 单测全绿）
> 性质：只读审阅 + 本报告落盘；未修改任何既有 GDD/设计文档，未执行 git commit。
> 审阅范围：`production/official-v1/`（plan-v1 / m2-feedback-data / v0.5-summary）· `design/official-v1/` 全目录 · `design/gdd/` 全目录 · `production/qa/r3-test-plan.md` v1.1 · 按需抽查 `src/config/balance.ts` / `src/weapons/class-upgrades.ts`（仅佐证实装状态，不做代码审阅）。

---

## 一、文档完整性审阅

### 1.1 design/official-v1 状态盘点表

| 文档 | 版本 | 与 V0.5 实装的差距 | 是否需要修订升版 |
|---|---|---|---|
| plan-v1.md | v1.0（定稿） | M0~M3 已完成、M4 部分完成（批次 1~4 入仓）；里程碑表未标进度状态 | 建议 v1.1 标注里程碑进度（低优先级，非阻塞） |
| pillars-v1.md | v1.1 | 支柱修订已实装（主动技低频约束在 gdd-active-skill ① 落地） | 本期不动；**难度重做时支柱 3「险而不绝望」与成功判据（中位存活 ≥4min）需随 gdd-difficulty-v3 再审** |
| world-bible.md | v1.1 | 与实装一致 | 本期不动；敌怪增删时 §4/§6/§9 联动增补 |
| content-design-outline.md | v1.4 | 已同步升级体验 v2（§3.3/§6/§6.6 逐条核对一致） | 本期不动；T1 内容取舍拍板后升 v1.5 |
| gdd-weapons-v2.md | v1.1 | 已同步（类成型 2 次/必占一席/×5，W1~W4 落实） | 本期不动；难度重做出 gdd-weapons-v3 |
| gdd-enemies-v2.md | v1.1 | 与实装一致（15 敌 + 4 Boss + R-C3-RULING 槽位语义） | 本期不动；难度重做出 gdd-enemies-v3 |
| gdd-upgrade-pool-v2.md | v1.3 | 与实装一致（G1~G8 落实；`balance.ts:1028-1048` 验证 WEIGHT_EVOLUTION=5 / GUARANTEE_* / STAGE_WEIGHT_MULT） | **无需修订——口径矛盾已闭环**（见 1.3①） |
| gdd-maps.md | v1.1 | 与实装一致 | 本期不动；若狼穴移速加权回调按 §② 预案走 |
| gdd-active-skill.md | v1.0 | 与实装一致（upgrade-experience-v2 §3.4 结论「本期无改动」成立） | 本期不动 |
| gdd-codex.md | v1.2 | 图鉴 50 条一致；**§3.4 功绩经济（28~32/局）与真机 +1/局 矛盾未裁决**（BUG-5） | **待 R3 重采裁决后升 v1.3**（改 §3.4 结算构成与典型值） |
| upgrade-experience-v2.md | v1.0 | 四方向已实装；§1.1 前提观测项（offersPerRun / xpGainedPerRun）埋点已上、**R3 尚未采集验证** | 文档不修订；验证责任转 R3 §6 数据表 |
| sim-verify-v1.md | v1.0 | **缺口：M3-FB2 复模拟结果未归档**——进化达成率 84~100% 仅在 v0.5-summary §三 一句话带过，复模拟参数/分布无档 | 建议补 v1.1 归档 M3-FB2 结论（防数据散落，难度重做需引用其方法论） |
| narrative-framework.md / narratives-spec.md | v1.1 / v1.0（终稿） | 与实装一致（42 条轻叙事 = 台词 30 + 档案/序章/播报文本） | 本期不动 |
| merit-ui-spec.md / codex-ui-spec.md | v1.0 | 与实装一致；功绩经济口径随 BUG-5 裁决联动 | 视 gdd-codex v1.3 结果微调文案 |
| consistency-anchors.md / consistency-review-v1.md | v1.1 / v1.0 | 过检工具与 M1b 批次登记，用途性文档 | 不动；**难度重做批次完成后需新出 consistency-review-v2 + sim-verify-v2** |
| content-id-frame-map.md / review-world-narrative-v1.md / m2-feedback-data.md | — | 登记与数据报告，历史输入 | 不动 |

### 1.2 design/gdd（Demo 基线层）状态盘点表

| 文档 | 版本 | 与 V0.5 实装的差距 | 是否需要修订升版 |
|---|---|---|---|
| weapons.md / enemies.md / upgrade-pool.md | v0.1 / v0.1 / v0.2 | Demo 基线，已被 official-v1 GDD 体系取代 | **基线冻结，不修订**（保留作演进留痕） |
| **spawner.md** | v0.1 | **严重脱节**：仍是 20min 局口径（20:00 Boss、budget 1200 分母、75s 波周期、4 段阶段表、3 敌构成）——与实装（BOSS_TIME=360、WAVE_PERIOD=60、3 段阶段表、15 敌槽位）全面不符 | **最高优先修订需求**：正式版没有一份「当前生效」的整合版生成器 GDD（见 1.4②）→ 由 **gdd-spawner-v2** 取代 |
| **rhythm-pace-adj.md** | v0.1 | **已实装闭环**（`balance.ts:157-160` BOSS_TIME/LINEAR_TOTAL=360、WAVE_PERIOD=60 验证；TASK-32 S3 tank 0.05 裁决 §9 在案） | 文档头部未标「已实装」状态，建议 v0.2 补状态标注，或整体并入 gdd-spawner-v2 |
| consistency-review.md / design-review-e2~e4.md | v0.1 / — | Demo 层与批次评审登记 | 不动 |

### 1.3 重点核查项结论

**① m2-feedback-data.md §四「GDD 口径矛盾（单局 5~7 次 vs XP 曲线 Lv~27≈26 次 offer）」——已裁决闭环 ✅**
- 裁决载体：`upgrade-experience-v2.md` §一（M3-DESIGN-1）：**平衡基准局 = 中位局 12~15 次 offer（标称 14）/ 全通局 26~28 次**，「5~7 次」为 Demo 20min 时代遗留口径废弃。四项决策（口径、进化 ≥50%/≥80%、保底席位、类成型阈值 3→2）已由用户确认（文件头注）。
- 文档同步闭环：G1~G8 → gdd-upgrade-pool-v2 v1.3、W1~W4 → gdd-weapons-v2 v1.1、C1~C4 → content-design-outline v1.4，版本留痕逐条可查。
- 实装闭环：`balance.ts`（WEIGHT_EVOLUTION=5、GUARANTEE_RELATED/PRIORITY、STAGE_WEIGHT_MULT、up_g_1~4 方向化改造 961~1080 行）与 `class-upgrades.ts:52`（THRESHOLD=2）逐项验证一致。
- **遗留验证项（未闭环，转 R3）**：裁决前提「真机 offersPerRun 中位 ≥12」（upgrade-experience-v2 §1.1）依赖 R3 §6 数据表采集确认；xpGainedPerRun 拾取率校验同理。**R3 未执行前，闭环状态 = 文档与代码闭环、数据未验收。**

**② rhythm-pace-adj.md 节奏调整——已实装 ✅（但文档层有缺口）**
- 实装验证：BOSS_TIME 1200→360、LINEAR_TOTAL_SECONDS/LINEAR_SCALE、WAVE_PERIOD 75→60、S3 tank 0.12→0.05（TASK-32 裁决）、BENCH_DURATION_MS 36s——`balance.ts:150-160` 与 spawner 配置逐项核对一致。
- 文档缺口：裁决散落在 rhythm-pace-adj（数值）+ gdd-enemies-v2 注（槽位）+ gdd-maps（参数覆盖）三处，design/gdd/spawner.md 仍冻结在 20min 口径。**生成器维度缺一份「当前生效」的整合 GDD，是难度重做前必须补的文档债。**

### 1.4 需修订文档 Top 3

| # | 文档 | 缺口 | 处置建议 |
|---|---|---|---|
| 1 | design/gdd/spawner.md | 20min 遗留口径，正式版生效 spawner 规格缺位 | 难度重做批次出 **gdd-spawner-v2** 整体取代（整合 rhythm-pace-adj + R-C3-RULING 槽位语义 + 阶段表） |
| 2 | gdd-codex.md §3.4 | 功绩经济设计值 28~32/局 vs 真机 +1/局（BUG-5）未裁决 | R3 单标签清档 5 局重采 → 裁决后升 v1.3（重标定结算构成） |
| 3 | sim-verify-v1.md | M3-FB2 复模拟结果（进化 84~100%）未归档 | 补 v1.1 归档，作为难度重做的模拟方法论与基线引用 |

---

## 二、难度重做设计输入盘点

### 2.1 两极表现的设计根因假设清单

**前期 35~42s 首死：**

| # | 根因假设 | 文档依据 |
|---|---|---|
| H1 | **前期压力旋钮单一 + 无豁免机制**：敌人面板恒定（gdd-enemies-v2 ①「压力由生成器数量驱动」），前期唯一难度旋钮是生成数量；缺出生保护/受击豁免/无敌帧类缓冲机制 | gdd-enemies-v2 ①、design/gdd/spawner.md ③ |
| H2 | **战力平台期与预算增长曲线交叉过早**：玩家开局 DPS ≈10~12（12 伤/1.2s 基线），首级 5 点 XP 需 ~30s；budget(t) 60s ≈ 1.44 点/s（rhythm-pace-adj §4「60s 1.44 vs 1.40」——前期斜率相对 20min 局**未降反微升**），30~45s 恰是「战力没涨、怪在变多」的谷 | rhythm-pace-adj §4 校验表、design/gdd/upgrade-pool.md v0.2（need(n)=5+3(n−1)） |
| H3 | **走位学习成本无梯度**：支柱 1「走位为主」下，35~42s 首死集中在未学会拉扯的玩家；XP 曲线前段过缓导致第一次升级（战力台阶）来得太晚 | pillars-v1 §1、need(n) 曲线 |
| H4 | **地图差异无前期豁免**：血教堂高密度回廊、狼穴 S1 冲锋怪频率 ~7.5%（R-C3-RULING 注），新手选错图前期更陡 | gdd-enemies-v2 §3.2/§3.3 注、gdd-maps ① |

**LV20+ 满血雪球：**

| # | 根因假设 | 文档依据 |
|---|---|---|
| H5 | **敌侧零缩放 × 玩家侧线性倍率**：倍率 1+0.04×(Lv−1)（Lv20 ≈ 1.76×、Lv27 ≈ 2.04×）+ 伤害强化 + 超武，而敌 HP/伤害全程恒定——「面板恒定」是 Demo 20min 局防数值膨胀的正确决策，在 6min 快节奏局 + XP 提速后失配 | gdd-enemies-v2 ①、rhythm-pace-adj §3 推算 |
| H6 | **升级体验 v2 放大了峰值前移**：进化前置（阈值 2 + 必占一席）使战力跳档提前（upgrade-experience-v2 §2.4 风险 2 自标「Boss 战中位时长可能 <60s」）；S3 tank 降权 0.05（TASK-32）进一步削后期威胁 | upgrade-experience-v2 §2.4、rhythm-pace-adj §9 |
| H7 | **中段（2~4min）缺威胁阶梯**：15 敌全部 S1 即入池（仅频率不同），除 Boss 6:00 / 化身 4:30 外无按局时解锁的新敌种；阶段表只改数量构成、不改威胁质——中段既无新逼迫、又未到 Boss，是「过渡缺失」的结构性原因 | gdd-enemies-v2 §3.1~3.3、rhythm-pace-adj §2 |

### 2.2 现有可复用输入

| 输入 | 位置 | 复用方式 |
|---|---|---|
| N=5000 局模拟方法论（三档玩家模型 + 敏感度分析） | m2-feedback-data.md §二~§七 | 难度模拟同构复用（死亡时间分布/存活曲线敏感性） |
| 单目标保守模型 + 判据重标定法 | rhythm-pace-adj §9、`c3-tank-simulation.test.ts` | 后期压力上界建模的现成工具 |
| 阶段权重乘区框架（S1/S2/S3/Boss × 类目） | upgrade-experience-v2 §2.2 | 难度侧阶段旋钮可直接对应同一阶段轴 |
| 遥测五件套（offersPerRun / xpGainedPerRun / evolutionComplete / relatedCardShare / bossFightSeconds） | v0.5-summary §三、r3-test-plan §6 | 难度校准数据管道已就绪 |
| 武器四类手感分类 + powerTag 五系 | gdd-weapons-v2 ①、world-bible §4 | 前期战力覆盖分析的分类骨架 |
| 15 敌面板 + 槽位语义 + 精英保底 | gdd-enemies-v2 §3、R-C3-RULING | 敌侧重做的完整现状底表 |
| 873 单测 + 埋点断言 | v0.5-summary §一 | 数值改动回归网 |

### 2.3 缺口

**需新采集的数据：**
1. **真机死亡时间分布**（deathsAtSeconds 直方图，分角色/分地图）——当前只有「35~42s 首死」结论性描述，无分布形状；R3 §6 表建议增列「死亡时点」。
2. **bossFightSeconds 实测分布**（R3 T-F29~31，未执行）。
3. **offersPerRun / xpGainedPerRun 中位数**（升级体验 v2 裁决前提验收，R3 §6）。
4. **中段威胁体感**（R3 §5.1 刻度题，未执行）。
5. **LV20+ 局的场上构成/击穿率采样** + 建议新增埋点：每分钟受击次数与 HP 流失曲线分桶（可在 `__BMV_LAST_RUN` 扩展，工程评估）。

**需新编写的 GDD（4 份）：**

| GDD | 一句话定位 |
|---|---|
| gdd-difficulty-v3 | 难度总纲：目标死亡时间分布、三侧旋钮分层（生成器/敌面板/玩家成长）、成功判据修订、是否引入动态难度的裁决 |
| gdd-spawner-v2 | 整合版生成器 GDD：取代 spawner.md + rhythm-pace-adj 散落状态，中段威胁阶梯（敌种分批解锁） |
| gdd-enemies-v3 | 敌侧重做：面板局时缩放或中段新敌、前期豁免、精英词缀取舍 |
| gdd-weapons-v3 | 玩家侧重做：首 60s 战力平台修复（初始武器/首级节奏/XP 曲线微调）、四类手感前期覆盖 |

---

## 三、0.8 vs 1.0 版本范围建议（核心章节）

### 3.1 两种划线

| 维度 | 方案 A：0.8 = 难度重做 + 修复 + M4 收尾；1.0 = M5 打磨 + Playtest + 发布 | 方案 B：1.0 一次到位 |
|---|---|---|
| 内容 | 0.8：gdd-difficulty-v3 体系设计+实装、BUG-3/4/5/6 修复、M4 pivot 接入；1.0：M5 全量 QA + 性能门 + Playtest + 发布门禁 | 全部压到 1.0 单版本 |
| 质量门负担 | 分摊：0.8 走设计评审 PASS + 定向难度 Playtest（小规模）；1.0 走 M5 全量门禁 | 1.0 单点承载全部门禁 |
| 返工风险 | 低——M5 打磨建立在已验证的难度曲线上 | **高**——难度重做若在 Playtest 才暴露问题，打磨成果（手感调优/性能优化/文案）大面积返工 |
| 玩家体验收益 | 0.8 即解决外测最痛三段（前期首死/中段过渡/后期雪球），1.0 收稳定 | 玩家长期停留在「能玩但难两极」状态 |
| 风险集中度 | 分散在两个版本 | 集中爆发在发布前（最贵的时间点） |

### 3.2 推荐：方案 A（0.8 先落难度重做）

**核心理由：难度重做是四系统联动改版（武器 DPS 曲线 ↔ XP 曲线 ↔ 生成器预算 ↔ 敌面板），任何一环在打磨期返工都会使打磨成果作废——M5 打磨必须建立在定稿的难度曲线之上，顺序不可倒置。** 辅助理由：
1. **既有迭代模式验证有效**：R2/R3 两轮「改动 → 外测 → 修复」节奏已跑通；0.8 作「难度验证版」加一轮定向 Playtest，等于给 1.0 的 M5 加一道预演，风险前置且便宜。
2. **M4 与难度重做天然可并行**：D3 双轨管线（帧名契约零代码替换）本就是为此设计——「难度重做设计先行、素材集成并行」**排布可行且推荐**：设计侧先出 difficulty/spawner 两份总纲定数值方向，工程同步做 pivot 接入与素材收尾，随后难度实装合流。
3. **内容纪律**：0.8 不加 T1 内容，改动面收敛在「重做」而非「扩张」，873 测试回归网可控。

---

## 四、新版本设计工作包草案

### 4.1 0.8（M-Diff 难度重做 + M4 收尾）

| 任务 ID | 内容 | Deliverables | Output Path | 依赖 |
|---|---|---|---|---|
| DIFF-D1 | 难度总纲 GDD：目标死亡时间分布、三侧旋钮分层、成功判据修订、动态难度裁决 | gdd-difficulty-v3.md | `design/official-v1/gdd-difficulty-v3.md` | **R3 补测数据**（死亡时点分布/bossFightSeconds/offersPerRun 中位）+ 挂起问题裁决 |
| DIFF-D2 | 整合版生成器 GDD：阶段表重构、中段威胁阶梯（敌种分批解锁）、槽位语义继承 | gdd-spawner-v2.md | `design/official-v1/gdd-spawner-v2.md` | DIFF-D1 |
| DIFF-D3 | 敌侧重做 GDD：面板缩放/中段新敌/前期豁免/精英词缀取舍（含 2.3 节 H1/H5/H7 根因对策） | gdd-enemies-v3.md | `design/official-v1/gdd-enemies-v3.md` | DIFF-D1 |
| DIFF-D4 | 玩家侧重做 GDD：首 60s 战力平台、XP 曲线/首级节奏微调、四类手感前期覆盖（H2/H3 对策） | gdd-weapons-v3.md | `design/official-v1/gdd-weapons-v3.md` | DIFF-D1 |
| DIFF-R | 跨 GDD 一致性评审 + 难度复模拟（复用 c3-tank 同构模型 + 三档玩家模型） | consistency-review-v2.md + sim-verify-v2.md | `design/official-v1/` | DIFF-D1~D4 |
| DIFF-E | 工程实装 + 873 测试基线更新 + 新埋点（受击/HP 流失分桶） | 实装分支 | src/（程基岩） | DIFF-R PASS |
| M4-PIVOT | pivot 接入 + M4 素材收尾（m4-backlog.md 接入点） | 素材集成完成 | — | 与 DIFF 并行（林绘澄/程基岩） |
| FIX-A | BUG-3/4/6 修复；BUG-5 按 R3 裁决结果修 merit 口径 | 修复 + gdd-codex v1.3 同步 | src/ + gdd-codex.md | R3 ①重采裁决 |
| 0.8 质量门 | 设计评审 PASS + 定向难度 Playtest（5~10 人，只测难度曲线） | playtest 报告 | `production/playtests/` | DIFF-E + FIX-A |

### 4.2 T1 增强内容取舍建议（plan-v1 §四 T1 表）

| T1 项 | 建议 | 理由 |
|---|---|---|
| 精英词缀/变异体 | **纳入 0.8**（作为 DIFF-D3 威胁阶梯的工具，先做 2~3 个词缀） | 敌侧重做的自然延伸，边际成本低、直接服务中段过渡 |
| 成就 | 纳入 1.0（功绩框架扩展，低成本） | 局外留存， merit-ui-spec 体系可直接复用 |
| 5 地图 / 每日挑战 | **明确不做**（1.0 维持 3 地图） | 3 图 + 难度分层已支撑重开动机；新图 = 全套敌怪/美术/Boss 成本，挤压难度重做资源 |
| 6 角色（含隐藏） | **明确不做**（1.0 维持 4 角色） | 4×（设计/美术/平衡/叙事）成本，主动技差异化已成立，收益薄风险大 |
| 20+ 武器 / 词条系统 | **明确不做**（维持 14+7） | 词条是新系统级工程；M2-FB1/M3-FB2 校准数据会因池重构失效 |
| 50+ 升级项 | **明确不做**（维持 40） | 40 项池刚完成 v2 校准与实装，重构即重蹈 M2 口径债 |
| 多难度/皮肤/过场多结局 | **明确不做** | 与 D2 轻叙事定位冲突；难度分层由 difficulty-v3 内部解决 |

**取舍原则**：1.0 的版本叙事是「难度重做后的稳定发布」——内容扩张让位于体验收敛。

### 4.3 R3 补测与版本门的关系

| R3 项 | 与版本门关系 |
|---|---|
| ①BUG-5 功绩重采 5 局 | **DIFF-D1 定稿前必须完成**（merit 口径影响 DIFF-D4 成长曲线侧的局外加成校准；FIX-A 依赖其裁决） |
| ②四角色 VFX / ③两图实玩 / ⑤移动端真机 | 0.8 回归基线；③顺带采集地图前期难度差异（H4 验证） |
| ④bossFightSeconds（T-F29~31） | **DIFF-D1 定稿前必须完成**（后期雪球量化基准） |
| §6 数据表（offersPerRun/xpGainedPerRun 等） | **DIFF-D1 定稿前必须完成**——既是升级体验 v2 裁决前提验收，又建议增列「死亡时点」列作难度基线 |
| §5.1 节奏曲线主观刻度 | **DIFF-D1 定稿前完成**（中段过渡缺失的体感验证） |

**结论：R3 全部 5 项 + §6 数据表 = DIFF-D1 的数据前置，是 0.8 设计启动的第一依赖。**

---

## 五、叙事与局外一致性（难度重做连锁影响清单）

| 影响域 | 触发条件 | 受影响内容 | 规模估计 |
|---|---|---|---|
| world-bible.md v1.1 | 新增敌种/词缀 | §4 力量体系（powerTag 归类）、§6 地图设定（怪构成表述）、§9 镜像表（若动精英/Boss） | 低：1~3 处增补，圣经本体不动 |
| gdd-enemies-v2 → v3 | 敌面板/行为重做 | 15 敌面板表 + 4 Boss 阶段重写级 | 全量 |
| 图鉴（gdd-codex 50 条） | 敌怪增删改 + 武器手感重排 | 需**复核**：敌人 15 + 武器 14 + 超武 7 = **36 条**（档案为叙事文案，面板数值改动通常不改文案）；需**改写**：行为描述变化的特殊行为敌档案 + 新增敌种新档案 | 复核 ~36 条 / 改写 ~8~15 条（5 类特殊行为怪若重做 + 新增敌 N 条）；条目总数随新增敌种 50→50+N |
| 轻叙事 42 条（narratives-spec：台词 30 + 档案/序章/播报） | 敌怪档案/Boss 改动 | 需**改写**：5 特殊行为敌 + 4 Boss 档案卡；若武器手感重排，进化播报 5 句（按 powerTag）需核对；新敌登场台词占用 30 条红线余量 | 改写 ~8~12 条；台词红线 30/30 需重算 |
| 守夜功绩（gdd-codex §3.4） | 难度曲线变化 + BUG-5 裁决 | 「单局典型 28~32 点（存活 12 + 击杀 ~8 + 通关 10 + 首杀 ~2）」的构成假设随新死亡时间分布失效，需按 difficulty-v3 重标定 | §3.4 一节重写 + merit-ui-spec 文案微调 |
| consistency-anchors v1.1 | 新批次 | 难度重做批次全量过检（A/B/C/D 四类） | 流程性 |

**规模级结论**：条目级 ~36 条复核 / ~8~15 条改写（新增敌种另计）；文档级 4 份升版（gdd-codex v1.3、narratives-spec v1.1、world-bible 视增删 v1.2、merit-ui-spec 视裁决 v1.1）。**原则**：档案文案是叙事不是数值——面板调参不触发改写，行为质变（新增/删除敌种、特殊行为重做、Boss 阶段改动）才触发；设计时优先「调参不动案」，可把叙事连锁压到最低。

---

## 六、审阅总结

1. **文档体系健康度：良好**。M1~M3 的 GDD 体系版本留痕完整、口径矛盾（5~7 vs 26）已在升级体验 v2 §一裁决并三文档同步 + 常量实装闭环；节奏调整已实装。仅存三处文档债（spawner 整合缺位、功绩经济未裁决、M3-FB2 结果未归档）。
2. **难度重做的最大结构洞**是「敌侧零缩放 × 玩家侧线性成长」+「中段无威胁阶梯」（H5/H7），且 design/gdd/spawner.md 20min 遗留口径未清——难度重做应从 gdd-difficulty-v3 总纲 + gdd-spawner-v2 整合切入。
3. **版本划线推荐方案 A**：0.8 = 难度重做 + 修复 + M4 收尾 + 定向难度 Playtest；1.0 = M5 全量打磨 + 发布。T1 内容除精英词缀（并入敌怪 v3）与成就外全部明确不做。
4. **第一依赖是 R3 补测**：全部 5 项 + §6 数据表（建议增列死亡时点）是 DIFF-D1 的数据前置，应尽快部署执行。

*报告完 · 文策渊 · 2026-08-28*
