# 《血月守夜》敌种 + Boss 逐帧朝向盘点表 + 朝向重绘工单（v1.0）

> **版本**：v1.0 · **日期**：2026-10-12 · **作者**：林绘澄（美术总监 / art-director）
> **服务对象**：**B2（flipX）解锁** + **M4 flipX**。**门禁与表同批落地**（工程侧承接）。
> **配套机器可读文件**：`design/art-bible/enemy-facing-inventory-v1.json`（同 schema，供朝向门禁当**白名单**）。
> **性质**：**新建盘点表 + 重绘工单**（纯文档/规格，不含代码）。**未碰** `src/**`、`tests/**`、`design/official-v1/**`、`tools/**`；**未改任何帧名**；**未 commit / 未 push**。
> **门禁**：无（不跑 tsc / vitest / build —— 工程线并行）。
> **判读方法**：`assets/frames/<frame>.png` 经**自建纯 Python PNG 解码器 8~10× 最近邻放大 + 棋盘垫底**后**逐帧目视**（脚本落 `tmp/`，仅分析用、随会话清理；**不复用上轮已删脚本**）。本轮为**独立复判**，上轮 `美术圣经回写报告 §7.2` 初判**只当线索、不作交付**。

---

## 0. 一句话结论

**21 个 base 帧全部判读完毕**：**11 `ok` / 4 `redraw-to-right` / 5 `exempt-symmetric` / 1 `needs-recheck`**。
现网敌种 / Boss **仍是「混朝向」**（20/21 有明确落点，唯 `enemy-gravekeeper` 强线索冲突留复核）；**4 帧须重绘**（`enemy-beetle` / `enemy-acolyte` / `enemy-decayedknight` / `boss-fenrir`，含变体共 **9 帧**）后方可把 `enemy-*`（含 `boss-*`）扩入 `defaultFacesRight`。**四条门禁设计约束已全部写进本表 + JSON。**

---

## 1. 判读口径与方法

### 1.1 判据（源自 `art-bible.md §2.7` / `asset-spec-v1.md §2.7`）

> 契约原文：「只 flipX，不出四向；**原图默认朝右**（**鼻尖 / 吻部 / 灯在画面右侧**）；镜像后剪影仍须可读。」

据此定「**朝向锚点**」优先级：

1. **四足**：吻部 / 头在画面**右** ⇒ 朝右；在**左** ⇒ 朝左。
2. **持械人形 / Boss**：主手持**武器 / 灯 / 道具**在画面**右** ⇒ 朝右。（灯为主锚点，见 `enemy-boss`。）
3. **无脸 / 无定形 / 正面对称**：无可靠侧向锚点 ⇒ `exempt-symmetric`（flipX 无观感差异）。
4. **强线索冲突 / 判读不可靠** ⇒ `needs-recheck`（交人工目视定夺，**不得**默认入表）。

> ⚠ **判读依据仅鼻尖 / 吻部 / 武器 / 灯笼的**画面**左右位置**，**不依赖生成元数据**（现网 `assets/report.json` / `frame-registry.json` **均无朝向字段** —— 本次已核实，此即本任务补的缺口）。

### 1.2 复判说明（相对 §7.2 初判的**差异**，主理人须知悉）

上轮 `美术圣经回写报告-2026-10-09.md §7.2` 的 8× 目视**只覆盖 16 帧**（4 偏左 + 8 朝右 + 4 近对称），**另有 5 帧未落点**。本轮**全 21 帧独立复判**，与初判**3 处不同**：

| 帧 | §7.2 初判 | **本轮复判** | 说明 |
|---|---|---|---|
| `enemy-zombie` | 偏左 | **朝右（`ok` · 低置信）** | 8× 目视：颅面朝右下、**前伸爪手在画面右**；躯干近侧视。**改判为朝右**，但置信低 ⇒ 见 §5 开放项 |
| `enemy-beetle` | 近对称 | **朝左（`redraw-to-right`）** | 10× 目视：**头（复眼+口器）在画面左下**、鞘翅（十字高光）在右上 ⇒ 有明确头向，**非对称** |
| `enemy-gravekeeper` | （未落点） | **不可判（`needs-recheck`）** | 铲刃在右上、躯干/兜帽面朝左下——**强线索冲突** |

