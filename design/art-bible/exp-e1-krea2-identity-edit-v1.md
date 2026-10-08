# 实验 E1 · Krea 2 Identity Edit 换姿（准备 → 验收）

> 版本：v1 · 日期：2026-09-11 · 作者：编码机助理（实验卡）
> 状态：**主理人 2026-09-11：大部分过。** C1、C3 有效；C2 类小幅度 / 与底难分辨可能失效。未写 `assets/frames/`。产出在 `_park/` 与 `review-exp-e1/`。
> 上游：`art-pipeline-feasibility-v1.md` §8 · 成法 `combat-identity-chengfa-v1.md` · 停手 `combat-identity-drift-v1.md` · 账本 `identity-validate-vf1-plan-v1.md`
> 姊妹卡：`exp-e2-wan-animate-walk-v1.md`（走循环）· `exp-e3-pixellab-probe-v1.md`（像素原生）

---

## 0. 一句话

用 **Krea 2 Identity Edit LoRA v1.2 + ComfyUI-Krea2Edit 两个节点**，在现网 Krea 2 Turbo 上把已过 Vf1 B-lo 印戳改成「叉腰」和「换重心」两姿，看零件还在不在、姿有没有变。这是 C 轨（换动作）**换作者**的第一试，改动最小：不换底座、不增显存。

---

## 1. 验证什么 · 若通过验证的是什么方案

### 1.1 假设

「同一人换姿」是编辑任务。把参考图放进模型上下文（in-context VAE token + 图像接地的 Qwen3-VL 编码），在**满降噪、空潜空间**下按指令出图，身份来自参考 token 而不是提示词，因此能同时做到「人不换、姿改了」。旧 C 轨在 Krea i2i 低 denoise 上做不到这件事，是 img2img 的性质，不是参数问题。

### 1.2 若通过，验证的方案

| 方案项 | 通过后落定为 |
|---|---|
| **C 轨作者（静姿）** | 编辑类模型：参考 = 已过印戳，控制 = 指令（必要时叠骨架 LoRA），满降噪。技能 a / b、设定表扩角、立绘级换件都走这条 |
| **条文判据** | 合法性按「身份来源」判：参考在上下文里的编辑模型允许 EmptyLatent / denoise 1；纯 t2i + OpenPose 仍禁。写进 `combat-64-workflow-v1.md` 与成法 §3–§4（主理人点） |
| **引擎表** | Krea 栏加一行「Identity Edit（换姿 / 换装 / 设定表）」；与 WAI 仍分 Queue |
| **算力** | 8GB 现网可跑，不必先租云或升卡就能开 C 轨静姿 |
| **不验证** | 走循环（E2）；像素原生（E3）；D 轨 LoRA 是否需要 |

### 1.3 若不过，说明什么

| 漂类 | 说明 | 下一步（不是第三枪） |
|---|---|---|
| 人在、姿没变 | 指令控姿不够；身份路对 | E1-b：叠盘上 `krea2_turbo_openpose_controlnet`（thedeoxen）+ Identity Edit，满降噪出姿（新判据下合法）；或转 Qwen-Image-Edit + DWPose（需 12GB / 云） |
| 姿变、人换件 | `ref_boost` / `grounding_px` 不够，或角、蕾丝这类罕见件被基座先验拉走 | 先扫 `ref_boost` 6–8、`grounding_px` 1024；仍漂 → 叠主体 LoRA（D 轨提前，料用 B-lo 同衣套） |
| 选人表 / 双人 / 风格横跳 | 出了训练范围（>2MP 或 grounding 过高） | 降 `grounding_px`、限 ≤1MP。仍出 → 记引擎限，转 Qwen-Edit |
| 节点或 LoRA 装不上 / INT8 不吃 LoRA | 环境问题，不是方案问题 | 换 `_r64` 低秩权重；仍不行 → 主理人决定是否另下非 INT8 Turbo 权重 |

---

## 2. 前置（主理人点）

