# 《血月守夜》统一工程影响评估报告（武器系统重做 × 成长系统重做）

- **任务 ID**：NV-ENG-ASSESS · **作者**：程基岩（engineering-lead）· **日期**：2026-08-29
- **评估对象**（五份定稿 GDD，2026-08-29）：
  1. `design/official-v1/gdd-exclusive-weapons.md`（专武：8 专武 2 选 1 + 8 衍生技 + 16 质变卡 + 弹药框架 + 圣物 ×5）
  2. `design/official-v1/gdd-resonance.md`（共鸣：8 对 + 共鸣钥 8 + 通武池 14 重设计）
  3. `design/official-v1/gdd-status-effects.md`（CC 状态层，硬项 = 与实装同版本交付）
  4. `design/official-v1/gdd-upgrade-pool-v3.md`（池 37 项 + 保底 P1~P5）
  5. `design/official-v1/gdd-talent-tree.md`（滤月余辉局外天赋树，替代守夜功绩）
- **基线**：tag `v0.5.0`（967d1b5，873/873 全绿；src 103 文件 ≈2.1 万行）。只读评估，未改 src/tests，未跑 git。
- **引用不重复**：架构水位/技术债/BUG 定位见 `production/official-v1/code-review-v05.md`（下称 CR）；五系统实装口径见 `production/official-v1/baseline-eng-v05.md`（下称 BE）。

---

## 〇、总览结论（一页版）

| 维度 | 结论 |
|---|---|
| 架构承载判定 | **可承载**。武器侧有 WeaponBehavior 注册表 + `evolve` 原子切换先例（weapon-system.ts:379-391）；成长侧 merit.ts 是纯函数数据层 + save.ts 抽象 storage，改造路径清晰。**前置条件两条**：① balance.ts 拆分（CR 技术债 T2，本轮配置表规模将翻倍）；② CC 状态层最先落地（三方共同依赖 + GDD 硬项） |
| 总工作量 | **≈55~85 人日**（纯工程，不含模拟验证轮、设计迭代与怪物域重做）。按 1 名全职工程 ≈ 11~17 周；分 6 批可并行度有限，建议串行主线 + UI 批次部分并行 |
| 最大风险 | ① 移动端树图适配（全新整树界面，无现成模板）；② 存档 v1→v2 迁移（现版本不符即弃档，save.ts:73）；③ 开局流程重写回归面（PlayScene create 装配序 + b/d/s1 组合矩阵） |
| 挂账影响 | FQ-1（质变卡 2 渠道）不阻塞代码、阻塞数值定版；BUG-5（功绩产出）阻塞树成本表定版——两者均可「配置驱动 + 兜底管线先行」化解 |
| 需用户裁决 | EG-1~9（见 §三.7），其中 EG-1（balance 拆分）与 EG-3（质变卡 2 兜底）建议本轮即裁决 |

---

## 一、逐 GDD 工程影响评估

### 1.1 gdd-status-effects.md —— CC 状态层（最先落地块，三方共同依赖）

**定位**：专武衍生技、共鸣改造、圣物、旧武器收编四方的共同前置（专武 GDD §3.3/§4.8、共鸣 GDD §3.2 控制效果行、升级池 P4 卡效果全部引用状态层）。GDD 明确硬项：与实装同版本交付。

**涉及模块与文件**：

| 类型 | 文件 | 说明 |
|---|---|---|
| 新建 | `src/combat/status/status-types.ts` | 封闭枚举 `Stun/Slow/Vulnerable` + 类型守卫（GDD §3.1 封闭集合纪律） |
| 新建 | `src/combat/status/status-engine.ts` | 纯函数核心：`applyStatus(target, spec)` / 叠加规则（同类取最强 §3.2）/ ICD 表（硬控 10s/单目标 §3.3）/ 抗性解析（Boss 免疫、精英 ×0.5 §3.4） |
| 新建 | `src/config/` 内状态表 | §④ 登记表 15 项逐条配置化（来源-状态-参数），含每敌抗性覆写字段位（§⑥-1，默认值按 §3.4 表） |
| 改造 | `src/enemies/enemy.ts:40-46,83-86,117-120` | 现散落字段 `stunnedUntil/slowUntil/slowPct/markUntil/markDamageMult` 收编为状态组件；池复用重置逻辑同步改 |
| 改造 | `src/enemies/enemy.ts:136-154` | `updateMovement` 眩晕/减速消费改读状态引擎查询（行为语义不变，数据源换） |
| 改造 | `src/combat/contact.ts:29-55` | 眩晕期接触伤害阻止改读状态引擎 |
| 改造 | `src/combat/damage.ts:34-36` | `computeHitDamage` 增易伤乘区（×(1+易伤值)）——现 `weaponDamageOnTarget`（active-skill-effects.ts:41-49）标记逻辑迁入 |
| 改造 | `src/active-skill/active-skill-math.ts:32-50`、`active-skill-effects.ts:181-210` | `stunEnemiesInRadius/applySlowInRadius/slowedSpeed` 改为状态引擎的门面转发（保 API 兼容，逐步退役） |
| 改造 | `src/weapons/weapon-behavior.ts`（WeaponUpdateContext） | ctx 增加 `applyStatus` 能力入口，武器行为声明式施加 CC |
| 改造 | `src/enemies/enemy.ts` + Boss | 抗性判定需 tier 信息（elite/Boss 识别，现 elite 由 kind 映射 enemy-types.ts:44-49，Boss 走 Boss 类） |
| 新建（同批评估） | enemy.ts 索敌扩展 | 守誓者承伤替身需要「敌方 AI 可选中友方实体」（GDD §⑥-2，专武 GDD §4.4 ⚠ 工程依赖）——**建议与 CC 层同批接线** |

