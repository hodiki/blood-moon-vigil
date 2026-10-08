# 立绘跟 H23 · 第三波方案（已确认）

> 2026-09-08 · **主理人已拍板**，按本文抽。  
> 上游：`portraits-follow-h23-v1.md` · `style-frame-h23-lessons-v1.md` · `character-art-bible-v1.md` §3–5 · `violet-identity-rebrief-v1.md`  
> 现网 C/E 64 不改。不写 `assets/frames/`。H23 仍是唯一风格成片。

---

## 0. 已拍板

| # | 裁定 |
|---|---|
| A | **守誓 Vo1 盔甲暂留。** 先拼「她 + 独立骑士」。若只看她、不考虑骑士，主理人可给到 **95，几乎可锁。** 本波 **不改她的脸、发、甲、烛**，只加骑士 |
| B | **魔化战斗向：从 Vf1 锁脸，其余可大幅改**（含短裙、局部盔甲等）。F-3 拖地礼裙只约束优雅向，不约束战斗向 |
| C | **本波不用 Klein 出成片。** 问题可能是没有完备使用方案（与当初裸用 WAI 同类）。确认是模型墙再换第二引擎；4070 实测好于评估，可试更高配模型（须另批下载） |
| D | 加尔文气质：**皇族/出奔**，压 G1 的痞气。现网文案仍是「狼王养子、今夜叛逃」；立绘读成 **狼穴继承人出奔**（披是残余贵重裹披，不是街头绑带）。改叙事另开文案，本波只锁气质 |
| E | `char-bible-portrait-edmund-v1` / `char-bible-portrait-galvan-v2` **可作身份辅。** Cursor `GenerateImage`（GPT image）按计划出身份底，不当锁稿、不跟 H23 平均油画风 |

---

## 1. 第二波诊断（仍有效）

量化：E-K1=0 · Vo-K1=50 · Vf-fix=75 · Vf-combat=30 · G-K1=0。

根因：**引擎分工错、词在问没有的先验、改图切太深。** Klein 成片当代化/去毛；Vo 一张图求两人毁脸；Vf 全身 0.75 打坏 85 分底；`combat dress` 无先验退回礼裙。

Vo1 现升格：盔甲可留，她本人几乎锁。双人仍靠拼图，不靠一张提示词。

---

## 2. 总策略

### 2.1 引擎本波

成片仍跟 H23：**WAI v170 · Euler a · 28 · CFG 6 · CLIP skip 2 · 768×1344。**

| 工具 | 本波干什么 |
|---|---|
| `GenerateImage` | 艾德蒙、加尔文身份底（ref = 旧成片+剪影）；Vf1 局部去脏辅。**不当锁稿** |
| WAI i2i | 把 GPT 身份底拉向 H23 画法（denoise 中，IPA=0） |
| WAI txt2img | 骑士独张 |
| WAI txt2img + IPA 脸 | 魔化战斗向（脸=Vf1 裁，身体新抽） |
| 本机拼图 | Vo1 原像素 + 骑士 |
| Klein | **不开** |

Klein 与 WAI 分 Queue、IPA 与 OpenPose 不同图：仍守。H23 不当 IPA 底。旧成片 **不当 WAI IPA 风格底**（会把油画平均进 H23）；只进 GPT ref。

### 2.2 提示词语言

WAI 吃 Danbooru 短标签。稀有形靠底图锁，不靠自造词（`night-watch hat`、`combat dress`）。

| 目的 | denoise | IPA |
|---|---|---|
| 新衣服（战斗向） | 1.0 txt2img | **仅脸** 0.45–0.55，end_at 0.35，`prompt is more important` |
| GPT 底 → H23 | **0.50–0.62** | 0 |
| 拼图收边 | **0.22–0.30** | 0 |
| 全身 0.75 修 Vf1 | **禁止** | — |

### 2.3 GenerateImage 怎么用（本波写死）

- 只做身份底和去脏辅，过目仍看 WAI 成片。
- 描述里写清：**2D 动画赛璐璐、全身站姿表、虚空底**；禁止写实、油画、3D。
- 身份跟 ref 图（帽檐灯 / 狼首裹披 / Vf1 脸与角）；不要把卡珊德拉 H23 当 ref（会串人）。
- 落盘进 `_park/comfy-lan/refs/`，不进 `locked/portraits/`。

---

## 3. 艾德蒙

