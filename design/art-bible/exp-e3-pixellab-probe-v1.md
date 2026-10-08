# 实验 E3 · PixelLab 像素原生作者探针（准备 → 验收）

> 版本：v1 · 日期：2026-09-11 · 作者：编码机助理（实验卡）
> 状态：**待主理人点名开工。** 需外部账号（本项目流程 §10.2 备选 A：「主理人授权账号或本机 GPU」）。未授权不注册、不调用。全程不写 `assets/frames/`，产出只进 `_park/pixellab/` 与过目夹。密钥不入库。
> 上游：`art-pipeline-feasibility-v1.md` §8 · `combat-64-pixel-workflow-v1.md`（现网成法：印戳 → 近邻 128）· 停手 `combat-identity-drift-v1.md`
> 姊妹卡：`exp-e1-krea2-identity-edit-v1.md`（静姿）· `exp-e2-wan-animate-walk-v1.md`（走循环）

---

## 0. 一句话

用一个**像素原生**的商用工具（PixelLab：≤128–200px 画布、带参考 / 骨架的角色动画、8 向旋转、强制色板、图转像素），拿**守誓已过 128 idle** 当参考出一条走循环，看三件事：还是不是她、走不走、画法离现网 128 近邻画法多远。这条不碰 GPU 机，几美元预算，只测「像素层该不该换作者」这一个假设。

---

## 1. 验证什么 · 若通过验证的是什么方案

### 1.1 假设

现网 128 = 绘画印戳近邻缩小，每个新姿都要先在绘画域对齐再降阶，把最难的一致性推进了最难的域（评估 §3.2）。像素原生模型在目标分辨率上直接以参考帧和骨架出下一帧，「同一棋子、走循环」是它的训练目标，可能比「绘画 → 降阶」更稳、更便宜。

### 1.2 若通过，验证的方案

| 方案项 | 通过后落定为 |
|---|---|
| **B + C 轨作者（像素侧）** | 像素原生工具当走 / 技能作者：参考 = 已过 128 idle，控制 = 动作文字或骨架，直接出 128；印戳 → 近邻只保留给 idle 首帧（或也被 `image-to-pixelart` 替代） |
| **备选 A 路线** | 「外接服务」成立：批量走 / 技能可以不占 8GB GPU |
| **战斗设计层** | 若主理人接受其画法，128 战斗帧的画法 = PixelLab 风格，属**形象套第三层（战斗设计）重锁**，剪影与立绘两层不动；已过 C / E 64 与守誓 idle 128 仍不重切 |
| **更新成本** | 同一人新姿 = 一次 API 调用 + 过目，符合 `combat-identity-pack-v1.md` §4「更新变便宜」 |
| **不验证** | 立绘级换姿 / 换装（E1）；驱动视频（E2）；绘画域的一致性 |

### 1.3 若不过，说明什么

| 结果 | 说明 | 下一步 |
|---|---|---|
| 人对、走对、**画法偏**（更卡通 / 更粗 / 描边） | 工具能扛一致性与相位，但风格套不对 | 不当成片。只当 E1 / E2 的**相位与骨架参考**（挑帧、对位用），或主理人裁「战斗层换画法」 |
| 人对、**不走**（站姿分腿） | 文字动作不够；需骨架 | 改 E3-3 骨架动画（web 工具）再一轮；仍不走 → 记工具限 |
| **人不对**（换头、丢烛、换衣） | 参考 128 信息量太小，或工具偏向自家角色先验 | 改用 E3-2（概念图 → 8 向 → 建角色）再一轮；仍不对 → 废，外部像素路线不再追 |
| 条款 / 费用不可接受 | 与技术无关 | 主理人裁定，不开 |

---

## 2. 前置（主理人点）