**改造要点（对照现状）**：
- 现状无任何 tier 级 CC 规则：`stunEnemiesInRadius` 对池内全部敌（含 Boss）无差别生效（active-skill-math.ts:46），减速同理——「Boss 硬控免疫/精英 ×0.5」是全新行为。
- 现状无 ICD 概念；ICD 表 + 起算时点（GDD 推荐状态结束时开始，⑧⑤-5）需写死注释固化。
- 易伤=现「标记」机制泛化：`markUntil/markDamageMult` 的取最强/刷新语义与状态层 §3.2 同构，迁移成本低。
- 减速区（血池）与武器减速同走「取最强」——现状血池地形消费路径未接线（BE 域5 §5.4），接入时按状态层统一。

**工作量**：**M，4~6 人日**（引擎 + 收编迁移 + 抗性 + 配置表 + 测试）。若守誓者索敌扩展并入本批 +1~2 人日。
**依赖**：无前置，是批次 1 内容。
**风险与回归面**：enemies 52 it 中 status 相关断言改写；active-skill 57 it 的 CC 类用例（提灯眩晕/安魂曲减速/血影标记）走门面后语义不变但需复核；combat 14 it 薄，建议本批补厚（易伤乘区/ICD/免疫矩阵）。**「旧散落字段收编」清单须在实施时逐项清点并留测试证据（GDD §3.5，域4 技术债联动）**。

---

### 1.2 gdd-exclusive-weapons.md —— 专武/衍生技/质变卡/圣物/弹药

**涉及模块与文件**：

| 类型 | 文件 | 说明 |
|---|---|---|
| 新建 | `src/weapons/exclusive/`（8 行为文件） | 8 专武基础形态行为，按四类手感挂接既有骨架：提灯≈B 环绕/领域（参照 orbit-weapons + ground-weapons）、左轮≈A 投射（projectile-weapon 扩展弹药）、双刃≈B 近战变体、长弓≈A 重型贯穿（标枪骨架）、圣铃≈C 领域+召唤联动、十字≈C 定点爆发、巨斧≈近战重斩（新增近战弧形判定）、号角≈D 召唤（summon-weapons 骨架） |
| 新建 | `src/active-skill/derivative/`（8 套衍生技） | 替代旧 4 主动技（R2-6 整体退役）：沿用 ActiveSkill 控制器骨架（CD/充能/100ms 防抖/埋点，active-skill.ts:13-116）+ 效果纯函数注册表（参照 active-skill-effects.ts 模式）；CC 全走状态层（§4.8 对照表） |
| 新建 | `src/weapons/ammo.ts` | 声明式弹药组件（§4.9 四字段：弹量上限/当前/装弹时长/装弹状态）+ `usesAmmo` 声明；纯函数层可单测 |
| 新建 | `src/relics/`（relics.ts + relic-engine.ts） | 圣物 ×5：获取（Boss 必掉池/祭坛概率池）、专用按键（第 2 技能键）、CD 240s、局内 1~2 次上限、演出触发（≥1.5s 全屏级、可降级） |
| 新建 | `src/weapons/companion/`（守誓者） | 友方常驻实体：HP/承伤转移/墓碑/复活进度（§4.4 全规格）；依赖 enemy.ts 索敌扩展 |
| 改造 | `src/config/balance.ts` → 新表 | `EXCLUSIVE_WEAPONS`（8）/`MUTATION_CARDS`（16，含顺序解锁前置）/`RELICS`（5）/`DERIVATIVE_SKILLS`（8）；**前置依赖 balance 拆分**（CR T2） |
| 改造 | `src/weapons/weapon-system.ts:281-322` | 构造期多武器注入：`applyInitialWeapon`（:368-371 单武器门控）泛化为 `applyLoadout(weaponIds[])`；初始门控列表（:315-321）重排 |
| 改造 | `src/scenes/PlayScene.ts` 开局段（:264-273）与施法段 | 专武装配 + 衍生技控制器替换旧 ActiveSkill 装配（:333-339, :1093-1104）；圣物键输入接线（input 域新增第 2 技能键，keyboard/touch 两适配器） |
| 改造 | `src/weapons/super-weapons.ts`/`evolution-engine.ts`/`super-weapon-behavior.ts` | **退役不删除**：行为资产进图鉴退役区收档（NW-5）；`WeaponSystem.evolve`（:379-391）保留原子切换模式供共鸣复用（§1.4）；进化达成率遥测口径退役 → 专武质变达成率（新埋点） |
| 改造 | `src/ui/hud.ts` / `src/input/*` | 弹巢 6 点点阵 HUD、圣物键 + CD 环 + 次数指示、守誓者随行 HP 条（§⑦） |
| 改造 | `src/stats/run-stats.ts` + 结算 | 质变达成率/圣物占比遥测埋点 |

**改造要点（对照现有实现）**：
- **行为注册表扩展模式已验证**：14 通武全部走 `WeaponId→WeaponBehavior` 注册（weapon-system.ts:306-321），8 专武照方抓药；质变卡 = 行为内形态参数覆写（参照类强化 applyClassUpgrade 广播模式 :339-341），卡 2 赠送管线 = 新事件 + 待发队列（§6.1-4 防卡死规则**必须实装**）。
- **衍生技 = 旧主动技骨架复用**：旧 4 技的控制器（CD/充能/输入锁/埋点）与结算管线（PlayScene tryCastActiveSkill 段）可直接承载新 8 技；效果纯函数重写，占位红线从「≤15% 硬线」改「12~18% 锚」（balance.ts:312-335 ACTIVE_SKILL_RULES 修订）。
- **弹药维度零侵入**：`usesAmmo` 未声明的 13+7 武器零改动（验收判据 ⑧-7 回归断言）；圣徒左轮装填真空/处决装填/无限弹期均为 ammo.ts 纯函数参数。
- **圣物**：Boss 掉落钩子在 `spawnBoss`/`BossDefeated` 事件链（PlayScene.ts:640-703 一带）已有点位；祭坛=地图事件新实体（现无祭坛系统，S 规模新建）。

