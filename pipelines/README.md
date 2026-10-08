# pipelines · 已验证的美术工作流库

> 建库：2026-09-12 · 维护：编码机助理 · 裁定：主理人
> 只放**主理人说过「过」或「大部分过」**的工作流。候选、试验、废稿仍在 `tools/comfy-lan/workflows/`（143 条，不清理）与 `_park/`。这里是从那堆里**晋升**出来的冻结版，供回溯、复用、修改。

---

## 0. 怎么用这个库

| 想做什么 | 进哪个目录 | 状态 |
|---|---|---|
| 确认 GPU 机通不通 | [`lan-smoke/`](lan-smoke/README.md) | 已过 |
| 新角色：从一张过关全身图派生卡 / 剪影 / 色键 | [`a-derive-single-source/`](a-derive-single-source/README.md) | 已过（Vf1） |
| 新角色：立绘 → 带眼印戳 → 近邻 128 idle | [`b-stamp-nearest-128/`](b-stamp-nearest-128/README.md) | 已过（守誓 idle · Vf1 B-lo，作者当时是 Krea i2i）。**新印戳扩散作者 = Qwen-Image-2.1**（条未晋升） |
| 已有 idle 印戳 → 技能 / 静态姿 | [`c-pose-krea2-identity-edit/`](c-pose-krea2-identity-edit/README.md) | 大部分过（E1，留档）。**新图片编辑 = Qwen-Image-2.1** |
| 已有 idle 印戳 → 走循环六帧 128 | [`c-walk-wan-animate2/`](c-walk-wan-animate2/README.md) | 已过（E2：守誓 walk 现网）。权重不在盘，新走先确认 |
| 已设计角色 → 复杂场景少枪融景 | [`scene-closed-source-few-shot/`](scene-closed-source-few-shot/README.md) | 已过（E5：tombstone / pew；Krea 路 A/B 退对照） |
| 过关竖首帧 → 视频段 + 段间 | [`video-h3-firstframe-chain/`](video-h3-firstframe-chain/README.md) | 部分过（E6：本机日常 I2V 0.4MP ~5s）。效果不好或需求复杂：反馈主理人调线上满血 H3 |
| 二次元立绘风格帧（WAI i2i） | [`portrait-wai-h23-style-frame/`](portrait-wai-h23-style-frame/README.md) | 已过（H23）留档。**二次元新图作者 = Krea 2**；WAI 备用或风格化 |

生产顺序不变：**A 入库 → B 降阶 idle → C 动作（静姿 / 走）→ TA 入现网**。上一环没过，不开下一环。

```
图1（过关全身）─ A ─▶ 卡 / 剪影 / 色键 / 零件表
      │
      └─ B ─▶ 带眼印戳（Krea i2i 低 denoise）─▶ 近邻 128 idle ──▶ 主理人过
                        │
                        ├─ C 静姿 ─▶ Identity Edit（满降噪 · 画面向指令）─▶ 印戳 ─▶ 近邻 128
                        └─ C 走   ─▶ Wan Animate 2（参考 = 印戳 · 姿 = 驱动视频）─▶ 挑六帧 ─▶ 去底 ─▶ 近邻 128
                                                                                        │
                                                            TA：process / pack / 门禁 ◀──┘（主理人过后才写 frames/）
```

上图是已过条的做法。**2026-09-23 起，新印戳和新图片编辑的扩散作者改为 Qwen-Image-2.1；新二次元改为 Krea 2。** 图里的 Krea i2i / Identity Edit / Wan 不删，新枪不默认再走。Wan 权重不在盘。

每个目录固定结构：

```
<pipeline>/
  README.md                 卡：状态 · 证据 · 输入输出 · 引擎权重 · 参数 · 命令 · 后处理 · 验收 · 已知限制 · 变更记录
  workflow.api.json         Comfy API 格式（run-job / queue 脚本吃的那份）· 验证当日冻结
  workflow.slots.json       槽位（节点路径）
  workflow.ui.json          （若有）Comfy 画布格式，拖进网页即可改
  prompt*.txt               验证时的提示词原文
  scripts/                  排队 / 后处理脚本冻结版（含绝对路径，回溯用；生产仍跑 tools/ 与 _inspect/ 的现行版）
  evidence/                 1–3 张对照卡 + 摘要 md；大图与全量过目只链接不复制
```

---

## 1. 晋升与降级规则

**晋升进库要同时满足：**

1. 主理人在过目记录里写了「过」或「大部分过」，并注明哪一枪；
2. 有冻结的 API JSON + 槽位 + 提示词（不是「网页里能跑」）；
3. 有一张对照卡能一眼看出过的是什么；
4. README 写清「适用 / 不适用 / 已知限制」，不写「万能」。

**改动规则：** 库内 `workflow.api.json` 不就地改。要改就复制到 `tools/comfy-lan/workflows/` 打新名，验证过了再以新版本回库，README 变更记录加一行。

**降级：** 被更稳的条替代时不删，README 状态改「退对照」，索引表移到 §3。

---

## 2. 与其它目录的关系

