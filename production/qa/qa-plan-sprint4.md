# 《血月守夜》Sprint 4（E4）QA 计划 + M2 性能验收标准

> 版本 v0.1 · 作者：严守真（质量保障与测试）· Sprint 4 · 与 E4 工程实现并行
> 上游依据：`production/qa/qa-plan-sprint3.md`（格式/分级/出口沿用）、`tests/test-framework.md`（三层模型/bench/M2 闸门）、`production/epics/epics.md` §4（E4 五 Story/DoD/M1-M2）、`design/ux/ux-spec.md` §2/§4、`design/art-bible/art-bible.md` §3/§4、`design/gdd/enemies.md`（Boss 面板）、`design/gdd/design-review-e3.md`（E4 交接项）、`design/concepts/concept.md` §9
> 工程抽查：`src/ui/hud.ts`、`results-overlay.ts`、`src/stats/run-stats.ts`、`tests/bench/perf-assert.ts`、`bench-run.ts`；基线实测 **27 文件 223 单测全绿**（`npm test` 复跑通过）
> 性质：QA 计划先行、执行随工程完成；质量门为建议性（advisory），M2 放行由主理人拍板。

## 1. 测试范围与目标

范围：Epic E4「收束与性能达标」5 Story，对应 S10 + Boss + 性能预算。里程碑关系：**M1 可玩 = E4-S3 达成**（SMK/FUNC 覆盖 E4-S1~S3）；**M2 Demo 验收 = E4-S5 达成**（在 M1 基础上叠加 E4-S4 结算 + §5 真机性能闸门，为进入 Phase 6 Playtest 的前置）。

| Story | 单测（Vitest） | 冒烟 | 手动功能 | 里程碑 |
|---|---|---|---|---|
| E4-S1 HUD | hud-events/hud-state（归约器刷新） | SMK-E4-01 | FUNC-E4-01/06 | M1 前置 |
| E4-S2 Boss | boss（面板/0.5s 霸体/血条宽） | SMK-E4-02 | FUNC-E4-02/03 | M1 前置 |
| E4-S3 20:00 收束 | closure/spawner（1200±0.1s/清场/停生成） | SMK-E4-02 | FUNC-E4-02 | **M1 达成** |
| E4-S4 结算页 | run-stats（聚合一致性） | SMK-E4-03 | FUNC-E4-04/05/07/08 | M2 前置 |
| E4-S5 性能基准 | perf-assert（阈值快照） | bench 无头 | §5 真机流程 | **M2 达成** |

## 2. 数值断言清单（自动化 · Vitest）

**Boss「血月尊者」**（`tests/unit/enemies/boss.test.ts` 已落地）：

| 断言 | 期望值 |
|---|---|
| 面板全表（E8-1） | hp 6000 / speed 28 / damage 30 / interval 2.0 / radius 40 / xp 100 |
| 0.5s 霸体 | GRACE_SECONDS=0.5；isBossInGrace 期内 true、期满 false（不含临界 1000.5） |
| 血条宽度 | 桌面 60% / 移动 50%（HP_BAR_WIDTH_DESKTOP/MOBILE） |

**20:00 收束**（E4-S3，RV-C8）：秒制累加器 **BOSS_TIME=1200，触发 ±0.1s**；清场 = 普通敌池批量 deactivate 无残余；Boss 战期间 budget 恒 0。

**终局判定**（E4-S3/S4）：击杀 Boss → `boss:defeated` → victory=true → 标题「血月退散·守夜完成」；HP≤0 → victory=false → 「守夜失败」+ 子弹/环绕球清空、生成器停止。

**结算数据一致性**（`run-stats.test.ts` 已落地）：RunStats.finish → RunResult 的 survivalSeconds（保留 1 位小数）/kills/level/build（按选择顺序）与记录逐一相等。

**纠结埋点判定**（FUNC-E3-06 延续）：dwell ≥3s（DWELL_SECONDS=3）或三张全机制型（代理定义）→ 计数；单局 hesitationCount **≥3** 为设计判据；Boss 战 bossFightSeconds ∈ **[60,90]**（GAME 常量 60/90）。

## 3. 冒烟测试（E4 · ?smoke=1 扩展）

判定规则：SMK-E4 全 PASS 才进功能测试；任一 FAIL 即"未达 QA"。通用前置：SMK-E3 全绿。

