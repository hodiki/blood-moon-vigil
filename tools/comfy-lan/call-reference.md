# 局域网 Comfy · 调用参考

> 版本：v1.5 · 日期：2026-09-23 · 状态：**连接环境已过 · 文档走 /userdata · 引擎期望已改**  
> 给谁：编码机 Agent、负责立绘 / 风格帧的 Agent  
> 配对：`check-and-recover.md`（坏了怎么查、怎么修）· GPU 文档：`pull-gpu-docs.ps1`  
> 权威范围：怎么排队、图落到哪、槽位怎么填。不替代 `design/art-bible/combat-64-workflow-v1.md`。

---

## 0. 现在到哪一步

| 层 | 状态 | 说明 |
|---|---|---|
| 局域网连接 | **已过** | Hodiki → HodikiX `:8188`，`/system_stats` 200 |
| 薄客户端 | **已过** | `run-job.ps1 ping` / `queue` |
| 通路冒烟 | **已过** | 女性猎魔人 SDXL 一张，约 19s |
| GPU 文档同步 | **已过（方案 A）** | `D:\ComfyUI\docs` 联接 `user\default\env-docs`。本机用 `/userdata`，不要 `/docs`（403） |
| 立绘 / 风格帧候选人 | **H23 已过** | 立绘线改 Krea Identity Edit（E4）。WAI 配方留档，不当卡珊德拉 / 魔化终审。开工卡 `style-frame-reopen-v1.md` 已追溯 |
| walk / skill 冻结工作流 | **不冻** | 握手里 `walk_strip_api` / `skill_strip_api` 仍为 false。本机不抢填。已过 C/E 64 不改 |
| Cursor `GenerateImage` | **身份底 / 补强 / 少枪融景** | 不当走条、不当角色抽卡、不当战斗锁稿。场景工序：少枪优先闭源融景。E5 tombstone / pew **过**。条款待核 |
| 社区 Comfy MCP | **不开** | 通用 `generate_image` 没有身份锁，不当产线 |
| C 轨图片编辑 | **期望已改** | 2026-09-23：新编辑 = Qwen-Image-2.1。Krea Identity Edit（E1）留档，新枪不默认走。参考图在 GPU `/userdata?dir=workflows` 的 `QWEN21-图片编辑.json`。编码机还没有晋升 API |
| E2 走循环 | **已过（现网帧仍在）** | 当时 Wan Animate 2。权重不在盘，不能再 Queue 走条。没有权重就停并反馈，不准用 H3 冒充走条 |

引擎分工（主理人 **2026-09-23**）：**图片编辑与非二次元 = Qwen-Image-2.1**；**二次元 = Krea 2**（`KREA2-Turbo-基础.json`）；**WAI = 备用或风格化**，点名才 Queue。**视频 = 本机 MiniMax H3，分辨率受限**（日常 I2V 0.4MP、约 5 秒）。效果不好，或需求更复杂 / 更高 / 更长 / 要参考视频 / 要宣传级：停，反馈主理人，由主理人调线上满血 H3。助理不代调官方 API。**走循环**仍是 Wan Animate 2，权重不在盘。Klein 停用，不要 Queue。Qwen / Krea / WAI / H3 **分 Queue**，换引擎先 `POST /free`。不要叠 IPA + OpenPose。斜杠写成 `%2F`。Qwen 的 VAE 是 `qwen_image_2.1_vae_bf16`，与 Krea 的 `qwen_image_vae` 不通用。编码器默认 `qwen3vl_8b_w4a8`。

---

## 1. 拓扑

```
Hodiki          192.168.101.82    编码机 / 本仓库 / 客户端
       WLAN 7C-21-4A-DD-A9-EB
HodikiX         192.168.101.200   GPU 机  RTX 4070 Laptop (8 GB)
       Comfy 0.34.0  听 0.0.0.0:8188
       安装 D:\ComfyUI
       启动含 --listen --lowvram --reserve-vram 0.8 --vram-headroom 0.4 --disable-api-nodes
防火墙            规则名 ComfyUI LAN Hodiki only
                 只允许 192.168.101.82 → TCP 8188
```

