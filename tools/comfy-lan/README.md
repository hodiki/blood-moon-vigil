# 局域网 Comfy（comfy-lan）

连接环境 **已过**（2026-09-08）：Hodiki `192.168.101.82` → HodikiX `192.168.101.200:8188`，通路冒烟已出图。

| 先读 | 用途 |
|---|---|
| [call-reference.md](call-reference.md) | **现行调用参考**（排队、槽位、落盘、交给工作流 Agent） |
| [check-and-recover.md](check-and-recover.md) | **现行检查与恢复**（基线、故障表、防火墙、IP 漂移） |
| [gpu-env-next.md](gpu-env-next.md) | GPU 侧已完成第一、二步；第三步等点名 |
| [pull-gpu-docs.ps1](pull-gpu-docs.ps1) | 用 `/userdata` 拉 docs / 握手。不要请求 `/docs` |

开工前历史工单（已执行完，只回溯）：

| 文件 | 用途 |
|---|---|
| [playbook-gpu-agent.md](playbook-gpu-agent.md) | 第一次让 GPU 机准备连接 |
| [playbook-client.md](playbook-client.md) | 握手前的编码机预备 |
| [handshake.example.json](handshake.example.json) | 握手字段合同 |

```powershell
cd d:\code\vampire-survivors-like\tools\comfy-lan
.\check-env.ps1
.\ping-comfy.ps1
.\run-job.ps1 ping
```

出图：有 `--char <id>` 进 `characters/<id>/_park/<ISO>/`；无旗标仍进 `_park/comfy-lan/`。不写 `assets/frames/`。新过目夹进 `characters/<id>/review/<yyyymmdd-topic>/`。

引擎：二次元 **WAI**；非二次元 **Krea 2**（`KREA2-Turbo-基础.json`）。**走循环 = Wan Animate 2**（`wan-animate2-vo-walk.api.json`，E2 已过）。Klein 停用、未删盘。握手：`.\pull-gpu-docs.ps1` 或 `GET /userdata/comfy-lan-handshake.json`。WAI / Krea / Wan 分 Queue，换引擎先 `POST /free`。

**已验证工作流库：** [`pipelines/`](../../pipelines/README.md)（A 派生 · B 印戳→128 · C 静姿 Identity Edit · C 走 Wan Animate 2 · 立绘 WAI H23 · 冒烟）。`workflows/` 里 143 条是全量候选与留档；只有主理人「过」的才晋升进库，库内 JSON 为验证当日冻结版。
