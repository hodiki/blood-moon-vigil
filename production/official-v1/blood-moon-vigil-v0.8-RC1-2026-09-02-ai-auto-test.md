# blood-moon-vigil v0.8-RC1 AI 自动化测试报告（2026-09-02 · ai-auto-test · v4）

> 执行：AI 测试线（WorkBuddy Agent）· 主理人：游承峰
> 被测：`http://localhost:5173/`（Vite dev，主理人本机启动）
> 代码基线：round 1 @ `80a8b37`（发现 P0-1）→ 主理人热修 `2c1ba2d`（补 `super('Play')`）→ round 2 续跑 → round 3（q13 Boss+HUD 综合局）→ round 4（q14 Boss 链路自然触发局 + q15 圣物定点探针）
> 依据文档：`production/official-v1/真机验收单-v0.8.md`（手测十条 / 回填 6 项 / §三判据）
> 职责边界：AI 专职测试不做修复；P0/P1 修复由主理人/工程线决策
> v2 变更：P0-1 修复复验通过；手测 9 PASS；手测 5 四锚全 PASS（q10/q11/q12 三局）；UI 抽检 5 项 PASS；矮视口 PASS；回填管线 PASS；atlas 认知修正
> v3 变更：q13 Boss+HUD 综合局闭环剩余自动化项——**新 P1 发现（月之化身击杀=胜利终局，设计-实现偏差）**；**新 P2 发现（共鸣徽记文案被帧图擦除）**；方阵 rolled=true 补采成功（2 条实锤）；抽检④ 终判；回填首个 victory 实样本
> **v4 变更**：化身抑制绕行 → **手测 6/8 运行时预验证 PASS**（t=360.0 准点 Boss 出场 boss_1 / telegraph ring+arc 交替 / 圣物链 q15 全链 PASS）；**抽检⑥ 事件链 PASS**（StatusImmune ×15）；**新 P2 发现（bossFightSeconds 恒 0——elapsedSeconds 收束后冻结）**；q13 relicBtn/skillBtn 结论修正（测试侧选择器误用，非缺陷）

---

## 一、总体结论

| 项 | 状态 |
|---|---|
| 验收进度 | **P0-1 已修复复验通过 —— 自动化可测项全部完成（含 Boss 链路绕行局），剩余主理人亲手项** |
| 手测十条（自动化可测） | 手测 9 ✅ / 手测 5 ✅（四锚全 PASS）/ **手测 6 预验证 ✅（t=360.0 准点出场+telegraph）/ 手测 8 预验证 ✅（圣物链 q15 全链）**；方阵 rolled=true 已实锤 |
| UI/表现抽检八项 | ①②③⑤⑦ ✅ 共 5 项；④ 终判（槽扩展 ✅ + 徽记文案擦除 P2，§4.7）；**⑥ 事件链 ✅（StatusImmune ×15）+ 飘字视觉待真机** |
| 回填 6 项采集管线 | ✅ 27 字段全齐；实样本 5 局（3 死亡 + 2 胜利）；**Boss 战时长字段口径缺陷（恒 0，§4.8 P2）**——60~85s 锚判定需工程修口径后重采 |
| 缺陷 | **P0 ×0（已修复）/ P1 ×1（化身击杀=胜利终局，挂裁决）/ P2 ×2（共鸣徽记文案擦除；bossFightSeconds 恒 0）** |
| 主理人亲手项 | 手测 1~4 / 6~8 / 10（AI 以 `__BMV_QA` 配合切角色/地图）；手测 6~8 的机制面已预验证，主理人可专注**视觉演出与手感** |

---

## 二、P0-1：PlayScene 场景 key 丢失（round 1 发现，已修复 ✅）

> **复验结论（round 2）**：主理人热修 `2c1ba2d`（`constructor(){ super('Play'); }`）后，`?smoke=1` 60 帧 RUNNING、点击开始正常进局、全部进局路径（smoke/qa 挂机/正常游玩）恢复。以下为 round 1 记录存档。

---

### 2.1 round 1 详情存档：PlayScene 场景注册 key 丢失（点击开始即黑屏）

### 现象
- `?smoke=1`：60s 内 `__SMOKE_RESULT__` 永不写入，console 报 **`Scene key not found: Play`**
- 正常路径：启动页点击「点击开始」→ overlay 销毁 → **画面永久黑屏**（截图 `menu-after-start.png`）
- 影响面：**所有进局路径全部断裂**（点击开始 / smoke / bench / qa 挂机），游戏当前不可玩

### 证据链
| # | 证据 | 位置 |
|---|---|---|
| 1 | BootScene 跳转目标 `this.scene.start('Play')` | `src/scenes/BootScene.ts:40` |
| 2 | 场景注册表 `[BootScene, PlayScene]` 正常 | `src/config/game-config.ts:39` |
| 3 | 当前 HEAD PlayScene 类 **无 constructor、无 super()**，无场景 key | `src/scenes/PlayScene.ts:100` |
| 4 | 基线 `3286635` 存在 `super('Play')`（PlayScene.ts:264） | git 考古 |
| 5 | W-F1 拆分将 `isSmoke/isBench/isQa` 读取搬入 BenchSmokeRunner（正确），`super('Play')` 随 constructor 整体遗失 | `src/scenes/run/bench-smoke-runner.ts:57-63` |

