# GPU 机生图环境工作规范

主机名 `HodikiX`。ComfyUI 在 `D:\ComfyUI`。  
编码机 `Hodiki`（`192.168.101.82`，MAC `7C-21-4A-DD-A9-EB`）只调用本机 `8188`，不在本机跑 Comfy。

本文确认分工，并规定本机「维护 / 优化 / 升级」怎么推进。

对外介绍：`D:\ComfyUI\docs\环境说明.md`  
维护记录：`D:\ComfyUI\docs\维护更新日志.md`  
局域网握手：`D:\ComfyUI\comfy-lan-handshake.json`（Hodiki 用 `/userdata` 拉，见方案 A）  
推进核对：`D:\ComfyUI\docs\任务清单.md`  
通信记录：`D:\ComfyUI\docs\局域网通信维护记录.md`  
第一期文件清单：`D:\ComfyUI\PHASE1_使用说明.txt`

本机 Agent **主要任务是维护 / 优化 / 升级**，并且**本机也要准备和搭建参考工作流、以及各类工具**（放大、锁角色/姿势、风格 LoRA、分级标签、后续 Klein / AnimateDiff 等）。Hodiki 和用户按需直接用现成图、改参数、或参考另建——关键是**按需选用，而不是固定唯一用法**。必须保持 Queue 生图能力（升级验收和个人出图）。不为 Hodiki 冻 walk / skill API。

---

## 1. 分工（已确认）

| 角色 | 机器 | 负责 | 不负责 |
|---|---|---|---|
| 编码机 | Hodiki | 按任务设计、改、冻工作流（含 walk / skill 的 API JSON）；从局域网调用本机出图；游戏仓库 `assets/frames/` | 在本机装模型、改 Comfy 启动参数、开公网隧道 |
| GPU 机 | HodikiX | 生图环境：安装、监听、防火墙、节点、权重、升级、冒烟；**准备参考工作流与工具**；本机个人生图 | 为游戏任务冻 walk / skill 等 API 工作流；改游戏仓库资源 |

「冻工作流」= 在 Comfy 网页里把某张图画到可重复调用，另存为 API 格式，交给编码机脚本。  
**游戏任务的冻图由 Hodiki 按任务灵活做。** 本机不预设、不维护 walk / skill 的官方 API 图。

本机在 `D:\ComfyUI\user\default\workflows` 维护的是**参考库**：入门图、底图+精修、锁角色、锁姿势等。  
这些图**可以打开就用**，也可以改提示词 / 尺寸 / 降噪 / 旁路节点，或另存一版。**不是**对 Hodiki 的冻 API 契约，也**不是**唯一正确画法。Hodiki 需要某能力时：优先看参考图和「本机已装的节点、文件名」，再按任务改或重画。

---

## 2. 本机职责

### 2.1 维护（日常）

- 用 `D:\ComfyUI\start_lowvram.bat` 启动。当前监听 `0.0.0.0:8188`，本机用 `http://127.0.0.1:8188`，Hodiki 用 `http://192.168.101.200:8188`。
- 保持防火墙规则 **ComfyUI LAN Hodiki only**：只允许 `192.168.101.82` 进 TCP 8188。不要 ngrok，不要把 8188 映射到 WAN，不要对 Python 点「允许所有连接」。
- 路由器给 `192.168.101.200` 做 DHCP 预留（人做，Agent 做不了）。IP 变了就重写握手文件并通知 Hodiki。
- 需要给 Hodiki 用时保持 Comfy 开着；关窗口即断。
- 不删、不挪已有模型文件，除非升级方案写明替换关系。
- 不改游戏仓库的 `assets/frames/`。

### 2.2 优化（8GB 硬约束）

机器：RTX 4070 Laptop **8GB**，32GB 内存，`--lowvram --reserve-vram 0.8 --vram-headroom 0.4`。

- 一次只挂一种 ControlNet。IP-Adapter 和 OpenPose **拆成两轮**。
- 主力分辨率：768×1024 或 832×1216。不要默认 1536。
- 不装「提示词 LLM 扩写」类节点（和生图抢显存，且会把 WAI 的 Danbooru 标签写成通用腔）。
- 不装 Impact Pack / FaceDetailer，除非单独评估显存。
- 优先固化采样与标签，而不是再下一颗底模：WAI 用 Euler a、28–35 步、CFG 5.5–7、CLIP Skip 2；正向可加 `masterpiece, best quality, general`。
- 像素条：Anything V5 + `pixel art, PixArFK`，先出 512–768，**最近邻**缩到 ≤128；姿势用 SD1.5 OpenPose，不用 SDXL 那颗。