- 编码机打开 / 脚本打：`http://192.168.101.200:8188`
- GPU 本机出图仍用：`http://127.0.0.1:8188`
- HodikiX 另有 `以太网 3 = 10.50.24.114/24`，**不用**这条握手。
- GPU ping Hodiki ICMP 超时是正常的（两边 WLAN 都是 Public）。TCP 8188 通才算通。

握手：`GET http://192.168.101.200:8188/userdata/comfy-lan-handshake.json`（schema `comfy-lan-handshake/v1`）。本机缓存 `incoming/handshake.json`（UTF-8 清理版）；原文可能中文键乱码，文件名以 `/userdata?dir=` 为准。不要再靠拷 U 盘。

```text
健康：      GET /system_stats
列文档：    GET /userdata?dir=env-docs&full_info=true
环境说明：  GET /userdata/env-docs%2F环境说明.md
通信记录：  GET /userdata/env-docs%2F局域网通信维护记录.md
握手：      GET /userdata/comfy-lan-handshake.json
参考工作流：GET /userdata?dir=workflows
```

本机一键：`.\pull-gpu-docs.ps1`

---

## 2. 本机命令（编码机）

工作目录必须是 `tools/comfy-lan`。PowerShell 5.1 即可。`node` 不在 PATH 里，`run-job.ps1` 会找 Workbuddy `v22.22.2`。

```powershell
cd d:\code\vampire-survivors-like\tools\comfy-lan

# 本机网络 / 工具链（不需要 GPU）
.\check-env.ps1

# 对端还活着
.\ping-comfy.ps1
.\run-job.ps1 ping

# 通路冒烟（已验证）
.\run-job.ps1 queue `
  -Workflow .\workflows\smoke-female-witcher.json `
  -Slots .\workflows\smoke-female-witcher.slots.json `
  -TimeoutSec 360

# 风格帧候选人（WAI，未过）
.\run-job.ps1 queue `
  -Workflow .\workflows\style-frame-wai-cassandra.json `
  -Slots .\workflows\style-frame-wai.slots.json `
  -TimeoutSec 360

# 拉最新 GPU 文档（不要请求 /docs）
.\pull-gpu-docs.ps1
```

冻结 walk / skill 条**本轮不做**。下面两条等主理人点名再导出：

```powershell
# 冻结条就位后（现在还没有这两个 JSON）
.\run-job.ps1 queue `
  -Workflow .\workflows\walk-strip.json `
  -Slots .\workflows\walk-strip.slots.json `
  -Idle ..\..\assets\frames\player.png `
  -WalkA ..\..\assets\frames\player-walk-a.png `
  -TimeoutSec 360
```

覆盖 URL（一般不用）：`-Url http://192.168.101.200:8188`

---

## 3. 客户端实际打哪些接口

`run-job.mjs` 只做这件事，不要另写一套除非要加槽。

| 步骤 | 方法 | 路径 | 作用 |
|---|---|---|---|
| 探活 | GET | `/system_stats` | 通不通、显存 |
| 节点 | GET | `/object_info/<Class>` | IP-Adapter / OpenPose 是否还在 |
| 上图 | POST | `/upload/image` | multipart；`overwrite=true` |
| 排队 | POST | `/prompt` | `{ prompt, client_id }` |
| 等完 | GET | `/history/<prompt_id>` | 每 2s 轮询，默认 300s |
| 拉图 | GET | `/view?filename=&subfolder=&type=` | 写入停放目录 |

工作流 JSON 可以是节点表，也可以是 Comfy 导出的 `{ "prompt": { ... } }`。客户端两种都吃。

---

## 4. 工作流与槽位

### 4.1 放下哪里

