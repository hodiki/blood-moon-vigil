# portrait-wai-h23-style-frame · 二次元立绘风格帧（WAI i2i）

> 状态：**已过（H23）** · 2026-09-08 · 主理人点选 `comfy_lan_style_c_hose2_00023_` 为风格帧 · 蓝本 `characters/cassandra/identity/source/h23.png`
> **画法归属（2026-09-23）：** H23 仍是已过风格蓝本。**二次元新图作者 = Krea 2。** WAI 只作备用或风格化，主理人点名才 Queue。本条是 H23 配方留档。WAI 许可已核：Fair AI Public License 1.0-SD，见 `engine-license-check-v1.md` §1。
> 条文：`style-frame-h23-lessons-v1.md`（配方与坑）· `pipeline-gpu-first-v1.md` · `character-art-bible-v1.md` §1
> 一句话：WAI Illustrious 全身 i2i，**改结构先旁路 IPA、denoise ≥0.75**，让提示词说得上话。

## 1. 适用 / 不适用

| 适用 | 不适用 |
|---|---|
| 二次元画法的立绘 / 风格帧；已有底图改衣、改姿 | 战斗帧作者（R19：不硬切绘画大图） |
| 低 denoise（0.3–0.45）给 Krea 出的构图上二次元质感——**未验证**，是 ②.2 裁定后的候选用法 | 锁脸：WAI 生态只有 IP-Adapter，E1 前已证不够 |

## 2. 输入 → 输出

| 输入 | 规格 |
|---|---|
| 底图 | H1 `comfy_lan_style_c_hose_00001_`（当时）；以后改用 H23 本身当底 |
| 提示词 | `workflow.api.json` 内正 / 负向（已按 H23 收过） |

输出 768×1344 PNG → `_park/comfy-lan/<ISO>/`。

## 3. 引擎 · 参数（配方）

| 项 | 值 |
|---|---|
| 底座 | `waiIllustriousSDXL_v170.safetensors` |
| 采样 | Euler a · 28 步 · CFG 6 · CLIP skip 2 |
| 尺寸 | 768×1344（i2i 缩放） |
| seed | 202609104 |
| IPA | PLUS 加载但 weight = 0（旁路） |
| denoise | **0.75** |
| 下装 / 靴 | 可选 `black pantyhose`；`matte black boots, stiletto, pointed toe` |

## 4. 命令

```powershell
cd d:\code\vampire-survivors-like\tools\comfy-lan
Invoke-RestMethod -Method POST -Uri http://192.168.101.200:8188/free -ContentType application/json -Body '{"unload_models":true,"free_memory":true}'
.\run-job.ps1 queue -Workflow ..\..\pipelines\portrait-wai-h23-style-frame\workflow.api.json `
  -Slots ..\..\pipelines\portrait-wai-h23-style-frame\workflow.slots.json -TimeoutSec 360
```

网页复原：`workflow.ui.json` 拖进 Comfy 画布。

## 5. 验收

主理人点选。外形听 lock-ce 左 + 色键 C 行；画法 = 本帧。不与旧 v2 平均。

## 6. 已知坑（来自 H23 经验）

- 全身 i2i + denoise 0.5 + IPA 0.78 = 提示词等于没写。
- WAI 里 `leather`+`stiletto` 与弱词 `matte`/`suede` 打不过漆皮靴先验。
- 半身女形传全身时身形易过度变方。
- API 排队不出现在网页画布；要复原用 `.ui.json`。

## 7. 文件

| 文件 | 说明 |
|---|---|
| `workflow.api.json` | = `tools/comfy-lan/workflows/style-frame-m1-hose2.json` |
| `workflow.slots.json` | 上图 / seed 槽 |
| `workflow.ui.json` | 画布版 |

蓝本图（600KB+）不复制，见 `characters/cassandra/identity/source/h23.png`。

## 8. 变更记录

| 日 | 变了什么 |
|---|---|
| 2026-09-12 | 建条；标注画法归属待定 |
