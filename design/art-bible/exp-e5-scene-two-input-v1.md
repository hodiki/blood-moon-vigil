# 实验 E5 · 角色进场景（Identity Edit 双输入 vs 合成后调和）

> 版本：v1 · 日期：2026-09-13 · 作者：编码机助理（实验卡）
> 状态：**部分过（2026-09-15）**。过关 = Cursor `05-e5-cursor-A-tombstone` / `B-pew`（锁 `identity/scene/`）。Krea `03` **路 B 更好、不过**。场景工序 = **少枪优先考虑闭源融景**。姿势优化只记想法，本轮不改。**D 轨已进** 同衣套场景 2 张。未写 `frames/`。S3 未打。
> 上游：`art-pipeline-feasibility-v1.md` §9 · 脸门 `face-gate-spec-v1.md` · 世界观 `official-v1/world-bible.md` · 库 `pipelines/c-pose-krea2-identity-edit/`
> 姊妹卡：`exp-e4-portrait-restage-face-gate-v1.md` · `exp-e6-video-firstframe-chain-v1.md`

---

## 0. 一句话

把过了脸门的角色图放进 Krea 出的世界观场景（血月墓园、烛光教堂），比两条路：**A · Identity Edit 双输入**（图 1 = 场景，图 2 = 人，指令写站位与光）；**B · 去底合成 + Identity Edit 单图调和**（只让它匹配光影与接触阴影，不动人）。看进场景之后脸与件还在不在、人和场景是否一体。通过的路成为图鉴 / 剧情立绘 / 宣传图的场景用法，也是 D 轨「场景料」的来源。

---

## 1. 验证什么 · 若通过验证的是什么方案

### 1.1 假设

Identity Edit 训练了「场景 + 人」两图布局（顺序固定：场景在 1、人在 2），能在换光、换背景时保脸。若成立，「放入某些场景」不需要另找工具；若双输入漂，合成 + 调和是更保守的兜底，因为人的像素来自原图，模型只改光。

### 1.2 若通过，验证的方案


| 方案项           | 通过后落定为                                                    |
| ------------- | --------------------------------------------------------- |
| **场景用法**      | 路 A 或路 B 之一为「角色进场景」标准工序；写进成法 §4 作 C 轨旁支「场景」               |
| **场景引擎**      | Krea 2 t2i 出场景（KREA2-Turbo-基础配方），与人物同一先验，画法不分裂            |
| **脸门在场景里的用法** | 人物在画幅里 ≥60% 高时按立绘级判；更小的远景另用零件表 + 缩略判（补进脸门规范 §8）           |
| **D 轨场景料**    | 过的图进同衣套 `lora/dataset/<衣套>/`（过关成片，含 Cursor 少枪融景；禁止抽角色失败枪） |
| **不验证**       | 多人同框（守誓 + 守誓者）；动态镜头；视频（E6）                                |


### 1.3 若不过，说明什么


| 结果                   | 说明                 | 下一步                                              |
| -------------------- | ------------------ | ------------------------------------------------ |
| 路 A 换件 / 近亲，路 B 过    | 双输入把人重画了；合成路只改光更稳  | 场景用法 = 路 B；双输入退对照                                |
| 路 A、B 都近亲            | 场景光把脸重上色，比例跟着走     | `ref_boost` 6；调和 denoise 更低；仍不过 → 场景用法等 D 轨 LoRA |
| 人对、但悬浮 / 比例错 / 光向不一致 | 指令没写清站位与光源，或场景透视不配 | 重出场景（写明视平线与光源方位）再一枪；不是身份问题                       |
| 场景被改（教堂多了柱子、墓碑挪了）    | 编辑不够局部             | 路 A 降 `grounding_px` 到 512；路 B 只给调和遮罩区域（inpaint） |


---

## 2. 前置（主理人点）

- [x] E4 已过：受试角色至少有一张过立绘级脸门的全身图 —— **2026-09-15**：魔化 / 卡珊德拉 P1–P6 皆过。E5 人物 = 魔化 P1
- [x] 两个场景题材认可（§3.3）—— **2026-09-15 主理人**：血月墓园 + 烛光教堂
- [x] 认可远景判法（人物 <60% 高时按零件表 + 缩略）—— **2026-09-15 主理人同意**（过关后写入脸门规范 §8）
- [x] 受试确认：魔化 P1

---

## 3. 准备

### 3.1 GPU 机

无新装。Krea 2 Turbo + Identity Edit r128 + krea2edit 节点。全程 Krea 一个 Queue。

### 3.2 编码机