**工作量**：**L，16~24 人日**（8 行为 + 8 衍生技 + 弹药 + 圣物 + 守誓者 + HUD/输入）。
**依赖**：CC 状态层（衍生技 CC）、balance 拆分；守誓者依赖索敌扩展；质变卡 2 渠道挂 FQ-1（不阻塞代码）。
**风险与回归面**：weapons 135 it 中 DPS 锁现值断言大量失效（WEAPONS.MISSILE 等 demo 数值 + 新表）；evolution-engine.test / class-upgrades.test（12→10 后）/ key-passives.test 需按新口径改写或退役；active-skill 57 it 大半重写（4 技→8 衍生技）；spawner/enemies 无直接波及。**「关技能可通 Boss」QA 用例（R2-14）需新增专项**。

---

### 1.3 gdd-resonance.md —— 共鸣/共鸣钥/通武池

**涉及模块与文件**：

| 类型 | 文件 | 说明 |
|---|---|---|
| 新建 | `src/weapons/resonance/resonance-engine.ts` | 双条件门控（持配对专武 ∧ 持共鸣钥）→ 原子形态切换。**复用 `WeaponSystem.evolve` 原子模式**（weapon-system.ts:379-391：清旧弹体→同 key 覆盖注册→不可逆 commit）——GDD §3.1 已明示此工程口径 |
| 新建 | 8 个共鸣形态行为（建议并入各武器行为文件或 `resonance/` 分区） | R-1~R-8 形态参数表（八字段模板 §3.2）；未配对形态 = 现行普通形态零变化（回归断言验收） |
| 新建 | `src/config/` 共鸣表 | `RESONANCE_PAIRS`（8 对）+ `RESONANCE_KEYS`（8 钥：旧 7 数值保留 + 葬仪铁钉新增） |
| 改造 | `src/upgrade/upgrade-apply-v2.ts:55-72` | 钥被动派生重挂：7 枚旧钥数值效果全保留、身份改为共鸣前置（R2 §B3）；新增葬仪铁钉「重击类冷却 −8%」需新冷却分类字段（适用 ≥2.0s 攻击间隔武器，§⑤ 表） |
| 改造 | `src/weapons/weapon-system.ts` | `unlockWeapon` 后触发共鸣条件评估（专武+钥+通武三态查询）；R-2 弹药互助回充计数（连弩命中 3 次→左轮 +1 弹）为跨武器联动，需事件或 ctx 通道 |
| 改造 | `src/codex/codex.ts` | 通武/强化卡/共鸣形态三类独立条目（验收 ⑧-5） |
| 改造 | `src/ui/levelup-overlay.ts` | 共鸣徽记（已持专武时高亮）/「可共鸣」灰态徽记（§⑦-1）/ 0.8s 定格演出（复用寻获模板） |

**改造要点**：
- 共鸣本质 = 条件化 evolve：进化引擎（类强化≥2 + 钥）退役后，其「条件评估 + 权重 ×5 + 保底席位」骨架完整平移给共鸣（条件换成「配对专武 + 钥」）。
- R-7 拖拽（位移非状态）、R-2 跨武器弹药网是两处非模板化行为，单独估算。
- 召唤上限共享（R-8 猎犬占月狼上限 + 锁存请求防连刷，§⑦-2）需要召唤物计数器从 per-weapon 提升为 per-owner 组。

**工作量**：**M~L，7~11 人日**（引擎 + 8 形态 + 钥重挂 + codex/UI）。
**依赖**：专武（配对专武存在性）、CC 层（R-1/R-4 控制效果）、升级池 v3（P2 席位 + 权重）；弹药框架（R-2）。
**风险与回归面**：weapons 135 it 中通武行为锁现值——**未配对 6 把「零变化」是强回归护栏**（验收 ⑧-1），建议先落该断言再动钥重挂；key-passives.test 全量改写；upgrade-apply-v2.test 钥段改写。

---

### 1.4 gdd-upgrade-pool-v3.md —— 升级池 v3（37 项 + P1~P5）

**涉及模块与文件**：

| 类型 | 文件 | 说明 |
|---|---|---|
| 新建 | `src/upgrade/upgrade-pool-v3.ts` | 37 项定义 + P1~P5 保底序列 + 席位优先级冲突裁决（P1>P2>P3>P4>P5，§⑧-3 **必须实装**）+ 阶段权重修订（专武卡 ×2×1.2S1 / 钥 ×1.2 / 达成 ×5 / P4 窗口） |
| 新建 | `src/upgrade/upgrade-apply-v3.ts` | 37 项效果写回（质变卡形态覆写 / 钥被动 / 通武强化 10 张 / 衍生技强化 8 张 / 全局 9 继承） |
| 退役 | `src/upgrade/upgrade-pool-v2.ts`、`upgrade-apply-v2.ts` | v2→v3 迁移完成后退役；**CR 技术债 T4（legacy 双池）顺势清偿**：PlayScene.ts:1054-1075 legacy else 分支与 upgrade-pool.ts/upgrade-apply.ts 一并删除 |
| 改造 | `src/config/balance.ts:1018-1054` | UPGRADE_POOL_RULES 重写（WEIGHT_EVOLUTION 废止、P 序列重排） |
| 改造 | `src/scenes/PlayScene.ts:1000-1075` | consumeUpgradeChoice 分支重写（evo_ 分支退役 → 质变卡/赠送管线分支）；bench 路径（:1005-1009）同步 |
| 改造 | `src/ui/levelup-overlay.ts` | 卡类徽记分区 + P1~P5 席位角标 + 触达 ≥44px（§⑧ UI） |
| 新建 | 赠送管线 | 质变卡 2 非池获取：精英宝箱渠道（FQ-1 挂账，怪物域回填）+ **兜底「距卡 1 后 N=8 次升级」待发队列**（§3.4）——建议两条渠道都实装为配置开关 |

