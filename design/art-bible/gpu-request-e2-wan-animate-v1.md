# GPU 机补能力 · E2 Wan Animate 2（走循环实验）

> **2026-09-17 · 追溯工单。** E2 已过、现网走帧仍在。**新走帧前确认 Animate 2 权重在盘**（E6 后本机曾卸）。不要按本文再下一轮「补能力」。
>
> 2026-09-12 · 编码机提出。HodikiX 执行。8GB。  
> 实验卡：`exp-e2-wan-animate-walk-v1.md`  
> 不要改游戏仓库 `assets/frames/`。不要 `git pull` Comfy（节点已在，不必升级）。
>
> **GPU 2026-09-12：E2 权重好了。** 扩散 `wan_animate_2_distill_int8_convrot.safetensors`；LoRA `lightx2v_I2V_14B_480p_cfg_step_distill_rank64_bf16.safetensors`。VAE 用盘上 `wan_2.1_vae.safetensors`（官方 `Wan2_1_VAE_bf16` 未下，打开模板要改这一项）。**14B I2V 文件名不作废。** 打前 `POST /free`。

编码机已探活（Comfy **0.34.0**）：`WanAnimate2ToVideo` / `WanAnimate2Cache` / `LoadVideo` / `GetVideoComponents` 均为 200。官方模板已写入 `user\default\workflows\Wan-Animate-2.json`。缺的是**权重**，不是节点。

权重已验收。编码机 2026-09-12 已 `POST /free` 后打 S0（API 图，不按模板默认）。驱动不在本工单。

---

## 要下（只这两件）

| 项 | 放哪 | 大小 | 来源 |
|---|---|---|---|
| `wan_animate_2_distill_int8_convrot.safetensors` | `D:\ComfyUI\models\diffusion_models\` | **15.51 GiB**（16653175528） | [Comfy-Org/Wan-Animate-2](https://huggingface.co/Comfy-Org/Wan-Animate-2) · `diffusion_models/` |
| `lightx2v_I2V_14B_480p_cfg_step_distill_rank64_bf16.safetensors` | `D:\ComfyUI\models\loras\` | **704 MB**（738005744） | 同仓 `loras/` |

共用已在盘、**不要再下**：`umt5_xxl_fp8_e4m3fn_scaled` · `clip_vision_h` · `wan_2.1_vae.safetensors`（官方模板写的是 `Wan2_1_VAE_bf16.safetensors`，编码机 Queue 时改文件名复用现网 VAE）。

**不要下**：`wan_animate_2_bf16` / `wan_animate_2_distill_bf16`（各 30.5 GiB）、非 distill 的 `wan_animate_2_int8_convrot`（又一块 15.5 GiB）。8GB 走 distill INT8。

示例（GPU 机，目录按实际改）：

```
huggingface-cli download Comfy-Org/Wan-Animate-2 diffusion_models/wan_animate_2_distill_int8_convrot.safetensors --local-dir D:\ComfyUI\models
huggingface-cli download Comfy-Org/Wan-Animate-2 loras/lightx2v_I2V_14B_480p_cfg_step_distill_rank64_bf16.safetensors --local-dir D:\ComfyUI\models
```

下完后 `UNETLoader` 应看见 distill 文件；`LoraLoaderModelOnly` 应看见 lightx2v。然后回编码机「E2 权重好了」。

---

## 盘不够时（授权挪，不粉碎）

本卡约需 **16.2 GiB** 空闲。不够则按序挪到 `D:\ComfyUI\_park_models\`（下拉会看不见，需要时再搬回）：

1. `models\diffusion_models\wan2.1_i2v_480p_14B_fp8_scaled.safetensors`（~15.3 GB，只跑过未过的 I2V 试枪）
2. 仍不够：`models\diffusion_models\flux-2-klein-4b.safetensors`（~7.75 GB，已停用）

主理人 2026-09-12：**14B I2V 文件名不作废**（未挪）。Klein 仍可在盘不够时挪。不要挪 umt5 / wan VAE / clip_vision_h / Krea Turbo INT8。

---

## 不要做

- 不要升 Comfy、不要 `git pull`
- 不要按官方模板默认 Queue；不要与 WAI / Krea 同会话。S0 已由编码机 API 打过
- 不要与 WAI / Krea 同会话硬扛；编码机打 E2 前会 `POST /free`
- 官方模板默认 Cache `device=gpu`、画幅 832×480、length 81、UNET 非 distill。8GB **不要按默认 Queue**。编码机改：distill UNET、竖幅 480×832、S0 length 17、Cache `cpu` + `int8`、VAE 用现网 `wan_2.1_vae`

---

## 验收（GPU 回一句即可）

- [x] `diffusion_models\` 有 `wan_animate_2_distill_int8_convrot.safetensors`
- [x] `loras\` 有 `lightx2v_I2V_14B_480p_cfg_step_distill_rank64_bf16.safetensors`
- [x] 腾盘：**不挪** 14B I2V（主理人：文件名不作废）
- [ ] 工作流侧栏能打开 `Wan-Animate-2.json`（打开后 VAE 改 `wan_2.1_vae`；编码机 S0 走 API 图，不按模板默认 Queue）