| 文件 | 用途 |
|---|---|
| `workflows/smoke-female-witcher.json` | 通路冒烟（已过） |
| `workflows/smoke-female-witcher.slots.json` | 冒烟槽：`seed` / `positive` / `negative` / `ckpt` |
| `workflows/style-frame-wai-cassandra.json` | 风格帧候选人 · WAI · 卡珊德拉身份（3 可作身份底） |
| `workflows/style-frame-wai.slots.json` | 上图槽 |
| `workflows/style-frame-klein-edit.json` | **留档。** 风格帧 Klein 改图。Klein 已停用，不要日常 Queue |
| `workflows/style-frame-klein-edit.slots.json` | 同上，仅回溯 |
| `workflows/walk-strip.json` | **不冻**（本轮） |
| `workflows/skill-strip.json` | **不冻**（本轮） |
| `workflows/krea2-vf1-identity-edit.api.json` | **E1 留档。** 新图片编辑不默认走。打之前 `POST /free` |
| `workflows/krea2-vf1-identity-edit.slots.json` | `image_ref` / `positive` / `seed` / `ref_boost` / `grounding_px` / `lora_strength` |
| `workflows/krea2-identity-edit-restage.api.json` | **E4 留档。** Identity Edit 768×1344。新 re-stage 走 Qwen |
| `workflows/wai-style-pass-lowdn.api.json` | **留档。** WAI 低降噪风格化候选。点名才 Queue |
| `workflows/wan-animate2-vo-walk.api.json` | **C 轨走循环留档。** 本机 Wan 已卸，不要 Queue |
| `workflows/wan-animate2-vo-walk.slots.json` | `image_ref` / `video_drive` / `positive` / `seed` / `length` / `width` / `height` |
| `workflows/slots.example.json` | 槽位格式样张 |

GPU 参考图（网页用，不是本机 API 契约）在 `/userdata?dir=workflows`：

| 用途 | 文件 | 日常？ |
|---|---|---|
| 图片编辑 | `QWEN21-图片编辑.json` | **日常**（2026-09-23） |
| 非二次元静图 | `QWEN21-T2I-基础.json`（40 步；编码器 `qwen3vl_8b_w4a8`） | **日常** |
| 透明 / 去底 | `QWEN21-T2I-透明RGBA.json` · `QWEN21-去背景.json` | 要 alpha 时用。Krea 无 alpha |
| 提示词改写 | `QWEN21-PE改写.json` | 提示词太短才点名。190s 级，不每枪 |
| 二次元 | `KREA2-Turbo-基础.json`（Euler + simple，8 步，CFG 1；CLIP type=`krea2`） | **日常** |
| 二次元对照 | `KREA2-Turbo-t2i.json` | 裸跑对照 |
| 零件仓 | `KREA2-Turbo-仓库.json` | **禁止 Queue**（无 SaveImage） |
| WAI | `WAI-*.json` | **备用 / 风格化**，点名才 Queue |
| H3 | `MiniMax-H3-T2V-8GB.json` · `MiniMax-H3-R2V-8GB.json` | 本机视频，分辨率受限。复杂需求反馈主理人 |
| Klein / Wan | `_backup/deprecated-workflows/2026-09-22/` | **不要 Queue** |

导出：GPU 网页里出一张过目条 → **Save (API Format)** → 拷到上表。不要让 Agent 现场拼节点图当产线。

### 4.2 槽位合同

值为节点路径，写入 `prompt[nodeId][inputs][field]`：

```json
{
  "seed": ["SAMPLER_NODE_ID", "inputs", "seed"],
  "denoise": ["SAMPLER_NODE_ID", "inputs", "denoise"],
  "ckpt": ["CKPT_NODE_ID", "inputs", "ckpt_name"],
  "positive": ["POS_NODE_ID", "inputs", "text"],
  "negative": ["NEG_NODE_ID", "inputs", "text"],
  "image_idle": ["LOAD_IDLE_NODE_ID", "inputs", "image"],
  "image_walk_a": ["LOAD_WALKA_NODE_ID", "inputs", "image"]
}
```