**改造要点（v2→v3 迁移路径）**：
- v2 的骨架可整体继承：标签过滤（upgrade-pool-v2.ts:85-101）、三选一加权抽取（:342-391）、阶段权重乘序（:184-187）、满层剔除、解锁变体（P5 同款，upgrade-apply-v2.ts:237-251）。
- 保底序列改造点：P1 从「进化卡」→「质变卡 1」（全局限 1 次 + 30~60s 窗口）；P2 从「领先类钥」→「共鸣钥」（选法改「通武强化累计最高」）；P4 从「主动技强化」→「当前衍生技强化卡 1 张」（S2 中段第 8~14 次升级窗口，错过不补）；新增席位优先级同帧冲突裁决（v2 GUARANTEE_PRIORITY 五级已有惯例可扩）。
- up_g_1~9 全量继承（v2 §3.1 为唯一来源，防双源漂移——GDD §4.1 明示）。
- 单局可选 ≤30 断言 + 池定义 37 不膨胀断言（验收 ⑧-1/3）。

**工作量**：**M~L，7~11 人日**（v3 引擎 + apply + 赠送管线 + legacy 清偿 + 测试改写）。
**依赖**：专武（质变卡/衍生技卡）、共鸣（钥）；是「专武批 → 池批 → 共鸣批」串行链的中间环节（P2 席位可先占位后填）。
**风险与回归面**：**upgrade 80 it 几乎全量改写**（本 GDD 最大测试面）；config 130 it 中 upgrade-pool-config.test 全量重写；xp 36 it 不波及（§3.5 明确不动 XP 曲线）。ui 63 it 中 levelup-overlay 徽记/角标新增用例。

---

### 1.5 gdd-talent-tree.md —— 滤月余辉天赋树（merit → 树）

**涉及模块与文件**：

| 类型 | 文件 | 说明 |
|---|---|---|
| 新建 | `src/progression/tree/tree-config.ts` | 全节点表 ≈40 节点（树根 1 + 质变 10 + 属性 15 铺位 23 层 + 4 支线锚 14）：类型/效果/成本/前置/层门槛（30/120/260）/图鉴前置 L-1~4；三桶预算断言（tree 版 `allMeritBonusesWithinRedline`，§3.6） |
| 新建 | `src/progression/tree/tree-state.ts` | `unlockNode/spendPoints/respec`（替代 canEquipMerit/toggleMeritEquipped，merit.ts:103-113 退役）；`computeTreeApplication`（替代 computeMeritApplication，merit.ts:130-166）：质变段（阵容注入）+ 属性段（纯局内开关门控返回空，§3.8） |
| 新建 | `src/ui/tree-overlay.ts` | **整树界面全新建**（替代 merit-overlay.ts:1-438 整体报废，附录 A-1）：主干+四支线分区、节点三态、层门槛进度条、点亮 0.8s 灌注演出、主菜单入口替换。**移动端适配 = 全项目最大风险**（§⑧ + §9.4） |
| 改造 | `src/stats/save.ts` | SAVE_VERSION 1→2 + 迁移：`treeState`（节点/层数/spent）+ `preselectedWeapon`（Q-d）新增；旧 `meritPoints` 1:1 平移、旧 4 加成折算对应属性节点 1 层自动点亮、`meritEquipped` 退役（§⑩-11）。**现 parseSave 版本不符即回退空存档（save.ts:73）——迁移函数必须先于版本号 bump 落地** |
| 改造 | `src/scenes/PlayScene.ts:1106-1118` | `applyMeritToStats` **树驱动重写**（附录 A-2）：质变节点注入开局阵容（Q-b 自带配对通武 / Q-d 预选通武 / s1 窗口增益 / s4 卡面前置）+ 属性段写 PlayerStats；保留「XpManager 装配前不得碰 this.xp」的时序纪律（:1117-1120 注释） |
| 改造 | `src/weapons/weapon-system.ts` | `applyLoadout` 多武器开局注入（b/d/s1 组合矩阵，§⑩-6；GT-7 全额 + GT-8 共存） |
| 新建 | 复活系统 | Q-c/Q-e：判定序（濒死护盾→圣物免死接口预留→天赋复活，§6.3）+ 50%/30% 递减 + 1.5s 无敌 + 击退 100px；接线 player.hurt 死亡判定链（player.ts:76-97） |
| 改造 | `src/scenes/PlayScene.ts` 击杀链 | Q-f1/f2/f3：每局首个精英击杀 → 额外三选一 offer（立即结算非暂存）；精英击杀点位在 `onEnemyKilled`（:687-733 一带），需 elite 识别 + 首个旗标 |
| 新建 | Q-s3 余烬 | 首次 HP 归零掉落 30 XP 宝石 / 无复活终局折算 +2 余辉 |
| 改造 | `src/ui/hud.ts` | 复活剩余次数小指示（**唯一局内 HUD 新增触点**，§⑧） |
| 改造 | `src/ui/results-overlay.ts` | 「余辉 +N」行替代旧功绩条 + 距下个节点提示（§⑧） |
| 退役 | `src/ui/merit-overlay.ts` | 整体报废（治疗道具规格 §11 不在替代范围） |
| 改造 | `src/codex/codex.ts` | 图鉴前置只读查询（不写 codex） |

