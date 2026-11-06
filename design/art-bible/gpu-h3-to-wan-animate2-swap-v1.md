# GPU 机 · H3 卸不卸、Wan Animate 2 装不装

> 2026-10-21 · 回应主理人第 ② 问
> 状态：**评估。未动 GPU 机任何文件。**
> 现场数据来自 `GET /system_stats` 与 `GET /models/*`（HodikiX · 192.168.101.200:8188 · 2026-10-21）

---

## 0. 结论

**建议改回 Wan Animate 2，但"卸 H3"不是必须的。**

- 换的理由不是"Wan 更好"，是**当前里程碑要的是走循环，不是剧情视频**。Wan Animate 2 是唯一在本机 8GB 上**出过货**的方案（薇奥莱 `walk-a..f` 现网 128，2026-09-12 过）；H3 的能力（竖首帧 → 5s 小动作）服务剧情 / 宣传，v0.8 的战斗层用不上。
- **没有"更高版本的 Wan Animate"可装。** Wan-Animate-2（2026-08-07，Apache 2.0，14B）是最后一个开源的 Wan 动画模型；Wan 2.5 / 2.6 / 2.7 / 3.0 全部只有 API。要更高只能走线上。
- **顺带更正：H3 不比 Wan-Animate-2 新。** H3 公布 2026-07-31、权重 2026-08-02；Wan-Animate-2 是 08-07。两者也不是同类模型，见 `video-model-role-split-v1.md`。
- **磁盘上这是一次打平，不是腾空间**：卸 H3 大约腾 23–26GB，装 Wan 要 26–27GB，净 +1–4GB。磁盘够的话**两者可以共存**——它们不会同时占显存，只在切换时 `/free` 一次。

## 1. 现场

| 项 | 值 |
|---|---|
| GPU | RTX 4070 Laptop · **8 GB**（空闲 7.4GB） |
| 内存 | 34 GB（空闲 20GB） |
| ComfyUI | 0.37.0 · PyTorch 2.14.0+cu130 |
| 启动参数 | `--lowvram --reserve-vram 0.8 --vram-headroom 0.4 --disable-api-nodes --enable-manager` |
| 队列 | 空 |

**节点在不在**：`WanAnimate2ToVideo` 与 `WanAnimate2Cache` 都在 0.37.0 的 789 个节点里。所以这不是"要装插件"，只是**缺权重**。

## 2. 两个包的文件账

### 现在盘上（H3）

| 文件 | 估计 |
|---|---|
| `clip_gguf/qwen3vl-32B-MiniMax-H3-Q2_K.gguf` | **~10 GB**（32B @ Q2_K，最大的一块） |
| `unet_gguf/MiniMax-H3-FL2VA-Q3_K_M.gguf` | ~6–7 GB |
| `unet_gguf/MiniMax-H3-REF2VA-Q3_K_M.gguf` | ~6–7 GB |
| `loras/minimax_h3_fl2v_turbo_8step` + `ref2v_turbo_4step` | ~0.5 GB |
| `vae/minimax_h3_video_vae_fp16` + `audio_vae_fp32` | ~0.7 GB |
| **合计** | **≈ 23–26 GB** |

### Wan Animate 2 要下的

| 文件 | 大小 |
|---|---|
| `diffusion_models/wan_animate_2_distill_int8_convrot.safetensors` | **16.7 GB**（README 实测值） |
| `text_encoders/umt5_xxl_fp8_e4m3fn_scaled` | ~6.4 GB |
| `clip_vision/clip_vision_h` | ~2.5 GB |
| `vae/wan_2.1_vae` | ~0.25 GB |
| `loras/lightx2v_I2V_14B_480p_cfg_step_distill_rank64_bf16` | ~0.6–1.2 GB |
| **合计** | **≈ 26–27 GB** |

> 除 16.7GB 是 README 实测，其余是公开权重常见体积，**没有远程读数**（ComfyUI 只给文件名，`/userdata` 不越出用户目录）。要精确值在 GPU 机跑：
> `Get-ChildItem <ComfyUI>\models -Recurse -File | Group-Object DirectoryName | %{ "{0,7:N1} GB  {1}" -f (($_.Group | Measure-Object Length -Sum).Sum/1GB), $_.Name }`

## 3. 三项代价

### 3.1 H3 停掉以后，剧情线只剩线上 API

