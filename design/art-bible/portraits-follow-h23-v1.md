# 立绘跟 H23 · 开工卡（2026-09-08）

> 风格帧已过：卡珊德拉 H23。本卡出艾德蒙 / 薇奥莱守誓 / 魔化 / 加尔文的 **WAI 全身候选人**。画法跟 H23，形跟各人剪影。现网 C/E 64 不改。不写 `frames/`。  
> 经验：`style-frame-h23-lessons-v1.md`。本波 **txt2img**（denoise 1），不用 H23 当 IPA 底（会串成卡珊德拉）。

## 采样（与 H23 同引擎）

WAI v170 · Euler a · 28 · CFG 6 · CLIP skip 2 · 768×1344 · 虚空底。

## 第一波已交（WAI txt2img · 未过）

768×1344 · Euler a 28 · CFG 6 · CLIP skip 2 · denoise 1。未点选不当锁稿。

| 谁 | 种子 | 路径 | 自检（未锁） |
|---|---|---|---|
| 艾德蒙 E1 | 202609211 | `archive/process-v1-deprecated/comfy-lan-2026-09/2026-09-08T13-47-33-351Z/comfy_lan_style_e_wai_00001_.png` | 画法近 H23。帽漂成高锥草帽；灯成路灯柱；有地面；缺身后锯齿破斗篷。身份偏 |
| 守誓 Vo1 | 202609221 | `_park/comfy-lan/2026-09-08T13-47-49-796Z/comfy_lan_style_vo_wai_00001_.png` | 她穿成银甲骑士，没有独立高个子守誓者；额巾/短披肩/长裙 O-2 没分开。身份偏 |
| 魔化 Vf1 | 202609231 | `archive/process-v1-deprecated/comfy-lan-2026-09/2026-09-08T13-48-06-229Z/comfy_lan_style_vf_wai_00001_.png` | 角、女形、黑丝、开叉近 F-3。手套太短；`hourglass` 被画成沙漏道具；红高跟。比另两张更近 |
| 加尔文 G1 | 202609241 | `archive/process-v1-deprecated/comfy-lan-2026-09/2026-09-08T13-48-22-694Z/comfy_lan_style_g_wai_00001_.png` | 狼首双足可读。披略破、偏白毛。画法略偏概念稿，仍可当身份底 |

过目只问：画法能不能跟 H23；远看是不是帽檐灯 / 额巾+骑士 / 角+开叉 / 狼首短披，没有串成卡珊德拉。

主理人量化：E1=0（WAI 可能缺训，改 Klein）；Vo1=50（脸 80 可锁，盔甲/没有两人，发须改短）；Vf1=85（去沙漏、去拟眼裂纹、高跟改黑；气质偏高贵优雅，修完可待选，另出战斗向）；G1=60（同 E，试 Klein）。

## 第二波已交（未过）

Klein 与 WAI **分 Queue**。Vo 以 Vo1 为底改图（锁脸意图）。Vf 修图 denoise 0.75、IPA 0。

| 谁 | 路径 | 自检（未锁） |
|---|---|---|
| 艾德蒙 E-K1 | `archive/process-v1-deprecated/comfy-lan-2026-09/2026-09-08T14-05-54-547Z/comfy_lan_style_e_klein_00001_.png` | 比 E1 像提灯人：破斗篷、虚空底、疲倦脸。灯在手里不是髋侧；帽仍偏尖宽 |
| 加尔文 G-K1 | `archive/process-v1-deprecated/comfy-lan-2026-09/2026-09-08T14-06-13-033Z/comfy_lan_style_g_klein_00001_.png` | 狼首双足、橄榄短披红边可读。身是肤色人身不是满毛 |
| 守誓 Vo-K1 | `archive/process-v1-deprecated/comfy-lan-2026-09/2026-09-08T14-06-35-767Z/comfy_lan_style_vo_klein_00001_.png` | **两人出来了**：她短披肩+长裙+烛，骑士在后。发已收到下巴。额巾还偏头箍 |
| 魔化 Vf-fix | `archive/process-v1-deprecated/comfy-lan-2026-09/2026-09-08T14-07-06-407Z/comfy_lan_style_vf_fix_00001_.png` | 沙漏道具没了，高跟已黑。拟眼裂纹还在。仍偏优雅 |
| 魔化 Vf-combat | `archive/process-v1-deprecated/comfy-lan-2026-09/2026-09-08T14-07-24-887Z/comfy_lan_style_vf_combat_00001_.png` | 黑高跟、开叉、黑丝。仍偏礼裙优雅，战斗感不够 |

主理人量化：E-K1=0（帽以外现代元素过浓）；Vo-K1=50（不如 WAI 独出骑士再与 Vo1 拼；Vo1 盔甲是小问题）；Vf-fix=75（腿细了，但角/女形/黑丝/开叉/手套略逊 Vf1；裂纹仍在）；Vf-combat=30（形象不差，未达「女性、魔化、战斗」）；G-K1=0（脱离设定）。

