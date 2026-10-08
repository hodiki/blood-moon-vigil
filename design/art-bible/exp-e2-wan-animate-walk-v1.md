# 实验 E2 · Wan Animate 驱动视频出走循环（准备 → 验收）

> 版本：v1 · 日期：2026-09-11 · 作者：编码机助理（实验卡）
> 状态：**已过（2026-09-12）。** 主理人认 **S3c-b**。现网 `hero-violet-walk-a/e/b/c/f/d` = 128（有烛偏低、未印戳）。旧修女 64 退 `_park/hero-violet-walk-nun64-superseded-2026-09-12/`。技能仍旧修女 64。过目 `18-e2-summary.md` · 三列 `23` · 循环 `25`。
> 上游：`art-pipeline-feasibility-v1.md` §8 · 成法 `combat-identity-chengfa-v1.md` · 停手 `combat-identity-drift-v1.md` · 走循环条文 `combat-64-workflow-v1.md` §1.1 ⑤ / §10 / R8 R20 R21 · 画布 `combat-64-pixel-workflow-v1.md` · TA `ta-combat-128-handoff-v1.md`
> 姊妹卡：`exp-e1-krea2-identity-edit-v1.md`（静姿）· `exp-e3-pixellab-probe-v1.md`（像素原生）

---

## 0. 一句话

把**守誓已过印戳**当参考，拿一段 **3 秒侧 3/4 朝右原地行走的驱动视频**喂给 **Wan Animate 2**（Comfy 原生、不需要骨架预处理），让模型在同一次采样里出整段走动；从中挑接触 / 落下 / 经过六帧，走现网 印戳 → 近邻 128 入盒，交六格条 + 8fps GIF 过目。这是「文字指定不了叉腰」的对症替换：姿势从视频来，身份从参考来。

---

## 1. 验证什么 · 若通过验证的是什么方案

### 1.1 假设

Wan 2.1 I2V 14B 两枪已证「人能锁，动作幅度与姿势由文字控不住」。动作迁移模型把姿势输入从文字换成驱动视频，姿势就不再是抽卡；同一段视频内的帧天然是同一个人（一次采样多相位）。走循环因此从「六张独立签」变成「一段视频里挑六帧」。

### 1.2 若通过，验证的方案

| 方案项 | 通过后落定为 |
|---|---|
| **C 轨作者（走循环）** | 动作迁移：参考 = 已过印戳，姿势 = 驱动视频，一次出整段 → 人挑六相位 → 印戳 → 近邻 128 |
| **原则** | 「一致性最便宜的来源是同一次采样」写进成法 C 轨与流程 §10（替代「单人六相位条」成为走循环优选；条仍是备选） |
| **技能姿的旁路** | 技能静姿也可用 1 秒驱动短片出（举灯、前刺），不必只靠 E1 的文字控姿 |
| **工序** | 视频帧 → 去底 → （必要时）B 轨印戳 denoise ≤0.35 → 近邻 128 → 石板 ×4 → GIF → TA 时间轴门禁（128 走档 hypot ≤6）。该链写进 `combat-64-pixel-workflow-v1.md` |
| **算力** | 8GB 能否扛 480×832 × 33–49 帧的动作迁移。能 → 本机开走循环；只能 17 帧或 OOM → 走循环批次上云（备选 A） |
| **不验证** | 静姿换作者（E1）；像素原生（E3）；D 轨 LoRA |

### 1.3 若不过，说明什么

