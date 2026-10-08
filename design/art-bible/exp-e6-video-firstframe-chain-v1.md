# 实验 E6 · 视频首帧链（Identity Edit 首帧 → Wan 段 → 段间接续）

> 版本：v1 · 日期：2026-09-13 · 作者：编码机助理（实验卡）
> 状态：**部分过（2026-09-17）。** 竖首帧过 · H3 I2V 124 过 · S4b / S5 过。**本机开源视频只剩 MiniMax H3**（Wan 已卸）。**本机日常 = I2V 0.4MP ~5s**（480×864 ×124 ≈ 8.5 min / 8GB）。**本机 R2V 加参考视频不作日常**（0.98×124 约 125 min）。**2026-09-23：** 效果不好或需求复杂 / 更高 / 更长 / 宣传级，停并反馈主理人，由主理人调线上满血 H3。助理不代调官方 API。不写 `assets/frames/`。
> 上游：`art-pipeline-feasibility-v1.md` §9 · 脸门 `face-gate-spec-v1.md`（视频级）· 库 `pipelines/c-walk-wan-animate2/` · 账本 `identity-validate-vf1-plan-v1.md` §13–§15（Wan 14B I2V 口径）
> 姊妹卡：`exp-e4-portrait-restage-face-gate-v1.md` · `exp-e5-scene-two-input-v1.md`

---

## 0. 一句话

先出一张过脸门的**视频首帧**（人在教堂里、指定姿势、竖画幅），再交给 **Wan**：无驱动走 **Wan 2.1 I2V 14B** 出 2–3 秒自由小动作；有驱动走 **Wan Animate 2** 出 3 秒指定动作。然后验**段间接续**：尾帧续 vs 每段重出首帧。回答「能不能稳定当视频角色」。

**2026-09-17：** 本机开源视频生成只留 MiniMax H3（T2V / I2V / R2V）。Wan 2.1 I2V 与 Animate 2 权重已卸，E6 S3 不再走 Animate 2。本机日常只跑 I2V 0.4MP ~5s。

**2026-09-23：** 超出这个包络，或成片效果不好：停，反馈主理人调线上满血 H3。不在本机硬撑，也不由助理代调官方 API。

---

## 1. 验证什么 · 若通过验证的是什么方案

### 1.1 假设

E2 证明 Wan 段内身份稳（49 帧不融）。视频角色真正的漂在**段间**：每段的身份都来自它的起点图。若起点图由 Identity Edit 从图1′ 派生并过立绘级脸门，段间就有了锚；若尾帧续段也不漂，成片可以更省。

### 1.2 若通过，验证的方案

| 方案项 | 通过后落定为 |
|---|---|
| **视频线** | 过立绘级脸门的竖首帧 → Wan 段（无驱动 I2V / 有驱动 Animate 2）→ 视频级脸门 → 段间按 §5 选定的接法。首帧作者 = 少枪闭源融景（E5 工序） |
| **段间接法** | 二选一：尾帧续段（省）或每段重出首帧（稳）；写进成法 §4「视频」旁支 |
| **视频级脸门** | 规范 §1 视频级口径在真段上可判；卡脚本视频模式可用 |
| **8GB 边界** | 记录 I2V 14B 33 / 49 帧、Animate 2 49 帧的耗时与是否 OOM；成片量大时上云 |
| **不验证** | 口型 / 台词；81 帧长段；多角色同框 |

### 1.3 若不过，说明什么

| 结果 | 说明 | 下一步 |
|---|---|---|
| 段内后段融化（I2V） | I2V 14B 无参考锚，长了就漂 | 缩到 33 帧；或改 Animate 2 带参考图 + 静止驱动（人几乎不动的驱动视频） |
| 尾帧续段第二段「近亲」 | 误差累积 | 段间接法定为「每段重出首帧」；尾帧只当构图参考给 Identity Edit |
| 首帧过脸门、Wan 首帧就变 | Wan 的 VAE / 重绘把脸改了 | 提高分辨率到 480×832 以上或人物占比更大；仍变 → 视频级口径下判是否「近亲」，近亲可接受于远景镜头 |
| Animate 2 动作跟不上或换件 | 驱动不合规（同 E2 §1.3） | 重录驱动 |

---

## 2. 前置（主理人点）

