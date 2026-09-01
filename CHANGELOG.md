# 变更日志（Changelog）

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与 [Semantic Versioning](https://semver.org/lang/zh-CN/)。
版本号唯一权威来源：package.json；发布升版规则见 `production/release/versioning.md`。

## [Unreleased] - v0.8 五系统重做全量（批次 A~G + P2 清零 + 模拟冻结，2026-09-02）

> v0.8 重做全量落地：设计（八份 GDD v1.x 定稿）→ 工程（批次 B1~F + 审查修复 A~G + P2 清零）→ 数值冻结（5400 局沙盘实证）。版本收口清单见 `production/official-v1/release-0.8-checklist.md`；待真机验收通过后定版 **0.8.0**。

### Added

- **武器系统重做**：8 专武（开局 2 选 1、EXCLUSIVE_SELECT 相位）+ 8 衍生技（落选转化）+ 16 质变卡（P1 保底/精英宝箱双渠道）+ 圣物层 ×5（Boss 出场即发 + 祭坛、专用键、CD 240s、伤害占比 <5%）+ 声明式弹药框架（左轮 6 发弹巢）。
- **共鸣系统**：8 对共鸣改造 + 共鸣钥 8 枚（P2 保底）+ 共鸣徽记四态 + 0.8s 定格演出 + 图鉴共鸣条目 8 条。
- **成长系统重做**：滤月余辉天赋树 ≈40 节点（质变 9 运行时：复活判定序/伴灯/携行旧兵/首猎之赏/遗言余烬/双灯并祀）+ 属性三桶（伤害 ≤8%/生存 ≤6% 总口径）+ 功绩体系替代（存档 v3 迁移）+ 升级池 v3（37 项 + P1~P5 保底 + P4 窗口/前移 + N=8 发卡 2）。
- **怪物域重做**：敌种 16 配置（突袭 lunge 前扑/远程精英掷骨者+忏悔者/石甲狼两阶段）+ 精英技能化 180s 门控 + Boss 五技能槽（每只 ≥2 可解 zone 技能）+ 方阵 9 阵（首版 7：追猎/苏生/宝藏护卫/腐朽骑士团/围猎/血旗/锁链）+ 组黑板协同 AI + 召唤物 noXp。
- **CC 状态效果层**：减速/眩晕/易伤封闭枚举 + 同类取最强异类共存 + ICD 10s + Boss 硬控免疫/精英 ×0.5 + 蓄力打断（MN-20）+ 状态微标 + Boss 免疫飘字。
- **数值冻结（5400 局沙盘实证）**：XP `c-标准`（needXp 4/3/6 · 敌 XP ×0.55 · 敌 HP ×1.125）+ budgetPiecewise 五端点 + M3 面板缩放（0~60s 豁免/滞后宽容）。
- **图鉴**：共鸣条目 8 条 + evo 退役区 + 守誓者/敌怪新档案；规模 50 → 60。
- **UI**：滤月余辉树界面 + 专武 2 选 1 演出 + HUD（弹巢点阵/圣物键/复活次数/共鸣徽记）+ 结算余辉行 + 升级卡席位角标/卡类徽记/共鸣预览 + telegraph 预警层。

### Changed

- **PlayScene 结构拆分**：2015 → 1200 行，拆出 8 个协作模块（`src/scenes/run/*`，行为零变化）；模块图见 `docs/architecture/architecture.md` §3.1.1。
- **双轨隔离收口（EG-2 归档不删）**：超武 `evolve` throw 守卫（资产保留）、旧主动技/升级池 v1 归档、merit-overlay 退役（存档迁移保留）。
- **通武池重设计**：14 池保留、6 把普通形态 + 10 张通武强化卡（叙事化命名）。
- **升级池红线**：定义 37 / 单局 ≤30 / 机制型占比 ≥85%（断言锁死）。

### Fixed

- **BUG-3/4/6**：结算页矮视口（scale 折回）、序章 timer 随相位冻结 + Esc 消费、音频手势节流 resume。
- **树界面交互卡死**、血猎手索敌实时刷新、提灯/左轮视觉可见化、P4「已取」查错 id（`dv_*` → `up_d_*`）+ 窗口外剔除、N=8 发卡 2 失效、圣物空技能（银潮汐补齐）。
- 审查 P0×8 + P1×18 全量：详见 `production/official-v1/项目审查结论-v0.8-2026-09-01.md` 与 `review-fix-report.md`。

### Removed

- 超武机制（7 把 + 进化卡）——行为拆解回流 + 图鉴退役区（NW-5，资产保留）；旧主动技 4 技体系（衍生技替代，`_archived/` 快照）；守夜功绩 UI（天赋树替代）。

### 规模

- 提交：v0.5.0（967d1b5）以来 **90+ commits**；测试 **873 → 1368**（+495）；PlayScene 2015 → 1200 行。
- 数值冻结依据：`sim-freeze-recommendation.md`（5400 局沙盘 + A/B 零漂移实证）。

## [Unreleased] - NV-REVIEW-FIX 批次 F（2026-09-01）

> v0.8 审查修复批次 F：结构拆分 + 双轨收口 + 三 BUG。审查结论见 `production/official-v1/项目审查结论-v0.8-2026-09-01.md`，批次报告见 `production/official-v1/review-fix-f-report.md`。

### Changed

- **PlayScene 结构拆分（W-F1 / P1-7）**：2015 → 1200 行，按「机械搬移 + 端口注入」拆出 8 个协作模块（`src/scenes/run/*`：BenchSmokeRunner / BossSkillConsumer / ExclusiveRunAssembler / RelicFieldRunner / UpgradeFlowController / DerivativeCastBridge / KillLootConsumer / TreeApplier），行为零变化（测试全程保持绿）。模块图见 `docs/architecture/architecture.md` §3.1.1。
- **双轨隔离收口（W-F2 / EG-2，归档不删）**：`WeaponSystem.evolve` 加 throw 守卫（原实现归档 `evolveArchived`）；`ACTIVE_SKILLS` 与 `active-skill-runtime` 旧轨标注 `@deprecated`；`merit-overlay` 运行时入口隐藏（树界面替代，存档迁移保留）。不可达断言 7 例（`tests/unit/review-fix-f.test.ts`）。
- **P2-6**：方阵每局次数锚 `[4,7]` → `[3,4]`（对齐 GDD v1.1）。
- **P2-2**：升级卡席位角标按 P1~P5 明示（`matchGuaranteeSeatV3` 席位号透传 → `levelup-overlay` 渲染「P1 保底」…「P5 保底」）。
- **P1-16 BUG-4**：序章自动推进 timer 改 Phaser Scene clock（随相位冻结/场景销毁）；PROLOGUE 相位内 Esc 由序章消费（推进/跳过）。
- **P1-17 BUG-6**：音频 unlock 失败后 `pointerdown`/`keydown` 常驻监听节流（800ms）重试 `ctx.resume()`。

### Fixed

- **BUG-3 结算页矮视口（P1-15）**：`results-overlay` 的 dvh/dvw 上限除以 `--bmv-overlay-scale` 折回设计空间，1280×656 下面板可用高度恢复满幅（1280×656 断言在 `review-fix-f.test.ts`）。
- **测试补强**：EXCLUSIVE_SELECT 相位矩阵用例（`tests/unit/core/phase-exclusive-select.test.ts`）、P2-6/P2-2 断言、PlayScene×8 模块协作接线守卫；共 +25 用例。

## [0.5.0] - 2026-08-28

> 正式版第一个稳定落定版：M0~M3 全量里程碑 + R2/R3 两轮外部测试修复。版本总结见 `production/release/v0.5-summary.md`。

### Added

- **4 角色差异化**（守夜人/血猎手/夜祷修女/狼裔）：主动技 4 技（施法姿态 + 分模板 VFX）、专属被动、成长曲线；启动页角色选择栏，**四角色三图全开放选择**。
- **武器系统扩展**：14 武器（四类手感）+ 7 超武进化（类强化成型 + 持钥 → 进化卡必占一席）。
- **敌人与 Boss**：15 敌（相位/光环/召唤/远程/冲锋 5 类特殊行为，均有反制）+ 4 Boss（阶段 2 + 专属入场演出）。
- **3 地图**：月下墓地 / 血教堂 / 狼穴（差异化生成器、障碍密度、血池危险区、专属 Boss）。
- **升级体验 v2**：40 项升级池（机制型 90%）、向心性保底席位 P1~P5、阶段节奏权重、数值卡方向化（武器共鸣/专精疾射/鲜血契约/踏月而行）、进化前置（达成率 84~100%）。
- **叙事与局外**：世界观圣经 v1.1 + 轻叙事 42 条（序章屏 PROLOGUE / 局内点缀 / 进化播报 5 系）、图鉴「守夜日志」50 条三态卡、守夜功绩（4 加成/装 2/纯局内开关）、存档、治疗道具。
- **遥测与测试辅助**：结算页真机遥测 5 项 + `window.__BMV_LAST_RUN` + `?qa=1` 控制台辅助（`__BMV_QA.unlockAll/setHero/setMap/status`）。
- **美术资产管线与批次 1~4 入仓**：外部素材契约（194 帧名注册表 + CI diff）、`tools/asset-pipeline/` 门禁（同族缩放/脚底对齐/时间轴 41-17 台账）、程序剪影双轨兜底。
- **测试计划**：R3 外部测试计划 v1.1（功能/美术/体验三层 + P0 回归矩阵 + 遥测采集表）。

### Fixed

- **BUG-1 升级界面隐形卡死（Blocker）**：已进化 P1 幂等 + LEVEL_UP 强显隐 + 键盘保底 + 无可选不进相位（R3 三态矩阵验证通过）。
- **BUG-2 启动蒙层挡面板（High）**：mask 让位 + Esc 关面板 + 焦点陷阱（R3 验证通过）。
- **`__BMV_LAST_RUN` 跨局串号**：RunStats per-run reset（含功绩首杀跨局累加虚报源）。
- **merit 加成 HUD 显示与磁力白屏崩溃**：HUD 装配后同步真实数值；磁力加成改由 xp 装配后读取。
- 敌潮移速口径注释、荆棘圣环减速恢复口径、结算标题对齐叙事 v1.1。

### Deferred

- **难度两极**（前期 35~42s 首死 vs LV20+ 满血雪球）：后续版本从根源系统性重做武器/成长/怪物生成/怪物设计（诊断与数据已留存）。
- BUG-3 结算页视口适配 / BUG-4 序章 Esc 双响应 / BUG-5 功绩账本裁决（待单标签 5 局重采）/ BUG-6 音频手势 resume / 姿态观感增强 / pivot 接入（m4-backlog）。

## [0.1.0-Demo] - Unreleased

> 垂直切片 Demo（当前内部基线，未发布）。R3 通过后正式验收发布，届时升版 **0.2.0**。
> 首个可完整游玩 20 分钟循环的版本：移动 → 击杀 → 经验 → 升级三选一 → 变强 → 20:00 Boss 收束 → 结算重开。

### Added

- **垂直切片核心玩法（E1–E4，22 Story）**：
  - 工程地基与移动（E1）：Vite + Phaser 3.90 + TS 脚手架、core 基建（事件/状态/时间/对象池）、RuntimeConfig 双端配置、键盘 WASD/方向键 + 移动端虚拟摇杆、3000×3000 地图边界与障碍碰撞。
  - 战斗闭环（E2）：伤害结算、3 种敌人（僵尸/疾行/厚血）、三武器（自动飞弹「血月猎手」/护体环绕球「守夜之环」/定时冲击波「月蚀脉冲」）、敌潮生成器（budget 压力曲线）。
  - 成长闭环（E3）：经验宝石与磁吸、need 升级曲线、12 项升级池（机制型 75%）、升级三选一 DOM 覆盖层、效果即时写回。
  - 收束与性能（E4）：HUD（DOM、0 draw call）、Boss「血月尊者」（6000HP/0.5s 霸体/顶部血条）、20:00 清场收束、结算页（存活/击杀/等级/build 回顾 + 再来一局）、性能基准与双端真机验证。
- **重开率埋点**：SessionStats（restartCount → 重开率，TASK-21），支撑 concept §9 留存判据。
- **剪影 v2**：程序生成高对比剪影（procedural-textures + 草地双材质，art-bible v0.3），敌我形状区分、描边纪律、双端可读。
- **音频引擎**（src/audio）：WebAudio 程序心跳层 + 6 项基础 SFX（武器发射/击杀闷响/宝石叮声/受击/选卡确认/Boss 出场）+ 手势解锁（audio-bible 首版必落）。
- **工程与发布基建**：git 仓库初始化（单提交 86eafcd）、283 单测（33 文件）、Playwright 冒烟、WorkBuddy 轻应用发布流程（production/release/）。
- **TASK-28 画面表现力专项**（src/fx + 环境氛围 + 双帧动画）：
  - 程序化 FX 粒子系统（fx-manager/fx-math/fx-spec/anim）：飞弹拖尾 / 环绕残影 / 冲击波涟漪 / 击杀溅射 / Boss 出场环，池 ≤200 桌面 / ≤100 移动，移动端 fxTrails=false 降级；粒子共用 fx-ambient 白底帧 + tint（1 组批次，+0 新贴图）。
  - 双帧角色动画：玩家 / 3 普通敌 / Boss 各 +1 变体帧（`*-v`，idle 1.4fps / move 9fps），随 applyPhase 暂停/恢复，同图集换帧 +0 draw call。
  - 环境氛围：血月天幕（moon 帧）+ 暗角渐晕（vignette 帧）+ 地面贴花 ×3（decal-rock/grass/blood），收敛 1 图集 fx-ambient（ambient +1 组批次）。
  - 纹理烘焙色值全量收敛为 token 派生（`hexToRgba`，code-review P1-2）；Boss 变体帧坐标收进 120px 帧界（美术复核 C-1 阻塞项修复）。
  - 新增 11 项单测（tests/unit/fx 9 + tests/unit/utils 2）；全量 294 单测（36 文件）。
- **TASK-33 矢量图标 DOM 落地**（src/ui/icons.ts + 升级卡 / 武器槽集成）：
  - 15 项矢量图标（升级卡 12 + 武器槽 3）由 Ardot 画布导出 SVG，本模块内联为模板（零静态资产、+0 draw call 增量）。
  - 编码总则（asset-spec §3 一眼分型）：机制型 = 蓝紫底 PALETTE.baseLight + 信息蓝描边（1/2 号带 ★ 星徽 = 新武器解锁）；数值型 = 琥珀金底（读"数字加多少"）。
  - **token 统一来源纪律**：模板内颜色一律 `{{token}}` 占位符，`ICON_COLORS` 全量派生自 balance.ts PALETTE / BOSS / GEM token（含新增 `PALETTE.uiPaper` 纸白），零散落字面量；同页多图标共存时 clipPath id 按 key 唯一化防 url 串扰。
  - DOM 覆盖层（levelup-overlay / hud）消费 `renderIconSvg()` 替换原 CSS 圆点占位；武器槽未解锁态降饱和变暗（区分解锁/锁定）；DOM 布局沿用 ux-spec §2/§3（升级桌面 128/移动 72、武器桌面 48/移动 44）。
  - 新增 9 项单测（tests/unit/ui/icons.test.ts：15 项 key 覆盖、类型分型、SVG 合法、token 解析、clipPath 唯一化、底色分型）；全量 303 单测（37 文件）。
- **TASK-36 剪影 v3 + 武器特效 P0 + 池契约修复**（src/fx/procedural-textures.ts + src/fx/fx-manager.ts + src/config/balance.ts 等 11 文件）：
  - **剪影 v3 P0**（按 silhouette-v2-spec）：玩家冷青提灯 + 帽带 + 三边开衩长袍；行尸颅骨裂纹 + 眉骨高光；血犬背脊棘刺 + 血口涎滴；屠夫屠刀（刃光纸白）+ 围裙带；Boss 冠上血月宝石 + 仪式权杖（杖首红宝石）。全部逐项过帧边界校验（Boss 放大 1.05 层 ≤120、屠刀刃光 x=22.5 ≤24、玩家开衩 ×1.12 ≤16）；帧名契约不变、色值全 token 来源、描边纪律不变。
  - **武器特效 P0**（按 weapon-fx-v2-spec，参数全收敛 `FX` 常量）：飞弹拖尾点→p-streak 彗尾（TRAIL_INTERVAL 90→70ms）+ 发射喷涌 + 命中冷青冲击环；环绕球自留尾迹 + 双层轨道环（外环 alpha 0.26/24°/s + 内环 0.12 反向 -12°/s）+ 命中火花节流 200ms；冲击波涟漪 18→36 加密提速（speed 90/size 4，移动端 24 降档）+ 最大半径白闪环 + 蓄力 2s 脉冲提示。+0 新增贴图批次（复用 fx-ambient p-ring/p-streak/p-circle），预算不变。
  - **池契约修复**（TASK-34 遗留建议）：`Enemy` 构造器 + `enemy-spawner` 的 `acquire` 显式传 `'characters'` + 帧名，与 XpGem/Boss/Missile 契约对齐，消除每次 spawn 的 `__MISSING enemy-zombie` 警告。
  - 新增 6 项单测（tests/unit/fx/fx-spec.test.ts：paper token 别名、拖尾帧、命中≤10、涟漪 36/24、白闪/蓄力、双层环常量）；全量 309 单测（37 文件）。

### Changed

- 厚血怪保底生成 20s→40s（TASK-15）→ 回调 30s（TASK-18）：修复前期厚血堆积超判据（E2 C3）。
- 冲击波改为"有目标才释放"（E2 C2 → E3 落地）：保宝石产出与清屏价值。
- **TASK-41 R1 波次 3 · 剪影 v3.5 强化**（R1 反馈 E3「主角剪影看不出是啥」；方案 design/art-bible/silhouette-v35-spec.md，src/fx/procedural-textures.ts）：
  - **P0-1 帽冠锥形尖顶**：playerShape 帽冠圆顶 → 锥形尖顶（两 pose 顶统一 y=-14；顺带修复 v3 pose1 顶 -15 的 0.8px 描边裁切 -16.8→-15.68 ✔）。
  - **P0-2 帽檐加宽 22→26px**：x±11→±13（×1.12=14.56 ≤16 ✔），帽檐成为全身最宽特征（26/32=81% 帧宽）。
  - **P0-3 提灯放大 + 光晕强化**：drawPlayerLantern 灯体 3×4→4×5、光晕 r2.8/α0.22 → 内圈 r4/α0.30 + 外圈 r5.2/α0.10（最右 x=15.7 ≤16 ✔）；保持描边层后单独绘制（TASK-36 约定）。
  - **P1-1 披风开衩加深 + 下摆加宽**：开衩 1.5×7→2×9（pose0 y4..13 / pose1 y4..14）、pose0 下摆 ±12→±13.5（×1.12=15.12 ≤16 ✔）。
  - **P1-2 屠夫屠刀加宽**：tankShape 刀身右缘 22→23（最右 x=23）、刃光 α0.55→0.75（48px 帧 x≤23.5 ≤24 ✔）。
  - 纪律：帧名契约不变、色值全 token（player/playerAccent/uiPaper/INK/enemyTank）、描边 1.12 冷青维持（不加粗）；移动端 LOD 由渲染缩放天然达成（相机 zoom=1 双端 32px，≤16px 时最近邻 2:1 自然丢弃帽带/开衩/光晕外圈亚像素，16px 仍保留尖顶/宽檐/提灯核心；createCharactersAtlas 的 cfg.isMobile 钩子留作未来 16px LOD 收敛位）。
  - 新增 11 项边界校验单测（tests/unit/fx/silhouette-bounds.test.ts，C-1 纪律：内容坐标 × 放大层 ≤ 帧半）；全量 342 单测（40 文件，基线 331 + 11）。
- **TASK-39 R1 波次 2 平衡落地**（用户已拍板：移速 235 / 厚血经验 10 / 首级强制武器；方案 production/gdd/balance-r1-tuning.md）：
  - **E1 磁吸强化**：`GEM.MAGNET_RADIUS 80→140`、`MAGNET_SPEED 320→360`（src/config/balance.ts）；升级第 9 项（磁力+100%）随之 140→280→420 不贬值。
  - **E1 E-lite 宝石慢漂**：落地 >3s 且距玩家 >磁吸半径的宝石以 80px/s 慢漂向玩家（src/xp/xp-manager.ts stepGem 新增 drifting 分支 + XpGem.age 字段）；进入磁吸半径后切换 360px/s 吸入，保留"地面战利品/贪心张力"。
  - **E1 玩家移速**：`PLAYER.MOVE_SPEED 220→235`（+6.8%，用户已批）。
  - **E2 敌潮重构**：`SPAWNER.LINEAR_SCALE 2.5→3.0`（20min 均值预算 4.2→4.8 点/s）、`WAVE_AMPLITUDE 0.4→0.3`（峰谷比 2.33→1.86 仍 ≥40%）；`SPAWN_STAGES` 四阶段权重按方案更新（0-3min 90/10/0、3-8min 78/20/2、8-15min 55/36/9、15-20min 45/35/16），屠夫随机 3%→2%、保底 30s 不动。
  - **E2 屠夫预警**：保底厚血出生前 2.5s 血月印记（`SPAWNER.TANK_WARNING_SECONDS=2.5`；enemy-spawner 预约落地时序 + PlayScene 红圈 p-ring 脉冲精灵 + audio-events 绑定低频重音，事件 `enemy:tank-warning`/`enemy:tank-spawned`）。
  - **E2 首级强制武器**：`rollThree(state, random, { forceWeaponFirst })` 保证首级三选一含 1/2 号（守夜之环/月蚀脉冲）之一（src/upgrade/upgrade-pool.ts；PlayScene 记首次抽取标志）。
  - **E2 厚血经验**：`ENEMIES.tank.xp 15→10`（E3 预授权判据 R1 Lv47 触发，压后期经验通胀）。
  - **文档同步**：`design/art-bible/art-bible.md` §4 精英"3 倍经验"口径改为 10、§7 拾取磁吸 80→140px（附 E-lite 漂移说明）。
  - 单测：新增 12 项（xp-manager 漂移 3 + 集成 1、upgrade-pool forceWeapon 4、tank-warning 时序 2、balance TANK_WARNING 断言并入既有项）；同步更新 §5.2 清单（balance/enemy-panel/player-stats/spawner/xp-manager 断言 220→235、80→140、15→10、预算新期望值）。全量 331 单测（38 文件，基线 321 + 10），`npm run bench` 通过（峰值 400/250、draw call 5、totalSpawned 3587）。
- **TASK-43 R2 节奏加速**（R2 用户反馈「约刷小怪到 15 级后才出现精英，希望继续加快节奏」；目标 3–5min 见首只精英 = 屠夫 600HP；方案 src/config/balance.ts + src/spawner/spawner.ts）：
  - **整体密度 +10%**：`SPAWNER.LINEAR_SCALE 3.0→3.3`，20min 均值预算 4.8→**5.16 点/s**，前期小怪/经验节奏同步提速；`WAVE_AMPLITUDE 0.3` 不动（峰谷比 1.86 仍 ≥40%，S8-3）。
  - **精英更早（双路径保障 3–5min）**：`SPAWN_STAGES[0]` 加随机 0.5% 厚血（0–3min），`SPAWN_STAGES[1]` 随机 2%→**3%**（3–8min），`SPAWN_STAGES[2/3]` 0.09→**0.11** / 0.16→**0.18**（中后段小幅上调，"中期到 Boss 过渡更平滑"）。`TANK_GUARANTEE_EVERY_SECONDS 30` 不动（C-7 决策记录：再降会退回"厚血未发现"，本次用"0–3min 随机 0.5% + 3–8min 随机 3% + 30s 保底"双路径达标，保底 3.5min 兜底）。模型实测（8/8 种子）：首只厚血 1.5–3.2min 出现，5min 节点场上厚血 ≤2（C3 FUNC-E2-07 仍达标），20min 经验有效值 ≥3000 / 可达 Lv30+（E3 预授权判据仍满足）。
  - **不破坏硬标准**：B1 接触链（contact.ts 纯函数）/ 首级强制武器（forceWeaponFirst）/ 屠夫预警 2.5s（TANK_WARNING_SECONDS）/ 移动端降档配置均不动；C-7 保底不动；敌人面板 HP/伤害/移速/半径不动（enemies §①"面板恒定"硬设计）。
  - **不破坏前置单测**：`c3-tank-simulation` 3 项（保底 30s 5min on-field ≤2 仍 ✔，3 个断言 0.05 内复算验证）、`tank-warning` 2 项（保底未动 + Math.random=0.5 mock 仍抽到僵尸，时序不变）、`xp-curve` 4 项（≥3000 / Lv≥30 下界仍 ✔）、`perf-assert`（峰值 400/250、draw call 5、totalSpawned 随 LINEAR ↑ 至 ~3900 仍 >3000）。同步更新断言 6 项（balance LINEAR_SCALE 3.0→3.3、spawner budget/budgetMean/权重/边界）+ 6 项陈旧期望值（2.1/3.0/4.8 → 2.19/3.18/5.16；90/10/0 → 89.5/10/0.5；78/20/2 → 77/20/3；55/36/9 → 53/36/11；45/35/16 → 47/35/18；边界 0.9/0.78/0.55/0.45 → 0.895/0.77/0.53/0.47），全部以"新模型实测值"为基线（非"改到绿"）。

### Fixed

- **TASK-43 R2 无敌回归 + 血条消失**（R2 反馈 P0：「看不到主角血条、碰怪不扣血不失败，处于无敌状态」）：
  - **运行时取证根因（Playwright + debug hook，1280×720 视口）**：伤害链本身正常（强制瞬移接触 hp 100→90、hp:changed 事件触发、120s 站桩+自动选卡自然接触 116→86/96→83/83→82 三次扣血、降低 hp 至 15 强制群殴 hp→0 触发 player:died → 「守夜失败」结算页）；**真正的根因 = DOM 覆盖层与画布不对齐**：Phaser Scale.FIT 把画布按视口等比缩放并居中（letterbox），但 `#ui-overlay`（含 HUD/升级/结算/暂停/启动覆盖层）此前以视口坐标系直接定位（CSS `inset: 0` + 设计空间坐标如 HP 条 top:1018px）。在视口高度 < 设计高（1080）的常见笔记本/轻应用窗口（1280×720 / 1366×768）下，**底部 HUD（HP 数值 1018 / HP 条 1042）渲染到可视区外** → 用户「看不到血条」；叠加自动飞弹远程击杀 + 玩家走位拉扯实际很少被怪贴身 → 看不到 HP 掉落 → 误判「无敌」（实际是"看不到 + 罕见被摸"）。无 console.error / pageerror / 异常（无 B1 类崩溃，伤害系统从 TASK-37 修复后即正常）。
  - **修复（架构级，保留 ux-spec 布局）**：新 `src/ui/overlay-scale.ts`（含纯函数 `computeOverlayLayout` 可脱离 DOM 单测 + `syncOverlayToCanvas(game)`）—— 把 `#ui-overlay` 同步到画布「渲染矩形 + 缩放」（布局按设计空间 1920×1080，transform: scale 缩放到画布实际渲染尺寸，再定位到画布左上角）。`main.ts` 在游戏创建后 + `Phaser.Scale.Events.RESIZE` + `window.resize` 三处调用同步函数。效果：1280×720 下 HP 条 (16,695) / HP 数值 (16,679) `inViewport: true` ✔；1366×768 下 (17,741) / (17,724) ✔；1920×1080 全屏 (24,1042) / (24,1018) 零回归（scale=1）。各覆盖层（升级卡/结算/暂停/启动）`inset:0` + 居中布局天然随 transform 落在画布内，指针命中由浏览器按变换矩阵反算（无破坏）。**不引入**新依赖、**不修改**任何覆盖层 DOM 结构/交互/动画（升级冷青描边 + 缩放、结算三段式统计 + 再来一局等全部沿用）、**不破坏** ux-spec §2 桌面 HUD（HP 仍底左、LV/XP 仍顶左、武器槽顶右）。
  - **回归单测**：新增 6 项 `tests/unit/ui/overlay-scale.test.ts`（满尺寸零回归 / 1280×720 HP 在视口内 / 1366×768 HP 在视口内 / 方形视口 letterbox HP 在视口内 / game-root 非零偏移 / designWidth≤0 防御）。**全套** 348/348 单测（41 文件，基线 342 + 6）绿、`npx tsc --noEmit` 0、`npm run bench` 通过（峰值 400/250、draw call 5）；Playwright e2e 冒烟通过；3 视口下死亡流程截图清晰：HP 0/100 显式可见、结算「守夜失败」居中可点。
- **P0 Bug1**：选卡后 WASD 持续按住失效（键盘恢复守卫）。
- **P0 Bug2**：移动端 DOM 覆盖层视口适配（升级/结算层在真机错位）。
- **P0 Bug3**：飞弹分裂无限弹射（同屏子弹数超预算 8；修复后 1 主弹 + 2 次级 ≤8）。
- **TASK-42 玩家冷青描边生效**（TASK-41 顺带发现的 pre-existing；src/fx/procedural-textures.ts）：`drawSilhouette` 放大层设计意图为「先画 outlineColor（玩家=冷青 PALETTE.playerAccent）1.12× → 再画主体白层」，但 `playerShape`/`bossShape` 内部首行 `ctx.fillStyle = PALETTE.player / BOSS.COLOR_MAIN` 覆盖了 outlineColor → 放大层实际是白色/同色，**玩家冷青 2px 描边自 v3 起从未可见**（白色 halo 隐于白身）。修复（方案 B，shape 收 bodyColor 参数）：`drawSilhouette` 放大层显式 `shape(ctx, outlineColor)`、主体层用 shape 默认 bodyColor；`playerShape(ctx, pose, bodyColor?)` / `bossShape(ctx, pose, bodyColor?)` 用 `bodyColor ?? 默认色`；4 处图集闭包改为 `(g, color) => playerShape(g, pose, color)`。效果：玩家 = 月银白主体 + 可见冷青 ~2px 描边带（1.12× 边缘，97 描边像素实测）；Boss 描边 = 猩红 COLOR_MAIN 与身体同色保持现状不变；普通敌（zombie/wolf/tank）无 outlineColor 保持纯剪影；帧名契约/token/TASK-41 v3.5 细节全部不变（描边 1.12 为安全上限——1.15× 会使 pose1 ±14→16.1 越帧）。
- **TASK-34 Bug-1**：守夜之环轨道残影「p-ring」显示为半圆（`drawParticleShapes` 环心 `ox+40` 偏离帧中心 `ox+60` 20px，左半被帧界裁掉；修复后环心对齐帧中心 (188,24)，r=22 → 完整圆环；其它粒子形状经核验 p-circle/p-square/p-streak/p-diamond 绘制坐标均在帧内，未受影响）。
- **TASK-34 Bug-2**：自动飞弹「血月猎手」渲染异常（`weapon-system` 调 `acquire(x,y,'missile')` 把帧名 'missile' 误传入池契约的 **texture** 槽；HomingMissile.launch() 不像 Enemy.spawn() 那样纠正帧 → 飞弹挂在 Phaser `__MISSING` 全透明纹理上不可见。修复：两处 `acquire` 调用补齐 `'characters'` 纹理参数，帧契约 `'missile'` 不变、实体零改动；池契约与其它调用方（Enemy.spawn 显式 setTexture 纠正 / PlayScene Boss 'enemy-boss' / XpGem 'effects'+'gem'）的差异在注释中点明）。
- **TASK-37 R1 波次 1（玩家撞怪卡死 / 飞弹残留 / 图标居中）**：
  - **B1（P0）玩家碰撞敌人后游戏卡死**（`src/scenes/PlayScene.ts` + 新 `src/combat/contact.ts`）：根因 = `physics.add.overlap(player, group, this.onPlayerEnemyOverlap)` 把方法引用直接传入，物理 step 内 `this` 为 `undefined` → 首次接触抛 `TypeError: Cannot read properties of undefined (reading 'hurt')` → 异常沿物理 step 冒泡导致 Phaser 主循环崩溃，画面卡在最后一帧（"卡着不动"）。修复：抽取 `playerEnemyContact(enemy, nowSeconds, player)` 纯函数（test-framework §1.2 可测性要求）封装敌人攻击门 + `Player.hurt` 调用，overlap 改用箭头函数闭包 `(_o1, o2) => playerEnemyContact(...)`，`this` 词法绑定到 PlayScene；同时移除原 `onPlayerEnemyOverlap` 私有方法（死代码）。新增 5 项单测（`tests/unit/combat/contact.test.ts`：未激活/冷却中/造成伤害/同帧多敌/无敌帧）。
  - **B2（P0）飞弹命中精英（厚血怪/Boss）后留在身上抖动**（`src/weapons/homing-missile.ts` + `src/weapons/weapon-math.ts`）：根因 = 升级 6「飞弹穿透」后，穿透飞弹命中厚血怪（600HP）穿出，tick 中 `nearestEnemy` 仍把同一厚血怪选为最近目标，`checkMissileHits` 走 `hasHit` 跳过但飞弹继续追踪 → 飞到目标身上速度归零绕着抖动至 3s 寿命结束。修复：`weapon-math` 新增 `selectHomingTarget(origin, enemies, hasHit)` 纯函数（已命中目标过滤），`HomingMissile.tick` 用之替换 `nearestEnemy`；若场上无未命中目标则按 W8 §⑥.2「无目标原地消散」立即 `dissipate()`，不再绕残敌。新增 1 项单测（`tests/unit/weapons/homing-missile.test.ts`：跳过已命中、选次近、全已命中→null、未命中仍可选）。
  - **B3（P1）升级/武器图标不居中**（`src/ui/icons.ts`）：根因 = 15 项图标由 Ardot 画布导出，画布稿部分内容（飞弹箭头偏右、屠刀偏右下、+15%/-8%/+20 数字型偏角、护体球+1 偏上等）未对齐 viewBox 中心。修复：用 Playwright + `SVGGraphicsElement.getCTM() × getBBox()` 测量 15 项图标「内容 bbox 中心 → viewBox 中心」差值；新增 `ICON_CENTERS: Record<IconKey, {dx,dy} | null>` 数据表（3 项已居中 `null`，12 项带 `dx/dy`），`renderIconSvg` 在 token 替换后、clip id 唯一化前，于背景 rect 之后、最后一组描边 frame 的 `<clipPath>` 之前插入 `<g transform="translate(dx dy)">…内容…</g>` 平移组——底色与外层描边 frame 保持原位，仅图形内容平移到 viewBox 中心；每 key 首次渲染缓存复用。新增 6 项单测（`tests/unit/ui/icons.test.ts`）。
  - 全量 321 单测（38 文件，+12），`npx tsc --noEmit` 0；Playwright 实测：站桩 25s + 移动 25s 无 `pageerror`/无 `console.error`，游戏持续运行；图标对照页 15 项全部居中（`D:\code\.workbuddy\screenshots\task37-b3-icons-compare.png`）。

### Performance

- 桌面峰值同屏 400 / 子弹 7.96 / draw call 3；移动峰值 250（perf-analysis.md）。
- **TASK-28**：draw call 口径 3 → 5（背景 1 + characters 1 + effects 1 + ambient 1 + 粒子 1，≤8 硬预算）；桌面同屏峰值 400 / 移动 250 不变。
- 主 chunk 1.55MB（gzip 约 360KB）。