**形：** lock-ce 右。帽檐横条、背后锯齿破斗篷、灯在髋/腿侧、疲倦成人、巡夜炭灰。  
**身份辅：** `char-bible-portrait-edmund-v1.png`（提灯、破披、帽、疲倦脸是对的）。  
**禁：** 衬衫领带、当代风衣、工装靴、路灯柱、举顶灯。灯：外挂或手提贴髋。

### 工作流

1. GPT：ref = edmund-v1 + lock-ce。把写实夜巡人画成 **H23 那种二次元全身表**，保住帽/破披/髋侧灯，去掉现代衣。
2. WAI i2i 该底，denoise 0.55 左右，IPA=0。正向只写大衣/破披/提灯/疲倦，负向打领带衬衫路灯。帽形交给底图，不写 `witch hat`。
3. 交 GPT 底 + WAI 1～2 张。

正向（WAI）：

```
masterpiece, best quality, amazing quality, very aesthetic, newest, 1boy, solo, adult man, tired face, stubble, full body, standing, three-quarter view, looking at viewer, hat, brim, dark cloak, tattered cloak, ragged cape, jagged hem, long dark coat, oil lantern, lantern, belt, dark boots, simple background, solid color background
```

负向：

```
necktie, suit, collared shirt, dress shirt, hoodie, jeans, sneakers, zipper, khaki, fedora, trench coat, witch hat, straw hat, top hat, street lamp, lamppost, scenery, 1girl, silver ponytail, wine-red coat, extra limbs, extra digits, lowres, worst quality, nsfw
```

---

## 4. 守誓

**她 = Vo1 原图，本波当脸/衣/烛的准锁（95）。** 不改发、不去甲。  
**缺的只有第二人。** 骑士 WAI 独出 → 本机拼：她前景，他右后、明显更高。  
收边 denoise ≤ 0.28；再高会动她的脸。衣改 O-2 额巾披肩放到双人过目之后。

骑士正向：

```
masterpiece, best quality, amazing quality, very aesthetic, newest, 1boy, solo, adult, full body, standing, three-quarter view, looking to the side, full plate armor, closed helmet, plume, dark steel, pauldrons, gauntlets, guard stance, simple background, solid color background
```

负向：

```
1girl, woman, candle, kneeling, damaged armor, gold armor, dress, skirt, extra limbs, extra digits, lowres, worst quality, nsfw, scenery, chibi
```

交骑士 2 张 + 各一版与 Vo1 的拼图。

---

## 5. 魔化 · 优雅向（Vf1 去脏）

Vf1=85 仍是优雅待选。不全身 i2i。

拟眼裂纹是 **恶魔女海报先验**，源图已有；负向清不掉。`hourglass` 禁写正向。

本波：GPT 以 Vf1 为 ref，**同一人**，去掉沙漏、去掉背景拟眼裂纹、红高跟改黑，其余不动。再可选 WAI denoise ≤ 0.28 收边。

---

## 6. 魔化 · 战斗向（锁脸，身可大改）

立绘仍是全身站姿表，不是战场插图。  
**脸/角/发色跟 Vf1**（IPA 脸裁）。身体允许短裙、局部甲、皮带、不同开叉，只要仍是 **能打的欲魔**，不是猎魔人、不是守誓骑士本人、不是晚会礼裙。

| 层 | 要 | 不要 |
|---|---|---|
| 脸 | Vf1 | 卡珊德拉、另一张脸 |
| 身份 | 半魔、邪魅、独行 | 堕修女、持烛、第二人 |
| 战斗衣 | 短裙/开叉、局部甲、皮带、贴身 | 拖地礼裙、蕾丝珠宝、H23 酒红大衣 |
| 态度 | 盯人、重心偏一腿 | 贵妇端着、猎人扬下巴 |
| 画面 | 纯底全身 | 战场、刀光、碎布、翼 |

### 词

身份（必留）：`succubus, demon girl, two horns, messy dark wavy hair`

战斗衣（本波主加，可组合）：

| 词 | 作用 |
|---|---|
| `short skirt, miniskirt, high slit` | 短裙能抬腿 |
| `pelvic curtain, thigh strap` | 夜行，不是礼裙拖尾 |
| `shoulder armor, waist armor, dark metal` | 局部甲；负向仍禁 `full plate, knight` |
| `leather, straps, buckles, fitted` | 能绑紧 |
| `long black gloves, detached sleeves` | 上臂断开 |
| `black pantyhose, black high heels, stiletto` | 仍女形 |
| `hand on hip, weight on one leg, lidded eyes, evil smile` | 态度 |

禁：`combat dress`（无先验）、`gown, evening dress, elegant, noble`、`proud, smug, chin up, hunter`、`nun, candle, hourglass, wings, dark aura, floating eyes`、`silver ponytail, wine-red coat`。

