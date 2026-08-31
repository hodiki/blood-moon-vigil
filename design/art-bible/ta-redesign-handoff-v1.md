# 《血月守夜》TA 重做 · 技术美术移交文档（ta-redesign-handoff）

> 版本：v1.2 · 日期：2026-08-31 · 作者：林绘澄（美术总监） / TA 审阅回填
> 变更：v1.2 — 工程开工：frame-specs / `-broken` 同族 / frame-map v1.2 注册表已落地。v1.1 — 主理人冻结 G-1~G-7。v1.0 — 初版。
> 上游：五系统重做 GDD（gdd-enemies-v3 v1.1 §④ telegraph 演出体系、gdd-exclusive-weapons v1.0 §⑦/尾章圣物层、gdd-status-effects v1.0 §⑧、gdd-spawner-v2 v1.1 附录 A W-13/14/16）+ B2/B6/怪物域批次报告（五系统 37+ 提交闭环，1157 测试全绿，全部程序化占位视觉）。
> 前置阅读：`design/art-bible/asset-spec-v1.md` v1.3.2（含 §2.7 时间轴/朝向/步态契约）、`design/art-bible/ta-review-handoff.md`（上一轮 TA 移交，§0 已落地项勿重复施工）、`production/official-v1/m4-backlog.md`、`design/official-v1/content-id-frame-map.md` v1.2。
> 配套：`ui-redesign-handoff-v1.md`（UI 规格）、`ui-redesign-artist-supplement-v1.md`（UI 美工补页）、`asset-production-order-v1.md`（制作工单）。

---

## 1. 资产管线现状与门禁

### 1.1 管线链路（tools/asset-pipeline，已落地，勿重造）

```
raw 帧 → process.mjs（单帧契约 + 时间轴门禁 + 同族共享 contain 缩放 + 脚底对齐）
       → pack.mjs（TexturePacker 打包 + pivots.json / meta.framePivots）
       → layout.mjs（时间轴分档门禁）+ layout.test.mjs（门禁自检）
```

- 门禁命令：`node process.mjs --all && node pack.mjs`（重处理）；`node process.mjs --check`（单帧+时间轴，单帧 PASS 但时间轴 FAIL → 整帧 FAIL）；`node layout.test.mjs`（不碰 raw）。
- 时间轴分档（asset-spec §2.7 已收编）：idle `-v` 最严（重心 hypot ≤2/3/4px 按档、面积 Δ≤15%、犬科 ≤20%、脚底 ΔY=0/1px）；`skill-*` / `-walk-*` / `-entrance` 只锁脚底、允许姿态变化。
- 每帧结果：`assets/report.json` → `checks.temporal.ok === true` 才算过关。

### 1.2 frame-registry 与 CI diff（帧名唯一事实源）

- 现状：`src/config/frame-registry.ts` → `scripts/export-frame-registry.ts` → 根目录 `frame-registry.json`；**v1.2 读数 238 帧**（effects 49 / characters 92 / ui 97）。
- CI diff 校验：`scripts/verify-frame-registry.ts` + `tests/unit/config/frame-registry.test.ts`——注册表 ⊆ 交付集且无多余名。

### 1.3 新增帧注册流程（B2~怪物域批新增内容的接入口径）

1. 工程侧在 `src/config/frame-registry.ts` 注册新帧名（含图集归属），跑测试导出新 `frame-registry.json`，CI 绿后方可入制作清单。
2. 设计侧同步把新帧名补入 `content-id-frame-map.md`（当前 v1.1，**止于 g1_6 守墓者，落后于工程注册**——见 §6 缺口清单）。
3. 美术侧按 `asset-production-order-v1.md` 制作，管线按注册表验收（注册表 ⊆ 交稿集 且无多余名，asset-spec §5.2）。
4. **管线尺寸表必须同步**：`tools/asset-pipeline/frame-specs.mjs` 是 `process.mjs` 认帧的唯一尺寸源。仅写入 `frame-registry.ts`、未写入 frame-specs 的帧会报 `UNKNOWN_FRAME`。v1.2 已补：`enemy-bonethrower(/-v)`、`enemy-decayedknight(/-v)` 96；忏悔者 56→96；broken / 召唤 48 / 圣物 / 专武弹体 / 已冻 UI。

