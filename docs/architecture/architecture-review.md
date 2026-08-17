# 《血月守夜》架构评审（Architecture Review）

> 版本：v0.1 · Phase 3（Lean 双质量门之一：架构评审）· 作者：程基岩（工程主程）
> 评审对象：Phase 2 全部 GDD（weapons / enemies / upgrade-pool / spawner）+ 概念文档 + 美术圣经
> 评审基准：Phaser 3.60+（WebGL 优先 / Canvas 兜底）+ Vite + TS；实现约束见 `architecture.md`
> 结论：**PASS with CONCERNS**（核心玩法闭环可实现；6 项关切须在实现期落实，见 §5）

---

## 1. 评审范围与方法

对 Phase 2 设计做**可实现性校验**，分四维：
1. **数值自洽**（GDD 内部数值与 20 分钟模拟是否成立）；
2. **并发与实体量**（400/250 同屏、8 弹道上限是否在 Phaser 3 能力边界内）；
3. **性能预算**（特效 draw call ≤8、移动端 30fps+ 是否可达）；
4. **引擎能力匹配**（设计点是否用到 Phaser 3 缺失/薄弱能力）。

每项给【校验结论】+【风险/备注】。

---

## 2. 数值校验（GDD 内部自洽）

| # | 校验项 | 计算/依据 | 结论 |
|---|---|---|---|
| N1 | 击杀时间对表 | 僵尸 12 HP：初始 DPS 10 → 1.2s/只 ✔；厚血怪 600 HP：5 分钟 DPS ~26 → ~23s ✔；20 分钟 DPS ~124 → ~4.8s ✔（weapons §5 / enemies §5） | ✅ 自洽 |
| N2 | Boss 战时长 | 6000 HP ÷ 124 DPS ≈ 48s；GDD 目标 60–90s（含走位损失）✔ | ✅ 自洽 |
| N3 | 生成预算与击杀率匹配 | 前 3 分钟预算 1.2/s vs DPS 10 击杀 ~0.8/s → 玩家清不过来、存量堆积 → "前 3 分钟压力"设计成立；后期 DPS 124 vs 预算 4.2/s → 割草 ✔（spawner §5） | ✅ 自洽 |
| N4 | 稳态敌人数是否溢出同屏上限 | 僵尸出生环带 600–900px，行进 55px/s ≈ 11–16s；峰值生成 5.88/s × 13s ≈ **76 只存量** ≪ 桌面 400 / 移动 250 ✔（波谷更低） | ✅ 上限充足 |
| N5 | 厚血怪堆积量 | 15–20 分钟 15% 构成 → 0.63 只/s ≈ 每 1.6s 一只（与 spawner §5 一致）；35px/s 追不上玩家 220px/s → 场上堆积 5–8 只 ✔ | ✅ 自洽 |
| N6 | 升级曲线 | need(n)=5+3(n−1)；Lv30 累计 1455 点。GDD 估 20 分钟累计击杀 ≈3000 点 → **可达 Lv30+** ✔ | ✅ 达标（见 C5） |
| N7 | 成型 DPS | Lv30 + 2×伤害强化 ≈ 总倍率 2.5；飞弹 3 枚 + 环绕 6 颗 + 冲击波 ≈ **124 DPS** ✔ | ✅ 自洽 |
| N8 | 升级池机制占比 | 机制改变型 9/12 = 75% ≥ 50%（upgrade-pool §③）✔ | ✅ 达标 |
| N9 | 飞弹追踪可行性 | 追踪 400px/s vs 疾行者 150px/s，飞行寿命 3s（行程 1200px）> 出生环带 900px → 能追上 ✔ | ✅ 可行 |

**数值总评**：GDD 数值模型在 20 分钟模拟下**自洽**，无硬性矛盾；可通关强度（Boss 60–90s 收束）成立。

---

## 3. 并发与实体量校验（Phaser 3 能力边界）