H3 当前唯一在用的是 `video-h3-firstframe-chain`：过脸门的竖首帧 → 本机 0.4MP / 约 5s 小动作，用于剧情、宣传、段间续（状态：部分过）。卸掉后这条线走官方 `MiniMax-H3` API：768P **$0.08/s**、2K $0.13/s，账号与条款由主理人开。

**日常战斗帧不受影响**——战斗帧从来不走 H3。

### 3.2 磁盘是打平，不是省

23–26GB 换 26–27GB。如果动机里含"腾空间"，这一换不解决。

### 3.3 8GB 的上限没变

只能 **384×672（5–9 分钟 / 49 帧）或 480×832（7–13 分钟）**，跑不了 720P。对 128 目标帧这是 **3–5 倍超采样**，够用。社区卖的"8GB GGUF 版"效果差，不要下；我们用的是 int8 distill。

## 4. 建议的做法

按代价从小到大：

1. **先量磁盘。** 余量 ≥ 52GB → **两边都留**，按任务切模型（切前 `POST /free`）。最省事，不用重下 H3。
2. 余量 30–52GB → **先装 Wan，暂不删 H3**。确认 Wan 能出帧且不比现网薇奥莱差，再决定删。
3. 余量 < 30GB → 删 H3 的 **32B 编码器 + 两个 unet GGUF**（这三项占 22–24GB，是 H3 包的绝大部分），保留两个 LoRA 与 VAE 以备将来；再装 Wan。

## 5. 装完先冒烟，不要直接跑 49 帧

管线参数是在 **Comfy 0.34.0** 上验的（`S3c-b` 过：384×672 · 49 帧 · `lcm` / `simple` · 6 步 · CFG 2 · shift 5 · seed 2026091212），现在引擎是 **0.37.0**。节点名还在，但采样器与 Cache 节点的参数名跨两个小版本可能改过。冒烟用 17 帧（4n+1），确认三件事再放量：

1. 不 OOM，`WanAnimate2Cache(device=cpu, dtype=int8)` 能开；
2. 驱动视频取帧步长 2 的接法没断（`LoadVideo → GetVideoComponents → ImageFromBatch`）；
3. 出图里只有一个人（README 记过一次：关掉 Cache 那枪多出两个人、扑克牌、披风马赛克）。

## 5.1 装机结果（2026-10-21 核）

主理人已按"方案 3"执行完毕，现场核对：

| 目录 | 现状 |
|---|---|
| `diffusion_models` | `wan_animate_2_distill_int8_convrot.safetensors` ✓ |
| `text_encoders` | `umt5_xxl_fp8_e4m3fn_scaled.safetensors` ✓ |
| `vae` | `Wan2_1_VAE_bf16.safetensors` ✓（官方版，比上轮用的等效件更好） |
| `clip_vision` | `clip_vision_h.safetensors` ✓ |
| `loras` | `lightx2v_I2V_14B_480p_cfg_step_distill_rank64_bf16` ✓ |
| `unet_gguf` / `clip_gguf` | **空**（H3 已清） |
| H3 LoRA / VAE | 已清 |
| 显存 | 8.6GB 总量 / 7.3GB 空闲 |

⇒ 权重就位，节点在，只差冒烟。**下一步是 17 帧冒烟，不是直接跑 49 帧。**

## 6. 与方案 C 的关系

昨天到今天这一串试下来：**C 出形行，C 出细节不行**（`combat-scheme-c-p0-detail-pilot-v1.md`）。所以走循环这条路，短期内还是得靠 Wan Animate 2。这一换装填的正是 P0 否掉之后留下的缺口。

另外提醒：Wan 路线的输入是"已过印戳"。卡珊德拉现在的参照是 64 时代的旧印戳；如果按 128 重做，**印戳也要重出一张 128 的**再进 Wan，否则动作迁移的参考分辨率比目标还低，白丢一次超采样。

## 7. 风险与回滚

| 风险 | 应对 |
|---|---|
| 0.37.0 上 Wan 节点参数变了，旧 API 图要改 | 冒烟阶段先跑 `workflow.api.json`，报错就按节点新签名改；改动记进 `c-walk-wan-animate2/README.md` |
| 下载 16.7GB 慢 / 中断 | 先下 unet，其余在冒烟期间并行下 |
| 出片不如薇奥莱那套 | 参数在 README §4，先复跑同 seed 看是否复现；不复现再谈换版 |
| 想回 H3 | 权重公开可再下，`queue-e6-h3.mjs` 与工作流 JSON 都在库；H3 的名字与 LoRA 文件名 README 有记 |