- [x] E4 已过：至少一张过立绘级脸门的全身图（优先 E5 的进场景图）—— **2026-09-15**：魔化 + **教堂** pew
- [x] 视频级脸门口径认可（首 / 中 / 尾三帧；近亲 ≤1 帧且不在首帧）—— **2026-09-15 主理人确认**
- [ ] 提供或授权一段 2–3 秒**上身小动作**驱动短片，规格见 §3.4 与 `00-e6-drive-spec.md`（开工前给到；没有它 S3 不跑，S1 / S2 / S4 / S5 不受影响）
- [x] 认可本卡 Wan 2.1 I2V 14B 继续留盘（不挪 `_park_models`）—— E2 已裁：文件名不作废；2026-09-15 ping 下拉仍在

---

## 3. 准备

### 3.1 GPU 机

无新装。`wan2.1_i2v_480p_14B_fp8_scaled`（15.3GB，在盘）· `wan_animate_2_distill_int8_convrot` · umt5 / `wan_2.1_vae` / `clip_vision_h`。Wan 一个 Queue。首帧不走 Krea Queue（除非兜底）。换引擎先 `POST /free`。

### 3.2 编码机

| 项 | 做什么 |
|---|---|
| 首帧 | Cursor `GenerateImage`（须授权）：参考 = E5 pew + 教堂底；`9:16` → 近邻 **480×832**。横 832×480 **本轮后置**。Krea Identity Edit 仅兜底（触限制或主理人改口） |
| I2V 图 | 复用 `tools/comfy-lan/workflows/wan21-vf1-i2v-14b.json`：`start_image` 换首帧；33 帧（先）/ 49 帧；20 步 uni_pc CFG 5 shift 8；加 `SaveAnimatedWEBP` 16 fps |
| Animate 2 图 | `pipelines/c-walk-wan-animate2/scripts/build-wan-animate2-vo-walk.mjs` 生成 49 帧图；参考 = **首帧**（不是印戳）；驱动 = 小动作视频；Cache cpu/int8 |
| 续段 | 脚本取第一段尾帧 → 作第二段 `start_image`（I2V）或 `reference_image`（Animate 2）。S5 重出首帧：先问是否授权 GenerateImage，否则 Krea Identity Edit |
| 脸门卡 | `make-card.mjs --frames f1,f中,f尾`（视频级五列） |
| 过目夹 | `characters/violet-fallen/review/20260915-e6/` |

### 3.3 素材

| 项 | 规格 |
|---|---|
| 首帧源 | E5 教堂过关 `identity/scene/e5-church-pew.png` + 底 `review/20260915-e5/00-e5-scene-B.png` |
| 首帧指令 | 腰以上中景；同一教堂；站定；目光略过镜头；一手搭长凳、一手自然垂；左烛暖光。竖 9:16 |
| 驱动短片 | 见 §3.4 与过目夹 `00-e6-drive-spec.md` |

### 3.4 驱动短片规格与交付（主理人提供 · 只给 S3 用）

| 项 | 要求 | 为什么 |
|---|---|---|
| 内容 | **一个人**做上身小动作，顺序固定：静止 0.5 秒 → 头向观者左侧转约 30° 再转回 → 一只手抬到胸前停 0.5 秒放下 → （可选）另一手拢发 | 动作幅度小、可读、与首帧「站立、手放下」起点一致；转头验脸门，抬手验持物位 |
| 时长 | **2–3 秒**（≥33 帧 @16 fps；3 秒 ≈ 49 帧） | Wan `length` 4n+1，49 帧是 8GB 验证过的上限 |
| 帧率 | 原生 16 fps 最好；30 / 60 fps 也可，编码机按步长抽到 ≈16 fps | 与 E2 同法（`STRIDE`） |
| 构图 | **半身**（腰以上）或全身与首帧一致；人物居中；头顶留空；正面或 3/4 朝观者右侧；镜头固定在胸高 | 首帧是 Identity Edit 出的中景，驱动构图要对得上 |
| 背景 | 纯色墙 / 素模灰棚，无他人、无道具、无镜面 | 防止背景与他人渗入（E2 S3 见过换件从驱动渗入） |
| 人 | 真人或 Mixamo 素模均可；**不要**戴帽 / 墨镜 / 手持物；手不要遮脸 | 遮脸会让视频级脸门判不了 |
| 尺寸 | 竖幅 ≥720×1280 或横幅 ≥1280×720，与首帧同向 | 节点内会 area 缩到 480×832 / 832×480 |
| 格式 | mp4（H.264）；一段一文件 | `LoadVideo` 直读；`/upload/image` 可传 |
| 命名与交付 | `20260915-drive-upperbody-v.mp4` → `characters/violet-fallen/review/20260915-e6/drive/` |
| 授权 | 真人素材由主理人确认可用于内部驱动（不出片、不入库为素材） | 同 E2 `8c3b8794` 口径 |

