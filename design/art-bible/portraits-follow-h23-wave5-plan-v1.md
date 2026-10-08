# 立绘跟 H23 · 第五波方案（已确认）

> 2026-09-09 · **已抽 · 已裁定。** 过目：`assets/ui-menu/preview/archive/process-v1-deprecated/review-h23-wave3-5/review-h23-wave5/`  
> ① 亮银红羽成片 **已锁**。② 甲 C = Vf1 战斗备选。③ 加尔文警惕 B **留**。④ 整理方案另纸。  
> 对照已迁：`archive/process-v1-deprecated/review-h23-wave3-5/`。不写 `frames/`。

---

## 0. 本波只跟这三条

| # | 主理人 | 评估 |
|---|---|---|
| ① | 骑士 01-dark 与 00002 **都和 Vo1 拼**，对比。锁人物，让生图模型拼，不要脚本抠图 | 同意。脚本拼只作对照，不当交件 |
| ② | 魔化战斗继续锁优雅成片；以 **A 的词** 做拓展抽卡 | 同意。脸源不变，甲从 A 的黑甲露腿往外扩，不另开礼裙 |
| ③ | 加尔文魁梧仍不足；危机用 **警惕**，禁害怕的表情和动作 | 同意。上一刀 `tense / looking to the side / wind` 容易读成慌、侧逃 |

---

## 1. 骑士拼图：为什么改模型拼

现有脚本拼（只对照，灰晕是抠底）：

- 00002 + Vo1：`assets/ui-menu/preview/archive/process-v1-deprecated/review-h23-wave3-5/review-h23-wave3/03-vo1-ok2-composite.png`
- 01-dark + Vo1：`assets/ui-menu/preview/archive/process-v1-deprecated/review-h23-wave3-5/review-h23-wave4/03-vo1-ok-dark-a.png`

骑士独张：

- 00002（亮银红羽）：`assets/ui-menu/preview/archive/process-v1-deprecated/review-h23-wave3-5/review-h23-wave3/01-vo-knight-00002.png`
- 01-dark（暗钢无羽）：`assets/ui-menu/preview/archive/process-v1-deprecated/review-h23-wave3-5/review-h23-wave4/01-ok-dark-a.png`
- Vo1（锁她）：`assets/ui-menu/preview/archive/process-v1-deprecated/review-h23-wave3-5/review-h23-wave3/02-vo1.png`

脚本拼的问题：灰底抠不净、两人光不统一、接缝假。  
一张提示词出两人：她会穿成骑士。Klein 一次改两人：毁 Vo1 脸。

**本波主路径：锁 Vo1，双参考交给 GPT（GenerateImage）。** 它已经锁过优雅去脏和艾德蒙身，适合「她不许动、只把第二人放进画面」。

描述要点：第一张人的脸、银甲、烛、发、裙 **一字不改**；第二张骑士整副甲站到她右后，明显更高，站岗不跪；虚空/纯底；烛光可以扫到他肩，但不改她。两套各出 1 张（00002 一套、01-dark 一套），过目只问：她还是不是 Vo1；骑士甲还在不在。

**备路（GPT 若改她）：** 脚本拼当 **构图底**，WAI i2i denoise **0.32–0.40**，IPA = Vo1 脸裁 0.55，`end_at` 0.35。这是保脸+收边，不是再发明骑士。仍禁止 Klein 双人、禁止 denoise ≥ 0.75。

过目并排四格：脚本-00002 / 模型-00002 / 脚本-dark / 模型-dark。点选只锁「哪套骑士 + 模型拼是否过」。

---

## 2. 魔化战斗：从 A 拓展

底与脸：

- 优雅成片（锁）：`assets/ui-menu/preview/archive/process-v1-deprecated/review-h23-wave3-5/review-h23-wave3/06-vf1-gpt-clean.png`
- 战斗 A（拓展起点）：`assets/ui-menu/preview/archive/process-v1-deprecated/review-h23-wave3-5/review-h23-wave4/05-vf-armor-a.png`

A 已对的：暗色抛光板甲、角、全身站、露腿甲缝（不是礼裙）。  
A 弱的：脸偏年轻/漂、有尾、像女骑士多过欲魔。

工作流：txt2img denoise 1，IPA 优雅脸裁 **0.55**（略高于 0.50，压年轻漂），`prompt is more important`，end_at 0.35。交 **3** 种子。

**从 A 留下的词**

`succubus, demon girl, two horns, messy dark wavy hair, dark armor, black plate armor, demonic armor, shoulder armor, gauntlets, fitted, slim waist, wide hips, full body, standing, looking at viewer`

**拓展（本波新加）**