### 根因判定
W-F1 PlayScene 拆分（2015→1200 行）机械搬移时，constructor 的**参数读取逻辑**被正确承接，但 **`super('Play')` 这一行随整个 constructor 被删除**。Phaser 对无 key 场景回退类名 `'PlayScene'` 注册，跳转找 `'Play'` 失败。

### 为什么三道门禁均未拦截
| 门禁 | 结果 | 原因 |
|---|---|---|
| typecheck | 0 错误 | TS 不强制显式 constructor（隐式 `super()` 合法） |
| 1368 单测 | 全绿 | 单测不跑真实 Phaser 引导链 |
| build | ✔ | 编译期无感知 |
| e2e 冒烟 | **未执行** | `playwright test` 属 CI §5 P2 可选增强，未入常规门 |

> **结构性建议**（记录待议）：e2e 冒烟（`npx playwright test`，需先 build）应纳入 commit/tag 门禁——批次 F 落地至本次真机验收前无人真实进局，此空洞持续约一整天未被察觉。

### 建议修复方案（供工程线采纳，AI 不执行）
```ts
export class PlayScene extends Phaser.Scene {
  constructor() {
    super('Play');
  }
  // ...原有类体不变（isSmoke/isBench/isQa 已由 BenchSmokeRunner 承接，无需搬回）
}
```

---

## 三、已执行检查项明细

### 3.1 手测 9：`?smoke=1` 冒烟 —— round 1 ⛔ BLOCKED（P0-1）→ round 2 ✅ PASS（见 §四.1）
- round 1：headless 与 headed 双模式均确认 `__SMOKE_RESULT__` 不产出（场景未启动）；诊断截图 `menu-after-start.png`（黑屏实证）
- round 2：热修后复跑通过，60 帧 RUNNING + 默认专武开火实证（§四.1）

### 3.2 启动页 / 主菜单 UI 检查 —— ✅ PASS
| 检查点 | 结果 |
|---|---|
| 标题渲染「血月守夜 / Blood Moon Vigil」 | ✅ |
| 4 角色卡（艾德蒙默认选中·冷青描边 / 卡珊德拉 / 薇奥莱 / 加尔文） | ✅ 齐全，选中态正确 |
| 3 地图卡（月下墓地选中 / 血教堂 / 狼穴，尺寸+Boss 标注） | ✅ |
| 功能按钮：守夜日志 / **滤月余辉**（树入口，手测 10 用） | ✅ 存在可点 |
| 「点击开始」按钮 | ✅ 存在可点（点击后进 P0-1 黑屏） |
| DOM 交互元素总数 | 10 个 button，全部 visible |
| 截图 | `menu-start.png` |

> 注：验收单手测 2 写「修女」，启动页角色全名为「圣辉夜祷修女·**薇奥莱**」（技能：安魂曲），执行时以该卡为准。

### 3.3 QA 钩子可用性 —— ✅ PASS
| 钩子 | 状态 | 备注 |
|---|---|---|
| `?qa=1` → `__BMV_QA` | ✅ 安装成功 | `status()` 返回 `{hero:'hero_edmund', map:'map_graveyard', unlocks:{...false}}`（新存档） |
| `__BMV_QA.setHero/setMap/unlockAll` | ✅ 可用（未实测进局效果，待 P0-1 修复） | 免刷新切角色/地图，手测 1~3 准备就绪 |
| `?smoke=1` → `__SMOKE_RESULT__` | ⛔ 待 P0-1 | 机制本身在位（BootScene 直通分支确认） |
| DEV `__BMV_GAME__`（Phaser.Game 实例） | ✅ main.ts:29 | **回填 6 项运行时采样的官方通道**（kills 曲线定时采样/宽容触发率深读） |
| `?bench=1` → `__BENCH_RESULT__` | 待 P0-1 | 36s→720 局时秒挂机采样，kills 曲线辅助 |

### 3.4 资源加载检查 —— ✅ 外部图集实际生效（v2 认知修正）
- **v2 修正**：round 1 判断「public/ 不存在 → 200(HTML) fallback」不准确。round 2 运行时日志实证 **外部 atlas 已生效**：`[atlas] 外部 characters 覆盖 100 帧（缺帧仍用程序剪影）、effects 覆盖 46 帧`——美术资产管线（M4 备料 drop-in replacement）工作正常
- console 无错误、无 loaderror 污染（headless 复跑 console 全净）
- 另有一条 headed 环境单次 404（未复现、无游戏影响，低危挂账）

### 3.5 测试基建验证 —— ✅（desktop-gui-automation 路线定案）
| 项 | 结果 | 结论 |
|---|---|---|
| Playwright（项目自带 1.62.1 + chromium-1234） | ✅ headless/headed 双模可用 | **主通道** |
| Step 0 注入自检（diag_inject） | ❌ **INJECTION_BLOCKED**（会话级沙箱隔离，`EXIT=2`） | gtool 键鼠注入层**本轮禁用**（skill 纪律：不重试） |
| CDP 协议层（Playwright Input 域 / eval / DOM click） | ✅ 不经 OS 注入，沙箱内有效 | 键鼠操作全走此层 |
| 视觉判定（协议层截屏 + 多模态分析） | ✅ 不受注入封锁影响 | Boss telegraph / 演出类判定用 |

