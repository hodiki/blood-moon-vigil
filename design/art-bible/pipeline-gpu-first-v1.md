# 产线裁定 · GPU 主力（2026-09-08）

> 主理人：结合路 1 + 路 3。不是厌弃现网 C/E 战斗循环，是为后续批量素材放弃一部分成片沉没成本。

## 1. 发动机

| 工具 | 角色 |
|---|---|
| 局域网 Comfy（HodikiX） | **主力。** **2026-09-23 期望：** **图片编辑与非二次元 = Qwen-Image-2.1**（`QWEN21-图片编辑.json` / `QWEN21-T2I-基础.json`；透明走 `QWEN21-T2I-透明RGBA.json` 或 `QWEN21-去背景.json`；编码器默认 `qwen3vl_8b_w4a8`；VAE `qwen_image_2.1_vae_bf16`）。**二次元风格 = Krea 2**（`KREA2-Turbo-基础.json`）。**WAI = 备用或风格化**，点名才 Queue。**走循环 = Wan Animate 2**（权重不在盘；没有就停并反馈，不准用 H3 冒充走条）。**视频 = 本机 MiniMax H3，分辨率受限**（日常 I2V 0.4MP、约 5 秒）。效果不好或需求复杂 / 更高 / 更长 / 参考视频 / 宣传级：停，反馈主理人，由主理人调线上满血 H3。助理不代调官方 API。Klein 停用，不要 Queue。Qwen / Krea / WAI / H3 分 Queue，换引擎先 `POST /free` |
| Cursor `GenerateImage` | **身份底、补强、少枪融景。** 不当锁稿、不走条、不扛魔化锚点、不当角色抽卡。条款待核 |

**引擎期望（主理人 2026-09-23）：** 上表这一行是现行分工。E1–E6 已过账不重做：Krea Identity Edit、Krea i2i 印戳、WAI H23、Wan 守誓走、本机 H3 I2V 124 都留在 `pipelines/`。Qwen-Image-2.1 还没有晋升条；新编辑第一枪仍须点名，并先有 Save (API Format)，不要现场拼节点。PE 改写（`QWEN21-PE改写.json`）只在提示词太短时点名。Krea 出图没有 alpha，要透明的非二次元图走 Qwen。Qwen 与 Krea 的 VAE 不通用。Qwen-Image-2.1 许可尚未写入 `engine-license-check-v1.md`，进 `assets/frames/` 之前补核。本机 H3 已通包络另有 T2V 0.2MP 至 15 秒、R2V 0.98MP×124、R2V 0.4MP×362；**0.98MP×362 未达**。超出日常包络或成片不行，按上表反馈，不在本机加枪硬撑。

**少枪融景（E5 · 2026-09-15 过）：** 场景工序 = **少枪优先考虑闭源融景**。调用 Cursor `GenerateImage` **前须主理人明确授权或当场确认**。条件——角色已设计好；这次不是角色抽卡；需要复杂场景和光线；未触发闭源限制；预期抽卡极少。过关：`characters/violet-fallen/identity/scene/e5-graveyard-tombstone.png` 与 `e5-church-pew.png`。Krea 路 B 相对更好、不过。姿势优化只记想法，本轮不改。不符合条件则仍走局域网 Comfy。条：`pipelines/scene-closed-source-few-shot/`。

新风格帧已点选：**卡珊德拉 H23**。后出的立绘必须跟它，不准再和卡珊德拉 v2 平均。过程经验：`style-frame-h23-lessons-v1.md`。

## 2. 留

| 块 | 为什么 |
|---|---|
| 色键 v2 的 **C / E / G** 行 | 更接近无明确画风的色面积，64 还能用 |
| 现网 C / E **已过 64**（idle / 走 / skill） | 现网继续跑。本轮不重切、不重抽 |
| 剪影形（lock-ce、G-披、Vo O-3 已过、Vf F-3 已过） | 锁的是谁，不是油画还是二次元 |
| 薇奥莱色键 | 守誓 **D2 已过**。魔化 **E1 已过**。C / E / G 行不改 |

## 3. 舍（风格成片，为统一重做）

下列**画风已写死**的成片 / 胸像退对照，新套过了再换选人：

- 卡珊德拉 v2 成片（旧「唯一风格帧」降为对照）
- 艾德蒙 / 加尔文已过或暂过成片
- 薇奥莱旧 O-焰前守 / F-魅廓，以及 Cursor / GPU 全身试稿
- 由旧成片裁的 `locked/faces/*`

不在本轮重做：C/E 局内 64。以后若要统一潮中画风，另开一波，不搭在这次立绘重开上。

## 4. 下一张画从哪来

1. ~~GPU 环境补两轮拆图。~~ 对端第一、二步已完成（WAI 精修/锁人/锁姿 + `/userdata`）。2026-09-09：非二次元主力改为 Krea 2；Klein 停用、未删盘。  
2. ~~GPU 出风格帧候选人。~~ **已点选 H23**（`characters/cassandra/identity/source/h23.png`）。  
3. ~~按 H23 重做四人立绘。~~ 身份已锁（E / Vo 双人 / Vf 优雅 / G bulk-a）。**2026-09-23：** 新立绘、图片编辑、非二次元走 Qwen-Image-2.1；二次元新图走 Krea 2；WAI 只做备用或风格化。过脸门（R24）。H23 蓝本不换。  
4. 战斗下一刀：**加尔文 idle 128** → 守誓者 192。魔化 idle 已过；**skill 待技能设计**（美术暂停）。守誓 idle / 走 / 技能 128 已过。C/E 64 仍已过。条：`pipelines/`。专武第二波。
