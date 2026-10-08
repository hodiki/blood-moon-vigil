# lan-smoke · 局域网 Comfy 通路冒烟

> 状态：**已过** · 2026-09-08 01:26 +08 · `prompt_id f2a782f1-172d-41f2-a148-fc9758b76f24`
> 条文：`tools/comfy-lan/call-reference.md` §6 冒烟基线 · `check-and-recover.md`
> 用途：任何一天开工前先跑这条。200 + 一张 PNG 落 `_park/` = 通路正常。不是产线。

## 1. 适用 / 不适用

| 适用 | 不适用 |
|---|---|
| 探活、换机、改防火墙、Comfy 升级后回归 | 当任何角色的参考 |

## 2. 输入 → 输出

无输入图。输出一张 832×1216 PNG → `assets/ui-menu/preview/locked/combat-64/_park/comfy-lan/<ISO>/`。

## 3. 引擎

WAI Illustrious SDXL v170 · `dpmpp_2m` + `karras` · 24 步 · CFG 6 · seed 20260908。约 19s（模型已在显存时）。

## 4. 命令

```powershell
cd d:\code\vampire-survivors-like\tools\comfy-lan
.\run-job.ps1 ping
.\run-job.ps1 queue -Workflow ..\..\pipelines\lan-smoke\workflow.api.json -Slots ..\..\pipelines\lan-smoke\workflow.slots.json -TimeoutSec 360
```

`ping` 同时探节点：`Krea2EditModelPatch` / `Krea2EditGroundedEncode` / `WanAnimate2ToVideo` 等，见 `run-job.mjs` `NODE_PROBES`。

## 5. 验收

`GET /system_stats` 200；`_park/` 出现 PNG；`incoming/last-job.json` 更新。图不必像素级相同。

## 6. 文件

| 文件 | 说明 |
|---|---|
| `workflow.api.json` | = `tools/comfy-lan/workflows/smoke-female-witcher.json` |
| `workflow.slots.json` | `seed` / `positive` / `negative` / `ckpt` |

## 7. 变更记录

| 日 | 变了什么 |
|---|---|
| 2026-09-12 | 建条（冻结 09-08 版） |