**交稿物（v1.1）**：美工交付 `assets/raw/<帧名>.png`（逐帧、文件名=帧名）。图集 PNG/JSON 与 `pivots.json` 由 `pack.mjs` 生成，**禁止**美工自打 TexturePacker，禁止手写 pivot。

**描边（v1.1）**：现网 `outlineW = 0`，外部轨**不会**后置描边。精英身份 = **96 档体型 + 双角画进 PNG**；3px 幽紫描边若要，也画进原图（计入 90% 安全框）。不要空出描边等管线。

---

## 1.4 主理人裁定（2026-08-30，制作口径冻结）

| # | 裁定 | 制作含义 |
|---|---|---|
| G-1 | 掷骨者、腐朽骑士均为 **96×96** | 方阵骑士玩法仍是「方阵专属普通档」，视觉按精英体型/精细度拉开；遮挡实测后再调 |
| G-2 | 尸巫双 role **不新帧** | healer/summoner 走引擎 marker/tint；本体只出 idle/`-v` |
| G-3 | 忏悔者 **升档 96×96**，帧名仍 `enemy-penitent` / `-v` | 契约从 56 改为 96；双角画进帧。**frame-specs 已改** |
| G-4 | 破甲态冻结 `enemy-stonewolf-broken` / `-v` | `layout.mjs` 循环剥后缀，`-broken` 并入 `enemy-stonewolf` 族 |
| G-5 | 守誓者 / 月狼 **先按 48×48** | `summon-oathkeeper` / `-v` / `-tombstone`、`summon-moonwolf` / `-v` 已入 specs |
| G-6 宝藏 | 新帧 `relic-reliquary`，**不复用** `chest` | `chest` 仍是升级三选一箱 |
| G-7 | telegraph 贴花 **本轮不出**（B-1~B-3 取消） | 继续程序 Graphics；实测后再决定是否补 `tg-*` |
| 批次 A | 含时间轴 FAIL 的 Boss `-v` 与英雄 FAIL 帧 | 见制作工单 A-6 |
| 幽蓝（月） | 映射电光蓝 `#4FC3F7`，不申请新 token | 关闭 G-9 色相缺口；UI 已冻帧见 frame-map v1.2 |

> **主理人确认（2026-08-31）：制作工单可交美工。** v1.2 工程待办已落地（specs / 同族 / 注册表）；未做：G-8 token、C-1~C-3 帧名、`pivots.json` 运行时消费（M4）。

---

## 2. telegraph 渲染规范（W-13 基座 → 正式演出）

### 2.1 现状（程序化占位，已可用）

- `src/fx/telegraph-layer.ts`：**单 Graphics 全量重绘 = 1 draw call/帧**，depth 5；已实现：扇形（守墓者 180°/130px、Boss 普攻）/ 地面箭头线（畸体 300px）/ 预警圈（掷骨者 90px、月坠 120px）/ 弹道细线（忏悔者 0.4s）/ 方阵阵纹（2.5s 渐亮，r90+r60 双环）/ 血渍减速区（60px/2s 暗红）/ Boss casting 通用落点圈。
- 数据层已通用化：`sync(eliteTelegraphs, pendingFormations, bossCasting, lineWidthBonus, bloodstains)`；方阵事件 `FormationWarning` / `FormationLanded`（src/core/events.ts）。

### 2.2 正式演出规范（升级方向，保持单层架构）