| 漂类 | 说明 | 下一步（不是第三枪） |
|---|---|---|
| 人锁、动作没跟视频 | 驱动视频不合规（构图 / 帧率 / 背景），不是模型墙 | 按 §3.3 规格重录一次；仍不跟 → 记引擎限 |
| 前几帧人在，后段融化（SVD 式） | 长度 / 分辨率超出 8GB 稳定区，或非 distill 步数不够 | 先降到 33 帧、384×672；换 distill / 非 distill 各一枪；仍融 → 本机记「只能短片」，走循环上云 |
| 换人 / 换件 / 换画法 | 参考被视频里的人「覆盖」；或提示词写了新场景 | 提示词只写镜头与底，不写人；驱动视频换成纯色背景、无脸细节的人（Mixamo 素模最稳） |
| **持烛丢失（S1 踩坑）** | 驱动是空手走，印戳胸前烛没有对应动作设计，走里烛离手 / 成白砖 | 主理人 2026-09-12：算踩坑，**人锁还可以，不因此停卡**。专武/持物要另给驱动，或接受走循环空手、烛只在 idle |
| 装不上 / OOM 起不来 | `WanAnimate2ToVideo` 不在现网 Comfy，或 16.7GB 装不下 | 主理人决定：升 Comfy（可回退）/ 腾盘 / 直接上云做本卡 |

---

## 2. 前置（主理人点）

- [x] 允许 GPU 机下载 `wan_animate_2_distill_int8_convrot.safetensors`（HF **15.51 GiB**）+ `lightx2v_I2V_14B_480p_cfg_step_distill_rank64_bf16.safetensors`（**704 MB**）。VAE 用盘上 `wan_2.1_vae.safetensors`（官方 `Wan2_1_VAE_bf16` 未下）。umt5 / clip_vision_h 复用。工单：`gpu-request-e2-wan-animate-v1.md`
  · **2026-09-12 GPU：E2 权重好了。** 14B I2V 文件名不作废。打前 `POST /free`。
- [x] 盘不够时允许把 `wan2.1_i2v_480p_14B_fp8_scaled.safetensors`（15.3GB）挪到 `D:\ComfyUI\_park_models\`（不粉碎）。**主理人 2026-09-12：14B I2V 文件名不作废（未挪）。**
- [x] 探活 `WanAnimate2ToVideo` / `WanAnimate2Cache` / `LoadVideo`：**200**（Comfy 0.34.0）。**不必升 Comfy、不要 git pull**
- [x] 提供或授权驱动视频来源（§3.3）：自拍 / Mixamo 渲染 / 授权助理找公开素材
  · **2026-09-12 主理人提供 `8c3b8794`。** 已拷 `review-exp-e2/drive/8c3b8794-drive-generic-walkinplace.mp4`。朝右走可读，**不是原地**，写实人脸。S0 用源帧 0,2,…,32（stride 2 ≈16fps 等效），未整片转码。`e4c22590` 是 Vf1 生成片，**不当驱动**，也不是本卡守誓参考。
- [x] 点名开工 = 认可本卡 `denoise 1`、驱动视频控姿是新判据下的合法工（身份来自参考图）
- [x] 点名开工 = 认可「工具准入」：本卡允许 ≤6 枪探工况（长度 × 分辨率 × distill），再进两枪封顶

---

## 3. 准备

### 3.1 GPU 机（HodikiX）

| 项 | 做什么 | 验证 |
|---|---|---|
| 节点 | 编码机先探 `WanAnimate2ToVideo` / `WanAnimate2Cache` / `LoadVideo`。缺 → §2 第 3 条 | **已探：三个 200**（2026-09-11） |
| 扩散 | `wan_animate_2_distill_int8_convrot.safetensors` → `models\diffusion_models\` | `UNETLoader` 下拉可见 |
| LoRA | `lightx2v_I2V_14B_480p_cfg_step_distill_rank64_bf16.safetensors` → `models\loras\`（官方模板挂它；distill 变体若模板说明不挂则跳过） | 下拉可见 |
| 共用 | `umt5_xxl_fp8_e4m3fn_scaled`（type=`wan`，device=cpu）· `wan_2.1_vae` · `clip_vision_h` | 已在握手 |
| 盘 | 需 ≈17GB 空闲 | `POST /free` 后看 `system_stats` |
| 内存 | `WanAnimate2Cache` 放 cpu、dtype int8：480×832 × 33 帧约 2–3GB 系统内存（81 帧 bf16 官方约 12.5GB） | 首枪看任务管理器 |
| 卫生 | 换引擎前 `POST /free`；不与 Krea / WAI 同 Queue | — |

### 3.2 编码机（Hodiki）

| 项 | 做什么 |
|---|---|
| 工作流 | 官方 UI 模板已上 GPU：`Wan-Animate-2.json`。编码机副本 `wan-animate2-official.ui.json`。权重落地后打开，改 distill / 竖幅 / Cache cpu，**Save (API Format)** → `wan-animate2-vo-walk.api.json`。不要现场拼节点。槽：`image_ref` · `video_drive` · `positive` · `seed` · `length` · `width/height` |
| 客户端 | `run-job.mjs` 已加 `--drive`（`/upload/image`）。驱动视频也可手拷到 `D:\ComfyUI\input\` |
| 抽帧 | 复用 `_inspect/extract-vf1-i2v.mjs` · `vf1-wan14-strip.mjs` 出帧条；新增六相位挑帧记录（哪一帧当 a/e/b/c/f/d，写进 summary） |
| 去底 | `InspyrenetRembg`（盘上有）或洪水只抠真底；夜布当主体留着（R2） |
| 入盒 | `_inspect/vo-idle-o3d2-box.mjs` 以 `C64_BOX=128` 近邻入盒，六帧共用同一缩放与脚底（P-6 口径，不各自撑满） |
| 过目 | `preview_board.py`（石板 `#2A3444` ×4）· `preview_strip_gifs.py`（播序 a,e,b,c,f,d · 8fps） |
| 门禁 | 用 `tools/asset-pipeline/layout.mjs` 的 128 走档函数对六张 PNG 算重心 hypot（≤6）/ 脚底 ΔY（0）/ 面积 Δ（≤25%），**只算不写** |
| 过目夹 | 现锁 `characters/violet-oath/combat/walk/` · `video/`（原 `review-exp-e2/` 已迁） |