> 主理人问询回复：此前未弹浏览器 = headless 模式（进程在、窗口不显）；现 headed 模式已验证可见窗口正常调起。desktop-gui-automation 已按 Step 0 完成注入自检并出具 INJECTION_BLOCKED 判定，其 CDP 路线与 Playwright 同通道继续服役，注入层按纪律降级。

---

## 四、round 2 测试结果（P0-1 热修 `2c1ba2d` 后）

### 4.1 手测 9 冒烟复跑 —— ✅ PASS
| 判据 | 结果 | 证据 |
|---|---|---|
| 60 帧内 `__SMOKE_RESULT__` RUNNING | ✅ | framesAdvanced=true / sceneReady=true / consoleErrors=[] / frame=60 / elapsed 5.07s |
| 默认专武在开火（非只有通武） | ✅ | 专武装配链实证：`exclusiveId='xw_lantern'`（8 专武门控中唯一 enabled）；通武 wpn_a_1 cooldown 0.22~0.85 波动推进；kills 0→1→3 增长 |
| 画面渲染 | ✅ | `smoke-final.png` 目检：守夜人剪影 + **暗金灯环常驻** + 血月 + 经验宝石 + 敌怪剪影 + HUD（LV/血条/小地图/守夜日志提示）全部正常 |

> 附带验证：smoke/bench 默认专武装配走 `defaultExclusiveFor(heroId)=HERO_EXCLUSIVE_PAIRS[hero][0]`，专武经 `applyLoadout` 门控启用、不进 `ownedWeaponIds`（升级获得列表只含通武）——装配语义与设计一致。

### 4.2 手测 5：`?qa=1` 时序锚（q10/q11/q12 三局采样）
**锚① 100s 前方阵不掷 —— ✅ PASS（q10 局，t=136 / 2727 条掷点日志）**

| 时间窗 | 样本 | rolled | reason | 判定 |
|---|---|---|---|---|
| t<100 | 2000 条 | 全 false | 全 `gate` | ✅ 首掷门控（`S1_END_WINDOW_START=100s`）拦截率 100% |
| t=100.0 | 1 条 | false | **`chance`** | ✅ **门控准点放行实证**：首掷节奏位命中、进入 0.3 概率掷骰（该掷未中） |
| t=100.2~136.3 | 726 条 | false | `gate` | ✅ 次掷等待期（100+60~90s=160~190s 才到下一节奏位），与 `spawn-group.ts:286` rollGroup 设计一致 |

> 判定口径：`reason=gate`=未到掷点节奏位、`chance`=节奏位已到概率未中——t=100.0 的 chance 条目是「门控准时打开」的直接证据。**rolled=true 已由 q13 补采 2 条实锤**（f_revive_circle / f_treasure_guard，见 §4.7）。

**锚②③④（q12 终版采样局终判）——✅✅✅ 全 PASS（q12：t=205.5 / 314 样本 / 4135 条 console 零错误）**

- q11 局（无敌挂机 t=234 / 20 样本 / 4866 条 console）：精英在场（g1_6 ×1~3 / g1_8 ×2 @t=216.4）但 eliteTel/lunge 全零。**排查结论：非运行时缺陷**——
  1. 接线完好：`aiDirector.update`（PlayScene:772）/ `eliteDirector.update(dt, now, player, elites, spawner.elapsedSeconds)`（PlayScene:986）每帧无条件推进；telegraph 查询（:804/:808）每帧执行
  2. 配置在位：g1_6=180° 蓄力扫（triggerDist 100/windup 0.9s/CD 4s）、g1_8=读圈骨矛（triggerDist 260/windup 1.0+warning 0.8s/CD 4s）均在 `ELITE_SKILLS`；血犬 enemy_g1_2（fast tier，unlockAt 60）在墓地池
  3. 根因 = 采样不足：q11 升级卡 overlay 高频弹出（360 杀升级风暴），20 条样本全落在 overlay 时刻——统计上不足以定罪
- q12 终版改进：升级卡 force-click（不再阻塞）+ 600ms 高频采样 + 全敌种 census + 960×540 视口提速（局时推进 ≈1:1 墙钟）

| 锚 | 判据 | 结果 | 证据 |
|---|---|---|---|
| ① | 100s 前方阵不掷 | ✅ PASS | q12 4122 条掷点日志 **0 条**在 t<100 放行（全 `gate`）；t=100.0 准点出现 `chance`（门控放行、进入 0.3 概率掷骰）；q10 局独立复核一致（2000 条 t<100 全 gate）。**rolled=true 已由 q13 补采 2 条**（t=161.7 f_revive_circle / t=223.3 f_treasure_guard，§4.7）——gate→chance→roll→spawn 全链路闭环；阵纹预警演出仍归主理人手测观察 |
| ② | 120s 精英无技能预警 | ✅ PASS | 120~180s 窗口 92 样本 telegraph 恒零，其中 **87 样本精英在场**（1~3 只 g1_6/g1_8 持续追击站桩玩家）——「在场且贴脸但无预警」强覆盖；首个 telegraph 出现在 **t=180.3**，门控 180.0 准点开启 |
| ③ | 181s 后新精英有技能 | ✅ PASS | g1_6 守墓者 arc 蓄力扫：t=180.3 首击（alpha 0.28 渐亮）→ 180.9（alpha 0.9 末段）→ 192.6/193.3、198.4/199、204.2/204.9 三轮完整 CD 循环（CD 4s 设计），dist 3~97px（≤triggerDist 100 内触发） |
| ④ | 血犬进 100px 有前扑前摇 | ✅ PASS | enemy_g1_2 血犬 **17 个 windup 样本**（首击 t=10.4，dist 67px），dist 全部 1~73px（≤100px 触发线）；血犬在场率 218/314 样本（max 并发 4）——100px 蓄身 0.25s 冻结前摇实证 |

