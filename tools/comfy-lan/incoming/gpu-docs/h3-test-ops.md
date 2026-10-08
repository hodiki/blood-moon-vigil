# MiniMax H3 · 测试工作流 / 素材 / 时长分辨率（可改备忘）

给试 H3 的人和主理人。要改规格、回溯某次 Queue，先改本文再动图。

- 整理：2026-09-15；**时长阶梯已跑完**（B3 362 帧，672s）
- 硬件：RTX 4070 Laptop 8GB，32GB RAM，ComfyUI 0.34.0
- 参考图 T2V：`user/default/workflows/MiniMax-H3-T2V-8GB.json`
- 参考图 R2V：`user/default/workflows/MiniMax-H3-R2V-8GB.json`（等 `input\h3_r2v_ref.png`）
- 方案总述：`docs/h3-local-plan.md`；R2V：`docs/h3-r2v-plan.md`
- 5 帧冒烟：`docs/h3-smoke-results.json` → `output/video/MiniMax_H3_smoke_00001_.mp4`
- 画布（Cursor）：`h3-workflow-and-cost.canvas.tsx`、`h3-next-tests.canvas.tsx`（展示用，以本文为准）

修订时在文末加一行，并写 `维护更新日志.md`。

---

## 0. 闸门（时长阶梯已跑完）

锁：**608×352（0.2 MP）**、**turbo 8**、**CLIP CPU**、**GGUF Q3 DiT + Q2 encoder**、种子 **20260915**、室内虎斑猫。  
阶梯：**5 帧 → B1 22 帧 → B2 124 帧 → B3 362 帧，全部已通。** 系统内存峰值始终约 32.2 GB，不是 CUDA OOM。  
不升分辨率。不接首帧图。不和 WAI/Krea 同 Queue。每档前 `POST /free`。不改 `start_lowvram.bat`，除非 ram-kill 且主理人点名维护。

---

## ① 工作流在 ComfyUI 里是否可见；能否同时开着服务

| 项 | 现状 |
|---|---|
| 测试图 | T2V `MiniMax-H3-T2V-8GB.json`；R2V `MiniMax-H3-R2V-8GB.json` |
| UI | 服务起来后，侧栏「工作流」与 WAI/Krea 同目录列出这两张 |
| 局域网 | Hodiki 打开 http://192.168.101.200:8188 是同一个 8188 |
| 官方模板库 | 另有 MiniMax H3 T2V/I2V/R2V，那是 INT8+NVFP4 原图，**不要 Queue** |
| 服务探测（落盘时） | 2026-09-15 17:00 前后 8188 曾连不上；看见图必须先用 `start_lowvram.bat` **独立窗口**拉起 |

MiniMax 不是旁路程序，就是这台 ComfyUI 上的一张图：

| 动作 | 服务 | 走图/技能 API | GPU / 32GB |
|---|---|---|---|
| 只打开图、改提示词、看节点 | 要开着（UI 连 8188） | 不受影响 | 不占生成资源 |
| Hodiki 走 WAI/Krea | 就是这个服务 | 队列空则正常 | 按静图占用 |
| Queue 这张 H3 | 服务仍在，队列被占 | 会排队；内存会顶满 32GB | 独占，禁止同队 WAI/Krea |
| 再开一个 `python main.py` | 不要 | 抢端口和显存 | 冒烟时见过双进程，禁止 |

打完 H3 应 `POST /free`，避免权重钉在内存里拖死后继走图。不冻 walk/skill API。

---

## ② 生成前能加哪些素材；参数做什么

当前 T2V 图任务头：`MiniMaxH3ImageToVideo`（fl2va）。不接图 = T2V。  
R2V 图任务头：`MiniMaxH3ReferenceToVideo`（ref2va）。成片音频从提示词联合解码，不是后配音。两张图 **不要同时 Queue**。

### 素材

