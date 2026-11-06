# b-stamp-t2i-128 · 立绘 → t2i 印戳 → 入盒 128

> 状态：**已过** · 2026-10-21 · 主理人定为**目前项目中效果最好的「角色立绘 → 像素形象」工作流**
> 证据：`evidence/01-board-cassandra-128.png`（三列九行）· `02-two-routes.png`（t2i vs 立绘+edit）· `03-leg-seed-lottery.png`（同提示词不同 seed 的腿色差异）
> 条文：`combat-scheme-a-directive-v1.md` · `character-art-bible-v1.md` §1.2 · `asset-spec-v1.md` §0.5
> 一句话：**立绘不进 128。把形锁写成提示词，t2i 出 768×1344，flood-key 去底，按内容高 112 入盒，脚底钉在 y=127。**

> ⚠️ **本条仍要吃两件事：提示词优化 + 抽卡。** 见 §6，别把它当确定性工序。

---

## 1. 适用 / 不适用

| 适用 | 不适用 |
|---|---|
| 已确认形锁（剪影锁 + 立绘）的角色，要出 128 战斗印戳 | 形锁还没定的角色——先走 `a-derive-single-source` |
| 目标帧 128（世界缩放 1） | 32 / 48 的杂兵与召唤物，128 的细节会被丢掉，改用 C 轨或简笔 |
| 要一次拿到「干净的 128 + 可当 Wan 参考的高分辨率印戳」 | 想要精确指定姿态——那是 `c-pose` 或 `c-walk` 的事，本条只管站姿 |

**为什么不直接缩立绘**：立绘 768×1344 是真画，直接缩到 128 会把光影、笔触、背景一起带进来，且姿态固定；而且 `combat-scheme-a-directive-v1.md` §3 明写「立绘只当身份来源，不缩小成战斗帧」。t2i 的作用是**按形锁重画一个干净的、纯色底、全身、比例正确的站姿**，再入盒。

## 2. 输入 → 输出

| 输入 | 规格 | 来源 |
|---|---|---|
| 形锁 | `character-art-bible-v1.md` §1.2 的剪影锚 + 配色键 | 设计文档，不读图 |
| 立绘（可选） | 768×1344 | 只在 §5 的 edit 旁路里当参考；t2i 主线**不用** |

| 输出 | 规格 | 落盘 |
|---|---|---|
| 印戳原图 | 768×1344 RGBA · 近黑纯色底 | `characters/<name>/review/<date>-scheme-a-128/raw/` |
| 去底印戳 | 768×1344 硬 alpha | `.../ref/stamp-<seed>-alpha.png` |
| 战斗帧 | 128×128 · 硬 alpha · 内容高 112 · 脚底 y=127 · 顶 y=16 | `.../x128/` |

尺寸链（卡珊德拉实测）：

```
768×1344 出图
  └ flood-key → 包围盒 412×1273
      └ 缩放 min(112/412, 112/1273) = 0.088 → 36×112
          └ 水平居中、脚底 y=127 → 128×128（内容 top 16）
```

## 3. 引擎 · 权重 · 节点

| 项 | 值 |
|---|---|
| 引擎 | ComfyUI 0.37.0 · PyTorch 2.14.0+cu130 · RTX 4070 Laptop **8GB** |
| 扩散 | `qwen_image_2.1_int8_convrot.safetensors`（Qwen-Image-2.1 · INT8） |
| 文本编码 | `qwen3vl_8b_w4a8.safetensors`（type `qwen_image`） |
| VAE | `qwen_image_2.1_vae_bf16.safetensors` |
| 节点 | `UNETLoader` → `CLIPLoader` → `VAELoader` → `QwenImage21Cache` → `TextEncodeQwenImage21` → `EmptyLatentImage` → `KSampler` → `VAEDecode` → `SaveImage` |
| 耗时 | 单张约 **60–75 秒**（8GB，含 /free 后装模） |

## 4. 参数

| 参数 | 值 | 备注 |
|---|---|---|
| 画布 | `EmptyLatentImage` **768×1344** | 成品尺寸由它决定，**不是** `resolution` |
| `resolution`（编码节点） | 1024 | 只作用于**参考图**；t2i 无参考图时不起作用 |
| 采样 | `euler` / `simple` / **40 步** / **cfg 1** / denoise 1 | |
| seed | 2026102109（采用值） | 同提示词不同 seed 结果不同，见 §6 |
| 提示词结构 | 六段：**构图 → 发/头 → 外衣 → 内衣与配饰 → 下装与靴 → 比例与画风** | 全文见 `prompt.txt` |

提示词里真正起作用的四句（缺一句就掉档）：

1. `body three-quarter toward the viewer's right, but her head turned slightly toward the viewer` —— 不给这半句，脸是白块、眼睛消失
2. `head about one eighth of the total height, small head, long legs` —— 不给，模型回到大头
3. `sheer charcoal stockings over pale skin so the legs read as dark warm grey, not pure black` —— 不给，腿是纯黑（与立绘的丝袜不符）
4. `Flat cel-shaded illustration, hard edges, no outline stroke, plain near-black empty background` —— 不给，出现描边或场景