> 手测 5 结论：**四锚全 PASS，180s 精英技能门（P0-5 轨③）行为与代码/设计完全一致**。q12 期间 4135 条 console 零 error/pageerror。

### 4.3 UI/表现抽检（验收单附加抽检八项）
| # | 项 | 结果 | 证据 |
|---|---|---|---|
| ① | 树界面可操作不卡死 | ✅ PASS | 「滤月余辉」入口可点；49 节点渲染；节点购买状态读取正常；返回导航可用（`ui-tree.png`） |
| ② | 专武 2 选 1 双卡演出 | ✅ PASS | 破旧提灯/圣徒左轮双卡带插画，选择后正常进局（`ui-exclusive-1s.png`） |
| ③ | 升级卡图标与 P1~P5 角标 | ✅ PASS（样本 P2/P3） | 升级卡带图标 + 席位角标（bmv-seat-badge）+ 共鸣待定标记（bmv-reso-awaiting-key）；P1/P4/P5 角标未抽样到（随机 offer，主理人手测补看） |
| ④ | HUD 武器槽扩展 + 共鸣徽记四态 | ✅ 槽扩展 PASS / ⚠️ 徽记 P2 | 槽扩展：active 2→3（t=2.4 `wpn_a_1+xw_lantern` → t=327.2 `+wpn_c_1`），`hud-slots.png` 目检 3 槽图标可见。共鸣徽记：430 样本恒 `hidden=false/text=""`——根因查明为**文案被帧图擦除（P2，hud.ts:311 preferFrameImg 缺 keep）**，接线本身完好（§4.7）；四态视觉区分待真机 |
| ⑤ | 结算页余辉行 | ✅ PASS | 「本周获«滤月»余辉 +0」行存在（q9b `hasYuhuiRow=true` + 截图目检） |
| ⑥ | 状态微标与 Boss「免疫」飘字 | ✅ 事件链 PASS / 视觉待真机 | q14：Boss 战期间 **StatusImmune 事件 ×15**（首次 Space 施放月痕狙击命中后 3s 内连发 5 连，此后多源硬控持续触发至 Boss 死亡）——Boss ccProfile 免疫→事件→FloatTextLayer 消费链运行时实证（events.ts:129）。飘字渲染目检待真机（q14 截图时机未对准） |
| ⑦ | BUG-3 矮视口 1280×656 | ✅ PASS | overflowX=false / overflowY=false；结算面板 (85,0)-(1251,656) 完全在视口内（§4.4） |

### 4.4 BUG-3 矮视口复现（1280×656）—— ✅ PASS
```
SHORTVP_CHECK = {
  viewport: 1280×656, overflowX: false, overflowY: false,
  resultsRect: { l:85, t:0, r:1251, b:656 }, inViewport: true,
  hasYuhuiRow: true, yuhuiSnippet: "余辉+0"
}
```
- HP=1 速死进结算页（死亡 survival 16.2s / kills 13），面板完整居中、无横向/纵向溢出——批次 F W-F3 修复（dvh÷--bmv-overlay-scale）真机复现通过；截图 `ui-results-656.png` 目检：守夜失败面板 / 余辉行 / 守夜日志 +5 / 遥测块 / Build 回顾（圣徒左轮）/ 再来一局按钮全部完整可见

### 4.5 回填 6 项采集管线 —— ✅ PASS
| 项 | 字段 | 状态 |
|---|---|---|
| 1 死亡时点 | `survivalSeconds` | ✅ 实测回填 3 局死亡样本：59.1s / 51.0s / 16.2s（挂机局） |
| 2 Boss 战时长 | `bossFightSeconds` | ⚠️ **字段口径缺陷（P2，§4.8）**：q14 实测 Boss 战墙钟 ~71s（4000HP 全程血量曲线），但字段恒 **0**、bossDpsEstimate=null——`elapsedSeconds` 收束后冻结 360，spawn/defeat 双双记录 360 相减为 0。60~85s 锚判定需工程改口径（建议 `this.time.now/1000` 游戏时钟）后重采 |
| 3 首级时点 + offers | `firstLevelUpSeconds` / `offersPerRun` | ✅ 字段在（q9b offers=1；q13 胜利局 offers=15 / firstLevelUpSeconds=14.6） |
| 4 kills 曲线 | `kills` + 分时采样 | ✅ q10 粗采样曲线 t=7~136: 2→164（8 个时点）；q13 胜利局 t=9.9~333.8: 4→623（31 条进度点） |
| 5 升级间隔 | `upgradeTimestamps`（差分） | ✅ 字段在（lastUpgradeIntervalSeconds 伴生）；q13 胜利局 15 个升级时点全录 |
| 6 宽容触发 + 方阵死亡 | `hesitationCount` / formation 遥测 | ✅ hesitationCount 字段在（q13 实测 10）；**方阵 rolled=true 遥测已实锤**（q13 2 条：f_revive_circle/f_treasure_guard）；方阵成员击杀分布需运行时深读（随主理人游玩批次） |