第三波方案（**已确认**）：`portraits-follow-h23-wave3-plan-v1.md`。Vo1 盔甲可留、她本人几乎锁；战斗向 Vf1 锁脸可改形；Klein 不成片；G 压痞、走继承人出奔；E v1 / G v2 作 GPT 身份辅。

## 第三波已交（未过）

Comfy 重启后重排。GPT 身份底在 `_park/comfy-lan/refs/`。WAI 成片如下。拼图是本机抠灰底，边缘有灰晕，不当锁。

| 谁 | 路径 | 自检（未锁） |
|---|---|---|
| 骑士 OK-A | `archive/process-v1-deprecated/comfy-lan-2026-09/2026-09-08T15-08-17-225Z/comfy_lan_style_ok_wai_00001_.png` | 闭面盔、暗红钢、红羽饰。可拼 |
| 骑士 OK-B | `_park/comfy-lan/2026-09-08T15-08-33-713Z/comfy_lan_style_ok_wai_00002_.png` | 闭面盔、亮银甲、红羽饰、站岗拳。金属更近 Vo1 |
| Vo 拼 A | `_park/comfy-lan/refs/vo1-ok1.png` | Vo1 原像素 + OK-A。她未改。灰晕是抠底残留 |
| Vo 拼 B | `_park/comfy-lan/refs/vo1-ok2.png` | Vo1 原像素 + OK-B |
| Vf 去脏 GPT | `_park/comfy-lan/refs/wave3-vf1-gpt-clean.png` · 过目 `archive/process-v1-deprecated/review-h23-wave3-5/review-h23-wave3/06-vf1-gpt-clean.png` | **主理人锁优雅向。** 底色变暗可接受 |
| Vf-c A | `archive/process-v1-deprecated/comfy-lan-2026-09/2026-09-08T15-09-04-269Z/comfy_lan_style_vf_combat_00002_.png` | 肩甲、皮带、手叉腰。仍偏长裙开叉+漆皮，有尾。脸偏坏笑 |
| Vf-c B | `archive/process-v1-deprecated/comfy-lan-2026-09/2026-09-08T15-09-28-859Z/comfy_lan_style_vf_combat_00003_.png` | 同上，角更红更粗。短裙没抽出来 |
| E GPT | `_park/comfy-lan/refs/wave3-edmund-gpt-identity.png` · 过目 `archive/process-v1-deprecated/review-h23-wave3-5/review-h23-wave3/09-edmund-gpt.png` | **主理人锁身份。** 与 WAI 画法差已知 |
| E i2i | `archive/process-v1-deprecated/comfy-lan-2026-09/2026-09-08T15-09-47-446Z/comfy_lan_style_e_i2i_00001_.png` | 画法近二次元。灯在髋。白眼、骷髅扣、工装靴是漂 |
| G GPT | `_park/comfy-lan/refs/wave3-galvan-gpt-identity.png` | 骨灰毛、橄榄裹披、沉着，痞气下降 |
| G i2i | `archive/process-v1-deprecated/comfy-lan-2026-09/2026-09-08T15-10-06-035Z/comfy_lan_style_g_i2i_00001_.png` | 狼首灰毛裹披红边可读。比 G1 少痞。胸针偏大 |

## 第四波已交（未过）

艾德蒙本波未动。过目请用 `archive/process-v1-deprecated/review-h23-wave3-5/review-h23-wave4/`，不要点 `_park` 长文件名。

| 谁 | 过目 | 自检（未锁） |
|---|---|---|
| 骑士暗钢 A | `archive/process-v1-deprecated/review-h23-wave3-5/review-h23-wave4/01-ok-dark-a.png` | 闭面盔、无红羽、暗钢。偏新抛光，旧蚀不够 |
| 骑士暗钢 B | `archive/process-v1-deprecated/review-h23-wave3-5/review-h23-wave4/02-ok-dark-b.png` | 同上，视缝更竖。可与 00002 对照 |
| Vo 拼暗 A | `archive/process-v1-deprecated/review-h23-wave3-5/review-h23-wave4/03-vo1-ok-dark-a.png` | Vo1 原像素。灰晕是抠底 |
| Vo 拼暗 B | `archive/process-v1-deprecated/review-h23-wave3-5/review-h23-wave4/04-vo1-ok-dark-b.png` | 同上 |
| 魔化甲 A | `archive/process-v1-deprecated/review-h23-wave3-5/review-h23-wave4/05-vf-armor-a.png` | 黑甲+露腿。有尾。脸偏年轻 |
| 魔化甲 B | `archive/process-v1-deprecated/review-h23-wave3-5/review-h23-wave4/06-vf-armor-b.png` | 更满甲、红角。有尾。比上一波礼裙更像能打 |
| 加尔文紧 A | `archive/process-v1-deprecated/review-h23-wave3-5/review-h23-wave4/07-galvan-tense-a.png` | 气质还在。仍偏瘦、偏干净 |
| 加尔文紧 B | `archive/process-v1-deprecated/review-h23-wave3-5/review-h23-wave4/08-galvan-tense-b.png` | 侧视/疤略明显。魁梧和危机仍不够 |