### 3.3 素材

| 项 | 路径 / 规格 | 说明 |
|---|---|---|
| 参考底（唯一） | `characters/violet-oath/stamps/idle-from-a.png` | 守誓 from-a 印戳（绘画大图，夜空底）。**不用 128 当参考**（太小），不用双人成片 |
| 已过 128（对照） | `characters/violet-oath/combat/idle/hero-violet-idle-128-v1.png` · `-x4.png` | 对照卡与 GIF 首格 |
| 零件表（守誓） | 长黑发（不是头巾）· 披裙夜灰大面 · 银只胸 / 肩 · 胸前烛 + 焰 · 能指的眼 | 六帧每帧都问 |
| **驱动视频** | 见下 | 主理人提供或授权 |

驱动视频规格（不合规先别 Queue）：

| 项 | 要求 | 为什么 |
|---|---|---|
| 内容 | 一个人**原地行走**（treadmill / Mixamo「In Place」），全身入镜、脚可见、头顶留空 | 原地走 = 六帧脚底自然对齐，入盒不用再对位 |
| 机位 | 侧 3/4，**面朝观者右侧**，镜头固定在胸高 | 现网走帧朝右；烛在胸前，不受左右影响，但禁止整帧 flipX（R20） |
| 背景 | 纯色墙 / 素模灰棚，无其他人、无道具 | 防止背景与他人被当成参考 |
| 帧率 / 长度 | **16 fps**，≥3 秒（≥49 帧）。源 30 / 60 fps 先转 16（否则步速慢一到三倍） | Wan 原速 16 fps；`length` 须 4n+1 |
| 尺寸 | 竖幅，≥480×832，16 的倍数 | 与参考印戳纵向一致 |
| 来源 | ① 手机拍真人原地走；② Mixamo：Y Bot → Walking → 勾 In Place → 摆 3/4 机位 → 录屏；③ 主理人授权的公开素材 | Mixamo 素模无脸无衣，最不容易把「别人」带进来 |

---

## 4. 执行

### 4.1 接线（按官方模板，不改结构）