| 素材 | 当前 8GB 图 | 模型/节点其实支持 | 这轮猫测试 |
|---|---|---|---|
| 提示词（画面 + 同期声） | 必填 | 联合 AV，声音写在同一段英文 | **用** |
| 首帧图 `first_frame` | 子图有口，空着 | 接上即 I2V；同一颗 fl2va，不用另下权重 | 不用 |
| 末帧图 `last_frame` | 子图有口，空着 | 首+末 = 首尾帧；末帧封面裁切 | 不用 |
| 参考图最多 9 张 | T2V 图没接。R2V 图接 1 张 `h3_r2v_ref.png`（主理人另给，尚未落到 `input\`） | `MiniMaxH3ReferenceToVideo`，提示词 `<Picture i>`；DiT 用 **REF2VA Q3**（已下） | 本轮 R2V 冒烟用 1 张；未 Queue |
| 参考视频最多 3 段 | 没接 | R2V，≥5 帧，`<Video k>` | 不用 |
| 参考音频 | 没接 | R2V `ref_audios` 或 Add Guide | 不用 |
| 任意帧锚点 | 没接 | 核心已有 `MiniMaxH3AddGuide`，可接到现图，仍用 fl2va | 不用 |
| Fun ControlNet | 没接 | 另要 model patch，未下 | 不用 |
| 云 API | `--disable-api-nodes` | 改 bat + 密钥 = 服务维护 | 不用 |

### 当前图参数

| 参数 | 现值（参考图 / 冒烟） | 作用 |
|---|---|---|
| prompt | 见第 4 节 | 唯一文本条件。画面、运镜、音效一段英文。不要屏幕字、logo、embedding |
| duration（秒） | 参考图 0.2 | ×24 再向上对齐 `17k+5`：5, 22, 39, …, 124≈5s, …, 362≈15s |
| ResolutionSelector | 16:9 · 0.2 MP · multiple 32 | 0.2→608×352；官方默认 0.4→864×480；768p 是 0.98→1344×768 |
| noise_seed | 冒烟/加长档锁 **20260915**（参考图里另有 757358688076805，Queue 前改回） | 可复现 |
| turbo_mode | true | true：挂 8-step LoRA；false：20 步满血。8GB 不要关 |
| turbo_steps | T2V **8**；R2V **4** | 去噪步数。R2V 挂专用 4-step LoRA（已下），不要拿 T2V 8-step 去挂 |
| turbo_model_strength | 1 | LoRA 强度。官方为 1 |
| sampler / scheduler / denoise | res_multistep / simple / 1 | 官方组合。denoise=1 表示整段从噪声来；I2V 仍是 1（首帧是条件） |
| CLIP | type=`minimax` device=`cpu` | 改 default 会把 8.5GB 编码器塞进 8GB 显存 |
| 权重 | Q3 GGUF + Q2_K GGUF + 两颗官方 VAE + 8-step turbo | 不要改回 INT8 DiT / NVFP4 encoder |
| CreateVideo / SaveVideo | fps 24 / format=`auto` 字符串 | format 不能是 DynamicCombo 字典（5 帧第一枪在这里失败） |
| first_frame / last_frame | 未接 | 接 LoadImage 会多视觉编码 + VAE encode，更吃内存 |

未露出：video/audio sigma shift（官方默认约 12 / 3）、CFG（BasicGuider，流匹配相当于 1）、负向提示词。

---

## ③ 时长 × 分辨率：墙钟和可行性

锚点分两套。T2V（横版 FL2VA，608×352 / turbo 8）：5 帧 **245s**；B1 **233s**；B2 **336.5s**；B3 **671.7s**。R2V（竖版 REF2VA）：0.2 MP 5/22 帧已通；0.98 MP **124 帧已通**（舞蹈 A 21.2 min）；**0.98 MP × 362 帧两次失败**。系统内存峰值都在约 **32.2–32.4 / 32.5 GB**。失败档也不是 CUDA OOM 报错，是进程被系统杀掉或采到超时仍不写盘。

**T2V 横版**（`MiniMax-H3-T2V-8GB.json`，猫，turbo 8）

| 分辨率 | 相对算力 | 5 帧 · 0.2s | 22 帧 · 0.9s | 124 帧 · 5s | 362 帧 · 15s |
|---|---|---|---|---|---|
| **0.2 MP 608×352** | ×1.0 | **已测 4.1 min** | **已测 3.9 min** | **已测 5.6 min** | **已测 11.2 min · B3 通** |
| 0.3 MP 736×416 | ×1.4 | 勿升 | 勿升 | 勿升 | 勿升 |
| 0.4 MP 864×480 | ×1.9 | 勿升 | 勿升 | 勿升 | 勿升 |
| 0.98 MP 1344×768 | ×4.8 | 勿试 | 勿试 | 勿试 | 勿试 |

**R2V 竖版**（REF2VA Q3，CLIP CPU；舞蹈档步数见第 4b 节）

| 分辨率 | 5 帧 · 0.2s | 22 帧 · 0.9s | 124 帧 · 5s | 362 帧 · 15s |
|---|---|---|---|---|
| **0.2 MP 352×608** | **已测 3.4 min**（全身 S01） | **已测 3.6 min**（全身 B1） | 上半身 **4.8 min**；全身 B2 未打 | 未打 |
| 0.3 MP 416×736 | — | — | 上半身 **5.6 min** | — |
| 0.4 MP 480×864 | — | — | 上半身 **7.0 min** | **已测 26.0 min · 通**（A 8 步 / LoRA 0.8 / beta） |
| **0.98 MP 768×1344** | 勿试 | 勿试 | 上半身 **13.8 min**；舞蹈 v1 **13.1 min** / **A 21.2 min** / B 42.1 min，**均通** | **两次失败**：第一枪杀进程（~8 min）；重试满载 >2.5 h 无成片 |

潜空间时间维：124 帧 T=37；362 帧 T=107（约 **2.9×**）。0.98 MP 像素面积约为 0.2 MP 的 **4.8×**。124 帧 A 采样 nvidia-smi **7056 / 8188**；362 帧采样 **7870–7899 / 8188**。

**取舍：** T2V 只加时长、锁 608×352，15 秒已通。R2V：**0.4 MP × 362 已通**（26 min）；**0.98 MP × 124 已通**；**0.98 MP × 362 未达**。15 秒档的分辨率极限在 0.4 与 0.98 之间。

**B3 闸门（2026-09-15 17:51–18:02）：** 成片 `output/video/MiniMax_H3_b3_00001_.mp4`（h264 608×352、**362 帧**、**15.083s**、aac 32 kHz / 15.075s，1 496 696 字节）。墙钟 **671.7s（11.2 min）**，落在粗估 10–15 分钟内。峰值系统内存 **32 269 / 32 479 MB**；Python 工作集峰值 **25 658 MB**（与 B2 持平）；采样时 nvidia-smi **5120 / 8188 MB**、GPU 约 100%，解码阶段约 **5896 MB**。**不是 CUDA OOM**。0.2 MP + turbo 8 时长阶梯到此结束。下一步若要继续，由主理人另点名（升分辨率 / I2V / 20 步），不要默认接着打。

---

## 4. 视频内容（同一只猫）

英语提示词。不要屏幕字、logo、字幕、embedding。固定机位；B3 才最多两三次硬切。

| 档 | 时长 | 帧 / T | 提示词 | 成片前缀 |
|---|---|---|---|---|
| 冒烟 | 0.2 s | 5 / 2 | A tabby cat walks across a wooden table from left to right. Soft indoor daylight. Footsteps on wood, a faint meow. No text, logos, or subtitles. | `video/MiniMax_H3_smoke` |
| **B1 已通** | 0.9 s | 22 / 7 | A tabby cat walks across a wooden table from left to right and stops at the near edge. Soft indoor daylight. Footsteps on wood, then a faint meow as it stops. No text, logos, or subtitles. | `video/MiniMax_H3_b1` |
| **B2 已通** | 5 s | 124 / 37 | A tabby cat hops onto a wooden table, sniffs a small stack of books, then sits and licks one paw. Soft indoor daylight. Footsteps, a faint meow, quiet room tone. No lyrics, no text, logos, or subtitles. | `video/MiniMax_H3_b2` |
| **B3 已通** | 15 s | 362 / 107 | A tabby cat walks across a wooden table, looks toward a sunlit window, jumps down onto a wooden chair, then lands on the floor and walks out of frame. Soft indoor daylight. Footsteps, a meow, chair creak, landing thump, continuous room tone. At most two hard cuts. No text, logos, or subtitles. | `video/MiniMax_H3_b3` |

Queue 脚本：`docs/h3_smoke_queue.py --rung b1|b2|b3`（默认仍是 5 帧冒烟）。结果 JSON：`h3-smoke-results.json` / `h3-b1-results.json` / `h3-b2-results.json` / `h3-b3-results.json`。

---

## 4b. R2V 内容（Vf1 / S01.png，竖版）

参考图：`input/S01.png`（从 `Documents\vf1-krea-lora\vf1-krea2-20260911\S01.png` 拷入）。正面全身站，黑根红尖角、红眼、黑礼裙红衬、薄手套。

锁：**352×608（0.2 MP 9:16）**、turbo **4**、CLIP CPU、REF2VA Q3、种子 **20260916**、`ref_image_size=match`。提示词都带 `<Picture 1>`。固定机位全身。不要屏幕字、logo、翼、尾、第二人。

| 档 | 时长 | 帧 | 动作 | 成片前缀 |
|---|---|---|---|---|
| **冒烟已通** | 0.2 s | 5 | 原地，发与裙摆轻晃 | `video/MiniMax_H3_r2v` |
| **B1 已通** | 0.9 s | 22 | 转头再看镜头，重心换脚 | `video/MiniMax_H3_r2v_b1` |
| B2 | 5 s | 124 | 两步靠近，右转露红衬，手放下 | `video/MiniMax_H3_r2v_b2` |
| B3 | 15 s | 362 | 三步近、转身、回看、两步退回起始 | `video/MiniMax_H3_r2v_b3` |

Queue：`docs/h3_smoke_queue.py --rung r2v|r2v_b1|r2v_b2|r2v_b3 --image S01.png`。5 帧 203.8s 已通。B1 **217.0s 已通**（22 帧 / 0.917s，RAM 峰值 32 228/32 479）。闸门允许 B2，**未自动打**。

**脸崩对照（2026-09-15，不是 B2）**：参考改 `input/S01_upper.png`（768×704），画布仍 **352×608 / 0.2 MP**，**124 帧**，`--rung r2v_upper`。成片 `video/MiniMax_H3_r2v_upper_00001_.mp4`，墙钟 **288.5s**，RAM 峰值 **32 425/32 479**。同一 0.2 MP，近景脸上像素多则脸可读；全身 B1 脸上像素少则糊。剩余软边仍像 Q3+4 步。抽帧 `docs/h3-r2v-upper-frames/`。

**0.3 MP 对照（2026-09-15）**：其余不变，画布 **416×736**，`--rung r2v_upper_03`。成片 `video/MiniMax_H3_r2v_upper_03_00001_.mp4`，墙钟 **337.5s**，RAM 峰值 **32 282/32 479**，**没杀进程**。细节比 0.2 更利落。抽帧 `docs/h3-r2v-upper-03-frames/`。

**0.4 MP 对照（2026-09-15）**：画布 **480×864**，仍 `S01_upper.png` / 124 帧 / turbo 4，提示词改转身回眸+撩发，`--rung r2v_upper_04`。成片 `video/MiniMax_H3_r2v_upper_04_00001_.mp4`，墙钟 **418.3s**，RAM 峰值 **32 252/32 479**，**没杀进程**。动作落地；落手时手套略糊。抽帧 `docs/h3-r2v-upper-04-frames/`。

**0.98 MP 对照（2026-09-15）**：画布 **768×1344**，其余同 0.4 档，`--rung r2v_upper_098`。成片 `video/MiniMax_H3_r2v_upper_098_00001_.mp4`，墙钟 **826.3s**，RAM 峰值 **32 322/32 479**，nvidia-smi **6853/8188**，**没杀进程**。脸比 0.4 利落；背景有多余红点。抽帧 `docs/h3-r2v-upper-098-frames/`。

**S101 舞蹈 v2 A/B（2026-09-15～16）**：同一提示词（工作流节点 138）、同一 `S101_9x16.png`、同一种子 20260916、**768×1344 × 124**、`beta`。A `--rung r2v_dance_v2a`：turbo LoRA **0.8** / **8 步**。B `--rung r2v_dance_v2b`：Boolean Lightning **false** → 裸 REF2VA GGUF / **20 步**（零下载）。均未杀进程。打完已 `POST /free`。

**S101 舞蹈 0.4 MP × 362（2026-09-16，已通）**：A 规格（8 步 / LoRA 0.8 / beta）+ 浅灰棚锁，画布 **480×864**，`--rung r2v_dance_04_362`。成片 `video/S01_dance_v3_studio_480x864_362f_00001_.mp4`（1 927 974 字节，h264 **480×864**、**362 帧**、15.083s）。墙钟 **1560.2s（26.0 min）**。RAM 峰值 **32 146 / 32 479**；工作集 **26 451 MB**；nvidia-smi **7529 / 8188**。没杀进程。棚是浅灰，没有金网舞台；墙上有角影。JSON `docs/h3-r2v-dance-04-362-results.json`。抽帧 `docs/h3-r2v-dance-04-362-frames/`。打完已 `POST /free`。

**S101 舞蹈 v3 362（2026-09-16，0.98 MP 两次失败）**：A 规格 + 浅灰棚，768×1344 × 362。第一枪 00:23 出队，采样约 2 分钟后杀进程。重试 01:15 出队，撑过杀点，GPU 满载约 2.5 小时仍未写盘，脚本 150 分钟超时；追加 90 分钟仍无 history。08:17 复查 8188 已挂、无 `S01_dance_v3*`。未拆 3×124。JSON `h3-r2v-dance-v3-362-results.json` / `h3-r2v-dance-v3-362-retry-results.json`。

### A 工作流实际跑了什么（不是 Switch 把 362 拖死）

UI 图：`MiniMax-H3-R2V-S01-dance-v2-8step.json`（28 节点 / 32 连线）。默认 **duration=5 → length 124**，不是 362。两组执行是同一条采样链：

1. **加载**：`UnetLoaderGGUF`（REF2VA Q3）+ `CLIPLoaderGGUF`（Qwen3-VL Q2，`device=cpu`）+ 视频 VAE fp16 + 音频 VAE fp32
2. **素材**：`LoadImage` = `S101_9x16.png`（只接 `ref_image_0`；图上 `ref_image_1/2`、参考视频/音频槽是空的，不会多编一次）
3. **条件**：`MiniMaxH3ReferenceToVideo` 吃 CLIP + 双 VAE + 提示词 + 宽高 + length + 参考图，`ref_image_size=match`
4. **A 开关**（仅 UI 图有）：Boolean Lightning **true** → 模型走 `LoraLoaderModelOnly`（4-step turbo，strength **0.8**），步数走 Int Lightning **8**；调度 **beta**，采样器 `res_multistep`
5. **采样**：`SamplerCustomAdvanced` 对 joint AV latent 做 8 步
6. **收尾**：`VAEDecode` + `VAEDecodeAudio` → `CreateVideo` 24fps → `SaveVideo` `format=auto`

UI 上多出来的 `ResolutionSelector`、时长公式、`ComfySwitchNode`、Markdown 备注：**不参与 362 的 API Queue**。两次 362 走的是 `h3_smoke_queue.py` 的 `graph_r2v()`，把 A 的开关结果写死（LoRA 0.8 / 8 步 / beta / 768×1344 / length=**362**），没有 Switch、没有公式节点。

对照：同一条链、同一套权重，**124 帧 A 21.2 分钟通了**。362 只改了 length（潜空间 T 37→107）。第一枪死在采样（GPU 100%、显存只剩 104 MB、还没到 VAEDecode）。第二枪同样 GPU 100% 顶了两个多小时，`output/video` 仍无文件，说明没走到 SaveVideo。所以不是工作流多接了节点，是 **0.98 MP × 362 帧的采样体积** 超过 8GB/32GB。

| | v1（4 步 turbo 1.0 / simple） | v2 A（8 步 turbo 0.8 / beta） | v2 B（20 步裸 GGUF / beta） |
|---|---|---|---|
| 墙钟 | 787.3s（13.1 min） | **1272.4s（21.2 min）** | **2524.1s（42.1 min）** |
| 成片 | `video/S01_dance_768x1344_124f_00001_.mp4` 1.5 MB | `video/S01_dance_v2_768x1344_124f_00001_.mp4` **2.5 MB** | `video/S01_dance_v2_noturbo_768x1344_124f_00001_.mp4` **1.1 MB** |
| RAM 峰值 / 工作集 / smi | 32435 / — / 6932 | **32354 / 24637 / 7056** | **32207 / 25743 / 6788** |
| 棚 | 炭灰舞室 + rim（跟第一枪提示词） | **幻觉金网舞台 + 脚底反射**，没跟「浅灰无缝棚」 | **浅灰无缝棚**，角影在墙上，贴 S101 |
| 角 / 手 | 多肢、多指、角易糊 | 两角干净；手套五指比 v1 好 | 两角干净；侧身时髋上手套仍略糊 |
| 身份 / 光 | 偏暗 | 脸可读，但加了禁止的 rim / 高对比 | 脸、肤、服装最贴 S101 |
| 动作 | 幅度大，伪影也大 | 偏正面站桩，撩发有一点 | 髋隔离 + 手贴脸 + 3/4 侧身比 A 清楚 |
| 抽帧 | `docs/h3-r2v-dance-124-frames/` | `docs/h3-r2v-dance-v2a-frames/` | `docs/h3-r2v-dance-v2b-frames/` |
| JSON | `h3-r2v-dance-124-results.json` | `h3-r2v-dance-v2a-results.json` prompt_id `e439fdb6-…` | `h3-r2v-dance-v2b-results.json` prompt_id `8a06bec7-…` |

结论：第一枪的手/角不全是 4 步 turbo 的锅（提示词收臂 + 锁两角之后 A/B 都干净许多）。**棚景听不听提示词，turbo 是天花板**：8 步 0.8 仍编造金网舞台；关掉 turbo 走 20 步才回到浅灰棚。日常若要身份锁，优先 B 规格；赶时间用 A 就要接受幻觉舞台。

---

## 5. 编码机（Hodiki）能不能调

H3 **不是** walk / skill 的冻 API。本机不替 Hodiki 冻。Hodiki 可以：打开参考图自己 Queue，或按任务自己冻一张视频 API 图，`POST http://192.168.101.200:8188/prompt`。