## 第五波已交 · 主理人裁定（2026-09-09）

艾德蒙本波未动。不写 `frames/`。

| # | 裁定 |
|---|---|
| ① | **亮银红羽可锁。** 成片：`locked/portraits/char-bible-portrait-violet-oath-gpt-ok.png`。暗钢不锁 |
| ② | `05-vf-armor2-c` **作 Vf1 战斗向备选**，不是过。`char-bible-portrait-violet-fallen-armor-c.png`。优雅 GPT 身份锁不动 |
| ③ | `07-g-vigil-b` **留**（眼神）。`char-bible-portrait-galvan-vigil-b.png`。不成身份锁 |
| ④ | 过程稿整理：**已执行**。见 `process-park-tidy-plan-v1.md` |

| 谁 | 过目 | 处置 |
|---|---|---|
| Vo 模型拼 00002 | `archive/process-v1-deprecated/review-h23-wave3-5/review-h23-wave5/01-vo-gpt-00002.png` | **已锁** |
| Vo 模型拼 dark | `archive/process-v1-deprecated/review-h23-wave3-5/review-h23-wave5/02-vo-gpt-dark.png` | 不锁 |
| 魔化甲2 A / B | `03` / `04` | 过程 |
| 魔化甲2 C | `05-vf-armor2-c.png` | **备选** |
| 加尔文警惕 A | `06` | 过程 |
| 加尔文警惕 B | `07-g-vigil-b.png` | **留** |

## 第六波已交 · 主理人裁定（2026-09-09）

| # | 裁定 |
|---|---|
| 优先 | Vf1 优雅 **仍是身份锁**：`locked/portraits/char-bible-portrait-violet-fallen-gpt-e.png` |
| 备用 | 新 A **锁为战斗向备用**：`locked/portraits/char-bible-portrait-violet-fallen-armor3-a.png`。不是过，不开 64 |
| 不锁 | 新 B、甲 C |

过目 `review-h23-wave6/`。

## 第七波已交 · 主理人裁定（2026-09-09）

警惕 B 作 i2i 底。过目 `review-h23-wave7/`。

| # | 裁定 |
|---|---|
| 锁 | 新抽 A → `locked/portraits/char-bible-portrait-galvan-bulk-a.png`。三道痕、披偏黑已知 |
| 不锁 | 新 B、警惕 B |

| 谁 | 过目 | 自检（未锁） |
|---|---|---|
| 加尔文魁 A | `review-h23-wave7/01-g-bulk-a.png` | **身份已锁** → `locked/portraits/char-bible-portrait-galvan-bulk-a.png` |
| 加尔文魁 B | `review-h23-wave7/02-g-bulk-b.png` | 不锁 |

## 第八波已交 · 主理人裁定（2026-09-09）

刀 C：**C1**。剪影跟成片。过目 `review-h23-wave8/`。不写 `frames/`。

| # | 裁定 |
|---|---|
| 选 | **C1。** |
| 过 | **O-3 = Krea `08-krea.png`。** lock：`char-bible-violet-oath-lock-o3.png`。站姿/朝向不改 |
| 排队 | `party-lineup-v4` 只换守誓列。C / E / G / F-3 旧像素 |
| 退 | O-2、排队 v3、脚本抠 `03`。不删 |
| 不选 | C2 重画成片回额巾；C3 双轨 |

| 谁 | 过目 | 处置 |
|---|---|---|
| 成片对照 | `review-h23-wave8/01-portrait-gpt-ok.png` | 已锁，不动 |
| 旧剪影 | `02-silhouette-o2.png` | 退对照 |
| 脚本抠 | `03-silhouette-o3.png` | 不作数 |
| O-3 | `08-krea.png` | **已过** |
| 排队 v4 | `04-lineup-v4.png` | 只换守誓列 |

## 第九波已交 · 主理人裁定（2026-09-09）

刀 D：**D2。** 过目 `review-h23-wave9/`。不写 `frames/`。C / E / G 不改。

| 问 | 裁定 |
|---|---|
| 面积 | **D2。** 披裙为大块，银只胸/肩，骑士中钢+红羽 |
| 语言 | **`04-gi-d2.png`** → `locked/color-keys/char-bible-violet-oath-color-key-d2.png` |
| 不选 | D1；Krea 05/06/08 |

## 第十波已交 · 主理人裁定（2026-09-09）

刀 E：**E1。** 过目 `review-h23-wave10/`。色键不要求等于风格立绘。不写 `frames/`。

| 问 | 裁定 |
|---|---|
| 面积 | **E1。** 角红跟成片更满；肤可读 |
| 语言 | **`04-gi-e1.png`** → `locked/color-keys/char-bible-violet-fallen-color-key-e1.png` |
| 不选 | E2；Krea 06/07 |