**改造要点（merit.ts → 树配置表，对照附录 A-2）**：
- `calculateMeritPoints` + `save.meritPoints` 管线**沿用零改动**（GT-4 更名止于文案 UI）——这是本 GDD 最友好的工程决定。
- `MERIT_BONUSES`（merit.ts:33-44）→ tree-config；`meritImpactPct/allMeritBonusesWithinRedline`（:81-100）→ 三桶折算 tree 版。
- `PURE_IN_GAME_MODE_KEY` 沿用，语义从「全关」改「属性段空 + 质变全开」（§3.8，GT-11 状态标注：整体待商榷）。
- 开局流程重写是 PlayScene 装配序改动 + WeaponSystem 注入接口扩展的交点，见 §二.1。

**工作量**：**L，14~20 人日**（数据层 3~5 + 开局流程/质变节点运行时 4~6 + 树 UI 5~7 + 存档迁移/结算/HUD 2~3）。
**依赖**：专武（Q-b 配对通武映射、开局流程）；图鉴（L-1~4 只读）；BUG-5 裁决（成本表定版前置，不阻塞代码）。
**风险与回归面**：stats/merit.test.ts、save.test.ts 大半重写（merit 函数退役 + 迁移用例）；player 13 it（本就最薄）需补树属性段矩阵；ui/merit-overlay.test.ts 退役 → tree-overlay 新建测试。**开局重写波及 smoke/bench 路径**（PlayScene.ts:369-372, 500-520 一带跳过序章直进战斗，需同步适配新开局流程）。

---

## 二、跨 GDD 公共工程

### 2.1 开局流程重写（整合方案）

**现状装配序**（PlayScene.ts create，:213-520）：读 session-selection（hero/map）→ loadSave → WeaponSystem 构造 → `applyInitialWeapon`（:266 单武器）→ computeMeritApplication（:272，仅属性 delta）→ XpManager/升级池 → HUD → 序章 → RUNNING。

**目标流**（专武 §3.1 + 树 Q-b/d/s4 集成）：

```
BootScene/主菜单（角色+地图选定）
  → [新] WeaponSelectOverlay：左右分屏专武 2 选 1（树根 Q-a 语义；落存档位，进图前可重选）
       · 同屏：Q-d 预选通武页签（若 Q-d 已点亮；同名校验置灰）
       · 同屏：Q-s4 选项（消耗本局 1 次升级换 P4 前置，确认后锁定）
  → PlayScene.create：
       loadSave → computeTreeApplication（质变段+属性段）
       → applyLoadout([专武, Q-b 配对通武(普通形态全额), Q-d 预选通武])
       → 衍生技控制器装配（落选专武转化技，标注「转化为技能」）
       → 序章 PROLOGUE → RUNNING（s1 30s 窗口从 RUNNING 起算）
```

**工程要点**：
1. 选择结果落存档位（专武 GDD §6.1-4 断线重连：进图前可重选、进图后不可）——需 session-selection 扩展或 save 新字段，**建议会话级 + save 双写**（树 GDD A-4 已要求 preselectedWeapon 持久化，专武选择可先会话级）。
2. `applyLoadout` 是 weapon-system.ts:368-371 的泛化：门控逻辑从「关 a_1、开 initial」改「开集合、关其余」；ownedWeaponIds 初始化同步（:268）。
3. 组合矩阵回归（树 §⑩-6）：b 同名/异名 × d × s1 = 4+ 组合，「同名通武不重复发放」防重逻辑在 loadout 汇聚处去重。
4. smoke/bench 路径需脚本化默认选择（跳过选择演出，保持 60 帧/36s 判据）。
5. 装配时序纪律沿 QA-FIX-3 教训：树属性段写 PlayerStats 仍须在 HUD 装配前、XpManager 磁力同步点前（现 :1117-1120 注释的约束平移）。

### 2.2 CC 状态效果层骨架（三方共同依赖，最先落地）

```
src/combat/status/
  status-types.ts    # 封闭枚举 Stun|Slow|Vuln；新增须走 GDD 修订（§3.1 红线）
  status-engine.ts   # 纯函数：
    applyStatus(target, {type, value, duration, source}, now)
      # 同类取最强（stun 取最长剩余 / slow·vuln 取最高值，后到强者刷新重置时长，§3.2）
      # 硬控 ICD：per-target 10s 冷却表；起算时点=状态结束（推荐口径，注释写死，§3.3）
      # 抗性：resolveResistance(target) → {stunImmune?, durationMult}
      #        Boss: 硬控免疫 / elite: ×0.5 / 普通: 1（§3.4；每敌覆写字段位预留）
    queryStatus(target, type, now) → {active, value}
    tickStatuses(target, now)      # 过期清除 + 载体死亡同步移除（§⑦-3）
  status-config.ts   # §④ 登记表 15 项配置化 + ENEMY_CC_RESISTANCE 默认表
```

**接入点清单**（改动最小集）：
- `enemy.updateMovement`（enemy.ts:136-154）：改读 queryStatus(Stun/Slow)；
- `contact.ts:55`：眩晕期接触伤害阻止改读状态引擎；
- `damage.ts` computeHitDamage：易伤乘区；
- `weapon-behavior.ts` WeaponUpdateContext：注入 `applyStatus`；
- 旧 4 主动技 CC 函数改门面转发（过渡期兼容）；旧武器散落 CC（荆棘圣环 30%、血池 20~40%）逐项迁移登记。
- **同批评估**：enemy 索敌扩展（友方实体 selectable），守誓者依赖（专武 GDD §4.4 ⚠）——若守誓者排批次 2，索敌扩展放批次 1 末或批次 2 头均可，但**接口字段（targetFilter）建议批次 1 一次留好**。

