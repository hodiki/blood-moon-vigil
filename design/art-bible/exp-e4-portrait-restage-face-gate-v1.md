# 实验 E4 · 立绘级 re-stage 同脸（Krea 主引擎 · WAI 终审层 · 脸门首用）

> 版本：v1 · 日期：2026-09-13 · 作者：编码机助理（实验卡）
> 状态：**部分过。** 魔化 6/6 过；卡珊德拉 6/6 过（P6 = TMP `ref_boost` 2.5）。这两人不用 WAI。成法：改不动时降 `ref_boost`。**卡珊德拉图1′ 不换**（仍 H23）。**D 轨已进**（各 6 张 Krea 原图）。未写 `frames/`。未训 LoRA。
> 上游：`art-pipeline-feasibility-v1.md` §9 · 脸门 `face-gate-spec-v1.md` · 成法 `combat-identity-chengfa-v1.md` · 库 `pipelines/c-pose-krea2-identity-edit/` · `pipelines/portrait-wai-h23-style-frame/`
> 姊妹卡：`exp-e5-scene-two-input-v1.md`（场景）· `exp-e6-video-firstframe-chain-v1.md`（视频）

---

## 0. 一句话

用 **Krea 2 Identity Edit** 从两个角色的图1′（魔化 Vf1 · 卡珊德拉 H23）各 re-stage 六张 **1024 级**立绘（三机位全身 + 背面 + 两表情近景），再对通过的图做 **WAI 低降噪风格化**两档，全部过**立绘级脸门**。回答三件事：Krea 能不能当立绘线主引擎；WAI 当终审层是保住脸还是打坏脸；脸门这套卡与判法在真图上顺不顺手。通过的图直接成为第一批 **D 轨料**。

---



## 1. 验证什么 · 若通过验证的是什么方案



### 1.1 假设

E1 证明参考在上下文的编辑能在 512×1024 印戳上守住零件表。立绘线要的是 768–1024 上的**同脸**，且画法要能落到二次元。若 Identity Edit 在 1MP 上仍过脸门，立绘线就不必回 WAI 抽卡，也不必先炼 LoRA；若 WAI 0.35–0.45 一遍能在保脸的前提下给出 H23 质感，立绘线就是「Krea 出人、WAI 上色」两段式。

### 1.2 若通过，验证的方案


| 方案项         | 通过后落定为                                                                                                      |
| ----------- | ----------------------------------------------------------------------------------------------------------- |
| **立绘线主引擎**  | Krea 2（Turbo 日常；终稿可评估 Raw）。②.2 落地                                                                           |
| **卡珊德拉图1′** | 她的 Krea re-stage（正面全身中性）若过脸门 → 成为新图1′，H23 退对照；基准胸像同日重发。**2026-09-15 主理人：不换。** H23 仍 `identity/source/h23.png`。P1 过脸但不是正面中性，不当图1′ |
| **WAI 终审层** | 若 WAI pass 后脸门通过率不低于 Krea 原图 → 立绘线可选「Krea → WAI 0.35 上色」；否则 WAI 只留给纯二次元素材，立绘线接受 Krea 成品质感（+ retroanime 低权重） |
| **脸门**      | 规范 v1 转现行；卡脚本 `tools/face-gate/make-card.mjs` 入库                                                            |
| **D 轨料**    | 过脸门的 re-stage 图进 `characters/<id>/lora/dataset/<衣套>/`，附 caption；D 轨从「没料」变「有料」                               |
| **不验证**     | 场景（E5）；视频（E6）；LoRA 是否必须                                                                                     |




### 1.3 若不过，说明什么


| 结果                       | 说明                               | 下一步（不是第三枪）                                                                         |
| ------------------------ | -------------------------------- | ---------------------------------------------------------------------------------- |
| Krea 原图脸门通过 <4/6 且多为「近亲」 | Identity Edit 在 1MP 上比例回归（模型卡自述） | 单元格第二枪：`ref_boost` 6、`grounding_px` 1024；仍近亲 → 记「立绘线需 D 轨 LoRA」，E4 过的图作种子集，LoRA 上云 |
| 「换人」                     | 指令写了不该写的（发型 / 脸词），或分辨率超训练域       | 降到 768×1344 内；指令只写机位 / 表情；仍换人 → 停，记引擎限                                             |
| Krea 原图过、WAI pass 掉到近亲   | 风格化改了比例或眼形                       | denoise 降到 0.30；IPA 仍关；仍掉 → WAI 不当终审层                                              |
| 卡珊德拉过、Vf1 不过（或反之）        | 与源画法相关（WAI 源 vs Krea 源）          | 记角色差异，不作全局结论；第二批换守誓                                                                |
| 主理人判「同脸但不像 H23 气质」       | 风格目标未达，非身份问题                     | 另开风格化配方（Krea 风格 LoRA / WAI 词），不算 E4 失败                                             |


