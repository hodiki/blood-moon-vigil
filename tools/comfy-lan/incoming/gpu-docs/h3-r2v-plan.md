# MiniMax H3 · R2V（参考图）更新方案

主理人已确认（2026-09-15）：**GGUF Q3**；1 张图 / 5 帧 / 0.2 MP / 单独新图；图另外提供；参考视频/音频本轮不做；5 帧若被杀再视情况定。

**已执行到 S101 舞蹈：124 帧至 0.98 MP（v1/v2A/v2B）；0.4 MP × 362 已通（1560s）；0.98 MP × 362 未达。** 本机 15 秒档目前通的是 **480×864**。

整理：2026-09-15。机器：HodikiX，RTX 4070 Laptop 8GB，32GB RAM，ComfyUI 0.34.0，`D:\ComfyUI`。  
活页：`docs/h3-test-ops.md` 第 5 节（R2V 冒烟前仍不能交 Hodiki）。

目标：补上 **ref2va + `MiniMaxH3ReferenceToVideo`**，让「一张（或几张）参考图 + 提示词」能出视频，供编码机日后调用。本方案**第一枪只做参考图**，不做参考视频 / 参考音频。

---

## 1. 三条路（请选一条）

| | A · 推荐 | B | C · 不建议 |
|---|---|---|---|
| DiT | `MiniMax-H3-REF2VA-Q3_K_M.gguf`（realrebelai，约 **15.6 GB**） | 官方 `minimax_h3_ref2va_pruned_int8_convrot.safetensors`（约 **19.5 GB**） | 把 R2V 节点塞进现有 `MiniMax-H3-T2V-8GB.json`，一张图里两颗 DiT |
| 和 T2V 的关系 | 与已通的 FL2VA-Q3 同一量化档；encoder / 两颗 VAE **复用** | 官方模板原件，质量可能略好 | 容易一次加载两颗 15GB+ 权重，32GB 必爆 |
| 内存 | T2V Q3 已在 32.2 GB 顶满但没死；R2V 参考 token 每步都在，**更险**，仍比 INT8 有机会 | 社区 12GB 卡 REF2VA 有过 **系统内存 >43GB** | 直接否 |
| 额外 LoRA | `minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors`（约 1.82 GB，**R2V 专用 4 步**） | 同左（官方 R2V 模板就是 4-step） | — |
| 下载量 | 约 **17.4 GB** 新文件 | 约 **21.3 GB** 新文件 | — |

**推荐 A。** 不要拿 T2V 那颗 `fl2v_turbo_8step` 去挂 R2V。不要 Queue 模板库官方 R2V 原图（它指向 INT8 DiT + NVFP4 encoder）。

若你点名走 B：可以，但第一枪失败时不要指望再叠 GGUF 当补丁——32GB 上应先停，而不是两套 DiT 都留下。

---

## 2. 第一枪规格（锁定）

复用已在盘上的：

- `text_encoders/qwen3vl-32B-MiniMax-H3-Q2_K.gguf`（CLIP `type=minimax` `device=cpu`）
- `vae/minimax_h3_video_vae_fp16.safetensors`
- `vae/minimax_h3_audio_vae_fp32.safetensors`

新下（仅当确认 A）：