> **本轮新落点（初判未判的 5 帧）**：`enemy-wraith`→`exempt-symmetric`；`enemy-cupbearer`→`exempt-symmetric`；`enemy-shadowwolf`→`ok`；`enemy-boss`→`ok`；`enemy-gravekeeper`→`needs-recheck`。

---

## 2. 覆盖口径（**定稿**，勿再改）

| 项 | 口径 |
|---|---|
| **门派集** | **26 base** = `player` + 4 hero（cassandra / violet / violet-fallen / galvan）+ **18 enemy**（zombie, hound, beetle, wraith, necro, acolyte, bat, cupbearer, fleshmass, penitent, greywolf, shadowwolf, stonewolf, wolfhunter, gravekeeper, decayedknight, bonethrower, **`enemy-boss`**）+ **3 boss**（cardinal, fenrir, moonavatar） |
| **待判读** | **21 base**（18 enemy + 3 boss）—— `player` + 4 hero 现网 `defaultFacesRight` 已返回 `true` = 已 `ok` |
| **`summon-*`** | **不入门禁**（已核实：**不调用 `applyFacing`**，恒按原图渲染、永不月步）⇒ 仅 §6 `informational` 段登记 |
| **变体折叠** | `-v` / `-skill-a\|b\|c` / `-entrance` / `-walk-[a-fs]` / `-broken` / `-tombstone` **折叠进 base**（复用 `stripVariantSuffixes` 同 regex），**不单列**；`enemy-stonewolf-broken` ⇒ `enemy-stonewolf` |
| **禁用前缀 glob** | `boss-*` glob **会漏 `enemy-boss`（血月尊者）** ⇒ 一律用**显式 base 集合**（见 §4 C1） |

---

## 3. 逐帧朝向盘点表（21 base）

> 判读结论 / **facing**（`right` / `left` / `symmetric` / `indeterminate`）/ **置信度**（high / medium / low）/ **action**（`ok` / `redraw-to-right` / `exempt-symmetric` / `needs-recheck`）/ 依据。
> **inGate** = `true`（`ok` ∪ `exempt-symmetric`）即可安全启用 flipX；`false` = 门禁 FAIL、须重绘/复核后才能入表。