> `__BMV_LAST_RUN` 共 **27 字段**（victory/survivalSeconds/kills/level/build/hesitationCount/upgradeTimestamps/firstLevelUpSeconds/lastUpgradeIntervalSeconds/reachedLevel47/bossFightSeconds/bossDpsEstimate/bossInTargetWindow/activeSkillCasts/offersPerRun/xpGainedPerRun/evolutionCompleteCount/evolutionComplete/relatedCardShare/derivativeDpsShare/relicDpsShare/mutationCard1AtSeconds/mutationCard2AtSeconds/resonanceAtSeconds/resonancePairId/talentReviveCount/eliteOfferCount/treeMutationCount）——回填清单约束 1/5 的数据需求全覆盖。

### 4.6 观察项与定案
| 项 | 定案 |
|---|---|
| HUD 技能钮 skillName=null（q8 采样） | **非缺陷**：生产路径 PlayScene:541 正确传衍生技名；q8 在 t≈1s 采样早于专武选择回填，aria-label 走「提灯闪耀」兜底。a11y 文案观察项挂账（非守夜人角色进局时若复现错标，属低危文案项） |
| atlas 加载 | 外部图集生效（characters 100 帧 + effects 46 帧覆盖，缺帧程序剪影兜底），M4 备料管线正常（§3.4） |
| 精英 t=14.4 早现（q11） | 伴随精英预约（P1-13 escort）正常语义，非缺陷 |
| 共鸣徽记 text 恒空（q13 430 样本） | **P2 缺陷定案**：接线完好（选专武时 setResonanceBadge 激活 awaiting 态），但 hud.ts:311 preferFrameImg 未传 keep → 帧图 load 后删除文案 span（frame-img.ts:24-30）。次级观察：HUD 徽记仅选专武时刷新一次，局内共鸣达成无刷新路径（§4.7） |
| hud-slots.png 红色大圆（t=327.2） | 与 census `?` 条目（化身）时间重合，疑似化身/月坠降临视觉信号——形态判定归真机确认 |
| q13/q14 的 relicBtn=null / skillBtn=false | **测试侧结论修正（v4）**：采样误用 `.bmv-hud-relic-btn`（移动端才附加的类，hud.ts:179）与 `.bmv-hud-skill`（移动端技能钮）——桌面正确形态为 `.bmv-hud-relic` 容器（q15 实证：授予前 hidden=true → 授予后显形）+ Space/Shift 施放。**非游戏缺陷**，圣物/技能链路以 §4.8 为准 |
| Boss/化身实体 census id=`?` | BOSSES 配置生成实体（spawnBoss/spawnAvatar）无 `enemyId`（q14 boss_1 同为 `?`）——遥测/统计系统若按 enemyId 归组 Boss 数据会落空，低危观察项挂工程 |
| f_treasure_guard FormationLanded 双发（q14） | 同一 groupId fg_2 在 0.1s 内两条 Landed（y=1686/1986 两个落点）——若为两段落地语义则正常，若为重复 emit 则低危；挂工程确认 |

### 4.7 q13 Boss+HUD 综合局（v3 新增：一局闭环剩余自动化项）

> q13 配置：`?qa=1` + 专武「破旧提灯」+ 墓地，960×540 视口，600ms 采样 × 430 条 + console 6691 条（零 error）。终局 **victory=true，t=333.9**（kills 640 / lv 16 / offers 15）。截图：`hud-slots.png`（t=327.2）/ `victory-results.png`。

#### 4.7.1 🔴 P1 发现：月之化身击杀 = 胜利终局（设计-实现偏差，挂主理人裁决）

q13 预期目标是 360s 地图 Boss（抽检⑥ + 手测 6/8 预验证），实际**在 t=333.9 以「击杀月之化身」提前触发胜利**，地图 Boss 全程未出场（bossSpawnAt=-1 / bossHp 全 null / zoneViews 全空）。

**证据链（配置语义 vs 实现）**：

| 层 | 事实 | 位置 |
|---|---|---|
| 配置语义 | boss_4「血月化身」phase2 注记「**不掉通关进度**，掉稀有图鉴」 | `enemies.ts:156` |
| 配置语义 | MOON_AVATAR 常量注释「稀有奖励**非进度门**」 | `enemies.ts:300` |
| 实现 | 化身以 `Boss` 类 + `spawnByBossConfig(BOSSES.boss_4)` 生成（270s 后每秒 5% 判定） | `PlayScene:1029-1048` |
| 实现 | `Boss.kill()` → `kind==='boss'` → 发 BossDefeated | `boss.ts:43-45` |
| 实现 | onBossDefeated → `finishGame(true)`（全工程唯一胜利入口） | `PlayScene:871-889` |
| 实测 | 化身 t=276.4 诞生（census `?` 条目，270s 门后 6.4s）→ 存活 57.4s → t≈333.9 被击杀 → victory=true | q13 采样日志 |