`run-job.ps1 queue` 目前会自动用的槽：

- `-Idle` → 先 `/upload/image`，再写入 `image_idle`
- `-WalkA` → 同上，写入 `image_walk_a`

其它槽（种子、降噪、提示词）要改就直接改 JSON，或以后再加旗标。没有的槽会被忽略，不会报错。

### 4.3 已点名节点（2026-09-08 探活为 true）

`IPAdapterApply` · `IPAdapterAdvanced` · `IPAdapterModelLoader` · `IPAdapterUnifiedLoader` · `ControlNetApplyAdvanced` · `ControlNetLoader` · `OpenposePreprocessor` · `DWPreprocessor` · `Krea2EditModelPatch` · `Krea2EditGroundedEncode`

### 4.4 已点名模型（文件名以 API 为准，不要带体积后缀）

| 类 | 文件 |
|---|---|
| checkpoint | `waiIllustriousSDXL_v170.safetensors`（**备用 / 风格化**。H23 配方留档。点名才 Queue） |
| checkpoint | `Anything-v5.0-PRT.safetensors`（SD1.5 量级，不要和 SDXL 节点混） |
| IP-Adapter | `ip-adapter-plus_sdxl_vit-h.safetensors` |
| CLIP Vision | `CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors` |
| ControlNet | `openpose-sdxl-xinsir.safetensors` |
| ControlNet | `control_v11p_sd15_openpose_fp16.safetensors`（SD1.5，不要塞进 SDXL 条） |
| 去底 | 要透明的新图优先 Qwen RGBA / `QWEN21-去背景.json`。`InspyrenetRembg` + `ckpt_base.pth` 留作旁路 |
| 放大 | `4x-UltraSharp.pth`（CC BY-NC-SA，不得进商用产线） |
| 图片编辑 / 非二次元 | `qwen_image_2.1_int8_convrot.safetensors` + `qwen3vl_8b_w4a8.safetensors`（type=`qwen_image`，默认档）+ `qwen_image_2.1_vae_bf16.safetensors`。参考图 `QWEN21-图片编辑.json` / `QWEN21-T2I-基础.json` / `QWEN21-T2I-透明RGBA.json`。int8 编码器 `qwen3vl_8b_int8_convrot` 只作对照。与 Krea / WAI / H3 **分 Queue** |
| 二次元 | `krea2_turbo_int8_convrot.safetensors` + `qwen3vl_4b_fp8_scaled.safetensors`（type=`krea2`）+ `qwen_image_vae.safetensors`。日常 `KREA2-Turbo-基础.json`。Krea 无 alpha |
| C 轨 Identity Edit | **留档，新枪不默认。** LoRA `krea2_identity_edit_v1_2_r128.safetensors` 仍在盘。E1 大部分过 |
| C 轨走循环 | **留档、勿 Queue。** 本机 Wan 权重不在盘（2026-09-17 起）。历史条 `wan-animate2-vo-walk.api.json`。现网守誓 walk 128 不改。没有权重就停并反馈 |
| 视频（E6） | 本机 `unet_gguf/MiniMax-H3-FL2VA-Q3_K_M.gguf` + CLIP `clip_gguf/qwen3vl-32B-MiniMax-H3-Q2_K.gguf` type=`minimax` **CPU** + `minimax_h3_video_vae_fp16` / `minimax_h3_audio_vae_fp32` + turbo 8-step LoRA。日常只跑已通的 I2V 0.4MP、约 5 秒。效果不好或需求复杂：停，反馈主理人调线上满血 H3。不要代调官方 API。R2V 权重 `MiniMax-H3-REF2VA-Q3_K_M.gguf` 在盘，不作日常。打前 `POST /free` |
| 像素 / 新战斗帧 128 | `Anything-v5.0-PRT.safetensors` + `PixelArtRedmond15V-PixelArt-PIXARFK.safetensors`（`pixel art, PixArFK`）。日常 API：`combat-128-pixel-t2i.json`（512×768 → 4× 入盒 128）。旧 `combat-64-pixel-*.json` 留档。不要和 SDXL IPA 同图 |
| Klein（停用） | 2026-09-22 参考图已归档。现网 `diffusion_models` 无 Klein 权重。不要 Queue |