| 加 | 作用 |
|---|---|
| `dark navy armor, glossy metal` | 跟 A 的甲色 |
| `high-cut armor, thigh gap, armored leotard` | 保住 A 的露腿甲，而不是拖裙 |
| `horned pauldron, sharp plates` | 魔化甲，不是守誓银甲 |
| `lidded eyes` | 邪魅，不是女骑士呆站 |

**负向加码**

`gown, evening dress, silver armor, gold armor, wine-red coat, silver ponytail, nun, candle, knight, wings, hourglass, floating eyes, scared, young child`

尾：A 有尾。本波 **不强制**；三张里不写 `tail`，让甲和脸优先。若主理人要尾，下一刀再加。

过目只问：是不是优雅成片那张脸；是不是 A 那路黑甲能打，而不是礼裙或守誓骑士。

---

## 3. 加尔文：魁梧 + 警惕（不是怕）

底仍是 GPT 气质稿：`assets/ui-menu/preview/archive/process-v1-deprecated/review-h23-wave3-5/review-h23-wave3/12-galvan-gpt.png`  
上一刀不够：`assets/ui-menu/preview/archive/process-v1-deprecated/review-h23-wave3-5/review-h23-wave4/07-galvan-tense-a.png` · `08-galvan-tense-b.png`

`tense, looking to the side, wind` 会画成侧身要跑、风吹披。改成 **盯着看、耳立、肩厚、随时能动手**，表情仍沉着。

| | |
|---|---|
| denoise | **0.48–0.55**（上一刀 0.42 几乎没加体量） |
| IPA | 0 |
| 姿态 | 仍全身站立立绘，不是奔跑帧 |

正向加：`broad shoulders, bulky, thick chest, muscular, vigilant, alert, sharp gaze, looking at viewer, ears up, ready stance`  
明确不写：`tense, scared, fear, running, looking back, wind, cowering`  
负向加：`scared, fear, crying, running, looking away, skinny, cute, polished`

交 2 张。过目只问：肩是不是厚了；是不是警惕而不是害怕；还是不是那只狼。

---

## 4. 确认后交件

| 序号 | 什么 | 张数 |
|---|---|---|
| Vo 拼 | GPT：Vo1+00002、Vo1+01-dark 各 1 | 2 |
| （仅 GPT 改她时） | WAI 低 denoise + Vo1 脸 IPA | 0～2 |
| Vf-c | A 词拓展，锁优雅脸 | 3 |
| G | GPT 底，魁梧+警惕 | 2 |

艾德蒙不动。脚本拼只放对照栏。

顺序：GPT 双拼（不占 Comfy）与 WAI 战斗向 / 加尔文可错开 Queue。

---

## 5. 不做

- 不改 Vo1 衣脸、不改两张 GPT 锁、不改 H23、不写 `frames/`
- 不以脚本抠图当正式拼图
- 不用 Klein 出双人
- 不加尔文写逃跑、侧视、害怕
- 不把战斗向退回礼裙词

---

## 6. 已交（未过）

过目短名。脚本拼只对照。GPT 备路未跑（她衣烛甲还在，不是换人；是否够锁由主理人判）。

| 过目 | 什么 | 过程稿 |
|---|---|---|
| `00-vo1.png` | Vo1 原图对照 | wave3 `02-vo1.png` |
| `00-script-00002.png` | 脚本拼 00002（灰晕） | wave3 `03-vo1-ok2-composite.png` |
| `00-script-dark.png` | 脚本拼 01-dark（灰晕） | wave4 `03-vo1-ok-dark-a.png` |
| `01-vo-gpt-00002.png` | 模型拼 Vo1+亮银红羽 | `_park/comfy-lan/refs/wave5-vo1-ok-00002.png` |
| `02-vo-gpt-dark.png` | 模型拼 Vo1+暗钢无羽 | `_park/comfy-lan/refs/wave5-vo1-ok-dark.png` |
| `03-vf-armor2-a.png` | 战斗拓展 A · seed 202609501 | `2026-09-08T16-16-19-315Z` |
| `04-vf-armor2-b.png` | 战斗拓展 B · 202609502 | `2026-09-08T16-16-45-850Z` |
| `05-vf-armor2-c.png` | 战斗拓展 C · 202609503 | `2026-09-08T16-17-10-473Z` |
| `06-g-vigil-a.png` | 加尔文警惕 A · 202609521 · denoise 0.50 | `2026-09-08T16-17-29-060Z` |
| `07-g-vigil-b.png` | 加尔文警惕 B · 202609522 | `2026-09-08T16-17-45-665Z` |

主理人裁定：见开工卡第五波表。锁稿副本在 `locked/portraits/`。