共用约束（三种素材都一样）：

- 先 `POST /free`，不要和 WAI / Krea / walk / skill **同 Queue**
- 只用 `MiniMax-H3-T2V-8GB.json` 或与 `h3_smoke_queue.py` 同规格的 GGUF 图。**不要** Queue 模板库里官方 MiniMax H3（那是 INT8+NVFP4）
- 锁 608×352、turbo 8、CLIP `device=cpu`、时长对齐 `17k+5`（已核到约 15s）
- `SaveVideo` 的 `format` 必须是字符串 `"auto"`
- 墙钟大约 4–11 分钟；内存会顶满 32GB。打完再 `/free`
- 成片在 GPU 机 `output/video/`。不要写进游戏 `frames/`，除非 Hodiki 自己决定拷贝
- 不冻进现有 walk / skill 图

| 用法 | 现在能否交 Hodiki | 缺什么 | 本机核过没有 |
|---|---|---|---|
| **纯提示词 T2V** | **可以。** 参考图已在 `workflows`；API 图与冒烟脚本同构 | 无新权重。Hodiki 自己冻 API 或 UI 打开 `MiniMax-H3-T2V-8GB.json` | 5 / 22 / 124 / 362 帧已通 |
| **首帧 / 首末帧图**（I2V / FLF2V） | **节点能接，尚未验收。** 子图已有空着的 `first_frame` / `last_frame`，同一颗 fl2va，不用另下权重。图走 `/upload/image` 再 `LoadImage` | 未冒烟。多一次视觉编码 + VAE encode，32GB 顶满时会不会杀进程不知道 | 未测 |
| **参考图锁身份/风格**（R2V） | **还不能当日常交付。** 5 秒至 0.98 MP 已通；**15 秒 0.4 MP 已通**；0.98×362 未达 | 0.98 MP × 15s 本机未达；A 8 步仍可能幻觉舞台 | 0.4 MP×362 已通；0.98 MP×362 失败 |

