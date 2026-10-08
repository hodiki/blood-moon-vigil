# c-pose-krea2-identity-edit · C 轨静姿：已过印戳 → Identity Edit 换姿（满降噪）

> 状态：**大部分过 · 留档** · 2026-09-11 · 主理人：「大部分过。C1、C3 有效；C2 类小幅度可能失效。提示词用视觉描述。」
> **2026-09-23：** 新图片编辑作者改为 Qwen-Image-2.1。本条不删。新枪不默认再 Queue。
> 证据：`evidence/04-e1-c1-a-card.png`（叉腰）· `evidence/23-e1-c3-a-card.png`（走接触）· `evidence/14-e1-summary.md` · 过关件 `characters/violet-fallen/stamps/poses/` · 其余仍在 `review-exp-e1/`
> 条文：`combat-64-workflow-v1.md` R23 · `combat-identity-chengfa-v1.md` §4 C · 实验卡 `exp-e1-krea2-identity-edit-v1.md`
> 一句话：「同一人换姿」是编辑任务。参考图进模型上下文，**EmptyLatent / denoise 1 合法**（身份来自参考 token，不是 OpenPose + t2i）。旧 Krea i2i 低 denoise 换姿 10 枪 0 过，本条 C1 2/2、C3 1/1。

## 1. 适用 / 不适用

| 适用 | 不适用 |
|---|---|
| 技能静姿（举物、前刺、叉腰、迈步接触）——目标姿与底**明显不同** | 重心微调、呼吸、与 idle 难分辨的姿（C2 0/4） |
| 底 = 该角色已过印戳（绘画平涂，夜空底） | 底 = 128 小图、双人成片、未过印戳 |
| 立绘级 re-stage（换机位 / 表情）——**机制同，全分辨率同脸见 E4** | 走循环（去 `c-walk-wan-animate2`）；**进场景**（去 `scene-closed-source-few-shot`） |

## 2. 输入 → 输出

| 输入 | 规格 | 来源 |
|---|---|---|
| 参考印戳 | 512×1024（源尺寸 = 输出尺寸，走纯潜空间路） | `review-identity-vf1/12-idle-blo-passed-stamp.png` 等 B 轨过关印戳 |
| 指令 | 身份句 + 一条姿势句，整句英文 | `prompt.txt` |

| 输出 | 规格 | 落盘 |
|---|---|---|
| 新姿印戳 | 512×1024 | `_park/comfy-lan/<ISO>/` |
| 128 | 近邻入盒（同 B 轨脚本） | `review-exp-e1/` 样式对照卡 |

## 3. 引擎 · 权重 · 节点

| 项 | 值 |
|---|---|
| 底座 | `krea2_turbo_int8_convrot.safetensors`（INT8 **吃 LoRA**，S0 对照已证） |
| LoRA | `krea2_identity_edit_v1_2_r128.safetensors` @1.0（`LoraLoaderModelOnly`） |
| 节点包 | `custom_nodes/comfyui-krea2edit`：`Krea2EditModelPatch` + `Krea2EditGroundedEncode`（两个都要） |
| 文本编码 / VAE | `qwen3vl_4b_fp8_scaled`（krea2 · cpu）· `qwen_image_vae` |
| 显存 / 耗时 | 与日常 Krea Turbo 持平 + 约 0.9GB；8GB 上每张 1–2 分钟 |

接线（见 `workflow.api.json`）：

```
LoadImage ─┬─ VAEEncode ── Krea2EditModelPatch.source_latent
           └─ Krea2EditGroundedEncode.image（正：指令 / 负：空指令）
UNETLoader ── LoraLoaderModelOnly(1.0) ── Krea2EditModelPatch(ref_boost 4 · fit) ── KSampler.model
EmptySD3LatentImage 512×1024 ── KSampler(euler · simple · 10 步 · CFG 1 · denoise 1) ── VAEDecode ── SaveImage
```

不接 Enhancer。不接 `source_latent_b` / `image_b`（那是「场景 + 人」两图模式）。

## 4. 参数（验证值 · 六格扫描后的最优格）

| 参数 | 值 | 扫过什么 |
|---|---|---|
| `grounding_px` | **768** | 512 / 768 / 1024：六格都叉腰、无选人表；768 综合最好 |
| `ref_boost` | **4** | 2 / 4：4 更贴参考 |
| LoRA 强度 | 1.0 | 0 对照 = 仍垂手 |
| 步 / CFG | 10 / 1 | 模型卡：8 偏构图、12 偏脸，10 折中 |
| 尺寸 | 512×1024（= 源） | ≤2MP，源出同尺寸省显存 |
| seed | C1 2026091102 / 03 · C3 2026091106 | — |