| 项 | 规范 |
|---|---|
| 形状语法 | 形状 = 危险范围（gdd-enemies-v3 §④ 七类）；**渐亮式**（α 随蓄力推进，下限 0.12）为唯一节奏语言——禁弹跳/旋转/描边抖动等噪声动效 |
| 色彩 | 敌侧 = 危险红 `#FF3B30`（扇形/线/圈）+ 幽紫（阵纹）；玩家侧 = 冷青/月银白；**全部取 PALETTE token 或其同色相 alpha 派生**——当前阵纹 `0x9B6EC8`、血渍 `0x8C1F1F` 非 token 值，需按 §8 勘误 #2 处置（token 派生白名单或改回 token） |
| 帧率/实现 | 保留程序 Graphics 几何层。**本轮不叠贴花**（G-7）。若日后补质感，只允许贴花级帧，外轮廓永远程序绘制 |
| 层级 | depth 5（地面层之上、实体之下）；贴花叠加同 depth 分批；血渍等多实例地面物并入同批次 |
| 性能红线 | 单 Graphics 层 1 draw call 不回退；叠加贴花走精灵批次计入特效 draw call 预算（§5）；移动端线宽 +1px（lineWidthBonus 已接），渐亮速率不变（gdd-enemies-v3 §⑦） |
| 可访问性 | 「减少闪烁」开启时：渐亮改直接亮起、阵纹/符文呼吸关闭（asset-spec §2.6 惯例扩展） |

---

## 3. pivot 接入规范（M4 帧名契约替换时一并做）

**重申 m4-backlog §1.1（判定依据与接入点以原文为准），铁律三条：**

1. **先算 body offset，再 setOrigin**：`bodyOffsetY = (py − 0.5) × frameHeight` → `setOrigin(px, py)` → 物理 body `setCircle(radius, offsetX, offsetY)` 下移补偿，使碰撞圆心仍落脚底投影点。顺序反了整体飘起。
2. **按同族 base 帧查 pivots.json**（如 `player` 取 `player` 而非 `player-skill-a`）；管线已保证同族一致，接入后加单测断言 base 与 variant/skill pivot 相同。
3. **禁止把 `frames[].pivot` 写进 TexturePacker JSON**——Phaser 解析器只读每帧 `frames[].pivot` 并自动 `setOrigin`，会打乱碰撞圆心；pivots 走独立 `assets/atlas/pivots.json` + `meta.framePivots`（Phaser 忽略后者，安全）。
- 接入断言：随机抽样实体，`精灵脚底 − body 圆心` 距离 ≈0（±1px）。
- 接入时机：M4 全量替换外部帧后一次接入（当前程序剪影 origin 0.5 双轨并存，提前接入回归风险高）。

---

## 4. 特效规格对接（fx-spec）

- 行为标记：`src/fx/status-markers.ts` 已按 `marker-*` 帧名接线，`fx-spec.ts` `SPECIAL_MARKERS` 有常量——**标记帧到货即自动换图，零代码**（m4-backlog §2）。
- 技能环：`fx-manager.ts` 已按四角色模板接 `skill-ring-*`，可用 `p-ring` tint 过渡——注意 4 主动技已随 R2-6 退役拆入 8 套衍生技，**`skill-ring-*` 帧复用于衍生技模板**（T1 爆发/T2 直线/T3 护体/爆发型四模板，asset-spec §3.2），不要按旧 4 技出新环。
- 新实体特效对接点（帧名均未注册，见 §6 缺口）：
  - 圣物演出 ×5（月蚀之陨/血海退潮/十二灯誓约/银潮汐/狼灵巡夜）：演出型、伤害占比 <5%，全屏级 ≥1.5s、可设置降级；粒子复用 `p-ring/p-circle/p-streak` + 专属覆盖帧。
  - 专武弹体：8 专武中弹幕/投射类（圣徒左轮银弹、月痕长弓巨矢、血影突袭斩击段）需弹体/轨迹帧；**银制月光箭双编码（箭体月银白 + 尾羽冷青）为弹体色彩基准**（asset-spec §1.2）。
  - 守誓者实体（墓碑态/复活态）+ 月狼（加尔文召唤，基础场上限 2、质变「群狼协议」后 3）：召唤物玩家侧色系铁律（月银白/冷青主体 + 冷青描边，R-D）。美工画 1 只实体即可。
  - 月影幻影（boss_4 普技 1）：受 1 次伤即散，描边比本体更淡（辨本体考题）——引擎 alpha 层实现即可，**不新增帧**（复用 `boss-moonavatar` α 调制）。
