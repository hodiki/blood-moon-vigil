# 批次 G 实施报告（NV-BATCH-G）—— XP c 案冻结切换 + budgetPiecewise 运行时实装

> 版本 v1.0 · 日期 2026-09-02 · 执行 程基岩（engineering-lead，batch-g）
> 上游：sim-freeze-recommendation.md §⑥ 实施清单 G1~G8（主理人拍板：SC-2 冻结 c-标准 + budget 五端点块整块冻结）+ 项目审查结论 v0.8 §八/§十。
> 基线：c9e18c9（工作区干净）→ 收官 HEAD 见文末提交列表。质量门：typecheck 0 / **1356/1356 测试**（1334 存量 + 22 新增冻结断言）/ build ✔。

---

## ① G1~G8 逐项落点

| # | 落点 | 内容 | 状态 |
|---|---|---|---|
| G1 | `src/config/balance/spawner.ts:41~66` | `BUDGET_PIECEWISE_ENDPOINTS = [[0,1.0],[60,1.1],[120,1.6],[240,2.4],[360,3.4]]` + `BUDGET_WAVE = {amplitude:0.25, period:60}` + `BUDGET_ANCHOR_RANGES` 端点锚区间表（自 tools/sim/xp-cases.ts 迁移）；标注「模拟冻结 2026-09-02（5400 局，sim-freeze-recommendation）」 | ✅ |
| G2 | `src/spawner/enemy-spawner.ts:170~172`（生成侧）+ `:278~280`（reportGroupBudget 方阵预扣会计） | `budget(this.t)*dt` → `budgetPiecewise(this.t, BUDGET_PIECEWISE_ENDPOINTS, BUDGET_WAVE.amplitude, BUDGET_WAVE.period)*dt`；**两处同口径**（防方阵占比预算错账）；旧 `budget()` 按 EG-2 归档为 `budgetLegacy` + `@deprecated`（spawner.ts:50）；`budgetMean` 保留文档口径 | ✅ |
| G3 | `src/config/balance/xp.ts:19~31` | `XP_CASE = { id:'c-standard', needFirst:4, earlyStep:3, lateStep:6, enemyXpMult:0.55, hpCaseLink:1.125 }`（SC-2 终裁冻结）；c-温和/c-陡峭注释化预案 + S-3 降档切换判据（§②-3：offers <12 或 Lv <14 破带 → 切 c-温和复测）；旧 `XP` 表 `@deprecated` 归档（BASE_NEED 5 / NEED_STEP 3 保持 legacy 锚值） | ✅ |
| G4 | `src/xp/xp-manager.ts:31~43` | `needXp()` 改两段式：need(1)=4；第 2~4 级增量 +3；第 5 级起 +6。公式与 `tools/sim/xp-cases.ts needXpCase` **同构逐值一致**（G7 断言 1~99 级全量对表）；c-标准口径 Lv30 累计 2309（旧 1363 归档） | ✅ |
| G5 | `src/spawner/enemy-spawner.ts:586~590`（spawnOneById） | 敌 XP 生成侧**单源乘区** `enemy.xp = cfg.xp * XP_CASE.enemyXpMult`（×0.55，与沙盘 sim-run `cfg.xp×enemyXpMult` 同值不取整）；精英经本口同吃 XP 下调（沙盘同口径）、Boss 走 spawnByBossConfig 独立曲线不吃；词缀 ×1.2 在其后再乘——**仅此一处乘区，无双重相乘** | ✅ |
| G6 | `src/scenes/PlayScene.ts:305~307` | `spawner.caseHpLink = XP_CASE.hpCaseLink`（HP ×1.125）——spawnOneById → applyPanelScale 链 caseLink（panel-scale.ts:84~93）已就绪，链路零改动；仅基础面板吃，精英/Boss 独立曲线不吃 | ✅ |
| G7 | `tests/unit/config/batch-g-freeze.test.ts`（新增，22 断言） | 三硬约束带记录（首级 18~22s **真机口径判据**，沙盘 8.7s 为模型偏置下界注记 / 6min offers 12~18 冻结中位 15 带中央 / Lv14~20 中位 16 带中央）+ budget 五端点形状与锚区间独立断言 + 运行时常量与沙盘逐值一致断言 + 方阵预扣占比 ≤25% 会计断言 + MN-13 动态难度负向断言（needXp 纯函数无玩家状态反馈 / mercy 只减不增） | ✅ |
| G8 | `src/config/balance/formations.ts:269`（核对） | `RUNS_PER_GAME_ANCHOR = [3,4]` 已就位（P2-6 已改锚）；掷点节奏 ROLL_INTERVAL [60,90] 为局时确定性规则，G2 只改「每秒点数」不改掷点/预约/落地时序——**断言锁定零时序冲突**（batch-g-freeze.test.ts「时序独立性」）；时序锚真机 `?qa=1` 验证为遗留采集项（见 §⑤ 残留） | ✅ |