## 5. 命令

```powershell
cd d:\code\vampire-survivors-like\tools\comfy-lan
Invoke-RestMethod -Method POST -Uri http://192.168.101.200:8188/free -ContentType application/json -Body '{"unload_models":true,"free_memory":true}'
.\run-job.ps1 queue -Workflow ..\..\pipelines\c-pose-krea2-identity-edit\workflow.api.json `
  -Slots ..\..\pipelines\c-pose-krea2-identity-edit\workflow.slots.json `
  -Ref <passed-stamp.png> -TimeoutSec 420
```

批量 / 扫描用 `scripts/queue-e1-s1.mjs`（六格）· `queue-e1-s2s3.mjs`（两姿各两枪）。改 `IDENTITY` / 姿势句 / `refPath` 即换角色。

## 6. 后处理

同 B 轨：`pipelines/b-stamp-nearest-128/scripts/vf1-box-b.mjs` 近邻 128 + 石板 ×4 对照卡（本枪印戳 · 128 原大 · 128 ×4 · 已过 idle 128 ×4 · 旧同姿对照）。C3 脚下投影会被入盒当主体，先看印戳再决定裁。

## 7. 验收（E1 七条，全「是」才交）

| # | 问 |
|---|---|
| 1 | 零件表 ≥7/8 可指，换件 = 0 |
| 2 | 姿势按句子变了（画面上一眼可辨） |
| 3 | 单人、无网格 / 三视图 / 第二人 |
| 4 | 仍是平涂 cel，不是 Q / 油画 / 写实 |
| 5 | 近邻 128 后角、眼位、开叉红条能指；无真洞 |
| 6 | 相对已过 idle 128 不换头、不换衣、不乱长 |
| 7 | 未写 `frames/` |

脸按分层判：印戳细看（E1 记「比底更二次元、眼更红」），128 只算呼吸。**立绘级用途不能沿用这条宽松判法**——见 §8。

## 8. 已知限制

- 小幅度姿失效（C2）。解法是换更明显的目标姿；E1-b（叠盘上 `krea2_turbo_openpose_controlnet` 骨架 LoRA，满降噪）只作静姿补救，点名才开。
- 画法会向 Krea 先验偏（更二次元 / 更亮）。在 128 上被近邻抹平；在 768+ 立绘上会显。
- 模型卡自述：纹理忠实、比例保守，特征鲜明的脸会向平均回归；换服装时好时坏；罕见件（角、蕾丝）可能被基座拉走——`ref_boost` 拉高、身份句点名可缓解。
- **指令改姿 / 改表情无效、画面仍贴参考时：先优化提示词（视觉描述），再酌情降低 `ref_boost`。** 日常 4 是「更贴参考」；贴死参考表情就降。E4 卡珊德拉 P6：句已够、`ref_boost` 4 仍浅笑，降到 **2.5** 冷视成立（`17-e4-cassandra-P6-rb25.png`）。近亲 / 零件漂才抬到 6，不要用抬 boost 修机位或表情。
- 手持物不在参考里的动作（举灯）需在姿势句里明确写出物件位置；未验证。

## 9. 文件

| 文件 | 说明 |
|---|---|
| `workflow.api.json` | = `tools/comfy-lan/workflows/krea2-vf1-identity-edit.api.json`（C1 句 · 最优格） |
| `workflow.slots.json` | `seed` / `positive` / `image_ref` / `ref_boost` / `grounding_px` / `lora_strength` |
| `prompt.txt` | 身份句 + C1 / C3（过）+ C2（反例）+ R23 写法 |
| `scripts/queue-e1-s0.mjs` | LoRA 1.0 vs 0 对照（验 INT8 吃 LoRA） |
| `scripts/queue-e1-s1.mjs` | 六格扫描 grounding × ref_boost |
| `scripts/queue-e1-s2s3.mjs` | 两姿各两枪（生产口径） |
| `scripts/queue-e1-c2v2-c3.mjs` | C2 v2 + C3 |
| `evidence/04 · 23 · 14` | 对照卡 ×2 + 摘要 |

## 10. 变更记录

| 日 | 变了什么 | 谁点 |
|---|---|---|
| 2026-09-11 | E1 大部分过；R23 入条文 | 主理人 |
| 2026-09-12 | 建条 | — |
| 2026-09-15 | E4：改不动时降 `ref_boost`（4→2.5 冷视成立）；近亲才抬 | 主理人 |