编码机收到后：`pipelines/c-walk-wan-animate2/scripts/e2-drive-extract.mjs` 出 8 帧缩略 `00-e6-drive-contact-sheet.png`，先看构图与帧率是否合规，再进 S3。本会话 Cursor **无**视频生成接口；短片由主理人交付。动作节拍：`characters/violet-fallen/review/20260915-e6/00-e6-drive-spec.md`。

---

## 4. 执行

| 步 | 枪 | 参数 | 看什么 |
|---|---|---|---|
| S0 首帧 | 1（先竖）+ 脸门 | GenerateImage `9:16`（须授权）→ 近邻 480×832 | 立绘级脸门过；教堂与姿势对。横后置 |
| S1 I2V 段 1 | 1 | 33 帧 · seed 2026091331 · 提示：「she slowly turns her head toward the viewer, hair sways slightly, static camera」 | 视频级脸门；动作有无 |
| S2 I2V 段 1′ | 1 | 49 帧，同 seed | 长一档是否融 |
| S3 Animate 2 段 | 1 | 49 帧 · 参考 = 首帧 · 驱动 = 小动作 · Cache cpu/int8 · seed 2026091333 | 视频级脸门；动作跟驱动 |
| S4 续段 · 尾帧法 | 1 | 取 S1 尾帧 → I2V 33 帧第二段 | 第二段首 / 中 / 尾 vs 基准；vs 第一段尾 |
| S5 续段 · 重出首帧法 | 1 | Identity Edit 以 S1 尾帧为源「same woman, same scene, next shot」→ I2V 33 帧 | 同上，两法并排 |
| S6 第二枪 | ≤3 | 只对「近亲」段换 seed 或缩帧 | 两枪封顶 |
| 合计 | ≤10 段 + 2 首帧 | 8GB：I2V 33 帧约 5–10 分钟；Animate 2 49 帧约 5–13 分钟 | — |

---

## 5. 过目与验收

### 5.1 卡与文件

| 文件 | 内容 |
|---|---|
| `00-e6-firstframe-<v/h>-fg.png` | 首帧立绘级脸门卡 |
| `01-e6-s1-vfg.png` · `02-e6-s2-vfg.png` · `03-e6-s3-vfg.png` | 各段视频级脸门卡（基准 · 首 · 中 · 尾 · 缩略条） |
| `04-e6-chain-tail-vfg.png` · `05-e6-chain-restage-vfg.png` | 两种续段的第二段卡，附「第一段尾帧」列 |
| `06-e6-loops.html` | 各段 16 fps 循环并排 |
| `07-e6-summary.md` | 每段：三帧三态、动作幅度、耗时、OOM、seed、prompt_id |

### 5.2 通过口径

| 项 | 通过 |
|---|---|
| 段内 | S1 或 S3 视频级脸门「过」（三帧无换人，近亲 ≤1 且不在首帧） |
| 段间 | S4 或 S5 的第二段视频级「过」，且第二段首帧 vs 第一段尾帧无「近亲」 |
| 接法选定 | S4 过 → 尾帧续段可用（省）；只 S5 过 → 每段重出首帧（稳）；都过 → 默认尾帧、长链每 2 段重出一次首帧 |
| 8GB | 记录耗时；任一段 OOM 两次 → 该长度记「上云」 |

主理人只看 `01 / 03`（段内）与 `04 / 05`（段间）四张卡 + `06` 循环。

---

## 6. 结果怎么写回

| 结果 | 写哪 |
|---|---|
| 通过 | `combat-identity-chengfa-v1.md` §4 加「视频」旁支（首帧来源、段长、接法）；`pipelines/video-krea2-firstframe-wan/` 建条（含两份 API JSON、续段脚本、脸门卡样例） |
| 通过 | `face-gate-spec-v1.md` 视频级口径转现行；`tools/face-gate/make-card.mjs` 视频模式入库 |
| 任一 | 账本一行；`art-pipeline-feasibility-v1.md` §9 E6 状态；`tools/comfy-lan/call-reference.md` 引擎表补 I2V 用途 |

---

## 7. 停手

视频级「换人」停；同段两枪近亲停；OOM 两次停并记长度。不为动作幅度改第三次提示词——动作要大就换 Animate 2 + 驱动。

## 8. 预算

编码机准备半天（首帧指令、I2V 图改槽、续段脚本、卡脚本视频模式）；出图 1.5–2.5 小时；过目 20 分钟；费用 0（本机）。

## 9. 与 E4 / E5 的关系

