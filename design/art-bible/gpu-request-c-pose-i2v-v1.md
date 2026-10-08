# GPU 机补能力 · C 骨架 + I2V（第一例挡住了）

> **2026-09-17 · 追溯工单，禁止当现行下载清单。** C 轨现作者 = Identity Edit（E1）；视频开源线 = MiniMax H3（E6，Wan 14B I2V 已卸）。本文是 09-10 的装盘记录。
>
> 2026-09-10 · 编码机提出。HodikiX 执行。8GB。  
> 成法：`combat-identity-chengfa-v1.md` §6.1  
> 不要改游戏仓库 `assets/frames/`。

**D 已装、第一枪已出。** GPU 回「D 好了」：`wan2.1_i2v_480p_14B_fp8_scaled.safetensors`。SVD 与 1.3B T2V 已在 `_park_models`。编码机已 Queue（prompt `123367fe-6661-4791-8a49-5f5663b8f561`）。17 帧已出。H3 仍先不要下，等过目。

骨架 A/A2 已装、合法两枪已出（没改姿）。I2V 节点在。SVD / 1.3B T2V **已否决** 并已挪走。14B I2V fp8 **已在盘上**。

探测（2026-09-10 午）：握手已更新。类名无空格：`Krea2ControlApply` / `Krea2ControlLoRALoader` / `Krea2ControlImageEncode` 现网非空。`LoraLoader` 下拉有 `krea2_turbo_openpose_controlnet.safetensors`。`KREA2-Turbo-基础.json` 未挂（对）。

第一枪（已过印戳 i2i + facok Apply，prompt `5e78bafc-cd55-4fcf-b6d8-6806103d6f20`）在 `Krea2ControlLoRALoader` 红：`Could not find expanded Krea2 first projection weight with shape (6144, 128)`。thedeoxen 这颗是 **Ostris Edit 用的普通 UNET LoRA**，不是 Patil/facok 那路「扩展 first 投影」。两套不能焊。官方示例工作流是 `EmptyLatent` + 提示词画衣服 = **非法 OpenPose+t2i**，不要按那张 Queue。

---

## A · Krea 骨架（C 要叉腰必须这条）

盘上 OpenPose 是 SDXL / SD1.5，接不上 Krea 2。社区已有 Krea 2 专用姿态 LoRA。

**要装**

