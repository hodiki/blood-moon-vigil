# GPU 机 · 生图环境下一轮（给 HodikiX Agent）

> 2026-09-08 工单（历史）· 编码机备忘已改 2026-09-09  
> 给谁：GPU 机 Cursor Agent（完善生图环境，**不做游戏过关裁定、不写游戏仓 `assets/frames/`**）  
> 编码机调用：`tools/comfy-lan/call-reference.md`

§0 是 2026-09-08 第一次完善环境时的复制稿，**不要当现行引擎表**。现行以握手 `/userdata/comfy-lan-handshake.json` 为准。

---

## 0. 复制给 GPU 机 Cursor Agent

```text
你是 GPU 机（HodikiX）上的 Cursor Agent。Comfy 已在 D:\ComfyUI，监听 0.0.0.0:8188，编码机 Hodiki 192.168.101.82 已能 /system_stats 200 并 queue 出图。

本轮只完善生图环境。不要改游戏仓库 assets/frames/。不要装社区 Comfy MCP。不要 ngrok。未询问主理人不要下载新的大模型（尤其不要先下 FLUX.2 Klein）。

## 硬件红线（必须守）

- RTX 4070 Laptop，8 GB。启动参数保持：--listen 0.0.0.0 --port 8188 --lowvram --reserve-vram 0.8 --vram-headroom 0.4 --disable-api-nodes
- 同一张图、同一条队列里，禁止同时加载：SDXL checkpoint + IP-Adapter + CLIP Vision + OpenPose ControlNet。
- 正确拆法：两轮工作流，中间卸载。
  - 轮 A「认人」：checkpoint + IP-Adapter（+ CLIP Vision）。出一张身份锁。
  - 轮 B「改姿」：checkpoint + OpenPose（SDXL 用 openpose-sdxl-xinsir；SD1.5 用 control_v11p_sd15_openpose_fp16）。img2img，denoise 低（建议 0.35–0.55），底图 = 轮 A。
- 不要把 SDXL 节点和 Anything-v5 / SD1.5 ControlNet 混在一条图里。

## 已有模型（以 API 文件名为准，不要带 ~6.6 GB 这种注释）

- waiIllustriousSDXL_v170.safetensors — 立绘/探索文生图（二次元）
- Anything-v5.0-PRT.safetensors — 仅像素/SD1.5 条，不要塞进 SDXL
- ip-adapter-plus_sdxl_vit-h.safetensors
- CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors
- openpose-sdxl-xinsir.safetensors
- control_v11p_sd15_openpose_fp16.safetensors

WAI 建议采样（与本机备忘对齐）：Euler a = euler_ancestral，步 28–35，CFG 5.5–7，尺寸 768×1024 或 832×1216。CLIP skip 2 若要加，用独立节点，确认不爆显存再写进冻结 JSON。

油画 LoRA / oilstyle：备忘写明是 SDXL 补，不是 Illustrious。没有主理人点名不要把油画 LoRA 塞进 WAI 条。

## 按优先级做（做完勾）

1. 清点 custom_nodes 与 models，列一张「已装 / 未装」表交回。不要擅自 git pull 升级 Comfy 到不可回退。
2. 做两条最小可导出工作流（网页里跑通 → Save API Format，文件名如下，放到方便拷回编码机的位置）：
   - txt2img_wai_api.json：只有 Checkpoint + CLIPEncode + EmptyLatent + KSampler + VAEDecode + SaveImage。无 IP-Adapter、无 OpenPose。
   - 若显存够再做：ipa_identity_api.json（仅轮 A）和 pose_i2i_api.json（仅轮 B）。做不到就写明 OOM 日志，不要硬叠。
3. 去底：若本机已有 RMBG / rembg 节点，写进清单。没有就记「未装」，等主理人点名再装。不要为去底下 FLUX。
4. 显存卫生：每条图结束能卸载（或文档写清要手动 Restart）。Queue 连续两张 WAI 不应爆。
5. 输出约定：SaveImage 必须在，filename_prefix 用英文。编码机靠 /history + /view 拉图。
6. 刷新握手 D:\ComfyUI\comfy-lan-handshake.json（schema 仍是 comfy-lan-handshake/v1）。models / custom_nodes / workflows 按实填。walk_strip_api / skill_strip_api 没有冻结条就保持 false。
7. 交回编码机：握手 JSON + 上述 API JSON（若有）+ 一张「显存实测」：txt2img 832×1216 峰值大约多少、是否能再开 IP-Adapter。

## 不要做

- 不要为「更像油画」先下 FLUX.2 Klein（8GB 上不是第一优先）。
- 不要全网段扫端口、不要把 8188 对任意 IP 开放。
- 不要现场给编码机拼一套没有 Save (API Format) 的巨型图当产线。
- 不要改编码机游戏仓。
```

---

## 编码机备忘（不给 GPU Agent）

2026-09-23 引擎期望（编码机；GPU 握手 notes 仍可能写旧分工，以本表和 `pipeline-gpu-first-v1.md` 为准）：

| 角色 | 引擎 | 日常参考图 |
|---|---|---|
| 图片编辑 / 非二次元 | Qwen-Image-2.1 | `QWEN21-图片编辑.json` · `QWEN21-T2I-基础.json`。透明走 `QWEN21-T2I-透明RGBA.json` 或 `QWEN21-去背景.json` |
| 二次元 | Krea 2 Turbo INT8 | `KREA2-Turbo-基础.json` |
| 备用 / 风格化 | WAI v170 | 点名才 Queue `WAI-*.json` |
| 视频 | 本机 MiniMax H3，分辨率受限 | 日常 I2V 0.4MP、约 5 秒。效果不好或需求复杂：反馈主理人调线上满血 H3 |
| 停用 | Klein · Wan Animate 2 | 参考图已归档。权重不在现网。不要 Queue |

2026-09-23 主理人改期望。Qwen / Krea / WAI / H3 分 Queue，换引擎 `POST /free`。Qwen 的 VAE（`qwen_image_2.1_vae_bf16`）与 Krea 的 `qwen_image_vae` 不通用。编码器默认 `qwen3vl_8b_w4a8`。Qwen 许可未核，进 `frames/` 前补核。已过 C/E 战斗帧不重切。

2026-09-08 对端已完成任务清单第一、二步（精修/IPA/Pose、当时的 Klein 4B、方案 A `/userdata`）。第三步（AnimateDiff / Tagger）仍等主理人点名。Klein 9B 不再评估。

产线：风格帧 H23 已过，蓝本不换；新二次元走 **Krea 2**，WAI 只做备用或风格化。`GenerateImage`：身份底 / 补强 / 少枪融景（条件见 `pipeline-gpu-first-v1.md`）。色键 C/E/G 与现网 C/E 64 不改。**不冻** walk/skill API。
