# 《血月守夜》美工制作工单（asset-production-order）

> 版本：v1.3 · 日期：2026-09-01 · 作者：林绘澄（美术总监） / TA 回填
> **主理人确认（2026-08-31）：可交美工。** C-4/C-6 维持美工绘制。
> 变更：v1.3 — 新增 D 批基础界面美术包（帧名为建议名未冻结，接 C 批后；规格源 ui-redesign-handoff v1.2 §7）。v1.2 — TA 已注册冻结帧并补 frame-specs（A-1/A-2/A-4/A-5 broken、B-4/B-5、C-5~C-11 已命名项、C-7~C-9、U-1 可入 `assets/raw`）。v1.1 — 主理人冻结尺寸与帧名。v1.0 — 初版。
> 上游：五系统重做 GDD + B2/B6/怪物域视觉欠账。
> 契约基准：`asset-spec-v1.md` **v1.3.2**；冲突处以 **本工单 + `ta-redesign-handoff-v1.md` §1.3~1.4** 为准。
> 配套：`ta-redesign-handoff-v1.md`、`ui-redesign-handoff-v1.md`、`ui-redesign-artist-supplement-v1.md`、`content-id-frame-map.md` **v1.3**、`ui-frame-freeze-c1-c3-v1.md`、**`asset-restock-walk-upg-wslot-v1.md`（走循环 / 升级 40 / 槽位 18 补货）**。
> 图集归属：`characters` / `effects` / `ui` / **`ui-portraits`**（512 立绘）/ **`ui-slots`**（C-1～C-3）。

**美工先读**：§0 纪律 → §1 批次 A（P0）→ §1.1 批次 U。C-1～C-3 已冻，入 `ui-slots`。

---

## 0. 制作纪律速览（开工前自检）

1. 帧名 = 文件名 = 引擎引用名；全小写 ASCII 连字符；**零改动替换**。
2. 主体剪影 ≤ 帧宽 90%，四周 ≥5% 安全边距。
3. 只用 14 token 色或同色相 alpha 派生；背景 L\*≤18；玩家/召唤物主体 L\*≥45；暗红普通敌豁免（形状可读）；UI 图形 ≥3:1。
4. 三要素编码（体型 + 色相 + 角饰），任意两要素可区分；形状优先于颜色。
5. 默认**朝右**（鼻尖 / 吻部 / 灯在画面右侧）；只 flipX 不出四向；镜像后剪影仍可读。
6. 时间轴：idle `-v` 最严（重心/面积/脚底，asset-spec §2.7）；`-v` = 呼吸 1–3px，不是第二张立绘；禁止 stretch vs compress。
7. 环 / 粒子 / 光晕 / 技能冲击波 **不画进 PNG**。
8. **交稿 = 逐帧 PNG**：`assets/raw/<帧名>.png`（可带纯底，管线抠图）。**不要**自打 TexturePacker；`pivots.json` 由管线生成，禁止手写；禁止写 `frames[].pivot`。
9. **描边现网不后置**（`outlineW=0`）。精英身份 = **96 档 + 双角画进图**；若要 3px 幽紫 `#B06AF0` 描边，也画进原图（计入安全框）。
10. 入仓后 TA 跑 `process.mjs --check` 全绿（单帧 + 时间轴）才算交稿。

---

## 1. 批次 A（P0）· 新敌种 + 升档 + 时间轴重绘（characters）

> 尺寸档：普通 40~68 / 精英与高威胁体 **96×96** / Boss 240~256。除注明外 = idle + `-v`（1.4fps 呼吸）。  
> 五精英（96px 须一眼分层）：守墓者 / 畸体 / 石甲狼 / 掷骨者 / **忏悔者（本批升 96）**。腐朽骑士视觉同 96，玩法仍是方阵专属。

| # | 资产 | 帧名 | 尺寸/帧数 | 要点 | 状态 |
|---|---|---|---|---|---|
| A-1 | 掷骨者 g1_8 | `enemy-bonethrower` / `-v` | 96×96 / 2 | 抛骨 + 骨矛；暗红 + **双角**；HALLOWED 反转：月银白圣辉小斑。一眼「远程精英」 | **已注册 + specs 96**；入 raw 即可 process |
| A-2 | 腐朽骑士 g1_7 | `enemy-decayedknight` / `-v` | **96×96** / 2 | 残破守夜甲 + 锈蚀纹章；月银白锈斑低面积。与尊者同族不撞形 | 同上；视觉精英档，实测再看遮挡 |
| A-3 | 尸巫 | `enemy-necro` / `-v` | 68×68 / 2 | **不画** healer/summoner 差；role 归引擎 tint。`-v` 须过时间轴（现 FAIL：重心/脚/面积） | 帧名已有；img2img from idle |
| A-4 | 忏悔者 | `enemy-penitent` / `-v` | **96×96** / 2 | 帧名不变，**整套按 96 重画**（原 56 作废）。烛台/铅面 + 双角。普通形态已退役 | **specs 已 56→96** |
| A-5 | 石甲狼两阶段 | `enemy-stonewolf` / `-v` + `enemy-stonewolf-broken` / `-v` | 96×96 / 2+2 | 石甲期高对比岩甲；破甲期同剪影只剥甲。崩落粒子归引擎。idle `-v` 现 FAIL（重心 5.9px） | **broken 已注册**；同族共享缩放 |
| A-6 | 时间轴 FAIL 重绘 | 见下表（含 Boss/英雄） | 沿原契约尺寸 | img2img from idle；只改 2–4px；脚钉死；**默认朝右** | 帧名已有，可立刻画 |