### 2.3 升级（必须有触发条件）

本机升级 = 加节点 / 换 LoRA / 加第二引擎。每做一项都要：

1. 有下面第 4 节对应条目的触发条件。
2. 本机冒烟：`GET /system_stats` 200，并用最小图确认新能力能 Queue 出结果。
3. 更新握手 JSON 的 `custom_nodes` / `models` / `notes` / `docs`（只改 `D:\ComfyUI\comfy-lan-handshake.json`，硬链接会到 `/userdata`）。
4. 用一句话通知 Hodiki：**新增了什么、文件名是什么、旧名是否作废**。Hodiki 自己改工作流，本机不替它冻图。不要再拷握手或 docs 到桌面 / Documents 当同步。

默认**不下**：Flux Dev 全家、本地 Qwen、Pony、为「更强」而没有触发条件的大文件。

### 2.4 个人生图

本机可以直接出九类游戏美术草稿（场景、立绘、油画、剪影、平涂、像素帧、装饰）。  
个人图与 Hodiki 任务图可以共用同一套环境，但输出目录和个人工作流不算产线交付。

### 2.5 参考工作流与工具（本机也要搭）

本机不只「装好权重等人来画」。Agent 要按 `docs\任务清单.md` 分批把**能打开的参考图**和**可选用工具**准备好，方便 Hodiki / 用户随时抽查、直接用或改。

原则：

