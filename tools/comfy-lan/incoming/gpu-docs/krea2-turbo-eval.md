# Krea 2 Turbo 评估（主理人指定 · 2026-09-09）

机器：HodikiX，4070 Laptop 8GB，Comfy 0.34.0。  
纪律：**清单里的模型不要自动逐个试**；这一轮只测你点名的 **Krea 2 Turbo**。

四步（你定的顺序）：

1. 提示词套件 → `docs/krea2-eval-prompts.json`
2. Turbo 裸跑参考图 → `user/default/workflows/KREA2-Turbo-t2i.json`
3. 裸跑 vs 已装 WAI v170 vs Klein 4B distilled
4. 社区优化版 / LoRA：主理人已同意落地 **L1 三件 + Bypass 2 仓位（未下文件）+ A2R V3**。日常图与仓库图已分开，见下「已落地」。

---

## 1. 提示词

8 题，覆盖风格和内容倾向（不是只测二次元）：

| ID | 倾向 | 测什么 |
|---|---|---|
| P01 | 纪实街拍 | 非二次元、湿路面、路人 |
| P02 | 油画书房 | 和 Klein 入门句同一条 |
| P03 | 夜城出字 | 长句 + `OPEN LATE` |
| P04 | 二次元立绘 | WAI 主场；Turbo 会不会塑料 |
| P05 | 空间指令 | 左红方 / 右蓝球 / 猫在中间 / 窗在后 |
| P06 | 产品材质 | 玻璃、金属、大理石 |
| P07 | 奇幻风景 | 大场景，不要画成人 |
| P08 | 欧美绘本 | 第三种审美 |

共用：**1024×1024，种子 20260909**。  
三引擎都吃同一段 `nl`。WAI 另有 `wai_tags`，只在 P02 / P04 / P07 各加一枪，不当主对照。  
Krea **关掉 prompt_enhance**，避免 LLM 改写把对比比歪。

---

## 2. Turbo 裸跑怎么跑

官方 Comfy INT8 模板扁平化。本机文件：

| 文件 | 目录 | 约 |
|---|---|---:|
| `krea2_turbo_int8_convrot.safetensors` | `models/diffusion_models` | 12.6 GB |
| `qwen3vl_4b_fp8_scaled.safetensors` | `models/text_encoders` | 4.9 GB |
| `qwen_image_vae.safetensors` | `models/vae` | 0.24 GB |

- CLIP type 必须是 **`krea2`**，不能复用 Klein 的 `qwen_3_4b` / type=`flux2`
- 采样跟 Comfy 0.34 官方 INT8 图：Euler + simple，8 步，**CFG 1**，负向 ZeroOut
- 官方 GitHub 有人写 Turbo 要 CFG=0。本机裸跑跟 Comfy 模板用 1；过曝再试 0
- 模型配置自带 shift≈1.15
- 不要 Queue Raw；不要挂 WAI LoRA / IPA
- 和 WAI / Klein **分 Queue**，换引擎前 `POST /free`

4070 不走 NVFP4。INT8 ConvRot 是官方 8GB 模板用的那颗。

---

## 3. 对照怎么判

每题看：Queue 是否成功、墙钟、是否 OOM、题材是否比 WAI 宽、是否明显强于 Klein 4B、出字/左右关系、二次元题相对 WAI 是否掉档。