| 编号 | 用例 | 步骤 | 预期结果（机械判定） |
|---|---|---|---|
| SMK-E4-01 | HUD 元素出现 | `?smoke=1`，60 帧后读 DOM | `.bmv-hud-lv` 文本「LV 1」；xp/hp/weapons/boss-bar 节点存在 |
| SMK-E4-02 | Boss 出场+收束 | 时缩 20× 覆盖 20:00 | `__SMOKE_RESULT__.bossSpawned=true`；顶部血条 visible；清场后普通敌数=0 |
| SMK-E4-03 | 结算页渲染 | 触发终局 | `.bmv-results-panel` 可见；标题/统计/build 渲染；数字终值=RunResult |
| SMK-E4-04 | Playwright 62s 无错 | 全程收集 console/pageerror | 62s 覆盖 Boss 出场，`errors=[]`（0 console error） |

## 4. 功能测试用例表（FUNC-E4-01~08）

通用前置：SMK-E4 全 PASS；桌面 Chrome 1920×1080 / 移动 DevTools 390×844。预期均为具体值。

| 编号 | Story | 前置 | 步骤 | 预期结果 | 优先级 |
|---|---|---|---|---|---|
| FUNC-E4-01 | E4-S1 | 开局 RUNNING | 击杀至升级；受击一次 | LV 文本 1→2；XP 条宽 0%→100%；受击后 HP 数值下降且条宽同步（红 #FF3B30） | P0 |
| FUNC-E4-02 | E4-S2/S3 | 非最优 build（飞弹+环） | 打满 20:00 → Boss 出场 → 击杀 | Boss 战时长 ∈ [60,90]s（击杀时刻 ≈1200+60~90s） | P0 |
| FUNC-E4-03 | E4-S2 | Boss 出场 | 出场 0.5s 内读 HP | 0~0.5s 霸体不承伤（HP 不减）；期满 0.5s 后可承伤 | P0 |
| FUNC-E4-04 | E4-S4 | 进入结算 | 观察数字滚动 | 0→目标 0.8s 缓出递增（cubic ease-out）；终值=RunResult 精确值 | P1 |
| FUNC-E4-05 | E4-S4 | 一局完成后 | 点「再来一局」→ 再打一局 | HP 回 100/100、LV 回 1、XP 条 0%、场上无旧怪/旧子弹/旧宝石；多次 restart 无 console.error（无泄漏） | P0 |
| FUNC-E4-06 | E4-S1 | 移动 UA 390×844 | 观察 HUD 与拇指区 | 全部 HUD 位于 y≤896 顶部区；暂停键 (652,24) 44×44 物理；左下半区无 HUD 遮挡摇杆 | P1 |
| FUNC-E4-07 | E4-S4 | 死亡终局 | 故意送死进结算 | 标题「守夜失败」；统计=RunStats 记录；子弹/环绕球清空 | P0 |
| FUNC-E4-08 | E4-S4 | Boss 击杀终局 | 结算页 | 标题「血月退散·守夜完成」；build 回顾含本局升级清单、顺序一致 | P1 |

## 5. M2 性能验收标准（本计划重点）

**双端阈值表**（对齐 `perf-assert.ts`）：

| 指标 | 桌面（集显 Chrome） | 移动中端（iPhone 12 / 小米 11） |
|---|---|---|
| 平均 fps | ≥58 | ≥30（目标 60） |
| 最低 fps | ≥50 | 不断言（minFps=0 跳过） |
| 同屏实体峰值 | ≤400 | ≤250 |
| 同屏子弹 | ≤8 | ≤8 |
| draw call 估算 | ≤8 | ≤8 |

**验收流程（三闸）**：
1. **headless 逻辑基准** `npm run bench`：桌面+移动各 20min 峰值模拟，断言峰值/子弹/draw call（环境无关，CI 可跑）。
2. **真机桌面 Chrome** `npm run bench:browser`（= bench-run `--browser --strict-fps`）：vite preview + Playwright chromium `/?bench=1`，60s 峰值（20× 时缩）→ `__BENCH_RESULT__`，严格模式 fps 未达标退出码非 0 —— **M2 最终闸门**。
3. **移动真机**：中端 Android/iPhone 挂 fps 浮层，30s 峰值观察 avgFps≥30；双端各确认一次。