| # | 校验项 | Phaser 3 能力 | 结论 |
|---|---|---|---|
| C1 | 400 敌人 + 8 子弹同屏 | `Arcade.Group` 400 body 物理步进 + 单图集 WebGL 合批（1–2 draw call）→ 现代桌面与中端移动均可行；敌-敌**不设 collider**（enemies §6.2）是控制物理对数的关键 | ✅ 可行 |
| C2 | 碰撞检测对 | 玩家-敌：手动半径距离检测（每帧 400 次距离计算，可忽略）；子弹-敌：`overlap(bullets, enemies)` + `processCallback` 过滤 inactive → Arcade 网格粗筛，3200 对最坏情况可接受 | ✅ 可行 |
| C3 | 粒子 200 上限 | `ParticleEmitter.maxAliveParticles` 原生支持，超限自动回收最早粒子（art-bible §7）✔ | ✅ 可行 |
| C4 | 经验宝石磁吸 | ≤300 宝石 × 每帧距离检查（80–240px 磁吸半径）→ 300 次浮点比较/帧，开销可忽略 | ✅ 可行 |
| C5 | 对象池承载 | `Arcade.Group`（classType + maxSize）即池；`get/killAndHide` 零 GC ✔ | ✅ 可行 |
| C6 | 距离裁剪 | Phaser 相机 cull 默认对 render 有效，但 **update 短路需自实现**（`DistanceCuller` 每 10 帧扫描，视口外 setVisible(false) + 逻辑跳过）——架构 §6 #6 已落实 | ✅ 需实现纪律 |
| C7 | 同帧多敌接触只扣 1 次 | 无敌帧 0.5s（时间戳比较）→ 天然合并（enemies §6.3）✔ | ✅ 简单可靠 |
| C8 | 20:00 Boss 准时 + 清场 | 局时秒制累加器（RUNNING 态）→ 精确触发；清场 = 敌人池批量 deactivate ✔ | ✅ 可行 |

**并发总评**：无并发/实体量超限风险；**最大开销集中在渲染与 FX，而非逻辑**——这正是预算表要防的（见 §4、§5-C1）。

---

## 4. 性能预算校验（≤8 draw call、移动 30fps+）

### 4.1 特效 draw call ≤8 核算（WebGL）

| 渲染项 | 载体 | Draw Call 估算 |
|---|---|---|
| 背景（单图/tilemap） | 1 纹理 | ~1 |
| 玩家 + 400 敌人 + 子弹 + 环绕球 | `characters` 图集（同图集同 blend 合批） | ~1 |
| 粒子（1 emitter）+ 冲击波 Sprite + 摇杆 | `effects` 图集 | ~1–2 |
| FX.Outline（仅玩家/精英/Boss，桌面） | Post FX 每对象 1 pass | 2–4（精英数相关） |
| HUD / 升级卡 / 结算 | **DOM 覆盖层**（ADR-004） | **0** |
| **合计** | | **~5–8 ✔（达上限，靠纪律维持）** |

**关键纪律**（不遵守则爆表）：
1. **普通敌绝不用 FX.Outline**（art-bible §4 普通敌本就靠剪影无描边）——若给 400 敌人加描边 = 400 额外 pass，直接爆预算（见 C1）。
2. 特效素材必须进 `effects` 单图集，禁止零散贴图/运行时模糊/全屏 shader（art-bible §7）。
3. HUD 与 UI 走 DOM，不用 Phaser Text（Text 每对象 1+ draw call）。

### 4.2 移动端 30fps+ 可达性

| 削减项 | 依据 | 实现开关（RuntimeConfig） |
|---|---|---|
| 同屏 250 | concept §8 | `maxEnemies: 250` |
| 粒子 100 | art-bible §7（200 减半） | `maxParticles: 100` |
| 死亡粒子 8 粒 | weapons §7 | `particlePerDeath: 8` |
| 描边关 | concept §8 | `outlineEnabled: false` |
| 屏幕震动关 | art-bible §7 | `screenShake: false` |
| 边缘红光关 | spawner §7 | `edgeWarning: false` |
| 出生环带 500–800 | spawner §7 | `spawnRing: [500,800]` |
| 距离裁剪 | concept §8 | `DistanceCuller` 恒开 |

**结论**：移动端预算**可达**，但依赖 §6 预算表逐项落地与真机基准（architecture.md §6.1）；中端 Android 是最严格基准机。

---

## 5. 技术风险与缓解（CONCERNS）