### 2.3 弹药框架（声明式最小实现）

```ts
// src/weapons/ammo.ts —— 纯函数，§4.9 四字段
interface AmmoState { max: number; current: number; reloadSeconds: number; reloading: boolean }
interface AmmoConfig { max: 6; reloadSeconds: 1.0; ... }        // 处决装填后 0.7s（配置）
function consumeAmmo(s, n=1): AmmoState        // current 0 → 触发 reloading
function tickReload(s, dt): AmmoState          // 装填完成 → current=max
function grantAmmo(s, n, cap): AmmoState       // 处决装填击杀+1 / R-2 共鸣回充（上限弹巢）
function setInfiniteWindow(s, until): AmmoState // 衍生技 5s 无限弹（金光常亮 HUD）
```
- 声明 `usesAmmo: true` 挂武器配置；WeaponUpdateContext 增可选 ammo 通道；**未声明武器零改动**（验收 ⑧-7 回归断言）。HUD 弹巢点阵读状态渲染（逐点熄灭/呼吸闪烁/金光）。
- R-2 共鸣回充 = 连弩命中计数事件 → 左轮 grantAmmo，独立于本框架参数（恒 3 次，§④ R-2 强化正交行）。

### 2.4 balance.ts 拆分（CR 技术债 #2）——**建议本轮执行**

- **理由**：本轮新增配置表规模 ≈ 现有全库（8 专武 + 16 质变卡 + 8 衍生技 + 5 圣物 + 8 共鸣对 + 8 钥 + 37 池项 + 40 树节点 + CC 表），继续单文件（现 1092 行）将使 config 130 it 断言漂移与评审冲突风险翻倍；且难度重做（后续 monsters/difficulty 轮）同样以拆分为前置（CR §五.3-3）。
- **方案**：`src/config/` 按域拆文件（weapons/exclusive/resonance/pool/status/relics/tree/enemies/spawner/hero/map...）+ `balance.ts` 纯 re-export 兼容层（调用方零改动，CR 原方案）；先拆后建新表，新表直接落域文件。
- **工作量**：M（2~5 人日），批次 1 执行。

### 2.5 演出模板复用盘点

| 现有模板 | 位置 | 可复用于 |
|---|---|---|
| 技能姿态两段单帧（skill-a/b 450ms） | balance.ts:257-258、player.ts:113-120 | 8 衍生技施放姿态（参数化逐技） |
| 三选一金+冷青爆发 | PlayScene.ts:1004 levelUpBurst | 质变卡获取/精英抽卡 offer 提示 |
| ★ 解锁变体卡面 | upgrade-apply-v2.ts:237-251 | 通武寻获 0.8s 定格演出（共鸣 §3.5-3、树点亮灌注同模板——两 GDD 均明示复用） |
| 图鉴 toast 幂等合并 | codexToastPending（PlayScene.ts:184,1040） | 共鸣形态条目/质变卡首获 |
| 覆盖层宿主 + 设计空间缩放 + z-index 75 | overlay-host/overlay-scale/merit-overlay 惯例 | 树界面 / 专武选择屏 / 圣物演出 |
| panel-a11y Esc capture + 热区惯例 | panel-a11y.ts、merit-ui-spec §8 | 树界面双端热区 ≥44px |
| 序章屏三句自动推进 + 点击跳过 | prologue-overlay.ts | 专武选择演出（但须修复其 setTimeout 相位盲缺陷，CR BUG-4/T7——**选择演出不要复制该模式**） |
| 血月印记预警 2.5s | status-markers、enemy-spawner:128-153 | 圣物演出前置 / 祭坛事件提示 |
| 开局横幅 NarrativeDispatcher | narratives dispatcher | 质变节点开局来源徽记提示（树 §⑧） |

---

## 三、实施排布建议（分阶段）

与设计方「状态层最先」对齐，前置插入 balance 拆分与存档版本准备；共鸣排在池 v3 之后（P2 席位可先占位），树最后（依赖开局 loadout 接口稳定）。

| 批次 | 内容 | 依赖 | 验收口径 | 预估 |
|---|---|---|---|---|
| **B1 地基**：CC 状态层 + balance.ts 拆分 + 存档 v2 迁移骨架 + 旧 CC 收编清点 | 无 | 状态层 GDD ⑧-1~4 全条（含同版本版本号绑定）；新表全量 re-export 兼容（873 全绿为门禁）；迁移函数 + 用例先行 | **6~9 人日** |
| **B2 专武主体**：8 专武行为 + 8 衍生技（替旧 4 技）+ 弹药框架 + 圣物层 + 守誓者 + applyLoadout 开局注入 | B1 | 专武 ⑧-1/3/4/5/6/7；未声明武器零变化断言；关技能通 Boss QA | **16~24 人日** |
| **B3 升级池 v3**：37 项 + P1~P5 + 席位冲突裁决 + 质变卡 2 赠送管线（兜底 N=8 可配置）+ legacy 双池清偿 | B2 | 池 ⑧-1~5；upgrade 80 it 改写完成 | **7~11 人日** |
| **B4 共鸣**：8 对 + 8 钥重挂（含葬仪铁钉）+ resonance-engine + 未配对零变化回归 | B3（P2）、B1 | 共鸣 ⑧-1~4；6 把普通形态零变化断言 | **7~11 人日** |
| **B5 天赋树数据层 + 开局重写**：tree-config/tree-state + PlayScene 1106-1118 树驱动 + Q-c/e/f/s1/s3/s4 运行时 + 存档迁移实装 | B2（Q-b 映射、loadout） | 树 ⑩-1/2/5/6/7/8/9/11；b/d/s1 组合矩阵 | **10~15 人日** |
| **B6 UI/结算/遥测**：树界面（含移动端适配攻坚）+ 专武选择演出 + HUD（弹巢/圣物/复活次数）+ 结算余辉行/质变达成率 + 全量遥测 + 5000-run 沙盘接入 | B5 | 树 ⑩-3/12；专武 ⑧-2/8；遥测口径全部上线 | **9~14 人日** |