| # | base 帧 | 中文 | facing | action | 置信 | inGate | 依据（鼻尖 / 吻部 / 武器 / 灯 在画面哪侧） |
|---|---|---|---|---|---|---|---|
| 1 | `enemy-zombie` | 行尸 | right | **ok** | **low** | ✔ | 颅面朝右下、**前伸爪手在画面右**；躯干近侧视（初判曾记「偏左」，已复判改判） |
| 2 | `enemy-hound` | 血犬 | right | **ok** | high | ✔ | 四足侧视：**吻部/头在画面右**、尾在左 |
| 3 | `enemy-beetle` | 墓穴甲虫 | **left** | **redraw-to-right** | medium | ✘ | **头（复眼+口器）在画面左下**、鞘翅（十字高光）在右上 |
| 4 | `enemy-wraith` | 亡魂 | symmetric | **exempt-symmetric** | medium | ✔ | 半透明·**无脸**幽灵；剪影近轴对称，flipX 无观感差异 |
| 5 | `enemy-necro` | 尸巫 | right | **ok** | high | ✔ | **法杖顶端幽紫宝珠在画面右上** |
| 6 | `enemy-acolyte` | 血信徒 | **left** | **redraw-to-right** | medium | ✘ | **兜帽开口 + 血色短杖指向画面左下** |
| 7 | `enemy-bat` | 血蝠 | symmetric | **exempt-symmetric** | medium | ✔ | 展翼正面飞行剪影，近双边对称 |
| 8 | `enemy-cupbearer` | 圣杯侍僧 | symmetric | **exempt-symmetric** | high | ✔ | 正面立姿、**圣杯居中**——无侧向锚点 |
| 9 | `enemy-fleshmass` | 血肉畸体 | symmetric | **exempt-symmetric** | high | ✔ | 无定形肉块、近放射状对称 |
| 10 | `enemy-penitent` | 忏悔者 | right | **ok** | high | ✔ | **画面右手高举报烛**（烛火）；双角在顶 |
| 11 | `enemy-greywolf` | 灰狼 | right | **ok** | high | ✔ | 四足侧视：**吻部在画面右**、尾在左 |
| 12 | `enemy-shadowwolf` | 暗影狼 | right | **ok** | high | ✔ | 奔袭姿：**狼头在画面右**、尾在左 |
| 13 | `enemy-stonewolf` | 石甲狼 | right | **ok** | high | ✔ | 四足侧视：**吻部在画面右**（含 `-broken` 破甲族） |
| 14 | `enemy-wolfhunter` | 狼裔猎手 | right | **ok** | medium | ✔ | **长爪/獠牙前伸至画面右下**（前肢为朝向锚点） |
| 15 | `enemy-gravekeeper` | 守墓者 | **indeterminate** | **needs-recheck** | low | ✘ | **铲刃在画面右上、握柄在左下**，而**躯干/兜帽面朝左下**——强线索冲突 |
| 16 | `enemy-decayedknight` | 腐朽骑士 | **left** | **redraw-to-right** | medium | ✘ | **长剑与持剑臂明确指向画面左下** |
| 17 | `enemy-bonethrower` | 掷骨者 | right | **ok** | high | ✔ | **长矛尖在画面右上** |
| 18 | `enemy-boss` | 血月尊者（boss_1） | right | **ok** | medium | ✔ | **锈蚀提灯（血光）垂在画面右侧**——合 `art-bible §2.7`「灯在画面右侧」主锚点 |
| 19 | `boss-cardinal` | 血主教·尼禄 | right | **ok** | high | ✔ | **高举圣杯在画面右上** |
| 20 | `boss-fenrir` | 狼王·芬里厄 | **left** | **redraw-to-right** | high | ✘ | **狼首+鬃+发光眼在画面左**、躯干与尾向右 |
| 21 | `boss-moonavatar` | 血月化身 | symmetric | **exempt-symmetric** | medium | ✔ | 正面人形光体、**无五官、无角饰** |

**判读分布**：`ok` **11** · `redraw-to-right` **4** · `exempt-symmetric` **5** · `needs-recheck` **1**（合计 21 ✔）

---

## 4. 朝向重绘工单（**按帧列具体改法 + 镜像可读性检查**）

> **总规模**：**4 个 base 族 / 含变体共 9 帧须重绘**（+ 1 族 / 2 帧**待复核**）。
> **统一改法基线**：目标 = 令「鼻尖/吻部/武器/灯」落**画面右侧**；**最经济实现 = 整图水平翻转（mirror）后按下方「镜像可读性检查」逐项复核**；翻转后仍不合格者才局部重绘。
> **所有帧**：翻转后**须重跑** `tools/asset-pipeline` 的**时间轴门禁**（脚底 ΔY / 重心 / 面积）与**尺寸/安全边距**（内容 ≤ 帧 90%）；**环/粒子不得画进 PNG**（§2.7）。

### W-1 · `enemy-beetle`（墓穴甲虫）— `redraw-to-right` · **优先级：低**
- **覆盖变体**：`enemy-beetle` + `enemy-beetle-v`（**2 帧**）
- **现况**：头（复眼 + 口器）与足簇在**画面左下**，鞘翅（十字高光）在右上。
- **改法**：整图水平翻转 ⇒ **头/复眼/口器/触角 + 前足簇移到画面右侧**，鞘翅（含十字高光）移到左侧后部。
- **镜像可读性检查**：甲虫顶视剪影近椭圆、翻转后仍可读；⚠ 复核鞘翅**十字高光**勿与**石板地表**混淆（暗红 `#7E1E1E` L\*≈28 vs 石板 L\*=7.8，ΔL\*≈20 ✅）；40px 小怪，方向性弱。

