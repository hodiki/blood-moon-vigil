# c-walk-wan-animate2 · C 轨走循环：已过印戳 + 驱动视频 → Wan Animate 2 → 挑六帧 → 近邻 128

> 状态：**已过** · 2026-09-12 · 主理人认 **S3c-b** → 现网 `assets/frames/hero-violet-walk-{a,e,b,c,f,d}.png`（128）。旧修女 64 退 `_park/hero-violet-walk-nun64-superseded-2026-09-12/`
> 证据：`evidence/21-e2-s4-s3c-b-6x128-strip.png` · `22-e2-s4-s3c-b-walk.gif` · `24-e2-s4-gates.json` · `17-…-pick.md` · `18-e2-summary.md` · 全量 `characters/violet-oath/combat/walk/` · `video/`
> 条文：`combat-64-workflow-v1.md` §10（动作迁移为走循环优选）· `combat-identity-chengfa-v1.md` §4 C 走 · 账本 `identity-validate-vo-walk-v1.md` · 实验卡 `exp-e2-wan-animate-walk-v1.md` · GPU 装机 `gpu-request-e2-wan-animate-v1.md`
> 一句话：**身份从参考图来，姿势从驱动视频来，一段视频里的帧天然是同一个人。** 走循环从「六张独立签」变成「一段里挑六帧」。8GB 本机可跑。

## 1. 适用 / 不适用

| 适用 | 不适用 |
|---|---|
| 已过 idle 印戳的角色出走循环（六相位 128） | 没有已过印戳的角色（先走 A / B） |
| 有合规驱动视频（§2） | 想靠文字让她「叉腰 / 举灯」——文字控不住姿，去 `c-pose-krea2-identity-edit` |
| 短动作也可（1–2 秒驱动短片出技能姿）——**旁路，未单独验证** | 手持物动作，除非驱动视频里的人也拿着东西 |

## 2. 输入 → 输出

| 输入 | 规格 | 验证时用的 |
|---|---|---|
| 参考印戳 | 绘画平涂全身，夜空 / 浅棚底；节点内 area 缩放到出图尺寸 | `characters/violet-oath/stamps/idle-from-a.png` |
| 驱动视频 | 单人朝观者右侧行走，全身入镜，纯色背景，≥3 秒；源 ~31.5 fps 取每 2 帧 ≈ 16 fps | `characters/violet-oath/video/drive/8c3b8794-drive-generic-walkinplace.mp4`（768×1344 · 141 帧 · 写实灰衣女人 · **非原地**） |

| 输出 | 规格 | 落盘 |
|---|---|---|
| 49 帧 PNG + 16fps webp | 384×672（S3c）或 480×832（S2） | `_park/comfy-lan/<ISO>/` |
| 六帧 128 | RGBA · 共用缩放 · 脚底 y=127 | `_park/e2-s4-6pick-box/` → 过了才 `assets/raw/` |
| 过目包 | 六格 ×4 条 · 三列对照 · 8fps GIF · 门禁 JSON | `review-exp-e2/16–25` |

## 3. 引擎 · 权重 · 节点（Comfy 0.34.0 已含核心节点，未升级）

| 项 | 值 |
|---|---|
| 扩散 | `wan_animate_2_distill_int8_convrot.safetensors`（16.7GB） |
| LoRA | `lightx2v_I2V_14B_480p_cfg_step_distill_rank64_bf16.safetensors` @1.0 |
| 文本 / VAE / CLIP-V | `umt5_xxl_fp8_e4m3fn_scaled`（wan · cpu）· `wan_2.1_vae`（官方 `Wan2_1_VAE_bf16` 未下，等价）· `clip_vision_h` |
| 核心节点 | `LoadVideo` → `GetVideoComponents` → 逐帧 `ImageFromBatch`（步长 2）→ `ImageBatch` 串 → `ImageScale(area)` → `WanAnimate2ToVideo` → `SamplerCustom` → `TrimVideoLatent` → `VAEDecode` → `SaveImage` + `SaveAnimatedWEBP` |
| **Cache** | `WanAnimate2Cache(device=cpu, dtype=int8)` **必开**。关掉那枪（S3b）多出两个人、扑克牌、披风马赛克 |
| 显存 / 耗时 | 8GB 无 OOM；49 帧 480×832 约 7–13 分钟，384×672 约 5–9 分钟；`/free` 后首枪含装模 |

## 4. 参数（验证值）

| 参数 | 值 | 备注 |
|---|---|---|
| 尺寸 | **384×672**（S3c-b 过）· 480×832（S2-a 留对照） | 384 更软但有烛；480 细节多但空手。16 的倍数 |
| `length` | **49**（4n+1） | 17 冒烟 · 33 一个周期 · 49 三秒挑帧余地够 |
| 采样 | `lcm` · `simple` · **6 步** · CFG **2** · shift **5** · denoise 1 | distill + LightX2V 口径 |
| pose / reference strength | 1.0 / 1.0 | 未扫 |
| seed | S3c-b **2026091212** · S2-a 2026091211 | 换 seed 改的是件不是人 |
| 驱动取帧 | 源帧 0,2,4,…,96 | `build-wan-animate2-vo-walk.mjs` `STRIDE=2` |

## 5. 命令

