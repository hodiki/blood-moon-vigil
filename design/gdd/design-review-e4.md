# E4 设计评审（Sprint 4 收尾 · Phase 6 开工前置）

> 版本 v0.1 · 作者：文策渊（设计策略师）· Sprint 4 质量门 · 依据：design-review-e3（E4 交接 4 条）、qa-plan-sprint4 §7 设计评审项、control-manifest §9.1、concept §9、epics E4 Story/DoD、工程抽查（run-stats / hud / results-overlay / boss + 对应单测 + perf-assert）
> 性质：实现后静态评审；调参预案仅作建议，是否派活由主理人拍板。不修改任何代码与 GDD 数值。
> 前置结论：E3 交接 4 项（HUD 完整化 / 纠结+升级时间戳埋点 / 结算页 / Boss 战判据）已在工程全部落地，单测覆盖到位。

## 1. 逐项设计评审

| 评审项 | 当前状态（实现后评估） | 判定 | 真机确认项 | 调参预案 |
|---|---|---|---|---|
| Lv47 预警 | run-stats 埋点就绪：upgradeTimestamps / firstLevelUpSeconds / lastUpgradeIntervalSeconds / reachedLevel47，单测绿；真机 20min 等级中位未测，0.45 经验系数仍为标定值 | CONCERNS（中） | 20min 真机等级中位；reachedLevel47 触发率；后期升级间隔 <45s | 厚血 15→10（首选，不动前期）或 need 3→3.5（备选） |
| 纠结代理 | optionsStrengthClose="三张全机制型"落地，边界单测正确（全机制 true / 混合 false / 空单 false）；全机制概率约 38%（未加权）且易满足 ≥3/局，代理偏宽 | CONCERNS（中） | Playtest 埋点 hesitationCount 分布 + 主观问卷「本局几次都想选」交叉 | 代理不匹配 → 调 dwell 阈值 3s→2/4s，或加强度差计算（如三选一强度差 <15% 才记纠结） |
| 厚血 30s | TANK_GUARANTEE_EVERY_SECONDS=30 落地（TASK-18 授权）；模拟同种子 5min 节点 ≤2 达标；真机"未发现厚血"是否缓解待确认 | CONCERNS（低） | 5min 厚血存在感 / 堆积 ≤2（FUNC-E3-07 延续） | 30s 仍过稀 → 记 CONCERNS 供裁决：保底顶替随机（首选）或权重 3%→1%（主理人批准） |
| Boss 战 | bossFightSeconds / bossDpsEstimate / bossInTargetWindow [60,90] 全落地；单测边界 59/60/90/91 正确；完整战时长未实测 | CONCERNS（中） | FUNC-E4-02 非最优 build 实测时长 ∈ [60,90] | >90s → 降 5000 或保底武器抽取；<60s → 观察（真机 Lv47 倍率 2.84 高于模型 Lv30 的 2.16，时长会偏短，以实测为准） |

4 项均为"埋点/判据就绪、真机待证"型 CONCERNS：无 FAIL、无硬伤。

## 2. 垂直切片总体设计评审

**四支柱对齐度**：

| 支柱 | 对齐度 | 依据与风险 |
|---|---|---|
| 走位唯一操作 | 高 | 输入层仅移动向量（CM §1），无瞄准/主动技能；HUD/结算全 DOM 0 draw call。风险：移动摇杆真机偏移（CM C-1 待验证） |
| build 决策唯一爽点 | 高 | 机制型 75% ≥50%；纠结埋点就绪。风险：纠结代理偏宽 → 判据虚高，掩盖真实决策质量 |
| 压力曲线 | 中高 | 20:00 收束结构达成（准时/清场/停生成）；厚血 40→30s 已调。风险：厚血存在感与 Lv47 越线互相作用 |
| 局局不同 | 中 | 随机化机制齐备、build 可记录；"两局不重复 / 3 局仍新鲜"无自动化验证，须 Playtest 实证 |

**成功标准可达性**：中位存活≥10min / 纠结≥3/局 / 性能——数据源就绪待真机；3min 爽≥80%——concept §9 本就是问卷口径，无自动埋点，Playtest 问卷必含；**重开率≥50%——发现数据源缺口**：RunResult 仅单局聚合，无 session 级「再来一局」点击计数，qa-plan §7.5"由 RunResult 埋点提供"不成立，Playtest 前须补埋点（或问卷/观察替代）。

**进入 Playtest 前最需验证的 3 件事**：
1. **纠结代理有效性**：埋点 + 主观问卷交叉，防"≥3/局"虚高掩盖真实纠结不足；
2. **真机性能三闸**：桌面 ≥58/50、移动 ≥30（M2 最终闸门；headless SwiftShader 29.4 为软件渲染，不代表真机 GPU）；
3. **20min 真机等级曲线**：Lv47 是否成立 + 后期升级间隔，直接决定厚血调参与 Boss 时长判据解读。

## 3. 范围检查

E4 五 Story 全在 epics §4 内；厚血 30s 回调为 TASK-18 预授权数值调参，非范围外。两处轻微标注（不阻塞）：①结算页「返回启动」按钮不在 CM §4 / epics E4-S4 验收中，属低风险 UI 便利项，建议保留并补入 CM；②E3 遗留 INITIAL_DPS_REFERENCE 注释口径（开局 10 而非 FULL_KIT 33.5）如未改，随下次 GDD 修订处理。**范围检查通过，无内容膨胀。**

## 4. 总判定与 Phase 6 交接

**总判定：CONCERNS（有条件放行）**——无 FAIL、无范围外玩法、无代码修改需求；允许进入 Phase 6 打磨与首轮 Playtest。

- **Playtest 前必须解决**：①真机性能三闸（M2 前置，未达标不算 M2）；②重开率数据源缺口（session 级重开埋点或问卷替代，否则留存判据拿不到数）；③确保首轮 Playtest 采集纠结代理与 Lv47 等级数据（数据可解读）。
- **可豁免进 Phase 6**：纠结代理校准、厚血存在感、Boss 完整战时长（本就是 Playtest 目的）；HUD 物理屏缩放（720×1280→390px ≈0.54，字号 ~11px / 暂停键 ~24px 物理，属打磨范畴）；draw call 真实批次（TexturePacker 正式图集接入后复核）。

**给 Phase 6 的设计交接项**：
1. **Playtest 问卷设计**：3min 自评爽（1–5 分 + 自发言语）；「本局几次都想选」与埋点交叉验代理；厚血/精英存在感；30s 内"只用移动"确认；重开意愿言语捕捉；移动端 HUD 可读性（~11px 字号）与暂停键热区反馈。
2. **美术方向确认**：程序贴图 → P1 表现层前定稿 art-bible 视觉锚点（暗红血月 / 剪影敌潮 / 霓虹哥特描边 / 宝石自发光）；接入 TexturePacker 正式图集并复核真实 draw call 批次。
3. **音频方向确认**：心跳低音 BGM（随压力曲线加速）+ 击杀闷响 / 宝石叮声 SFX（concept §7），阮和鸣开工前提。