- 粒子池红线：≤200（桌面）/ ≤100（移动）soft-cap，超限回收最早；单次主动技/衍生技 ≤40、超武质变（已退役转圣物/质变卡）≤60；移动端 fxTrails=false、死亡 8 粒（asset-spec §2.5）。

---

## 5. 图集组织、双编码与性能预算

### 5.1 现有图集（运行时 3 图集口径，asset-spec §2.3 工程注）

| 图集 | 现帧数 | 内容 | 容量状态 |
|---|---|---|---|
| characters | 82 | 4 英雄（含 skill）+ 17 敌（含新 g1_7/g1_8）+ 4 Boss（含 entrance） | 1024²~1536² 级，余量健康 |
| effects | 43 | tile/贴花/粒子/marker/skill-ring/gem/chest | ≤512² 级 |
| ui | 73 | upg 40 + wslot 21 + skill 4 + hud-skillbtn + codex 6 + chest | 1024² 级，紧（asset-spec 已预留拆包口径） |

### 5.2 新增图集建议（扩容前评估，不强制）

- **`ui-upgrades` / `ui-slots` 拆包**：若树界面节点图标（~20 帧新 UI）+ 圣物/徽记入 ui 档触顶 1536²，按 asset-spec §2.3 预留口径拆包；拆包 = 加载链路 +1 请求，需工程确认。
- **`fx-telegraph` 贴花图集（可选）**：阵纹内部符文/血渍质感贴花若出帧资产，建议独立小图集（≤256²）或并入 effects；**不建 telegraph 主图集**——外轮廓永远程序绘制（§2.2）。
- 双编码不变：desktop 2x / mobile 1x（UI）；世界实体同规格共享；tile 2 次幂 64×64；`premultipliedAlpha=false`；图集 ≤2048²、留 ~10% 余量。

### 5.3 性能预算表（双端，验收级）

| 项 | 桌面 1920×1080 | 移动 720×1280 |
|---|---|---|
| 特效 draw call（单屏） | ≤8（telegraph 层恒 1） | ≤8（telegraph 层恒 1） |
| HUD/结算 DOM | 0 draw call | 同左 |
| 粒子池 | ≤200 soft-cap | ≤100 soft-cap；fxTrails=false；死亡 8 粒 |
| 帧率目标 | 60fps | 中端机 30fps+（方阵分帧落地 ≤5 只/帧计入，spawner-v2 §⑧） |
| 同屏敌上限 | 400 | 250 |
| 屏幕震动 | 默认开 ≤4px/≤0.15s | 默认关（冲锋/扑击改受击框闪） |
| Boss 血条 | 屏宽 60% | 50% |
| 移动端 telegraph | 全保留 | 线宽 +1px、渐亮速率不变 |

---

## 6. 契约缺口清单（TA 侧）

> 制作口径已按 §1.4 冻结。下表「处置」= v1.2 工程状态。