### A-6 其余 FAIL（14 帧；尸巫 / 忏悔者 / 石甲狼 idle 见 A-3/A-4/A-5）

| 优先级 | 帧 | 问题 | 画法 |
|---|---|---|---|
| P0 | `enemy-hound-v` | 面积 +22.8% | 两帧都是小步，锁体长；禁 stretch/compress |
| P0 | `enemy-greywolf-v` | 面积 +21.1% | 同上 |
| P0 | `enemy-wolfhunter-v` | 重心 8.4px、面积 +28.5% | 同剪影换步 |
| P0 | `boss-fenrir-v` | 重心 12.2px | 呼吸不要整只平移；`-entrance` 已过关，勿改 |
| P0 | `boss-cardinal-v` | 重心 7.2px | 圣杯/袖不要拽质心 |
| P1 | `enemy-bat-v` | 重心 4.5px、面积 +30% | 翅膀开合不改身体大小 |
| P1 | `enemy-cupbearer-v` | 面积 **+57.1%** | 两帧体量必须接近 |
| P1 | `hero-galvan-v` | 重心 3.0px | 只呼吸，不换姿势 |
| P1 | `hero-galvan-skill-b` | 面积 +29.7% | 狂化 +10% 不要整帧放大 |
| P1 | `hero-violet-v` | 脚 1px、面积 +15.2% | 脚钉死 |
| P1 | `boss-moonavatar-v` | 重心 11.0px、脚 1px | 不要整座升降；entrance 已过关 |
| P1 | `enemy-boss-v` | 重心 6.9px | 尊者呼吸 |
| P2 | `enemy-fleshmass-v` | 重心 3.8px | img2img from idle |
| P2 | `enemy-zombie-v` | 重心 2.1px | 微调 |

**不必重绘（已 PASS）**：守夜人全家；卡珊德拉全家；紫衣 skill-a/b；加尔凡 skill-a；守墓者；血信徒；甲虫；暗影狼；亡魂；三 Boss `-entrance`。不要把它们算进 A-6 工时。

**批次 A 验收**：96px 五精英分层；突袭敌「低伏蓄身」可读；A-6 各帧 `checks.temporal.ok === true`。

---

## 1.1 批次 U（P0，与 A 并行）· 专武立绘卡（ui）

> 工单 v1.0 的 C 批未覆盖此项。规格见 `ui-redesign-artist-supplement-v1.md` §2 S-1。  
> **先出 2 张风格样张（破旧提灯 + 圣徒左轮）**，主理人拍板后再铺 8 张。

| # | 资产 | 帧名 | 尺寸 | 要点 |
|---|---|---|---|---|
| U-1 | 专武选择卡立绘 ×8 | `exw-card-lantern` / `revolver` / `twinblade` / `longbow` / `bell` / `cross` / `axe` / `horn` | 版式冻结后回填；样张建议最长边 512，透明底 | **一张卡 = 一把专武**。左右分屏是「两把专武 2 选 1」，不是一张图上画基础+质变两个人。徽记留白（C-3 叠）。底光走 CSS，**不画光晕帧**。主题色见 ui-handoff **表 T-1** |

样张直接入 `assets/raw/exw-card-lantern.png` 等（已注册，管线 512×512）。

---

## 2. 批次 B（P1）· 圣髑匣 / 圣物覆盖（effects）

> **B-1 阵纹贴花、B-2 血渍贴花、B-3 Boss 施法贴花：本轮取消。** telegraph 继续程序绘制，实测后再开。

| # | 资产 | 帧名 | 尺寸 | 规格 |
|---|---|---|---|---|
| B-4 | 殉道者的圣髑匣 | `relic-reliquary` | **32×32** | 棺椁宝匣 + 骸骨纹。**不复用** `chest`。金光环归引擎 `p-ring` |
| B-5 | 圣物演出覆盖 ×5 | `relic-mooneclipse` / `relic-bloodtide` / `relic-twelvelamps` / `relic-silvertide` / `relic-wolfspirit` | 64×64 | 只画主体符号（月影/血浪/十二灯/银雨/狼灵）；粒子归引擎；≥1.5s 可降级 |

