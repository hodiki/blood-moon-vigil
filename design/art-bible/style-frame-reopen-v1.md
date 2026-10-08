# 风格帧重开 · 开工卡（2026-09-08）

> **2026-09-17 · 追溯。禁止当新开工卡。** H23 已过；Klein 已停用。立绘线现走 Krea Identity Edit（E4）+ 脸门 R24。配方留档：`style-frame-h23-lessons-v1.md` · `pipelines/portrait-wai-h23-style-frame/`。
>
> 产线：`pipeline-gpu-first-v1.md`。GPU 环境第一、二步已完成。本机不冻 walk / skill API。  
> **2026-09-08 主理人点选：H23 当风格帧。** 蓝本 `characters/cassandra/identity/source/h23.png`。坑与成法：`style-frame-h23-lessons-v1.md`。现网 C/E 64 不改。

## 目的

从 GPU 过程稿里点选 **一张新风格帧**（一人当蓝本，其余跟）。**已点选 H23。** 下列 1～8 波是过程稿，不当锁稿。

旧卡珊德拉 v2 **只对照外形**，不对照画法。色键 C/E/G 留色不留画风。现网 C/E 64 不改。`GenerateImage` 只做身份底和补强。

## 这轮怎么抽

| 项 | 定 |
|---|---|
| 谁当候选人主体 | **卡珊德拉**（剪影 lock-ce 左 + 色键酒红/银发/银搭扣） |
| 裁 | 全身已补（K2）。风格点选仍先认画风 |
| 第一波引擎 | **WAI v170**（`style-frame-wai-cassandra.json`） |
| 第二波 | **进行中**：3 号当底，Klein 4B 改图（`style-frame-klein-edit.json`）。竖图 768×1024，不套 GPU 参考图的 1024 方裁 |
| 落盘 | 过程稿 `_park/comfy-lan/<ISO>/`。锁稿已进 `locked/portraits/`。不写 `frames/` |

WAI 吃 Danbooru 标签。采样跟 GPU 环境说明：Euler a、28 步、CFG 6、CLIP Skip 2、832×1216。

## 过目只问

1. 这张的**画法**能不能当四人蓝本（体积、脸、光、底）？
2. 还是卡珊德拉那个人（马尾刃、酒红大衣、手空），没有串成艾德蒙/薇奥莱？
3. 要不要再开 Klein / 油画滑条当另一路候选人？

点选之后才重做四人成片。

## 第一波已交（WAI · 未过）

| # | 种子 | 路径 | 自检（未锁） |
|---|---|---|---|
| 1 | 202609081 | `_park/comfy-lan/2026-09-08T05-32-59-798Z/comfy_lan_style_c_wai_00001_.png` | 白大衣抢主体，酒红只剩内领；背上弓箭。身份偏了 |
| 2 | 202609082 | `_park/comfy-lan/2026-09-08T05-34-53-293Z/comfy_lan_style_c_wai_00002_.png` | 酒红大衣回来了；虚空底；手握拳。画法是 Illustrious 二次元 |
| 3 | 202609083 | `_park/comfy-lan/2026-09-08T05-35-37-453Z/comfy_lan_style_c_wai_00003_.png` | 同 2，双皮带更清楚。仍是二次元，不是旧 v2 半写实 |

主理人：3 的形象与整体设计可接受。3 **不当风格锁**，只当身份底。

## 第二波已交（Klein 改图 · 未过）

底图 = 3。竖图 768×1024，Euler 4 / CFG 1，CLIP 在 CPU。约 40s，未 OOM。

| # | 种子 | 路径 | 自检（未锁） |
|---|---|---|---|
| K1 | 202609084 | `_park/comfy-lan/2026-09-08T06-13-46-702Z/comfy_lan_style_c_klein_00001_.png` | 3/4 过来了，手放下，酒红大衣还在。画法仍偏二次元，体积比 3 略厚 |

主理人：K1 姿势可接受，要更骄傲的表情 + 补全身，再走绘画/虚空底。

## 第三波已交（全身 + 下一刀 · 未过）

| # | 种子 | 路径 | 自检（未锁） |
|---|---|---|---|
| K2 | 202609085 | `_park/comfy-lan/2026-09-08T06-21-50-971Z/comfy_lan_style_c_klein_full_00001_.png` | 腿和靴出来了，大衣到小腿中。表情仍偏冷 |
| K3 | 202609086 | `_park/comfy-lan/2026-09-08T06-23-02-694Z/comfy_lan_style_c_klein_paint_00001_.png` | 全身还在；眼更窄、嘴更薄，偏傲。体积略厚。大衣下摆可能偏长 |

K2 / K3 不当风格锁。**K2 是当前身份底**（脸型五官可跟，只改表情；下半身对照 C 剪影/色键收女角形 + 高跟靴）。

主理人打断（2026-09-08）：

1. K3 表情问题 = **一只眼睁、一只眼半闭**，不是要双眼等大。3/4 透视差合理。骄傲 ≠ 半闭眼。
2. K2 整体设计仍在期望上。后续抽卡把脸型五官漂了。**锁 K2 脸**（IP-Adapter PLUS FACE），不要无锁精修。
3. 下半身问题不是紧身衣，是大腿/小腿/脚/靴偏男形。对照 `lock-ce` 左 + 色键 C：收腰、大衣停小腿中、细高跟靴，禁艾德蒙方头平底粗柱。