| 项 | 放哪 | 来源 |
|---|---|---|
| 节点 `comfyui-krea2-controlnet` | `D:\ComfyUI\custom_nodes\` | https://github.com/facok/comfyui-krea2-controlnet |
| 权重 `krea2_turbo_openpose_controlnet.safetensors` | `D:\ComfyUI\models\loras\` | https://huggingface.co/thedeoxen/Krea-2-pose-controlnet |
| 可选节点 `comfyui-krea2-ostris-edit` | `custom_nodes\` | https://github.com/ostris/comfyui-krea2-ostris-edit |

DWPose 检测已经有，不必再装 `comfyui_controlnet_aux`。

**接法（必须这样，否则非法）**

合法：已过印戳 **i2i** + 骨架图当 control（`Krea2 Control Image Encode` → `Krea2 Control Apply`）+ 低 denoise。人来自底图像素，姿来自骨架。

非法：只喂骨架、用提示词重画衣服。thedeoxen README 默认就是这条，**不要按 README 单独 Queue**。那是成法里的「OpenPose + t2i」。

**A 已装完的部分**：节点 + 这颗 LoRA 文件。冒烟节点非空。**还不能出姿。**

**A2 · 还要装（否则 C 骨架仍 Queue 不成）**

| 项 | 放哪 | 来源 |
|---|---|---|
| 节点 `comfyui-krea2-ostris-edit` | `D:\ComfyUI\custom_nodes\` | https://github.com/ostris/comfyui-krea2-ostris-edit |

**A2 已装（2026-09-10 13:35）。** 冒烟非空。编码机已 Queue 合法两枪：`image1`=骨架，**没有**把印戳放 `image2`（避免第二参考潜空间锁站姿）。C1/C2 已出，见账本 §10。未下 edit LoRA、未挂基础图（对）。

编码机试过的**合法**接法：已过印戳 **VAEEncode i2i** + `TextEncodeKrea2OstrisEdit` `image1`=骨架 + 普通 `LoraLoaderModelOnly` 挂 thedeoxen + 低 denoise。

非法：`EmptyLatent` / denoise 1 / 只喂骨架用提示词重画衣服。thedeoxen 自带 `krea2_controlnet_pose.json` 就是这条。

不要为了叉腰去下 Patil **depth** LoRA 冒充姿态。那是景深，不是骨架。公开 facok 格式的 pose LoRA 目前没有。

---

## B · I2V SVD（已否决 · 权重要腾盘）

节点在。两枪已出：A 后半融化，B f2 起糊。主理人同意严重变形。**SVD 停。** 权重见 §D：挪出 `checkpoints\`，腾给 14B。

**当时装的（现在不要再下）**

| 项 | 放哪 | 说明 |
|---|---|---|
| `svd_xt.safetensors` 或 `svd_xt_1_1.safetensors`（fp16） | `D:\ComfyUI\models\checkpoints\` | Stability `stable-video-diffusion-img2vid-xt`。约 5–10 GB |
| 启动 | 已有 `start_lowvram.bat` | 保持 `--lowvram` |

- I2V API 图已写好：`tools/comfy-lan/workflows/svd-vf1-i2v.json`（只出 8 帧 PNG）  
建议：576×1024（竖图印戳）、**8 帧**、motion_bucket **70**、20 步。抽第 3 帧和第 7 帧入盒。

**诚实限制：** SVD 多半是呼吸 / 镜头，不一定叉腰。枪 A（竖图 motion 70）后半段融化。枪 B（1024×576 motion 35）f2 起糊。主理人同意枪 B：严重变形。SVD 停。

**不要装的（8GB / 本例）**

- MiniMax H3（任务清单 4.7，约 40GB）——14B I2V 失败后再点名
- Hunyuan / 720p 14B / 14B fp16
- AnimateDiff + Anything V5 拿 Krea 印戳去摇（换引擎、换风格套）

---

## C · Wan 1.3B 接底图（已否决 · 权重要腾盘）

官方目录里 **没有** `wan2.1_i2v_1.3B`。1.3B 是 **T2V**；真 I2V 权重是 **14B**。当时用 1.3B 接到 `WanImageToVideo`（`start_image` = 已过印戳）。**不要再装 1.3B。** 扩散权重按 §D 挪走。

**当时装的（现在：扩散挪走，后三件留下）**

| 项 | 放哪 | 文件 |
|---|---|---|
| 扩散 | `D:\ComfyUI\models\diffusion_models\` | `wan2.1_t2v_1.3B_fp16.safetensors` |
| 文本 | `D:\ComfyUI\models\text_encoders\` | `umt5_xxl_fp8_e4m3fn_scaled.safetensors` |
| VAE | `D:\ComfyUI\models\vae\` | `wan_2.1_vae.safetensors` |
| CLIP Vision | `D:\ComfyUI\models\clip_vision\` | `clip_vision_h.safetensors` |

启动仍用 `start_lowvram.bat`。CLIP type 必须是 **`wan`**，device **cpu**。不要和 Krea / SVD / WAI 同 Queue。

**当时不要下（历史。14B 现改走 §D）**

- VACE 14B、T2V 14B
- MiniMax H3
- `wan2.1_t2v_1.3B` 当空 latent 文生视频单独 Queue（没底图 = 换作者，不当 C）

**历史冒烟（装完已否决。现应按 §D：下拉没有 1.3B）**

1. `UNETLoader` / Load Diffusion Model 下拉有 `wan2.1_t2v_1.3B_fp16.safetensors`
2. `CLIPLoader` 有 `umt5_xxl_fp8_e4m3fn_scaled.safetensors`，type=`wan`
3. `VAELoader` 有 `wan_2.1_vae.safetensors`
4. `CLIPVisionLoader` 有 `clip_vision_h.safetensors`（若只有已在盘上的 `CLIP-ViT-H-14-laion2B*`，记下文件名，编码机可改槽）

两枪已出：叉腰有、人换了。主理人确认不第三枪 1.3B。**权重见 §D：挪出 `diffusion_models\`。** umt5 / wan VAE / clip_vision_h **留下**（14B 共用）。

**过关仍按零件表。** 听「hands on hips」但换装/换人/融化 = 废。下一档是 §D 真 I2V 14B fp8。再不行才 H3。

---

## D · Wan I2V 14B fp8（主理人已确认换档 · 现在装）

官方真 I2V。480p。约 **16.4 GB**。8GB 靠 `--lowvram` + 共享内存，可能紧/慢/OOM。

仓：https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/tree/main/split_files/diffusion_models

**先腾盘（建议挪走，不必粉碎。不要删下面「留」的）**

| | 路径 | 约 | 做 |
|---|---|---|---|
| SVD XT | `D:\ComfyUI\models\checkpoints\svd_xt.safetensors` | 8.9 GB | **挪走**。两枪融化，不当日常视频引擎。腾给 14B |
| Wan T2V 1.3B | `D:\ComfyUI\models\diffusion_models\wan2.1_t2v_1.3B_fp16.safetensors` | 2.6 GB | **挪走**。不是 I2V；两枪换人 |
| umt5 | `text_encoders\umt5_xxl_fp8_e4m3fn_scaled.safetensors` | 6.3 GB | **留**。14B 还要用 |
| Wan VAE | `vae\wan_2.1_vae.safetensors` | 0.24 GB | **留** |
| CLIP Vision | `clip_vision\clip_vision_h.safetensors` | 1.2 GB | **留** |
| Krea / WAI / Klein | 原位 | — | **留**。不要动日常静图 |

建议挪到例如 `D:\ComfyUI\_park_models\`（Comfy 下拉就看不见）。14B 需要约 17 GB 空闲；只挪 SVD+1.3B 约腾出 11.5 GB，**还要再看盘**够不够 16.4 GB。

**要装（只这一颗新扩散）**

| 优先 | 文件 | 放哪 |
|---|---|---|
| 首选 | `wan2.1_i2v_480p_14B_fp8_scaled.safetensors` | `D:\ComfyUI\models\diffusion_models\` |
| 没有 scaled 再用 | `wan2.1_i2v_480p_14B_fp8_e4m3fn.safetensors` | 同上 |

**不要下**

- `*_fp16.safetensors` / `*_bf16.safetensors` 14B（约翻倍）
- `wan2.1_i2v_720p_14B_*`
- T2V 14B、VACE 14B
- MiniMax H3

启动仍 `start_lowvram.bat`。CLIP type=`wan`，device=cpu。不要和 Krea / WAI 同 Queue。不要空 latent 文生。本机不要 Queue。

**冒烟**

1. Load Diffusion Model 下拉出现 `wan2.1_i2v_480p_14B_fp8_scaled`（或 e4m3fn）
2. umt5 / wan VAE / clip_vision_h 仍在（没被误删）
3. SVD / 1.3B T2V 已不在下拉（说明挪走成功）

回编码机一句 **「D 好了」**，并写清实际文件名（scaled 还是 e4m3fn）。编码机 `POST /free` 后打 480×832、17 帧。

---

## 编码机已做（不必 GPU 重复）

- 已过印戳 DWPose 抽取（骨架底）：见账本 `20-c-dwpose-from-idle.png`
- SVD / 1.3B 图与 Queue 脚本仍在盘上，**不要再跑**（权重挪走后脚本会停）
- Wan 14B API 图：`tools/comfy-lan/workflows/wan21-vf1-i2v-14b.json`
- Queue：`tools/comfy-lan/queue-vf1-wan14.ps1`（无 `wan2.1_i2v_480p_14B_fp8*` 会停）

装完 D 回「D 好了」。H3 仍等这一枪过目。