墓碑实体并入 C-7，不在此重复。

---

## 3. 批次 C（P2）· UI 切图 + 召唤物 + 专武弹体

> C-1～C-3 已冻，入 **`ui-slots`**（`assets/raw/<帧名>.png`）。HUD 小图仍走 `ui`。

### 3.1 UI 切图（`ui` HUD · C-1～C-3 走 **`ui-slots`**）

| # | 资产 | 帧名 | 尺寸（桌面/移动） | 要点 |
|---|---|---|---|---|
| C-1 | 树节点图标 | 见 `ui-frame-freeze-c1-c3-v1.md`（22 帧 `tree-q-*` / `tree-a-*` / `tree-peak`） | 64（桌面）/ 运行时 48 | **已注册 → ui-slots**。三态 tint；P1-3 复用 `tree-q-b/d/s1` |
| C-2 | 圣物背包图标 ×5 | `relic-icon-mooneclipse` 等 5（勿与 B-5 `relic-*` 演出帧混淆） | 64 / 运行时 48 | **已注册 → ui-slots** |
| C-3 | 专武徽记 ×8 | `exw-emblem-<slug>` | 64 / 运行时 48 | **已注册 → ui-slots**；取色表 T-1；不画光晕 |
| C-4 | 共鸣覆盖小徽记 | `reso-ready` / `reso-awaiting` / `reso-achieved` | 16×16 | ready 冷青 / awaiting 灰 / achieved 纹样 |
| C-5 | 复活灯焰 | `hud-revive` | 24×24 | 冷青灯焰；熄灭可只出 1 帧 + 引擎灰化 |
| C-6 | 席位角标 P1~P5 + 卡类徽记 | `seat-p1`~`p5` / `badge-mech` / `badge-num` / `badge-evo` | 32×32 | 几何件 |
| C-10 | 余辉货币小图标 | `hud-merit-glow` | 24×24 | **不可**复用旧 4 张功绩加成卡。余辉金 `#FFC93C` |
| C-11 | 敌头顶状态图标 ×3 | `sticon-hard` / `sticon-soft` / `sticon-vuln` | 24×24 | 硬控 / 软控 / 易伤；帧画中性形，tint：硬控纸白、软控冷青、易伤幽紫。Boss「免疫」不出帧 |

滤月壁面装饰底（补页 S-3）可选，程序化可兜底，不进本批。

### 3.2 玩家侧实体（characters）

| # | 资产 | 帧名 | 尺寸/帧数 | 要点 |
|---|---|---|---|---|
| C-7 | 守誓者 | `summon-oathkeeper` / `-v` + `summon-oathkeeper-tombstone` | **48×48** / 2+1 | R-D：月银白/冷青 + 冷青描边画进图。墓碑同 48。复活进度归引擎 HUD |
| C-8 | 月狼 | `summon-moonwolf` / `-v` | **48×48** / 2 | 同上；流线剪影区别灰狼/暗影狼。画 1 只（场上限是规则不是张数） |
| C-9 | 专武弹体 | `proj-revolver` / `proj-longbow` / `proj-twinblade` | 16×16 | 银白箭体 + 冷青尾羽为色彩基准；拖尾 `p-streak` |

---

## 3.3 批次 D（P0 补充）· 基础界面美术包（ui + 独立背景纹理）

> 接 C 批后。规格源：`ui-redesign-handoff-v1.md` **v1.2 §7**（基础界面六屏：主菜单/角色选择/地图选择/守夜日志/序章/设置）。
> **帧名均为建议名，未冻结**——待与 UI 侧冻结表下一轮合并入 frame-registry / content-id-frame-map（升 v1.4），**合并前不接稿**（§6 铁律）。静态单帧、无时间轴；三态/hover 由引擎 tint 或 9-slice，帧只画常态。