- [x] 允许 GPU 机装 `comfyui-krea2edit` 节点包（`custom_nodes/`，无额外 Python 依赖）
- [x] 允许下载 LoRA `krea2_identity_edit_v1_2_r128.safetensors`（0.91GB；备 `_r64` 0.46GB）到 `D:\ComfyUI\models\loras\`
- [x] 认可「工具准入实验」模式：本卡允许**一次 ≤6 格参数扫描**，扫完再进两枪封顶
- [x] 认可本卡的 EmptyLatent / denoise 1 是**新判据下的合法工**（身份来自参考 token），不算违反 R 条
- [x] 过目仍只问零件表；「过」只由主理人说

---

## 3. 准备

### 3.1 GPU 机（HodikiX）

| 项 | 做什么 | 验证 |
|---|---|---|
| 节点 | `cd D:\ComfyUI\custom_nodes && git clone https://github.com/lbouaraba/comfyui-krea2edit`，重启 Comfy | 编码机 `GET /object_info/Krea2EditModelPatch` 与 `Krea2EditGroundedEncode` 均 200 |
| LoRA | `krea2_identity_edit_v1_2_r128.safetensors` → `models\loras\` | `GET /object_info/LoraLoaderModelOnly` 下拉含该文件 |
| 底座 | 不变：`krea2_turbo_int8_convrot.safetensors` · `qwen3vl_4b_fp8_scaled.safetensors`（type=`krea2`，device=cpu）· `qwen_image_vae.safetensors` | 已在握手 |
| 显存 | 与日常 Krea Turbo 同级；LoRA r128 约 +0.9GB。**待探：** INT8 convrot 权重吃不吃 LoRA（对照：LoRA 强度 1.0 与 0 出图应明显不同） | 第一枪即验 |
| 卫生 | 换引擎前 `POST /free`；不与 WAI / Wan 同 Queue | — |

### 3.2 编码机（Hodiki）

| 项 | 做什么 |
|---|---|
| 工作流 | 新建 `tools/comfy-lan/workflows/krea2-vf1-identity-edit.api.json` + `.slots.json`（槽：`image_ref` · `positive` · `seed` · `ref_boost` · `grounding_px`）。接线见 §4.1 |
| 客户端 | `run-job.ps1 queue -Workflow … -Slots … -Ref <印戳>`。现有 `--ref` 槽即可，不改 `run-job.mjs` |
| 探活 | `run-job.mjs` 的 `NODE_PROBES` 加 `Krea2EditModelPatch` / `Krea2EditGroundedEncode`（一行改动，方便 ping 看到） |
| 入盒 | 复用 `locked/combat-64/_inspect/vf1-box-b.mjs`（同 B-lo 参数近邻 128）与 `vf1-c-strip.mjs`（对照卡） |
| 过目夹 | 新建 `assets/ui-menu/preview/locked/review-exp-e1/`，编号 `01-…` |

### 3.3 素材

| 项 | 路径 | 说明 |
|---|---|---|
| 参考底（唯一） | `assets/ui-menu/preview/locked/review-identity-vf1/12-idle-blo-passed-stamp.png` | 已过 B-lo 印戳，512×1024，夜空底。**不用立绘、不用 128 当底** |
| 已过 128（对照） | `…/review-identity-vf1/12-idle-blo-passed-128.png` | 对照卡右列 |
| 旧 C 失败对照 | `…/review-identity-vf1/15-c1-stamp-and-128.png` · `25-c-ostris-c1-stamp-and-128.png` | 同姿旧枪，放过目板最右 |
| 零件表 | 账本 §3 八条：黑根红尖双角 · 红眼 · 墨色长卷过肩 · 苍肤 · 黑礼裙抹胸 + 蕾丝 bib 高领 · 黑蕾丝手套（前臂）· 高开叉红衬 · **红高跟** | 过目只问这八条 |

---

## 4. 执行

### 4.1 接线（单图编辑 · 潜空间路）

源图尺寸 = 输出尺寸（512×1024），走纯潜空间路，不接 `vae + source_image` 像素路，省显存。

```
LoadImage(印戳 512×1024) ─┬─ VAEEncode ─────────────── Krea2EditModelPatch.source_latent
                          └─ Krea2EditGroundedEncode.image   (+ 指令；grounding_px)
UNETLoader(krea2_turbo_int8_convrot) ── LoraLoaderModelOnly(identity_edit_v1_2_r128 @1.0)
   ── Krea2EditModelPatch(ref_boost, fit_mode=fit) ── KSampler.model