参考视频 / 参考音频同样走 R2V，**本轮不做**。`Add Guide` 可在现 fl2va 上锚任意帧，也没接线、没冒烟，不作为交付。

R2V 方案：`docs/h3-r2v-plan.md`。Queue：`docs/h3_smoke_queue.py --rung r2v --image S01.png`。

---

## 修订

| 日期 | 谁 | 改了什么 |
|---|---|---|
| 2026-09-15 | 试 H3 | 初稿：可见性/并发、素材参数、时长×分辨率外推、猫题材与 B1–B3 提示词 |
| 2026-09-15 | 试 H3 | B1 Queue 通：233.4s，22 帧，RAM 峰值不高于 5 帧；闸门允许 B2，未自动打 |
| 2026-09-15 | 试 H3 | B2 Queue 通：336.5s，124 帧 / 5.167s；RAM 峰值 32215/32479；闸门允许 B3，未自动打 |
| 2026-09-15 | 试 H3 | B3 Queue 通：671.7s，362 帧 / 15.083s；时长阶梯结束 |
| 2026-09-15 | 试 H3 | 第 5 节：编码机调用边界。T2V 可交；首末帧有口未核；R2V 缺 ref2va 不能交 |
| 2026-09-15 | 试 H3 | R2V B1 通：22 帧 / 0.917s / 217s；闸门允许 B2，未自动打 |
| 2026-09-15 | 试 H3 | R2V 上半身对照：124 帧 / 0.2 MP / 288.5s；脸崩主因是全身时脸上像素少；未打 B2 |
| 2026-09-15 | 试 H3 | R2V 上半身 0.3 MP：416×736 / 124 帧 / 337.5s；没杀进程；未打 0.4 |
| 2026-09-15 | 试 H3 | R2V 上半身 0.4 MP：480×864 / 124 帧 / 418.3s；转身回眸+撩发落地；未打 0.98 |
| 2026-09-15 | 试 H3 | R2V 上半身 0.98 MP：768×1344 / 124 帧 / 826.3s；没杀进程；未打全身 B2 |
| 2026-09-15 | 试 H3 | R2V S101 舞蹈 124 帧 0.98 MP：787.3s；RAM 32435/32479；未打 362 |
| 2026-09-16 | 试 H3 | 舞蹈 v2A 8 步 1272s / v2B 20 步裸 GGUF 2524s；均通；A 幻觉金网舞台 |
| 2026-09-16 | 试 H3 | 舞蹈 v3 362 帧 0.98 MP A 规格被杀（smi 7899，RAM 32370/32479）；8188 挂；未拆 3×124 |
| 2026-09-16 | 试 H3 | 墙钟表补上 R2V 实测；A 工作流解析：362 失败不是 Switch/公式节点 |
| 2026-09-16 | 试 H3 | R2V 0.4 MP × 362 通：1560s / 480×864 / RAM 32146 / smi 7529 |