---



## 2. 前置（主理人点）

- [x] 脸门规范 v1 口径认可（三档、四判项、三态、两枪封顶）——2026-09-13 签
- [x] 两个受试角色认可：`violet-fallen`（Vf1 图1′）· `cassandra`（H23）——2026-09-14 主理人确认
- [x] 卡珊德拉若过，接受「Krea re-stage 版为新图1′，H23 退对照」——2026-09-14 主理人确认（开工许可）
- [x] **2026-09-15 主理人裁定：卡珊德拉图1′ 不换**（仍 H23）；**十二格过图进 D 轨**
- [x] WAI 许可条款已核（②.2 条件三）：FAIPL 1.0-SD，生成物可商用、无署名义务 → WAI pass **可进产线**（`engine-license-check-v1.md` §1）
- [x] 认可 E4 过关图进 D 轨 dataset（未过的一张不进）——2026-09-14 主理人确认；2026-09-15 十二格皆过并复制

---



## 3. 准备



### 3.1 GPU 机

无新装。用 E1 同一套：`krea2_turbo_int8_convrot` + `krea2_identity_edit_v1_2_r128` + `comfyui-krea2edit`；WAI pass 用 `waiIllustriousSDXL_v170`。两引擎分 Queue，换引擎 `POST /free`。

### 3.2 编码机


| 项     | 做什么                                                                                                                                                                                                                                                        |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 工作流 A | `tools/comfy-lan/workflows/krea2-identity-edit-restage.api.json`：从 `pipelines/c-pose-krea2-identity-edit/workflow.api.json` 复制，`EmptySD3LatentImage` 改 **768×1344**，源图先缩放到同尺寸走潜空间路；槽加 `grounding_px` / `ref_boost` / `seed` / `positive` / `image_ref`（已有） |
| 工作流 B | `tools/comfy-lan/workflows/wai-style-pass-lowdn.api.json`：从 `pipelines/portrait-wai-h23-style-frame/workflow.api.json` 复制，IPA weight 0，**加** `denoise` **槽**（现 JSON 写死 0.75），尺寸 768×1344                                                                   |
| 脸门卡脚本 | 新建 `tools/face-gate/make-card.mjs`（规范 §7），先出两个角色的基准胸像 `00-bust-ref.png` / `00-full-ref.png`                                                                                                                                                                |
| 过目夹   | `characters/<id>/review/20260913-e4/`                                                                                                                                                                                                                      |
| 排队脚本  | `tools/comfy-lan/queue-e4.mjs`：按 §4.3 单元格表跑，落 `characters/<id>/_park/<ISO>/`（`run-job --char`），`job.json` 记单元格                                                                                                                                             |




### 3.3 素材


| 项             | 路径                                                                 | 说明                                                           |
| ------------- | ------------------------------------------------------------------ | ------------------------------------------------------------ |
| Vf1 图1′       | `characters/violet-fallen/identity/source/vf1-clean.png`（720×1280） | 缩放到 768×1344 作源；零件表见账本 §3（蕾丝 bib · 黑蕾丝手套 · **红高跟**）          |
| 卡珊德拉 H23      | `characters/cassandra/identity/source/h23.png`（768×1344）           | 直接作源；零件表：银白高马尾 · 酒红开襟长大衣 · 黑高领 · 胸前白十字 · 双皮带 · 连裤黑丝 · 哑光黑细高跟 |
| 基准胸像          | 两角色各一，由卡脚本从图1′ 裁                                                   | `face-gate/00-bust-ref.png`                                  |
| 风格词（WAI pass） | `pipelines/portrait-wai-h23-style-frame/workflow.api.json` 正向的画法段  | 只留画法词，不写角色外形词                                                |


---



## 4. 执行



### 4.1 Identity Edit 接线

同 `pipelines/c-pose-krea2-identity-edit/` §3，只改：`EmptySD3LatentImage 768×1344`；`grounding_px` 起 **1024**（模型卡：人像取高）；`ref_boost` **4**（贴参考）；10 步 CFG 1；源 = 图1′ 缩到 768×1344。不接 `image_b`。**指令改表情 / 机位无效时不要抬 boost**——E4 P6：句已够，4 仍贴 H23 笑，降到 **2.5** 才冷视成立。近亲才走 S2 的 6。