负向草案：

```
gown, evening dress, lace, jewelry, earrings, wedding dress, nun, candle, full plate armor, knight, wings, halo, magic circle, floating eyes, extra eyes, tentacles, hourglass, red heels, silver ponytail, wine-red coat, extra limbs, extra digits, lowres, worst quality, nsfw, nude, scenery
```

工作流：txt2img denoise 1 + IPA **Vf1 脸裁** 0.50 / end_at 0.35。不把 Vf1 全身当 i2i 底（会锁死礼裙）。交 2 种子。

---

## 7. 加尔文

G1=60 能认狼，但 **痞**（露臂、胸口图腾、破披、白毛街头感）。G-K1=0 弃用。  
**身份辅：** `char-bible-portrait-galvan-v2.png`（狼首、骨灰毛、橄榄裹披、暗红滚边、琥珀眼、沉着）更接近「出奔的继承人」。

气质：克制、疲倦尊严、衣曾贵重而磨损。不是混混，不是健身房狼，不是家犬。

### 工作流

1. GPT：ref = galvan-v2 + lock-v2。二次元全身表；骨灰毛；橄榄**裹身**短披+暗红滚边；无胸口大纹、无露臂绑带痞气。
2. WAI i2i denoise 0.52 左右。正向强调 grey fur / short cape / olive / red trim / wrapping；负向 human skin, white fur, tattered cloak, emblem, sneakers。
3. 交 GPT 底 + WAI 1～2 张。

正向（WAI）：

```
masterpiece, best quality, amazing quality, very aesthetic, newest, 1boy, solo, furry, anthro, wolf, grey fur, snout, pointed ears, amber eyes, scar, muscular, broad shoulders, full body, standing, two legs, looking at viewer, short cape, olive green, red trim, wrapping, tunic, dark boots, noble, dignified, simple background, solid color background
```

负向：

```
human skin, pale skin, human face, kemonomimi, white fur, quadruped, four legs, tattered cloak, trench coat, necktie, sneakers, chest jewel, emblem, sleeveless, 1girl, silver ponytail, wine-red coat, lantern, hat, extra limbs, extra digits, lowres, worst quality, nsfw, scenery
```

`noble, dignified` 在 WAI 里可能偏礼服——若漂成披风过长，下一刀去掉这两词，改靠 GPT 底的气质。

---

## 8. Klein 与第二引擎（本波不装，只记账）

裸用 Klein 4B 失败，不等于 Klein 不能用，等于 **没有方案**（自然语言怎么写时期服装、怎么 ref、出了构图谁来画成 H23）。

完备 Klein 方案（以后才写）：只出构图/灯位/双人站位 → 立刻 WAI 重画；禁止 Klein 设计当代衣橱；禁止 Klein 成片过目。

若以后确认是模型墙，再批第二引擎（4070 8GB + lowvram，实测已能 WAI 768×1344 与 Klein 4B）：

| 候选 | 为什么可能 | 风险 |
|---|---|---|
| 写完 Klein 配方再试 4B | 成本最低 | 仍可能当代化 |
| 同系列更大 Klein / 量化权 | 身份理解可能更好 | 8GB 可能只有 Q4 |
| 其它 Illustrious / NoobAI | 仍二次元，帽/披标签或不同 | 画法可能离 H23 |
| Pony | 衣物标签强 | 画法跳，要单独跟帧 |
| 更大 Flux 系 | 构图强 | 显存、且更偏写实 |

**未点名不下模型。** 本波不换引擎。

---

## 9. 本波交件

| 序号 | 交什么 | 过目只问 |
|---|---|---|
| E | GPT 身份底 + WAI i2i | 是夜巡人还是衬衫领带？画法能不能跟 H23？ |
| Vo-k | 骑士独张 ×2 | 闭面盔、能站她身后变高？ |
| Vo | Vo1 **原图** + 骑士拼图 | 她还是 Vo1 吗？是两人吗？ |
| Vf-e | Vf1 去脏（GPT） | 沙漏/裂纹没了？高跟黑了？脸还是她？ |
| Vf-c | 锁脸战斗向 ×2 | 是 Vf1 的脸吗？能打还是礼裙/女骑士/猎人？ |
| G | GPT 身份底 + WAI i2i | 是出奔的狼裔皇子，还是痞、白毛、贴头人身？ |

不做：改 C/E 64、改 H23、写 `frames/`、H23/旧成片进 WAI IPA、一张词出守誓双人、`hourglass` 正向、Klein 成片。