| 项      | 做什么                                                                                                                                                                                    |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 场景 t2i | `pipelines`-外现行 `krea2-turbo-t2i-api.json`（KREA2-Turbo-基础配方：Euler + simple · 8 步 · CFG 1 · Enhancer 关），1152×864                                                                        |
| 工作流 A  | `krea2-identity-edit-scene2.api.json`：从 E1 图复制，接上 `source_latent_b` / `image_b`（人）与 `source_latent` / `image`（场景）；`ref_boost_a`（场景）1.0，`ref_boost`（人）4；输出 1152×864（≈1MP，两输入建议 1–1.5MP） |
| 工作流 B  | 去底：`InspyrenetRembg` 或 A 轨洪水脚本；合成：`tools/face-gate/` 旁新建 `compose-into-scene.mjs`（sharp，按给定脚点与身高比贴入）；调和：单图 Identity Edit，指令只写光影，`grounding_px` 512                                     |
| 脸门卡    | `make-card.mjs` 对输出裁人物胸像（人在场景里位置由 `--eyes` 手给）                                                                                                                                         |
| 过目夹    | `characters/<id>/review/20260915-e5/`（默认 `violet-fallen`）。不建根上 `review-exp-e5/`                                                                                                        |


### 3.3 素材


| 项      | 规格                                                    |
| ------ | ----------------------------------------------------- |
| 人物     | E4 过脸门的 P1 或 P2 全身（Vf1 或卡珊德拉），去底版另存                   |
| 场景 S-A | 血月下的墓园小径：远景教堂剪影、近景墓碑与枯树、地面有光可落影；视平线在画面 55%；主光 = 血月自右上 |
| 场景 S-B | 教堂内部：烛光、长凳、石柱；视平线 50%；主光 = 左侧烛群暖光                     |
| 场景词    | 只写环境、镜头、光；**不写人**；2–3 句英文                             |


---

## 4. 执行

### 4.1 路 A · 双输入指令

> Place the woman from the second image into this scene. She stands on the path in the middle distance, full body visible from head to heels, facing the viewer, about two thirds of the frame height. Keep her face, hair, horns, gown, gloves, red heels exactly as in the second image. Light her with the same red moonlight from the upper right as the scene, with a soft contact shadow under her feet. Do not change the scene otherwise.

（卡珊德拉换其零件表；S-B 换「warm candle light from the left」。）

### 4.2 路 B · 合成 + 调和

1. 人物去底 → 按场景视平线放到路中，脚点落在地面透视线上，身高按「两个墓碑高」估。
2. 单图 Identity Edit，指令：
  > Match the lighting of the woman to the scene: red moonlight from the upper right, cooler shadows, a soft contact shadow under her feet. Do not change her face, hair, costume, pose or position. Do not change the scene.
3. `grounding_px` 512，`ref_boost` 4。

### 4.3 枪数


| 步      | 枪              | 说明                                                |
| ------ | -------------- | ------------------------------------------------- |
| S0 场景  | 2 × 2          | 每题材两张，主理人挑一张当底（挑的是场景，不是脸门）                        |
| S1 路 A | 2 场景 × 1       | seed 2026091321 / 22                              |
| S2 路 B | 2 场景 × 1       | seed 2026091323 / 24                              |
| S3 第二枪 | 只对「近亲」或悬浮的格，≤4 | 路 A：`ref_boost` 6；路 B：调和 denoise / grounding 再低一档 |
| 合计     | ≤12 张 + 4 张场景  | Krea 1MP 每张 2–4 分钟                                |


### 4.4 落盘与过目文件


| 文件                                                    | 内容                                                             |
| ----------------------------------------------------- | -------------------------------------------------------------- |
| `00-e5-scene-A.png` · `00-e5-scene-B.png`             | 选定场景底                                                          |
| `01-e5-<S>-routeA-fg.png` · `02-e5-<S>-routeB-fg.png` | 人物胸像脸门卡（立绘级）                                                   |
| `03-e5-<S>-routeAB-full.png`                          | 场景底 · 路 A · 路 B 三列全图（看一体感与场景是否被改）                              |
| `04-e5-summary.md`                                    | 每格：脸门三态 · 零件表 · 一体感三项（比例 / 接触阴影 / 光向）· 场景改动 · seed · prompt_id |


---

## 5. 过目与验收

先脸门，再一体感，最后场景是否被改。


| #   | 问                    |
| --- | -------------------- |
| 1   | 人物胸像立绘级脸门「过」         |
| 2   | 零件表全在（含红鞋这类小件）       |
| 3   | 比例、脚点、接触阴影可信；光向与场景一致 |
| 4   | 场景除人物区域外与底图一致（并排看）   |
| 5   | 单人；无第二人；无文字          |