- [ ] 注册 PixelLab 账号并取 API key（Pro 工具按次计费；个别实验性工具需订阅档，按页面提示）
- [ ] 确认服务条款允许把产出用于商业游戏素材
- [ ] 预算上限：本卡 **≤ 10 美元**（估 2–5 美元）
- [ ] 密钥放法：编码机环境变量 `PIXELLAB_API_KEY`，不写进仓库任何文件
- [ ] 认可产出只当**对照**，主理人「过」之前不进 `frames/`，也不改任何形象套层

---

## 3. 准备

### 3.1 编码机（Hodiki）

| 项 | 做什么 |
|---|---|
| 客户端 | 新建 `tools/pixellab/call.mjs`（Node 22 fetch，无依赖）：读 `PIXELLAB_API_KEY`，POST 一个端点，落盘 `assets/ui-menu/preview/locked/combat-64/_park/pixellab/<ISO>/` + `job.json`（端点、参数、费用估）。**拒绝写 `assets/frames/`**（照抄 `run-job.mjs` 的 `assertNotFrames`） |
| 素材 | 见 §3.2 |
| 色板 | 从已过 128 idle 抽 ≤16 色（`_inspect/sample-gpt-ok-palette.mjs` 同法另存 `vo-idle-128-palette.json`），给支持 forced palette 的端点 |
| 过目 | 复用 `preview_board.py`（石板 ×4）· `preview_strip_gifs.py`（8fps） |
| 过目夹 | `assets/ui-menu/preview/locked/review-exp-e3/` |

### 3.2 素材

| 项 | 路径 | 用途 |
|---|---|---|
| 参考（主） | `assets/ui-menu/preview/locked/combat-64/hero-violet-idle-128-v1.png` | 128×128 透明，守誓已过 idle。E3-1 / E3-3 的 reference |
| 参考 ×4（对照） | `…/combat-64/hero-violet-idle-128-v1-x4.png` | 过目板左列 |
| 概念图 | `…/combat-64/hero-violet-idle-128-v1-stamp.png` | from-a 印戳（绘画大图）。E3-0 / E3-2 的输入。先 letterbox 成正方形（脚贴底、两侧留空）再送 |
| 零件表（守誓） | 长黑发（不是头巾）· 披裙夜灰大面 · 银只胸 / 肩 · 胸前烛 + 焰 · 能指的眼 | 每帧都问 |
| 现网 128 画法口径 | `combat-64-pixel-workflow-v1.md`：头约 16–20px、眼能指、硬色块、无外描边（B 条文：轮廓光默认无） | 风格贴合度按这几条比 |

### 3.3 视角口径

现网战斗帧是 **3/4 朝右**。PixelLab 的 `view` / `direction` 选项里，最接近的是 `low top-down` + `east`（或 `south-east`）。第一枪用 `east`，不像就换 `south-east`，两者算同一格，不算两枪。

---

## 4. 执行（由便宜到贵，前一步不过就不必花后一步的钱）

| 步 | 端点 | 输入 | 输出 | 估价 | 目的 |
|---|---|---|---|---|---|
| **E3-0 图转像素** | `POST /v2/image-to-pixelart` | 概念图 letterbox 到 512×512 | 128×128 | ≈ $0.007 | 便宜对照：像素原生降阶 vs 现网近邻 128。同一张印戳，两种降阶并排 |
| **E3-1 参考出走** | `POST /v2/animate-with-text-v2`（Pro） | reference = 128 idle；action「walk cycle, walking in place, facing right」；view `low top-down`；direction `east`；frames 9（备 4 / 16）；forced palette 若支持 | 9 帧 ≤128 | ≈ $0.095 / 次 × 2 | **主问题**：像素原生能不能直接出「她在走」 |
| **E3-2 概念图建角色** | `POST /v2/generate-8-rotations-v2`（Pro，非像素概念图 → 8 向 ≤168）→ `create-character-v3`（南向 128 建角色）→ `animate character`（walk · east · v3 4 帧） | 概念图 | 8 向 + 走 4 帧 | ≈ $0.2–0.5 | E3-1 不过或想看 8 向时才开；顺带看她的南 / 北向长什么样（现网暂不用） |
| **E3-3 骨架出走** | web 工具 Animate with skeleton（≤128）：Set reference = 128 idle → estimate skeleton → 模板 walk 骨架 → 生成 → 粗修 → 以 init image 再生 | 128 idle | 6–8 帧 | ≈ $0.015 / 帧 | E3-1 人对不走时才开；这是 PixelLab 自家推荐的高控制路 |
| 可选 | `POST /v2/transfer-outfit-v2`（Pro，≤128） | — | — | — | **本卡不开。** 换装 = 另一形象套，等 A 轨齐 |