**FAIL 处理优先级（先调描边纪律 C1 而非砍实体）**：① 查描边/draw call——移动端确认 `outlineEnabled=false`，Boss/精英描边超预算先降宽度或关闭（RV-C1）；② 查特效削减表——粒子 100/震动关/边缘红光关逐项核对；③ 最后才评估实体预算（400/250 为 GDD 定案，砍实体属数值变更须文策渊+主理人拍板）；④ headless 与真机冲突以真机为准（swiftshader 仅参考）。

## 6. 双端矩阵增量（E4）

| 场景 | 桌面 1920×1080 | 移动 720×1280 |
|---|---|---|
| HUD 布局 | 贴边：LV(24,16)20px/XP(24,48)240×8/HP(24,1042)240×14/武器槽 3×48 右上 | 上移让拇指区：全在 y≤896；LV(24,24)/XP(24,56)220×8/HP(24,80)220×14 数值内嵌 20px/武器槽 3×44(512,24) |
| 暂停键 | 无按钮（Esc/P；开局 0~5s 提示） | 右上 (652,24) **44×44 物理**（≥44px 达标） |
| Boss 血条 | 顶部 屏宽 60% | 顶部 屏宽 50% |
| 结算页 | 面板 640×760；统计 28px；Build 滚动 240px；按钮 320×56+160×44 | 面板 92vw(≈662px)；统计竖排 22px；Build max-height 220px；按钮全宽 64/48px（热区>44px） |
| 触控热区 | 鼠标 ≥32×32；Esc/数字键 | 暂停键/按钮/卡片 ≥44×44 物理 |

## 7. 出口标准（E4 DoD + M2 闸门 + concept §9）

全部满足才进入 Phase 6 Playtest（主理人最终放行）：
1. 20:00 Boss 准时出场+清场+停生成；击杀即终局、无残余怪（DoD-1）——§2+§3+§4。
2. 结算页存活/击杀/等级/build 展示；「再来一局」干净重置（DoD-2）——FUNC-E4-04/05/07/08。
3. 性能基准达标：桌面 60fps 不掉帧、移动 30fps+；峰值≤400/250；draw call≤8（DoD-3 / RV 放行 4 / C9-性能）——§5 三闸全 PASS。
4. M1 达成（E4-S3 全绿）→ M2 达成（E4-S5 真机复核通过）——里程碑闸门，未达不进入 P1 表现层。
5. concept §9 数据源就绪：中位存活≥10min / 重开≥50% / 纠结≥3 由 RunResult 埋点提供——§2 结算一致性。
6. 本计划 §2~§6 全绿：无未关闭 P0/P1 Bug；真机校准项执行。

**设计评审项（文策渊，实现后按实测评审）**：

| 编号 | 评审项 | 判据（本计划实测点） | 超阈值调参预案 |
|---|---|---|---|
| Lv47 | 升级频率预警（design-review-e3 §1） | 20min 真机等级中位；reachedLevel47 埋点；后期升级间隔 <45s | 厚血 15→10（首选，不动前期）或 need 3→3.5 |
| 纠结代理 | 「全机制型=强度接近」代理定义（run-stats） | 真机 playtest 纠结≥3/局 + 主观问卷交叉 | 代理不匹配 → 调 dwell 阈值或加强度差计算 |
| 厚血 30s | 保底 40→30s 回调（TASK-18 已授权） | 5min 厚血存在感/堆积 ≤2；30s 仍过稀 → 记 CONCERNS | 记录 CONCERNS 供设计裁决，不擅自再调 |
| Boss 战 | 60~90s 判据（交接项 4） | FUNC-E4-02 非最优 build 实测时长 | >90s → 降 5000 或保底武器；<60s（Lv47 倍率 2.84 偏高）→ 观察 |

## 附 A. 测试代码骨架（示意，非实现）

```ts
// tests/unit/enemies/boss.test.ts（已落地，E8-1 全表锚定）
it('血月尊者 6000/28/30/2.0/40/100', () => {
  expect(ENEMIES.boss).toEqual({ hp: 6000, speed: 28, damage: 30, attackInterval: 2.0, radius: 40, xp: 100 });
});
```

```ts
// tests/smoke/smoke.e2e.spec.ts（?smoke=1 扩展，SMK-E4-01~04）
expect(result.hudLvText).toBe('LV 1');        // HUD 元素出现
expect(result.bossSpawned).toBe(true);         // Boss 出场 + 清场
expect(result.resultsPanelVisible).toBe(true); // 结算页渲染
expect(errors).toEqual([]);                    // 62s 全程 0 console error
```
