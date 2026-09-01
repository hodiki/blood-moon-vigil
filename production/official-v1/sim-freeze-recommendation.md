# 模拟冻结裁决数据轮 · 冻结建议报告（NV-SIM-FREEZE）

> 版本 v1.0 · 日期 2026-09-02 · 作者 程基岩（engineering-lead）
> 上游：项目审查结论 v0.8 §八批次 G（「锚须 B1 沙盘裁决后冻结」）+ gdd-difficulty-v3 §5.2/§5.3（v1.1）+ sim-calibration-report（SC-1~5）。
> 性质：**只出数据与建议，不改生产代码**；冻结拍板权归主理人。本报告全部跑批基于批次 F 收官 HEAD（651eab8，typecheck 0 / 1316 用例全绿）。
> ⚠ 近似模型声明沿用 `tools/sim/README-sim.md` 分级（可信/需真机/不可用）；1D 径向等效模型，击杀效率未标定。

---

## ① 跑批规模与数据文件

| 轮次 | 工具 | 规模 | 输出 |
|---|---|---|---|
| XP c 案三档全量 | `batch-xp-cases.ts --seeds 150` | 3720 局（每档：invincible 40 局 + movement 1200 局） | `tools/sim/output/xp-cases-report.json`（本轮覆盖）+ `freeze-xp-cases-stdout.txt` |
| budget 端点参数面 | `batch-freeze.ts --seeds 10 --survival-seeds 25`（本批新增工具） | 1680 局（6 变体 × 8 专武 × 35 种子） | `tools/sim/output/freeze-budget-report.json` + `freeze-budget-stdout.txt` |
| **合计** | | **5400 局** | |

- 矩阵：3 c 档 × 8 专武 × 双口径（XP 曲线口径 invincible 隔离承伤；movement 生存口径）× 3 图轮转；`panelScale=true`（W-8 M3 缩放链）+ `pickupDelay=true`（S-3 gem 磁吸时延）。
- budget 变体：legacy `budget(t)` 基线 / 五端点下沿 / 中值 / 上沿 / S1 压平 60s 下沿 / 上沿。
- 方阵激进锚：沙盘无方阵语义（1D 模型不含阵型生成），**配置核对**：`RUNS_PER_GAME_ANCHOR` 已 = `[3,4]`（`src/config/balance/formations.ts:269`，P2-6 已改锚）。时序锚（S1 末 100s 入 / 掷点 60~90s / 同屏 ≤2 / 占比 25%）需真机 `?qa=1` 验证（审查 §九-5）。

---

## ② SC-2 终裁建议：XP c 案三档对照终表

实测（3720 局；约束 1~5 在 invincible 口径 n=40/档，v1.1 判据口径）：

| 硬约束（目标） | c-温和 4/3/5·−40%·×1.075 | c-标准 4/3/6·−45%·×1.125 | c-陡峭 5/4/7·−50%·×1.175 |
|---|---|---|---|
| 1. 首级 18~22s | 8.7s **FAIL** | 8.7s **FAIL** | 9.8s **FAIL** |
| 2. 首精英前 offers ≥3 | 11 **PASS** | 9.5 **PASS** | 8 **PASS** |
| 3. 6min offers 12~18 | 16.5 **PASS**（贴上沿） | 15 **PASS**（带中央） | 13 **PASS** |
| 4. 等级终值 Lv14~20 | Lv17.5 **PASS** | Lv16 **PASS** | Lv14 **PASS**（**贴下限**） |
| 5a. 升级间隔中位 ≤30s（判据） | 43.4s **FAIL** | 49.8s **FAIL** | 59.2s **FAIL** |
| 5b. 最坏间隔 ≤45s（联调观测项） | 67.8s **FAIL** | 74.8s **FAIL** | 85.3s **FAIL** |
| 参考：死亡中位 / 存活 / Boss 击杀（movement n=1200/档） | 74.8s / 0.06 / 0 | 76.4s / 0.03 / 0 | 71.0s / 0.02 / 0 |

与 v2 复测（720 局，2026-08-30）逐项一致（偏差 ≤5%），样本量 ×5 后结论稳定。

### 两项 FAIL 的模型偏置归因（冻结前必须读）

- **约束 1（首级偏早 ~10s）**：1D 沙盘击杀效率未标定——敌直线走入武器带、无「找怪/绕行」时间成本，XP 获取速率系统性偏快（README-sim 假设 2/4）。三档梯度方向正确（8.7 → 8.7 → 9.8s，needFirst/earlyStep 抬升有效推迟）。**此约束沙盘不可定谳，转真机验收判据**（见 §⑤ 回填清单 3/4）。
- **约束 5（后段间隔偏长）**：offer 占位不消费 → DPS 全程 mul=1，而敌 HP 吃 scale(t)×hpCaseLink 复利 → 后段击杀率坍缩 → XP 收入衰减。真机 DPS 成长 ×3.0（MD-0 口径）会显著缩短间隔。**沙盘值 = 保守下界**；联调方向按 GDD §5.2 #5：优先上调 S3 budget 终值斜率（3.2~3.6 → 3.4~3.8），needXp/lateStep 冻结期不动。