| # | 缺口 | 现状 | 处置 |
|---|---|---|---|
| G-1 | `enemy-bonethrower(/-v)`、`enemy-decayedknight(/-v)` 已入 frame-registry，**未入 frame-specs**；frame-map v1.1 止于 g1_6 | **已裁定 96×96** | **已落地**：frame-map v1.2 + frame-specs 96 |
| G-2 | 尸巫 healer/summoner 无独立帧 | **已裁定不新帧** | 引擎 marker/tint；idle/`-v` 仍须过时间轴门禁 |
| G-3 | 忏悔者精英化后仍为 56 契约 | **已裁定升档 96×96**，帧名不变 | **已落地**：frame-specs + asset-spec §1.3 |
| G-4 | 石甲狼破甲无第二阶段帧名 | **已裁定** `enemy-stonewolf-broken` / `-v` | **已落地**：注册 + `familyKey` 循环剥后缀 |
| G-5 | 守誓者 + 月狼无帧名 | **已裁定** `summon-oathkeeper` / `-v` / `-tombstone`、`summon-moonwolf` / `-v`，**48×48** | **已落地**：注册 + specs 48 |
| G-6 | 专武弹体 / 圣物覆盖 / 圣髑匣 / 新标记色调未入 asset-spec | 圣髑匣 **已裁定** `relic-reliquary` | **已落地**帧名与 specs；asset-spec v1.3.2 尺寸表已补 |
| G-7 | telegraph 贴花无前缀 | **本轮零帧**（取消 B-1~B-3） | 维持程序层；若实测不够再开 `tg-*` |
| G-8 | 阵纹 `0x9B6EC8` / 血渍 `0x8C1F1F` 非 14 token | 程序私有常量 | 工程改回 token 或声明派生白名单；**不挡美工**（本轮无贴花） |
| G-9 | UI 幽蓝 + 树/圣物/徽记/立绘帧名 | 幽蓝 **已映射电光蓝** | 立绘/状态/席位/共鸣徽已冻；**C-1~C-3 仍未冻** |
| G-10 | 注册表 198 vs 口径 200 | 以 CI 导出为准 | v1.2 冻结帧已计入；以 `npm run frame-registry:ci` 为准 |

---

## 7. 铁律重申（每条都有事故史，勿违）

1. **禁止写 `frames[].pivot`** 进 TexturePacker JSON（§3）。
2. **帧名零改动替换**：引擎只认帧名不认画工；外部素材同名 PNG 重建图集，实体代码零改动（asset-spec §4.3）。
3. **只 flipX 不出四向**：原图**默认朝右**（ta-review §2 朝向契约）；`-walk-a/b` 后缀勿占用 `-v`。
4. **不要为鬼畜出 4 向 × 8 帧走循环**；不要把 idle `-v` 接回 9fps move（已拆）。
5. **不改 `PLAYER.RADIUS`**（已与 64 档脱钩）。
6. **禁运行时模糊/全屏 shader/全屏红晕**；特效全部粒子池 + 预烘焙图集。
7. **环/粒子/光晕不画进角色 PNG**（引擎粒子分工）。现网不管线后置描边；精英双角与可选 3px 幽紫边画进原图。

## 8. 勘误与口径校准（对既有文档的勘误级标注，不改原文）

1. 任务口径「frame-registry 200 帧」：v1.1 实测 **198**。v1.2 已追加冻结帧，以 `npm run frame-registry:ci` 导出为准。
2. 任务口径「asset-spec-v1.md v1.1 / 12 验收项」：现行文件为 **v1.3.2 / §5.1 共 14 验收项**（v1.3.1 增补 §2.7；v1.3.2 冻结帧回填）。本文档全部按 v1.3.2 引用。
3. `telegraph-layer.ts` 头注释「正式美术后按帧名替换或保留几何层」——按 §2.2 规范，**首选保留几何层 + 可选贴花叠加**，不走整帧替换路线（分辨率无关 + 零图集成本），此为本文档对该注释的澄清。
4. `skill-ring-*` 4 帧在主动技退役（R2-6）后语义改为「衍生技四模板环」，frame-map v1.2 §6 已改。
5. asset-spec §2.2 仍写「管线后置描边」：与 v1.3 头注 / 现网 `outlineW=0` 冲突。制作以 **v1.1 本档 §1.3** 为准，spec 原文待 v1.4 勘误。
6. asset-spec §2.1.2「禁止零散图、只交打包图集」：与本仓库管线（raw → process → pack）冲突。美工交稿以 **逐帧 raw PNG** 为准。