### 4.2 指令（每格一条 · 身份句照零件表 · 只写机位与表情，不写脸的形状）

Vf1 身份句同 `pipelines/c-pose-krea2-identity-edit/prompt.txt`。卡珊德拉身份句：

> Keep this exact woman and her costume unchanged: silver-white high ponytail, pale sharp face with red hunter eyes and light black eyeshadow, wine-red open long coat over a black turtleneck with a white cross on the chest, two black belts with silver buckles, black pantyhose, matte black stiletto pointed boots, empty dark void background, same clean anime illustration style.


| 格                                                              | 机位 / 表情句                                                                                            | 判                        |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------ |
| P1 正面全身 · 中性                                                   | Full-body, facing the camera straight on, arms relaxed, neutral expression, camera at chest height. | 脸门 + 零件表                 |
| P2 左前 3/4 全身 · 中性                                              | Full-body, camera at her front-left three-quarter angle, weight even, neutral expression.           | 脸门 + 零件表                 |
| P3 右侧面全身 · 中性                                                  | Full-body, true right profile, nose and near eye readable, arms relaxed.                            | 脸门（侧脸判 1 / 3 / 4 项）+ 零件表 |
| P4 背面全身                                                        | Full-body, back view, hair and coat back visible, no face required.                                 | 只判 3 / 4 项 + 零件表         |
| P5 半身近景 · 微笑 / 得意（卡珊德拉用 proud smirk；Vf1 用 faint knowing smile） | Waist-up close shot, camera at eye height, she gives a … expression.                                | 脸门（表情不算不同）               |
| P6 半身近景 · 冷 / 怒                                                | Waist-up close shot, camera at eye height, cold hard stare, brows lowered.                          | 脸门                       |




### 4.3 枪数与顺序


| 步               | 枪                                         | 说明                                                 | 停                |
| --------------- | ----------------------------------------- | -------------------------------------------------- | ---------------- |
| S0 冒烟           | 1（Vf1 P1）                                 | 768×1344 潜空间路在 8GB 起得来、耗时、不出选人表                    | OOM → 改 640×1152 |
| S1 Krea 原图      | 12（2 角色 × 6 格，seed 2026091301–06 / 11–16） | 每格一枪                                               | 出「换人」立即停该角色      |
| S2 第二枪（只对「近亲」格） | ≤12                                       | `ref_boost` 6 · `grounding_px` 1024 · 换 seed       | 两枪满仍近亲 → 该格停     |
| S3 WAI pass     | 过脸门的 Krea 图 × 2 档（denoise 0.35 / 0.45）    | IPA 0 · Euler a 28 · CFG 6 · clip skip 2 · seed 固定 | 掉到近亲 → 降 0.30 一枪 |
| 合计              | ≤40 张                                     | Krea 1MP 每张 2–4 分钟；WAI 768×1344 每张约 1 分钟           | —                |




### 4.4 落盘与过目文件

原出 `characters/<id>/_park/<ISO>/`；过目 `characters/<id>/review/20260913-e4/`：


| 文件                                                 | 内容                                          |
| -------------------------------------------------- | ------------------------------------------- |
| `00-<id>-bust-ref.png` · `00-<id>-full-ref.png`    | 基准（两角色）                                     |
| `01-e4-<id>-P<n>-krea-fg.png`                      | Krea 原图立绘级同脸卡（三列 + 勾选行）                     |
| `02-e4-<id>-P<n>-wai035-fg.png` · `-wai045-fg.png` | WAI pass 同脸卡                                |
| `03-e4-<id>-finish-ab.png`                         | 同一格三张并排：Krea 原图 · WAI 0.35 · WAI 0.45（选质感用） |
| `04-e4-summary.md`                                 | 每格结果三态 × 三版本、耗时、seed、prompt_id、进 dataset 清单 |


---



## 5. 过目与验收



### 5.1 判什么、按什么顺序

先脸门（规范 §4 四项 + 零件表 → 过 / 近亲 / 换人），再看质感 A/B。**质感不影响脸门结果。**

### 5.2 通过口径