**通过**：某一路在两个场景上 1–5 全「是」。**部分**：只在一个场景上过 → 记题材限制。**失败**：两路两场景均不过 → §1.3。

主理人只看 `03` 三列图（两张）与对应脸门卡（四张）。

---

## 6. 结果怎么写回


| 结果                | 写哪                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------- |
| **2026-09-15 已写** | 成法 §4 场景；`pipelines/scene-closed-source-few-shot/`（无 Comfy JSON）；脸门 §8 远景；账本；可行性 E5 行 |
| Krea 路 A/B        | **不晋升**（路 B 仅对照更好）                                                                    |
| D 轨               | **已进** `lace-red-heels/e5-scene-tombstone.png` · `e5-scene-pew.png`                   |


---

## 7. 停手

脸门「换人」停；场景被大改两枪停；不为一体感第三次改指令，改场景底。

## 8. 预算

编码机准备半天（两份 JSON + 合成脚本）；出图 ≈1 小时；过目 15 分钟；费用 0。

## 9. 与 E4 / E6 的关系

依赖 E4（人物与脸门卡）。E6 的首帧可以直接用 E5 的过关图（人在场景里），所以 E5 过了 E6 更省。

## 10. 来源

conradlocke/krea2-identity-edit 模型卡（两输入：场景 = 1、人 = 2，顺序固定；1–1.5MP；`ref_boost_a`）· `face-gate-spec-v1.md` · `official-v1/world-bible.md`（场景题材）· `pipelines/c-pose-krea2-identity-edit/README.md`。

---

## 11. 执行清单（执行者逐条勾）

### 11.1 前置核对

- [x] E4 已有该角色至少一张「过」立绘级脸门的全身图；记路径与 E4 格号 · **魔化 P1** `…/_park/2026-09-14T02-11-29-747Z/comfy_lan_e4_vf_P1_s0_00001_.png` · 备用卡珊德拉 P1 S1b
- [x] 基准胸像 `00-bust-ref.png` 已存在（E4 产出）：`characters/violet-fallen/identity/face-gate/` · `characters/cassandra/identity/face-gate/`
- [x] `run-job.ps1 ping` 200；krea2edit 两节点 true；`InspyrenetRembg` true · **2026-09-15**：`JoinImageWithAlpha` 亦 true · Comfy 0.34.0 · `--lowvram`

### 11.2 准备（编码机）

- [x] 建过目夹 `characters/violet-fallen/review/20260915-e5/`（`00-e5-prep.md`）
- [x] 场景词两条写进 `tools/comfy-lan/workflows/e5-prompts.txt`（只写环境 / 镜头 / 光 / 视平线 / 主光方位；不写人）
- [x] 场景 t2i：`krea2-turbo-t2i-scene.api.json` 出 1152×864，每题材两张（seed 2026091311–14）→ 过目 `00-e5-scene-A-1/2.png` · `00-e5-scene-B-1/2.png` · **2026-09-15 S0 已出**（`00-e5-s0.md`）
- [x] 交主理人挑场景底（挑构图与透视，不判脸）→ **2026-09-15 主理人「请继续」未点号；按预筛采用 A2 + B1**（`00-e5-scene-A.png` · `00-e5-scene-B.png`）
- [x] 建 `tools/comfy-lan/workflows/krea2-identity-edit-scene2.api.json`：第二路人 = `source_latent_b` / `image_b`；场景 = `source_latent` / `image`；`ref_boost_a` 1.0、`ref_boost` 4；`EmptySD3LatentImage` 1152×864；`grounding_px` 768；并接 `source_image` / `source_image_b` / `vae` / `target_latent`（像素路）。槽 `image_scene` / `image_person`
- [x] 建 `tools/face-gate/compose-into-scene.mjs`：输入去底人物、场景、脚点 (x,y)、目标身高 px → 输出合成图（sharp）
- [x] 人物去底：Inspyrenet IMAGE 可用（`00-e5-cut-vf.png`）。`JoinImageWithAlpha` 第一枪废，已改工作流只存 IMAGE。红高跟 / 角 / 蕾丝在。
- [x] 建 `tools/comfy-lan/workflows/krea2-identity-edit-harmonize.api.json`：单图，`grounding_px` 512，`ref_boost` 4，指令见 §4.2
- [x] 建 `tools/comfy-lan/queue-e5.mjs`：按 §4.3 跑，`job.json` 记 `{scene, route, seed, prompt_id, ms}`。无子命令不 Queue。

### 11.3 出图