```
UNETLoader(wan_animate_2_distill_int8_convrot) ── [LoraLoaderModelOnly(lightx2v rank64) 按模板] ── [WanAnimate2Cache(device=cpu, dtype=int8) 可选]
CLIPLoader(umt5 · type=wan · cpu) ── CLIPTextEncode(正) / CLIPTextEncode(负)
LoadImage(参考印戳) ──────────────────────────────── WanAnimate2ToVideo.reference_image
LoadVideo(驱动 mp4) ── GetVideoComponents ── IMAGE ── WanAnimate2ToVideo.pose_video
VAELoader(wan_2.1_vae) ── WanAnimate2ToVideo.vae
WanAnimate2ToVideo(width 480 · height 832 · length 33) ── KSampler(模板步数 / CFG) ── VAEDecode
   ── SaveImage(prefix comfy_lan_e2_)  +  SaveAnimatedWEBP(16 fps) 过目用
```

`positive_pose` 留默认（= positive）。`video_frame_offset` 用来跳过视频开头的起步帧，选到稳定的步周期。

### 4.2 提示词（只写镜头与底，不写人）

正向：

> Static camera at chest height. Empty pure black void behind her, no floor, no scenery, no props. Same flat cel-shaded illustration as the reference image. She walks in place facing the viewer's right, natural stride, arms and cloak swinging with each step.

负向：官方模板默认负向 + `camera motion, zoom, new background, landscape, second person, realistic photo, blurry`。

**不要**把零件表复述进正向——外观由参考图扛（Wan 文档口径），复述只会把画法拉向绘画。

### 4.3 枪数与顺序（工具准入 ≤6 枪，再两枪）

| 步 | 枪 | 参数 | 目的 | 停下来的条件 |
|---|---|---|---|---|
| S0 冒烟 | 1 | 480×832 · **17 帧** · seed 2026091201 | 节点通、8GB 起得来、人是不是她 | **已打（2026-09-12）。** 不 OOM，~189s，人是守誓，烛不稳 |
| S1 走 33 | 1 | 480×832 · **33 帧** · 同 seed | 一个完整步周期（约 16–19 帧）在不在 | **已打。** 主理人 2026-09-12：人锁还可以；持烛无专门动作设计、走里丢失 = 踩坑。未过 |
| S2 走 49 | 1 | 480×832 · **49 帧** | 3 秒，两三个周期，挑帧余地 | **已打（2026-09-12）。** 不 OOM，~411s，后段未融。空手（持烛踩坑）。未挑六帧。未 Queue S3 |
| S3 补探 | ≤3 | 底 = S2。换：分辨率一档 / 有无 Cache / seed | 找稳定工况 | **三枪打完。** S3a seed 人锁换件；S3b 关 Cache 废；S3c 384 人锁偏软。未进 S4 |
| S4 两枪 | 2×2 | 主理人：S2 与 S3c 都可进 · seed 2026091211 / 12 | 生产口径，各自挑六帧 | **已出。** S3c-a 换画法；另三枪人锁。未挑六帧 |

8GB 上 distill + 33 帧预计每枪 5–15 分钟（对照：Wan 2.1 14B fp8 17 帧 20 步已在 3600s 超时内完成）。

### 4.4 挑帧（人做，记下来）

1. 在 33 / 49 帧里找**同一只脚两次接触之间**的一个完整周期（约 16–19 帧）。
2. 按 Williams 相位取六帧：a 接触（前脚跟着地，跨步最大）→ e 落下 → b 经过（摆动脚在髋下）→ c 对侧接触 → f 落下 → d 经过。等分取，允许 ±1 帧就近取更清楚的一张。
3. 记进 `summary.md`：源帧号 → 相位。禁止 flipX 凑对侧（R20）；对侧必须是另一只脚向前的那一帧。

### 4.5 入盒与过目稿