| 项          | 通过                                                                 |
| ---------- | ------------------------------------------------------------------ |
| Krea 主引擎可行 | 每角色 Krea 原图 **≥4/6 格「过」**，且 P1 必过                                  |
| 卡珊德拉换图1′   | 她的 P1 Krea 原图「过」，主理人点「以此为图1′」                                      |
| WAI 终审层    | WAI 0.35 或 0.45 在过脸门的格上**通过率不低于 Krea 原图**，且主理人在 A/B 里选了它           |
| 脸门可用       | 主理人能在一板 ≤6 卡里 10 分钟内判完；判项无歧义                                       |
| D 轨料       | 「过」的 Krea 原图（或选定的 WAI 版，二选一，不混）进 `lora/dataset/<衣套>/`，每张一行 caption |




### 5.3 主理人只看

每角色一板：`01-…-P1…P6-krea-fg.png`（六张）；通过后再看 `03-…-finish-ab.png`（六张）。WAI 卡只看主理人选中的那档。

---



## 6. 结果怎么写回


| 结果        | 写哪                                                                                                                                    | 谁           |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 任一        | `face-gate-spec-v1.md` 状态与 §9；账本各角色一行                                                                                                 | 助理起草，主理人签   |
| Krea 可行   | `pipeline-gpu-first-v1.md` §1 引擎表：立绘线主引擎 = Krea 2；`character-art-bible-v1.md` §1 风格帧段落改「画法目标 = H23 气质，作者 = Krea re-stage（+ WAI 上色可选）」 | 美术总监起草，主理人点 |
| 卡珊德拉换图1′  | 圣经 §5.1 成片表、`characters/cassandra/identity/source/`                                                                                   | 同上          |
| WAI 终审层定性 | `pipelines/portrait-wai-h23-style-frame/README.md` 状态改「风格化层 / 仅二次元素材 / 退对照」三选一                                                        | 助理          |
| D 轨料      | `characters/<id>/lora/dataset/<衣套>/` + `captions.txt`；`combat-identity-chengfa-v1.md` §4 D 加「料来源 = 过脸门的 re-stage」                     | 助理          |
| 新库条目      | 通过 → `pipelines/portrait-krea2-restage/`（含 API JSON、指令表、脸门卡样例）                                                                        | 助理          |


---



## 7. 停手

脸门「换人」当场停该角色（漂类换人）。同格两枪近亲停格。出现选人表 / 双人 / 三视图 → 降 `grounding_px` 一档后仍出 → 停。不为「更像」改第三次指令。

---



## 8. 预算


| 项        | 估                                                 |
| -------- | ------------------------------------------------- |
| 编码机准备    | 半天（两份 API JSON、卡脚本、排队脚本、基准胸像）                     |
| 出图       | Krea ≤24 张 × 2–4 分钟 + WAI ≤24 张 × 1 分钟 ≈ 1.5–2 小时 |
| 过目       | 主理人两板 + A/B ≈ 30 分钟                               |
| 费用 / 新模型 | 0                                                 |


---



## 9. 与 E5 / E6 的关系

E4 是 E5、E6 的前置：脸门卡与基准胸像在这里首用；E5 的人物输入、E6 的首帧都要先过 E4 口径的立绘级脸门。E4 不等 E5 / E6。

## 10. 来源

`face-gate-spec-v1.md` · `pipelines/c-pose-krea2-identity-edit/README.md`（E1 参数与限制）· `pipelines/portrait-wai-h23-style-frame/README.md`（H23 配方与 IPA / denoise 经验）· conradlocke/krea2-identity-edit 模型卡（`grounding_px` 1024 人像、≤2MP、比例保守）· `engine-license-check-v1.md` · 主理人 2026-09-12 ②.1–②.3。

---



## 11. 执行清单（执行者逐条勾 · 顺序不可换）



### 11.1 准备（编码机 Hodiki）