输出前缀：`cmp_krea_P0x_` / `cmp_wai_P0x_` / `cmp_klein_P0x_`，WAI 标签枪 `cmp_wai_tags_P0x_`。  
目录：`D:\ComfyUI\output\`

脚本：`docs/krea2_compare_queue.py`（本机 Queue，不冻 walk/skill）。

### 步骤 3 结果

跑次：2026-09-09 14:09–14:20，Comfy 0.34.0，脚本 `docs/krea2_compare_queue.py`。  
27 枪全成功，无 OOM。墙钟含加载；**稳态**约 Krea 27s / WAI 18s / Klein 21s（均 1024²）。首枪更慢：Krea 36.6s、WAI 25.7s、Klein 37.7s。  
对照图：`D:\ComfyUI\output\`。表里时间可点开（本机资源管理器 / 浏览器）。Comfy 开着时也可用  
`http://127.0.0.1:8188/view?filename=文件名&type=output`（局域网把主机换成 `192.168.101.200`）。  
标签枪：[P02](file:///D:/ComfyUI/output/cmp_wai_tags_P02_00001_.png) · [P04](file:///D:/ComfyUI/output/cmp_wai_tags_P04_00001_.png) · [P07](file:///D:/ComfyUI/output/cmp_wai_tags_P07_00001_.png)。秒数：`docs/krea2-compare-results.json`。

| ID | Krea | WAI | Klein | 谁更贴题 | 备注 |
|---|---|---|---|---|---|
| P01 纪实街拍 | [36.6s](file:///D:/ComfyUI/output/cmp_krea_P01_00001_.png) | [25.7s](file:///D:/ComfyUI/output/cmp_wai_P01_00001_.png) | [37.7s](file:///D:/ComfyUI/output/cmp_klein_P01_00001_.png) | **Krea** | Krea/Klein 都是雨夜外卖骑手；WAI 锁成黄雨衣二次元少女，丢掉纪实 |
| P02 油画书房 | [25.9s](file:///D:/ComfyUI/output/cmp_krea_P02_00001_.png) | [15.3s](file:///D:/ComfyUI/output/cmp_wai_P02_00001_.png) | [21.4s](file:///D:/ComfyUI/output/cmp_klein_P02_00001_.png) | Krea ≈ Klein | 两台 DiT 都有油画书房和窗光。WAI 更插画，桌面冒烟不合理。标签枪仍偏二次元室内 |
| P03 夜城出字 | [27.2s](file:///D:/ComfyUI/output/cmp_krea_P03_00001_.png) | [18.1s](file:///D:/ComfyUI/output/cmp_wai_P03_00001_.png) | [22.6s](file:///D:/ComfyUI/output/cmp_klein_P03_00001_.png) | **Krea ≈ Klein** | Krea、Klein 都把 `OPEN LATE` 写对。WAI 是新海诚风巷子，没有可读英文招牌 |
| P04 二次元立绘 | [27.2s](file:///D:/ComfyUI/output/cmp_krea_P04_00001_.png) | [18.1s](file:///D:/ComfyUI/output/cmp_wai_P04_00001_.png) | [21.2s](file:///D:/ComfyUI/output/cmp_klein_P04_00001_.png) | **WAI** | WAI 主场（标签枪更像 Illustrious）。Krea 是偏厚涂的立绘，能用但不抢 WAI |
| P05 空间指令 | [28.7s](file:///D:/ComfyUI/output/cmp_krea_P05_00001_.png) | [18.1s](file:///D:/ComfyUI/output/cmp_wai_P05_00001_.png) | [21.3s](file:///D:/ComfyUI/output/cmp_klein_P05_00001_.png) | **Krea ≈ Klein** | 左红方、右蓝球、猫居中、窗在后，两台 DiT 都对。WAI 左右对调，方块也不是纯红 |
| P06 产品材质 | [27.3s](file:///D:/ComfyUI/output/cmp_krea_P06_00001_.png) | [18.1s](file:///D:/ComfyUI/output/cmp_wai_P06_00001_.png) | [21.3s](file:///D:/ComfyUI/output/cmp_klein_P06_00001_.png) | **Krea** | Krea：白大理石 + 金盖 + 无假 logo。Klein 接近，液体里多气泡。WAI 乱出品牌字、底不是白大理石 |
| P07 奇幻风景 | [27.2s](file:///D:/ComfyUI/output/cmp_krea_P07_00001_.png) | [18.1s](file:///D:/ComfyUI/output/cmp_wai_P07_00001_.png) | [21.1s](file:///D:/ComfyUI/output/cmp_klein_P07_00001_.png) | **Krea** | Krea 金晖峡谷 + 石桥 + 无人。Klein 也无人但构图更俯视栈道。WAI 对称插画，桥上有小人（违背 no people） |
| P08 欧美绘本 | [31.6s](file:///D:/ComfyUI/output/cmp_krea_P08_00001_.png) | [18.1s](file:///D:/ComfyUI/output/cmp_wai_P08_00001_.png) | [21.2s](file:///D:/ComfyUI/output/cmp_klein_P08_00001_.png) | **Krea ≈ Klein** | 都是穿蓝大衣的狐狸绘本。WAI 画成带狐耳兜帽的人 |

**总判（裸跑）**

- **相对 WAI**：题材明显更宽。听长句、出字、左右关系、产品材质、非二次元绘本，都是 Krea 赢；二次元立绘仍让给 WAI。自然语言喂 WAI 会风格锁死，标签枪也救不了 P07 的「不要人」。
- **相对 Klein 4B distilled（主理人 2026-09-09）**：**部分情况光影理解优于 Krea 2；细节易出错；整体逊于 Krea 2。** 听指令/出字/空间仍能当对照，但不再按「并列第二引擎」写。不默认补位。未下令删盘。

**主理人 2026-09-09 晚间确认：** 不再使用 Klein。二次元主力 **WAI**，非二次元主力 **Krea 2 Turbo**（日常 `KREA2-Turbo-基础.json`）。Klein 权重与参考图留档，不要日常 Queue。
- **CFG 1**：8 张未见过曝废图，本机继续跟 Comfy INT8 模板，不必立刻改 0。
- **包络**：日常远低于 1–2 分钟。
- **本机任务管理器（主理人截图）**：生图中 3D ≈97%、专用显存 6.6/8GB，但共享 GPU 内存同时 ~6.5GB（合计约 13GB）。这是 12.6GB INT8 在 8GB 上靠 `--lowvram` 把权重摊到系统内存，不是空余 1.4GB 还能再挂一张大模型。结束瞬间专用显存掉到 0.6GB，说明卸载是真释放。86°C 是满载笔记本正常偏热，没 OOM。

步骤 4（主理人 2026-09-09 同意的落地，不是对照重跑）：

- 日常：`KREA2-Turbo-基础.json`（INT8 + `Krea2T-Enhancer-Advanced`，`enabled` 可关）。冒烟 `output/krea2_base_00001_.png`（约 39s，Enhancer 开）
- 仓库：`KREA2-Turbo-仓库.json`（L1 三件 / Bypass 2 仓位未下文件 / A2R V3；各组有备注；无 SaveImage）
- 裸跑图保持原样，仍作对照基线。

---

---

## 4. 社区优化 / LoRA（已按主理人方案落地）

社区里「优化过的 Krea2」多数是 **LoRA（在 Raw 上训、挂到 Turbo）**，不是换一颗融合大底。量化包（Winnougan FP8/INT8）只是同一颗 Turbo 的压缩，**不算优化审美**。

### 建议先看（等你点名）

| 优先级 | 名称 | 类型 | 源 | 约 | 触发 / 用法 | 为什么列 | 先别下的理由 |
|---|---|---|---|---|---|---|---|
| **L1** | 官方 style 三件 | LoRA | [Comfy-Org/Krea-2/loras](https://huggingface.co/Comfy-Org/Krea-2/tree/main/loras) | 各 ~448 MB | `krea2_softwatercolor` → `art deco watercolor style`；`krea2_retroanime` → `purple retro anime style`；`krea2_darkbrush` → `monochrome ink wash style`；强度约 1.0 | 官方「Train on Raw, Run on Turbo」示范；补裸跑覆盖面 | 裸跑基线已有，等你点头再下 |
| L1b | `krea2_turbo_lora_rank_64_bf16` | 适配 LoRA | 同上 `loras/` | 实施时核 | 无风格触发词；挂 Turbo 用 | Comfy 包里的 Turbo 配套，不是审美融合底 | 先确认是不是「修蒸馏」；不要当风格包 |
| L2 | 其余官方 style | LoRA | 同上 | 各 ~448 MB | `dotmatrix` / `kidsdrawing` / `neondrip` / `rainywindow` / `sunsetblur` / `vintagetarot` | 风格更偏 | 一次不要堆 9 个 |
| L3 | `krea2_style_reference` | 参考图 LoRA | 同上 ~436 MB | 官方风格参考模板用 | 接近「多一张参考」 | 还不是 OpenPose；裸跑后再说 |
| C1 | Anything2Real V2 | I2I 风格 LoRA | [WarmBloodAban/Krea2_Anything2RealCharacters-V2](https://huggingface.co/WarmBloodAban/Krea2_Anything2RealCharacters-V2) | 实施时核 | 二次元/插画 → 写实；Turbo 8 步 CFG 1 | 社区里少见的「改 Turbo 审美」 | **图生图**，不是这次文生对照 |
| C2 | krea2-reid | 身份 LoRA | [yijunwang2/krea2-reid](https://huggingface.co/yijunwang2/krea2-reid) | 实施时核 | 一张脸参考改衣服/姿势；训在 Raw、跑 Turbo | 以后锁角色可能用得上 | 要参考图 + 额外节点，超出裸跑 |
| 不列进本轮 | 角色 OC LoRA（如 masafee）、CharacterSheet QuadView | 特定角色 / I2I 三视图 | HF 上有 | — | 作者自己的角色或拆视图 | 对「Turbo 好不好看」没有通用增益 | 不对这次 |

**已按你同意的方案做：** L1 三件下到 `models/loras/`，只进仓库单挂，不默认接到基础图。Anything2Real 用 **V3 LoRA**（已下），不要 V2 融合底。Filter Bypass 2 只占仓库位 + 备注，**文件未下**（节点红是预期）。Enhancer Advanced 在基础图上，可关。  
**2026-09-10：** Hodiki 装 A 已落地——节点 `comfyui-krea2-controlnet` + `krea2_turbo_openpose_controlnet.safetensors`（`models/loras/`）。这是骨架，不是 L1 风格包，未挂基础图。

不要下 Raw。HD 两段本轮没进仓库。L1b / 其余官方 style / krea2-reid 等你另点。

---

## 明确还没做

- Filter Bypass 2 权重未下（仓里有红节点和备注）
- 未把 L1 / A2R / Bypass 接到基础图默认路径
- 未改 `WAI-*.json`；未覆盖裸跑 `KREA2-Turbo-t2i.json`
- 未冻 walk / skill
- 未装 ComfyUI-GGUF（Turbo 走 INT8，不需要）
