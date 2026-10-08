# 局域网 Comfy · 环境检查与恢复

> 版本：v1.0 · 日期：2026-09-08 · 状态：**连接环境已过**  
> 给谁：编码机 Agent、GPU 机 Agent、主理人回溯  
> 配对：`call-reference.md`（怎么调用）  
> 原则：先本机，再对端，再防火墙，最后才动模型/节点。不要全网段扫端口。

---

## 0. 健康基线（2026-09-08 已核实）

| 项 | 基线 |
|---|---|
| 编码机 | `Hodiki` · `192.168.101.82/24` · MAC `7C-21-4A-DD-A9-EB` · WLAN · 类别 **Public** |
| GPU 机 | `HodikiX` · `192.168.101.200/24` · Comfy `D:\ComfyUI` · 0.34.0 |
| GPU 另口 | `以太网 3` `10.50.24.114/24` — **不是**握手地址 |
| 网关 | `192.168.101.1`（编码机已 ping 通，约 1ms） |
| URL | `http://192.168.101.200:8188` |
| 监听 | `0.0.0.0:8188`（启动参数含 `--listen`） |
| 防火墙 | 规则名 `ComfyUI LAN Hodiki only`，只放行 `192.168.101.82` → TCP 8188 |
| 节点 | `ComfyUI_IPAdapter_plus`、`comfyui_controlnet_aux` 已在 |
| 显卡 | RTX 4070 Laptop · 8 GB · 启动带 `--lowvram` |
| 握手 | `tools/comfy-lan/incoming/handshake.json` |
| 通路图 | `_park/comfy-lan/2026-09-07T17-26-35-008Z/comfy_lan_smoke_witcher_00001_.png` |

已知无害现象：

- GPU → 编码机 **ICMP ping 超时**，但 ARP 能解析到 `7C-21-4A-DD-A9-EB`。Public 网常挡 ICMP。**不要**为此改防火墙「全放行」。
- 编码机 PATH 没有 `node` / `git`。客户端用 Workbuddy `C:\Users\zhy\.workbuddy\binaries\node\versions\22.22.2-2\node.exe`。
- 编码机 `python` 是 Windows Store 空壳。不要用它写客户端。
- 邻居表里 `.200` 显示 `Stale` 也可以 TCP 通。以 `/system_stats` 为准。

---

## 1. 日常检查（编码机，约 30 秒）

```powershell
cd d:\code\vampire-survivors-like\tools\comfy-lan
.\check-env.ps1
.\ping-comfy.ps1
.\run-job.ps1 ping
```

| 出口 | 含义 |
|---|---|
| `check-env` 打印 `ipv4 WLAN 192.168.101.82/24` | 本机身份没漂 |
| `ping-comfy` `status 200` 且 `allow 192.168.101.82 match` | 握手仍对准这台机 |
| `run-job ping` 里 IP-Adapter / OpenPose 各类 = true | 节点还在 |

快照（均不入库，可覆盖）：

- `incoming/client-env.json` — 本机
- `incoming/last-ping.json` — 对端
- `incoming/last-job.json` — 最近一次排队

通路仍怀疑时，重跑 `call-reference.md` §6 冒烟。成功即环境未坏。

---

## 2. 故障表

按出现顺序往下做，不要跳着重装。

### A. 没有 `incoming/handshake.json`

- 现象：`Missing incoming\handshake.json`
- 修：`.\pull-gpu-docs.ps1`，或 `GET /userdata/comfy-lan-handshake.json`。不要请求 `/docs`（前端说明书，403）。JSON 生成失败时，按 `handshake.example.json` 手填，schema 必须是 `comfy-lan-handshake/v1`。

### B. `Unreachable http://192.168.101.200:8188/system_stats`

在编码机看完 `.\check-env.ps1` 的 `ipv4` 再动 GPU。

1. **本机 IP 变了**（不再是 `.82`）→ 走 §4。
2. **GPU 没开机 / Comfy 没开** → 在 HodikiX 开 Comfy，确认启动参数仍有 `--listen`，本机浏览器先开 `http://127.0.0.1:8188`。
3. **只听了 127.0.0.1** → 启动日志若只有 localhost，补 `--listen`（或 `--listen 0.0.0.0`）后重启。便携/自定义 bat 在 `main.py` 后面加。当前已知 argv 含 `--listen` `0.0.0.0` `--port` `8188`。
4. **防火墙丢了或 RemoteAddress 过期** → §3 重建规则。不要用「专用网络任意」或给 `python.exe` 全放行。
5. **GPU 的 WLAN IP 变了**（不再是 `.200`）→ 在 GPU 上看 `ipconfig`，改握手 `gpu.lan_ip` / `gpu.url`，建议路由器给 `.200` 做 DHCP 预留。
6. **走错网卡** → 不要改打 `10.50.24.114`。握手只认 `192.168.101.200`。
7. **Wi-Fi 休眠/隔离** → 两台机连同一 SSID（网关 `192.168.101.1`）。访客网络、AP 隔离会让 ARP 在、TCP 死。

### C. 网页能开，脚本 200，但 `queue` 失败

- 读报错正文。常见：节点 ID 对不上、`ckpt_name` 带了 `~6.6 GB` 这种握手注释、SaveImage 被删。
- `queue` 成功但 `saved 0`：工作流没有 `SaveImage`（或只走了 websocket 预览节点）。必须有 SaveImage，客户端靠 `/history` + `/view`。
- 排队很久后超时：4070 Laptop + `--lowvram`，SDXL 冷启动可能远长于 19s。先把 `-TimeoutSec` 加到 600，再看 GPU 机 Comfy 是否 OOM。不要为此换模型 unless 主理人点名。