| # | 风险 | 等级 | 说明 | 缓解措施 |
|---|---|---|---|---|
| C1 | **FX.Outline 描边 draw call 膨胀** | 高 | WebGL 下每个带 Post FX 的对象 = 额外 shader pass；若误给 400 普通敌加描边，draw call 从 ~5 爆到 400+，移动端直接崩帧 | 描边仅玩家/精英/Boss（art-bible 本如此）；`outlineEnabled` 运行时开关；实现期 perf.ts 监控 draw call，超预算即 CI 失败提醒 |
| C2 | **分辨率冲突：1920×1080 vs 移动端最小实体 ≥16px** | 高 | 1920 宽 FIT 缩到 390px 屏 → 实体 32px 变 ~6.5px，**违反 art-bible §4 硬标准** | **已定案**：移动端设计分辨率 720×1280（architecture.md §4.3），32px → ~17px ✔；世界坐标与数值常量完全共用，仅设计分辨率不同。此偏离 art-bible §8"统一 1920×1080"，需在美术圣经同步更新 |
| C3 | **Phaser 版本知识缺口**（3.7x+ changelog 未验证） | 中 | 3.60 之后 API 可能变动（本架构所用 API 均为 3.60 稳定面） | 安装后第一步跑 `npm run build` + 冒烟 Demo；升级 Phaser 走独立 PR + 全量验收 |
| C4 | **Canvas 兜底模式下预算不可达** | 中 | Canvas 渲染器不支持 Post FX/部分 blend，且每 sprite ≈ 1 draw call → 400 实体在 Canvas 下必卡 | Canvas 仅作"WebGL 不可用"兜底（老设备/内嵌浏览器），预算降级为移动 250 或更低；**性能验收以 WebGL 为准**；Canvas 只保证"可玩不崩" |
| C5 | **20 分钟等级可能显著高于 Lv30** | 低 | 击杀经验估算偏保守：早期+中期+后期击杀率推算累计经验 ≥3000 点，need 求和 Lv40 仅需 2540 → 实际可能 Lv40+，总倍率 ~3.0 vs 设计 2.5，Boss 战更短（仍可通关，不违反验收） | 埋点断言"Lv30+"（满足）；若后期想收紧节奏，可调大 need 曲线，属数值迭代不属架构问题 |
| C6 | **draw call 无自动监控，靠纪律** | 中 | ≤8 是"设计上限"而非引擎强制 | 开发期 `utils/perf.ts` 打印 draw call 估算；集成 DevTools 审查清单；perf 基准脚本纳入验收门槛 |

---

## 6. 引擎能力匹配：设计点 vs Phaser 3 能力

| 设计点 | Phaser 3 能力 | 匹配度 |
|---|---|---|
| 自动武器（无手动攻击） | 纯逻辑触发，无需引擎支持 | ✅ |
| 虚拟摇杆 | 无内置，需自研（ADR-002，~40 行 + 贴图） | ⚠️ 需自研（已定案） |
| 暂停/升级选卡 | 单场景状态机（ADR-003） | ✅ |
| UI 覆盖层 | DOM overlay（ADR-004） | ✅ 原生 HTML 最熟 |
| 冲击波扩散/粒子 | ParticleEmitter + Sprite 缩放 | ✅ |
| 屏幕震动 | `camera.shake()` | ✅（移动端关） |
| 敌潮生成器预算 | 纯逻辑 + `clampDelta` 秒制累加 | ✅ |
| 图集加载 | `load.atlas` JSON 数组格式原生支持 | ✅ |
| WebP/PNG | Phaser 原生支持两者 | ✅ |
| 无障碍（字体缩放/高对比） | DOM/CSS 原生 | ✅ |
| Boss 顶部血条 | CSS 百分比宽度（DOM） | ✅ |

**唯一自研项**为虚拟摇杆（已由 ADR-002 收敛为 40 行数学 + 图集贴图），无能力缺口。

---

## 7. 评审判定

| 维度 | 判定 |
|---|---|
| 数值自洽 | ✅ PASS |
| 并发与实体量 | ✅ PASS |
| 性能预算（≤8 draw call、移动 30fps+） | ⚠️ PASS with 纪律（§4.1 三纪律 + §6 预算表逐项落地） |
| 引擎能力匹配 | ✅ PASS（1 项自研：摇杆，已定案） |
| **总判定** | **PASS with CONCERNS** |

**放行条件（实现期必须落实）**：
1. 描边纪律：普通敌不加 FX.Outline（C1）。
2. 双设计分辨率：移动端 720×1280（C2），并回写 art-bible。
3. WebGL 为准、Canvas 仅兜底（C4）。
4. 性能基准脚本（architecture.md §6.1）在 P0 闭环后执行，未达门槛不进入 P1。
5. 版本验证：Phaser 安装后第一步冒烟（C3）。

**不阻塞项**：C5（等级偏高，数值迭代范畴）、C6（开发纪律，用 perf.ts 缓解）。