| 目录 | 是什么 | 和本库 |
|---|---|---|
| `tools/comfy-lan/` | 局域网 Comfy 客户端、探活、排队脚本、`incoming/` 握手 | 生产运行在那边；本库的 `scripts/` 是冻结副本 |
| `tools/comfy-lan/workflows/` | 全部 API / 槽 / 提示词，含候选与废 | 本库只收晋升条；不回头清理那边 |
| `tools/asset-pipeline/` | TA 管线：抠底 · 族共享缩放 · 门禁 · 图集 | C 轨产出过关后走它入现网；本库不重复 |
| `characters/<id>/` | 现行源、锁、过关帧源、新过目 | 本库 `evidence/` 只放缩略与摘要；全量看角色目录 |
| `assets/ui-menu/preview/locked/review-h23-wave*` | 历史过目波次（不搬） | 回溯用 |
| `design/art-bible/` | 条文、成法、实验卡、账本 | 本库 README 引用条文编号，不复述条文 |
| `.cursor/rules/combat-64-workflow.mdc` | 助理红线 | 本库不改红线；红线改了要回来对齐 README |

---

## 3. 退对照（历史有效、现已被替代）

| 条 | 曾经过什么 | 被谁替代 | 留档处 |
|---|---|---|---|
| GenerateImage 单人六相位条 | 艾德蒙 walk V4（64） | `c-walk-wan-animate2` | `combat-64-workflow-v1.md` §10 |
| 卡珊德拉色键语言直切 | C 全套 64 | 不再适用（新帧 128） | `combat-64-workflow-v1.md` §0 |
| Krea i2i 低 denoise 换姿 | 从未过 | `c-pose-krea2-identity-edit` | `identity-validate-vf1-plan-v1.md` §8–§10 |

---

## 4. 引擎与权重（2026-09-23 期望 · GPU 机 HodikiX · RTX 4070 Laptop 8GB · Comfy 0.37.0）

| 用途 | 引擎 | 权重（`D:\ComfyUI\models\`，2026-09-23 API 核对） | 用在 |
|---|---|---|---|
| 图片编辑 / 非二次元 | Qwen-Image-2.1 INT8 | `diffusion_models/qwen_image_2.1_int8_convrot.safetensors` · `text_encoders/qwen3vl_8b_w4a8.safetensors`（type=`qwen_image`）· `vae/qwen_image_2.1_vae_bf16.safetensors` | 新编辑、新印戳、透明图。参考图 `QWEN21-*.json`。条未晋升 |
| 二次元 | Krea 2 Turbo INT8 | `diffusion_models/krea2_turbo_int8_convrot.safetensors` · `text_encoders/qwen3vl_4b_fp8_scaled.safetensors`（type=`krea2`）· `vae/qwen_image_vae.safetensors` | 新二次元风格。日常 `KREA2-Turbo-基础.json`。无 alpha |
| 备用 / 风格化 | WAI Illustrious SDXL v170 | `checkpoints/waiIllustriousSDXL_v170.safetensors` | 点名才用。H23 配方留档 |
| 视频 | MiniMax H3 FL2VA Q3 GGUF | `unet_gguf/MiniMax-H3-FL2VA-Q3_K_M.gguf` · CLIP `clip_gguf/qwen3vl-32B-MiniMax-H3-Q2_K.gguf`（CPU）· `vae/minimax_h3_video_vae_fp16.safetensors` · turbo 8-step LoRA | 本机短片，分辨率受限。日常 I2V 0.4MP ~5s |
| 已过留档 | Krea Identity Edit · Wan Animate 2 | Identity Edit LoRA 仍在 `loras/krea2_identity_edit_v1_2_r128.safetensors`。Wan 权重不在盘 | 不默认 Queue |

铁律：换引擎先 `POST /free`；Qwen / Krea / WAI / H3 不同 Queue；输出只进 `_park/`；主理人「过」之前不写 `assets/frames/`。本机 H3 效果不好，或要更高、更长、参考视频、宣传级：停，反馈主理人调线上满血 H3。助理不代调官方 API。

许可（详见 `design/art-bible/engine-license-check-v1.md`）：WAI = Fair AI Public License 1.0-SD（生成物可商用，不分发权重即无义务）· Krea 2 与 Identity Edit = Krea 2 Community License（公司年收入 <100 万美元；人工审核；依法 / 平台披露 AI 生成）· Wan = Apache 2.0 · MiniMax H3 本机 = MiniMax H3 Community License（适用地不含美 / 欧 / 英 / 韩；年收入 >2000 万美元须另申请；商业界面须标 MiniMax H3）· 配件多为 Apache / MIT。**Qwen-Image-2.1 许可尚未核**，进 `assets/frames/` 前补一节。**盘上 `4x-UltraSharp.pth` 为 CC BY-NC-SA，不得进商用产线**（现未引用）。

---

## 5. 新增条目

复制 [`_template/README.md`](_template/README.md)，按 §1 四条填齐再提交。目录名：`<轨>-<动作>-<引擎>`，小写连字符。