### D. `run-job.ps1` 说找不到 node

- 预期路径：`C:\Users\zhy\.workbuddy\binaries\node\versions\22.22.2-2\node.exe`
- 修：更新 `lib/find-node.ps1` 的 pin，或把新的 `node.exe` 放进 PATH。不要装系统 Python 顶替。
- `.ps1` 解析失败（意外的 `}`）：文件须是 ASCII 或 UTF-8 **带 BOM**。不要用无 BOM 的中文注释（Windows PowerShell 5.1 会读乱）。现有脚本已按 ASCII 写。

### E. 节点探活变成 false

- `IPAdapter*` / `OpenposePreprocessor` 变 false：GPU 机自定义节点掉了或 Comfy 换了装。到 `D:\ComfyUI\custom_nodes` 核对 `ComfyUI_IPAdapter_plus`、`comfyui_controlnet_aux`，重启 Comfy，再 `.\run-job.ps1 ping`。
- **未询问主理人不要下载新模型或新节点。**

### F. 图回来了但「人散 / 风格跳」

- 这不是连接故障。环境仍算好。按 `combat-64-workflow-v1.md` §10 废条重抽，不要重装 Comfy。
- 禁止用量化、收腿、硬切冒充修好。

### G. 编码机浏览器能开 UI，Agent 沙箱连不上

- 用 `.\ping-comfy.ps1` / `.\run-job.ps1`（它们走本机网络）。不要在沙箱受限的 Shell 里裸 `curl 192.168.x` 然后宣布环境坏了。

---

## 3. GPU 机恢复（HodikiX）

只在编码机 §1 失败、且排除 IP 漂移之后做。可把本节交给 GPU Cursor Agent。

### 3.1 确认 Comfy 在听局域网

1. 进程在、UI 本机 `http://127.0.0.1:8188` 能开。
2. `GET http://127.0.0.1:8188/system_stats` 和 `GET http://192.168.101.200:8188/system_stats` 都是 200。
3. 启动参数必须含 `--listen`（当前完整相关参数：`--lowvram --reserve-vram 0.8 --vram-headroom 0.4 --disable-api-nodes --enable-manager --listen 0.0.0.0 --port 8188`）。
4. **不要** ngrok、不要把 8188 映射到 WAN。

### 3.2 重建防火墙（管理员 PowerShell）

先看有没有旧规则：

```powershell
Get-NetFirewallRule -DisplayName "ComfyUI LAN Hodiki only"
```

没有或 RemoteAddress 不是 `192.168.101.82` 时：

```powershell
Get-NetFirewallRule -DisplayName "ComfyUI LAN Hodiki only" -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName "ComfyUI LAN Hodiki only" -Direction Inbound -Protocol TCP -LocalPort 8188 -RemoteAddress 192.168.101.82 -Action Allow -Profile Any
```

不要改成任意远程地址。不要另建「Python 入站全放行」。

### 3.3 握手刷新

改了 IP / 节点 / 模型之后，重写 `D:\ComfyUI\comfy-lan-handshake.json`，再覆盖编码机 `tools/comfy-lan/incoming/handshake.json`。字段合同见 `handshake.example.json`。`allow.client_ip` 必须等于编码机当时的 IPv4。

---

## 4. 编码机 IP 漂了

`check-env.ps1` 的 `ipv4` 不再是 `192.168.101.82` 时：

1. 优先：路由器给 Hodiki `.82`、HodikiX `.200` 做 DHCP 预留，然后两台机续租/重连，回到基线。
2. 不能预留：用**新的编码机 IP**重建 GPU 防火墙（§3.2 把 `RemoteAddress` 换成新 IP），并改握手 `allow.client_ip`。
3. 再跑 §1。不要同时改 GPU 的 LAN IP，除非它也漂了。

---

## 5. 不要当恢复手段的事

- 装社区 Comfy MCP / 换一套客户端「试试看」。
- 全网段 nmap / 扫 8188。
- 把 Comfy 输出目录做成 SMB 共享当主路径。
- 为了通路去下新的大模型。
- 改已过 `assets/frames/player*` 或其它已过帧。
- 把 ICMP ping 失败当成连接失败。
- 把 Windows 网络类别改成 Private 当唯一修复（不稳，且不是根因）。

---

## 6. 回溯档案

| 文件 | 什么时候看 |
|---|---|
| `incoming/handshake.json` | 对端自称是谁 |
| `incoming/client-env.json` | 本机当时网卡 / IP / Node |
| `incoming/last-ping.json` | 最近一次探活（含 `system_stats`、节点表） |
| `incoming/last-job.json` | 最近一次排队 |
| `playbook-gpu-agent.md` | 第一次把 GPU 机从零拉起来（历史工单） |
| `playbook-client.md` | 握手前的编码机预备（历史工单） |
| `call-reference.md` | 现行怎么调用 |
| 本文 | 现行怎么修 |

`incoming/` 下除样张外的 JSON **不入库**（见仓根 `.gitignore`）。握手若丢失，用本文 §0 + `handshake.example.json` 重填，不必等 GPU 机再生成一次坏 JSON。