1. 六帧去底（只抠真底；夜布是主体）。
2. 直接 `vo-idle-o3d2-box.mjs C64_BOX=128` 近邻入盒，六帧共用缩放与脚底。
3. 若 128 上边不是硬块（Wan 出图偏软），**再加一遍 B 轨印戳**：六帧同 seed、Krea i2i denoise ≤0.35、夜空底，再近邻。记「加了印戳」。不得抬 denoise 碰姿。
4. 出：六格静帧条 · 石板 ×4 板 · 8fps GIF（a,e,b,c,f,d）· 与已过 idle 128 的对照卡 · 128 走档门禁数值。

### 4.6 落盘

- 原出：`assets/ui-menu/preview/locked/combat-64/_park/comfy-lan/<ISO>/`（帧 PNG + webp + `job.json`）
- 过目：`assets/ui-menu/preview/locked/review-exp-e2/`

| 文件 | 内容 |
|---|---|
| `01-e2-drive-contact-sheet.png` | 驱动视频抽 8 帧缩略（证明输入合规） |
| `02-e2-s0-17f.png` · `03-e2-s1-33f-strip.png` · `04-e2-s2-49f-strip.png` | 冒烟与探工况帧条 |
| `05–15` | 探工况 / S4 四枪全帧条与循环（已占用；卡表原 `05-e2-a-pick` 重号，不用） |
| `16-e2-s4-s2-a-pick.md` · `16-e2-s4-s2-a-6pick-strip.png` | S2-a 挑帧（播序 f9,12,14,18,20,23） |
| `17-e2-s4-s3c-b-pick.md` · `17-e2-s4-s3c-b-6pick-strip.png` | S3c-b 挑帧（播序 f9,12,14,17,19,22） |
| `18-e2-summary.md` | 零件表 + 漂类 + 门禁摘要 + 是否加印戳 |
| `19` / `20` | S2-a 128×4 条 · 8fps GIF/webp |
| `21` / `22` | S3c-b 128×4 条 · 8fps GIF/webp |
| `23-e2-s4-compare-3col.png` | idle / S2-a / S3c-b 三列对照 |
| `24-e2-s4-gates.json` · `25-e2-s4-6pick-loops.html` | 门禁数值 · 双循环页 |

---

## 5. 过目与验收

### 5.1 过目板

石板 `#2A3444` · 先封洞 · 近邻 ×4。GIF 首格前放已过 idle 128 一格做起点对照（只放她自己的 64 / 128，不放别人的，见流程 §9.2「过目板不放 C」）。技能不在本卡，不拼技能。

### 5.2 判据（全「是」才交主理人）

| # | 问 | 是 / 否 |
|---|---|---|
| 1 | 六帧每帧零件表五条可指：长黑发 · 披裙夜灰 · 银胸 / 肩 · 胸前烛 + 焰 · 眼 | |
| 2 | 六帧是同一个人，且与已过 idle 128 是同一个人（不换头、不换衣、体量不跳） | |
| 3 | 是走姿不是站姿变形（R8）：后脚离地向前摆、重心前移、上身 / 披 / 烛有相位 | |
| 4 | 对侧是另一只脚向前，整帧朝右，无 flipX（R20）；无脚本改姿（R21） | |
| 5 | 8fps 循环顺：无突然前倾 / 立直 / 体量乱跳 | |
| 6 | 128 上是硬色块，不是糊；眼与烛焰能指（头约 16–20px） | |
| 7 | 门禁数值：重心 hypot ≤6 · 脚底 ΔY = 0 · 面积 Δ ≤25%（128 走档）；红的只记，不为绿改图（R5） | |
| 8 | 未写 `frames/`；原出在 `_park/`，过目在 `review-exp-e2/` | |

### 5.3 通过 / 失败口径

- **通过**：任一枪六帧全「是」，主理人点「过」。
- **部分**：六帧里 4–5 帧可用、缺的是落下或经过 → 记「动作迁移可出关键帧」，缺帧允许从同枪相邻帧再挑，**不允许**脚本收腿 / 剪倾补（R21）。仍算方案成立，工序补一句「多录 1 秒备挑」。
- **失败**：两枪均落 §1.3 某一漂类 → 停，写漂类，按该行下一步。

主理人只看：`07 / 08 / 09`（枪 A）与 `13 / 14 / 15`（枪 B），共六件。