| 文件 | 约 | 目录 | 源 |
|---|---|---|---|
| `MiniMax-H3-REF2VA-Q3_K_M.gguf` | 15.6 GB | `models/diffusion_models` | [realrebelai/MiniMax-H3_GGUFs](https://huggingface.co/realrebelai/MiniMax-H3_GGUFs/resolve/main/MiniMax-H3-REF2VA-Q3_K_M.gguf) |
| `minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors` | 1.82 GB | `models/loras` | [Comfy-Org/MiniMax-H3/loras](https://huggingface.co/Comfy-Org/MiniMax-H3/resolve/main/loras/minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors) |

下载命令（与现网一致）：`curl.exe -L --proxy http://127.0.0.1:10808 -C -`。

工作流：

- **新建** `user/default/workflows/MiniMax-H3-R2V-8GB.json`
- 从官方 `video_minimax_h3_r2v.json` 克隆，改成 GGUF 加载器 + CLIP CPU + 0.2 MP
- **不改** `MiniMax-H3-T2V-8GB.json`（T2V 已验收）
- 节点头：`MiniMaxH3ReferenceToVideo`；`ref_image_size=match`（不要第一枪就 `max`）
- 只接 **1 张** `ref_image_0`；`ref_video_*` / `ref_audio_*` 空着
- 提示词必须带 `<Picture 1>`
- 分辨率 **608×352**，时长 **5 帧（0.2s）**，turbo **4 步**，种子另定一颗（例如 `20260916`），与 T2V 猫测试种子分开，避免搅在一起
- `SaveVideo` `format="auto"` 字符串；前缀 `video/MiniMax_H3_r2v`

参考图素材（第一枪）：从已有成片抽一帧，避免再引入新题材。

- 源：`output/video/MiniMax_H3_b2_00001_.mp4` 第 1 帧
- 落到：`input/h3_r2v_ref_cat.png`

明确第一枪 **不做**：参考视频、参考音频、9 张参考图、`ref_image_size=max`、Add Guide、Fun ControlNet、升分辨率、20 步、和 WAI/Krea 同 Queue、改 `start_lowvram.bat`、装 `ComfyUI-MiniMaxH3-Cache`、换秋叶包、冻进 walk/skill。

---

## 3. 执行顺序（确认后才做）

1. **下载** 上表两件；核对体积。encoder / VAE 不重下。
2. **确认** `UnetLoaderGGUF` 下拉能看见 `MiniMax-H3-REF2VA-Q3_K_M.gguf`（arch 已在 `ComfyUI-GGUF` 补过 `minimax_h3`；若加载报 unknown arch 再补，不预改）。
3. **抽帧** 得到 `input/h3_r2v_ref_cat.png`。
4. **组图** `MiniMax-H3-R2V-8GB.json`（Markdown 注明：R2V、4-step、不要和 T2V 同 Queue）。
5. **`POST /free`**，确认队列空。
6. **Queue 冒烟**：5 帧 / 1 张参考图 / 0.2 MP / turbo 4。脚本拟为 `docs/h3_smoke_queue.py --rung r2v`（或独立 `h3_r2v_queue.py`），`SaveVideo` 仍用 `format="auto"`。
7. **记** 墙钟、系统内存峰值、nvidia-smi、是否 CUDA OOM / RAM kill、成片路径。写入 `docs/h3-r2v-smoke-results.json` + `维护更新日志.md` + 活页第 5 节。
8. **闸门**（与 T2V 同一套）：
   - Queue 出片、进程没被杀、RAM 峰值仍约 32.x GB → 允许下一档 **22 帧、仍 1 张参考图、仍 0.2 MP**（等你再点名）
   - 工作集明显涨 / 页面文件狂转 / 进程被杀 → **停 R2V**。可讨论维护加 `--disable-pinned-memory`，不自动改 bat
   - CUDA OOM → 停。不要升分辨率、不要 `ref_image_size=max`、不要把 CLIP 搬回 GPU
9. **Hodiki**：仅当 5 帧冒烟通了，才把活页改成「R2V 参考图可交（自己打开或冻 API）」；仍不冻 walk/skill。

T2V 与 R2V **不要同时加载**。换任务头必须 `/free`。两颗 GGUF DiT 都在盘上没关系，运行只留一颗。

---

## 4. 提示词与节点要点

`MiniMaxH3ReferenceToVideo`（已在 `comfy_extras/nodes_minimax_h3.py`，不用装新节点）：

- 参考图最多 9 张，提示词按出现顺序写 `<Picture 1>` … `<Picture 9>`
- 参考视频最多 3 段（≥5 帧），`<Video k>`；可带成对 `ref_video_audio_*`
- 独立参考音频最多 3 段，`<Audio j>`（**本方案第一枪全空**）
- `ref_image_size`：`match` = 按生成像素面积缩小（不下采样放大）；`max` = 短边最高 2048，每步都带着，会慢数倍
- 需要接 **video VAE**（把参考图编进 DiT）和可选 **audio VAE**（第一枪无参考音频，仍接上以免模板缺线）

第一枪提示词草案（确认后可改）：

```
The same tabby cat as <Picture 1> sits on a wooden table and turns its head. Soft indoor daylight. Quiet room tone, a faint meow. No text, logos, or subtitles.
```

---

## 5. 风险（先看再点头）

- R2V 比 T2V 更吃内存：参考 token **每步重注入**。T2V 已顶满 32.2/32.5 GB，R2V 5 帧仍可能直接杀进程。
- 4-step turbo 画质会比 T2V 8-step 更糊；第一枪只证明 Queue，不证明「锁得住脸」。
- 官方 INT8（路 B）在 8GB+32GB 上，社区口径比 GGUF 更接近 RAM OOM。
- 下完约 17 GB 后 D 盘仍应 ≥60 GB 余量（90−17≈73，合格）。
- 不改 bat、不装 H3 Cache、不换秋叶、不冻 walk/skill。

---

## 6. 请确认后再执行

请回复时点名下面几项（未点的按推荐）：

1. 走 **A（GGUF Q3 + 4-step R2V LoRA）** 还是 **B（官方 INT8 19.5GB）**？推荐 **A**。
2. 第一枪是否同意：**1 张参考图、5 帧、608×352、单独新图 `MiniMax-H3-R2V-8GB.json`**？
3. 参考视频 / 参考音频是否 **本轮不做**？（推荐不做）
4. 5 帧若 RAM 杀掉：是 **停 R2V**，还是你再点名维护改 bat？

确认后才：下载 → 组图 → `/free` → Queue 5 帧冒烟。