**合计 ≈55~84 人日**。B2 内部可再切「守誓者/圣物」子批以提前消化索敌扩展风险；B6 树界面建议在 B5 期间先出交互原型（风险前置，见 §五 R1）。

### 需用户裁决的工程决策点

| # | 决策点 | 工程建议 |
|---|---|---|
| EG-1 | balance.ts 拆分是否本轮执行 | **是**，批次 1（理由 §二.4） |
| EG-2 | 旧 4 主动技/超武/进化链代码退役方式：删除 vs 归档 | **归档不删**（超武行为资产图鉴退役区收档是定稿；进化引擎建议 `legacy/` 目录停用保留，共鸣复用其原子切换骨架后再清） |
| EG-3 | 质变卡 2 渠道在 FQ-1 回填前如何实装 | **双渠道配置开关**：默认兜底「距卡 1 后 N=8 次升级」，精英宝箱渠道预留（挂怪物域） |
| EG-4 | 守誓者 HP 口径（×150% vs 固定 200，专武模拟项 #12） | 配置双值，默认固定 200（数值可读性好），模拟定版后收口 |
| EG-5 | ICD 起算时点 | 按 GDD 推荐「状态结束时开始」，注释写死（§3.3） |
| EG-6 | 移动端树图方案（滚动 / 分区 tab / 列表化降级） | 建议先做「纵向主干 + 支线 tab」滚动原型过 UX 复核，列表化为降级预案（§五 R1） |
| EG-7 | 纯局内模式 GT-11 待商榷 | 保留开关，按 §3.8 实现「属性段空 + 质变全开」；不投入额外 UI 承诺 |
| EG-8 | 树成本表定版时点（BUG-5 挂账） | 成本进配置表，首版按锚点值 + 总成本 800~1000 断言；BUG-5 关闭前只调配置不改代码 |
| EG-9 | 衍生技 CD/占比红线修订落点（≤15% 硬线 → 12~18% 锚） | ACTIVE_SKILL_RULES 随 B2 修订，占位校验从硬断言改遥测口径 |

---

## 四、测试策略

### 4.1 需改写的现有测试（锁现值 → 区间/行为断言）

| 测试域（it 数） | 处置 |
|---|---|
| upgrade 80 | **全量改写**：v2 40 项 → v3 37 项；保底 P 序列、权重、席位冲突用例重建 |
| config 130 | upgrade-pool-config 重写；weapon-config 扩专武/共鸣/圣物/树表断言；balance.test 锁现值 → 「域文件 re-export 等价 + 新表区间」 |
| weapons 135 | DPS 锁现值 → 平台带区间断言（开局 DPS 9~16 / 双路线差 ≤±15%，专武 §⑤）；evolution-engine.test 退役归档；class-upgrades.test 12→10 改写；key-passives.test 钥重挂改写；新增未配对 6 把零变化 + 未声明弹药零变化两组强回归 |
| active-skill 57 | 4 技 → 8 衍生技重写；CC 类用例走状态层断言；红线口径 15%→12~18% 改区间 |
| stats 54 | merit.test 大半退役 → tree-config/tree-state 断言（总成本 800~1000、三桶 ≤8%/≤6%/≤10%）；save.test 增迁移矩阵 |
| enemies 52 | status 字段迁移复核 + 新增免疫/折减用例；spawnByConfig 抗性字段位 |
| ui 63 | merit-overlay.test 退役；新增 tree-overlay / 专武选择屏 / HUD 弹巢-圣物-复活次数用例 |
| player 13 | 补树属性段写回矩阵（本就最薄，重做主战场，CR §6.2） |
| combat 14 | 增厚：易伤乘区 / ICD 拦截 / Boss 免疫 / 精英 ×0.5 矩阵 |
| spawner 53 / xp 36 / fx / 其他 | 基本不波及（Q-f 只在击杀链消费；XP 曲线明确不动） |

### 4.2 新增测试清单

1. `status-effects.test`：§④ 登记表 15 项逐条 来源-状态-参数断言；叠加取最强 / 异类共存 / ICD 拦截比 / 载体死亡同步清除 / Boss 免疫（守夜环灯眩晕 0 次生效）。
2. `ammo.test`：消耗-装填-处决补弹-无限弹窗-R2 回充上限六态。
3. `tree-config.test`：40 节点计数（26 主干+支线）、层门槛、L-1~4 前置、三桶断言、总成本区间。
4. `tree-state.test`：unlockNode 前置校验 / spendPoints / 层门槛防跳点 / respec 全返 / 纯局内属性段空。
5. `save-migration.test`：v1→v2（meritPoints 1:1、4 加成折算 1 层、meritEquipped 退役、损坏回退 + .bak）。
6. `opening-flow.test`：loadout 组合矩阵（b×d 同名/异名 × s1）+ 同名去重 + smoke/bench 快速路径。
7. `mutation-cards.test`：顺序解锁 + 待发队列（卡 2 先开）+ 满级剔除。
8. `relics.test`：Boss 必掉 / 祭坛概率 / CD 240s / 每局 1~2 上限 / 占比遥测。
9. `resonance.test`：双条件门控半满足不触发 / 原子切换在途弹体结算完毕 / 强化正交。
10. `revive.test`：判定序（护盾→圣物预留→天赋）同帧不叠用 / 50%/30% 递减。
11. `elite-offer.test`：仅首个精英 / f1→f2→f3 前置 / offer 立即结算。