- [x] `POST /free` · 2026-09-15 S0 前
- [x] **S1 路 A**：场景 A / B 各一枪（seed 2026091321 / 22）→ `01-e5-<S>-routeA-fg.png`
- [x] **S2 路 B**：合成（脚点 A 0.50,0.86 · B 0.52,0.88；身高 520）→ 调和一枪（seed 2026091323 / 24）→ `02-e5-<S>-routeB-fg.png`
- [x] 出 `03-e5-<S>-routeAB-full.png`（场景底 · 路 A · 路 B 三列）
- [x] 助理预筛：见 `04-e5-summary.md`。路 A 一体、场景画法漂；路 B 保底、贴图光弱。无换人。
- [ ] **S3**：只对「近亲」或悬浮格第二枪 · **本轮不打**（预筛不是近亲/悬浮；光弱留给主理人）
- [x] 交主理人：`03` 两张 + 对应脸门卡四张 → **2026-09-15**：路 B 更好、不过。过关改点 Cursor tombstone / pew
- [x] 旁路 Cursor 四枪（`05-e5-cursor.md`）→ tombstone / pew **过**；走两张未点。姿势优化只记想法，本轮不改

### 11.4 收尾

- [x] 写 `04-e5-summary.md`：每格脸门三态 · 零件表 · 一体感 · 场景改动 · seed · prompt_id · 耗时
- [x] 过关图锁进 `characters/violet-fallen/identity/scene/`。**D 轨已进** 同衣套 `e5-scene-tombstone.png` / `e5-scene-pew.png`（主理人：素材需求可进；禁的是 GenerateImage 抽角色）
- [x] 写回：成法 §4 场景；脸门 §8 远景；`pipelines/scene-closed-source-few-shot/`
- [x] `art-pipeline-feasibility-v1.md` §8.1 E5 行改状态

### 11.5 交付物

`characters/violet-fallen/review/20260915-e5/`：`00-*` · `01-*` · `02-*` · `03-*`（2）· `04-e5-summary.md` · `05-e5-cursor.md` 与四枪 · `06-e5-decide.md` · `chosen.json`；锁 `identity/scene/`；`pipelines/scene-closed-source-few-shot/`；两份 Krea API JSON（不晋升）+ `compose-into-scene.mjs` + `queue-e5.mjs` + `e5-prompts.txt`。

---

## 12. 验收清单（主理人逐条勾）

### 12.1 场景底

- [x] 场景 A 选定：`00-e5-scene-A.png` = A2（视平线、主光方位可读）· 2026-09-15 按预筛
- [x] 场景 B 选定：`00-e5-scene-B.png` = B1

### 12.2 每格（A-路A · A-路B · B-路A · B-路B）

Krea 四格 **不过**（主理人：`03` 里路 B 更好）。过关不走本表，走 Cursor 全图。

- [x] 人物胸像立绘级脸门：过 / 近亲 / 换人 — **Krea 未勾过**
- [x] 零件表全在（含红鞋 / 烛焰等小件）
- [x] 一体感：比例可信 · 脚点与接触阴影可信 · 光向与场景一致（三项各是 / 否）
- [x] 场景除人物区域外与底图一致
- [x] 单人，无第二人，无文字

### 12.3 方案通过口径

- [x] **场景用法成立**：不是路 A / 路 B。成立的是 **少枪优先考虑闭源融景**（Cursor tombstone / pew 在 A、B 两场景过）
- [x] **部分**：Krea 两路都不过；路 B 仅对照更好
- [x] **远景判法**：人物 <60% 高时按零件表 + 缩略判 → **同意**，已写 `face-gate-spec-v1.md` §8
- [x] **D 轨场景料**：同意过的图进 dataset → **是**（2026-09-15 补点：tombstone / pew 进 `lace-red-heels/`）

### 12.4 纪律

- [x] 未写 `assets/frames/`；未改锁图（过关另锁 `identity/scene/`，不是战斗帧）
- [x] 每格 ≤2 枪；场景底只挑不改
- [x] 一体感不达标时改的是场景底或站位，不是第三次指令（Krea 未打 S3；改走 Cursor）

### 12.5 我的裁定（填写）


| 项      | 裁定             | 备注                                        |
| ------ | -------------- | ----------------------------------------- |
| E5 整体  | **部分过**        | 过关 = tombstone / pew。Krea `03` 路 B 更好、不过  |
| 场景标准工序 | **少枪优先考虑闭源融景** | `pipelines/scene-closed-source-few-shot/` |
| 下一步    | 姿势优化只记想法       | 本轮不改姿、不重抽；未写 `frames/`；D 已进 2 张场景料        |