```powershell
cd d:\code\vampire-survivors-like\tools\comfy-lan
# 1) 生成 API 图（长度 / 尺寸 / Cache 可选）
node .\workflows\build-wan-animate2-vo-walk.mjs 49 --size=384x672
# 2) 排队（脚本内含 POST /free、上传参考与驱动、落 _park）
node .\queue-e2-s4.mjs s3c 2026091212 s3c-b
```

`queue-e2-s4.mjs` 用 `/upload/image` 直接传 mp4（Comfy 前端同接口），不必手拷 GPU `input/`。换角色改 `refPath`；换驱动改 `drivePath`。

## 6. 后处理（人挑帧 + 入盒）

1. **挑帧**：在 49 帧里找同一只脚两次接触之间的周期（本例 f9→f25 = 16 帧），按 Williams 取 a 接触 / e 落下 / b 经过 / c 对侧接触 / f 落下 / d 经过，±1 帧就近取清楚的。记源帧号（`evidence/17-…-pick.md`：f9, 12, 14, 17, 19, 22）。禁 flipX。
2. **去底**：洪水阈值 28，角点取样；白鞋 / 烛焰留住（`scripts/e2-s4-6pick-box.mjs`）。
3. **入盒**：六帧**共用**近邻缩放（P-6 口径，取能装下最大姿势的 scale）+ 脚底钉已过 idle `footY=127`；S3c-b scale≈0.185。不各自撑满。
4. **过目包**：`e2-s4-6pick-strip.mjs`（×4 条）· `e2-s4-6pick-review.mjs`（三列对照 · GIF 8fps 播序 idle→a,e,b,c,f,d · 门禁 JSON）。
5. 128 若偏软可再走 B 轨印戳 denoise ≤0.35（六帧同 seed）再近邻——**本例未加**，主理人接受软版入现网。

## 7. 验收（E2 八条）

| # | 问 | S3c-b |
|---|---|---|
| 1 | 六帧零件表五条可指（长黑发 · 披裙夜灰 · 银胸/肩 · 烛+焰 · 眼） | 烛偏低、眼软，主理人过 |
| 2 | 六帧同一人且与已过 idle 同一人 | 是 |
| 3 | 走姿不是站姿变形（后脚离地向前摆、重心前移、披 / 发有相位） | 是 |
| 4 | 对侧另一只脚、朝右、无 flipX、无脚本改姿 | 是 |
| 5 | 8fps 循环顺 | 是 |
| 6 | 128 硬色块、眼与烛能指 | **软**（已知债） |
| 7 | 门禁：脚底 ΔY 0 · hypot ≤6 · 面积 Δ ≤25% | 脚底 / hypot 全绿；面积 5/6 红（裙摆开合），只记 |
| 8 | 未写 `frames/` 直到主理人过 | 是 |

## 8. 已知限制

- **手持物**：驱动空手 → 烛离手 / 白砖 / 偏低。要保物，驱动视频里的人须持同类物件。
- **驱动非原地**：人持续右移、侧面加深；靠共用缩放 + 脚底钉补。原地行走（Mixamo「In Place」或跑步机）会更省。
- **画法**：Wan 出图比印戳软；384 更软。近邻 128 后不是硬色块。
- **换 seed 改件不改人**：S3a 出胸标、白卷；S2 喇叭袖 / 黑鞋从驱动渗入。件的漂用零件表挑，不加枪。
- **Cache 必开**；8GB 上 81 帧未试。
- 只验证了守誓一人一段驱动；其他角色复用同一驱动理论上成立，未跑。

## 9. 文件

| 文件 | 说明 |
|---|---|
| `workflow.api.json` | 冻结：122 节点 · 384×672 · 49 帧 · Cache 开 · seed 2026091201（S4 由脚本改 seed / 前缀） |
| `workflow.slots.json` | `image_ref` / `video_drive` / `positive` / `seed` / `length` / `width` / `height` |
| `workflow.official-template.ui.json` | ComfyUI 官方「Wan Animate 2」模板画布版，拖进网页可改；`COPY-TO-GPU.txt` 是拷法 |
| `prompt.txt` | 正 / 负向原文 + 持物注 |
| `scripts/build-wan-animate2-vo-walk.mjs` | 生成 API 图（长度 / 尺寸 / Cache / 步长） |
| `scripts/queue-e2-s4.mjs` | 生产排队（含 `/free`、上传 mp4、落 park、job.json） |
| `scripts/e2-drive-extract.mjs` | 驱动视频抽帧看片 |
| `scripts/e2-s4-6pick-box.mjs` | 去底 + 共用近邻 128 + 门禁 |
| `scripts/e2-s4-6pick-strip.mjs` · `e2-s4-6pick-review.mjs` | ×4 条 · 三列对照 · GIF · 门禁 JSON |
| `evidence/21 · 22 · 24 · 17 · 18` | 过关六帧条 · GIF · 门禁 · 挑帧记录 · 总结 |

驱动视频不复制进库（主理人提供的真人素材），原位 `review-exp-e2/drive/`。

## 10. 变更记录

| 日 | 变了什么 | 谁点 |
|---|---|---|
| 2026-09-12 | E2 过，S3c-b 入现网；条文 §10 优选改动作迁移 | 主理人 |
| 2026-09-12 | 建条 | — |
