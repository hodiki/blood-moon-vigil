# 风格帧 H23 · 锁点与产线经验（2026-09-08）

> 主理人点选：`comfy_lan_style_c_hose2_00023_` **当风格帧**。  
> 蓝本：`characters/cassandra/identity/source/h23.png`  
> 过程稿：`_park/comfy-lan/2026-09-08T09-00-25-659Z/comfy_lan_style_c_hose2_00023_.png`  
> 开工流水：`style-frame-reopen-v1.md`。产线：`pipeline-gpu-first-v1.md`。  
> 现网 C/E 64 **不改**。不写 `assets/frames/`。艾德蒙 / 薇奥莱 / 加尔文立绘跟此画法，不跟旧 v2。

---

## 1. 测通配方（以后复现先抄这里）

| 项 | 值 |
|---|---|
| 引擎 | WAI Illustrious SDXL v170 · Euler a · 28 步 · CFG 6 · CLIP skip 2 |
| 底图 | **H1** `comfy_lan_style_c_hose_00001_`（不是 hose2_00001） |
| 尺寸 | 768×1344（i2i 缩放） |
| 种子 | `202609104` |
| IPA | PLUS 仍加载，**weight = 0**（旁路）。end_at 0.35 备着，weight 0 时不起作用 |
| denoise | **0.75** |
| 下装 | 可选 `black pantyhose` |
| 靴 | `matte black boots, stiletto, pointed toe` |

正向 / 负向以 `tools/comfy-lan/workflows/style-frame-m1-hose2.json` 为准（已按 H23 收过）。

下一刀改图：底图换成 **H23 本身**，不要再从 H1 重锁。

---

## 2. 踩的坑

1. **全身 i2i + denoise 0.5 + IPA 0.78 = 提示词等于没写。** 采样全在保底图，不是 CLIP 没读到词。
2. **WAI 里 `leather`+`stiletto`，以及 `matte`/`suede` 弱词，都打不过漆皮靴型。** 细高跟黑靴先验偏漆面。
3. **半身女形传到全身，做 i2i 时需留意身形过度变方。**
4. **API 排队不会出现在 8188 画布上。** 用户若要复原工作流，需写进 ComfyUI 画布（UI 格式进 `user/default/workflows`，或拖 `*.ui.json`）。

---

## 3. 成法

1. **改结构先旁路 IPA，denoise ≥ 0.75**，确保提示词能生效。
2. **女下装可选 `black pantyhose`。**
3. **女形若要凸显身材，写 `hourglass, wide hips, curvy`。**
4. **高跟靴可写 `matte black boots, stiletto`，负向不要禁细高跟。**

---

## 4. 以后出图（跟 H23）

底图用 H23。画法跟 H23（二次元、虚空底）。形跟 lock-ce 左 + 色键 C 行（色面积）。不要和卡珊德拉 v2 平均，不要重切现网 C/E 64。

新立绘仍一人一套形、画法跟这一套。**作者按 2026-09-23 期望：** 二次元走 Krea 2，非二次元与图片编辑走 Qwen-Image-2.1。不要用 WAI 当日常作者。

---

## 5. 引擎分工

**现行（2026-09-23）：** 二次元新图 = Krea 2。WAI 只作备用或风格化。非二次元与图片编辑 = Qwen-Image-2.1。下表是 2026-09-09 的历史分工，不要再当开工表。H23 这张已过的画仍是风格蓝本，不要用新引擎去平均它。

H23 成片仍是 **WAI**。不要用后来的引擎去「平均」这套二次元风格。

| 用途 | 引擎 | 日常图 |
|---|---|---|
| 二次元立绘 / 厚涂 / 锁脸锁姿 | WAI v170 | `WAI-*.json` |
| 长提示、出字、写实/风景/产品 | Krea 2 Turbo | `KREA2-Turbo-基础.json` |
| Klein 4B | **停用**（未删盘） | `FLUX2-Klein4B-*.json` 仅留档 |

WAI 与 Krea 分 Queue。Klein 过程图不作废文件，但不要当日常引擎。