- [x] 读完本卡 + `face-gate-spec-v1.md` + `pipelines/c-pose-krea2-identity-edit/README.md` + `pipelines/portrait-wai-h23-style-frame/README.md`
- [x] `cd tools\comfy-lan && .\run-job.ps1 ping` → 200，且 `Krea2EditModelPatch` / `Krea2EditGroundedEncode` = true · **2026-09-14 复核：Comfy 0.34.0 · 队列空 · UNET/LoRA/WAI/VAE/CLIP 文件名齐 · vram_free ≈7.4/8.6GB（**`--lowvram`**）**
- [x] 建过目夹 `characters/violet-fallen/review/20260913-e4/` · `characters/cassandra/review/20260913-e4/`（`00-e4-prep.md`）
- [x] 建 `tools/face-gate/make-card.mjs`（规范 §7：`--ref --new --id --topic [--eyes x,y] [--frames …]`；输出 PNG + JSON；石板底 `#2A3444`）
- [x] 出六角色基准（规范路径，不回溯判）：`characters/<id>/identity/face-gate/00-bust-ref.png` · `00-full-ref.png`。E4 受试两人源：Vf1 = `characters/violet-fallen/identity/source/vf1-clean.png` · 卡珊德拉 = `characters/cassandra/identity/source/h23.png`
- [x] 源图预处理：Vf1 720×1280 → lanczos 缩放到 **768×1344**（AR 近似，不裁人）存 `characters/violet-fallen/_park/identity-e4/src-vf1-768x1344.png`；H23 已是 768×1344 直接用
- [x] 建 `tools/comfy-lan/workflows/krea2-identity-edit-restage.api.json`：复制 `pipelines/c-pose-krea2-identity-edit/workflow.api.json`，改 `EmptySD3LatentImage` 为 768×1344；`grounding_px` 两处改 1024；其余不动。`.slots.json` 沿用（`seed` / `positive` / `image_ref` / `ref_boost` / `grounding_px` / `lora_strength`）
- [x] 建 `tools/comfy-lan/workflows/wai-style-pass-lowdn.api.json`：复制 `pipelines/portrait-wai-h23-style-frame/workflow.api.json`；确认 IPA weight = 0；KSampler `denoise` 加进 `.slots.json`；尺寸 768×1344；正向只保留画法词（去掉角色外形词），负向沿用
- [x] 建 `tools/comfy-lan/queue-e4.mjs`：读 §4.3 单元格表（角色 × P1–P6 × seed），每格一枪，落 `characters/<id>/_park/<ISO>/`（`--char`），`job.json` 记 `{char, cell, seed, ref_boost, grounding_px, prompt_id, ms}`。无子命令不 Queue。
- [x] 写两角色六格指令到 `tools/comfy-lan/workflows/e4-prompts.txt`（身份句 + §4.2 机位句；Vf1 身份句抄 `pipelines/c-pose-krea2-identity-edit/prompt.txt`）



### 11.2 出图

- [x] `POST /free`
- [x] **S0 冒烟**：Vf1 P1，seed 2026091301，记耗时与显存；OOM → 改 640×1152 再一枪并记入 summary · **2026-09-14：119s · 无 OOM · prompt_id** `7a8163b4-…` **· 见** `00-e4-s0.md`**。此枪即 S1 Vf1 P1，不重打。**
- [x] **S1**：12 格各一枪（Vf1 seed 01–06，卡珊德拉 11–16）；每出一张立即 `make-card.mjs` 出 `01-e4-<id>-P<n>-krea-fg.png`
- [x] 助理预筛：勾零件表；标「疑过 / 疑近亲 / 换人」；「换人」当场停该角色并记漂类 · 见两份 `04-e4-summary.md`
- [x] **S2**：只对「疑近亲」格第二枪：`ref_boost` 6 · `grounding_px` 1024 · 新 seed（格号 +20）；两枪满不再打 · **仅卡珊德拉 P4；S2 废。魔化 P6 选人表改降 grounding 768，未走 S2。**
- [x] **S1b**（2026-09-14）：同种子、画面向机位句。卡 `11-e4-*-s1b-krea-fg.png` · 对照 `12-e4-*-s1-compare.png` · 句 `e4-prompts.txt`（S1a 存 `e4-prompts-s1a.txt`）
- [x] 交主理人第一板 → **2026-09-14 混用锁定**（魔化 P1/P2/P4/P5/P6=S1a，P3=S1b；卡珊德拉 P1–P5=S1b，P6=S1a）。未逐格填「过」；十二张按可进 S3 往下
- [x] `POST /free`，切 WAI
- [x] **S3**：十二格 × 0.35 / 0.45（seed `202609104`）；卡 `02-e4-<id>-P<n>-wai035/045-fg.png`。近亲/换件/水印四格再 0.30：魔化 P4、P6；卡珊德拉 P3、P5
- [x] 合成 `03-e4-<id>-P<n>-finish-ab.png`（同格三列：Krea 原图 · WAI 0.35 · WAI 0.45）
- [x] 交主理人第二板（脸门卡 + A/B + 0.30 补）→ **2026-09-14/15：不用 WAI**（这两人原 Krea 足矣）。助理预筛：魔化 P4 三档角尖品红、卡珊德拉 P3 三档换件 → 0.30 仍掉，**停枪**（见 `07-e4-s3.md`）



