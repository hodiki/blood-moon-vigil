# video-h3-firstframe-chain · 视频首帧链：少枪融景首帧 → MiniMax H3 I2V

> 状态：**部分过** · 2026-09-17 · 主理人：H3 I2V 124 过；S4b / S5 过。**本机开源视频只留 H3**（Wan 已卸）。
> 证据：`characters/violet-fallen/identity/video/` · 过目 `characters/violet-fallen/review/20260915-e6/07-e6-summary.md` · 卡 `design/art-bible/exp-e6-video-firstframe-chain-v1.md`
> 条文：`combat-identity-chengfa-v1.md` §4 视频 · `face-gate-spec-v1.md` 视频级
> 一句话：过立绘级脸门的竖首帧 → 本机 H3 FL2VA 124 帧小动作 → 段间默认 first+last 续。效果不好或需求复杂：停，反馈主理人，由主理人调线上满血 H3。

生产脚本在 `tools/comfy-lan/queue-e6-h3.mjs`（不复制 JSON 进本库：图由脚本现组）。

## 1. 适用 / 不适用

| 适用 | 不适用 |
|---|---|
| 剧情 / 宣传：已过关竖首帧出 5 秒内转头停 | 战斗 128 走帧、口型、多角色同框 |
| 段间续：尾帧当 first，过关脸当 last | 只接 first_frame 续段（E6 S4 不过） |
| **本机日常**：8GB · 0.4 MP（480×864）· 124f @24fps · I2V | 本机 R2V+驱动（0.98×124 ≈ 125 min，不作日常） |
| | Wan 2.1 I2V 14B 自由动作；H3 65 帧（非法）；本机 768×1344 ×362（未达） |

## 1.1 本机 vs 线上（2026-09-23 · 主理人）

本机 **能跑** H3，分辨率受限。日常停在 0.4 MP、约 5 秒。效果不好，或要复杂动作、更高分辨率、更长、参考视频、宣传级：停，**反馈主理人**，由主理人调线上满血 H3。助理不代调官方 API，也不在本机加枪硬撑。

| 走本机 H3 | 反馈主理人，由主理人走线上满血 H3 |
|---|---|
| 日常短 I2V：480×864 ×124 ≈ 5s · ~8.5 min / 8GB | 成片效果不好 |
| 段间 first+last 续（同规格） | 复杂动作、物理、指定高压运动 |
| 验证提示词、脸锚、接法 | 更长段、768P / 2K、宣传级 |
| | 参考视频 / 多模态参考；本机 0.98MP×362 未达 |

官方现网（2026-09-17 查，价格可能变）：`POST /v2/video_generation` · 模型 `MiniMax-H3` · 768P **$0.08/s** · 2K **$0.13/s** · 时长 4–15s 整数。Hailuo 02 / 2.3 是遗留线，新枪优先 H3。账号与条款由主理人开。许可见 `engine-license-check-v1.md` §3.1。

## 2. 输入 → 输出

| 输入 | 规格 | 来源 |
|---|---|---|
| 首帧 | 过立绘级脸门 · 竖 · 近邻 480×864 | 少枪融景 / 已过段 |
| 尾帧（续段） | 同画布 · 过关脸锚 | 过关竖首帧或已过 last |

| 输出 | 规格 | 落盘 |
|---|---|---|
| 段 | mp4 480×864 24fps 124f | 过目 `review/`；过了锁 `identity/video/` |
| 战斗帧 | — | **不写 `assets/frames/`** |

## 3. 引擎

| 项 | 值 |
|---|---|
| UNET | `MiniMax-H3-FL2VA-Q3_K_M.gguf` |
| CLIP | `qwen3vl-32B-MiniMax-H3-Q2_K.gguf` type=minimax **CPU** |
| VAE | `minimax_h3_video_vae_fp16` + audio fp32 |
| LoRA | `minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16` @1 |
| 节点 | `MiniMaxH3ImageToVideo` |
| 采样 | res_multistep / simple / 8 步 / denoise 1 / CFG≈1 |
| 耗时 | 8GB · 480×864 ×124 ≈ 8.5 min |

与 WAI / Krea / Wan 分 Queue。打前 `POST /free`。SaveVideo `format=auto`（字符串）。

## 4. 参数（E6 验证）

| 枪 | first | last | seed | 结论 |
|---|---|---|---|---|
| I2V 124 | 过关竖首帧 | — | 2026091632 | 过 |
| S4 仅首帧 | 上段 last | — | 2026091731 | 不过 |
| S4b | 上段 last | 过关竖首帧 | 2026091732 | 过 |
| S5 | 重出静帧 还可以 | — | 2026091733 | 过 |

## 5. 命令

```powershell
cd d:\code\vampire-survivors-like\tools\comfy-lan
# 无子命令不 Queue
node queue-e6-h3.mjs i2v124
node queue-e6-h3.mjs s4b
node queue-e6-h3.mjs s5
```

## 6. 后处理

ffmpeg 抽 f1 / mid / last → `make-card.mjs --frames` 视频级五列。主理人过了才锁 `identity/video/`。

## 7. 验收

视频级：三帧不换人；近亲 ≤1 且不在首帧。动作按词可读。段间第二段首帧 vs 上段尾帧无近亲。

## 8. 已知限制

- 仅 first_frame 续段会换脸。
- 8 步 turbo 可能改景；E6 教堂锁住了，换场景要复核。
- length 必须 17k+5；没有 Wan 的 4n+1 / 16fps。
- 768×1344 ×362 本机未达；要更高分辨率 / 更长段走官方 MiniMax-H3 API。
- 本机 R2V+驱动能跟动作，但不作日常（0.98×124 ≈ 125 min）。
- Animate 2 指定动作未再验（Wan 已卸）。

## 9. 文件

| 文件 | 说明 |
|---|---|
| 本 README | 工序卡 |
| `prompt-i2v.txt` | 已过段正向（转向烛后停） |
| `prompt-s4b.txt` | 续段正向（转回镜头） |
