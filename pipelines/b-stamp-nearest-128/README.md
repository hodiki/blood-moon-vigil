# b-stamp-nearest-128 · B 轨：带眼印戳 → 近邻入盒 128（战斗 idle）

> 状态：**已过 ×2** · 守誓 idle（2026-09-10，from-a，现网 `hero-violet.png`）· Vf1 idle（2026-09-10，B-lo，`characters/violet-fallen/combat/idle/12-idle-blo-passed-128.png`）
> **2026-09-23：** 这两例的扩散作者是 Krea i2i，不重做。新印戳的扩散作者改为 Qwen-Image-2.1（条未晋升，第一枪须点名）。
> 证据：`evidence/11-from-a-stamp-and-128.png` · `evidence/08-blo-stamp-and-128.png`
> 条文：`combat-64-pixel-workflow-v1.md` 成法表 · `combat-identity-chengfa-v1.md` §3 · 停手 `combat-identity-drift-v1.md`
> 一句话：**作者是「带眼硬色块印戳 + 近邻入盒」，不是扩散模型直接画 2px 眼。** 印戳只当身份底，过的是 128。

## 1. 适用 / 不适用

| 适用 | 不适用 |
|---|---|
| 新角色第一张战斗 idle（128；守誓者 192） | 走 / 技能（去 C 轨） |
| 底 = A 轨图1′ 落到夜空底（`#00040C`） | 底 = 双人成片、无脸色键、绘画大图硬切 |
| 两枪封顶：B-lo / B-mid 各一 | 第三枪换种子；128 再压回 64 |

已知失败：守誓者 192（wave15/16）——印戳把胸甲盖成罩袍、裙甲收成布裙，四枪未讨回零件。B 轨换件问题不是 denoise 能解，见 §7。

## 2. 输入 → 输出

| 输入 | 规格 | 来源 |
|---|---|---|
| 夜空底参考 | 图1′ 单人，落到 `#00040C`，512×1024 | `_inspect/vf1-void-ref.mjs` / `ok-void-ref.mjs` |

| 输出 | 规格 | 落盘 |
|---|---|---|
| 印戳 | 512×1024 绘画平涂，带眼 | `_park/comfy-lan/<ISO>/` |
| 128 idle | 128×128 RGBA，人站满高，头约 16–20px | `review-<角色>/` → 过了才 `assets/raw/` + `process.mjs --solo` |
| 对照卡 | 印戳 · 128 原大 · 128 ×4 | `review-<角色>/` |

## 3. 引擎 · 权重

Krea 2 Turbo INT8 · `qwen3vl_4b_fp8_scaled`（krea2 · cpu）· `qwen_image_vae`。Enhancer 节点保留但 `enabled:false`。与 WAI / Wan 分 Queue。

## 4. 参数（两例验证值）

| 参数 | Vf1 B-lo（过） | 守誓 from-a（过） | Vf1 B-mid（废：红鞋变黑） |
|---|---|---|---|
| 工作流 | `krea2-stamp-i2i-vf1-blo.api.json` | `krea2-stamp-i2i-vo-from-a.api.json` | 同 B-lo |
| denoise | **0.48** | 0.58（JSON 现值；底已是 wave13 A 印戳） | 0.58 |
| 采样 | euler · simple · 8 步 · CFG 1 | 同 | 同 |
| seed | 2026091001 | 2026091602 | 2026091002 |
| 提示词 | `prompt-vf1-blo.txt` | `prompt-vo-from-a.txt` | — |

经验：底若已是绘画印戳，denoise 可到 0.58；底是立绘则 ≤0.5，再高开始换件（鞋、领）。守誓 wave14 记「0.52 已洗掉烛」——小物件对 denoise 最敏感。

## 5. 命令

```powershell
cd d:\code\vampire-survivors-like\tools\comfy-lan
Invoke-RestMethod -Method POST -Uri http://192.168.101.200:8188/free -ContentType application/json -Body '{"unload_models":true,"free_memory":true}'
.\run-job.ps1 queue -Workflow ..\..\pipelines\b-stamp-nearest-128\krea2-stamp-i2i-vf1-blo.api.json `
  -Slots ..\..\pipelines\b-stamp-nearest-128\workflow.slots.json `
  -Ref <void-ref.png> -TimeoutSec 300
```

换角色：改 `positive` 槽为该角色的印戳词（结构照 `prompt-*.txt`：一句产品定义 · MUST KEEP 零件 · 脸必须有眼 · 姿势 · 色面积 · 夜空底 · 禁项）。

## 6. 后处理（入盒）

| 脚本 | 用途 |
|---|---|
| `scripts/vf1-box-b.mjs` | 通用：抠印戳主体（夜空 / 浅棚 / 红 / 肤 / 藏青判定）→ 近邻进 128 → 石板 ×4 对照卡。`node vf1-box-b.mjs <label> <stamp.png> <rawName> <boxName> <cardName>` |
| `scripts/vo-idle-o3d2-box.mjs` | 守誓专用：D2 面积框 + 印戳框 + 板。`C64_BOX=128` |

入盒口径：紧裁 → 近邻 contain 到 `128 − 2×7` 高 → 脚底贴 `y=127` → 体内洞先封（算阴影）→ 石板 `#2A3444` ×4。第一刀曾把夜空光晕当成人（128 缩成点），用「种子生长抠人」重切即可，不是新枪。

## 7. 验收

| # | 问 |
|---|---|
| 1 | 零件表在印戳上 ≥7/8 可指，换件 = 0（丢蕾丝网可以；红鞋变黑 = 换件） |
| 2 | 128 上眼能指、角 / 灯 / 烛能指；不是空白肤块 |
| 3 | 单人、非选人表、非三视图、非油画 |
| 4 | 无体内真洞；主体不是大面积近墨 |
| 5 | 两枪内；未写 `frames/` |

**B 轨换件（守誓者甲件）**：不再加 denoise 枪。候选修法是用 `c-pose-krea2-identity-edit` 的 Identity Edit 从立绘单裁 re-stage 成站姿印戳（参考在上下文里，零件更保得住）——未验证，需主理人点。

## 8. 已知限制

- 印戳步会换件，是 Krea 2 stock i2i 无稳参考的性质。
- 128 硬色块靠近邻缩小的「像素感」，不是真正的硬色块设计；密度由印戳决定。
- 只出 3/4 朝右一个朝向。

## 9. 文件

| 文件 | 说明 |
|---|---|
| `krea2-stamp-i2i-vf1-blo.api.json` | = `tools/comfy-lan/workflows/krea2-vf1-stamp-lo.json` |
| `krea2-stamp-i2i-vo-from-a.api.json` | = `krea2-vo-stamp-w14-from-a.json` |
| `workflow.slots.json` | `seed` / `positive` / `image_ref` |
| `prompt-vf1-blo.txt` · `prompt-vo-from-a.txt` | 两例印戳词 |
| `scripts/vf1-box-b.mjs` · `vo-idle-o3d2-box.mjs` | 冻结副本，来源 `_inspect/` |
| `evidence/08 · 11` | 两例对照卡 |

## 10. 变更记录

| 日 | 变了什么 |
|---|---|
| 2026-09-12 | 建条，收两例 |