## ② 断言更新映射表（锁现值 → c 案值）

| 测试 | 断言 | 旧值（锁现值） | 新值（c 案值） |
|---|---|---|---|
| xp-manager.test | needXp(1)/(2)/(3)/(30) | 5 / 8 / 11 / 92 | 4 / 7 / 10 / 169 |
| xp-manager.test | cumulativeXpToReach(30)/(31) | 1363 / 1455 | 2309 / 2478 |
| xp-manager.test | addXp 跨阈值升级入参 | addXp(5) | addXp(4)（need(1)=4） |
| xp-manager.test | 大额宝石连升锚 | addXp(1363) → Lv30 | addXp(2309) → Lv30（ups=29 不变） |
| hud-events.test | needXp(1) / xpFillFraction | 5 · 3/5 | 4 · 3/4 |
| spawner.test | budget(t) 曲线组 | `budget` | 改挂 `budgetLegacy`（EG-2 归档锚，数值不变：1.2/1.92/2.64） |
| c3-tank / xp-curve.test | 20min 模拟生成曲线 | `budget(t)` | `budgetLegacy(t)`（legacy 标定口径维持） |
| bench-sim.ts | 堆积上限预算曲线 | `budget(t)` | `budgetPiecewise(t)`（随运行时切换，最坏堆积口径更新） |
| sim-run.ts | legacy 基线回退 | `budget(t)` | `budgetLegacy(t)`（沙盘基线口径归档） |
| 新增 batch-g-freeze.test | 全部 | — | 22 断言（见 §① G7） |

既有断言**零删除**：全部按新口径更新或在归档锚上保留；xp-curve「可达 Lv30+」在 c 案两段式下自然满足（cum(30)=2309 < 有效经验 ~3000）。

## ③ 沙盘一致性验证（切换后复测 · 三项对表）

复测命令：`npx vite-node tools/sim/batch-xp-cases.ts --seeds 150`（与冻结轮同种子基 20260831，3720 局；输出 `tools/sim/output/batch-g-verify-stdout.txt`）。
一致性链路：**运行时 needXp ≡ 沙盘 needXpCase（1~99 级逐值断言）** × **运行时五端点/波参数 ≡ 沙盘 BUDGET_PIECEWISE_ENDPOINTS/WAVE（逐值断言）** → 沙盘复测中位值应与冻结报告逐值一致。

### ③-1 c-标准档三项对表（3720 局复测 vs 冻结报告）

| 指标 | 冻结报告（651eab8 基线） | 本批复测（6d93838 HEAD） | 判定 |
|---|---|---|---|
| 6min offers 中位（带 12~18） | 15 | **15** | ✅ 逐值一致 |
| 等级终值中位（带 Lv14~20） | Lv16 | **Lv16** | ✅ 逐值一致 |
| 首精英前 offers 中位 | 9.5 | **9.5** | ✅ 逐值一致 |
| 中后段最长升级间隔中位 | 74.8s | 71.87s | △ −3.9%（轮次间偏差带 ≤5% 内，见 ③-2 归因） |
| 首级时点（沙盘偏置项，真机 18~22s 判据） | 8.7s | 7.97s | △ 偏置方向不变（见 ③-2） |
| 参考：死亡中位 / 三档梯度 | 76.38s / 8.7→8.7→9.8 | 76.82s / 7.97→7.97→9.48 | 梯度方向与排序完全一致 |