依赖 E4（脸门与首帧源）；E5 过则首帧直接用进场景图。E2 的走循环工序不变，本卡不碰局内帧。

## 10. 来源

`pipelines/c-walk-wan-animate2/README.md`（Animate 2 参数、Cache 必开、8GB 耗时）· `identity-validate-vf1-plan-v1.md` §13–§15（Wan 2.1 I2V 14B：人锁、动作弱、`4n+1`、16 fps）· `face-gate-spec-v1.md` §1 视频级 · Comfy 文档 Wan Animate 2（`video_frame_offset` 续段）。

---

## 11. 执行清单（执行者逐条勾）

### 11.1 前置核对

- [x] E4 已过：首帧源确定 —— **魔化教堂 pew** `identity/scene/e5-church-pew.png`
- [x] 基准胸像 `00-bust-ref.png` 在 `characters/violet-fallen/identity/face-gate/`
- [ ] 驱动短片已到 `review/20260915-e6/drive/` 且 `00-e6-drive-contact-sheet.png` 合规（§3.4）；未到则 S3 跳过并记录
- [x] `run-job.ps1 ping`：`WanAnimate2ToVideo` / `WanAnimate2Cache` / `WanImageToVideo` / `LoadVideo` 均 true；UNET 下拉含 `wan2.1_i2v_480p_14B_fp8_scaled` 与 `wan_animate_2_distill_int8_convrot` · **2026-09-15**

### 11.2 准备（编码机）

- [x] 建过目夹 `characters/violet-fallen/review/20260915-e6/`（`00-e6-prep.md` · `00-e6-drive-spec.md`）
- [x] **首帧**：主理人授权一枪 `GenerateImage` 竖 9:16 → `00-e6-firstframe-v.png` · 近邻 `00-e6-firstframe-v-480x832.png` → 脸门 `00-e6-firstframe-v-fg.png` → **等判**。横后置
- [ ] **I2V 图**：复制 `tools/comfy-lan/workflows/wan21-vf1-i2v-14b.json` 为 `wan21-e6-i2v.api.json`；`start_image` 槽 = 首帧；`length` 槽；加 `SaveAnimatedWEBP` 16 fps；提示词 = §4 S1 句；负向沿用
- [ ] **Animate 2 图**：驱动到位后生成 49 帧 480×832（Cache cpu/int8）；参考图槽 = 首帧
- [ ] **续段脚本** `tools/comfy-lan/e6-chain.mjs`：尾帧法 / 重出首帧法（重出先问 GenerateImage 授权）
- [x] `make-card.mjs --frames` 视频模式可用（五列）
- [ ] `tools/comfy-lan/queue-e6.mjs`：按 §4 表跑，`job.json` 记 `{stage, engine, length, size, seed, prompt_id, ms, oom}`

### 11.3 出图（每段打前 `POST /free`；Krea 与 Wan 不同 Queue）

- [x] **S1** I2V 33 帧 seed 2026091331 → `01-e6-s1-vfg.png` + webp · **2026-09-15 主理人：不过（无期望动作）**
- [x] **S1b** I2V 33 帧 seed 2026091332 CFG 6 → `01b-e6-s1b-vfg.png` + webp · **2026-09-15** 628s · 等视频级判
- [x] **33 单拍** seed 2026091333 CFG 6 → `03-e6-s33hold-vfg.png` + webp · **2026-09-15** 623s · 等视频级判
- [x] **H3 I2V 124** 480×864 seed 2026091632 → `05b-e6-i2v124.mp4` · **2026-09-16 主理人：过**
- [x] **S2** I2V 49 帧 同 seed → `02-e6-s2-vfg.png` · **973s**。中/尾融化。等判
- [x] **S3** H3 R2V（首帧 + 驱动）→ `03-e6-s3.mp4`（73f · 33.5 min）· `03b-e6-s3.mp4`（124f · ~125 min）· **2026-09-17 主理人：本机加参考视频成本过大，不作日常**；两枪仍等视频级若要关账
- [x] **S4** 尾帧法：H3 I2V 仅首帧 → `04-e6-s4.mp4` · **2026-09-17 主理人：不过（没锁脸）**
- [x] **S4b** 首+尾帧 → `04b-e6-s4b.mp4` · **2026-09-17 主理人：过** · 锁 `identity/video/e6-s4b.mp4`
- [x] **S5 静帧** GenerateImage → **还可以**（未升格过关立绘）
- [x] **S5 I2V** 480×864 ×124 → `05-e6-s5.mp4` · **2026-09-17 主理人：过** · 锁 `identity/video/e6-s5.mp4`
- [x] 助理预筛每段：首 / 中 / 尾三态；动作幅度（无 / 小 / 够）；耗时；OOM
- [x] **S6**：S4 第二枪即 S4b（首+尾帧）；未第三枪
- [ ] `06-e6-loops.html`（各段 16 fps 并排）
- [x] 交主理人：`01 / 03`（段内）+ `04 / 05`（段间）→ **S4b / S5 过**

