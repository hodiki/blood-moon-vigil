# 编码机方案 · GPU 一就绪就开工

> **历史工单（已执行 · 2026-09-08）。** 握手已写入 `incoming/handshake.json`，通路冒烟已过。现行查 [call-reference.md](call-reference.md) / [check-and-recover.md](check-and-recover.md)。

机器：`Hodiki` · `192.168.101.82` · WLAN · 网关 `192.168.101.1`（已 ping 通，1ms）。  
对端：HodikiX `http://192.168.101.200:8188`。

---

## 0. 2026-09-07 已查（GPU 未上线）

| 项 | 结果 | 含义 |
|---|---|---|
| 网段 | `192.168.101.0/24`，本机 `.82` | GPU 必须也是 `192.168.101.x` |
| 网卡 | WLAN `7C-21-4A-DD-A9-EB`，866 Mbps | Wi-Fi；大图上传可能抖，脚本已按可重试写 |
| Windows 网络类别 | **Public** | 出站一般仍可；不要指望「改 Private」当唯一手段 |
| 邻居 | `.200` Reachable；`.16/.131/.134` Stale | `.200:8188/80/443/11434` 均不通，**还没有可用 Comfy** |
| 本机 8188 | 无监听 | Comfy 不在这台机 |
| `node`/`npm`/`git` PATH | 空 | 游戏仓本身有 `node_modules`；Agent 默认 PATH 没有 Node |
| 可用 Node | Workbuddy `22.22.2` | 客户端用它，不新装 |
| `python` | Windows Store 空壳 | 不用 Python 客户端 |
| `curl` | 8.21.0 | 探测可用 |
| Cursor MCP | 用户级 / 工作区都没有 `mcp.json` | **先不要装社区 Comfy MCP** |
| 参考图 | `assets/frames/player.png`、`player-walk-a.png` 在 | 上传槽已指向这两张 |
| 落盘 | `_park/comfy-lan/` | 只进停放，不写现网帧 |

重跑检查：

```powershell
cd d:\code\vampire-survivors-like\tools\comfy-lan
.\check-env.ps1
```

会刷新 `incoming\client-env.json`（本机快照，不入库）。

---

## 1. 已就位、等握手就能用的东西

| 路径 | 作用 |
|---|---|
| `incoming\handshake.json` | 你把 GPU Agent 交回的 JSON **改名拷到这里** |
| `.\ping-comfy.ps1` | `GET /system_stats`，确认对端真的从 `.82` 可达 |
| `.\run-job.ps1 ping` | 同上 + 抽查 IP-Adapter / OpenPose 节点类名 |
| `.\run-job.ps1 queue ...` | 上传参考图、改槽、排队、图落到 `_park/comfy-lan/` |
| `workflows\` | 放下 GPU 稍后导出的 API JSON + slots |

没有握手文件时，ping / queue 会失败并写明缺什么。这是预期。

---

## 2. GPU 交回握手之后（当天就能做）

1. 保存为 `tools\comfy-lan\incoming\handshake.json`。
2. 本机执行：

```powershell
cd d:\code\vampire-survivors-like\tools\comfy-lan
.\check-env.ps1
.\ping-comfy.ps1
.\run-job.ps1 ping
```

3. 过关：`system_stats` 200，`gpu.url` 能开，本机 IP 仍是握手里的 `allow.client_ip`（变了就改防火墙再重握手）。
4. 浏览器再开一次 `gpu.url`，确认不是只在 GPU 本机能开。
5. 此时 **连接环境开工完成**。可以上图、排队。  
   **还不能**当 §10.2 备选 A 已开：walk/skill 冻结工作流要等 GPU 网页用已过 idle + `walk-a` 出一张过目条，再 `Save (API Format)`。

---

## 3. 冻结工作流到位之后（真正抽卡）

GPU 机导出后，放到：

```
tools/comfy-lan/workflows/walk-strip.json
tools/comfy-lan/workflows/walk-strip.slots.json
tools/comfy-lan/workflows/skill-strip.json
tools/comfy-lan/workflows/skill-strip.slots.json
```

`slots` 格式见 `workflows/slots.example.json`。然后：

```powershell
.\run-job.ps1 queue `
  -Workflow .\workflows\walk-strip.json `
  -Slots .\workflows\walk-strip.slots.json `
  -Idle ..\..\assets\frames\player.png `
  -WalkA ..\..\assets\frames\player-walk-a.png
```

图只进 `assets/ui-menu/preview/locked/combat-64/_park/comfy-lan/<时间戳>/`。  
过目板、GIF、64 对照仍按 `combat-64-workflow-v1.md` §10。主理人说「过」之前不准写 `assets/frames/`。

---

## 4. 不要做

- 装通用 Comfy MCP 当产线。那是又一个软参考 `GenerateImage`。
- 本机 PATH 没有 Node 就去装一套系统 Python / 再装一个 Node。用 Workbuddy 的 `node.exe` 即可。
- 全网段扫端口。只对握手里的 URL 探测。
- 把 Comfy 输出目录做成 SMB 共享当主路径。用 API 拉回 `_park/`。
- 改已过 idle / walk / skill，或把生成条硬切进现网。

---

## 5. 本机 IP 变了怎么办

WLAN + DHCP，`.82` 可能变。`check-env.ps1` 会打印当前 IPv4。若与握手 `allow.client_ip` 不同：

1. GPU 机防火墙改成新 IP（或先改 DHCP 预留再改回 `.82`）。
2. 更新 `handshake.json` 里的 `allow.client_ip`。
3. 再 `.\ping-comfy.ps1`。
