# 立绘跟 H23 · 第四波方案（待确认）

> 2026-09-08 · **已抽。** 过目已迁：`assets/ui-menu/preview/archive/process-v1-deprecated/review-h23-wave3-5/review-h23-wave4/`  
> 对照：`assets/ui-menu/preview/archive/process-v1-deprecated/review-h23-wave3-5/review-h23-wave3/`  
> 本轮补裁定：魔化优雅 GPT 去脏、艾德蒙 GPT 身 **已锁身份**。  
> H23 仍是风格帧。现网 C/E 64 不改。不写 `frames/`。

---

## 0. 裁定（含补意见）

| # | 裁定 |
|---|---|
| ① | 骑士 **00002 待定**。另开 O-flame 路骑士，可大改。Vo1 不改 |
| ② | **魔化优雅 GPT 去脏已锁。** 去沙漏/裂纹优秀。底色变暗，问题不大。取消对 Vf1 原图 inpaint。原「GPT 弃用」作废 |
| ③ | 战斗向再换 **魔化盔甲**，可大改。脸改锁 **优雅成片**（不再锁未去脏的 Vf1 原图） |
| ④ | **艾德蒙 GPT 身已锁。** 帽/破披/灯/中年风霜都对。唯一剩：画法与 WAI/H23 略不同。取消往 v1 换脸、取消再修骷髅扣/工装靴 |
| ⑤ | 加尔文 GPT 气质对，太干净。补逃跑紧张/危机，体格更魁梧 |

Klein 成片仍不开。

成片落盘（身份锁，不是 64）：

- 魔化优雅：`locked/portraits/char-bible-portrait-violet-fallen-gpt-e.png`
- 艾德蒙：`locked/portraits/char-bible-portrait-edmund-gpt.png`

---

## 1. 评估：这两条锁了，工作流怎么改

### 魔化优雅

GPT 去脏已经完成「锁大部 + 去两处脏」。再对 Vf1 原图 inpaint 是重复且有漂脸风险。  
GPU 局部重绘能力仍记着，**本波优雅向不用。** 暗底不修。

战斗向 IPA 脸裁改从 GPT 优雅成片裁，避免两套脸。

### 艾德蒙

第三波 WAI i2i（denoise 0.56）把画法拉近二次元，但换来白眼、骷髅扣，脸也年轻化。主理人现在认 GPT 身，说明 **身份优先于跟 WAI 线。**

| 做法 | 判断 |
|---|---|
| 再 i2i 0.50+ | **禁止**（已证明毁脸） |
| 低 denoise 0.28–0.35，IPA=0，只为赛璐璐 | 可选。可能略损体积光；失败则退回 GPT 锁 |
| 本波不动，接受与 H23 的画法差 | **默认。** 四人风格完全齐再另开「E 跟帧」小刀 |

建议默认 **本波不再动艾德蒙。** 若确认要跟 H23，只准一刀低 denoise，GPT 锁当退路。

### 图片编辑 / inpaint

不再是本波关键路径。节点仍在，骑士/加尔文/战斗向用 txt2img 或轻 i2i。

---

## 2. 本波仍要抽的人

采样：WAI v170 · Euler a · 28 · CFG 6 · CLIP skip 2 · 768×1344。

### ① 守誓骑士（不变）

Vo1 不动。00002 待定。另出暗钢骑士：借 O-flame 的熏黑旧钢、闭面窄视缝、肩后阴影；不借修女、金狮、油画、红羽。txt2img denoise 1，IPA=0。交 2 张再拼。

### ③ 魔化战斗（脸源改成片）

| | |
|---|---|
| 脸 | **GPT 优雅成片** 脸裁，IPA **0.50**，end_at 0.35 |
| 身 | txt2img denoise 1，不要全身 i2i 礼裙底 |
| 要 | `dark armor, demonic armor, black plate`，角仍在 |
| 不要 | 亮银守誓甲、酒红大衣、礼裙、翼、沙漏、拟眼 |

交 2 种子。

### ⑤ 加尔文（底改 GPT 锁气质那张）

第三波 G i2i 已偏干净二次元，再洗容易丢 GPT 的出奔气。底用 **GPT 加尔文**。

| | |
|---|---|
| 底 | `_park/comfy-lan/refs/wave3-galvan-gpt-identity.png` |
| denoise | **0.38–0.45**（改体量与紧张，不换人） |
| IPA | 0 |
| 加 | `broad shoulders, bulky, worn cape, tense, alert, looking to the side, wind` |
| 禁 | `skinny, cute, polished, tattered cloak, sleeveless, emblem, human skin` |

交 1～2 张。

### ④ 艾德蒙

**默认不抽。** 可选跟帧刀见 §1，须主理人点名。

---

## 3. 本波交件

| 序号 | 交什么 | 张数 |
|---|---|---|
| OK-C | O-flame 路暗钢骑士 | 2 |
| Vo 拼 | 点选骑士 + Vo1 | 视点选 |
| Vf-c | 魔化盔甲 + 优雅成片脸 | 2 |
| G | GPT 底，魁梧+紧张 | 1～2 |
| E | 默认不交；点名才低 denoise 一刀 | 0 或 1 |

顺序：骑士与战斗向 txt2img（战斗向要先裁优雅成片脸）→ 加尔文 i2i。

---

## 4. 明确不做

- 不改 Vo1、H23、C/E 64，不写 `frames/`
- 不对 Vf1 原图 inpaint，不弃用 GPT 优雅去脏
- 不把艾德蒙再洗成 E i2i 那张
- 不把 O-flame 油画当风格锁
- 不把加尔文洗回 G1 痞气