**影响面**：
- 化身在 270~360s 窗口出现概率 = 1−0.95^90 ≈ **99%**——几乎每局必现；玩家击杀（常态行为）即局终
- → **6:00 地图 Boss（手测 6/7/8 + 抽检⑥ 的验证对象）在常规对局中几乎不可达**；真机验证需刻意躲避化身不击杀（或待修复后）
- 「稀有奖励」语义被实现为「替代终局」；Boss 出场圣物保底（`spawnBoss → grantBossGuaranteed`，PlayScene:1096）同样被跳过
- 关联项：`relic-runtime.ts:51` 已有「Boss 击杀即胜利终局」工程偏离挂裁决记录——本条是同族偏差的化身特例，建议一并裁决

**裁决选项（供参考，AI 不执行）**：
- A. 化身死亡不发 BossDefeated（`Boss.kill` 按来源/kind 区分，或化身改用非 boss kind + 独立击杀奖励结算）——回归 GDD「稀有奖励非进度门」
- B. 保持现状（化身=隐藏速通终局），GDD/world bible 补记语义
- C. 化身死亡只发奖励与图鉴，地图 Boss 照常 360s 出场（化身幸存则叠加威胁）

#### 4.7.2 方阵 rolled=true 补采成功（锚①遗留项关闭）

| 时点 | 日志 | 说明 |
|---|---|---|
| t=100.0 | `rolled=false reason=chance` | 首个节奏位 0.3 掷骰未中 |
| **t=161.7** | **`rolled=true formation=f_revive_circle cost=16`** | 第二节奏位掷中，复活阵环成组 |
| **t=223.3** | **`rolled=true formation=f_treasure_guard cost=47`** | 宝藏护卫（180s+ 特例路径）成组 |

gate→chance→roll→spawn 全链路运行时实证闭环；阵纹预警演出（视觉）仍归主理人手测。

#### 4.7.3 抽检④ 终判 + P2 发现：共鸣徽记文案被帧图擦除

- **槽扩展 PASS**：active 2→3（t=2.4 `wpn_a_1+xw_lantern` → t=327.2 `+wpn_c_1`），截图目检 3 槽图标可见（4~6 槽形态待真机长局）
- **共鸣徽记**：430 样本恒 `hidden=false / text="" / cls=bmv-hud-reso`（无修饰类）。排查定案——**接线完好，文案被擦**：
  1. 接线存在：`applySelection → refreshResonanceBadge → setResonanceBadge('awaiting-key')`（exclusive-run-assembler.ts:109→123-130），选专武时徽记已激活（hidden=false 即证）
  2. **P2 缺陷**：`hud.ts:311` `preferFrameImg(el, frame)` **未传 `keep`**——帧图 load 成功后删除宿主全部非 img 子节点（frame-img.ts:24-30），「待取钥/可共鸣/共鸣」文案 span（hud.ts:308-310 精心构造）被静默删除，徽记只剩图形。对照正确用法：codex-overlay.ts:289 `preferFrameImg(glyph, frame, { keep: '.bmv-codex-q' })`
  3. 修复方向（供工程参考）：`preferFrameImg(el, frame, { keep: '.bmv-hud-reso-text' })`
- **次级观察（挂主理人确认是否设计如此）**：`refreshResonanceBadge` 仅在专武选择时调用一次，局内共鸣达成（本局 14.6s 拿「武器共鸣」卡，resonanceAtSeconds=14.6/pairId R1）后 HUD 常驻徽记无刷新路径——achieved 态在 HUD 上不可达（升级卡内徽记另有呈现，levelup-overlay.ts:173）。若设计意图是「HUD 徽记常驻反映共鸣状态」，需补一个共鸣达成事件订阅

#### 4.7.4 回填 2 首个 victory 实样本

`__BMV_LAST_RUN`（q13 胜利局，27 字段全）：survivalSeconds=**333.9** / kills=640 / level=16 / offersPerRun=15 / firstLevelUpSeconds=14.6 / lastUpgradeIntervalSeconds=22.6 / hesitationCount=10 / resonanceAtSeconds=14.6（R1）/ relatedCardShare=0.667 / bossFightSeconds=null / bossInTargetWindow=false / activeSkillCasts=0 / relicDpsShare=0。结算页「封印稳固·守夜完成」+ 遥测块渲染目检一致（`victory-results.png`）。

> 实样本累计 4 局：死亡 59.1 / 51.0 / 16.2 + 胜利 333.9。`bossFightSeconds` 的 60~85s 锚判定仍需真机 Boss 局（化身短路径下该字段必为 null，见 §4.7.1）。

### 4.8 q14 Boss 链路自然触发局 + q15 圣物定点探针（v4 新增：手测 6/8 预验证闭环）

> **绕行方法（如实记录）**：P1 偏差（§4.7.1）使 6:00 Boss 常规不可达。q14 运行时置位 `PlayScene.avatarTriggeredThisRun=true`（TS private 仅编译期，JS 可达）**仅抑制化身**，spawner 于 t=360 **自然触发** onBossTime（enemy-spawner.ts:163-169：停掷→清预约→回调）——清场/Boss 出场/霸体/圣物保底/技能/telegraph/击杀结算全部生产代码路径原样执行。