---

## 6. 结果怎么写回

2026-09-12 过目后已写（本表勾完即 E2 记账结束）：

| 结果 | 写哪 | 谁写 | 写回 |
|---|---|---|---|
| 通过 | `combat-identity-chengfa-v1.md` §4 C 轨加「走：动作迁移 · 参考 = 已过印戳 · 姿 = 驱动视频」；§1.1 路线图加 E2 节点 | 助理起草，主理人点 | **已写** |
| 通过 | `combat-64-workflow-v1.md` §10 走循环优选改为「驱动视频一次出段 → 挑六帧」，单人六相位条退备选；§1.1 ⑤ 加「驱动视频 ≠ 站姿变形」注 | 同上 | **已写**（过时） |
| 通过 | `combat-64-pixel-workflow-v1.md` 成法表加「视频帧 → 去底 →（印戳）→ 近邻 128」 | 助理 | **已写**（过时） |
| 通过 | `tools/comfy-lan/call-reference.md` 引擎表加 Wan Animate 2；`workflows/` 入 API JSON；`README.md` 一行 | 助理 | **已写** |
| 通过 | `ta-combat-128-handoff-v1.md` §6：守誓走帧 EXPLICIT 切 128 的触发 = 本卡主理人「过」后入现网 | TA | **已写**（过时） |
| 任一 | `identity-validate-vf1-plan-v1.md` §6 或新开 `identity-validate-vo-walk-v1.md` 记账 | 助理 | **已写** 短账本；Vf1 只留指针 |
| 任一 | `art-pipeline-feasibility-v1.md` §8 表 E2 行改状态 | 助理 | **已写**（过时） |

通过后**第一批生产帧**：守誓 `hero-violet-walk-a/e/b/c/f/d` 128（帧名契约不变），仍主理人过才写 `frames/`，写后按 TA 卡 §2 步骤入现网、切 EXPLICIT、`pack`。

---

## 7. 停手

`combat-identity-drift-v1.md` 任一类当场停。另加本卡两条：驱动视频不合规不 Queue；OOM 两次不再降参硬凑，转 §1.3 末行由主理人决定升级 / 上云。

---

## 8. 预算

| 项 | 估 |
|---|---|
| 下载 | 16.7GB + LoRA，按 GPU 机带宽（主理人） |
| Comfy 升级（若需要） | 0.5–1 小时含备份 |
| 驱动视频 | 0.5 小时（Mixamo 录屏或手机拍 + 转 16fps） |
| 编码机准备 | 1–2 小时（导 API JSON、槽、挑帧记录模板） |
| 出图 | 6 探 + 2 产 ≈ 8 枪 × 5–15 分钟 ≈ 1–2 小时 |
| 挑帧 + 入盒 + 板 | 1 小时 |
| 过目 | 主理人 15 分钟看六件 |
| 费用 | 0（本机）。若上云：24GB 机按小时，本卡 ≈1–2 小时 |

---

## 9. 与 E1 / E3 的关系

E2 只答「走循环能不能靠一段视频出」。技能静姿以 E1 为主，E2 的「1 秒短片出技能姿」是通过后的旁路，不在本卡枪数内。E3 若像素原生走条能用，与 E2 是两条平行的走循环作者，由主理人按风格贴合度选一条进成法。

## 10. 来源

ComfyUI 文档《Wan Animate 2: Motion Transfer》与 `WanAnimate2ToVideo` / `WanAnimate2Cache` 节点页（参考图 + 驱动视频、无骨架预处理、Cache 内存口径）· Comfy-Org/Wan-Animate-2（INT8 convrot 16.7GB、模板文件表）· 本仓库 `identity-validate-vf1-plan-v1.md` §13–§15（Wan 14B 人锁、`4n+1`、16 fps）· `gpu-request-c-pose-i2v-v1.md` §D（8GB 跑 14B fp8 的实测口径）· Williams 相位与本项目播序 a,e,b,c,f,d（`combat-64-workflow-v1.md` §10）。
