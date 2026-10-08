# 立绘跟 H23 · 第十一波（刀 F · 守誓 idle 64）

> 2026-09-09 · **看稿退对照。** 四份都丢脸。改走专用像素工作流，见 `combat-64-pixel-workflow-v1.md`。不准写 `frames/`。  
> 过目：`assets/ui-menu/preview/locked/review-h23-wave11/`  
> 过程：`locked/combat-64/_park/vo-idle-o3d2/` · 开工卡：`locked/combat-64/_inspect/hero-violet-oath-idle-o3d2-job.md`

## 过目文件

| # | 文件 | 说明 |
|---|---|---|
| 01 | `01-silhouette-o3.png` | 形锁 |
| 02 | `02-color-key-d2.png` | 色锁 |
| 03 | `03-cut-d2-64.png` | D2 左人近邻入盒。无脸。**面积对照，不作锁** |
| 04 | `04-krea-a-64.png` | Krea 印戳 A · 种子 2026091101 · 入盒 22×56 · 焰约 5px |
| 05 | `05-krea-a2-64.png` | 同句第二枪 · 2026091102 · 24×56 · 焰 2px |
| 06 | `06-krea-b-64.png` | 纸切句 · 2026091103 · 29×56 · 焰 1px、银块更大 |
| 07 | `07-review-board.png` | 石板 `#2A3444` · 1x + ×4 |

Krea 源在 `_park/comfy-lan/2026-09-09T15-35-*`。未写 `frames/`。未跑 `--check`（权威帧还不存在）。

自检（给主理人看的三枪）：硬色块、长发非头巾、披裙夜灰、银在胸肩、胸前烛、3/4 朝右、洞 0。D2 切无脸故对照。A 焰偏大；B 银偏满。不代锁。

顺序（本轮自定，未改排队）：守誓 idle →（过了才）守誓者 48 idle → 守誓走 → 魔化 idle（新帧名）→ 加尔文。本波只交守誓 idle。

---

## 形象套（本帧）

| 层 | 路径 | 本帧怎么用 |
|---|---|---|
| 剪影 | `locked/silhouettes/char-bible-violet-oath-lock-o3.png` | 锁人：长发、披裙、胸前烛。不锁局内朝向 |
| 立绘 | `locked/portraits/char-bible-portrait-violet-oath-gpt-ok.png` | 只核身份。**不挂生成、不硬切（R19）** |
| 战斗设计 | `locked/color-keys/char-bible-violet-oath-color-key-d2.png` | 锁色面积。源已是硬色块，可入盒作面积对照 |

姿态语言（不是旧身份）：现网 C/E idle 为 3/4 朝右、站满高、摆贴底。形锚锁人不锁死动作，故本 idle 可 3/4，即使 O-3 近正脸。

不用：现网 `hero-violet*`（修女套，R14）、六人表、骑士、魔化、GI 当 64 条、WAI。

---

## 候选

| # | 法 | 过目名 | 说明 |
|---|---|---|---|
| 面积对照 | D2 左人近邻入盒 | `03-cut-d2-64.png` | 源已是战斗色块（C 能切的那种）。色键无脸，**不作锁稿** |
| A | Krea 印戳硬色块 · 3/4 朝右 | `04` / `05` | 64 语言直出。Enhancer 关 |
| B | Krea 色块印戳，更强调纸切 | `06` | 同引擎第二句 |

引擎：Krea 2 Turbo。不 Queue WAI。不 `GenerateImage` 走条。

---

## 不过线

- 不准写 `assets/frames/`。现网守誓帧不改。
- 不抽走 / skill。不把骑士画进本 64。
- 不硬切 `gpt-ok`。不 BOX / 中位色 / 脚本补脸灯。
- 不加呼吸。C / E / G / D2 / E1 / O-3 / F-3 不改。
- 主理人说「过」之前不停、不代锁。