### 11.3 收尾

- [x] 写 `04-e4-summary.md`：枪账在两份 summary；dataset 清单补在文末（2026-09-15）
- [x] 过关图复制到 `characters/<id>/lora/dataset/<衣套>/`，每张一行 caption（触发词 + 零件表 + 机位 / 表情）· **2026-09-15**：魔化 `lace-red-heels/e4-P1…P6.png` · 卡珊德拉 `h23-coat/e4-P1…P6.png`（P6 = rb2.5）
- [x] 按 §6 起草写回：成法 §4 D 加料来源；可行性表 E4 行改部分过。**圣经图1′ 不换，未改 §5.1。** WAI 库未全局退（只这两人不用）。`pipelines/portrait-krea2-restage/` 未单独立库（沿用 Identity Edit）
- [x] `art-pipeline-feasibility-v1.md` §8.1 E4 行改状态（部分过 · 2026-09-15）



### 11.4 交付物

`review-exp-e4/`：`00-*`（4）· `01-*`（≤12 + S2 补枪）· `02-*`（≤24）· `03-*`（≤12）· `04-e4-summary.md`；`_park/comfy-lan/<ISO>/job.json`（每枪）；`tools/face-gate/make-card.mjs`；两份新 API JSON + `queue-e4.mjs` + `e4-prompts.txt`。

---



## 12. 验收清单（主理人逐条勾）



### 12.1 脸门（每格一卡 · 规范 §4）

- [x] Vf1 P1 · P2 · P3 · P4（只判 3/4 项）· P5 · P6：各格三态已填 · **2026-09-14 主理人：六格皆过**
- [x] 卡珊德拉 P1–P6：各格三态已填 · **六格皆过。P6 = TMP `ref_boost` 2.5（`17-e4-cassandra-P6-rb25.png`）**
- [x] 「换人」格已按漂类停，未再加枪 · 无换人。P6 靠降 `ref_boost` 过，不是换人



### 12.2 方案通过口径

- [x] **Krea 主引擎可行**：Vf1 Krea 原图「过」≥4/6 且 P1 过 → **是**（6/6）
- [x] **Krea 主引擎可行**：卡珊德拉 Krea 原图「过」≥4/6 且 P1 过 → **是**（6/6；P6 为 `ref_boost` 2.5）
- [x] **卡珊德拉换图1′**：P1 过且我点「以此为图1′，H23 退对照」→ **否 / 不换**（2026-09-15）。H23 仍 `characters/cassandra/identity/source/h23.png`。不重发基准胸像。P1 S1b 不当图1′
- [x] **WAI 终审层**：→ **不用 WAI**（卡珊德拉、魔化原 Krea 足矣；0.45 更容易改件）
- [x] **脸门可用**：主理人已逐格判完十二张，未报判项歧义 → **是**（跨两日，不是单板 10 分钟）
- [x] **D 轨料**：同意「过」的图进 dataset → **是**（2026-09-15）。十二张 Krea 原图已复制；图1′ 不进；未训



### 12.3 纪律

- [x] 未写 `assets/frames/`；未改任何锁图（H23 / Vf1 图1′ 未动）
- [x] 每格 ≤2 枪；扫描未超 §4.3 枪数 · **例外（主理人授权）**：卡珊德拉 P6 在两枪外加 S1c / S1d / LoRA 松锁 / TMP rb2.5，最终以 rb2.5 过
- [x] 指令未写脸的形状词（只写机位 / 表情）· **例外（主理人授权）**：卡珊德拉 P6 S1d 句含下眼睑 / 口平，为拉开冷视
- [x] 结果已写回账本一行（角色 · 日期 · 格 · 三态）· 2026-09-15 两份 `ledger.md`



### 12.4 我的裁定（填写）


| 项       | 裁定               | 备注  |
| ------- | ---------------- | --- |
| E4 整体   | **部分** | 引擎可行（两人 6/6）；WAI 不用；图1′ **不换**；D 轨 **已进 12 张**（第一批种子，不是 12–20 训门槛） |
| 立绘线主引擎  | **Krea** | 细节仍漂；LoRA 减漂不替代抽卡 |
| WAI 终审层 | **不用** | 仅这两人；0.35/0.45 是细节差 |
| 卡珊德拉图1′ | **不换** | 仍 H23。P1 过脸但非正面中性 |
| 下一步     | **D 轨有料，未训** | 门槛仍是脸门过 + 同衣套 ≥15–20 + 战斗外下游。E5 可用过脸全身 |


