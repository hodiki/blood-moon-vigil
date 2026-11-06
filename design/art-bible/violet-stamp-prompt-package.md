# 薇奥莱角色插图 · 提示词与工作流交付

> 2026-10-30 · 给主理人自己出图用
> 对应脚本：`tools/comfy-lan/queue-violet-stamp.mjs`（可原样跑，也可按本文在 ComfyUI 里搭）

---

## 1. 模型与工作流

**模型（三个文件，全部来自 Qwen-Image 2.1 系列）**

| 角色 | 文件 |
|---|---|
| UNET | `qwen_image_2.1_int8_convrot.safetensors` |
| CLIP | `qwen3vl_8b_w4a8.safetensors`，`type = qwen_image` |
| VAE | `qwen_image_2.1_vae_bf16.safetensors` |

**图结构（ComfyUI）**

```
UNETLoader ──► QwenImage21Cache ──► KSampler.model
CLIPLoader ─┐
VAELoader  ─┴► TextEncodeQwenImage21(prompt, negative_prompt, resolution=1024)
                                    ├─ [0] ──► KSampler.positive
                                    └─ [1] ──► KSampler.negative
EmptyLatentImage 768×1344 ──────────────► KSampler.latent_image
KSampler ──► VAEDecode ──► SaveImage
```

**采样参数**

| 项 | 值 |
|---|---|
| 分辨率 | **768 × 1344**（竖构图，人物全身） |
| steps | 40 |
| **cfg** | **1.0** |
| sampler | euler |
| scheduler | simple |
| denoise | 1.0 |
| seed | 见 §6 |

> **最重要的一条：cfg = 1 时，负向提示词实际上不起作用。**
> 这不是设置错了，是 Qwen-Image 蒸馏采样的工作方式——cfg=1 意味着负向分支的权重为 0。
> 所以**所有约束必须写进正向句**。我第一批里"头纱变成了白色发箍"，就是因为"not a headband"只写在负向里，模型根本没看到。第二批把它写进正向（"The veil is not a headband and not a hood"）才纠正过来。

---

## 2. 正向提示词（可直接粘贴）

> `{{SHOE}}` 处换成 §3 里的任一句。

```
Full body character reference sheet of one pale solemn woman in her late twenties, a secular nun-like night watcher, standing, body three-quarter toward the viewer's right, head level, hands relaxed at her sides. HEAD: a deep charcoal veil sits on the crown and falls to her shoulders, its whole outer edge traced with a thin pale line so the veil reads as a distinct shape against her black hair and the dark background. The veil is open at the front, the pale forehead and the hairline are visible, and long black hair falls out from under it down her back. The veil is not a headband and not a hood. TORSO: a high-collared black dress in a qipao cut, narrow and straight from chest to hip with no waist cinch, a pale stand collar at the throat, one thin pale placket line running diagonally down the right side of the chest, three small silver frog buttons. Shoulders are square and slightly broad, not narrow. CHEST MARK: a small eight-pointed star glyph in pale silver on the sternum where the placket ends. Geometric star, not a cross. LOWER BODY: the dress is split open at both sides from the hip, so the front panel and the back panel hang separately and a wide wedge of bare upper thigh shows between them on each side. The front panel ends at mid thigh, the back panel at mid calf. Under the split the white opaque thigh-high stocking is visible with a clear pale band at the top of the thigh, and a strip of bare skin sits between the band and the hem. No shorts, no wrapped skirt, no floor-length fabric, the legs stay fully visible from the side. {{SHOE}} LIGHT: a soft amber orb about the size of her head floats in the air a hand's width from her left shoulder, with a visible warm halo and a faint rim of light on the veil. Nothing is held in her hands. Realistic proportions, head about one eighth of the total height, small head, long legs. Pale tired face, calm, unsmiling. Flat cel-shaded illustration, hard edges, no outline stroke, plain near-black empty background, no floor, no scenery, no text.
```

---

## 3. 鞋型替换句（只换这一句，其余不动）

**A · 厚底粗跟（默认，推荐）**

```
Chunky black block-heeled shoes with a rounded toe and a single pale strap across the instep. The sole reads as a solid dark block, not a thin spike.
```

**B · 尖头细跟**

```
Black pointed stiletto pumps, very thin heel, sharp toe.
```

> 已有结论：**这两种在 128 像素下都读不出来**（都是两个小黑点）。所以随便挑，只影响立绘观感，不影响游戏内。

---

## 4. 负向提示词（照填，但别指望它）

```
long veil to the floor, veil covering the body, wimple, hood, habit, headband, cross, crucifix, rosary, halo, religious symbol, candle, candlestick, lantern, holding anything in hand, shorts, trousers, floor-length skirt, wide A-line skirt, skirt covering both legs, waist cinched, corset, black stockings, bare legs, platform boots, headband, tiara, hairband, big head, chibi, short legs, stray dot, tiny floating speck, background scenery, floor, text, watermark, smiling, glossy latex, leather shine
```

**用途**：换到 cfg>1 的采样器时才会生效；在 cfg=1 下它只是占位，真正的约束靠 §2 的正向句。

---

## 5. 出图后怎么变成游戏帧（可选）

```bash
node tools/scheme-c/box-stamp.mjs <raw.png> <out.png> --fill=112
```

- 目标画布 **128×128**，内容高 112，**脚底 y=127**（工具已内置吸附）
- `-v` 帧 = 与之逐像素相同的副本（不是镜像）
- 朝右；朝左由引擎 `flipX`

---

## 6. 已跑的种子与文件

| 轮次 | seed | 鞋型 | 结果 |
|---|---|---|---|
| 1 | 2026103001 | block | 白箍、直筒裙、光点过小 |
| 1 | 2026103002 | block | 同上 |
| 1 | 2026103003 | point | 同上 |
| 1 | 2026103004 | point | 同上 |
| 2 | **2026103005** | block | **本批最佳**：纱成形、侧衩出现、光可读 |
| 2 | 2026103006 | block | 次之，光偏小 |

文件：`characters/violet/review/20261030-violet-128/raw/t2i-<seed>.png`（768×1344 原图）、`box/<seed>.png`（128 入盒）

---

## 7. 已知失败模式与对策

| 现象 | 原因 | 对策 |
|---|---|---|
| 头纱变成**白色发箍** | 纱和头发都是黑，且"not a headband"只在负向 | 纱改**深炭灰** + **整圈描浅边**；把否定写进正向 |
| **高衩不出现**，裙子成直筒 | "split" 太抽象 | 写明"split open at both sides **from the hip**"+"a wide wedge of bare upper thigh shows" |
| 悬浮光成了**小橙点** | 尺寸没给 | 明确"**about the size of her head**"+"visible warm halo" |
| 悬浮光**过大**像天体 | 给了一个头大 | 收到"**half the size of her head**"，并"closer to the shoulder" |
| 白立领看不见 | 未强调 | 加"**a clear pale band around the neck, two pixels wide**" |
| 裙子过长（到小腿） | "mid thigh" 被忽略 | 改"**the hem sits well above the knee, the knee is fully visible**" |

---

## 8. 我建议的第三轮只改三处

1. **白立领**：加"a clear pale collar band around the neck"，并在正向里再说一次"the collar is the brightest thing on her torso"
2. **裙长**：把"front panel ends at mid thigh"换成"**hem well above the knee, both knees visible**"
3. **光**：一个头 → **半个头**，并"tucked closer to her shoulder"

其余不动，便于对比。