#### 4.8.1 手测 6 预验证 —— ✅ PASS（q14）

| 判定点 | 结果 | 证据 |
|---|---|---|
| 6:00 收束准点触发（±0.1s RV-C8） | ✅ | 化身抑制生效（270~360s 窗口无 `?` 实体）；**t=360.0 整点** BossSpawned 事件 `{"bossId":"boss_1","bossHp":4000}`（墓地 Boss）+ census 4000HP `?` 实体 @dist 287 |
| Boss zone telegraph 形态序列 | ✅ | zoneViews **13 个非空样本全部 t=360（战斗期）**：`ring(range 180)` ×6 与 `arc(range 120, angle ±1/±2)` ×5 交替——双技能 telegraph 循环；截图 `boss-telegraph.png` |
| 出场清场 + 生成停止 | ✅ | spawn 后 census 普通敌清空，kills 继续增长（武器输出 Boss）；方阵 BOSS_TIME 停掷（spawn-group.ts:128） |

#### 4.8.2 Boss 战全程与击杀终局 —— ✅ PASS（q14）

- **血量曲线 60 样本**（1.15s 步进）：4000/4000 @dist 287 → ~10s 接近贴脸 → **71s 墙钟持续输出至 7/4000** → BossDefeated 事件 `{"bossHp":0}` → victory=true（t=360，kills 806 / lv 17 / offers 16）
- **抽检⑥ 事件链 PASS**：**StatusImmune ×15**——首波 5 连（Space 施放月痕狙击命中后 3s 内，弹幕逐发硬控→免疫反馈），此后多源硬控持续触发至死亡；`activeSkillCasts=1` + `derivativeDpsShare=0.33%` 佐证施放注册。飘字渲染目检归真机
- Space/Shift 施放入口运行时可用（keyboard-input.ts:55/91 → DerivativeCastBridge.tryCast）

#### 4.8.3 手测 8 预验证 —— ✅ PASS（q15 圣物定点探针）

q15 以生产函数直接调用验证全链（= PlayScene:1096 Boss 出场同一入口）：

| 判定点 | 结果 | 证据 |
|---|---|---|
| 圣物池非空 | ✅ | boss 池 3 枚（relic_moonfall / relic_bloodtide / relic_silver_tide），altar 池 4 枚（relic-engine.ts:21 RELICS.pools 静态过滤，无存档门控） |
| 出场保底授予 | ✅ | `grantBossGuaranteed()` → `relic_bloodtide`（血海退潮），slots 0→1 |
| HUD 显形 | ✅ | `.bmv-hud-relic` hidden=true → **false**，文案「✧ 血海退潮 ×1」（截图 `relic-hud.png`） |
| Q 键释放（桌面） | ✅ | Q JustDown（keyboard-input.ts:100）→ `tryUseRelic` → **used=true / cdReadyAt=258（now=19 + 240s CD 精确）**，HUD ×1→**×0**（截图 `relic-hud-after-q.png`） |
| 每局 ≤1 枚 + 重复使用闸门 | ✅ | 二次授予返回 null 且 slots 不变；二次 Q 状态无变化 |

> **q13/q14 relicFired=false 结论修正**：测试脚本误用 `.bmv-hud-relic-btn`（移动端附加类）做闸门 → Q 从未按下 → relicDpsShare=0。圣物链路本身无缺陷。

#### 4.8.4 🔴 新 P2 发现：`bossFightSeconds` 恒 0（回填 2 口径缺陷）

- **实测对照**：Boss 战真实墙钟 ~71s（血量曲线 4000→7），LAST_RUN 却输出 `bossFightSeconds=0 / bossDpsEstimate=null / bossInTargetWindow=false`
- **根因**：`recordBossSpawn(spawner.elapsedSeconds)`（PlayScene:1100）与 `recordBossDefeated(spawner.elapsedSeconds)`（PlayScene:878）均取局时秒——而 `elapsedSeconds` 在 6:00 收束后**冻结于 360**（enemy-spawner.ts:69「收束后不再累计」），两值相减恒 0；bossDpsEstimate 除零守卫 → null
- **影响**：回填 2 的 60~85s 锚在现口径下**不可判定**（真机 Boss 局同样会输出 0）
- **修复方向（供工程参考，AI 不执行）**：spawn/defeat 时点改用游戏时钟 `this.time.now/1000`（与 graceUntil 同源），或在 Spawner 暴露收束后继续走动的局末时钟
- q14 胜利样本（第 5 局实样本）：survivalSeconds=360 / kills=806 / lv=17 / offers=16 / hesitationCount=14 / mutationCard1AtSeconds=293.75（首个质变卡）/ relatedCardShare=0.75

#### 4.8.5 方阵事件旁证（q14）

`FormationWarning → FormationLanded` 事件对 ×2：f_hunt_pack（t≈136 落地 fg_1）、f_treasure_guard（t≈339→342 落地 fg_2，**双 Landed 观察项**见 §4.6）。与 q13 console rolled=true 日志互为印证——方阵系统 gate→chance→roll→warn→land 全链实证。