- **有能力，不强迫用。** 油画 LoRA、分级标签（含 nsfw）、AnimateDiff、第二引擎等都先备好或列入清单；某次出图可以完全不用。
- **按需调整。** 参考图里的采样、尺寸、强度、旁路节点都可以改；需要时另存，不要把一张图当成全项目唯一管线。
- **NSFW 不是插件。** 它是 WAI / Danbooru 的分级标签（`general` / `sensitive` / `nsfw` / `explicit`），只改尺度，不提高光影或细节。见 `docs\提示词预设.txt`。
- **8GB 仍拆轮。** 锁角色（IP-Adapter）和锁姿势（OpenPose）分成两张参考图；Klein 与 WAI 也分 Queue。不要叠在同一 Queue。
- 工具就位后：更新任务清单勾选、环境说明「现在能做什么」、握手 `notes` / `models`，并用四行通知 Hodiki 文件名。文档只写 `D:\ComfyUI\docs\`（联接即 `env-docs`），Hodiki 用 `/userdata` 拉，不必再拷。

当前参考图目录：`D:\ComfyUI\user\default\workflows\`（见任务清单第一步）。

---

## 3. 给 Hodiki 的环境契约

Hodiki 组图时按**文件名**找权重。本机 `workflows` 里**有参考 JSON**，可直接打开、改完另存，或只当节点接法说明书。不要把参考图当成 walk / skill 的冻 API。

当前已提供：

| 能力 | 文件或节点 |
|---|---|
| 二次元 / 厚涂主力 | `waiIllustriousSDXL_v170.safetensors` |
| 像素 / 小图 | `Anything-v5.0-PRT.safetensors` |
| 锁脸 | `ip-adapter-plus_sdxl_vit-h.safetensors` + `CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors` + 节点 `ComfyUI_IPAdapter_plus` |
| 姿势 SDXL / SD1.5 | `openpose-sdxl-xinsir.safetensors` / `control_v11p_sd15_openpose_fp16.safetensors` + `comfyui_controlnet_aux` |
| 像素 LoRA | `PixelArtRedmond15V-PixelArt-PIXARFK.safetensors`（触发词 `pixel art, PixArFK`） |
| 油画 LoRA（替补） | `oil-painting-sdxl-slider.safetensors`（触发词 `oil painting`） |
| 无背景抠图 | 节点类名 `InspyrenetRembg`（显示名 Inspyrenet Rembg）；权重 `models\background_removal\.transparent-background\ckpt_base.pth` |
| 放大 | `4x-UltraSharp.pth`（精修图里默认旁路，按需打开） |
| 参考工作流 | `WAI-Illustrious-个人学习.json`；`WAI-底图加精修.json`；`WAI-锁角色-IPAdapter.json`；`WAI-锁姿势-OpenPose.json`；`FLUX2-Klein4B-个人学习.json`；`FLUX2-Klein4B-改图.json`；`WAI-精修外来底图.json` |
| 提示词工具 | `docs\提示词预设.txt`（质量 / 分级含 nsfw / 光影 / 油画 / Klein 自然语言 / 负向） |
| 第二引擎 | `flux-2-klein-4b.safetensors` + `qwen_3_4b.safetensors` + `flux2-vae.safetensors`（CLIP type=`flux2`；Euler 4 / CFG 1） |

未提供（见第 4 节与任务清单第三步）：Illustrious 专用油画 LoRA、AnimateDiff。不下 9B / Flux Dev / 本地 Qwen Image。

握手里的 `walk_strip_api` / `skill_strip_api` 由 **Hodiki 冻好后再改**，本机不抢填 `true`。

---

## 4. 环境升级推进方案（原 2 / 3 / 4 / 5）

下面四条都是本机环境项。Hodiki 只在「本机宣布已装」之后，把对应节点画进自己的任务图。

### 4.1 抠图（原第 2 项）— 已完成（2026-09-08）

**目的**：③⑤ 无背景立绘能在本机闭环；Hodiki 也能在任务图末尾接抠图。

**触发**：现在就可以做。不依赖游戏工作流是否冻好。

**本机做**：装轻量抠图节点和权重；本机 Queue 一张白底立绘再抠，确认碎发可接受。  
**Hodiki 做**：需要无背景交付时，在自己的图末尾接该节点。本机不提供官方抠图 API 图。

**做法（8GB）**：

- 只装抠图，不顺带装 Impact Pack。
- 优先选 Comfy 里常见的 RMBG / InSPyReNet / anime-seg 一类节点；二次元碎发优于通用 `u2net`。
- 权重大约 0.2–0.4GB 级，放到节点文档指定目录或 `D:\ComfyUI\models\background_removal`。
- 下载走 Hugging Face + 现有代理；不为抠图去登录 Civitai。

**验收**：

- 节点出现在 Comfy 节点列表。
- 本机一张 WAI 白底立绘 → 抠图 → 透明底 PNG。
- 握手 `custom_nodes` / `notes` 写上节点名；通知 Hodiki 节点显示名。

**现在不做**：为抠图再下一颗新底模。

---

### 4.2 油画 LoRA（原第 3 项）— 有对口文件再换

**目的**：④⑤ 更稳地偏油画，而不换掉 WAI。

**触发**（满足一条再动手）：

- Hugging Face / 其它镜像出现 **Illustrious 油画 LoRA**，且说明可跟 WAI 用（例如 Civitai 1879856「Oil Painting Style Illustrious」，触发词 `0ilstyle` 的同 hash）；或
- 主理人指定某一文件并同意从 Civitai 手动下载。

**未触发时**：继续用提示词 `oil painting (medium), impasto, traditional media`，需要时再挂现有 `oil-painting-sdxl-slider`（强度约 0.6–1.2）。不主动为这一项登录 Civitai。

**本机做**：新文件放进 `models\loras\`，文件名不含空格；本机用 WAI + 新 LoRA 出一张对照图；旧滑条先保留，确认新的更好再标「弃用」。  
**Hodiki 做**：改自己图里的 LoRA 文件名和触发词。本机不改 Hodiki 的 JSON。

**验收**：对照图明显比「纯提示」或「仅滑条」更像油画；握手 `models` 与 `notes` 更新；通知 Hodiki 新文件名和触发词。

**不做**：为油画再下一整颗绘画大底模；把 Pony 油画 LoRA 挂到 WAI 上。

---

### 4.3 AnimateDiff（原第 4 项）— 真要走 / 跑草稿再装

**目的**：⑧ 的连续动作草稿（走、跑、挥砍）。逐帧 OpenPose 仍然是默认路径。

**触发**：Hodiki 或本机个人明确要「一段动作草稿」，而不是单帧姿势条。口头「以后可能要动画」不算。

**未触发时**：⑧ 继续用 Anything V5 + 像素 LoRA + SD1.5 OpenPose + 最近邻缩小。不要为动画预下运动模块。

**本机做**（触发后）：

- 只加 **SD1.5** AnimateDiff（节点 + 一个运动模块，优先 16 帧左右的官方/社区模块）。
- 不装 SDXL AnimateDiff。
- 8GB：动画图不要同时挂 IP-Adapter；先出短段，再按需 img2img 贴回锚点。
- 本机冒烟：16 帧以内能出、不 OOM。

**Hodiki 做**：自己冻动画任务图（输入锚点 / 骨架或提示，输出帧目录）。本机不冻 walk 动画 API。

**验收**：本机短段能出；握手写上节点和运动模块文件名；通知 Hodiki「可画 AnimateDiff，仍建议 Pose 条为成品草稿主路径」。

**不做**：视频大模型、帧插值全家桶、为 AnimateDiff 再换底模。

---

### 4.4 FLUX.2 Klein（原第 5 项）— 已完成（2026-09-08，4B distilled）

**目的**：补「听长提示 / 弱出字 / 非二次元说明图」。不是 WAI 立绘的替代品。

**触发**（满足一条）：

- 本机个人需要复杂自然语言场景或弱出字，WAI 连续失败；或
- Hodiki 有任务明确要第二引擎，并接受和 WAI 不同的工作流。

**触发状态（2026-09-08）**：主理人下令推进第二步。只下 **4B distilled** 三件套，参考图另存，**不改**已有 `WAI-*.json`。

**本机做**（触发后）：

- **只下 FLUX.2 Klein**（体积按当时 HF 页面选能在 8GB + `--lowvram` 跑完 1024 的那一档）。
- 配齐该仓库要求的 text encoder / VAE，不多下 Dev / Schnell / 其它 Klein 变体。
- 本机冒烟：1024 能出、不长期占满显存。
- 通知 Hodiki：引擎名、checkpoint / UNET 文件名、推荐步数；并写明 **二次元立绘仍用 WAI**。

**Hodiki 做**：只有任务需要时才另冻一张 Klein 图。不要把现有 WAI 图的采样器直接套过来。

**验收**：握手增加 Klein 相关文件；`GET /system_stats` 仍 200；本机有一张 Klein 冒烟图。

**禁止**：Flux.1 Dev、Flux 全家桶、本地 Qwen GGUF、Pony。AA Elo 上的满血 Qwen / Flux 分数不能用来选这台 8GB 的本地文件。

---

## 5. 推荐推进顺序

细节勾选以 `docs\任务清单.md` 为准（Agent 与主理人随时核对）。

| 批次 | 内容 | 现在 |
|---|---|---|
| 第一步 | 底图+精修、UltraSharp、锁角色 / 锁姿势参考图、提示词预设 | **已完成** |
| 第二步 | Klein 4B distilled + 与 WAI 分图配合 | **已完成**（另开参考图，未改已有 WAI 图） |
| 第三步 | 风格多样化能力（油画对口 LoRA、AnimateDiff、分级预设、Tagger 等） | 按需装；不一定常用，但不能没有能力 |
| 环境项 | 油画 LoRA 换对口文件 / AnimateDiff | 仍受第 4 节触发条件约束 |

Hodiki 侧与本机并行：按任务冻自己的 API 图；本机不阻塞、不代做。参考图供选用，不代替冻 API。

---

## 6. 文档怎么改、怎么通知

**写哪里（不变）**：维护说明、任务清单、更新日志、提示词预设只改 `D:\ComfyUI\docs\`。握手只改 `D:\ComfyUI\comfy-lan-handshake.json`。参考工作流仍在 `user\default\workflows\`。

**怎么到 Hodiki（已变）**：方案 A。`docs` 联接为 `user\default\env-docs`，握手是硬链接。改完即最新。不要请求 `/docs`（前端节点说明书，403）。`/userdata/{file}` 只认一段路径，斜杠写成 `%2F`。

```text
列文档：  GET http://192.168.101.200:8188/userdata?dir=env-docs&full_info=true
环境说明：GET http://192.168.101.200:8188/userdata/env-docs%2F环境说明.md
握手：    GET http://192.168.101.200:8188/userdata/comfy-lan-handshake.json
工作流：  GET http://192.168.101.200:8188/userdata?dir=workflows
```

不要再把同一份文件拷到桌面或 Documents 当同步。联接坏了见 `docs\局域网通信维护记录.md`。

本机每完成一次环境变更，回复里仍带这四行（给人看，不是传文件）：

```text
变更：<节点或文件>
路径/显示名：<……>
旧名是否作废：是/否（<旧名>）
握手：已更新 /userdata/comfy-lan-handshake.json
```

Hodiki 收到后再改自己的冻图。不要假设编码机已经连上新节点。