Krea2EditGroundedEncode(指令) ────────────────────── KSampler.positive
Krea2EditGroundedEncode(空指令 · 同图) ─────────────── KSampler.negative
EmptySD3LatentImage(512×1024) ─────────────────────── KSampler.latent_image  (denoise 1)
KSampler(euler · simple · 10 步 · CFG 1) ── VAEDecode ── SaveImage(prefix comfy_lan_e1_)
```

`Krea2T-Enhancer` 不接。`source_latent_b` / `image_b` 留空（两图模式是「场景 + 人」，不是「人 + 姿」，本卡不用）。

### 4.2 指令（Qwen3-VL 要整句，不要词袋）

共用身份句（每枪原样）：

> Keep this exact woman and her costume unchanged: two horns with black roots and red tips, red eyes, pale skin, long wavy jet-black hair past the shoulders, black evening gown with a lace bib high collar, black lace gloves ending on the forearms, high slit with red lining, red high heels, empty dark void background, same flat cel-shaded illustration style.

姿势句（每枪只接一条）。**写画面里看见的改变**（画幅左/右、触地点、肩髋线），不要把角色解剖（她的左腿/右腿）当指令。

| 姿 | 句 |
|---|---|
| C1 叉腰 | Change only her pose: she stands with both hands on her hips, elbows pointing out, weight even on both feet, facing the same direction as before. |
| C2 换重心（v1 · 废） | Change only her pose: she shifts her weight onto her left leg, right knee relaxed, hips tilted, arms hanging loosely at her sides. |
| C2 换重心（v2 · 画面向） | Repose the character into a contrapposto stance. Her weight rests on the straight vertical leg on the LEFT side of the frame; the opposite knee bends slightly forward and its toe stays lightly on the ground, heel raised. The hip on the supporting side rises, the pelvis tilts, and the shoulder line counter-tilts in the opposite direction, creating a subtle S-curve through the torso. |
| C3 可选 · 走接触（v2 · 画面向） | Change her pose to a mid-stride walk moving toward the RIGHT side of the frame, her body turned into a three-quarter profile facing right. The front leg extends forward with the heel striking the ground, while the back leg extends fully behind with the heel raised high. Both feet stay on the same ground line. The torso leans slightly forward so the shoulders sit ahead of the hips; the hips counter-rotate against the shoulders; the coat hem and her hair trail backwards, away from the direction of travel, lifted slightly by the step. |

负向：空指令 + 同图（CFG 1 时不起作用，但按训练布局接上）。

### 4.3 枪数与顺序

| 步 | 枪 | 固定 | 变 | 目的 |
|---|---|---|---|---|
| S0 冒烟 | 1 | C1 句 · seed 2026091101 · ref_boost 4 · grounding 768 | LoRA 强度 1.0 vs 0 各一张（算 1 格） | 节点通、INT8 吃 LoRA、出图不是选人表 |
| S1 扫描（≤6 格） | 6 | C1 句 · seed 2026091101 · 10 步 · CFG 1 | `grounding_px` ∈ {512, 768, 1024} × `ref_boost` ∈ {2, 4} | 找「人在 + 姿变」的工况。若 6 格全「姿没变」，扫描不再加格，转 §1.3 第一行 |
| S2 两枪 · C1 | 2 | S1 最优格 | seed 2026091102 / 03 | 生产口径 |
| S3 两枪 · C2 | 2 | 同 | seed 2026091104 / 05 | 第二姿 |
| S4 可选 · C3 | 2 | 同 | seed 2026091106 / 07 | 预看静态编辑能否出走接触（不替代 E2） |

合计 11–13 张，8GB 上每张约 1–2 分钟。**两枪满仍漂 → 停，不第三枪，写漂类。**

### 4.4 落盘

- 原出：`assets/ui-menu/preview/locked/combat-64/_park/comfy-lan/<ISO>/`（`run-job` 自动，含 `job.json`）
- 过目：`assets/ui-menu/preview/locked/review-exp-e1/`

| 文件 | 内容 |
|---|---|
| `01-e1-sweep-grid.png` | S1 六格 + 底图，标 grounding / ref_boost |
| `02-e1-c1-a-raw.png` · `03-e1-c1-a-128.png` · `04-e1-c1-a-card.png` | C1 枪 A：印戳 · 近邻 128 · 对照卡（印戳 / 128 原大 / 128 ×4 / 已过 idle 128 / 旧 C1） |
| `05–07` | C1 枪 B |
| `08–13` | C2 枪 A / B |
| `14-e1-summary.md` | 每枪零件表勾选 + 漂类 + prompt_id |

---

## 5. 过目与验收

### 5.1 过目板

按流程 §5：先封洞、坐石板 `#2A3444`、近邻 ×4。对照卡固定五列：**本枪印戳 · 本枪 128 原大 · 本枪 128 ×4 · 已过 idle 128 ×4 · 旧 C 同姿（15 / 25 号卡）**。脸按已定分层判：印戳细看，128 只算呼吸。

### 5.2 判据（全「是」才交主理人）