---

## 五、剩余项与分工

| 项 | 执行人 | 说明 |
|---|---|---|
| 手测 1~4 / 6~8 / 10 | 主理人（AI 配合） | AI 以 `__BMV_QA.setHero/setMap/unlockAll` 免刷新切角色/地图。手测 6/8 机制面已预验证（§4.8），主理人可专注视觉演出与手感；若需亲见 6:00 Boss，当前实现下需躲避化身不击杀（§4.7.1 P1 待修） |
| 回填 6 项正式批次 | 主理人游玩 + AI 采集 | ≥10 局正常游玩；AI 挂机采样脚本已备（q10/q12/q13/q14 可复跑）；bossFightSeconds 需先修口径（§4.8.4 P2） |
| ③ 角标 P1/P4/P5 / ④ 共鸣徽记四态视觉 / ⑥ 免疫飘字目检 / 方阵阵纹演出 | 主理人手测顺带 | 随机 offer 条件 / 视觉演出类 |
| P1 化身胜利偏差 + P2 徽记文案擦除 + P2 bossFightSeconds 口径 | 主理人裁决 → 工程线修复 | §4.7.1 三选项裁决；§4.7.3 keep 修复方向；§4.8.4 游戏时钟口径（AI 不执行修复） |

---

## 六、附件与产物

| 文件 | 说明 |
|---|---|
| `D:\code\.workbuddy\tmp\bmv-qa\menu-start.png` | 启动页全景（PASS 实证） |
| `D:\code\.workbuddy\tmp\bmv-qa\menu-after-start.png` | 点击开始后黑屏（round 1 P0-1 实证） |
| `D:\code\.workbuddy\tmp\bmv-qa\smoke-final.png` | smoke 60 帧画面（round 2 复验：灯环/血月/HUD 正常） |
| `D:\code\.workbuddy\tmp\bmv-qa\ui-tree.png` | 滤月余辉树界面（抽检①） |
| `D:\code\.workbuddy\tmp\bmv-qa\ui-exclusive-1s.png` | 专武 2 选 1 双卡（抽检②） |
| `D:\code\.workbuddy\tmp\bmv-qa\ui-upgrade-1.png` | 升级卡图标+角标（抽检③） |
| `D:\code\.workbuddy\tmp\bmv-qa\ui-results-656.png` | 矮视口结算页（抽检⑤⑦） |
| `D:\code\.workbuddy\tmp\bmv-qa\qa-anchor-log.json` / `qa-anchor2-log.json` | q7（v1 死亡 2 局）/ q10（无敌挂机 t=136，formation 门控数据） |
| `D:\code\.workbuddy\tmp\bmv-qa\qa-anchor3-log.json` / `qa-anchor3-console.json` | q11（t=234 排查局：接线完好性证据） |
| `D:\code\.workbuddy\tmp\bmv-qa\qa-anchor4-log.json` / `qa-anchor4-console.json` | q12（终判局：t=205.5 / 314 样本 / 四锚证据） |
| `D:\code\.workbuddy\tmp\bmv-qa\boss-hud-log.json` / `boss-hud-console.json` | q13（Boss+HUD 综合局：t=333.9 胜利 / 430 样本 / 化身 `?` 条目 + 方阵 rolled=true 日志） |
| `D:\code\.workbuddy\tmp\bmv-qa\hud-slots.png` | q13 t=327.2 画面：3 active 武器槽 + 疑似化身视觉信号（抽检④） |
| `D:\code\.workbuddy\tmp\bmv-qa\victory-results.png` | q13 结算页「封印稳固·守夜完成」+ 遥测块（回填 victory 样本） |
| `D:\code\.workbuddy\tmp\bmv-qa\q14-boss-log.json` / `q14-boss-console.json` | q14（Boss 链路局：t=360.0 出场 boss_1 / 470 样本 / 事件 21 条：BossSpawned/StatusImmune×15/BossDefeated/Formation×4） |
| `D:\code\.workbuddy\tmp\bmv-qa\boss-spawn.png` / `boss-telegraph.png` | q14：Boss 出场（4000HP@dist287）/ telegraph ring 首采 |
| `D:\code\.workbuddy\tmp\bmv-qa\q15-relic-probe.json` | q15（圣物探针：授予/显形/Q 键/240s CD/闸门全链） |
| `D:\code\.workbuddy\tmp\bmv-qa\relic-hud.png` / `relic-hud-after-q.png` | q15：圣物 HUD「血海退潮 ×1」显形 / Q 后「×0」 |
| `D:\code\.workbuddy\tmp\bmv-qa\boss-victory.png` | q14 结算页（Boss 击杀胜利，t=360） |
| `D:\code\.workbuddy\tmp\bmv-qa\q0_diag.cjs ... q15_relicprobe.cjs` | 可复跑测试脚本（createRequire 指向项目 node_modules，零污染） |

---

*报告 v4 终版：2026-09-02 13:05 · AI 测试线 · 自动化可测项全部闭环（含 Boss 链路绕行局 + 圣物探针）· P1 ×1 + P2 ×2 挂裁决/修复 · 待主理人手测批次（1~4/6~8/10，机制面已预验证）*