每步**两次调用封顶**（E3-2 整条算一枪）。E3-0 只一次。

### 4.1 E3-1 动作句（整句，不堆词）

> The same character as the reference, walking in place and facing right. Natural stride: heel plant, weight shift, passing step. Cloak and long black hair swing slightly with each step. The candle stays at her chest. Keep every colour and the hard pixel blocks of the reference. No outline added.

### 4.2 后处理（不改姿、不重涂）

1. 输出若不是 128×128：只做近邻 letterbox 到 128（`_inspect/letterbox.mjs`），不 lanczos、不量化。
2. 六相位挑帧（9 帧里取 a e b c f d，记源帧号）；4 帧则只交 4 帧 + 说明。
3. 石板 ×4 板 · 8fps GIF · 与已过 idle 128 ×4 并排的对照卡。
4. 若强制色板未生效，**不**脚本贴色（R12），只记「色偏」。

### 4.3 落盘

- 原出：`assets/ui-menu/preview/locked/combat-64/_park/pixellab/<ISO>/`（PNG + `job.json`）
- 过目：`assets/ui-menu/preview/locked/review-exp-e3/`

| 文件 | 内容 |
|---|---|
| `01-e3-0-downscale-ab.png` | 同一印戳：现网近邻 128 ×4 vs `image-to-pixelart` 128 ×4 |
| `02-e3-1-a-raw-strip.png` · `03-e3-1-a-board-x4.png` · `04-e3-1-a-walk.gif` · `05-e3-1-a-vs-idle-card.png` | E3-1 第一次调用过目包 |
| `06–09` | E3-1 第二次 |
| `10-e3-2-8dir.png` · `11-e3-2-walk-strip.png` · `12-e3-2-board-x4.png` | E3-2（若开） |
| `13-e3-3-skeleton-walk.png` · `14-e3-3-board-x4.png` · `15-e3-3-walk.gif` | E3-3（若开） |
| `16-e3-summary.md` | 每步零件表勾选 · 走姿判 · 风格距离判（主理人栏留空）· 费用合计 · 调用 id |

---

## 5. 过目与验收

### 5.1 过目板

石板 `#2A3444` · 近邻 ×4 · 左列永远放已过 idle 128 ×4。走循环交 GIF；E3-0 只交并排卡。

### 5.2 判据

分三层判，**顺序不能反**：先人、再走、最后风格。前一层「否」，后一层不判。

| 层 | # | 问 | 是 / 否 |
|---|---|---|---|
| 人 | 1 | 每帧零件表五条可指：长黑发 · 披裙夜灰 · 银胸 / 肩 · 胸前烛 + 焰 · 眼 | |
| 人 | 2 | 与已过 idle 128 是同一个人（不换头、不换衣、不换体量） | |
| 走 | 3 | 是走姿不是站姿分腿（R8）：后脚离地向前摆、重心前移、披 / 发 / 烛有相位 | |
| 走 | 4 | 对侧是另一只脚，朝右，无 flipX；8fps 循环顺 | |
| 风格 | 5 | 硬色块、无外描边、头约 16–20px、眼能指 | |
| 风格 | 6 | 与已过 idle 128 并排像同一套像素（不是更 Q、更粗、更亮） | |
| — | 7 | 未写 `frames/`；未改任何形象套层；费用 ≤ 上限 | |