K3 及之后无锁 WAI 精修 **退对照**（脸漂了）。

## 第四波已交（K2 锁脸 · 未过）

本机已装的是 `ip-adapter-plus_sdxl_vit-h`，走 **PLUS (high strength)** + K2 脸裁，不是 PLUS FACE（那个权重没装）。

| # | IPA | 路径 | 自检（未锁） |
|---|---|---|---|
| K2L1 | 0.72 / 后段 0.65 | `_park/comfy-lan/2026-09-08T06-52-51-541Z/comfy_lan_style_c_k2lock_00001_.png` | 高跟开始有；半闭还在；脸可能偏尖 |
| K2L2 | 0.55 / 后段 0.50 | `_park/comfy-lan/2026-09-08T06-53-53-324Z/comfy_lan_style_c_k2lock_00002_.png` | 靴跟和腿比 K2 更近 C 剪影；半闭仍在 |

半闭是 K2 脸裁上就有的。IPA 会把它当身份一起锁，提示词「双目睁开」压不过。要改表情，脸参考不能继续用带半闭的原裁。

主理人：L1 / L2 的差异是故意的（脸锁紧 vs 身锁松）。L1 表情最好，只是黑眼影过重；L2 下半身尤其靴子更好。

## 第五波已交（L1 脸 × L2 身 · 未过）

底图 = L2。脸参考 = `refs/k2l1-face.png`。denoise 0.34 保靴。IPA 0.7 拉 L1 表情。负向禁 heavy eyeshadow / panda eyes。

| # | 种子 | 路径 |
|---|---|---|
| M1 | 202609094 | `_park/comfy-lan/2026-09-08T07-34-00-640Z/comfy_lan_style_c_merge_00001_.png` |
| M2 | 202609095 | `_park/comfy-lan/2026-09-08T07-34-48-590Z/comfy_lan_style_c_merge_00002_.png` |

主理人：M1 更好。靴过亮；改暗（含跟）；脚略缩小。确认后才过。

## 第六波已交（M1 收靴 · 未过）

底图 = M1。脸裁锁表情。只动靴。

| # | denoise | 路径 |
|---|---|---|
| B1 | 0.28 | `_park/comfy-lan/2026-09-08T07-47-31-859Z/comfy_lan_style_c_m1boot_00001_.png` |
| B2 | 0.36 | `_park/comfy-lan/2026-09-08T07-48-39-472Z/comfy_lan_style_c_m1boot_00002_.png` |

## 第七波已交（M1 绒面靴 + 下装对照 · 未过）

底图 = M1。脸裁 = `refs/m1-face.png`。同种子 `202609101`，denoise 0.45，IPA 0.8。正向已去 `messy bangs` / `general`；靴主干 `charcoal suede high-heeled boots`，负向去 `stiletto`。下装只差 `black pants` vs `black pantyhose`。

| # | 下装 | 路径 |
|---|---|---|
| P1 | 黑裤 | `_park/comfy-lan/2026-09-08T08-59-48-750Z/comfy_lan_style_c_pants_00001_.png` |
| H1 | 连裤黑丝 | `_park/comfy-lan/2026-09-08T09-00-25-659Z/comfy_lan_style_c_hose_00001_.png` |

主理人：不要黑裤（军装感）；要 `black pantyhose`。负向加 `shorts, skirt`。正向写回 `stiletto`。开襟用 `open coat`（穿法，不是第二件衣服）。体型在逐次 i2i 中偏男形，下一刀收腰髋。

## 第八波已交（H1 丝袜收形 · 未过）

底图 = H1。脸裁 = `refs/m1-face.png`。种子 `202609104`，denoise 0.5。正向：`open coat` + `black pantyhose` + `stiletto heels` + `slim waist, hip curve`。负向：`shorts, skirt, pants, trousers, military uniform, masculine`。

| # | 路径 |
|---|---|
| H2 | `_park/comfy-lan/2026-09-08T09-24-34-067Z/comfy_lan_style_c_hose2_00001_.png` |

主理人：H2 图锁太死（IPA 0.78 + denoise 0.5），改鞋/光脚都不动。按新参数在 GPU 网页测通。

## 第九波已交（H23 · 主理人测通 · 未过）

底图 = H1（`hose_00001_`）。IPA **weight 0** / end_at 0.35。denoise **0.75**。种子仍 `202609104`。正向改 `matte black boots, stiletto` + `hourglass, wide hips, curvy`。负向去掉 `nsfw, nude`。

| # | 路径 |
|---|---|
| H23 | `_park/comfy-lan/2026-09-08T09-00-25-659Z/comfy_lan_style_c_hose2_00023_.png` |

主理人：衣服收多了一些但可接受；靴反光基本解决；身材好很多；无不可接受 NSFW。  
**点选：H23 = 风格帧。** `black sole` 不采用（会漂成有鞋带的鞋型）。细高跟黑靴在 WAI 里先验偏漆面，H23 的哑光是可接受结果，不再追材质词。