### 11.4 收尾

- [x] `07-e6-summary.md`：每段三帧三态、动作幅度、耗时、OOM、seed、prompt_id；段间两法对照结论
- [x] 起草写回（成法 §4 视频旁支；脸门规范视频级首用说明；`pipelines/video-h3-firstframe-chain/`；`call-reference.md` 引擎表），交主理人点
- [x] `art-pipeline-feasibility-v1.md` §8.1 E6 行改状态

### 11.5 交付物

`characters/violet-fallen/review/20260915-e6/`：`00-e6-prep.md` · `00-e6-drive-spec.md` · `00-e6-firstframe-v*` · `01–05` · `06-e6-loops.html` · `07-e6-summary.md`；`drive/`；I2V / Animate JSON + `e6-chain.mjs` + `queue-e6.mjs`。

---

## 12. 验收清单（主理人逐条勾）

### 12.1 首帧（立绘级）

- [x] 竖首帧脸门：**过**（2026-09-15）· `identity/video/e6-firstframe-v.png`
- [ ] 横首帧脸门：**本轮后置**（竖过后再开）
- [x] 场景与姿势符合首帧指令（教堂、搭凳、左烛；全身竖幅主理人接受）

### 12.2 段内（视频级 · 规范 §1）

- [x] S1（I2V 33）：**不过**（无期望动作，2026-09-15）
- [ ] S1b（I2V 33 CFG 6）：首 / 中 / 尾三态；段结论 过 / 不过
- [ ] 33 单拍（转头后停）：首 / 中 / 尾；动作是否四分之一转出画
- [x] H3 I2V 124（480×864）：**过**（2026-09-16 · 转头后停）
- [ ] S2（I2V 49）：同上；相对 S1 是否更漂
- [ ] S3（H3 R2V 指定动作）：`03` / `03b` 已出；**本机加参考视频不作日常**（2026-09-17）；关账仍可视频级判
- [x] 动作幅度：H3 I2V 124 **够**（转头后停）；Wan S1 无

### 12.3 段间

- [x] S4 尾帧法（仅首帧）：**不过**（没锁脸，2026-09-17）
- [x] S4b 尾帧法（首+尾帧）：**过**（2026-09-17）· 第二段首帧 vs 第一段尾帧无近亲
- [x] S5 重出首帧静帧：**还可以**（2026-09-17）
- [x] S5 I2V 第二段：**过**（2026-09-17）
- [x] 接法选定：默认尾帧（须 first+last）；长链每 2 段重出一次首帧。仅首帧续禁用

### 12.4 方案通过口径

- [x] **段内成立**：S1 或 S3「过」→ **是**（H3 I2V 124，2026-09-16；Wan S1 仍不过）
- [x] **段间成立**：S4b 与 S5 第二段「过」且首尾无近亲 → **是**（2026-09-17）
- [x] **视频级脸门可用**：五列卡能判、口径无歧义 → **是**
- [x] **8GB 边界**：H3 480×864 ×124 ≈ 8.5 min · 无 OOM；Wan 49f 融化不上云记

### 12.5 纪律

- [x] 未写 `assets/frames/`；未动局内走帧
- [x] 每段 ≤2 枪；未为动作幅度改第三次提示词
- [x] 驱动短片只作内部驱动，未入库为素材（本卡未收到驱动）

### 12.6 我的裁定（填写）

| 项 | 裁定 | 备注 |
|---|---|---|
| E6 整体 | 部分过 | H3 竖首帧 + 段内 I2V + 段间过；Wan 自由动作不过；本机 R2V+视频不作日常 |
| 视频线 | MiniMax H3 I2V 124 | 480×864 · 8 步 turbo · 锁 `identity/video/` |
| 段间接法 | 默认尾帧（须 first+last）；长链每 2 段重出一次 | 仅首帧续不过 |
| 下一步 | 指定动作不走本机 R2V+视频；优先本机 I2V / 拼接。**2026-09-23：** 效果不好或需求复杂则反馈主理人调线上满血 H3，助理不代调。横首帧后置。`06-e6-loops.html` 未做 | |
