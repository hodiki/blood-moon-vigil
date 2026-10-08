# GPU 机方案 · 只准备连接环境

> **历史工单（已执行 · 2026-09-08）。** 现行查 [call-reference.md](call-reference.md) / [check-and-recover.md](check-and-recover.md)。HodikiX `192.168.101.200` 已听 `8188`，编码机已连上。

把 **§0 整段**（从「你是 GPU 机…」到「§0 结束」）复制到 GPU 机 Cursor Agent，作为第一条用户消息。  
Agent 做完后，唯一要交回编码机的文件是 `comfy-lan-handshake.json`。

编码机（会来连你）已经固定：

| 项 | 值 |
|---|---|
| 主机名 | `Hodiki` |
| IPv4 | `192.168.101.82/24` |
| MAC | `7C-21-4A-DD-A9-EB` |
| 网段 | `192.168.101.0/24` 网关 `192.168.101.1` |
| 角色 | 只出站访问你的 `8188`，不跑 Comfy |

---

## 0. 复制给 GPU 机 Cursor Agent

```text
你是 GPU 机上的 Cursor Agent。任务：准备局域网 ComfyUI 连接环境，让编码机 Hodiki（192.168.101.82，MAC 7C-21-4A-DD-A9-EB）能立刻调用。不要做游戏美术，不要改任何游戏仓库的 assets/frames/。

## 目标（按顺序，做完一项勾一项）

1. 查清本机：OS、主机名、本机局域网 IPv4（必须和 192.168.101.82 同一 /24）、默认网关、是否能 ping 通 192.168.101.82。
2. 找到已有 ComfyUI 安装（便携包 / git clone / 桌面快捷方式）。没装就停，列出你搜过的路径，等主理人装，不要擅自下几十 GB 模型。
3. 让 Comfy 监听局域网，而不是只有 127.0.0.1：
   - 通用：启动参数加 --listen（或 --listen 0.0.0.0），端口保持 8188。
   - Windows 便携包：改 run_nvidia_gpu.bat（或实际在用的 bat），在 main.py 后加 --listen。
   - 启动后本机访问 http://127.0.0.1:8188 和 http://<本机LAN_IP>:8188 都应能开 UI。
   - GET http://127.0.0.1:8188/system_stats 必须 200。
4. 防火墙只放行编码机，禁止对客网/公网裸开：
   - 不要 ngrok、不要端口映射到 WAN、不要 --listen 后不加限制。
   - Windows（管理员 PowerShell）：
     New-NetFirewallRule -DisplayName "ComfyUI LAN Hodiki only" -Direction Inbound -Protocol TCP -LocalPort 8188 -RemoteAddress 192.168.101.82 -Action Allow -Profile Any
   - Linux ufw：
     sudo ufw allow from 192.168.101.82 to any port 8188 proto tcp
     sudo ufw deny 8188   # 若需要先允许再拒绝其它；按发行版习惯，原则是只让 .82 进
   - 规则建好后重述：谁能连 8188。
5. 清点，不要偷偷下载：
   - 自定义节点：是否已有 ComfyUI_IPAdapter_plus、comfyui_controlnet_aux（OpenPose）。没有就记 false，询问主理人再装。
   - 模型目录里已有的 checkpoint / ipadapter / controlnet / clip_vision 文件名列表（只列名字和大致体积，不删不移）。
6. 本机冒烟（有任意一个 checkpoint 才做；没有就跳过并在 notes 说明）：
   - 网页里用最小 txt2img 出一张任意图，确认 Queue → 出图。
   - 不要为了冒烟去装新模型。
7. 写握手文件 comfy-lan-handshake.json（放到你方便交给主理人的位置，例如 GPU 机桌面）。schema 必须是 comfy-lan-handshake/v1，字段如下，按实填，禁止留 REPLACE：

{
  "schema": "comfy-lan-handshake/v1",
  "generated_at": "<ISO 8601 带时区>",
  "gpu": {
    "hostname": "<本机主机名>",
    "os": "windows 或 linux",
    "lan_ip": "<本机 192.168.101.x>",
    "port": 8188,
    "url": "http://<本机LAN_IP>:8188",
    "listen": "0.0.0.0"
  },
  "allow": {
    "client_hostname": "Hodiki",
    "client_ip": "192.168.101.82",
    "client_mac": "7C-21-4A-DD-A9-EB"
  },
  "firewall": {
    "kind": "windows 或 ufw 或 firewalld 或 other",
    "rule": "allow tcp/8188 from 192.168.101.82 only",
    "verified_local": true
  },
  "comfy": {
    "version": "<能读到就填，读不到留空>",
    "system_stats_ok": true,
    "devices": ["<system_stats 里的 GPU 名>"],
    "custom_nodes": {
      "ipadapter_plus": false,
      "controlnet_aux": false
    }
  },
  "models": {
    "checkpoints": [],
    "ipadapter": [],
    "controlnet": [],
    "clip_vision": []
  },
  "workflows": {
    "smoke": false,
    "walk_strip_api": false,
    "skill_strip_api": false
  },
  "notes": "<ping Hodiki 结果、未装的节点、未做的冒烟>"
}

8. 连接环境做到握手文件为止。不要现在设计像素条工作流，不要导出 walk/skill API JSON（那是握手被编码机 ping 通之后的下一步）。
9. 完成后用简短中文回复：本机 IP、Comfy 是否在听 0.0.0.0:8188、防火墙规则名、握手文件路径、以及编码机接下来应打开的 URL。把握手 JSON 全文放在回复里，方便主理人复制。

## 禁止

- 把 8188 暴露到公网或用隧道软件。
- 未询问就下载大模型或自定义节点。
- 修改、删除已有模型文件。
- 声称「已经给编码机连上」。你只能证明本机 /system_stats 200；对端探测由编码机做。
```

§0 结束。

---

## 1. 本机主理人在 GPU 机上还要看的

- 启动后 UI 地址应类似 `http://0.0.0.0:8188` 或同时列出本机 LAN IP，而不是只有 `127.0.0.1`。
- 路由器给 GPU 机做 DHCP 预留，避免 IP 变了握手作废。
- 握手 JSON 拷到编码机：

`d:\code\vampire-survivors-like\tools\comfy-lan\incoming\handshake.json`

- `walk_strip_api` / `skill_strip_api` 保持 `false` 即可。编码机 ping 通后再在网页里冻工作流。