### 推荐档：**冻结 c-标准（4/3/6 · 敌 XP −45% · HP ×1.125）**

理由：
1. **破带裕度最大**：offers 15（目标 14 ±1）、Lv16（带 14~20 中央）——三档中唯一全部 PASS 项都处于带中央的档位。
2. **c-陡峭出局**：Lv 终值中位贴 Lv14 下限（v2/v3 两轮复现），端点扰动或真机偏差任意方向即破带；且 offers 13 / 首精英前 8 裕度同为三档最薄。
3. **c-温和留作降档预案**：offers 16.5 贴上沿 18（真机 XP 获取若偏高风险更大），不推荐首选；若真机回填后 c-标准破带（offers <12 或 Lv <14），按 S-3 单轮冻结纪律切 c-温和复测。
4. 预期 offers 落差收敛 1.2~1.4×（GDD §5.2 表），与「校准报告 1.8~2.8×」的修正方向一致。

---

## ③ budget 分段五端点冻结建议

**冻结值：端点中值 `[0,1.0] / [60,1.1] / [120,1.6] / [240,2.4] / [360,3.4]`，正弦波幅 0.25、周期 60s**（gdd-spawner-v2 §③-1 分段线性插值 + 正弦波）。

依据（1680 局参数面）：
1. **鲁棒性**：六变体（legacy 基线 + 端点下/中/上沿 + S1 压平两沿）全区间扰动下，约束 2/3/4 判定零翻转（offers 15~15.5 / Lv16~16.5 / 首级 7.76~8.12s）——端点锚区间可整块冻结，无需逐点优化。
2. **切换影响可控**（pw-mid vs legacy `budget(t)` 对照，c-标准档）：
   - XP 约束指标零扰动（offers 15=15 / Lv16=16 / 首级 8.0≈8.0s）——切运行时不动 XP 节奏；
   - 前段生成压力 60s 均值 1.44 → 1.1（**−24%**，H2 压平兑现）；死亡中位 45.5s → 77.6s（模型口径）——**方向支持 MD-1**（死亡谷后移，距 90~150s 目标带仍早，归因 1D 悲观 + 无升级消费）。
3. **与 GDD 对照**：中位 ≤30s 判据沙盘 47.8~50.0s（c-标准档六变体）、最坏间隔 69.6~73.4s > 45s 观测线——同 §② 约束 5 归因（模型保守下界）；联调首选项 = S3 终值斜率 3.4~3.8（pw-high 实测改善有限 ~4%，真机 DPS 成长才是主修正项）。
4. **分工红线自查**：budget 管「量」、scale(t) 管「质」——本批端点扰动未与缩放终值同时段双陡升（120/240s 端点区间锚无斜率动作），符合 GDD §5.3。

---

## ④ MD-1~5 判据对照终版

| 判据 | 本轮角色 | 结论 |
|---|---|---|
| MD-1 首死中位 90~150s | c 案 + piecewise + panelScale 全开：死亡中位 71~78s（n=1200/档） | **方向 PASS**（legacy 45s → 78s 后移 +69%）；绝对值需真机 deathsAtSeconds 终检 |
| MD-2 全开 ≤80% 且 ≤+25pp | 通关率沙盘 2~7%（近战系 1D 悲观拖底） | **不可判**（DPS 侧 ×3.0 输入已就绪，通关率需真机） |
| MD-3 s1 窗口不改死亡分布 | 校准批 <10% | **方向支持**（维持，不重跑） |
| MD-4 Boss 60~85s | 沙盘 Boss 无 scale/DPS 无成长 | **不可用** → 真机 bossFightSeconds |
| MD-5 濒死事件 | RunMetrics 无 hpCurve | **未测** → 真机遥测 |

---

## ⑤ 真机回填清单（主理人验收采集项）

| # | 采集项 | 用途 | 回填动作 |
|---|---|---|---|
| 1 | deathsAtSeconds 直方图（分角色/地图） | MD-1 终检 + 死亡档校准 | SC-5 绕行系数 1.5 回填 `sim-config.ts retreatSpeedMult` |
| 2 | bossFightSeconds | MD-4 定谳 | 登记对照，无回填 |
| 3 | 首级时点 + offersPerRun + xpGainedPerRun | 约束 1/3/4 沙盘偏置修正（沙盘首级 8.7s vs 真机预期 18~22s） | 真机值入 sim 标定表 |
| 4 | kills 曲线（0~360s 分 30s 桶） | **1D 击杀效率标定（最大不确定项）** | 回填后复跑 batch-xp-cases |
| 5 | 升级间隔分布（中位/最坏） | 约束 5 v1.1 判据定谳 + S3 斜率联调决策 | 若真机最坏 >45s → 上调 S3 终值 3.4~3.8（budget 域，不动 XP） |
| 6 | 缩放宽容触发率（>15% 监控）/ 方阵在场死亡分布 / 方阵局内次数 | GDD §⑦ 遥测 + 方阵激进锚验证 | 触发率超限走修订流程，不就地改参 |

