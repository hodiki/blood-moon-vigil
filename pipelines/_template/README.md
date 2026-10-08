# <轨>-<动作>-<引擎>

> 状态：**已过 / 大部分过 / 退对照** · 过关日：YYYY-MM-DD · 主理人裁定原文一句
> 证据：`evidence/…`（对照卡）· 全量：`assets/ui-menu/preview/locked/review-…/`
> 条文：`design/art-bible/…` §…（只引编号）· 实验卡 / 账本：…

## 1. 适用 / 不适用

| 适用 | 不适用 |
|---|---|
| | |

## 2. 输入 → 输出

| 输入 | 规格 | 来源 |
|---|---|---|
| | | |

| 输出 | 规格 | 落盘 |
|---|---|---|
| | | `_park/…` |

## 3. 引擎 · 权重 · 节点

| 项 | 值 |
|---|---|
| 底座 | |
| LoRA / 节点包 | |
| 显存 / 耗时 | |

## 4. 参数（验证值）

| 参数 | 值 | 为什么 |
|---|---|---|
| | | |

## 5. 命令

```powershell
cd d:\code\vampire-survivors-like\tools\comfy-lan
Invoke-RestMethod -Method POST -Uri http://192.168.101.200:8188/free -ContentType application/json -Body '{"unload_models":true,"free_memory":true}'
.\run-job.ps1 queue -Workflow <api.json> -Slots <slots.json> -Ref <ref.png> -TimeoutSec 600
```

## 6. 后处理

## 7. 验收（过目板 · 判据）

## 8. 已知限制

## 9. 文件

| 文件 | 说明 |
|---|---|
| `workflow.api.json` | |
| `workflow.slots.json` | |
| `prompt.txt` | |
| `scripts/…` | 冻结副本，来源 `…` |
| `evidence/…` | |

## 10. 变更记录

| 日 | 变了什么 | 谁点 |
|---|---|---|
| | 建条 | |
