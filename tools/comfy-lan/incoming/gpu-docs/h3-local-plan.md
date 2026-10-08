# MiniMax H3 · 本机试跑方案（HodikiX）

给**试 H3 的人**和主理人。整理日期：2026-09-09；权重落地：2026-09-15；**5 帧冒烟 + B1 22 帧：2026-09-15**。  
机器：RTX 4070 Laptop **8GB**，32GB 内存，ComfyUI **0.34.0**，`D:\ComfyUI`。  
任务清单 **4.7 B3 已通**：0.2 MP 时长阶梯结束。成片在 `output/video/MiniMax_H3_{smoke,b1,b2,b3}_00001_.mp4`。活页 `docs/h3-test-ops.md`。

出处：`docs/model-shortlist.md` C13；`docs/任务清单.md` 4.7；Comfy 0.34 模板 `video_minimax_h3_*.json` / `api_minimax_h3_*.json`；`comfy_extras/nodes_minimax_h3.py`；[Comfy-Org/MiniMax-H3](https://huggingface.co/Comfy-Org/MiniMax-H3)。

H3 是视频模型（约 33.1B + Qwen3-VL-32B），不是静图底。不要为静图下它。

---

## 0. 结论（先读）

- **第一枪**：本地 T2V 最短合法段 + 低分辨率 + **8-step Turbo LoRA 打开** + **32B CLIP 钉 CPU**。不要一上来 15 秒 / R2V / I2V / 音频精修。
- **NVFP4 encoder**：4070（Ada）没有原生 NVFP4 算力，Comfy 当 **emulated** 存储格式。别人的 3060 能加载，但本机 **没核**；Windows 上有过加载崩溃。不要当第一选择。
- **8GB 推荐 encoder**：`qwen3vl-32B-MiniMax-H3-Q2_K.gguf`（约 **8.5 GB**）。官方 NVFP4 约 15.7 GB，和 19.5 GB DiT 叠在 32GB 上更容易系统内存 OOM。
- **更怕系统内存 OOM**，不是显存 OOM。显存 OOM 多半是 CLIP 没钉 CPU 或分辨率太大。
- **云 API**（`api_minimax_h3_*.json`）要去掉 `--disable-api-nodes` 并处理密钥。那是**服务维护**，不是生图 / H3 试跑范围。试本地的人不要改 `start_lowvram.bat`。
- **秋叶 2026.8 整合包 v3.2（Comfy 0.30.2）对本机不是捷径**：比现网 0.34 旧，缺 0.31/0.32 的 H3 修复，换包会拆 Hodiki。详见第 8 节。

---

## 1. 本机还没核、试之前必须先补

这些是空的。第一枪前由试 H3 的人勾掉，不要假设「官方模板打开就能 Queue」。

| # | 项 | 现状（2026-09-09） | 谁补 | 不补的后果 |
|---|---|---|---|---|
| 1 | `city96/ComfyUI-GGUF` | **已装** `6ea2651` + `minimax_h3` arch / CLIP `device=cpu` 补丁 | 已补 | 无法加载 `*.gguf` encoder / DiT |
| 2 | 4070 上官方 NVFP4 encoder 能否加载 | **未测** | 试 H3 的人（仅当走官方路径） | 可能 `UnicodeDecodeError` / Windows `0xC0000005`，或极慢 |
| 3 | H3 权重是否在盘 | **第一枪五件已下**（2026-09-15） | 试图的人 Queue | 模板红节点 |
| 4 | 32GB 上第一枪峰值内存 | **已测**（2026-09-15 5 帧）：系统内存峰值 **32 348 / 32 479 MB**，Python 工作集约 **25 GB**；nvidia-smi **7406 / 8188 MB**。进程没被杀，也不是 CUDA OOM | 试图更长片段时再记 | 调研判断：正好落在社区 RAM OOM 聚集区 |
| 5 | Q2_K encoder + `CLIPLoaderGGUF` `type=minimax` | **已通**（device=`cpu`） | — | 节点类型不对会编不出 conditioning |
| 6 | Queue 前关掉 WAI / Krea / 浏览器大页 | 日常环境还占着 | 试之前 | 32GB 更紧 |
| 7 | D 盘余量 | 约 **90 GB** 空闲（2026-09-15 下完第一枪） | 官方路径不要再叠一套 | GGUF 约 30 GB 已占；仍建议留 ≥60 GB 余量 |
| 8 | 启动参数 | `start_lowvram.bat` 带 `--disable-api-nodes` | **不要为 H3 本地试跑去改** | 见第 7 节 |

不要装 `ComfyUI-MiniMaxH3-Cache`。不换秋叶 v3.2（见第 8 节）。仍用 `D:\ComfyUI` 0.34。  
加载极慢或内存翻倍时，**服务维护**可加 `--disable-pinned-memory`；试图的人先记现象，不要自己改 bat。

下载仍走现有代理：`curl.exe -L --proxy http://127.0.0.1:10808 -C -`。

---

## 2. 4070 上 NVFP4 encoder 能不能用

**硬件**：RTX 4070 Laptop 是 Ada（SM 89）。NVFP4 tensor core 是 Blackwell（50 系）的东西。本机启动日志一类口径是 `emulated ops: nvfp4`，不是 native。

**软件**：官方模板用的就是这颗：

- `qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors`
- 目录：`models/text_encoders`
- 体积：**15.7 GB**（HF；选型清单里写的 14.6 GB 是旧约数，以 HF 为准）
- 源：[Comfy-Org/MiniMax-H3](https://huggingface.co/Comfy-Org/MiniMax-H3/resolve/main/text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors)
- 节点：`CLIPLoader`，`type=minimax`，**`device=cpu`**

社区（Kijai 等）的说法：这里的 NVFP4 主要是**存储格式**，老卡可以反量化后算。有人在 **3060 12GB + 32GB** 上用官方 NVFP4 encoder 跑通过。  
反例：ComfyUI #15397（Windows 加载 NVFP4 CLIP 直接崩）、#15400（空 `comfy_quant` → `UnicodeDecodeError`）。Krea 评估也写过「4070 不走 NVFP4」。

**本机裁定**：

1. **不要把官方 NVFP4 当 8GB 第一枪。** 体积和官方 INT8 DiT 叠在 32GB 上偏紧，而且加载未核。
2. 若主理人坚持官方模板原文件：可以**单独试加载**（只 Queue 到 CLIP 编码、最短帧）。失败立刻改走下表替代，不要修 `ops.py`。
3. 就算加载成功，4070 上也没有 NVFP4 加速，只是省盘，编码会慢。

### 替代 encoder（具体文件名和体积）

官方另外两颗 **不要下**：

| 文件 | 体积 | 为什么否 |
|---|---|---|
| `qwen3vl_32b_minimax_h3_int8_convrot.safetensors` | 27.1 GB | 单独就接近整机内存 |
| `qwen3vl_32b_minimax_h3_bf16.safetensors` | 51.5 GB | 不可能 |

替代（只下一颗）：

| 优先级 | 文件 | 约 | 源 | 加载 | 备注 |
|---|---|---|---|---|---|
| **第一枪** | `qwen3vl-32B-MiniMax-H3-Q2_K.gguf` | **8.49 GB** | [realrebelai/MiniMax-H3_GGUFs](https://huggingface.co/realrebelai/MiniMax-H3_GGUFs/resolve/main/qwen3vl-32B-MiniMax-H3-Q2_K.gguf) | `CLIPLoaderGGUF`，先装 `ComfyUI-GGUF` | 唯一明显减轻 32GB 的 encoder |
| NVFP4 不能用、又不想 GGUF | `qwen3vl_32b_minimax_h3_int4_convrot.safetensors` | **15.0 GB** | [Abiray/MiniMax-H3-GGUF](https://huggingface.co/Abiray/MiniMax-H3-GGUF/resolve/main/text_encoders/qwen3vl_32b_minimax_h3_int4_convrot.safetensors) | 原生 `CLIPLoader` `type=minimax` | INT4 是 native op，往往比 emulated NVFP4 稳、快；体积几乎不省 |
| GGUF 要更高质量 | `qwen3vl_32b_minimax_h3-Q4_K_M.gguf` | **14.6 GB** | [Abiray text_encoders](https://huggingface.co/Abiray/MiniMax-H3-GGUF/resolve/main/text_encoders/qwen3vl_32b_minimax_h3-Q4_K_M.gguf) | `CLIPLoaderGGUF` | 和 NVFP4 同量级内存，救不了 32GB |
| 同上（另一份） | `qwen3vl-32B-MiniMax-H3-Q4_K_M.gguf` | **14.6 GB** | realrebelai 根目录 | 同上 | 不要和下一行搞混 |

**不要下**：Abiray 仓库里也有一个叫 `qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors` 的文件，**27.1 GB**，体积等于官方 INT8，当 NVFP4 下会白占盘。

---

## 3. 32B CLIP：CPU 还是 GPU；8-step Turbo 是不是第一枪

### CLIP → **CPU**

`CLIPLoader` 的 `device` 只有 `default` / `cpu`（advanced）。官方模板是 `default`。

8GB 上 **必须改成 `cpu`**：

- 官方 NVFP4 15.7 GB > 8 GB
- Q2_K 8.49 GB 仍然 ≥ 显存
- `default` 会先往 GPU 塞 → **显存 OOM**（或把 DiT 挤到更狂的 offload，然后系统内存爆）

GGUF 路径同样：encoder 放 CPU。不要和 DiT 抢 8GB。

### 8-step Turbo → **是，8GB 第一枪就开**

官方 T2V 模板里 `turbo_mode` **默认 false**，底步数 **20**。8GB 上 20 步是在延长「占满内存」的时间，不是在提高冒烟成功率。

| 档 | 文件 | 约 | 步数 | 何时 |
|---|---|---|---|---|
| **第一枪** | `minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors` | 1.82 GB | 8 | T2V / I2V（fl2va） |
| 太慢再考虑 | `minimax_h3_fl2v_turbo_4step_v1.0_768p_comfyui_bf16.safetensors` | 1.82 GB | 4 | 8 步能出、但墙钟不可接受 |
| R2V 专用（第一枪不要） | `minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors` | 1.82 GB | 4 | 另要 `ref2va` 权重 |

8-step 官方模板指向 [lightx2v/Minimax-h3-Turbo](https://huggingface.co/lightx2v/Minimax-h3-Turbo/resolve/main/minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors)；[Comfy-Org/MiniMax-H3/loras](https://huggingface.co/Comfy-Org/MiniMax-H3/tree/main/loras) 里是同一份。放 `models/loras/`。

模板里：`turbo_mode=true`，`turbo_steps=8`，`turbo_model_strength=1`。Sampler 保持 `res_multistep` / `simple`。  
4-step 不是第一枪：更省时间，但更伤画质，会把「能不能跑」和「是不是太糊」搅在一起。

---

## 4. 最短冒烟规格

用 **T2V** 官方图：`video_minimax_h3_t2v.json`（模板库 Video）。不要用 `i2v` / `i2v_continuation` / `r2v` / `multiframe_reference` / 任何 `api_minimax_h3_*`。

节点约束（`nodes_minimax_h3.py`）：

- 帧数 `length`：**最小 5**，对齐 `17k+5`（5, 22, 39, 56, 73, …, 124≈5s, …）
- 公式（模板 Math Expression）：`max(5, round(秒 * 24))` 再向上对齐
- **训练区间约 124–362 帧（约 5–15 秒）**。5 帧合法，只证明 Queue，不证明成片

| 项 | 第一枪 | 明确不要 |
|---|---|---|
| 模板 | `video_minimax_h3_t2v.json` | R2V / 多帧参考 / 续写 / 云 API |
| 时长 | **0.2 秒 → length=5** | 15 秒（约 362 帧）、模板默认 5 秒（124 帧） |
| 分辨率 | Resolution Selector **0.2 MP**、16:9、multiple=32 → **608×352** | 0.98 / 1344×768（官方 768p）；15s 2K |
| 步数 | Turbo **开**，8 步 | 20 步满血 |
| CLIP | `device=cpu`，`type=minimax` | `default` |
| 提示词 | 一两句动作 + 一句环境音即可 | 模板里那大段分镜、embedding、风格精修 |
| 音频 | 保留官方 audio VAE **解码**（模型是联合 AV，不是后配音） | 二次采样 / Quality Refine / 单独音频精修图 |
| 其它 | 关 embeddings；不挂 Sage Attention（冒烟后再说） | 同时开 WAI/Krea Queue |

第二枪（仅当 5 帧成功）：22 帧（约 0.9 秒），分辨率仍 0.2 MP。再往后才考虑 124 帧 / 0.4 MP。  
R2V 已另下 `MiniMax-H3-REF2VA-Q3_K_M.gguf` + 4-step LoRA。S101 舞蹈 124 帧 v2A/v2B 已通。不要 Queue 官方 INT8 模板。

判据（写入 `维护更新日志.md`，不要套静图 1–2 / 5 分钟包络）：

- Queue 是否成功
- 墙钟
- 是 **CUDA OOM** 还是 **系统内存 / 页面文件打满 / 进程被杀**
- 输出是否在 `output/video/MiniMax_H3*`

---

## 5. 失败模式：显存 OOM vs 系统内存 OOM

调研更担心 **后者**。12GB 卡上就有 REF2VA 峰值显存约 11.6GB、**系统内存 >43GB** 的记录。满血对照有人报到约 28GB 显存 + 54GB 内存。本机 8GB+32GB 正好是社区 RAM OOM 聚集区。

| | 显存 OOM | 系统内存 OOM |
|---|---|---|
| 日志 | `CUDA out of memory` / Comfy 红节点写 VRAM | 进程直接没、Windows 卡死、`MemoryError`、页面文件狂涨 |
| 任务管理器 | GPU 8/8 GB | 「已提交」顶到 32GB+，磁盘 100% |
| 常见原因 | CLIP `device=default`；0.98 MP / 长帧；R2V 参考 token；和 Krea 同驻 | 15.7+19.5+4.9 同时映射；pinned memory 翻倍；encoder 在 CPU 但仍占 RAM |
| 第一枪对策 | CLIP 钉 CPU；0.2 MP；5 帧；`--lowvram` 已在 bat 里 | Q2_K encoder；关其它占内存程序；必要时让维护加 `--disable-pinned-memory` |
| 不要做的 | 把 CLIP 迁回 GPU「加速」 | 改去下 27 GB INT8 encoder |

粗算（不是本机测量）：

- 官方 NVFP4 15.7 + INT8 DiT 工作集 + VAE 4.9 + Windows/Comfy ≈ **容易超过 32GB**
- Q2_K 8.5 + Q3 DiT 流式 offload + VAE + 系统 ≈ **卡在 32GB 边缘，才有机会**

---

## 6. 第一枪下载清单（2026-09-15 已下）

只下 T2V 一套。不要顺带 ref2va。

**推荐（GGUF，约 30 GB）**

| 文件 | 约 | 目录 |
|---|---|---|
| `MiniMax-H3-FL2VA-Q3_K_M.gguf` | 14.5 GB | `diffusion_models`（Abiray `unet/` 或 realrebelai 根目录，同名即可） |
| `qwen3vl-32B-MiniMax-H3-Q2_K.gguf` | 8.49 GB | `text_encoders` |
| `minimax_h3_video_vae_fp16.safetensors` | 4.85 GB | `vae` |
| `minimax_h3_audio_vae_fp32.safetensors` | 0.56 GB | `vae` |
| `minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors` | 1.82 GB | `loras` |

前置：`ComfyUI-GGUF` **已装**。参考图 `user/default/workflows/MiniMax-H3-T2V-8GB.json`。5 帧冒烟记录：`docs/h3-smoke-results.json`，成片 `output/video/MiniMax_H3_smoke_00001_.mp4`（冷跑 245s）。试图的人打开参考图前 `POST /free`。

**备选（官方原件，约 42 GB，内存更险）**

| 文件 | 约 | 目录 |
|---|---|---|
| `minimax_h3_fl2va_pruned_int8_convrot.safetensors` | 19.5 GB | `diffusion_models` |
| `qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors` | 15.7 GB | `text_encoders` |
| 两颗 VAE + 8-step LoRA | 同上 | 同上 |

加载失败 → 删 NVFP4，改下 Q2_K 或 INT4，不要同时留两颗 32B encoder。

---

## 7. 云 API 捷径（服务维护，不是生图节点）

0.34 自带 `api_minimax_h3_t2v.json` 等，节点例如 `MinimaxHailuo03TextToVideoNode`。这是托管 Hailuo，不占 40GB 权重。

本机现在：

```
D:\ComfyUI\start_lowvram.bat
python main.py --lowvram --reserve-vram 0.8 --vram-headroom 0.4 --disable-api-nodes --enable-manager --listen 0.0.0.0 --port 8188
```

要走云 API 必须：去掉 `--disable-api-nodes`、重启、在 Comfy 用户设置里配 MiniMax 密钥。  
防火墙、监听、密钥存放、bat 变更 = **服务维护**。H3 本地试跑 / 生图节点 **不改 bat、不配密钥、不把 API 图当本地验收**。

本地失败时若只要效果：和维护说一声走云，和 `GenerateImage` 同类（补位）。商业授权按 MiniMax / Comfy 条款，不在试跑范围。

---

## 8. 秋叶 2026.8 整合包 v3.2：会不会更方便（2026-09-15 核查）

出处：秋葉aaaki 动态（2026-08-06）：整合包 **v3.2**，ComfyUI **v0.30.2**，Python **3.13.11**，torch **2.13.0+cu130**；文案写「支持 MiniMax H3」，权重在夸克网盘。解压密码 `bilibili-秋葉aaaki`。

**结论：对「从零装一台玩 H3 的电脑」方便；对本机 `D:\ComfyUI` 不方便，也不该换。** 换包是版本倒退，还会拆掉 Hodiki 现网。

### 和本机对照

| | 本机 `D:\ComfyUI` | 秋叶 v3.2（2026-08-06） |
|---|---|---|
| ComfyUI | **0.34.0**（已有 H3 原生节点 + `video_minimax_h3_*.json`） | **0.30.2**（H3 刚进核心的那一周） |
| Python | 3.12.10 | 3.13.11（整套 venv / 自定义节点要重装） |
| torch | **2.14.0+cu130** | 2.13.0+cu130（比本机旧） |
| H3 修复 | 含 0.31 音频双时钟、0.32 峰值内存 `#15486` 等后续 PR | **没有** 0.31 / 0.32 那九个 H3 修复 |
| 8GB 含义 | `--lowvram` 现网；Krea / WAI / IPA 已冒烟 | 网盘多半是官方 INT8+NVFP4 约 40GB，正是本机判定不该当第一枪的栈 |
| 现网 | 8188、Hodiki only 防火墙、`start_lowvram.bat`、env-docs | 换包 = 另起一套 Python，端口和节点都要重接 |

官方下限是 0.30.0「有节点」。社区口径（含 `#15486`）：**实际该跑 0.32.0 或更新**。v3.2 卡在 0.30.2，日期是 8 月 6 日；0.31.0 是 8 月 8 日，0.32.0 是 8 月 11 日。8GB + 32GB 最怕的就是峰值内存和音频时钟，秋叶这包正好缺这两块。

### 网盘权重大概是什么

秋叶说「H3 模型已经传到网盘」。没登录夸克无法列文件名，但公开整合包惯例是 **Comfy-Org 官方四件套**（pruned INT8 DiT + NVFP4 32B encoder + 两颗 VAE，约 42 GB），不是本机第一枪要的 Q2_K GGUF。即便只把网盘当镜像，仍要按 `h3-local-plan` 挑文件，不能整包丢进 `models\`。

### 可以怎么用秋叶、不可以怎么用

- **不要**解压覆盖 `D:\ComfyUI`。
- **不要**再开一套秋叶占用 8188（Hodiki 会断）。
- **可以**（可选）：夸克只当下载体，对照第 6 节文件名挑 GGUF / INT4 encoder；下完仍放现网目录。
- 8 月 23 日另有「适配 30/40/50」类教程视频，**不是**这份 v3.2 的版本声明；要另核其 Comfy 号，不能用 v3.2 的 0.30.2 去代表它们。

---

## 9. 明确不做

- 不为静图下 H3（选型 C13 当静图综合 3.0）
- **不换秋叶 v3.2 覆盖现网**、不装 H3 Cache 节点
- 不和 WAI / Krea 同一 Queue
- 不把 Sage Attention、2K regenerate、Fun ControlNet 放进第一枪
- 第一枪五件已下；R2V Q3 + 4-step 已下（2026-09-15），等参考图冒烟。不要再叠官方 INT8+NVFP4。

---

## 10. 测试工作流 / 素材 / 时长分辨率（活页）

可见性与能否同时开服务、当前图能接的素材和参数、时长×分辨率墙钟表、猫题材与 B1–B3 提示词：

**`docs/h3-test-ops.md`**

改规格先改那一页，再 Queue。画布只是展示。闸门：锁 0.2 MP / turbo 8 / CLIP CPU；5 帧已通；下一枪 B1 = 22 帧。