**回填后复跑计划**：SC-5 系数 + kills 效率标定回填 → 复跑 `batch-xp-cases --seeds 150`（约 3720 局）→ 确认约束 1/5 判定与 c-标准档带内性 → 若破带按 S-3 单轮纪律切 c-温和复测。方阵占比 25% 挤压炮灰基本盘时按 GDD §⑥-5 降掷点概率（0.9→0.7），不挤 budget 端点。

---

## ⑥ 批次 G 实施清单（冻结批准后执行，本批未动任何 src/ 文件）

| # | 改动点 | 内容 |
|---|---|---|
| G1 | `src/config/balance/spawner.ts` | 新增冻结常量：`BUDGET_PIECEWISE_ENDPOINTS = [[0,1.0],[60,1.1],[120,1.6],[240,2.4],[360,3.4]]` + `BUDGET_WAVE = { amplitude: 0.25, period: 60 }` + 端点锚区间断言表（自 `tools/sim/xp-cases.ts` BUDGET_ANCHOR_RANGES 迁移） |
| G2 | `src/spawner/enemy-spawner.ts:167` | `budget(this.t) * dt` → `budgetPiecewise(this.t, ENDPOINTS, AMP, PERIOD)`；**同步 `:274` `reportGroupBudget(...)` 内的 `budget(this.t)*dt`**（方阵预扣会计同口径，否则占比断言失真）；`budgetMean` 保留文档口径 |
| G3 | `src/config/balance/xp.ts` | 新增档位参数化结构 `XP_CASE = { id:'c-standard', needFirst:4, earlyStep:3, lateStep:6, enemyXpMult:0.55, hpCaseLink:1.125 }`（三档可切换，GDD §⑧-3） |
| G4 | `src/xp/xp-manager.ts:31` | `needXp()` 改两段式消费 XP_CASE（公式与 `tools/sim/xp-cases.ts needXpCase` 逐值一致：need(1)=4；2~4 级增量 3；5 级起增量 6）+ 双实现对齐单测 |
| G5 | 敌 XP 下调 | 生成侧 `enemy.xp = cfg.xp × XP_CASE.enemyXpMult`（`spawnOneById` 现有 `enemy.xp = cfg.xp` 路径；精英/Boss 独立曲线不吃） |
| G6 | hpCaseLink 接线 | `EnemySpawner.caseHpLink`（`enemy-spawner.ts:125` 字段位已就绪）← 场景初始化赋 `XP_CASE.hpCaseLink`；面板链 `applyPanelScale`（`panel-scale.ts:84`）已支持 caseLink，**链路无需改** |
| G7 | 断言/测试 | 三约束断言（首级 18~22s / offers 12~18 / Lv14~20，注意：真机口径判据，沙盘偏置已在 §② 声明）+ budget 五端点独立断言 + 方阵预扣占比 ≤25% 断言 + MN-13 动态难度负向断言 |
| G8 | 方阵锚核对 | `RUNS_PER_GAME_ANCHOR = [3,4]` 已就位（formations.ts:269）；占比 25% 掷点与 S1 末 100s 入场时序随 C 批方阵运行时验收，不在 G 批改参 |

**执行纪律**：G1~G7 一个 PR；质量门 typecheck/test/build；切换后跑 `tools/sim` 回归批（batch-xp-cases ≥720 局）确认沙盘指标与冻结报告一致。

---

## ⑦ 局限声明（沿用 README-sim 分级）

- **可信（方向性）**：三档约束梯度与排序；offers 落差收敛方向；budget 端点鲁棒性；piecewise 切换的前段减压方向；c-标准档带中央性。
- **需真机复测**：首级时点绝对值（约束 1）；升级间隔绝对值（约束 5）；死亡时点绝对值（近战三系不可用）；绕行系数 1.5；击杀效率曲线。
- **不可用**：Boss 战时长（MD-4）；MD-5；圣物占比；树节奏（局外循环）；方阵时序锚。

## ⑧ 工具链变更记录

- 新增 `tools/sim/batch-freeze.ts`（budget 端点参数面跑批；只读 src，输出至 output/）。**未改 `src/` 任何文件、未改 GDD、未回填任何 balance 数值**（XP_C_CASES/BUDGET_PIECEWISE_ENDPOINTS 维持模拟复测锚状态，等待主理人拍板后按 §⑥ 迁入）。