### 5.3 通过 / 失败口径

| 口径 | 条件 | 意义 |
|---|---|---|
| **通过 A（可当作者）** | 1–7 全「是」，主理人点「过」 | §1.2 全部落定；战斗设计层是否改画法由主理人另点 |
| **通过 B（人对走对、风格偏）** | 1–4「是」，5–6 有「否」 | 工具能扛一致性与相位；只当 E1 / E2 的相位 / 骨架参考，不当成片。仍写进评估 |
| **失败** | 1–2 有「否」（E3-1 与 E3-2 都试过） | 外部像素路线不再追 |

主理人只看：`01`、`05`、`09`（三张卡）+ `04` / `08` 两个 GIF；E3-2 / E3-3 开了再加 `12` / `14` / `15`。

---

## 6. 结果怎么写回

| 结果 | 写哪 | 谁写 |
|---|---|---|
| 通过 A | `combat-64-pixel-workflow-v1.md` 成法表加「像素原生作者（参考 = 已过 128 idle）」一行；`combat-identity-chengfa-v1.md` §4 C 轨加平行作者 | 助理起草，主理人点 |
| 通过 A 且主理人接受画法 | `character-art-bible-v1.md` §6 战斗降阶：战斗设计层画法改记；剪影 / 立绘不动；已过 C / E 64、守誓 idle 128 仍不重切 | 美术总监起草，主理人点 |
| 通过 A / B | `combat-64-workflow-v1.md` §10.2 备选 A 状态从「未点名不开」改「已试，结论见 E3 卡」 | 助理 |
| 任一 | `art-pipeline-feasibility-v1.md` §8 表 E3 行改状态；§5 工具表 PixelLab 行补实测 | 助理 |
| 任一 | `tools/pixellab/README.md` 一页：端点、费用、密钥放法、`_park/pixellab/` 落盘（通过后才建） | 助理 |

通过 A 后**第一批生产帧**：守誓 `hero-violet-walk-a…f` 128，与 E2 产出并排交主理人选一条进现网；仍主理人过才写 `frames/`。

---

## 7. 停手

`combat-identity-drift-v1.md` 任一类当场停（换人 / 丢脸 / 错产品 / 风格横跳）。另加：费用到上限停；同一端点两次封顶；不为「像一点」去改 prompt 第三次。

---

## 8. 预算

| 项 | 估 |
|---|---|
| 账号 + 密钥 + 条款 | 主理人 15 分钟 |
| 客户端 | 1 小时（一个文件） |
| 调用 | E3-0 ≈ $0.01 · E3-1 ×2 ≈ $0.2 · E3-2 ≈ $0.5 · E3-3 ≈ $0.2 → **合计 ≈ $1；上限 $10** |
| 后处理 + 板 | 0.5 小时 |
| 过目 | 主理人 10 分钟看 3 卡 2 GIF |
| GPU | 0（不占 HodikiX） |

---

## 9. 与 E1 / E2 的关系

E3 与 E1 / E2 是**不同的假设**：E1 / E2 修的是绘画域的作者，E3 问的是「要不要在像素域另找作者」。三条并行；若 E2 与 E3 都出了走条，主理人按风格贴合度选一条进成法，另一条退对照。E3 通过 B 时，它的走条给 E1 / E2 当挑帧与骨架参考。

## 10. 来源

pixellab.ai API 页（端点、画布上限、估价：`image-to-pixelart` ≤320 · `animate-with-text-v2` Pro ≤128/170/256 · `generate-8-rotations-v2` Pro ≤168 · `create-character-v3` 64/128/168 · `animate-with-skeleton` ≤128）· pixellab.ai 文档《Animate with skeleton》《Animation to animation》（Set reference → estimate skeleton → 生成 → 粗修 → init image 迭代）· 本仓库 `combat-64-pixel-workflow-v1.md`（现网 128 口径）· `combat-64-workflow-v1.md` §10.2 备选 A。