### 4.3 5000-run 模拟沙盘接入点

- 以 `tests/unit/spawner/c3-tank-simulation.test.ts` 模式 + bench headless 管线为基础建 `sim/` 整局沙盘（20 种子 × 4 角色 × 3 图 × loadout 矩阵），输出每 30s 的 DPS/承伤/等级指纹——**这是 CR §五.3-2 已登记的最大缺口，本轮武器/成长数值锚点全部依赖它**。
- 验证路径：专武附录 B 21 项 + 树附录 B 18 项（合计 39 项数值锚）+ 共鸣 8 项 + 池 7 项 + 状态层 5 项 ≈ **59 项锚点**逐项映射到沙盘输出指标（开局 DPS 带、Boss 时长、占比、uptime、抽取密度、余辉产出节奏）；沙盘先行于 B2 动工（B1 末期搭骨架），否则专武数值是盲调。
- 5000-run 全量跑作为批次验收门（B2~B6 各自跑锚点子集），锚点改配置不改测试结构。

---

## 五、风险登记表

| # | 风险 | 影响 | 缓解方案 |
|---|---|---|---|
| R1 | **移动端树图适配（最大风险）**：≈40 节点 T3 树在移动端画布内的可读性/触达 | 树 UI 返工；若压测帧率超标拖累局内 | 可行方案：a) 纵向滚动主干 + 支线 tab（推荐，树深度 ≤4、层宽 ≤3 天然窄列，适配 overlay-scale 设计空间 + 滚动容器）；b) 列表化降级（按枝分组节点列表，牺牲「树」观感保可用）；c) 缩放平移画布（否决——移动端 pan/zoom 成本高）。热区 ≥44px、关键数值 ≥16px 物理沿用 merit-ui-spec §8。**建议 B5 期间先行原型过 UX**（EG-6） |
| R2 | **存档旧档迁移**：现 `parseSave` 版本不符即回退空存档（save.ts:73）+ 全空存档误判 .bak 备份（:96-104）——直接 bump 版本号会静默清掉全量玩家进度 | 玩家进度丢失（不可逆） | 迁移函数先落地再 bump SAVE_VERSION；v1 数据整体保留读入（meritPoints→余辉、4 加成→节点 1 层）；损坏 .bak 机制已备；迁移矩阵用例（§4.2-5）+ 真机旧档手测双端 |
| R3 | **开局流程重写回归面**：PlayScene create 装配序脆弱（QA-FIX-3 三个时序教训：HUD 初始态、xp 磁力前置、per-run reset）；b/d/s1 三武器 + 衍生技 + 树属性段叠加 | 开局态错乱 / smoke、bench 判据破坏 | applyLoadout 单一汇聚点去重；组合矩阵回归（树 §⑩-6）；smoke/bench 脚本化默认选择；装配时序断言（属性段在 HUD 前、xp 磁力同步点前） |
| R4 | **FQ-1（精英宝箱产出）挂账**：质变卡 2 渠道未定 | 卡 2 无法定版 | 不阻塞代码：兜底 N=8 升级管线先行（EG-3 双渠道开关）；渠道回填 = 怪物域轮纯配置接入 |
| R5 | **BUG-5（功绩产出 +1/局 vs 设计 28~32）挂账**：树成本表不能定版 | 全树 28~35 局节奏失真风险 | 成本表配置化 + 区间断言（EG-8）；修复优先级按树 GDD §3.4 = 修获取公式 > 调成本；本轮工程侧不预设裁决 |
| R6 | **PlayScene god-file（CR T1，1277 行）**：开局重写 + 衍生技装配 + Q 节点运行时 + 击杀链改动全部压入单文件 | 回归面失控、评审冲突 | 建议 B1~B2 间先拆 SkillController/开局装配模块（L 债，可只拆本轮必碰的两块：开局装配段 + 技能结算段） |
| R7 | **守誓者/月狼多召唤物性能**（专武模拟项 #21）+ 友方索敌扩展 | 移动端帧率预算 | 索敌扩展按「可选 targetFilter」最小实现；召唤物并入既有对象池；移动端 runtime-config 分档已有惯例 |
| R8 | **873 测试锁现值规模**：~15-20 文件改写 + 新增 ~11 测试文件 | 批次间绿灯门禁变慢 | 区间断言先行策略（CR §五.3-1 沿用）；每批验收 = 全绿 + 沙盘锚点子集通过 |

---

## 六、下一步建议

1. 用户裁决 EG-1~9（至少 EG-1/EG-3/EG-6 三项影响批次 1~2 开工）。
2. 批次 1（CC 层 + balance 拆分 + 存档迁移骨架）可立即开工，无外部依赖。
3. B1 末期搭建整局模拟沙盘骨架，B2 前产出「开局 DPS 平台带」基线指纹，供专武数值锚点校验。
4. 本报告与设计方 GDD 的交叉确认项：树 GDD §⑩-6 组合矩阵与专武 GDD §6.1-4 断线重连口径已在 §二.1 整合；Q-s4 与池 v3「P4 窗口错过不再出现」的措辞复核已在树 GDD §4.1 Q-s4 边界登记，实施前由设计方确认一次。

> 下游：主理人排期裁决 → 批次 1 开工 → 怪物域重做（FQ-1 回填 + 硬依赖 ⑨-1 验收）与本轮无阻塞并行。