冻结条应走 **SDXL + IP-Adapter plus + OpenPose SDXL**。战斗 64 要硬色块直出，Illustrious 偏二次元绘画，条过不过由主理人看，不由通路绿。

---

## 5. 落盘与红线

出图默认进：

`assets/ui-menu/preview/locked/combat-64/_park/comfy-lan/<ISO时间戳>/`

角色活路加 `--char <id>`：

`characters/<id>/_park/<ISO时间戳>/`

每次一份 `job.json`（`prompt_id`、URL、文件列表）。  
客户端**拒绝**写入 `assets/frames/`。

| 准 | 不准 |
|---|---|
| 过程条、冒烟、对照进 `_park/` | 主理人说「过」之前写 `frames/` |
| 参考用已过 `player.png` + `player-walk-a.png` | 改已过 idle / walk / skill |
| 走：优先 E2（印戳 + 驱动视频一次出段 → 挑 `a,e,b,c,f,d`）。单人六相位条退备选 | 独立抽签再混编；站姿当走；硬切/BOX/中位色；Cache-off |
| 技能：单人两格条，拆成静帧过目 | 把 a/b 做成联动 GIF（R22） |
| 量化/收腿只收色或 1–2px | 脚本改姿冒充循环（R20 R21） |

条文：`design/art-bible/combat-64-workflow-v1.md`（v1.14）· `pipeline-gpu-first-v1.md`。现网已过帧见流程 §0，本轮不改 C/E 64。新帧 128。

---

## 6. 冒烟基线（回溯用）

| 项 | 值 |
|---|---|
| 时间 | 2026-09-08 01:26 +08 |
| `prompt_id` | `f2a782f1-172d-41f2-a148-fc9758b76f24` |
| 工作流 | `workflows/smoke-female-witcher.json` |
| 模型 | `waiIllustriousSDXL_v170.safetensors` |
| 种子 / 步 / CFG | `20260908` / 24 / 6 · `dpmpp_2m` + `karras` |
| 尺寸 | 832×1216 |
| 耗时 | 约 19s（对端当时模型多半已在显存） |
| 图 | `_park/comfy-lan/2026-09-07T17-26-35-008Z/comfy_lan_smoke_witcher_00001_.png` |

重跑同一条命令，应再次落盘且不写 `frames/`。图不必像素级相同（若 Comfy 端种子行为变了），但必须有 PNG。

---

## 7. 交给编码机 Agent 的开工范围（风格帧）

1. 读本文 + `check-and-recover.md` + `style-frame-reopen-v1.md`。先 `.\run-job.ps1 ping`，200 再干活。
2. 用 `style-frame-wai-cassandra.json` 出候选人，落 `_park/comfy-lan/`。未点选不当蓝本。
3. 非二次元走 Krea 2（`KREA2-Turbo-基础.json`），与 WAI 分 Queue，换引擎 `POST /free`。C 轨静姿走 `krea2-vf1-identity-edit.api.json`（满降噪合法；指令用视觉描述）。不要 Queue Klein，不要 Queue `KREA2-Turbo-仓库.json`。不要开 Krea 官方 `prompt_enhance`。
4. 不要冻 walk / skill API。不要装社区 Comfy MCP。不要动已过现网帧。
5. GPU 文档用 `.\pull-gpu-docs.ps1` 或 `/userdata`，不要请求 `/docs`。