| # | 问 | 是 / 否 |
|---|---|---|
| 1 | 零件表八条在印戳上 ≥7 可指，且**换件 = 0**（丢蕾丝网可以；红鞋变黑、领变细带、手套变长袖 = 换件） | |
| 2 | 姿势按句子变了：C1 两手在髋、肘外张；C2 重心单腿可读 | |
| 3 | 单人、单帧、无网格 / 三视图 / 第二人 | |
| 4 | 仍是同一套画法（平涂 cel），不是 Q、不是油画、不是写实 | |
| 5 | 近邻 128 后角、眼位、裙、开叉红条仍能指；无体内真洞 | |
| 6 | 相对已过 idle 128 不换头、不换衣、不全身乱长 | |
| 7 | 未写 `frames/`；原出在 `_park/`，过目在 `review-exp-e1/` | |

### 5.3 通过 / 失败口径

- **通过**：C1、C2 各至少一枪全「是」，且主理人点「过」。
- **部分**：C1 或 C2 只有一姿过 → 记「静姿可用、幅度受限」，仍算方案成立，另一姿走 E1-b。
- **失败**：两姿两枪均在 §1.3 某一漂类 → 停，写漂类，按该行下一步，不加种子。

主理人只看 `04 / 07 / 10 / 13` 四张对照卡 + `01` 扫描图（C2 v2 / C3 另看 `17 / 20 / 23`）。

**主理人 2026-09-11：大部分过。** C1、C3 有效。C2 类动作幅度过小或与原图区别不明显的可能失效。提示词着重视觉描述，不要物理描述。不成全绿，成法仍草案；C 轨静姿作者按部分口径换为 Identity Edit。

---

## 6. 结果怎么写回

| 结果 | 写哪 | 谁写 |
|---|---|---|
| 通过 | `combat-identity-chengfa-v1.md` §4 C 轨作者改为「编辑模型 · 参考 = 已过印戳 · 满降噪」；§1.1 路线图加 E1 节点 | 助理起草，主理人点 |
| 通过 | `combat-64-workflow-v1.md` 合法性判据一条（身份来源）；R 表加一行「编辑模型满降噪 ≠ OpenPose+t2i」 | 同上 |
| 通过 | `tools/comfy-lan/call-reference.md` §0 / §4.4 引擎表加 Identity Edit；工作流 JSON 入 `workflows/` | 助理 |
| 任一 | `identity-validate-vf1-plan-v1.md` §6 记日期、枪、漂类、prompt_id | 助理 |
| 任一 | `art-pipeline-feasibility-v1.md` §8 表 E1 行改状态 | 助理 |

通过后**第一张生产帧**：守誓技能 a（底 = `hero-violet-idle-128-v1-stamp.png`），仍两枪封顶、仍过目、仍主理人过才写 `frames/`。

---

## 7. 停手

出现 `combat-identity-drift-v1.md` 任一类（换人 / 丢脸 / 错产品 / 风格横跳 / 同底连打 3 枪不认）当场停。S1 扫描是**一次**六格，不是六轮；扫描内出现选人表也停扫，先降 `grounding_px` 再决定是否继续。

---

## 8. 预算

| 项 | 估 |
|---|---|
| GPU 机准备 | 0.5 小时（clone + 下 0.9GB + 重启） |
| 编码机准备 | 1–2 小时（API JSON、槽、探活、过目脚本沿用） |
| 出图 | 11–13 张 × 1–2 分钟 ≈ 0.5 小时 |
| 过目 | 主理人 15 分钟看 5 张卡 |
| 费用 | 0 |
| 显存 | 与日常 Krea Turbo 持平 + LoRA r128 约 0.9GB；不够则换 `_r64` |

---

## 9. 与 E2 / E3 的关系

E1 只答「静姿能不能换作者」。**大部分过之后下一条实验是 E2**（走循环 · 驱动视频）。E1-b（叠 `krea2_turbo_openpose_controlnet`）不是队列里的下一步，只是静姿幅度太小、主理人仍要点那一姿时才开。C3 只是迈步接触预看，不替代 E2。E3 独立。

## 10. 来源

conradlocke/krea2-identity-edit（模型卡：v1.2 · `ref_boost` · Turbo 8–12 步 CFG 1 · ≤2MP · 已知限制）· lbouaraba/comfyui-krea2edit（README：节点、最小接线、潜空间路）· 本仓库 `identity-validate-vf1-plan-v1.md` §8 / §10（旧 C 失败对照）· 握手 `incoming/handshake.json`（2026-09-10 模型清单）。