### W-2 · `enemy-acolyte`（血信徒）— `redraw-to-right` · **优先级：中**
- **覆盖变体**：`enemy-acolyte` + `enemy-acolyte-v`（**2 帧**）
- **现况**：兜帽开口（面部）与血色短杖指向**画面左下**。
- **改法**：水平翻转 ⇒ **兜帽开口/面部 + 持杖臂移到画面右侧**（血杖指向右下）；左臂自然下垂。
- **镜像可读性检查**：⚠ 长袍下摆**不对称褶皱**镜像后须仍与肩线一致（防「布料逆风」）；⚠ 暗红袍 vs 教堂**暗红地毯**须靠**形**区分（地毯为装饰、无斜纹无闪烁，见 `consistency R-C`），翻后复核不与地毯**融块**（ΔL\* 复检）。

### W-3 · `enemy-decayedknight`（腐朽骑士）— `redraw-to-right` · **优先级：中**
- **覆盖变体**：`enemy-decayedknight` + `enemy-decayedknight-v`（**2 帧**）
- **现况**：长剑与持剑臂指向**画面左下**。
- **改法**：水平翻转 ⇒ **长剑 + 持剑臂移到画面右侧**（剑指右下）；头盔**双角为左右近对称特征，无需改**。
- **镜像可读性检查**：⚠ 破斗篷的**飘动方向**镜像后须仍与肩甲/朝向一致（防「布料逆风」）；双角对称 ⇒ 安全；翻后复核与 `enemy-gravekeeper` 的精英剪影**不与混淆**（二者均 96px）。

### W-4 · `boss-fenrir`（狼王·芬里厄）— `redraw-to-right` · **优先级：高**
- **覆盖变体**：`boss-fenrir` + `boss-fenrir-v` + `boss-fenrir-entrance`（**3 帧**）
- **现况**：**狼首（双耳 + 发光眼 + 鬃）在画面左**、躯干与尾向右 ⇒ 现图朝左。
- **改法**：水平翻转 ⇒ **狼首 + 鬃移到画面右侧**、躯干/尾向左。
- **镜像可读性检查**：狼首为**强剪影锚点**，翻转后与原画等价可读；⚠ 鬃毛/尾的**不对称轮廓**镜像后仍成立；⚠ `-entrance` 出场帧**须同批翻转**（否则 idle↔entrance 切换时「扭头」）。

### W-R · `enemy-gravekeeper`（守墓者）— **`needs-recheck` · 待复核**（暂不列正式工单）
- **覆盖变体**：`enemy-gravekeeper` + `enemy-gravekeeper-v`（**2 帧**）
- **待定**：铲刃在右上、握柄在左下，而躯干/兜帽面朝左下——**两组强线索矛盾**。
- **若复核定为「朝左」**：整图水平翻转 ⇒ 铲刃 + 持铲臂移到右侧、面朝右。
- **镜像可读性检查**：⚠ 铲刃为**强不对称特征**，翻转后仍可读；须确认翻转后与「守墓者」叙事朝向一致。
- **处置**：见 §7 开放项 O-1（**请主理人 / 人工目视定夺**）。

---

## 5. 门禁设计约束（**四条，均已写入本表 + JSON `gateConstraints`**）

> 工程侧已识别这四点；**一并固化于此，勿丢**。

| # | 约束 | 说明 |
|---|---|---|
| **C1** | **必须用显式帧集合**（禁用前缀 glob） | `boss-*` glob **会漏 `enemy-boss`（血月尊者，帧名前缀是 `enemy-`）** ⇒ 一律用**显式 base 集合**（本表 21 项 / JSON `frames[].frame`） |
| **C2** | **主键用 base 帧** | 查表前先 `stripVariantSuffixes`（剥 `-v` / `-skill-*` / `-entrance` / `-walk-*` / `-broken` / `-tombstone`）取 base 为主键；否则变体帧查不到表、被误报 |
| **C3** | **加 `frameSetHash` 防 bit-rot** | JSON 顶部 `frameSetHash` = **sha256（21 base 帧排序列表，utf-8，`\n` 连接）** = `3e781df832dfd63885d4dccde8cb8c2eb28b8fa06b4a162b62adcb4354adf22f`；帧集变化即哈希失配 ⇒ 报错、提示重生成盘点表 |
| **C4** | **按前缀白名单派生** | `assets/atlas/characters.json` **混装 22 帧非角色帧**（`missile` / `proj-*`×8 / `orb*` / `ring-*` / `aura-barrier` / `beam-chain` / `shockwave` / `super-*`×7，实测 115 帧里 93 角色 + 22 非角色）⇒ 派生待判帧集合**必须按 `^(player\|hero-\|enemy-\|boss-)` 白名单且再排除 `summon-*`**，否则会**凭空报 ≈22 个假 FAIL** |