## 5. 命令

```powershell
# 0) 确认 GPU 机在线、队列空
curl http://192.168.101.200:8188/system_stats

# 1) 出印戳（t2i 主线；多给几个 seed）
& $NODE tools\comfy-lan\queue-cassandra-stamp.mjs t2i 2026102109 2026102110 2026102111
#    旁路：以立绘为参考的图片编辑（对照用，不默认走）
& $NODE tools\comfy-lan\queue-cassandra-stamp.mjs edit 2026102201

# 2) 去底 + 入盒 128（一帧一条）
& $NODE tools\scheme-c\box-stamp.mjs <raw.png> <out-128.png> --fill=112

# 3) 技能 / 静姿（旁路，属 c-pose 条）
& $NODE tools\comfy-lan\queue-cassandra-skill.mjs a
& $NODE tools\comfy-lan\queue-cassandra-skill.mjs b
```

入盒五个动作（`box-stamp.mjs`）：四边 flood-key（RGB 和 ≤24 判背景）→ 取包围盒 → 按 `min(fill/w, fill/h)` 面积平均缩放 → 水平居中、脚底 `y = 127` → alpha ≥128 阈值成硬边。

> `--eye` 参数**不要用**（2026-10-21 主理人核）：128 原生就是 1 源像素对 1 屏幕像素，靠降采样留下的那个更暗像素已经够；再补一个点反而像鼻子。

## 6. 已知限制（必读）

1. **抽卡是必要的。** 同一版提示词，seed 106 / 107 / 109 / 110 出了丝袜，**seed 108 仍是纯黑腿**（L 13.5）。提示词把命中率抬到约 3/4，不是确定性修复。**一角色至少出 4 张挑一张。**
2. **cfg=1，负面提示词不生效。** ComfyUI 在 cfg=1 跳过 uncond 分支，`negative_prompt` 整串是装饰。想用负面必须先抬 cfg 并重验采样。
3. **脸是最大的不确定性。** 不写「头稍转向观者」就得到白块；写了也仍可能没眼。§6.1 的抽卡同样适用于脸。
4. **比例靠提示词自觉，必须事后量。** 出图后要量头高/身高（目标 ≈1/7.8）与腰线位置，不合就重出，不要靠目测。
5. **本条只管站姿。** 走循环与技能不在本条的成熟范围内：
   - 走：Wan Animate 2 + 驱动视频这一版「看起来比之前都好，但仍需验证」——**未固化**，见 `c-walk-wan-animate2/` 与 `design/art-bible/gpu-h3-to-wan-animate2-swap-v1.md`
   - 技能：走图片编辑（`c-pose`），文字描述姿态，无动作源，胯膝转折不保证严谨

## 7. 验收

四问（`combat-scheme-a-directive-v1.md` §2）之外，本条额外三条：

| 项 | 门槛 | 卡珊德拉实测 |
|---|---|---|
| 尺寸 | 128×128、内容高 111–112、**脚底 y=127**、顶 16–17 | 16 / 127 / 112 |
| 细节密度 | 对同角色体块 128 的色块数比 ≥3×、\|ΔL\| ≥1.5× | 5.0× / 2.0× |
| 与已过帧同规格 | 与 `hero-galvan` / `hero-violet` 逐项一致 | 一致 |

同批交付时还要看：十帧（含走、技能）脚底在同一行、身高差 ≤1px。

## 8. 换角色要改什么

冻结脚本里写死了卡珊德拉的路径，换角色只改这三处，逻辑不动：

| 文件 | 改什么 |
|---|---|
| `tools/comfy-lan/queue-cassandra-stamp.mjs` | `OUT`（输出目录）；提示词按新角色 §1.2 形锁定重写 |
| `tools/comfy-lan/queue-cassandra-skill.mjs` | `REF`（新印戳）、`OUT` |
| `tools/scheme-c/box-stamp.mjs` | **不用改**（纯函数：输入图 + 输出路径 + `--fill`） |

提示词不能照抄：六段结构照搬，但发/衣/靴/配饰/比例每一句都要换成本角色形锁的原文。

## 9. 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-21 | 建条。卡珊德拉 128 十帧一次过；主线定 t2i，立绘+edit 退对照 |
| 2026-10-21 | 提示词加「丝袜透肉」句，基线 seed 106 → 109；记录 seed 108 反例 |

---

## 附：目录内容

```
b-stamp-t2i-128/
  README.md                 本卡
  workflow.api.json         Comfy API 图（seed 2026102109 冻结）
  workflow.slots.json       槽位：每个节点干什么、吃哪个权重
  prompt.txt                验证时的提示词原文（positive + negative）
  scripts/queue-stamp.mjs   排队脚本冻结副本（生产跑 tools/comfy-lan/ 的现行版）
  scripts/box-stamp.mjs     入盒脚本冻结副本（生产跑 tools/scheme-c/ 的现行版）
  evidence/                 三张对照卡
```