硬约束判定模式与冻结报告逐项相同（约束 2/3/4 PASS 带内、约束 1/5 沙盘偏置 FAIL 转真机）——**切换未改变任何带内性结论**。

### ③-2 偏差归因（A/B 实证：批次 G 零沙盘漂移）

- **A/B 实验**：同参数小规模批（`--seeds 5`，240 局 ×3 档）分别在 `c9e18c9`（批次 G 前）与 `6d93838`（批次 G 后 HEAD）运行，输出**逐字节一致**（唯一差异为输出路径行）。→ 批次 G 的 src 改动（budgetLegacy 改名 / XP_CASE 新增 / needXp 两段式 / 生成侧乘区 / caseHpLink 接线）对沙盘结算路径**零影响**（沙盘消费 tools 常量 + needXpCase；budgetPiecewise 纯函数体未动）。
- **与冻结报告偏差的来源**：冻结跑批基线为 651eab8；651eab8→c9e18c9 之间的 P2-4/P2-7 提交改动了沙盘消费面（`exclusive-math.ts`/`resonance-math.ts` 的 CC 施加链路切 `applyStatusWithImmuneFeedback`、`key_bone` 语义调整等），令专武 DPS 微变 → 首级/间隔两项连续量小幅漂移；offers/等级两项整数中位不受影响（逐值一致）。偏差幅度在冻结报告自述的轮次间一致性带内（「与 v2 复测逐项一致，偏差 ≤5%」）。
- **一致性链路（切换正确性本体）**：运行时 `needXp ≡ 沙盘 needXpCase`（1~99 级逐值断言，batch-g-freeze.test.ts）× 运行时五端点/波参数 ≡ 沙盘 BUDGET_PIECEWISE_ENDPOINTS/WAVE（逐值断言）——运行时切换与沙盘预演公式级一致。

## ④ 提交列表（每子项即 commit，尾标 [NV-BATCH-G]）

| commit | 内容 |
|---|---|
| `8d46a6a` | G1+G2：budget 五端点冻结入配置 + 运行时切换 budgetPiecewise（budgetLegacy 归档） |
| `6aafb4b` | G3+G4+G5：XP_CASE c-标准冻结入配置 + needXp 两段式 + 敌 XP 生成侧单源乘区 |
| `c171947` | G6：PlayScene 场景初始化接线 caseHpLink = XP_CASE.hpCaseLink |
| `6d93838` | G7+G8：冻结断言三件套 + 方阵锚核对（22 断言） |

## ⑤ 残留与移交

1. **时序锚真机验证（G8 遗留）**：方阵 S1 末 100s 入场 / 掷点 60~90s / 同屏 ≤2 / 占比 25%——配置与断言已就位，真机 `?qa=1`（groupRollLogger 观测点）随 C 批方阵运行时验收采集，本批不改参。
2. **真机回填清单**（sim-freeze-recommendation §⑤）：首级时点 / offersPerRun / 升级间隔分布 / kills 曲线等 6 项——约束 1/5 定谳与 SC-5 系数回填归后续批次。
3. **S-3 降档预案**：c-温和参数已注释化备于 `src/config/balance/xp.ts`；真机破带（offers <12 或 Lv <14）时单轮冻结切档复测，禁止就地改参。
4. **联调方向备案**：真机最坏升级间隔 >45s → 上调 S3 budget 终值斜率 3.4~3.8（budget 域，XP 冻结期不动）。
5. 构建体积警告（chunk >500 kB）为存量事项，与本批无关。
6. **遗留对表偏差备案**：冻结报告 651eab8 基线的 stdout（freeze-xp-cases-stdout.txt）与 c9e18c9 后工具链存在 P2 批引入的 ≤5% 连续量偏差（③-2 A/B 实证非本批引入）——建议后续复跑冻结轮时以当前工具链重锚基线（或注明基线版本）。
7. 本批复测产物：`tools/sim/output/batch-g-verify-stdout.txt`（3720 局全量）/ `batch-g-verify-report.json`（同轮 JSON 备份）/ `ab-base-stdout.txt`+`ab-head-stdout.txt`（A/B 实证，前者在已清理的验证工作树中，结论记录于本报告）。