---

## 6. JSON 与 `informational` 段

### 6.1 机器可读文件字段

`design/art-bible/enemy-facing-inventory-v1.json`：

- **表级**：`version` / `asOf` / `author` / `sourceAtlas` / `scope` / **`frameSetHash`**（+ `frameSetHashAlgo` / `frameSetHashScope`）/ `count` / `gateConstraints`{C1~C4} / `whitelistSemantics`
- **`frames[]`（21 项）**：**`frame`**（base 主键）/ `familyBase` / **`facing`**（`right\|left\|symmetric\|indeterminate`）/ **`confidence`**（`high\|medium\|low`）/ **`action`**（`ok\|redraw-to-right\|exempt-symmetric\|needs-recheck`）/ `inGate`（bool）/ `coversVariants[]` / `note`

### 6.2 `informational` 段（**不入朝向门禁**）

> 依据：**召唤物不调用 `applyFacing`**（`src/fx/anim.ts` 仅 `tickPlayer` / `tickEnemy` 调 `applyFacing`；召唤物经 `weapons/summon-weapons.ts` 渲染）⇒ **恒按原图渲染、永无「月步」**，朝向不构成门禁项。

| base 帧 | 变体 | 图集 | 备注 |
|---|---|---|---|
| `summon-oathkeeper` | `-v` / `-tombstone` | characters | 守誓者；不入门禁 |
| `summon-moonwolf` | `-v` | characters | 月狼；不入门禁 |
| `summon-bat` | — | effects | 血蝠群召唤物；不入门禁 |
| `summon-hound` | — | effects | 狼影猎犬召唤物；不入门禁 |

---

## 7. 状态与开放项

### 7.1 状态

- ✅ **盘点表**（本文件）—— 21 base 全判读完毕。
- ✅ **重绘工单** —— 4 族 / 9 帧（含**镜像可读性检查**）。
- ✅ **JSON 白名单** —— `enemy-facing-inventory-v1.json`（含 `frameSetHash`）。
- ✅ **四条门禁约束** —— 已写入本表 §5（+ JSON `gateConstraints`）。
- ⏭ **门禁与表同批落地**（工程侧承接）—— 本表为**输入**；`enemy-*`（含 `boss-*`）扩入 `defaultFacesRight` 以**4 帧重绘完成**为**前置换取**。

### 7.2 开放项（**待主理人 / 人工拍板**）

| # | 开放项 | 影响 | 建议 |
|---|---|---|---|
| **O-1** | `enemy-gravekeeper` **朝向不可判**（`needs-recheck`） | 1 族 / 2 帧悬置；门禁若 `FAIL` 会卡该族 | 请**人工目视 `/` 主理人定夺**；裁定后补入工单或归 `exempt` |
| **O-2** | `enemy-zombie` **改判为朝右但置信 `low`**（初判记「偏左」、本轮改判「朝右」） | 若实为朝左，门禁会**放行错误帧** | 请人工**复核一眼**再决定是否入表；或将本帧临时列 `needs-recheck` |
| **O-3** | **重绘产能与排期** | 4 族 / 9 帧（Boss 3 帧含 `-entrance`） | 建议**先做 `boss-fenrir`（高优先、朝向错位最显眼）**，其余 3 族随批次 |
| **O-4** | ⚠ **本轮判读为「目视近似」**，非像素级量化 | 若干帧（尤其近侧视人形）存在主观成分 | 若须**零争议**，可在 M4 用**「鼻尖/吻部像素重心相对帧中心 x 偏移」**脚本复核 |

---

> **本表为 M1 交付物**（服务 B2 解锁 + M4 flipX）；**门禁与表同批落地**（工程侧承接）。
> 任何帧名 / 图集 / 尺寸偏离以 `asset-spec-v1.md` 与 `frame-registry.json` 为准；**本表不改任何帧名**。