| # | 资产 | 帧名建议 | 尺寸 | 要点 |
|---|---|---|---|---|
| D-1 | 主菜单背景 | `ui-menu-bg` | 1920×1080 **独立纹理** | 血月+守夜会钟楼剪影+十二灯阵；背景 L\*≤18、月面主体 L\*≥45 |
| D-2 | 标题字效 | `ui-logo` | 长边 ~1024 | 月银白主体+暗红月晕；禁动画发光（减少闪烁） |
| D-3 | 通用按钮框体 | `ui-btn-frame` | 9-slice 源 ~96×48 | 常态 ×1；选中态冷青引擎 tint |
| D-4 | 角色选择背景 | `ui-sel-bg` | 1920×1080 独立纹理 | 守夜会堂内景 |
| D-5 | 英雄头像 ×4 | `ui-sel-face-galvan` / `-cassandra` / `-violet` / `-edmund` | 64（桌面 2x 128） | 入 `ui` 图集；对齐英雄 slug |
| D-6 | 选人卡框 | `ui-sel-card` | 9-slice | 卡面光晕走 CSS（T-1 装饰层），帧不画光晕 |
| D-7 | 地图选择背景 | `ui-map-bg` | 1920×1080 独立纹理 | 守夜作战星图台 |
| D-8 | 封印节点卡插画 ×3 | `ui-map-card-graveyard` / `-cathedral` / `-den` | ~480×270 | 色语言对齐 frame-map §4 各图 tile；未解锁引擎灰化 |
| D-9 | 节点卡框 | `ui-map-card-frame` | 9-slice | — |
| D-10 | 图鉴背景 | `ui-codex-bg` | 1920×1080 独立纹理 | 档案室烛光手账；条目内容帧复用 frame-map §5，勿新增 |
| D-11 | 图鉴条目框 | `ui-codex-entry` | 9-slice | — |
| D-12 | 图鉴分类签 ×4 | `ui-codex-tab-dead` / `-court` / `-pack` / `-vigil` | 32×32 | 亡者/血廷/兽群/守夜会；形状区分双编码 |
| D-13 | 序章背景 | `ui-prologue-bg` | 1920×1080 独立纹理 | 十二守夜人滤月封印仪式剪绘 |
| D-14 | 通用面板框 | `ui-panel` | 9-slice 源 ~192×192 | 设置/序章文字框/各弹层共用 |
| D-15 | 设置控件 | `ui-toggle-on` / `ui-toggle-off` / `ui-slider` | 48×48 / 96×24 | 开关 ×2 + 滑条 ×1 |

**帧数预估**：静态 **22 帧**（背景 5 大件走独立纹理不入图集；头像/分类签/控件 9 帧入 `ui`；框体 8 件为 9-slice DOM 层源图）。工时约 **1 个美术周**；P0 子集 = D-1~D-6 + D-13 + D-14（首页/选人/序章首发链路）先行，P1 子集（D-7~D-12、D-15）随后。工程侧前置：TA 定 1920×1080 独立纹理装载口径（ui-handoff §5 缺口 4）。

---

## 4. 提交格式

1. 文件名 = 冻结后的帧名；C-1~C-3 未冻，只交样张、不入正式 raw。
2. 每帧一张 PNG（RGBA 或纯底）。源文件可选 .aseprite/.psd。
3. 世界实体单规格；UI 桌面 2x / 移动 1x（立绘样张可先只出 2x）。
4. 成对 idle/`-v` 必须同脚底、同尺度；验收看管线成品不是 raw。
5. 流程：

```
美工：assets/raw/<帧名>.png
  → TA：node process.mjs --all && node pack.mjs
  → node process.mjs --check 全绿
  → frame-registry CI diff 绿 → 冒烟（帧名不变）→ 主理人拍板
```

程序剪影兜底保留，缺帧不阻塞运行。

---

## 5. 谁可以立刻画 / 谁必须等注册

| 可立刻画（已注册 + specs） | 仍等 |
|---|---|
| A-1~A-6、U-1 样张、B-4/B-5、C-1～C-11、C-7～C-9 | 无未冻帧名。C-1～C-3 入 **`assets/raw/`**，图集 **`ui-slots`** |
| **补货 R-2/R-3/R-1a**：其余 18 `wslot-*`、40 `upg-*`、四英雄 `-walk-a/b` | 见 `asset-restock-walk-upg-wslot-v1.md`。精英走循环 R-1b 可选。`key_nail` / `up_d-*` / `mc_*` 未冻，勿画 |
| — | **D 批基础界面件（D-1~D-15）**：帧名未冻，待与 UI 侧冻结表合并轮（frame-map 升 v1.4）后才可接稿 |

---

## 6. 分批节奏

| 批次 | 量级 | 说明 |
|---|---|---|
| A | 新敌 4 帧 + 忏悔者 2 + 石甲 2~4 + FAIL 约 14 + 尸巫 2 | 约 1 个美术周；P0 |
| U | 样张 2 → 通过后 +6 | 与 A 并行；版式未冻只出样张 |
| B | 圣髑匣 1 + 圣物覆盖 5 | 0.5 周；等注册 |
| C | UI ~30 + 召唤 5 + 弹体 3 | 1~1.5 周；帧名批量冻结后 |
| R（补货） | 槽位 18 + 升级 40 + 英雄走 8（精英走 10 可选） | 见 `asset-restock-walk-upg-wslot-v1.md`；与 v0.8 已交帧并行 |
| D（基础界面） | 静态 22 帧（背景 5 独立纹理 + 图集件 9 + 9-slice 框体 8） | 约 1 周；P0 子集（D-1~D-6、D-13、D-14）先行；**等帧名冻结合并轮** |

---

> 《血月守夜》美术组 · asset-production-order v1.3 · 2026-09-01
