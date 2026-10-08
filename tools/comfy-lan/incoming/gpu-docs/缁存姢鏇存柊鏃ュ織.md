# GPU 机生图环境 · 维护更新日志

只记本机环境变更（安装、监听、防火墙、节点、权重、文档）。不记 Hodiki 冻了哪张工作流。

每次维护写一条。最新在上。写完后同步改 `docs\环境说明.md` 和 `comfy-lan-handshake.json`。

## 2026-09-22 · 补充：QWEN21 工作流编码器修正 + PE 独立工作流 + 对照测试

- **类型**：修正 + 加参考工作流 + 评估（**未改** bat）
- **修正（重要）**：`QWEN21-*.json` 5 张图的编码器**实际是 `qwen3vl_8b_int8_convrot`（8.71 GiB）**——此前批量替换只改到"外层显示槽位"，**没改到 subgraph 内部节点的 `CLIPLoader`**。已用递归替换修正为 **`qwen3vl_8b_w4a8`（5.88 GiB，省 2.83 GiB）**，并对官方模板逐项校验结构（nodes / links / 子图内节点数全部一致）。旧文件备份在 `_backup\qwen21-workflows-before-encfix\`。
- **新增参考工作流**：`QWEN21-PE改写.json` —— 基于官方 `llm_qwen3_5_text_gen.json` 改（4 节点：`CLIPLoader(pe_t2i, type=qwen_image)` → `TextGenerate` → `PreviewAny` + 用法便签）。内嵌官方 system prompt，采样参数 `temperature 0.3 / sampling on` 已实测：**输出合法 JSON，`wh_ratio=2:3`**。
- **对照测试完成**：Krea 2（含 Enhancer 开关 / strength）× Qwen-Image-2.1（含 PE），**62 条出图记录全部成功**。报告 `docs/krea2-vs-qwen21-compare.md`；数据 `docs/krea2-vs-qwen21-results.json`。结论要点：① Krea 快 1.46×（26.2s vs 38.3s）；② **Krea 无 alpha 通道（RGB）**，透明 sprite 只能走 Qwen（RGBA，全透明 65.1%）；③ **Enhancer 是"内容解锁开关"不是画质开关**——旁路后"大哭"题交出完全平静的中性脸，情绪特征全被抹掉；④ Enhancer ON 下 Krea 出字也全对（差距转为"版式是否听话"）；⑤ PE 在已写细的题面上是边际收益，**但产出可跨引擎复用**（喂 Krea 同样有效）。
- **验收**：62/62 success，无 OOM；`/userdata?dir=workflows` 已列出全部 `QWEN21-*.json`（6 张）。
- **对 Hodiki**：**新增** `QWEN21-PE改写.json`；`QWEN21-*.json` 的编码器已从 int8 改为 **w4a8**（省内存，出图质量无可见差异，A/B 已测）；**Krea 2 不支持透明输出**（无 alpha 通道），透明素材请走 Qwen 2.1。对照报告 `docs/krea2-vs-qwen21-compare.md`。

## 2026-09-22 · ComfyUI 0.34.0 → 0.37.0 升级 + Qwen-Image-2.1 落地

- **类型**：升级 + 加权重 + 加参考工作流（**未改** bat；**不冻 API**）
- **原因**：主理人点名评估并部署 Qwen-Image-2.1（2026-09-20 发布，ComfyUI 需 ≥0.37.0）。决策：版本走 **v0.37.0 稳定 tag**；权重走 **int8 DiT + w4a8 编码器**；PE 改写要。
- **做了什么**：
  - 备份 _backup\0.34.0\（2013 文件 / 161.6 MB 源码树 + pip freeze 171 包 + 旧 requirements + bat 副本）。
  - 本机 D:\ComfyUI **无 .git** → 官方 update.py（pygit2）不可用，改为**覆盖式升级**：取 Comfy-Org/ComfyUI v0.37.0 源码包（13,104,933 B）→ robocopy 覆盖，排除 models/custom_nodes/input/output/user/temp/venv/_backup/_stage。
  - 依赖 pip install -r requirements.txt。**踩坑**：清华 PyPI 镜像上 comfyui-workflow-templates-media-assets-02==0.1.3 不存在 → 改用 --index-url https://pypi.org/simple（**未改 pip 全局配置**）。装后 comfy-aimdo 0.5.2→**0.5.5**、comfy-kitchen 0.2.33→**0.2.35**、workflow-templates 0.11.55→**0.11.66**、frontend 1.51.9→**1.52.7**、embedded-docs 0.5.11→**0.5.12**；**torch 仍 2.14.0+cu130，未被覆盖**。
  - 新权重 5 个（字节数均与源站校验一致）：qwen_image_2.1_int8_convrot 6.76 GiB、qwen3vl_8b_w4a8 5.88 GiB、qwen3vl_8b_int8_convrot 8.71 GiB（A/B 用）、qwen3.5_9b_qwen_image_2.1_pe_t2i.int8_convrot 8.82 GiB（PE）、qwen_image_2.1_vae_bf16 0.63 GiB。
  - 新增参考工作流 5 个（结构对官方模板校验一致）：QWEN21-T2I-基础.json（1024²/40 步）、QWEN21-T2I-2K.json（2048²/25 步）、QWEN21-T2I-透明RGBA.json、QWEN21-图片编辑.json、QWEN21-去背景.json。
  - 清理：FLUX2-Klein4B-个人学习.json / FLUX2-Klein4B-改图.json / Wan-Animate-2.json 移出到 _backup\deprecated-workflows\2026-09-22\。
- **验收**（全部 success，墙钟实测）：
  - 既有能力回归：WAI 768×1024/28 步 **21.1s**；Krea2 INT8 1024²/8 步 **54.2s**；H3 T2V 5 帧 0.2 MP **251.2s**（output/SMOKE-H3-037_00001_.mp4）。**789 节点全在，自定义节点无一被打断**。
  - Qwen 2.1：1024²/25 步 **30.1s**；1024²/40 步 RGBA **40.1s**；1488² **70.1s**；**2048² 165.3s（未 OOM）**。**比 Krea 2 更快**（同为 1024² 时 Krea 2 需 54.2s）。
  - 原生透明：alpha 呈双峰（透明区 66.1%，中间带仅 0.7%），一步阈值清理后软边 0.67%，检查板合成干净 → **可替代 InspyrenetRembg**。
  - PE 改写：注入官方 system prompt 后输出合规 JSON {"rewritten_prompt": 331 词, "wh_ratio": "2:3"}，**190s**。同 seed 对照：裸短句→普通生活照；PE 改写→完整商业海报（文字全对）。
  - 编码器 A/B：w4a8 40.1s vs int8 45.1s，**出字与多约束均无可见差异** → 默认用 w4a8（省 2.83 GiB）。
- **踩坑汇总**：① 清华镜像滞后（见上）；② Windows schannel 吊销检查失败 → HF 下载改走 hf-mirror.com + --ssl-no-revoke（官方小文件走 ModelScope API）；③ TextGenerate 的 sampling_mode 是 DynamicCombo，API 必须写**扁平点号键**；④ PowerShell 5.1 读 UTF-8 必须显式 -Encoding UTF8。
- **对 Hodiki**：**新增** Qwen-Image-2.1 一套（DiT qwen_image_2.1_int8_convrot + 编码器 qwen3vl_8b_w4a8 + VAE qwen_image_2.1_vae_bf16；PE qwen3.5_9b_qwen_image_2.1_pe_t2i.int8_convrot）。ComfyUI **0.34.0 → 0.37.0**。参考工作流新增 QWEN21-*.json 5 个（/userdata?dir=workflows）。**旧名作废**：FLUX2-Klein4B-*.json、Wan-Animate-2.json 已移出（权重早已删，别再引用）。评估与实测全文 docs/qwen-image-2.1-eval.md。
---

## 2026-09-16 · H3 R2V 0.4 MP × 362 已通（A 规格）

- **类型**：验收（Queue；**未改** bat）
- **原因**：0.98 MP × 362 暂定未达上限。主理人点名走一枪 0.4 MP 362，摸 15 秒档的分辨率极限。
- **做了什么**：拉起 `start_lowvram.bat`。`--rung r2v_dance_04_362`：480×864、length 362、8 步、LoRA 0.8、beta、浅灰棚提示词、`S101_9x16.png`。prompt_id `accd3af6-85c6-4454-b244-a8e636b78fdb`。
- **验收**：`output/video/S01_dance_v3_studio_480x864_362f_00001_.mp4` **1 927 974** 字节；h264 **480×864**、**362 帧**、15.083s。墙钟 **1560.2s（26.0 min）**。RAM 峰值 **32 146 / 32 479**；工作集 **26 451 MB**；nvidia-smi **7529 / 8188**。**没杀进程。** JSON `docs/h3-r2v-dance-04-362-results.json`。
- **成片**：浅灰棚，无金网舞台；墙上有角影。
- **极限**：15 秒已通 0.4 MP；0.98 MP × 362 仍未达。中间档等点名。
- **对 Hodiki**：成片 `video/S01_dance_v3_studio_480x864_362f_00001_.mp4`。不要当日常交付。walk/skill 仍不冻。

---

## 2026-09-16 · 补墙钟表 + A 工作流解析（未再 Queue）

- **类型**：文档
- **原因**：主理人指出「时长 × 分辨率」表仍停在 T2V 0.2 MP；要确认 0.98×362 失败是不是 A 图操作导致。
- **做了什么**：`h3-test-ops.md` 第 ③ 节拆成 T2V / R2V 两张实测表；第 4b 节写 A 的六段流水线。结论：362 两次走 API `graph_r2v`（无 Switch/公式），与已通的 124 帧 A 同链，只改 length。
- **对 Hodiki**：无新成片。8188 仍须 `start_lowvram.bat` 独立窗口。

---

## 2026-09-16 · H3 R2V 舞蹈 v3 362 重试仍无成片（超时后 8188 挂）

- **类型**：验收失败（Queue；**未改** bat）
- **原因**：主理人点名再试一次 15s。拉起 `start_lowvram.bat` 后同一 A 规格 768×1344 × 362。
- **做了什么**：01:15:02 Queue，prompt_id `726c12a5-2a06-42ca-9839-06f2ac6c7526`。轮询 150 分钟超时后确认 Queue 仍在跑，又多等 90 分钟。
- **验收**：**没成片。** 采样期间 GPU 约 **7808–7878 / 8188**、100%；RAM 长期 **28–32 / 32.5 GB**（比第一枪杀进程时更稳，撑过了 8 分钟）。脚本 03:45 `TIMEOUT`（9001s）；05:16 追加等待也超时。08:17 复查：8188 **10061 拒绝连接**，nvidia-smi **85 MiB / 20%**，系统 RAM **10.1 / 32.5 GB**，`output/video/` 无 `S01_dance_v3*`。JSON `docs/h3-r2v-dance-v3-362-retry-results.json`。
- **对 Hodiki**：**8188 已挂。** 用 `start_lowvram.bat` 独立窗口重拉。walk/skill 仍不冻。

---

## 2026-09-16 · H3 R2V S101 舞蹈 v3 362 帧被杀（0.98 MP / A 规格）

- **类型**：验收失败（Queue；**未改** bat；**不冻 API**）
- **原因**：主理人点名最后一枪高压：768×1344 × **362**，A（8 步 / LoRA 0.8 / beta），浅灰无缝棚。不做 B。
- **做了什么**：`POST /free` 后 `--rung r2v_dance_v3_362 --image S101_9x16.png`。prompt_id `6175b0eb-37d5-4400-b234-b42c0ebe0143`。
- **验收**：**没成片。** 00:23:05 出队；00:28:35 RAM **32 370 / 32 479**；00:28:51 起采样，nvidia-smi **7873→7899 / 8188**（124 帧 A 只有 7056）；00:30:49 最后一刀健康（显存只剩 104 MB）；**00:31:04** 连接被关（10054），随后 8188 拒绝连接（10061）。墙钟约 **8 分钟**，采样只撑了约 **2 分钟**。分类 **system_ram_ceiling_not_cuda_oom**。JSON `docs/h3-r2v-dance-v3-362-results.json`。
- **轮询**：Queue 脚本在 8188 死后仍打 `history poll`，已停。**未**自动拆 3×124，**未**改 bat。
- **对 Hodiki**：**8188 已挂。** 用 `start_lowvram.bat` **独立窗口**重新拉起。walk/skill 仍不冻。

---

## 2026-09-15/16 · H3 R2V S101 舞蹈 v2 A/B（8 步 turbo vs 20 步裸 GGUF）

- **类型**：验收（Queue；**未改** bat；**不冻 API**）
- **原因**：第一枪舞蹈伪影多。主理人放了两张图：A `MiniMax-H3-R2V-S01-dance-v2-8step.json`，B `MiniMax-H3-R2V-S01-dance-v2-noturbo-20step.json`。
- **做了什么**：提示词从工作流节点 138 读取。`S101_9x16.png`，768×1344，124 帧，种子 20260916，`beta` 调度。A：turbo LoRA strength **0.8**、**8 步**。B：不挂 turbo、**20 步**。各 `POST /free` 后 Queue。内存约 15s 一刀。
- **验收 A**：`output/video/S01_dance_v2_768x1344_124f_00001_.mp4` **2 521 064** 字节；h264 **768×1344**、124 帧、5.167s。墙钟 **1272.4s（约 21.2 分钟）**。RAM 峰值 **32 354 / 32 479**；工作集 **24 637 MB**；nvidia-smi **7056 / 8188**。JSON `docs/h3-r2v-dance-v2a-results.json`。
- **验收 B**：`output/video/S01_dance_v2_noturbo_768x1344_124f_00001_.mp4` **1 066 370** 字节；同样 768×1344 / 124 帧 / 5.167s。墙钟 **2524.1s（约 42.1 分钟）**。RAM 峰值 **32 207 / 32 479**；工作集 **25 743 MB**；nvidia-smi **6788 / 8188**。JSON `docs/h3-r2v-dance-v2b-results.json`。
- **对照**：两枪都没杀进程。v1 手/角伪影，A/B 提示词收臂后都干净许多 → **不全是 4 步 turbo 的锅**。A 仍幻觉金网舞台+脚底反射，没跟浅灰棚；B 浅灰棚、角影、身份最贴 S101，髋隔离/手贴脸比 A 清楚。turbo 卡的是**棚景听提示词**，不是手指。B 墙钟约 2× A。
- **闸门**：0.98 MP × 362 两枪无成片。124 帧 A 已通。
- **对 Hodiki**：A `video/S01_dance_v2_768x1344_124f_00001_.mp4`；B `video/S01_dance_v2_noturbo_768x1344_124f_00001_.mp4`。不要当日常交付。walk/skill 仍不冻。

---

## 2026-09-15 · H3 R2V S101 舞蹈 124 帧（0.98 MP / 768×1344）

- **类型**：验收（Queue；**未改** bat；**不冻 API**）
- **原因**：主理人确认四条后点名开第一枪高压：S101 舞装、124 帧、0.98 MP。方案 `WorkBuddy\2026-09-15-21-16-43\MiniMax-H3-S01-舞蹈出片方案.md`。
- **做了什么**
  - 拷原版 `S101.png`（768×1280）到 `input\`；上下各延展 32px → `input\S101_9x16.png`（768×1344）
  - 提示词按 S101（无上衣），编舞时间轴用方案 §4
  - `POST /free` 后 `h3_smoke_queue.py --rung r2v_dance_124 --image S101_9x16.png`；内存约 15s 一刀；运行日志 `docs/h3-r2v-dance-124-run.log`
  - **未**打 362 帧
- **验收**：`output/video/S01_dance_768x1344_124f_00001_.mp4` **1 505 744** 字节；h264 **768×1344**、**124 帧**、24fps、**5.167s**；音频 aac **32 kHz、5.167s**。墙钟 **787.3s（约 13.1 分钟）**。峰值系统内存 **32 435 / 32 479 MB**（比上半身 0.98 更顶）；Python 工作集峰值 **24 815 MB**；nvidia-smi **6932 / 8188 MB**。**不是 CUDA OOM，也没被系统杀掉。** JSON `docs/h3-r2v-dance-124-results.json`。抽帧 `docs/h3-r2v-dance-124-frames/`。
- **成片**：炭灰舞室、全身脚在画面里；叉腰起手 → 双手到脸 → 侧身甩发回眸 → 回正面。服装跟 S101。脸比 0.2 全身可读。手套/手指/角有多肢伪影。
- **闸门**：362 帧 / 15 秒 **等点名**。RAM 只剩约 44 MB 余量，362 风险明显高于 124。
- **对 Hodiki**：成片 `video/S01_dance_768x1344_124f_00001_.mp4`。不要当日常交付。打前 `POST /free`。walk/skill 仍不冻。

---

## 2026-09-15 · H3 R2V 上半身 0.98 MP（124 帧 / 768×1344）

- **类型**：验收（Queue；**未改** bat；**不冻 API**）
- **原因**：主理人点名「试试 0.98，看看这次能否依旧顺利」。沿用 `S01_upper.png`、124 帧、turbo 4、转身回眸+撩发提示词。
- **做了什么**：`POST /free` 后 `h3_smoke_queue.py --rung r2v_upper_098 --image S01_upper.png`（**768×1344**）。打完再 `/free`。**未**打全身 B2、**未**打 15 秒。
- **验收**：`output/video/MiniMax_H3_r2v_upper_098_00001_.mp4` **2 438 842** 字节；h264 **768×1344**、**124 帧**、24fps、**5.167s**；音频 aac **32 kHz、5.167s**。墙钟 **826.3s（约 13.8 分钟）**。峰值系统内存 **32 322 / 32 479 MB**；Python 工作集峰值 **25 090 MB**；nvidia-smi **6853 / 8188 MB**。**不是 CUDA OOM，也没被系统杀掉。** JSON `docs/h3-r2v-upper-098-results.json`。抽帧 `docs/h3-r2v-upper-098-frames/`。
- **对照**：脸和角脊明显比 0.4 利落。动作：正面 → 双手撩发 → 侧身回眸。背景出现参考图没有的红点；手套/手指有糊。身份仍不完全等于 S01。
- **闸门**：全身 B2 / 15 秒 / 更高 MP **等点名**。上半身 5 秒分辨率阶梯到 0.98 为止。
- **对 Hodiki**：成片 `video/MiniMax_H3_r2v_upper_098_00001_.mp4`。墙钟约 14 分钟，仍不要当日常交付。打前 `POST /free`。walk/skill 仍不冻。

---

## 2026-09-15 · H3 R2V 上半身 0.4 MP（124 帧 / 转身回眸+撩发）

- **类型**：验收（Queue；**未改** bat；**不冻 API**）
- **原因**：主理人见 0.2/0.3 较稳，点名升 0.4，提示词加大动作（转身回眸、用手撩发）。
- **做了什么**：`POST /free` 后 `h3_smoke_queue.py --rung r2v_upper_04 --image S01_upper.png`（**480×864**）。打完再 `/free`。**未**打 0.98、**未**打全身 B2。
- **验收**：`output/video/MiniMax_H3_r2v_upper_04_00001_.mp4` **777 611** 字节；h264 **480×864**、**124 帧**、24fps、**5.167s**；音频 aac **32 kHz、5.167s**。墙钟 **418.3s（约 7.0 分钟）**。峰值系统内存 **32 252 / 32 479 MB**；Python 工作集峰值 **25 088 MB**；nvidia-smi 生成约 **5806 / 8188 MB**，解码采样 **5894**。**不是 CUDA OOM，也没被系统杀掉。** JSON `docs/h3-r2v-upper-04-results.json`。抽帧 `docs/h3-r2v-upper-04-frames/`。
- **动作**：正面起 → 侧身回眸 → 手套抬到耳侧撩发 → 手落下仍回眸。动作比前两档大。落手时手套略糊。脸比 0.3 更利落，身份仍不完全等于 S01。
- **闸门**：0.98 MP / 全身 B2 / 15 秒 **等点名**。
- **对 Hodiki**：成片 `video/MiniMax_H3_r2v_upper_04_00001_.mp4`。R2V 仍不要当日常交付。打前 `POST /free`。walk/skill 仍不冻。

---

## 2026-09-15 · H3 R2V 上半身 0.3 MP（124 帧）

- **类型**：验收（Queue；**未改** bat；**不冻 API**）
- **原因**：主理人点名「其他参数不变，升 0.3」。沿用 `S01_upper.png`、124 帧、turbo 4、种子 20260916。
- **做了什么**：`POST /free` 后 `h3_smoke_queue.py --rung r2v_upper_03 --image S01_upper.png`（**416×736**）。打完再 `/free`。**未**打 0.4、**未**打全身 B2。
- **验收**：`output/video/MiniMax_H3_r2v_upper_03_00001_.mp4` **759 822** 字节；h264 **416×736**、**124 帧**、24fps、**5.167s**；音频 aac **32 kHz、5.167s**。墙钟 **337.5s（约 5.6 分钟）**，比 0.2 档 288.5s 大约 +17%。峰值系统内存 **32 282 / 32 479 MB**；Python 工作集峰值 **25 652 MB**；nvidia-smi **6255 / 8188 MB**。**不是 CUDA OOM，也没被系统杀掉。** JSON `docs/h3-r2v-upper-03-results.json`。抽帧 `docs/h3-r2v-upper-03-frames/`。
- **对照**：同构图下 0.3 比 0.2 更利落（蕾丝、角脊、眼高光）。身份仍不完全等于 S01。32GB 顶满程度与 0.2 同级。
- **闸门**：0.4 MP / 全身 B2 / `ref_image_size=max` **等点名**。
- **对 Hodiki**：成片 `video/MiniMax_H3_r2v_upper_03_00001_.mp4`。R2V 仍不要当日常交付。打前 `POST /free`。walk/skill 仍不冻。

---

## 2026-09-15 · H3 R2V 上半身对照（124 帧 / 仍 0.2 MP）

- **类型**：验收（Queue；**未改** bat；**不冻 API**）
- **原因**：主理人要先确认脸崩是不是分辨率过低：参考图改上半身，**仍 0.2 MP**，124 帧。**不是**全身 B2。
- **做了什么**
  - `S01.png` 裁头顶到约腰胯 → `input\S01_upper.png`（768×704，290 077 字节）
  - 脚本加 `r2v_upper`；提示词锁上半身入画、慢转头，不走路
  - `POST /free` 后 `h3_smoke_queue.py --rung r2v_upper --image S01_upper.png`；打完再 `/free`
  - **未**升 MP、**未**打 `r2v_b2` / `r2v_b3`
- **验收**：`output/video/MiniMax_H3_r2v_upper_00001_.mp4` **443 864** 字节；h264 **352×608**、**124 帧**、24fps、**5.167s**；音频 aac **32 kHz、5.167s**。墙钟 **288.5s（约 4.8 分钟）**。峰值系统内存 **32 425 / 32 479 MB**；Python 工作集峰值 **25 231 MB**；nvidia-smi **6742 / 8188 MB**。**不是 CUDA OOM**。JSON `docs/h3-r2v-upper-results.json`。抽帧 `docs/h3-r2v-upper-frames/`。
- **对照结论**：同一 0.2 MP 下，全身 B1 脸只占几个像素、糊成一团；上半身成片后段脸明显可读。脸崩主因是 **0.2 MP 全身时脸上像素太少**，不是 S01 没接到。近景仍有 Q3+4 步的软、身份不完全锁死。
- **闸门**：全身 B2 / 升 MP / `ref_image_size=max` **等点名**。不要当日常交付。
- **对 Hodiki**：成片 `video/MiniMax_H3_r2v_upper_00001_.mp4`。R2V 仍不要当日常交付。打前 `POST /free`，不要和 WAI/Krea/T2V 同队。walk/skill 仍不冻。

---

## 2026-09-15 · H3 R2V B1（22 帧 / S01 / 9:16）

- **类型**：验收（Queue；**未改** bat；**不冻 API**）
- **原因**：主理人说 5 帧太短、脸像变形，点名继续。打 B1 方便看脸。
- **做了什么**：`POST /free` 后 `h3_smoke_queue.py --rung r2v_b1 --image S01.png`；打完再 `/free`。**未**自动打 B2。
- **验收**：`output/video/MiniMax_H3_r2v_b1_00001_.mp4` **70 423** 字节；h264 **352×608**、**22 帧**、24fps、**0.917s**；音频 aac **32 kHz、0.917s**。墙钟 **217.0s（约 3.6 分钟）**。峰值系统内存 **32 228 / 32 479 MB**；Python 工作集峰值 **24 798 MB**；nvidia-smi **7433 / 8188 MB**。**不是 CUDA OOM**。原始 JSON `docs/h3-r2v-b1-results.json`。
- **闸门**：允许 R2V B2（124 帧），**未自动 Queue**。
- **对 Hodiki**：**R2V B1 约 0.9 秒已通，仍不要当日常交付。** 成片 `video/MiniMax_H3_r2v_b1_00001_.mp4`。打前 `POST /free`，不要和 WAI/Krea/T2V 同队。walk/skill 仍不冻。

---

## 2026-09-15 · H3 R2V 5 帧冒烟（S01 / 9:16 / 0.2 MP）

- **类型**：验收（Queue；**未改** bat；**不冻 API**）
- **原因**：主理人指定 `S01.png`、竖版、四档动作阶梯。先打最短档。
- **做了什么**
  - 拷 `S01.png` → `input\S01.png`（541 515 字节）
  - 参考图改 **9:16 / 352×608 / 0.2 MP**；脚本加 `r2v_b1|r2v_b2|r2v_b3`（未自动打）
  - `POST /free` 后 `h3_smoke_queue.py --rung r2v --image S01.png`
  - 打完再 `POST /free`
- **验收**：`output/video/MiniMax_H3_r2v_00001_.mp4` **23 766** 字节；h264 **352×608**、**5 帧**、24fps、**0.208s**；音频 aac **32 kHz、0.2s**。墙钟 **203.8s（约 3.4 分钟）**。峰值系统内存 **32 261 / 32 479 MB**；Python 工作集峰值 **24 026 MB**；nvidia-smi **7443 / 8188 MB**。**不是 CUDA OOM**。原始 JSON `docs/h3-r2v-smoke-results.json`。
- **闸门**：允许 R2V B1（22 帧），**未自动 Queue**。
- **对 Hodiki**：**R2V 5 帧已通，仍不要当交付。** 成片 `video/MiniMax_H3_r2v_00001_.mp4`。竖版 352×608，参考 `S01.png`。打前 `POST /free`，不要和 WAI/Krea/T2V 同队。walk/skill 仍不冻。

---

## 2026-09-15 · H3 R2V 权重 + 8GB 参考图（未 Queue）

- **类型**：权重 + 参考图（**未改** bat；**不冻** walk/skill；**未 Queue**）
- **原因**：主理人确认走 GGUF Q3；1 张参考图 / 5 帧 / 0.2 MP / 单独新图；参考图另外提供；参考视频/音频本轮不做。
- **做了什么**
  - 下 `models/diffusion_models/MiniMax-H3-REF2VA-Q3_K_M.gguf`（**15 577 923 264**）
  - 下 `models/loras/minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors`（**1 956 193 000**，R2V 专用 4-step）
  - 新建 `user/default/workflows/MiniMax-H3-R2V-8GB.json`（官方 r2v 模板克隆：`UnetLoaderGGUF` + `CLIPLoaderGGUF` type=`minimax` device=`cpu` + `MiniMaxH3ReferenceToVideo`；0.2 MP；duration 0.2s；turbo 4 开；只接 1 张 `LoadImage`=`h3_r2v_ref.png`）
  - Queue 脚本加 `--rung r2v`（图不在 `input\` 会直接退出，不会空打）
  - **未**抽 B2 成片当参考图。**未**改 `MiniMax-H3-T2V-8GB.json`
- **验收**：两件体积与 HF 一致。`UnetLoaderGGUF` / `LoraLoaderModelOnly` 下拉可见上述文件。`input\` 尚无主理人参考图，**未 Queue** 5 帧冒烟。
- **对 Hodiki**：**R2V 权重和图好了，还没冒烟，先不要交。** 扩散 `MiniMax-H3-REF2VA-Q3_K_M.gguf`；LoRA `minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors`（不要挂 T2V 那颗 8-step）。参考图 `MiniMax-H3-R2V-8GB.json`。主理人把图放到 `input\h3_r2v_ref.png` 后再点名打。打前 `POST /free`，不要和 WAI/Krea/T2V 同队。不要 Queue 官方 INT8 模板。walk/skill 仍不冻。

---

## 2026-09-15 · H3 编码机调用边界（未冻 API）

- **类型**：文档（**未改** bat；**不冻** walk/skill）
- **原因**：主理人问纯提示词 / 首末帧 / 参考图能否交 Hodiki 调。
- **做了什么**：活页 `h3-test-ops.md` 第 5 节。
- **验收**：T2V 可交（已通到 15s）；首末帧有口未核；R2V 盘上无 ref2va。
- **对 Hodiki**：H3 **不是** walk/skill 冻图。要调视频：打开 `MiniMax-H3-T2V-8GB.json` 或自己冻 API，先 `POST /free`，不要和 WAI/Krea 同队。纯提示词可以。首末帧节点在、未冒烟。参考图锁身份还不行（缺 ref2va）。不要 Queue 官方模板库那张 INT8 图。

---

## 2026-09-15 · MiniMax H3 B3（362 帧 / 约 15s / 0.2 MP / turbo 8）

- **类型**：验收（Queue；**未改** `start_lowvram.bat`；**不冻 API**）
- **原因**：主理人点名打 B3。
- **做了什么**
  - `POST /free` 后 `docs/h3_smoke_queue.py --rung b3`：608×352、length=362、turbo 8、CLIP CPU、种子 20260915
  - 打完再 `POST /free`
- **验收**：`output/video/MiniMax_H3_b3_00001_.mp4` **1 496 696** 字节；h264 **608×352**、**362 帧**、24fps、**15.083s**；音频 aac **32 kHz、15.075s**。墙钟 **671.7s（约 11.2 分钟）**。峰值系统内存 **32 269 / 32 479 MB**；Python 工作集峰值 **25 658 MB**（与 B2 持平）；采样时 nvidia-smi **5120 / 8188 MB**、GPU 约 100%。**不是 CUDA OOM**。原始 JSON `docs/h3-b3-results.json`。
- **闸门**：0.2 MP 时长阶梯结束。升分辨率 / I2V 未做。
- **对 Hodiki**：**H3 B3 约 15 秒已通。** 成片 `video/MiniMax_H3_b3_00001_.mp4`。打 H3 前 `POST /free`，不要和 WAI/Krea 同队。walk/skill 仍不冻。

---

## 2026-09-15 · MiniMax H3 B2（124 帧 / 约 5s / 0.2 MP / turbo 8）

- **类型**：验收（Queue；**未改** `start_lowvram.bat`；**不冻 API**）
- **原因**：主理人点名打 B2。
- **做了什么**
  - `POST /free` 后 `docs/h3_smoke_queue.py --rung b2`：608×352、length=124、turbo 8、CLIP CPU、种子 20260915
  - 打完再 `POST /free`
- **验收**：`output/video/MiniMax_H3_b2_00001_.mp4` **639512** 字节；h264 **608×352**、**124 帧**、24fps、**5.167s**；音频 aac **32 kHz、5.167s**。墙钟 **336.5s（约 5.6 分钟）**。峰值系统内存 **32 215 / 32 479 MB**；Python 工作集峰值 **25 653 MB**（B1 为 24 009，略升）；nvidia-smi **6929 / 8188 MB**，采样时 GPU 约 99%。**不是 CUDA OOM**。原始 JSON `docs/h3-b2-results.json`。原先 20–30 分钟外推过重。
- **闸门**：允许 B3，**未自动 Queue**。B3 墙钟粗估 10–15 分钟。
- **对 Hodiki**：**H3 B2 约 5 秒已通。** 成片 `video/MiniMax_H3_b2_00001_.mp4`。打 H3 前 `POST /free`，不要和 WAI/Krea 同队。walk/skill 仍不冻。

---

## 2026-09-15 · MiniMax H3 B1（22 帧 / 0.2 MP / turbo 8）

- **类型**：验收（Queue；**未改** `start_lowvram.bat`；**不冻 API**）
- **原因**：主理人确认猫题材与闸门后点名打 B1。
- **做了什么**
  - `start_lowvram.bat` 独立窗口拉起 8188（此前探测连不上）
  - `POST /free` 后 `docs/h3_smoke_queue.py --rung b1`：608×352、length=22、turbo 8、CLIP CPU、种子 20260915
  - 打完再 `POST /free`
- **验收**：`output/video/MiniMax_H3_b1_00001_.mp4` **84521** 字节；h264 **608×352**、**22 帧**、24fps、**0.917s**；音频 aac **32 kHz**。墙钟 **233.4s（约 3.9 分钟）**。峰值系统内存 **32 245 / 32 479 MB**（5 帧是 32 348，没有因加长再涨）；Python 工作集峰值 **24 009 MB**；nvidia-smi **7504 / 8188 MB**，采样时 GPU 约 96%。**不是 CUDA OOM**，进程没被杀。原始 JSON `docs/h3-b1-results.json`。
- **闸门**：RAM 权重主导，允许 B2，**未自动 Queue**。
- **对 Hodiki**：**H3 B1 22 帧已通。** 成片 `video/MiniMax_H3_b1_00001_.mp4`。活页 `h3-test-ops.md`。打 H3 前 `POST /free`，不要和 WAI/Krea 同队。walk/skill 仍不冻。

---

## 2026-09-15 · H3 测试活页（可见性 / 素材参数 / 时长×分辨率）

- **类型**：文档（**未改** bat；**不冻 API**）
- **原因**：主理人确认闸门阶梯与猫题材后，要求把「图在不在 UI、能不能和服务同开」「能加哪些素材/参数」「时长×分辨率墙钟与可行性」写成可改、可回溯的一页。
- **做了什么**
  - 新活页 `docs/h3-test-ops.md`（以该文件为准；Cursor 画布只展示）
  - `h3-local-plan.md` 第 10 节指向活页；`环境说明.md` / `任务清单.md` 4.7 / 握手 `docs.files` 挂上
  - 脚本 `docs/h3_smoke_queue.py` 增加 `--rung b1|b2|b3`（默认仍是 5 帧冒烟）
- **验收**：活页在 `docs\`（经 env-docs 联接，Hodiki 可 `/userdata` 拉）。B1 Queue 另记一条。
- **对 Hodiki**：H3 规格与并发说明见 `env-docs/h3-test-ops.md`。打开 `MiniMax-H3-T2V-8GB.json` 不等于 Queue。打 H3 前 `POST /free`，不要和 WAI/Krea 同队。walk/skill 仍不冻。

---

## 2026-09-15 · MiniMax H3 第一枪冒烟（5 帧 / 0.2 MP / turbo 8）

- **类型**：验收（Queue；**未改** `start_lowvram.bat`；**不冻 API**）
- **原因**：主理人要求按 `h3-local-plan` 最短规格走一次冒烟并记墙钟。
- **做了什么**
  - `POST /free` 后 Queue 扁平 API 图（与 `MiniMax-H3-T2V-8GB.json` 同规格）：608×352、length=5、turbo 8、CLIP `device=cpu`、GGUF Q3 DiT + Q2_K encoder
  - 脚本 `docs/h3_smoke_queue.py`；原始 JSON `docs/h3-smoke-results.json`
  - 第一枪 245s：采样 / 视频+音频解码 / CreateVideo **都跑完**；`SaveVideo` 的 DynamicCombo `format` 没进 API.kwargs，落盘失败
  - 第二枪 0.8s：改 `format="auto"`，命中缓存，写出 `output/video/MiniMax_H3_smoke_00001_.mp4`
- **验收**：MP4 **30031** 字节；h264 **608×352**、**5 帧**、24fps、时长 **0.208s**；音频 aac **32 kHz 立体声**。墙钟：**冷跑约 4.1 分钟**（245s）。峰值系统内存 **32 348 / 32 479 MB**（顶满）；nvidia-smi 显存 **7406 / 8188 MB**，采样时 GPU 约 **92–98%**。Python 工作集约 **25 GB**。**不是 CUDA OOM**，是 32GB 内存顶满但进程没被杀。
- **对 Hodiki**：**H3 5 帧 Queue 已通。** 成片 `video/MiniMax_H3_smoke_00001_.mp4`。冷跑约 4 分钟，内存会顶满 32GB。更长片段还没试。打 H3 前 `POST /free`，不要和 WAI/Krea 同队。walk/skill 仍不冻。

---

## 2026-09-15 · MiniMax H3 第一枪：GGUF 节点 + 五件权重（未 Queue）


- **类型**：升级（节点 + 权重 + 参考图；**未改** `start_lowvram.bat`；**不冻 API**；**未 Queue**）
- **原因**：主理人点名按 `docs/h3-local-plan.md` 装本地 MiniMax H3。不换秋叶包。
- **做了什么**
  - 克隆 `custom_nodes/ComfyUI-GGUF`（city96，`6ea2651`）。venv 装 `gguf 0.19.0`（sentencepiece / protobuf 已有）
  - 本机两处补丁（city96 #471 仍开）：`loader.py` 的 `IMG_ARCH_LIST` 加上 `minimax_h3` / `minimax`；`CLIPLoaderGGUF` 补上核心 CLIP 同款 `device=cpu`
  - 下第一枪五件（HF 体积已核）：
    - `models/diffusion_models/MiniMax-H3-FL2VA-Q3_K_M.gguf`（15 577 923 360）
    - `models/text_encoders/qwen3vl-32B-MiniMax-H3-Q2_K.gguf`（8 487 968 160）
    - `models/vae/minimax_h3_video_vae_fp16.safetensors`（5 207 808 496）
    - `models/vae/minimax_h3_audio_vae_fp32.safetensors`（605 254 808）
    - `models/loras/minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors`（1 956 193 000）
  - 参考图 `user/default/workflows/MiniMax-H3-T2V-8GB.json`：官方 `video_minimax_h3_t2v.json` 克隆；`UnetLoaderGGUF` + `CLIPLoaderGGUF` type=`minimax` device=`cpu`；0.2 MP；duration 0.2s；turbo 8 开。**未下** ref2va / NVFP4 / INT8 DiT / 4-step LoRA
  - `start_lowvram.bat` **独立窗口**重启；`--lowvram` 与 `--disable-api-nodes` 未丢
- **验收**：五件体积与 HF 一致。`/system_stats` 200。`UnetLoaderGGUF` / `CLIPLoaderGGUF` object_info 200，下拉可见上述 GGUF；VAE / LoRA 下拉可见两颗 VAE 与 8-step Turbo。D 盘空闲约 **90 GB**。**未 Queue** 5 帧冒烟（32GB 可能顶满，需主理人/试图的人单独打，先 `POST /free`，不要和 WAI/Krea 同队）
- **对 Hodiki**：**H3 第一枪权重好了，但还没冒烟。** 扩散 `MiniMax-H3-FL2VA-Q3_K_M.gguf`；编码器 `qwen3vl-32B-MiniMax-H3-Q2_K.gguf`（CLIP type=`minimax`，device=`cpu`）；VAE `minimax_h3_video_vae_fp16.safetensors` + `minimax_h3_audio_vae_fp32.safetensors`；LoRA `minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors`。参考图 `MiniMax-H3-T2V-8GB.json`。WAI / Krea 文件名不作废。打 H3 前 `POST /free`。walk/skill 仍不冻。不要写 `frames/`。

---

## 2026-09-15 · 清 Wan/SVD/Klein 腾盘给 MiniMax H3

- **类型**：维护（删权重；**未下** H3；**未改** `start_lowvram.bat`；**不冻 API**）
- **原因**：已装视频模型效果都不满意；主理人指定 A+B+C（全部 Wan/SVD）+ Klein 4B 清掉，给 H3 腾空间。替换关系：SVD / Wan 1.3B / Wan 14B I2V / Wan Animate 2 / Klein 4B → 空位留给 H3（尚未下载）。
- **做了什么**
  - `POST /free` 后删除 11 个文件，并去掉空的 `_park_models\`
  - A：`svd_xt.safetensors`、`wan2.1_t2v_1.3B_fp16.safetensors`
  - B：`wan_animate_2_distill_int8_convrot.safetensors`、`wan2.1_i2v_480p_14B_fp8_scaled.safetensors`、`lightx2v_I2V_14B_480p_cfg_step_distill_rank64_bf16.safetensors`
  - C：`umt5_xxl_fp8_e4m3fn_scaled.safetensors`、`clip_vision_h.safetensors`、`wan_2.1_vae.safetensors`
  - Klein：`flux-2-klein-4b.safetensors`、`qwen_3_4b.safetensors`、`flux2-vae.safetensors`
  - **未动** WAI / Krea / IPA 的 `CLIP-ViT-H-14-laion2B-s32B-b79K` / OpenPose。**未装** `ComfyUI-GGUF`。Klein / Wan-Animate 参考 JSON 仍在 workflows，已无对应权重
- **验收**：11 个路径不存在；`_park_models` 已无；`/system_stats` 200；D 盘空闲约 **120 GB**（清前约 62 GB）
- **对 Hodiki**：**Wan / SVD / Klein 权重已删，文件名作废。** 不要再 Queue 14B I2V、Animate 2、Klein、停放的 SVD/1.3B。二次元仍 WAI，非二次元仍 Krea 2。H3 还没下。walk/skill 仍不冻。不要写 `frames/`。

---

## 2026-09-12 · Wan Animate 2 distill INT8 + LightX2V（实验 E2 准备）

- **类型**：升级（仅权重；**未改** `start_lowvram.bat`；**不升 Comfy**；**不冻 API**；**未 Queue**）
- **原因**：编码机实验卡 E2 要在现网 8GB 上用驱动视频出走循环。节点已在 0.34.0，只缺 distill INT8 与 LightX2V。
- **做了什么**
  - 下 `models/diffusion_models/wan_animate_2_distill_int8_convrot.safetensors`（16 653 175 528 字节，约 15.51 GiB）
  - 下 `models/loras/lightx2v_I2V_14B_480p_cfg_step_distill_rank64_bf16.safetensors`（738 005 744 字节）
  - 复用盘上 `umt5_xxl_fp8_e4m3fn_scaled`（type=`wan`）· `wan_2.1_vae` · `clip_vision_h`
  - **未下** non-distill INT8、bf16、官方 `Wan2_1_VAE_bf16`、H3。**未挪** 14B I2V / Klein（D 盘下完后仍约 62.9 GB 空闲）
  - 用 `start_lowvram.bat` **独立窗口**拉起（当时 8188 是关的）；`--lowvram` 未丢。**未 git pull**
- **验收**：`WanAnimate2ToVideo` / `WanAnimate2Cache` / `LoadVideo` 的 object_info 200。`UNETLoader` 下拉含 distill INT8；`LoraLoaderModelOnly` 含 LightX2V。Queue 空
- **对 Hodiki**：**E2 权重好了。** 扩散 `wan_animate_2_distill_int8_convrot.safetensors`；LoRA `lightx2v_I2V_14B_480p_cfg_step_distill_rank64_bf16.safetensors`。VAE 用盘上 `wan_2.1_vae.safetensors`（官方模板写的 `Wan2_1_VAE_bf16` **没有下**）。14B I2V 文件名不作废。本机不代 Queue；打前 `POST /free`。walk/skill 仍不冻。不要写 `frames/`。

---

## 2026-09-11 · Krea 2 Identity Edit 节点 + r128 LoRA（实验 E1 准备）

- **类型**：升级（节点 + 权重；**未改** `start_lowvram.bat`；**不冻 API**；**未 Queue**）
- **原因**：编码机实验卡 E1 要在现网 INT8 Turbo 上做 Identity Edit 换姿。GPU 机只装节点和 LoRA。
- **做了什么**
  - 克隆 `custom_nodes/comfyui-krea2edit`（lbouaraba，`86f886d`）。无额外 Python 依赖。与已有 `comfyui-krea2-ostris-edit` **不是同一包**，两套都留
  - 下 `models/loras/krea2_identity_edit_v1_2_r128.safetensors`（914 159 744 字节，约 0.91GB）。**未下** full 1.83GB、`_r64`、v1 / v1.1
  - `start_lowvram.bat` **独立窗口**重启；`--lowvram` 未丢
- **验收**：`GET /object_info/Krea2EditModelPatch` 与 `Krea2EditGroundedEncode` 200；输入含 `ref_boost` / `fit_mode` / `grounding_px`。`LoraLoaderModelOnly` 下拉含该 r128 文件。Ostris / Control 节点仍 200
- **对 Hodiki**：**E1 GPU 准备好了。** 节点类名 `Krea2EditModelPatch`、`Krea2EditGroundedEncode`。LoRA 文件名 `krea2_identity_edit_v1_2_r128.safetensors`。旧 Ostris 节点名不作废。底座仍 `krea2_turbo_int8_convrot`。本机不代 Queue；编码机组 API 图后、主理人点名再打。打 Krea 前 `POST /free`。walk/skill 仍不冻。不要写 `frames/`。

---

## 2026-09-11 · KSampler `OSError: [Errno 22]`（进度条写控制台）

- **类型**：缺陷修复（核心 logger；**未改** `start_lowvram.bat`；**不冻 API**）
- **原因**：Comfy 从已被掐掉的 Cursor 终端拉起后，KSampler 的 tqdm `\r` 经 Manager → `app/logger.py` 写死控制台，Windows 回 `EINVAL`，整枪失败。采样本身没坏。
- **做了什么**
  - `LogInterceptor.write` / `flush` 吞掉 `OSError` / `ValueError`；`logs` 空时不再 `IndexError`
  - 用 `start_lowvram.bat` **独立窗口**重启；`--lowvram` 未丢
  - Anything V5 256² / 2 步冒烟成功后 `/free`，避免占着 V5 挡 Krea
- **验收**：`errno22_smoke_00001_.png`；`/system_stats` 200 且 argv 仍含 `--lowvram`
- **对 Hodiki**：可继续 Queue。打 Krea 前仍 POST `/free`。不要从 Cursor 终端拉起后再把该终端掐掉。

---

## 2026-09-10 · Vf1 Krea LoRA 扩角两张参考图（本机自 Queue）

- **类型**：参考工作流（**不冻 API**；**未 Queue**）
- **原因**：整包 `Documents\vf1-krea-lora` 已备好；要在 Comfy 里能打开带底图 / 无底图两张图。
- **做了什么**
  - `KREA2-Turbo-Vf1-底图.json`（LoadImage=`vf1-clean.png`，denoise 0.55，Enhancer 关）
  - `KREA2-Turbo-Vf1-无底图.json`（768×1280，denoise 1；**未改**日常 `KREA2-Turbo-基础.json`）
  - 底图 `input\vf1-clean.png`（备用 `vf1-idle-stamp.png`）；提示词 `KREA2-Turbo-Vf1-prompts.md`
- **验收**：两 JSON 在 `user\default\workflows\`；`/userdata?dir=workflows` 能列到。本机不代 Queue
- **对 Hodiki**：新文件名如上。walk/skill 仍不冻。不要写 `frames/`。

---

## 2026-09-10 · Wan I2V 480p 14B fp8 scaled（编码机 D）

- **类型**：升级（挪权重 + 下一颗；**不冻 API**）
- **原因**：1.3B 是 T2V、两枪换人；要 I2V 480p 14B fp8。共用 umt5 / wan VAE / clip_vision_h 必须留。
- **做了什么**
  - SVD `svd_xt.safetensors`、Wan T2V `wan2.1_t2v_1.3B_fp16.safetensors` 挪到 `D:\ComfyUI\_park_models\`（未粉碎；下拉不可见）
  - 只下 `wan2.1_i2v_480p_14B_fp8_scaled.safetensors`（16 401 356 938 字节）到 `models/diffusion_models/`。**未下** e4m3fn / fp16 / 720p / T2V 14B / VACE / H3
  - **未改** `start_lowvram.bat`，**未卸节点**，**未 Queue**。Krea / WAI / Klein 未动
- **验收**：Load Diffusion Model 有 14B fp8 scaled；看不见 SVD 与 1.3B T2V；umt5 / `wan_2.1_vae` / `clip_vision_h` 仍在
- **对 Hodiki**：**D 好了。** 实际文件名 `wan2.1_i2v_480p_14B_fp8_scaled.safetensors`。walk/skill 仍不冻。

---

## 2026-09-10 · Wan 2.1 1.3B 拆包（编码机 C，替换 SVD 日常）

- **类型**：升级（仅权重；**不冻 API**）
- **原因**：SVD 效果不好；Hodiki 要换 Wan 2.1 1.3B（Comfy-Org split_files）。
- **做了什么**
  - 确认 8188 仍 `--lowvram`；**未改** `start_lowvram.bat`
  - 下四件到指定目录：`wan2.1_t2v_1.3B_fp16.safetensors`、`umt5_xxl_fp8_e4m3fn_scaled.safetensors`、`wan_2.1_vae.safetensors`、`clip_vision_h.safetensors`
  - **未下** `wan2.1_i2v_*14B*`、VACE 14B、H3。**未 Queue**、未空 latent 文生
- **验收**：`UNETLoader` 有 `wan2.1_t2v_1.3B_fp16`；`CLIPLoader` 有 `umt5_xxl_fp8_*` 且 type 含 `wan`；`VAELoader` 有 `wan_2.1_vae`；`CLIPVisionLoader` 有 `clip_vision_h`（盘上仍保留 IPA 用的 `CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors`）
- **对 Hodiki**：**C 好了。** SVD 权重未删。walk/skill 仍不冻。

---

## 2026-09-10 · SVD XT 整包（img2vid，编码机 B）

- **类型**：升级（仅权重；**不冻 API**）
- **原因**：Hodiki 要图生视频草稿；编码机脚本认文件名里的 `svd_xt`。
- **做了什么**
  - 确认 8188 在跑且 argv 含 `--lowvram`；**未改** `start_lowvram.bat`
  - 下 `svd_xt.safetensors`（9 559 625 980 字节，stabilityai XT 整包）到 `models/checkpoints/`。1.1 仓库 gated（401），改用可直下的 XT。**未下** decoder-only、H3、Hunyuan、Wan
  - 刷新模型列表（未重启）。**未 Queue**、未开官方 SVD 示例、未写 `frames/`
- **验收**：`ImageOnlyCheckpointLoader`（显示名 Load Checkpoint Image Only (img2vid model)）下拉含 `svd_xt.safetensors`
- **对 Hodiki**：**B 好了。** 编码机 `POST /free` 后再打 8 帧。不要和 WAI / Krea 同时加载。walk/skill 仍不冻。

---

## 2026-09-10 · Krea 2 Ostris Edit 节点

- **类型**：升级（仅节点；**不冻 API**）
- **原因**：Hodiki 要装 A2，给 Krea 参考图编辑（ai-toolkit `edit: true` LoRA）。
- **做了什么**
  - 克隆 `custom_nodes/comfyui-krea2-ostris-edit`（ostris）
  - 重启 Comfy 注册节点。**未下** edit LoRA。**未改** `KREA2-Turbo-*.json` / `WAI-*.json`
- **验收**：`GET /object_info/TextEncodeKrea2OstrisEdit` 与 `Krea2OstrisEditModelPatch` 都不再是 `{}`
- **对 Hodiki**：显示名 `Text Encode Krea 2 Ostris Edit` / `Krea 2 Ostris Edit Model Patch`。CLIP 必须是带视觉权重的 `krea2` encoder。`kv_cache` 仅当 LoRA 训练时开过才开。walk/skill 仍不冻。

---

## 2026-09-10 · Krea 2 骨架（OpenPose Control LoRA）

- **类型**：升级（节点 + 权重；**不冻 API**）
- **原因**：Hodiki 要装 A，给 Krea 用骨架/姿势。
- **做了什么**
  - 克隆 `custom_nodes/comfyui-krea2-controlnet`（facok）
  - 下 `krea2_turbo_openpose_controlnet.safetensors`（~218 MB）到 `models/loras/`（按 Hodiki 指定，不进 `controlnet/`）
  - 重启 Comfy 注册节点。**未改** `KREA2-Turbo-基础.json` / `t2i.json` / `WAI-*.json`，未新建姿势工作流
- **验收**：`GET /object_info/Krea2ControlApply` 不再是 `{}`（显示名 `Krea2 Control Apply`）；`Krea2ControlLoRALoader` 的 `lora_name` 含上述文件
- **对 Hodiki**：类名 `Krea2ControlLoRALoader` / `Krea2ControlApply` / `Krea2ControlImageEncode`。控制图用已有 `comfyui_controlnet_aux` OpenPose 出图，再 Encode → Loader → Apply。8GB 一次一种 Control；Krea 与 WAI 仍分 Queue + `/free`。walk/skill 仍不冻。

---

## 2026-09-09 · 引擎分工：WAI 二次元 / Krea 非二次元；Klein 停用

- **类型**：维护（角色确认；**不冻 API**；**未删盘**）
- **原因**：主理人确认不再用 Klein；Krea 2 改为非二次元主力；WAI 仍为二次元相关主力。
- **做了什么**：改环境说明 / 工作规范 / 任务清单 / 选型清单 / 握手 `notes`。Klein 参考图加停用备注。未改 `WAI-*.json`，未删 Klein 三件套。
- **验收**：文档与握手一致；walk/skill 仍 false
- **对 Hodiki**：二次元继续 WAI；非二次元改走 `KREA2-Turbo-基础.json`。`FLUX2-Klein4B-*.json` 不要日常 Queue。

---

## 2026-09-09 · MiniMax H3 试跑方案（文档，未下权重）

- **类型**：文档（4.7 仍暂缓）
- **原因**：主理人要在 4070 8GB + 32GB 上评估 H3；C13 只写了「内存紧、先别下」，试的人还缺 encoder / CLIP 设备 / 最短冒烟规格。
- **做了什么**
  - 新建 `docs/h3-local-plan.md`（对照 C13、任务 4.7、0.34 模板 `video_minimax_h3_*.json`）
  - 选型清单 C13「本机现在的决定」、任务清单 4.7 各加指向
  - **未下** H3 权重，**未装** `ComfyUI-GGUF`，**未改** `start_lowvram.bat`
- **验收**：方案写明第一枪 T2V 5 帧 / 0.2 MP / CLIP=CPU / 8-step Turbo；NVFP4 非首选；云 API 归服务维护
- **对 Hodiki**：无新节点、无新权重。walk/skill 仍不冻。

---

## 2026-09-09 · Krea 2 基础图 + 仓库图（L1 / Bypass2 / A2R）

- **类型**：升级（参考工作流 + 节点 + 部分权重；**不冻 API**）
- **原因**：主理人同意日常用 INT8 + 可关 Enhancer；仓库先放 L1 三件、Filter Bypass 2、Anything2Real V3，且每组必须有备注防误用。
- **做了什么**
  - 装 `custom_nodes/ComfyUI-Krea2T-Enhancer`（需重启 Comfy 才注册；类名 `Krea2T-Enhancer-Advanced`）
  - 新参考图 `workflows/KREA2-Turbo-基础.json`（裸跑链 + Enhancer，`enabled` 可关，不挂 LoRA）
  - 新参考图 `workflows/KREA2-Turbo-仓库.json`（L1 / Bypass2 / A2R **单挂、无 SaveImage**；各组 Markdown 备注）
  - **未改** `KREA2-Turbo-t2i.json`、**未改** `WAI-*.json`
  - 已下 L1 三件官方 style + A2R V3 到 `models/loras/`。**未下** Filter Bypass 2（仓里节点会红，备注写明）
- **验收**：重启后 `object_info` 有 `Krea2T-Enhancer-Advanced`。基础图 API Queue 冒烟成功：`output\krea2_base_00001_.png`（约 39.4s，Enhancer enabled=true）。仓库图未 Queue（按设计无输出）。Bypass 2 文件仍未下
- **对 Hodiki**：新文件名如上。裸跑图仍在、不作废。walk/skill 仍不冻。

---

## 2026-09-09 · Krea 2 Turbo 裸跑评估（主理人指定）

- **类型**：升级 / 评估（不冻 API）
- **原因**：主理人指定先试 Krea 2 Turbo；清单不得自动逐个试。
- **做了什么**
  - 提示词套件 `docs/krea2-eval-prompts.json`（8 题）
  - 裸跑参考图 `workflows/KREA2-Turbo-t2i.json`（无 enhance、无 LoRA）
  - 对照脚本 `docs/krea2_compare_queue.py`；记录 `docs/krea2-turbo-eval.md`
  - 权重：`krea2_turbo_int8_convrot` + `qwen3vl_4b_fp8_scaled` + `qwen_image_vae`（LoRA 确认前不下）
- **验收**：步骤 3 已跑完。27 枪全成功无 OOM；稳态约 Krea 27s / WAI 18s / Klein 21s。结论写入 `krea2-turbo-eval.md`。未改 `WAI-*.json`。LoRA 仍未下
- **主理人补记（同日）**：Klein 4B：部分情况光影理解优于 Krea 2，细节易出错，整体逊于 Krea 2。未删盘。
- **对 Hodiki**：新参考图文件名如上。对照图在 GPU `output\cmp_*`，不经 walk。walk/skill 仍不冻。

---

## 2026-09-09 · 放开模型评估 + 引擎分工 + 选型清单

- **类型**：维护（规范与评估队列；**未下载**新权重）
- **原因**：4070 上 WAI/Klein 约 20s 已够快；要更强更全面。旧规范的模型黑名单会让评估没意义。`GenerateImage` 是无工作流补位，不是主力。
- **做了什么**
  - 工作规范去掉 Flux/Qwen/Pony/9B 等「默认不下」；改为能力目标 + 1–2 分钟 / 5 分钟包络
  - 写明三套引擎：WAI 主力、`GenerateImage` 补位、本机更强模型待评估
  - 新建 `docs\model-shortlist.md`（原中文文件名 Cursor 无法打开，已改 ASCII）（A1 Klein 9B GGUF → A2 Flux.1 Dev GGUF → A3 Qwen-Image；B 档 SDXL 可控；C 档暂缓）
  - 任务清单增加能力对照与第四步（未下令不下）
- **验收**：文档可经 `/userdata` 拉到；本机未装 GGUF 节点、未下 A/B 档权重
- **对 Hodiki**：拉新清单即可。旧 Klein 4B 文件仍在，默认不当第二引擎。walk/skill 仍不冻。

### 同日补记 · 清单扩写

- 补上 **Krea 2**、**Anima / WAI-Anima**，以及 SD3.5 Large、Schnell、HiDream、Lumina、Hunyuan、Chroma 等目录项
- MiniMax H3：写明官方是视频；静图只是旁路；磁盘约 40GB；本机 8GB+32GB 内存偏紧；不下权重

### 同日补记 · Krea / Anima / NoobAI 说明

- Krea：官方 Raw 不适合直接推理；Turbo 可以裸跑但有蒸馏/CFG/VAE 限制；正路是 Turbo +（官方或社区）LoRA，不是必须先找融合底
- Anima 与本机 WAI（Illustrious）不是换文件：架构、提示词、工具链全换；WAI-Anima 是另一颗
- NoobAI：Illustrious 堂兄弟；先 Eps；V-pred 另说

### 同日补记 · 预估评分

- `model-shortlist.md` 增加三项分（能力 / 4070适配 / 可控）和综合分（0.4/0.4/0.2）
- 写明：综合高不等于最好看；仅 WAI、Klein 4B 有本机实测
- C5–C11 不评分（缺 8GB 对照）
- 各主候选补优劣势


---

## 2026-09-08 · 文档更新流程对齐方案 A

- **类型**：维护（文档怎么写；不冻 API）
- **原因**：服务维护 Agent 已落地 `/userdata` 联接；生图侧规范里还留着「桌面同步 / 拷文件」。
- **做了什么**
  - 工作规范第 6 节改为：只写 `D:\ComfyUI\docs` 与根目录握手；Hodiki 用 `/userdata` 拉
  - 去掉「桌面 / Documents 拷一份当同步」
  - 工作规范硬链接进 `docs\`，可 `/userdata/env-docs%2F工作规范-GPU生图环境.md`
- **验收**：联接仍指向 `D:\ComfyUI\docs`；`/userdata` 能列 env-docs；握手 `docs.files` 含工作规范
- **对 Hodiki**：拉文档方式不变。旧习惯拷文件不作废，但不再必要。

---

## 2026-09-08 · 文档方案 A（/userdata + 联接）

- **类型**：维护（局域网文档同步；不冻 API）
- **原因**：`D:\ComfyUI\docs` 更新后只能拷文件，Hodiki 拿不到及时内容。
- **做了什么**
  - 目录联接 `user\default\env-docs` → `D:\ComfyUI\docs`
  - 硬链接 `user\default\comfy-lan-handshake.json` ↔ 根目录握手
  - 新建 `docs\局域网通信维护记录.md`；环境说明补充拉取 URL
  - 握手增加 `docs`（list / files / handshake）
- **验收**
  - `/system_stats` 仍 200
  - `/userdata?dir=env-docs&full_info=true` 列出 docs 文件
  - 能读到环境说明与局域网通信维护记录
- **没做什么**：没开 SMB、没新端口、没改防火墙规则、没重启 Comfy
- **对 Hodiki**：用 `/userdata/env-docs%2F…` 拉文档；`/docs` 不是这份文档。旧名无。

---

## 2026-09-08 · 恢复提示词预设 + 第二步 Klein 4B

- **类型**：维护 / 升级（工作规范 4.4；不冻 API）
- **原因**：`docs\提示词预设.txt` 误删需恢复；主理人下令推进第二步，且尽量不影响现有 Comfy 工作流。
- **做了什么**
  - 恢复 `docs\提示词预设.txt`（并补 Klein 自然语言段）
  - **未改**已有 `WAI-*.json`，未改启动脚本，未重启 Comfy
  - 只下 4B distilled：`flux-2-klein-4b.safetensors`、`qwen_3_4b.safetensors`、`flux2-vae.safetensors`
  - 新参考图：`FLUX2-Klein4B-个人学习.json`、`FLUX2-Klein4B-改图.json`、`WAI-精修外来底图.json`
- **验收**
  - Klein 文生图约 30s：`output\klein_t2i_00001_.png`
  - 另 Queue WAI 精修外来底约 24s：`output\wai_from_ext_00001_.png`
  - Klein 改图约 40s：`output\klein_edit_00001_.png`
  - `/system_stats` 仍 200
- **没做什么**：没下 9B / Flux Dev / 本地 Qwen Image；没装 AnimateDiff；没冻 walk / skill API
- **对 Hodiki**：立绘仍用 WAI。Klein 文件名见上；采样 Euler / 4 步 / CFG 1；CLIP type=`flux2`。与 WAI **分 Queue**。

---

## 2026-09-08 · 第一步：底图+精修 / 放大 / 锁角色 / 锁姿势

- **类型**：维护（参考工作流与工具；不冻 API）
- **原因**：主理人要求分批推进；本机也要搭好可选用的工作流和工具，Hodiki / 用户按需用、改或另建。
- **做了什么**
  - 工作规范增加「本机准备参考库、按需选用」；进度以 `docs\任务清单.md` 为准
  - 放大：`models\upscale_models\4x-UltraSharp.pth`
  - 参考图：`WAI-底图加精修.json`（832×1216 → 1.5× lanczos → denoise 0.4；UltraSharp 默认旁路）
  - 参考图：`WAI-锁角色-IPAdapter.json`、`WAI-锁姿势-OpenPose.json`（8GB 分两张）
  - 提示词：`docs\提示词预设.txt`（质量 / 分级含 nsfw / 光影；nsfw 不是插件）
  - OpenPose 检测权重：`custom_nodes\comfyui_controlnet_aux\ckpts\lllyasviel\Annotators\`（body / hand / face）
  - 默认参考图：`input\ref_character.png`（来自 `wai_learn_00001_`，请换成自己的）
- **验收**
  - 精修 Queue 约 48s：`output\wai_base_00001_.png`、`output\wai_refine_00001_.png`
  - IPA 约 24s：`output\wai_ipa_00001_.png`
  - OpenPose 约 16s：`output\wai_pose_00001_.png`
  - `/system_stats` 仍 200
- **没做什么**：没下 Klein；没装 AnimateDiff；没换 Illustrious 专用油画 LoRA；没冻 walk / skill API
- **对 Hodiki**：参考 JSON 可打开就用或改；文件名见上。旧名无。不是冻 API。

---

## 2026-09-08 · 个人学习工作流（WAI）

- **类型**：维护（个人生图 / 学习，不冻 API）
- **原因**：主理人要一张基于当前 WAI 的可练手图；优先用现成好评图而不是从零发明。
- **做了什么**
  - 查了 Civitai 上好评 WAI 图（如 Freyja Pixel「Bounty Hunter」）：要 v14+v15 双底模和精修 LoRA，8GB / 当前只装 v170 **不能搬**
  - EasyIllustrious 要再装整包节点，不装
  - 采用 ComfyUI 官方模板 `image_sdxl_simple`，按 WAI 官方推荐改采样与 CLIP Skip
  - 文件：`D:\ComfyUI\user\default\workflows\WAI-Illustrious-个人学习.json`
- **验收**：同参数 Queue，832×1216、28 步、Euler a、CFG 6、CLIP Skip 2、LoRA 强度 0，约 13s，`output\wai_learn_*.png`
- **对 Hodiki**：无。这是个人图，不是 walk/skill API。

---

## 2026-09-08 · 4.1 抠图节点 + 文档分轨

- **类型**：优化 / 升级（工作规范 4.1）
- **原因**：③⑤ 无背景缺本机抠图；维护记录和对外说明要分开。
- **做了什么**
  - 克隆 `D:\ComfyUI\custom_nodes\ComfyUI-Inspyrenet-Rembg`（john-mnz）
  - venv 安装 `transparent-background==1.3.4`
  - 权重 `ckpt_base.pth`（约 351MB）放到 `D:\ComfyUI\models\background_removal\.transparent-background\`
  - `start_lowvram.bat` 增加 `TRANSPARENT_BACKGROUND_FILE_PATH=D:\ComfyUI\models\background_removal`
  - 新建 `docs\环境说明.md`、`docs\维护更新日志.md`
- **没做什么**：没装 Impact Pack；没换油画 LoRA；没装 AnimateDiff / Klein
- **验收**
  - 节点 `InspyrenetRembg`（显示名 Inspyrenet Rembg）已加载
  - 文生图仍通：WAI 768×1024，16 步，约 15s，`output\env_src_00001_.png`
  - 抠图：`output\env_rembg_00001_.png` 为 RGBA，约 29% 全透明，碎发半透明
  - `/system_stats` 200
- **对 Hodiki**：节点类名 `InspyrenetRembg`，旧名无。本机不提供官方抠图 API 图。
- **生图能力**：保留。本次用同一条 Queue 先出图再抠图。

---

## 2026-09-08 · 局域网监听（握手）

- **类型**：维护
- **原因**：编码机 Hodiki 要调本机 8188。
- **做了什么**
  - `start_lowvram.bat`：`--listen 0.0.0.0 --port 8188`
  - 防火墙规则 **ComfyUI LAN Hodiki only**：只允许 `192.168.101.82`
  - 握手文件 `D:\ComfyUI\comfy-lan-handshake.json`（桌面有副本）
- **验收**：本机 `127.0.0.1` 与 `192.168.101.200` 的 `/system_stats` 均为 200。对端连通由 Hodiki 确认。
- **未做**：DHCP 预留（需路由器上手动）；walk / skill API 不由本机冻。

---

## 2026-09-08 · 第一期权重与节点

- **类型**：安装
- **原因**：空环境无法出图。
- **做了什么**
  - ComfyUI 0.34.0 + torch 2.14.0+cu130，路径 `D:\ComfyUI`
  - 节点：`ComfyUI_IPAdapter_plus`、`comfyui_controlnet_aux`
  - 底模：`waiIllustriousSDXL_v170.safetensors`、`Anything-v5.0-PRT.safetensors`
  - OpenPose SDXL / SD1.5、IP-Adapter Plus SDXL、CLIP ViT-H
  - LoRA：像素 `PixelArtRedmond15V-PixelArt-PIXARFK`；油画滑条替补 `oil-painting-sdxl-slider`
  - 启动：`--lowvram --reserve-vram 0.8 --vram-headroom 0.4`
- **验收**：WAI 冒烟 `output\phase1_smoke_00001_.png`；局域网后再冒烟 `lan_smoke_00001_.png`。
